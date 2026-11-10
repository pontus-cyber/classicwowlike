# Expedition spec: start-camp preparation, contracts, roaming zone maps, the Dimming

Owner: Lead Game Designer. Status: draft for Lead and owner review, 2026-11-10 (milestone M2b). Part 1 of 2: rules (sections 1-8). Part 2 (UI, bots, balance targets, prototype evidence, constant table) follows in the next commit; until then the constants named here are defined in section 12 of the prototype notes and the hand-off.
Audience: Core Gameplay Engineer, UI/UX Engineer, Simulation & Balance Engineer, Content Designer, QA.

Sources: owner feedback [stated: docs/feedback/2026-11-10-1006-owner.md, including the 10:09 follow-up]; current rules [source: docs/specs/rules.md sections 1, 2, 3, 11]; playtest [source: docs/handoffs/qa-2026-11-09.md]; balance state [source: docs/reports/balance-2026-11-10b.md]. Every number is a named constant in the table at the end (section 13); all are starting values for the Simulation & Balance Engineer to tune.

What the owner asked for [stated]:
1. In the start camp the player spends preparation points on a few contracts (quests) and on supplies; these choices shape the run heavily.
2. Finding the path to a contract's targets is partly chance; today's fully visible 7 × 3 map makes the best path easy to compute.
3. Visibility is itself bought with preparation points; a fresh profile sees almost nothing beyond adjacent nodes; meta progression widens it, so playing many runs is rewarded.
4. Each zone is a roamable, roughly circular map like FTL: start in the centre, walk in any direction and back. Something hunts the player and kills them if they stay; they must leave by a specific place or a recall item.

Kept [stated: docs/BRIEF.md]: about 45 minutes, manual combat, the end boss and its time pressure (Ascendancy), the speed route, the classic MMO feel.

---

## 1. Run structure (replaces rules.md 1.1)

`CREATE -> PREP -> ZONE_HUB -> MAP <-> NODE -> ... -> CAMP -> BOSS -> SUMMARY`

| Phase | Player actions (new or changed in bold) |
|---|---|
| CREATE | as rules 1.1 |
| **PREP** | **`TAKE_CONTRACT(i)`, `DROP_CONTRACT(i)`, `BUY_PREP(id)`, `SELL_PREP(id)`, `REROLL_BOARD`, `SET_OUT`** (section 2) |
| ZONE_HUB | hub services (rules 1.4), **`TAKE_HUB_CONTRACT(mode)`** (3.6), **`ASK_LOCALS`** (5.3), `LEAVE_HUB` |
| MAP | **`MOVE(nodeId)`** (adjacent node only), **`TAKE_ROAD`** (on a Road node), **`RING_BELL`** (Homeward Bell, 7.2), **`USE_SPYGLASS(nodeId)`**, out-of-combat actions. `CHOOSE_NODE(lane)` and `TRAVEL_ON` are removed. |
| NODE | node actions as rules 2, plus **`PASS`** (leave the node unresolved, 4.6) |
| CAMP, BOSS, SUMMARY | as rules 1.1; SUMMARY adds the contract and expedition lines (9.3) |

Real time: PREP is one screen, about PACE_PREP_S seconds. The run otherwise keeps the rules 3 pacing terms; new terms in section 9.4.

## 2. The start camp (PREP)

### 2.1 Preparation points
`prepPoints = PREP_POINTS + PREP_POINTS_PER_QM × (Quartermaster ranks)` (meta, 11). Everything on the prep screen is bought with these points. Points not spent at `SET_OUT` become **Reserve** (2.6).

### 2.2 The contract board
At PREP the board shows CONTRACT_BOARD_SIZE contracts drawn on stream `prep(k)` = hash(runSeed, "prep", k), k = number of rerolls so far:
- one contract for each zone 1..ZONE_COUNT, then CONTRACT_BOARD_EXTRA more for zones drawn uniformly from 1..ZONE_COUNT;
- kind by weight: Cull CW_CULL, Bounty CW_BOUNTY, Delve CW_DELVE (section 3);
- target region: uniform over the zone's REGION_COUNT regions (Delve: the zone's dungeon); target family: one of the region's families (Content, 12.2);
- every contract shows: zone and level band, kind, target ("Cull boars in the Barley Reach, Amberfold Downs, levels 1-10"), sites needed, reward summary, price.

