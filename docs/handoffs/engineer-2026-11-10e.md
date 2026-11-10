# Hand-off: Core Gameplay Engineer, 2026-11-10e (M2b 2b.3, expedition map in the engine)

## Summary
- The expedition map runs in the engine behind a run option. `newRun({ mapMode: 'expedition' })` plays it; the
  default stays `'rows'`. In a rows run nothing changed: 126 full runs (72 on autoplay, 54 with the simulator's
  planner, greedy and random bots) give identical events, summaries and action logs before and after [measured].
- Scope is the zone map, vision, the Dimming, Roads and the Homeward Bell (expedition.md 1, 4-7 and 9.5). The
  preparation economy, contracts, the hub contract and the meta changes are not in it (2b.5).
- In the engine:
  - circular zone graph: hub, rings of 6 / 12 / 12 nodes, node ids, seeded on map(z);
  - node types by region kind, content level by ring, the region family share;
  - MOVE (forward and back), PASS_THROUGH, hub revisits;
  - vision: radius 1, remembered nodes, cap VISION_RADIUS_MAX;
  - a player-visible `mapView`;
  - the Dimming: grace, one hop per 2.5 h, Dimmed encounters, content lost, death;
  - TAKE_ROAD on the three Roads, and the Homeward Bell (charges, 2 h channel);
  - zone 6 leads to the Camp and the boss;
  - the 9.5 pacing values in expedition runs only;
  - a default autoplay map policy.
- The rules are in rules.md as section 1.9 "(expedition)". The constants are in the section 13 table, which the
  constants test reads, and the REGION_W table has its own test. engine-api.md has a new section 10, and
  ARCHITECTURE.md has a new row for `src/engine/expedition.js` and updated rows for the changed files.
- Tests: qa/engine 265/265, of them 36 new in `s01b-expedition` and 1 new in s13. qa/rules 56/56, qa/docs 3/3,
  qa/sim 65/65. Build: `node tools/build.mjs --out /tmp/eng-game.html` gives 51 modules, 1 228 KB.

## Commits (all on main)
| Commit | What | Files |
|---|---|---|
| fb0d0e7 | rules.md 1.9 "(expedition)" and the constant-table rows; the constants, REGION_W, the shardspawn variant; s13 tests the region table | src/constants.js, docs/specs/rules.md, qa/engine/s13-constants.test.mjs, docs/ARCHITECTURE.md (constants row) |
| 053e773 | The map module (not wired yet): graph generation in the map(z) draw order, node setup by region, distances, the Dimming's front, vision, the map view; streams by node id; content validation of `regions` and `family`; 10 generation tests, one of them an exact replay of the draw order | src/engine/expedition.js (new), src/rng.js, src/engine/map.js (exports `pickFrom`), src/engine/content.js, qa/engine/s01b-expedition.test.mjs (new), docs/ARCHITECTURE.md |
| 688eec1 | The run flow: `mapMode`, MOVE, PASS_THROUGH, hub visits, the settle step (Dimmed encounters, Bell arrival), TAKE_ROAD, RING_BELL, 9.5 pacing, summary and death location, the default map policy; s01b grows to 36 tests | src/rules.js, src/engine/{nodes,actions,damage,summary,autoplay}.js, docs/specs/engine-api.md, docs/ARCHITECTURE.md, qa/rules/COVERAGE.md, qa/engine/s01b-expedition.test.mjs |
| (this commit) | "Engine: expedition map implemented" and this note | docs/handoffs/engineer-2026-11-10e.md |

The UI Engineer's cbe5520 and the Lead's fb03dc4 landed between my first two commits. My rows in ARCHITECTURE.md
were added on top of the UI rows.

