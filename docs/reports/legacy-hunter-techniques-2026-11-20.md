# Hunter Lost Techniques and B6 (2026-11-20)

Status: **draft** (Core Gameplay Engineer, with leave to change sim/), for the Lead. Nothing here is approved by the owner. Task: BACKLOG row 2026-11-20 "Hunter Lost Techniques break B6 with a bought hall" (D165). Engine (src/) untouched; the fix is in the sim's bar template (sim/lib/policy.mjs), Legacy runs only.

## Verdict

**Cause (a): the sim planner's bar.** The bar template valued Ricochet Bolt (Lost Technique I) with its two bounces on every cast (1.6 × Keen Shot), while autoplay casts it only with 2 or more enemies and every other multi-target spell (Volley Rain, Cinder Storm, Deadfall Trap) is valued at one target. From hero 18 on, Ricochet Bolt took the Camp bar's AoE step from Deadfall Trap (which autoplay casts on every Oruvath cast) and a zone slot from Savage Order. Beastcall Horn (Technique II) never reaches a bar, so it changes nothing. Neither (b) the technique numbers nor (c) Stormhawk is the cause. Stormhawk has no effect in any sim cell: the planner always plays the Ridgewolf.

**Fix (D166, draft):** in Legacy runs the bar template counts one target for Ricochet Bolt, as it does for the other multi-target spells. With both techniques the Hunter at hero 20 goes from 11.0 % to 35.5 %, the same as with nothing bought. Level-60 runs are unchanged.

**B6 after the fix:** with nothing bought, hero 25 passes (2.2 pp) and hero 20 fails (13.1 pp, the Rogue ahead). That failure was there before and the fix cannot reach it. With the v2 hall, hero 20 fails by 0.6 pp (8.6 pp, inside the ±2.6 pp error of one class) and hero 25 fails by 3.5 pp (11.5 pp, the Hunter ahead). The hero 25 gap comes from the **Cartographer** (with Old Hand), not from the techniques. Region Charts mark the dungeon, and the Hunter clears 2-4 times as many dungeons as the other classes (section 4). Not built: it is a class or dungeon lever, not a small number change in the technique entries.

## 1. Set-up

