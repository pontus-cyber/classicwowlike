# Expedition spec: start-camp preparation, contracts, roaming zone maps, the Dimming

Owner: Lead Game Designer. Status: draft for Lead and owner review, 2026-11-10 (milestone M2b). Sections 2 (start camp: points, board, rerolls, supplies, vision perks, Reserve) and 3 (contracts: kinds, rewards, story chain retired, sites, slots, hub contract 3.6) are in the engine with `newRun({ mapMode: 'expedition', prep: true })`, the default since D116 (2026-11-12, docs/handoffs/engineer-2026-11-12b.md: a new run starts on the expedition map at the start camp; the rows map is an option for the simulator and the Dev menu; an option before, 2026-11-11, docs/handoffs/engineer-2026-11-11f.md; engine-api.md 13), with the PREP actions of section 1, `USE_SPYGLASS`, the Tracker's and Delve's vision of 5.2, the summary and Echo lines of 8.1 and the pacing terms of 9.4 (in the engine), and the meta catalogue of 8.2 (in the engine since the M2b v11 build, 2026-11-11, docs/handoffs/engineer-2026-11-11h.md; the entries act in runs with the start camp); not yet: `ASK_LOCALS`. The engine defaults of engineer-2026-11-11f section 4 are confirmed by the designer (docs/specs/changes-m2b-v10.md, "Engine defaults"; lines marked "(M2b v10)"); the M2b v10 tuning package for the switch-over (docs/specs/changes-m2b-v10.md, draft, D82-D86) is in the engine with its rows A1-A3, B1-B4 and C1 since 2026-11-11 (docs/handoffs/engineer-2026-11-11g.md; lines in 3.1, 6.2 and 13 marked "(M2b v10)"); its bot rows (C2, D1, D2, the EST_COMPLETE prior) and the B44 target (C3) are the Simulation & Balance Engineer's and the designer's and are not folded here. The flip package M2b v11 (docs/specs/changes-m2b-v11.md, draft, D91-D98) is in the engine with its rows 1-4 and row 8 as a named constant at its old value (gated) since 2026-11-11 (docs/handoffs/engineer-2026-11-11h.md; lines in 6.3, 8.2, 9.5 and 13 marked "(M2b v11)"); its target rows 5-7 are folded when the Lead accepts D95-D97. The last package before the flip, M2b v12 (docs/specs/changes-m2b-v12.md, draft, D100-D104), is in the engine with its rows 1-2, the B43 caught band of row 3 (D102, owner O9 default) and row 5 as a named constant at its old value (gated) since 2026-11-11 (docs/handoffs/engineer-2026-11-11i.md; lines in 6.2, 6.3, 9.5, 11.1 and 13 marked "(M2b v12)"); row 4 is the simulator's. Rules in sections 1-8; UI 9; bots 10; balance targets 11; prototype evidence 12; Heat addendum H (2026-11-10, rows mode and expedition); constants 13. Tuning pass M2b v6 (2026-11-11, docs/specs/changes-m2b-v6.md) changes lines marked "(M2b v6)". M2b v7 (2026-11-11, docs/specs/changes-m2b-v7.md): time is counted in whole **tolls** (1 toll = 1 former hour, every number kept), the meter is called **the Furnace** with the states Calm, Smouldering, Burning and Infernal, and every time constant is renamed from HOURS_* / *_H to TIME_*; rule lines marked "(M2b v7)", lines changed only by the rename are not marked. Prototype and measurement records (sections 9.5, 12, H.7) keep their "h": read 1 h as 1 toll. M2b v14 (2026-11-12, docs/specs/changes-m2b-v14.md row 2, D112; status draft as that file): a hidden elite shows its Deathblow's type on the map (5.3); in the engine since 2026-11-12 (docs/handoffs/engineer-2026-11-12.md); marked "(M2b v14)". M2b v15 (2026-11-12, docs/specs/changes-m2b-v15.md row 2, D124; status draft as that file): the Swift passage of a Road (7.1, 9.2, 13; switch `GATES.swiftRoad`); in the engine since 2026-11-12 (docs/handoffs/engineer-2026-11-12c.md); marked "(M2b v15)". Off since D126 (docs/reports/balance-2026-11-12c.md: the planner's win falls 3.2 pp on PALL and P0 is under 20 % with it on); the rule and the switch stay.
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
| **PREP** | **`TAKE_CONTRACT(i)`, `DROP_CONTRACT(i)`, `BUY_PREP(id)`, `SELL_PREP(id)`, `REROLL_BOARD`, `SET_OUT`** (section 2; `REROLL_BOARD` only with `GATES.campReroll`, off since D128) |
| ZONE_HUB | hub services (rules 1.4), **`TAKE_HUB_CONTRACT(mode, contractId)`** (3.6; `contractId` for `swap` only, M2b v10), **`ASK_LOCALS`** (5.3), `LEAVE_HUB` |
| MAP | **`MOVE(nodeId)`** (adjacent node only), **`TAKE_ROAD`** (on a Road node), **`RING_BELL`** (Homeward Bell, 7.2), **`USE_SPYGLASS(nodeId)`**, out-of-combat actions. `CHOOSE_NODE(lane)` and `TRAVEL_ON` are removed. |
| NODE | node actions as rules 2, plus **`PASS`** (leave the node unresolved, 4.6) |
| CAMP, BOSS, SUMMARY | as rules 1.1; SUMMARY adds the contract and expedition lines (9.3) |

Real time: PREP is one screen, about PACE_PREP_S seconds. The run otherwise keeps the rules 3 pacing terms; new terms in section 9.4.

## 2. The start camp (PREP)

### 2.1 Preparation points
`prepPoints = PREP_POINTS + PREP_POINTS_PER_QM × (Quartermaster ranks)` (meta, 11). Everything on the prep screen is bought with these points. Points not spent at `SET_OUT` become **Reserve** (2.6).

### 2.2 The contract board
At PREP the board shows CONTRACT_BOARD_SIZE contracts drawn on stream `prep(k)` = hash(runSeed, "prep", k), k = number of rerolls so far:
- (D132) slot i (from 0) first takes its zone from its band, CONTRACT_BOARD_BANDS[i]: one uniform draw over the band's zones (a band of one zone makes no draw). The bands are zones 1-2, 3-4 and 5-6, so the three offers span the run: one early, one middle, one late contract (report 2026-11-12d: with the board on zones 1-3 the zone 4-6 contracts left the start camp and the hubs did not replace them; PALL 48.2 % < 50 %, B46 5.1 % < 8 %). The switch `GATES.boardAcrossRun` is **on**; off, slot i is a contract of zone i + 1 while i < ZONE_COUNT with no zone draw (the D128 board: zones 1, 2 and 3), kept so the simulator can arm the old board. A slot past the bands (or past ZONE_COUNT when off) would draw its zone uniformly from 1..ZONE_COUNT. (D128: CONTRACT_BOARD_SIZE 3; it was 8, one per zone and CONTRACT_BOARD_EXTRA 2 drawn zones, a constant now retired. Owner playtest 2026-11-12 20:19: "lower the contracts to maybe 3 choices". Each zone 2-6 also offers a contract at its hub, 3.6.);
- kind by weight: Cull CW_CULL, Bounty CW_BOUNTY, Delve CW_DELVE (section 3);
- target region: uniform over the zone's REGION_COUNT regions (Delve: the zone's dungeon); target family: one of the region's families (Content, 12.2);
- every contract shows: zone and level band, kind, target ("Cull boars in the Barley Reach, Amberfold Downs, levels 1-10"), sites needed, reward summary, price.
- no two offers on one board are the same contract (same zone, kind, target region and family, and a Bounty's elite; D128, D132: a board whose slots all have their own zone or band never draws a repeat, so the rule acts only on a larger board or a meta unlock): a slot whose offer equals one already on the board (an earlier slot, or after a reroll an offer kept because it is taken) takes instead one weighted draw, on the same stream, over the offers that slot can draw (its band's zones, each 1 / band size: a zone's own slot that zone, a band slot its band, an extra slot every zone) that are not on the board, each with its chance in the normal draw, so the odds are those of drawing again until it differs; with none left the offer stays. A board without a repeat is drawn as before this rule (QA playtest 2026-11-11 finding 4: offers 2 and 7 were the same; 2026-11-11, UI/UX & Visual Engineer, docs/handoffs/ui-2026-11-11d.md).

`TAKE_CONTRACT(i)` costs `CONTRACT.kind.price` points; at most CONTRACT_SLOTS contracts may be held at once (whole run, PREP and hubs). `DROP_CONTRACT(i)` at PREP refunds the price.

`REROLL_BOARD` costs REROLL_PRICE points, at most REROLL_MAX times; it redraws every contract not taken (stream `prep(k+1)`; a taken slot still makes its draws and keeps its offer, and the no-repeat rule above counts the taken offers). (D128) The reroll is legal only while the switch `GATES.campReroll` is on; it is **off**: the first screen has no reroll. The rule stays for a later meta unlock.

`CONTRACT_SLOTS` is unchanged by D128 (4): the three board offers can all be held, and the fourth slot serves a hub contract (3.6).

### 2.3 Supplies
| id | Name | Price | Effect |
|---|---|---|---|
| prep_draughts | Field Draughts | PRICE_PREP_DRAUGHTS | PREP_DRAUGHT_COUNT Healing Draughts in the bag (heal is a share of max HP, so they keep their worth all run) |
| prep_rations | Trail Pack | PRICE_PREP_RATIONS | PREP_RATION_COUNT Trail Rations |
| prep_ember | Ember of Return | PRICE_PREP_EMBER | one Ember of Return (rules 8.6; EMBER_MAX_CARRIED still applies) |
| prep_bell | Second Clapper | PRICE_PREP_BELL | +1 Homeward Bell charge (7.2), up to BELL_MAX_CHARGES |
| prep_mule | Pack Mule | PRICE_PREP_MULE | +PREP_MULE_SLOTS bag slots for the run |

Each supply and each vision perk can be bought once per run; supplies do not stack (engine default, confirmed M2b v10).

(D128) The start camp offers only the options in PREP_CAMP_OPTIONS: **Field Draughts** and **Ember of Return** (supplies), **Region Charts** and **Tracker's Notes** (vision, 2.4), at most four on the screen. These are the four the planner bot valued (balance 2026-11-11f, P0: Field Draughts in 100 % of runs, Region Charts 54 %, the Ember 30 %, Tracker's Notes 9 %; the Local Guide and the Second Clapper were never bought) [source: docs/reports/balance-2026-11-11f.md, 2026-11-11e.md]. The Trail Pack, the Second Clapper, the Pack Mule, the Local Guide and the Spyglass keep their rules and SET_OUT effects in the engine but are not offered: `BUY_PREP` refuses them ("not offered at the start camp"). A later meta unlock can add an option to the list.

