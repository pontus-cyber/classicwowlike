# Hand-off: Core Gameplay Engineer, 2026-11-10f (Heat in the engine; D50, D51, D52)

## Summary
- Heat (docs/specs/expedition.md section H, on its defaults) runs in the engine for both map modes:
  - `heatView(state)`: the meter. It gives the line, the heat (hours in hand or past the line), the state, projected
    boss Ascendancy, the Dimming's clock in expedition zones, and a preview of every legal hour-costing choice ("2 h,
    ends Warm"). `heatPreview(state, action)` gives the same for one action. Both were pushed first, on their own
    (16a13dd).
  - A node's heat state is fixed on entry.
  - The node's XP and gold get the HEAT_GAIN multiplier.
  - Every item rolled on a drop table gets the always-drawn rarity step.
  - The summary has a `heat` block, and the Echoes have a new line, `heat`.
- D52: every intent-track entry has a predicted `cancel`. The bridge now reads it (src/ui/engine-bridge.js
  `convTrack`). Its old inference is kept only as the mock engine's fallback.
- D51: Road names (`zones[i].roads`) and the `texts.expedition` group are in the content, the validator and
  SCHEMA.md. The expedition view shows them, and the `travel` event names the Road taken. `mapView.regions` lists
  each region's families.
- D50: a seen elite no longer tells a rare. `newRun({ mapMode: 'expedition', dimming: false })` plays a run without
  the Dimming, for the B44 measurement.
- Everything is folded into the specs: rules.md 1.7.1-1.7.4, 1.9.5-1.9.7, 1.9.10, 7.11, 8.3, 8.4, 9, 11.1 and 13;
  engine-api.md (new section 11, plus sections 1, 4-7 and 10); SCHEMA.md; ARCHITECTURE.md (rows); qa/rules/COVERAGE.md.

## Commits (all on main)
| Commit | What | Files |
|---|---|---|
| 16a13dd | heatView and heatPreview, display only: line, heat, states, the Dimming's clock, ascIfPar, bar, previews; HEAT_* constants; `canEnter` moves to expedition.js | src/engine/heat.js (new), src/rules.js, src/constants.js, src/engine/expedition.js, src/engine/nodes.js, qa/engine/s01c-heat.test.mjs (new), docs/specs/rules.md, docs/specs/engine-api.md, docs/ARCHITECTURE.md |
| 7196e96 | Rewards: entry state, XP and gold multiplier, the rarity step (always drawn, the stream independent of heat), the summary block, the Echo line, `heatView.node` | src/engine/{heat,nodes,combat,progress,items,meta,summary}.js, qa/engine/s01c-heat.test.mjs, qa/rules/COVERAGE.md, docs/specs/rules.md, docs/specs/engine-api.md, docs/ARCHITECTURE.md |
| 28127a3 | D52: predicted `cancel` on track entries; the bridge reads it | src/engine/track.js, src/engine/boss.js, src/ui/engine-bridge.js, qa/engine/s07b-combat-v2.test.mjs, docs/specs/rules.md, docs/specs/engine-api.md, docs/ARCHITECTURE.md |
| 3299c03 | D51: Road names, the expedition texts, region families, the Road in the `travel` event. D50: elites without name or own archetype in the expedition view; `dimming: false` | src/content/{zones,index,texts (new)}.js, src/content/SCHEMA.md, src/constants.js, src/engine/{content,expedition,nodes,summary}.js, src/rules.js, qa/engine/s01b-expedition.test.mjs, qa/engine/s11-s12-meta-content.test.mjs, docs/specs/rules.md, docs/specs/engine-api.md, docs/ARCHITECTURE.md |
| (this commit) | "Engine: heat implemented", the expedition.js header and this note | src/engine/expedition.js, docs/handoffs/engineer-2026-11-10f.md |