## Rules and tests (qa/engine/s01b-expedition.test.mjs unless named)
| Rule | Behaviour | Tests |
|---|---|---|
| 1.9.1 | `mapMode` option. CHOOSE_NODE and TRAVEL_ON are refused in an expedition run, and the expedition actions are refused in a rows run. `legalActions` lists MOVE and PASS_THROUGH per neighbour, RING_BELL, and TAKE_ROAD on a Road | "a run is created on the rows map unless ...", "CHOOSE_NODE and TRAVEL_ON are not legal ..." |
| 1.9.2 | Ids ring by ring. The draw order of map(z): angles, edges, regions, Roads and the Shardfall, node types | "graph ...", "draw order on map(z) ... replay exactly" (40 seeds × 3 zones), "edges ..." (frequencies over 300 zones), "regions ...", "landmarks ...", "node types ...", "determinism ..."; s13 "1.9.2 region kinds" |
| 1.9.3 | Content level by ring (u = the first draw of node(z, id)). One grind wave, two trash fights, valid encounters, trap = the first draw of loot(z, id). Content regions and the family share | "content level ...", "node setup ...", "regions from content ..." |
| 1.9.4 | MOVE enters or walks; the way back; each node resolved at most once; PASS_THROUGH; a fled fight resolves its node; fight(z, id, k) and loot(z, id); hub revisits; the hub vendor keeps what was sold | "MOVE enters ...", "PASS_THROUGH ...", "a fled fight ...", "the hub ..." |
| 1.9.5 | Radius 1 at entry and after every step; seen nodes remembered; Local Guide and the cap; Region Charts; Pathfinder; contents only of seen nodes | "vision ...", "radius ...", "the map view ...", "leak test ..." |
| 1.9.6 | The front formula and `dimAt`; `dimming` events; the Dimmed encounter (make-up from dim(z, id, n), level with depth and the cap, HP and damage multipliers, hours, engage round); rewards; flee; the front reaching the player during a node; content lost; hub services stop; death in the dark | seven tests in "the Dimming (1.9.6)" |
| 1.9.7 | TAKE_ROAD through six zones to the Camp and the boss at level 1; a Dimmed Road after its encounter; the Bell (charges, hours, legality); the Bell after a Dimmed encounter | four tests in "leaving a zone (1.9.7)" |
| 1.9.8 | Node hours 3 / 3 / 2 / 6; a one-wave Grind starts on entry; trash, trash, boss; XP × 1.6 on kills, turn-ins, waves and clears (rows: × 1); estSeconds for walks, passes and the Bell | three tests in "pacing ..." |
| 1.9.9 and 0 | Full autoplay runs per class end, with fixture and real content, and every action autoplay takes is listed. Same seed and actions give the same state; a save mid-run resumes exactly | "full autoplay runs ...", "determinism ..." |

