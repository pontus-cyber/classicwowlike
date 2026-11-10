# Hand-off: Lead Game Designer (combat), 2026-11-10b: combat v2.1

Spec: docs/specs/combat-v2.md section 16 (and lines marked "(combat v2.1)"), docs/specs/rules.md 7 and 13 (marked "(combat v2.1)"), change table docs/specs/changes-combat-v21.md, decisions D55-D59. Trigger: docs/reports/balance-2026-11-10d.md (owner goal docs/feedback/2026-11-10-1043-owner.md).

## Pitch for the owner (5 lines)
1. Elites and dungeon bosses now telegraph a wind-up in round 3 (a dungeon boss again in round 5). You can see it from the first round.
2. Answer it (interrupt, stun, control, a trap, a full dodge or the pet) and the enemy is staggered for the rest of the fight: -30 % damage. Let it land and it is empowered to the end: +15 % per wind-up.
3. Every class can answer a dungeon boss's first wind-up from level 1: its control opener becomes Disrupt on a boss.
4. Mashing still clears normal fights, but it lands the wind-ups and dies to elites and bosses: 5 to 7 times as many elite and boss deaths as a planned opening.
5. Setup openers are stronger: Premeditate gives a full 5 combo points, Gathered Power three free guaranteed crits.

## Measured effect (scratch on the real engine, heat engine 8507303; P0, 900 runs per cell, seeds 1000-1299, paired)
| | Autoplay reach | Masher reach | Planned opening (opener) reach | Autoplay - masher | Opener - autoplay | Deaths per 1 000 fights, opener / autoplay |
|---|---|---|---|---|---|---|
| today (main ac28155, sim's opener, same seeds) | 80.6 % | 79.3 % | 82.4 % | +1.2 pp | +1.9 pp | 0.88 |
| sim constants only (D55), opener with beam fix | 81.9 % | 70.9 % | 81.4 % | +11.0 pp | -0.4 pp | 1.03 |
| **v2.1** | **81.6 %** | **64.8 %** | **85.8 %** | **+16.8 pp (13.5 - 20.1)** | **+4.2 pp (1.7 - 6.7)** | **0.74** |

- Masher trails autoplay by 16.8 pp (target >= 8). Autoplay stays within 1 pp of today (81.6 % against 80.6 % on main, 81.9 % for the reference). The planned opening beats autoplay by +4.2 pp. The interval excludes 0, but B48's +5 pp floor is inside the interval, so B48 just fails, as does its death ratio (0.74 against 0.70).
- Deaths per 1 000 fights, opener / autoplay / masher: elite 14.1 / 24.9 / 74.0, dungeon boss 18.2 / 46.4 / 128.7. Wind-ups answered: 78 / 67 / 8 % (B55 passes).
- B50: 76.0 % of the masher's deaths survive with the opener's first 5 rounds, 65.9 % with autoplay's (gap +10.1 pp, passes). B52: 26.5 against 3.9 windows used per 100 fights (passes).
- Fights are no longer than before (median 6 / 7 / 9 / 41 rounds). Combat 26.2 min and 51 fights per run are still the expedition's job.
- By class, opener - autoplay: Rogue +0.3, Mage +2.7, Hunter +9.7 pp. B51 passes for the Hunter. The Rogue (Ambush 73 %, Premeditate 2 %) and the Mage (Gathered Power 7 %) still fail.

## Open choices (team builds on the default)
1. Lasting result of a wind-up: default answered -30 % / landed +15 % for the fight (alt: landed only, harder for autoplay; or no lasting result).
2. Ambush in multi-enemy fights: default keeps STEALTH (alt: breaks it; measured -6.3 pp on autoplay's Rogue).
3. Autoplay Disrupts a visible wind-up also in one-enemy fights: default no (alt: yes; autoplay +3.5 pp, the planning edge goes with it).
4. B48 floor: default keep +5 pp / 0.70 and tune EMPOWER/STAGGER after the engine build (alt: +4 pp / 0.75 on today's evidence).
5. Rogue and Mage setup share (B51): default accept for now and look again after the engine build with the sim's 1 000-run measure (alt: Premeditate also gives "next finisher costs 0").

## Work for other roles
- Engine (Core Gameplay Engineer, S-M): wind-up flags on signature entries (track.js makeEntry: `windup`, `cast`, multiplier of the original flag); EMPOWERED / STAGGERED stacks in enemyPct (damage.js) with events `empower` / `stagger`; answered and landed hooks in interrupt, control cancel, nowIntent cancel, SILENCED replacement and the avoided heavy (spells.js, track.js, combat.js); Disrupt in engage.js (legality on CC-immune targets and the TRAP on the first visible wind-up); D52's predicted cancel for Disrupt; constants of 16.1 and 16.3; rules.md 7 is already written. The working prototype is sim/out/combat21/v21.patch in the designer worktree (git-ignored; also the switches). The patch is not production code: the switches read process.env.
- UI (UI/UX Engineer, S): combat-v2.md 10 item 9 (Wind-up badge with its answers, EMPOWERED / STAGGERED frame badges, log lines, Disrupt label).
- Sim (Simulation & Balance Engineer, M): opener beam fix D59 (OPENER_ROOT_KEEP 6; candidates on an immune enemy's cast); recorder wind-ups answered/landed per fight kind; B50 gap, B52 per 100 fights, B55 rows in combatchecks and the report; then measure 1 000 runs per class and tune EMPOWER_DMG / STAGGER_DMG (the two levers: their sum widens the masher and opener gaps; STAGGER - EMPOWER sets autoplay's difficulty). The opener now costs about 1.8 s per run.
- QA: a wind-up interrupted on a dungeon boss staggers it; Disrupt is illegal without a visible wind-up; stacks persist to fight end and are removed after.

## Commits, files, checks
- b211a53: docs/specs/combat-v2.md, docs/specs/rules.md, docs/specs/changes-combat-v21.md. 7d24d0d: docs/DECISIONS.md (D55-D59). This note: docs/handoffs/designer-combat-2026-11-10b.md.
- No src/, sim/ or tests changed. Checked: every number comes from run records in the git-ignored sim/out/combat21/out-* directories, read with sim/out/combat21/an.mjs (it uses sim/lib/combatchecks.mjs). 0 errors in every cell. The reference arm reproduces the sim's variant `scripts × 1.5, window +50 %` exactly on these seeds (81.9 / 71.1 %) on ac28155. The final arms ran on the rebased heat engine 8507303 (Lead's note).
