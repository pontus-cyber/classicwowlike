# Rule coverage map (M1 1.5)

Every section of docs/specs/rules.md and the tests that cover it. Engine suite: `node --test qa/engine/` (154 tests, Core Gameplay Engineer). QA suite: `node --test qa/rules/` (this folder). Browser: qa/browser/full-run.mjs and ui-checks.mjs.

File keys. Engine: E00 s00-s01-structure, E02 s02-nodes, E03 s03-s04-character, E05 s05-classes, E06 s06-talents, E07 s07-combat, E07b s07b-combat-v2, E08 s08-s09-items-death, E10 s10-boss, E11 s11-s12-meta-content, E13 s13-constants, EH health. QA: Q01 r01-r02-map-nodes, Q04 r04-r07-character-combat, Q06 r06-talents, Q08 r08-items, Q09 r09-r11-summary-meta, Q10 r10-boss, QA api-legal. B browser scripts.

| Section | Covered by | QA additions and notes |
|---|---|---|
| 0 Conventions (integers, RNG streams, consequence) | E00 rounding, streams, JSON generator, weighted draws, map/loot independent of fights; EH determinism (B35), purity, plain JSON | B: the browser run and its Node twin agree on every state of a full run (same seed, same choices) |
| 1.1 Phases and actions | E00 phase path, out-of-combat legality; EH legalActions sound, illegal actions throw | QA: every legal action that changes the state is listed by legalActions (the UI enables controls from it) |
| 1.2 Character creation | E00 start kit, meta at creation | - |
| 1.3 Zones | E00 bands and exit levels | - |
| 1.4 Map generation, node setup, movement, hub | E00 constraints over 300 seeds × 6 zones, CL per row, node setup, movement, hub services; E13 node weights | Q01 type shares follow W_*, quest offsets uniform, CL capped at 60, map visible on entry (one archetype per enemy, rare hidden), hub vendor at the band minimum. B: the map tooltip drops the enemy count (BUG-QA-02) |
| 1.5 Leaving a zone | E00 TRAVEL_ON rules, Wayfinder, Swift Boots, forced after row 8 | - |
| 1.6 Camp | E00 camp waves at 58 | Q01 camp vendor at content level 60 |
| 1.7 In-game time and Ascendancy | E00 formula and boss HP | Q10 all boss damage × (1 + asc); Q09 speed bonus at or under the par |
| 1.8 Trade-offs | emergent: sections 2, 8, 10 | playtest notes in docs/handoffs/qa-2026-11-09.md |
| 2.0 Node summary, mob kill XP | E02 hours per type, kill XP per kind | - |
| 2.1 Quest | E02 rewards, story chain, flee | Q01 exact turn-in XP with diffMod above and below, encounter size weights, zone normals |
| 2.2 Grind | E02 waves, hours, stop | Q01 exact wave XP; stopped after wave 1 of 3 costs 1 h |
| 2.3 Elite | E02 multipliers, add, rare, drop, coin | Q01 add and rare frequencies, 1 ability (rare 2), rare XP and loot |
| 2.4 Dungeon | E02 3 trash + boss, leave, no flee, clear rewards | Q01 trash sizes 50/50, leave keeps loot and hours, exact clear XP; Q04 flee from trash |
| 2.5 Rest | E02 | - |
| 2.6 Vendor | E02 stock, prices, buy/sell; E08 Ember limit, Alchemist; E11 Thrift | - |
| 2.7 Trainer | E02 learn, train, train all, respec; E11 Ledger | - |
| 2.8 Treasure | E02 guard, chest, trap never kills | Q01 guard and trap frequencies, trap damage 15 % (the E02 assertion never runs on its seed) |
| 2.9 Shrine | E02 boon effects and durations | Q01 boon weights without replacement, Insight +20 % XP |
| 3 Pacing model | E03 estSeconds; E07b PACE_ENGAGE_S (manual only), 3.1 s and 1.1 s rounds (combat v2) | measured: about 2.3 s of animation per manual round at 1× (playtest notes) |
| 4.1-4.2 Stats and derived values | E03 formulas and caps; E06 stat talents | - |
| 4.3 Levelling | E03 curve, carry-over, HP rise, talent points | Q04 mana rises with max mana |
| 4.4 XP per event | E03 diffMod table, eventXp with Insight and Quick Study; E02 rested | - |
| 5.1 Classes | E13 base stats; E05 basic attacks | - |
| 5.2 Learning, ranks, bars | E05 bar only, tl strength; E02 trainer | Q04 talent spells follow L; bar and item-bar edits out of combat. Todo: spellInfo.tl of talent spells (BUG-QA-06) |
| 5.3 Rogue spells | E05 every spell; E13 level/cost/CD; E07 autoplay rules | - |
| 5.4 Mage spells | E05 every spell | - |
| 5.5 Hunter spells and pets | E05 every spell, pet values, specials, aggro, death and revive | - |
| 5.6 Meta spells | E05 | - |
| 6 Talents (points, tiers, capstone, 81 talents) | E06 points, tiers, one capstone, new-spell talents, about 30 talents; E13 table | Q06 the other 50 talents (damage, DOT, ward, crit, pet, resource and mechanic talents). All 81 now have an assertion. E06 names Crippling Toxin, Glacier Spike ×1.5 and Barrage Mastery without asserting them; Q06 does |
| 7.1 Fight flow | E07 round order, autoplay toggle legal, fight start/end, engage round Unaware for every class (combat v2) | Q04 end-of-round order (player-side ticks first). B: the UI Autoplay toggle never plays (BUG-QA-01) |
| 7.2 Damage pipeline | E07 independent re-implementation, 3 draws per event, MIN_HIT, WARD, IMMUNE, level clamp, CHILLED/CURSED, DOT snapshot | Q04 heals draw nothing and never crit |
| 7.3 Resources | E07 costs, mana rounding, focus regen | Q04 energy regen and cap, cost on a miss |
| 7.4 Status effects | E07 durations, refresh, per-source BLEED, dispersal, BRAND, POISON, WARD, EXPOSED/MARKED, EVASION cap, TAUNT; E05 STUN, FROZEN, HEXED, SILENCED, STEALTH, IMMUNE, HOT | Q04 STEALTH gained mid-fight lasts one round |
| 7.5 Items in combat | E07 item bar, shared POTION_CD, Tonic, Spark | Q04 Spark and Tonic have no cooldown, Spark formula |
| 7.6 Enemy AI and intents | E07 stats (× ENGAGE_DMG_COMP), weights (turn-5 picks), SILENCED, Mend, cooldowns, soft enrage, templates; E13 archetypes; E07b ENGAGE_DMG_COMP not on the end boss | - |
| 7.7 Interrupts | E07; E05; E10 boss channel in either round; E07b OFF_BALANCE after an interrupt (also the end boss's Litany) | - |
| 7.8 Flee | E07 chance, stealth, bosses; E02 quest flee; E07b legal in the engage round | Q04 flee from a dungeon fight |
| 7.9 Autoplay policy | E07 rules 1-6, default target; E07b rule E (control on the most damaging track, strike, Mage Pre-cast, ties), SAPPED skipped by the default target | Q04 ">= N enemies" ignores HEXED and SAPPED; rations between fights |
| 7.10 Engage round (combat v2) | E07b ENGAGE only in the engage round (not round 2, not the end boss), every listed ENGAGE steps, control options vs immune enemies (engageOptions reason), each of the 9 options; E13 option table; EH ENGAGE in full runs | - |
| 7.11 Intent track (combat v2) | E07b turns 1..3 at start, draw counts (scripted 0, aggro per entry, turn by turn), no draw at round 1 -> 2, one entry per round, entries fixed once shown, re-seeded look-ahead re-draws only new entries, pick cooldowns (track, e.cds, later scripted entry), control cancels without delay, replacement with reason, TAUNT at now and in the shown targets, adds draw at once; E05 pet-aggro share; E07 interrupt draw count | - |
| 7.12 Opening scripts and pack roles (combat v2) | E07b scripts per archetype, lone skulker, signatures (elite, rare, dungeon boss turn 5), script multipliers, Signal (add pool, level, no rewards, once, interrupted), Bolster, Bloodlust (step, cap), guardian ward; E13 script table | - |
| 7.14 Encounter composition (combat v2) | E07b rule examples, every generated quest, grind, elite + add, dungeon and Camp encounter valid over 150 seeds × 6 zones, repair draws only when needed (1 draw, fallback), add pool from the zone and validated, mapView archetypes for treasure guards and dungeon fights; E00 quest draw order with the repair | - |
| 7.13 Off-balance (combat v2) | E07b interrupt, control on a heavy (mid-round and at turn start), avoided heavies (miss, WARD, IMMUNE, TAUNT; not hit, not pet aggro), +OFFBAL_TAKEN, +OFFBAL_CRIT, dodge 0, FROZEN counts once, durations, end boss (Litany, Crush) | Q06 Brittle vs FROZEN (FROZEN counts as OFF_BALANCE) |
| 8.1-8.3 Slots, rarity, budget | E08 formulas, rarity stats, class bias, item score | - |
| 8.4 Drops | E08 mob chances, rare share, guaranteed elite drops, draw order, Ember, uniques | Q08 rarity weights of all 9 sources, trash item chance, grind × 1.5, slots uniform; Q01 rare elite loot |
| 8.5 Gold | E08 V(L), sell, junk; E02 coins; E11 Prospector | - |
| 8.6 Consumables | E07; E08 rations, elixir, Ember | Q04 Spark Flask, Tonic |
| 8.7 Bags | E08 capacity, stacks, loot window | Q08 autoplay discards junk first, then the lowest sell value |
| 9 Death, resurrection, summary | E08 charge order, death location, Frailty | Q09 every summary field of rules 9, resurrection keeps the round and the enemies, killer and ability |
| 10 End boss | E10 setup, phase 1 schedule, Litany, interrupts, Chrono Sigil, phases 2-3, enrage, victory | Q10 Ascendancy on damage, telegraph counters predict the schedule, Crush heavy. Todo: Pulse and Shards counters (BUG-QA-07) |
| 11 Meta progression | E11 Echoes, catalogue, unique effects, unlocks, Oaths, END_RUN | Q09 speed bonus, progress scaling, profile carried into the next run. B: profile saved after a run |
| 12 Content ranges | E11 validator (fixture, strict real content, errors), engine never changes content; E13 ability templates | - |
| 13 Constant table | E13 every constant and data table against rules.md | - |

## Not tested, and why
- 1.4 "re-draw at most 10 times, then Quest": with the spec weights the fallback needs about 0.36^10 odds in a row-1 cell (about one map in 30 000) and the generator cannot be given a fixed stream from outside. Review only: map.js places 'quest' after MAP_REDRAW_TRIES.
- 3 Pacing in real seconds of a human: needs the owner; QA measured only the animation time of a round.
- The text simulator (task 1.2): not on main at a4ed861, so "one class from level 1 to the boss in the text simulator" could not be checked.
- Art, animation and "feel" quality: review of screenshots only.

## Test notes (qa/engine, no game impact)
- s06 test names claim Crippling Toxin, Glacier Spike ×1.5 and Barrage Mastery but the bodies do not assert them (now in Q06).
- s02 "2.8 treasure": the trap-damage assertion sits under `if (trap.length)` and never runs with seed 12 (now in Q01).
- s11 "11.4": the Prospector assertion runs in a promise the test does not return; a failure would be reported against the file, not the test.
