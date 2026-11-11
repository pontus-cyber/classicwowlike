# Engine API (src/rules.js)

Owner: Core Gameplay Engineer. Audience: UI/UX Engineer, Simulation & Balance Engineer, QA.
Status: M1 1.1, 2026-11-09; updated 2026-11-09b (rule helpers on the API, `hpLost`, `regen`, level-up gains,
no heal events of 0, boss counters); 2026-11-10 (M2 v3: `resurrectCharges`, rounded Echo lines, Ricochet Bolt
bounce data in `spellInfo`, older meta ranks); 2026-11-10b (M2 v4: `bossPar`, `zoneDanger`, Wayfinder removed, owned ids
not in the catalogue ignored); 2026-11-10c (M2 v5: Starforged Arms removed, `state.meta` without `starforged`);
2026-11-10d (combat v2, rules 7.10-7.13: intent tracks, the engage round and `ENGAGE`, OFF_BALANCE, pack roles,
`STATE_VERSION` 2; marked "(combat v2)"); 2026-11-10e (expedition map, rules 1.9: `mapMode`, `MOVE`, `PASS_THROUGH`,
`TAKE_ROAD`, `RING_BELL`, the expedition `mapView`; section 10; marked "(expedition)"); 2026-11-10f (heat, rules
1.7.1-1.7.4 and 1.9.10: `heatView`, `heatPreview`, the node's entry state, `xp` and `gold` `heat`, the summary's
`heat` block; section 11; marked "(heat)"); 2026-11-10g (combat v2.1, rules 7.10 and 7.12: wind-ups on the signature
turns, the EMPOWERED and STAGGERED stacks with the `empower` and `stagger` events, Disrupt; marked "(combat v2.1)");
2026-11-11 (dev tools, owner feedback 2026-11-11 07:41: `debug`, section 12, a dev-only API; marked "(dev)"); 2026-11-11b (owner feedback 08:11 and 08:14: `pendingTicks`, the DoT preview, section 6.1; `talentInfo`, talent
totals; marked "(preview)").
Rules authority:
docs/specs/rules.md (section numbers below refer to it).

The engine is pure and seeded (D5): no DOM, no clock, no `Math.random`, no globals. ES modules (D13); Node
runs `src/rules.js` directly and the browser loads the same files. Every number lives in `src/constants.js`
(exported as `C`). The front end never contains rules: it reads the state, offers `legalActions(state)`, sends
the chosen action to `step`, and animates the returned events.

## 1. Functions

```js
import { newRun, legalActions, step, autoAction, summary, serialize, deserialize } from './src/rules.js';
import { CONTENT } from './src/content/index.js';

let state = newRun({ classId: 'mage', seed: 12345, content: CONTENT }); // phase CREATE
({ state } = step(state, { type: 'START_RUN' }));                         // phase ZONE_HUB
const { state: next, events } = step(state, legalActions(state)[0]);
```

| Function | Returns | Notes |
|---|---|---|
| `newRun({classId, petId, name, seed, profile, content, mapMode, vision, dimming})` | state (phase CREATE) | All fields but `content` optional. `seed`: integer, normalised to uint32; the front end draws a random seed (the engine never does). `profile`: meta profile (`newProfile()` if omitted). `content` is validated (structural) and deep-frozen. (expedition) `mapMode`: `'rows'` (today's map, rules 1.4; the default) or `'expedition'` (rules 1.9, section 10); `state.mapMode` keeps it. `vision`: expedition only, `{ guide, charts, pathfinder }` booleans (Local Guide, Region Charts, Pathfinder, rules 1.9.5) until the start camp and meta buy them (2b.5). `dimming` (D50): expedition only, `false` plays the run without the Dimming (rules 1.9.6; a measurement option for B44), default `true`. Throws on invalid content/class/pet/mapMode/vision/dimming. |
| `legalActions(state)` | action[] | Every concrete legal action. `SET_NAME` and `SET_SEED` take free values and are not listed (they are legal in CREATE). |
| `step(state, action)` | `{ state, events }` | Pure: the input is never changed. Throws `IllegalActionError` (`err.code === 'ILLEGAL_ACTION'`, message names the reason) on an illegal action. |
| `stepInPlace(state, action)` | events | Same, but changes `state` in place (no copy). For simulators that own their state. |
| `isLegal(state, action)`, `whyIllegal(state, action)` | bool / string or null | Validation without applying. |
| `autoAction(state)` | action or null | Deterministic. In combat: the autoplay policy of rules 7.9. Elsewhere: a simple default policy (talents, gear, bar, hub, map, rewards, camp) so a headless run goes from CREATE to SUMMARY. `null` only in ENDED. |
| `summary(state)` | object or null | Run summary (rules 9) incl. Echoes breakdown (11.1): `echoes = { lines: [{ id, count, each, echoes }], base, oathMult, total }`; a line's `echoes` is `round(count × each)` (half away from zero, M2 v3; `each` can be fractional), `base` the sum of the lines, `total = round(base × oathMult)`. Show `echoes` per line. (heat) Line `heat`: fights won in heat ("Fights won in heat"); block `heat` (section 11.3). Available any time after START_RUN. |
| `serialize(state)` / `deserialize(str, content)` | string / state | The content tables are not saved; pass the same `CONTENT` (version is checked). |
| `mapView(state)` | object or null | What the player may see of the zone map (rules 1.4). Rare elites, traps and vendor Embers are `null` unless the profile owns Scout's Eye. Use this, not `state.zone.rows`, to draw the map. Fight nodes list one archetype per enemy: quest and elite `archetypes`, grind `archetypes` (first wave), treasure `archetypes` (the guard; `[]` unguarded, combat v2), dungeon `fights` (one archetype list per trash fight) and `bossArchetype` (combat v2). (expedition) In an expedition run: the zone graph as the player sees it (section 10.3). null outside a zone. |
| `validateContent(content, {strict})` | string[] | Content checks (src/content/SCHEMA.md). |
| `newProfile()`, `metaOffers(profile)`, `buyMeta(profile, id)` | profile / offers / profile | Meta catalogue between runs (rules 11.2). `buyMeta` throws `IllegalActionError` when not allowed. |
| `xpToNext(L)`, `talentPointsFree(state)`, `itemScore(item, classId)`, `spellCost(state, id)`, `spellCooldown(state, id)`, `fleeChance(state)` | number | Display helpers so the UI never re-implements a rule. |
| `bagCapacity(state)` | number | Bag slots: `BAG_SLOTS` + meta Deeper Pockets (rules 8.7, 11.2). In CREATE it reads the profile. |
| `travelLevel(state)` | number or null | Level from which `TRAVEL_ON` is legal in the current zone (rules 1.5): exit level - TRAVEL_EARLY_LEVELS, one lower with Swift Boots ("Travel on at level N"). After the last row TRAVEL_ON is legal at any level. null outside a zone (CREATE, Camp, run over) and in an expedition run (no level gate, rules 1.9.7). |
| `resurrectCharges(state)` | object or null | Resurrect charges (rules 9, M2 v3): `{ boon, secondBreath, ember, now, boss }`. `boon`, `secondBreath`, `ember` = charges held. `now` = the sources a death would use, in order (`'boon'`, `'second_breath'`, `'ember'`), in the current fight (out of combat: on the journey); `boss` = the same in the end-boss fight, where Second Breath is not used ("not in the final fight"). Both `[]` under the Oath of Frailty. null before START_RUN. |
| `bossPar(state)` | number | Boss time par in hours (rules 1.7, 11.5): BOSS_TIME_PAR, OATH_HASTE_HOURS less under the Oath of Haste. Ascendancy counts full ASC_STEP_HOURS past it; the Echoes speed bonus needs a kill at or under it. After START_RUN from `state.oaths`, in CREATE from the Oaths chosen so far (M2 v4). |
| `zoneDanger(level, variant = 'normal')` | number | Zone danger (rules 7.6): the damage multiplier the engine gives an enemy built from a template at `level`. `zd = 1 + ZONE_DANGER_STEP × max(0, level - ZONE_DANGER_FROM) / 10` for `'normal'` (quest, grind, Camp waves, summoned adds), `'elite'`, `'rare'`; `1 + DUNGEON_DANGER_FRAC × (zd - 1)` for dungeon `'trash'` and `'dboss'` (M2 v4: level 60 ×1.5 against ×2.0). Show `zoneDanger(...) - 1` as the extra damage; for a dungeon node use the trash level with `'trash'` and `bossLevel` with `'dboss'`. Not the end boss or the Shards. |
| `V(L)`, `xpCurve(L)`, `diffMod(d)` | number | Rule helpers for estimates (read-only): value scale V (rules 8.5; prices and gold are multiples of it), the levelling polynomial (rules 4.3, defined for every L: `xpCurve(60)` is the event-XP base at CL 60 while `xpToNext(60)` is 0), the XP level-difference modifier for `d = CL - L` (rules 4.4). |
| `spellInfo(state, id, target)` | object or null | Tooltip data: name, level, tags, resource, cost, cd, cdLeft, tl, rank, `amount` (`{kind: damage|dot|ward|heal, amount or perTick, hits, school}`, base value before level/target/crit/variance; Ricochet Bolt adds `bounces, bounceFrac, bounceAmount`: the target takes `amount`, up to `bounces` other enemies take `bounceAmount` = round(amount before rounding × bounceFrac), M2 v3 40 %), `usable` and `reason` in a fight, content flavour `text`, `window` (combat v2: the spell deals damage and `target`, or for an AoE spell some enemy, is in an OFF_BALANCE window; cost 0 under Gathered Power shows in `cost`). |
| `defaultTarget(state)` | number or null | Autoplay's default target (rules 7.9): living, not HEXED or SAPPED (combat v2), mender > caster > others, lowest HP, lowest index; an enemy that was sapped this fight (`wasSapped`) only when no other such enemy lives (D48); HEXED or SAPPED enemies only when no other is left. null outside a fight. |
| `isEngageRound(state)` | bool | (combat v2) The fight is in its engage round (rules 7.10): round 1 of every fight but the end boss. `ENGAGE` is legal only then. |
| `engageOptions(state)` | array or null | (combat v2) The engage panel (rules 7.10), null outside the engage round: one entry per class option in the order strike, control, setup: `{ id, kind ('strike'|'control'|'setup'), name, targets, spells, disrupt, reason }`. `targets`: the enemy indices it may be used on (`[null]` for no target); Pre-cast has `spells: [{ spellId, targets }]` instead (bar spells castable at 0 mana). `disrupt` (combat v2.1): the targets on which this control option is **Disrupt** (an enemy immune to control, a dungeon boss, that shows a wind-up in turns 1..INTENT_TRACK_LEN; rules 7.10): label the option "Disrupt" there; `[]` for every other option and target. `reason`: why it cannot be used at all (e.g. the only enemy is immune to control and shows no wind-up: grey it out with this text). Option data (name, turns, multipliers): `C.ENGAGE_OPTION[id]`. |
| `engagePreview(state, action)` | object or null | (combat v2) What an ENGAGE action does to the tracks, for the engage panel's hover preview (rules 7.10). No draw, so it shows nothing the player cannot see. null when the action is not legal, else `{ enemies: [{ u, cancelled, offBalance, window, pet, stagger, disrupt }] }` with turn numbers: entries it cancels (Sap, Binding Glyph, Lay Trap, Disrupt, a Pre-cast Hexbind or Rime Burst; Sap and Hexbind only while no damage breaks them, Rime Burst only if it hits), those among them that leave the enemy OFF_BALANCE (heavy or cast: "OFF_BALANCE on turn 2"), turns FROZEN (a window), turns whose single-target hits go to the pet (Send the Pet), (combat v2.1) `stagger`: the cancelled turns whose entry is a wind-up (answered: STAGGERED), `disrupt`: true when the option is a Disrupt on this enemy (its one cancelled turn is the first visible wind-up). Send the Pet answers a heavy wind-up among its `pet` turns too while the pet lives (rules 7.13 (3)); the preview lists it under `pet` only. Damage options change no entry. |
| `offBalance(state, enemyIdx)` | object or null | (combat v2) The OFF_BALANCE window on an enemy (rules 7.13): `{ status ('OFF_BALANCE', or 'FROZEN', which counts as OFF_BALANCE while it lasts), taken, crit, rounds }`; null when there is none. Highlight bar spells with `spellInfo(...).window`. |
| `pendingTicks(state, unit)` | array, object or null | (preview) The DoT preview (owner feedback 2026-11-11 08:11): what the ticks at the end of the current round (rules 7.1 step 5) will do if nothing else happens before them, one entry per unit they touch, in tick order (player, pet, enemies). With `unit` (`'player'`, `'pet'` or an enemy index): that unit's entry or null. null outside a fight. Fields and guarantees: section 6.1. |
| `talentInfo(state, talentId)` | object or null | (preview) Talent totals for the tooltip (owner feedback 2026-11-11 08:14; rules 6): `{ id, name, ranks, rank, per, now, next }`. `per`: the values one rank gives, `now`: their totals at the ranks taken (null at rank 0), `next`: at one more rank (null at the maximum). The keys are the talent's per-rank fields (`C.TALENT_PER_RANK`; the numbers stay in `C.TALENT`), e.g. Silent Footing at 3/3: `now { pct: 0.3 }`, `next` null. `base` (Toxic Coating, Trapper): the damage formula b + l × L (Trapper: the Snare Trap's training level) + p × Power, times the ranks, before modifiers, rounded to 0.1 (null without a character). Hemorrhage Mastery: `{ dotCrit, dotPct }` by rank. Any phase; null for an unknown id. |
| `heatView(state)` | object or null | (heat) The heat meter (rules 1.7.1-1.7.2, 1.9.10), in any phase after START_RUN (null before): the line, the player's heat, the state, the Dimming's clock in an expedition zone, the projected boss Ascendancy and the previews of the legal hour-costing choices. Fields in section 11. Pure and cheap. |
| `heatPreview(state, action)` | object or null | (heat) The hours an action costs and the heat after it ("2 h, ends Warm", rules 1.7.1, 1.9.10), and for an action that enters a node the state it pays at (`pays`); null when the action is not legal or costs no hours. Fields in section 11. |
| `C` | module | All constants and data tables (CLASS, SPELL, TALENT, TALENT_PER_RANK (preview), PET, CONSUMABLE, BOON, META, BOSS_TEXT, OPENING_SCRIPT, SCRIPT_ACTION, ENGAGE_OPTION, ENGAGE_OPTIONS, ...). |
| `debug` | object | (dev) The dev tools, section 12: build a run at any zone and level, jumps, any encounter, hours, god mode, the profile, `validate`. Not game rules; a run they change is a dev run. |