## Rules and tests (qa/engine unless named)
| Rule | Behaviour | Tests |
|---|---|---|
| 1.7.1 | `line(z) = parHours × min(z, 6) / 6`, kept at 6 decimals; the Camp's line is the par. `heat = hours - line`. The line moves on zone entry, and travel hours count against the zone being left. `ascIfPar` equals the boss Ascendancy at the Camp. | s01c "line(z) ...", "entering the next zone ...", "ascIfPar ..." |
| 1.7.2 | State thresholds 0, 10 and 30; gain and rarityUp by state; the bar. heatView is null before START_RUN, defined in every later phase, and reading it changes nothing. | s01c "Clear below ...", "the bar ...", "null before START_RUN ..." |
| 1.7.2 previews | Every listed choice is checked against the engine's own hours, heat and state after the step, over four full runs (rows and expedition, fixture and real content; more than 1 000 previews, among them Dimmed-encounter previews). | s01c "previews are exact ...", "a walk that ends in the Dimming ..." |
| 1.7.3 | The state is fixed on entry, before the node's hours, on the node, its fights and the events; it equals `pays`. XP and gold get × (1 + HEAT_GAIN) after rested, Insight and meta; the events carry the extra as `heat`. Covered: kill, quest turn-in, grind wave, dungeon clear, treasure gold. Not paid: selling, Camp waves, the boss, Dimmed encounters. | s01c four tests in "rules 1.7.3" |
| 8.4 | One heat draw after the rarity draw, in every state. Below HEAT_RARITY_UP the rarity goes one step up; epic stays. The draws are the same in every state, also with the unique unlocks. Quest reward choices step up; vendor stock never does. | s01c two tests in "rules 8.4"; s08 unchanged and passing |
| 11.1, 1.7.4 | Echo line `heat`: one per fight won in a Hot or Scorched node; fled fights and Clear or Warm nodes give none. Summary block: hours by the state each hour starts in, and over full runs the block adds up (hours, nodes, fights won, the zone track). | s01c two tests in "rules 11.1 and 1.7.4" |
| 1.9.10 | Dimming states at 4 h and 2 h; the hotter state counts, and `by` names the clock. No clock in rows runs or at the Camp. A node entered at the Dimming's edge pays Hot. | s01c "dimIn = ...", "no Dimming clock ...", "a node entered at the Dimming's edge ..." |
| 7.11 (D52) | Predictions are checked against what happens when each entry becomes now: injected STUN, SAPPED, HEXED and a 2-turn trap, and every engage option of the three classes (9 fights each). End boss entries: null. | s07b "control statuses by their rounds left ...", "the end boss's entries ..." |
| 1.9.5-1.9.7 (D50, D51) | View: roadNames (Road k = name k), texts, region families; the `travel` event's `road`. Elites: name and own archetype null, one entry per enemy (40 real-content seeds). `dimming: false`: no front, nothing dims, no encounters, hub services stay open, a full run ends, rows runs refuse it. Validator: roads and the expedition group. | s01b three tests in "expedition content and options"; s11-s12 "D51 expedition content ..." |

## Decisions where the spec left a choice (please confirm or change)
1. **When the entry state is fixed: at the moment of entry, before the node's hours.** H.3 says "fixed when the
   player enters the node". So a node pays at the state the meter shows when the player clicks, with the Dimming's
   clock of the node entered. `heatPreview(...).pays` shows it; `state` is where the node ends.
   - The prototype (H.7) took the state at each gain. That is mostly after the node's hours, because hours are spent on
     entry. So the real engine pays a little less often than the prototype. Example: a node entered at 9 h past the
     line that ends Hot pays as Warm.
   - If the Designer wants "the state it ends in", it is a one-line change in nodes.js `beginNode`: fix the state
     after the entry hours. `pays` would then equal `state`.
