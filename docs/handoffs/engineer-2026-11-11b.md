# Hand-off: Core Gameplay Engineer (with the UI side), 2026-11-11b (DoT preview, talent totals, hints, Killed by)

## Summary
Owner feedback of 2026-11-11 [stated], all in one task:
- 08:11: show how much HP pending DoTs will take and whether that kills (Slay the Spire style).
- 08:14: talent tooltips with the total of the ranks taken.
- 08:31 screenshot: "Killed by" showed a raw ability id.
- 08:03: he did not find Sap (a first-fight hint per class), and a run ended with 0 potions used (a low-health hint).
- Lead note (engineer-2026-11-11): the settings window cut off Animation speed at 1366x768.

| # | What | Where |
|---|---|---|
| 1 | **DoT preview.** Engine `R.pendingTicks(state, unit)`: what the ticks at the end of the current round do to each unit if nothing else happens first: damage after absorbs, HP after, heals, `lethal` (and the resurrect a lethal tick would use), and `crit` (every crit-capable tick a crit). UI: a hatched segment at the end of every HP bar in a fight (nameplates, target frame, boss frame, player and pet frames), a skull when lethal (a faint one when only crits would kill), and the numbers per tick in the bar's tooltip. | src/engine/combat.js (`tickPhase`, `pendingTicks`), src/rules.js; engine-api.md 1 and 6.1; src/ui/engine-bridge.js (`dot`), src/ui/hud.js (`setBar`, `dotTip`), src/ui/director.js |
| 2 | **Talent totals.** Engine `R.talentInfo(state, id)`: `per`, `now`, `next` from `C.TALENT` and the new `C.TALENT_PER_RANK` (which fields multiply by rank; no numbers in it). Tooltip: "Now: +30 %", "Next rank: +40 %" or "Max rank". | src/constants.js, src/rules.js; src/ui/tooltip.js, src/ui/ui-text.js (`talentTotals`) |
| 3 | **Killed by.** Cause: no content entry. All 46 abilities have names. The bridge passed the killer's ability id through `humanize`. Now `actionName` (exported from engine-bridge.js) names every damage source and enemy action. Lookup order: spells and basic attacks, the pet, consumables, talents and their procs, an enemy's DoT (`'<id>@<idx>'`), content abilities, archetype actions, the end boss's actions, Brand, the Shards' strike, and status ticks. It returns null for an unknown id, and the line then shows the killer alone. The combat log uses it too, with the fallback "an attack". | src/ui/engine-bridge.js, src/ui/screens.js |
| 4 | **First-fight hint.** In the first engage round each class meets, a note beside the engage panel lists its three openers on Q, W, E, with one line each (for the Rogue, Sap: "one enemy skips its next three turns ... The answer to a pack"). "Got it", or the end of that engage round, stores it for that class. | src/ui/tracks.js (`HINT_KEY` = `tbwcr.hints.v1`), src/ui/ui-text.js (`engageHint`), src/ui/style.css |
| 5 | **Low-HP potion hint.** Below 35 % health in a fight, a healing potion on the item bar that can be drunk now pulses green with a "Drink" tag. Nothing is drunk automatically. | src/ui/hud.js (`POTION_HINT_HP`), src/ui/engine-bridge.js (`consumables[].heal`), src/ui/style.css |
| 6 | **Settings at 1366x768.** Each settings row's control keeps its full width and the description wraps. All four Animation speed choices now show. | src/ui/style.css |

## Commits (all on main)
| Commit | What | Files |
|---|---|---|
| c5a741d | Engine: `pendingTicks`, `talentInfo`, `TALENT_PER_RANK`; `endOfRound` uses the new `tickPhase`, and `resolveRound` uses the new `roundActions` (no change in play: every suite and its numbers are as before); 12 tests | src/engine/combat.js, src/rules.js, src/constants.js, qa/engine/s15-dot-preview.test.mjs (new), docs/specs/engine-api.md, docs/ARCHITECTURE.md |
| e95b259 | UI: items 1-6, the 13 talent texts, `data-id` on talent cells; ui-regress part L | src/ui/{director,engine-bridge,hud,mock-data,screens,style.css,tooltip,tracks,ui-text,windows}.js, qa/browser/ui-regress.mjs, docs/ARCHITECTURE.md |
| (this commit) | This note | docs/handoffs/engineer-2026-11-11b.md |