State is plain JSON except `state.content`, a shared reference to the frozen content tables (never copied by
`step`, left out by `serialize`). Compare states with `serialize`. `STATE_VERSION` is 2 since combat v2 (enemies carry
intent tracks): `deserialize` refuses a state saved by an older engine.

## 2. Phases (rules 1.1)
`CREATE -> ZONE_HUB -> MAP <-> NODE -> ... -> CAMP -> BOSS -> SUMMARY -> ENDED`

| Phase | What is going on | Typical actions |
|---|---|---|
| CREATE | class, pet, name, seed, oaths | `SELECT_CLASS`, `SELECT_PET`, `SET_NAME`, `SET_SEED`, `SET_OATH`, `START_RUN` |
| ZONE_HUB | zone hub; `state.service` may be open | `SERVICE`, service actions, `LEAVE_HUB`, out-of-combat |
| MAP | choose the next node | `CHOOSE_NODE`, `TRAVEL_ON`, out-of-combat; (expedition) `MOVE`, `PASS_THROUGH`, `TAKE_ROAD`, `RING_BELL` (section 10) |
| NODE | inside a node; `state.node.stage` = `fight`, `between`, `grindSetup`, `reward` or `service` | per stage |
| CAMP | before the boss; `state.fight` set during a camp wave | `SERVICE`, `CAMP_GRIND`, `FIGHT_BOSS` |
| BOSS | the end boss fight | combat actions |
| SUMMARY | run over (`state.outcome` = `victory` or `death`) | `END_RUN` |
| ENDED | `state.result = { summary, echoes, profile }`; store `result.profile` | none |

Fighting is indicated by `state.fight !== null` (in NODE, CAMP or BOSS). The **loot window** is
`state.loot` (items that did not fit the bag): while it is not empty, only `LOOT_TAKE`, `LOOT_DROP`,
out-of-combat actions and `SET_AUTOPLAY` are legal.

## 3. Actions
Every action is `{ type, ...fields }`. Indices are 0-based. Enemy targets are indices into `state.fight.enemies`
(dead enemies stay in the array, so indices are stable; summons are appended).