**Leak test** (the task's requirement):
- On every node the player has not seen, `mapView` has only the skeleton keys: id, ring, angle, nb, hops, hub, road,
  shardfall, dimmed, dimsIn, dimAt, know and region (null).
- `mapView` and `autoAction` are the same when the contents of every hidden node are replaced by another seed's
  zone. This holds over 12 runs, fixture and real content.
- `mapView` and the default policy read only what the player sees.

## Decisions where the spec left a choice (please confirm or change)
1. **PASS is `PASS_THROUGH(nodeId)` on the map, chosen before the step.**
   - expedition.md 4.5 puts PASS inside the node "before its first fight or choice".
   - `PASS` is already the combat action, and quest and elite fights start on entry.
   - Rest and unguarded Treasure nodes have no choice point inside, so they could never be passed.
   - Adjacent nodes are always fully in view, so the player has the same information either way.
2. **When a Dimmed encounter happens.** Hour-costing actions are a step, a node's content, a hub service and the
   Bell's channel. Such an action that ends in a Dimmed node, with nothing open, starts one encounter. Its own hour
   starts no second one.
   - Standing in the dark costs nothing until hours pass.
   - A node whose content started before the front arrived is finished first; the encounter comes after it.
   - "Entering a Dimmed node" means a node Dimmed when the MOVE starts. The MOVE becomes a walk, and the encounter
     follows.
3. **The Dimmed encounter's level** is capped at MAX_LEVEL (rules 1.4: no content level above 60), so depth adds
   nothing at the top of zone 6. The make-up and the fight come from one stream, dim(z, id, n).
4. **Shardspawn enemies:**
   - zone danger as a normal enemy, and ENGAGE_DMG_COMP as every template enemy (not in the Rogue's fights, D48);
   - the fight has an engage round;
   - kills count as normal kills;
   - a skulker's Signal still brings a normal add with no rewards.
5. **A Grind of one wave starts on entry.** The GRIND_SET_WAVES stage would offer only "1".
6. **XP_WEIGHT_MULT and EXPED_HOURS_GRIND_WAVE apply to Camp waves too.** That is what the rules.md values do when
   9.5 is folded in at the switch-over.
7. **The story chain stays, unweighted, until contracts replace it (2b.5).** Without it a zone gives about 0.9
   levels less.
8. **Ring 1's forbidden types** (Elite, Vendor, Trainer) weigh 0 in the weighted draw: one draw per node, no
   redraws.
9. **Family share:**
   - every template pick of a quest, a grind wave, an elite (template and add) and a treasure guard takes two
     draws, always drawn;
   - quests pick from their own list;
   - dungeons, the Camp and Dimmed encounters do not use regions.
10. **Regions on the map:**
    - a seen node shows its region (expedition.md 3.4: regions are "discovered by walking");
    - Region Charts show every node's region;
    - `mapView.regions` lists the zone's regions in content order, so it does not reveal the wedge order.
11. **The hub:**
    - a walk onto the hub, out of the Dimming, is a new visit: phase ZONE_HUB, each service once again, and
      LEAVE_HUB back to the map;
    - the hub vendor's stock is drawn once per zone and keeps what was sold;
    - Trainer's Ledger stays once per hub.
12. **Roads are landmarks on nodes that have normal content.** The player takes the Road after resolving or passing
    the node.
13. **Scout's Eye and Swift Boots have no effect in an expedition run.** Scout's Eye: 5.3 hides rares, traps and
    Embers. Swift Boots: there is no level gate, and the +1 Bell charge is a meta change for 2b.5.
14. **Vision perks before PREP:** the provisional newRun option `vision: { guide, charts, pathfinder }`, so the
    Simulation Engineer can measure PALL-like vision (B41, B42) before 2b.5. The Tracker and the Spyglass wait for
    contracts and PREP.

## Content needs (Content Designer, src/content/; nothing there was changed)
The engine runs on today's content. Without regions, each zone has one region of each kind (wilds, road, haunt,
steads) with no name and no family bias. To use the region rules:
1. `zones[i].regions`: exactly REGION_COUNT (4) entries `{ id, name (<= 28), kind ('wilds' | 'road' | 'haunt' |
   'steads'), families: [tag, ...] }`. `validateContent` checks the count, the name, the kind and the family list.
   The kind sets the node mix (rules 1.9.2 table), so match it to the zone's theme.
2. `family` (a string tag) on every normal, elite and rare template. Give each family 2 or more normal templates of
   different archetypes. Otherwise an all-family 2-mob grind wave breaks rules 7.14, and the repair redraws its
   last enemy from the whole list.
3. Please add rows for both fields to src/content/SCHEMA.md (as for `addPool`).
4. For later:
   - add pools per region (combat-v2.md 4.2; the engine still uses the zone's `addPool`);
   - bounty elites (2b.5);
   - names and lines for the Shardfall, Shardspawn, the Dimming, Roads and the Homeward Bell (UI text; the engine
     needs none).

## For the UI Engineer (2b.6; src/ui/ not changed)
- An expedition run needs the fog map. `mapView` changes shape in such a run (engine-api.md 10.3), and today's bridge
  reads the rows view. The shipped game is unaffected, because `mapMode` defaults to 'rows'.
- What the map can show:
  - `mapView.moves`: per neighbour, `via`, `hours` and `passHours`;
  - per node: `dimsIn` and `dimAt` (the "dims in N h" clocks), `know`, `region`, `road`, `shardfall`;
  - `dim.front` and `dim.nextIn`, `bell.charges`, `onRoad`.
- Events: `move` (with newly `seen` ids), `dimming`, `dim`, `bell`, `travel` (with `by`). A Dimmed encounter is phase
  NODE with `node.type === 'dim'` and `fight.kind === 'dim'`; its enemies have `kind: 'shardspawn'`.
- A seen rare elite shows `name: null`, as on today's map. That tells the player it is a rare, while expedition.md
  5.3 wants the flag hidden. Showing no elite names, or the rare's name, would fix it (Designer's call).

## For the Simulation Engineer (2b.4)
- In an expedition run, bots read `mapView`. The oracle may read `state.zone` (diagnostic only).
- Use `stepInPlace`.
- Throughput, real content, default policy, shared machine [measured]:
  - `stepInPlace`: 2 005 runs/min in expedition runs, 1 681 in rows runs;
  - pure `step`: 666 and 635 runs/min;
  - pure `step` per action: 0.47 ms in expedition runs against 0.38 ms, because the state is larger (13 k against
    8 k characters at the zone 1 hub).
- Generation facts, 900 zones [measured]:
  - the hub is always 3 hops from the Shardfall (it dims at zone hour 14) and 3 hops from the nearest Road;
  - the last node dims at zone hour 21;
  - Roads lie 2 to 6 hops from the Shardfall;
  - about 55 edges per zone;
  - node types per zone: about 10.1 quests, 4.2 rests, 3.7 grinds, 3.1 treasures, 2.6 elites, 1.9 shrines,
    1.95 trainers, 1.3 vendors, 1 dungeon.
- B44 needs a cell with the Dimming off. I can add a run option such as `dimming: false` (one guard in `frontAt`'s
  callers) if you want it; ask through the Lead.
- **The default policy is not a bot.** 300 runs per mode, seeds 1000-1099 × 3 classes, real content [measured]:

  | | Rows | Expedition |
  |---|---|---|
  | Reach the boss | 11.0 % | 10.7 % |
  | Median hours at the boss | 107 | 120 |
  | Median manual minutes, runs that reach the boss | 52.0 | 40.5 |
  | Most non-boss deaths | dungeons | quests |

  - It leaves each zone at level 10 × z in both modes.
  - In expedition runs: 17.0 zone hours, 5.24 resolved nodes, 0.58 walks and 1.49 passes per zone.
  - It meets the Dimming in none of the 300 runs and never rings the Bell. That is by design: it enters a node only
    if a clean way to a Road remains afterwards. So the Dimming's bite (B43) must come from the greedy and planner
    bots. The s01b tests cover every Dimmed-encounter rule.

## How to test
```
node --test qa/engine/     # 265 pass (s01b: 36)
node --test qa/rules/      # 56 pass
node --test qa/docs/       # 3 pass
node --test qa/sim/        # 65 pass
node tools/build.mjs --out /tmp/eng-game.html
node -e "import('./src/rules.js').then(async (R) => { const { CONTENT } = await import('./src/content/index.js');
  let s = R.newRun({ classId: 'mage', seed: 7, content: CONTENT, mapMode: 'expedition' });
  while (s.phase !== 'ENDED') s = R.step(s, R.autoAction(s)).state; console.log(s.result.summary.expedition); })"
```

## Known issues
- The browser client cannot draw an expedition run yet (2b.6). Expedition runs are opt-in, so the shipped game is
  unaffected.
- The default map policy never meets the Dimming (see above).
- A seen rare elite's `name: null` reveals the rare flag (UI section above).
- SCHEMA.md has no rows yet for `regions` and `family`, because src/content/ was outside my paths.
