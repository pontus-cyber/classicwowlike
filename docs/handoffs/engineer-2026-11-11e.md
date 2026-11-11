# M2b v8 in the engine and the UI: tuning package rows 1-9, 2026-11-11 (Core Gameplay Engineer)

Task: docs/specs/changes-m2b-v8.md rows 1-9 (draft; D72-D77). Appendix A (pet revive) is not part of it and was not
touched. Spec tables are the source. Status: draft, as the change doc (BOSS_DMG_MULT 1.30 until the sim's ladder; D77
open to the owner's veto).

## 1. What changed
| Row | Change | Where |
|---|---|---|
| 1 | New EARLY_DMG_MULT 0.80, EARLY_DMG_MAX_LEVEL 20. `zoneDanger(M, variant)` = early(M) × the old form (dungeon trash and bosses take DUNGEON_DANGER_FRAC of the bonus, then × early). Every template enemy goes through it (normal, quest, grind, elite, rare, dungeon trash and boss, Camp waves, summoned and Signal adds, and the expedition's Shardspawn, exactly as zone danger); the end boss and its Shards are not made there. Intent estimates read `e.dmg`, so they follow | src/constants.js, src/engine/combat.js |
| 2 | ZONE_DANGER_STEP 0.25 -> 0.375: level 21 ×1.0375, 30 ×1.375, 60 ×2.5, dungeons at 60 ×1.75 | src/constants.js |
| 3 | CLASS.mage hpBase / hpPerLevel 50 / 19.5 -> 62 / 21.06 (62, 462, 1 305 HP at levels 1, 20, 60 before STA and items, as the change doc) | src/constants.js |
| 4-5 | BOSS_HP 13066 -> 12282; BOSS_DMG_MULT 1.17 -> 1.30 (Umbral Strike at asc 0: 338 before level modifier and armor) | src/constants.js |
| 6 | TALENT.h_a2.petDmgPct 0.125 -> 0.15625; TALENT.h_a1.petHpPct 0.08 -> 0.10 | src/constants.js |
| 7 | r_b4 healPct 0.03 -> 0.02; r_b7 healPct 0.10 -> 0.05 (CD reduction unchanged); r_b9 healPct 0.20 -> 0.10 | src/constants.js |
| 8 | h_c1 hpPct 0.04 -> 0.03; h_c4 pct 0.20 -> 0.10; h_c5 dodge 0.03 -> 0.02 | src/constants.js |
| 9 | New FREE_POTION_MULT 0.5. New `itemAmount(s, id, free)` in spells.js computes what one use restores (heal = round(heal × max HP × (1 + UNIQUE_POTION_PCT × potion uniques) × mult), mana = round(mana × max mana × mult), one rounding); `useItem` uses it, with mult = FREE_POTION_MULT for the free potion and 1 otherwise (× 1 is exact, so every other potion is bit-identical to before). The free potion's event is `{ t: 'action', kind: 'item', item, free: true, mult: 0.5 }`. Later potions of the fight: full amount, cost the turn | src/constants.js, src/engine/spells.js |
| API | New `potionInfo(state, itemId)` -> `{ id, free, mult, heal, mana }`: what one use restores now, before the cap; `free` = freePotion(state) and a potion. Same function as the use itself | src/rules.js |
| UI | The UI did not compute the free potion's heal (the log's heal line is the engine's `heal` event), but the item tooltip only said "costs no turn" next to the consumable text "Restores 35 %". Now: the bridge passes `legal.items[].mult`, `.heal`, `.mana` from `R.potionInfo` and the event's `mult`; the item-bar tooltip reads "Free action, half strength (Packed Satchel): your first potion this fight costs no turn and restores 116 health now", the aria-label and the combat log say "Free action, half strength (Packed Satchel)"; the Packed Satchel card and tooltip say "first potion each fight is free, at half strength" ("half" from FREE_POTION_MULT via `data.meta.freePotionMult`; new `strengthText`, `freeActionText` in ui-text.js) | src/ui/engine-bridge.js, src/ui/hud.js, src/ui/director.js, src/ui/ui-text.js |
| UI talent texts | Talent descriptions follow C.TALENT: Veiled Recovery 2 %, Shroudwalk 5 %, Death's Sidestep 10 %, Thick Hide +10 %, Ferocity +15.63 %, Hardy +3 %, Field Medic 10 %, Survivalist +2 % (the Now / Next totals already read the engine) | src/ui/mock-data.js (TALENTS, the talent tooltip's text) |
| Docs | rules.md: 5.1, 6.1, 6.3, 7.5, 7.6 (formula, examples, the 20/21 step), 10.1, 11.2 (Satchel row, meta power budget), 13 (EARLY_DMG_MULT, EARLY_DMG_MAX_LEVEL, FREE_POTION_MULT, ZONE_DANGER_STEP, BOSS_HP, BOSS_DMG_MULT with the ladder note), all marked "(M2b v8)"; status line. engine-api.md: status line, `zoneDanger`, `freePotion`, `potionInfo` (new row), section 3 free potion, the `action` event's `mult`. ARCHITECTURE rows of rules.js, constants.js, combat.js, spells.js, engine-bridge.js, ui-text.js and the zone-danger map line. qa/rules/COVERAGE.md rows 5.1, 7.5, 7.6 | docs/specs/rules.md, docs/specs/engine-api.md, docs/ARCHITECTURE.md, qa/rules/COVERAGE.md |

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **359/359** (354 before, plus 5 new) |
| s13-constants (rules 13 table, 5.1 class table, 6.3 Beastbond numbers, new: the 6.1 / 6.3 trims parsed from the Effect cells) | pass against the spec tables |
| New and changed tests | s16: free potion at half for Healing, Mana and Greater Healing Draught, later potions full, without the unlock full, a potion unique included, the event's `mult`, `potionInfo` in and out of a fight, null cases. s03: Mage HP at levels 1, 20, 60. s07 / api-events: zone danger with the early factor for every variant at levels 1-60 (level 20 ×0.8, 21 ×1.0375, 60 ×2.5, dungeons ×1.75), hits use it, XP and HP unchanged. s10: BOSS_HP 12282, BOSS_DMG_MULT 1.3 on Oruvath's hit, the estimate, a Shard and the Brand tick. s06 / r06: the trimmed talents and Beastbond by value. s11: the full catalogue's potion line reads normal amounts with the free potion used, and the free Greater draught at half |
| qa/rules | **56/56** |
| qa/docs (code map) | **3/3** |
| qa/sim | **83/83**: no failure from the changed numbers |
| Build (`node tools/build.mjs --out /tmp/v8/v8-game.html`) | 56 modules, 1 530 KB |
| ui-regress parts A, F, L at 1366x768 | **63/63**, no console errors. It includes OWN-L "every talent text with one per-rank percentage states the engine's number" and the Satchel card / tooltip / purchase checks |
| Free-potion page check (scratch /tmp/v8chk/free.mjs, not committed), 1366x768 and 1920x1080 | Slot 8 shows "Free"; aria-label and tooltip "Free action, half strength (Packed Satchel)", tooltip "restores 116 health now"; after key 8 the round stays 2, cooldown 4, the log reads "You use Healing Draught." / "Free action, half strength (Packed Satchel)." / "Healing Draught heals you for 116."; key A plays round 3. No console errors |

Not run: ui-regress parts B-E, G-K, ui-checks, full-run, playtest, pace, 1920x1080 for parts A, F, L.

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node tools/build.mjs --out /tmp/v8-game.html
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/v8-game.html --sizes 1366x768 --parts A,F,L
```

## 3. Commits (all on main)
| Commit | What |
|---|---|
| f688205 | Engine: rows 1-9, `potionInfo`, the UI texts, rules.md, engine-api.md, ARCHITECTURE, tests |
| (this note) | Engine: M2b v8 implemented; this hand-off |

## 4. Notes and open points (defaults taken)
1. **Ferocity's text.** The change doc suggests the tooltip "+15.6 %". The UI writes talent percentages with two decimals (`pct2`, as Pack Leader's 6.25 %), the Now / Next totals already show "+15.63 % pet damage", and ui-regress OWN-L requires each talent text to contain the engine's number in that form, so the text says "+15.63 % per rank". rules.md 6.3 states the exact 15.625 %. Say if the designer wants "+15.6 %" (OWN-L would then need a tolerance).
2. **zoneDanger below 1.** At levels 1-20 `zoneDanger` is now 0.8, so `zoneDanger - 1` is -0.2. The UI shows a danger line only when it is above 0, so zones 1-2 show none, as before; nothing tells the player early enemies are softer. A UI line is possible if the Lead wants one.
3. **Shardspawn** (expedition Dimmed encounters) take the early factor too: they are template enemies built through `makeEnemy`, and the change doc says the factor applies "exactly as zone danger does".
4. **Heat preview test seed.** The real-content Mage autoplay run of seed 3 no longer reaches the Camp (it dies at level 35); s01c now uses seed 1, which does. The engine's own autoplay dies early on most real-content Mage seeds both before and after v8 (it is not the sim's planner).
5. **Ladder.** If the sim picks BOSS_DMG_MULT 1.32 or 1.34, it is one constant plus the rules.md 13 cell; s10 pins the value (`C.BOSS_DMG_MULT === 1.3` and the literal in its formulas) and must change with it.
6. **Sim and bots.** No sim code reads potion amounts or the changed constants (checked: no use of HEAL_DRAUGHT_PCT, zone danger, BOSS_*, class HP or the trimmed talents in sim/; the tactician values potions through `R.step`), so the halved free potion reaches the bots through the engine. `potionInfo` is there if a bot wants the amount.
7. **Not touched:** balance.md (the change doc's "(M2b v8)" marks there are the designer's or Lead's), changes-m2b-v8.md, sim/, game.html, src/ui/mock-engine.js (the mock keeps its own old talent numbers; mock mode only). STATE_VERSION stays 3: no state field changed.
