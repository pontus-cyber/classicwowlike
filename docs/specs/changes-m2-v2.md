# Spec changes M2 v2 (M2 task 2.3, design pass 2026-11-09b)

Owner: Lead Game Designer. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, QA.
Every changed or new line in docs/specs/rules.md and docs/specs/balance.md ends with "(M2 v2)". Decisions D16-D23 in docs/DECISIONS.md.

Type: **number** = the Engineer only updates src/constants.js; **mechanic** = engine code changes (exact behaviour below); **UI** = visual client; **bot** = simulator change (sim/); **target** = balance.md target band only.

Evidence: "S-..." are designer scratch runs of the simulator in a git-ignored copy (sim/out/x-*), planner bot unless noted, seeds 1000+, 600-run risk warm-up, 300 runs per class (600 for S-final); results in docs/handoffs/designer-2026-11-09b.md. "untested" = not measured.

## Change table

| # | Constant or rule | Old -> new | Problem | Evidence | Type |
|---|---|---|---|---|---|
| 1 | Interrupts always hit (rules 7.2 step 3, 7.7): Throat Jab, Spellsnap, Muzzle Shot | can miss/be dodged -> never miss, never dodged | 1, 2 | S-nomiss | mechanic |
| 2 | Linked per Shard (rules 7.2 step 6, 10.2); new LINK_DR_PER_SHARD; LINK_DR becomes the cap | -0.60 while any Shard lives -> -0.15 per living Shard, max -0.60 | 1, 2 | S-boss | mechanic |
| 3 | Shards take extra damage from AoE (rules 7.2 step 6, 10.2); new SHARD_AOE_TAKEN | none -> +1.00 from direct hits of aoe-tagged spells | 1, 2 | S-boss | mechanic |
| 4 | SHARD_HP | 1300 -> 1000 | 2 | S-boss; balance report proposal 2 | number |
| 5 | BOSS_HP | 11000 -> 13000 | 2 (re-tighten after 1-3) | S-final | number |
| 6 | BOSS_MELEE | 200 -> 260 | 2 (re-tighten after 1-3) | S-final | number |
| 7 | BOSS_TIME_PAR | 130 -> 120 | 5 (keeps the normal route about 20 h over par with 7 rows) | S-final | number |
| 8 | CLASS.mage.hpPerLevel | 14 -> 17.5 | 1 | S-mage1; balance report proposal 1 | number |
| 9 | CLASS.mage.stats.STA growth | 1.0 -> 1.25 | 1 | S-mage1; balance report proposal 1 | number |
| 10 | MANA_REGEN_ROUND_PCT | 0.02 -> 0.025 | 1 | S-mage1; balance report proposal 1 | number |
| 11 | SPELL.ember_bolt l / p | 1.5 / 0.8 -> 2.1 / 1.12 | 1 | S-mage-dmg, S-final | number |
| 12 | SPELL.frost_lance l / p | 1.1 / 0.6 -> 1.54 / 0.84 | 1 | S-mage-dmg, S-final | number |
| 13 | SPELL.pyre_comet l / p | 3.0 / 1.5 -> 4.2 / 2.1 | 1 | S-mage-dmg, S-final | number |
| 14 | SPELL.cinder_storm l / p | 1.0 / 0.45 -> 1.4 / 0.63 | 1 | S-mage-dmg, S-final | number |
| 15 | SPELL.starlance_barrage l / p | 1.0 / 0.5 -> 1.2 / 0.6 | 1, 6 (Arcanism lead) | S-trees | number |
| 16 | SPELL.glacier_spike l / p (talent m_b9) | 2.6 / 1.4 -> 3.9 / 2.1 | 1, 6 (Rimecraft) | S-trees | number |
| 17 | TALENT.m_b1.pct (Biting Cold) | 0.08 -> 0.12 | 6 (mage trees) | S-trees | number |
| 18 | TALENT.m_c4.pct (Ward Weaving) | 0.20 -> 0.10 | 6 (mage trees: Arcanism 59 % -> 35 %) | S-trees | number |
| 19 | TALENT.m_c7.share (Mindguard) | 0.30 -> 0.20 | 6 (mage trees) | S-trees (small effect) | number |
| 20 | TALENT.m_c8.pct (Arcane Momentum) | 0.02 -> 0.01 | 6 (mage trees) | S-trees (Arcanism -2.6 pp) | number |
| 21 | PET_DMG_POWER | 0.30 -> 0.375 | 1 (hunter) | S-final; balance report proposal 2 | number |
| 22 | PET_DMG_PER_LEVEL | 0.55 -> 0.65 | 1, 6 (Beastbond) | S-trees | number |
| 23 | TALENT.h_a2.petDmgPct (Ferocity) | 0.06 -> 0.10 | 6 (hunter trees) | S-trees | number |
| 24 | TALENT.h_a6.pct (Pack Leader) | 0.03 -> 0.05 | 6 (hunter trees) | S-trees | number |
| 25 | TALENT.h_b1.pct (Steady Aim) | 0.06 -> 0.04 | 6 (Marksmanship lead) | S-trees | number |
| 26 | TALENT.h_b4.critMult (Mortal Shots) | 0.20 -> 0.15 | 6 (Marksmanship lead) | S-trees | number |
| 27 | TALENT.h_c2.pct (Barbed Mastery) | 0.10 -> 0.20 | 6 (Wildcraft) | S-trees | number |
| 28 | TALENT.h_c8.pct (Cornered Beast) | 0.04 -> 0.08 | 6 (Wildcraft) | S-trees | number |
| 29 | PET.thornback.dmgMult | 0.7 -> 0.9 | B9 pets | S-pets (thornback 11 % -> 18 %) | number |
| 30 | ENERGY_REGEN (Rogue) | 30 -> 25 | class band (rogue far ahead after 1-3) | S-final | number |
| 31 | SPELL.open_vein.dot.p | 0.13 -> 0.10 | 6 (Venomcraft boss lead) | S-final | number |
| 32 | TALENT.r_c2.pct (Deep Wounds) | 0.12 -> 0.09 | 6 | S-final; balance report proposal 4 | number |
| 33 | TALENT.r_a3.pct (Serrated Finish) | 0.06 -> 0.08 | 6 (Bladework) | S-trees | number |
| 34 | Trainer guarantee (rules 1.4 step 2b); new TRAINER_ROW_MIN, TRAINER_ROW_MAX | none -> one Trainer in rows 3-5 of every zone | 3 | S-early | mechanic |
| 35 | SPELL.arcane_ward.lvl | 6 -> 4 | 3 (Mage has no Ward in zone 1) | S-early | number |
| 36 | SPELL.mark_prey.lvl | 6 -> 4 | 3 | S-early | number |
| 37 | SPELL.throat_jab.lvl | 8 -> 6 | 3 | S-early | number |
| 38 | SPELL.mend_companion.lvl | 8 -> 6 | 3 | S-early | number |
| 39 | Zone 1 quest cap (rules 2.1); new QUEST_MAX_SIZE_Z1 | 1-3 mobs -> at most 2 mobs in zone 1 | 3 | S-early | mechanic |
| 40 | QUEST_TURNIN_XP_FRAC | 0.80 -> 1.15 | 3, 4 (player under the row level) | S-early, S-rows7 | number |
| 41 | MOB_XP_FRAC | 0.20 -> 0.285 | 3, 4 | S-early, S-rows7 | number |
| 42 | GRIND_WAVE_XP_FRAC | 0.10 -> 0.115 | 5 (7 rows keep XP per zone) | S-rows7 | number |
| 43 | DUNGEON_CLEAR_XP_FRAC | 0.60 -> 0.70 | 4, 5 | S-rows7 | number |
| 44 | STORY_XP_FRAC | 0.80 -> 0.90 | 5 (7 rows keep XP per zone) | S-rows7 | number |
| 45 | TRAVEL_ON one level early (rules 1.5); new TRAVEL_EARLY_LEVELS | L >= exit level -> L >= exit level - 1 (Swift Boots: - 2) | 4 (speed lever) | S-slack | mechanic |
| 46 | ELITE_LEVEL_OFFSET | 2 -> 1 | 4 (elites 3-4 levels above the player) | S-early | number |
| 47 | ELITE_HP_MULT | 3.5 -> 2.8 | 4; B16 elite rounds | S-early; balance report "also measured" | number |
| 48 | DUNGEON_LEVEL_OFFSET | 6 -> 4 | 4 (dungeon 93-98 % death rate) | S-early | number |
| 49 | DUNGEON_BOSS_HP_MULT | 7 -> 5.6 | 4; B16 dungeon boss rounds | S-early; balance report "also measured" | number |
| 50 | ZONE_CHOICE_ROWS | 8 -> 7 | 5 (run length) | S-rows7 | number (engine); UI must drop its literal 8s |
| 51 | Pacing model (rules 3): PACE_MANUAL_ROUND_S split into new PACE_ROUND_ANIM_S + PACE_ROUND_DECIDE_S | 2.5 assumption -> 1.5 + 1.0 = 2.5, with a UI budget | 5 | QA finding 5 | number + UI |
| 52 | Round time budget at default animation speed (rules 3) | none (2.3-2.7 s measured at 1x) -> <= 1.5 s; input during enemy animation finishes it | 5 | QA finding 5; untested | UI |
| 53 | PACE_TRAVEL_NODE_S | 4 -> 3.5 | 5 | QA finding 5 (3.4 s measured) | number |
| 54 | Quest enemy count on the map (rules 1.4) | hidden -> shown | 3 | QA finding 3, BUG-QA-02; untested | UI |
| 55 | Tactician bot (balance.md 1): telegraph rules T1-T2, autoplay in the end-boss fight, new TACTICIAN_ADD_WEIGHT, TACTICIAN_SAFE_HP | 3-round search everywhere -> rules first, search in non-boss fights only | 5 (B5) | balance report miss 5; untested | bot |
| 56 | NODES_NORMAL, NODES_SPEED, FIGHTS_NORMAL, HOURS_NORMAL, HOURS_SPEED | 44-54, 32-42, 55-75, 135-165, 100-125 -> 38-47, 28-37, 48-66, 125-155, 70-100 | 5 (7 rows) | S-rows7 | target |

