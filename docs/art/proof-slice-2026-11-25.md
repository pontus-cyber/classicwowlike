# Art proof slice: Lantern Gouache in the real client (MD D.4)

Status: **draft, a proposal for the owner to judge** (UI/UX and Visual Engineer, 2026-11-25; D120, D121, D129, D171). It is off by default and it is not the overhaul: it paints what a demo player sees most (a zone 1 and a zone 2 fight, the zone map, the start camp) so the owner can say go or no-go before more is spent.

Claims are tagged as in docs/README.md: [stated], [source], [inference], [assumption].

## 1. How to see it

- By link: add `?art=lantern` to the address (`?art=current` forces today's look). The link wins for that page and is not saved.
- In the game: Dev menu (`` ` `` or the DEV corner button), tab **World**, section **Look**, switch **Art: Lantern proof slice**. Saved with the other settings; it can be switched mid-fight.
- Both set `data-art="lantern"` on `<html>`. Without it the game looks exactly as before (section 6).
- It is a separate switch from proposal 1's colour theme (`?theme=lantern`): the HUD keeps today's dark panels, as the owner chose (D129).

## 2. Screenshots

Real client, 1366x768, same seed and state in both looks; each image is the current look on the left and the Lantern proof slice on the right. Files in `docs/art/proof-slice/`, made with `docs/art/proof-slice/shots.mjs` (it also writes each half as its own file).

| # | State | File |
|---|---|---|
| 1 | Zone 1 fight (Amberfold Downs), Rogue against a Hedge Ogre, a Scarecrow Hexer and a Barn Wolf (three families: outlaw, blight, wild), round 2 | `1-zone1-fight-side-by-side.jpg` |
| 2 | Zone 2 elite fight (Greywater Fens), Hunter and Ridgewolf against Bargh the Drowned King, engage round with the Deathblow pending | `2-zone2-elite-fight-side-by-side.jpg` |
| 3 | Zone map, Amberfold Downs, on setting out | `3-map-side-by-side.jpg` |
| 3b | Zone map later in a run: regions seen, the Dimming two tolls away | `3b-map-dimming-side-by-side.jpg` |
| 4 | The start camp (first run) | `4-camp-side-by-side.jpg` |
| 5 | Hunter and Ridgewolf, close-up (HUD hidden, 2x pixels) | `5-actor-hunter-side-by-side.jpg` |
| 6 | Rogue, close-up | `6-actor-rogue-side-by-side.jpg` |
| 7 | Mage, close-up | `7-actor-mage-side-by-side.jpg` |
| 8 | Zone 1 enemies, close-up: Hedge Ogre, Scarecrow Hexer, Barn Wolf | `8-enemies-zone1-side-by-side.jpg` |
| 9 | Zone 2 elite, close-up: Bargh the Drowned King | `9-elite-zone2-side-by-side.jpg` |

The Dimming panel's border in 3b differs between the halves only because it pulses (an animation caught at another moment); the rule is the same in both.

## 3. What changed (only with the switch on)

| Area | Today | Lantern proof slice |
|---|---|---|
| Zone 1 backdrop (farmland) | Soft gradients, round trees made of radial blobs, white puffy clouds | Gouache: hand-cut shapes with no outlines, a low sun on the right as the one key light, cool distant hills, mist bands between layers, visible brush strokes, painted fields, trees in two values lit toward the sun, flat-bottomed clouds, a worn road with ragged edges |
| Zone 2 backdrop (wetlands) | Grey-green willows and dead trees | Fen green and water; dome willows with hanging strands, stilt huts with one warm window, reeds, pools with a paper-cream glint; the low sun on the left |
| The camp at dusk | Dark farmland at sunset, a small fire, a flat tent and banner | Slate to ochre dusk; the fire is the key light and throws a warm pool on the ground; a painted tent lit on its fire side, the class banner as cloth; a muster yard round it: a bell frame, spear rack, crates, two lamp posts |
| Heroes | Flat-colour rigs, no light side, Rogue in red | Same rigs in the direction's palette (Hunter fen green and moss, Rogue dusk slate with an umber scarf, Mage water-blue robe with a lantern orb); every actor gets a shadow-side glaze, a darker edge away from the light and a warm lit edge toward it, gouache grain; no glowing eyes |
| Zone 1-2 enemies | Archetype rigs tinted by zone, glowing eyes | Families drawn apart: outlaw ogre (bare, tusked jaw, a fence post for a club), blight scarecrow (stitched sack head, straw hat, straw at the cuffs, standing not floating), wolves with a lit ruff, boars in umber; reedfolk, witchkin and fenbeasts in zone 2's fen, water and murk |
| Elite | 1.18x, a pulsing gold glow, a text tag | 1.3x, drawn as an elite: Bargh has a rusted crown with verdigris, a waterlogged cape that drips, a mooring post with rope for a club, and a heavier shadow edge; no glow |
| Shadows, target ring | Black ellipse; the selected target's ring is red | Umber pool with a darker core; the target ring is lantern light (selected) or a dashed cream ring (hover). Red stays the danger colour (D120) |
| HUD (dark panels kept, D129) | Enemy health red; Set out, Take and the close button red; damage spells and the healing draught on red icons | Enemy health brick with an ink edge; Set out and Take lantern ochre with ink text; the close button dark with a cream line; damage and potion icons rust umber. The Deathblow banner, its prompt, LETHAL, MAIMED and the danger icons keep madder red |
| Zone map (the paper chart of D129) | Paper chart; uncharted land a grey mist; soft blurred region tints | Painted chart: paper texture and a darker deckle edge, a compass rose, region washes with hand-cut gouache edges, uncharted land as blank hatched paper, ink roads, the Dimming a dark violet soak |
| Portraits | Cropped rigs | The same crop of the Lantern look, painted (the "portraits as portraits" pass is stage 1) |

All names, shapes and drawings are original and made for this task. Bargh's crown, cape and mooring post follow the draft style frame (docs/art/README.md), built from his name and zone; they are not canon.

## 4. What it did not touch

- **Zones 3-6, the Sunken Observatory, dungeon interiors, the end boss and shards, NPCs (quest giver, vendor, trainer) and the other set pieces** (cart, chest, gate, shrine, signpost): today's art. With the switch on, actors in other zones are painted but keep today's palette.
- **The Furnace strip** (still runs to red at Infernal), the action-bar icon shapes, the minimap, the character sheet's figure, tooltips, windows: today's look, apart from the token changes in section 3.
- **Deathblow repeats and the telegraph in the world** (readability stage 2): unchanged.
- **Layout.** Two layout problems show in both halves and are not art: at the start camp the supplies row covers the hero at 1366x768, and in the zone 2 engage round the Engage panel covers the Hunter.
- Rules, engine, sim, content: nothing. No file in src/engine, src/rules.js, src/content or sim was edited.

## 5. Readability and feel

- **R1 telegraph first:** with the target ring, the enemy health bar, the buttons and the damage icons out of red, the Deathblow banner and its prompt are the only saturated red on the fight screens (screenshot 2) [source: screenshots]. The Furnace strip is the exception left.
- **R6 actor separation:** actors stand out from the lighter, softer backdrops by value and by the lit edge; an elite reads as an elite with the HUD hidden (screenshot 9) [inference from the close-ups; the greyscale check was not run].
- **Light:** one key light per scene (the sun in zones 1-2, the fire at camp); actors are lit from its side, so the Hunter in zone 1 faces into the light and Bargh in zone 2 is lit from the front.
- **Motion:** to keep the frame cheap, a painted actor is kept as a sprite per pose: idle breathing runs on a 12-step loop at 6 steps a second and an action in 16 steps (gouache "on twos"). Position, lunge, recoil and flashes stay smooth. Some may find the stepped idle visible; see question 2.
- **Not checked:** colour-blind simulation, greyscale (R6, R7), 1920x1080, contrast ratios of the new tokens.

## 6. Checks

| Check | Result |
|---|---|
| Style snapshot, switch off, build of origin/main 853f127 vs this build (1366x768) | **Identical**: 14 states, 6 161 elements, 388 176 values compared, 0 differences. The 2 states listed by the compare (guided-camp, guided-fight) are not reached by the snapshot script in either build (pre-existing) |
| Canvas pixels, switch off (`qa/browser/canvas-shot.mjs`, 6 states) | **Identical** for class-select, engage-deathblow, zone1-travel. mage-fight, maimed and mage-round are not deterministic on origin/main itself: over repeated runs each takes a small set of hashes (mage-fight d39c84b6 / be1231e9; maimed cadb8ed6 / 1271d4b8 / 76c126a5; mage-round 676d4b82 / 5c4fc187), and every hash this build gave was also given by origin/main |
| `node --test qa/engine qa/rules qa/docs qa/sim qa/ui` | **1 072 / 1 072 pass**, exit 0 |
| `ui-regress` parts A, D, H, M, N, P at 1366x768, switch off | **111 / 112**. The one failure (part D, M2v2-52: a round's maximum 2 958 ms against a 2 940 ms cap) fails the same way on origin/main (2 948 ms), so it is the machine's timing, not this change |
| Switch on: console and page errors | None in the 20 screenshot pages and the frame-time runs |
| Dev switch | Off by default; on sets `data-art="lantern"`, rebuilds the backdrop and the actors mid-fight, is saved, survives a reload; off removes it. No console errors |
| Frame time (headless Chromium, median of the frame callback, 3 runs each) | Idle fight: today 0.7-0.8 ms, Lantern 0.5 ms (sprites). While a round plays: today 1.6 ms, Lantern 3.7 ms (zone 1, three enemies) and 4.6 ms (Bargh), with spikes to 11-27 ms (95th percentile) when a pose is painted the first time. **R9 (no more than +2 ms) passes idle and fails while a round plays**; the fix is in section 7 |

How to repeat:
```
node tools/build.mjs --out /tmp/tbwcr-wt-ui/game.html
NODE_PATH=/opt/npm-tools/node_modules node docs/art/proof-slice/shots.mjs --file /tmp/tbwcr-wt-ui/game.html --out /tmp/proof-slice
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/style-snapshot.mjs --file /tmp/tbwcr-wt-ui/game.html
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/canvas-shot.mjs --file /tmp/tbwcr-wt-ui/game.html
```

## 7. What each further stage would cost

Sessions of one UI engineer slot [inference from this slice, which took one session for 2 backdrops, the camp, 3 heroes, 4 enemy families, 1 elite and the map]. "Demo" is zones 1-2 only, as D171 applies the chosen art to the demo.

| Stage (docs/art/README.md 5) | For the demo | For the whole game | Notes |
|---|---|---|---|
| Paint performance (needed before anything ships, R9) | 0.5 | 0.5 | Pre-paint each actor's poses while the fight loads, or move the shading into the vector drawing (then no sprites and smooth motion); the second is the better base for stage 1 |
| 1. Characters and enemies | 1.5 | 3 | Demo: every zone 1-2 normal, elite, rare and dungeon trash and both dungeon bosses, all four pets, portraits drawn as portraits. Whole game adds zones 3-6, the end boss and shards, NPCs |
| 2. Readability (Deathblow once in the world, once in the plan; the telegraph on the ground) | 1-1.5 | same | Independent of the art; needs the designer's word on which repeats go |
| 3. UI frames, icons and tokens (dark panels kept, D129) | 1 | 1.5-2 | Furnace strip off red, icons redrawn in the direction, the remaining hard-coded reds; smaller than first planned because the panels stay dark |
| 4. Backdrops | 0.5 | 1.5-2 | Demo: polish of zones 1-2 and the zone 1-2 dungeon interiors and hub. Whole game: zones 3-6 and the Sunken Observatory |
| 5. Map and camp | 0.5 | 0.5 | Node states by line as well as colour (R7); the camp layout so the hero is not covered |
| **Total after this slice** | **about 5-5.5** | **about 8.5-10** | The demo spec's estimate for D.4 was 3-4 sessions (docs/specs/demo.md 8); the gap is the performance step, stage 2 and the dungeon interiors |

## 8. Open questions for the owner

Defaults apply until answered.
1. **Go or no-go for the demo:** Lantern Gouache for zones 1-2, the HUD and the map, as shown. Default: go, starting with the performance step and stage 1.
2. **Motion:** keep the painted actors on steps (as shown, cheapest) or make them move smoothly (shading moved into the drawing, part of stage 1, no extra session)? Default: smooth, done in stage 1.
3. **The lit edge and grain** on the actors: as shown, softer, or stronger? Default: as shown.
4. **The map:** hatched blank paper for uncharted land and a compass rose, as shown? Default: yes.
5. D171 mentions "two or three art directions" for zones 1-2 and the HUD; this task built direction A only, the owner's choice of 2026-11-12 (D120). Default: no B or C slice unless the owner asks.

## 9. Files

| File | Change |
|---|---|
| `src/ui/settings.js` | `lanternArt` setting (off), `?art=` flag, `data-art` on `<html>` |
| `src/ui/theme.js` | `artStyle()`; a `data-art` change clears the token cache and fires `onTheme` |
| `src/ui/dev-menu.js` | The switch in World > Look |
| `src/ui/art-world.js` | `LANTERN_THEMES`, `buildLanternBackdrop` (farmland, wetlands, dusk with the muster yard); `buildBackdrop` uses it when asked with `lantern` |
| `src/ui/art-actors.js` | Lantern looks (heroes, pets, zone 1-2 families, Bargh), the look selectors `heroLook`, `petLook`, `foeLook`, `foeBeastLook`, the features (cape, crown, jaw, sack head, straw, ruff, mooring post), `paintActor`, `makeGrain`, painted portraits |
| `src/ui/art-fx.js` | Umber shadow, lantern target ring, no rank glow (switch on only) |
| `src/ui/art-props.js` | Painted campfire, tent and banner (switch on only) |
| `src/ui/scene.js` | Backdrop cache keyed by the art style, `restyle()` on a switch, `drawPainted` (sprites per pose), palette of the built backdrop |
| `src/ui/hud.js` | Portraits follow the art style |
| `src/ui/screens.js` | The map's wash, soak and hatch (SVG filters and pattern) added only under the switch |
| `src/ui/tokens.css` | One marked `:root[data-art="lantern"]` block: red kept for danger on the HUD, the painted chart |
| `docs/ARCHITECTURE.md` | Rows for settings, theme, art-actors, art-world, tokens.css |
| `docs/art/proof-slice/` | `shots.mjs` and the ten side-by-side screenshots |

`game.html` is not rebuilt here; the Lead builds it. To remove the slice: delete the marked block at the end of `tokens.css`, the Lantern sections at the end of `art-world.js`, `art-actors.js` and `art-props.js`, and the `artStyle()` branches; with the switch off none of it runs.