### 2.4 Vision perks (owner decision 1)
Vision is a resource. A fresh profile sees adjacent nodes only (section 5). Perks bought here last the whole run:

| id | Name | Price | Effect |
|---|---|---|---|
| prep_charts | Region Charts | PRICE_CHARTS | the region of every node of every zone is shown (tint and name), and every dungeon's location |
| prep_tracker | Tracker's Notes | PRICE_TRACKER | contract sites (4.5) are shown within TRACKER_RADIUS hops, even when the node itself is hidden |
| prep_guide | Local Guide | PRICE_GUIDE | full vision radius +GUIDE_RADIUS_BONUS (capped at VISION_RADIUS_MAX) |
| prep_spyglass | Spyglass | PRICE_SPYGLASS | SPYGLASS_CHARGES uses of `USE_SPYGLASS(nodeId)` (0 tolls): reveals that node and its neighbours fully, any distance |

A perk the profile already has from meta (11) is shown as owned and cannot be bought. (D128) Of these four, Region Charts and Tracker's Notes are offered at the camp (2.3); the Local Guide and the Spyglass are not.

### 2.5 Prices are the design lever
The points cannot buy everything: with PREP_POINTS = 10 a fresh player chooses between, for example, four cheap contracts; two contracts and the Tracker; one contract, an Ember and the Guide. The prototype (section 12) measured what the main choices are worth. (D128) With three offers and four options: all three contracts (6-8 points) leave 2-4 points for the Draughts, the Charts or the Tracker; the Ember (4) costs one or two contracts. The board and the four options together cost 14-16 points, so the choice stays.

### 2.6 Reserve (unspent points)
Unspent points are kept as Reserve. Reserve pays for hub contracts (3.6) and for `ASK_LOCALS` (no point cost; it is listed here because the hub screen shows Reserve next to it). At SUMMARY each Reserve point left is worth PREP_ECHO_PER_POINT Echoes (11.1 new line). So spending is a real choice: a point kept is flexibility in the run and a small Echo value; a point spent is power or information now.

## 3. Contracts (replaces the story chain of rules 2.1 and 1.8)

### 3.1 Kinds
| Kind | Target | Sites needed | Price | Reward on completion |
|---|---|---|---|---|
| Cull | an enemy family in one region ("boars in the Barley Reach") | CULL_SITES | CONTRACT.cull.price | `CULL_XP_FRAC × XP_WEIGHT_MULT × xpToNext(CL_c)` (M2b v10: no diffMod), gold `CULL_GOLD_V × V(CL_c)`, choose 1 of CONTRACT_REWARD_CHOICES items on table "Contract" |
| Bounty | a named elite of a family, roaming one region | 1 | CONTRACT.bounty.price | `BOUNTY_XP_FRAC × …`, gold `BOUNTY_GOLD_V × V`, choose 1 of CONTRACT_REWARD_CHOICES on table "Bounty" |
| Delve | clear the zone's dungeon | 1 | CONTRACT.delve.price | `DELVE_XP_FRAC × …`, gold `DELVE_GOLD_V × V`, choose 1 of DELVE_REWARD_CHOICES on table "Contract" |

