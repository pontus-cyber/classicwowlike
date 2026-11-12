# Art proposal 1: the Lantern colour theme in the real client

Status: **draft, a proposal for the owner to steer** (Art Director, 2026-11-12; D120, D121). It is not the overhaul. It is off by default, it changes colours only, and it can be removed by emptying one block of one file.

Claims are tagged as in docs/README.md: [stated], [source], [inference], [assumption].

## 1. How to see it

- In the game: Dev menu (`` ` `` key or the DEV corner button), tab **World**, section **Look**, switch **Theme: Lantern (proposal)**. The choice is saved with the other settings.
- By link: add `?theme=lantern` to the address (`?theme=current` forces today's look). The link wins for that page and is not saved.
- Both set `data-theme="lantern"` on `<html>`; without it the game looks exactly as before.

## 2. Screenshots

Real client, 1366x768, same seed and same state in both themes. Made with `docs/art/proposal-1/shots.mjs`.

| State | Current | Lantern (proposal) |
|---|---|---|
| Combat, engage round, Deathblow pending (Hunter vs Bargh the Drowned King) | `1-combat-deathblow-current-1366.jpg` | `1-combat-deathblow-lantern-1366.jpg` |
| MAIMED after the Deathblow landed | `2-maimed-current-1366.jpg` | `2-maimed-lantern-1366.jpg` |
| Fog map, Amberfold Downs | `3-fogmap-current-1366.jpg` | `3-fogmap-lantern-1366.jpg` |
| The start camp | `4-start-camp-current-1366.jpg` | `4-start-camp-lantern-1366.jpg` |
| Character sheet | `5-character-current-1366.jpg` | `5-character-lantern-1366.jpg` |

## 3. What changed

All of it sits in `src/ui/tokens.css`: the `:root[data-theme="lantern"]` token block and one marked block of lantern-only rules below it.

| Area | Current | Lantern |
|---|---|---|
| Panels | Near-black box, gold hairline, gold diamond studs, the same for every panel | Umber timber board with a faint plank grain, one painted cream line, slightly uneven hand-cut corners, no studs |
| Cards the player chooses (contracts) | Parchment with a soft radial glow | Flat paper with an ink edge; a taken contract gets an ochre edge |
| Text | Cool cream on black | Paper cream on timber, ink on paper |
| Accent | Bright gold | Lantern and ochre |
| Health, resource and XP bars | Glossy neon green, blue, purple | Opaque fen green, water, ochre, burnt orange, dusk slate; the glass highlight is almost gone |
| Enemy health | Bright red | Brick with an ink edge (red is no longer "enemy") |
| Primary buttons (Set out, Take) | Red | Lantern ochre with ink text |
| Close button | Red disc | Timber disc with a cream line |
| Deathblow banner on the enemy | Dark red box with a red glow and a pulse | Flat madder banner, ink edge, cream line, hard shadow, no glow, no pulse |
| Fog map | Dark table around a pale disc; "you are here" is a red ring; the urgent Dimming clock is red | Paper chart around the disc; "you are here" is lantern-white; the urgent Dimming clock is violet |
| Answers to a telegraph | Cyan | Water teal |
| The Furnace's Infernal token | Crimson | Burnt sienna (see question 2) |

Red reserved for danger (D120): in this theme madder red is left on the Deathblow (banner, Engage warning, target-frame row, prompt), LETHAL and MAIMED. Section 4 lists where red still appears because this task could not reach it.

## 4. What did not change

- **Characters, enemies, pets, portraits and backdrops.** Not touched, by instruction. They are drawn on canvas from colours in JavaScript (`art-actors.js`, `art-world.js`), which no CSS theme reaches. This is still the weakest part of the picture and the theme makes that more visible, not less [inference from the screenshots].
- **Ability and item icons.** Also canvas. Damage spells and the potion are still red squares, so the action bar breaks "red is danger" in both themes.
- **The Furnace strip and the minimap.** Their colours live in JavaScript (`heat.js`) and in CSS literals that are not tokens yet; only the small Calm marker moved.
- **Deathblow repeats.** The Deathblow is still stated five times on the combat screen (readability target R2). That is a layout decision for the designer, not a colour.
- **The Engage cards, the Opening strip, intent rows, tooltips and the Dev menu.** Still dark glass boxes; they only pick up the new text, line and accent colours.
- **Layout, sizes, fonts, wording and rules.** Nothing moved; no engine, sim or QA file was edited.
- **The default look.** Unchanged, checked value by value (section 7).

## 5. Readability notes

Contrast ratios are computed from the token values (WCAG formula); the rest is from the screenshots [source: this folder].

| Check | Current | Lantern |
|---|---|---|
| Body text on a panel | 14.5:1 | 11.6:1 (dim text 7.9:1; muted text 4.4:1, a hair under the 4.5 target) |
| Number on the health fill, lightest part / middle (R4 target 4.5:1) | 1.7 / 3.6 | 2.8 / 4.5. Better, still short at the top edge; the text keeps its dark outline |
| Number on the enemy health fill | (bright red) | 4.2 / 6.9 on brick |
| Number on the Focus fill | (unchanged problem) | 2.4 / 3.6: the weakest bar; needs a darker orange or ink text |
| Deathblow banner text on its fill | glow on dark red | 5.9:1, flat |
| Ink on the ochre button | (cream on red) | 7.0:1 |

- **R1, telegraph first.** With enemy health in brick and the buttons in ochre, the Deathblow banner is the only saturated red in the world area. On the HUD the red spell icons still compete with it (section 4).
- **The panels are lighter.** Timber is brown, not black, so panels separate less from a dark backdrop (Greywater Fens) and more from a bright one (Amberfold Downs). It reads as warmer and softer; some may read it as lower contrast.
- **The fog map on paper.** Node labels and the key keep their own dark plates, so they still read. The pale disc now sits on pale paper, so the disc edge is weaker than on the dark table.
- **Not checked:** colour-blind simulation, 1920x1080, hover states, the other windows (bags, talents, vendor, loot, Hall of Echoes, death summary). They take the tokens automatically but nobody has looked at them in this theme yet.

## 6. Open choices for the owner

Each has a default that applies if there is no answer.

1. **Panels: brown timber (as shown) or keep them near-black with only the cream line and ochre accents?** Timber is the direction's look; near-black keeps the strongest contrast. Default: timber.
2. **The Furnace at Infernal: burnt sienna (red stays strictly for the Deathblow, as shown in the tokens) or madder red (the kiln "burns red", as in the style frame)?** Default: burnt sienna.
3. **Fog map: paper chart (as shown) or the dark table of today?** Default: paper.
4. **Is this enough to go on to the proof slice (one fight with repainted characters and backdrop, also behind this switch), or do you want another colour pass first?** Default: go on; colours are cheap to move later.

## 7. Checks

| Check | Result |
|---|---|
| Style snapshot, default theme, build before this change vs build with it (10 states, 1366x768) | **Identical**: 5 230 elements, 329 156 values compared, 0 differences, exit 0 |
| `ui-regress` parts A, M, N, P at 1366x768, default theme | **95/95 pass**, exit 0, no console errors |
| Ten screenshots (five states, two themes) | No console or page errors; each page reported the theme asked for |
| Dev switch | Pass: off by default (no attribute), on sets `data-theme="lantern"` and the tokens change, it survives a reload, off removes it; `?theme=lantern` works; no console errors |

How to repeat:
```
node tools/build.mjs --out /tmp/art-game.html
node docs/art/proposal-1/shots.mjs --file /tmp/art-game.html
NODE_PATH=/opt/npm-tools/node_modules node qa/browser/ui-regress.mjs --file /tmp/art-game.html --sizes 1366x768 --parts A,M,N,P
```

## 8. Files

| File | Change |
|---|---|
| `src/ui/tokens.css` | The lantern token block filled; one marked block of lantern-only rules (boards, paper cards, red taken off non-danger, the flat Deathblow banner, opaque bars) |
| `src/ui/settings.js` | Setting `lanternTheme` (off by default), the `?theme=` flag, `data-theme` on `<html>` |
| `src/ui/dev-menu.js` | The switch in the World tab |
| `docs/art/proposal-1/` | This file, the ten screenshots, `shots.mjs` |

`game.html` is not rebuilt here; the Lead builds it. Until then the switch exists only in a local build.

To remove the proposal: empty the `:root[data-theme="lantern"]` block and delete the marked rule block in `tokens.css`. The switch then does nothing.

## 9. What the next stage would cost

Session counts are [inference] and need the UI engineer's own estimate.

| Next step | What it gives | Cost |
|---|---|---|
| Another colour pass on this theme after the owner's answers | The answers above applied; Focus and health contrast fixed; the other windows looked at | Under 1 session |
| R3, one palette for JavaScript and canvas (already planned, D119) | The theme reaches the Furnace strip, icons, minimap and map disc; without it the canvas ignores the switch | 1 session, UI engineer |
| Proof slice, stage 0 of docs/art/README.md | One fight in Lantern Gouache in motion: Hunter, wolf and one elite with light and shadow sides, one repainted backdrop, behind this same switch. **The go or no-go for the overhaul is here** | 1-2 sessions |
| Stages 1-5 (all characters, readability pass, frames and icons, backdrops, map and camp) | The overhaul itself | About 7-12 sessions in total |

Recommended order: the owner's answers, then R3, then the proof slice. Nothing beyond this proposal starts before the owner's steer (D121).
