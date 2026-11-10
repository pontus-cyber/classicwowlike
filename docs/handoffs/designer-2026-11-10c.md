# Hand-off: Lead Game Designer, 2026-11-10c (M2b expedition design)

Task: design spec for the owner's 10:06 idea (start-camp preparation points, contracts, a less calculable map) and the 10:09 follow-up (vision bought with points and meta; FTL-style roaming circular zones with a pursuing threat; compare exits) [stated: docs/feedback/2026-11-10-1006-owner.md]. The 10:09 decisions override the Lead's defaults where they conflict: the 7 × 3 row map with one row of exact vision and one of region hints (Lead default) is replaced by a roaming disc map with radius vision.

## Summary
- docs/specs/expedition.md: complete rules for the start camp (PREP), contracts (Cull, Bounty, Delve; they replace the story chain), the roaming disc map (hub in the centre, three rings, four regions, Roads on the rim), vision as a resource (prep perks and meta), the Dimming (a darkness spreading from a fallen shard of the end boss; it eats the zone with every hour spent), exits, UI, bots, nine new balance targets (B39-B47) and the constant table. It states which rules.md sections it replaces (8.1) and the meta catalogue changes (8.2). rules.md, balance.md, src/ and sim/ were not edited.
- Calculability is defined and measurable: C_step (share of map decisions where the fog planner matches a full-information oracle from the same state) and C_route (share of zones where the whole route matches). Today both are 1.00.
- A crude scratch model (git-ignored, sim/out/expedition/) with real XP and hours numbers from src/rules.js and stated stand-ins for combat compared exit variants, threat speed and vision. Recommendation: **Roads + one Homeward Bell charge per run** (variant C).

