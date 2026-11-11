# Spec changes M2b v14: the Rogue's zone 1 Deathblow, the expedition elite tooltip, the v13 gates

Owner: Lead Game Designer (combat), 2026-11-12. For: Core Gameplay Engineer (src/), Simulation & Balance Engineer (sim/), UI/UX Engineer, Lead. **Status: draft** (not approved). Proposed decisions D111-D113 (team) and owner item O14; hand-off docs/handoffs/designer-2026-11-12.md.

Input: the v13 measure [source: docs/reports/balance-2026-11-12.md, docs/handoffs/sim-2026-11-12.md]; engine readings 2 and 4 [source: docs/handoffs/engineer-2026-11-11j.md]; the Deathblow display [source: docs/handoffs/ui-2026-11-11e.md]; changes-m2b-v13.md; rules.md 5.3, 7.1, 7.4, 7.9, 7.10, 7.11, 1.9.5; combat-v2.md 6.2, 8, 16.2. No scratch runs for this package: every expected effect below is from the v13 measure or marked [inference].

Scope: autoplay's Rogue after a Sap on a lone enemy, PASS while every enemy is sapped, the map view of a hidden elite, and the defaults of two v13 switches. Nothing else changes. When the Engineer builds this package, every changed line in rules.md, combat-v2.md and engine-api.md is marked "(M2b v14)" in the same commit as the code.

## Why the Rogue lands a third of its zone 1 Deathblows
Autoplay's rule E2 Saps a lone elite or rare in the engage round. Sap cancels the enemy's turn 1 at the start of round 2 (rules 7.11), then rules 1-6 strike the only target in round 2, which breaks Sap; the Deathblow (turn 2, round 3) then plays. From level 6 Throat Jab answers it (rule 3); before level 6 the Rogue has no answer, so 33 % of its zone 1 Deathblows land and its zone 1 special deaths rise +6.1 pp (classic P0, 27.2 against 21.1 %) and +8.8 pp (expedition P0, 22.9 against 14.1 %); mage and hunter answer 100 % [source: report, reading 2 and B61 per class]. It is also behind most of the expedition B60 misses (opener line: Rogue elites 21.1 %, n 19) [source: report, B60 expedition].

Sap already answers the Deathblow if the Rogue waits one round: an intact Sap cancels the round-3 entry at the start of round 3, before the player acts, so the Deathblow is answered (STAGGERED) and the enemy is OFF_BALANCE for the Rogue's round-3 action (rules 7.11, 7.13). Two things stop that today: autoplay never waits, and PASS removes STEALTH (only openers, Sap and Premeditate keep it; src/engine/spells.js `playerAction`), so a manual Rogue who waits loses the Shadowstep Strike it would open with. Row 1 fixes both.

## Change table
Type: **rule** = engine code; **number** = constant; **view** = engine view only; **target** = balance target or switch.

