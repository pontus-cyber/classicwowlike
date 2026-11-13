# Tutorial seed report 2026-11-13: TUTORIAL_SEED for the guided zone (M3 3.2)

Status: **draft** (the seed value goes into the constant table of docs/specs/m3-onboarding.md 12 when the Lead accepts it). Owner: Simulation & Balance Engineer. Audience: Lead, Content Designer (`src/content/tutorial.js`), Core Gameplay Engineer (E1), QA. src/ untouched; no rules constant, content value or spec changed.

**Chosen: TUTORIAL_SEED = 8736.** It meets criteria (a)-(e) of m3-onboarding.md 2.3 and has the shortest possible guided tour (5 hops: hub, two Verge fights, the Elite, a Cull site, the Road). Its Road is the one farthest from the Shardfall, all four first scripted fights (S1-S4) can play in ring 1 next to the hub, and two of the three Cull sites lie in the Verge's rings 1-2.

## 1. Method
- Script: `node sim/pick-tutorial-seed.mjs [--from 1] [--count 5000] [--top 5] [--seed N] [--json]`.
- Zone 1 is built by the engine itself: a run with the candidate as its seed (so `map(1)`, `node(1, id)`, `fight(1, id, k)` and `loot(1, id)` are exactly the streams TUTORIAL_SEED will feed), `START_RUN`, board slot 1 set to the guided run's Cull (wild family, the Barleyreach Verge, zone 1; spec 2.3 "Board"), `TAKE_CONTRACT 0`, `SET_OUT`. The Cull sites are then the ones the engine places on the map(1) stream after the node types (expedition.md 3.3). Slots 2 and 3 are zones 3-6 (D132), so no other contract places sites in zone 1. The class does not change the map (node setup reads only the seed and the content).
- Criteria, as checked:
  - (a) at least 3 Quest or Grind nodes in rings 1-2 of the Verge;
  - (b) the **overlay's Elite** (the Elite nearest the hub, ties lowest id; spec 2.3 "Elite") is in ring 2 and within 2 hops of a ring 1 Verge node. The script checks (b) and (d) on that node, so the node Gorrak stands on is the one that meets them;
  - (c) the Shardfall at least 150 degrees from the Verge's direction (circular mean of the angles of the Verge's nodes, rings 1-3);
  - (d) a Road within 3 hops of that Elite;
  - (e) a Rest in ring 1 or 2. The engine always places its Rest guarantee there (expedition.md 4.3 step 5), so (e) holds on every seed; it is checked as a guard.
- Ranking (best first): the shortest walk from the hub through 3 of the Verge's ring 1-2 Quest or Grind nodes and the Elite, in any order, ending on a Road (5 hops is the least possible); then more non-site Quest or Grind nodes in ring 1, up to 4 (ONB_SCRIPTED_FIGHTS); then more Cull sites in the Verge's rings 1-2, up to 2 (CULL_SITES); then more Verge Quest or Grind nodes in ring 1; then the end Road farther from the Shardfall; then the larger Verge-Shardfall angle; then the lower seed.

## 2. Scan
Seeds 1-20 000 (engine main e8316fd): **507 pass (2.5 %)**. Top 5, all with a 5-hop tour, 4 ring 1 script slots and 2 near Cull sites:

| Seed | Tour (node ids) | Verge Q/G rings 1-2 | Elite (region) | End Road (hops from Shardfall) | Verge-Shardfall | Cull sites |
|---|---|---|---|---|---|---|
| **8736** | 0 > 2 > 1 > 18 > 7 > 19 | 1, 2, 7 | 18 (Verge) | 19 (6) | 176.4 deg | 1, 4, 7 |
| 17633 | 0 > 6 > 1 > 8 > 7 > 19 | 1, 6, 7, 18 | 8 (Verge) | 19 (6) | 175.6 deg | 1, 6, 15, 21, 24, 30 |
| 19274 | 0 > 1 > 9 > 8 > 7 > 19 | 1, 6, 7, 8 | 9 (Verge) | 19 (6) | 175.0 deg | 1, 3, 7, 8, 19 |
| 19295 | 0 > 5 > 6 > 7 > 18 > 29 | 5, 6, 18 | 7 (Hollow) | 29 (6) | 174.7 deg | 6, 18, 28 |
| 8836 | 0 > 2 > 1 > 8 > 9 > 21 | 1, 2, 9, 11 | 8 (Steadings) | 21 (6) | 174.6 deg | 1, 11, 20 |

The full text maps: `node sim/pick-tutorial-seed.mjs --count 20000 --top 5`.

