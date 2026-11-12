# Art direction: where we are and three ways forward

Status: **draft** (Art Director, 2026-11-12; not approved by the owner). Nothing here changes the game until the Lead schedules it.

Purpose: the owner is considering a graphics overhaul and does not want to spend on it "unless we really know what we want" [stated]. This file makes that choice concrete: an honest look at today's art, three original directions shown as style frames of the same three screens, a recommendation and a staged plan.

Claims are tagged as in docs/README.md: [stated], [source], [inference], [assumption].

## 1. How to read the frames

Nine style frames in `docs/art/frames/`, each a self-contained HTML file (inline SVG and CSS, no external assets) and a 1366x768 PNG rendered from it with Playwright.

| Screen | A: Lantern Gouache | B: Bellfoundry Print | C: Unlit Nocturne |
|---|---|---|---|
| Combat: Hunter and Ridgewolf vs Bargh the Drowned King (Elite), Deathblow in round 3 | `frames/a-lantern-gouache-combat-1366.png` | `frames/b-bellfoundry-print-combat-1366.png` | `frames/c-unlit-nocturne-combat-1366.png` |
| Zone fog map: Amberfold Downs | `frames/a-lantern-gouache-fogmap-1366.png` | `frames/b-bellfoundry-print-fogmap-1366.png` | `frames/c-unlit-nocturne-fogmap-1366.png` |
| The start camp | `frames/a-lantern-gouache-camp-1366.png` | `frames/b-bellfoundry-print-camp-1366.png` | `frames/c-unlit-nocturne-camp-1366.png` |

Compare them with today's game: `docs/handoffs/screens/ui-2026-11-11e-1-deathblow-engage-1366.jpg` (combat), `ui-2026-11-11c-1-fogmap-1920.jpg` (map), `ui-2026-11-11b-1-prep-1920.jpg` (camp).

What the frames are, and are not:
- They use the real game's layout and wording, so the only thing that differs between columns is the art direction. Layout problems (section 2.3) are left in on purpose; fixing them is a separate, cheaper job.
- They are stills. Motion, hit feel and the Furnace heating up are described in words only.
- All three use **one character blocking** (the same Hunter, wolf and elite shapes) rendered three ways. In a real build each direction would also get its own proportions (section 3). So judge palette, light, line and UI treatment; do not judge anatomy.
- They were built in about an hour with the same means the game has: shapes, gradients, SVG filters and CSS. They show roughly where code-drawn art lands on a first pass, not a ceiling [inference from building them].
- Typography uses the game's current system font stacks, because no font files may be downloaded. Text will look slightly different on the owner's machine.
- Original work: every shape was drawn for this task. Bargh's look here (rusted crown, waterlogged cape, mooring-post club) is a draft proposal built from his existing name and zone, not canon.

## 2. Assessment of the current look

Based on the screenshots above, the live `game.html` at 1366x768, and `src/ui/style.css`, `art-actors.js`, `art-world.js`, `art-icons.js`.

### 2.1 What works
- **The UI is ahead of the world art.** Panels, bars, the action bar and the parchment contract cards are consistent and feel like a classic MMO. The 1rem scaling holds at 1366 and 1920 [source: docs/handoffs/screens].
- **Information is honest and complete.** Intents, the Opening strip, the Deathblow answer keys and toll costs are all on screen. Few games at this stage tell the player this much.
- **Backdrops have a mood.** Layered hills, mist and zone-specific props (willows, stilt huts) already separate the zones by colour and silhouette.
- **The pipeline is cheap to change.** Backdrops are built once into offscreen canvases (`buildBackdrop`), actors are drawn from `look` objects, and the HUD is CSS. A direction change is mostly new numbers and a few new drawing passes, not a new engine [source: src/ui/art-world.js, art-actors.js].

### 2.2 What reads as placeholder
- **Characters and enemies.** This is the weakest part and the first thing a player looks at. Actors are flat-colour capsule rigs with dot eyes and no light side or shadow side. The elite brute and the Hunter have the same visual weight; "Elite" is carried by a text tag and a ring, not by the drawing. Portraits are the same rig cropped.
- **Actors do not sit in the world.** The backdrop has haze and soft light; the actors have neither, so they look pasted on. There is no shared light direction.
- **Icons are generic.** White glyphs on flat coloured squares (arrow, heart, target). They do the job but say nothing about this world.
- **One frame treatment for everything.** Every panel is the same dark brown box with a gold hairline and diamond studs, whether it is a unit frame, a warning or a tooltip. Nothing looks more important than anything else.
- **Typography is default.** A system sans for almost everything, with Palatino for titles. Clean, but it has no character, and numbers do not stand out from labels.