- Main 0bdfffb (fix: d4bef86, pushed as 4e89291). `C.GATES.legacy`, `oruvathLegacy` and `economyV2` on (`sim/legacy-run.mjs grid --native --oruvath --econ --hall <arm>`). Planner, expedition map with the start camp, profile `later`, the band tables sim/tables/legacy-hx, the same seeds as LH1: 9000-9449 at hero 20, 9000-9599 at hero 25. Attribution cells use 200 runs (9000-9199). Hall arms come from sim/lib/hall.mjs (v2 = the engine's hall as built; `v2:<entries>` = only those entries owned).
- Rogue and Mage cells are LH1's (report legacy-hall-v3-lh1-2026-11-20, `/tmp/lh1/main`). The fix only acts on a spell with `bounces`, and Ricochet Bolt is the only one, so the Rogue's and Mage's bars, and their runs, are unchanged. A Hunter cell with nothing bought hashes as in LH1: 35.5 % at hero 20, 71/200 on the same seeds.

## 2. The cause

Hunter, hero 20, seeds 9000-9199, the techniques only:

| Hall owned | Before | After | Runs reaching Oruvath (before) | Zone deaths (before) | Oruvath losses to Final Dark (before) |
|---|---|---|---|---|---|
| nothing | 35.5 % | 35.5 % | 99.0 % | 2 | 84 |
| Lost Technique I | 11.0 % | 35.5 % | 87.0 % | 26 | 131 |
| Lost Techniques I and II | 11.0 % | 35.5 % | 87.0 % | 26 | 131 |

After the fix, every fight of the technique cell plays as in the nothing-bought cell (same outcome, death, nodes, fights and rounds, run for run). Only the gold and minutes of training Ricochet Bolt at trainers differ.

Bars of the Hunter's hero at hero 20 (sim/campbars.mjs set-up, standard Wildcraft build, rare gear):

| Bar | Without techniques | With techniques, before | With techniques, after |
|---|---|---|---|
| Camp (Oruvath) | Muzzle Shot, Feign Stillness, Field Dressing, Mend Companion, **Deadfall Trap**, Heartseeker Shot, Keen Shot | ..., Mend Companion, **Ricochet Bolt**, Heartseeker Shot, Keen Shot | as without |
| Zone | Muzzle Shot, Field Dressing, Feign Stillness, Deadfall Trap, **Savage Order**, Heartseeker Shot, Keen Shot | ..., **Ricochet Bolt**, Deadfall Trap, Heartseeker Shot, Keen Shot | as without |

Template values at hero 20 (sim/lib/policy.mjs rawDamage and value): Ricochet Bolt 514 before (Keen Shot's 321 × (1 + 2 × 0.30)), 321 after. Deadfall Trap 436 raw (597 at the Camp with its stun), Savage Order 415. The Camp's AoE step sorts by raw damage, so 514 beat Deadfall Trap. Without Deadfall Trap, Oruvath's casts go through (8 Collapse Litany deaths against 0), and the Hunter loses the race to Final Dark more often. Beastcall Horn's value is the utility stand-in (161, half of Keen Shot): it never fills a slot, before or after.

The technique itself is not weak where it fits. At hero 10, with the v2 hall, the Hunter wins 61.0 % with the techniques and 53.5 % without them (200 runs). Ricochet Bolt stays on the hero 9-17 bars after the fix, at one-target value, where it beats Mark Prey or Volley Rain for the fill slot. At hero 20-25 it gets no bar slot: the hero 18-20 spells and Deadfall Trap outvalue it. This is a design observation, not a B6 matter: an owned technique that the good player leaves off the bar from hero 18 on.

## 3. B6 before and after (planner, max - min <= 8 pp, each class within ±5 pp of the mean)

| Hero | Hall | Rogue | Mage | Hunter before | Hunter after | Spread before | Spread after | B6 after |
|---|---|---|---|---|---|---|---|---|
| 20 | nothing bought | 46.9 | 36.4 | 33.8 | 33.8 | 13.1 | 13.1 | fail (Rogue +7.9 over the mean) |
| 20 | v2 hall | 62.4 | 57.8 | 17.1 | **53.8** | 45.3 | **8.6** | fail by 0.6 pp (each class inside ±5) |
| 25 | nothing bought | 52.2 | 50.0 | 51.8 | 51.8 | 2.2 | 2.2 | pass |
| 25 | v2 hall | 69.8 | 68.2 | 46.5 | **79.7** | 23.3 | **11.5** | fail (Hunter +7.1 over the mean) |

450 runs per class at hero 20, 600 at hero 25: about ±2.6 pp per class (95 %). The after-fix Hunter equals LH1's v2-nt arm (the hall without the techniques) exactly: 53.8 % and 79.7 %. The techniques now change no fight at hero 20-25.

- Hero 20, nothing bought: the failure was there before the hall and the techniques (LH1 section 2). D157 read B6 by band (16-20 pooled passed on seeds 6000-6119). At hero 20 alone, on these seeds, the Rogue leads by 13 pp. It is outside this task. The Hunter is lowest there, so a Hunter cut would widen it.
- Hero 20, v2 hall: 0.6 pp over the line is inside the error of one class. A re-read on fresh seeds can decide it.

## 4. The remaining gap at hero 25: the Cartographer, not Stormhawk

Hero 25, 200 runs per class (seeds 9000-9199; the nothing-bought and whole-hall rows are LH1's runs on the same seeds):

| Hall owned (v2 effects) | Rogue | Mage | Hunter |
|---|---|---|---|
| nothing | 51.5 | 46.5 | 53.5 |
| Vigor II + Edge II | 63.5 | 47.5 | 63.5 |
| Second Breath | 58.0 | 48.5 | 54.5 |
| Satchel, Pockets, Quartermaster II, Cartographer, Old Hand, Swift Boots, Quick Study II | 56.5 | 58.0 | **73.0** |
| Old Hand + Cartographer | 59.5 | 46.0 | **71.0** |
| Cartographer only | | | 67.0 |
| Old Hand only | | | 57.5 |
| Satchel only | | | 59.5 |
| Quartermaster II only | | | 53.5 |
| Swift Boots + Pockets + Quick Study II | | | 55.5 |
| whole hall without the techniques (= after the fix) | 68.0 | 67.5 | 76.5 |

Dungeons cleared a run, same cells:

| Hall | Rogue | Mage | Hunter |
|---|---|---|---|
| nothing | 0.93 | 0.36 | 1.72 |
| Old Hand + Cartographer | 1.43 | 0.80 | 3.62 |
| Cartographer only | | | 4.30 |
| whole v2 hall | 1.57 | 0.81 | 3.42 |

- The map entries are worth +17.5 pp to the Hunter, +8 to the Rogue and 0 to the Mage. The Cartographer alone gives the Hunter +13.5. With Region Charts the dungeon is known on arrival (expedition.js `knowledge`). The Hunter dies in few dungeons (2.4 % of dungeon entries in its hero 16-20 table), so the planner goes there and keeps the loot (gear score at Oruvath 628 → 666). This is the level-60 pattern of balance.md 4 (B6 PALL and gold: the Hunter clears about 4 dungeons a PALL run against 0.4-0.9) showing up again in Legacy.
- Stormhawk: owning it changes nothing in any sim cell. The planner always plays the Ridgewolf (SIM.DEFAULT_PET, runner `cellPet`), and hall.mjs already treats Stormhawk as price only. A player who picks the hawk is not measured here (limit).
- To pass at hero 25 with the hall, the Hunter needs about -3.5 pp (to at most 76 %), and nothing at hero 25 or hero 20 without the hall. A general Hunter cut would break hero 20, where the Hunter is lowest. The lever has to act on the dungeon route the Charts open. Options for the Designer (draft, none built or measured): (1) dungeon trash or boss numbers against a pet tank (the Hunter's pet takes the dungeon's hits); (2) Region Charts mark the dungeon's region instead of its node (less certain routing for every class; the Mage gains nothing from the entry today); (3) accept the gap and read B6 on a bought hall by band, as D157 did. The Lead's call. No D166 number change is proposed for it.

## 5. Legacy off

- Gate: the change applies only where `legacyRules(s)` holds (a Legacy run with C.GATES.legacy and oruvathLegacy on). Level-60 runs keep the bounces in the value.
- Hashes: 160 of 160 runs identical between main 0bdfffb's sim and this one. Classic and expedition maps; profile `all` (the techniques owned) and `fresh`; planner Rogue, Mage and Hunter, greedy and speedrunner Hunter; seeds 1000-1009 (scratch script /tmp/htools/l60ident.mjs, which calls `runWithBot(..., { hash: true })` on both trees).

## 6. Limits

- The planner is the "good player". Its risk tables were warmed without the hall (LH1 section 7).
- Attribution cells hold 200 runs (±7 pp per class at 95 %; paired on seed, differences of 10 pp and more are clear, 1-3 pp are not).
- Hero 1 and 10 B6 with a bought hall (LH1: 8.3 and 37.6 pp) are not re-read. At hero 10 the fix changes nothing (Hunter 61.0 % on seeds 9000-9199, as LH1), so LH1's hero 10 row stands.

## 7. Commands

```
node sim/legacy-run.mjs grid --native --oruvath --econ --hall v2 --classes hunter --levels 20 --tables sim/tables/legacy-hx --out <dir> --runs 450 --seed 9000
node sim/legacy-run.mjs grid --native --oruvath --econ --hall v2 --classes hunter --levels 25 --tables sim/tables/legacy-hx --out <dir> --runs 600 --seed 9000
node sim/legacy-run.mjs grid --native --oruvath --econ --hall v2:tech2 --classes hunter --levels 20 --tables sim/tables/legacy-hx --out <dir> --runs 200 --seed 9000
node sim/legacy-run.mjs grid --native --oruvath --econ --hall v2:old_hand1,cartographer1 --levels 25 --tables sim/tables/legacy-hx --out <dir> --runs 200 --seed 9000
```

Checks: `node --test qa/engine qa/rules qa/docs qa/sim qa/ui`: 1061 pass, 0 fail. New: qa/sim/hunter-tech.test.mjs, 2 tests, both failing on 0bdfffb.
