# Milestones

Status values: todo, doing, done, blocked. One milestone is active at a time.

## M0. Discovery
Done when the owner has approved BRIEF.md, the rules spec covers every system in the brief with named constants, and the balance targets are measurable by the simulator.
| # | Task | Owner | Status |
|---|---|---|---|
| 0.1 | Review BRIEF.md with the owner's answers | Lead | done |
| 0.2 | Rules spec: classes, stats, combat, spells, talents, items, path and nodes, zones, boss, death, meta progression (docs/specs/rules.md) | Lead Game Designer | doing |
| 0.3 | Balance and pacing targets (docs/specs/balance.md) | Lead Game Designer | doing |
| 0.4 | Owner answers the brief's open questions | Owner | done |

## M1. First playable: the core loop is fun
Done when the owner can play one class from level 1 to the boss in the visual build and in the text simulator, every rule in rules.md has a test, and a full run completes headless with no console errors. Art can be placeholder-quality but the HUD layout, scrolling world and fight flow are in place.
| # | Task | Owner | Status |
|---|---|---|---|
| 1.1 | Rules engine (src/rules.js), pure, seeded, no DOM | Core Gameplay Engineer | todo |
| 1.2 | Text simulator: play one run interactively in the terminal, and run N seeded runs headless (sim/) | Simulation & Balance Engineer | todo |
| 1.3 | Visual client: HUD, scrolling world, path choice, auto and manual fights, talents, bags | UI/UX & Visual Engineer | todo |
| 1.4 | Content tables for all three classes and zones 1–60 within the designer's ranges | Content Designer | todo |
| 1.5 | Tests for every rule, headless full run of game.html | Playtest & QA Lead | todo |
| 1.6 | Build game.html, send it to the owner | Lead | todo |
| 1.7 | Owner plays and writes what to change first | Owner | todo |

## M2. Balanced by simulation
Done when the bots play at least 10,000 runs per class and the results meet docs/specs/balance.md: good plans beat bad plans, no single strategy dominates, run length lands near target, and the three classes are within the class win-rate band.
| # | Task | Owner | Status |
|---|---|---|---|
| 2.1 | Bots: random, greedy, planner, speedrunner (sim/) | Simulation & Balance Engineer | todo |
| 2.2 | Balance report: win rates per class and strategy, level and gear at the boss, time used, death causes | Simulation & Balance Engineer | todo |
| 2.3 | Tune numbers until targets are met; log each change in DECISIONS.md | Lead Game Designer + Simulation & Balance Engineer | todo |
| 2.4 | Playtest pass on the balanced build | Playtest & QA Lead | todo |

## M3. Meta progression
Done when meta points, the unlock screen and permanent unlocks (items in drop pools, skills, stat boosts) work, ten consecutive simulated runs show rising strength, and the owner has played five runs in a row.

## M4. Content, look and feel
Done when the zones, dungeons, gear tiers and boss mechanics in docs/specs/content.md are in, the art and animation pass is done, and the build still meets the M2 targets.
