# Oruvath on the 1-25 scale, 2026-11-18

Status: **draft** (Lead Game Designer), for the Lead; nothing here is approved by the owner. The rule and its constants are in docs/specs/legacy.md 2.4.1 and section 10 (rows marked 2.4.1). src/, game.html, rules.md, balance.md and content are untouched; every rule ran on scratch copies (sim/legacy-patch.py).

## Verdict

1. **The rule** (legacy.md 2.4.1, draft): Oruvath's numbers follow one table by the hero's level at FIGHT_BOSS; his damage scale is smooth in level and capped so a young hero can die but is not one-shot; his Shards have half their HP share up to hero level 17 and full from 23; Final Dark comes later for a younger hero (76 rounds up to hero 11, 57 at 25); autoplay stops casting DoTs on Shards and casts them on bosses at any HP; the sim's Hunter keeps its pet heal on the Camp bar; four class numbers (Frost Lance + 15 %, Pyre Comet at hero 9, Barbed Arrow + 10 %, Field Dressing 0.18). The Rogue is unchanged.
2. **B6 passes in four of five bands** on fresh seeds, 300 runs per class per band: 6.0 / 8.0 / **11.0** / 5.3 / 7.7 pp (bands 1-5; band 21-25 a low reading). Band 11-15 fails by 3 pp on the Mage (43 % against 32-34 %). Before: 12.5 / 75.5 / 76.0 / 30.5 / 10.5 pp.
3. **The race is gone and no spell flips a class.** Final Dark ends 0 % of the Rogue's, 1-14 % of the Mage's and 15-59 % of the Hunter's boss losses (before 62-99 % for the Mage and the Hunter in bands 1-3). Per class the 3-level mean of the win rate never rises more than 11 pp between neighbouring levels (before: the Rogue 5 → 97.5 % from hero 5 to 6).
4. **The win rate rises with the hero level:** pooled 4.1 / 23.7 / 36.4 / 37.1 / 34.8 % by band, and by start level (3-level mean) from 2 % at hero 1 to 47 % at hero 22 with one dip of 7 pp at 16-18. First win around run 4-5, hero level 10-12 (47 % of campaigns by run 4, 63 % by run 5) [inference: the cell rates chained].
5. **Three findings outside the brief:** Oruvath's damage scale inherited zone danger's early factors (a 37 % jump in his damage between boss levels 20 and 21, a hole at hero level 5); autoplay wasted Living Flame and Barbed Arrow on fresh Shards and never cast them on Oruvath below 60 % HP; the sim's Camp bar dropped the Hunter's Mend Companion from hero 12, so the pet died in phase 2 (most of the Hunter's 'never above 30 %').
6. **Not met / open:** band 11-15 (a Mage number at hero 11-15 on 600 runs per class per band is the next step); the Hunter is still the slow class (its Final Dark share); rules 5-6 also touch today's level-60 cells, to be re-run when built.

## The rule (legacy.md 2.4.1)

| # | Rule | Constants |
|---|---|---|
| 1 | Oruvath's and the Shards' HP × hpScale(LB) × a table by the hero's level at FIGHT_BOSS (replaces bossHpLevel) | BOSS_HP_LEVEL = 0.50, 0.53, 0.57, 0.61, 0.71, 0.84, 0.87, 0.90, 1.00, 1.12, 1.10, 1.07, 1.07, 1.07, 1.05, 1.03, 1.02, 1.01, 0.99, 0.96, 0.94, 0.94, 0.92, 0.89, 0.89 |
| 2 | Every damage of the fight × dmgScale0(LB) (the enemy curve with zone danger, without the early factors) × max(0.90, min(1.20, 1.40 - 0.021 H)) | BOSS_DMG_LEVEL_BASE 1.40, _STEP 0.021, _MIN 0.90, _MAX 1.20 |
| 3 | The Shards' HP × 0.5 up to hero level 17, rising to 1 at 23 | SHARD_HP_LEVEL_LOW 0.5, SHARD_HP_RAMP_FROM 17, SHARD_HP_RAMP_TO 23 |
| 4 | Final Dark at round min(76, 57 + round(1.4 × (25 - H))): 76 up to H11, 71 at H15, 64 at H20, 57 at H25 | FINAL_DARK_LEVEL_STEP 1.4, FINAL_DARK_ROUND_MAX 76 |
| 5 | Autoplay: Living Flame and Barbed Arrow on a boss at any HP, never on a Dimming Shard (rules 7.9) | AUTO_DOT_BOSS on |
| 6 | Sim: the Hunter's Camp bar keeps Mend Companion (balance.md 1.2) | HUNTER_CAMP_PET_SLOT on |
| 7 | Class numbers | Frost Lance l 1.54 → 1.77, p 0.84 → 0.97; Pyre Comet power 38 → 21 (hero 16 → 9); Barbed Arrow DoT l 0.45 → 0.495, p 0.18 → 0.20; Field Dressing healPct 0.12 → 0.18; Rogue unchanged |

H is the hero's level at FIGHT_BOSS (in the sim, the hero level of the power level reached in the run: 2-3 levels above the cell's starting level).

