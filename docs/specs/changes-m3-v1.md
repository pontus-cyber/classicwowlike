# Spec changes M3 v1: zone 1 asks for care (D146 Designer item)

Owner: Game Designer (balance), 2026-11-13. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), Lead. **Status: draft** (not approved).

Input: the blind testers [source: docs/feedback/2026-11-13-blind-casual.md 6, -tactician.md 4: "never below about 75 % health in zone 1", "nothing could hurt in zone 1, then a wall"]; the zone 1 to zone 2 measure [source: docs/reports/balance-2026-11-13c.md: about 2 levels per fight, half of zone 1 XP from quest turn-ins, the guided board Cull a third of zone 1 XP, no guided fight under 25 % HP; enemy count rejected as the lever (a2: B21 16.7 %)]; D145, D146; balance.md B1, B21, B24, B38, B59.

Scope: one rule number (row 1). Rows 2-3 of the lever table were measured and are not proposed. The new balance rows are in balance.md (B63-B65, B15 re-set, draft). The guided zone's D145 G8 fix is in m3-onboarding.md 2.8.

## Measure (D118)
- **Engine:** main 321f2aa (D146 `zone2InnerCap` on, `rewardPrimary` on; every default switch). origin/main d3c8ee5 differs from it only by a UI constant (ONB_HINT_SHOWS), so the numbers hold for it.
- **Map and profile:** the expedition map with the start camp (`--map expedition --prep`), P0 (`--profile fresh`), `--warmup 0`, the X0 tables (`--risk-in sim/out/pass-v9v10/obs-P0.json --tables-in sim/out/pass-v12/exp/table/planner-P0-exp-prep/risk.json`), as report balance-2026-11-13c.
- **Bots and runs:** planner, onebutton and masher, 300 runs per class (900 per bot), seeds 1000-1299; the guided first run (`--guided`): planner and onebutton, 300 per class. Every arm is paired with the build on the same seeds. Build: 4 500 runs; arms dm25 and ct50: 4 500 each; gl and dm25+gl guided: 1 800 each (gl's non-guided cells re-run as an identity check: equal to the build, as expected). Total about 17 000 runs.
- **Arms:** scratch copies of src/ (src/ untouched), one edit each, by a scratch script under sim/out/design-z1/ (not committed): `arms.sh` (the sed lines below), `run.sh`, and two readers, `step.mjs` (the zone step and zone 1 HP quantiles) and `b59.mjs`. Tables: `node sim/cliffreport.mjs sim/out/design-z1 --arms`.
- **Definitions** as report 2026-11-13c: lowest HP per fight; near death = lowest HP below 25 %, a fall survived, or a death; B21 = runs dying in zones 1-2; intervals are Wilson 95 % or normal intervals on paired differences.

## The levers (3 measured)
| Arm | Edit (scratch) | Lever |
|---|---|---|
| **dm25** | combat.js `zoneDanger`: `early = level <= EARLY_DMG_MAX_LEVEL ? EARLY_DMG_MULT * (level <= 10 ? 1.25 : 1) : 1` | zone 1 enemy damage × 1.25 (every template enemy of level 1-10) |
| ct50 | contracts.js `completeContract`: contract XP × 0.5 when `c.z === 1` | zone 1 contract payout (the guided board Cull is a third of guided zone 1 XP) |
| gl | constants: ONB_SCRIPT_LEVEL_MAX 5 -> 8, ONB_ELITE_LEVEL_MIN / MAX 4 / 6 -> 6 / 8 | guided zone: scripted fights and Gorrak at the node's own level (guided run only) |

The XP-pace lever on quest turn-ins (QUEST_TURNIN_XP_FRAC × 0.5 in zone 1) was set up but not run: ct50 measured the same direction (less zone 1 XP), and it made the guided zone easier and the zone 2 step steeper, as report 2026-11-13c predicted for an XP cut alone.

### Results (planner P0 unless named; build -> arm)
| Measure | dm25 | ct50 | gl (guided) |
|---|---|---|---|
| Zone 1 mean lowest HP, won fights | **69.9 -> 65.4 %** | 69.5 -> 69.5 % (all fights) | guided 87.1 -> 88.6 % |
| Zone 1 won fights below 50 % HP | **19.0 -> 25.4 %** | - | guided 0 -> 0 % |
| Zone 1 near death per fight | 2.7 -> 5.9 % | 2.7 -> 2.7 % | 0 -> 0 % |
| Zone 1 close wins (< 35 %, B24 part) | 10.1 -> 14.6 % | - | - |
| Levels per fight in zone 1; level leaving zone 1 (median) | 2.0; 11 -> 11 | 11 -> 11 (mean 11.3 -> 11.2) | guided 9 -> 11 |
| Died in zone 1 (of runs) | 2.4 -> 5.6 % | 2.4 -> 2.7 % | 0 (rescue) |
| Zone 2, first 3 fights: deaths per fight | 0.3 -> 0.3 % | 0.3 -> 0.4 % | guided 0.2 -> 0.0 % |
| **B21 runs dying in zones 1-2 (<= 12 %)** | **3.8 -> 6.7 %** (5.2-8.5), pass | 3.8 -> 4.1 % | guided 0.9 -> 0.4 % |
| Win, paired | **-4.0 pp** (-6.4 to -1.6): 34.1 -> 30.1 % | -0.6 pp (n.s.) | guided +2.6 pp (n.s.) |
| Reach the boss, paired | -3.4 pp (-5.5 to -1.4) | -0.4 pp | guided +3.7 pp |
| Onebutton: died in zone 1; B21 | 11.3 -> 18.8 %; 24.8 -> 31.1 % | 11.1 %; 24.2 % | guided 0; 8.8 -> 9.0 % |
| Onebutton B59 (d) zone 1 elite, rare, dungeon-boss deaths per fight (>= 25 %) | **24.3 -> 36.4 %** (fails -> passes) | - | - |
| Masher: died in zone 1; reach, paired | 10.6 -> 15.9 %; -2.7 pp | 10.7 %; -0.4 pp | - |
| Guided run, zone 1 mean lowest HP (planner / onebutton) | 87.1 -> 85.2 % / 86.3 -> 80.9 % (\*) | 87.1 -> 90.1 % / 86.3 -> 91.2 % | 88.6 / 88.2 % |
| Guided run, zone 2 first-fight gap; zone 2 deaths (planner / onebutton) | +3.2; 1.0 / 10.3 % | **+4.5**; 4.1 / 14.7 % | **+2.0**; 0.4 / 9.0 % |

(\*) 259 of 300 guided onebutton Hunter runs on dm25 did not finish (engine finding 1 below); the guided onebutton row on dm25 reads the other 641 runs.

Class rates, planner P0 (build -> dm25): rogue 40.3 -> 31.7, mage 37.7 -> 35.7, hunter 24.3 -> 23.0 % (B6 spread 16.0 -> 12.7 pp; both outside the band, as before).

### Reading
1. **dm25 is the only lever that makes the standard zone 1 ask for care.** The mean low point falls 4.5 pp, one won fight in four dips under half health (one in five today), and near-death fights double, while the level pace and the zone 2 entry do not move. Deaths stay inside B21 (6.7 % of 12 %). Its cost is late in the run (win -4.0 pp, reach -3.4 pp): weaker players lose more runs in zone 1 instead of zone 2-3. That cost offsets two thirds of rewardPrimary's +6.2 pp (D145, D146), and planner P0 stays inside B1 (30.1 % in 20-35 %).
2. **ct50 is rejected.** Less contract XP leaves the guided player one level lower against fights capped at level 5, so the guided zone gets easier (87 -> 90 %), and the guided zone 2 entry gets steeper (gap +3.2 -> +4.5, guided zone 2 deaths 1.0 -> 4.1 % planner, 8.8 -> 14.7 % onebutton). On the standard map it does nothing (contracts are 4 % of zone 1 XP). The quest turn-in cut works the same way.
3. **The guided zone stays easy under every lever** (85-91 %). Its ease comes from the overlay (scripts are one or two enemies, capped at ONB_SCRIPT_LEVEL_MAX 5; Gorrak clamped to 4-6; the rescue) and is by design (m3-onboarding.md principle 5). dm25 still reaches it: Gorrak and the site fights hit 25 % harder. gl measures what the overlay levels do: the guided player leaves zone 1 at 11 instead of 9 and the guided zone 2 step closes (first-fight gap +2.0, the same as the standard map), with zone 1 still at 88 %. It is not proposed here (the guided zone's purpose is the Lead's and owner's call, principle 5); it is listed for the Lead as a measured option. dm25 + gl on the guided run: planner 85.6 %, zone 2 deaths 0.4 %, win +4.7 pp (0.9 to 8.5).
4. **Where dm25 does not reach:** the sim's bots play the guided zone in 4.4 fights, not the guide's route (report 2026-11-13c reading 1); a human following the coach line meets the same overlay fights, so the guided lowest-HP figure is an upper bound on care, not a measure of it.

## Change table
| # | Rule or constant (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| 1 | **Zone 1 enemy damage** (rules 7.6 zone danger): template enemies of level <= Z1_DMG_MAX_LEVEL deal × Z1_DMG_MULT on top of the early factor: `early(M) = EARLY_DMG_MULT × (M <= Z1_DMG_MAX_LEVEL ? Z1_DMG_MULT : 1)` at M <= EARLY_DMG_MAX_LEVEL, else 1. Every variant made by `makeEnemy` (normal, elite, rare, dungeon trash and boss, shardspawn, Signal adds, summoned adds); the end boss and the Shards keep their own constants. Both maps. Zone 1 levels 1-10; a zone 1 rim elite at level 11 (ELITE_LEVEL_OFFSET) is not covered | early(M) = 0.80 at levels 1-20 | **Z1_DMG_MULT 1.25, Z1_DMG_MAX_LEVEL 10** (levels 1-10 at 1.00, levels 11-20 stay 0.80) | B63 (new), B21, B59 (d), B1 | Measured as dm25 above: zone 1 mean lowest HP 69.9 -> 65.4 % (B63 band 0.60-0.68); B21 3.8 -> 6.7 %; win -4.0 pp; zone 2 entry unchanged; B59 (d) 24.3 -> 36.4 % | number + rule |

**Exact change for the engineer.** src/constants.js, next to EARLY_DMG_MULT:
```
/** rules 7.6 (M3 v1, draft; changes-m3-v1.md row 1): × the damage of every template enemy of level <= Z1_DMG_MAX_LEVEL (zone 1), on top of EARLY_DMG_MULT. */
export const Z1_DMG_MULT = 1.25;
export const Z1_DMG_MAX_LEVEL = 10;
```
src/engine/combat.js, `zoneDanger`:
```
-  const early = level <= EARLY_DMG_MAX_LEVEL ? EARLY_DMG_MULT : 1;
+  const early = level <= EARLY_DMG_MAX_LEVEL ? EARLY_DMG_MULT * (level <= Z1_DMG_MAX_LEVEL ? Z1_DMG_MULT : 1) : 1;
```
Optionally behind `C.GATES.z1Dmg` (on) so the sim keeps the old arm; with the gate off every run is identical to 321f2aa. Docs in the same commit: rules.md 7.6 (the early factor line) and 13 (constant table), the zoneDanger header comment, engine-api.md if `zoneDanger` is listed. The measured arm is this line with the literal values (arms.sh dm25).

QA after the build: `node --test qa/engine qa/rules qa/docs qa/sim`; golden hashes that cover zone 1 fights change (expected). Sim: a planner P0 pass on the expedition map reads B1, B21, B59, B63-B65 (balance.md).

## Engine and sim findings (for the Lead; not part of this change)
1. **Guided rescue loop (engine, B36).** With zone 1 enemies stronger (dm25: 259 of 300 guided onebutton Hunter runs; ct50: none of this kind), a guided run can stay in phase NODE for ever: the onebutton Hunter dies in a Dimmed encounter, the rescue (m3-onboarding.md 2.6) puts it on the previous node, which is also Dimmed, a new encounter starts there, it dies again, and so on (seed 1000, Hunter: 9 224 zone 1 fights, zone time 36 891 tolls, no map action in between). A human player in the same spot cannot act either. The rescue has no cap by design ("the Dimming and the tolls are the limit"), but the Dimming does not end a zone. Suggested rule (Designer default, draft): a rescue always lands the player in phase MAP with no encounter started, and from the ONB_RESCUE_MAX-th rescue (draft 3) the guide ends (as `SKIP_GUIDE`: deaths are normal after it). Repro: `bash sim/out/design-z1/run.sh dm25 "" onebutton` on 321f2aa, or the scratch copy with `--runs 1 --class hunter --seed-start 1000 --guided`. It must be fixed before row 1 ships, since row 1 makes it reachable.
2. **Planner bar loop (sim bot, B36).** On ct50 the guided planner and onebutton Hunter got stuck in phase MAP in 41 of 300 runs: the bar template swaps slot 0 between `mend_companion` and `barbed_arrow` for ever (seed 1003). A sim policy issue (balance.md 1.2), for the Simulation & Balance Engineer; not seen on the build or dm25.

## Constants (new)
| Constant | Value | Unit |
|---|---|---|
| Z1_DMG_MULT | 1.25 | × damage, template enemies of level <= Z1_DMG_MAX_LEVEL (row 1) |
| Z1_DMG_MAX_LEVEL | 10 | level (zone 1) |
| ONB_RESCUE_MAX | 3 | rescues after which the guide ends (finding 1; draft, not measured) |
