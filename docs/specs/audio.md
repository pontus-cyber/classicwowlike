# Sound spec

Status: **built** (UI/UX & Visual Engineer, 2026-11-12; D127: the owner approved docs/audio/README.md with its defaults). Code: `src/ui/audio.js` (hooks in `app.js`, `director.js`, `settings.js`, `windows.js`). Tests: `qa/ui/audio.test.mjs`, `qa/browser/ui-regress.mjs` part Q. The listening reference is `docs/audio/preview.html`; the cues reuse its synthesis.

## 1. Direction (D127)
Warm wood, cloth, felt and small brass bells (art direction A). Positive cues are bells on D major pentatonic. Reserved voices: the gong on a tritone with a beating minor second only for the Deathblow (cues 1-3); the cold glass voice only for the Dimming and the Unlit Star (built for the Dimming; the Unlit Star not yet); the full pentatonic run only for level-up. Every sound is synthesised in the browser; no file is ever loaded (no fetch, no decodeAudioData, no `<audio>`). Sound never carries information that is not also on screen. No music until M4 (the `music` bus is reserved and empty).

## 2. Cues
Numbers are the README's (section 2). Source: director events (`ctx.audio.event`), the decision view after a step (`viewCues`), the action (`actionCues`), or app.js.

| # | Cue (log name) | Plays on | Built |
|---|---|---|---|
| 1 | `deathblowTelegraph`; `deathblowFirstShow` (quieter, no drum) | The decision view after a step: an enemy's now-entry is a Deathblow that nothing answers yet (a SAPPED cancel that breaks on damage still counts), once per Deathblow (enemy uid, turn). First show: the first engage-round view whose track holds a Deathblow, once per enemy | must, built |
| 2 | `deathblowAnswered` | `windup`, `deathblow`, `result: 'answered'` | must, built |
| 3 | `deathblowLanded` (+ #12 `maimed` when `e.maimed`) | `windup`, `deathblow`, `result: 'landed'` | must, built |
| 4 | `hitHeavy` | `damage` (not tick, miss or immune; not a pet's) when the action is a heavy blow, `tm.power >= HEAVY_POWER` or the hit took `>= HEAVY_SHARE` of maximum health; volume scales with the share; taken hits 8 % lower and drier | must, built |
| 5 | `hitLight`; `tick` (-9 dB, shorter) | Other hits and every pet hit; DoT ticks | must, built |
| 6 | `crit` | `damage` with `e.crit` | must, built |
| 7 | `kill` | `death` of an enemy (not `despawn`); elite, rare, dungeon boss and boss kills add the room and a second bell | must, built |
| 8 | `playerDeath` | `death` of the player: the rest ducks to 30 % over 0.8 s, then silence through the death screen until the next step or click | must, built |
| 9 | `levelUp` | `levelUp` | must, built |
| 10 | `dimmingSpread` (the reserved glass voice) | The decision view after a step (`dimmingNear`): the Dimming reached new nodes of the same zone in the step and now the player's node is Dimmed, dims in DIM_NEAR tolls or fewer, or a node next to it was just Dimmed; a spread far from the player is silent | should, built (ui-2026-11-13) |
| 11 | `uiClick` (UI bus) | A click on a button, card, slot, toggle or map node (one document-level listener, `CLICKABLE`) | must, built |
| 12 | `maimed`; muffled heal | Tail of #3; a heal cut by MAIMED plays `heal` through a 700 Hz low-pass | must (tail), should (heal): built |
| 13 | `windupAnswered`, `windupLanded` | `windup` without `deathblow` | must, built |
| 14 | `interrupt` | `interrupt`, `trapSprung` | should, built |
| 15 | `heal` | `heal` with an amount; an enemy's quieter and lower | should, built |
| 16 | `potion` | `action` with `kind: 'item'` (the heal cue follows from its own event) | should, built |
| 17 | `dodge` | `damage` with `e.miss` | should, built |
| 18 | `loot` | `gotItem` by rarity (common: cloth; uncommon 1, rare 2, epic 3 bells and a swell); heat raised it: ember crackle first | should, built |
| 19 | `furnaceUp`, `furnaceCalm` | The view's heat state rose (2 crackle ticks per state step: 2, 4, 6), or went back to Calm | should, built |
| 20 | `error` (UI bus) | A toast of kind `err` (refused actions, `msg` warnings) | should, built |
| 21 | `winOpen`, `winClose` (UI bus) | The number of open windows rose or fell | should, built |
| 22 | `arrive` | A zone change's banner (`zoneTravel`: Travel on, a Road, the Bell); the footstep bed is #24 | should, built (bells only) |
| 23 | `homewardBell` | `RING_BELL` starts (rung twice) | should, built |
| 24-26 | Map steps, hover, music | | later |

## 3. Mixer, unlock, voices, speed
- Buses: master > { sfx (× SFX_TRIM), ui, music (reserved) } > one compressor (threshold -12 dB, ratio 4). One shared room (1.6 s generated impulse). The player's death plays on its own path past the duck.
- Settings (`settings.js`, saved): `soundMaster` 0.7, `soundSfx` 1, `soundUi` 0.6, `soundMuted` false; the settings window has a mute switch and three sliders.
- No `AudioContext` before the first trusted `pointerdown` or `keydown`; until then cues are only logged. The context is suspended while the tab is hidden.
- Voices: at most MAX_VOICES cue instances, SAME_MAX of one cue, none retriggers within RETRIGGER_S; when full, the lowest-ranked, oldest instance fades out in FADE_S, or the new cue is dropped if it ranks lowest. PROTECTED cues (1-3, 12's tail, 8) are never dropped or stolen.
- Variation per instance: pitch ±3 % (bell cues ±0.4 %, so they stay on the scale), level ±1.5 dB, a random noise start.
- Speed (no time-stretch): tails × TAIL (1x 1, 2x 0.6, 4x and Instant 0.4); at 4x one `hitLight` or `tick` per beat. Instant, or a step skipped as a whole (Space or click outside a round), keeps only the step's top-ranked cue plus its PROTECTED cues; a skipped hit inside a round plays its cues at once under the voice rules.
- Test hook: `testApi().audio()` = `{ unlocked, state, muted, log }`, log entries `{ cue, step, t, kept, sound }` (`kept: false`: dropped by a voice rule or the Instant rule; `sound: true`: rendered).

## 4. Budget
Plan (README section 3): `audio.js` at most 500 lines and 16 KB; game.html at most +20 KB. Built: 299 lines, 22.6 KB (all must and 12 of 13 should cues), game.html about +25 KB with the hooks: over the plan's size, flagged in the hand-off for the Lead.

## 5. Constants

| Name | Value | Meaning |
|---|---|---|
| MAX_VOICES | 8 | Cue instances at once |
| SAME_MAX | 2 | Instances of one cue at once |
| RETRIGGER_S | 0.05 s | The same cue does not start again within this |
| FADE_S | 0.02 s | Fade of a stolen instance |
| HEAVY_POWER | 0.6 | combat-feel.js `hitPower` at or above: a heavy hit |
| HEAVY_SHARE | 0.15 | Share of maximum health at or above: a heavy hit |
| TAIL | 1x 1, 2x 0.6, 4x 0.4, Instant 0.4 | Release tails by speed |
| SFX_TRIM | 0.9 | The preview's effects bus level under the effects slider |
| Defaults | master 0.7, sfx 1, ui 0.6, muted false | D127 |
| Duck | 30 % over 0.8 s, silence by 2.4 s | The player's death |
| Ranks and lengths | `META` in audio.js | Priority (Deathblow telegraph 100 ... tick 10) and length at 1x for the voice count |
