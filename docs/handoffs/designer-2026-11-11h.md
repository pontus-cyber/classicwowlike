# Hand-off: Lead Game Designer (combat and balance), 2026-11-11h (M2b v13, special fights demand thought, draft)

Task: owner 18:41 / 18:46 / 20:57 (docs/feedback/2026-11-11-1841-owner.md): one-button deaths much higher in elite, rare and dungeon-boss fights; grind unchanged; autoplay playable. Spec: docs/specs/changes-m2b-v13.md. Status: draft. No src/ or sim/ change; balance.md, rules.md and combat-v2.md not edited (B59-B62 and the rules are folded in when D105-D110 are accepted). v12 rows untouched.

## Findings (mash records, scratch script)
1. A landed wind-up costs +15 % for the rest of the fight, which a potion pays for: one button lands 74 % of elite wind-ups and dies in 11 % of those fights.
2. Potions carry one button in special fights (elite deaths 9.6 % with, 15.9 % without).
3. Zone 1 cannot tell one button from autoplay (Z1 elite deaths 3.6 / 3.1 %): no interrupts before level 6-14, and rule E uses the engage control only with 2+ enemies.
4. The Z1 rare kills every policy (23-round fights past the soft enrage at round 20).
5. One-button fights are not slower than planned ones (elite 8.3 vs 7.3 rounds), so a turn-limit enrage does not separate them; the default target already picks the healer, so target choice cannot punish one button.

## Package (7 rows)
1. DEATHBLOW_MULT 2.0: the first wind-up (turn 2) of elites, rares and dungeon bosses hits × 2 on top of today.
2. DEATHBLOW_EMPOWER 1.00: a landed Deathblow gives +100 % enemy damage for the rest of the fight (other wind-ups keep 0.15; stacks are summed).
3. MAIMED (MAIM_HEAL 0.50): a landed Deathblow halves the player's healing (potions included) for the rest of the fight. This is the potion limit; a per-fight potion cap was measured and adds nothing on top.
4. Autoplay rule E2: in special fights autoplay uses the engage control option (Disrupt on a dungeon boss, Sap allowed) on the enemy with a visible wind-up.
5. Zone 1 rare HP 4.5 -> 3.0, gated on the opener line's Z1 rare deaths.
6. First-meeting wind-up for a new normal enemy type in quest fights (grind stakes), gated on B62.
7. Targets B59-B62.

## Measured in scratch (classic P0, 300 per class, rows 1-4 together)
- One button: elite 11.5 -> 50.0 %, rare 42.3 -> 80.5 %, dungeon boss 31.2 -> 79.0 %, Z1 specials 18.7 -> 51.0 %. PALL: 28.9 / 63.7 / 70.9 / 51.6 % (elites miss 40: O11).
- Masher: 6.5 / 28.1 / 20.7 -> 42.2 / 71.5 / 71.4 %.
- Opener (30 per class): elite 0.9, rare 3.8, dungeon boss 0.9 % (base same seeds 1.0 / 12.0 / 1.9).
- Autoplay: reach 82.7 -> 82.3 %, win 31.3 -> 32.3 %; elite 1.0, rare 12.7, dungeon boss 2.2 %; PALL reach 91.2, win 57.8 %.
- Normal quest, grind, trash deaths: unchanged within 0.1 pp for one button and autoplay.
- Consequence: one-button reach the boss 37.8 -> 9.0 % (P0), masher 56.8 -> 13.4 % (O13).
Not measured: expedition, think replays (B59 replay column, B60), spacing (B62 b), rows 5-6.

## Sim plan
9 cells, about 45 min on 2 workers; decision rules in the spec (DEATHBLOW_MULT up to 2.4 if elites fail; EMPOWER down to 0.75 if autoplay fails with > 15 pp margin).

## Owner items
- O11: one-button targets binding at P0 only; PALL reported, elite floor 25 %. Default: as written.
- O12: autoplay answers the Deathblow in every special fight (shrinks the planned opening's edge there). Default: on.
- O13: one button and a fixed rotation become losing strategies (about 9 % / 13 % reach the boss). Default: yes.

## Risks
- Scratch arms are 300 runs per class; the opener check is 90 runs. One-button runs now end early, so later-zone special fights have few one-button samples; the think replays on the planner's fights would be the cleaner B59 basis if the sim adds one (onebutton as a replay policy).
- Rule E2 lets the Rogue Sap a lone elite in autoplay (D49 said never); measured only pooled.
- MAIMED is not removed by dispersal by design; the UI must make that clear.

## Proposed decisions
D105-D110 (team), O11-O13 (owner, defaults apply); table in the spec.

## Files
docs/specs/changes-m2b-v13.md (new), docs/BACKLOG.md (one-button item updated, two items added), this note. Scratch copy and env switches: /tmp only, not committed.
