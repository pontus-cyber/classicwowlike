# Spec changes M3 v2: a lean first run, a protected guided zone, a steady Dimming (D151)

Owner: Game Designer, 2026-11-14. For: Core Gameplay Engineer (src/engine, constants), UI/UX Engineer (src/ui), Content Designer (src/content lines), Simulation & Balance Engineer (sim/), QA, Lead. **Status: draft** (not approved by the owner; D151 is a team default per D115).

Build status (M3 v2, D152; Core Gameplay Engineer, 2026-11-14, docs/handoffs/engine-2026-11-14f.md): sections 1-3 and 7.1 are built in the engine, each behind a `C.GATES` switch, all on: `firstRunLean` (1.1-1.3), `gorrakBounty` (1.4), `guidedHold` (2.1-2.2), `steadyDim` (3.2-3.3, with DIM_FRONT_TIME 4) and `rescueDim` (3.4); with all five off the engine plays the game before D152 run for run. The specs carry the rules (expedition.md, m3-onboarding.md, rules.md 1.9.6-1.9.7, engine-api.md, SCHEMA.md; marked "(M3 v2)"). The simulator side of 7.4 is built (FIXED_PROFILE_RUNS 2 for PN and PALL, the harness rule in sim/lib/runner.mjs, cell tags). Section 5's planner cells (P0, normal and guided, 900 runs each) reproduce on the built engine run for run; the guided records differ only in the recorder's source of the bounty's XP (`bounty`, not `contract`; hand-off section 4). The UI parts (7.2: the camp's first-run screen, no tracker or Bell button, the held mark, the Dimming panel, the `dimBack` and bounty lines, the Furnace label of section 4) are open for the UI/UX Engineer.

Input: D151 [source: docs/DECISIONS.md D151: "(1) a first run's zone 1 shows only tolls and the Dimming: contracts, Reserve and the Bell hidden on the first run, the camp offers supplies only, the Furnace keeps its late introduction; (2) the guided zone protects its lesson: the Dimming cannot reach Gorrak's node or the hub before his fight ends, and every fight counts toward his return; (3) no sudden blackouts: the Dimming spreads at a steady visible pace and a rescue never lands the player in a mostly dark zone"]; blind round 2 [source: docs/feedback/2026-11-14-blind-casual-rerun.md 2-4, 6; -tactician-rerun.md 2, 5, 8; -skipper.md; -explorer.md]; D143-D150; expedition.md 2, 6, 7.2, H.4-H.5; m3-onboarding.md 2.3-2.6; balance.md B1, B21, B63-B65.

