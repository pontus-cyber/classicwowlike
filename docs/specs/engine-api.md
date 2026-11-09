# Engine API (src/rules.js)

Owner: Core Gameplay Engineer. Audience: UI/UX Engineer, Simulation & Balance Engineer, QA.
Status: M1 1.1, 2026-11-09; updated 2026-11-09b (rule helpers on the API, `hpLost`, `regen`, level-up gains,
no heal events of 0, boss counters). Rules authority: docs/specs/rules.md (section numbers below refer to it).

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
| `newRun({classId, petId, name, seed, profile, content})` | state (phase CREATE) | All fields but `content` optional. `seed`: integer, normalised to uint32; the front end draws a random seed (the engine never does). `profile`: meta profile (`newProfile()` if omitted). `content` is validated (structural) and deep-frozen. Throws on invalid content/class/pet. |
| `legalActions(state)` | action[] | Every concrete legal action. `SET_NAME` and `SET_SEED` take free values and are not listed (they are legal in CREATE). |
| `step(state, action)` | `{ state, events }` | Pure: the input is never changed. Throws `IllegalActionError` (`err.code === 'ILLEGAL_ACTION'`, message names the reason) on an illegal action. |
| `stepInPlace(state, action)` | events | Same, but changes `state` in place (no copy). For simulators that own their state. |
| `isLegal(state, action)`, `whyIllegal(state, action)` | bool / string or null | Validation without applying. |
| `autoAction(state)` | action or null | Deterministic. In combat: the autoplay policy of rules 7.9. Elsewhere: a simple default policy (talents, gear, bar, hub, map, rewards, camp) so a headless run goes from CREATE to SUMMARY. `null` only in ENDED. |
| `summary(state)` | object or null | Run summary (rules 9) incl. Echoes breakdown (11.1). Available any time after START_RUN. |
| `serialize(state)` / `deserialize(str, content)` | string / state | The content tables are not saved; pass the same `CONTENT` (version is checked). |
| `mapView(state)` | object or null | What the player may see of the zone map (rules 1.4). Rare elites, traps and vendor Embers are `null` unless the profile owns Scout's Eye. Use this, not `state.zone.rows`, to draw the map. |
| `validateContent(content, {strict})` | string[] | Content checks (src/content/SCHEMA.md). |
| `newProfile()`, `metaOffers(profile)`, `buyMeta(profile, id)` | profile / offers / profile | Meta catalogue between runs (rules 11.2). `buyMeta` throws `IllegalActionError` when not allowed. |
| `xpToNext(L)`, `talentPointsFree(state)`, `itemScore(item, classId)`, `spellCost(state, id)`, `spellCooldown(state, id)`, `fleeChance(state)` | number | Display helpers so the UI never re-implements a rule. |
| `bagCapacity(state)` | number | Bag slots: `BAG_SLOTS` + meta Deeper Pockets (rules 8.7, 11.2). In CREATE it reads the profile. |
| `V(L)`, `xpCurve(L)`, `diffMod(d)` | number | Rule helpers for estimates (read-only): value scale V (rules 8.5; prices and gold are multiples of it), the levelling polynomial (rules 4.3, defined for every L: `xpCurve(60)` is the event-XP base at CL 60 while `xpToNext(60)` is 0), the XP level-difference modifier for `d = CL - L` (rules 4.4). |
| `spellInfo(state, id, target)` | object or null | Tooltip data: name, level, tags, resource, cost, cd, cdLeft, tl, rank, `amount` (`{kind: damage|dot|ward|heal, amount or perTick, hits, school}`, base value before level/target/crit/variance), `usable` and `reason` in a fight, content flavour `text`. |
| `C` | module | All constants and data tables (CLASS, SPELL, TALENT, PET, CONSUMABLE, BOON, META, BOSS_TEXT, ...). |

State is plain JSON except `state.content`, a shared reference to the frozen content tables (never copied by
`step`, left out by `serialize`). Compare states with `serialize`.

## 2. Phases (rules 1.1)
`CREATE -> ZONE_HUB -> MAP <-> NODE -> ... -> CAMP -> BOSS -> SUMMARY -> ENDED`

