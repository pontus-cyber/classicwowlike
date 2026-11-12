# Spec changes M2b v13: special fights demand thought (Deathblow)

Owner: Lead Game Designer (combat and balance), 2026-11-11. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, Content Designer, Lead. **Status: implemented (d7b2776, approved by the owner 2026-11-11 21:26); folded into the main specs with "(M2b v13)" marks; this file is kept as the change record

Input: owner feedback 18:41, 18:46 and 20:57 [stated: docs/feedback/2026-11-11-1841-owner.md]; the mash report [source: docs/reports/mash-2026-11-11.md, docs/handoffs/sim-2026-11-11i.md]; combat-v2.md (4.1, 7.9, 16), rules.md 7.6-7.12, 12.4. Scratch evidence: a git-ignored copy of main 9fe4eea (src/ and sim/ in /tmp, env switches for the rows below; nothing committed), classic map, seeds 1000 onward, paired with the mash cells; the mash cells' per-run records were read with a scratch script. v12 (changes-m2b-v12.md) is untouched: its rows are pending measure and none of this package's rows depend on them.

Scope: elite, rare and dungeon-boss fights on both maps, and autoplay's engage round. Normal quest fights, grind waves, dungeon trash, Camp waves, Dimmed encounters and the end boss keep their rules (row 6 is a gated exception for a first meeting). When the Engineer builds this package, every changed line in rules.md and combat-v2.md is marked "(M2b v13)" in the same commit as the code.

## What the owner asked for
- Grind with a known rotation is fine; mashing may work there [stated: 18:46].
- Rares, elites, dungeon bosses and new enemy types must make the player stop and think; that should happen every so often [stated: 18:46].
- "Die rates should be way higher for 1 button fights" [stated: 20:57]; the Lead's reading: in the special fights [stated: Lead, same file].

## Why one button survives special fights today (mash records, classic P0)
1. **A landed wind-up costs too little.** One-button play lands 74 % of elite wind-ups (Z2-Z5) and dies in 12.7 % of those fights; with one landed wind-up the elite deals +15 % for the rest of the fight (EMPOWER_DMG), which a potion pays for [source: mash records, full runs: elite Z2+ n 1 804, landed 1 in 74 %, deaths 11 % with one landed].
2. **Potions carry it.** One-button deaths per special fight with and without potions: elite 9.6 / 15.9 %, rare 41.7 / 54.2 %, dungeon boss 25.2 / 35.7 % (full runs) [source: report, full-run fight-kind table].
3. **Zone 1 cannot tell the two apart.** Z1 elites kill one button 3.6 %, autoplay 3.1 %, the opener 3.2 %; autoplay lands 84 % of Z1 elite wind-ups, because it has no interrupt before level 6-14 and rule E uses the engage control only with two or more enemies (a Z1 elite is alone 70 % of the time) [source: mash records; rules 5.3-5.5; ELITE_ADD_CHANCE 0.30].
4. **The Z1 rare kills everyone.** Mother Thistlewick (mender, Self Heal + Thorn Lash) fights last 23 rounds and kill one button 70 %, autoplay 55 %, the opener 70 % (n 10) [source: mash records]: past FIGHT_SOFT_ENRAGE_ROUND 20 she outlasts every policy. That is not "think", it is attrition.
5. **Turn limits would not separate the policies.** Rounds per special fight, one button / opener: elite 8.3 / 7.3, rare 13.8 / 12.4, dungeon boss 12.0 / 9.8 [source: mash records, Z2+]. One-button play is not slow; it is exposed.
6. **Target choice cannot punish one button.** The default target is already mender, then caster, then lowest HP (rules 7.9), so "not choosing" hits the healer first [source: report, reading 1]. A target lever would need a worse default target, which hits casual and autoplay players in every fight, the grind included.

## The idea: the Deathblow
Every elite, rare and dungeon boss already announces one wind-up on turn 2 (round 3). v13 makes that first wind-up the fight's **Deathblow**: it hits twice as hard as today, and if it lands it leaves the enemy far stronger and the player MAIMED (potions and heals at half) for the rest of the fight. Every class has an answer from level 1 (the engage control option, Disrupt on a dungeon boss), so a player who reads the track and spends the engage round on it fights a STAGGERED enemy; a player who presses one key meets a hit that a potion no longer fixes. Autoplay answers it too (row 4), so casual play stays where it is. The grind does not change.

