# Architecture and code map

Owner: Technical Writer. Audience: the owner and every agent who needs to find code later. Rules authority is docs/specs/rules.md ("rules N" below means its section N). The engine contract is docs/specs/engine-api.md. A test (qa/docs/code-map.test.mjs) fails when a `.js`/`.mjs` file under src/, sim/ or tools/ is missing from the file table in section 2, or when the table lists a file that does not exist. Add a row whenever you add a file.

## 1. Overview and data flow

The game is a turn-based classic-MMO-feel roguelike. All rules live in a pure, seeded JavaScript engine (`src/rules.js` plus `src/engine/*`, numbers in `src/constants.js`) that has no DOM, clock or `Math.random`, so the same files run in Node and in the browser. Game text and tables (zones, enemies, quests, item names, uniques) are plain data in `src/content/`. The visual client (`src/ui/`) never contains rules: it reads the engine state through one module (`engine-bridge.js`), offers `legalActions`, sends the chosen action to `step` and animates the returned events. The text simulator and balance tooling (`sim/`) drive the same engine through bots and write the balance report. `tools/build.mjs` bundles `src/` into the single file `game.html` that the owner plays.

```
 src/content/*.js ──► CONTENT (src/content/index.js) ─────────────┐
 src/constants.js (C: every number, data tables) ─► src/engine/* ─┤
 src/rng.js (seeded streams) ────────────────────► src/engine/* ──┤
                                                                   ▼
                                              src/rules.js  (public API: newRun, legalActions, step,
                                                autoAction, summary, mapView, serialize, metaOffers ...)
                                                   │                    │                     │
                 ┌─────────────────────────────────┘                    │                     │
                 ▼                                                      ▼                     ▼
   src/ui/engine-bridge.js  (the only UI module that                sim/lib/engine.mjs    qa/engine, qa/rules
   talks to the engine; view + actions + events)                    (sim's only gateway)  (tests, fixture content
        │        ▲                                                       │                 in qa/fixtures)
        ▼        │ localStorage: tbwcr.profile.v1 (meta profile),        ▼
   app.js ► director.js ► scene.js / hud.js /      tbwcr.history.v1   sim/bots/* ► sim/lib/runner.mjs
   screens.js / windows.js / meta.js               (run log),          ► batch.mjs + pool.mjs + worker.mjs
   tbwcr.ui.settings.v1 (settings.js)                                  ► metrics.mjs ► sim/pass.mjs ► sim/report.mjs
                                                                         ► docs/reports/balance-*.md
   Build:  src/index.html + src/ui/style.css + all imported modules
           ──► tools/build.mjs ──► dist/game.html  (or --out game.html, the Lead's release build)
```

State flow in one step: `legalActions(state)` lists concrete actions, `step(state, action)` returns `{ state, events }` (pure; `stepInPlace` for simulators), and the UI or a bot reads the new state. The meta profile (Echoes, unlocks, rules 11) is created by `newProfile()`, passed into `newRun`, updated by `applyRunToProfile` at the end of a run and returned in `state.result.profile`; the UI stores it in localStorage, the simulator builds profiles in `sim/lib/profiles.mjs`. `?mock=1` in the browser swaps the engine for `src/ui/mock-engine.js` (UI development only).

## 2. File table

Role names are those of docs/README.md. "Spec" is the rules.md section (or other doc) the file implements. Rows for qa/ are per folder.

### 2.1 src/ (engine, content, build entry)