| Phase | What is going on | Typical actions |
|---|---|---|
| CREATE | class, pet, name, seed, oaths | `SELECT_CLASS`, `SELECT_PET`, `SET_NAME`, `SET_SEED`, `SET_OATH`, `START_RUN` |
| ZONE_HUB | zone hub; `state.service` may be open | `SERVICE`, service actions, `LEAVE_HUB`, out-of-combat |
| MAP | choose the next node | `CHOOSE_NODE`, `TRAVEL_ON`, out-of-combat |
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
| `CHOOSE_NODE` | `lane` 0-2 | MAP; `mapView(state).next` lists reachable lanes |
| `TRAVEL_ON` | | MAP; level >= exit level (Swift Boots: -1) or row 8 done (then it is the only move) |
| `GRIND_SET_WAVES` | `n` 1-3 | Grind node, on entry (starts wave 1) |
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

One combat action resolves one full round (rules 7.1): player action, pet, enemies in index order, end of
round, then the next round's intents are rolled and shown. The events list covers all of it.

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
| `player.res.{boon, meta}`, Embers in the bag | resurrect charges (rules 9) |
| `player.pet = {id, hp, alive}` | Hunter pet |
| `zone` | current zone; draw it with `mapView(state)` |
| `hub.used.{trainer, vendor, inn}` | hub/camp services used this visit |
| `service = {kind, where, cl, stock}` | open trainer or vendor; vendor `stock[i] = {kind: 'cons'|'gear', id or item, price, sold, unlimited}` |
| `node = {type, r, l, cl, stage, k, rewards, quest, planned, wavesDone}` | current node |
| `fight` | see section 6 |
| `loot[]` | loot window |
| `stats`, `death` | counters for the summary; death location (rules 9) |

Items: gear `{uid, kind: 'gear', slot, rarity, ilvl, name, stats: {AGI, INT, STA, SPI}, power, crit, armor,
bonusArmor, wd, affix, unique, effect}`; consumable stack `{uid, kind: 'cons', id, qty}`; junk
`{uid, kind: 'junk', name, level, qty}`. Item score for the upgrade arrow: rules 8.3 (`ITEM_SCORE`).

## 5. Events
`step` returns `events`, in order. Units: `'player'`, `'pet'` or an enemy index (number).

| `t` | Fields | Meaning |
|---|---|---|
| `phase` | `phase` | phase changed |
| `runStart` | `classId, petId, seed, oaths` | |
| `zone`, `camp`, `travel` | `z, name` / `name` / `from` | zone hub entered / camp / TRAVEL_ON |
| `hours` | `add, total, why` | in-game hours spent |
| `node`, `nodeDone`, `quest` | `type, r, l, cl` / ... / `quest` | node entered / completed / quest template id |
| `service`, `serviceClosed` | `service, where` | |
| `rest` | `hp, mana, rested` | Rest node or Inn |
| `fight` | `kind, k, enemies[{u, name, level, hp, kind}]` | fight started (`kind`: quest grind elite trash dboss treasure camp boss) |
| `round` | `n` | a new round starts (intents follow) |
| `intent` | `u, intent` | enemy intent for this round (section 6) |
| `action` | `kind` (`cast` `attack` `item` `pass` `flee` `skip`), `spell, target, cost, item, success` | player action |
| `petAction` | `target` | |
| `enemyAction` | `u, id, name` | an enemy performs its intent |
| `damage` | `src, dst, amount, hpLost, absorbed, spell, crit, school, tick, immune, sidestep` | see "Damage amounts" below |
| `miss` | `src, dst, spell, dodge` | miss or dodge |
| `heal`, `mana` | `dst, amount, spell` / `amount, spell` | `amount` = HP (mana) restored. Sent only when something is restored (`amount > 0`): a potion, HOT tick or ration at full health, or Mana Siphon at full mana, sends none. |
| `status` | `u, id, on, dur, stacks, src` | status applied (`on: true`) or removed |
| `interrupt`, `skip` | `u, by` | cast interrupted / Chrono Sigil |
| `channel` | `u, name, step` | boss Litany channel step |
| `summon`, `despawn`, `linked` | `u, name, hp, by` / `u` / `on, n` | adds, Shards, Linked on/off. `linked` is sent when a Shards wave comes (`on: true`) and when the last Shard dies or Shards despawn (`on: false`); `n` = living Shards then. The boss takes `-min(LINK_DR, LINK_DR_PER_SHARD × n)` (rules 10.2); between events, count the living Shards in `state.fight.enemies` |
| `shield`, `enrage`, `image` | | enemy shield, enemy enrage, Mirrorshade image |
| `phaseChange` | `phase` | boss phase 2 or 3 |
| `death` | `u, name` | enemy, pet or player died |
| `resurrect` | `source` (`boon` `second_breath` `ember`), `hp, mana` | `hp`, `mana`: the player's values after the resurrect (RES_HP_PCT, RES_MANA_PCT) |
| `xp` | `amount, rested, why` | |
| `levelUp` | `level, talentPoint, hpGain, manaGain, petHpGain, maxHp, maxMana, petMaxHp` | one per level gained. Current HP, mana and pet HP (live pet) rise by the max gains (rules 4.3); `*Gain` = what was added, `max*` = the new maxima (`maxMana` 0 without mana, `petMaxHp` 0 without a pet) |
| `gold` | `amount, why` | negative when spent |
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
`state.fight = { kind, round, enemies[], canFlee, boss, p, pet }`.
- `fight.p = { st[], cds{spellId: readyRound}, cp, energy, focus, potionReady, skip, ... }`: the player's
  statuses, cooldowns (usable when `round >= cds[id]`), combo points, energy/focus. Mana is `player.mana`.