## Change table (the package)
Type: **rule** = engine code; **number** = constant; **data** = data-table value; **bot** = simulator policy; **target** = balance target.

| # | Constant or rule (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| 1 | **DEATHBLOW_MULT** (new; rules 7.12, combat-v2.md 16.2): × on the pct of the SIGNATURE_TURN wind-up of an elite, rare or dungeon boss (hit, rend, cleave; heals, shields and curses keep their pct, D60), on top of HEAVY_SCRIPT_MULT / CAST_SCRIPT_MULT | 1 (wind-up × 1.5) | **2.0** (Deathblow × 3.0 of the ability's pct) | B59 | Alone (×1.6): one-button elite deaths 11.5 -> 17.6 %, dungeon boss 31.2 -> 44.9 %, rare 42.3 -> 48.7 %; planner elite 0.3 -> 0.5 %, dungeon boss 2.6 -> 2.8 % [measured: scratch, 300 per class, classic P0]. It is the lever that makes one landed Deathblow a near-lethal hit in Z2+; answered, it never lands (interrupt, stun, control, Disrupt, or a full dodge, WARD or the pet for a heavy one) | rule (new constant) |
| 2 | **DEATHBLOW_EMPOWER** (new; rules 7.4, 7.12): EMPOWERED value a landed Deathblow adds (other wind-ups keep EMPOWER_DMG 0.15) | 0.15 | **1.00** (+100 % damage dealt for the rest of the fight) | B59 | Alone (0.60): one-button elite 11.5 -> 18.1 %, rare 42.3 -> 56.0 %, dungeon boss 31.2 -> 42.0 %; planner elite 0.3 -> 0.7 % [measured: scratch]. Self Shield, Self Heal and Curse Deathblows (Mawra Ironbrow, Grimmel Rootbound, Old Marrow) carry their weight through this row and row 3, since row 1 does not raise them. EMPOWERED and STAGGERED become sums of their stacks' values (a Deathblow stack 1.00, any other 0.15 / 0.30) instead of stacks × one value | rule (new constant) |
| 3 | **MAIMED** (new player status; rules 7.4, 7.5; MAIM_HEAL new): a landed Deathblow MAIMS the player for the rest of the fight: all healing the player receives × (1 - MAIM_HEAL) (potions, the free potion, heal spells, HOTs, heal-on-kill); removed at fight end, not by dispersal | none | **MAIM_HEAL 0.50** | B59; potion carry | Alone: one-button elite 11.5 -> 16.0 %, rare 42.3 -> 54.7 %, dungeon boss 31.2 -> 42.7 %, Z1 specials 18.7 -> 23.0 %; planner elite 0.5 %, dungeon boss 3.3 % [measured: scratch]. In the package it adds about +10 pp of one-button elite deaths (37.7 -> 50.0 %) and +9 pp in dungeon bosses (69.7 -> 79.0 %) [measured: arms E and C]. This is the potion limit: it binds only after a Deathblow the player did not answer, so it is answerable and readable, and it costs a planned player nothing | rule (new status) |
| 4 | **Autoplay rule E2** (rules 7.9, combat-v2.md 8): in the engage round, before rule E: if a living elite, rare or dungeon boss shows a wind-up in turns 1..INTENT_TRACK_LEN and the class's control option is legal on it, use it on that enemy (first such enemy by index; Sap allowed here for the Rogue; on a dungeon boss the option is Disrupt) | rule E only with >= 2 enemies; Rogue never Saps | **E2 in every special fight** | B61 | E2 alone: planner reach 82.7 -> 83.1 %, win 31.3 -> 32.7 %, Z1 special deaths 14.6 -> 11.0 % [measured: scratch]. With rows 1-3 it holds autoplay where it is today: reach 82.7 -> 82.3 %, win 31.3 -> 32.3 %, elite 0.3 -> 1.0 %, rare 10.2 -> 12.7 %, dungeon boss 2.6 -> 2.2 %, Z1 specials 14.6 -> 16.0 % [measured: package arm C]. One-button play never takes it (it never reads the track). Reverses combat-v2.md open choice 9 for special fights only: the planned opening keeps its edge on the dungeon boss's second wind-up (round 5) and in normal fights (O12) | rule (autoplay) |
| 5 | **Zone 1 rare HP** (rules 2.3; RARE_HP_MULT_Z1 new): rare elites of zone 1 | RARE_HP_MULT 4.5 | **3.0** (other zones keep 4.5) — **gated**: applied only if the opener line's Z1 rare deaths stay > 25 % on the package | B60 rares | Z1 rares last 23 rounds and kill every policy (one button 70 %, autoplay 55 %, opener 70 % of n 10) because they outlast FIGHT_SOFT_ENRAGE_ROUND 20 [source: mash records]. Two thirds of the HP brings the fight to about 15 rounds, under the soft enrage, so the Deathblow (row 1) decides it, not attrition. Expected: opener-line Z1 rare deaths 70 -> 15-25 %, autoplay 55 -> 15-30 %, one button stays >= 50 % through rows 1-3 [inference: rounds scale with HP; the soft enrage adds +25 % per round from 20] | data (gated) |
| 6 | **First meeting** (new; rules 7.11, 7.12; FIRST_MEET_WINDUP new): the first fight of a run in which a normal enemy template appears, that enemy's turn-2 scripted action is a wind-up (windup + cast; answered: STAGGERED -STAGGER_DMG; landed: EMPOWERED +EMPOWER_DMG 0.15; no Deathblow, no MAIMED) and its frame shows "New". Quest fights only (not grind waves, dungeon trash, Camp or Dimmed) — **gated** on B62 | first-met = familiar (16.0 vs 16.3 % think fights) | **on** | owner 18:46 "new enemy types"; B62 | Gives a new enemy type a signature move that is early, clearly telegraphed and answerable, at the grind's stakes (+15 %, not the Deathblow's). Expected: think share of first-met quest fights 16 -> 22-28 %, familiar ones unchanged; one-button quest deaths +0.1 to +0.4 pp (a brute's turn-2 Heavy Smash already lands today; the stack adds 15 % for the rest of a 5-round fight) [inference]. Kept only if one-button and autoplay quest and grind deaths move <= 1 pp (B62) | rule (gated) |
| 7 | **B59-B62** (new; balance.md 3.5, combat-v2.md 12) | none | rows below | owner 20:57 | Target rows; the package's measured values are in "Expected package result" | target |