### 2.3 What hurts readability
These matter more than style, and most can be fixed in any direction.
- **The Deathblow is said five times in one screen** (Engage panel, target frame row, Opening strip, banner over the enemy, prompt above the action bar), each a red box with a glow. When everything shouts, the player stops hearing it, and the one place that matters (the enemy who is about to do it) is not the strongest [source: ui-2026-11-11e-1-deathblow-engage-1366.jpg].
- **Red means four things:** enemy HP, the Deathblow, damage-spell icons and the primary button. The danger colour is not reserved.
- **The target frame floats mid-screen** and covers the space between the two sides, where the fight should read.
- **The Furnace is a long text bar.** Its four states are small caps on a strip; the state is read, not felt. Nothing else on screen changes as it heats.
- **The fog map carries state mainly by colour.** Seen, Remembered, Type known and Unknown are four similar discs; "dims in N" tags overlap nodes; region colours compete with node colours [source: ui-2026-11-11c-1-fogmap-1920.jpg].
- **Small text.** Card body text and intent sub-lines sit near 11 px at 1366x768. This is a density problem more than a font problem.
- **Technical debt that slows any reskin:** `style.css` holds about 980 hard-coded colour values (435 distinct) next to about 490 uses of the colour variables [source: grep of src/ui/style.css, 2026-11-12]. A reskin has to start by moving those into named tokens.

### 2.4 The honest ceiling
The rules allow procedural SVG/canvas and CSS only: no external images, no paid tools, no downloaded art. Inside those rules the game can reach **clean, cohesive, stylised**: clearly better than today and clearly its own thing. It will not reach hand-illustrated character art, whichever direction is chosen. If the owner wants that level, it is a different decision (an illustrator, or generated images) and should be parked in docs/EXPERIMENTS.md rather than mixed into this one.

## 3. Three directions

### A. Lantern Gouache
**Pitch.** A storybook painted in opaque gouache at dusk. Soft-edged, slightly wobbly shapes; a limited earthy palette; warm lantern and low-sun light against cool distance. The UI is a traveller's kit: dark timber boards with a painted cream line, and paper cards for anything the player chooses. It is the closest of the three to the owner's "stylised painted 2D" [stated] and to the lore tone "grounded and weary, with hope underneath" [source: docs/lore/style.md]. It is also the nearest to what the game already is, done properly.

| | |
|---|---|
| Palette | Dusk slate `#27313b`, fen green `#5d7a5a`, moss `#8a9a5b`, ochre `#d9a441`, lantern `#f2c56b`, paper `#f1e3c0`, umber board `#3d2c20`, ink `#2b2118`, water `#4f8a8b`. Reserved: madder red `#b8432f` (danger only), Dimming violet `#6b4fa0`. |
| Light | One warm key light, low and from the horizon; cool ambient. Every actor gets a shadow side (a dark violet-brown glaze, about 30 %) and a warm lit edge. Mist bands between depth layers. |
| Shape language | Rounded, hand-cut shapes with a dry-brush wobble on the edge; no outlines, a slightly darker edge of the same hue instead. Heroes upright and narrow; enemies wide and low, elites 1.3x with one oversized feature (a crown, a club, a jaw). |
| Characters and enemies | Three values per colour (base, shade, light) plus a few visible brush strokes. Faces stay hidden or simple (hood, cowl, helm), which suits a small code-drawn figure. |
| UI frames | Timber panel with a cream line and uneven hand-cut corners; paper cards with ink edge for choices (abilities, contracts); a red painted banner for warnings. Three frame types instead of one. |
| Typography | Titles: the current Palatino-family serif stack, sentence case. Body: the current system sans, one step larger. Numbers: bold, tabular. |
| The Furnace | A painted kiln strip: teal water-glaze for Calm running to ochre, orange and madder. As it heats, the backdrop's key light warms and embers rise in the scene, so the state is felt without reading. |
| Deathblow telegraph | A madder-red painted banner over the enemy, a thick red ring under it, and a dashed red brush stroke along the ground to the target with a ring at their feet. Red is used for nothing else. |
| Fog map | A painted parchment chart: region washes, dashed ink roads, cream discs for seen nodes with a gold ring, grey for unknown. The Dimming is a violet wash soaking into the paper. |
| Cost in this codebase | **Lowest.** CSS tokens and three frame classes; a shade and a light pass in `drawHumanoid` / `drawBeast`; brush-stroke and mist passes in `buildBackdrop` (built once, so free at runtime). Edge wobble: pre-render actors to offscreen sprites with jittered path points; do not rely on a per-frame filter. About 6-8 UI-engineer sessions for the whole game [inference from the size of the art files: about 1 500 lines]. |
| Risk | The safest and the least surprising. Done half-way it looks like today's game with a texture on top. It only works if the character pass is done first and done well. |

