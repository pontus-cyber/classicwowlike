# Spec changes M2b v12: the last package before the flip (v11 outcomes, the way out of the dark, the rusher, Ricochet Bolt)

Owner: Lead Game Designer, 2026-11-11. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), Lead. **Status: implemented (c0ab802); folded into the main specs with "(M2b v12)" marks; this file is kept as the change record

Input: the v11 measure [source: docs/reports/balance-2026-11-11g.md, docs/handoffs/sim-2026-11-11h.md], changes-m2b-v11.md, DECISIONS D91-D98, STATUS "Next". Where a figure says "v11 run records", the designer read the per-run files of that pass (sim worktree, sim/out/pass-v11/exp: planner-P0-exp-prep, greedy-P0-exp-prep, planner-PALL-exp-prep, speedrunner-PALL-exp-prep, arm-loot19-price2; and pass-v9v10 for the 11-11f speedrunner) with a scratch script; nothing was re-simulated.

Scope: expedition runs, plus one spell value on both maps (row 5, gated). When the Engineer builds this package, every changed line in expedition.md, rules.md and engine-api.md is marked "(M2b v12)" in the same commit as the code.

## Where v11 stands
Flip criteria 2 and 3 pass; criterion 1 fails on B43 and B12 [source: report 11-11g]. In the configuration the v11 rules decided (Delve price 2, EXPED_DROP_MULT 1.9): planner P0 22.0 %, PALL 51.6 % (48.3 - 54.8), B11 44.9 min, B43 caught 21.2 %, Dimmed share 17.4 % (43 / 247) [source: report 11-11g, cell 10; v11 run records]. B12 was not measured in that configuration.

### B43: what the second toll did (the chain)
A Dimmed encounter's own tolls do not start another encounter (src/engine/nodes.js settleExpedition), so the chain is not at one node: it is **walking through the dark**. A step that ends in a Dimmed node costs TIME_WALK 1 plus TIME_DIM_FIGHT. The front moves DIM_FRONT_HOPS / DIM_FRONT_TIME = 0.4 hop per toll, and a step away from the Shardfall adds 1 hop of distance, so the depth per outward step changes by `0.4 × (1 + TIME_DIM_FIGHT) - 1`:

| TIME_DIM_FIGHT | Tolls per step in the dark | Depth per outward step | Reading |
|---|---|---|---|
| 1 (v10) | 2 | **-0.2** | walking out works, slowly |
| 2 (v11) | 3 | **+0.2** | every step out goes deeper: no way out on foot |

[computed: expedition.md 6.2 constants]. The v11 records show it: 870 of 1 932 Dimmed encounters (45 %) directly follow another Dimmed encounter; 44 of 52 Dimmed deaths are at depth 1 or more, where death per encounter is 6.9 % (depth 1) and 28 % (depth 2+) against 0.5 % at depth 0 [source: v11 run records; report 11-11g depth table]. That contradicts expedition.md 6.3 ("the way out is to leave") and is what row 2 fixes.

### B43: why the planner is caught in a fifth of its zones
- 52 % of caught zones hold exactly one Dimmed encounter; 80 % of caught zones are still left by a Road [source: v11 run records, 532 of 1 020; 819 of 1 020].
- The planner enters 0.95 Dimming-Hot nodes per run (H.5: the node at the edge pays +35 % XP and gold and a 50 % rarity step). Every node costs at least 2 tolls and Hot means the node dims within 2, so a Hot node nearly always ends with one depth-0 encounter. Runs with a Hot entry have 2.93 Dimmed encounters, runs without 1.12 [source: v11 run records, 510 of 900 runs].
- So most caught zones are a chosen brush with the edge, bought by H.5's reward; the band 8-18 % was set on the prototype before H.5 existed (expedition.md 12, 7.3), and 9.5 already marked it "at risk": the 9.5 budget gave about 26 % caught in the model [source: expedition.md 9.5, 13 CAUGHT_ZONES note]. Row 3 re-sets the band; the danger part of B43 (Dimmed share of deaths) keeps its band.