Count: 7 rows. 3 new constants (rows 1-3), 1 autoplay rule (row 4), 1 gated data value (row 5), 1 gated rule (row 6), 1 target set (row 7).

### Levers considered and not taken
| Lever | Measured or argued | Why not |
|---|---|---|
| Potion cap per special fight (1 potion) | alone: one-button elite +1.6 pp, rare +6.5, dungeon boss +3.9; planner dungeon boss 2.6 -> 3.4 % [measured: scratch]; on top of rows 1-4: +0 pp (arm A 48.8 % elites vs arm C 50.0 %) | adds nothing once MAIMED exists, and it is a rule the player feels in every special fight, also when playing well. MAIMED is the potion limit that only an unanswered Deathblow triggers |
| Enrage on a turn limit (special fights) | rounds one button / opener: elite 8.3 / 7.3, rare 13.8 / 12.4, dungeon boss 12.0 / 9.8 [source: mash records] | one-button play is not slower, so a turn limit punishes slow classes and long rares for every policy. Kept as a reserve arm (sim cell 9) |
| STAGGER_DMG 0.30 -> 0.50 | one button unchanged; planner reach +1.4 pp [measured: scratch] | rewards answering but does not punish one button; the gap is set by the landed side |
| Raw elite or boss damage (ELITE_DMG_MULT etc.) | combat-v2.md 7: "punishes the planner as much as the masher" | not answerable |
| Target-choice counters (menders punish not focusing the healer) | default target already mender > caster (rules 7.9) | one button already focuses the healer; a worse default target would hurt the grind and casual play. Archetype counters come through the Deathblow's kind instead: a caster's is a cast (interrupt it), a brute's a heavy hit (stun, control, dodge, WARD, the pet), a mender rare's a cast verdict (interrupt), a guardian's a self-shield (interrupt or control before it lands) |