| Type | Fields | Legal when |
|---|---|---|
| `SELECT_CLASS` | `classId`: `rogue` `mage` `hunter` | CREATE |
| `SELECT_PET` | `petId`: `ridgewolf` `thornback` `duskcat` (`stormhawk` with meta) | CREATE, Hunter |
| `SET_NAME` | `name` (1-24 chars) | CREATE |
| `SET_SEED` | `seed` (integer) | CREATE |
| `SET_OATH` | `oath`: `haste` `frailty` `thrift`, `on`: bool | CREATE, profile owns `oaths` |
| `START_RUN` | | CREATE, class (and pet for Hunter) chosen |
| `SET_AUTOPLAY` | `on`: bool | always (not ENDED); changes nothing else (rules 7.1) |
| `SERVICE` | `service`: `trainer` `vendor` `inn` | ZONE_HUB or CAMP, once per visit each |
| `LEAVE` | | a service is open (at a Vendor/Trainer node this completes the node) |
| `LEAVE_HUB` | | ZONE_HUB, no service open |
| `LEARN` | `spellId` | trainer; class or unlocked meta spell, `lvl <= L`, not known, gold |
| `TRAIN` | `spellId` | trainer; known non-talent spell with `tl < L`, gold |
| `TRAIN_ALL` | | trainer; trains in bar order, then learn order, while gold lasts |
| `RESPEC` | | trainer; points spent > 0 |
| `BUY` | `index` into `state.service.stock` | vendor; gold, bag space, Ember limit |
| `SELL` | `itemId` (bag uid) | vendor |
| `SELL_JUNK` | | vendor; junk in bag |
| `CHOOSE_NODE` | `lane` 0-2 | MAP; `mapView(state).next` lists reachable lanes. Not in an expedition run |
| `TRAVEL_ON` | | MAP; level >= `travelLevel(state)` (exit level - TRAVEL_EARLY_LEVELS, Swift Boots one lower) or the last row (ZONE_CHOICE_ROWS) done (then it is the only move). Costs HOURS_TRAVEL with every profile (M2 v4: Wayfinder removed). Not in an expedition run |
| `GRIND_SET_WAVES` | `n` 1-3 | Grind node, on entry (starts wave 1). (expedition) 1-EXPED_GRIND_MAX_WAVES; with one wave the Grind starts it on entry and this stage is skipped |
| `NEXT_FIGHT` | | between Grind waves or Dungeon fights |
| `GRIND_STOP` | | between Grind waves |
| `DUNGEON_LEAVE` | | between Dungeon fights |
| `CHOOSE_REWARD` | `index` | `state.node.rewards[0]` (quest items, story items or shrine boons) |
| `LOOT_TAKE` / `LOOT_DROP` | `itemId` | loot window |
| `CAMP_GRIND` | | CAMP, no service open |
| `FIGHT_BOSS` | | CAMP, no service open |
| `END_RUN` | | SUMMARY |
| `EQUIP` | `itemId` (bag or loot window) | out of combat |
| `UNEQUIP` | `slot` | out of combat, bag space |
| `DISCARD` | `itemId` (bag) | out of combat |
| `USE_ITEM` (out of combat) | `itemId`: consumable id, e.g. `trail_rations` | out of combat |
| `SET_BAR` | `slot` 0-6, `spellId` or null (swaps if the spell is on another slot) | out of combat |
| `SET_ITEM_BAR` | `slot` 0-2, consumable id usable in combat or null | out of combat |
| `SPEND_TALENT` | `talentId` | out of combat; free point; tier gate (rules 6) |
| `CAST` | `spellId`, `target` (enemy index, or null for self/AoE spells) | fight; spell on the bar, off cooldown, resource, requirements |
| `ATTACK` | `target` | fight; free basic attack (Strike / Spark / Auto Shot) |
| `USE_ITEM` (in combat) | `slot` 0-2, `target` null | fight; item on the item bar, in the bag, potion cooldown |
| `FLEE` | | fight, not vs dungeon boss or end boss |
| `PASS` | | fight (the only legal combat action while Glacial Tomb skips your turn, `state.fight.p.skip`) |
| `MOVE` | `nodeId` | (expedition) MAP; a node next to the player's (`mapView(state).moves`). Enters an unresolved, non-hub, non-Dimmed node (its content and hours); else a walk of HOURS_WALK; a walk onto the hub out of the Dimming starts a hub visit (rules 1.9.4) |
| `PASS_THROUGH` | `nodeId` | (expedition) MAP; a neighbour that MOVE would enter: walk through it for HOURS_WALK, it stays unresolved |
| `TAKE_ROAD` | | (expedition) MAP, standing on a Road (`mapView(state).onRoad`): HOURS_TRAVEL, next zone's hub (zone 6: the Camp); no level gate |
| `RING_BELL` | | (expedition) MAP (not in a node, the hub screen, the Camp or at the boss), a Bell charge left: BELL_CHANNEL_H, then (after a Dimmed encounter if the node is Dimmed then) the next zone's hub; no HOURS_TRAVEL |
| `ENGAGE` | `option`, `target` (enemy index or null), `spellId` (Pre-cast only) | (combat v2) the engage round only (rules 7.10), so once per fight; `option` one of the class's `C.ENGAGE_OPTIONS[classId]`; target rules in `engageOptions(state)` (control options: on an enemy immune to control only as Disrupt, while its track shows a wind-up in turns 1..INTENT_TRACK_LEN, combat v2.1; Send the Pet: a live pet). Key order as listed: `{ type, option, target }`, Pre-cast `{ type, option, spellId, target }` |

One combat action resolves one full round (rules 7.1): player action, pet, enemies in index order, end of
round (then a Signal reinforcement joins), then the next round's intents are shown from the intent tracks. The
events list covers all of it. Round 1 of every fight but the end boss is the engage round (combat v2): enemies are
Unaware and do not act; `CAST`, `ATTACK`, `USE_ITEM`, `PASS`, `FLEE` and `ENGAGE` are legal.