Why 8736 (all five tie on tour, script slots and near Cull sites; 8736 ranks first on the later keys): it is the only one of the five with both (1) the Elite inside the Verge (19295 and 8836 have it in another region, so the Gorrak fight would not sit in the contract's region) and (2) only 3 Cull sites, the minimum CULL_SITES + CULL_SITE_SPARE (17633 and 19274 have 5-6, so the first zone a new player sees is covered in contract markers). Its Rest (node 8) also sits in the Verge between the first fights and the Road.

## 3. Map facts for the overlay (seed 8736)
Directions are as the map draws them (src/ui/screens.js: 0 degrees right, 90 down). Levels are the node's content level (`cl`). "Dims at" is the zone time in tolls when the Dimming reaches the node (mapView `dimAt`). Regions: Verge = Barleyreach Verge (wilds), Road region = Carter's Furrow Road, Hollow = Boundary Stone Hollow, Steadings = Millbrook Steadings.

**Layout.** The Verge lies to the lower right (south-east, about 38 degrees). The **Shardfall is node 25, upper left (north-west, 222 degrees), 176 degrees from the Verge**. The Dimming spreads from the upper left, so the Verge is the last part of the zone to go dark (16-21 tolls; the hub at 14).

| Role | Node | Ring | Type | Level | Region | Neighbours | Dims at | Notes |
|---|---|---|---|---|---|---|---|---|
| Verge Grind | **2** | 1 | grind | 3 | Verge | 0, 1, 3, 8, 9 | 16 | not a Cull site: the nearest script slot (S1 if the player goes there first) |
| Verge Quest | **1** | 1 | quest "Pillars of the Field" | 4 | Verge | 0, 2, 6, 7, 18 | 16 | **Cull site** |
| Verge Grind | **7** | 2 | grind | 7 | Verge | 1, 8, 18, 19, 30 | 19 | **Cull site**; next to the Road |
| Elite (Gorrak) | **18** | 2 | elite | 5 | Verge | 1, 7, 17, 30 | 19 | nearest Elite to the hub; 1 hop from Verge node 1, 2 hops from the Road |
| Road | **19** | 3 | Road (rest node) | 8 | Verge | 7, 20 | 21 | 6 hops from the Shardfall: the last Road to dim; 2 hops from the Elite (via 7) |
| Rest | **8** | 2 | rest | 5 | Verge | 2, 7, 20 | 19 | between node 2 and node 7; the other ring 1-2 Rest is 15 (Steadings) |
| Shardfall | **25** | 3 | treasure | 10 | Road region | 13, 26 | 6 | upper left |

Other landmarks: Roads 23 (3 hops from the Shardfall, dims at 14) and 27 (4 hops, dims at 16); Dungeon (the Harrow Cellars) node 21, ring 3, Hollow, reached only through node 9; Trainers 12 (ring 2, Road region, dims at 11) and 29 (ring 3); the hub dims at 14.

**Cull sites** (board slot 1, the engine's placement today): **1** (ring 1 quest, Verge), **4** (ring 1 quest, Road region, an out-of-region draw, CULL_SITE_OUT), **7** (ring 2 grind, Verge). The contract needs 2 (CULL_SITES); 3 are placed (CULL_SITE_SPARE 1). The site fights of spec 2.3 (site 1 a lone Furrow Boar, site 2 a Furrow Boar and a Barn Wolf) replace the generated encounters.

**Script slots** (non-site Quest or Grind nodes in rings 1-2, by hops from the hub): ring 1: 2 (Verge grind L3), 3 (Hollow quest L3), 5 (Road region grind L4), 6 (Steadings quest L2); ring 2: 9, 10, 11, 13, 14, 16, 17. S1-S4 play on the first four the player enters, whichever they are; every ring 1 neighbour of the hub except 1 and 4 is one.

**Ring 1 at a glance** (hub 0 links to all): 1 quest L4 Verge (site), 2 grind L3 Verge, 3 quest L3 Hollow, 4 quest L3 Road region (site), 5 grind L4 Road region, 6 quest L2 Steadings. Ring 1 edges kept: 1-2, 2-3, 3-4, 4-5, 5-6, 6-1 (the full ring).

## 4. Notes for the Content Designer and the Engineer
1. Every ring 2 node is 2 hops from the hub, so the Elite of any seed that meets (b) is 2 hops away: a player can walk into Gorrak (node 18, from node 1) before S2-S4 have taught intents, the engage round and wind-ups. The spec's beats fire on events, so this is legal; the Designer may want the Elite's map label or level clamp (ONB_ELITE_LEVEL_MIN/MAX) to carry it.
2. The facts above assume the guided run's zone 1 is generated exactly as a run whose seed is TUTORIAL_SEED, with only the slot 1 Cull held (spec 2.3, E1). If E1 draws anything else from `map(1)` before the sites (for example a different board contract object with another region or family), the Cull sites move; rerun `node sim/pick-tutorial-seed.mjs --seed 8736` after E1.
3. qa/sim/tutorial-seed.test.mjs checks that the seed (C.TUTORIAL_SEED once the constant exists, else 8736) still meets (a)-(e) and pins the node ids above. If it fails after an engine change, the overlay has to be checked before the seed or the pins are changed.

## 5. Reproduce
`node sim/pick-tutorial-seed.mjs --count 20000 --top 5` (about 4 s); one seed: `node sim/pick-tutorial-seed.mjs --seed 8736` (`--json` for the facts as data).