### B12: what moved
Speedrunner PALL wins by class, same policy, 11-11f -> v11 (from SET_OUT): rogue 30.9 -> 31.8, mage 30.8 -> 31.7, hunter 28.5 -> 30.0 min, at the same fights (27.7-27.9 per win), nodes (+0.2 to +0.9) and fewer rounds [source: v11 and 11-11f run records]. So the +1.0 to +1.5 min per class is per-event time, most likely the extra gear drops of v11 rows 1-2 (PACE_LOOT_S 3 s each) and their sales [inference]; cell 10's EXPED_DROP_MULT 1.9 adds a little more. The pooled median is also 54 % hunter wins (151 of 278). Needed: about -0.8 min for the cap (30.8 -> 30.0) and -0.4 min for the ratio (31.8 against 0.70 × 44.9 = 31.4).

The expedition speedrunner is not the bot balance.md 1 specifies. balance.md 1: "path search minimising tolls to reach the zone exit level". Built (sim/bots/speedrunner.mjs speedExpMap): the planner's belief search with the full value function (XP, **gear, gold**, sites, heat) at time weight PLANNER_TIME_MULT × STYLE_SPEED_TIME_MULT. So it takes nodes for gear and gold that a rusher skips: 1.45 treasure fights, 0.14 elites and 1.7 dungeons per win [source: v11 run records]. Row 4 brings it back to its spec.

## Change table (the package)

Type: **rule** = engine code; **number** = constant; **data** = data-table value; **bot** = simulator value or policy; **target** = balance target or definition.