Key prototype numbers (planner, fresh profile; estimated real minutes calibrated on today's map):

| | Today's map | C Roads + Bell, fresh | C, full-catalogue vision |
|---|---|---|---|
| C_step / C_route | 1.00 / 1.00 | 0.72 / 0.04 | 0.93 / 0.47 |
| Contract completion | 80 % | 56 % | 70 % |
| Est. run minutes / hours | 46 / 125 (model) | 48 / 142 | 48 / 141 |
| Zones caught by the Dimming / its share of expected deaths | - | 15 % / 17 % | 14 % / 12 % |

Without the Dimming the roaming planner takes about 84 minutes: the threat is what bounds the zone.

## Pacing with slower, weightier combat (Lead's 10:43 input)
Assumed (combat-v2 not written yet): round on screen 2.1 s [stated +40 %], the first 4 rounds of a fight take 3 s each to decide, 6 s to read a fight before it starts, rounds per fight unchanged. A normal fight then takes about 36 s instead of 18; with today's ~50 fights a run would last about 64-65 minutes.
Plan (expedition.md 9.5): about 36 fights per run instead of 50: one Grind wave, two dungeon trash fights, XP per fight × 1.6, node hours up (quest 3, elite 3, grind 2, dungeon 6) so the in-game clock keeps its scale, Dimming 2.5 h per hop, more Cull sites per region (0.65). Model: 37 resolved nodes (about 6 per zone) and 6 walk-throughs, 132 h, estimated 46-48 minutes. Cost: the planner is caught by the Dimming in about 26 % of zones (B43 asks 8-18 %); first levers: 3 h per hop (+2 min, 21 %) or a gentler depth-0 Dimmed encounter.

## Pitch for the owner
Before each run you stand in the start camp with 10 preparation points. The contract board offers eight jobs across the six zones (cull boars in the Barley Reach, hunt a named bandit chief, clear the cellar dungeon); each pays far more than a quest, and only if finished. The same points buy supplies, a Homeward Bell charge, or eyes: region charts, a tracker for your contract targets, a local guide.
Each zone is a round map with the town in the middle. You can walk anywhere, but on a fresh profile you see only the paths next to you, so finding the boars is half judgement, half luck.
A shard of Oruvath, the Unlit Star, has fallen on the rim of every zone. Its darkness, the Dimming, spreads a step closer every few hours; what it covers is lost, and what walks in it kills. Leave by one of three roads on the rim, or ring the Bell if you bought the time.
New runs earn better maps: Pathfinder, Cartographer and Old Hand make the zones readable over time, but never fully.
In the model, a fresh player's route matches the "perfect information" route in 4 % of zones (today 100 %), and the run stays near 45-48 minutes.

## Open choices (default in bold; the team builds on the default)
1. Exits: **C Roads (3) + Homeward Bell (1 charge per run, 2 h channel)**; runners-up A Roads only (set BELL_START_CHARGES 0) and B Bell only. Owner review.
2. Threat speed: **grace 6 h, then one hop per 2.5 h** with the weightier nodes of 9.5 (run about 46-48 min, planner caught in about 26 % of zones). 3 h per hop is the fallback if B43 matters more than 2 minutes. Sim to tune against B11, B17, B43.
10. Fight count with the slower combat: **about 36 fights per run (one Grind wave, two dungeon trash fights, XP × 1.6)**; rules.md values change when M2b lands, not now.
3. Fresh vision: **adjacent nodes only (radius 1), graph skeleton and landmarks always visible**. Hiding the skeleton too would make the Dimming unfair (the player could not plan an escape).
4. Vision cap: **full radius 2 at most; Pathfinder (meta) shows types only at 2 hops**. Radius 3 made every choice equal to the oracle's (C_step 1.00).
5. Level gate on leaving: **none** (the Dimming bounds the zone; under-levelling is its own risk). Swift Boots becomes **+1 Bell charge**.
6. Contracts paid **at once on the last site** (no walk back to a giver).
7. Unspent points: **Reserve, usable for the hub contract, 2 Echoes each at the end**.
8. Story chain: **retired, replaced by contracts**.
9. Hub contract: **one per zone hub (zones 2-6), paid from Reserve or swapped for a held one**.

## Implementation plan (M2b)
| # | Owner | Task | Size |
|---|---|---|---|
| 1 | Engineer | Disc map generation (4.3) with node ids; streams keyed by id; `MOVE`, `PASS`, walk hours; hub services on revisit | L (2-3 sessions) |
| 2 | Engineer | `mapView` with vision (5): radius, memory, landmarks, perks, Pathfinder; leak-free by construction | M |
| 3 | Engineer | The Dimming (6): front, Dimmed nodes, Dimmed encounter (Shardspawn variant), lost content | M |
| 4 | Engineer | Exits (7): `TAKE_ROAD`, Homeward Bell, no level gate; Camp entry from Z6 | S |
| 5 | Engineer | PREP phase (2): board, rerolls, supplies, perks, Reserve; contracts (3): sites, progress, rewards, expiry, hub contract; drop tables; summary and Echo lines; meta catalogue changes (8.2) | L |
| 6 | Engineer | rules.md, engine-api.md, ARCHITECTURE.md rows in the same commits (D41); retire the row-map constants | S |
| 7 | UI | Prep screen (9.1), disc fog map with regions, landmarks and Dimming clocks (9.2), contract tracker (9.3), Road and Bell buttons | L (2 sessions) |
| 8 | Sim | Bots on `mapView` only: belief-search planner, greedy threat rule, speedrunner, oracle diagnostic (10); completion table for the prep planner; leak test | L |
| 9 | Sim | New metrics B39-B47 in the pass and report; diagnostic cells: Dimming off, vision entries off, prep none and random; re-measure B11, B14, B17, B20, B31 | M |
| 10 | Content | Per zone: 4 regions (name, kind, 2-3 families); `family` tag on every normal and elite template; 1-2 bounty elites per zone; contract text templates (Cull, Bounty, Delve: title <= 32, text <= 240); Road names; Shardfall and Shardspawn names and lines; Homeward Bell text | M |
| 11 | QA | Rules tests for 2-7; leak test of `mapView`; browser checks for the prep screen and fog map (BUG-QA-10 rule: the Set out button visible at both sizes) | M |
| 12 | Designer | Fold expedition.md 9.5 into rules.md (Grind waves, dungeon trash, node hours, XP × 1.6) together with combat-v2's round counts; then after the first measure: tune DIM_*, contract rewards (B40, B46), prices; update balance.md with B39-B47 | S |

Order: 1-4 and 8 first (the Sim measures the map and the threat before the prep economy), then 5, 7, 9-11. Rough total: about 8-10 agent sessions.

What the Sim Engineer must build that the scratch model only fakes: real fights and deaths (runs end), real loot and gear, the risk table for Dimmed encounters, the prep planner's completion table, and the speed route.

## Risks
- Plan value is not shown yet: in the model, planned contracts beat random ones by nothing (16.5 vs 15.8 gear points) because contracts differ only in price and reward. B40 decides; first lever: contract rewards.
- The greedy (no lookahead) is caught in 19 % of zones and the Dimming is about a third of its expected non-boss deaths: the UI clocks and a clear threat rule are required.
- Tension with the 45-minute budget: shorter zones make the Dimming catch the planner in about 26 % of zones and the greedy in 38 % (9.5).
- Hours rise (model 132-142 h vs 124-125 on today's map): Ascendancy at the boss goes up unless BOSS_TIME_PAR or the threat speed moves (B17).
- With more vision the planner takes more elites and dungeons (expected non-boss deaths 0.64 -> 0.88 in the model's stand-in risk); the real risk table will tell.
- Scope: this is a map rewrite. It touches rules, map generation, UI, bots and content. M3 content should wait for it.

## Commits
- a78846d: docs/specs/expedition.md part 1 (sections 1-8)
- 2bf2794: docs/specs/expedition.md part 2 (sections 9-13)
- 2db1a26: docs/handoffs/designer-2026-11-10c.md
- this commit: expedition.md 9.5 and 12.5 (pacing with slower combat) and this note's pacing section

## Files changed
docs/specs/expedition.md (new), docs/handoffs/designer-2026-11-10c.md (new). Scratch only, not committed: sim/out/expedition/model.mjs, run.mjs, sum.mjs and result files.

## How it was checked
- The scratch model imports xpToNext, diffMod and the node constants from src/rules.js on main (ecc2acf); the baseline (today's 7 × 3 map, full view) reproduces 42 nodes per run (measured 42 in balance-2026-11-10b) and was used to calibrate minutes (+3.7) and to scale XP (0.82).
- 300 runs per variant and bot (seeds 1000-1299), threat sweeps at 200; every number in expedition.md section 12 and in the tables above comes from those runs (`node run.mjs 300 <variants> | node sum.mjs`).
- Not checked: anything involving real combat, loot or win rates. No engine, simulator or test code was changed.