## Targets (row 7; new B59-B62, draft)
Measured on paired seeds, classic and expedition, P0 binding, PALL reported (O11). "Deaths" = deaths or resurrects per fight of that kind.

| ID | Pri | Metric | Target | How |
|---|---|---|---|---|
| B59 | P1 | One-button deaths per fight kind, onebutton bot, P0: (a) elites (not rare) (b) rares (c) dungeon bosses (d) zone 1 elite, rare and dungeon-boss fights together | (a) >= ONEBTN_ELITE_MIN (b) >= ONEBTN_RARE_MIN (c) >= ONEBTN_DBOSS_MIN (d) >= ONEBTN_Z1_MIN | full runs (fx) and the paired think replays (tk) both; full runs decide |
| B60 | P1 | Planned opening survives them: opener-line deaths per fight kind on the same fights (paired think replays of the onebutton runs), and opener full runs | elites <= OPEN_ELITE_MAX, rares <= OPEN_RARE_MAX, dungeon bosses <= OPEN_DBOSS_MAX | tk replays decide; opener full runs as a check |
| B61 | P1 | Autoplay stays playable: planner (autoplay) reach the boss and win, P0, paired with the pre-package cell; its deaths per special fight kind | reach and win within AUTO_KEEP_PP; special-fight deaths each within +AUTO_SPECIAL_PP | full runs |
| B62 | P1 | The grind stays the grind: (a) onebutton and planner deaths in normal quest fights, grind waves and dungeon trash, paired with the pre-package cell; (b) nodes between rotation think fights (the masher replayed on the onebutton runs' fights) | (a) each within GRIND_KEEP_PP; (b) THINK_SPACING band | full runs; tm replays |

Kept as they are: B48-B55 (read on the package; B48 and B55 may move, O12), B1-B6, B21, B24, B38.

## Expected package result
Rows 1-4 measured together in the scratch copy (arm C: DEATHBLOW_MULT 2.0, DEATHBLOW_EMPOWER 1.0, MAIM_HEAL 0.5, rule E2), classic P0, 300 per class (opener 30 per class against the first 30 seeds per class of the mash opener cell); rows 5-6 not built in scratch.

| Check | Today (scratch base, same seeds) | Package (arm C) | Target |
|---|---|---|---|
| One button: elite / rare / dungeon boss / Z1 specials | 11.5 / 42.3 / 31.2 / 18.7 % | **50.0 / 80.5 / 79.0 / 51.0 %** | >= 40 / 60 / 70 / 25: pass |
| One button PALL (200 per class) | 9.2 / 30.2 / 21.7 / 16.8 % | 28.9 / 63.7 / 70.9 / 51.6 % | elite misses 40 (O11) |
| Masher (rotation) P0: elite / rare / dungeon boss | 6.5 / 28.1 / 20.7 % | 42.2 / 71.5 / 71.4 % | (not a target: a rotation that ignores the track fails too) |
| Opener P0 full runs: elite / rare / dungeon boss (n 112 / 26 / 113) | 1.0 / 12.0 / 1.9 % (mash cell, same seeds) | 0.9 / 3.8 / 0.9 % | <= 3 / 25 / 5: pass (small n; B60 is read on the replays) |
| Autoplay P0: reach / win | 82.7 / 31.3 % | 82.3 / 32.3 % | within 2 pp: pass |
| Autoplay P0: elite / rare / dungeon boss / Z1 specials | 0.3 / 10.2 / 2.6 / 14.6 % | 1.0 / 12.7 / 2.2 / 16.0 % | each within +3 pp: pass |
| Autoplay PALL: reach / win | 90.8 / 58.8 % | 91.2 / 57.8 % | pass |
| Normal quest / grind / trash deaths, one button | 1.4 / 0.3 / 0.4 % | 1.3 / 0.3 / 0.4 % | within 1 pp: pass |
| Same, autoplay | 0.5 / 0.1 / 0.1 % | 0.5 / 0.1 / 0.1 % | pass |
| One button reach the boss P0 / PALL | 37.8 / 66.2 % | 9.0 / 16.7 % | (consequence; O13) |
| Masher reach the boss P0 | 56.8 % | 13.4 % | (consequence; O13) |

Package arms for reference (one button P0, elite / rare / dungeon boss / Z1 specials; planner elite / rare / dungeon boss): A rows 1-4 + potion cap 1: 48.8 / 79.7 / 80.0 / 50.3; 1.0 / 12.7 / 2.1. B DEATHBLOW_MULT 1.6, EMPOWER 0.75, MAIM 0.5, potion cap 1, E2: 40.4 / 74.0 / 73.4 / 46.9; 1.1 / 12.7 / 2.1. D rows 1, 2, 4 + potion cap: 40.3 / 75.8 / 75.5 / 44.2. E rows 1, 2, 4 only: 37.7 / 72.1 / 69.7 / 41.1 [measured: scratch]. The package takes arm C: B and D sit on the elite floor; C leaves 10 pp of margin for the expedition and rows 5-6.

Not measured: the expedition (one-button special deaths were higher there today: elite 19.0, rare 48.7, dungeon boss 44.7 % on replays, so the package should pass with more margin [inference]); the paired think replays (B59 replay column, B60); the rotation spacing (B62 b): one-button runs now end about zone 2-3, so think fights per run fall, while the spacing in nodes should stay near 4 (they come from the same normal and special fights) [inference]; rows 5 and 6.

## Exact behaviour
- **Row 1.** In track.js makeEntry, after a signature entry becomes a wind-up: if the enemy's variant is elite, rare or dboss and t === SIGNATURE_TURN and the entry deals damage (hit, rend, cleave), pct × DEATHBLOW_MULT, and the entry gets `deathblow: true` (copied to the intent). The dungeon boss's SIGNATURE_TURN_2 wind-up is not a Deathblow. The estimate on the track shows the multiplied number. Summons, Signal adds and the end boss: no Deathblow.
- **Row 2.** landWindup: a `deathblow` entry adds DEATHBLOW_EMPOWER to EMPOWERED's value; any other wind-up EMPOWER_DMG. answerWindup unchanged (STAGGER_DMG). EMPOWERED and STAGGERED keep `stacks` for the UI and store `value` as the sum of the stacks' values. Events `empower` carry `deathblow: true`.
- **Row 3.** landWindup of a `deathblow` entry also adds MAIMED to the player (dur null, value MAIM_HEAL; one status, no stacks; a second Deathblow in the same fight changes nothing). healUnit for the player: amount × (1 - value) before the cap, rounded once. Removed at fight end; not removed by dispersal (Vanishing Step, Glacial Tomb, Feign Stillness, Purifying Tonic). potionInfo (rules.js) returns the MAIMED amount so the item tooltip shows it. Event `status` MAIMED on.
- **Row 4.** autoplay.js engagePolicy, first: for each living enemy in index order with variant elite, rare or dboss whose track holds an entry with `windup` in turns 1..INTENT_TRACK_LEN: if ENGAGE(control, idx) is legal, return it. Then rule E as today. Bots that use autoplay (planner, greedy, speedrunner, the opener after its plan, tactician continuations) get E2 through the engine.
- **Row 5.** combat.js makeEnemy: a rare in zone 1 uses RARE_HP_MULT_Z1. Expedition zone 1 the same. Applied only if the gate passes (cell 6).
- **Row 6.** The engine keeps `s.met`, a set of normal template ids met in the run (added when a fight starts; saved with the run). In a quest fight, an enemy of variant normal whose template is not in `s.met` at the fight's start gets `windup` + `cast` on its turn-2 scripted entry (its pct unchanged: today's script multiplier) and `firstMeet: true` on the enemy. Answered and landed as 7.12 with EMPOWER_DMG and STAGGER_DMG; no Deathblow, no MAIMED. Grind, trash, Camp and Dimmed fights do not add to `s.met` and get no first-meeting wind-up. Behind a switch until cell 7 decides.