`TAKE_CONTRACT(i)` costs `CONTRACT.kind.price` points; at most CONTRACT_SLOTS contracts may be held at once (whole run, PREP and hubs). `DROP_CONTRACT(i)` at PREP refunds the price.

`REROLL_BOARD` costs REROLL_PRICE points, at most REROLL_MAX times; it redraws every contract not taken (stream `prep(k+1)`).

### 2.3 Supplies
| id | Name | Price | Effect |
|---|---|---|---|
| prep_draughts | Field Draughts | PRICE_PREP_DRAUGHTS | PREP_DRAUGHT_COUNT Healing Draughts in the bag (heal is a share of max HP, so they keep their worth all run) |
| prep_rations | Trail Pack | PRICE_PREP_RATIONS | PREP_RATION_COUNT Trail Rations |
| prep_ember | Ember of Return | PRICE_PREP_EMBER | one Ember of Return (rules 8.6; EMBER_MAX_CARRIED still applies) |
| prep_bell | Second Clapper | PRICE_PREP_BELL | +1 Homeward Bell charge (7.2), up to BELL_MAX_CHARGES |
| prep_mule | Pack Mule | PRICE_PREP_MULE | +PREP_MULE_SLOTS bag slots for the run |

### 2.4 Vision perks (owner decision 1)
Vision is a resource. A fresh profile sees adjacent nodes only (section 5). Perks bought here last the whole run:

| id | Name | Price | Effect |
|---|---|---|---|
| prep_charts | Region Charts | PRICE_CHARTS | the region of every node of every zone is shown (tint and name), and every dungeon's location |
| prep_tracker | Tracker's Notes | PRICE_TRACKER | contract sites (4.5) are shown within TRACKER_RADIUS hops, even when the node itself is hidden |
| prep_guide | Local Guide | PRICE_GUIDE | full vision radius +GUIDE_RADIUS_BONUS (capped at VISION_RADIUS_MAX) |
| prep_spyglass | Spyglass | PRICE_SPYGLASS | SPYGLASS_CHARGES uses of `USE_SPYGLASS(nodeId)` (0 h): reveals that node and its neighbours fully, any distance |

A perk the profile already has from meta (11) is shown as owned and cannot be bought.

### 2.5 Prices are the design lever
The points cannot buy everything: with PREP_POINTS = 10 a fresh player chooses between, for example, four cheap contracts; two contracts and the Tracker; one contract, an Ember and the Guide. The prototype (section 12) measured what the main choices are worth.

### 2.6 Reserve (unspent points)
Unspent points are kept as Reserve. Reserve pays for hub contracts (3.6) and for `ASK_LOCALS` (no point cost; it is listed here because the hub screen shows Reserve next to it). At SUMMARY each Reserve point left is worth PREP_ECHO_PER_POINT Echoes (11.1 new line). So spending is a real choice: a point kept is flexibility in the run and a small Echo value; a point spent is power or information now.

## 3. Contracts (replaces the story chain of rules 2.1 and 1.8)

### 3.1 Kinds
| Kind | Target | Sites needed | Price | Reward on completion |
|---|---|---|---|---|
| Cull | an enemy family in one region ("boars in the Barley Reach") | CULL_SITES | CONTRACT.cull.price | `CULL_XP_FRAC × xpToNext(CL_c) × diffMod`, gold `CULL_GOLD_V × V(CL_c)`, choose 1 of CONTRACT_REWARD_CHOICES items on table "Contract" |
| Bounty | a named elite of a family, roaming one region | 1 | CONTRACT.bounty.price | `BOUNTY_XP_FRAC × …`, gold `BOUNTY_GOLD_V × V`, choose 1 of CONTRACT_REWARD_CHOICES on table "Bounty" |
| Delve | clear the zone's dungeon | 1 | CONTRACT.delve.price | `DELVE_XP_FRAC × …`, gold `DELVE_GOLD_V × V`, choose 1 of DELVE_REWARD_CHOICES on table "Contract" |

