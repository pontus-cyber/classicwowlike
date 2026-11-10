# Hand-off: Lead Game Designer (combat), 2026-11-10 — combat v2

Spec: docs/specs/combat-v2.md (change set on rules.md 7; constants in its section 15). Trigger: docs/feedback/2026-11-10-1043-owner.md.

## Pitch for the owner (6-10 lines)
Today levelling fights do not reward play: a bot that just presses its biggest button reaches the boss as often as autoplay (81 % against 82 %) [source: scratch measure, 900 runs per bot].
Combat v2 makes the first five moves the decision:
1. Every enemy shows its next 3 actions (an intent track), and each enemy type has a fixed, different opening: the brute's big swing on turn 2, the caster's Hex Bolt on turn 2, the skulker calls a reinforcement on turn 3, the beast grows stronger each turn, the mender shields and heals, the guardian protects a named ally.
2. Stopping or dodging a big move knocks the enemy off-balance: your next hit does +30 % and crits more, so you hold your burst for the window instead of spending it in round 1.
3. Every fight starts with an engage round in which nobody hits you: each class picks a strike, a control or a setup opener (Rogue: Ambush, Sap, Premeditate; Mage: Pre-cast, Binding Glyph, Gathered Power; Hunter: Opening Shot, Lay Trap, Send the Pet).
Mashing still gets through easy fights; it loses to packs that need a plan. Autoplay stays a safe default but does not read the track or hold for windows.

## Open choices (default first)
1. A stun cancels the enemy's current action, later actions keep their rounds (alt: stun delays the whole track).
2. Engage round for every class, paid for by enemy damage × 1.15 (alt: Rogue only plus one universal pull).
3. Track shows 3 actions (alt: 2 or 5).
4. No engage round against the end boss (alt: one with control options off).
5. Autoplay reads only the current action (alt: reads the track; smaller manual edge).
6. Window +30 % damage taken, +20 % crit, one action (alt: +50 % for one action or +20 % for two).

## Measured and expected effect
Prototype on the real engine in a git-ignored copy (sim/out/combat2/), P0, 300 runs per class, seeds 1000-1299: opening scripts, off-balance (damage only) and a free engage round with the bar spells only; no engage options, Signal, Bolster, Bloodlust or track display yet.
- Measured: at matched autoplay difficulty (reach the boss 82.0 % against 82.3 % today, enemy damage × 1.15), the masher falls from 80.9 % to 74.7 % and its non-boss deaths rise from 4.54 to 6.30 per 1 000 fights (autoplay 4.22). Fight lengths unchanged (quest 5 rounds, elite 8, dungeon boss 11).
- Measured, negative: the existing per-round 3-round search (tactician style) is not a planner; in the first five rounds it does worse than autoplay (77.0 % reach) because it holds potions and cannot wait two rounds for a window. Planning value (B48, B50) needs the sequence-planning opener bot of spec section 11.
- Expected [inference]: the engage options and pack roles widen the planner-masher gap to the B49 band (>= 8 pp) and move B5 (tactician - planner) from 12.6 pp to 15-30 pp, with most of it in the opening.
- With the expedition: combat at the slower animation costs 3.1 s per round plus 9 s per fight; 50 fights today would be 23 min of combat. Budget 21 min (B53) needs 34-42 fights per run: grind nodes as one fight and no 1-mob filler fights, which matches the expedition's fewer, weightier fights. Every fight then has an opening worth planning.

## Implementation plan (rough size)
- Engine (Core Gameplay Engineer, M-L, about 400-600 lines): intent track with entry-time draws (combat.js), archetype scripts and signature turns, Signal / Bolster / Bloodlust / guardian ward, OFF_BALANCE status and the 7.2 step 6 hook (damage.js), engage round for all classes and the `ENGAGE` action with 9 options (spells.js, actions.js), autoplay rule E, boss track and boss OFF_BALANCE hooks; rules.md 7 and engine-api.md updated in the same commit; Content: add pools and composition rules.
- UI (UI/UX Engineer, M): 3-entry track per enemy frame, role badges, engage panel with effect preview, opening ruler (rounds 1-5), OFF_BALANCE marker and bar highlight, log lines, node tooltip with enemy count and types; animation at 2.1 s per round.
- Sim (Simulation & Balance Engineer, M): masher bot, sequence-planning opener bot, fight replay harness (B50), recorder fields, B48-B54 and the changed B5/B15/B16 rows; then tune ENGAGE_DMG_COMP and OFFBAL_TAKEN. The scratch masher/opener code and the patched engine in sim/out/combat2/ are a starting point.
- Order: engine and sim first (one measure decides the window size and compensation), UI in parallel from the spec.

## Commits, files, checks
- Files: docs/specs/combat-v2.md (new), docs/handoffs/designer-combat-2026-11-10.md (new). No src/, sim/, rules.md, balance.md or expedition.md change.
- Checked: prototype cells re-run with the commands in spec section 13; numbers in the spec are read from the run records with sim/out/combat2/an.py. Commit hash: see the Lead's log (this note's commit).