| # | Constant or rule (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| 1 | **v11 rule outcomes**, decided by the v11 rules, recorded as engine rows: CONTRACT.delve.price (expedition.md 2.2, 13); EXPED_DROP_MULT (rules 8.4, expedition.md 13); DUNGEON_DIM_HOLD (expedition.md 6.2, 13; rules 1.9.6); SPELL.beastcall_horn.cd (rules 5) | price 1; 1.6; 3 tolls; 12 (15 gated) | price **2**; **1.9**; **removed** (the Dungeon dims by its hops); **12** (row 8 void) | Flip 2; B4 | Measured in v11: the guard tripped (0.61 Delves abandoned per run, > 0.25) so price 2 (D93); at price 2 PALL 48.1 % < 50, cell 10 ran and 1.9 brought PALL to 51.6 % with B11 44.9 <= 48, so adopted; the hold added 4.3 pp of Delve completion < 8, so dropped; the gated Beastcall cooldown changed no run (the bots never slot it) and the attribution moved the hunter 0 pp, so void [source: report 11-11g "Decisions"]. Expected: the cell 10 numbers (P0 22.0 %, PALL 51.6 %) [measured]; removing the hold moved planner P0 -1.2 pp (-2.6 - 0.1) in arm 9c [measured] | number (outcomes, no new judgement) |
| 2 | **TIME_DIM_ESCAPE** (new; expedition.md 6.3, 13; rules 1.9.6): tolls of a Dimmed encounter that a MOVE **farther from the Shardfall** started | TIME_DIM_FIGHT 2 | **1** (every other Dimmed encounter keeps 2) | B43 Dimmed share; 6.3 "the way out is to leave" | An outward step in the dark costs 2 tolls again, so depth falls 0.2 per step instead of rising 0.2 (table above) [computed]; the first encounter (front reaches the player after a node, or a step sideways or inward) keeps 2 tolls, so row 4 of v11's price on being caught stays. Arm 9a (1 toll everywhere) had 18 Dimmed deaths against 52 [source: report 11-11g]; this rule gives 9a's escape only to outward steps: Dimmed deaths 52 -> 25-35, **share 20.2 -> 10-14 %** (17.4 -> 9-12 % at the decided configuration) [inference]. Cheaper escape makes the edge a little cheaper: caught +0 to +1.5 pp [inference]. Non-boss deaths -15 to -25 per 900 runs: planner P0 +0.3 to +0.8 pp [inference: those runs go on and win about 0.32 of their boss fights (boss win given reach, report 11-11g), some die later first] | rule (new constant) |
| 3 | B43 caught-zones band, CAUGHT_ZONES (expedition.md 6.3, 11.1, 13) | 0.08-0.18 | **0.08-0.25** (Dimmed share 0.05-0.20 and greedy close calls 0.40-0.75 unchanged) | B43 | Target change, argued above: the band predates H.5, which pays Hot at the edge, and the 9.5 budget, which the spec already marked as putting the band at risk (model about 26 %). Half of caught zones are one encounter, mostly at depth 0 (0.5 % death), after a Hot node; runs with a Hot entry hold 2.6 × the encounters [source: v11 run records]. "Caught" in those zones is the price of the reward the design offers, and B43's harm part is the Dimmed share, which keeps its band. The upper bound 25 % keeps three zones in four clean and sits under the 9.5 model's 26 %, so v11's TIME_DIM_FIGHT 2 must keep its gain. Expected with row 2: caught 21-23 % (pass), share 10-14 % (pass), close calls about 56 % (pass) [inference] | target (team; owner item O9) |
| 4 | Speedrunner map policy on the expedition (balance.md 1; expedition.md 10.2; sim/bots/speedrunner.mjs speedExpMap) | planner belief search, full value function (XP, gear, gold, sites, heat), time weight × 9 | **balance.md 1's speedrunner on the fog view**: the belief search minimises tolls + P(death) × VAL_DEATH / VAL_TIME + missing levels to 10z - 1 × VAL_XP / VAL_TIME (speedMap's cost, the rows map's rule); gear, gold and heat terms 0; its Delve sites keep their value (XP only); zone 6 and the exit rule unchanged | B12 | A rusher stops taking nodes for gear and gold: fewer treasure (1.45 fights per win), elite and Shrine detours, and Hot nodes for their reward [source: v11 run records]. Expected -1 to -2 nodes and -1 to -2 fights per win, **-0.4 to -1.0 min** (about 30-35 s per quest-sized node in autoplay: node 8.5 s, fight 3 s, about 7 rounds × 1.1 s, loot and text) [inference]; B12 from SET_OUT 30.8 (+0.1 to +0.2 for EXPED_DROP_MULT 1.9) -> **29.9-30.6 min**, ratio 0.69-0.71 [inference]. Side effect: less gear at the boss, speedrunner PALL win -1 to -3 pp (B3 speedrunner already under its band; O4) and fewer wins in the B12 sample (278 -> about 230-260, still >= 200) [inference]. Not a target change: it builds the bot the spec names | bot |
| 5 | SPELL.ricochet_bolt.bounceFrac (rules 5, Lost Technique I, hunter; PALL only) | 0.40 | **0.30** (-25 %, inside TUNE_LIMIT) — **gated**: applied only if expedition planner PALL stays >= 50 % with it | B6 PALL (both maps) | The PALL hunter's lead is Ricochet Bolt: classic PALL hunter 68.6 % with it, 54.8 % without (-13.8 pp), the other classes 58.0 / 55.0 [source: report 11-11g K2]. Its main hit equals Keen Shot (same coefficients, 5 Focus more); its edge is the two bounces (0.8 of a hit at 2-3 enemies, the end boss's Shards and dungeon packs). -25 % of the bounce: classic PALL hunter **-3 to -4 pp** (64.5-65.5 %), classic B6 PALL spread 13.6 -> 10-11 pp (still over 8: classic residue, O8) [inference: linear share of the measured -13.8 pp]. Expedition: PALL hunter 61.3 -> 58-59 %, spread 17.3 -> 14-15 pp; pooled PALL **-0.8 to -1.2 pp** [inference]. P0 untouched (PALL-only entry), so the expedition P0 order (hunter last, 15.3 %) does not get worse; P10 does not hold sp_h1 under the 8.2 order (item P10 below). A larger cut (one bounce, -50 %) would put the classic spread in band but costs pooled PALL about -2.3 pp, under criterion 2's floor [inference]; not taken | data (gated) |