| Path | Purpose | Main exports / entry | Spec / owner |
|---|---|---|---|
| `src/rules.js` | Public engine API; wires the engine modules together (expedition: `newRun` option `mapMode`, the expedition `mapView`; heat: the meter) | `newRun`, `legalActions`, `step`, `stepInPlace`, `isLegal`, `whyIllegal`, `autoAction`, `summary`, `serialize`, `deserialize`, `mapView`, `validateContent`, `newProfile`, `metaOffers`, `buyMeta`, helpers (`xpToNext`, `itemScore`, `bagCapacity`, `travelLevel`, `resurrectCharges`, `defaultTarget`, `V`, `xpCurve`, `diffMod`), combat v2 helpers (`engageOptions`, `engagePreview`, `isEngageRound`, `offBalance`), heat (`heatView`, `heatPreview`), `STATE_VERSION`, `C` | engine-api.md (10: expedition, 11: heat); Core Gameplay Engineer |
| `src/constants.js` | Single source of every number and data table (classes, spells, pets, talents, archetypes, opening scripts, engage options, slots, rarity, drops, consumables, boons, meta catalogue, ability templates, content ranges, region kinds, engine assumptions) | `C`-style named exports: `MAX_LEVEL`, `ZONE_COUNT`, ..., expedition `RING_NODES`, `DIM_*`, `BELL_*`, `EXPED_*`, heat `HEAT_*`, `ECHO_PER_HEAT_FIGHT`, ..., `CLASS`, `SPELL`, `PET`, `TALENT`, `ARCHETYPE`, `OPENING_SCRIPT`, `SCRIPT_ACTION`, `ENGAGE_OPTION`, `ENGAGE_OPTIONS`, `REGION_W`, `REGION_KINDS`, `META`, `CONSUMABLE`, `ENGINE_ASSUMPTION`, ... | rules 13 (table) and rules 1.7.1-1.7.2, 1.9, 2.9, 5, 6, 7.6, 7.10, 7.12, 8, 11, 12; Core Gameplay Engineer |
| `src/rng.js` | Seeded random streams (sfc32, hash32 stream seeds); expedition streams keyed by node id | `hash32`, `streamSeed`, `makeRng`, `nextU32`, `nextFloat`, `nextInt`, `weightedIndex`, `STREAM` (incl. `nodeId`, `fightId`, `lootId`, `dim`), `normaliseSeed` | rules 0 (RNG, streams), 1.9.2; Core Gameplay Engineer |
| `src/engine/actions.js` | Action table: legality checks, enumeration and application of every action (ENGAGE only in the engage round; expedition MOVE, PASS_THROUGH, TAKE_ROAD, RING_BELL and the settle step after every action) | `checkAction`, `applyAction`, `legalActions`, `NAME_MAX` | engine-api.md 3, 10; Core Gameplay Engineer |
| `src/engine/autoplay.js` | `autoAction`: autoplay combat policy (rule E in the engage round, rules 1-6) and the default policy for all other decisions (expedition: the default map policy) | `autoAction`, `autoTarget` | rules 7.9, 1.9.9; Core Gameplay Engineer |
| `src/engine/boss.js` | End boss Oruvath: setup, phases, intents and intent track, shards, crush, litany, enrage, OFF_BALANCE hooks | `makeBoss`, `onBossDamaged`, `bossStartRound`, `bossEntry`, `bossIntent`, `bossTrackView`, `interruptBoss`, `mirrorImage`, `bossAct`, `bossEndOfRound`, `SHARD_ACTION` | rules 10, 7.11, 7.13; Core Gameplay Engineer |
| `src/engine/combat.js` | Fight lifecycle (engage round), enemy creation, zone danger, enemy actions (pack roles: Signal, Bolster, ward, Bloodlust count), round resolution | `zoneDanger`, `makeEnemy`, `defaultTarget`, `breaksOnHit`, `beginRound`, `resolveRound`, `startFight`, `endFight` | rules 7.1, 7.4, 7.6, 7.10, 7.12, 7.13; Core Gameplay Engineer |
| `src/engine/content.js` | Content access helpers and structural validation (expedition: optional zone `regions`, template `family`) | `zoneContent`, `campEnemies`, `validateContent`, `SUFFIX_KEYS`, `CAMP_Z` | rules 12, 1.9.2, src/content/SCHEMA.md; Core Gameplay Engineer |
| `src/engine/damage.js` | Damage pipeline, statuses, OFF_BALANCE, Bloodlust, kills (expedition: Shardspawn rewards, XP weight), death (expedition: node and depth) and resurrection | `unitSt`, `unitLevel`, `unitAlive`, `findSt`, `hasSt`, `addStatus`, `removeStatus`, `debuffStacks`, `gainStealth`, `gainOffBalance`, `offBalanceOpen`, `bloodlust`, damage and heal functions | rules 7.2, 7.4, 7.12, 7.13, 9, 1.9.6, 1.9.8; Core Gameplay Engineer |
| `src/engine/engage.js` | Engage round: the ENGAGE action and the nine class engage options (legality, resolution, the UI's option list) | `engageAction`, `engageError`, `engageAct`, `engageOptions`, `engagePreview`, `keepsStealth`, `trapTurn` | rules 7.10; Core Gameplay Engineer |
| `src/engine/expedition.js` | Expedition map (behind `mapMode: 'expedition'`): zone graph generation (map(z)), node setup by region (nodeId(z,id)), hop distances, the Dimming's front, vision, the player-visible map view; mode helpers for both maps (node hours, grind waves, XP weight) | `generateExpZone`, `setupExpNode`, `zoneRegions`, `hops`, `angDist`, `frontAt`, `dimAt`, `dimmedAt`, `dimmedNow`, `dimmedIds`, `frontNextIn`, `zoneHours`, `visionKit`, `visionRadius`, `refreshVision`, `knowledge`, `expMapView`, `canEnter`, `isExpedition`, `grindMaxWaves`, `xpWeight`, `nodeHours`, `MAP_MODES`, `RING_START`, `NODE_COUNT` | rules 1.9; expedition.md 4-7, 9.5; Core Gameplay Engineer |
| `src/engine/heat.js` | Heat (both map modes): the line (par schedule), run heat, the four states, the Dimming's clock as the second component in expedition zones, projected Ascendancy, the meter view and the preview of hour-costing choices | `heatView`, `heatPreview`, `heatState`, `lineAt`, `runState`, `dimState`, `dimInOf`, `ascOver`, `hotter`, `heatIndex` | rules 1.7.1-1.7.2, 1.9.10; expedition.md H; Core Gameplay Engineer |
| `src/engine/items.js` | Items, drops, affixes, uniques, gold values, prices, bag | `V`, `rollDrop`, `rollGear`, `makeUnique`, `makeFixedGear`, `makeJunk`, `makeConsumable`, `itemScore`, `sellValue`, `gearPrice`, `consumablePrice`, `bagCapacity` | rules 8; Core Gameplay Engineer |
| `src/engine/map.js` | Zone map generation and node set-up (streams `map(z)`, `node(z,r,l)`), encounter composition | `generateLayout`, `generateZone`, `setupNode`, `vendorStock`, `nextLanes`, `dungeonLevels`, `contentLevel`, `clampCl`, `validEncounter`, `composeEncounter`, `pickFrom` | rules 1.3, 1.4, 2, 7.14; Core Gameplay Engineer |
| `src/engine/meta.js` | Meta profile, catalogue purchases, Echoes per run | `newProfile`, `metaOffers`, `buyMeta`, `profileHash`, `echoes`, `applyRunToProfile` | rules 11; Core Gameplay Engineer |
| `src/engine/nodes.js` | Run flow outside combat: run start, zones, hubs, map moves, node types, rewards, loot window, vendor, trainer, camp, boss start, run end; expedition moves, hub revisits, Dimmed encounters, Roads, the Homeward Bell and the settle step | `startRun`, `enterZone`, `travelOn`, `travelLevel`, `restEffect`, `openService`, `leaveService`, `addHours`, `newStats`, `availablePets`, `zoneAddPool`, `moveTo`, `passThrough`, `canEnter`, `startDimEncounter`, `takeRoad`, `ringBell`, `settleExpedition` and node handlers | rules 1, 1.9, 2, 9; Core Gameplay Engineer |
| `src/engine/progress.js` | XP, levels, rested pool, talent points, gold income | `xpCurve`, `xpToNext`, `diffMod`, `talentPointsFree`, `eventXp`, `gainXp`, `addRested`, `gainGold`, `spendGold` | rules 2.5, 4.3, 4.4, 6, 8.5; Core Gameplay Engineer |
| `src/engine/spells.js` | Player combat actions and the pet action: casting, costs, cooldowns, items in combat, interrupts and control (OFF_BALANCE), Gathered Power, flee | `spellCost`, `spellCd`, `castError`, `spellAmount`, `fleeChance`, `itemUsableInCombat`, `playerAction`, `petAction`, helpers for engage.js (`cast`, `control`, `pHit`, `base`, `addCp`, `twinFangs`, `isDamaging`) | rules 5, 6, 7.1 step 2, 7.3, 7.5, 7.7, 7.8, 7.10, 7.13; Core Gameplay Engineer |
| `src/engine/stats.js` | Character stats and derived values | `refreshDerived`, `baseStat`, `baseMana`, `rating`, `hasEffect`, `tr` | rules 4.1, 4.2, 5.5; Core Gameplay Engineer |
| `src/engine/summary.js` | Run summary and the real-time estimate (expedition: walks, passes, the Bell, the `expedition` block) | `summary`, `estSeconds` | rules 9, 3, 1.9.8; Core Gameplay Engineer |
| `src/engine/track.js` | Intent track: entries drawn when they enter the track, opening scripts and signature turns, the now-intent (control, Lay Trap, summon trigger, conditions), what the track shows | `isEngageRound`, `turnOf`, `updateTracks`, `fillTrack`, `nowIntent`, `refreshTrack`, `enemyActions`, `basicAction`, `scriptedId`, `signatures`, `assignWard`, `wardOf`, `lowestHpAlly`, `hitEst`, `controlOf`, `isSingle` | rules 7.6, 7.11, 7.12; Core Gameplay Engineer |
| `src/engine/util.js` | Small pure helpers (rounding, clone, freeze, errors); no rules | `rnd`, `flr`, `clamp`, `cloneState`, `deepClone`, `deepFreeze`, `IllegalActionError`, `fail` | rules 0 (integers); Core Gameplay Engineer |
| `src/content/index.js` | Assembles the `CONTENT` object handed to `newRun` | `CONTENT` | SCHEMA.md; Content Designer |
| `src/content/abilities.js` | Generated table: elite, rare and dungeon-boss abilities | `ABILITIES` | rules 12.4; Content Designer |
| `src/content/affix-words.js` | Generated table: affix prefixes and suffixes by stat | `AFFIX_WORDS` | rules 12.5; Content Designer |
| `src/content/camp.js` | Generated table: Camp name and texts | `CAMP` | rules 1.6; Content Designer |
| `src/content/classes.js` | Generated table: class texts, starting gear names | `CLASSES` | rules 5; Content Designer |
| `src/content/enemies.js` | Generated table: enemies per zone | `ENEMIES` | rules 12.2; Content Designer |
| `src/content/item-names.js` | Generated table: item base names per slot and tier | `ITEM_NAMES` | rules 12.5; Content Designer |
| `src/content/quests.js` | Generated table: quests | `QUESTS` | rules 12.3; Content Designer |
| `src/content/uniques.js` | Generated table: unique items | `UNIQUES` | rules 11.3; Content Designer |
| `src/content/zones.js` | Generated table: zones, hubs, themes | `ZONES` | rules 1.3, 12.1; Content Designer |

Other files in src/ that are not .js: `src/index.html` (HTML shell, the build entry), `src/ui/style.css` (all client styles, UI/UX & Visual Engineer), `src/content/SCHEMA.md` (content shape and validation rules).

### 2.2 src/ui/ (visual client, presentation only)

| Path | Purpose | Main exports / entry | Spec / owner |
|---|---|---|---|
| `src/ui/main.js` | Entry point of the client (bundled by the build); creates the `App` | none (runs on load) | UI/UX & Visual Engineer |
| `src/ui/app.js` | Orchestrator: owns bridge, scene, HUD, screens, windows; input to actions (combat v2: the engage options on keys Q, W, E and their hover preview); plays each step through the director | `App`, `flags` | combat-v2.md 10.3 (input); UI/UX & Visual Engineer |
| `src/ui/engine-bridge.js` | The only module that talks to the engine (or the mock): engine state to a plain view (combat v2: intent tracks, roles, off-balance windows, engage options, spell windows, map archetypes), UI actions to engine actions, events to UI events; profile and run history in localStorage | `Bridge`, `createBridge`, `flags`, `ENGAGE_KEYS` | engine-api.md; UI/UX & Visual Engineer |
| `src/ui/director.js` | Plays the events of one step as animation (combat rounds as beats on the step's own clock: wind-up, hit-stop, recoil, numbers, shake), then hands the view to the HUD; skip a hit or the step; combat v2 log lines (cancelled and replaced entries, off-balance, traps, Signal, Bolster) | `Director`, `planMs`, `makeInterim` | combat-v2.md 10.6; UI/UX & Visual Engineer |
| `src/ui/combat-feel.js` | Presentation timing of combat (owner feedback 2026-11-10): round pace and cap at 1x, beat lengths, spell weight from the engine's spell entry (engage options: their own weight), hit power; pure | `roundPace`, `timeline`, `spellWeight`, `hitPower`, `hitShare`, `BEAT`, `STATUS_LABEL`, `ENGAGE_WEIGHT`, `OLD_ROUND_MS`, `SLOWER` | UI/UX & Visual Engineer |
| `src/ui/scene.js` | World canvas: parallax backdrop, hero, enemies, effects (hit-stop, recoil, impact flash, charge-ups, trails, telegraph wind-ups, weighted numbers, the off-balance ring, sleep) | `Scene` | UI/UX & Visual Engineer |
| `src/ui/hud.js` | Persistent HUD: unit frames, nameplates with intent tracks, action bar (off-balance window highlight), XP bar, minimap, log, boss frame; hosts the opening ruler and the engage panel | `createHud`, `travelState`, `heroPortrait`, `petPortrait`, `conColor`, `resurrectTip`, drag helpers | rules 7.6, 10.3, combat-v2.md 10 (display); UI/UX & Visual Engineer |
| `src/ui/tracks.js` | The combat v2 display: each enemy's intent track on its nameplate (chips) and in the target frame (rows), role badges and pack-role tags, the off-balance marker, the opening ruler (rounds 1-5) and the engage panel with its hover preview | `trackChips`, `trackRows`, `entryTip`, `entriesOf`, `targetWord`, `roleBadge`, `roleTags`, `roleTip`, `offBalanceText`, `offBalanceTip`, `createRuler`, `createEngagePanel`, `OPENING_ROUNDS` | combat-v2.md 10, engine-api.md 1, 6; UI/UX & Visual Engineer |
| `src/ui/screens.js` | Centre screens by phase: class select, hub, map (node tooltips with each fight's archetypes), node dialogs, loot, vendor, trainer, shrine, summary | `createScreens`, `buildMap` | rules 1, 2, 9, combat-v2.md 10.7 (display); UI/UX & Visual Engineer |
| `src/ui/windows.js` | Toggle windows: character, bags, spellbook, talents, quest log, settings | `createWindows` | UI/UX & Visual Engineer |
| `src/ui/meta.js` | Hall of Echoes screen (meta progression between runs) | `createMeta`, `buildOaths`, `echoAmt`, `metaIcon`, `offerState` | rules 11 (display); UI/UX & Visual Engineer |
| `src/ui/tooltip.js` | Hover tooltips for spells, items, talents, statuses, nodes | `initTooltip`, `tip`, `itemTip`, `spellTip`, `talentTip`, `statusTip`, `basicTip` | UI/UX & Visual Engineer |
| `src/ui/ui-text.js` | Display text for spells, talents, statuses (combat v2: off-balance, sapped, trap), consumables, boons, classes, resurrects, zone danger, meta unlocks, Oaths, Linked, enemy roles and engage options | `spellText`, `bounceText`, `talentText`, `consumableText`, `boonText`, `petText`, `resurrectText`, `dangerRule`, `dangerBanner`, `metaEffect`, `metaReqText`, `oathEffect`, `nextRunLines`, `linkedText`, `statusEffect`, `engageText`, `DANGER_LEVELS`, `STATUS_INFO`, `ROLE_INFO`, `CONTROL_WORD`, `ENGAGE_KIND`, `CLASS_UI`, `ECHO_LINE`, `META_KIND` | rules 5, 6, 7.4, combat-v2.md 4, 6 wording; UI/UX & Visual Engineer |
| `src/ui/settings.js` | Presentation settings (animation speed, fast mode, screen shake, reduce motion), saved in localStorage | `settings` | UI/UX & Visual Engineer |
| `src/ui/util.js` | DOM and colour helpers, number formatting, emitter, wait/skip token | `h`, `add`, `clear`, `clamp`, `lerp`, `ease`, `shade`, `mix`, `rgba`, `prng`, `fmtNum`, `moneyEl`, `wait`, `SkipToken`, `emitter` | UI/UX & Visual Engineer |
| `src/ui/art-actors.js` | Characters drawn in code: humanoid and beast rigs, hawk, end boss, shards, portraits | `drawHumanoid`, `drawBeast`, `drawHawk`, `drawBoss`, `drawShard`, `drawPortrait`, `HERO_LOOKS`, `PET_LOOKS`, `enemyLook` | UI/UX & Visual Engineer |
| `src/ui/art-icons.js` | Icons drawn in code, cached as data URLs (combat v2: role badges, engage options, control marks) | `icon`, `spellIcon`, `itemIcon`, `talentIcon`, `consumableIcon`, `slotIcon`, `nodeIcon`, `statusIcon`, `abilityIcon`, `roleIcon`, `engageIcon`, `controlIcon`, `NODE_COLORS` | UI/UX & Visual Engineer |
| `src/ui/art-world.js` | Painted parallax backdrops, one theme per zone | `THEMES`, `buildBackdrop`, `drawBackdrop`, `drawForeground`, `themeForZone`, `GROUND_Y` | rules 1.3 (themes); UI/UX & Visual Engineer |
| `src/ui/mock-engine.js` | Simplified stand-in engine, only behind `?mock=1` | `createState`, `step`, `legalInfo`, `autoAction`, `data`, ... | UI/UX & Visual Engineer (development aid, not rules) |
| `src/ui/mock-data.js` | Tables for the mock engine and base text for `ui-text.js` | `SPELLS`, `TALENTS`, `STATUS_INFO`, `CONSUMABLES`, `BOONS`, `CLASSES`, `PETS` | UI/UX & Visual Engineer |

### 2.3 sim/ (simulator, bots, balance)

| Path | Purpose | Main exports / entry | Spec / owner |
|---|---|---|---|
| `sim/play.mjs` | Text play of one run, interactive or scripted, with bots and autoplay | CLI entry | M1 1.2; Simulation & Balance Engineer |
| `sim/run.mjs` | Batch mode: N seeded runs per class with one bot across worker threads | CLI entry | balance.md 1, 2; Simulation & Balance Engineer |
| `sim/pass.mjs` | Full balance pass: every cell the report needs (default trees per profile group by the switch rule, B5 fallback), campaigns, replay and throughput checks | CLI entry | balance.md 1.3, 2, 3; Simulation & Balance Engineer |
| `sim/report.mjs` | Builds the balance report (targets B1-B38, both default-tree sets with the switch rows) from a pass directory | CLI entry | balance.md 1.3, 3, 6; Simulation & Balance Engineer |
| `sim/combatpass.mjs` | Combat v2 measure: P0 planner (warm-up chain as pass stage A), masher with B50 replays, opener, tactician; cheap B1/B3 cells | CLI entry | combat-v2.md 11, 12; Simulation & Balance Engineer |
| `sim/combatreport.mjs` | Combat v2 report: B48-B54, the changed B5/B15/B16, B53, and B1/B3/B4/B6/B21, now against a before pass | CLI entry | combat-v2.md 12; balance.md 3; Simulation & Balance Engineer |
| `sim/worker.mjs` | Worker thread: plays the runs or campaigns of one task | message handler | Simulation & Balance Engineer |
| `sim/lib/engine.mjs` | The simulator's only gateway to the engine; engine helpers for bots | `R`, `C`, `CONTENT`, `STREAM`, `newRunFor`, `petsFor`, `BotRng`, `SPELL`, `TALENT`, `CONSUMABLE`, `countCons`, `hpFrac`, `manaFrac`, `legal`, `V`, `xpCurve`, `diffMod` | balance.md 1; Simulation & Balance Engineer |
| `sim/lib/params.mjs` | Bot parameters and targets (`BAL` = balance.md 6; `C2` = the sim's constants of combat-v2.md 15) and open numbers (`SIM`, incl. the recorded default trees per profile group and the opener's search budget) | `BAL`, `SIM`, `C2` | balance.md 6; combat-v2.md 15; Simulation & Balance Engineer |
| `sim/lib/trees.mjs` | Default talent tree per class and profile group: the switch rule (TREE_SWITCH_Z), the B5 fallback's best point estimate, profile groups | `treeSwitch`, `bestPointTree`, `defaultTrees`, `profileGroup` | balance.md 1.3 (M2 v5); Simulation & Balance Engineer |
| `sim/lib/policy.mjs` | Shared bot policies: talents, bar, gear, consumables, trainer, vendor, hub, camp | `makeBot`, `standardTalent`, `randomTalent`, `templateBar`, `learnOrderBar`, `lootAction`, `vendorAction`, `trainAllAction`, ... | balance.md 1.2, 1.3; Simulation & Balance Engineer |
| `sim/lib/model.mjs` | Node value model (XP, gear, gold, hours, death risk) used by the planning bots | `makeCtx`, `evalNode`, `expGain`, `innValue`, `vAt`, `copyM` | balance.md 1.1; Simulation & Balance Engineer |
| `sim/lib/risk.mjs` | Death-risk table learned from the simulator's own runs | `buildTable`, `priorTable`, `riskP`, `riskDh`, `riskType`, `newObs`, `addRecord`, `mergeObs`, `tableSummary` | balance.md 1.1; Simulation & Balance Engineer |
| `sim/lib/clone.mjs` | State copies for the tactician's look-ahead | `treeClone`, `fightClone` | balance.md 1 (tactician); Simulation & Balance Engineer |
| `sim/lib/view.mjs` | Player-visible view for look-ahead bots (hidden streams replaced, never read) and the combat v2 adapters (engage round and options, intent track, OFF_BALANCE, default target) | `playerView`, `resample`, `HIDDEN`, `isEngageRound`, `engageActions`, `engageKind`, `trackOf`, `isThreat`, `offBalance`, `defaultTarget`, `actionTarget`, `actionLabel` | combat-v2.md 3, 5, 6, 11; Simulation & Balance Engineer |
| `sim/lib/replay.mjs` | Fight replay harness: replay a fight from its first-decision snapshot with policy X for OPEN_ROUNDS rounds and Y after (B50) | `snapshot`, `replayFight`, `replayDeath`, `openerPolicy`, `OUTCOME` | combat-v2.md 11, 12 (B50); Simulation & Balance Engineer |
| `sim/lib/runner.mjs` | One run from CREATE to ENDED with a bot (B50 fight replays on masher deaths with `cell.replay`); replay check | `runWithBot`, `playRun`, `replayHash`, `cellPet` | balance.md 3 (B35, B36); combat-v2.md 11 (B50); Simulation & Balance Engineer |
| `sim/lib/recorder.mjs` | Per-run record (fights, combat v2 fight fields, node entries, summary) for the metrics | `Recorder`, `FIGHT_KINDS`, `trainAllCovered` | balance.md 3; combat-v2.md 11 (recorder); Simulation & Balance Engineer |
| `sim/lib/metrics.mjs` | Metrics of one cell from run records | `cellMetrics`, `deathStage`, `bossLossPhase`, `tensionPerZone`, `timeBudget`, `wonFightLows` | balance.md 3; Simulation & Balance Engineer |
| `sim/lib/combatchecks.mjs` | Combat v2 metrics and checks from run records: B48-B54, the changed B5, B15, B16, B53 at v2 pacing | `combatChecks`, `deathRate`, `deathRatio`, `pairedDiff`, `replayStats`, `engageShares`, `windowStats`, `firstTargetStats`, `combatMinutes`, `v2Pace`, `roundsByGroup`, `engageTable` | combat-v2.md 9, 12; Simulation & Balance Engineer |
| `sim/lib/stats.mjs` | Wilson and bootstrap intervals, medians, quantiles | `wilson`, `rate`, `quantile`, `median`, `mean`, `bootQuantile`, `medianDiff`, `diffRate` | balance.md 2; Simulation & Balance Engineer |
| `sim/lib/batch.mjs` | N runs of one cell across workers, risk table refreshed in seed blocks | `runCell`, `runCampaigns` | balance.md 1.1, 2; Simulation & Balance Engineer |
| `sim/lib/pool.mjs` | Worker pool over `node:worker_threads` | `Pool` | Simulation & Balance Engineer |
| `sim/lib/session.mjs` | One batch invocation: warm-up, runs, metrics, output files | `runBatch`, `CLASSES` | balance.md 2; Simulation & Balance Engineer |
| `sim/lib/campaign.mjs` | Campaign: consecutive runs with meta purchases | `playCampaign` | balance.md 1.4 (B31, B32); Simulation & Balance Engineer |
| `sim/lib/campaignreport.mjs` | Campaign metrics and Markdown summary | `campaignMetrics`, `campaignMetricsByClass`, `blockList`, `campaignMarkdown` | balance.md 3; Simulation & Balance Engineer |
| `sim/lib/profiles.mjs` | Meta profiles (P0, P10, PALL, ...) and the campaign purchase rule | `buildProfile`, `profileLabel`, `standardOrder`, `nextPurchase`, `campaignBuy`, `catalogueComplete` | balance.md 1.4; Simulation & Balance Engineer |
| `sim/lib/cellreport.mjs` | Markdown summary of one batch invocation | `cellMarkdown` | Simulation & Balance Engineer |
| `sim/lib/output.mjs` | Output helpers: commit hash, file writers, number and table formatting | `REPO`, `commitInfo`, `cellName`, `writeJson`, `writeJsonl`, `readJsonl`, `pct`, `num`, `table` | Simulation & Balance Engineer |
| `sim/lib/textview.mjs` | Plain-text view of state, legal actions and events for `play.mjs` | `describeState`, `describeAction`, `listActions`, `describeEvents`, `money` | M1 1.2; Simulation & Balance Engineer |
| `sim/bots/index.mjs` | Bot registry and time profiles | `createBot`, `BOT_NAMES`, `TIME_PROFILE` | balance.md 1; Simulation & Balance Engineer |
| `sim/bots/shared.mjs` | Parts shared by greedy, planner, speedrunner and tactician | `createValueBot`, `hubFull`, `excludedSpells`, `FULL_KIT` | balance.md 1; Simulation & Balance Engineer |
| `sim/bots/random.mjs` | Random bot | `createRandomBot` | balance.md 1; Simulation & Balance Engineer |
| `sim/bots/greedy.mjs` | Greedy bot (best node value per hour, no lookahead) | `createGreedyBot`, `greedyMap` | balance.md 1; Simulation & Balance Engineer |
| `sim/bots/planner.mjs` | Planner bot (path search over the visible zone map) | `createPlannerBot`, `planMap`, `exitLevelOf` | balance.md 1, 1.1; Simulation & Balance Engineer |
| `sim/bots/speedrunner.mjs` | Speedrunner bot (minimises hours to the exit level) | `createSpeedrunnerBot`, `speedMap` | balance.md 1; Simulation & Balance Engineer |
| `sim/bots/tactician.mjs` | Tactician bot (telegraph rules T1-T2, combat search; combat v2: the opener's engage search in the engage round) | `createTacticianBot`, `tacticianChoice`, `telegraphAction`, `searchChoice` | balance.md 1 (M2 v2); combat-v2.md 11; Simulation & Balance Engineer |
| `sim/bots/masher.mjs` | Masher bot: planner outside combat; strike engage, potion at AUTO_POTION_HP, biggest damage button on the default target; never reads intents | `createMasherBot`, `mashChoice`, `directDamage`, `healItem` | combat-v2.md 11; Simulation & Balance Engineer |
| `sim/bots/opener.mjs` | Opener bot: planner outside combat; beam-search plan of the first OPEN_ROUNDS rounds on a player-visible view, re-planned on surprises; autoplay rules 1-2 stand | `createOpenerBot`, `openerChoice`, `planOpening`, `openerCandidates`, `forcedAction`, `Acc` | combat-v2.md 11; Simulation & Balance Engineer |

### 2.4 tools/

| Path | Purpose | Main exports / entry | Spec / owner |
|---|---|---|---|
| `tools/build.mjs` | One-file game builder (no dependencies): bundles `src/` to a single HTML | CLI entry (`--out`, `--watch`, `--serve`, `--quiet`, `--src`) | docs/team/lead.md; Lead Developer |
| `tools/ui-check.mjs` | Headless click-through of the built game with screenshots (puppeteer-core) | CLI entry | UI/UX & Visual Engineer |

### 2.5 qa/ (one row per folder)

| Path | Purpose | Main exports / entry | Spec / owner |
|---|---|---|---|
| `qa/engine/` | Engine unit tests, one file per rules section (`s00-s01` to `s13`; `s01b` the expedition map, `s01c` heat, `s07b` combat v2), plus `api-events`, `health`, helpers and `bench.mjs` (B37 throughput) | `node --test qa/engine/` | rules 0-13, engine-api.md; Core Gameplay Engineer |
| `qa/rules/` | QA rule tests that fill the gaps of qa/engine, `api-legal`, and COVERAGE.md (rule-to-test map) | `node --test qa/rules/` | rules 1-11; Playtest & QA Lead |
| `qa/sim/` | Simulator tests: bots legal, batch reproducible, metrics, params equal balance.md, play transcript, M2 changes | `node --test qa/sim/` | balance.md; Simulation & Balance Engineer |
| `qa/docs/` | Documentation checks (this code map) | `node --test qa/docs/` | Technical Writer |
| `qa/browser/` | Browser checks of the built game (Playwright): `full-run`, `ui-checks`, `ui-regress`, `pace`, plus `playtest` and `policy` (the QA player through the engine API) | `node qa/browser/<file>.mjs` | qa/plan-m1.md; Playtest & QA Lead |
| `qa/fixtures/` | Minimal fixture content for engine tests | `CONTENT` in `content-min.js` | SCHEMA.md; Playtest & QA Lead |

## 3. Where does X live

| Concept | Files |
|---|---|
| Combat pipeline (round order, damage, statuses) | `src/engine/combat.js` (`resolveRound`, `beginRound`), `src/engine/damage.js` (rules 7.2), `src/engine/spells.js` (player and pet actions) |
| Intents and the intent track (what enemies will do in their next turns) | `src/engine/track.js` (`updateTracks`, `nowIntent`, opening scripts); boss `src/engine/boss.js` `bossIntent`, `bossTrackView`; display `src/ui/tracks.js` (nameplates, target frame, opening ruler, engage panel) through `src/ui/engine-bridge.js` `convTrack` |
| Engage round, off-balance windows (combat v2) | `src/engine/engage.js` (ENGAGE, options), `src/engine/track.js` `isEngageRound`; OFF_BALANCE in `src/engine/damage.js` (`gainOffBalance`, step 6, crit, dodge) and its triggers in `spells.js` (`interrupt`, `control`), `combat.js` (avoided heavy), `track.js` (control at turn start), `boss.js`; rule E in `autoplay.js` |
| Talents | data `src/constants.js` (`TALENT`); effects read through `hasEffect` in `src/engine/stats.js` and used in `spells.js`, `damage.js`; points `src/engine/progress.js`; UI `src/ui/windows.js`, `tooltip.js` |
| Loot and items | `src/engine/items.js` (drops, affixes, uniques, prices, bag); tables in `src/constants.js` (`DROP_TABLE`, `RARITY`, `SLOT`); names in `src/content/item-names.js`, `affix-words.js`, `uniques.js`; loot window in `src/engine/nodes.js` |
| Map generation | `src/engine/map.js` (`generateLayout`, `generateZone`, `setupNode`); visible part `mapView` in `src/rules.js`; drawing `src/ui/screens.js` `buildMap` |
| Expedition map (rules 1.9: zone graph, regions, vision, the Dimming, Roads, the Homeward Bell) | `src/engine/expedition.js` (generation, vision, Dimming math, `expMapView`); flow in `src/engine/nodes.js` (`moveTo`, `passThrough`, `startDimEncounter`, `takeRoad`, `ringBell`, `settleExpedition`); actions in `actions.js`; default map policy in `autoplay.js`; tests `qa/engine/s01b-expedition.test.mjs` |
| Heat (the meter: line, heat, states, the Dimming's clock; previews) | `src/engine/heat.js` (`heatView`, `heatPreview`), exported by `src/rules.js`; constants `HEAT_*` in `src/constants.js`; tests `qa/engine/s01c-heat.test.mjs` |
| Zone danger | `src/engine/combat.js` `zoneDanger`, used by `makeEnemy`; constants in `src/constants.js` |
| Boss phases | `src/engine/boss.js` (rules 10); constants `BOSS_*`, `P2_AT`, `P3_AT` in `src/constants.js`; boss frame `src/ui/hud.js`; sprite `art-actors.js` `drawBoss` |
| Meta / Echoes / Oaths | `src/engine/meta.js`, `META` table in `src/constants.js`; screen `src/ui/meta.js`; profile storage `src/ui/engine-bridge.js`; simulator profiles `sim/lib/profiles.mjs` |
| Autoplay | `src/engine/autoplay.js` (`autoAction`, rules 7.9); toggle `SET_AUTOPLAY` in `actions.js`; time estimate `src/engine/summary.js` |
| Zone flow, hubs, services, camp, run end | `src/engine/nodes.js` |
| Character stats, XP, levels | `src/engine/stats.js`, `src/engine/progress.js` |
| Random streams, determinism | `src/rng.js`, `STATE_VERSION` and `serialize` in `src/rules.js` |
| Content validation | `src/engine/content.js` `validateContent`; schema `src/content/SCHEMA.md` |
| Bots | `sim/bots/*`, shared policies `sim/lib/policy.mjs`, value model `sim/lib/model.mjs`, death-risk table `sim/lib/risk.mjs` |
| Batch runs | `sim/run.mjs`, `sim/lib/batch.mjs`, `pool.mjs`, `worker.mjs`, `session.mjs` |
| Balance report | `sim/pass.mjs` (data), `sim/report.mjs` (report), `sim/lib/metrics.mjs`, `stats.mjs`; targets in `sim/lib/params.mjs` (mirror of balance.md 6); output `docs/reports/balance-*.md` |
| Build | `tools/build.mjs`, entry `src/index.html`, output `dist/game.html` or `game.html` |
| UI animation and feel | `src/ui/director.js`, `scene.js`, `settings.js` |

## 4. How to run

Node 22 is used (directory arguments to `node --test` resolve to each folder's `index.js`). The repo has no dependencies; browser checks need Playwright from outside the repo.

| What | Command |
|---|---|
| Engine tests | `node --test qa/engine/` |
| QA rule tests | `node --test qa/rules/` |
| Simulator tests | `node --test qa/sim/` |
| Code-map test | `node --test qa/docs/` |
| All suites | `node --test qa/engine/ qa/rules/ qa/sim/ qa/docs/` |
| Throughput benchmark | `node qa/engine/bench.mjs [runsPerClass]` |
| Text play (interactive) | `node sim/play.mjs --class mage --seed 42 [--pet ridgewolf] [--profile fresh]` |
| Text play (scripted) | `node sim/play.mjs --class mage --seed 42 --script run.txt [--transcript out.md] [--finish auto]` |
| Batch | `node sim/run.mjs --bot planner --class all --runs 500 --seed-start 1 --profile fresh --out sim/out/test` |
| Balance pass | `node sim/pass.mjs --out sim/out/pass-YYYY-MM-DD [--runs 2000] [--stages A,B,C,D,E,F] [--resume]` |
| Balance report | `node sim/report.mjs --in sim/out/pass-YYYY-MM-DD --out docs/reports/balance-YYYY-MM-DD.md [--before <earlier report>]` |
| Build | `node tools/build.mjs` (to `dist/game.html`), `node tools/build.mjs --out game.html` (Lead's release), `--watch`, `--serve [port]` for unbundled development |
| Browser checks | build first: `node tools/build.mjs --out /tmp/qa-game.html`; then `NODE_PATH=/opt/npm-tools/node_modules node qa/browser/full-run.mjs --file /tmp/qa-game.html`, and likewise `ui-checks.mjs`, `ui-regress.mjs`, `pace.mjs` |
| QA player, headless | `node qa/browser/playtest.mjs [--classes rogue,mage,hunter] [--seeds 1-20] [--trace]` |
| UI screenshots | `NODE_PATH=/opt/npm-tools/node_modules node tools/ui-check.mjs` (see the header of the file for the Chrome and puppeteer setup) |

Batch and pass outputs go under `sim/out/` (ignored by git, see `sim/.gitignore`). Each script's header comment lists every option.

## 5. Doc map

| Doc | Holds |
|---|---|
| docs/README.md | Team handbook, roles, file ownership, rules for all agents |
| docs/BRIEF.md | What we are building (owner-approved) |
| docs/KICKOFF.md | Kick-off prompt and first instructions |
| docs/specs/rules.md | Rules authority: sections 0-13, constant table in section 13 |
| docs/specs/balance.md | Bots, metrics and balance targets B1-B37, bot constants (section 6) |
| docs/specs/changes-m2-v2.md, changes-m2-v3.md, changes-m2-v4.md | Per-version change lists from the balance pass (what changed in rules, bots, targets) |
| docs/specs/engine-api.md | Engine functions, actions, state fields, events (the contract for UI, sim and QA) |
| docs/content-draft.md | Early content draft by the Content Designer |
| src/content/SCHEMA.md | Shape and validation rules of the content tables |
| docs/DECISIONS.md | Every decision with reason and status |
| docs/STATUS.md | One page: where we are, next tasks, blockers, build |
| docs/MILESTONES.md | Milestones, tasks, done-when lines |
| docs/OWNER.md | Tasks only the owner can do |
| docs/team/*.md | Role files (lead, designer, engineer, ui, sim, qa, content) |
| docs/handoffs/*.md | Hand-off notes per role and date; `screens/` and `qa-screens/` hold screenshots |
| docs/reports/*.md | Reports to the owner; `balance-*.md` are the generated balance reports |
| docs/feedback/*.md | Owner feedback written down by any chat |
| qa/plan-m1.md, qa/bugs.md, qa/rules/COVERAGE.md | QA test plan, bug list, rule-to-test coverage map |
| docs/ARCHITECTURE.md | This code map |