Count: 56 rows. 46 number changes (rows 4-33, 35-38, 40-44, 46-51, 53; row 50 also needs UI text fixes, row 51 also sets a UI budget), 6 mechanic changes (rows 1, 2, 3, 34, 39, 45), 2 UI-only changes (rows 52, 54), 1 bot change (row 55), 1 target change (row 56, five bands).

## Mechanic changes: exact behaviour

**M1. Interrupts always hit (row 1).** In `damage()` for the player's Throat Jab, Spellsnap and Muzzle Shot hits, skip the miss and dodge test (step 3). r1, r2 and r3 are still drawn, so stream positions do not change. Crit and variance apply as before. The interrupt and SILENCED then always land on a living target.

**M2. Linked per Shard (row 2).** Replace "boss takes -LINK_DR while any Shard lives" with `pct -= min(LINK_DR, LINK_DR_PER_SHARD × n)`, n = living (not despawned) Shards, in the boss's target modifiers (rules 7.2 step 6). Values: 1 Shard -0.15, 2 -0.30, 3 -0.45, 4 -0.60. DOT snapshots take n at application, as other step-6 modifiers do. The `linked` event keeps its meaning (on while n > 0); add `n` to it so the UI can show the strength (UI optional).

**M3. Shards take extra AoE damage (row 3).** In the Shard's target modifiers: `+SHARD_AOE_TAKEN` when the source is the player and the spell of the hit has the `aoe` tag (whirling_edges, rime_burst, cinder_storm, volley_rain, deadfall_trap, ricochet_bolt). Not for DOT ticks, the pet, basic attacks, items (Spark Flask) or other spells.