Count: 5 rows. 1 records v11 outcomes (four values), 1 new rule constant (row 2), 1 target (row 3), 1 bot policy (row 4), 1 data value (row 5, gated). Rows 1-4 touch expedition runs only; row 5 both maps (PALL runs with sp_h1). Designer rows beyond TUNE_LIMIT: row 1 (decided by v11 rules), row 2. Not changed, on purpose:
- **DIM_PACK_SIZE, DIM_DMG_MULT, DIM_HP_MULT**: they raise death per encounter, which is B43's harm part; arm 9b (damage 1.6) was worse on both parts (caught 29.1 %, share 24.9 %) [source: report 11-11g].
- **Front speed** (DIM_FRONT_TIME 5 -> 6): makes walking out depth-neutral but lengthens every zone (about +2 tolls per zone, B11 +1.5 to +3 min, B20 exit levels already high) [inference]; row 2 fixes the chain where it is.
- **HEAT_DIM_HOT** (H.6's named B43 lever): narrowing Hot to 1 toll moves the Hot encounter deeper (the node then ends 2+ tolls past its dimAt) and touches B56-B58, which this pass does not measure.
- **Bell and Road costs** for B12: a third Bell charge saves about 15 s per run (one walk to the rim) [inference]; too small for the gap, and it moves B47.

### P10 under the 8.2 order (task item 5): no change to standardOrder
Under the 8.2 order P10 is satchel, vigor 1, edge 1, quick_study 1, pockets 1, ledger, scout, **cartographer**, vigor 2, edge 2; sp_(class)1 is 11th [source: sim-2026-11-11h "For the designer" 5]. Keep it:
- The standard order is the campaign's buying order; B31 (34 runs) and B32 (all three parts) pass with it on the expedition [source: report 11-11g]. Moving sp_x1 forward to protect a profile definition would re-open those.
- On the expedition (the default map after the flip) Cartographer is a free Region Charts every run (1 point), a sensible early buy at 100 Echoes; on the classic map it does nothing.
- P10 without sp_x1 is less class-skewed: sp_h1 is the PALL hunter's edge (row 5).
- B2 (WR_P10_PLANNER 0.32-0.48) is not a flip criterion. It is next measured on the expedition after the flip, with this P10; a classic-map B2 read on this P10 is classic residue (O8). The sim records which entries P10 held in the report.

### Expected package result [inference: estimated effects added, not measured together]
| Check | v11 decided configuration (price 2, 1.9) | Expected v12 |
|---|---|---|
| Planner P0 win (expedition, 900 runs) | 22.0 % | 22-23 % (row 2 +0.3 to +0.8) |
| Planner PALL win (expedition, 900 runs) | 51.6 % (48.3 - 54.8) | **50.5-52 %** (row 5 -0.8 to -1.2; row 2 +0.5 to +1.5: PALL has 54 Dimmed deaths of 143 non-boss deaths, 37.8 % [source: v11 run records], and wins about two in three boss fights); row 5 is gated on >= 50 % |
| B43 caught / Dimmed share / greedy close calls | 21.2 / 17.4 / 56.0 % | 21-23 % (band 8-25) / 9-12 % / 50-60 % |
| B11 / B53 | 44.9 / 16.5 min | 44.5-45.5 / 16-17 min |
| B12 from SET_OUT / ratio | not measured (30.8 at price 1, 1.6) | 29.9-30.6 min / 0.69-0.71 |
| B6 PALL spread, classic / expedition | 13.6 / 17.3 pp | 10-11 / 14-15 pp |
| B39 planner P0 / PALL / greedy | 57.3 / 69.9 / 4.0 % (price-2 arm; PALL and greedy at price 1) | about the same |

## Exact behaviour
- **Row 1.** CONTRACT.delve.price 2; EXPED_DROP_MULT 1.9; DUNGEON_DIM_HOLD and its `dimAt` term removed (expedition.md 6.2's "The dungeon holds out" paragraph struck, the 13 row deleted, rules 1.9.6 and the "dims in N" label follow the hops formula for every node); Beastcall Horn data unchanged (the gated switch removed). The sim's scratch switches for these become the engine's values.
- **Row 2.** At `MOVE(id)` the engine records `outward = shardDist[id] > shardDist[from]` (expedition.md 4.5; both on the zone graph, as 6.2). If the settle step after that MOVE starts a Dimmed encounter (rules 1.9.6), it costs TIME_DIM_ESCAPE instead of TIME_DIM_FIGHT. Every other Dimmed encounter (after a node's content, a PASS, a Bell channel, a hub service, or a MOVE that is not outward) costs TIME_DIM_FIGHT 2. Depth, level, pack and rewards are unchanged. The flag clears at the next action. The same rule in the tolls previews: src/engine/heat.js (node tolls with `dimFight`) and src/engine/autoplay.js (Dimmed steps on the way). Bots: sim/lib/view.mjs (`escapeV`) and sim/bots/planner.mjs read the rule through the view (sim row); the `dim` risk table is relearned (cell 1). Fiction for 6.3: the Shardspawn come for what stands still in the dark; a bearer walking out of it fights them off on the move. Text: expedition.md 6.3 and 13, rules 1.9.6, engine-api.md if the tolls preview is documented there.
- **Row 3.** expedition.md 6.3 "Target (B43)", 11.1 B43 and 13 CAUGHT_ZONES: 8-25 %. Folded in when the Lead accepts D102 (and O9's default holds), as v11 rows 5-7.
- **Row 4.** Sim only. `speedExpMap` searches with the speedrunner's cost (as `speedMap`/`nodeCost` on the rows map: node tolls, P(death) × VAL_DEATH / VAL_TIME, and missing levels to 10z - 1 × VAL_XP / VAL_TIME at the search's end), with the fog model of planFog (unknown nodes by region weights) and the Dimming exact; contract sites of its own Delves count as their XP only. Prep (speedPrep), hub, zone 6 and the exit rule (Road, or the Bell when the way crosses the Dimming or takes longer than the channel) unchanged. balance.md 1 needs no edit (it already says this); the sim's bot comment changes.
- **Row 5.** SPELL.ricochet_bolt.bounceFrac 0.30, only if the gate passes (cell 3 against cell 3b). Tooltip and rules 5 text "at 30 %" follow the data.

## What the sim must run
Engine: main with rows 1-2 (row 1 values, the hold removed, TIME_DIM_ESCAPE) on the Engineer's build, or the sim's scratch copy with switches; row 5 as a switch (gated). Sim: row 4 (speedrunner policy), row 3's band in params, the P10 entry list in the report. SIM.POTION_VALUE 30 (D2). Seeds 1000 onward, paired by class and seed with 11-11g. Node-risk tables: the v11 observations; `ct` and `dim` relearned in cell 1 (row 2 changes what a Dimmed step costs). Default trees as 11-11g. Wall time from 11-11g on 2 workers (expedition about 250 ms per run; a 900-run cell about 2 min; classic 26-38 ms per run): **about 40 minutes**. Run in this order; cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | Table pass: package, planner P0 and planner PALL | 100 per class each | `ct` and `dim` tables for every later cell | 1.5 min |
| 2 | Package, planner P0, planned prep | 300 per class (900) | **flip 2 (P0)**, B39, **B43** (caught, share, depth table), B46, B11, B53, gear at the boss, dungeons and Delves per run | 2 min |
| 3 | Package with row 5, planner PALL | 300 per class | **flip 2 (PALL)**, B39 PALL, B6 PALL (expedition), row 5 gate | 2 min |
| 3b | Package without row 5, planner PALL (paired with 3) | 300 per class | row 5 gate and its measured effect | 2 min |
| 4 | Package with row 4, speedrunner PALL | 700 per class | **B12** both clauses (>= 200 wins), per class medians, nodes and fights per win, B3 speedrunner | 4.5 min |
| 5 | Package, greedy P0 | 300 per class | B39 greedy, **B43 close calls** | 1.5 min |
| 6 | Package, planner P0, prep `none` and `random` | 300 per class each | B40 both parts (paired with cell 2) | 4 min |
| 7 | B41: planner P0 `--oracle --route`; PALL with the oracle | 50 per class each | C_step, C_route | 3 min |
| 8 | Arm: row 2 off (every Dimmed encounter 2 tolls), planner P0 | 300 per class | row 2's measured effect (B43 parts, Dimmed deaths by depth, win) | 2 min |
| 9 | Arm: row 4 off (speedrunner as v11), speedrunner PALL | 700 per class | row 4's measured effect on B12 (paired with cell 4) | 4.5 min |
| 10 | Classic: planner PALL default trees with row 5, 1 000 per class; planner PALL hunter without sp_h1 is in 11-11g | 3 000 | B6 PALL classic, row 5's classic effect (hunter 68.6 % in 11-11g) | 1.5 min |
| 11 | Classic regression: planner P0 default trees 1 000 per class; hash identity, classic (24) and expedition without `prep` (24) against 11-11g | 3 048 | rows 1-4 leave the classic map unchanged; row 5 touches PALL only | 1.5 min |
| 12 | Campaigns on the expedition, 8.2 catalogue | 50 per class | B31, B32 (all parts; STATUS "Next") | 10 min |

About 40 minutes. Decision rules:
- **Row 5 gate:** apply bounceFrac 0.30 if cell 3's pooled PALL is >= 50 % on the point; else leave 0.40, report cell 3b as the PALL figure and both hunter rates. No other Ricochet value in this pass.
- **Row 2:** keep if cell 2's Dimmed share is under arm 8's and planner P0 does not fall by more than 1.5 pp against arm 8; else drop it and report.
- **Row 4:** it is the specified bot; it stays whatever cell 4 measures. Cell 9 tells how much of B12 it moved.
- **B43:** read on row 3's band, and on the old band for the report (both readings, as v11 rows 5-7).
- **B12:** if cell 4 fails by no more than 0.5 min on either clause, the report says so and owner item O10 applies; no further arm in this pass.

Report: the 11-11g expedition tables with a v12 column; the flip criteria table; per-row measured effects (row 2 from arm 8, row 4 from arm 9, row 5 from 3b and cell 10); the P10 entry list.

## Flip criteria: expected outcome
Criteria as changes-m2b-v10.md "Criteria to flip".
| Criterion | Failing on 11-11g | v12 rows | Expected |
|---|---|---|---|
| 1. B43 | caught 21.7 %, share 20.2 % | rows 2-3 | **pass**: caught 21-23 % in 8-25, share 9-14 %, close calls about 56 % |
| 1. B12 | 31.8 / 30.8 min, ratio 0.71 | row 4 | **at the edge**: 29.9-30.6 min from SET_OUT, ratio 0.69-0.71; about an even chance to pass both clauses |
| 1. B39, B40, B41, B11, B53 | pass | none | pass (row 2 and row 5 move them by less than their margins) |
| 2. Winnable | pass on the point (P0 22.0, PALL 51.6 %) | row 1 (decided), row 2; row 5 gated so it cannot break PALL >= 50 % | pass: P0 22-23 %, PALL 50.5-52 % (PALL's interval still reaches under 50 %) |
| 3. Nothing breaks | pass | none (qa/engine and qa/sim for rows 1-2; ui-regress A and M after the build) | pass, if the Engineer's tests and ui-regress pass on the v12 build |

**Expected: flip criteria 2 and 3 pass, and criterion 1 passes unless B12 lands on the wrong side of 30.0 min.** If it does, O10 decides.

## Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D100 | v11 outcomes into the engine: Delve price 2, EXPED_DROP_MULT 1.9, DUNGEON_DIM_HOLD removed, Beastcall Horn stays 12 (row 1) | team |
| D101 | TIME_DIM_ESCAPE 1: an outward step in the dark costs 1 toll for its encounter (row 2) | team |
| D102 | B43 caught band 8-25 % (row 3) | team (target); owner item O9 |
| D103 | Expedition speedrunner follows balance.md 1 (tolls to the exit level; no gear, gold or heat terms) (row 4) | team (bot) |
| D104 | Ricochet Bolt bounce 40 -> 30 %, gated on expedition PALL >= 50 % (row 5); standardOrder unchanged, P10 holds Cartographer | team |
| O9 | B43's caught-zones band rises to 8-25 % because H.5 pays the player to work at the dark's edge; the danger band (Dimmed share of deaths 5-20 %) stays. Default: as written | owner, default applies |
| O10 | If B12 misses by 0.5 min or less after row 4 (either clause), the flip goes ahead with B12 logged as a known miss and the speedrunner's prep (contracts by XP per toll) as the next arm; a larger miss holds the flip. Default: as written | owner, default applies |

## Constants
New or changed by this package (expedition.md 13 unless stated).

| Constant | Old | New | Unit |
|---|---|---|---|
| CONTRACT.delve.price | 1 | 2 (D93 guard) | points |
| EXPED_DROP_MULT | 1.6 | 1.9 (cell 10) | × item and junk chance of normal and dungeon-trash kills, expedition runs |
| DUNGEON_DIM_HOLD | 3 | removed (B4) | tolls |
| SPELL.beastcall_horn.cd (rules 5) | 12 (15 gated) | 12 (row 8 void) | rounds |
| TIME_DIM_ESCAPE (new) | - (TIME_DIM_FIGHT 2) | 1 | tolls of a Dimmed encounter after a MOVE farther from the Shardfall |
| CAUGHT_ZONES (B43) | 0.08-0.18 | 0.08-0.25 | share |
| Speedrunner expedition policy (sim) | planner value, time weight × 9 | balance.md 1 cost (tolls, death, missing levels) | bot |
| SPELL.ricochet_bolt.bounceFrac (rules 5), gated | 0.40 | 0.30 | × of the main hit per bounce |
| standardOrder (balance.md 1.4) | 8.2 order | unchanged (P10 holds cartographer, not sp_x1) | - |