2. **The loot stream does not depend on heat, and this needed two more changes.** H.3 asks for an always-made draw "so
   the stream does not depend on heat". That draw alone was not enough: an item that steps up rolls the stats of its
   new rarity (epics skip the split draw, and only rares and epics draw an affix). The unique draw also depended on the
   rarity. So, for items rolled on a drop table:
   - the three stat draws (split, primary, affix) are always made, and each is used only when the rarity needs it;
   - the unique draw is made whenever the profile makes the source a unique source (Cache: elite, rare and treasure
     drops; Relics: dungeon boss drops).
   - A step-up now changes only that item's rarity and stats. Vendor stock and starting gear keep the old draws.
   - rules.md 8.3 and 8.4 say this. Every run's loot changes once, as H.3 expected.
3. **Gains that count as the node's:** the story bonus and Boon of Plenty gold count too ("every XP and gold gain of
   the node"). Selling does not (it is not a gain, and Prospector does not apply to it either).
4. **Summary counters:**
   - `hoursByState`: each hour counts in the state it starts in. Travel hours use the run state alone, because the
     player is on the Road.
   - `fightsByState`: fights won in map nodes only. Camp waves, the boss and Dimmed encounters have no entry state.
   - `nodesByState` is extra; B56 needs "a run with at least one Hot or Scorched node".
   - `trackPerZone` includes the Camp as `z: 7`, its line being the par.
5. **Previews that leave the zone** (TRAVEL_ON, TAKE_ROAD, RING_BELL) show `dimIn: null`. The next zone's map is not
   drawn until arrival. Its hub is always at least 3 hops from the Shardfall, so it starts Clear.
6. **D50:** in every zone of the real content the rares use archetypes that the elites do not (tested). So the
   name alone was not the leak.
   - A seen elite in the expedition view shows `name: null` and `archetypes: [null, <add's archetype>]`, rare or not.
     The array stays one entry per enemy, because the bots read its length.
   - If the Designer wants elite archetypes back on the map, the content must give each zone's rares the archetypes
     of its elites; the name stays hidden either way.
   - The rows map is unchanged.
7. **`dimming: false`** puts Infinity in `mapView` (`dimsIn`, `dimAt`, `dim.nextIn`), plus `dim.off: true`. I chose
   Infinity over null because bots compare these numbers, and `null <= 2` is true in JavaScript.
8. **The Echo line id is `heat`.** Until the UI adds a label, it shows the fallback "Heat (n)".

## For the UI Engineer
- The meter: `R.heatView(state)` on every screen but PREP and SUMMARY. The fields are in engine-api.md 11.1:
  - the bar: `bar.min`, `bar.max`, `bar.marker`, `bar.beyond`; the line is at 0;
  - the text: `inHand` and `past`, "Boss +N %" from `ascIfPar`, and in Hot and Scorched the live reward from `gain`
    and `rarityUp`;
  - the Dimming marker in expedition zones: `dimIn`, `stateDim`, `by`;
  - inside a node: `node.state`, what that node pays.
- Hover: `heatView.next` holds the legal hour-costing choices with `hours` and the state after them. Match an entry to
  a map node by `action.lane` or `action.nodeId`. `change` says the state differs from now (colour the hour label);
  `pays` is the node's reward state. For any other action, `R.heatPreview(state, action)`.
- Toast on a state change: compare `heatView(state).state` before and after a step. The engine sends no heat event
  (say if you want one).
- Events: `node.heat`, `fight.heat`, and `xp.heat` / `gold.heat` (the extra amount, only when > 0), for log lines
  such as "+35 % from heat".
- SUMMARY: `summary.heat` (engine-api.md 11.3). For the chart, plot per record the heat at arrival (`entry - line`)
  and when left (`exit - line`). Show `hoursByState` too. Add a label for the Echo line `heat` to
  `ui-text.js ECHO_LINE`, for example "Fights won in heat".
- D52: `convTrack` now takes `x.cancel` from the engine. The view's shape is unchanged
  (`{ by, offBalance, breaks, done }`), and ui-regress part H passes on it.