## 4. State fields the front end reads
| Path | Meaning |
|---|---|
| `phase`, `hours`, `autoplay`, `oaths`, `outcome` | run level |
| `player.{name, classId, level, xp, rested, hp, mana, gold}` | character; XP bar max: `xpToNext(level)` (0 at 60) |
| `player.d.{maxHp, maxMana, power, crit, critMult, dodge, armor, wd, STA, AGI, INT, SPI, regenPct, petMaxHp}` | derived values (rules 4.2), refreshed by the engine |
| `player.spells[id] = {tl, rank}`, `player.spellOrder`, `player.bar[7]`, `player.itemBar[3]` | spells and bars |
| `player.talents[id] = rank`, `player.talentSpent` | talents; unspent points: `talentPointsFree(state)` |
| `player.equipped[slot]`, `player.bag[]` | items (see below) |
| `player.buffs.{insight, fury, elixir} = {left, active}` | node-timed buffs; `active` while inside a node |
| `player.res.{boon, meta}`, Embers in the bag | resurrect charges (rules 9); `meta` = Second Breath, not used in the end-boss fight. Use `resurrectCharges(state)` for what a death would use |
| `player.pet = {id, hp, alive}` | Hunter pet |
| `zone` | current zone; draw it with `mapView(state)` |
| `hub.used.{trainer, vendor, inn}` | hub/camp services used this visit |
| `service = {kind, where, cl, stock}` | open trainer or vendor; vendor `stock[i] = {kind: 'cons'|'gear', id or item, price, sold, unlimited}` |
| `node = {type, r, l, cl, stage, k, rewards, quest, planned, wavesDone, heat}` | current node ((expedition) `id` instead of `r`, `l`; section 10.2). (heat) `heat`: the heat state the node was entered in, which it pays at (rules 1.7.3); a Dimmed encounter has none |
| `fight` | see section 6 |
| `loot[]` | loot window |
| `stats`, `death` | counters for the summary (combat v2: `stats.engages` = fights with an engage round; heat: `stats.heat` = the summary block's counters, read `summary(state).heat`); death location (rules 9) |

Items: gear `{uid, kind: 'gear', slot, rarity, ilvl, name, stats: {AGI, INT, STA, SPI}, power, crit, armor,
bonusArmor, wd, affix, unique, effect}`; consumable stack `{uid, kind: 'cons', id, qty}`; junk
`{uid, kind: 'junk', name, level, qty}`. Item score for the upgrade arrow: rules 8.3 (`ITEM_SCORE`).

## 5. Events
`step` returns `events`, in order. Units: `'player'`, `'pet'` or an enemy index (number).

| `t` | Fields | Meaning |
|---|---|---|
| `phase` | `phase` | phase changed |
| `runStart` | `classId, petId, seed, oaths` | |
| `zone`, `camp`, `travel` | `z, name` / `name` / `from` | zone hub entered / camp / TRAVEL_ON. (expedition) `travel` adds `by` (`road` or `bell`), `node` and `road` (D51: the Road's content name, null by the Bell or without names) |
| `hours` | `add, total, why` | in-game hours spent |
| `node`, `nodeDone`, `quest` | `type, r, l, cl, heat` / ... / `quest` | node entered / completed / quest template id. (expedition) `node`: `type, id, ring, cl, heat`; `nodeDone`: `type, id`. (heat) `heat`: the node's entry state (rules 1.7.3) |
| `move` | `from, to, via, seen` | (expedition) a step: `via` `enter`, `walk` or `pass`; `seen` = node ids newly in view |
| `dimming` | `front, dimmed` | (expedition) the Dimming's front advanced; `dimmed` = node ids it newly covers |
| `dim` | `id, depth, level, k` | (expedition) a Dimmed encounter starts at node `id` (its `fight` event follows, `kind: 'dim'`) |
| `bell` | `charges, node` | (expedition) RING_BELL: the channel starts (`charges` left) |
| `service`, `serviceClosed` | `service, where` | |
| `rest` | `hp, mana, rested` | Rest node or Inn |
| `fight` | `kind, k, engage, heat, enemies[{u, name, level, hp, kind, arch}]` | fight started (`kind`: quest grind elite trash dboss treasure camp boss, (expedition) dim; `engage`: it has an engage round, combat v2). A Dimmed encounter's enemies have `kind: 'shardspawn'`. (heat) `heat`: the node's entry state, null for Camp waves, the boss and Dimmed encounters |
| `round` | `n`, `engage` (true in the engage round, combat v2) | a new round starts (intents follow) |
| `intent` | `u, intent` | enemy intent for this round (section 6); the tracks are in the state |
| `action` | `kind` (`cast` `attack` `item` `pass` `flee` `skip` `engage`), `spell, target, cost, item, success, option, engage` | player action. Combat v2: `kind: 'engage'` with `option` and `target` for an ENGAGE; a Pre-cast is `kind: 'cast'` with `engage: 'precast'` and `cost` 0. Combat v2.1: a Disrupt adds `disrupt: true` (log "Disrupt: <boss> will miss <wind-up>") |
| `cancel` | `u, id, name, by, turn, offBalance` | (combat v2) control (`by`: STUN FROZEN HEXED SAPPED) cancelled the enemy's entry `id` this turn; `offBalance`: a heavy or cast, so it is now OFF_BALANCE. Log: "Heavy Smash cancelled: stunned -> off-balance" |
| `replace` | `u, turn, from, fromName, to, toName, reason` | (combat v2) the now-entry could not be played and became the basic attack (rules 7.11) |
| `offBalance` | `u, why, id, name, dur` | (combat v2) the enemy is OFF_BALANCE (`why`: `interrupt`, `control`, `avoided` = a heavy that cost you 0 HP); the status event follows the rules of 7.4 |
| `stagger` | `u, id, name, turn, why, by, stacks, value` | (combat v2.1) a wind-up of enemy `u` (action `id`, `name`, its `turn`) was answered (rules 7.12): it gained a STAGGERED stack (its `status` event comes first); `stacks` = STAGGERED stacks now, `value` = stacks × STAGGER_DMG (its damage dealt less). `why`: `interrupt` (an interrupt, a stun-tagged spell or control stopped it during the round; `by` = the spell or engage option id), `control` (STUN, FROZEN, HEXED or SAPPED cancelled it at its turn's start; `by` = the status), `trap` (a laid trap sprang on it; `by` `STUN`), `disrupt` (Disrupt's trap; `by` `STUN`), `silenced` (replaced by the basic attack; `by` `SILENCED`), `avoided` (a heavy one that cost the player 0 HP; `by` null). Log: "Wind-up answered: staggered" |
| `empower` | `u, id, name, turn, stacks, value` | (combat v2.1) a wind-up of enemy `u` (its `turn`) landed (rules 7.12): its hit or rend cost the player or the pet HP, or a cleave, curse, self_heal or self_shield was played; it gained an EMPOWERED stack (its `status` event comes first); `value` = stacks × EMPOWER_DMG. Not sent when that hit ended the fight (the player died). Log: "Wind-up landed: empowered" |
| `trapSprung` | `u, turn, disrupt` | (combat v2) Lay Trap springs (a STUN status and a `cancel` follow); (combat v2.1) `disrupt: true` for Disrupt's trap (then a `stagger` with `why: 'disrupt'`) |
| `signal` | `u, adds` | (combat v2) a skulker's Signal: `adds` enemies join at the end of the round (`summon` with `signal: true`) |
| `petAction` | `target` | |
| `enemyAction` | `u, id, name` | an enemy performs its intent |
| `damage` | `src, dst, amount, hpLost, absorbed, spell, crit, school, tick, immune, sidestep` | see "Damage amounts" below |
| `miss` | `src, dst, spell, dodge` | miss or dodge |
| `heal`, `mana` | `dst, amount, spell` / `amount, spell` | `amount` = HP (mana) restored. Sent only when something is restored (`amount > 0`): a potion, HOT tick or ration at full health, or Mana Siphon at full mana, sends none. |
| `status` | `u, id, on, dur, stacks, src` | status applied (`on: true`) or removed |
| `interrupt`, `skip` | `u, by` | cast interrupted / Chrono Sigil |
| `channel` | `u, name, step` | boss Litany channel step |
| `summon`, `despawn`, `linked` | `u, name, hp, by, signal` / `u` / `on, n` | adds, Shards (`signal: true` for a Signal reinforcement, combat v2), Linked on/off. `linked` is sent when a Shards wave comes (`on: true`) and when the last Shard dies or Shards despawn (`on: false`); `n` = living Shards then. The boss takes `-min(LINK_DR, LINK_DR_PER_SHARD × n)` (rules 10.2); between events, count the living Shards in `state.fight.enemies` |
| `shield`, `enrage`, `image` | `u, amount, by, spell` / ... | enemy shield (`u` = the shielded enemy; Bolster: `by` the mender, `spell: 'bolster'`, combat v2), enemy enrage, Mirrorshade image |
| `phaseChange` | `phase` | boss phase 2 or 3 |
| `death` | `u, name` | enemy, pet or player died |
| `resurrect` | `source` (`boon` `second_breath` `ember`), `hp, mana` | `hp`, `mana`: the player's values after the resurrect (RES_HP_PCT, RES_MANA_PCT). Never `second_breath` in the end-boss fight (M2 v3) |
| `xp` | `amount, rested, why, heat` | (heat) `heat` (only when > 0): the part of `amount` that heat added (rules 1.7.3) |
| `levelUp` | `level, talentPoint, hpGain, manaGain, petHpGain, maxHp, maxMana, petMaxHp` | one per level gained. Current HP, mana and pet HP (live pet) rise by the max gains (rules 4.3); `*Gain` = what was added, `max*` = the new maxima (`maxMana` 0 without mana, `petMaxHp` 0 without a pet) |
| `gold` | `amount, why, heat` | negative when spent. (heat) `heat` (only when > 0): the part of `amount` that heat added |
| `loot` | `item, to` (`bag` or `window`) | |
| `victory`, `fled` | `kind, rounds` | fight over |
| `regen` | `pct, hpGain, manaGain, petHpGain` | post-fight regen (rules 4.2) after a won fight, right after `victory`: `pct` of each maximum, capped at the maximum; `*Gain` = what was restored. Not sent when nothing was restored (or after `fled`) |
| `petRevive` | `hp, spell` | |
| `questComplete`, `story`, `dungeonClear`, `dungeonLeft` | | |
| `boon`, `trap`, `buffEnd` | `id, name` / `amount` / `id` | |
| `learn`, `train`, `respec`, `talent`, `buy`, `sell`, `equip`, `unequip`, `discard`, `bar`, `itemBar`, `useItem`, `lootDropped`, `autoplay` | | bookkeeping |
| `bossStart` | `asc, hours, level` | |
| `runEnd`, `echoes` | `outcome` / `total` | |

**Damage amounts.** The pipeline rolls a hit (rules 7.2); absorbs come off it, in this order: IMMUNE (all),
WARD or an enemy's shield, Mindguard, the Shared Wounds share (sent as its own `damage` event on the pet,
`spell: 'shared_wounds'`).
- `amount`: damage after absorbs, **not** capped at the HP the target had: the number to float. On a killing
  blow it can exceed the HP left (overkill = `amount - hpLost`).
- `hpLost`: HP the target actually lost, `min(amount, HP before)`. Use it to track HP; run stats
  (`dmgDealt`, `spellDmg`) count it.
- `absorbed`: taken by WARD, a shield or Mindguard (not part of `amount`). IMMUNE: `amount` 0, `hpLost` 0,
  `immune: true`. Death's Sidestep: `amount` 0, `hpLost` 0, `absorbed` = the hit, `sidestep: true`.

**Tracking the player's HP from events.** Within a step, from the HP before it: `- hpLost` (`damage` on
`'player'`), `+ amount` (`heal` on `'player'`), `+ hpGain` (`levelUp`, `regen`), `= hp` (`resurrect`, `rest`),
`- amount` (`trap`). A test checks this for every combat step of full runs (qa/engine/api-events.test.mjs).
Out of combat, equipping, talents and Boon of Mending change HP without an HP field: read the state there.