## Measured

**Final grid** (seeds 5000-5059, 60 runs per class and hero level, 300 per class per band; planner, band risk tables, profile `later`):

| Band | Win: Rogue / Mage / Hunter (pooled) | 95 % interval per class | B6: spread, each within 5 pp of the mean | Reach | Boss fights won R / M / H | Final Dark share of boss losses R / M / H |
|---|---|---|---|---|---|---|
| 1-5 | 2.0 / 2.3 / 8.0 (4.1) | 1-4 / 1-5 / 5-12 | 6.0 pp, pass | 87.7 % | 2.4 / 2.5 / 9.2 | 0 % / 8 % / 15 % |
| 6-10 | 23.7 / 19.7 / 27.7 (23.7) | 19-29 / 16-25 / 23-33 | 8.0 pp, pass | 89.6 % | 26.3 / 21.7 / 31.4 | 0 % / 9 % / 40 % |
| 11-15 | 34.3 / 43.0 / 32.0 (36.4) | 29-40 / 38-49 / 27-37 | 11.0 pp, fail | 87.8 % | 41.9 / 45.6 / 36.8 | 0 % / 14 % / 32 % |
| 16-20 | 34.3 / 37.3 / 39.7 (37.1) | 29-40 / 32-43 / 34-45 | 5.3 pp, pass | 86.9 % | 42.0 / 41.9 / 44.1 | 0 % / 3 % / 59 % |
| 21-25 | 32.7 / 32.0 / 39.7 (34.8) | 28-38 / 27-37 / 34-45 | 7.7 pp, pass | 96.8 % | 34.4 / 33.3 / 39.9 | 0 % / 1 % / 40 % |

By start hero level (win %):

| Hero level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pooled win % | 1 | 4 | 8 | 4 | 3 | 13 | 26 | 28 | 27 | 24 | 29 | 31 | 37 | 41 | 44 | 39 | 26 | 36 | 40 | 44 | 46 | 46 | 51 | 26 | 7 |
| Rogue | 0 | 0 | 7 | 3 | 0 | 23 | 27 | 15 | 30 | 23 | 37 | 33 | 37 | 30 | 35 | 37 | 27 | 27 | 40 | 42 | 37 | 50 | 43 | 25 | 8 |
| Mage | 3 | 3 | 3 | 2 | 0 | 2 | 18 | 30 | 27 | 22 | 30 | 30 | 43 | 63 | 48 | 40 | 30 | 38 | 38 | 40 | 48 | 40 | 47 | 23 | 2 |
| Hunter | 0 | 8 | 15 | 7 | 10 | 15 | 33 | 38 | 25 | 27 | 22 | 28 | 32 | 28 | 50 | 42 | 22 | 43 | 42 | 50 | 52 | 47 | 62 | 28 | 10 |

Before (2.4 scaling, report legacy-calibration-2026-11-17, 200 runs per class per band): 8.5 / 4.0 / 16.5, 89.0 / 13.5 / 27.0, 77.0 / 14.5 / 1.0, 38.0 / 41.5 / 11.0, 12.5 / 14.0 / 3.5 % (spreads 12.5, 75.5, 76.0, 30.5, 10.5 pp).

**Earlier validation grids** (fresh seeds each; they show the seed and class-number sensitivity):