**M4. Trainer guarantee (row 34).** In map generation of every zone (stream map(z)), after the Rest guarantee and before the weighted fill: `row = TRAINER_ROW_MIN + nextInt(rng, TRAINER_ROW_MAX - TRAINER_ROW_MIN + 1)`; free = lanes of that row not yet filled (dungeon or rest); `lane = free[nextInt(rng, free.length)]`; the cell becomes 'trainer'. Two extra draws per zone, so maps of the same seed change (expected; replay of a seed + log stays deterministic). The weighted fill may still add further trainers (W_TRAINER unchanged).

**M5. Zone 1 quest cap (row 39).** In quest node setup: `size = min(z === 1 ? QUEST_MAX_SIZE_Z1 : 3, 1 + weightedIndex(rng, w))`. The draw is unchanged; only the result is capped; then mobs are drawn for the capped size. Note: every quest template in src/content/quests.js carries its own sizeWeights, so QUEST_SIZE_W1-W3 are only the fallback (the balance report's QUEST_SIZE_W3 proposal would have no effect).

**M6. Travel on one level early (row 45).** `canTravel`: `need = exitLevel(z) - TRAVEL_EARLY_LEVELS - (swiftBoots ? META.swift_boots.levels : 0)`; legal when `L >= need` or the last row is done. The sim's `exitLevelOf` (sim/bots/planner.mjs) must use the same formula. UI text "Travel on at level N" uses `need`.

## Notes for the team
- ZONE_CHOICE_ROWS = 7: the engine reads the constant everywhere (map, movement, content level, travel), so the change is a number for src/. The UI has literal 8s: src/ui/screens.js (map links loop `r < 8`, comments), src/ui/screens.js and src/ui/hud.js texts "finish row 8" / "after row 8". DUNGEON_ROW 4-6, REST_ROW 3-5 and TRAINER_ROW 3-5 stay inside 7 rows. Content level per row in zone 1 becomes 1, 2, 4, 5, 7, 8, 10.
- QA: qa/engine/s13-constants.test.mjs and qa/sim/params.test.mjs compare the spec tables with src/constants.js and sim/lib/params.mjs; they fail until both are updated. Tests that assume 8 rows, the old map draws or old values need updating with the change.
- Not changed although proposed in the balance report: BOSS_ARMOR (helped the rogue more than the hunter once interrupts always hit), QUEST_SIZE_W* (unused, see M5), W_TRAINER (replaced by the guarantee), TACTICIAN_HP_WEIGHT.
- Tried and rejected (designer scratch runs): a wider content-level span per zone (early deaths rose to 62-87 % of deaths), a Shard death damaging the boss (not needed once interrupts always hit), a steeper enemy damage curve (ENEMY_DMG_PER_LEVEL 3.2: little effect on mid-zone deaths), a larger story XP bonus (speed route 1 node shorter only), a bigger Arcane Ward (mage 1 % -> 8 % only).