## 6. Fight state and intents
`state.fight = { kind, round, enemies[], canFlee, boss, p, pet, engage, startCount, signalled, heat }` (combat v2: `engage`
= the fight has an engage round, `startCount` = enemies at fight start, `signalled` = a Signal was given; heat: `heat` =
the node's entry state, null outside a node that pays heat).
- `fight.p = { st[], cds{spellId: readyRound}, cp, energy, focus, potionReady, skip, ... }`: the player's
  statuses, cooldowns (usable when `round >= cds[id]`), combo points, energy/focus. Mana is `player.mana`.
- `fight.pet.st[]`: pet statuses (TAUNT).
- Enemy: `{ idx, tid, name, kind, arch, level, hp, maxHp, armor, dodge, st[], intent, alive, elite, boss, shield }`;
  combat v2 adds `turn` (its current turn, 0 before turn 1), `turn0` (round of its turn 1), `track` (below), `acted`
  (turns it acted; a beast's Bloodlust is `min(BLOODLUST_MAX, BLOODLUST_STEP × acted)`), `ward` (a guardian's ward
  index or null; draw the link on both frames), `unscripted` (summons, Signal adds, Shards, end boss), `noReward`
  (Signal adds: no XP, coin or loot), `wasSapped` (Sap landed on it this fight; the default target keeps off it while
  another enemy lives, D48). `dmg` includes zone danger and ENGAGE_DMG_COMP (not in the Rogue's fights except its dungeon-boss fights, D48,
  D49).
- Status object: `{ id, dur (rounds left, null = no expiry), stacks, value, tick, amount, src }`: `tick` is the
  damage per tick of BLEED, BURN and POISON; `amount` is the heal per tick of HOT and what is left of a WARD.
  Combat v2 statuses: enemy `OFF_BALANCE` (`value` = extra damage taken; window, rules 7.13), `SAPPED`, `TRAP`
  (`turn` = the turn it springs on, `stun`); player `GATHER` (`stacks` = spells left, `value` = crit bonus); pet
  `PET_LEAD` (`value` = damage taken less). Combat v2.1: a Disrupt's `TRAP` has `disrupt: true` and `stun` 1 (rules 7.10). Combat v2.1 (rules 7.12): enemy `EMPOWERED` and `STAGGERED`, the lasting
  result of its wind-ups: `{ id, dur: null, stacks, value }`, one stack per wind-up landed or answered, no cap, no
  expiry (gone with the fight); `value` = stacks × EMPOWER_DMG (damage dealt more) or stacks × STAGGER_DMG (damage
  dealt less), both in its 7.2 step 2 sum, so its hits and every shown `est` include them. Badge them on the frame
  ("+15 % damage", "-30 % damage").

**Intent track (combat v2, rules 7.11).** `enemy.track` holds INTENT_TRACK_LEN entries, oldest first: the entry of
the current turn ("now") and the next turns; before turn 1 (engage round, an add that just appeared) turns
1..INTENT_TRACK_LEN. Entry: `{ turn, id, name, kind, cast, heavy, school, hits, pct, cd, scripted, aggro, target,
est, cancel, windup }`: `scripted` = from the opening script or a signature turn (rules 7.12), `aggro` = the drawn pet-aggro target
(fixed), `target` and `est` = what to show, recomputed from the current state every round (TAUNT and feign that
will still run on that turn show `'pet'`; Mend and Bolster show the lowest-HP ally now; Shield Ally the ward).
`windup` (combat v2.1; only on wind-ups): the entry is a wind-up (rules 7.12), the signature of an elite, rare or
dungeon boss on SIGNATURE_TURN and a dungeon boss's second on SIGNATURE_TURN_2, set when the entry enters the track,
so it shows from the engage round on. A wind-up always has `cast: true` (every interrupt, stun-tagged spell or
control stops it, also on a dungeon boss); `heavy` stays as the ability has it (a heavy one is also answered by a full
dodge, WARD, Mirrorshade or the pet by TAUNT). Badge: "Wind-up" with what answers it.
`cancel` (D52) = what will cancel the entry when it becomes now, recomputed every round, or null: `{ by, offBalance,
stagger, breaks, done }`. `by`: `STUN`, `FROZEN`, `HEXED`, `SAPPED` (a control status still on at the start of that turn's
round) or `TRAP` (a laid trap's STUN covers that turn; the intent then says STUN); `done`: the now-entry, already
cancelled (`intent.cancelled`); `breaks`: HEXED and SAPPED end on any damage, so the prediction holds only while the
enemy takes none (draw it softer); `offBalance`: the entry is a heavy or a cast, so the cancel leaves the enemy
OFF_BALANCE; `stagger` (combat v2.1): the entry is a wind-up, so the cancel answers it (STAGGERED). Not predicted: what
the player has not done yet (an interrupt, new control). End boss entries: always null (immune to control). Read this
instead of inferring from statuses.
Entries never change once shown, except what they show; a new one is appended each round. `enemy.intent` is the
now-entry as it will be played (below). The engage round's intents are Unaware.

End boss track: entries `{ turn (= round), aggro, target, actions[], cast, heavy, est, brand, shards, ifPhase,
alt }`: `actions` as in the boss intent (the first entry is this round's intent), `brand` = a BRAND stack at the end
of that round, `shards` = a Shards wave at its start, `ifPhase` = the next phase for later rounds while phase < 3,
and `alt` = the actions if that phase starts this round (null when they are the same).

Normal intent: `{ id, name, kind, target ('player'|'pet'|'all'|'self'|ally index), est (estimated damage or
heal), cast (interruptible), heavy (telegraphed big hit), school, hits, turn, windup (combat v2.1: a wind-up) }`. Kinds: `hit`, `rend`, `cleave`,
`curse`, `brace`, `shieldAlly`, `heal`, `selfHeal`, `selfShield`, `summon`, combat v2 `bolster`, `signal`, and `none`
(`Stunned`, `Hexed`, `Sapped`, `Unaware`). After an interrupt the intent gets `interrupted: true`; after Chrono
Sigil `skipped: true`. Combat v2: `cancelled: { by, id, name, cast, heavy }` = control (`by`: STUN, FROZEN, HEXED,
SAPPED) cancelled this turn's action: set on the intent when control lands during the round, and on the `none`
intent ("Stunned", "Hexed", "Sapped") of an enemy that is controlled when its turn starts; an entry that could not be
played was replaced by the basic attack and the intent carries `replaced: { id, name, reason }` (show "Mend -> Strike:
no wounded ally"); a summon at its HP trigger carries `replaced` too. Combat v2.1: `cancelled.windup` and
`replaced.windup` are true when the action that did not happen was a wind-up (a cancelled one, or one replaced with
reason `silenced`, was answered: a `stagger` event says so; one replaced for any other reason is neither).

Boss intent: `{ id: 'boss', kind: 'boss', actions: [...], cast, heavy, est, target, telegraph, turn }` where each
action is `{ id, name, kind, est, target, cast?, heavy?, step? }` (`umbral_strike`, `gravity_crush`,
`collapse_litany` with `step` 1 or 2, `starless_pulse`, `final_dark`), and `telegraph = { crushNextRound,
brandInRounds, litanyInRounds, shardsInRounds, pulseInRounds, enrageInRounds, phase }` (rules 10.3).

Telegraph counters are rounds from the current round; 0 = this round:

| Field | Meaning |
|---|---|
| `crushNextRound` | Gravity Crush is in next round's intent (phases 1-2) |
| `brandInRounds` | rounds until the round whose end adds a BRAND stack (0: this round's end) |
| `litanyInRounds` | rounds until a Collapse Litany channel starts (0: this round's intent has step 1) |
| `shardsInRounds` | phase 2 only: rounds until the round that starts with a Shards wave (1: next round). `null` outside phase 2 and while SHARD_MAX Shards are alive (that wave would summon none); killing a Shard brings the countdown back |
| `pulseInRounds` | phase 3 only: 0 when this round's intent has Starless Pulse, else rounds until the next Pulse |
| `enrageInRounds` | rounds until Final Dark (BOSS_ENRAGE_ROUND) |

### 6.1 DoT preview (preview; owner feedback 2026-11-11 08:11)
`pendingTicks(state)` answers "what will the ticks at the end of this round do?" so the HP bars can mark the HP that
pending DoTs will take, and whether that kills (Slay the Spire style). It plays the engine's own tick phase (rules 7.1
step 5, `tickPhase` in src/engine/combat.js) on a copy of the state, so the numbers are exact for that phase: BLEED, BURN
and POISON (tick × stacks; no miss, no armor, rules 7.2) and BRAND, after IMMUNE (and god mode), WARD or an enemy's shield,
Mindguard, the Shared Wounds share (it shows as damage on the pet's entry, `spell: 'shared_wounds'`) and Death's Sidestep;
HOT ticks (and Veiled Recovery) heal in the status order; a death ends the fight at once (no later tick), and an enemy
killed by a tick spreads Plague Heart before the later enemies tick. It draws nothing and reveals no draw: a tick that
can crit (Hemorrhage Mastery) is counted without the crit, and `crit` gives the same numbers with every such tick a crit.
Not counted: what happens earlier in the round (the player's action, the pet, the enemies' actions, new statuses). Shown
at the start of a round, the entry is what the ticks do when the round changes nothing that unit's ticks read.

Entry: `{ u, hp, amount, hpLost, absorbed, heal, hpAfter, lethal, resurrect, ticks, crit }`.
| Field | Meaning |
|---|---|
| `u` | `'player'`, `'pet'` or an enemy index |
| `hp` | HP now |
| `amount`, `hpLost`, `absorbed` | the sums of its `damage` events in the tick phase (section 5 "Damage amounts"): damage after absorbs, HP lost, absorbed |
| `heal` | HP healed in the tick phase (HOT, Veiled Recovery, a kill heal, Death's Sidestep) |
| `hpAfter` | HP after the tick phase (0 for a unit that died; the player after a resurrect: the resurrect HP). Mark `hp - hpAfter` on the bar when it is positive |
| `lethal` | the unit dies in the tick phase (the player: also when a resurrect would bring it back) |
| `resurrect` | the player: the resurrect source a lethal tick would use (`'boon'`, `'second_breath'`, `'ember'`), else null |
| `ticks` | `[{ spell, amount, absorbed, crit }]`, one per `damage` event, in order; `spell` as in the `damage` event (an enemy's DoT: `'<ability>@<enemy index>'`; POISON: `'poison'`); `immune: true` or `sidestep: true` when it applies |
| `crit` | null, or `{ amount, hpLost, hpAfter, lethal, resurrect }` when every tick that can crit crits and the numbers differ |

Tested over 1 500 combat steps of autoplay and built runs (qa/engine/s15-dot-preview.test.mjs): at the moment the ticks
start, every entry equals what the ticks then do; at the start of the round it does too whenever nothing the unit's ticks
read changed in the round.

## 7. Randomness and replays
Streams (rules 0): `map(z)`, `node(z,r,l)`, `fight(z,r,l,k)`, `loot(z,r,l)`, `boss` (`src/rng.js`, sfc32 seeded
by a 32-bit hash of the keys). Hub and camp use row 0; the camp is zone 7; camp wave `w` uses `node(7,w,0)`,
`fight(7,w,0,0)`, `loot(7,w,0)`; hub vendors `node(z,0,0)`. Same seed + same actions = same state (tested).
(expedition) Node ids replace (row, lane): `node(z,id)`, `fight(z,id,k)`, `loot(z,id)` (`STREAM.nodeId`, `fightId`,
`lootId`); the hub is id 0 (its vendor: `node(z,0)`); Dimmed encounter n at node id: `dim(z,id,n)` (make-up, then
its fight). Map draw order: rules 1.9.2; node setup: rules 1.9.3.
(dev) Dev encounter n of a run (section 12): `dev(n, 0)` its fight, `dev(n, 1)` its loot (`STREAM.dev`).
Item names use a separate hash and never touch a stream. The sim's bots must use their own stream
(`STREAM.bot` in `src/rng.js`), never the game's.

Draw orders the engine guarantees (beyond rules 7.2 and 8.4):
- Map layout (`map` stream, rules 1.4): dungeon row and lane; rest guarantee row, then lane among the free cells;
  trainer guarantee row, then lane among the free cells (M2 v2); then the weighted fill row by row, lane 0..2.
- Node setup (`node` stream): Quest: template, size (in zone 1 the drawn size is capped at QUEST_MAX_SIZE_Z1, M2 v2),
  one mob per enemy of that size, composition repair, level offset. Elite: rare flag, template, add flag,
  add template, composition repair. Dungeon: per trash fight size, mobs, composition repair. Grind: 3 waves × (2 mobs,
  composition repair). Treasure: guard flag, guard. Camp wave: 2 mobs, composition repair. The composition repair
  (combat v2, rules 7.14) draws only when the drawn encounter breaks a rule: 1 draw for its last enemy.
  Vendor: 3 gear items (rarity, slot, stats), then Ember. Shrine: 2 boons by weight without replacement.
- Treasure: the trap is the first draw of `loot(z,r,l)` (so Scout's Eye can show it).
- Drops (rules 8.4): item chance, junk chance; when an item is rolled: rarity, the heat step (heat: always drawn),
  slot, stats (always the three draws split, primary, affix, each used only when the rarity needs it), then the unique
  draw whenever the profile owns Cache of the Wanderer (elite, rare, treasure drops) or Relics of the Deep (dungeon boss
  drops), whatever the rarity. So a drop's draws never depend on heat or on the rarity drawn (heat).
- Item stats of vendor stock and of starting gear (rules 8.3 order): split (1-2 stat items), primary, affix
  (rare/epic); no heat step, no unique draw.
- Combat extra draws: Mirrorshade (before the 3 damage draws; an image skips them), unique procs and Twin Fangs
  after a landed hit, Lucid Flow after each Mage spell, flee, DOT crit (1 draw, only when a tick can crit).
- Intent tracks (combat v2, rules 7.11): draws happen only when an entry enters a track. At fight start the
  entries for turns 1..INTENT_TRACK_LEN are made turn by turn, enemies in index order; at each later round start
  one entry per living enemy, in index order; an add draws its whole track when it appears (template summon: after
  its pool draw; Signal reinforcement at the end of the round: 1 pool draw, then its track; Shards when they come).
  An entry: 1 draw for a weighted pick (none for a scripted action; the boss makes none), then 1 pet-aggro draw
  whenever a live pet exists (TAUNT and feign apply when the entry becomes now). The engage round adds no draw.
  Round 1 -> 2 of a fight with an engage round draws no entry (the tracks already hold turns 1..3).

## 8. Autoplay
(expedition) On the expedition map `autoAction`'s map and hub decisions follow the default map policy of rules
1.9.9 (explore what leaves a clean way to a Road, then the cheapest way out; the Bell when that way crosses the
Dimming). It reads only what `mapView` shows.

Combat v2: in the engage round `autoAction` follows rule E (rules 7.9): the class's control option on the enemy
whose track shows the most damage on the player over turns 1..ENGAGE_AUTO_LOOK (with at least 2 enemies), else the
strike option (Mage: Pre-cast of the first bar spell whose autoplay condition holds). The Rogue never gets Sap from
`autoAction` (D49): its rule E is Ambush on the default target. Afterwards it reads only the
now-intents. Combat v2.1: a wind-up is a cast, so rule 3 interrupts it (or stuns it) when an interrupt or stun-tagged
spell is ready. `state.autoplay` only records the toggle. When it is on and `state.fight` is set, the front end calls
`step(state, autoAction(state))` at its own pace (PACE_AUTO_ROUND_S). The simulator calls `autoAction` for
every decision or replaces the out-of-combat part with its bots.

## 9. Meta profile
`profile = { v, echoes, earned, spent, unlocks: {id: rank}, reachedBoss, bossKills, firstKill: {rogue, mage,
hunter}, runs }`. Unlocks apply at START_RUN (rules 11.4). `END_RUN` puts the updated profile in
`state.result.profile`; the front end stores it. Buy between runs with `buyMeta(profile, id)`.

Catalogue numbers (ranks, costs per rank, effect per rank such as `C.META.vigor.hpPct`) are in `C.META`; show
them from there or from `metaOffers(profile)` (`rank`, `ranks`, `nextCost`). M2 v3: Vigor and Edge +0.01 per rank,
Keen 2 ranks, Ancestral Insight 1 rank, new costs (catalogue total 7 690). A stored rank above an entry's ranks
(a profile saved under an older catalogue) counts as the maximum rank in a run and in `metaOffers`; Echoes are
not refunded.

M2 v4: Vigor and Edge 4 ranks (80/120/170/230; a stored rank 5 counts as 4), Keen +0.0075 crit, Quick Study +0.0375
XP, Prospector +0.06 gold per rank, Swift Boots without requirement, catalogue total 7 010. Wayfinder is removed
(D34). An owned id that is not in `C.META` (a profile that bought Wayfinder) is ignored, as D32 handles ranks: no
effect in a run (`state.meta` has no `wayfinder` flag), not listed by `metaOffers`, `buyMeta` throws "unknown meta
unlock", no Echoes refunded; the id stays in `profile.unlocks` and in the profile END_RUN returns.

M2 v5: Starforged Arms is removed (D45), catalogue total 6 560. A stored `starforged` id is handled as Wayfinder
(D42): `state.meta` has no `starforged` flag, the Camp vendor's stock follows the same rule as every vendor (no class
weapon), it is not listed by `metaOffers`, `buyMeta` throws "unknown meta unlock", no Echoes are refunded, and the id
stays stored. The class weapons stay in `CONTENT.uniques` (kind `weapon`); no rule puts them in a run.

## 10. Expedition map (expedition; rules 1.9)
A run created with `newRun({ mapMode: 'expedition' })` plays the roamable zone graph (rules 1.9). Until the
switch-over the default stays `'rows'`; nothing of a rows run changes. Not yet in the engine (2b.5): PREP, contracts,
the hub contract, Ask the Locals, the Spyglass, the meta changes of expedition.md 8.2.

### 10.1 Flow
- START_RUN: phase ZONE_HUB on the hub (node 0) of zone 1. `LEAVE_HUB` puts the player on the map, standing on the
  hub. `MOVE` back onto the hub (out of the Dimming) is a new hub visit: phase ZONE_HUB, services once each again; the
  hub vendor's stock is drawn once per zone and keeps what was sold.
- MAP: `MOVE(nodeId)`, `PASS_THROUGH(nodeId)`, `TAKE_ROAD`, `RING_BELL`, out-of-combat actions. `mapView(state).moves`
  lists the neighbours with `via` (`enter` or `walk`), `hours` and `passHours` (PASS_THROUGH, null when not legal).
- A node entered by MOVE plays as on today's map (phase NODE, `state.node = { type, id, cl, stage, k, ... }`). When it
  is done the player stands on it (phase MAP).
- Settle step: after every action, once the player is on the map or in the hub with nothing open (no node, fight,
  service or loot window), hours spent since the last check make the engine check the Dimming: if the player's node is
  Dimmed, a Dimmed encounter starts (phase NODE, `state.node.type === 'dim'`, `state.fight.kind === 'dim'`). After it
  (won or fled) the player is back on the map on the same node. Then a ringing Bell completes (next zone).
- Leaving: `TAKE_ROAD` (on a Road) or the Bell; either goes to the next zone's hub, zone 6's to the Camp.

### 10.2 State fields (expedition)
| Path | Meaning |
|---|---|
| `mapMode` | `'rows'` or `'expedition'` (every state; saves without it are rows) |
| `exp` | `{ vision: { radius, regions, typeRadius }, bell (charges), pending, bellPending, dimming }` (engine bookkeeping; read the Bell from `mapView`; `dimming` false: newRun option, D50) |
| `zone` | `{ z, mode: 'expedition', nodes[], hub: 0, roads[], shardfall, shardDist[], pos, start (run hours at arrival), seen[], typed[], dimN[], hubStock, path[], questsDone, storyDone, dimOff? }`: the full zone (hidden contents included; `dimOff` true in a run without the Dimming). Draw the map with `mapView`, never from here |
| `node` | `{ type, id, cl, stage, k, ... }`; a Dimmed encounter: `{ type: 'dim', id, cl (its level), stage, k, depth }` |
| `stats.exp` | `{ walks, passes, dimFights, bells, bellExits, roads, maxRing, zones[] }` (the summary's `expedition` block) |
| `death` | adds `node`, `ring` and `depth` (Dimmed encounters); `row` and `lane` are null |

### 10.3 `mapView(state)` in an expedition run
```
{ mode: 'expedition', z, name, hz (zone hours), pos (player's node), hub: 0, roads: [ids], shardfall: id,
  roadNames: [name per Road, in the order of roads] (D51; null without content names),
  texts: { shardfall, shardspawn, dimming, homeward_bell } (D51: content texts.expedition; each null when missing),
  onRoad (TAKE_ROAD legal here), walkH, travelH, bell: { charges, channelH },
  vision: { radius (full, capped), regions (Region Charts), typeRadius (Pathfinder) },
  dim: { graceH, hoursPerHop, front (-1 before the grace ends), nextIn (hours until the front moves), off (D50: a run
    without the Dimming; then front -1 and nextIn, every node's dimsIn and dimAt are Infinity) },
  regions: [{ id, name, kind, families }]  (the zone's regions in content order; name null and families [] without
    content regions; D51: families so contract text can name them),
  bands: [[min, max] per ring], edges: [[a, b]], moves: [{ nodeId, via, hours, passHours, dimmed }],
  nodes: [node] }
node (every node): { id, ring, angle (degrees), nb (neighbour ids), hops (from the player), hub, road, shardfall,
  dimmed, dimsIn (hours from now; 0 = Dimmed), dimAt (zone hour it dims), know ('full' | 'type' | 'none'),
  region (content region index, or null when unknown) }
know 'full' (the hub, or seen) adds: type, cl, done, lost (Dimmed and unresolved), and the details of the rows view:
  quest { title, archetypes }, grind { archetypes }, elite { level, archetypes ([null, the add's archetype]: one
  entry per enemy, the elite's own hidden, D50), rare: null, name: null (D50: neither tells a rare) },
  dungeon { name, level, bossLevel, fights, bossArchetype }, treasure { guarded, trap: null, archetypes },
  vendor { ember: null }
know 'type' (Pathfinder within its radius; the dungeon with Region Charts) adds: type
```
Nothing else of a hidden node is read: qa/engine/s01b checks that a hidden node has only the skeleton keys and that
`mapView` (and `autoAction`) do not change when hidden contents are replaced.

### 10.4 Summary (expedition)
`summary(state)` adds `mapMode: 'expedition'` and `expedition = { walks, passes, dimFights, dimZones, bellsRung,
bellCharges (left), roads, maxRing, zones: [{ z, hours, nodes, walks, passes, dimFights, exit ('road' | 'bell' |
null) }], dimming (false in a run without the Dimming, D50) }` (the current zone's `hours` are its hours so far). `minutes` adds the walk and pass terms and the Bell
(rules 1.9.8). `death` as 10.2.

## 11. Heat (heat; rules 1.7.1-1.7.2, 1.9.10)
One meter for time pressure in both map modes (docs/specs/expedition.md section H; the UI rules are H.4). The engine
computes everything the meter shows, so the UI never re-implements the line, the states or the Dimming's clock.

### 11.1 `heatView(state)`
```
{ hours, par (bossPar), z (state.zone.z; the Camp ZONE_COUNT + 1), line, heat (hours - line; negative = in hand),
  inHand (max(0, -heat)), past (max(0, heat)), stateRun, dimIn, stateDim, state, by ('run' | 'dim'),
  ascIfPar, gain, rarityUp, bar: { min, max, marker, beyond }, next: [{ action, ...heatPreview(action) }] }
```
- `state`, `stateRun`, `stateDim`: one of `C.HEAT_STATES` (`'clear'`, `'warm'`, `'hot'`, `'scorched'`). `stateRun` from
  the heat (rules 1.7.2); `stateDim` from `dimIn` (rules 1.9.10), null without a Dimming clock (a rows run, the Camp,
  or `dimming: false`); `state` is the hotter of the two, and `by` names the clock that sets it (`'dim'` only when the
  Dimming state is hotter).
- `dimIn`: hours until the player's node dims (0 or less: it is Dimmed), or null. Text: "Dimming: 3 h".
- `ascIfPar`: the boss Ascendancy if the player leaves the zone now and keeps the line from here ("Boss +4 %"). At the
  Camp it is the Ascendancy FIGHT_BOSS would give.
- `node`: inside a node, `{ state, gain, rarityUp }` of the state the node was entered in, which is what it pays (it
  can differ from `state` once the node's hours are spent); null elsewhere (map, hub, Camp, boss, Dimmed encounter).
- `gain`, `rarityUp`: `C.HEAT_GAIN[state]` and `C.HEAT_RARITY_UP[state]`, the rewards of the state (rules 1.7.3):
  "+35 % XP and gold, 1 in 4 drops a rarity up".
- `bar`: `min` = HEAT_BAR_MIN, `max` = HEAT_BAR_MAX, `marker` = heat clamped to the bar, `beyond` = -1 / 1 when the
  heat is off the bar (draw the arrow), else 0. The line is the mark at heat 0.
- `next`: the legal choices of the current phase that cost hours, each with its preview: map moves (rows:
  `CHOOSE_NODE` per reachable lane and `TRAVEL_ON`; expedition: `MOVE` and `PASS_THROUGH` per neighbour, `TAKE_ROAD`,
  `RING_BELL`), hub and Camp services (`SERVICE`), `CAMP_GRIND`, and in a Grind `GRIND_SET_WAVES` and `NEXT_FIGHT`.
  Empty during a fight. Match an entry to a map node by `action.lane` or `action.nodeId`.

### 11.2 `heatPreview(state, action)`
```
{ hours, hoursAfter, line, heat, stateRun, dimIn, stateDim, state, by, ascIfPar,   (as heatView, after the action)
  change (state differs from now), dimFight, perWave, pays }
```
- `hours`: what the action costs (`hoursAfter` = run hours then), as the engine spends it: node hours (rules 2.0, 1.9.8), a walk or a pass
  (HOURS_WALK), TRAVEL_ON and TAKE_ROAD (HOURS_TRAVEL), the Bell's channel (BELL_CHANNEL_H), a service, a Camp wave,
  n Grind waves. `dimFight`: the step, node, service or channel ends on a node that is Dimmed by then, so a Dimmed
  encounter follows (rules 1.9.6); its HOURS_DIM_FIGHT is included and the state after is Scorched. `perWave`: a Grind
  whose waves are chosen inside (today's map): `hours` is one wave.
- Leaving the zone (TRAVEL_ON, TAKE_ROAD, RING_BELL): the state after uses the next zone's line (the Camp: the par);
  `dimIn` is null there (the next zone's map is not drawn yet; its hub is at least 3 hops from the Shardfall, so it
  starts Clear).
- `pays`: for an action that enters a node (CHOOSE_NODE, MOVE into an unresolved node), the state the node is entered
  in: the state now, with the Dimming clock of the node entered (rules 1.7.3 fixes the node's rewards by it). null
  for every other action.

### 11.3 Rewards and the summary (rules 1.7.3, 1.7.4)
- Entry state: `state.node.heat`, the `node` event's `heat` and `state.fight.heat` (each fight of the node) are the
  state at the moment of entry, before the node's hours (`heatPreview(...).pays` showed it).
- XP and gold of the node × (1 + `C.HEAT_GAIN[heat]`) after rested and meta: the `xp` and `gold` events carry the
  extra as `heat`.
- Every item rolled on a drop table in the node is one rarity step higher below `C.HEAT_RARITY_UP[heat]`; the item's
  `rarity` is the final one (no extra field).
- `summary(state).heat`:
```
{ trackPerZone: [{ z, line, entry, exit }],   (z: 1-6, the Camp ZONE_COUNT + 1; entry / exit: run hours; the last
                                                zone's exit = the hours so far)
  hoursByState: [clear, warm, hot, scorched], nodesByState: [4], fightsByState: [4] (fights won in map nodes),
  echoHeat }                                   (the Echo line `heat`, before the Oath multiplier)
```
  The hours-vs-line chart: per record, heat `entry - line` at arrival and `exit - line` when left.

## 12. Dev tools (dev; dev only, not game rules)
Owner feedback 2026-11-11 07:41 [stated]: "in-game dev tools from a menu, so he can test any stage without playing
through". `R.debug` (src/engine/debug.js) builds or changes a run for testing; the UI's Dev menu (src/ui/dev-menu.js)
calls it through the bridge, and nothing else in the game or the simulator does. Pure and seeded like `step`: every run
helper returns `{ state, events }` with a new state (its input is never changed) that passes `debug.validate`, and the
same state with the same calls gives the same result. Errors are `IllegalActionError` (`code 'ILLEGAL_ACTION'`) naming
the helper and the reason.

**Dev runs.** Every run helper marks the run: `state.dev = { tools: [ids of the helpers used], god, godUsed, n (dev
encounters started), talentPoints (given) }`. A dev run's `summary` has `dev: { god (god mode was on at some point),
tools }` and earns no Echoes: `echoes = { lines: [], base: 0, oathMult, total: 0, withheld }` (`withheld` = what the run
would have earned); `END_RUN` returns the profile as it was (no Echoes, no run counted, no boss flags; meta.js
`applyRunToProfile`). A normal run has no `dev` key in its state or summary. `setProfile`, `grantEchoes` and
`fullCatalogue` change the profile, not the run, and do not mark it.

| Function | Returns | Notes |
|---|---|---|
| `build({ content, classId, petId, name, seed, profile, oaths, mapMode, vision, dimming, zone, level, rarity, ilvl, talents, gold, potions, hours })` | `{ state, events }` | A run at zone `zone` (1..ZONE_COUNT; ZONE_COUNT + 1 = the Camp), phase ZONE_HUB (CAMP). Defaults: classId `rogue`, a Hunter's first pet the profile has, seed 0, `oaths` [] (sworn in CREATE; the profile must own them), mapMode `rows`, level the zone's first (the Camp MAX_LEVEL), rarity DEV.RARITY, ilvl level + the rarity's `ilvlBonus` (at most ILVL_MAX), talents `'auto'` (autoplay's default build, one SPEND_TALENT at a time) or `'unspent'`, gold DEV.GOLD_V × V(level) copper, potions DEV.POTIONS Healing Draughts (a Mage as many Mana Draughts too), hours `ceil(line of zone - 1)` (on schedule; the expedition zone's clock starts there). Every slot holds fixed-stat gear of that ilvl and rarity (as starting gear: the class's primary, STA, the power affix; generated names). Every spell the trainer teaches up to the level is learned and trained to it; the bars are autoplay's; full HP and mana. The heat records (summary `heat`) and the expedition zone records start at this zone; zones left = zone - 1 |
| `toCamp(state)` | `{ state, events }` | To the Camp (phase CAMP), leaving whatever is open (below); the hours stay; zones left at least ZONE_COUNT |
| `toBoss(state, { phase })` | `{ state, events }` | The end-boss fight (phase BOSS, round 1), from anywhere (the Camp first). `phase` 2: the boss at floor(P2_AT × HP), 3: ceil(P3_AT × HP) - 1, each reached by the engine's own phase change (rules 10.2: Shards come with phase 2, go with phase 3); its intent and track are then shown for the new phase. Ascendancy from the hours (rules 1.7) |
| `nextZone(state)` | `{ state, events }` | The next zone's hub as by TRAVEL_ON (a Road, TAKE_ROAD, on the expedition map): HOURS_TRAVEL, no level gate; from zone ZONE_COUNT the Camp. Throws at the Camp |
| `encounter(state, { ids, level })` | `{ state, events }` | A fight against one or more enemy templates by id, any kind, each as its template's `kind` (normal, elite, rare, trash, dboss) at `level` (default: the player's level). Fight kind: `dboss`, `elite` (elite or rare), `trash` or `grind`, by the strongest; an engage round as every fight; no flight from a dungeon boss; no heat. Played in phase NODE as node `{ type: 'dev', cl, stage, k, heat: null, from, enemies, id (expedition: the player's node) }` on the dev stream (`STREAM.dev(seed, n, 0)` the fight, `(seed, n, 1)` its loot). Won or fled, the player is back at `from` (`MAP`, `ZONE_HUB` or `CAMP`); kills pay their XP, coin and loot; no map node is resolved |
| `killTarget(state, target)` | `{ state, events }` | Kill a living enemy of the current fight (default: `defaultTarget`) through the damage pipeline (`damage` event `src: 'dev'`): kill rewards, a boss's phase changes. The last one ends the fight as a victory (a boss kill ends the run). Then the settle step (expedition) |
| `refill(state)` | `{ state, events }` | Full HP and mana, the pet alive at full HP; in a fight also full energy and focus, no cooldowns, potions ready |
| `setGod(state, on)` | `{ state, events }` | God mode: the player takes no damage. It works as a lasting IMMUNE that Final Dark does not pierce (`damage` event `amount: 0, hpLost: 0, immune: true, god: true`), so a heavy blow on the player counts as avoided (rules 7.13: OFF_BALANCE; 7.12: its wind-up answered). The pet takes damage as usual. Turning it off when it is off changes nothing |
| `give(state, { gold, potions, talentPoints })` | `{ state, events, given }` | Gold in copper; Healing Draughts while the bag takes them (a Mage as many Mana Draughts); unspent talent points on top of the level's (rules 6: `talentPointsFree` counts them, SPEND_TALENT spends them). `given`: what was added |
| `setHours(state, hours)` | `{ state, events }` | The run's hours (whole, >= 0): heat, the boss's Ascendancy. The zone's own clock stays: on the expedition map its arrival hour moves with the run's, so the Dimming stands where it was; the zone's open heat record moves the same way |
| `setHeat(state, heatState)` | `{ state, events }` | `setHours` to `ceil(line + x)`, x the middle of the state's band (rules 1.7.2): Clear HEAT_WARM_AT - (HEAT_HOT_AT - HEAT_WARM_AT) / 2, Warm (HEAT_WARM_AT + HEAT_HOT_AT) / 2, Hot (HEAT_HOT_AT + HEAT_SCORCH_AT) / 2, Scorched HEAT_SCORCH_AT + (HEAT_SCORCH_AT - HEAT_HOT_AT) / 2. `heatView(...).stateRun` is then that state |
| `revealMap(state)` | `{ state, events }` | Expedition: every node of the zone seen (`know: 'full'`). Today's map hides only rare elites, traps and vendor Embers: Scout's Eye is on for the rest of the run (`state.meta.scout`). Throws at the Camp |
| `setMapMode(state, mode)` | `{ state, events }` | Play on with the other map: the current zone is drawn again in that mode and the player is at its hub (services again; its heat record stays); at the Camp only the mode changes. An expedition starts without vision unlocks, with the Dimming and BELL_START_CHARGES. The same mode changes nothing |
| `grantEchoes(profile, n)` | profile | n more Echoes to spend (not counted in `earned`) |
| `fullCatalogue(profile)` | profile | Every `C.META` entry at its highest rank (no Echoes spent) |
| `setProfile(state, profile)` | `{ state, events }` | The state with another profile: in CREATE the one START_RUN reads (pets, Oaths, unlocks); in a run the one END_RUN updates (the run's `state.meta` stays as START_RUN made it). Not after ENDED |
| `enemies(content)` | `[{ id, name, kind, archetype, family, zone }]` | Every enemy template once, with its home zone (the first zone that lists it; null if none) |
| `validate(state, { steps = true })` | string[] | The state checks every helper's result passes (empty = valid): version and phase; plain JSON (`serialize`/`deserialize` round trip, no object shared); the character (level and XP, HP and mana in range, the pet, `player.d` current, talents with their ranks, tier gates and `talentSpent`, spells known and trained up to the level, the bars, gear in its slots, bag stacks and capacity, unique item uids below `nextUid`, gold); the zone and node for the phase (a `dev` node only during its fight); the fight (enemy indices, HP, intents, INTENT_TRACK_LEN track entries); `mapView`, `heatView` and `summary` do not throw; `legalActions` is not empty and `autoAction` is legal; with `steps`, every listed action steps without error. It passes every state of autoplay runs (qa/engine/s14-debug.test.mjs) |

**Leaving what is open** (`toCamp`, `toBoss`, `nextZone`, `encounter`, `setMapMode`), by the engine's own exits: the
loot window's items are dropped (`lootDropped`), a fight is left without its rewards, a service closes (a hub vendor's
stock is kept), a map node is resolved as after a flight (`completeNode`), a Dimmed encounter or a dev fight ends where
it would, and the end-boss fight is left for the Camp.

Constants (src/constants.js `DEV`, dev tools only):

| Name | Value | Use |
|---|---|---|
| DEV.GOLD_V | 30 | `build`: gold = DEV.GOLD_V × V(level) |
| DEV.POTIONS | 5 | `build`: Healing Draughts (and Mana Draughts for a Mage) |
| DEV.RARITY | uncommon | `build`: gear rarity when none is given |