| Grid | Change from the final | Bands 1-5: R / M / H win %, spread |
|---|---|---|
| V1, seeds 1000-1059 | Frost Lance + 20 %, Barbed Arrow + 20 %, Final Dark step 0.8, damage not capped, first HP table | 7.0/3.0/8.7 (5.7), 19.7/21.0/32.0 (12.3), 38.3/53.0/29.7 (23.3), 40.3/44.7/37.0 (7.7), 29.0/27.7/28.3 (1.3) |
| V2, seeds 3000-3059 | Frost Lance + 10 %, Final Dark step 0.8, damage not capped | 5.7/4.3/9.0 (4.7), 20.7/11.3/15.3 (9.3), 37.3/23.0/21.3 (16.0), 35.3/39.7/39.7 (4.3), 33.3/36.3/40.3 (7.0) |
| V3, seeds 4000-4059 | Final Dark step 1.2 without cap, damage not capped, HP at H1-8 × 1/1.06 | 6.0/1.7/13.0 (11.3), 26.3/21.3/28.0 (6.7), 35.3/37.0/27.0 (10.0), 32.3/33.7/40.3 (8.0), 32.7/28.0/36.7 (8.7) |
| **V4, seeds 5000-5059 (final)** | - | 2.0/2.3/8.0 (6.0), 23.7/19.7/27.7 (8.0), 34.3/43.0/32.0 (11.0), 34.3/37.3/39.7 (5.3), 32.7/32.0/39.7 (7.7) |

The class balance in band 11-15 moves 10-20 pp with Frost Lance and the Shard factor: that band is where the next tuning pass has to work.

**B7 (talent trees)**, the final rule, 20 runs per class and level (100 per band), seeds 5000-5019, worst / best tree >= 0.60:

| Class | Bands 1-5 / 6-10 / 11-15 / 16-20 / 21-25 (tree 0 / 1 / 2 win %) | B7 |
|---|---|---|
| Rogue (Bladework / Shadowcraft / Venomcraft) | 0/0/1, 0/0/20, 1/0/34, 15/14/36, 33/28/29 | fail in 1-4, pass in 5 |
| Mage (Pyromancy / Rimecraft / Arcanism) | 1/4/1, 12/18/11, 11/50/30, 41/37/45, 30/33/26 | pass in 2, 4, 5; fail in 1 (low counts) and 3 |
| Hunter (Beastbond / Marksmanship / Wildcraft) | 22/5/10, 64/5/36, 74/2/37, 86/25/50, 65/23/36 | fail in every band |

B7 is not met and is not a fight problem: on the compressed scale Venomcraft (Toxic Coating at tier 1) and Beastbond (the pet, now healed at the Camp) carry their classes; Bladework, Shadowcraft and Marksmanship win little before hero 16. Note for the sim: by balance.md 1.3's switch rule the Hunter's P0 default would move to Beastbond on this scale, which would break B6 (Beastbond 64-86 % in bands 2-4); tree balance on the 1-25 scale is the next class task.

**One button** (`--bot onebutton`, the final rule, 20 runs per class and level): 0 / 4 / 0 % in band 1-5 and 0 % in every other band (0 of 230 boss fights won from hero 6; most runs die in zones). One-button play still fails Oruvath.

## How the rule was found

