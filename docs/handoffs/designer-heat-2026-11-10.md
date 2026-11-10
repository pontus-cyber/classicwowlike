# Hand-off: Heat meter and heat rewards (designer, 2026-11-10)

Task: owner feedback 14:05 [stated: docs/feedback/2026-11-10-1405-owner.md]: an always-visible heat meter and a reason to go into heat on purpose. Spec: docs/specs/expedition.md section H (constants in section 13, block "Heat").

## Pitch for the owner (5 lines)
1. A red line now chases you all run: each zone gets 20 of the boss's 120 par hours, and the HUD meter shows how far ahead of or past that line you are.
2. Four states: Clear (ahead), Warm (past the line, still free), Hot (10-30 h past: boss +4-8 %), Scorched (30 h+: boss +12 % or more).
3. Heat pays: a node entered Hot gives +35 % XP and gold and a 1-in-4 chance that each drop is one rarity better (Scorched +50 %, 2 in 5), plus an Echo per fight won.
4. So you choose: run hot for gear and meet a stronger Unlit Star, or stay clear, bank hours for a hard stretch later, and meet a weaker one.
5. In expedition zones the Dimming joins the same meter: working right at its edge counts as Hot and pays as Hot.

## Defaults (owner review: all of them)
HEAT_WARM_AT 0 h, HEAT_HOT_AT 10 h (= ASC_STEP_HOURS), HEAT_SCORCH_AT 30 h; HEAT_GAIN 0 / 0 / 0.35 / 0.50; HEAT_RARITY_UP 0 / 0 / 0.25 / 0.40; ECHO_PER_HEAT_FIGHT 1 (not prototyped); Dimming Warm at 4 h, Hot at 2 h; no reward at the Camp, the boss or in Dimmed encounters; state fixed at node entry. Ascendancy's formula is unchanged.

## Measured effect (scratch prototype, rows mode, planner P0, 900 runs per cell; not the real policy)
- Choice is real (B55): heat-seek 42.9 % vs heat-avoid 46.9 % win (4.0 pp, target within 5); seek reaches the boss more often with better gear, avoid meets a +0 % boss. Without heat the slow style trails by 15 pp.
- Used, not forced (B56): 81 % of winning runs had a Hot node (band 30-85 %).
- Power (B57): today's planner +3.3 pp (40.7 -> 44.0 %, cap 4). Paying from Warm gave +9 pp and was rejected.
- Side finding: with no heat, planner hour weight 4 beats today's PLANNER_HOUR_MULT 2 by 6 pp. The planner undervalues time.

## What each role must do
- UI: ship the meter now (H.4) from `heatView`. It works on display alone in rows mode: bar, red line, marker, "N h in hand / past the line", "Boss +N %", hover "ends Warm", toast on state change, summary track. In expedition runs it also shows the Dimming marker.
- Engine: `heatView(s)` (H.6); then H.3 rewards: XP/gold multiplier, one always-made rarity draw per rolled item (QA goldens move once), node entry state, the summary `heat` block, the Echo line; fold into rules.md 1.7, 8.4, 11.1 and engine-api.md.
- Sim: add the heat term to the value function; heat-seek and heat-avoid policies; measure B55-B57 on the real engine; recheck B31 (Echoes) and, in expedition, B43; check the PLANNER_HOUR_MULT finding.

## Commits, files, checks
- 8e1bcfa: docs/specs/expedition.md (section H, Heat constants in 13).
- This note: docs/handoffs/designer-heat-2026-11-10.md.
- Checked by: a scratch copy of src/ and sim/ at 5f67d5e in sim/out/heat/ (git-ignored), with the patch in src/engine/progress.js and items.js and a sum.mjs. Command in H.7. No src/ or sim/ file in the repository was changed.
