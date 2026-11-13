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
totals; marked "(preview)"); 2026-11-11c (tuning pass M2b v6, docs/specs/changes-m2b-v6.md: new numbers in `C`, the end
boss's BOSS_DMG_MULT, the Packed Satchel free potion; marked "(M2b v6)"); 2026-11-11d (M2b v7, docs/specs/changes-m2b-v7.md
B-C, D68-D70: time in whole tolls; `state.time`, the `time` event, `heatView.time`, `heatPreview.time` / `timeAfter`,
`mapView` `zt`, `moves[].time` / `passTime`, `walkTime`, `travelTime`, `bell.channelTime`, `dim { grace, frontHops,
frontTime }`, the summary's `time`, `timeAtBoss`, `heat.timeByState` and `expedition.zones[].time`, `debug.setTime` and
`build({ time })`; the line rounded up per zone and the Dimming's front in integers; `STATE_VERSION` 3; marked "(M2b v7)");
2026-11-11e (tuning pass M2b v8, docs/specs/changes-m2b-v8.md rows 1-9: new numbers in `C`, `zoneDanger`'s early factor,
the free potion at FREE_POTION_MULT with the event's `mult`, `potionInfo`; marked "(M2b v8)"); 2026-11-11f (start camp and contracts,
docs/specs/expedition.md 2-3, task 2b.5, expedition runs only: phase PREP, `prepView`, `contractView`, the PREP actions,
`TAKE_HUB_CONTRACT`, `USE_SPYGLASS`, the `prep`, `contract` and `spyglass` events, `mapView` site marks and `spyglass`, the
summary's `expedition.contracts` and the Echo lines `contracts` and `reserve`; section 13; marked "(prep)"); 2026-11-11g
(tuning pass M2b v9, docs/specs/changes-m2b-v9.md rows 1-4: new numbers in `C`, `zoneDanger` with ZONE_DANGER_STEP 0.45;
marked "(M2b v9)"; tuning pass M2b v10, docs/specs/changes-m2b-v10.md rows A1-A3, B1-B4, C1: contract XP without the
level-difference modifier and `reward.xp` in `prepView` / `contractView`, new numbers in `C`, the Dungeon's
DUNGEON_DIM_HOLD in `dimAt`, `mapView` and `heatView`, the engine defaults of 13.4 confirmed; marked "(M2b v10)");
2026-11-11h (the flip package M2b v11, docs/specs/changes-m2b-v11.md rows 1-4 and 8: new numbers in `C` (EXPED_DROP_MULT,
EXPED_DUNGEON_BOSS_DROPS, TIME_DIM_FIGHT 2, the Delve's price 1, BEASTCALL_HORN_CD and its gated value); the meta catalogue
of expedition.md 8.2 in `C.META` (Cartographer, Old Hand, Quartermaster with `mapMode: 'expedition'`; Scout's Eye and
Swift Boots with an `expedition` effect) and its effects in runs with the start camp; marked "(M2b v11)");
2026-11-11i (M2b v12, docs/specs/changes-m2b-v12.md rows 1-2 and the gated row 5: EXPED_DROP_MULT 1.9, the Delve's price
2, DUNGEON_DIM_HOLD and BEASTCALL_HORN_CD_GATED removed from `C` (the Dungeon dims by its hops in `dimAt`, `mapView` and
`heatView`), the new TIME_DIM_ESCAPE in the settle step, `heatPreview`'s `dimFight` tolls and the autoplay map policy,
`exp.outward`, RICOCHET_BOUNCE_FRAC and its gated value; marked "(M2b v12)"; the row-5 gate passed, so RICOCHET_BOUNCE_FRAC is
0.30); 2026-11-11j (M2b v13, docs/specs/changes-m2b-v13.md rows 1-6: the Deathblow flag and estimate on track entries and
intents, summed EMPOWERED / STAGGERED values with their Deathblow share, the player status MAIMED and `potionInfo`'s cut amount,
the `empower` / `stagger` / `heal` event fields, autoplay rule E2, `state.met` and the gated switches `C.GATES`, and the views
`windupView`, `autoplayEngage` and the map's Deathblow fields (section 6.2); marked "(M2b v13)"); 2026-11-12 (M2b v14,
docs/specs/changes-m2b-v14.md rows 1, 2 and 4: autoplay rule H, the PASS that keeps STEALTH while every living enemy is SAPPED,
`C.GATES` on by default with the new `sapHold` and `passStealth`, a hidden elite's `deathblow: { type }`, `autoplayEngage`'s
`wait`, and in `windupView` the Sap answer's `wait` / `stealth` and the PASS answer; marked "(M2b v14)"); 2026-11-12b (D116,
the flip: `newRun`'s defaults are `mapMode: 'expedition'` and, on the expedition map, `prep: true`, so a new run starts at
the start camp; the rows map is an option (`mapMode: 'rows'`) for the simulator and the Dev menu; `debug.build` follows;
default since D116; docs/handoffs/engineer-2026-11-12b.md; marked "(D116)"); 2026-11-12c (M2b v15, docs/specs/changes-m2b-v15.md
rows 1, 2 and 4, D123-D125: the Swift passage of a Road (rules 1.9.7: the `swift` event and the `xp` event's `why: 'swift'`,
`mapView.swift`, `heatPreview`'s `swift`, `stats.exp.swift` and the summary's `swift` counts), `C.ROAD_SWIFT_TOLLS`,
`C.ROAD_SWIFT_XP_FRAC`, the switch `C.GATES.swiftRoad` (off since D126, report 2026-11-12c; the rule stays),
`debug.nextZone` without the Swift passage; marked "(M2b v15)"; D126: `C.GATES.mawgrimHp` and content `gated` removed,
Mawgrim's hpMult 0.95 is its content value); 2026-11-12e (D132: the start camp's board drawn across the run,
`C.CONTRACT_BOARD_BANDS` and the switch `C.GATES.boardAcrossRun`, on; section 13.1; marked "(D132)"); 2026-11-13 (D133:
autoplay's start camp buys the Ember of Return first, the switch `C.GATES.autoEmberFirst`, on; section 13.4; marked "(D133)");
2026-11-13b (M3 3.4, docs/specs/m3-onboarding.md 5 E1-E8, D135, D137, D138: `newRun`'s `tutorial` option, the guided first run on
TUTORIAL_SEED with the overlay of CONTENT.tutorial, the rescue, `SKIP_GUIDE`, the beats and `tutorialView`, the profile's `guide`
and `welcome` with `migrateProfile` and `setGuide`, the Echo line `welcome`, the summary's `tutorial` block, `debug.resetOnboarding`;
section 14; marked "(M3)"; runs without the option are unchanged, checked run for run in qa/engine/s18); 2026-11-13c (M3 3.7, D142
item 5: G10 on the map only, G12's return cap `C.ONB_LINE_RETURNS`; section 14.4; marked "(D142)").
Units: every time value of the API is a whole number of tolls (1 toll = 1 former in-game hour, D69); there are no hours.
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
| `newRun({classId, petId, name, seed, profile, content, mapMode, vision, dimming, prep, tutorial})` | state (phase CREATE) | All fields but `content` optional. `seed`: integer, normalised to uint32; the front end draws a random seed (the engine never does). `profile`: meta profile (`newProfile()` if omitted). `content` is validated (structural) and deep-frozen. (expedition) `mapMode`: `'expedition'` (rules 1.9, section 10; the default since D116) or `'rows'` (the classic map, rules 1.4; an option for the simulator and the Dev menu); `state.mapMode` keeps it. `vision`: expedition only, `{ guide, charts, pathfinder }` booleans (Local Guide, Region Charts, Pathfinder, rules 1.9.5); a test and measurement option beside the start camp and the catalogue, which give them too (M2b v11). `dimming` (D50): expedition only, `false` plays the run without the Dimming (rules 1.9.6; a measurement option for B44), default `true`. (prep) `prep`: expedition only, `true` starts the run at the start camp (phase PREP) and plays contracts (section 13); (D116) left out, it is `true` on the expedition map (the default since D116) and off on the rows map; `false` plays the expedition map exactly as before task 2b.5; `true` with `mapMode: 'rows'` throws. (M3) `tutorial`: `true` plays the guided first run (section 14; the expedition map with the start camp only, and CONTENT.tutorial is needed; else it throws), default `false`. (M3) The profile is read through `migrateProfile` (it gains `guide` and `welcome`). Throws on invalid content/class/pet/mapMode/vision/dimming/prep/tutorial. |
| `legalActions(state)` | action[] | Every concrete legal action. `SET_NAME` and `SET_SEED` take free values and are not listed (they are legal in CREATE). |
| `step(state, action)` | `{ state, events }` | Pure: the input is never changed. Throws `IllegalActionError` (`err.code === 'ILLEGAL_ACTION'`, message names the reason) on an illegal action. |
| `stepInPlace(state, action)` | events | Same, but changes `state` in place (no copy). For simulators that own their state. |
| `isLegal(state, action)`, `whyIllegal(state, action)` | bool / string or null | Validation without applying. |
| `autoAction(state)` | action or null | Deterministic. In combat: the autoplay policy of rules 7.9. Elsewhere: a simple default policy (talents, gear, bar, hub, map, rewards, camp) so a headless run goes from CREATE to SUMMARY. `null` only in ENDED. |
| `summary(state)` | object or null | Run summary (rules 9) incl. Echoes breakdown (11.1): `echoes = { lines: [{ id, count, each, echoes }], base, oathMult, total }`; a line's `echoes` is `round(count × each)` (half away from zero, M2 v3; `each` can be fractional), `base` the sum of the lines, `total = round(base × oathMult)`. Show `echoes` per line. (heat) Line `heat`: fights won in heat ("Fights won in heat"); block `heat` (section 11.3). (M2b v7) The run's time is `time` and the time at the end boss `timeAtBoss` (whole tolls; null before the boss; were `hours`, `hoursAtBoss`). Available any time after START_RUN. |
| `serialize(state)` / `deserialize(str, content)` | string / state | The content tables are not saved; pass the same `CONTENT` (version is checked). |
| `mapView(state)` | object or null | What the player may see of the zone map (rules 1.4). Rare elites, traps and vendor Embers are `null` unless the profile owns Scout's Eye. Use this, not `state.zone.rows`, to draw the map. Fight nodes list one archetype per enemy: quest and elite `archetypes`, grind `archetypes` (first wave), treasure `archetypes` (the guard; `[]` unguarded, combat v2), dungeon `fights` (one archetype list per trash fight) and `bossArchetype` (combat v2). (M2b v13) Elite nodes add `deathblow` (M2b v14: `{ type }` only while the name is hidden: a rare without Scout's Eye) and dungeon nodes `bossDeathblow` (section 6.2). (expedition) In an expedition run: the zone graph as the player sees it (section 10.3). null outside a zone. |
| `validateContent(content, {strict})` | string[] | Content checks (src/content/SCHEMA.md). |
| `migrateProfile(profile)`, `setGuide(profile, value)` | profile | (M3, section 14.5) A stored profile with `guide` and `welcome` (a profile without them and `runs > 0` loads as `'done'` and `true`, else `'todo'` and `false`); `setGuide` sets `guide` (`'todo'`, `'done'`, `'skipped'`; class select and Settings), throws `IllegalActionError` on another value. Pure. Call `migrateProfile` when the profile is loaded |
| `tutorialView(state)` | object or null | (M3) The guided first run for the UI (section 14.3); null in any other run and before START_RUN. Pure and cheap |
| `newProfile()`, `metaOffers(profile)`, `buyMeta(profile, id)` | profile / offers / profile | Meta catalogue between runs (rules 11.2). `buyMeta` throws `IllegalActionError` when not allowed. (M2b v11) The expedition entries are offered and bought as any entry; read `C.META[id].mapMode` (`'expedition'`: no effect on the rows map) and `C.META[id].expedition` (Scout's Eye, Swift Boots: the effect in an expedition run) to label them. |
| `xpToNext(L)`, `talentPointsFree(state)`, `itemScore(item, classId)`, `spellCost(state, id)`, `spellCooldown(state, id)`, `fleeChance(state)` | number | Display helpers so the UI never re-implements a rule. |
| `bagCapacity(state)` | number | Bag slots: `BAG_SLOTS` + meta Deeper Pockets (rules 8.7, 11.2). In CREATE it reads the profile. |
| `travelLevel(state)` | number or null | Level from which `TRAVEL_ON` is legal in the current zone (rules 1.5): exit level - TRAVEL_EARLY_LEVELS, one lower with Swift Boots ("Travel on at level N"). After the last row TRAVEL_ON is legal at any level. null outside a zone (CREATE, Camp, run over) and in an expedition run (no level gate, rules 1.9.7). |
| `resurrectCharges(state)` | object or null | Resurrect charges (rules 9, M2 v3): `{ boon, secondBreath, ember, now, boss }`. `boon`, `secondBreath`, `ember` = charges held. `now` = the sources a death would use, in order (`'boon'`, `'second_breath'`, `'ember'`), in the current fight (out of combat: on the journey); `boss` = the same in the end-boss fight, where Second Breath is not used ("not in the final fight"). Both `[]` under the Oath of Frailty. null before START_RUN. |
| `bossPar(state)` | number | Boss time par in tolls (rules 1.7, 11.5): BOSS_TIME_PAR, OATH_HASTE_TIME less under the Oath of Haste. Ascendancy counts full ASC_STEP_TIME past it; the Echoes speed bonus needs a kill at or under it. After START_RUN from `state.oaths`, in CREATE from the Oaths chosen so far (M2 v4). |
| `zoneDanger(level, variant = 'normal')` | number | Zone danger (rules 7.6): the damage multiplier the engine gives an enemy built from a template at `level`. `zd = 1 + ZONE_DANGER_STEP × max(0, level - ZONE_DANGER_FROM) / 10` for `'normal'` (quest, grind, Camp waves, summoned adds), `'elite'`, `'rare'`; `1 + DUNGEON_DANGER_FRAC × (zd - 1)` for dungeon `'trash'` and `'dboss'` (M2 v4: level 60 ×1.5 against ×2.0). Show `zoneDanger(...) - 1` as the extra damage; for a dungeon node use the trash level with `'trash'` and `bossLevel` with `'dboss'`. Not the end boss or the Shards. (M2b v8) Both forms are × `early = EARLY_DMG_MULT` (0.80) at `level <= EARLY_DMG_MAX_LEVEL` (20), else 1, and ZONE_DANGER_STEP is 0.45 (M2b v9: was 0.375): level 20 and below 0.8 (so `zoneDanger - 1` is -0.2 there: those enemies deal less), 21 1.045, 30 1.45, 60 2.8 (dungeons 1.9). |
| `V(L)`, `xpCurve(L)`, `diffMod(d)` | number | Rule helpers for estimates (read-only): value scale V (rules 8.5; prices and gold are multiples of it), the levelling polynomial (rules 4.3, defined for every L: `xpCurve(60)` is the event-XP base at CL 60 while `xpToNext(60)` is 0), the XP level-difference modifier for `d = CL - L` (rules 4.4). |
| `spellInfo(state, id, target)` | object or null | Tooltip data: name, level, tags, resource, cost, cd, cdLeft, tl, rank, `amount` (`{kind: damage|dot|ward|heal, amount or perTick, hits, school}`, base value before level/target/crit/variance; Ricochet Bolt adds `bounces, bounceFrac, bounceAmount`: the target takes `amount`, up to `bounces` other enemies take `bounceAmount` = round(amount before rounding × bounceFrac), M2 v3 40 %), `usable` and `reason` in a fight, content flavour `text`, `window` (combat v2: the spell deals damage and `target`, or for an AoE spell some enemy, is in an OFF_BALANCE window; cost 0 under Gathered Power shows in `cost`). |
| `defaultTarget(state)` | number or null | Autoplay's default target (rules 7.9): living, not HEXED or SAPPED (combat v2), mender > caster > others, lowest HP, lowest index; an enemy that was sapped this fight (`wasSapped`) only when no other such enemy lives (D48); HEXED or SAPPED enemies only when no other is left. null outside a fight. |
| `isEngageRound(state)` | bool | (combat v2) The fight is in its engage round (rules 7.10): round 1 of every fight but the end boss. `ENGAGE` is legal only then. |
| `engageOptions(state)` | array or null | (combat v2) The engage panel (rules 7.10), null outside the engage round: one entry per class option in the order strike, control, setup: `{ id, kind ('strike'|'control'|'setup'), name, targets, spells, disrupt, reason }`. `targets`: the enemy indices it may be used on (`[null]` for no target); Pre-cast has `spells: [{ spellId, targets }]` instead (bar spells castable at 0 mana). `disrupt` (combat v2.1): the targets on which this control option is **Disrupt** (an enemy immune to control, a dungeon boss, that shows a wind-up in turns 1..INTENT_TRACK_LEN; rules 7.10): label the option "Disrupt" there; `[]` for every other option and target. `reason`: why it cannot be used at all (e.g. the only enemy is immune to control and shows no wind-up: grey it out with this text). Option data (name, turns, multipliers): `C.ENGAGE_OPTION[id]`. |
| `engagePreview(state, action)` | object or null | (combat v2) What an ENGAGE action does to the tracks, for the engage panel's hover preview (rules 7.10). No draw, so it shows nothing the player cannot see. null when the action is not legal, else `{ enemies: [{ u, cancelled, offBalance, window, pet, stagger, disrupt }] }` with turn numbers: entries it cancels (Sap, Binding Glyph, Lay Trap, Disrupt, a Pre-cast Hexbind or Rime Burst; Sap and Hexbind only while no damage breaks them, Rime Burst only if it hits), those among them that leave the enemy OFF_BALANCE (heavy or cast: "OFF_BALANCE on turn 2"), turns FROZEN (a window), turns whose single-target hits go to the pet (Send the Pet), (combat v2.1) `stagger`: the cancelled turns whose entry is a wind-up (answered: STAGGERED), `disrupt`: true when the option is a Disrupt on this enemy (its one cancelled turn is the first visible wind-up). Send the Pet answers a heavy wind-up among its `pet` turns too while the pet lives (rules 7.13 (3)); the preview lists it under `pet` only. Damage options change no entry. (M2b v6) Sap's `cancelled` lists turns 1..SAP_TURNS (4), one more than the engage round's track shows; `offBalance` and `stagger` can name only turns that have an entry. |
| `offBalance(state, enemyIdx)` | object or null | (combat v2) The OFF_BALANCE window on an enemy (rules 7.13): `{ status ('OFF_BALANCE', or 'FROZEN', which counts as OFF_BALANCE while it lasts), taken, crit, rounds }`; null when there is none. Highlight bar spells with `spellInfo(...).window`. |
| `pendingTicks(state, unit)` | array, object or null | (preview) The DoT preview (owner feedback 2026-11-11 08:11): what the ticks at the end of the current round (rules 7.1 step 5) will do if nothing else happens before them, one entry per unit they touch, in tick order (player, pet, enemies). With `unit` (`'player'`, `'pet'` or an enemy index): that unit's entry or null. null outside a fight. Fields and guarantees: section 6.1. |
| `freePotion(state)` | bool | (M2b v6) Packed Satchel's free potion (rules 7.5): true while the current fight's free potion is unused, so the next potion the player drinks (an item with `C.CONSUMABLE[id].potion`: Healing, Mana or Greater Healing Draught) costs no turn. false outside a fight, without the unlock, once used, and while the player's action is skipped. Mark the potions on the item bar "free" while it is true. (M2b v8) The free potion restores FREE_POTION_MULT (0.5) × its normal amount ("Free action, half strength"); `potionInfo` gives the amount. |
| `potionInfo(state, itemId)` | object or null | (M2b v8) What one use of a consumable restores now (rules 8.6, 7.5): `{ id, free, mult, heal, mana }`. `heal` (HP) and `mana` are the amounts before the cap at max HP and max mana, potion uniques included (rules 11.3), 0 when it restores none (Purifying Tonic, Spark Flask). `free`: in a fight, this use would be Packed Satchel's free potion (`freePotion(state)` and a potion); then `mult` is `C.FREE_POTION_MULT` and the amounts are that share of the normal ones, else `mult` 1. The engine's own numbers (the same function resolves the use): show them, never recompute them. The `heal` / `mana` events of the use show what was restored after the cap. (M2b v13) `maim`: the MAIMED share (rules 7.5; `C.MAIM_HEAL`, 0 when not MAIMED); while MAIMED `heal` is already the cut amount, × (1 - maim) rounded once, as the use heals. null for an id that is not a consumable, or before START_RUN. |
| `windupView(state)` | array or null | (M2b v13) Every wind-up on the enemies' tracks with its Deathblow flag, estimate, stakes and the player's answers now ("answers ready"); section 6.2. null outside a fight. |
| `autoplayEngage(state)` | object or null | (M2b v13) In the engage round, the ENGAGE autoplay plays by rule E2 on a special enemy's wind-up, for the hint "Autoplay will answer the Deathblow with <name>"; (M2b v14) `wait` when rule H will then wait a round ("..., then wait a round"); section 6.2. |
| `prepView(state)` | object or null | (prep) The start camp screen (expedition.md 2, 9.1), null outside phase PREP. Fields in section 13.2 |
| `contractView(state)` | object or null | (prep) The contract tracker (expedition.md 9.3) and the hub contract on offer, any phase of an expedition run after START_RUN; null in a rows run. Never names a site's node. Fields in section 13.3 |
| `talentInfo(state, talentId)` | object or null | (preview) Talent totals for the tooltip (owner feedback 2026-11-11 08:14; rules 6): `{ id, name, ranks, rank, per, now, next }`. `per`: the values one rank gives, `now`: their totals at the ranks taken (null at rank 0), `next`: at one more rank (null at the maximum). The keys are the talent's per-rank fields (`C.TALENT_PER_RANK`; the numbers stay in `C.TALENT`), e.g. Silent Footing at 3/3: `now { pct: 0.3 }`, `next` null. `base` (Toxic Coating, Trapper): the damage formula b + l × L (Trapper: the Snare Trap's training level) + p × Power, times the ranks, before modifiers, rounded to 0.1 (null without a character). Hemorrhage Mastery: `{ dotCrit, dotPct }` by rank. Any phase; null for an unknown id. |
| `damageView(state)` | object or null | The character sheet's damage block (owner feedback 2026-11-11 11:58; src/engine/damageview.js): `{ pct, main, pet, perPower, perWd }`. `pct`: the summed outgoing % modifiers that hold for every attack (boons, elixir, talents; in a fight also its buffs, e.g. Rapid Volley). `main`: the class's main attack, `C.CLASS[cls].startSpells[0]` (Gutting Jab, Ember Bolt, Keen Shot), at its training level: `{ spellId, name, school, tl, base, pct, lo, hi, critLo, critHi, crit, critMult, avg }`; `base` = b + l × tl + p × Power + w × WD (the spell tooltip's amount), `pct` every % on it (`pct` plus school and spell talents), `lo`-`hi` a hit, `critLo`-`critHi` a crit, `crit` the chance, `avg` per hit with crits included. `pet` (Hunter, else null): `{ id, name, base, pct, lo, hi, critLo, critHi, crit, critMult, avg }`. `perPower`, `perWd`: what one more point of Power or Weapon damage adds to `main.avg`. Target-free: a foe of the player's level with no armour or statuses, so the level step is 1 and mitigation 0; misses, procs (Twin Fangs, unique procs), off-balance windows and conditional bonuses (Riposte, poison stacks, an elite target) are not in it. From the damage pipeline (snapshot, critChance, critMult); qa/engine/s17 checks every real hit against the ranges. Show these numbers, never recompute them. null without a character (CREATE). |
| `heatView(state)` | object or null | (heat) The heat meter (rules 1.7.1-1.7.2, 1.9.10), in any phase after START_RUN (null before): the line, the player's heat, the state, the Dimming's clock in an expedition zone, the projected boss Ascendancy and the previews of the legal hour-costing choices. Fields in section 11. Pure and cheap. |
| `heatPreview(state, action)` | object or null | (heat) The tolls an action costs and the heat after it ("3 tolls, ends Smouldering", rules 1.7.1, 1.9.10), and for an action that enters a node the state it pays at (`pays`); null when the action is not legal or costs no time. Fields in section 11. |
| `C` | module | All constants and data tables (CLASS, SPELL, TALENT, TALENT_PER_RANK (preview), PET, CONSUMABLE, BOON, META, BOSS_TEXT, OPENING_SCRIPT, SCRIPT_ACTION, ENGAGE_OPTION, ENGAGE_OPTIONS, ...). |
| `debug` | object | (dev) The dev tools, section 12: build a run at any zone and level, jumps, any encounter, the run's time, god mode, the profile, `validate`. Not game rules; a run they change is a dev run. |

State is plain JSON except `state.content`, a shared reference to the frozen content tables (never copied by
`step`, left out by `serialize`). Compare states with `serialize`. `STATE_VERSION` is 3 since M2b v7 (the run's time
is `state.time` in tolls; 2 since combat v2: enemies carry intent tracks): `deserialize` refuses a state saved by any
other version, and names the reason for a version 2 save ("saved before M2b v7: it counts time in hours, the engine
counts tolls; old saves cannot be loaded, start a new run"). There is no conversion: the UI saves only the profile,
never a run. (M2b v7)

## 2. Phases (rules 1.1)
`CREATE -> ZONE_HUB -> MAP <-> NODE -> ... -> CAMP -> BOSS -> SUMMARY -> ENDED`

| Phase | What is going on | Typical actions |
|---|---|---|
| CREATE | class, pet, name, seed, oaths | `SELECT_CLASS`, `SELECT_PET`, `SET_NAME`, `SET_SEED`, `SET_OATH`, `START_RUN` |
| PREP | (prep) the start camp of an expedition run created with `prep: true` (the default since D116), after START_RUN: no zone yet; `mapView` and `heatView` are null | `TAKE_CONTRACT`, `DROP_CONTRACT`, `BUY_PREP`, `SELL_PREP`, `REROLL_BOARD`, `SET_OUT`, `SET_AUTOPLAY` |
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
| `TRAVEL_ON` | | MAP; level >= `travelLevel(state)` (exit level - TRAVEL_EARLY_LEVELS, Swift Boots one lower) or the last row (ZONE_CHOICE_ROWS) done (then it is the only move). Costs TIME_TRAVEL with every profile (M2 v4: Wayfinder removed). Not in an expedition run |
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
| `USE_ITEM` (in combat) | `slot` 0-2, `target` null | fight; item on the item bar, in the bag, potion cooldown. (M2b v6) With Packed Satchel the fight's first potion costs no turn (below) |
| `FLEE` | | fight, not vs dungeon boss or end boss |
| `PASS` | | fight (the only legal combat action while Glacial Tomb skips your turn, `state.fight.p.skip`) |
| `MOVE` | `nodeId` | (expedition) MAP; a node next to the player's (`mapView(state).moves`). Enters an unresolved, non-hub, non-Dimmed node (its content and tolls); else a walk of TIME_WALK; a walk onto the hub out of the Dimming starts a hub visit (rules 1.9.4) |
| `PASS_THROUGH` | `nodeId` | (expedition) MAP; a neighbour that MOVE would enter: walk through it for TIME_WALK, it stays unresolved |
| `TAKE_ROAD` | | (expedition) MAP, standing on a Road (`mapView(state).onRoad`): TIME_TRAVEL, next zone's hub (zone 6: the Camp); no level gate |
| `RING_BELL` | | (expedition) MAP (not in a node, the hub screen, the Camp or at the boss), a Bell charge left: BELL_CHANNEL_TIME, then (after a Dimmed encounter if the node is Dimmed then) the next zone's hub; no TIME_TRAVEL |
| `TAKE_CONTRACT` / `DROP_CONTRACT` | `index` (board slot, 0-based) | (prep) PREP. Take: not taken, its price within the points left, fewer than CONTRACT_SLOTS held. Drop: taken; refunds the price |
| `BUY_PREP` / `SELL_PREP` | `id` (`C.PREP_OPTION_IDS`) | (prep) PREP. Buy: not bought (each option once), not owned (meta or the `vision` option), the price within the points left, the Bell under BELL_MAX_CHARGES, no Ember carried. Sell: bought; refunds |
| `REROLL_BOARD` | | (prep) PREP; fewer than REROLL_MAX rerolls, REROLL_PRICE within the points left, an offer not taken |
| `SET_OUT` | | (prep) PREP: purchases take effect, the points left become Reserve, then zone 1's hub (phase ZONE_HUB) |
| `TAKE_HUB_CONTRACT` | `mode` (`reserve` or `swap`), `contractId` (swap: a held contract's id; ignored with `reserve`) | (prep) ZONE_HUB of zones 2-6, no service open, before the zone's first `LEAVE_HUB`, its offer not taken. reserve: its price from Reserve and a free slot; swap: abandons that contract (no refund, progress lost), free. (M2b v10: `TAKE_HUB_CONTRACT(mode, contractId)` confirmed, D90; expedition.md 1, 3.6) |
| `USE_SPYGLASS` | `nodeId` (any node of the zone) | (prep) MAP of an expedition zone, a Spyglass charge left: 0 tolls, the node and its neighbours are seen |
| `SKIP_GUIDE` | | (M3) a guided run (newRun `tutorial`) whose guide is neither skipped nor ended, in any phase (a fight and the loot window too): the guide stops (section 14.2) |
| `ENGAGE` | `option`, `target` (enemy index or null), `spellId` (Pre-cast only) | (combat v2) the engage round only (rules 7.10), so once per fight; `option` one of the class's `C.ENGAGE_OPTIONS[classId]`; target rules in `engageOptions(state)` (control options: on an enemy immune to control only as Disrupt, while its track shows a wind-up in turns 1..INTENT_TRACK_LEN, combat v2.1; Send the Pet: a live pet). Key order as listed: `{ type, option, target }`, Pre-cast `{ type, option, spellId, target }` |

One combat action resolves one full round (rules 7.1): player action, pet, enemies in index order, end of
round (then a Signal reinforcement joins), then the next round's intents are shown from the intent tracks. The
events list covers all of it. Round 1 of every fight but the end boss is the engage round (combat v2): enemies are
Unaware and do not act; `CAST`, `ATTACK`, `USE_ITEM`, `PASS`, `FLEE` and `ENGAGE` are legal.

(M2b v6) Packed Satchel's free potion (rules 7.5): with the unlock, the first `USE_ITEM` of a potion in each fight
(the end-boss fight included) resolves as the player's action (its effect, POTION_CD from this round, STEALTH removed,
Arcane Momentum reset) and the round stops there: no pet or enemy action, no end of round, no `round` or `intent`
events; `fight.round`, `stats.rounds` and `stats.bossRounds` stay. The player then chooses again in the same round
(`legalActions` as before, the potion on cooldown; in the engage round the engage options stay legal). Its `action`
event has `free: true`; `freePotion(state)` turns false. Later potions of the fight, Purifying Tonic and Spark Flask
always cost the turn. `stats.potionsUsed` counts the free potion. (M2b v8) The free potion restores FREE_POTION_MULT
(0.5) × its normal amount (rules 7.5: Healing Draught 0.175 of max HP, Mana Draught 0.175 of max mana, Greater Healing
Draught 0.1875 of max HP, a potion unique's bonus included, one rounding); its `action` event also carries `mult`
(FREE_POTION_MULT). Later potions restore the full amount. `potionInfo(state, itemId)` gives the amounts before the use.

## 4. State fields the front end reads
| Path | Meaning |
|---|---|
| `phase`, `time` (the run's tolls, a whole number; M2b v7: was `hours`), `autoplay`, `oaths`, `outcome` | run level |
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
| `met` | (M2b v13) normal enemy template ids met in the run (rules 7.12 first meeting; not grind, trash, Camp, Dimmed or boss fights); recorded whatever `C.GATES.firstMeetWindup` is |
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
| `time` | `add, total, why` | tolls spent (M2b v7: was the `hours` event) |
| `node`, `nodeDone`, `quest` | `type, r, l, cl, heat` / ... / `quest` | node entered / completed / quest template id. (expedition) `node`: `type, id, ring, cl, heat`; `nodeDone`: `type, id`. (heat) `heat`: the node's entry state (rules 1.7.3) |
| `move` | `from, to, via, seen` | (expedition) a step: `via` `enter`, `walk` or `pass`; `seen` = node ids newly in view. (M3) `via: 'rescue'`: a rescue's way back (section 14.2) |
| `rescue` | `tolls, node, to, hp, mana` | (M3) a death in the guided zone is a rescue (section 14.2), sent at the killing blow instead of the player's `death`: the player goes from node `node` back to node `to` (the same node after a Dimmed encounter) with `hp` and `mana` (full; track HP with `= hp`), `tolls` (ONB_RESCUE_TOLLS) follow as a `time` event with `why: 'rescue'`. No `victory` or `fled` event |
| `beat` | `id, what, line` | (M3) a beat of the guided run (section 14.4): `what` `open` (its trigger; `line` = the coach line id), `line` (its line changed, null = open, waiting for its moment; or a resting line came back, D141, at most ONB_LINE_RETURNS times per zone, D142), `done` (learned), `missed` (its moment passed), `skip` (G10 without a contract) |
| `guideSkipped`, `guideEnd` | | (M3) SKIP_GUIDE; zone 1 of a guided run was left (the guide's end toast) |
| `dimming` | `front, dimmed` | (expedition) the Dimming's front advanced; `dimmed` = node ids it newly covers (M2b v12: the zone's Dungeon too, by its hops; M2b v10's DUNGEON_DIM_HOLD removed; no event then) |
| `dim` | `id, depth, level, k` | (expedition) a Dimmed encounter starts at node `id` (its `fight` event follows, `kind: 'dim'`) |
| `bell` | `charges, node` | (expedition) RING_BELL: the channel starts (`charges` left) |
| `swift` | `xp, zt, tolls, node` | (M2b v15) TAKE_ROAD with the Swift passage (rules 1.9.7): the Road was taken at zone time `zt` <= `tolls` (ROAD_SWIFT_TOLLS) from Road `node`; its `xp` event (`why: 'swift'`) and any `levelUp` follow, then the travel's `time`, `travel` and `zone`. Log "Swift passage: +N XP" |
| `prep` | `what` (`buy`, `sell`, `reroll`, `setOut`), `id`, `k`, `left`, `reserve`, `bought`, `contracts` | (prep) a start camp action; `left` = points left; `setOut`: `reserve`, the options `bought`, contracts held |
| `contract` | `what` (`take`, `drop`, `site`, `complete`, `expire`, `abandon`), `id, z, kind, from, node, progress, need` | (prep) a contract changed: taken (`from` `board` or `hub`), dropped at PREP, a site won (`node`, `progress` of `need`), complete (its `xp` and `gold` events with `why: 'contract'` follow; the item choice is a reward set of the node), expired when the zone was left, abandoned by a swap |
| `spyglass` | `node, seen, charges` | (prep) USE_SPYGLASS: the node ids newly seen, charges left |
| `service`, `serviceClosed` | `service, where` | |
| `rest` | `hp, mana, rested` | Rest node or Inn |
| `fight` | `kind, k, engage, heat, enemies[{u, name, level, hp, kind, arch}]` | fight started (`kind`: quest grind elite trash dboss treasure camp boss, (expedition) dim; `engage`: it has an engage round, combat v2). A Dimmed encounter's enemies have `kind: 'shardspawn'`. (heat) `heat`: the node's entry state, null for Camp waves, the boss and Dimmed encounters |
| `round` | `n`, `engage` (true in the engage round, combat v2) | a new round starts (intents follow) |
| `intent` | `u, intent` | enemy intent for this round (section 6); the tracks are in the state |
| `action` | `kind` (`cast` `attack` `item` `pass` `flee` `skip` `engage`), `spell, target, cost, item, success, option, engage, free` | player action. Combat v2: `kind: 'engage'` with `option` and `target` for an ENGAGE; a Pre-cast is `kind: 'cast'` with `engage: 'precast'` and `cost` 0. Combat v2.1: a Disrupt adds `disrupt: true` (log "Disrupt: <boss> will miss <wind-up>"). (M2b v6) `kind: 'item'` with `free: true`: Packed Satchel's free potion, the round goes on (log "Free action (Packed Satchel)"; section 3); (M2b v8) with `mult` (FREE_POTION_MULT, 0.5): it restores that share of its normal amount (log "Free action, half strength (Packed Satchel)") |
| `cancel` | `u, id, name, by, turn, offBalance` | (combat v2) control (`by`: STUN FROZEN HEXED SAPPED) cancelled the enemy's entry `id` this turn; `offBalance`: a heavy or cast, so it is now OFF_BALANCE. Log: "Heavy Smash cancelled: stunned -> off-balance" |
| `replace` | `u, turn, from, fromName, to, toName, reason` | (combat v2) the now-entry could not be played and became the basic attack (rules 7.11) |
| `offBalance` | `u, why, id, name, dur` | (combat v2) the enemy is OFF_BALANCE (`why`: `interrupt`, `control`, `avoided` = a heavy that cost you 0 HP); the status event follows the rules of 7.4 |
| `stagger` | `u, id, name, turn, why, by, stacks, value` | (combat v2.1) a wind-up of enemy `u` (action `id`, `name`, its `turn`) was answered (rules 7.12): it gained a STAGGERED stack (its `status` event comes first); `stacks` = STAGGERED stacks now, `value` = stacks × STAGGER_DMG (its damage dealt less). `why`: `interrupt` (an interrupt, a stun-tagged spell or control stopped it during the round; `by` = the spell or engage option id), `control` (STUN, FROZEN, HEXED or SAPPED cancelled it at its turn's start; `by` = the status), `trap` (a laid trap sprang on it; `by` `STUN`), `disrupt` (Disrupt's trap; `by` `STUN`), `silenced` (replaced by the basic attack; `by` `SILENCED`), `avoided` (a heavy one that cost the player 0 HP; `by` null). Log: "Wind-up answered: staggered". (M2b v13) `deathblow: true` when it was a Deathblow ("Deathblow answered: staggered"); `value` = the sum of the stacks' values |
| `empower` | `u, id, name, turn, stacks, value, deathblow, maimed` | (combat v2.1) a wind-up of enemy `u` (its `turn`) landed (rules 7.12): its hit or rend cost the player or the pet HP, or a cleave, curse, self_heal or self_shield was played; it gained an EMPOWERED stack (its `status` event comes first); `value` = stacks × EMPOWER_DMG. Not sent when that hit ended the fight (the player died). Log: "Wind-up landed: empowered". (M2b v13) `value` = the sum of the stacks' values; a Deathblow: `deathblow: true`, its stack worth DEATHBLOW_EMPOWER, and `maimed: true` when it MAIMED the player (its player `status` MAIMED comes first; false when the player already was): "Deathblow landed: empowered, you are maimed" |
| `trapSprung` | `u, turn, disrupt` | (combat v2) Lay Trap springs (a STUN status and a `cancel` follow); (combat v2.1) `disrupt: true` for Disrupt's trap (then a `stagger` with `why: 'disrupt'`) |
| `signal` | `u, adds` | (combat v2) a skulker's Signal: `adds` enemies join at the end of the round (`summon` with `signal: true`) |
| `petAction` | `target` | |
| `enemyAction` | `u, id, name` | an enemy performs its intent |
| `damage` | `src, dst, amount, hpLost, absorbed, spell, crit, school, tick, immune, sidestep` | see "Damage amounts" below |
| `miss` | `src, dst, spell, dodge` | miss or dodge |
| `heal`, `mana` | `dst, amount, spell, maimed` / `amount, spell` | `amount` = HP (mana) restored. Sent only when something is restored (`amount > 0`): a potion, HOT tick or ration at full health, or Mana Siphon at full mana, sends none. (M2b v13) `maimed: true` on a heal of the player while MAIMED: `amount` is the cut heal (float "Healing halved") |
| `status` | `u, id, on, dur, stacks, src` | status applied (`on: true`) or removed |
| `interrupt`, `skip` | `u, by` | cast interrupted / Chrono Sigil |
| `channel` | `u, name, step` | boss Litany channel step |
| `summon`, `despawn`, `linked` | `u, name, hp, by, signal` / `u` / `on, n` | adds, Shards (`signal: true` for a Signal reinforcement, combat v2), Linked on/off. `linked` is sent when a Shards wave comes (`on: true`) and when the last Shard dies or Shards despawn (`on: false`); `n` = living Shards then. The boss takes `-min(LINK_DR, LINK_DR_PER_SHARD × n)` (rules 10.2); between events, count the living Shards in `state.fight.enemies` |
| `shield`, `enrage`, `image` | `u, amount, by, spell` / ... | enemy shield (`u` = the shielded enemy; Bolster: `by` the mender, `spell: 'bolster'`, combat v2), enemy enrage, Mirrorshade image |
| `phaseChange` | `phase` | boss phase 2 or 3 |
| `death` | `u, name` | enemy, pet or player died |
| `resurrect` | `source` (`boon` `second_breath` `ember`), `hp, mana` | `hp`, `mana`: the player's values after the resurrect (RES_HP_PCT, RES_MANA_PCT). Never `second_breath` in the end-boss fight (M2 v3) |
| `xp` | `amount, rested, why, heat` | (heat) `heat` (only when > 0): the part of `amount` that heat added (rules 1.7.3). (M2b v15) `why: 'swift'`: the Swift passage of a Road (after its `swift` event) |
| `levelUp` | `level, talentPoint, hpGain, manaGain, petHpGain, maxHp, maxMana, petMaxHp` | one per level gained. Current HP, mana and pet HP (live pet) rise by the max gains (rules 4.3); `*Gain` = what was added, `max*` = the new maxima (`maxMana` 0 without mana, `petMaxHp` 0 without a pet) |
| `gold` | `amount, why, heat` | negative when spent. (heat) `heat` (only when > 0): the part of `amount` that heat added |
| `loot` | `item, to` (`bag` or `window`) | |
| `victory`, `fled` | `kind, rounds` | fight over |
| `regen` | `pct, hpGain, manaGain, petHpGain` | post-fight regen (rules 4.2) after a won fight, right after `victory`: `pct` of each maximum, capped at the maximum; `*Gain` = what was restored. Not sent when nothing was restored (or after `fled`) |
| `petRevive` | `hp, spell` | |
| `questComplete`, `story`, `dungeonClear`, `dungeonLeft` | | |
| `boon`, `trap`, `buffEnd` | `id, name` / `amount` / `id` | |
| `learn`, `train`, `respec`, `talent`, `buy`, `sell`, `equip`, `unequip`, `discard`, `bar`, `itemBar`, `useItem`, `lootDropped`, `autoplay` | | bookkeeping |
| `bossStart` | `asc, time, level` | `time`: the run's tolls at the boss (M2b v7) |
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
- `fight.p = { st[], cds{spellId: readyRound}, cp, energy, focus, potionReady, skip, freePotion, ... }`: the player's
  statuses, cooldowns (usable when `round >= cds[id]`), combo points, energy/focus. Mana is `player.mana`. (M2b v6)
  `freePotion`: Packed Satchel's free potion of this fight is unused; read it with `freePotion(state)`.
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
  ("+15 % damage", "-30 % damage"). (M2b v13) `value` is the sum of the stacks' values: a landed Deathblow's EMPOWERED stack
  is DEATHBLOW_EMPOWER (1.00), so read `value`, never stacks × a constant; `deathblows` = the stacks from Deathblows and
  `deathblowValue` their share of `value` (show it apart: "+100 % (Deathblow)"). Player `MAIMED` (M2b v13, rules 7.4): `{ id,
  dur: null, value (MAIM_HEAL), by (the enemy index), src (the Deathblow's id), name }`, the rest of the fight; dispersal and
  a resurrect keep it. Badge it large and lasting ("Healing halved"); `potionInfo` shows the cut potion amounts.
  (M2b v13) Enemy `firstMeet: true` (only while `C.GATES.firstMeetWindup` is on, the default since M2b v14): a first meeting in a quest fight (rules
  7.12), its turn-2 scripted entry is a wind-up; tag the frame "New".

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
`deathblow` (M2b v13; only on Deathblows): the wind-up on SIGNATURE_TURN of an elite, rare or dungeon boss (rules 7.12); a
damaging one's `pct` and `est` include DEATHBLOW_MULT; landed it EMPOWERS by DEATHBLOW_EMPOWER and MAIMS. `firstMeet` (M2b v13,
gated): the first-meeting wind-up of a normal enemy (never a Deathblow). Badge the Deathblow apart from the wind-up badge,
with `est` and "MAIMS if it lands"; `windupView` (6.2) lists its answers.
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
and `alt` = the actions if that phase starts this round (null when they are the same). (M2b v6) Every `est` of the
end-boss fight (Oruvath and the Shards) includes BOSS_DMG_MULT × (1 + asc), as their hits and the Brand's ticks do
(rules 10.1, `C.BOSS_DMG_MULT`; also at Ascendancy 0); `bossStart.asc` and `fight.boss.asc` stay the Ascendancy alone.

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
reason `silenced`, was answered: a `stagger` event says so; one replaced for any other reason is neither). M2b v13: the
intent, `cancelled` and `replaced` also carry `deathblow: true` for a Deathblow (the intent `firstMeet: true` for a first
meeting's wind-up).

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

### 6.2 Deathblow views (M2b v13; docs/specs/changes-m2b-v13.md "UI needs")
`windupView(state)`: one item per wind-up in the living enemies' tracks (enemy index order, then turn; the end boss has
none), null outside a fight:

| Field | Meaning |
|---|---|
| `u`, `enemy`, `turn`, `round`, `inRounds` | the enemy, the wind-up's turn, the fight round it is played in, rounds from now (0: this round) |
| `id`, `name`, `kind`, `heavy`, `target`, `est` | the action as the track shows it; `est` includes DEATHBLOW_MULT for a damaging Deathblow |
| `deathblow`, `firstMeet` | a Deathblow (badge it; rules 7.12), a gated first meeting's wind-up |
| `empower`, `maims`, `maimHeal`, `stagger` | if it lands: EMPOWERED value it adds (DEATHBLOW_EMPOWER or EMPOWER_DMG) and whether it would MAIM the player now (a Deathblow while not MAIMED; `maimHeal` = MAIM_HEAL); if answered: STAGGER_DMG |
| `cancel` | the track's prediction (D52) that it will be cancelled, or null |
| `answers` | `[{ via, id, name, target, spellId, how, sure, now, breaks, wait, stealth }]`: `via` `engage` (engage round only: an ENGAGE whose preview cancels it, or sends a heavy single hit to the pet; `name` 'Disrupt' on a CC-immune enemy), `pass` (M2b v14: `id` 'pass', `how` 'wait', `sure`, `now`: while every living enemy is SAPPED and the track predicts its cancel by SAPPED, waiting answers it; `stealth`: the PASS keeps STEALTH, rules 7.4; show it on the Pass button) or `spell` (a bar spell that answers it in its round: interrupt-tagged, stun-tagged, Hexbind; for a heavy one Glacial Tomb, Feign Stillness, Beastcall Horn, Arcane Ward, Mirrorshade, Smoke Veil, Vanishing Step), listed when its cooldown is over by the wind-up's round; `how`: `disrupt`, `control`, `pet`, `interrupt`, `stun`, `immune`, `ward`, `image`, `dodge`, `stealth`; `sure` false for a chance, an amount or a hit roll (Rime Burst, Deadfall Trap); `now`: usable this round (engage options in the engage round; a spell only in the wind-up's own round, by `castError`); `breaks`: Sap or Hexbind, which any damage ends before the wind-up's turn; `wait` (M2b v14, Sap only): sure if the player then passes until its turn, because every other living enemy is SAPPED or none lives and the wind-up comes after the enemy's turn 1 ("Sure if you wait: press Pass next round"); `stealth` with it: those passes keep STEALTH ("you stay hidden") |
| `ready` | "answers ready": an answer, or a `cancel` that answers it and does not break; false: show "no answer ready" in red |

`autoplayEngage(state)`: in the engage round, when autoplay's rule E2 acts (rules 7.9): `{ action (the ENGAGE `autoAction`
returns), option, name ('Disrupt' or the option's name), target, enemy, windup: { turn, id, name, deathblow }, wait }`; else
null. `wait` (M2b v14; present only when true): the option is a Sap that leaves every living enemy SAPPED and cancels the
wind-up after the enemy's turn 1, so rule H will wait a round (`C.GATES.sapHold` on). The front end shows "Autoplay will
answer the Deathblow with <name>" (with `wait`: "..., then wait a round") while autoplay is on.

Map tooltips (`mapView`): an elite node's `deathblow` and a dungeon node's `bossDeathblow` = `{ id, name, kind (the
ability's kind), heavy, cast (its own flags), type ('heavy': also a full dodge, WARD, an image or the pet answer it; else
'cast': interrupt or control it), damaging }`. An elite's is `{ type }` only while its name is hidden (a rare without Scout's
Eye; on the expedition map always, D50): no `id`, `name`, `kind` or `damaging` (M2b v14, D112; every zone's elite pool has a
heavy and a cast Deathblow, so the type never tells a rare; null if it has none); the dungeon boss's always shows in full.

## 7. Randomness and replays
Streams (rules 0): `map(z)`, `node(z,r,l)`, `fight(z,r,l,k)`, `loot(z,r,l)`, `boss` (`src/rng.js`, sfc32 seeded
by a 32-bit hash of the keys). Hub and camp use row 0; the camp is zone 7; camp wave `w` uses `node(7,w,0)`,
`fight(7,w,0,0)`, `loot(7,w,0)`; hub vendors `node(z,0,0)`. Same seed + same actions = same state (tested).
(expedition) Node ids replace (row, lane): `node(z,id)`, `fight(z,id,k)`, `loot(z,id)` (`STREAM.nodeId`, `fightId`,
`lootId`); the hub is id 0 (its vendor: `node(z,0)`); Dimmed encounter n at node id: `dim(z,id,n)` (make-up, then
its fight). Map draw order: rules 1.9.2; node setup: rules 1.9.3.
(dev) Dev encounter n of a run (section 12): `dev(n, 0)` its fight, `dev(n, 1)` its loot (`STREAM.dev`).
(prep) The board after k rerolls: `prep(k)` (`STREAM.prep`); the hub contract of zone z: `hubc(z)` (`STREAM.hubc`); contract
sites: the zone's `map(z)` stream continued after the node types (kept as `zone.siteRng`); draw orders in section 13.1.
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

M2b v13: first rule E2 (rules 7.9, D108): the class's control option on the first special enemy (elite, rare, dungeon boss)
whose track shows a wind-up in turns 1..INTENT_TRACK_LEN, if legal (Disrupt on a dungeon boss; a lone elite counts; the
Rogue may Sap here, which supersedes D49 for this case). M2b v14 (D111): rule H after rules 1-2, outside the engage round:
`PASS` while every living enemy is SAPPED and a SAPPED enemy's track shows a later wind-up whose cancel is predicted by
SAPPED; that PASS keeps STEALTH (rules 7.4). Switches `C.GATES.sapHold` (rule H) and `C.GATES.passStealth` (the STEALTH), on. Then, combat v2: in the engage round `autoAction` follows rule E (rules 7.9): the class's control option on the enemy
whose track shows the most damage on the player over turns 1..ENGAGE_AUTO_LOOK (with at least 2 enemies), else the
strike option (Mage: Pre-cast of the first bar spell whose autoplay condition holds). The Rogue never gets Sap from
`autoAction` (D49): its rule E is Ambush on the default target. Afterwards it reads only the
now-intents. Combat v2.1: a wind-up is a cast, so rule 3 interrupts it (or stuns it) when an interrupt or stun-tagged
spell is ready. (M2b v6) After Packed Satchel's free potion the round goes on: `autoAction` runs the policy again
in the same round (the potion is then on cooldown). `state.autoplay` only records the toggle. When it is on and `state.fight` is set, the front end calls
`step(state, autoAction(state))` at its own pace (PACE_AUTO_ROUND_S). The simulator calls `autoAction` for
every decision or replaces the out-of-combat part with its bots.

## 9. Meta profile
`profile = { v, echoes, earned, spent, unlocks: {id: rank}, reachedBoss, bossKills, firstKill: {rogue, mage,
hunter}, runs, guide, welcome }` ((M3) `guide` and `welcome`, section 14.5). Unlocks apply at START_RUN (rules 11.4). `END_RUN` puts the updated profile in
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

M2b v6 (D66): Vigor and Edge +0.005 per rank (`C.META.vigor.hpPct`, `C.META.edge.powerPct`; ranks and costs
unchanged; a saved rank keeps its count at the new value). Packed Satchel also gives the free potion (section 3,
`freePotion`).

M2 v5: Starforged Arms is removed (D45), catalogue total 6 560. A stored `starforged` id is handled as Wayfinder
(D42): `state.meta` has no `starforged` flag, the Camp vendor's stock follows the same rule as every vendor (no class
weapon), it is not listed by `metaOffers`, `buyMeta` throws "unknown meta unlock", no Echoes are refunded, and the id
stays stored. The class weapons stay in `CONTENT.uniques` (kind `weapon`); no rule puts them in a run.

M2b v11 (expedition.md 8.2, rules 11.2): the catalogue holds the expedition entries `cartographer` (100), `old_hand` (150)
and `quartermaster` (2 ranks, 120 / 200), catalogue total 7 130. They carry `mapMode: 'expedition'`: on the rows map they
do nothing and `state.meta` has no flag for them (a rows run is unchanged, its state too). In an expedition run with the
start camp (`prep: true`, section 13) Cartographer owns Region Charts, Old Hand Tracker's Notes (`prepView` options
`owned`), and each Quartermaster rank adds PREP_POINTS_PER_QM points. `scout` and `swift_boots` keep their rows effect
(`state.meta.scout`, `state.meta.swiftBoots`) and carry `expedition`: with the start camp Scout's Eye is Pathfinder
(`mapView.vision.typeRadius` = PATHFINDER_RADIUS) and Swift Boots adds `expedition.bell` Homeward Bell charges at
START_RUN (`mapView.bell.charges`, at most BELL_MAX_CHARGES; the Second Clapper is then refused at the start camp when the
Bell is full). Without the start camp none of the expedition effects apply, as before. `C.META_EXPEDITION` stays: the
three expedition entries, the same objects as in `C.META`.

## 10. Expedition map (expedition; rules 1.9)
A run created with `newRun({ mapMode: 'expedition' })` plays the roamable zone graph (rules 1.9). (D116) It is the default
since D116 (with the start camp); `mapMode: 'rows'` plays the classic map, and nothing of a rows run changes. (prep) The start
camp, contracts, the hub contract and the Spyglass come with `newRun`'s `prep` (section 13; on by default on the expedition
map since D116), and so are the catalogue's expedition effects of
expedition.md 8.2 (section 9, M2b v11). Not yet: Ask the Locals. (M2b v11) An expedition run's kills drop more: a normal
or trash kill's item and junk chance × EXPED_DROP_MULT, a dungeon clear EXPED_DUNGEON_BOSS_DROPS rolls (rules 1.9.8, 8.4);
a Dimmed encounter costs TIME_DIM_FIGHT 2 tolls. (M2b v12) EXPED_DROP_MULT is 1.9; the Dungeon dims by its hops as every node
(DUNGEON_DIM_HOLD removed); a Dimmed encounter that the settle step after a MOVE walking farther from the Shardfall starts
costs TIME_DIM_ESCAPE 1 toll (rules 1.9.6), every other one TIME_DIM_FIGHT.

### 10.1 Flow
- START_RUN: phase ZONE_HUB on the hub (node 0) of zone 1 (with the start camp, the default since D116: phase PREP first,
  and SET_OUT enters zone 1's hub; section 13). `LEAVE_HUB` puts the player on the map, standing on the
  hub. `MOVE` back onto the hub (out of the Dimming) is a new hub visit: phase ZONE_HUB, services once each again; the
  hub vendor's stock is drawn once per zone and keeps what was sold.
- MAP: `MOVE(nodeId)`, `PASS_THROUGH(nodeId)`, `TAKE_ROAD`, `RING_BELL`, out-of-combat actions. `mapView(state).moves`
  lists the neighbours with `via` (`enter` or `walk`), `time` and `passTime` (tolls; PASS_THROUGH, null when not legal). (M2b v7)
- A node entered by MOVE plays as on today's map (phase NODE, `state.node = { type, id, cl, stage, k, ... }`). When it
  is done the player stands on it (phase MAP).
- Settle step: after every action, once the player is on the map or in the hub with nothing open (no node, fight,
  service or loot window), tolls spent since the last check make the engine check the Dimming: if the player's node is
  Dimmed, a Dimmed encounter starts (phase NODE, `state.node.type === 'dim'`, `state.fight.kind === 'dim'`). After it
  (won or fled) the player is back on the map on the same node. Then a ringing Bell completes (next zone).
- Leaving: `TAKE_ROAD` (on a Road) or the Bell; either goes to the next zone's hub, zone 6's to the Camp. (M2b v15) A Road
  taken at zone time <= ROAD_SWIFT_TOLLS first pays the Swift passage XP (`swift` event; `mapView.swift` shows the window).

### 10.2 State fields (expedition)
| Path | Meaning |
|---|---|
| `mapMode` | `'rows'` or `'expedition'` (every state; saves without it are rows) |
| `exp` | `{ vision: { radius, regions, typeRadius, tracker }, bell (charges), pending, bellPending, dimming, outward, contracts, nextContract, reserve, spyglass, mule }` (engine bookkeeping; `outward` (M2b v12): set by a MOVE that walks farther from the Shardfall, read and cleared by the settle step of the same action, so false between actions; read the Bell from `mapView`, contracts from `contractView`; `dimming` false: newRun option, D50) |
| `prep` | (prep) `{ points, board, rerolls, bought, done }`: the start camp; kept after SET_OUT (`done`). Read it with `prepView` |
| `zone` | `{ z, mode: 'expedition', nodes[], hub: 0, roads[], shardfall, shardDist[], pos, start (run tolls at arrival), seen[], typed[], dimN[], hubStock, path[], questsDone, storyDone, dimOff? }`: the full zone (hidden contents included; `dimOff` true in a run without the Dimming). Draw the map with `mapView`, never from here |
| `node` | `{ type, id, cl, stage, k, ... }`; a Dimmed encounter: `{ type: 'dim', id, cl (its level), stage, k, depth }` |
| `stats.exp` | `{ walks, passes, dimFights, bells, bellExits, roads, swift, maxRing, zones[] }` (the summary's `expedition` block; (M2b v15) `swift`: Roads taken with the Swift passage, a zone record's `swift`: the XP its Road paid) |
| `death` | adds `node`, `ring` and `depth` (Dimmed encounters); `row` and `lane` are null |

### 10.3 `mapView(state)` in an expedition run
```
{ mode: 'expedition', z, name, zt (zone time: tolls since arrival at the hub), pos (player's node), hub: 0, roads: [ids], shardfall: id,
  roadNames: [name per Road, in the order of roads] (D51; null without content names),
  texts: { shardfall, shardspawn, dimming, homeward_bell } (D51: content texts.expedition; each null when missing),
  onRoad (TAKE_ROAD legal here), walkTime (TIME_WALK), travelTime (TIME_TRAVEL), bell: { charges, channelTime (BELL_CHANNEL_TIME) },
  spyglass (prep: Spyglass charges left),
  swift: (M2b v15, rules 1.9.7; null while C.GATES.swiftRoad is off) { tolls (ROAD_SWIFT_TOLLS), frac (ROAD_SWIFT_XP_FRAC),
    left (tolls left in the window: tolls - zt; 0 = a Road taken now still pays; null once passed), xp (what a Road taken
    now pays: round(frac × xpToNext(L)); 0 once passed or at MAX_LEVEL), eligible (xp > 0) }; shown on the hub too,
  vision: { radius (full, capped), regions (Region Charts), typeRadius (Pathfinder) },
  dim: { grace (DIM_GRACE), frontHops (DIM_FRONT_HOPS), frontTime (DIM_FRONT_TIME), front (-1 before the grace ends;
    then floor(frontHops × (zt - grace) / frontTime)), nextIn (tolls until the front moves: dimAt(front + 1) - zt, at
    least 1), off (D50: a run without the Dimming; then front -1 and nextIn, every node's dimsIn and dimAt are Infinity) },
  regions: [{ id, name, kind, families }]  (the zone's regions in content order; name null and families [] without
    content regions; D51: families so contract text can name them),
  bands: [[min, max] per ring], edges: [[a, b]], moves: [{ nodeId, via, time, passTime, dimmed }],
  nodes: [node] }
node (every node): { id, ring, angle (degrees), nb (neighbour ids), hops (from the player), hub, road, shardfall,
  dimmed, dimsIn (tolls from now; 0 = Dimmed), dimAt (zone toll it dims: grace + ceil(hops from the Shardfall ×
  frontTime / frontHops), the zone's Dungeon too (M2b v12: M2b v10's DUNGEON_DIM_HOLD removed, so every node shows the
  engine's value), know ('full' | 'type' | 'none'),
  region (content region index, or null when unknown) }
know 'full' (the hub, or seen) adds: type, cl, done, lost (Dimmed and unresolved), and the details of the rows view:
  quest { title, archetypes }, grind { archetypes }, elite { level, archetypes ([null, the add's archetype]: one
  entry per enemy, the elite's own hidden, D50), rare: null, name: null (D50: neither tells a rare), deathblow: { type }
  (M2b v14, D112: 'heavy' or 'cast' only; M2b v13 hid it with the name) }, dungeon { name, level, bossLevel, fights, bossArchetype, bossDeathblow (M2b v13, 6.2) },
  treasure { guarded, trap: null, archetypes },
  vendor { ember: null }
know 'type' (Pathfinder within its radius; the dungeon with Region Charts or a held Delve contract of the zone, prep) adds: type
sites (prep; only when the player sees marks there): [ids of held contracts with a site on the node], on a 'full' node,
  and with Tracker's Notes on any node within TRACKER_RADIUS hops (hidden ones too)
```
Nothing else of a hidden node is read: qa/engine/s01b checks that a hidden node has only the skeleton keys and that
`mapView` (and `autoAction`) do not change when hidden contents are replaced.

### 10.4 Summary (expedition)
`summary(state)` adds `mapMode: 'expedition'` and `expedition = { walks, passes, dimFights, dimZones, bellsRung,
bellCharges (left), roads, swift, maxRing, zones: [{ z, time, nodes, walks, passes, dimFights, exit ('road' | 'bell' |
null), swift }], dimming (false in a run without the Dimming, D50), contracts (prep: { taken, completed, expired, abandoned, held, bought (option ids), reserve }) }` (`time`: the zone's tolls; the current zone's so far). (M2b v15) `swift`: Roads taken with the Swift passage; a zone's `swift`: the XP its Road paid (0 without). (prep) Echo lines `contracts` (completed × ECHO_PER_QUEST × ECHO_CONTRACT_MULT) and `reserve` (Reserve × PREP_ECHO_PER_POINT); `minutes` adds PACE_PREP_S once and PACE_HUB_CONTRACT_S per hub with an offer. `minutes` adds the walk and pass terms and the Bell
(rules 1.9.8). `death` as 10.2.

## 11. Heat (heat; rules 1.7.1-1.7.2, 1.9.10)
One meter for time pressure in both map modes (docs/specs/expedition.md section H; the UI rules are H.4; the player
sees it as the Furnace with the states Calm, Smouldering, Burning and Infernal, D68: the engine keeps the names below).
The engine computes everything the meter shows, so the UI never re-implements the line, the states or the Dimming's
clock. Every time value is a whole number of tolls (M2b v7): the line is rounded up per zone, `ceil(par × min(z, 6) /
6)` in integers (D70; Oath of Haste, par 100: 17, 34, 50, 67, 84, 100), so the heat is whole too.

### 11.1 `heatView(state)`
```
{ time, par (bossPar), z (state.zone.z; the Camp ZONE_COUNT + 1), line, heat (time - line; negative = in hand),
  inHand (max(0, -heat)), past (max(0, heat)), stateRun, dimIn, stateDim, state, by ('run' | 'dim'),
  ascIfPar, gain, rarityUp, bar: { min, max, marker, beyond }, next: [{ action, ...heatPreview(action) }] }
```
- `state`, `stateRun`, `stateDim`: one of `C.HEAT_STATES` (`'clear'`, `'warm'`, `'hot'`, `'scorched'`). `stateRun` from
  the heat (rules 1.7.2); `stateDim` from `dimIn` (rules 1.9.10), null without a Dimming clock (a rows run, the Camp,
  or `dimming: false`); `state` is the hotter of the two, and `by` names the clock that sets it (`'dim'` only when the
  Dimming state is hotter).
- `dimIn`: tolls until the player's node dims (0 or less: it is Dimmed), or null. Text: "Dimming: 3 tolls".
- `ascIfPar`: the boss Ascendancy if the player leaves the zone now and keeps the line from here ("Boss +2 %"; steps of
  ASC_PER_STEP 0.02 per ASC_STEP_TIME past the par, M2b v6). At the Camp it is the Ascendancy FIGHT_BOSS would give.
- `node`: inside a node, `{ state, gain, rarityUp }` of the state the node was entered in, which is what it pays (it
  can differ from `state` once the node's tolls are spent); null elsewhere (map, hub, Camp, boss, Dimmed encounter).
- `gain`, `rarityUp`: `C.HEAT_GAIN[state]` and `C.HEAT_RARITY_UP[state]`, the rewards of the state (rules 1.7.3):
  "+35 % XP and gold, 1 in 2 drops a rarity up" (Hot; Scorched "+50 % XP and gold, 7 in 10 drops a rarity up", M2b v6).
- `bar`: `min` = HEAT_BAR_MIN, `max` = HEAT_BAR_MAX, `marker` = heat clamped to the bar, `beyond` = -1 / 1 when the
  heat is off the bar (draw the arrow), else 0. The line is the mark at heat 0.
- `next`: the legal choices of the current phase that cost time, each with its preview: map moves (rows:
  `CHOOSE_NODE` per reachable lane and `TRAVEL_ON`; expedition: `MOVE` and `PASS_THROUGH` per neighbour, `TAKE_ROAD`,
  `RING_BELL`), hub and Camp services (`SERVICE`), `CAMP_GRIND`, and in a Grind `GRIND_SET_WAVES` and `NEXT_FIGHT`.
  Empty during a fight. Match an entry to a map node by `action.lane` or `action.nodeId`.

### 11.2 `heatPreview(state, action)`
```
{ time, timeAfter, line, heat, stateRun, dimIn, stateDim, state, by, ascIfPar,   (as heatView, after the action)
  change (state differs from now), dimFight, perWave, pays, swift }
```
- `swift` (M2b v15, rules 1.9.7): for `TAKE_ROAD`, the Swift passage XP the Road pays now (as `mapView.swift.xp`); null
  when it pays none and for every other action.
- `time`: the tolls the action costs (`timeAfter` = run time then), as the engine spends it: node tolls (rules 2.0, 1.9.8), a walk or a pass
  (TIME_WALK), TRAVEL_ON and TAKE_ROAD (TIME_TRAVEL), the Bell's channel (BELL_CHANNEL_TIME), a service, a Camp wave,
  n Grind waves. `dimFight`: the step, node, service or channel ends on a node that is Dimmed by then, so a Dimmed
  encounter follows (rules 1.9.6); its tolls are included (TIME_DIM_FIGHT; TIME_DIM_ESCAPE for a MOVE that walks
  farther from the Shardfall, M2b v12) and the state after is Scorched. `perWave`: a Grind
  whose waves are chosen inside (today's map): `time` is one wave. Text: "3 tolls, ends Smouldering".
- Leaving the zone (TRAVEL_ON, TAKE_ROAD, RING_BELL): the state after uses the next zone's line (the Camp: the par);
  `dimIn` is null there (the next zone's map is not drawn yet; its hub is at least 3 hops from the Shardfall, so it
  starts Clear).
- `pays`: for an action that enters a node (CHOOSE_NODE, MOVE into an unresolved node), the state the node is entered
  in: the state now, with the Dimming clock of the node entered (rules 1.7.3 fixes the node's rewards by it). null
  for every other action.

### 11.3 Rewards and the summary (rules 1.7.3, 1.7.4)
- Entry state: `state.node.heat`, the `node` event's `heat` and `state.fight.heat` (each fight of the node) are the
  state at the moment of entry, before the node's tolls (`heatPreview(...).pays` showed it).
- XP and gold of the node × (1 + `C.HEAT_GAIN[heat]`) after rested and meta: the `xp` and `gold` events carry the
  extra as `heat`.
- Every item rolled on a drop table in the node is one rarity step higher below `C.HEAT_RARITY_UP[heat]`; the item's
  `rarity` is the final one (no extra field).
- `summary(state).heat`:
```
{ trackPerZone: [{ z, line, entry, exit }],   (z: 1-6, the Camp ZONE_COUNT + 1; line: whole tolls; entry / exit:
                                                run tolls; the last zone's exit = the run's time so far)
  timeByState: [clear, warm, hot, scorched], nodesByState: [4], fightsByState: [4] (fights won in map nodes),
  echoHeat }                                   (the Echo line `heat`, before the Oath multiplier)
```
  The tolls-against-the-line chart: per record, heat `entry - line` at arrival and `exit - line` when left.

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
| `build({ content, classId, petId, name, seed, profile, oaths, mapMode, vision, dimming, prep, zone, level, rarity, ilvl, talents, gold, potions, time })` | `{ state, events }` | A run at zone `zone` (1..ZONE_COUNT; ZONE_COUNT + 1 = the Camp), phase ZONE_HUB (CAMP). Defaults: classId `rogue`, a Hunter's first pet the profile has, seed 0, `oaths` [] (sworn in CREATE; the profile must own them), mapMode and prep as `newRun` (D116: `expedition` with the start camp, left with nothing bought, every point Reserve; `rows` the classic map), level the zone's first (the Camp MAX_LEVEL), rarity DEV.RARITY, ilvl level + the rarity's `ilvlBonus` (at most ILVL_MAX), talents `'auto'` (autoplay's default build, one SPEND_TALENT at a time) or `'unspent'`, gold DEV.GOLD_V × V(level) copper, potions DEV.POTIONS Healing Draughts (a Mage as many Mana Draughts too), time (whole tolls) the line of zone - 1 (on schedule; whole since M2b v7; the expedition zone's clock starts there); the old option `hours` throws. Every slot holds fixed-stat gear of that ilvl and rarity (as starting gear: the class's primary, STA, the power affix; generated names). Every spell the trainer teaches up to the level is learned and trained to it; the bars are autoplay's; full HP and mana. The heat records (summary `heat`) and the expedition zone records start at this zone; zones left = zone - 1 |
| `toCamp(state)` | `{ state, events }` | To the Camp (phase CAMP), leaving whatever is open (below); the run's time stays; zones left at least ZONE_COUNT |
| `toBoss(state, { phase })` | `{ state, events }` | The end-boss fight (phase BOSS, round 1), from anywhere (the Camp first). `phase` 2: the boss at floor(P2_AT × HP), 3: ceil(P3_AT × HP) - 1, each reached by the engine's own phase change (rules 10.2: Shards come with phase 2, go with phase 3); its intent and track are then shown for the new phase. Ascendancy from the run's time (rules 1.7) |
| `nextZone(state)` | `{ state, events }` | The next zone's hub as by TRAVEL_ON (a Road, TAKE_ROAD, on the expedition map): TIME_TRAVEL, no level gate; from zone ZONE_COUNT the Camp. Throws at the Camp. (M2b v15) Never the Swift passage: the level stays as built |
| `encounter(state, { ids, level })` | `{ state, events }` | A fight against one or more enemy templates by id, any kind, each as its template's `kind` (normal, elite, rare, trash, dboss) at `level` (default: the player's level). Fight kind: `dboss`, `elite` (elite or rare), `trash` or `grind`, by the strongest; an engage round as every fight; no flight from a dungeon boss; no heat. Played in phase NODE as node `{ type: 'dev', cl, stage, k, heat: null, from, enemies, id (expedition: the player's node) }` on the dev stream (`STREAM.dev(seed, n, 0)` the fight, `(seed, n, 1)` its loot). Won or fled, the player is back at `from` (`MAP`, `ZONE_HUB` or `CAMP`); kills pay their XP, coin and loot; no map node is resolved |
| `killTarget(state, target)` | `{ state, events }` | Kill a living enemy of the current fight (default: `defaultTarget`) through the damage pipeline (`damage` event `src: 'dev'`): kill rewards, a boss's phase changes. The last one ends the fight as a victory (a boss kill ends the run). Then the settle step (expedition) |
| `refill(state)` | `{ state, events }` | Full HP and mana, the pet alive at full HP; in a fight also full energy and focus, no cooldowns, potions ready |
| `setGod(state, on)` | `{ state, events }` | God mode: the player takes no damage. It works as a lasting IMMUNE that Final Dark does not pierce (`damage` event `amount: 0, hpLost: 0, immune: true, god: true`), so a heavy blow on the player counts as avoided (rules 7.13: OFF_BALANCE; 7.12: its wind-up answered). The pet takes damage as usual. Turning it off when it is off changes nothing |
| `give(state, { gold, potions, talentPoints })` | `{ state, events, given }` | Gold in copper; Healing Draughts while the bag takes them (a Mage as many Mana Draughts); unspent talent points on top of the level's (rules 6: `talentPointsFree` counts them, SPEND_TALENT spends them). `given`: what was added |
| `setTime(state, time)` | `{ state, events }` | (M2b v7: was `setHours`) The run's time in tolls (whole, >= 0): heat, the boss's Ascendancy. The zone's own clock stays: on the expedition map its arrival toll moves with the run's, so the Dimming stands where it was; the zone's open heat record moves the same way |
| `setHeat(state, heatState)` | `{ state, events }` | `setTime` to `line + x` (whole; no rounding needed since M2b v7), x the middle of the state's band (rules 1.7.2): Clear HEAT_WARM_AT - (HEAT_HOT_AT - HEAT_WARM_AT) / 2, Warm (HEAT_WARM_AT + HEAT_HOT_AT) / 2, Hot (HEAT_HOT_AT + HEAT_SCORCH_AT) / 2, Scorched HEAT_SCORCH_AT + (HEAT_SCORCH_AT - HEAT_HOT_AT) / 2. `heatView(...).stateRun` is then that state |
| `revealMap(state)` | `{ state, events }` | Expedition: every node of the zone seen (`know: 'full'`). Today's map hides only rare elites, traps and vendor Embers: Scout's Eye is on for the rest of the run (`state.meta.scout`). Throws at the Camp |
| `setMapMode(state, mode)` | `{ state, events }` | Play on with the other map: the current zone is drawn again in that mode and the player is at its hub (services again; its heat record stays); at the Camp only the mode changes. An expedition starts without vision unlocks, with the Dimming and BELL_START_CHARGES. The same mode changes nothing |
| `grantEchoes(profile, n)` | profile | n more Echoes to spend (not counted in `earned`) |
| `resetOnboarding(profile)` | profile | (M3, m3-onboarding.md E8) `guide` `'todo'`, `welcome` false; unlocks, Echoes and runs stay. The Dev menu's "Reset onboarding" also clears the UI's `tbwcr.hints.v2` |
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

## 13. Start camp and contracts (prep; docs/specs/expedition.md 2-3, task 2b.5)
An expedition run created with `newRun({ mapMode: 'expedition', prep: true })` goes `CREATE -> PREP -> ZONE_HUB -> ...`:
START_RUN builds the character and opens the start camp; SET_OUT applies the purchases and enters zone 1. (D116) This is
`newRun`'s default since D116: `newRun({})` is `{ mapMode: 'expedition', prep: true }`. With `prep: false` an expedition run
plays exactly as before 2b.5 (no PREP, contracts, hub offers or Spyglass; the story chain stays), and a rows run
(`mapMode: 'rows'`) never has any of it (both checked run for run against the engine before 2b.5).
`debug.build({ mapMode: 'expedition' })` (its default too) sets out with nothing bought. sim/lib/policy.mjs `makeBot`
answers phase PREP since 2b.5's sim slice. (M2b v10) The M2b v10 numbers that are not contract numbers (XP_WEIGHT_MULT 1.4, EXPED_TIME_DUNGEON 5;
DUNGEON_DIM_HOLD 3 until M2b v12 removed it) act on every expedition run, with or without `prep`; rows runs are untouched by v10.
(M2b v12) The same holds for EXPED_DROP_MULT 1.9 and TIME_DIM_ESCAPE; the Delve's price 2 acts with `prep`.

### 13.1 Rules as the engine plays them
- Points: `PREP_POINTS + PREP_POINTS_PER_QM × min(profile.unlocks.quartermaster, 2)`. Spent on contracts (their price),
  options (each bought once) and rerolls (REROLL_PRICE each, not refunded); DROP and SELL refund. Left at SET_OUT: Reserve.
- (D128, a lean start camp) CONTRACT_BOARD_SIZE 3: the board is zones 1, 2, 3 (was 8; CONTRACT_BOARD_EXTRA retired).
  REROLL_BOARD is refused ("no reroll at the start camp") while `C.GATES.campReroll` is off, its default; on, the rule
  below holds. BUY_PREP refuses an option not in `C.PREP_CAMP_OPTIONS` ("not offered at the start camp"): the camp sells
  Field Draughts, Ember of Return, Region Charts and Tracker's Notes; the other options keep their SET_OUT effects.
  `contracts.js drawBoard(s, k, kept, size)` draws a board of `size` slots (default CONTRACT_BOARD_SIZE; tests draw 8).
- (D132, the board across the run) With `C.GATES.boardAcrossRun` on (the default), slot i draws its zone from
  `C.CONTRACT_BOARD_BANDS[i]` = [[1,2],[3,4],[5,6]]: the board is one offer each from zones 1-2, 3-4 and 5-6. Off: the
  D128 board (zones 1, 2, 3; the stream as D128 drew it). `contracts.js boardBand(i)` gives a slot's band [lo, hi] under
  the switch. prepView's `z`, `zoneName`, `band` and `reward` follow the drawn zone (no new fields).
- Board (`prep(k)`): slot i takes its zone from its band `boardBand(i)` (D132, switch on: CONTRACT_BOARD_BANDS[i]; off:
  zone i + 1 while i < ZONE_COUNT; past those: 1..ZONE_COUNT): 1 draw `lo + nextInt(hi - lo + 1)` when lo < hi, none for
  a band of one zone. Each offer: kind by weight CW_* (1
  draw); Cull and Bounty: region (1 draw, uniform over the zone's regions in content order), family (1 draw over the
  region's families; null without), Bounty: its elite (1 draw over the zone's rares of that family, else over all its
  rares); Delve: the zone's dungeon. REROLL_BOARD replaces every offer not taken by the same slot of `prep(k + 1)`; a
  taken slot still makes its draws and keeps its offer. No repeats (2026-11-11): a slot whose offer equals one already on
  the board (same zone, kind, region, family and elite; an earlier slot or a taken offer) takes instead one `weightedIndex`
  draw over the offers it can draw (its band's zones, each 1 / band size: a zone slot its zone, a band slot its band, an
  extra slot every zone) that are not on
  the board, each weighted by its chance in the normal draw (kind weight, then 1 / regions, 1 / families, 1 / the elite
  list), in the order zone, kind (CONTRACT_KINDS), region, family, elite; with none left the offer stays. A board without
  a repeat is drawn as before; the zone and band slots of `prep(0)` never change. `contracts.js sameOffer` is the comparison.
- Slots: at most CONTRACT_SLOTS contracts held at once (taken and not complete, expired or abandoned).
- SET_OUT: Field Draughts, Trail Pack and the Ember go into the bag (what does not fit: the loot window); Second Clapper
  +1 Bell charge (at most BELL_MAX_CHARGES); Pack Mule +PREP_MULE_SLOTS bag slots for the run (`bagCapacity`); Region
  Charts, Tracker's Notes (TRACKER_RADIUS), Local Guide (+GUIDE_RADIUS_BONUS radius) and the Spyglass (SPYGLASS_CHARGES)
  for the run. Owned (not for sale): Region Charts with `cartographer`, Tracker's Notes with `old_hand` (profile unlocks)
  or with the newRun `vision` option (`charts`, `guide`).
- Sites, when a zone is generated (held contracts of the zone, in the order taken) and when the hub contract is taken, on
  `map(z)` after the node types: Cull: one draw per Quest or Grind node (id order) below CULL_SITE_IN in the target region,
  else CULL_SITE_OUT; then while fewer than CULL_SITES + CULL_SITE_SPARE, one draw adds a Quest or Grind node of the region;
  then per site (id order) without a mob of the family: one draw picks a zone normal of the family, which replaces the last
  mob, else an earlier one, the first that keeps rules 7.14 (none: unchanged). Bounty: BOUNTY_PLACED times one draw over the
  region's ring 2-3 nodes that are not the Dungeon, a Rest, a Road, the Shardfall, the Trainer or a site; a non-Elite is set
  up again as an Elite on `node(z, id)`; its elite becomes the bounty's rare. Delve: the Dungeon (no draw).
- Progress: a site counts when its node is won: a Quest's encounter, a Grind's first wave, an Elite's fight, a Dungeon's
  boss. The last one completes the contract at once: XP `round(xpFrac × XP_WEIGHT_MULT × xpToNext(CL_c) × (1 + Quick
  Study + Insight))` with no level-difference modifier (M2b v10; was `eventXp`, diffMod at the player's level), not a kill
  (no rested XP), 0 at MAX_LEVEL, then the node's heat; CL_c = 10z - 2 (CONTRACT_CL_OFFSET 8, M2b v10); gold
  `goldV × V(CL_c)` (`why: 'contract'`; Prospector and the node's heat apply), and an item choice of
  `choices` items on table `contract` or `bounty` at level CL_c from the node's loot stream (heat's rarity step applies),
  offered after the node's own rewards (`CHOOSE_REWARD`). A completed Bounty's other site gets its own elite back.
- Expiry: leaving a zone (Road or Bell) expires its held contracts. Story chain: off on the expedition map.
- Hub contract (`hubc(z)`, zones 2-6, as one board offer): `TAKE_HUB_CONTRACT` before the zone's first LEAVE_HUB.

### 13.2 `prepView(state)`
```
{ points, spent, left, slots, held,
  board: [{ index, z, zoneName, band: [min, max], kind, region, regionName, family, template, name (Bounty: the elite's
    name), dungeon (Delve: its name), need, price, reward: { cl, xpFrac (levels-worth incl. XP_WEIGHT_MULT), xp (M2b v10:
    the XP it pays if completed now, before heat; 0 at MAX_LEVEL), gold (copper, before Prospector and heat), choices,
    table, rarity: { rare, epic } }, taken, canTake, canDrop }],
  options: [{ id, name, kind ('supply' | 'vision'), price, owned, bought, canBuy, canSell, why (why it cannot be bought),
    item, qty, bell, slots, charges }]   (D128: only the ids of C.PREP_CAMP_OPTIONS, in PREP_OPTION order),
  reroll: { open (D128: C.GATES.campReroll; the screen shows no reroll while false), used, max, price, can },
  reserve: { points, echoes } }
```

### 13.3 `contractView(state)`
```
{ slots, held, reserve,
  contracts: [{ id, z, zoneName, band, kind, region, regionName, family, template, name, dungeon, need, price, reward,
    from ('board' | 'hub'), progress, status ('active' | 'later' | 'complete' | 'expired' | 'abandoned') }],
  hub: null or { ...the offer as above, reserve (TAKE_HUB_CONTRACT reserve legal), swap: [contract ids a swap may give up] } }
```
Site locations are never in it: the map shows the marks the player sees (`mapView` node `sites`).

### 13.4 Engine defaults (confirmed by the designer, M2b v10, D90)
Each option once per run (supplies do not stack); a Bounty's elite of another family when the zone has no rare of the
target family (a fallback: content adds the missing family rares before the flip); the Trainer is never a Bounty site and
a completed Bounty's other node gets its own elite back; a Cull site without a mob of the family takes a zone normal of
it, else stays as it is (it still counts); the hub contract only before the zone's first LEAVE_HUB; `swap` names the
contract it gives up: `TAKE_HUB_CONTRACT(mode, contractId)`, `contractId` for `swap` only (ignored with `reserve`); a
Delve shows its dungeon's type while held or complete; a Grind site counts at its first wave won; REROLL_BOARD replaces
slot by slot from `prep(k + 1)` (with `GATES.campReroll` on; off since D128); board draws: kind, region, family (always one draw), the Bounty's elite, extra slots
their zone first; Cartographer, Old Hand and Quartermaster are read from `profile.unlocks` (catalogue entries in `C.META`
since the M2b v11 build, section 9; `C.META_EXPEDITION` names the three); autoplay's start camp: (D133, `C.GATES.autoEmberFirst`
on) the Ember of Return when affordable (`BUY_PREP` legal: points, EMBER_MAX_CARRIED), then the board's
contract for each of zones 1-AUTO_PREP_ZONES whatever its kind (D132: on the board across the run that is the zone 1-2
offer, and the middle offer only when it is zone 3; unchanged by D132) (a Delve costs 2 again since M2b v12) while AUTO_PREP_RESERVE
points stay, then (D133) Field Draughts when AUTO_PREP_RESERVE points still stay after them; with the switch off, the order
before D133: Field Draughts first, then the contracts, no Ember; the hub contract from Reserve when it can; its map policy
does not seek sites.

## 14. The guided first run (M3; docs/specs/m3-onboarding.md 2, 4.2, 5 E1-E10; D135, D137, D138, D141, D142)
`newRun({ tutorial: true })` (the expedition map with the start camp; `src/engine/tutorial.js`) plays the profile's guided first
run. Zones 2-6 and everything after the guide are the normal rules. A run without the option is unchanged run for run
(qa/engine/s18 golden check). The balance bots never set it. Numbers: `C.TUTORIAL_SEED` and `C.ONB_*` (m3-onboarding.md 12).

### 14.1 Seed and overlay (E1, E2)
- `state.tutorial = { on, skipped, ended, rescues, script, sites, beats }` from START_RUN (`script`: scripted fights ended;
  `sites`: Cull site fights started; `beats`: engine bookkeeping, read `tutorialView`). `create.tutorial` is true.
- Zone 1's streams `map(1)`, `node(1, id)`, `fight(1, id, k)`, `loot(1, id)`, `dim(1, id, n)` and the hub vendor take
  `C.TUTORIAL_SEED` (8736, D137) in place of the run seed (`expedition.js zoneSeed`), skipped or not, so every guided run
  gets the same zone 1 (Cull sites 1, 4, 7; Gorrak on node 18; Roads 23, 27, 19; Shardfall 25). Item names keep the run seed.
- Board slot `CONTENT.tutorial.board.slot` (1) is the content's contract (a Cull of `wild` in region `z1_wilds`, zone 1)
  after the board's own draws, so slots 2-3 are those of the run seed; a reroll keeps it.
- Gorrak: the Elite node nearest the hub (ties: lowest id) holds `elite.enemy`, alone unless `elite.add`, never the rare
  unless `elite.rare`, at `clamp(L, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX)` (the map's elite `level` follows L).
- Gate (D138): while the guide runs, his node is barred until script `elite.gate.afterScript` (`s4`) has ended (won, fled
  or rescued): `MOVE` and `PASS_THROUGH` onto it are illegal, `mapView` marks the node and its move `barred: true`, the
  autoplay map policy treats it as closed. SKIP_GUIDE (and leaving zone 1) opens it.
- Scripts and sites: every unresolved Quest and Grind node of zone 1 plays its role, laid on its encounter after every
  action (so `mapView` shows it): a node with a held contract's site plays `siteFights[min(sites, last)]` at the node's level;
  any other plays the next script `scripts[script]` (S1-S4, ONB_SCRIPTED_FIGHTS) at `min(its level, ONB_SCRIPT_LEVEL_MAX)`
  (its `cl` too); once the scripts are used up, its own encounter. A Grind plays it as its only wave. `fight.tut = { kind
  ('script' | 'site'), i, id }`. A scripted fight's end (any outcome) advances `script`.
- Wind-ups (D138): in an overlay fight only enemies with `windup: true` play their turn-2 scripted action as a wind-up (the
  first-meeting mechanism, any fight kind; S4's Scarecrow Hexer: Hex Bolt); every other quest fight of the guided zone has
  no first-meeting wind-up. Elite, rare and dungeon-boss wind-ups and Deathblows are unchanged.
- S1's loot (`scripts[0].loot`), on a win, replaces its drops: one item of rarity `loot.upgrade` for the class's weakest slot
  by `itemScore` (fixed stats as starting gear, ilvl = the node's level + the rarity's bonus; an upgrade), and
  ONB_LOOT_POTIONS of `loot.consumable`.
- `validateContent` checks the table (content.js `validateTutorial`): seed = C.TUTORIAL_SEED, board kind / zone / region id /
  family, site fights and exactly ONB_SCRIPTED_FIGHTS scripts of the zone's normals, `windup` booleans, the loot's rarity and
  consumable, the elite among the zone's elites with its Deathblow among its abilities, `gate.afterScript` a script id, 13
  beats G1-G13 and 37 hints H01-H37 in order.

### 14.2 Rescue and SKIP_GUIDE (E3, E4)
- The guided zone: zone 1 while the guide is neither skipped nor ended. A death there (not the Camp or the end boss, which
  zone 1 never has) is a rescue, before any resurrect source: event `rescue`, the fight ends (no `victory` or `fled`), the
  player goes back to the node it came from (`zone.path`; after a Dimmed encounter or a dev fight: the same node) with full
  HP and mana and a living pet at full HP, the node stays unresolved, ONB_RESCUE_TOLLS tolls (`time` `why: 'rescue'`; the
  Dimming moves, and the settle step may start a Dimmed encounter), `tutorial.rescues` + 1. Back on the hub out of the
  Dimming it is a hub visit (phase ZONE_HUB). No limit.
- `SKIP_GUIDE`: `tutorial.skipped`; open beats close as missed; event `guideSkipped`; no rescue from then on; Gorrak's node
  opens; the zone, its streams and its overlay stay. Refused after the guide has ended (an engine choice; spec E4 says "while
  not skipped").
- Leaving zone 1 (a Road or the Bell; after a dev jump, at the next action) ends the guide: `tutorial.ended`, event `guideEnd`.

### 14.3 `tutorialView(state)` (E5)
```
{ on, skipped, ended, guidedZone, script, scripts (ONB_SCRIPTED_FIGHTS), next (the next script id or null), sites,
  eliteNodeId, elite: { node, enemy, level, barred, afterScript, left (scripted fights until the node opens) } (null outside zone 1),
  rescues, rescueTolls (ONB_RESCUE_TOLLS),
  beat, line (the open beat with a line that is not resting, by C.ONB_BEAT_PRIORITY; null when none or the guide is off),
  open: [{ id, line, rest }] (by priority; rest: the beat has yielded its line, 14.4), done: [ids closed], learned: [ids learned], skippedBeats: [ids] }
```

### 14.4 Beats (spec 2.4; content `beats`)
The engine opens and closes G1-G13 from the action, its events and the state, while the guide runs; the UI shows `line`
(content: `<id>` = the beat's `line`, `<id>.<key>` = `alt[key]` or `byClass[key]`) and adds its own queue, pace and "Got it".
| Beat | Opens (line) | Closes |
|---|---|---|
| G1 | START_RUN (`G1`) | SET_OUT: learned with a contract held; else missed and G10 `skip` (the "press again" line `G1.noContract` is the UI's) |
| G2 | first MAP at zone 1's hub | learned on MOVE or PASS_THROUGH |
| G3 | the first fight's round 1; again at the next fight while open | learned on a won fight; a rescue or flight leaves it open (line null) |
| G4 | the first gear loot in the guided zone | learned on EQUIP; missed when the next fight ends |
| G5 | the first map step after G4's | learned on the next map action (MOVE, PASS_THROUGH, TAKE_ROAD, RING_BELL, USE_SPYGLASS) |
| G6 | the first fight with a heavy or cast entry on a track | at its end: learned if a heavy cost 0 HP (`offBalance` `avoided`), else missed (hovering is the UI's) |
| G7 | the first engage fight with 2 or more enemies | learned on ENGAGE; shown again at the next engage fight (ONB_ENGAGE_SHOWS), then missed |
| G8 | the first fight with a non-Deathblow wind-up | learned on its `stagger`; landed: `G8.landed`, open for ONB_BEAT_RETRIES more, then missed |
| G9 | the first fight with a Deathblow (`G9.<class>`) | learned on a Deathblow's `stagger`; landed: `G9.landed`, the class line again at the next Deathblow fight |
| G10 | (D142) on the map with nothing open, a held contract's site mark first in view (as `mapView` shows it: `sites`), never at the hub screen (`G10`) | first site won: line null; complete: `G10.done`; learned at the CHOOSE_REWARD that takes its reward |
| G11 | in a fight, HP < ONB_POTION_HP of max with a healing potion on the item bar | learned on USE_ITEM of it; missed when the fight ends |
| G12 | the first node dims, or the front within ONB_DIM_NEAR_HOPS of the player | `G12.caught` at a Dimmed encounter; at the guide's end learned if zone 1 had none |
| G13 | on the map: on a Road (`G13.onRoad`), or ONB_BELL_HOPS+ hops from every Road with the node dimming within ONB_BELL_DIM tolls (`G13`) | learned on TAKE_ROAD or RING_BELL |
Beats still open when the guide ends close (G12, G13 as above; the rest missed); SKIP_GUIDE closes them as missed.

Coach lines yield (spec 2.5, D141). A step is one action of the guided run while the guide runs. After each step the top
line (the open beat with a line, not resting, by C.ONB_BEAT_PRIORITY) counts one step shown; a top line that has already
been shown C.ONB_LINE_STEPS (2) steps, unlearned, rests when another open beat has a line, and the next one is `line`
(so G13 becomes the line after G12 has shown for 2 steps; seed 8736, qa/engine/s18). With no other open beat line it stays.
A resting beat stays open and can still be learned or closed; its line comes back (count from 0) when the beat's line
changes (`beat` what `line`), or when its trigger fires again: G12 when the front comes within ONB_DIM_NEAR_HOPS of the
player after a step on which it was not (`beat` what `line` with the same line). (D142) A trigger brings a resting line
back at most C.ONB_LINE_RETURNS (1) times per zone; after that it does nothing (no event, the count is not reset). The
UI shows `line` and needs no step rule of its own.

### 14.5 Profile, welcome and summary (E6, E7)
- `profile.guide`: `'todo'` (new profiles), `'done'` or `'skipped'`: END_RUN of a guided run sets `'done'`, or `'skipped'`
  after SKIP_GUIDE. `profile.welcome`: false in `newProfile()`; END_RUN of every non-dev run sets it.
- The Bellwrights' welcome: while the profile's welcome is due, the summary has the Echo line `welcome` (count 1, each
  ONB_WELCOME_ECHOES = Packed Satchel's price, so the Satchel is affordable after the first run). A dev run pays nothing and
  leaves the profile as it was. A profile saved before M3 with `runs > 0` loads with the welcome had (`migrateProfile`).
- The summary of a guided run has `tutorial: { rescues, skipped, learned }`.
- Not in the engine (spec 3.1, U2): the first-time hints' seen ids and Hints On / Off (`tbwcr.hints.v2`, the UI's).