No sim/, src/content/, docs/specs/rules.md, balance.md, expedition.md or game.html file was changed.

## How the preview works (engine-api.md 6.1)
- It plays the engine's own tick phase on a copy of the state. `tickPhase` is the code `endOfRound` runs, so the numbers are exact for that phase:
  - tick × stacks, with no armor (rules 7.2);
  - absorbs: IMMUNE and god mode, WARD or an enemy shield, Mindguard, the Shared Wounds share (it shows on the pet's bar), Death's Sidestep;
  - HOT heals, in the order of the statuses;
  - a death ends the fight with no later tick;
  - Plague Heart spreads before the later enemies tick;
  - BRAND.
- It draws nothing. A crit-capable tick (Hemorrhage Mastery) counts without its crit, and `crit` gives the upper bound.
- It does not count what happens earlier in the round: the player's action, the pet and the enemies' actions. The tooltip says so. On an enemy, a lethal preview says "It will kill X after its turn: no need to attack it this round", because the enemy still acts before the ticks.
- The UI shows the preview only at decision points. The views drawn while a round plays carry none (`makeInterim`).

## How it was checked
- `node --test qa/engine/`: 336/336 (324 + 12 new). `qa/rules/` + `qa/docs/`: 59/59. `qa/sim/`: 82/82.
- qa/engine/s15-dot-preview.test.mjs, against what the engine actually does. It covers 1 539 combat steps:
  - runs: autoplay runs from START_RUN (3 classes × 3 seeds, one seed with a passive player who passes every third round) and dev-built runs at zones 2-6 with DoT, absorb and death talents (a Venomcraft Rogue with Hemorrhage Mastery and Death's Sidestep, a Plague Heart Rogue, Mindguard and Pyromancy Mage, a Shared Wounds and trap Hunter), each against the zone's normals and an elite.
  - The round is replayed up to its ticks with `roundActions`, and its events must equal the real step's first events.
  - At that moment, `pendingTicks` equals what the ticks then do, for every unit: amount, HP lost, absorbed, healed, HP after, lethal and the resurrect. That held for 838 unit samples, including 46 tick deaths. In the 51 rounds with tick crits, the value is within the [no crit, all crit] bounds.
  - The preview taken at the start of the round equals the ticks whenever the round changed nothing that unit's ticks read and no unit before it in the tick order died. 83 samples, no mismatch.
  - Set-up cases: a lethal enemy DoT in the engage round (the enemy dies at the end of a Pass); a lethal player DoT with no resurrect and with a Boon of Return; WARD, IMMUNE, god mode, an enemy shield, Mindguard, Shared Wounds, Death's Sidestep, HOT before BLEED, Plague Heart spreading in the same phase, a crit-capable POISON (no draw, state unchanged), BRAND, and null outside a fight.
  - `talentInfo`: every talent has a `TALENT_PER_RANK` entry whose fields are numbers of `TALENT`. Checked values: Silent Footing at 0, 1 and 3 ranks; Cheap Trick's two fields; Hemorrhage Mastery by rank; Toxic Coating's formula; Trapper with the trap's training level.
- Name scan (scratch, not in the repo):
  - 48 autoplay runs (3 classes × 8 seeds × both map modes), the end boss for each class, and every one of the 99 enemy templates against each class gave 67 distinct `damage` source ids. `actionName` names all 67.
  - All 46 content abilities read by their content name.
  - Death records seen: Crown-Breaker's id now reads "Crown-Breaker", Warden Belk's rend reads "Distraint Chain", the Shard's strike reads "Dimming Shard Strike".
- ui-regress part L, `NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/l-game.html --parts L --sizes 1366x768,1920x1080`: 44/44 (22 per size):
  1. DoT preview:
     - A level-11 Hunter casts Barbed Arrow. Every HP bar's mark (`data-dot`, hatched width) equals R.pendingTicks of a Node twin of the page's engine log.
     - A set-up state puts DoTs on both enemies (one lethal Poison ×3), the player and the pet. Every bar matches, and the skull shows only on the lethal enemy's nameplate and the target frame.
     - The tooltips give the tick names ("Poison ×3", "Rend (Reed Stalker)") and "no need to attack". After Pass, the enemy called lethal is dead and the other bars follow the new state.
  2. Talents: Silent Footing clicked to 1/3 shows "Now: +10 %", "Next rank: +20 %"; at 3/3 it shows "Now: +30 %", "Max rank". Toxic Coating's line matches. Every talent text with one per-rank percentage states the engine's number.
  4. Hint:
     - The Rogue's first engage round lists Ambush, Sap and Premeditate on Q, W and E, fully in view, covering no engage card, target frame, nameplate, ruler or action bar.
     - "Got it" stores it. A new Rogue run, after a page reload, shows none. A first Mage run shows it until W, and then stores it.
  5. Potion: a Healing Draught pulses at 30 % health but not at 50 % or while the potion cooldown runs, and no USE_ITEM is sent.
  - Also: "Killed by" reads "Aldrec Barrow-King (Crown-Breaker)" on a loaded summary. The settings window shows 1×, 2×, 4× and Instant whole. No console errors.
- Full ui-regress (parts A-L, both sizes) on the same build: see "Regression" below.
- Build check: `node tools/build.mjs --out /tmp/l-game.html`: 56 modules, about 1.50 MB.
- Screenshot: /tmp/lshots/L/1366x768-L-dot-preview.png. It shows the set-up fight with hatched segments on both nameplates, the target frame, the player and the pet, the skull on the lethal enemy, and the potion pulsing. Next to it (both sizes) are -L-hint, -L-barbed, -L-potion, -L-killed-by and -L-settings. Screenshots are not committed: they are outside this role's paths.

## Regression
`NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/l-game.html --sizes 1366x768,1920x1080`
(every part, A-L): **366/366** (183 per size; 322 before, plus part L's 44), exit 0, no console errors. The build was made
from e95b259's sources; the files that changed after it changed only in comments. Log: /tmp/lshots/regress-all.log,
screenshots in /tmp/lshots/all.

## Decisions taken on a default (Lead or owner may change)
1. **"Before its next action" = the ticks at the end of the current round.** The ticks come after the player's action and the enemies' (rules 7.1), so at the decision point that is the damage taken before the player acts again. An enemy whose preview is lethal still acts this round, and the tooltip says so.
2. **No intents in the preview.** An enemy's visible heal or shield this round, or a hit on the target, is not added. The preview is "if nothing else happens first", which keeps it exact and testable. The intent track already shows those actions.
3. **The segment shows net HP lost** (`hp - hpAfter`), so a HOT that heals first shrinks it. The tooltip lists the damage and the heal separately.
4. **Hint storage: per class in this browser's saved game** (`localStorage tbwcr.hints.v1`), like the Heat note. It is not tied to run history, so the owner, who has played Rogue runs, still sees it once. It is marked seen by "Got it" or when the engage round in which it showed ends. An engage round played on autoplay from its start does not show it and marks nothing.
5. **Potion hint threshold 35 % (`POTION_HINT_HP`, UI only)**, healing potions only, and only when the potion can be drunk now.
6. **Talent texts fixed in src/ui/mock-data.js.** These texts feed the real game too, because content has no talent texts, and 13 still had the numbers from before M2 v2 and v5: Serrated Finish 8 %, Deep Wounds 9 %, Biting Cold 12 %, Ward Weaving 10 %, Mindguard 20 %, Arcane Momentum 1 %, Ferocity 12.5 %, Pack Leader 6.25 %, Savage Mastery 12.5 %, Steady Aim 4 %, Mortal Shots 0.15, Barbed Mastery 20 %, Cornered Beast 8 %. Part L now fails if a one-percentage text drifts from `C.TALENT`.

## Spec notes (not edited; designer's files)
- rules.md 7.1 step 5 and 7.4 are unchanged. The preview adds no rule.
- rules.md 6 could name the per-rank fields the way `C.TALENT_PER_RANK` does. Today "/rank" covers two fields in one phrase for Cheap Trick, Smoldering, Savage Mastery and Trueshot Focus.

## Content entries that need a name
None. All 46 entries of src/content/abilities.js have a name, and every damage source id seen in play now resolves to a display name.

## Known issues
- When the target frame switches enemy, its hatched segment eases to the new width over 0.3 s. The width is set at once; only the box animates.
- The preview does not cover the end-boss fight's Brand landing at the end of a round, because that is a new stack added after the ticks (rules 10.2). It shows the Brand stacks the player already has.
- The hint is shown again if localStorage is blocked (private mode).