### B. Bellfoundry Print
**Pitch.** The game as a printed chapbook from the Bellwrights' own press: heavy ink line, flat colour blocks, hatching for shadow, on warm paper. Two spot colours carry all meaning: vermilion for danger and violet for the Dimming. The UI is a ledger: ruled paper panels with hard drop shadows, and warnings as rubber stamps. It is the most distinctive and the easiest to read at a glance, and it turns the limits of code-drawn art into the style itself.

| | |
|---|---|
| Palette | Paper `#efe4cb`, paper shade `#d9c9a3`, ink `#1d1a17`, bell bronze `#b07a2e`, fen teal `#3f7f78`, moss `#6f8a3f`. Reserved: vermilion `#d2382a` (danger only), star violet `#5b3fa8` (the Dimming only). |
| Light | No gradients. Light is paper showing through; shadow is hatching at one angle. Sky is ruled lines that thin towards the horizon. |
| Shape language | Bold silhouettes with a 2-3 px wobbling ink outline; angular cuts as in a woodblock; large flat areas. Heroes drawn with paper-light faces of cloth; enemies carry more black. |
| Characters and enemies | Flat fill, ink outline, one hatched shadow shape. Rank is shown by ink weight: normal thin line, elite heavy line and a solid black cape or mass. |
| UI frames | Paper panel, 2 px ink border, inner hairline, hard offset shadow (no blur). Key caps are solid black squares. Buttons are stamped boxes. |
| Typography | Titles: the serif stack in small capitals with wide tracking. Body: system sans in ink. Numbers: bold; damage numbers in black, danger numbers in vermilion. |
| The Furnace | A printed gauge with four tinted cells and a black pointer. As it heats, more of the scene is overprinted in bronze and then vermilion (sun, sky lines, ground). |
| Deathblow telegraph | A vermilion stamp, set slightly crooked, over the enemy; a hatched vermilion arrow printed on the ground from the enemy to the target. The only large red thing on the page. |
| Fog map | A surveyor's chart with a degree ring. Node state is carried by line: heavy double ring (seen), thin ring (remembered), dashed (type known), dashed and tinted (unknown). The Dimming is violet hatching flooding in. Works without colour. |
| Cost in this codebase | **Low to medium.** Line-and-flat is what canvas and SVG do best: outlines via `stroke`, hatching via `createPattern`, no blur or glow at all, so it is also the fastest at runtime. But it is a full break: every backdrop, actor, icon and panel is redone, nothing carries over. About 8-10 sessions [inference]. |
| Risk | It is ink and wash, not "painted": it may read as a board game or a comic rather than a classic fantasy MMO, and the light paper UI is far from the dark-and-gold look players expect. Six zones on one paper colour can look alike unless each zone gets its own spot colour. A wobbling line must be pre-rendered or it will shimmer. |

### C. Unlit Nocturne
**Pitch.** The world at night under a star that gives no light. Deep blue silhouettes, thin rim light, small warm lamps, and the Unlit Star hanging in the sky as a black disc with a cold corona. The UI is a Sunscribe instrument: dark glass, hairline brass, round dials and tick marks. It is the most dramatic and the most modern-looking, and it puts the game's own antagonist in every frame.

| | |
|---|---|
| Palette | Night `#0b1020`, deep `#131a33`, indigo `#24305c`, horizon teal `#5b8fa8`, moon steel `#9fb6d9`, star white `#e8f0ff`, brass `#c9a45c`, lamp `#ffb05c`, HP green `#5fd08a`. Reserved: crimson `#ff3b4f` (danger only), void violet `#8a5cff` (the Dimming only). |
| Light | Back-lit. A bright horizon band, dark figures in front, a thin coloured rim on the side facing the light, glow around lamps and eyes. |
| Shape language | Clean geometric silhouettes with no texture; circles and thin lines in the UI. Shapes must read as black cut-outs first. |
| Characters and enemies | Near-silhouette fills (base colour mixed about 75 % towards night), one rim-light shape, glowing eyes. Friendly rim is moon steel; a telegraphing enemy is rim-lit in crimson, so the threat lights its owner. |
| UI frames | Translucent dark glass, 1 px brass line, corner ticks. Action slots are round dials with the key above and the cooldown below. |
| Typography | Titles: serif stack in brass. Body: system sans in star white. Labels: small tracked capitals. |
| The Furnace | An instrument scale: only the current state is lit, the rest are dim engraved labels. As it heats, the horizon band shifts from teal to ember and lamp-coloured sparks multiply. |
| Deathblow telegraph | A crimson reticle under the enemy and the target, joined by a dotted line of light; the enemy's rim light and eye turn crimson; a glowing crimson plate above it. |
| Fog map | A star chart on an astrolabe disc: nodes are stars, bright when seen and faint dashed rings when unknown. The Dimming is a black void with a violet edge that puts the stars out. The best fit of fiction and function of the three. |
| Cost in this codebase | **Medium to high.** Silhouettes are cheap to draw, but the look depends on glow and blur. On canvas that means `shadowBlur` or pre-blurred sprites for every light; the scene already uses these in about a dozen places [source: grep of src/ui/scene.js] and more will cost frame time unless each glow is baked once. About 8-10 sessions plus a performance pass [inference]. |
| Risk | The highest. Dark on dark is the classic readability trap: in the combat frame the Hunter is harder to find than in A or B. All six zones become "night", so farmland, fen and desert lose their daylight identity, and 45 minutes in the dark is tiring [inference]. It also drifts towards a look many current indie games share. |

