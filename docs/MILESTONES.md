# Milestones

Status values: todo, doing, done, blocked. One milestone is active at a time.

## M0. Discovery (done 2026-11-09)
Done when the owner has approved BRIEF.md, the rules spec covers every system in the brief with named constants, and the balance targets are measurable by the simulator.
| # | Task | Owner | Status |
|---|---|---|---|
| 0.1 | Review BRIEF.md with the owner's answers | Lead | done |
| 0.2 | Rules spec: classes, stats, combat, spells, talents, items, path and nodes, zones, boss, death, meta progression (docs/specs/rules.md) | Lead Game Designer | done |
| 0.3 | Balance and pacing targets (docs/specs/balance.md) | Lead Game Designer | done |
| 0.4 | Owner answers the brief's open questions | Owner | done |

## M1. First playable: the core loop is fun (done 2026-11-09)
Done when the owner can play one class from level 1 to the boss in the visual build and in the text simulator, every rule in rules.md has a test, and a full run completes headless with no console errors. Art can be placeholder-quality but the HUD layout, scrolling world and fight flow are in place.
| # | Task | Owner | Status |
|---|---|---|---|
| 1.1 | Rules engine (src/rules.js), pure, seeded, no DOM | Core Gameplay Engineer | done |
| 1.2 | Text simulator: play one run interactively in the terminal, and run N seeded runs headless (sim/) | Simulation & Balance Engineer | done |
| 1.3 | Visual client: HUD, scrolling world, path choice, manual fights with autoplay toggle, talents, bags | UI/UX & Visual Engineer | done |
| 1.4 | Content tables for all three classes and zones 1–60 within the designer's ranges | Content Designer | done |
| 1.5 | Tests for every rule, headless full run of game.html | Playtest & QA Lead | done (07c679d; open bugs in qa/bugs.md) |
| 1.6 | Build game.html, send it to the owner | Lead | done (2cb7bf2) |
| 1.7 | Owner plays and writes what to change first | Owner | done (18:26: on the right path, no polish yet) |

## M2. Balanced by simulation (done 2026-11-10: P1 45/45, docs/reports/balance-2026-11-10c.md)
Done when the bots play at least 10,000 runs per class and the results meet docs/specs/balance.md: good plans beat bad plans, no single strategy dominates, run length lands near target, and the three classes are within the class win-rate band.
| # | Task | Owner | Status |
|---|---|---|---|
| 2.1 | Bots: random, greedy, planner, speedrunner, tactician (sim/) | Simulation & Balance Engineer | done |
| 2.2 | Balance report: win rates per class and strategy, level and gear at the boss, time used, death causes | Simulation & Balance Engineer | done (docs/reports/balance-2026-11-09.md, 38/71 checks pass) |
| 2.3 | Tune numbers until targets are met; log each change in DECISIONS.md | Lead Game Designer + Simulation & Balance Engineer | done (v2-v5, D16-D46) |
| 2.4 | Playtest pass on the balanced build | Playtest & QA Lead | moved to M2b 2b.8 (the design changes there) |

## M2b. Expedition and combat v2 (owner feedback 2026-11-10)
Done when a run plays on the roamable fog map with contracts, the Dimming, Roads and the Homeward Bell (docs/specs/expedition.md) and with combat v2 (docs/specs/combat-v2.md: intent track, off-balance windows, engage round); the bots read only what the player sees; B39-B54 and the M2 P1 targets are measured and met or re-banded with the owner's agreement; the owner has played it.
| # | Task | Owner | Status |
|---|---|---|---|
| 2b.1 | Engine: combat v2 (intent track, archetype openings, off-balance, engage round, autoplay rule) | Core Gameplay Engineer | done (e362fd0, D48-D49) |
| 2b.2 | Sim: masher and sequence-planning opener bots; tune enemy damage compensation and window size (B48-B54) | Simulation & Balance Engineer | doing |
| 2b.3 | Engine: circular zone map, vision, the Dimming, Roads and Bell | Core Gameplay Engineer | done (6d27a78, behind mapMode 'expedition') |
| 2b.4 | Sim: fog-only bots with a leak test, oracle for measuring; B39-B47 | Simulation & Balance Engineer | todo |
| 2b.5 | Engine + content: prep points, contracts, hub contract, regions and enemy families | Core Gameplay Engineer + Content Designer | todo |
| 2b.6 | UI: combat v2 display; prep screen; fog map with regions, landmarks and Dimming clocks; contract tracker | UI/UX & Visual Engineer | doing (combat v2 display first) |
| 2b.7 | Fold expedition 9.5 and combat-v2 into rules.md and balance.md; tune after first measure | Lead Game Designer | todo |
| 2b.8 | QA: rule tests, leak test, browser checks; playtest | Playtest & QA Lead | todo |
| 2b.9 | Owner plays the build | Owner | todo |

## M3. Meta progression
Done when meta points, the unlock screen and permanent unlocks (items in drop pools, skills, stat boosts) work, ten consecutive simulated runs show rising strength, and the owner has played five runs in a row.

## M4. Content, look and feel
Done when the zones, dungeons, gear tiers and boss mechanics in docs/specs/content.md are in, the art and animation pass is done, and the build still meets the M2 targets.