1. **The race is steep.** On the boss bench (Oruvath alone, rare gear at item level P + 1, the planner's Camp bar and kit) a class's win rate falls from 100 % to 0 % over a 40 % change of Oruvath's HP at hero levels 6-18 while Final Dark binds; in full-run replays, 10 % of one class's damage in the fight moves it 10-15 pp. A class difference of 15 % is then a 30-50 pp gap. So the fight has to be lost by dying (as at level 60, Final Dark 3.5 % of boss losses) and the classes' power has to agree within a few per cent per band.
2. **What each class lacked.** Per class and tree, the HP multiplier at which the bench wins half its fights (base scaling): the Rogue's Venomcraft 1.5-1.7 at hero 6-12 (Whirling Edges with Toxic Coating) while its other two trees sat at 0.7-0.9; the Mage 0.8-1.0 until Pyre Comet (1.1-1.5 after); the Hunter 0.8-0.9 from hero 9 to 16. Traces: the Mage spends phase 2 on Living Flame on fresh Shards, Arcane Ward and passes for mana (boss damage 38 per round against 155 in phase 1, hero 10); the Hunter's pet is alive 100 % of phase 1, 24-42 % of phase 2 and 1-2 % of phase 3, because the sim's Camp bar has no Mend Companion from hero 12, and in phase 3 it never casts Barbed Arrow (target under 60 %).
3. **Fight levers alone do not close the class gap.** A grid of flat settings (Oruvath's HP 0.8-2.2 ×, damage 0.9-2.5 ×, Shard HP 0.4-1, Final Dark 57-85, Linked 0.05-0.15, Shard interval 8-12; 128 and 160 arms replayed on 4 500 full runs) left the best spread at the target win rates at 18-31 pp in bands 6-15. Each lever moves the classes differently: stronger Shards favour the Rogue, a later Final Dark the Hunter, more damage the Rogue (dodge), more HP the Rogue and the Hunter over the Mage. So class numbers are needed, and the fight's settings then set the level and smooth the curve.
4. **A hole at hero level 5** came from the scaling itself: dmgScale(LB) used zone danger's early factors (× 1.0 to boss level 10, × 0.8 from 11 to 20, × 1.045 rising from 21), a 37 % jump in Oruvath's damage between boss levels 20 and 21. `dmgScale0` removes it.
5. **The HP table follows the hero.** A linear HP factor gave a hump in the win curve at hero levels 6-11 (60-75 %) and a fall after 13: the hero's power on the 1-25 scale rises fastest at 5-10 (in band 6-10 runs the planner clears about one dungeon and four elites a run). The table was solved level by level toward a rising target (3 % at H1 to about 43 % at H22), smoothed, on full-run states.
6. **Class numbers tried** (full runs unless marked): Toxic Coating not through Whirling Edges (Rogue 0-5 % from hero 15: its late power is that spread; rejected); Toxic Coating × 0.8 and Smoke Veil 0.45 → 0.30 (replays: -8 to -18 pp for the Rogue in every band; rejected); Whirling Edges at power 26 (moves the step; rejected); Pyre Comet at power 16, 21, 26 (21 kept: it fills the Mage's hero 9-15); Frost Lance + 10 %, + 15 %, + 20 % (+ 20 % made the Mage 53 % against 30-38 % in band 11-15); Barbed Arrow + 10 % and + 20 % (+ 20 %: the Hunter 32 % against 20 % in band 6-10); Keen Shot cost 25 and Volley Rain on 2 enemies (no effect); Arcane Ward + 30 % (Mage 56 % in band 16-20; rejected).

## Method

- Engine: origin/main 05f3b48, scratch copies built by `node sim/legacy-run.mjs build --scratch <dir>` with sim/legacy-patch.py (this pass adds the fields `shp`, `fd`, `bsmooth`, `link`, `scnt`, `sevr`, `spell`, `talent`, `pet`, `dotfix`, `barfix` and env BOSSDUMP). Cells: planner, `--map expedition --prep` (D118), profile `later` (two runs, nothing bought), the band risk tables of sim/tables/legacy/ (`--risk-in`, `--warmup 0`), the P0-group default trees (Rogue Venomcraft, Mage Rimecraft, Hunter Wildcraft), pet ridgewolf.
- Calibration on seeds 2000-2059 and 1000-1059 (60 runs per class and hero level, 4 500 runs a grid), with the states before FIGHT_BOSS dumped and Oruvath's fight replayed under other settings (sim/legacy-replay.mjs; a replay reproduces its grid exactly, about 4 s for 3 900 fights). The final measurement is a fresh grid on seeds 5000-5059: 60 runs per class per hero level, **300 per class per band**.
- Commands (the arm's JSON is in sim/out/oru/ on the designer's worktree; the fields are listed in the rule table):
  - `node sim/legacy-run.mjs grid --scratch S --levels 1-25 --tables sim/tables/legacy --runs 60 --seed 5000 --out O --leg '<arm>'` (`BOSSDUMP=<dir>` to keep the states)
  - `LEG='<arm with T2 fields>' node sim/legacy-replay.mjs <dir> --part 0/2 --json out.json` (from the scratch copy)
  - `node sim/legacyreport.mjs O --levels`; B7: the same grid with `--tree 0`, `--tree 1`, `--tree 2`, 20 runs per class and level.
- B6 as balance.md 2 on point estimates: every class within 5 pp of the three-class mean and max - min <= 8 pp.

## Limits

- 300 runs per class per band: about ±5 pp per class at 30 % (Wilson intervals in the table), so a band's spread carries about ±6 pp of noise; a clean pass needs about 600 runs per class per band.
- The HP table was solved on the calibration seeds (and the class numbers chosen on them); the final grid is on fresh seeds.
- Band 21-25 is a low reading: from hero 23 the planner rushes once in-run levels end (VAL_HERO_XP, legacy.md 5.8 item 3, not built).
- The sim's in-run level cost is the designer's stand-in (10 × xpToNext); no Legacy purchases, trees or sets; one profile.
- Replays hold the run up to the boss fixed: exact for Oruvath's settings, not for class numbers (their zone effects need full runs; the Frost Lance step showed a 30 pp difference between replay and full run in band 11-15).