## 4. Recommendation

**Build A (Lantern Gouache) as the base, take B's discipline for everything that must be read, and keep C as the visual language of the enemy.** In one line: a lantern-lit painted world that the Unlit Star slowly puts out.

Why A as the base:
1. It is what the owner asked for (stylised painted 2D) and it matches the tone in docs/lore/style.md.
2. It keeps what already works (dark-and-gold MMO frames, parchment cards, zone colour identity), so no finished work is thrown away and it can ship screen by screen.
3. It has the lowest cost and the lowest risk, and daylight zones stay different from each other across a 45-minute run.

What to take from B (rules, not looks):
1. **One reserved danger colour.** Madder red means "this will hurt you" and nothing else. Enemy HP moves to a darker brick tone with an ink edge; damage-spell icons and the primary button leave red.
2. **State by line as well as colour.** Map node states and intent rows differ in ring weight and dash, so they survive colour-blindness and a dim screen.
3. **Hard-edged, flat warnings.** The Deathblow marker is a flat banner with an ink edge and no glow, drawn over a soft painted world. Flat on painted is what makes it jump.

What to take from C (as story, not as the default):
1. **The Dimming, Shardfall, Shardspawn and the Sunken Observatory use the Nocturne palette.** Dimmed map regions go to void and violet; a Shardspawn enemy is a near-silhouette with a cold rim. The player learns that "dark blue with a violet edge" means the star.
2. **The star-chart map is the map of the last zone**, and the black disc of the Unlit Star appears in the sky of every backdrop, a little higher each zone (Ascendancy made visible; lore is draft, so this waits for the owner's story).
3. **The Furnace changes the light**, as in C: Calm is A's normal dusk; Infernal pushes the key light to ember.

Why not B or C alone: B is the best answer to "readable and distinctive on a budget", but it gives up the painted look and the classic MMO warmth that are the game's stated identity. C is the most striking single screenshot and the worst over a full run. If the owner looks at the frames and prefers B's or C's whole look, that is a legitimate choice and the plan below still applies; only stage 1's art pass changes.

## 5. Staged plan

Order by effect per session. Every stage ends in a build the owner can play, and each can be stopped after without leaving the game half-styled. Session counts are [inference] and need the UI engineer's own estimate.

| Stage | What changes | Why this order | Work for the UI engineer | Sessions |
|---|---|---|---|---|
| 0. Proof slice | One fight (Hunter and pet vs one elite, one zone backdrop) in the chosen direction, behind a dev-menu toggle. No other screen touched. | The frames are stills made outside the client. This proves the look inside the real renderer, in motion, before anything is committed. **The owner decides go or no-go here.** | New `look` entries and shade/light passes for one humanoid, one beast, one brute; one backdrop repaint; sprite pre-render with edge wobble; frame-time check. | 1-2 |
| 1. Characters and enemies | All heroes, pets and enemy archetypes: three-value shading, one light direction shared with the backdrop, rank shown by the drawing (size, one oversized feature, heavier edge). Portraits drawn as portraits, not cropped rigs. Ground shadows and contact. | The player looks at the actors most of the time, and they are today's weakest part. This alone moves the game from "prototype" to "styled". | `art-actors.js`: `drawHumanoid`, `drawBeast`, `drawHawk`, `drawBoss`, `drawPortrait`, `HERO_LOOKS`, `enemyLook`, `beastLook`. | 2-3 |
| 2. Readability pass | Reserve the danger colour; one Deathblow marker in the world (on the enemy, with the ground line to the target) and one in the plan, the other three repeats removed or reduced to a small tag; enemy HP recoloured; intent rows get icon, number, target in fixed columns. Dock the target frame. | Cheap, independent of art style, and it is what makes elites feel like "stop and think" moments [stated direction]. Could run before stage 1 if the Lead prefers. | `style.css`, `hud.js`, `scene.js` telegraph drawing, `combat-feel.js`. Needs the designer's agreement on which repeats go. | 1-2 |
| 3. UI frames and tokens | Move hard-coded colours into named tokens; three frame types (board, card, warning); type scale one step up for body text; action-bar slots and icons redrawn in the direction; the Furnace as a state the scene shows. | Largest file, most mechanical work. Tokens first makes every later change cheap. | `style.css` (about 980 colour literals to tokens), `art-icons.js`, `heat.js`. | 2-3 |
| 4. Backdrops | Brush and mist passes, shared light, the Unlit Star in the sky; one zone at a time, starting with Amberfold Downs. | Backdrops are already the best part; they need lifting, not replacing. | `art-world.js`: `THEMES`, `buildBackdrop` (one-time cost per zone, no runtime cost). | 1-2 |
| 5. Map and camp | Fog map as a painted chart with line-coded node states and the Nocturne Dimming; start camp boards and cards on the new frames, with the muster-yard scene behind. | Last because both screens already function and inherit most of stage 3 for free. | `tracks.js`, `prep.js`, `screens.js`. | 1-2 |

QA after each stage: both resolutions, no console errors, and the readability targets below.

## 6. What must stay readable

Proposed targets in the style of the balance B-targets, for the Lead to number and for QA to check on every art change. Draft values; the designer and QA should confirm them.

| ID (draft) | Must hold | How to check |
|---|---|---|
| R1 Telegraph first | In a screenshot of a fight with a Deathblow pending, the Deathblow marker is the highest-contrast element in the world area, and the danger colour appears on nothing that is not a threat. | Greyscale the screenshot: the marker is still the first thing seen. Count uses of the danger token in CSS and art. |
| R2 Telegraph once | The Deathblow is stated in full at most twice (once in the world on its owner, once in the plan). Other places show a tag only. | Screenshot review. |
| R3 Answer visible | The answering abilities are marked on the action bar or cards with their keys, readable without a tooltip. | Screenshot review at 1366x768. |
| R4 HP at a glance | Player, pet and target HP bars have text contrast of at least 4.5:1 on the fill and on the empty track, and differ from each other by position and shape, not only colour. | Contrast check on the tokens; greyscale screenshot. |
| R5 Intents | Each intent row shows icon, damage number and who it hits in fixed positions; the number is at least 16 px at 1366x768. | Measure in Playwright. |
| R6 Actor separation | Hero, pet and each enemy separate from the backdrop in greyscale; an elite is recognisable as an elite with the HUD hidden. | Greyscale screenshot with `#hud` hidden. |
| R7 Map states | The six node states (seen, remembered, type known, unknown, Dimmed, Shardfall) are distinguishable in greyscale. | Greyscale screenshot of the fog map. |
| R8 Text size | No gameplay text below 11 px at 1366x768; body text 12 px or more. | Computed font sizes in Playwright. |
| R9 Frame time | No stage raises the median frame time of a fight by more than 2 ms on the QA machine. | Existing headless run with timing. |

Against these, the frames score as follows [inference from the PNGs]: A passes R1, R4, R6, R7 and fails R2 (it keeps today's five repeats on purpose); B passes R1, R4, R6, R7 most clearly; C passes R1 and R7 and is weak on R6 (the Hunter against the dark ground).

## 7. Open questions for the owner

Defaults apply until answered.
1. Direction: A as the base with B's rules and C for the Dimming (section 4). Default: yes, and the Lead schedules stage 0 only.
2. Is "clean, cohesive, stylised" (section 2.4) the target, or does the owner want illustrated character art, which needs means outside today's rules? Default: stylised, code-drawn.
3. May the art show the Unlit Star in every zone's sky, rising by zone? This touches the lore, which is draft. Default: hold until the lore chat confirms.
4. Fonts: stay on system stacks, or allow one openly licensed font file embedded in the build? It would be a download, so it needs an explicit yes. Default: system stacks.

## 8. Files

- `docs/art/README.md`: this file.
- `docs/art/frames/<direction>-<screen>.html`: the nine style frames (self-contained).
- `docs/art/frames/<direction>-<screen>-1366.png`: the same frames rendered at 1366x768.

Checked: all nine HTML files load in Playwright (Chromium) with no console or page errors and reference no external files.