Scope: the four items of D151 plus one compensating rule found by the measure (Gorrak's bounty, 1.4), each with exact rules and constants (sections 1-4), measured in the sim (section 5), with the change table (6), what each role builds (7) and the constant table (8). Nothing else changes.

---

## 1. First run: zone 1 shows only tolls and the Dimming

### 1.1 Definition
A **first run** is a run of a profile with `profile.runs` 0 (no run completed; a dev run does not count), the engine's existing `firstRun(s)` (contracts.js, D150 item 15). The guided first run is a first run; a first run with the guide turned off is also a first run. "Play the guide again" on a later profile (runs > 0) is not a first run: it keeps contracts, Reserve and the Bell as today (its board slot 1 is the guided Cull, m3-onboarding.md 2.3).

### 1.2 What a first run hides, and when each comes back
| System | Hidden on a first run (engine and UI) | Comes back |
|---|---|---|
| Contract board (start camp) | No board: `prepView.board` is `[]`, `TAKE_CONTRACT` and `DROP_CONTRACT` refused ("no contract on the board"). The camp screen has no contracts column, no "Contract slots" line, no contract heading or help line. G1 and G10 do not fire | The second run (`profile.runs` 1): the D150 board of CONTRACT_BOARD_FIRST_BANDS (one zone 1 offer); from the third run (`runs` >= 2) CONTRACT_BOARD_SIZE (3) offers. The first-time hints H20-H23 show on the run where their system first appears |
| Contract slots and tracker (map, hub, HUD) | `contractView` returns `null` for the whole run (no tracker, no "Contract slots 1/4 · Reserve 0" line) | With the board (second run) |
| Hub contract (zones 2-6) | No offer: `zone.hubOffer` is `null`; `TAKE_HUB_CONTRACT` refused ("no hub contract on offer"); no hub contract card, no H22 | With the board (second run) |
| Reserve | Never named or shown on a first run (camp, hub, map, summary) | With the board (second run) |
| Vision perks (start camp) | Region Charts and Tracker's Notes are not offered: `BUY_PREP` refuses every option whose `kind` is not `supply` ("not offered on a first run"); `prepView.options` lists only Field Draughts and the Ember of Return | The second run |
| Homeward Bell | In zone 1 of a first run: no Bell button, `RING_BELL` refused ("the Homeward Bell is not in hand yet"), `mapView.bell` = `{ charges: 0, hidden: true, channelTime }`; its charge (BELL_START_CHARGES) is kept, not spent. G13's far line ("Far from a Road? Ring the Homeward Bell ...") does not show; its Road line reads content `G13.road.first` (2.4) | Zone 2 of the first run: from arrival at zone 2's hub the button and the charge are there, and the Bell's first-time hint H19 shows at its trigger (m3-onboarding.md 3.2) |
| Camp supplies | Kept: Field Draughts and the Ember of Return, prices as today | - |
| The Furnace | As today: hidden in a guided first run until its coach line (G5) has shown (D150 item 1) | - |

The map keeps tolls, the Dimming (wash, "dims in N" chips, the Dimming panel of 3.3) and the Furnace (late introduction). Regions keep their tint and names only where they show today without Region Charts (the camp perk is not on offer).

### 1.3 Camp points on a first run (no hidden Reserve trap)
- A first run's camp has **PREP_POINTS_FIRST** points (5 = Field Draughts 1 + Ember of Return 4): buying both spends every point, so the full purchase is visible and possible.
- Points left at `SET_OUT` are kept by the engine as today (`s.exp.reserve`) but have no use on a first run (no hub contract is offered), and pay PREP_ECHO_PER_POINT Echoes each at SUMMARY, as Reserve does today.
- The camp says so before Set out, in place of the Reserve line: content `prep.unspentFirst` (draft): "Points you do not spend: +{echoes} Echoes at the end of the run." `{echoes}` = points left × PREP_ECHO_PER_POINT. The summary's Echo line for them reads "Unspent camp points" (draft) on a first run.
- Nothing a first-run player does at the camp can lock him out of anything later in the run.

### 1.4 Gorrak's bounty (the guided zone's XP without the Cull)
The guided board's Cull paid about a third of guided zone 1 XP [source: changes-m3-v1.md; measured here 3.1 levels per run in zone 1]. Without it the guided player leaves zone 1 at level 8 and the step into zone 2 fails B65 (F2 in 5.4). Rule: on a first run, a **victory** over Gorrak in the guided zone pays the reward the guided Cull paid, on his node's reward stage, as a contract completion does (expedition.md 3.1): XP `CULL_XP_FRAC × XP_WEIGHT_MULT × xpToNext(CL_c)` with CL_c of zone 1 (8; no level-difference modifier, heat applies), gold `CULL_GOLD_V × V(CL_c)`, and a choice of CONTRACT_REWARD_CHOICES items on table "Contract". Event `bounty { xp, gold }`; line content `guide.bountyLine` (draft): "Gorrak's bounty: the Bellwrights pay for the Fieldbreaker." Not on a flight or a rescue, not outside the guided zone, not on a later run (the Cull is back). No new constant. Measured (F3): level leaving zone 1 back to 11, B65 zone 2 passes, guided onebutton B21 25.6 -> 14.4 % (base 10.7 %).

### 1.5 Why the second run, not zone 2, for contracts
Contracts are a start-camp decision (board, price, slots) paid in camp points; a zone 2 hub contract on a first run would need Reserve or a swap, the currency the tactician and the explorer did not know they held [source: -tactician-rerun.md 2 and 5, s0208; -explorer.md s0263]. Teaching it at zone 2 is a mid-run decision with an unknown currency. The Bell is one button with one charge and its own hint (H19), so it can come in zone 2 of the same run, after the first zone has taught tolls and the Dimming. Cost measured in section 5 (columns F2 and F3).

## 2. The guided zone protects its lesson

### 2.1 Gorrak's return: every fight counts
- `state.tutorial.fights` (new, 0 at START_RUN) counts every fight that **ends** in the guided zone while the guide is on: won, fled or rescued; quest, grind (each wave), Cull site, other elite, dungeon (each fight), treasure guard and Dimmed encounter. Gorrak's own fight does not count. A death that ends the run cannot happen there (rescue).
- **His node opens** when `fights >= ONB_ELITE_FIGHTS` (3), or at once when no unresolved Quest or Grind node outside the Dimming is left in the zone (so a player who let the zone go dark can still fight him). It replaces the gate on scripts (`elite.gate.afterScript`, D138/D143), which is retired.
- The barred line keeps its text (content `elite.gate.barredLine`, "Gorrak is out on the downs. He comes back after {n} more fights."; newcomer check 2026-11-15, draft: "Gorrak is out on the downs. Fights before he comes back: {n}.", which reads right at {n} = 1), with `{n}` = ONB_ELITE_FIGHTS - fights; `tutorialView.elite.left` gives it. Every fight now moves it, so the tactician's case (a grind fight and a Dimmed fight that did not move the count, s0068-s0182) cannot happen.
- Scripts S1-S4 keep their rule (the first non-site Quest or Grind fights play them in order). On a first run there is no Cull (1.2), so the first three Quest or Grind fights are S1-S3 and the guided route stays S1, S2, S3, Gorrak, as D143-D149 built it, with G8 before G9. A player who fights elsewhere first (a Dimmed encounter, a treasure guard, a replayed guide's Cull site) can meet Gorrak before S3; accepted, because G9 has no coach line since D150 (the prompt bar names the answer).
- **ONB_ELITE_FIGHTS 3 suits a player who wanders:** the wandering bot (random adjacent moves for 10 tolls, section 5.5) meets him in 99.9 % of runs, median zone toll 18 (base: 34.8 %).

### 2.2 The corridor: what the Dimming cannot reach before his fight ends
Fixed when the guided zone is set up (`setupGuidedZone`, after Gorrak's node is chosen):
- the **hub**, **Gorrak's node**, and one shortest path between them (hops on the zone graph; at each step back from Gorrak's node the neighbour one hop nearer the hub with the lowest id);
- the **Road nearest Gorrak's node** (hops; ties: lowest id) and one shortest path from his node to it (same tie rule).
On TUTORIAL_SEED the corridor is nodes 0 (hub), 1, 18 (Gorrak), 7 and 19 (Road): 5 of 31 nodes. The Road path is in the corridor because a first run has no Bell in zone 1 (1.2): after his fight the player must be able to walk out.

While the corridor is **held** (the guide is on and his fight has not ended):
- its nodes never dim (`dimAt` is Infinity; the map shows the held mark of 7.2, no "dims in" chip);
- they take no place in the Dimming's order (3.2): the other nodes dim in their place, so the per-toll cap counts only the nodes outside the corridor.

**Release** when his fight ends (won, fled or rescued) or the guide ends (SKIP_GUIDE, ONB_RESCUE_MAX rescues): each corridor node gets `dimAt = max(dimAtHops(its hops), tRelease + ONB_HOLD_RELEASE + i)`, i = 0, 1, 2, ... in the order of hops from the Shardfall (ties: lowest id), so the side nearest the dark goes first and the Road last. tRelease is the zone toll of the release. With ONB_HOLD_RELEASE 3 a player standing on Gorrak's node has at least 3 tolls before the first corridor node dims, and the Road, 2 hops away on the seed, dims last. The release can add one node to a toll that the cap already fills (measured: at most 3 nodes in one toll, section 5.4).

### 2.3 Roads, rescue and the no-lock rule
- The Roads stay closed until his fight has ended (D142, unchanged). His node cannot dim while held and opens at the latest when no Quest or Grind node is left (2.1), so the no-lock clause of m3-onboarding.md 2.3 ("his node resolved or Dimmed, or still barred with no Quest or Grind node left") reduces to "his node resolved"; the engine keeps the whole clause as a fallback.
- The rescue keeps its rules (m3-onboarding.md 2.6) and gains the Dimming rule of 3.4.

### 2.4 Lines (content, draft)
- `guide.holdLine` (map tooltip of a held node): "The Bellwrights keep the dark off this road until Gorrak's fight is over."
- `G13.road.first` (G13 on a Road, first run, zone 1): "On a Road: take it to the next zone."

## 3. A steady Dimming

### 3.1 Why one dungeon and a rescue took 7 to 26 of 31 nodes dark
The front moves by hops at a fixed pace (DIM_FRONT_HOPS 2 per DIM_FRONT_TIME 5 tolls, so a step every 2 or 3 tolls), but a disc graph seen from a rim node holds few nodes near the Shardfall and many in the middle. Nodes per hop from the Shardfall, mean of 300 zone 1 maps: 1.0, 2.6, 4.1, 5.7, 6.5, 6.9, 4.1 (hops 0-6); TUTORIAL_SEED: 1, 2, 4, 5, 8, 6, 5 [measured: scratch script on generateExpZone]. So the visible spread speeds up from 1-3 nodes a step to 6-8 a step exactly when the player is in the middle of the zone:

| Zone toll | 6 | 9 | 11 | 14 | 16 | 19 | 21 |
|---|---|---|---|---|---|---|---|
| Nodes Dimmed, mean of 300 maps (of 31) | 1.0 | 3.6 | 7.8 | 13.4 | 20.0 | 26.9 | 31.0 |
| TUTORIAL_SEED | 1 | 3 | 7 | 12 | 20 | 26 | 31 |

The largest number of nodes dimmed in one toll is 7 (median map), 9 (p90), 11 (max): 23-35 % of the zone at once.
- **Tactician** (s0138-s0161, "7 to 20 within about 3 tolls"): on the seed, 7 nodes are Dimmed at zone tolls 11-13 and 20 at toll 16. Three tolls, two front steps (hops 3 and 4: 5 + 8 nodes).
- **Casual** (s0234, "26 of 31 after one dungeon visit and a rescue"): the dungeon costs EXPED_TIME_DUNGEON 5 tolls at entry and the rescue ONB_RESCUE_TOLLS 2: 7 tolls, three front steps, from 7 Dimmed at toll 11-13 to 26 at toll 19-20. The player saw none of it while inside the dungeon. In the sim one class of the guided onebutton bot does this on every seed: all 300 of its rescues land at 26 of 31 Dimmed (84 %) [measured: section 5.4, base].

### 3.2 Rule: the Dimming's order and its cap
At zone generation, after `shardDist`:
1. **Order** every node (the corridor of 2.2 excluded in the guided zone) by hops from the Shardfall, then by angular distance from the Shardfall's angle (`angDist`), then by id. The dark grows as one connected patch from the star, nearest first.
2. **Schedule** node k of the order (k = 0, 1, ...): `dimAt_k = max(dimAtHops(h_k), dimAt_(k-1), dimAt_(k-DIM_MAX_PER_TOLL) + 1)`, with `dimAtHops(h) = DIM_GRACE + ceil(h × DIM_FRONT_TIME / DIM_FRONT_HOPS)`. The hop pace is the earliest a node can dim; the cap lets at most **DIM_MAX_PER_TOLL (2)** nodes dim in any one toll (6.5 % of a 31-node zone).
3. **DIM_FRONT_TIME 5 -> 4** (2 hops every 4 tolls). Without it the cap slows the late zone and the planner wins 37.2 % (+7.5 pp, B1 fails, 5.2); with it the clock keeps its length (B1 +1.7 pp).
4. Store the schedule on the zone (`zone.dimBase[id]`); `dimAt(zone, id) = zone.dimBase[id] + zone.dimShift` (3.4), Infinity for a held corridor node, the corridor's release value after release. Every reader of `dimAt` (mapView `dimsIn`/`dimAt`, heatView `dimIn`, `dimmedNow`, the settle step, previews, bots) is unchanged.

The resulting clock:

| Zone toll | 6 | 9 | 11 | 14 | 16 | 19 | 21 | hub dims at | half Dimmed at (16th node) | all Dimmed at |
|---|---|---|---|---|---|---|---|---|---|---|
| Today, 300 maps | 1.0 | 3.6 | 7.8 | 13.4 | 20.0 | 26.9 | 31.0 | 14 | 16 | 21 |
| Today, TUTORIAL_SEED | 1 | 3 | 7 | 12 | 20 | 26 | 31 | 14 | 16 | 21 |
| D151, 300 maps | 1.0 | 3.6 | 7.3 | 13.2 | 17.2 | 23.2 | 27.2 | 13.6 (12-16) | 15 | 23 (max 26) |
| D151, TUTORIAL_SEED (no corridor) | 1 | 3 | 7 | 13 | 17 | 23 | 27 | 14 | 16 | 23 |

It stays a real clock: the first node at 6, the hub at 13.6 on average (12-16), half the zone at 15, all of it by 23-26; it no longer jumps. In the guided zone the corridor (5 nodes) is held, so 26 of 31 can be Dimmed there before Gorrak's fight ends.

### 3.3 Depth, the front and the panel
- **Depth of a Dimmed encounter** is the time since its node dimmed: `depth = max(0, floor(DIM_FRONT_HOPS × (zt - dimAt(id)) / DIM_FRONT_TIME))` (0 at the edge, +1 every 2 tolls). Before, `depth = front - hops`; with the cap a node can dim later than its hop says, and the old formula would start it deep.
- The **front** (`frontAt`) stays only as a display value (`mapView.dim.front`) and for G12's trigger ("the first node dims, or a Dimmed node is within ONB_DIM_NEAR_HOPS hops of the player").
- `mapView.dim` gains `maxPerToll` (DIM_MAX_PER_TOLL; newcomer check 2026-11-15, draft: the most nodes that can dim in one toll for the rest of the zone, DIM_MAX_PER_TOLL plus what the guided corridor's release can add, so the tooltip's line never meets a larger `nextCount`; the rule's value as `cap`), `nextIn` (tolls until the next node dims: the smallest `dimAt - zt` above 0; Infinity when none), `nextCount` (nodes that dim then), `count` and `total`; `frontHops`/`frontTime` stay for the tooltip.
- **Dimming panel** (UI, D150 wording rules): first line "Spreads in {n} tolls: {k} places" ("Starts to spread in {n} tolls" before the first node); "Your node dims in {n} tolls" / "You stand in the Dimming!" as today; "{count} of {total} places Dimmed". Tooltip line in place of "It spreads 2 hops every 5 tolls ...": "It takes at most {maxPerToll} places a toll, nearest the purple star first, from toll {grace} in the zone." (draft)

### 3.4 Rescue rule: never a mostly dark zone
In the guided zone (the only rescue):
1. The rescue's ONB_RESCUE_TOLLS count on the Furnace (run tolls) but **not on the Dimming**: `zone.dimShift += ONB_RESCUE_TOLLS`, so no node dims during a rescue.
2. Then, if more than DIM_RESCUE_MAX_SHARE (0.5) of the zone's nodes are Dimmed, the Dimming falls back: `zone.dimShift` grows one toll at a time until at most `floor(DIM_RESCUE_MAX_SHARE × nodes)` (15 of 31) are Dimmed. Nodes it leaves come back with their content (they are computed from `dimAt`, nothing was resolved). Event `dimBack { tolls }`; log line content `guide.dimBackLine` (draft): "The Bellwrights ring the dark back."
3. D147's rule stays: the rescue starts no fight where it lands.
4. A rescue never moves the Furnace backwards and never changes the Roads or Gorrak's gate.

Measured (5.4, 5.5): no rescue landing above 48 % Dimmed in any guided cell (base: median 84-100 %).

## 4. The Furnace bar label when the Dimming is the hotter clock

Today the bar reads "{state} · {N} tolls to spare" whatever set the state, so the tactician saw "SMOULDERING · 4 tolls to spare" and "INFERNAL · 1 toll to spare" (s0141, s0165) next to a tooltip that defines those states as overspent.

Rule (UI, ui/heat.js `standText` and the log line `heatToast`), from `heatView.by`:
| `heatView.by` | Line over the bar |
|---|---|
| `run` (the run clock sets the state, or both equal) | as today: "{State} · {N} tolls to spare" / "{State} · No tolls to spare" / "{State} · {N} tolls overspent" ("1 toll"), "Boss +N %" only above 0 |
| `dim`, the player's node not Dimmed (`dimIn` > 0) | **"{State} · Your node dims in {dimIn} tolls"** ("in 1 toll") |
| `dim`, the player stands in the Dimming | **"Infernal · You stand in the Dimming"** |

When `by` is `dim` the tolls-to-spare figure moves to the tooltip's first line: "Tolls: {N} to spare. The Dimming near you sets the Furnace now." (draft; replaces "Raised by the Dimming near you."). The words match the map's own ("Your node dims in N tolls", "You stand in the Dimming!", screens.js), so one fact has one wording. No engine change: `heatView` already gives `by`, `dimIn` and `stateDim`.

## 5. Measure (D118)

### 5.1 Set-up
- **Engine:** origin/main 17cbe11. Arms on scratch copies of src/ and sim/ (src/ untouched), one patch gated by a scratch constant `D151 = { steady, hold, first, rescue }` (not committed; under sim/out/design-d151/: `patch.py` the arms, `mk.sh` the scratch trees, `run2.sh` and `run3.sh` the cells, `read.mjs` the reader, `opts.mjs` and `hubstat.mjs` the schedule tables).
- **Cells:** the expedition map with the start camp (`--map expedition --prep`), P0 (`--profile fresh`: every run is a profile's first run, so section 1 acts on every P0 cell), `--warmup 0`, the X0 tables (`--risk-in sim/out/pass-v9v10/obs-P0.json --tables-in sim/out/pass-v12/exp/table/planner-P0-exp-prep/risk.json`), seeds 1000-1299, 300 runs per class (900 per cell); planner and onebutton, normal and guided (`--guided`). About 25 000 runs.
- **Harness rule, all arms including base:** in the guided zone, while the Roads are closed and Gorrak's node is open, the bot takes the engine's autoplay action (it follows the coach line "Face Gorrak first"). Without it the planner walked between a closed Road and the corridor for ever once only Gorrak was left (the sim bots do not read the guide; report balance-2026-11-13c).
- **Wandering policy:** guided, random adjacent `MOVE` (uniform over the legal ones, bot stream) for the first 10 zone tolls of zone 1, the engine's autoplay inside nodes and the hub during those tolls, then the planner.
- **Arms:** base (17cbe11); **D** = section 3 (cap, DIM_FRONT_TIME 4, depth by time) + 3.4; **DG** = D + section 2; **F2** = DG + section 1 without Gorrak's bounty; **F3** = the whole package (F2 + 1.4; its normal cells equal F2's, the bounty acts only in the guided zone). Two cap variants were run on the planner normal cell to choose the clock (5.2).
- **Definitions:** B1 planner P0 win, all classes pooled (target 20-35 %); B21 runs dying in zones 1-2 (<= 12 %); B63 zone 1 mean lowest HP of won non-boss fights (band 60-68 %) and share below 50 % (>= 22 %); B64 zone 1 levels per fight (<= 2.1); B65 deaths per fight, last 3 fights of zone z-1 against the first 3 of zone z (first <= max(1.5 × last, 1.0 %)); "!" marks a fail. Dimming pace: the largest number of nodes that dim at one toll of the schedule (share of the zone), and the realised rise of the Dimmed count over the run's own states within 1 toll, within 3 tolls and within one action.

### 5.2 Choosing the clock (planner, normal, P0)
| Variant | B1 win | Reach boss | Dimmed encounters per run | Zone 1 dark at exit (median) | Most nodes in one toll |
|---|---|---|---|---|---|
| base (front 2 hops / 5 tolls, no cap) | 29.7 % | 81.2 % | 1.52 | 71 % | 7 (p90 9, max 11) |
| cap 2, front 2 / 5 | 37.2 % (B1 fails) | 87.7 % | 0.74 | 61 % | 2 |
| cap 3, front 2 / 5 | 31.7 % | 83.3 % | 1.24 | 71 % | 3 |
| **cap 2, front 2 / 4 (chosen)** | **31.4 %** | 84.2 % | 0.86 | 71 % | **2** |

Cap 2 alone slows the late zone (23.7 of 31 Dimmed at toll 21 against 31) and the planner farms it. Cap 3 keeps the clock with jumps of 3 a toll (9 in 3 tolls); cap 2 with the 4-toll front keeps the clock (same exit darkness, B1 +1.7 pp) and halves the steps (6 in 3 tolls).

### 5.3 Results: the normal first run (P0, not guided)
| Measure | base | D (section 3) | F (whole package) |
|---|---|---|---|
| **B1** planner win (20-35 %) | 29.7 % | 31.4 % | **24.2 %** |
| Planner reach the boss | 81.2 % | 84.2 % | 80.7 % |
| **B21** planner died in zones 1-2 (<= 12 %); in zone 1 | 7.2 %; 5.9 % | 7.3 %; 5.9 % | 9.2 %; 6.4 % |
| **B63** planner zone 1 mean lowest HP, won fights (60-68 %); share < 50 % (>= 22 %) | 65.8 %; 24.3 % | 66.3 %; 23.7 % | 65.6 %; 25.5 % |
| **B64** planner zone 1 levels per fight (<= 2.1); level leaving zone 1 (median) | 2.14; 12 | 2.13; 12 | 1.98; 11 |
| **B65** planner, zone 2 step (deaths per fight, last 3 -> first 3); zones 3-6 | 2.0 -> 0.3 %; all pass | 2.0 -> 0.2 %; all pass | 2.2 -> 0.6 %; all pass |
| Planner Dimmed encounters per run | 1.52 | 0.86 | 0.75 |
| Planner zone 1 left at zone toll (median); share Dimmed then (median, p90) | 18; 71 %, 94 % | 19; 71 %, 90 % | 19; 74 %, 94 % |
| Planner zone 1 left by the Bell | 8.4 % | 6.8 % | 0 (hidden) |
| **Nodes dimmed in one toll**, schedule (all zones; share of the zone) | median 7 (22.6 %), max 11 (35.5 %) | 2 (6.5 %) | 2 (6.5 %) |
| Realised rise of the Dimmed count in 3 tolls, p90 / max | 13 / 17 | 6 / 6 | 6 / 6 |
| Realised rise in one action, p90 / max (a dungeon is 5 tolls) | 13 / 20 | 8 / 12 | 8 / 12 |
| Onebutton reach the boss; B21; zone 1 deaths | 20.0 %; 31.1 %; 18.6 % | 20.0 %; 30.9 %; 18.7 % | 15.2 %; 34.9 %; 20.7 % |
| Onebutton B63; B65 | 64.1 %; all pass | 63.9 %; all pass | 63.8 %; all pass |

### 5.4 Results: the guided first run
The guided zone is one fixed map (TUTORIAL_SEED), so a bot's route there is nearly the same on every seed of a class: read the guided rows as three routes, not as spread. "F2" is the package without Gorrak's bounty (1.4), F3 the package.

| Measure (planner unless named) | base | D | DG (2 + 3) | F2 | **F3 (package)** |
|---|---|---|---|---|---|
| Gorrak fought (won) | **0 %** | 0 % | 100 % | 100 % | **100 %** |
| ... at zone toll (median); fights before him; scripts before him | - | - | 16; 3; 2 | 12; 3; 3 | 12; 3; 3 |
| Roads open at zone toll (median) | 19 (his node dims: no-lock) | 20 | 16 | 12 | 12 |
| Zone 1 left by the Bell | 33.3 % | 0 % | 0 % | 0 (hidden) | 0 (hidden) |
| Level leaving zone 1 (median); zone 1 fights | 9; 4.3 | 10; 3.0 | 11; 5.0 | 8; 4.3 | 11; 4.0 |
| B65 zone 2 step | 0.0 -> 0.2 % | 0.0 -> 0.4 % | 0.0 -> 0.1 % | **0.0 -> 2.3 % (fails)** | 0.0 -> 0.1 % |
| B21; win | 0.7 %; 31.9 % | 1.8 %; 33.7 % | 0.9 %; 36.1 % | 7.1 %; 23.7 % | 1.2 %; 28.1 % |
| B63 zone 1 mean lowest HP (no target on the guided run) | 84.9 % | 89.3 % | 83.5 % | 81.4 % | 83.0 % |
| Onebutton: Gorrak fought; level leaving zone 1 | 0 %; 9 | 0 %; 10 | 100 %; 11 | 100 %; 8 | 100 %; 11 |
| Onebutton: B21; B65 zone 2 step | 10.7 %; 0.0 -> 1.3 % (fails) | 12.4 %; 0.0 -> 1.5 % (fails) | 9.3 %; 0.0 -> 0.2 % | 25.6 %; 0.0 -> 4.7 % (fails) | 14.4 %; 0.0 -> 0.9 % |
| Onebutton: rescues per run; share Dimmed where a rescue lands | 0.33; **84 % (every landing)** | 0 | 0 | 0 | 0 |
| Nodes dimmed in one toll / 3 tolls (realised max) | 10 / 18 | 2 / 6 | 3 / 7 (the release) | 3 / 9 | 3 / 8 |

Why base never fights Gorrak: his gate counted scripted fights only; the planner's route plays a Cull site, S1, a second site and S2 by zone toll 18, so S3 is not done when his node dims at 19 and the no-lock rule opens the Roads. The tactician met the same gate [source: -tactician-rerun.md 5].

### 5.5 The wandering policy (random adjacent moves for the first 10 tolls, then the planner; guided)
| Measure | base | DG | **F3 (package)** |
|---|---|---|---|
| Gorrak fought (won) | 34.8 % | 99.9 % | **100 %** |
| ... at zone toll, median / p90 | 17 / 21 | 18 / 23 | 18 / 22 |
| Rescues per run; guide ended by ONB_RESCUE_MAX | 0.36; 3.4 % | 0.19; 0.1 % | 0.16; 0 % |
| Share Dimmed where a rescue lands, median / max | **100 % / 100 %** | 29 % / 48 % | 35 % / 48 % |
| Dimming pushed back by a rescue (3.4), tolls per run | - | 0.09 | 0.07 |
| Zone 1 Dimmed encounters per run | 1.31 | 0.38 | 0.30 |
| Level leaving zone 1 (median); B65 zone 2 step | 9; 0.1 -> 3.1 % (fails) | 10; 0.0 -> 0.8 % | 10; 0.0 -> 0.2 % |
| B21; win | 10.6 %; 25.0 % | 3.4 %; 31.4 % | 1.3 %; 26.8 % |
| Zone 1 left by the Bell | 22.5 % | 0.1 % | 0 (hidden) |

### 5.6 Reading
1. **Item 3 holds.** At most 2 nodes dim in a toll (6.5 % of the zone; 3 at a corridor release), at most 6 in 3 tolls (was 13 at p90, 17-18 at most); the largest rise in one action is 12 (a 5-toll dungeon), was 20. The clock keeps its length: zone 1 is left at the same darkness (71 % median) and B1 moves +1.7 pp (in band). Dimmed encounters fall by about 40 % (1.52 -> 0.86 per planner run), because the dark no longer arrives in a block on the player.
2. **The rescue rule holds.** No rescue landing above 48 % Dimmed in any cell (base: every guided onebutton landing at 84 %, every wanderer landing at 100 %). The fall-back acts rarely (0.07-0.09 tolls per run); the pause does most of the work.
3. **Item 2 holds.** Gorrak is fought in 100 % of guided runs (base 0 %) and by 99.9-100 % of wanderers (base 34.8 %), at zone toll 12 on the route (base: never), 18 for a wanderer (p90 22-23), always before his corridor can dim.
4. **Item 1 costs the first run about 5 pp of wins** (planner P0 29.7 -> 24.2 %, inside B1's band; B21 9.2 % inside 12 %), because a first run now has no contract XP or contract rewards in any zone. That matches the owner's "the first runs very hard" [stated: docs/feedback/2026-11-11-1026-owner.md]; later runs have contracts. In the guided zone the lost Cull is paid back by Gorrak's bounty (1.4): without it the guided step into zone 2 fails B65 (F2).
5. Not measured: a human reading the held mark, the new Furnace label and the panel. The next blind panel run should check that the zone 1 map reads as "tolls and the Dimming" only.

## 6. Change table
| # | Rule or constant (section) | Old | New | Target | Expected effect, measured | Type |
|---|---|---|---|---|---|---|
| 1 | First run hides contracts (board, tracker, hub offers), Reserve, the vision perks and, in zone 1, the Bell (1.2) | D150: one zone 1 offer; Bell, Reserve, hub offers, Charts and Tracker on a first run | hidden as 1.2; contracts and perks from the second run (one offer), three offers from the third; the Bell from zone 2 | blind panel: zone 1 shows tolls and the Dimming only; B1, B21, B65 | F: planner P0 B1 29.7 -> 24.2 % (in band), B21 9.2 %, B65 passes; Bell exits of zone 1 0 % | rule + UI |
| 2b | Gorrak's bounty on a first run (1.4) | the guided Cull's reward | his victory pays the Cull's XP, gold and item choice | B65 guided | guided level leaving zone 1 8 -> 11; zone 2 step 2.3 -> 0.1 % (planner), 4.7 -> 0.9 % (onebutton) | rule + content line |
| 2 | First-run camp points (1.3) | PREP_POINTS 10, unspent = Reserve | **PREP_POINTS_FIRST 5**; unspent pay PREP_ECHO_PER_POINT Echoes, said on the camp screen | no hidden trap | the planner buys both supplies with every point | number + UI line |
| 3 | Gorrak returns after any fights (2.1) | after script S3 (scripted fights only) | **ONB_ELITE_FIGHTS 3** fights of any kind, or when no Quest or Grind node is left outside the Dimming | wanderer reaches him | guided route: Gorrak fought 0 -> 100 % at zone toll 12; wanderer 34.8 -> 100 % | rule + number |
| 4 | The corridor is held until his fight ends (2.2) | the Dimming reaches his node at toll 19 on the seed, the hub at 14 | hub, Gorrak, the path between, the nearest Road and its path never dim before his fight ends; release ONB_HOLD_RELEASE 3 tolls, one node a toll, Road last | Gorrak fought in every guided run | rescue landings and Dimmed encounters fall; Roads open at toll 12 (base 19, by the no-lock rule) | rule + number |
| 5 | The Dimming's order and cap (3.2) | front by hops, up to 11 nodes in one toll | ordered by hops, angle, id; **DIM_MAX_PER_TOLL 2**; **DIM_FRONT_TIME 4** (was 5) | at most 2 nodes a toll (6.5 %); B1 within band | at most 2 nodes a toll (was median 7, max 11); 6 in 3 tolls (was p90 13); B1 31.4 % (+1.7 pp) | rule + 2 numbers |
| 6 | Depth of a Dimmed encounter (3.3) | front - hops | floor(DIM_FRONT_HOPS × (zt - dimAt) / DIM_FRONT_TIME) | - | 0 at the edge, +1 every 2 tolls | rule |
| 7 | Rescue and the Dimming (3.4) | the rescue's 2 tolls move the Dimming | the Dimming pauses for the rescue, then falls back to at most **DIM_RESCUE_MAX_SHARE 0.5** Dimmed | no landing in a mostly dark zone | rescue landings Dimmed: max 48 % (base 84-100 %) | rule + number |
| 8 | Furnace label (4) | "{State} · N tolls to spare" whatever set the state | by `dim`: "{State} · Your node dims in N tolls" / "Infernal · You stand in the Dimming" | the label agrees with the state | UI only | UI |
| 9 | Dimming panel and map (3.3, 2.4) | "Spreads again in N tolls"; tooltip "2 hops every 5 tolls" | "Spreads in N tolls: K places"; tooltip of 3.3; held mark on corridor nodes | - | UI | UI + content |

## 7. What each role builds

### 7.1 Core Gameplay Engineer (src/engine, constants)
- constants.js: PREP_POINTS_FIRST, DIM_MAX_PER_TOLL, DIM_RESCUE_MAX_SHARE, ONB_ELITE_FIGHTS, ONB_HOLD_RELEASE (values in 8); DIM_FRONT_TIME 5 -> 4. Retire `elite.gate.afterScript` from content validation (keep `barredLine`, `openLine`).
- expedition.js: `dimSchedule(zone, held)` (3.2 steps 1-2) called in `generateExpZone` (no hold) and again in `setupGuidedZone` (with the corridor); `zone.dimBase`, `zone.dimShift` (0); `dimAt` as 3.2 step 4; `nextDimIn(zone, zt)` and the `mapView.dim` fields of 3.3; `bellHidden(s)` = first run and zone 1; `mapView.bell` with `charges: 0, hidden: true` while hidden; a held node in mapView carries `held: true` and `dimsIn: null` (no chip).
- nodes.js: `dimmingAfterTime` lists the nodes whose `dimAt` falls in (zt - t, zt] (same `dimming` event); the rescue branch of 3.4 (why 'rescue': pause, fall back, `dimBack` event); `startDimEncounter` depth of 3.3; in `finishFight`, `tutorial.fights += 1` for every fight that ends in the guided zone except Gorrak's (2.1).
- tutorial.js / nodes.js: Gorrak's bounty (1.4) on his node's reward stage (the contract-completion reward code without a contract; event `bounty`).
- tutorial.js: `newTutorial` gains `fights: 0`; `eliteBarred` per 2.1; `setupGuidedZone` builds the corridor and `zone.hold = { ids, release: null, at }`; `refreshOverlay` releases it (2.2); `tutorialView.elite.left` = ONB_ELITE_FIGHTS - fights (min 0) and `hold` (ids, released or not); G13's far line not opened while `bellHidden`, its Road line `G13.road.first`.
- contracts.js: `boardSize` 0 on a first run, CONTRACT_BOARD_FIRST_BANDS on the second (`runs` 1), CONTRACT_BOARD_SIZE after; `newPrep` points PREP_POINTS_FIRST on a first run; `buyPrepError` and `prepView.options` per 1.2; `prepView.first` (true) and `prepView.unspent = { points, echoes }` in place of `reserve` on a first run; hub offer null on a first run; `contractView` null on a first run.
- actions.js: `RING_BELL` refused while `bellHidden`. autoplay.js: no `RING_BELL` while `bellHidden`.
- Specs in the same commit: expedition.md 2.1-2.4, 2.6, 3.6, 6.2-6.3, 7.2, 13; m3-onboarding.md 2.3, 2.4 (G1, G10, G13), 2.6, 12; rules.md 1.9.6 and 13; engine-api.md (mapView.dim, bell, held; prepView.first/unspent; tutorialView.elite.left, hold; contractView null). Mark the lines "(M3 v2)".
- Tests: the D143/D147 route test (every class, 20 seeds) still fights Gorrak and leaves by a Road with 0 rescues, now with no Bell in zone 1; a first-run profile has an empty board, no hub offer and RING_BELL refused in zone 1 and legal in zone 2; a second-run profile has one offer; per-toll count <= DIM_MAX_PER_TOLL outside a release on 300 maps; no corridor node dims before Gorrak's fight ends; after a rescue at most floor(0.5 × 31) nodes are Dimmed. Golden hashes of expedition runs change (expected).

### 7.2 UI/UX Engineer (src/ui)
- Start camp on a first run: no contracts column, no slots or Reserve line, two supplies, "Points you do not spend: +N Echoes at the end of the run." over Set out (content `prep.unspentFirst`).
- Map and HUD: no contract tracker or slots line when `contractView` is null; no Bell button while `mapView.bell.hidden`; held nodes show a small lamp mark instead of the "dims in" chip, tooltip content `guide.holdLine`; the Dimming panel of 3.3; the `dimBack` event as a log line (content `guide.dimBackLine`).
- The Furnace label and tooltip of section 4 (heat.js `standText`, `heatToast`, `heatTip`).
- The summary's Echo line for unspent points on a first run: "Unspent camp points".

### 7.3 Content Designer (src/content, draft lines)
`prep.unspentFirst`, `guide.holdLine`, `guide.dimBackLine`, `guide.bountyLine`, `G13.road.first` (texts in 1.3, 1.4, 2.4, 3.4); the Dimming tooltip line of 3.3; the summary label "Unspent camp points". All draft, plain, one sentence each.

### 7.4 Simulation & Balance Engineer (sim/)
- view.mjs `dimDepthV`: depth by time (3.3), as the engine.
- The fixed profiles: P0 is a first run (`runs` 0) and models section 1; P10 and PALL should set `runs` >= 2 (they model later runs with meta; today they have `runs` 0 and would play the first-run camp, no contracts and no zone 1 Bell).
- The guided harness rule of 5.1 (follow the coach line while the Roads are closed and Gorrak is open) belongs in sim/lib/runner.mjs next to the existing guided fallback.

### 7.5 QA
- New-player checklist (m3-onboarding.md 7.2): on a first run zone 1 shows no contract, Reserve, Bell or region perk; the Furnace label never says "to spare" next to a state the Dimming set; no toll moves the Dimmed count by more than 2 (3 at a release); after a rescue at most half the zone is dark.

## 8. Constant table (new or changed)
| Constant | Value | Unit | Section |
|---|---|---|---|
| PREP_POINTS_FIRST | 5 | camp points on a first run (= PRICE_PREP_DRAUGHTS + PRICE_PREP_EMBER) | 1.3 |
| ONB_ELITE_FIGHTS | 3 | fights of any kind in the guided zone before Gorrak's node opens | 2.1 |
| ONB_HOLD_RELEASE | 3 | tolls after Gorrak's fight before the first corridor node can dim; then one node a toll | 2.2 |
| DIM_MAX_PER_TOLL | 2 | nodes that dim in one toll, at most (outside a corridor release) | 3.2 |
| DIM_FRONT_TIME | 4 (was 5) | tolls per DIM_FRONT_HOPS hops of the earliest pace; also the depth step | 3.2, 3.3 |
| DIM_RESCUE_MAX_SHARE | 0.5 | share of the zone's nodes Dimmed, at most, after a rescue | 3.4 |
| CONTRACT_BOARD_FIRST_BANDS | [[1, 1]] (unchanged value) | now the board of the second run (`runs` 1); a first run has none | 1.2 |
| `elite.gate.afterScript` | retired | - | 2.1 |