| # | Constant or rule (spec section) | Old | New | Target | Expected effect, with basis | Type |
|---|---|---|---|---|---|---|
| 1 | **Wait in the shadows** (rules 7.4 STEALTH, 7.9 new rule H; combat-v2.md 6.2, 8). (a) **Autoplay rule H**, after rules 1-2 (potion, cleanse), before rule 3: if every living enemy is SAPPED and some SAPPED enemy's track shows a wind-up whose cancel the track predicts by SAPPED (7.11 "what the track shows"), the action is PASS. (b) **PASS keeps STEALTH** while every living enemy is SAPPED (as Sap and Premeditate keep it, rules 7.10) | autoplay strikes the sapped lone enemy in round 2 (Sap breaks; the Deathblow lands below level 6); PASS removes STEALTH | **(a) on, (b) on** | B61 Rogue zone 1; B60 expedition | The Rogue waits one round, Sap cancels the Deathblow (STAGGERED, -30 % enemy damage for the fight), and it opens from STEALTH into the OFF_BALANCE window (Shadowstep Strike from level 4). Expected: Rogue zone 1 Deathblows answered by autoplay 67 -> about 100 % (as mage and hunter); Rogue zone 1 special deaths 27.2 -> 21 % or lower on classic P0 and 22.9 -> 14-17 % on the expedition (back to or under the pre-package values; mage and hunter fell below theirs when they answered every Deathblow: 11.4 -> 4.5, 7.7 -> 2.5 %); Rogue planner reach +0.5 to +1.5 pp; expedition B60 opener-line elites 5.4 -> about 3 % (the opener's candidate list includes the autoplay action, so Sap, PASS, opener enters its beam) [inference, from report B61 per class and reading 2; unmeasured]. One-button and masher bots never Sap, so B59 and B62 do not move. Cost: one Rogue action in fights with a lone sapped special enemy; the enemy also loses turns 1 and 2. Keeps the Rogue's identity (Sap, patience, the opener from STEALTH) and Sap's rule (it still breaks on any damage) | rule (autoplay + STEALTH) |
| 2 | **Hidden elite's Deathblow on the map** (rules 1.9.5, engine-api.md 6.2; D50, D54): when an elite node hides its name (every expedition elite; a classic rare without Scout's Eye), the view gives `deathblow: { type }` only: `'heavy'` or `'cast'`, no `id`, `name`, `kind` or `damaging` | `deathblow: null` | **`{ type }`**; the UI line reads "Deathblow: a heavy blow (…)" or "Deathblow: a cast (…)" with UI text `deathblowKind(type)`, and no name | UI need 7 (v13); D50 | The player can plan the answer before entering (a heavy one is also answered by a full dodge, WARD, an image or the pet; a cast only by an interrupt, stun or control). D50 holds: in every zone the elite pool has one heavy (the brute) and at least one cast Deathblow, so no type identifies a rare. Posterior chance of a rare at RARE_CHANCE 0.20: zones 3-6 unchanged (heavy share 1/3 in both pools); zone 1 heavy 25 %, cast 14 %; zone 2 cast 33 %, heavy 0 % (Z2 rares are all cast: a heavy Deathblow there says "not rare", it never reveals a rare) [source: content tables, `deathblowOf` per zone; computed]. `kind` would break D50 (a rend in zone 1 and a cleave in zone 2 are rare-only), so it stays hidden. Content invariant (qa/content or the validator): each zone's elite pool keeps at least one heavy and one cast Deathblow | view |
| 3 | **O13 actuals** (owner note; changes-m2b-v13.md O13) | expected: one button reaches the end boss in about 9 % of classic P0 runs, the masher about 13 % | measured: **30.6 %** and **43.0 %**; wins **0.0 %** and **0.3 %**; per-fight deaths match the spec (one button elite / rare / dungeon boss / zone 1 50.6 / 84.0 / 79.4 / 55.8 % against arm C's 50.0 / 80.5 / 79.0 / 51.0 %) | O13, owner 20:57 | **No change.** The owner's ask is deaths in one-button special fights; those meet B59 with 10-31 pp margin and a one-button run almost never wins. The run-level estimate was wrong because the scratch base reached the boss in 37.8 % before the package, the mash cell in 46.9 % [source: report reading 3]. Row 4 (zone 1 rare HP) lowers one-button zone 1 rare deaths 90 -> 60 % on the replays, so its reach rises a little further, about +1-3 pp [inference]; cell 1 reports it. If the owner wants lower one-button reach, the reserve lever is v13 cell 9 (special-fight enrage), not a deeper Deathblow, which would hit autoplay (B61). Owner item O14 | note |
| 4 | **v13 rows 5 and 6 on by default** (rules 2.3, 7.12, 13): `C.GATES.rareHpMultZ1` (RARE_HP_MULT_Z1 3.0) and `C.GATES.firstMeetWindup` | both false (off) | **both true**; the switches stay for sim arms | B60 rares; B62 | Decision rules applied by the sim [source: report, decision rules]: row 5's gate opened (opener line zone 1 rare deaths 80 %, n 10); with it B60 classic rares 29.7 -> 13.5 %, opener line zone 1 rares 80 -> 20 %, one button still 75.7 % in rares, planner reach +0.3 pp, win +0.2 pp [measured: cell 6]. Row 6 moved one-button and planner quest and grind deaths <= 0.1 pp (rule: <= 1 pp); first-met quest think share 9.4 -> 11.6 % [measured: cell 7]. Expected with both on: expedition B62 (b) 7.2 nodes -> about 7.0 (row 6 adds think fights in quest fights) [inference; read in cell 2] | target (switch defaults) |

Count: 4 rows. 1 rule with two parts (row 1), 1 view (row 2), 1 owner note (row 3), 2 switch defaults (row 4).

### Levers considered for row 1 and not taken
| Lever | Why not |
|---|---|
| Sap survives the first damage (or holds until the enemy's next turn) | changes Sap for every manual fight (a free hit plus a cancelled turn in multi-enemy fights) and reopens D49 and D65's measured Sap balance; the problem is that autoplay does not wait, not that Sap is weak |
| A fourth Rogue engage option that answers a lone enemy's Deathblow | breaks the three-options panel (combat-v2.md 6.2, B51) and adds a second answer where Sap already is one |
| Throat Jab at level 1-4 (today 6) | changes the Rogue's levelling kit in every fight, normal casters and the grind included (B62 (a), B6); the Rogue already has a level-1 answer (Sap) |

## Exact behaviour
- **Row 1 (a).** autoplay.js combatPolicy, after rules 1-2 and before rule 3, not in the engage round: if every living enemy has SAPPED and at least one SAPPED enemy has a track entry after the now-entry with `windup` whose predicted cancel is `by: 'SAPPED'` (the track's cancel prediction in track.js: `by` SAPPED, `stagger` true), return PASS. It applies to any class that has SAPPED enemies (today only the Rogue). It also covers an elite whose add died before the Deathblow's round. Bots on autoplay (planner, greedy, speedrunner, the opener's autoplay candidate and continuation, tactician continuations) get it through the engine.
- **Row 1 (b).** spells.js playerAction: a PASS keeps STEALTH when every living enemy has SAPPED at the time of the action. Rules 7.4's STEALTH row "removed by any non-opener action" gets "(except Sap, Premeditate, and a PASS while every living enemy is SAPPED; M2b v14)".
- **Row 2.** expedition.js `details` and rules.js map view: an elite node whose `name` is null gets `deathblow: { type }` from `deathblowOf(...).type` (else null as today). Nodes with a name keep the full object. The content check fails if a zone's elite pool lacks a heavy or a cast Deathblow.
- **Row 4.** constants.js `GATES`: `rareHpMultZ1: true`, `firstMeetWindup: true`. Tests that assume them off set them off explicitly. rules.md and combat-v2.md lines for rows 5-6 drop "gated, off by default" and say "on (M2b v14, sim decision rules of the v13 measure)".

## UI needs (UI/UX Engineer)
1. Autoplay hint (v13 UI need 8): when rule E2 Saps a lone special enemy, the line reads "Autoplay will answer the Deathblow with Sap, then wait a round" (from `autoplayEngage`; the engine adds `wait: true` when rule H will apply).
2. Sap as an answer (today "?", a chance): in a fight where every other enemy is dead or sapped, the card and tooltip say "Sure if you wait: press Pass next round; you stay hidden". The bar's Pass button gets the answer ring in round 2 of such a fight.
3. Map tooltip for a hidden elite (row 2): "Deathblow: a heavy blow (…)" or "Deathblow: a cast (…)", no name.

## What the sim must run
Engine: the package as built (rows 1, 2, 4), with a switch for row 1 (a) and (b) separately (scratch or `C.GATES.sapHold`, `C.GATES.passStealth`). Same seeds, tables and tools as the v13 measure (sim/measure-v13.sh, sim/v13report.mjs), paired with the v13 cells. About 20 minutes; run in order, cut from the bottom.

| # | Cell | Runs | Checks | About |
|---|---|---|---|---|
| 1 | Classic P0, gates on: planner with row 1 on, planner with row 1 off; onebutton | 1 000 per class each | **row 1**: Rogue zone 1 Deathblows answered, Rogue zone 1 special deaths, B61 per class; **row 3**: one-button reach and win with rows 5-6 on | 4 min |
| 2 | Expedition P0 with the start camp, gates on, row 1 on: planner 300 per class; onebutton `--think --think-mash` 50 per class | as listed | **B60 expedition** (opener line elites, dungeon bosses), B61 Rogue zone 1, **B62 (b)** spacing | 10 min |
| 3 | Classic P0 onebutton `--think` 50 per class, gates on, row 1 on | 50 per class | B60 classic with both gates and row 1; B59 unchanged | 4 min |
| 4 | Classic P0 planner, row 1 (a) only (PASS removes STEALTH) | 1 000 per class (Rogue only is enough) | the value of row 1 (b) | 1 min |

Decision rules:
- **Row 1 stays** if, in cell 1, autoplay answers >= 95 % of the Rogue's zone 1 Deathblows and the Rogue's zone 1 special deaths are within +3 pp of the pre-package value (21.1 % classic; cell 2: 14.1 % expedition), and the Rogue's reach and win are not below the row-1-off arm by more than 2 pp. Else report and keep row 1 off.
- **Row 1 (b)** stays if cell 4's Rogue reach is not above cell 1's row-1-on Rogue reach (it should be lower: no opener after the wait); otherwise drop (b) and keep (a).
- **B60 expedition**: report elites and dungeon bosses with row 1; if the dungeon-boss miss stays (6.5 %, n 31), list the templates (Disrupt fights, not Sap; outside row 1).
- **Row 2** needs no sim: an engine test (every expedition elite node has `deathblow.type` and no name) and the content invariant.
- Report per row, by class, and the one-button reach for O14.

## Not in this package
- B12 (speedrunner gear) and row 6's small think-share effect (+2.2 pp against the 6-12 expected): left to the Lead's next combat or expedition package. If cell 2 leaves expedition B62 (b) over 7 nodes, the next lever is the first meeting's stakes (a higher EMPOWER value for its wind-up; still no Deathblow or MAIMED), not more special fights.

## Proposed decisions (for the Lead to log)
| # | Decision | Owner |
|---|---|---|
| D111 | Wait in the shadows: autoplay rule H passes while every living enemy is SAPPED and a sapped enemy's wind-up is predicted cancelled; a PASS keeps STEALTH while every living enemy is SAPPED (row 1) | team |
| D112 | A hidden elite shows its Deathblow's type (heavy or cast) on the map, not its name or kind; content keeps a heavy and a cast Deathblow in every zone's elite pool (row 2; D50 holds) | team |
| D113 | v13 rows 5 and 6 on by default (RARE_HP_MULT_Z1 3.0; first-meeting wind-up), switches kept for the sim (row 4) | team |

## Owner items
| # | Question | Default |
|---|---|---|
| O14 | One-button play reaches the end boss in 30.6 % of classic P0 runs and the masher in 43.0 % (expected about 9 and 13 %), but they win 0.0 % and 0.3 %, and their special-fight deaths are as asked (one button: elites 51, rares 84, dungeon bosses 79 %). Keep the package as it is? | yes, no change (reserve: special-fight enrage, v13 cell 9) |

## Constants
| Constant | Old | New | Unit |
|---|---|---|---|
| Autoplay rule H (rules 7.9) | - | on | rule |
| PASS keeps STEALTH while every living enemy is SAPPED (rules 7.4) | no | yes | rule |
| `C.GATES.rareHpMultZ1` | false | true | switch (RARE_HP_MULT_Z1 3.0) |
| `C.GATES.firstMeetWindup` | false | true | switch |