`CL_c = ZONE_LEVELS × (z - 1) + CONTRACT_CL_OFFSET` (M2b v10: the zone's rim level 10z - 2, was the middle 10z - 5; zone 6: 58). Contract XP has no level-difference modifier (M2b v10): `round(xpFrac × XP_WEIGHT_MULT × xpToNext(CL_c) × (1 + Quick Study + Insight))`, as the retired story chain; it is not a kill (no rested XP); heat applies (H.5); nothing at MAX_LEVEL. The prep board and the tracker show this amount (`reward.xp`, engine-api.md 13). Item level as rules 8.3 with source level CL_c: a rare 10z - 1, an epic 10z + 1 (zone 6: 59 and 61). (M2b v10)

New drop tables (rules 8.4): "Contract" C/U/R/E = 0 / 0 / CONTRACT_RARE_W / CONTRACT_EPIC_W; "Bounty" 0 / 0 / BOUNTY_RARE_W / BOUNTY_EPIC_W (M2b v10: 65 / 35 and 40 / 60, were 80 / 20 and 60 / 40). Heat's rarity step (H.3) still applies; an epic stays epic.

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
CONTRACT_SLOTS limits held contracts (PREP and hubs together). The board offers one contract from each of zones 1-2, 3-4 and 5-6 (D132; D128 had zones 1-3, and the board covered all six zones before), so the start camp sets an early, a middle and a late goal; the hub offers one contract per zone from zone 2 on.

### 3.6 Hub contract
Each zone hub (zones 2..6; zone 1's hub follows PREP directly) offers one contract of that zone (stream hash(runSeed, "hubc", z); kind and target as 2.2), open until the zone's first `LEAVE_HUB` (a later hub visit does not offer it; M2b v10). `TAKE_HUB_CONTRACT(mode, contractId)`:
- `reserve`: pay its price from Reserve; needs a free slot;
- `swap`: abandon the held contract `contractId` (any zone; no refund, progress lost) and take this one for free.
Taken before `LEAVE_HUB`, its sites are placed with the zone (3.3).

## 4. Zone map: a roamable disc (replaces rules 1.4)

### 4.1 Shape
Each zone is a graph of 1 + RING_NODES[1] + RING_NODES[2] + RING_NODES[3] nodes: the **hub** in the centre (ring 0), and rings 1, 2 and 3 (the rim) around it. The player starts at the hub and may walk to any adjacent node, in any direction, including back to visited nodes and the hub [stated].

### 4.2 Content level by ring
`CL(z, ring) = ZONE_LEVELS × (z - 1) + 1 + RING_CL_BASE[ring] + u`, u uniform in 0..RING_CL_SPREAD-1, drawn per node (Z1: ring 1 levels 2-4, ring 2 levels 5-7, ring 3 levels 8-10). The hub is the band minimum. Offsets as today: Quest + QUEST_LEVEL_OFFSETS, Elite + ELITE_LEVEL_OFFSET, dungeon levels as rules 1.4. So walking outward is walking up the zone's level band, as in a classic MMO zone with its town in the middle.

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

### 4.5 Tolls and moving
- `MOVE(id)` to an unresolved node enters it: the node's content starts and costs its tolls (rules 2.0).
- `MOVE(id)` to a resolved node (or the hub) costs TIME_WALK and nothing else.
- `PASS` inside an unresolved node (before its first fight or choice) leaves it unresolved and costs TIME_WALK instead of the node's tolls. The player can come back later.
- Each node is resolved at most once.
- Zone time `zt` (tolls) counts from arrival at the hub, hub services included. Run tolls keep counting for Ascendancy (rules 1.7). (M2b v7: was zone hours `hz`)

### 4.6 Hub
The hub is a node with the services of rules 1.4 (Trainer, Vendor, Inn), usable on every visit, each once per visit. Walking back to the hub to train is legal and costs the walk (the QA finding that zone 1's trainer comes too early is softened: the player can return at level 4-6) [source: qa-2026-11-09 finding 2]. The hub can be reached by the Dimming (section 6); its services stop then.

## 5. Vision (fog of war)

### 5.1 What the player always sees
- The whole graph skeleton: every node as a marker, every edge, every ring (so the level band of an unseen node is known roughly from its ring).
- Landmarks: the hub, the Roads, the Shardfall, the Dimming's current extent and the tolls until it advances (section 6).
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
| `ASK_LOCALS` (hub, TIME_ASK_LOCALS) | the zone's regions, as Region Charts, for this zone only |
| Delve contract | its dungeon's location |

Full vision radius is capped at VISION_RADIUS_MAX. Reason (prototype, 12.3): at radius 3 the whole zone is in view from the hub and the planner's choices match the full-information choice in every decision, which is today's problem again.

### 5.3 What is never shown
Rare elite flags, treasure traps and vendor Embers stay hidden (today only meta Scout's Eye shows them; that entry is replaced, 11.2). The engine's `mapView` returns only what this section allows; bots and UI read `mapView`, never the zone state.
An elite's name, own archetype and Deathblow ability stay hidden (D50); its Deathblow's type shows, heavy or cast, so the player can plan the answer before entering (a heavy one is also answered by a full dodge, WARD, an image or the pet; a cast only by an interrupt, stun or control). Every zone's elite pool has both types (rules 12.4), so the type never tells a rare (rules 1.9.5; D112). (M2b v14)

## 6. The Dimming (the pursuing threat)

### 6.1 Fiction
Oruvath, the Unlit Star, is the end boss; its phase 2 summons Dimming Shards [source: rules 10.2]. In every zone a shard has fallen on the rim (the **Shardfall**), and the darkness it spreads, **the Dimming**, eats the zone outward from it. Things that walk in it are Shardspawn. The longer the player stays, the less of the zone is left; staying in the dark kills. The threat ties the zones to the boss and to the existing Ascendancy clock (time makes the Unlit Star stronger).

### 6.2 Spread
`front(zt) = floor(DIM_FRONT_HOPS × (zt - DIM_GRACE) / DIM_FRONT_TIME)`; a node is **Dimmed** when `front >= 0` and its hop distance from the Shardfall is `<= front`. Distances are on the zone graph (edges as generated). With the starting values (grace 6 tolls, then two hops every five tolls) the first node dims after 6 tolls, the next ring of hops at 9, 11, 14, 16, 19, 21, so the hub (3 hops) dims at 14 and the farthest node (6-7 hops) at 21-24. (M2b v7: DIM_HOURS_PER_HOP 2.5 became DIM_FRONT_HOPS 2 per DIM_FRONT_TIME 5, the same schedule in whole tolls)

The front only moves with tolls, and every action costs tolls, so it advances every step [stated: "advances every step"], and slow actions (Rest 4 tolls, a dungeon 5 tolls, M2b v10) let it advance more. The map shows, on every node, "dims in N tolls". (M2b v7)

The Dungeon dims by its hops as every node (M2b v12, D100: M2b v10's "the dungeon holds out", DUNGEON_DIM_HOLD 3 tolls added to the Dungeon's dimAt, is struck; it added 4.3 pp of Delve completion against the 8 pp it had to earn). Its "dims in N" label and the Dimming state (H.5) use the hops formula. A Delve held on a Dimmed dungeon expires as any contract when the zone is left.

### 6.3 Inside the Dimming
- Entering a Dimmed node, or ending any action in one (the front reached the player), starts a **Dimmed encounter**: DIM_PACK_SIZE Shardspawn (zone's normal templates with the Shardspawn variant) at level `max(CL, L) + DIM_LEVEL_PER_DEPTH × depth`, depth = `front - distance` (0 at the edge), HP × DIM_HP_MULT, damage × DIM_DMG_MULT; it costs TIME_DIM_FIGHT (M2b v11: 2 tolls, was 1; the front check after it uses the new zone time); XP × DIM_XP_MULT, no loot, no gold. Flee is allowed (rules 7.8) and counts as passing through.
- A Dimmed node's content is lost (it cannot be resolved; Rest, Vendor, Trainer and hub services do not work there). Sites in it are lost.
- Fights deeper in the dark are higher level, so standing still or walking deeper kills; the way out is to leave (section 7).
- **Walking out** (M2b v12, D101): a Dimmed encounter that a `MOVE` farther from the Shardfall started (a walk to a node with more hops from the Shardfall than the one left, `shardDist[to] > shardDist[from]` on the zone graph, as 6.2) costs TIME_DIM_ESCAPE (1 toll) instead of TIME_DIM_FIGHT. Every other Dimmed encounter keeps TIME_DIM_FIGHT: the first one when the front reaches the player after a node's content, and those after a PASS, the Bell's channel, a hub service, or a walk sideways or inward. Depth, level, pack and rewards are unchanged. An outward step in the dark then costs TIME_WALK + TIME_DIM_ESCAPE = 2 tolls, the front moves 0.8 hop and the step adds 1 hop, so depth falls 0.2 per outward step (with TIME_DIM_FIGHT on every step it rose 0.2: no way out on foot). Fiction: the Shardspawn come for what stands still in the dark; a bearer walking out of it fights them off on the move. The map's tolls previews count it (rules 1.9.6, 1.9.10).

Target (B43): a planner is caught in 8-25 % of zones (M2b v12, D102: was 8-18 %, set on the prototype before H.5 paid Hot at the edge; owner O9) and Dimmed encounters are 5-20 % of non-boss deaths. The prototype lands at 15 % and about 17 % (section 12).

## 7. Leaving a zone (replaces rules 1.5)

The owner asked to compare Roads on the rim, a recall item, and both [stated]. The recommendation is **both** (7.3), with Roads as the normal way out; section 12.2 has the evidence.

### 7.1 Roads
ROAD_COUNT Roads on the rim. On a Road node, `TAKE_ROAD` leaves the zone: TIME_TRAVEL, then the next zone's hub (Z6: the Camp). A Dimmed Road can still be taken after its Dimmed encounter. There is **no level gate**: the player may leave at any level (TRAVEL_EARLY_LEVELS retired); leaving under-levelled is its own risk, as today.

**Swift passage** (M2b v15, D124): a Road taken while the zone time (tolls since arriving at the zone's hub, hub services included; checked before TIME_TRAVEL is paid) is <= ROAD_SWIFT_TOLLS first grants `round(ROAD_SWIFT_XP_FRAC × xpToNext(L))` XP, L the level then (no level-difference modifier or other XP modifier; level-ups apply), then the travel. Once per zone; zone 6's Road to the Camp counts; the Homeward Bell (7.2) does not. The rush path is XP-bound, so a rusher gets about three quarters of a level for crossing fast and a normal player loses nothing (changes-m2b-v15.md row 2). Off since D126 (`GATES.swiftRoad` false): no Road pays it and the view's `swift` is null. Rules 1.9.7; engine event `swift`, `mapView.swift` (engine-api.md 10.3). (M2b v15)

### 7.2 Homeward Bell (the recall item)
An original item: a small brass bell that, rung, calls its bearer home along the road it was cast for. Every run starts with BELL_START_CHARGES charge (prep 2.3 and meta 11.2 add more, max BELL_MAX_CHARGES).
- `RING_BELL` on the map: channel of BELL_CHANNEL_TIME tolls (the Dimming advances; if the player's node dims during the channel, a Dimmed encounter happens first, then the bell completes), then the player arrives at the next zone's hub (Z6: the Camp). No TIME_TRAVEL.
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

Risk: the greedy bot (no lookahead) is caught in about 19 % of zones under A and C, and the Dimming is about a third of its expected non-boss deaths. A human sees the darkness coming, which the greedy partly ignores, but the UI must make "dims in N tolls" impossible to miss (section 9) and the Sim Engineer's greedy needs the threat rule of 10.2.

## 8. Changes to rules.md and the meta catalogue

### 8.1 rules.md sections replaced or changed
| rules.md | Change |
|---|---|
| 1.1 Phases | PREP added; MAP actions as section 1 here |
| 1.2 Creation | start kit unchanged; prep purchases are added at `SET_OUT` |
| 1.4 Map | replaced by section 4 (disc graph, regions, landmarks, sites); weights W_* replaced by REGION_W; DUNGEON_ROW_*, REST_ROW_*, TRAINER_ROW_*, ZONE_CHOICE_ROWS, LANES, MAX_SAME_TYPE_PER_ROW retired; hub services unchanged but usable on every hub visit |
| 1.5 Leaving | replaced by section 7; TRAVEL_EARLY_LEVELS retired |
| 1.6 Camp | unchanged (the Camp is reached by a Z6 Road or the Bell) |
| 1.7 Ascendancy | unchanged; BOSS_TIME_PAR to be re-measured (B17) because zone tolls change |
| 1.8 Trade-offs | "Story chain" row replaced by "Contracts" (plan the run at the start camp; find sites under fog); new rows "Vision vs contracts vs safety" (prep points) and "One more node vs the Dimming" |
| 2.0 / 2.1 Quest | quest nodes unchanged; story chain retired (3.2); a Quest node can be a contract site |
| 2.5 Rest | unusable in a Dimmed node |
| 3 Pacing | new terms in 9.4; the worked estimate is replaced by the prototype estimate (12.4) until the simulator measures it |
| 8.4 Drops | tables "Contract" and "Bounty" added |
| 9 Summary | adds contracts taken / completed / expired, prep purchases, Reserve left, Dimmed encounters, Bell charges used, zone tolls |
| 11.1 Echoes | new line: Reserve × PREP_ECHO_PER_POINT; ECHO_PER_QUEST also paid per contract completed × ECHO_CONTRACT_MULT |
| 11.2 Catalogue | see 8.2 |
| Streams (0) | `prep(k)`, `hubc(z)` added; `node`, `fight`, `loot` keyed by node id |

### 8.2 Meta catalogue (rules 11.2)
In the engine since the M2b v11 build (rules 11.2; docs/handoffs/engineer-2026-11-11h.md): the entries are in the catalogue `C.META`; Scout's Eye and Swift Boots keep their rows-map effect and add the one below (`expedition` in their data); Cartographer, Old Hand and Quartermaster are marked `mapMode: 'expedition'` and do nothing on the rows map. Every effect below applies in a run with the start camp (as the owned perks of 2.4). (M2b v11)

| id | Name | Change | Cost |
|---|---|---|---|
| scout | Scout's Eye | **replaced** by Pathfinder: node types visible within PATHFINDER_RADIUS hops (type only) | 100 (as today) |
| cartographer | Cartographer (new) | Region Charts every run, free | META_COST_CARTOGRAPHER |
| old_hand | Old Hand (new) | Tracker's Notes every run, free | META_COST_OLD_HAND |
| quartermaster | Quartermaster (new, 2 ranks) | +PREP_POINTS_PER_QM preparation points per rank | META_COST_QM_1 / META_COST_QM_2 |
| swift_boots | Swift Boots | **changed**: +1 Homeward Bell charge per run (no level gate exists to lower) | 200 (as today) |

Catalogue total rises by META_COST_CARTOGRAPHER + META_COST_OLD_HAND + META_COST_QM_1 + META_COST_QM_2 = 570 Echoes (6 560 -> 7 130; in the engine, M2b v11); B31 (runs to full catalogue) is re-measured. Vision entries are "information" in the meta budget (rules 11.2); Quartermaster is power and counts against B10.

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

## 9. UI the player needs

### 9.1 Prep screen (start camp)
(D128, owner playtest 2026-11-12 20:19: "strip it as much as possible ... 3 simple choices".) One lean screen, landscape: the title and one line, then **three contract cards side by side** (keys 1-3), each with only its title (kind icon, kind and target, e.g. "Cull boars"), one line of what to do ("Win 2 sites in the Barley Reach, Amberfold Downs"), the pay in one line ("2.8 levels of XP · gold · choose 1 of 3"), its price and Take / Drop. Below them **up to four small option cards** (keys A-D: name, icon, price, Buy / Sell or Owned), the **points left** in large type with "N contracts held", and `Set out` (Enter), always in view bottom-right (QA finding BUG-QA-10: never below the fold). Everything else moves into tooltips: zone and level band, sites needed and where they lie ("Sites: Quest or Grind nodes in the Barley Reach; with your vision you will see them when adjacent / within 2 hops"), the exact XP, gold and rarities, an option's full effect and refund, and the Reserve preview ("Unspent: N points = N × PREP_ECHO_PER_POINT Echoes, usable at hubs", on the points and on `Set out`). No reroll button while `GATES.campReroll` is off (2.2). Before D128 the screen had three columns: an 8-card board with reroll, nine supplies and perks, and an expedition column with slots and purchases.

### 9.2 Fog map
- The zone disc fills the map panel: hub in the centre, rings as faint circles, edges as paths, nodes as markers. Unseen nodes: dim marker with "?" and the ring's level range on hover. Seen nodes: type icon, level coloured against the player (as today), enemy count (BUG-QA-02), contract-site badge in the contract's colour.
- (D128, owner playtest 2026-11-12 20:19: "make the icons smaller on the map ... it's a bit cluttered".) Node markers are about 70 % of their earlier size. Text labels show only where the player acts: the player's node, the reachable nodes (level and tolls) and contract sites (level). Every other node shows its icon only, with its level as a small coloured pip; levels, enemy counts, level ranges and tolls of the rest are on hover. The Dimming's "dims in N" clock stays on the player's node and the reachable nodes; nodes farther out show a small clock mark (number on hover). No label overlaps another at 1366x768.
- Regions (when known): soft tint per wedge with the region name on the rim.
- Landmarks: Roads as signposts on the rim with the next zone's name; the Shardfall as a cracked star; the Dimming as a dark wash over Dimmed nodes, and on every node within 2 hops of the front a small mark "dims in N tolls". The player's node shows its own count prominently when N <= 2. (M2b v7)
- Legal moves highlight on hover with their tolls; a resolved node shows "walk 1 toll". Taking a Road and ringing the Bell are buttons on the map panel with their tolls and, for the Bell, charges left.
- Swift passage (7.1): the hub and every Road say "Swift passage: take a Road within 15 tolls for +¾ of a level" with the tolls left (`mapView.swift`: `left`, `xp`), greyed once passed (`left` null); the `swift` event gets a float and a log line. (M2b v15)

### 9.3 Contract tracker
The quest log (BRIEF HUD) becomes the contract tracker: one line per held contract: zone, kind, target, progress "1/2 sites", and state (active in this zone / later zone / complete / expired). Contracts of the current zone are pinned at the top-right under the minimap. Completing one shows the reward choice (as today's story reward).

### 9.4 Pacing terms (rules 3)
| Term | Constant | Seconds |
|---|---|---|
| Prep screen | PACE_PREP_S | 60 |
| Walk through a resolved node | PACE_DECIDE_S + PACE_TRAVEL_NODE_S | 8.5 per step |
| Hub contract decision | PACE_HUB_CONTRACT_S | 6 per hub |
| Bell channel animation | PACE_BELL_S | 6 |
| Dimmed encounter | as a normal fight | |

### 9.5 Fight and node budget with slower, weightier combat (owner 10:43)
The owner asked for animations at least 40 % slower and openings that need thought, Slay the Spire style [stated: docs/feedback/2026-11-10-1043-owner.md]; docs/specs/combat-v2.md (separate task, not yet written) owns the combat rules. This section plans the expedition's node and fight counts so a run still lands near 45 minutes.

Assumptions (to be replaced by combat-v2's measured values):
| Term | Constant | Value | Tag |
|---|---|---|---|
| Round on screen at default speed | PACE_ROUND_ANIM_S | 2.1 s (was 1.5) | [stated: +40 %] |
| Decision time, first rounds of a fight | PACE_OPENING_ROUNDS, PACE_OPENING_DECIDE_S | 4 rounds × 3.0 s | [assumption] |
| Decision time, later rounds | PACE_ROUND_DECIDE_S | 1.0 s (unchanged) | [assumption] |
| Pre-fight read of the enemies and plan | PACE_FIGHT_PLAN_S | 6 s per fight | [assumption] |
| Rounds per fight | B16 values | normal 6, elite 9, dungeon boss 13, end boss 46 (unchanged) | [assumption] |

So a normal fight takes about 36 s on screen (was 18 s), an elite 45 s (26 s), the end boss 160 s (135 s). With today's fight count (about 50 per run) the run would take about 64 minutes on today's map and about 65 on the expedition map [source: scratch model, 12.5].

Plan: about **36 fights per run instead of 50**, each worth more:
| Change (proposed rules.md values; rules.md not edited in this task) | From | To |
|---|---|---|
| Grind node: one wave (GRIND_MAX_WAVES) | 3 | 1 |
| Dungeon trash fights (DUNGEON_TRASH_FIGHTS) | 3 | 2 |
| Node hours: TIME_QUEST / TIME_ELITE / TIME_GRIND_WAVE / TIME_DUNGEON | 2 / 2 / 1 / 5 | 3 / 3 / 2 / 6 (M2b v10: dungeon 5, EXPED_TIME_DUNGEON) |
| XP per fight and per node: MOB_XP_FRAC, QUEST_TURNIN_XP_FRAC, GRIND_WAVE_XP_FRAC, DUNGEON_CLEAR_XP_FRAC, contract XP | × 1 | × XP_WEIGHT_MULT (1.6; M2b v10: 1.4) |
| Kill loot: item and junk chance of normal and dungeon-trash kills (rules 8.4) | × 1 | × EXPED_DROP_MULT 1.6 (M2b v11, D91); 1.9 (M2b v12, D100) |
| Dungeon boss rolls at a clear (rules 8.4) | DUNGEON_BOSS_DROPS 2 | EXPED_DUNGEON_BOSS_DROPS 3 (M2b v11, D92) |
| The Dimming: DIM_HOURS_PER_HOP | 3 | 2.5 |
| Cull sites in the target region: CULL_SITE_IN | 0.50 | 0.65 (fewer nodes per zone) |

Node hours rise with the fights' weight, so the in-game clock (Dimming, Ascendancy, BOSS_TIME_PAR) keeps its scale: about 22 hours per zone, 132 h per run in the model (today's map in the model: 124 h).

Budget per run (model, variant C, planner P0): 37 resolved nodes (about 6 per zone) and 6 walk-throughs, about 36 fights plus the boss; levels leaving zones 12 / 22 / 32 / 43 / 53 / 60; model 45.1 minutes, estimated **46-48 minutes** real (the calibration difference shrinks with fewer loot windows). Contract completion 46 % (P0) and 59 % (full-catalogue vision); C_step 0.69 / 0.91.

Cost: the shorter zones make the Dimming bite harder. The planner is caught in about 26 % of zones and Dimmed encounters are about a third of its expected non-boss deaths, above B43 (8-18 %, 5-20 %). Levers, in order: (1) keep DIM_HOURS_PER_HOP at 3 (planner caught about 21 %, about +2 minutes); (2) make a depth-0 Dimmed encounter a normal-strength fight and let only depth add danger; (3) a fifth fewer nodes per zone via ring 3 of 10 nodes instead of 12. The Sim Engineer measures (1) and (2) on the real engine first. If combat-v2 lowers rounds per fight, the budget gains about 3 s per removed round per fight (about 2 minutes per round removed).

## 10. Bots (balance.md 1)

### 10.1 Shared rule: bots read `mapView` only
No bot may read the zone state. The Sim Engineer adds a QA check that the planner's choices are identical when the hidden part of the zone is replaced by another draw (a leak test).

### 10.2 Map policies
| Bot | Prep | Map |
|---|---|---|
| random | random affordable purchases until no point can be spent | uniform over legal moves; Road when on one at 50 %; Bell at 10 % per decision when held |
| greedy | contracts by `reward value / price` (no completion estimate), then Field Draughts | best adjacent move by value per toll (balance 1.1, site value added, 10.3); **threat rule**: never step into a node that dims within 2 tolls of arrival unless leaving; when the front is within one hop: leave if `L >= 10z - 2` (Bell if held, else Road, else walk to the Road farthest from the Shardfall), otherwise retreat to the best neighbour farther from the Shardfall that does not dim within 2 tolls |
| planner | contracts by `estimated completion × reward value / price` from a running table of completion rate by (kind, vision profile, zone), refreshed every SIM_RISK_REFRESH runs; prior EST_COMPLETE; buys Tracker when its estimated gain in completion × reward beats its price in contract value; keeps Bell charges | **belief search**: depth PLANNER_FOG_DEPTH over moves; known nodes valued exactly; unknown nodes valued as the expectation over the region kind's weights (zone average if the region is unknown) with site chance CULL_SITE_IN / CULL_SITE_OUT (by region if known); the Dimming exactly (it is visible); leaf term = expected cost of reaching the cheapest Road (Dimmed encounters on the way) or the Bell channel; leaving valued with an under-level penalty |
| speedrunner | Delve contracts, Second Clapper, Field Draughts | belief search minimising tolls to `L >= 10z - 1`, then the nearest Road or the Bell |
| tactician | as planner | as planner (combat as today) |
| oracle (diagnostic only) | n/a | the planner's search with full information of the current zone; never acts in a measured run; used for B41 |

### 10.3 Site value in the value function
`siteValue = P(site) × (progress + 1 >= need ? contractValue : contractValue / need × SITE_PARTIAL_MULT)`, `contractValue = (XP levels of the reward × VAL_XP + rarity-weighted item score gain × VAL_GEAR + gold / V × VAL_GOLD)`. Holding a Bell charge is worth BELL_KEEP_VALUE value units until zone 6.

## 11. Balance targets (new, balance.md section 3; numbers in section 13)

### 11.1 Calculability (owner: "the best path is easy to compute")
Definitions, measured on planner runs with the oracle (10.2) evaluated at every map decision from the same state:
- **Step calculability** `C_step = (map decisions where the planner's choice equals the oracle's) / (map decisions)`.
- **Route predictability** `C_route` = share of zones where the planner's realised route (node sequence and exit) equals the route the oracle realises when played from the same zone-entry state on a copy.
- Diagnostic: information regret = oracle minus planner, in levels-equivalent, per zone.
Today both are 1.00 by construction (full map in view).

| ID | Pri | Metric | Target |
|---|---|---|---|
| B39 | P1 | Contract completion rate, planner P0 / planner PALL / greedy P0 | 45-65 % / 65-85 % / at least 8 pp under planner P0 |
| B40 | P1 | Plan matters: planner P0 win rate, planned prep minus prep "none" (all points to Reserve), paired seeds; and planned minus random prep | >= PLAN_GAIN_MIN pp; >= PLAN_VS_RANDOM_MIN pp |
| B41 | P1 | C_step planner P0 / PALL; C_route planner P0 / PALL | 0.60-0.80 / 0.80-0.92; <= 0.15 / <= 0.50 |
| B42 | P2 | Vision value: planner PALL minus planner PALL without the vision entries (scout, cartographer, old_hand): contract completion; win rate | >= 10 pp; inside B10 |
| B43 | P1 | Tension: zones with at least one Dimmed encounter, planner P0; Dimmed encounters' share of non-boss deaths, planner P0; zones where the front came within one hop, greedy P0 | 8-25 % (M2b v12, D102: was 8-18 %; owner O9); 5-20 %; 40-75 % |
| B44 | P2 | Threat bounds the zone: planner P0 zone tolls with the Dimming off, divided by with it on (diagnostic cell) | >= 1.5 |
| B45 | P2 | Walk-throughs (resolved nodes passed) per zone, planner P0 | <= 2.5 |
| B46 | P2 | Contract reward share of total XP, planner P0 | 8-20 % |
| B47 | P2 | Bell charges used per run, planner P0 (variant C) | 0.4-0.9 |

Existing targets that move: B11 (40-50 min) stays; B14 nodes per run 38-47 becomes 44-56 resolved nodes plus walk-throughs; B17 tolls band and BOSS_TIME_PAR are re-set from the first measure (zone tolls change); B20 zone exit levels stay (10z ± 1) and are now also a check that the Dimming leaves enough time.

## 12. Prototype estimate (scratch, not a measurement of the game)

### 12.1 What was built
A crude model in the git-ignored folder sim/out/expedition/ (model.mjs, run.mjs, sum.mjs): the disc graph of section 4, regions, sites, vision, the Dimming, the three exit variants, contracts and prep, and three map bots (the fog planner with depth-4 belief search, the greedy with the threat rule, and the full-information oracle), plus today's 7 × 3 map for the baseline.

Real engine numbers (imported from src/rules.js): xpToNext, diffMod, MOB_XP_FRAC, QUEST_TURNIN_XP_FRAC, GRIND_WAVE_XP_FRAC, ELITE_XP_MULT, DUNGEON_* XP, HOURS_*, the W_* weights for the baseline map, the bots' VAL_* weights and RISK_PRIOR.

Stand-ins (SI, stated in the code): no combat simulation; per-node HP loss (quest 0.30, grind 0.40, elite 0.45, dungeon 0.60 of max HP, +8 % per level above the player), post-node regen 0.20, three rations per zone; death chance per node = RISK_PRIOR × e^(0.35 × levels above) × 3 if under 40 % HP, counted as expected deaths, not sampled (runs never end early); Dimmed encounter death chance 0.08 × (1 + depth); gear as abstract points; XP scaled by 0.82 so the baseline planner leaves zones near the measured levels; real minutes from the rules 3 pacing terms with B16 round counts; contract XP of 1.0-2.5 levels and gear 0.6-1.3 points. Calibration: the baseline planner gives 42 nodes (measured 42), 42.5 model minutes (measured 46.2) and 125 h (measured 141); estimated real minutes below add the 3.7-minute difference.

### 12.2 Results (300 runs per row; planner unless marked)
| Variant (P0 = fresh profile) | Est. min | Hours | Resolved nodes + walks | Contract completion | Caught zones | Threat share of exp. deaths | C_step | C_route |
|---|---|---|---|---|---|---|---|---|
| Today's map, full view | 46 | 125 | 42 + 0 | 80 % | - | - | 1.00 | 1.00 |
| A Roads (3) | 49 | 144 | 51 + 10 | 56 % | 17 % | 20 % | 0.72 | 0.04 |
| A2 Roads (2) | 46 | 133 | 46 + 11 | 50 % | 35 % | 48 % | 0.72 | 0.06 |
| B Bell only | 46 | 132 | 49 + 6 | 55 % | 18 % | 22 % | 0.69 | 0.04 |
| **C Roads + Bell** | **48** | **142** | **50 + 9** | **56 %** | **15 %** | **17 %** | **0.72** | **0.04** |
| C, Dimming off | 84 | 329 | 91 + 123 | 90 % | - | - | 0.77 | 0.00 |
| C, full-catalogue vision (PALL) | 48 | 141 | 46 + 11 | 70 % | 14 % | 12 % | 0.93 | 0.47 |
| C greedy P0 | 44 | 127 | 42 + 11 | 42 % | 19 % | 35 % | | |
| B greedy P0 | 38 | 101 | 35 + 4 | 38 % | 16 % | 18 % | | |

Threat sweep (variant C, planner P0, 200 runs): grace 6 h / 3 h per hop gives 44.3 model minutes and 15 % caught; 6 / 2.5 gives 41.7 and 23 %; 8 / 3 gives 46.4 and 12 %. With a Dimmed death chance of 0.05 instead of 0.08 the planner accepts more Dimmed encounters (20-28 % caught) because they are cheap; the encounter must hurt for the front to shape routes.

Prep (variant C, planner P0): contracts planned vs random vs none: gear 15.8 / 16.5 / 13.9 points, zone exit levels about +0.4 with contracts. Tracker (2 points) raises completion from 56 % to 77 %; Region Charts (1 point) to 61 %.

### 12.3 What the prototype shows
1. The roaming map needs the Dimming: without it the planner wanders (123 walk-throughs, 84 minutes). With it, a zone takes about 23-24 hours and the run lands near 48 minutes; the threat speed is the main time lever.
2. The map stops being calculable at a fresh profile: the planner's move matches the full-information move 72 % of the time and its zone route only 4 % of the time (today: 100 %), so the owner's "partly chance" holds. Contract completion falls from 80 % to 56 %.
3. Vision buys it back in two different ways: the Tracker buys steering (completion 56 % -> 77 %, calculability unchanged), the radius buys calculability (0.72 -> 0.92). Radius 3 restores today's problem (1.00), hence the cap at 2 and Pathfinder as type-only.
4. Variant C is the best Roads variant on safety and keeps the tension that B loses (section 7.3).
5. Honest gap: in the model, choosing contracts well beats choosing them at random by nothing (16.5 vs 15.8 gear points), because the model's contracts differ only in price and reward. Whether the plan "heavily shapes the run" [stated] depends on what the real engine adds: class fit (families and archetypes), risk of Bounties, and the vision/safety purchases competing for the same points. B40 measures it; if planned prep beats "none" by less than PLAN_GAIN_MIN, raise contract rewards first (CULL_XP_FRAC, epic weight), then make kinds differ more.
6. The greedy bot suffers from the Dimming (a third of its expected non-boss deaths). The UI clocks (9.2) and the threat rule (10.2) are required, not optional.

### 12.5 With the slower combat (owner 10:43; 200 runs, planner unless marked)
Pacing assumptions of 9.5. "Weightier" = one Grind wave, two dungeon trash fights, node hours 3/3/2/6, XP × 1.6.
| Setup | Model min | Hours | Nodes + walks | Completion | Caught | C_step |
|---|---|---|---|---|---|---|
| Today's map, slower combat, today's nodes | 60.7 | 124 | 42 + 0 | 81 % | - | 1.00 |
| C, slower combat, today's nodes | 61.0 | 141 | 50 + 9 | 57 % | 15 % | 0.72 |
| C, weightier, Dimming 6 h / 3 h per hop | 46.8 | 140 | 39 + 7 | 42 % | 21 % | 0.69 |
| **C, weightier, 6 h / 2.5 h, CULL_SITE_IN 0.65** | **45.1** | **132** | **37 + 6** | **46 %** | **26 %** | **0.69** |
| same, full-catalogue vision | 46.3 | 131 | 34 + 7 | 59 % | 24 % | 0.91 |
| same, greedy P0 | 44.9 | 128 | 33 + 7 | 37 % | 38 % | |
| B Bell only, weightier, 5 h / 2.5 h | 39.6 | 113 | 32 + 3 | 39 % | 23 % | 0.66 |

Reproduce: `PACEV2=1 SHAPEV2=1 XPS=1.3 OVR='{"dimGraceH":6,"dimHoursPerHop":2.5,"pIn":0.65}' node run.mjs 200 both_P0 both_PALL | node sum.mjs` (XPS 1.3 = the model's 0.82 calibration × 1.6).

### 12.4 Reproduce
`cd sim/out/expedition && node run.mjs 300 rows_today rim_P0 recall_P0 both_P0 both_PALL | node sum.mjs`; threat sweeps with `OVR='{"dimGraceH":6,"dimHoursPerHop":3,"dimP":0.08}' node run.mjs 200 both_P0`. The folder is git-ignored; the Sim Engineer rebuilds the measurement on the real engine (handoff designer-2026-11-10c).

## H. Heat: time pressure on one meter (addendum 2026-11-10)

Source: owner feedback [stated: docs/feedback/2026-11-10-1405-owner.md]: he did not know about in-game hours and Ascendancy until his run summary (148 h, par 120, boss +8 % [source: docs/feedback/2026-11-10-1353-owner.md]); he wants an always-visible heat meter like FTL's chasing line, and a real choice: go into heat deliberately to gain extra, or stay ahead because a hard stretch comes later. Section H works in today's rows mode (H.1-H.4) so the UI can ship the meter before the expedition switch; H.5 adds the Dimming for expedition runs. Constants: section 13, block "Heat".

### H.1 The line and the player's heat
The **line** is the par schedule: each zone's share of the boss par.
`line(z) = ceil(par(oaths) × min(z, ZONE_COUNT) / ZONE_COUNT)`, whole tolls, z = the current zone (the Camp counts as ZONE_COUNT). With BOSS_TIME_PAR 120 and six zones the line is 20 tolls per zone: 20, 40, ... 120. `par` is rules 1.7's par (Oath of Haste lowers it to 100: line 17, 34, 50, 67, 84, 100). (M2b v7: rounded up, rules 1.7.1; no state or projected Ascendancy changes)
`heat = time - line(z)` (run tolls, rules 1.7), a whole number. Negative heat is tolls in hand; positive heat is tolls past the line.
- On entering a zone the line jumps 20 tolls ahead, so a player who left the last zone on time starts each zone with 20 tolls in hand, and the line closes in as the zone is played. Time saved in one zone carries into the next; time lost carries too. This is the chasing line.
- At the Camp the line is the par itself, so `heat` at FIGHT_BOSS is exactly the over-par tolls that rules 1.7 turns into Ascendancy. Ascendancy's formula is unchanged.
- **Projected Ascendancy** (what the meter promises): `ascIfPar = min(ASC_CAP, ASC_PER_STEP × floor(max(0, heat) / ASC_STEP_TIME))`, the boss Ascendancy if the player leaves this zone now and plays every later zone in exactly its line share. It is an honest floor: staying longer only raises it.

### H.2 States
| State (shown as, M2b v7) | Run heat (tolls past the line) | Meaning at the boss if par is kept from here | Reward (H.3) |
|---|---|---|---|
| Clear (Calm) | heat < HEAT_WARM_AT (0) | under par: no Ascendancy, ECHO_SPEED_BONUS in reach | none |
| Warm (Smouldering) | HEAT_WARM_AT <= heat < HEAT_HOT_AT (0-10 tolls) | speed bonus lost, no Ascendancy yet | none (a warning) |
| Hot (Burning) | HEAT_HOT_AT <= heat < HEAT_SCORCH_AT (10-30 tolls) | Ascendancy +2 % to +4 % (M2b v6: ASC_PER_STEP 0.02; was +4 % to +8 %) | HEAT_GAIN.hot, HEAT_RARITY_UP.hot |
| Scorched (Infernal) | heat >= HEAT_SCORCH_AT (30 tolls or more) | Ascendancy +6 % or more (cap ASC_CAP) (M2b v6: was +12 % or more) | HEAT_GAIN.scorched, HEAT_RARITY_UP.scorched |

HEAT_HOT_AT equals ASC_STEP_TIME on purpose: Hot starts where Ascendancy starts to cost, so heat pays only where it is paid for. Warm pays nothing because it costs nothing at the boss except the speed bonus; the prototype showed that paying in Warm is free power (H.7). The owner's run (148 tolls) ends Hot at +28; the planner P0 median (141 tolls) ends Hot at +21 [source: docs/reports/balance-2026-11-10c.md B17].

### H.3 What heat gives
The node's **heat state is fixed when the player enters the node** (rows: CHOOSE_NODE; expedition: MOVE into an unresolved node) and applies to everything the node pays, so the hover preview and the result agree. Hub services, walks and travel pay nothing.
- **XP and gold**: every XP and gold gain of the node (kills, quest turn-in, grind wave, dungeon clear, treasure gold, contract reward when completed in it) × (1 + HEAT_GAIN[state]), after every other modifier (rested, meta).
- **Better drops**: every item rolled on a drop table in the node (kill drops, elite and dungeon boss drops, treasure, quest and contract reward choices; not vendor stock) draws once more on its loot stream after the rarity draw: below HEAT_RARITY_UP[state] the rarity is one step higher (common -> uncommon -> rare -> epic; epic stays). The draw is always made, also in Clear, so the stream does not depend on heat (QA goldens move once, when this lands).
- **Echoes**: new rules 11.1 line "Fights won in heat": ECHO_PER_HEAT_FIGHT per fight won in a Hot or Scorched node [assumption: not prototyped; about 10-20 Echoes on a 235-Echo planner run, the Sim Engineer checks B31].
- **Not paid**: the Camp (its waves are repeatable; heat there would be a farm), the boss, Dimmed encounters (H.5), and nodes in the Dimming.

What it costs: the tolls themselves, which become Ascendancy at the boss (unchanged rules 1.7), and the lost ECHO_SPEED_BONUS. No new penalty is added: the meter makes the existing cost visible and prices a reward against it.

The choice this creates: run Hot through the middle zones for more levels-worth, gold and rare/epic gear, and meet a stronger boss; or stay Clear and bank tolls for a dungeon or a bad zone later, and meet a weaker boss with less gear.

### H.4 UI: the Furnace (always visible, rows mode and expedition) (M2b v7)
The owner asked for heat to have its own name, for a small whole-number time unit in place of hours, and for the meter to sit at the top centre as a central part of the game [stated: docs/feedback/2026-11-11-1012-owner.md]. The meter is called **the Furnace**; time is counted in **tolls**.
- Place: top centre of the HUD on every screen of the run except PREP and SUMMARY (map, node, fight, hub, Camp, boss intro), always in view, never covered by a window.
- Look: a central horizontal bar with a pointer that moves along it. The left (cool) end is a very calm setting; the right (hot) end looks like the core of hell. The four segments carry the player names Calm, Smouldering, Burning and Infernal (engine states Clear, Warm, Hot, Scorched). The Star's line is a mark at heat 0; the pointer sits at `heat`; the bar spans HEAT_BAR_MIN to HEAT_BAR_MAX tolls (clamped, the pointer shows an arrow when beyond).
- Text: the state name; "12 tolls in hand", "On the line" (heat 0) or "8 tolls past the line" ("1 toll" in the singular); "Boss +4 %" (ascIfPar); in Burning and Infernal the live reward "+35 % XP and gold, 1 in 2 drops a rarity up" (Infernal "+50 % XP and gold, 7 in 10 drops a rarity up").
- Tooltip: "Tolls so far: 47 · the Star's line: 60"; "Oruvath grows stronger for every 10 tolls past 120 (Ascendancy)."
- On hover over a node (map) or a service: the tolls it costs and the state after it ("3 tolls, ends Smouldering"). A choice that would move the player into a new state shows the new state's colour on its toll label.
- A state change shows a short toast once: Calm "Calm: you are ahead of the Star." Smouldering "Smouldering: past the Star's line; the speed bonus is lost." Burning "Burning: the Unlit Star gains on you; spoils grow." Infernal "Infernal: the Star burns high; spoils are richest."
- SUMMARY: the tolls-vs-line track of the whole run as a small chart, the tolls spent in each state and the Echo line of H.3; "Tolls: 141 (par 120) · Ascendancy +4 %".
- Wording rules: the meter is "the Furnace"; the unit is "toll" / "tolls", always written out and always a whole number. No "h", "hours", days, clock times ("Day 2, 14:00") or decimals anywhere on screen; the day clock is removed. The words Ascendancy and par stay in tooltips only; the line is "the Star's line".

### H.5 Expedition runs: the Dimming on the same meter
In an expedition zone a second clock runs: the tolls until the player's node dims, `dimIn = dimAt(node) - zt` (rules 1.9.6: `dimAt = DIM_GRACE + ceil(hops × DIM_FRONT_TIME / DIM_FRONT_HOPS)`). (M2b v7)
| Dimming state | Condition |
|---|---|
| Clear (Calm) | dimIn > HEAT_DIM_WARM (4 tolls) |
| Warm (Smouldering) | HEAT_DIM_HOT < dimIn <= HEAT_DIM_WARM (3-4 tolls) |
| Hot (Burning) | 0 < dimIn <= HEAT_DIM_HOT (1-2 tolls) |
| Scorched (Infernal) | the node is Dimmed |

The meter's state is the **hotter** of the run state (H.2) and the Dimming state; the meter shows the Dimming as a second marker ("Dimming: 3 tolls") and names which clock sets the state. Rewards (H.3) use the combined state at node entry, so a node at the Dimming's edge pays as Hot: the reward for working near the dark. A Dimmed node pays nothing (its content is lost; Dimmed encounters keep DIM_XP_MULT and no loot). Contracts completed in a Hot node pay their reward × (1 + HEAT_GAIN.hot), which is the contract bonus for running hot.

### H.6 Engine, bots and balance targets
Engine (Core Gameplay Engineer): `heatView(s)` = { time, line, heat, stateRun, dimIn (expedition, else null), stateDim, state, ascIfPar, gain, rarityUp }, pure and cheap, usable by the UI at any phase; the node's entry state stored on the node and in the fight record; summary adds `heat` = { trackPerZone: [tolls at entry and exit, line], fightsByState: [4], echoHeat }. The UI's meter (H.4) may ship before the rewards: `heatView` without H.3 is display-only and changes no balance.

Bots (Simulation & Balance Engineer): the value function adds the heat multiplier to the XP, gold and gear terms of a node from the state it would be entered in. Two policies for B58: **heat-seek** = planner with time weight × HEAT_SEEK_TIME_MULT; **heat-avoid** = planner with time weight × HEAT_AVOID_TIME_MULT (both instead of PLANNER_TIME_MULT). Every policy also pays the boss term (balance-2026-11-11: change of projected Ascendancy × SIM.VAL_ASC). With PLANNER_TIME_MULT 3 (balance.md 6, M2b v6) the default planner plays on the time-light side: on the v6 rules it enters no Hot node and wins like heat-avoid (34.8 % against 34.3 %, paired, 1 000 runs per class). (M2b v6) Greedy and autoplay keep their rules; the greedy's threat rule (10.2) treats Dimming-Hot nodes as today.

| ID | Pri | Metric | Target |
|---|---|---|---|
| B58 | P1 | Heat is a real option: win rate heat-seek minus heat-avoid, planner P0, all classes pooled, paired seeds | within ±HEAT_POLICY_GAP_MAX pp |
| B56 | P2 | Heat is used, not forced (M2b v6, redefined): (a) heat-seek minus planner win rate, planner P0, paired; (b) share of heat-seek's winning P0 runs with at least one Hot or Scorched node. Diagnostic, no target: the same share for the default planner (the old B56) | (a) >= -HEAT_POLICY_GAP_MAX pp; (b) HEAT_WIN_SHARE |
| B57 | P2 | Heat rewards do not inflate power: planner P0 win rate with H.3 minus without | <= HEAT_POWER_MAX pp |

Why B56 changed (M2b v6): the old B56 measured the default planner's own time weight. At PLANNER_TIME_MULT 3 that planner sits at the time-light end and never enters Hot, even with HEAT_RARITY_UP and HEAT_GAIN doubled [measured: designer scratch, 300 runs per class], while heat-seek wins as often (+1.2 pp). Rewards large enough to pull it into Hot would put heat-seek more than 5 pp ahead of heat-avoid (B58). B56 now asks what the owner asked for: a player who goes into heat on purpose wins as often as the default planner (a), and that player really uses heat without being forced to run Hot every time (b). [owner review]

If B58 fails with avoid ahead, raise HEAT_RARITY_UP first (gear is what wins the boss; XP is capped at level 60), then HEAT_GAIN; with seek ahead, lower them. If B57 fails, lower HEAT_GAIN before the rarity step. Expedition: re-measure B43 with H.5, since a reward at the Dimming's edge pulls the planner toward it; lever HEAT_DIM_HOT.

### H.7 Prototype (scratch, rows mode; not a measurement of the game)
A scratch copy of src/ and sim/ at commit 5f67d5e in the git-ignored sim/out/heat/ with H.1-H.3 patched into the engine (XP and gold multiplier and the rarity draw, state taken at each gain rather than at node entry; no Echo line) and PLANNER_TIME_MULT set per cell; the planner does not yet value the heat reward (so heat-seek is approximated by a low hour weight). Planner P0, 300 runs per class, warm-up 300, same seeds per cell.

| Cell | Win | Reach boss | Hours at boss (median) | Asc | Gear score | Rarity steps per run |
|---|---|---|---|---|---|---|
| No heat, hour weight 2 (today's planner) | 40.7 % | 76.0 % | 140 | 0.08 | 583 | 0 |
| No heat, weight 0.5 (slow) | 32.0 % | 77.0 % | 145 | 0.08 | 588 | 0 |
| No heat, weight 4 (fast) | 46.9 % | 66.1 % | 115 | 0 | 579 | 0 |
| **Heat (defaults: Hot/Scorched only), weight 2** | **44.0 %** | 76.0 % | 139 | 0.04 | 588 | 2.5 |
| **Heat defaults, seek (0.5)** | **42.9 %** | 76.4 % | 144 | 0.08 | 599 | 4.4 |
| **Heat defaults, avoid (4)** | **46.9 %** | 66.1 % | 115 | 0 | 579 | 0 |
| Heat paid from Warm (+15/35/50 %, 10/25/40 %), weight 2 | 49.7 % | 79.6 % | 138 | 0.04 | 592 | 5.2 |
| same, seek / avoid | 46.3 % / 47.6 % | 78.0 / 66.3 % | 144 / 116 | | 603 / 579 | 7.1 / 0.1 |
| Weaker (+10/25/40 %, 5/15/25 % from Warm), seek / avoid | 39.7 % / 47.0 % | 78.4 / 66.1 % | 144 / 116 | | 598 / 579 | 4.1 / 0 |

Findings:
1. With the defaults the choice is real: heat-seek 42.9 % against heat-avoid 46.9 % (B58: 4.0 pp, inside 5; the standard error of the difference is about 2.3 pp), and the two win differently: seek reaches the boss more often (76 % against 66 %) with better gear (599 against 579) and a +8 % boss; avoid dies more on the journey and meets a +0 % boss. Without heat the slow style is 15 pp behind the fast one; heat closes 11 pp of that.
2. B56: 81 % of the default planner's wins had a Hot node (band 30-85 %); 47 / 41 / 12 / 0 % of its XP events were Clear / Warm / Hot / Scorched. Scorched is not reached by any planner in rows mode; it is the meter's danger zone, not a target.
3. B57: the defaults raise today's planner by 3.3 pp (40.7 -> 44.0 %). Paying from Warm raised it by 9 pp and is rejected: Warm costs nothing at the boss.
4. Side finding for the Sim Engineer [inference: from the no-heat cells]: the planner with hour weight 4 wins 6 pp more than with today's PLANNER_TIME_MULT 2 (46.9 against 40.7 %) while reaching the boss 10 pp less often, so today's planner undervalues time against Ascendancy. Worth a check before B58 is measured on the real policy.

Reproduce: `cd sim/out/heat && HEATP='{"gain":[0,0,0.35,0.5],"up":[0,0,0.25,0.4]}' HM=0.5 node sim/run.mjs --bot planner --class all --runs 300 --profile fresh --warmup 300 --out o/seek3 && node sum.mjs o/seek3/planner-P0` (HEAT=0 turns the patch off; HM sets the hour weight).

## 13. Constant table (starting values)

| Constant | Value | Unit |
|---|---|---|
| PREP_POINTS | 10 | points |
| PREP_POINTS_PER_QM | 2 | points per Quartermaster rank |
| PREP_ECHO_PER_POINT | 2 | Echoes per Reserve point at SUMMARY |
| CONTRACT_BOARD_SIZE | 3 | contracts (D128: was 8; CONTRACT_BOARD_EXTRA 2 retired) |
| CONTRACT_BOARD_BANDS | [[1,2],[3,4],[5,6]] | zone band of each board slot (D132; only with `GATES.boardAcrossRun`, on; off: zones 1, 2, 3) |
| CONTRACT_SLOTS | 4 | contracts held |
| REROLL_PRICE | 1 | points (only with `GATES.campReroll`, off since D128) |
| REROLL_MAX | 2 | rerolls (only with `GATES.campReroll`, off since D128) |
| PREP_CAMP_OPTIONS | prep_draughts, prep_ember, prep_charts, prep_tracker | options offered at the start camp (D128; the other five stay in the engine, not offered) |
| CW_CULL / CW_BOUNTY / CW_DELVE | 55 / 25 / 20 | weight |
| CONTRACT.cull.price / bounty / delve | 2 / 3 / 2 | points (M2b v10: delve 1 -> 2; M2b v11: back to 1, D93; M2b v12: 2 again, D100, the D93 guard) |
| CULL_SITES | 2 | sites |
| CULL_SITE_SPARE | 1 | extra sites guaranteed |
| CULL_SITE_IN | 0.65 | probability per eligible node in the target region (0.50 with today's node counts, 9.5) |
| CULL_SITE_OUT | 0.08 | probability per eligible node elsewhere |
| BOUNTY_PLACED | 2 | nodes |
| CONTRACT_CL_OFFSET | 8 | levels above the band start (CL_c = 10(z-1) + 8; M2b v10: was 5) |
| CULL_XP_FRAC / BOUNTY_XP_FRAC / DELVE_XP_FRAC | 2.0 / 2.5 / 1.5 | of xpToNext(CL_c) (M2b v10: delve was 1.0) |
| CULL_GOLD_V / BOUNTY_GOLD_V / DELVE_GOLD_V | 4 / 6 / 2 | × V(CL_c) |
| CONTRACT_REWARD_CHOICES | 3 | items |
| DELVE_REWARD_CHOICES | 2 | items |
| CONTRACT_RARE_W / CONTRACT_EPIC_W | 65 / 35 | weight (M2b v10: was 80 / 20) |
| BOUNTY_RARE_W / BOUNTY_EPIC_W | 40 / 60 | weight (M2b v10: was 60 / 40) |
| ECHO_CONTRACT_MULT | 3 | × ECHO_PER_QUEST per contract completed |
| PRICE_PREP_DRAUGHTS / PREP_DRAUGHT_COUNT | 1 / 2 | points / items |
| PRICE_PREP_RATIONS / PREP_RATION_COUNT | 1 / 3 | points / items |
| PRICE_PREP_EMBER | 4 | points |
| PRICE_PREP_BELL | 2 | points |
| PRICE_PREP_MULE / PREP_MULE_SLOTS | 1 / 4 | points / slots |
| PRICE_CHARTS | 1 | points |
| PRICE_TRACKER | 2 | points |
| PRICE_GUIDE | 3 | points |
| PRICE_SPYGLASS / SPYGLASS_CHARGES | 1 / 3 | points / uses |
| VISION_RADIUS | 1 | hops (full vision, P0) |
| VISION_RADIUS_MAX | 2 | hops |
| GUIDE_RADIUS_BONUS | 1 | hops |
| TRACKER_RADIUS | 2 | hops |
| PATHFINDER_RADIUS | 2 | hops (type only) |
| TIME_ASK_LOCALS | 1 | tolls |
| RING_NODES | [1, 6, 12, 12] | nodes per ring (0 = hub) |
| RING_CL_BASE | [0, 1, 4, 7] | levels above the band minimum |
| RING_CL_SPREAD | 3 | levels |
| EDGE_KEEP_R1 / EDGE_KEEP_R2 / EDGE_KEEP_R3 | 0.80 / 0.70 / 0.65 | probability |
| EDGE_DIAG_R23 | 0.35 | probability |
| REGION_COUNT | 4 | regions per zone |
| REGION_W.kind.type | table 4.4 | weight |
| REGION_FAMILY_SHARE | 0.70 | share of encounter mobs from the region's families |
| TIME_WALK | 1 | tolls |
| ROAD_COUNT | 3 | Roads per zone |
| DIM_GRACE | 6 | zone tolls |
| DIM_FRONT_HOPS / DIM_FRONT_TIME | 2 / 5 | hops per zone tolls: 2.5 tolls per hop in whole tolls (M2b v7: was DIM_HOURS_PER_HOP 2.5; 3 with today's node counts, 9.5) |
| DIM_PACK_SIZE | 2 | mobs |
| DIM_LEVEL_PER_DEPTH | 2 | levels per hop of depth |
| DIM_HP_MULT / DIM_DMG_MULT | 1.2 / 1.3 | × (tuned to about 8 % death chance at depth 0 for the planner P0, prototype SI) |
| DIM_XP_MULT | 0.25 | × normal kill XP |
| TIME_DIM_FIGHT | 2 | tolls (M2b v11, D94: was 1; arm 1 with DIM_DMG_MULT 1.6); every Dimmed encounter but an escape (6.3) |
| TIME_DIM_ESCAPE | 1 | tolls of a Dimmed encounter after a MOVE farther from the Shardfall (6.3; rules 1.9.6; M2b v12, D101) |
| BELL_START_CHARGES | 1 | charges per run |
| BELL_MAX_CHARGES | 2 | charges |
| BELL_CHANNEL_TIME | 2 | tolls |
| ROAD_SWIFT_TOLLS | 15 | tolls of zone time (7.1; M2b v15, D124; switch `GATES.swiftRoad` off since D126) |
| ROAD_SWIFT_XP_FRAC | 0.75 | × xpToNext(L) (7.1; M2b v15, D124) |
| META_COST_CARTOGRAPHER | 100 | Echoes |
| META_COST_OLD_HAND | 150 | Echoes |
| META_COST_QM_1 / META_COST_QM_2 | 120 / 200 | Echoes |
| PACE_PREP_S | 60 | s |
| PACE_HUB_CONTRACT_S | 6 | s per hub |
| PACE_BELL_S | 6 | s |
| PACE_ROUND_ANIM_S | 2.1 | s per round (owner 10:43; rules.md value 1.5 until combat-v2) |
| PACE_OPENING_ROUNDS | 4 | rounds [assumption] |
| PACE_OPENING_DECIDE_S | 3.0 | s per opening round [assumption] |
| PACE_FIGHT_PLAN_S | 6 | s per fight [assumption] |
| XP_WEIGHT_MULT | 1.4 | × XP per fight and node and of contracts (9.5; rules 1.9.8; M2b v10: was 1.6; the sim's arm 1.5) |
| EXPED_TIME_DUNGEON | 5 | tolls of a Dungeon node (9.5; rules 1.9.8; M2b v10: was 6) |
| EXPED_DROP_MULT | 1.9 | × item and junk chance of normal and dungeon-trash kills, expedition runs (9.5; rules 1.9.8, 8.4; M2b v11, D91; M2b v12, D100: was 1.6, v11's cell 10) |
| EXPED_DUNGEON_BOSS_DROPS | 3 | rolls on "Dungeon boss" at a dungeon clear, expedition runs (rules 1.9.8, 8.4; M2b v11, D92) |
| PLANNER_FOG_DEPTH | 4 | moves (bots) |
| SITE_PARTIAL_MULT | 0.8 | × (bots) |
| BELL_KEEP_VALUE | 80 | value units (bots) |
| EST_COMPLETE cull / bounty / delve | 0.55 / 0.50 / 0.90 | prior completion (bots) |
| PLAN_GAIN_MIN | 3 | pp win rate (B40) |
| PLAN_VS_RANDOM_MIN | 2 | pp win rate (B40) |
| C_STEP_P0 / C_STEP_PALL | 0.60-0.80 / 0.80-0.92 | share (B41) |
| C_ROUTE_P0_MAX / C_ROUTE_PALL_MAX | 0.15 / 0.50 | share (B41) |
| CAUGHT_ZONES | 0.08-0.25 | share (B43; M2b v12, D102: was 0.08-0.18; owner O9) |
| DIM_DEATH_SHARE | 0.05-0.20 | share (B43) |
| CLOSE_CALL_GREEDY | 0.40-0.75 | share (B43) |
| THREAT_BOUND_MIN | 1.5 | × (B44) |
| WALKS_PER_ZONE_MAX | 2.5 | steps (B45) |
| CONTRACT_XP_SHARE | 0.08-0.20 | share (B46) |
| BELL_USE | 0.4-0.9 | charges per run (B47) |
| **Heat (section H)** | | |
| HEAT_LINE_PER_ZONE | par / ZONE_COUNT, rounded up per zone total (20 at par 120) | tolls of line per zone (derived, H.1) (M2b v7) |
| HEAT_WARM_AT | 0 | tolls past the line (H.2) |
| HEAT_HOT_AT | 10 | tolls past the line (= ASC_STEP_TIME) |
| HEAT_SCORCH_AT | 30 | tolls past the line |
| HEAT_DIM_WARM / HEAT_DIM_HOT | 4 / 2 | tolls until the player's node dims (H.5) |
| HEAT_GAIN clear / warm / hot / scorched | 0 / 0 / 0.35 / 0.50 | × extra XP and gold (H.3) |
| HEAT_RARITY_UP clear / warm / hot / scorched | 0 / 0 / 0.50 / 0.70 | chance per rolled item of one rarity step (H.3) (M2b v6: was 0 / 0 / 0.25 / 0.40) |
| ECHO_PER_HEAT_FIGHT | 1 | Echoes per fight won in a Hot or Scorched node [assumption] |
| HEAT_BAR_MIN / HEAT_BAR_MAX | -20 / 40 | tolls shown on the meter (H.4) |
| HEAT_SEEK_TIME_MULT / HEAT_AVOID_TIME_MULT | 0.5 / 4 | × VAL_TIME (bots, B58) |
| HEAT_POLICY_GAP_MAX | 5 | pp (B58) |
| HEAT_WIN_SHARE | 0.30-0.85 | share of heat-seek's P0 wins (B56 b) (M2b v6: was of the default planner's wins) |
| HEAT_POWER_MAX | 4 | pp (B57) |

Retired from rules.md 13: ZONE_CHOICE_ROWS, LANES, DUNGEON_ROW_MIN/MAX, REST_ROW_MIN/MAX, TRAINER_ROW_MIN/MAX, MAX_SAME_TYPE_PER_ROW, W_* (kept only as the zone-average fallback), TRAVEL_EARLY_LEVELS, STORY_QUESTS, STORY_XP_FRAC, STORY_REWARD_CHOICES.
