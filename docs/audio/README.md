# Sound: direction, cue list and plan

Status: **draft, a proposal for the owner to steer** (Game Designer, feel and audio, 2026-11-12; BACKLOG row 2026-11-11 "Sound"; D121: sound is treated like art, so nothing beyond this proposal is built before the owner's steer). Nothing here changes the game until the Lead schedules it.

Listen first: open `docs/audio/preview.html` in a browser (no files, no network) and click the eight cues. Then read sections 1-2 against what you heard.

Claims are tagged as in docs/README.md: [stated], [source], [inference], [assumption].

## 1. Sound direction

The game should sound like direction A looks (docs/art/README.md, Lantern Gouache): a storybook at dusk, made of warm, physical things a traveller carries. Wood, cloth, leather, felt and small brass bells; soft attacks, a rounded low-mid body, little above 6 kHz, and one small timber "room" of reverb shared by everything so all sounds sit in the same place. Positive cues (answers, level-ups, loot) are bells on a D major pentatonic set, so any two of them played together never clash. Two voices are **reserved**, as the art reserves madder red and Dimming violet: the **Deathblow** owns a low, hollow gong built on a tritone with a beating minor second (no other cue uses that interval or that timbre), and **the Dimming and the Unlit Star** own a cold, glassy voice (detuned high sines, a sinking resonant noise swell, the sound of a lantern being put out), which is art direction C's "enemy language" in sound. Everything is synthesised in the browser with Web Audio oscillators, noise, envelopes and filters [stated: BACKLOG row]. To avoid: any sample, recording or sound file from an existing game or library; recognisable signature sounds of existing MMOs (no imitated level-up fanfares, quest chimes or loot jingles; our level-up is our own pentatonic run); bright digital chirps, square-wave "8-bit" bleeps and sci-fi zaps; long reverb tails that blur fast rounds; anything shrill on the most frequent cues (clicks, light hits), which the player hears hundreds of times per run [inference: about 300 rounds per run, combat-v2.md section 9].

## 2. Cue list, ranked by value

Rank is value to the player: readability of danger first, then the core hit feel, then rewards, then the map and the UI. Priority: **must** (first build), **should** (same build if the budget holds), **later**. "Source" is where the cue is fired from in today's code: director events (`e.t` in `src/ui/director.js`), actions in `app.js`, or a view change after a step (as `heat.js noteStep` does for the Furnace toast).

Building blocks used in the recipes: *thump* = sine with a fast downward pitch glide (body); *noise* = looped white noise through a filter with an envelope (texture); *bell* = 3-4 sine partials, upper ones decaying first; *gong* = inharmonic partials (×1, 1.414, 2, 2.83, 4.07) through a low-pass; *room* = one shared convolver with a generated 1.6 s impulse.

| # | Cue | When it plays (source) | How it should feel | Procedural recipe | Priority | Readability role |
|---|---|---|---|---|---|---|
| 1 | **Deathblow telegraph** | Once, when an enemy's now-entry is a Deathblow at the start of the player's decision (`round` event, intent `deathblow` from engine-bridge); a quieter version (no drum) the first time it shows on a track in the engage round | A held breath, then something heavy and wrong | Low-pass noise swell 150→900 Hz over 0.45 s; then thump 90→50 Hz, gong on D2 (2.2 s), D3 and E♭3 sines beating against each other | must | **Unique cue, used for nothing else.** Says "stop and think" even with eyes on the action bar. Never stolen by the voice limit |
| 2 | **Deathblow answered** | `windup` with `deathblow` and `result: 'answered'` | Relief and a small triumph: the wrong interval resolves | Parry clack (band-pass noise 1.8 kHz, 50 ms); bells D5-F♯5-A5-D6 at 80 ms steps; D3+A3 fifth swelling under them | must | Pairs with #1: same register, the minor second becomes a fifth, so the player hears that the threat is gone |
| 3 | **Deathblow landed** | `windup` with `deathblow` and `result: 'landed'` | A blow that costs the rest of the fight | Heavy hit ×1.3; gong on the tritone below D2, pitch sinking 12 %; low rumble 400→120 Hz over 1.2 s | must | The only hit that carries the gong; the player knows the Deathblow, not a normal hit, did this |
| 4 | **Heavy hit** | `damage` (not tick, not miss) where the action is heavy or the hit share is high (`hitShare`, `tm.power`); same cue both sides, taken hits slightly lower and drier | Weight, cloth and wood, no metal clang | High-pass click 15 ms; thump 120→42 Hz (0.28 s); triangle 70→40 Hz through 300 Hz low-pass; low-pass noise 1.5 kHz→300 Hz | must | Matches the hit-stop and shake of combat-feel.js; volume scales with hit share so a big hit is heard as big |
| 5 | **Light hit** | `damage`, ordinary hits and pet hits; ticks (`e.tick`) use a softer, shorter variant at -9 dB | Quick, soft, never tiring | Low-pass noise 2.5 kHz→600 Hz (90 ms); thump 180→90 Hz | must | The bed of every round; quiet enough that #1-#4 stand out |
| 6 | **Critical hit** | `damage` with `e.crit` | The heavy hit with a small spark of brass | Heavy hit; triangle snap 660→1320 Hz; bells E6 and B6 (0.5 s); high-pass noise sparkle | must | Says "crit" without reading the number; OFF_BALANCE payoffs (combat-v2.md 5) are heard |
| 7 | **Kill** | `death` with `dst.side === 'enemy'` | A body settling and a soft release | Thump 80→40 Hz, low-pass noise fall 800→150 Hz (0.4 s), one quiet low bell (A3) | must | Confirms the target is down before the frame fades; elite and boss kills add the room and a second bell |
| 8 | **Player death** | `death` with `dst.side === 'player'` (before the death screen) | Everything going quiet | Heavy hit; all buses duck to 30 % over 0.8 s; a falling D4→A3 triangle sigh through a closing low-pass; silence on the death screen | must | Ends the run's sound clearly; no music sting to grate on repeat runs |
| 9 | **Level up** | `levelUp` (with its banner) | The warmest sound in the game | Bells D4-E4-F♯4-A4-B4-D5 at 70 ms steps; detuned sawtooth fifth D3+A3 through 900 Hz low-pass, slow attack; faint high sparkle | must | The reward everyone waits for; owns the pentatonic run, which loot does not use in full |
| 10 | **Dimming spreads** | After a map step, when the Dimming front reached new nodes (view diff of the map's Dimmed nodes) and the player's node now shows "dims in N" with N <= 2, or the front reached a node next to the player | Cold, close, something going out | Band-pass noise (Q 8) sinking 3 kHz→350 Hz with a slow 0.7 s attack; 1760/1767 Hz sines beating at 7 Hz; 55 Hz swell; then a short low-pass "puff" (a lantern blown out) | should | **Reserved glass voice.** Answers expedition.md 7.3's risk: "dims in N tolls" must be impossible to miss. Plays only when the front is near the player, not on every toll |
| 11 | UI click | Any button or card pressed (one document-level listener in app.js; action bar and map nodes included) | A wooden token set down | Band-pass noise 2.4 kHz (35 ms) plus a short triangle tick 1100→800 Hz, on the UI bus | must | Confirms input; the UI bus has its own slider |
| 12 | MAIMED | Tail of #3 when `e.maimed`; afterwards each heal on the player cut by MAIMED (`heal` with `e.maimed`) plays the heal through a 700 Hz low-pass ("muffled heal") | A wound that will not close | Two muffled heartbeats (62→45 Hz) 250 ms apart; falling triangle E4→E♭4 through 900 Hz low-pass | must (tail), should (muffled heal) | The muffled heal tells the player, every time, that healing is halved, without a float |
| 13 | Ordinary wind-up answered / landed | `windup` without `deathblow` | Smaller versions of #2 and #3 | Answered: parry clack and two bells (D5, A5). Landed: heavy hit and one low brass "dong" (no gong, no tritone) | must | Keeps the gong exclusive to the Deathblow while still marking STAGGERED and EMPOWERED |
| 14 | Interrupt | `interrupt`, and `trapSprung` | A cast snapped off | Rising band-pass noise cut short at 120 ms; triangle 600→300 Hz | should | Spells cut off are heard as cut off |
| 15 | Heal | `heal` on player or pet (enemy heals: the same, quieter and lower) | Warm water | Two sines a fifth apart with a soft 60 ms attack, slight upward glide, room | should | Enemy heals (menders, Bolster) are heard, so the player looks for the mender |
| 16 | Potion | `action` with `kind: 'item'` | Cork, a swallow | Short band-pass "pop" 900 Hz; gurgle of three short low-pass noise bursts; then the heal cue | should | Confirms the free or paid potion used a turn or not |
| 17 | Dodge / miss | `damage` with `e.miss` | Air past the ear | Band-pass noise sweep 600→2.5 kHz, 120 ms, no body | should | Tells a full dodge of a heavy blow (which also answers a wind-up) from a hit |
| 18 | Loot by rarity | `gotItem` (`e.rarity`) and the chest | Coins and cloth; brighter with rarity | Junk/common: a soft cloth thump. Uncommon: one bell (A4). Rare: two bells (A4, D5). Epic: three bells and a low swell. Heat raised rarity (`e.heatUp`): an ember crackle (short high-pass noise ticks) before the bells | should | Rarity heard before read; epic must never be confused with level-up (no full run) |
| 19 | Furnace state change | `heat.js noteStep` (the state changed in the step) | The kiln drawing breath | Up a state: low-pass noise "whoomph" 200→1.2 kHz plus 2-6 crackle ticks (more ticks per state). Back to Calm: a soft water-glaze tone (sine D4 with slow vibrato) | should | One step per state, so Smouldering, Burning and Infernal are told apart by ear |
| 20 | Error | `msg` with `kind: 'warn'`, toasts of kind `err`, illegal input | A dull wooden knock, not a buzzer | Two low thumps 160→120 Hz, 70 ms apart, on the UI bus | should | Different from the click, so a refused action is noticed |
| 21 | Window open / close | `windows.open` / `close` (bags, talents, map, settings) | Paper and leather | Open: rising band-pass noise 400→1.6 kHz (120 ms). Close: the same falling, shorter | should | None beyond comfort |
| 22 | Road taken | `TAKE_ROAD` with a zone change (`zoneTravel`) | Setting out at dusk | Footstep bed (#24) for the travel, then a bell pair (A4, D5) on arrival with the zone banner | should | Marks the zone change |
| 23 | Homeward Bell | `RING_BELL`: the channel, then arrival | A small brass bell with a long, clear decay | One bell (D5, 2.5 s, extra room) rung twice across the channel; on arrival as #22 | should | The item is a bell in the fiction (expedition.md 7.2); it should sound like the one bell the player owns |
| 24 | Map step | `MOVE` travel (`travel()`), one step per tile-walk animation | Boots on a road | Low-pass noise ticks at walking pace with random pitch | later | Comfort; dropped at speed 4 and Instant |
| 25 | Hover | Hover on a card, map node or action slot | Barely there | A 20 ms band-pass tick at -18 dB, at most every 80 ms | later | Comfort; off by default if the owner finds it busy |
| 26 | Music and ambience | Zone beds, the Camp, the boss | (M4) | Not procedural in the backlog plan: CC0 or commissioned files in M4 [stated: BACKLOG row]; a mixer bus is reserved now | later | See owner question 4 |

Rules that hold for every cue:
1. Reserved voices: the gong and tritone only in #1 and #3; the glass voice only for the Dimming, Shardspawn and the end boss; the full pentatonic run only for level-up.
2. Every cue has small random variation (pitch ±3 %, level ±1.5 dB, noise start point), so repeated hits never sound like a loop.
3. Sound never carries information that is not also on screen (the game must stay fully playable muted).

## 3. Technical plan

**One module, fed by the director.** A new `src/ui/audio.js` (UI engineer's file; header comment and ARCHITECTURE.md row in the same commit, D41):
- `cuesFor(event, info)`: a **pure** table from a director event (plus `{ heavy, share, side, speed }`) to cue names. No Web Audio in it, so QA can test it in Node.
- `createAudio(settings)`: returns `{ event(e, info), cue(name, opts), unlock(), log() }`. The director calls `ctx.audio.event(e, info)` once per event in its existing loop (one line next to `this.cursor = e`); the few cues that come from outside the event loop are one call each: `app.js` (document-level click, error toasts, the Deathblow telegraph when a round's view is pushed), `windows.js` (open/close), `heat.js noteStep` (Furnace), and the map diff after a step (Dimming).
- No sound file is ever loaded: no `fetch`, no `decodeAudioData`, no `<audio>`. The noise buffer (2 s mono) and the room impulse (1.6 s stereo) are generated once at unlock.

**Mixer and settings.** Buses: master → { sfx, ui, music (empty until M4) }, then one compressor to protect against clipping. New settings (in `settings.js`, persisted as today): `soundMaster` 0.7, `soundSfx` 1.0, `soundUi` 0.6, `soundMuted` false; three sliders and a mute box in the settings window. The context is suspended while the tab is hidden.

**No audio before the first user gesture.** The `AudioContext` is created on the first `pointerdown` or `keydown` (browser autoplay rules); before that, `event()` only writes the log. Headless runs that never click never create a context.

**Polyphony.** At most 8 cue instances sound at once (each is up to about 10 Web Audio sources); at most 2 instances of the same cue; the same cue does not retrigger within 50 ms (hover 80 ms). When full, the lowest-ranked, oldest instance is faded out over 20 ms. The Deathblow cues (#1-#3) and the player's death are never stolen.

**Speed, skips and Instant.** Sound is not time-stretched: a cue keeps its pitch at every speed.
- 1×: everything as listed.
- 2×: release tails shortened to 60 %; map steps every other tile.
- 4×: tails 40 %; at most one light hit or tick per beat; map steps and hover off.
- Skip (Space or click, director skip tokens) and **Instant** (`settings.instant`, speed 0, and the speedrun preset): the events of a step resolve at once, so audio plays only the **single highest-ranked cue of the step** (plus the click that caused it). A step with a Deathblow always keeps its Deathblow cue. This keeps Instant and autoplay from producing a wall of noise.

**Budget.** `audio.js` at most 500 lines and 16 KB unminified; `game.html` grows by at most 20 KB with the hooks. Runtime: no allocation per frame (nodes are made per cue and released when they stop); the art's frame-time target R9 (no more than +2 ms median per fight frame) applies to sound too.

**Test hook.** `testApi().audio()` returns `{ unlocked, muted, log }`, where `log` is the list of cues the game asked for in this page (`{ cue, step, t, kept }`, `kept: false` when the voice limit or the Instant rule dropped it). The log is written whether or not sound can play (locked, muted, headless), so `qa/browser/ui-regress.mjs` can assert, for example, that a Deathblow fight logs `deathblowTelegraph` once in round 3 and then `deathblowAnswered` or `deathblowLanded`, and that an Instant step logs one kept cue. `cuesFor` gets a Node unit test in qa/. The preview page has the same idea in small: `window.__audio.log` and `window.__audio.render(cue)`, which renders a cue offline and returns its peak level and length, so a check can confirm a cue makes sound without anyone listening.

**Specs before code.** Once the owner has steered, the cue table and every number in this section move into a short spec (proposed `docs/specs/audio.md`, with the constants in one table at its end) before the UI engineer starts.

## 4. The sample

`docs/audio/preview.html`: one self-contained page (inline CSS and JS, no files, no network) with eight buttons: UI click; light and heavy hit; critical hit; Deathblow telegraph; Deathblow answered; Deathblow landed with MAIMED; level up; the Dimming spreading. Volume slider and mute; sound starts on the first click.

Checked (2026-11-12, Playwright with Chrome, headless): the page loads with no console or page errors and makes no network request; each cue rendered offline through `window.__audio.render` makes sound, with peaks from 0.12 (click) to 0.80 (Deathblow landed) of full scale and no clipping, and lengths from 27 ms (click) to 1.8 s (Deathblow telegraph); a click on a button writes the cue to `window.__audio.log`. Whether the cues sound right is the owner's call: the levels and lengths are first guesses.

## 5. Owner questions and cost

Defaults apply until answered [stated rule: docs/README.md "Never wait for the owner"].
1. **Direction.** Warm wood, cloth and small bells for the world (direction A), with the gong reserved for the Deathblow and the cold glass voice reserved for the Dimming and the Unlit Star. Default: yes, as in the preview.
2. **The Deathblow telegraph: once or held?** It can play once when the player must decide (as in the preview), or keep a slow, quiet heartbeat under the decision until the player acts. Default: once, plus the quieter first-sight version in the engage round; no loop.
3. **Sound on at first launch?** Default: on at 70 % master after the first click, UI bus at 60 %, with sliders and mute in settings. Alternative: off until the player turns it on.
4. **Music and ambience.** The backlog plans CC0 or commissioned files in M4; a CC0 file is a download and needs an explicit yes under the rules. A procedural ambience bed (dusk wind, distant birds, the Furnace's low hum rising with its state) could come earlier with no files. Default: no music or ambience until M4; the `music` bus is reserved now.

**Cost of the full build** [inference: from the size of combat-feel.js and heat.js and the number of hook points, about 15]:

| Stage | What | Sessions |
|---|---|---|
| 0 | Owner listens to the preview and steers (this file) | owner, about 10 minutes |
| 1 | Spec `docs/specs/audio.md` from this table with the owner's answers | designer, 0.5 |
| 2 | `audio.js`, mixer, settings, unlock, the **must** cues (#1-#9, #11-#13) wired through the director and app.js, behind a Dev menu switch first, as a proof slice the owner plays (D121) | UI engineer, 1-1.5 |
| 3 | The **should** cues (#10, #14-#23), speed and Instant rules, voice limit tuning | UI engineer, 1 |
| 4 | QA: `cuesFor` unit test, ui-regress assertions on the log, frame-time check, a listening pass at 1×/4×/Instant | QA, 0.5 |
| | **Total** | **about 3-3.5 sessions**, plus later cues (#24-#25) at 0.25 |

Music and ambience (M4) are not in this cost.

## 6. Files

- `docs/audio/README.md`: this file.
- `docs/audio/preview.html`: the listening sample (self-contained).