## What the sim must run
Engine: the package as the Engineer builds it, or a scratch copy with switches for rows 1-6 (the designer's scratch used env switches X_DB_MULT, X_EMP1, X_MAIM, X_POTCAP, X_AUTO_E2; not committed). Sim: B59-B62 in mashreport (per fight kind incl. rare split from `fc`, Z1 specials, first-met split), potions per special fight, MAIMED fights (landed Deathblows) per bot. Seeds 1000 onward, paired by class and seed with the mash cells; starting tables as the mash report (classic 11-11b warm-up tables; expedition 11-11f/g observations). Wall time from the mash run (classic 26-52 ms per run, opener about 2.3 s per run, expedition about 250 ms per run; 2 workers): **about 45 minutes**. Run in this order; cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | Classic P0: onebutton, masher, planner, package | 1 000 per class each | **B59** (full runs), **B61**, **B62 (a)**, reach / win by class | 3 min |
| 2 | Classic P0: onebutton with `--think --think-mash`, package | 100 per class | **B59** replay column, **B60** (opener line on the same fights), **B62 (b)** spacing, think share by zone and first-met split | 10 min |
| 3 | Classic PALL: onebutton, planner, package; onebutton `--think` 50 per class | 1 000 per class; 50 | B59-B61 PALL (O11) | 6 min |
| 4 | Expedition P0 with the start camp: onebutton, masher, planner, package; onebutton `--think --think-mash` 50 per class | 300 per class; 50 | **B59-B62 on the expedition** | 10 min |
| 5 | Opener full runs, classic P0, package | 50 per class | B60 check, B48, B55 (O12) | 3 min |
| 6 | Row 5 gate: cell 2's Z1 rares; if the opener line's Z1 rare deaths > 25 %, classic P0 onebutton `--think` and planner with RARE_HP_MULT_Z1 3.0 | 100 per class; 1 000 per class | row 5 gate and effect | 4 min |
| 7 | Row 6 arm: package with first meeting, classic P0 onebutton `--think` and planner | 100 per class; 1 000 per class | **B62 (a)** gate for row 6, first-met think share | 5 min |
| 8 | Expedition PALL: onebutton and planner, package | 200 per class | B59, B61 on the expedition PALL | 3 min |
| 9 | Reserve arm, only if B59 (a) or (c) fails on P0: SPECIAL_ENRAGE (special fights +0.25 damage per round from round 10), classic P0 onebutton, planner | 1 000 per class | the turn-limit lever | 2 min |

About 45 minutes. Decision rules:
- **Rows 1-4** stay if B59 (a)-(d) pass on classic P0 and B60, B61, B62 (a) pass. If B59 passes by more than 15 pp on every part and B61 fails, step DEATHBLOW_EMPOWER to 0.75 (one arm, cell 1 only) and report both.
- **If B59 (a) fails on P0** (elites < 40 %): DEATHBLOW_MULT 2.0 -> 2.4 (one arm, cells 1-2); never above 2.4 in this pass.
- **If B60 fails** (the opener line dies more than its cap in a kind): report the enemies behind it (templates with >= 25 fights); no constant change in this pass.
- **Row 5** applies only through cell 6's gate; **row 6** stays only if cell 7 moves onebutton and planner quest and grind deaths by <= 1 pp against cell 1.

Report: the mash report's tables with a v13 column; B59-B62 per map and profile; per-row effects (rows 5, 6 from cells 6, 7); the enemies with the most one-button deaths and the most opener-line deaths after the package.

## UI needs (telegraphs must be readable) — for the UI/UX Engineer
1. **Deathblow badge** on the track entry and the opening ruler: distinct from the wind-up badge (larger, own colour and icon), with the estimated damage and "MAIMS if it lands"; it must read in the engage round without hover.
2. **Its answers on the badge**: which of the player's options answer it now (engage control or Disrupt, an interrupt or stun spell off cooldown, a defensive for a heavy one), highlighted on the engage panel and the bar; "no answer ready" in red when none is.
3. **MAIMED** as a large, lasting badge on the player frame ("Healing halved"), and the potion buttons and tooltips show the halved amount.
4. **EMPOWERED from a Deathblow** shown as "+100 %" on the enemy frame (sum of stacks), separate from ordinary wind-up stacks.
5. **Log and float text**: "Deathblow answered: staggered" / "Deathblow landed: empowered, you are maimed", staggered with the other answer-moment floats (BACKLOG item "Answer moment").
6. **First meeting** (row 6, if kept): a "New" tag on the enemy frame and its wind-up badge in the first fight with that enemy type.
7. **Map tooltip** for elite and dungeon nodes: the special enemy's Deathblow name and kind (cast or heavy), so the player can plan the answer before entering.
8. **Autoplay toggle hint**: in a special fight with autoplay on, a short line "Autoplay will answer the Deathblow with <option>" in the engage round.

## Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D105 | The first wind-up of every elite, rare and dungeon boss is a Deathblow: DEATHBLOW_MULT 2.0 on its damage (row 1) | team |
| D106 | A landed Deathblow EMPOWERS the enemy by DEATHBLOW_EMPOWER 1.00; EMPOWERED and STAGGERED store the sum of their stacks' values (row 2) | team |
| D107 | MAIMED: a landed Deathblow halves the healing the player receives for the rest of the fight (MAIM_HEAL 0.50); no potion cap (row 3) | team |
| D108 | Autoplay rule E2: in special fights autoplay uses the engage control option (Disrupt on a dungeon boss, Sap allowed) on the enemy with a visible wind-up (row 4) | team; owner item O12 |
| D109 | Zone 1 rares at RARE_HP_MULT_Z1 3.0, gated on the opener line's Z1 rare deaths (row 5); first-meeting wind-up for new normal enemy types in quest fights, gated on B62 (row 6) | team |
| D110 | B59-B62 with the draft values below (row 7) | team (targets); owner item O11 |

## Owner items
| # | Question | Default |
|---|---|---|
| O11 | Do the one-button targets (elites >= 40, rares >= 60, dungeon bosses >= 70, zone 1 >= 25 %) hold with full meta (PALL) too? Measured PALL elites 28.9 % on the package (P0 50.0 %). | P0 binding; PALL reported, PALL elites floor 25 % |
| O12 | Autoplay now answers the Deathblow in every special fight (rule E2), also against a lone elite. Casual play stays as safe as today (reach 82.3 %, win 32.3 %), but the planned opening's edge over autoplay (B48, B55) shrinks in those fights; the opening still decides the dungeon boss's second wind-up and normal fights. | E2 on |
| O13 | One-button play and a fixed damage rotation become losing strategies: one button reaches the end boss in about 9 % of P0 runs (today 38-47 %), the masher in 13 % (57-64 %). Is that the intended strength? | yes (owner 20:57) |

## Constants
New or changed by this package (rules.md 13 unless stated; combat-v2.md 15 for the wind-up values).

| Constant | Old | New | Unit |
|---|---|---|---|
| DEATHBLOW_MULT (new) | 1 | 2.0 | × the Deathblow's pct, on top of the script multiplier |
| DEATHBLOW_EMPOWER (new) | 0.15 (EMPOWER_DMG) | 1.00 | damage dealt, per landed Deathblow, rest of the fight |
| MAIM_HEAL (new) | - | 0.50 | share of healing received removed while MAIMED |
| EMPOWER_DMG, STAGGER_DMG | 0.15, 0.30 | unchanged (values now summed per stack) | damage dealt |
| Autoplay rule E2 (rules 7.9) | - | on | rule |
| RARE_HP_MULT_Z1 (new), gated | 4.5 (RARE_HP_MULT) | 3.0 | × HP, zone 1 rares |
| FIRST_MEET_WINDUP (new), gated | off | on | rule switch |
| ONEBTN_ELITE_MIN / ONEBTN_RARE_MIN / ONEBTN_DBOSS_MIN / ONEBTN_Z1_MIN (B59) | - | 0.40 / 0.60 / 0.70 / 0.25 | deaths per fight, onebutton, P0 |
| OPEN_ELITE_MAX / OPEN_RARE_MAX / OPEN_DBOSS_MAX (B60) | - | 0.03 / 0.25 / 0.05 | deaths per fight, opener line |
| AUTO_KEEP_PP / AUTO_SPECIAL_PP (B61) | - | 2 / 3 | pp against the pre-package paired cell |
| GRIND_KEEP_PP (B62 a) | - | 1 | pp |
| THINK_SPACING (B62 b) | - | 4-7 | nodes between rotation think fights |