- `fight.pet.st[]`: pet statuses (TAUNT).
- Enemy: `{ idx, tid, name, kind, arch, level, hp, maxHp, armor, dodge, st[], intent, alive, elite, boss, shield }`.
- Status object: `{ id, dur (rounds left, null = no expiry), stacks, value, tick, amount, src }`: `tick` is the
  damage per tick of BLEED, BURN and POISON; `amount` is the heal per tick of HOT and what is left of a WARD.

Normal intent: `{ id, name, kind, target ('player'|'pet'|'all'|'self'|ally index), est (estimated damage or
heal), cast (interruptible), heavy (telegraphed big hit), school, hits }`. Kinds: `hit`, `rend`, `cleave`,
`curse`, `brace`, `shieldAlly`, `heal`, `selfHeal`, `selfShield`, `summon`, `none` (`Stunned`, `Hexed`,
`Unaware`). After an interrupt the intent gets `interrupted: true`; after Chrono Sigil `skipped: true`.

Boss intent: `{ id: 'boss', kind: 'boss', actions: [...], cast, heavy, est, target, telegraph }` where each
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

## 7. Randomness and replays
Streams (rules 0): `map(z)`, `node(z,r,l)`, `fight(z,r,l,k)`, `loot(z,r,l)`, `boss` (`src/rng.js`, sfc32 seeded
by a 32-bit hash of the keys). Hub and camp use row 0; the camp is zone 7; camp wave `w` uses `node(7,w,0)`,
`fight(7,w,0,0)`, `loot(7,w,0)`; hub vendors `node(z,0,0)`. Same seed + same actions = same state (tested).
Item names use a separate hash and never touch a stream. The sim's bots must use their own stream
(`STREAM.bot` in `src/rng.js`), never the game's.

Draw orders the engine guarantees (beyond rules 7.2 and 8.4):
- Node setup (`node` stream): Quest: template, size, mobs, level offset. Elite: rare flag, template, add flag,
  add template. Dungeon: per trash fight size then mobs. Grind: 3 waves × 2 mobs. Treasure: guard flag, guard.
  Vendor: 3 gear items (rarity, slot, stats), then Ember. Shrine: 2 boons by weight without replacement.
- Treasure: the trap is the first draw of `loot(z,r,l)` (so Scout's Eye can show it).
- Item stats (rules 8.3 order): split (1-2 stat items), primary, affix (rare/epic); then the unique draw only
  when the profile has an eligible unique.
- Combat extra draws: Mirrorshade (before the 3 damage draws; an image skips them), unique procs and Twin Fangs
  after a landed hit, Lucid Flow after each Mage spell, flee, DOT crit (1 draw, only when a tick can crit).
- Intents: 1 draw per acting enemy (none when stunned, hexed, unaware or a forced summon), then 1 target draw
  when a live pet exists and no TAUNT/feign; the boss makes only the target draw.

## 8. Autoplay
`state.autoplay` only records the toggle. When it is on and `state.fight` is set, the front end calls
`step(state, autoAction(state))` at its own pace (PACE_AUTO_ROUND_S). The simulator calls `autoAction` for
every decision or replaces the out-of-combat part with its bots.

## 9. Meta profile
`profile = { v, echoes, earned, spent, unlocks: {id: rank}, reachedBoss, bossKills, firstKill: {rogue, mage,
hunter}, runs }`. Unlocks apply at START_RUN (rules 11.4). `END_RUN` puts the updated profile in
`state.result.profile`; the front end stores it. Buy between runs with `buyMeta(profile, id)`.