`CL_c = ZONE_LEVELS × (z - 1) + CONTRACT_CL_OFFSET` (the zone's middle). XP uses the player's level at completion for diffMod. Item level as rules 8.3 with source level CL_c.

New drop tables (rules 8.4): "Contract" C/U/R/E = 0 / 0 / CONTRACT_RARE_W / CONTRACT_EPIC_W; "Bounty" 0 / 0 / BOUNTY_RARE_W / BOUNTY_EPIC_W.

The reward is paid at once when the last site is won (no walk back to a giver; the zone's runner pays). A contract of zone z that is incomplete when the player leaves zone z expires: no reward, no penalty, the slot frees.

### 3.2 Story chain removed
STORY_QUESTS, STORY_XP_FRAC and STORY_REWARD_CHOICES are retired. The story bonus (about 0.9 levels and a 3-rare choice per zone, rules 2.0) moves into contracts. Quest nodes stay as local quests (rules 2.1) with their turn-in reward; they no longer count toward anything.

XP accounting [inference: from rules 2.0 values]: a held Cull pays CULL_XP_FRAC = 2.0 levels-worth plus a rare/epic choice; at the target completion rates (B39) and about one contract per zone, contracts return about the story chain's XP on average, with more spread between a good and a bad plan. The Sim Engineer checks the exit levels (B20) and adjusts QUEST_TURNIN_XP_FRAC if the levelling curve moves.

### 3.3 Sites
A **site** is a node that counts for a contract. Sites are fixed when the zone is generated (stream `map(z)`, 4.3 step 6), from the contracts held at that moment (hub contract taken before `LEAVE_HUB` included).

| Kind | Site placement |
|---|---|
| Cull | every Quest or Grind node of the zone is a site with chance CULL_SITE_IN in the target region and CULL_SITE_OUT elsewhere (one draw per node per contract, always drawn); if fewer than CULL_SITES + CULL_SITE_SPARE sites result, add sites on random Quest or Grind nodes of the target region until reached. The encounter of a site contains at least one mob of the target family. |
| Bounty | BOUNTY_PLACED nodes of ring 2 or 3 in the target region (not dungeon, Rest, Road, Shardfall) become Elite nodes with the bounty elite (a rare template of the family, rules 2.3 rare variant). Winning either completes the contract; the other then becomes a normal Elite. |
| Delve | the dungeon. Taking a Delve contract also reveals the dungeon's location in that zone (5.2). |

Progress: a site counts when its node is won (Quest: encounter won; Grind: at least one wave won; Elite: elite killed; dungeon: cleared). A node can be a site for several contracts.

### 3.4 Why sites are found partly by chance
The player knows the target region of each contract but, with a fresh profile, not which nodes are sites or where the region lies: both are discovered by walking (section 5). Region Charts show where to go; the Tracker shows the sites; the Guide shows more of everything. This is the owner's "finding the boars is partly chance" [stated], and the prep perks are how a player buys that chance down.

### 3.5 Slots and the plan
CONTRACT_SLOTS limits held contracts (PREP and hubs together). The board covers all six zones, so the start camp sets most of the run's goals; the hub offers one change per zone.

### 3.6 Hub contract
Each zone hub (zones 2..6; zone 1's hub follows PREP directly) offers one contract of that zone (stream hash(runSeed, "hubc", z); kind and target as 2.2). `TAKE_HUB_CONTRACT(mode)`:
- `reserve`: pay its price from Reserve; needs a free slot;
- `swap`: abandon one held contract (any zone; no refund, progress lost) and take this one for free.
Taken before `LEAVE_HUB`, its sites are placed with the zone (3.3).

## 4. Zone map: a roamable disc (replaces rules 1.4)

### 4.1 Shape
Each zone is a graph of 1 + RING_NODES[1] + RING_NODES[2] + RING_NODES[3] nodes: the **hub** in the centre (ring 0), and rings 1, 2 and 3 (the rim) around it. The player starts at the hub and may walk to any adjacent node, in any direction, including back to visited nodes and the hub [stated].

### 4.2 Content level by ring
`CL(z, ring) = ZONE_LEVELS × (z - 1) + RING_CL_BASE[ring] + u`, u uniform in 0..RING_CL_SPREAD-1, drawn per node (Z1: ring 1 levels 2-4, ring 2 levels 5-7, ring 3 levels 8-10). The hub is the band minimum. Offsets as today: Quest + QUEST_LEVEL_OFFSETS, Elite + ELITE_LEVEL_OFFSET, dungeon levels as rules 1.4. So walking outward is walking up the zone's level band, as in a classic MMO zone with its town in the middle.

### 4.3 Generation (stream `map(z)`, draws in this order)
1. Angles: ring 1 node i at `a1 + 360/RING_NODES[1] × i`; ring 2 node j at `a2 + 360/RING_NODES[2] × j`; ring 3 node j at ring 2 node j's angle + half a step. a1, a2 uniform.
2. Edges: hub to every ring 1 node; ring 1 neighbours with chance EDGE_KEEP_R1; every ring 2 node to the ring 1 node nearest in angle; ring 2 neighbours with chance EDGE_KEEP_R2; ring 2 node j to ring 3 node j, and to ring 3 node j-1 with chance EDGE_DIAG_R23; ring 3 neighbours with chance EDGE_KEEP_R3. The spokes (hub to ring 1, ring 1 to ring 2, ring 2 to ring 3) guarantee every node is connected.
3. Regions: REGION_COUNT wedges of equal angle from a uniform offset; each wedge takes one of the zone's regions (Content: name, kind, families), shuffled.
4. Landmarks: ROAD_COUNT **Roads** on ring 3 at evenly spaced positions from a uniform start (7.1); the **Shardfall** on ring 3 halfway between two Roads, which pair uniform (section 6).
5. Node types: Dungeon on a uniform ring 2 or 3 node that is not a Road or the Shardfall; Rest guarantee on a uniform free ring 1 or 2 node; Trainer guarantee on a uniform free ring 2 node; every other node by the region kind's weights (table 4.4); no Elite, Vendor or Trainer in ring 1; the Shardfall node is a Treasure.
6. Contract sites (3.3), then per node setup on stream `node(z, id)` as rules 1.4 step 4.

Node ids replace (row, lane): `node(z, id)`, `fight(z, id, k)`, `loot(z, id)`.

### 4.4 Region kinds (node weights)
| Kind | Quest | Grind | Elite | Rest | Vendor | Trainer | Treasure | Shrine | Feel |
|---|---|---|---|---|---|---|---|---|---|
| wilds | 36 | 24 | 10 | 10 | 2 | 2 | 10 | 6 | beasts, open country |
| road | 34 | 10 | 18 | 8 | 12 | 6 | 8 | 4 | bandits, waystations |
| haunt | 34 | 12 | 16 | 8 | 2 | 4 | 10 | 14 | ruins, casters, shrines |
| steads | 42 | 8 | 8 | 20 | 10 | 6 | 2 | 4 | farms, villages, rest |

Named REGION_W.kind.type in section 13. Encounters in a region draw REGION_FAMILY_SHARE of their mobs from the region's families, the rest from the zone's normal templates.

### 4.5 Hours and moving
- `MOVE(id)` to an unresolved node enters it: the node's content starts and costs its hours (rules 2.0).
- `MOVE(id)` to a resolved node (or the hub) costs HOURS_WALK and nothing else.
- `PASS` inside an unresolved node (before its first fight or choice) leaves it unresolved and costs HOURS_WALK instead of the node's hours. The player can come back later.
- Each node is resolved at most once.
- Zone hours `hz` count from arrival at the hub, hub services included. Run hours keep counting for Ascendancy (rules 1.7).

### 4.6 Hub
The hub is a node with the services of rules 1.4 (Trainer, Vendor, Inn), usable on every visit, each once per visit. Walking back to the hub to train is legal and costs the walk (the QA finding that zone 1's trainer comes too early is softened: the player can return at level 4-6) [source: qa-2026-11-09 finding 2]. The hub can be reached by the Dimming (section 6); its services stop then.

## 5. Vision (fog of war)

### 5.1 What the player always sees
- The whole graph skeleton: every node as a marker, every edge, every ring (so the level band of an unseen node is known roughly from its ring).
- Landmarks: the hub, the Roads, the Shardfall, the Dimming's current extent and the hours until it advances (section 6).
- Every node within the **vision radius** (hops from the player's node, VISION_RADIUS at P0) fully: type, content level, enemy count and archetypes, quest title, contract site markers.
- Nodes seen once stay seen (remembered) for the rest of the zone.

### 5.2 What vision perks add
| Source | Adds |
|---|---|
| Region Charts (prep) or Cartographer (meta) | region of every node, and the dungeon's location |
| Tracker's Notes (prep) or Old Hand (meta) | contract-site markers within TRACKER_RADIUS hops, on hidden nodes too |
| Local Guide (prep) | full vision radius +GUIDE_RADIUS_BONUS |
| Pathfinder (meta) | node **type** (no level detail, enemy count or site marker) within PATHFINDER_RADIUS hops |
| Spyglass (prep) | one node and its neighbours, fully, per charge |
| `ASK_LOCALS` (hub, HOURS_ASK_LOCALS) | the zone's regions, as Region Charts, for this zone only |
| Delve contract | its dungeon's location |

Full vision radius is capped at VISION_RADIUS_MAX. Reason (prototype, 12.3): at radius 3 the whole zone is in view from the hub and the planner's choices match the full-information choice in every decision, which is today's problem again.

### 5.3 What is never shown
Rare elite flags, treasure traps and vendor Embers stay hidden (today only meta Scout's Eye shows them; that entry is replaced, 11.2). The engine's `mapView` returns only what this section allows; bots and UI read `mapView`, never the zone state.

## 6. The Dimming (the pursuing threat)

### 6.1 Fiction
Oruvath, the Unlit Star, is the end boss; its phase 2 summons Dimming Shards [source: rules 10.2]. In every zone a shard has fallen on the rim (the **Shardfall**), and the darkness it spreads, **the Dimming**, eats the zone outward from it. Things that walk in it are Shardspawn. The longer the player stays, the less of the zone is left; staying in the dark kills. The threat ties the zones to the boss and to the existing Ascendancy clock (time makes the Unlit Star stronger).

### 6.2 Spread
`front(hz) = floor((hz - DIM_GRACE_H) / DIM_HOURS_PER_HOP)`; a node is **Dimmed** when `front >= 0` and its hop distance from the Shardfall is `<= front`. Distances are on the zone graph (edges as generated). With the starting values the first node dims after DIM_GRACE_H hours and the farthest node (6-7 hops) after about 24-27 zone hours; the hub (3 hops) dims at about 15 h.

The front only moves with hours, and every action costs hours, so it advances every step [stated: "advances every step"], and slow actions (Rest 4 h, a dungeon 5 h) let it advance more. The map shows, on every node, "dims in N h".

### 6.3 Inside the Dimming
- Entering a Dimmed node, or ending any action in one (the front reached the player), starts a **Dimmed encounter**: DIM_PACK_SIZE Shardspawn (zone's normal templates with the Shardspawn variant) at level `max(CL, L) + DIM_LEVEL_PER_DEPTH × depth`, depth = `front - distance` (0 at the edge), HP × DIM_HP_MULT, damage × DIM_DMG_MULT; it costs HOURS_DIM_FIGHT; XP × DIM_XP_MULT, no loot, no gold. Flee is allowed (rules 7.8) and counts as passing through.
- A Dimmed node's content is lost (it cannot be resolved; Rest, Vendor, Trainer and hub services do not work there). Sites in it are lost.
- Fights deeper in the dark are higher level, so standing still or walking deeper kills; the way out is to leave (section 7).

Target (B43): a planner is caught in 8-18 % of zones and Dimmed encounters are 5-20 % of non-boss deaths. The prototype lands at 15 % and about 17 % (section 12).

## 7. Leaving a zone (replaces rules 1.5)

The owner asked to compare Roads on the rim, a recall item, and both [stated]. The recommendation is **both** (7.3), with Roads as the normal way out; section 12.2 has the evidence.

### 7.1 Roads
ROAD_COUNT Roads on the rim. On a Road node, `TAKE_ROAD` leaves the zone: HOURS_TRAVEL, then the next zone's hub (Z6: the Camp). A Dimmed Road can still be taken after its Dimmed encounter. There is **no level gate**: the player may leave at any level (TRAVEL_EARLY_LEVELS retired); leaving under-levelled is its own risk, as today.

### 7.2 Homeward Bell (the recall item)
An original item: a small brass bell that, rung, calls its bearer home along the road it was cast for. Every run starts with BELL_START_CHARGES charge (prep 2.3 and meta 11.2 add more, max BELL_MAX_CHARGES).
- `RING_BELL` on the map: channel of BELL_CHANNEL_H hours (the Dimming advances; if the player's node dims during the channel, a Dimmed encounter happens first, then the bell completes), then the player arrives at the next zone's hub (Z6: the Camp). No HOURS_TRAVEL.
- Not usable in a node (only on the map), in the Camp or at the boss.

### 7.3 Recommendation and why
Prototype numbers are from the scratch model (section 12; planner and greedy bots, fresh profile P0, 300 runs each; "threat share" = Dimmed encounters' share of the model's expected non-boss deaths).

| Variant | What it does to play | Planner: caught / threat share / est. minutes | Greedy: caught / threat share / Z6 exit level |
|---|---|---|---|
| A Roads only (3) | strongest spatial pull: the Dimming comes from one side and the Roads are fixed, so every zone is a trip across with chosen detours; harsh when fog hides a dead end | 17 % / 20 % / 49 | 19 % / 36 % / 57 |
| A2 Roads only (2) | as A, with fewer ways out | 35 % / 48 % / 46 | 52 % / 73 % / 54 |
| B Bell only (1 charge per zone, no Roads) | leaving becomes a timing choice anywhere; geography stops mattering for the exit; a simple player leaves early and under-levelled; fewest walk-backs | 18 % / 22 % / 46 | 16 % / 18 % / 54 |
| **C Roads (3) + Bell (1 charge per run)** | Roads keep A's spatial planning and tension; the Bell is a bought insurance against a bad fog draw and a speed tool, so prep decides how much risk the player carries | **15 % / 17 % / 48** | 19 % / 35 % / 57 |

Why C:
1. It keeps what makes FTL's map work: a known goal on the far side, a visible threat behind, and every step a choice between one more node and the way out. In B that goal disappears; the model shows the effect as fewer close calls for a simple player (46 % of zones against 66-70 % with Roads) and a run that is shortest because nobody walks to the rim.
2. It is the safest Roads variant: the planner is caught least (15 % of zones) and threat deaths are the smallest share (17 %). A2 shows how fast Roads-only becomes punishing.
3. It turns the owner's two ideas into one decision: the Bell is something prep points buy (Second Clapper), so "how much safety do I carry" competes with contracts and vision at the start camp.
4. The bots use the one charge in about 77 % of runs, mostly when the walk to a Road would cross the Dimming; it is an escape, not the normal exit.

Runners-up: **A** if the owner wants FTL's hard edge with no safety net (one constant: BELL_START_CHARGES = 0); **B** if he wants the gentlest version (Roads removed, BELL_START_CHARGES per zone).

Risk: the greedy bot (no lookahead) is caught in about 19 % of zones under A and C, and the Dimming is about a third of its expected non-boss deaths. A human sees the darkness coming, which the greedy partly ignores, but the UI must make "dims in N h" impossible to miss (section 9) and the Sim Engineer's greedy needs the threat rule of 10.2.

## 8. Changes to rules.md and the meta catalogue

### 8.1 rules.md sections replaced or changed
| rules.md | Change |
|---|---|
| 1.1 Phases | PREP added; MAP actions as section 1 here |
| 1.2 Creation | start kit unchanged; prep purchases are added at `SET_OUT` |
| 1.4 Map | replaced by section 4 (disc graph, regions, landmarks, sites); weights W_* replaced by REGION_W; DUNGEON_ROW_*, REST_ROW_*, TRAINER_ROW_*, ZONE_CHOICE_ROWS, LANES, MAX_SAME_TYPE_PER_ROW retired; hub services unchanged but usable on every hub visit |
| 1.5 Leaving | replaced by section 7; TRAVEL_EARLY_LEVELS retired |
| 1.6 Camp | unchanged (the Camp is reached by a Z6 Road or the Bell) |
| 1.7 Ascendancy | unchanged; BOSS_TIME_PAR to be re-measured (B17) because zone hours change |
| 1.8 Trade-offs | "Story chain" row replaced by "Contracts" (plan the run at the start camp; find sites under fog); new rows "Vision vs contracts vs safety" (prep points) and "One more node vs the Dimming" |
| 2.0 / 2.1 Quest | quest nodes unchanged; story chain retired (3.2); a Quest node can be a contract site |
| 2.5 Rest | unusable in a Dimmed node |
| 3 Pacing | new terms in 9.4; the worked estimate is replaced by the prototype estimate (12.4) until the simulator measures it |
| 8.4 Drops | tables "Contract" and "Bounty" added |
| 9 Summary | adds contracts taken / completed / expired, prep purchases, Reserve left, Dimmed encounters, Bell charges used, zone hours |
| 11.1 Echoes | new line: Reserve × PREP_ECHO_PER_POINT; ECHO_PER_QUEST also paid per contract completed × ECHO_CONTRACT_MULT |
| 11.2 Catalogue | see 8.2 |
| Streams (0) | `prep(k)`, `hubc(z)` added; `node`, `fight`, `loot` keyed by node id |

### 8.2 Meta catalogue (rules 11.2)
| id | Name | Change | Cost |
|---|---|---|---|
| scout | Scout's Eye | **replaced** by Pathfinder: node types visible within PATHFINDER_RADIUS hops (type only) | 100 (as today) |
| cartographer | Cartographer (new) | Region Charts every run, free | META_COST_CARTOGRAPHER |
| old_hand | Old Hand (new) | Tracker's Notes every run, free | META_COST_OLD_HAND |
| quartermaster | Quartermaster (new, 2 ranks) | +PREP_POINTS_PER_QM preparation points per rank | META_COST_QM_1 / META_COST_QM_2 |
| swift_boots | Swift Boots | **changed**: +1 Homeward Bell charge per run (no level gate exists to lower) | 200 (as today) |

Catalogue total rises by META_COST_CARTOGRAPHER + META_COST_OLD_HAND + META_COST_QM_1 + META_COST_QM_2 = 570 Echoes (6 560 -> 7 130); B31 (runs to full catalogue) is re-measured. Vision entries are "information" in the meta budget (rules 11.2); Quartermaster is power and counts against B10.

Standard purchase order (balance.md 1.4) inserts cartographer after scout, old_hand after cache, quartermaster ranks after keen 1.

Visibility ladder (owner decision 1), as the planner experiences it (prototype, variant C):

| Profile | Vision | Contract completion | Step calculability |
|---|---|---|---|
| fresh, nothing bought | adjacent nodes | 56 % | 0.72 |
| fresh + Region Charts (1 point) | + regions | 61 % | 0.72 |
| fresh + Tracker (2 points) | + sites within 2 hops | 77 % | 0.73 |
| fresh + Charts + Guide (4 points) | radius 2, regions | 70 % | 0.92 |
| full catalogue (prototype: full radius 2, regions, sites within 3, 14 points) | | 70 % | 0.93 |
| radius 3 | whole zone from the hub | 81 % | 1.00 |

The Tracker buys contract steering without making the whole route computable; the Guide buys calculability. That is the intended split: a learned profile steers better, but the zone stays partly unknown, which is why Pathfinder shows types only and the radius is capped at 2.
