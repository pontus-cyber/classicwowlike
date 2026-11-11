# Task 2b.5 (engine part): start camp and contracts, 2026-11-11 (Core Gameplay Engineer)

Task: docs/MILESTONES.md 2b.5, engine part. Spec: docs/specs/expedition.md sections 2 and 3, plus the parts of 1, 5.2,
8.1 and 9.4 they need. The new rules sit behind `mapMode: 'expedition'` and a new newRun option, `prep: true` (section 3
below). Status: draft, as the spec.

## 1. What changed
| Part | Change | Where |
|---|---|---|
| PREP (2.1-2.6) | START_RUN of an expedition run with `prep: true` opens phase PREP. It has no zone, and `mapView` and `heatView` are null. Points = PREP_POINTS + PREP_POINTS_PER_QM × Quartermaster ranks. The board is drawn on stream `prep(k)`. REROLL_BOARD redraws the slots not taken from `prep(k + 1)`. Supplies and vision perks can each be bought once. TAKE_CONTRACT / DROP_CONTRACT, BUY_PREP / SELL_PREP refund the price; rerolls are not refunded. At most CONTRACT_SLOTS contracts are held. SET_OUT applies the purchases (bag items, Bell charge, Pack Mule slots, Region Charts, Tracker's Notes, Local Guide, Spyglass charges), turns the points left into Reserve, then enters zone 1. `prepView` gives the screen's data | new src/engine/contracts.js; src/engine/nodes.js (`startRun`, `setOut`), actions.js, src/rng.js (`STREAM.prep`, `STREAM.hubc`), items.js (`bagCapacity` + mule) |
| Contracts (3.1-3.5) | Sites are placed when a zone is generated, on the zone's `map(z)` stream continued after the node types (`zone.siteRng`). Cull: per-node draws, a top-up to CULL_SITES + CULL_SITE_SPARE, and a family repair that keeps rules 7.14. Bounty: BOUNTY_PLACED Elite nodes with the bounty's rare. Delve: the Dungeon, which the map then shows. A site counts when its node is won. The last site pays at once: XP `eventXp(xpFrac × XP_WEIGHT_MULT, CL_c)`, gold `goldV × V(CL_c)`, and an item choice on the new tables `contract` / `bounty`, offered after the node's own rewards. The node's heat applies. Leaving a zone expires its held contracts. The story chain is retired in runs with the start camp | contracts.js (`placeSites`, `siteWon`, `expireContracts`), nodes.js (`enterZone`, `finishFight`, `leaveZone`), constants.js (`CONTRACT`, `DROP_TABLE.contract` / `.bounty`) |
| Hub contract (3.6) | Zones 2-6 offer one contract on stream `hubc(z)`. TAKE_HUB_CONTRACT `reserve` pays from Reserve and needs a free slot. `swap` abandons a held contract (`contractId`): no refund, its progress is lost. The offer is only open before the zone's first LEAVE_HUB. Its sites are placed at once | contracts.js, actions.js (LEAVE_HUB sets `zone.leftHub`) |
| Vision (2.4, 5.2) | USE_SPYGLASS(nodeId) costs 0 tolls and shows the node and its neighbours fully. `mapView` node `sites` holds held contracts' marks on full nodes, and with Tracker's Notes on any node within TRACKER_RADIUS hops. `mapView.spyglass` gives the charges left. Meta Cartographer and Old Hand mean the perk is owned | expedition.js (`siteView`, `knowledge`, `expMapView`) |
| Views | `prepView(state)` and `contractView(state)`. The tracker gives status active / later / complete / expired / abandoned and the hub offer with its legal modes. It never names a site's node | src/rules.js; engine-api.md 13 |
| Summary, Echoes, pacing | `summary.expedition.contracts` = { taken, completed, expired, abandoned, held, bought, reserve }. New Echo lines `contracts` (× ECHO_PER_QUEST × ECHO_CONTRACT_MULT) and `reserve` (× PREP_ECHO_PER_POINT). `minutes` adds PACE_PREP_S once and PACE_HUB_CONTRACT_S per hub with an offer | summary.js, meta.js |
| Autoplay | The default start camp: Field Draughts, then one contract per zone for zones 1-3 in board order, keeping 2 points as Reserve, then SET_OUT. At a hub it takes the contract from Reserve when it can | autoplay.js (`prepPolicy`, `hubPolicy`), `C.ENGINE_ASSUMPTION.AUTO_PREP_ZONES` / `AUTO_PREP_RESERVE` |
| Dev tools | `debug.build({ prep: true })` sets out with nothing bought, so every point is Reserve. `validate` accepts PREP | debug.js |
| Constants | Every expedition.md 13 constant of sections 2-3, plus `PREP_OPTION`, `CONTRACT`, `CONTRACT_KINDS`, `META_EXPEDITION` | src/constants.js |
| Docs | engine-api.md: status line, `newRun` `prep`, functions, phase PREP, actions, events `prep` / `contract` / `spyglass`, state, mapView, summary, streams, new section 13 (rules as played, views, defaults). expedition.md: status line. ARCHITECTURE: contracts.js row and the changed rows | docs/ |

## 2. Checks
| Check | Result |
|---|---|
| qa/engine | **377/377** (359 before, plus 18 in the new s01d-prep-contracts) |
| s01d | Checks the constants against expedition.md 13. It replays the board draws (`prep(k)`), rerolls (`prep(k+1)`), Cull sites (map(z) continued) and the hub offer (`hubc(z)`) from the documented draw order. It also covers points with Quartermaster, slots, refunds, options bought once and owned perks, SET_OUT effects, Bounty and Delve sites, a played Cull to completion (XP, gold and choices exact), expiry, the hub contract by reserve and swap, the Spyglass, Tracker marks (shown and hidden), contractView without sites, the summary and Echo lines, the story chain off, autoplay reaching the boss, the dev tools, and the option off |
| qa/rules | **56/56** |
| qa/docs | **3/3** |
| qa/sim | **87/87** (on the latest upstream sim, including the 2b.4 fog bots) |
| Golden, classic | 90 rows autoplay runs (3 classes × 30 seeds, real content) give identical per-step events, final state, Echoes and minutes compared with the engine before this change (src of origin/main extracted to a scratch folder). An earlier pass over 120 runs gave the same result |
| Golden, expedition without `prep` | The same comparison over 90 expedition runs is identical too |
| Expedition with `prep: true` | Autoplay reaches the boss in 4 of 30 real-content runs (10 seeds per class; 5 of 30 before, without contracts or the story chain). Contracts are taken in every run. The s01d autoplay test asserts at least one run reaches the boss |
| Build | `node tools/build.mjs --out /tmp/eng25/g.html` builds (1.6 MB) |

Not run: browser checks. The UI is not touched.

How to test:
```
node --test qa/engine/ && node --test qa/rules/ && node --test qa/docs/ && node --test qa/sim/
node --test qa/engine/s01d-prep-contracts.test.mjs
```

## 3. Why PREP is behind `newRun({ prep: true })` (decision for the Lead)
While I worked, the Sim Engineer pushed the 2b.4 fog-only expedition bots (80ba728). Their `makeBot` (sim/lib/policy.mjs) has no branch for phase PREP. With PREP always on in expedition runs, 4 qa/sim tests failed, and sim/ is outside my scope. So the start camp and everything it brings (contracts, hub offers, the Spyglass, the story chain's retirement) needs `prep: true` for now. Without it, an expedition run plays exactly as before.

To make PREP the default:
1. Sim: in `makeBot.choose`, answer phase PREP. `R.autoAction(s)` is a working default, or the Sim Engineer can add the bots of expedition.md 10.2. It must come before `ooc(s)`, because out-of-combat actions are not legal in PREP. B39 and B40 need this anyway.
2. UI: the prep screen (2b.6) reads `R.prepView`, the tracker reads `R.contractView`, and the map reads node `sites` and `spyglass`.
3. Engine: change `prep = false` to `true` in `newRun`, then update s01b and s01c to SET_OUT after START_RUN.

## 4. Engine defaults (designer or Lead to confirm)
1. Each option can be bought once per run. The spec does not say whether supplies stack.
2. Owned perks: Cartographer and Old Hand are read from `profile.unlocks` (`C.META_EXPEDITION`), and so is Quartermaster (ranks capped at 2). None of them is in the meta catalogue `C.META` yet. Adding them would show items that do nothing in the Hall of Echoes of the rows game the owner plays, and would change B31 and the sim's PALL profile. Add them at the switch-over. The newRun `vision` options `charts` and `guide` also count as owned.
3. Bounty elite: a zone rare of the target family, else any zone rare (section 5).
4. Bounty sites never use the Trainer, so the Trainer guarantee of 4.3 step 5 holds. Bounty sites also never use an existing site. A completed Bounty's other node gets back the elite it was set up with.
5. A Cull site without a mob of the family: a zone normal of the family replaces the last mob, else an earlier one, the first that keeps rules 7.14. When none does, the encounter stays unchanged.
6. The hub contract is only open before the zone's first LEAVE_HUB ("taken before LEAVE_HUB"). A later hub visit does not offer it.
7. `swap` needs the id of the held contract it gives up (`contractId`). The spec's `TAKE_HUB_CONTRACT(mode)` names none.
8. A Delve contract shows its dungeon's type while it is held or complete.
9. A Grind site counts at its first wave won. If a contract completes there, the node ends with the reward (one wave on the expedition map).
10. REROLL_BOARD replaces each slot not taken with the same slot of `prep(k + 1)`, so the one-per-zone layout holds.
11. Board draw order per offer: kind, region, family (always one draw), then the Bounty's elite. Extra slots draw their zone first.
12. Autoplay's start camp is a fixed rule, not a bot (AUTO_PREP_ZONES 3, AUTO_PREP_RESERVE 2). Its map policy does not seek sites.

## 5. For the Content Designer (placeholder ids, nothing invented)
- Families without a rare in their zone, so their Bounties fall back to another family's rare: z1 outlaw, blight; z2 reedfolk, witchkin; z3 reiver, stormward; z4 sunbound; z5 veil; z6 pyrecult.
- Family display names for the contract text ("Cull boars in ..."). Content has only family ids ('wild', 'outlaw', ...). Proposed group: `texts.families[familyId]`.
- Flavour lines for the prep options (ids `prep_draughts`, `prep_rations`, `prep_ember`, `prep_bell`, `prep_mule`, `prep_charts`, `prep_tracker`, `prep_guide`, `prep_spyglass`) and the contract kinds (`cull`, `bounty`, `delve`). Proposed groups: `texts.prep`, `texts.contracts`. The option names come from the spec (`C.PREP_OPTION[id].name`).

## 6. Not done (left for a next slice)
- `ASK_LOCALS` (5.3, TIME_ASK_LOCALS).
- The meta catalogue changes of 8.2: Pathfinder replacing Scout's Eye in expedition runs, Swift Boots as a Bell charge, and the catalogue entries (see 4.2).
- An autoplay map policy that steers to known sites.
- rules.md 1.9 still says the start camp is "not here yet". That section is the designer's; 2b.7 folds it in.
- The default flip of section 3.
- Not touched: sim/, src/ui/, game.html, rules.md, balance.md.

## 7. Commits (all on main)
| Commit | What |
|---|---|
| 814cad1 | Engine, constants, tests (s01d), engine-api.md 13, expedition.md status line, ARCHITECTURE |
| (this note) | Hand-off |