- For the fog map (2b.6):
  - `mapView.roadNames` and `mapView.texts` (shardfall, shardspawn, dimming, homeward_bell);
  - `regions[].families`;
  - `travel.road`;
  - an elite's `archetypes[0]` is null: draw it as an unknown elite.

## For the Simulation Engineer
- Value function (H.6): the state a node pays at is `R.heatPreview(state, { type: 'CHOOSE_NODE', lane })` or
  `{ type: 'MOVE', nodeId }`, field `pays`. The multipliers are `C.HEAT_GAIN[pays]` and `C.HEAT_RARITY_UP[pays]`.
  `heatView(state).next` lists all choices at once.
- For B56, `summary.heat.nodesByState[2] + [3] > 0` marks a run with a Hot or Scorched node. For B31, the `heat`
  line is in `summary.echoes.lines`.
- For B44: `newRun({ mapMode: 'expedition', dimming: false })`.
- Per-fight records: the `fight` event's `heat`.
- The fight look-ahead clone (sim/lib/clone.mjs) still works: the heat counters live in `state.stats.heat`, which
  fightClone deep-copies.
- Sim params were not changed. qa/sim passes 65/65.
- Throughput (B37), real content, shared machine, two runs each: before the rewards (16a13dd) 62.7-65.0 k steps/s
  with `stepInPlace`; after (3299c03) 56.9-65.4 k steps/s. That is within the noise. Runs that reach the boss take
  11-12 ms each with `stepInPlace`.

## For QA (qa/browser is outside my paths)
- I ran ui-regress at 1366x768 on build 28127a3: 73 of 74 checks pass.
  - Parts A, D, E, F, G and H pass.
  - **Part B fails** its one check "part B ran to the end": seed 20's run no longer reaches the camp, because the loot
    stream changed once (rarity step).
  - **Seed 1 meets part B's conditions** on the Node twin: it leaves zone 1 early at level 9, reaches the camp hurt
    with Trail Rations, and its boss fight reaches phase 2 with 1 to 4 Shards. A scratch copy with `SEED = 1` passed
    part B 14/14 on the same build.
- Part E's seed 8 still reaches the camp and dies at the boss with Second Breath unused. Its Node twin no longer holds
  a Boon of Return at the camp; the part takes its numbers from the twin.
- Parts A and H pass again on 3299c03 (33/33).
- qa/engine, qa/rules and qa/sim needed no golden updates; their assertions are statistical or replay the draws.
  Only the new s01c test seeds were picked after the change (noted in the test).

## For the Content Designer
- `zones[i].roads` and src/content/texts.js hold your text from content-2026-11-10b, verbatim.
- zones.js is a generated table. If you regenerate it, keep the `roads` field.
- All three Roads of zone 6 lead to the Camp in the engine. "The last leads to the Camp" is flavour only.

## How to test
```
node --test qa/engine/     # 290 pass (s01c: 19 new; s07b +2, s01b +3, s11-s12 +1)
node --test qa/rules/      # 56 pass
node --test qa/docs/       # 3 pass
node --test qa/sim/        # 65 pass
node tools/build.mjs --out /tmp/eng-game.html    # 53 modules, 1 264 KB
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/eng-game.html --sizes 1366x768 --parts H
node -e "import('./src/rules.js').then(async (R) => { const { CONTENT } = await import('./src/content/index.js');
  let s = R.step(R.newRun({ classId: 'mage', seed: 3, content: CONTENT }), { type: 'START_RUN' }).state;
  console.log(R.heatView(s)); while (s.phase !== 'ENDED') s = R.step(s, R.autoAction(s)).state; console.log(s.result.summary.heat); })"
```

## Known issues
- The default autoplay policy stays Clear: it leaves each zone at the exit level. Heat rewards show up only for
  bots or players who spend time; B55-B57 need the Sim Engineer's heat-seek and heat-avoid policies.
- Contract rewards × (1 + HEAT_GAIN) (H.5) wait for contracts (2b.5).
- The browser client has no meter yet (UI task). The engine side is ready.
