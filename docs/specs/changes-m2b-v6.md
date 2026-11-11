# Spec changes M2b v6 (M2b task 2b.7, tuning pass, first part)

Owner: Lead Game Designer, 2026-11-11. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, QA. Status: draft; decisions D62-D67 (team), owner-review items in docs/handoffs/designer-2026-11-11.md.
Every changed line in docs/specs/rules.md, balance.md and expedition.md is marked "(M2b v6)". Problems: 1 heat is not a real choice (B58 -9.6 pp, B56 6.8 %; docs/reports/balance-2026-11-11.md), 2 the Rogue is the weak class (B6 P0 spread 15.4 pp; Z1-Z2 deaths; owner playtest docs/feedback/2026-11-11-0803-owner.md), 3 Packed Satchel's free potion (owner idea, agreed once per fight), 4 the end boss lasts 42 rounds (B16 30-40).

Type: **number** = src/constants.js only; **mechanic** = engine code (exact behaviour below); **bot** = sim/ change; **target** = a balance target or its definition.

## Evidence

Designer scratch: `git clone --shared` copies of main 7893adc (engine = 730146d of the sim's 11-11 measure plus the dev tools, no rule change) in the git-ignored sim/out/v6/var/*, constants changed by sed; the boss multipliers and the free potion were patched into the scratch engine behind environment switches (X_BH boss HP, X_BD boss damage, X_FP free potion), so one copy runs every arm. Planner cells start from the sim's 11-11 warm-up risk table (sim/out/h11/m/warm, copied); PALL cells from one PALL table built on the unchanged engine (500 runs per class from it). Seeds 1000 onward, paired by class and seed across arms. The unchanged copy reproduces the sim's 11-11 cells run for run (hm2 300 per class: 30.0 / 46.3 / 45.3 %). Exploration 300 runs per class; the final package 1 000 per class (P0 and PALL planner cells). Variants: hm<x> = planner with heat terms and hour weight x; heat-seek / heat-avoid = H.6 policies (0.5 / 4); "old planner" = the sim's noHeat variant (no heat terms, weight 2, the planner of 11-10e), used as a stand-in for a player who spends hours freely (it reaches the boss at 140 h; the owner's runs 148 h).

**Package** (rows 1-8 together, final cells, 1 000 per class, P0 unless named):

| Cell | Rogue | Mage | Hunter | All | Reach | Hours at the boss | Hot runs | Boss rounds | Before (11-11, same seeds) |
|---|---|---|---|---|---|---|---|---|---|
| planner (weight 3) | 37.3 | 31.5 | 35.6 | **34.8** | 78.3 | 117 | 0 % | 37 | 38.5 % (weight 2: 28.7 / 44.1 / 42.6), 42 rounds |
| heat-seek | 37.0 | 32.7 | 38.4 | 36.0 | 80.7 | 139 | 65 % | 39 | 36.6 % |
| heat-avoid | 36.0 | 31.4 | 35.6 | 34.3 | 78.3 | 115 | 0 % | 37 | 46.2 % |
| planner, weight 2 | 36.3 | 31.0 | 30.7 | 32.7 | 82.5 | 134 | 36 % | 38 | 38.5 % |
| old planner | 36.2 | 32.3 | 36.2 | 34.9 | 80.4 | 140 | 60 % | 38 | 35.2 % (28.4 / 36.9 / 40.2) |
| planner PALL (weight 3) | 77.1 | 69.8 | 78.1 | **75.0** | 91.5 | 114 | 0 % | 37 | 76.0 % (weight 2) |

Checks on the package: B58 seek - avoid **+1.7 pp** (-0.3 - 3.7; was -9.6); B56 (redefined) (a) seek - planner +1.2 pp (-0.8 - 3.2), (b) 80.4 % of seek's wins Hot; old B56 (diagnostic) 0.0 %; B57 0.0 pp (the weight-3 planner enters no Hot node; at weight 2 +2.1 pp, 0.8 - 3.4); B1 planner 34.8 % (band 20-35; the weight-2 planner before: 38.5 %, fail); B6 P0 spread 5.8 pp, largest deviation 3.3 pp (was 15.4 / 8.1); B16 end boss 37 rounds (was 42); B3 planner PALL 75.0 % (band 55-75); B10 75.0 - 34.8 = 40.2 pp (20-45); B6 PALL spread **8.3 pp** (mage 69.8 %; fails by 0.3 pp); B21 Z1-Z2 18.6 % (fails, see row 6).

## Change table

| # | Constant or rule | Old -> new | Problem | Evidence | Type |
|---|---|---|---|---|---|
| 1 | ASC_PER_STEP (rules 1.7, 13) | 0.04 -> 0.02 | 1 | A planner that prices Ascendancy stays out of Hot: entering Hot costs one step, about 15 pp of boss win, and the H.3 rewards buy far less (sim 11-11). 300 per class, today's rewards: B58 -10.3 pp at 0.04, -8.3 at 0.03, **-1.9 at 0.02**; reward levers alone at 0.04 at best -6.4 pp (sim). At 0.02 the Hot band means boss +2 % to +4 %, Scorched +6 % or more | number |
| 2 | HEAT_RARITY_UP hot / scorched (rules 13, expedition.md H.3, H.4, 13) | 0.25 / 0.40 -> 0.50 / 0.70 | 1 | With row 1 (300 per class, uncompensated boss): heat-seek 45.8 -> 47.3 %, the weight-3 planner unchanged (48.8 %, never Hot), B57 at weight 2 +1.8 pp. Doubling HEAT_GAIN as well (0.70 / 1.0) added little to seek (50.1 %) and took B57 to +3.9 pp at weight 2, so HEAT_GAIN stays 0.35 / 0.50 (H.6: rarity first) | number |
| 3 | PLANNER_HOUR_MULT (balance.md 6) | 2 -> 3 | 1 | Package, 1 000 per class: weight 3 34.8 % vs weight 2 32.7 % (+2.1 pp, 0.2 - 4.1). On today's rules +8.6 pp (sim). Every planner-based bot inherits it (tactician, opener, masher) | bot |
| 4 | B56 definition (expedition.md H.6) | share of the default planner's P0 wins with a Hot node -> (a) heat-seek - planner win rate >= -HEAT_POLICY_GAP_MAX; (b) share of heat-seek's P0 wins with a Hot or Scorched node in HEAT_WIN_SHARE; the old share stays as a diagnostic | 1 | At weight 3 the default planner never enters Hot, with today's rewards, with row 2 and with both rewards doubled (300 per class each), and plays like heat-avoid (34.8 vs 34.3 %). Old B56 0.0 %. New B56: (a) +1.2 pp, (b) 80.4 %. [owner review] | target |
| 5 | BOSS_HP (rules 10.1, 13); new BOSS_DMG_MULT | 13900 -> 13066 (× 0.94); every damage of the end-boss fight's enemies × 1.17 | 4, and the difficulty cost of row 1 | Rounds of won end-boss fights 42 -> 37 (HP × 0.94; 38 at weight 2). Row 1 alone makes the game easier for a player who spends hours: old planner 33.7 -> 43.6 % (300 per class, today's rewards). The damage factor was set so the old planner keeps its win rate: 1.12 -> 40.2 %, 1.16 -> 35.2 %, **1.17 -> 34.9 %** (today 35.2 %; 1 000 per class). It shifts difficulty from slow to fast play: the weight-3 planner 48.1 % on today's rules -> 34.8 % (-13.3 pp), the old planner -0.3 pp. A uniform +4 % (HP and damage) was the first try: -12 pp everywhere, rounds 43 | number |
| 6 | CLASS.rogue.hpBase / hpPerLevel (rules 5.1) | 70 / 20 -> 100 / 21 | 2 | Rogue alone, 300, row-1/2 rules, weight 2: +8.3 pp win, +5.7 pp reach, Rogue Z1-Z2 deaths 20.3 -> 15.0 %. Alternatives on the same seeds: hpPerLevel 22 +9.3 / +1.3 reach (late only); hpBase 100 +1.7 / +4.0; hpBase 120 +3.0 / +6.0; dodgeBase 0.08 +2.7; Smoke Veil at level 8 +1.3. Package: Rogue 37.3 % (mage 31.5, hunter 35.6). Rogue Z1-Z2 deaths, same planner: weight 3 24.3 -> 21.0 %, old planner 23.6 -> 18.5 %. B21 pooled stays a fail (18.6 %): the weight-3 planner rushes the early zones (reach 78.3 % vs 82.5 % at weight 2) | number |
| 7 | SAP_TURNS (rules 7.10, 13) | 3 -> 4 | 2 (owner: "about 4 rounds") | Manual and opener only: autoplay never saps (rules 7.9 rule E, D49), so B6 and the planner do not move. Re-measured: autoplay Sap in every 2+ enemy fight costs the Rogue 12.0 pp (3 turns) and 7.3 pp (4 turns), in 3+ enemy fights 1.3 pp (300, weight 2): D49 stands. B51 Rogue opener shares: see the hand-off | number |
| 8 | Packed Satchel (rules 7.5, 11.2): free potion; META.vigor.hpPct, META.edge.powerPct (rules 11.2) | start with 3 Healing Draughts -> also: the first potion each fight costs no turn (once per fight, the end boss included); Vigor and Edge 0.01 -> 0.005 per rank | 3 | PALL weight 3, 1 000 per class, boss damage factor 1.16: the free potion +8.2 pp (72.8 -> 80.9 %, 6.5 - 9.8), almost all of it in the end-boss fight (reach +1.1 pp; excluding the end boss it gives +0.6 pp). Halving Vigor and Edge takes back 4.9 pp (B3 76.0 %); Edge 0.0025 reaches 74.8 % but drops the mage (spread 8.8 pp), so Vigor and Edge 0.005. Final (with row 5 at 1.17): 75.0 %; without the free potion 66.5 % | mechanic |

Count: 8 rows. 5 number rows, 1 mechanic (with two catalogue numbers), 1 bot constant, 1 target definition. No class content, talent or spell changes. HEAT_GAIN, HEAT thresholds, ASC_STEP_HOURS, ASC_CAP, the H.6 policies (0.5 / 4) and every band are unchanged.

## Exact behaviour

**Row 1, ASC_PER_STEP.** Constant only. `asc = min(ASC_CAP, 0.02 × floor(max(0, hours - par) / 10))`; heatView's ascIfPar follows (engine heat.js ascOver). The meter's "Boss +x %" text reads ascIfPar, so it shows 2 % steps. The sim's SIM.VAL_ASC (8 000 per 1.0 Ascendancy) stays: it is a price per unit of Ascendancy, and the boss term halves by itself.

**Row 2, HEAT_RARITY_UP.** Constant only: `{ clear: 0, warm: 0, hot: 0.50, scorched: 0.70 }`. The draw is unchanged (always made, rules 8.4). UI: the Hot reward line reads "+35 % XP and gold, 1 in 2 drops a rarity up"; Scorched "+50 % XP and gold, 7 in 10 drops a rarity up" (expedition.md H.4).

**Row 3, PLANNER_HOUR_MULT 3.** BAL constant in sim/lib/params.mjs (qa/sim/params.test.mjs compares it with balance.md 6). heat-seek and heat-avoid keep their own weights (0.5 / 4). Re-measure with it in the next full pass: B1 tactician, B5, B21, B48-B55 (opener, masher, tactician inherit the weight).

**Row 4, B56.** sim/lib/heatchecks.mjs: B56 (a) = pairedDiff(seek, planner, win) >= -HEAT_POLICY_GAP_MAX / 100; (b) = share of heat-seek's winning runs with `ht[2] + ht[3] > 0` inside HEAT_WIN_SHARE; B56 passes when both pass. Print the default planner's share as a diagnostic row (no target).

**Row 5, end boss.** BOSS_HP 13066. New constant BOSS_DMG_MULT = 1.17 (rules 13). Every damage dealt by an enemy of the end-boss fight is multiplied by BOSS_DMG_MULT at the point where (1 + asc) is applied today: damage.js snapshot (`x *= 1 + asc` for an enemy with `asc`) becomes `x *= BOSS_DMG_MULT × (1 + asc)` for Oruvath and the Shards, and the Brand tick (combat.js) becomes `BRAND_DMG × stacks × BOSS_DMG_MULT × (1 + asc) × levelMod`. Note the guard: today the multiply runs only when `asc` is non-zero; with BOSS_DMG_MULT it must also run at asc 0 (the scratch engine stored `(1 + asc) × BOSS_DMG_MULT - 1` in the unit's asc field). Shard HP stays `SHARD_HP × (1 + asc)`; Final Dark is unaffected in practice (99 999). Dungeon bosses, Camp waves and Dimmed encounters are not end-boss fights. Intent estimates use the snapshot, so they show the new numbers without other changes.

**Row 6, Rogue HP.** CLASS.rogue: hpBase 100, hpPerLevel 21 (level 1: 121 HP instead of 90; level 20: 520 instead of 470; level 60: 1 360 instead of 1 270, before STA and items).

**Row 7, SAP_TURNS 4.** Constant only: SAPPED for 4 turns (status duration 5, rules 7.10 "n turns" rule), still broken by any damage. Autoplay unchanged (rule E: the Rogue never saps).

**Row 8, free potion.** Rules 7.5 (new paragraph):
- Condition: `s.meta.satchel` and the fight's free potion is unused and the action is a legal `USE_ITEM` whose item has the potion flag (healing_draught, mana_draught, greater_healing_draught).
- Effect: resolve it exactly as the player action of the round (playerAction: the item's effect, POTION_CD from this round, STEALTH removed, Arcane Momentum reset), mark the fight's free potion used, and stop: no pet action, no enemy actions, no end of round, `f.round` and `s.stats.rounds` unchanged. The engine then waits for the next player action of the same round (legalActions as before; the potion is on cooldown). Autoplay and every bot run their policy again.
- In the engage round the engage options stay legal after the free potion (it is still round 1). In the end-boss fight it works the same way.
- Not free: a second potion in the same fight, Purifying Tonic, Spark Flask, any out-of-combat use. Without Packed Satchel nothing changes.
- Event: the item-use event gets `free: true`; UI shows "Free action (Packed Satchel)" in the log and on the item bar (the first potion of a fight shows a small "free" mark while unused). Summary potions count unchanged in meaning (free potions are counted).
- META.vigor.hpPct 0.005, META.edge.powerPct 0.005 (catalogue text "+0.5 % per rank"); ranks and costs unchanged. Saved profiles keep their ranks with the new value per rank.

## What was tried and not taken
- Autoplay Sap for the Rogue (rule E without the Sap exception): -12.0 pp Rogue win at SAP_TURNS 3, -7.3 pp at 4, -1.3 pp limited to 3+ enemies (300, weight 2). Its reach fell 21 pp at 3 turns. D49 stays.
- Smoke Veil at level 8 (+1.3 pp), Rogue dodgeBase 0.08 (+2.7 pp): too small.
- HEAT_GAIN 0.70 / 1.0 with row 2: B57 +3.9 pp at weight 2 for +2.8 pp of heat-seek.
- Free potion except in the end-boss fight: +0.6 pp PALL (B3 73.4 %), but the PALL class spread fails (11.4 pp: it was the hunter's and the mage's boss fight that the free potion helped); and the owner agreed to once per fight. Kept as the fallback if B3 fails in the full pass.
- Uniform boss +4 % (HP and damage) instead of row 5: -12 to -14 pp everywhere, end boss 43 rounds.

## Reproduce
Scratch scripts in sim/out/v6/ (git-ignored): `mkpkg.sh <name> <R1|r|none>` (a clone of 7893adc with rows 1, 2, 6, 7 and the boss and free-potion switches), `run.sh <var> <out> <runs> <variant>` (planner P0 from risk-warm-P0.json), `runp.sh` (PALL from risk-warm-PALL.json), `an.mjs label=dir ...` (win by class, reach, hours, Hot shares, Z1-Z2 deaths, boss rounds, paired differences). Final cells: `X_BH=0.94 X_BD=1.17 ./run.sh pR1 G-1k 1000 <hm3|heatSeek|heatAvoid|hm2|noHeat>`, B57 arm `./run.sh pnone G-nr-1k 1000 hm2`, PALL `X_FP=1 ./runp.sh pT1 G-fp-PALL-1k 1000 hm3` (pT1 = pR1 with Vigor and Edge 0.005).
