# Spec changes M3 v3: the guided zone asks for care (Gorrak one level up, the bounty's XP on the road), and the Deathblow prompt after the first meeting

Owner: Game Designer, 2026-11-15. For: Core Gameplay Engineer (src/engine, constants), UI/UX Engineer (src/ui), Content Designer (src/content lines), Simulation & Balance Engineer (sim/), QA, Lead. **Status: draft** (not approved by the owner). Built engine side 2026-11-17 (D153; docs/handoffs/engine-2026-11-17.md): sections 2, 3, the content line and, for section 4, the profile's `deathblowMet` and windupView's `firstDeathblow`; the UI parts are open.

Input: the newcomer check after D152 [source: docs/feedback/2026-11-15-blind-newcomer.md, "Difficulty": "level 10 against level 5 enemies, Gorrak never hit once (s0097, s0101); no ward, potion or Ember needed; the Deathblow banner names the exact key, 'nothing to work out'"]; the round 2 re-runs [source: docs/feedback/2026-11-14-blind-tactician-rerun.md 3-4: "Too easy by a wide margin: no potion, ration or flask used, never below about 80 % health"; "the wind-up prompt names the answer ... good tutorial but no puzzle"; -blind-casual-rerun.md: "the game told me the one thing to press and it worked. More of that."]; the owner's principle [stated: docs/feedback/2026-11-11-1841-owner.md 18:46: "the game throws in this rare mob or something new, and then you need to stop and think"; 20:57: "die rates should be way higher for 1 button fights"]; D147-D152; changes-m3-v2.md 1.4, 5; balance.md B21, B59, B63-B65; m3-onboarding.md 2.3, 2.4 (G9).

Scope: two small rule changes in the guided zone (sections 2-3), one answer on the Deathblow prompt (section 4), measured in the sim (section 5), the levers not chosen (6), the change table (7), what each role builds (8) and the constant table (9). Nothing outside the guided first run changes: a normal run plays exactly as today (checked in 5.5).

---

## 1. What the guided zone plays today (measured, built engine 1b4ab69)

The guided zone is one fixed map (TUTORIAL_SEED 8736) whose node, fight and loot streams do not depend on the run seed, so a class that follows the guide plays the same zone 1 on every seed: read the zone 1 rows as three routes (one per class), not as a spread [source: changes-m3-v2.md 5.4; measured: all 300 runs of a class give the same zone 1 numbers]. The route, every class (sim/out/design-v3/trace.mjs, engine autoplay):

| Fight | Node (own level) | Player level at start | Enemy level | Lowest HP, Rogue / Mage / Hunter |
|---|---|---|---|---|
| S1 Furrow Boar | 1 (4) | 1 | 4 | 69 / 93 / 90 % |
| S2 Hedge Ogre | 6 (2) | 4 | 2 | 88 / 96 / 96 % |
| S3 Scarecrow Hexer + Furrow Boar (G8) | 16 (6, cap 5) | 5 | 5 | 84 / 88 / 84 % |
| Gorrak (G9), Deathblow answered | 18 (5; elite 6) | 7 | **6** (clamp(L, 4, 6)) | 50 / 82 / 80 % |
| Road (node 19) | - | leaves at **11** | - | - |

Why it is easy:
1. **Gorrak is below the player.** His level is clamp(L at entry, ONB_ELITE_LEVEL_MIN 4, ONB_ELITE_LEVEL_MAX 6), so a player who follows the guide meets him one level down (7 against 6) [source: src/engine/tutorial.js refreshOverlay]. Every other elite is ELITE_LEVEL_OFFSET (1) above its node [source: src/engine/expedition.js]. With the Deathblow answered (the prompt names the key, G9) the Mage and the Hunter never drop below 80 % and drink nothing.
2. **The bounty pays inside zone 1.** Gorrak's kill moves the player 7 -> 9 and his bounty (changes-m3-v2.md 1.4) 9 -> 11 on the same screen, while every script left in the zone is capped at level 5 (ONB_SCRIPT_LEVEL_MAX). A player who takes one more quest after him, as the newcomer did (s0129), fights level 5 enemies at level 10-11.
3. **Only a player who ignores the prompt is in danger, and even he wins.** The onebutton bot never answers the Deathblow: it lands every time and leaves the bot at 1.8 / 19.8 / 13.5 % HP, but he wins every time (0 rescues). The owner asked that one-button play fail in the special fights [stated: 20:57; B59 (d) asks for >= 25 % one-button deaths in zone 1 specials]; in the guided zone it fails 0 %.

## 2. Change 1: Gorrak one level above the player

**Rule.** In the guided zone, while his fight has not ended, Gorrak's level is

`eliteLevel = clamp(L + ELITE_LEVEL_OFFSET, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX)`, with **ONB_ELITE_LEVEL_MAX 6 -> 8** (ONB_ELITE_LEVEL_MIN stays 4, ELITE_LEVEL_OFFSET stays 1).

L is the player's level, read on every refresh of the overlay as today (the map shows the level he will play at). He is an elite one level above you, the same offset every other elite has over its node. The cap 8 keeps him a zone 1 enemy (below ring 3's 8-10 and inside Z1_DMG_MAX_LEVEL 10). On the route the player meets him at 7, so he plays at **8** (was 6). Nothing else of his changes: template, hpMult 1.1, dmgMult 0.95, Deathblow (Threshing Blow), the corridor, his gate, the rescue.

**Effect (5.3):** with the Deathblow answered, his fight leaves the Rogue at 34-37 % (below half, so G11's potion line now has its moment; the planner drinks there), the Mage at 63-65 %, the Hunter at 67 % (was 50 / 82 / 80 %). The answered Deathblow still wins every time (900 of 900 for each bot that reads the prompt; 0 rescues). The unanswered one now loses: the onebutton bot is rescued at his fight in every run (was 0), which is the one-button failure the owner asked for, with the guided rescue as its safety net.

## 3. Change 2: the bounty's XP is paid on the road, whatever happened at Gorrak

**Rule.** Gorrak's bounty (changes-m3-v2.md 1.4) is split:
- On his **victory** (his node's reward stage, as today): the gold `CULL_GOLD_V × V(CL_c)` and the choice of CONTRACT_REWARD_CHOICES items on table "Contract". Event `bounty { xp: 0, gold }`; line `guide.bountyLine` as today ("Gorrak's bounty: the Bellwrights pay for the Fieldbreaker.").
- On **arrival at zone 2's hub** (enterZone with z = 2, after the `zone` event, before the hub screen), once per run, on a guided lean first run (`s.tutorial`, `leanFirst(s)`, GATES.gorrakBounty): the XP `CULL_XP_FRAC × XP_WEIGHT_MULT × xpToNext(CL_c)` with CL_c of zone 1 (8), `flatXp` as today (no level-difference modifier; no heat, as at any hub). Paid **whether Gorrak was won, fled, rescued or never fought, and after a skip**. Event `bounty { xp, gold: 0, road: true }`, `xp` event `why: 'bounty'`; new line content `guide.bountyRoadLine` (draft): "The Bellwrights pay for the road you kept open: +{xp} XP."

No new constant. The amount is the same (8 176 XP on the route).

**Why the XP and not the rest.** The XP was never Gorrak's prize: it is the guided Cull's XP, which a first run lacks because it has no contracts, and it exists to keep the step into zone 2 inside B65 [source: changes-m3-v2.md 1.4, F2]. Paid on the road it does both jobs of D152 and two new ones:
1. **No out-levelling inside zone 1.** A player who stays after Gorrak fights at level 9-10, not 11 (route: S4 at player level 9 against level 5; was 11 against 5 for a human who stayed).
2. **Change 1 does not open a cliff.** With change 1 alone, a player who lost to Gorrak would reach zone 2 at level 7 (onebutton: B21 47.4 %, zone 2 step 0.0 -> 15.6 %). With the XP on the road he reaches it at 10, and every player who follows the guide at 11-12.
Gorrak's kill XP, his gold, his item choice and his own loot stay the prize for winning.

## 4. The Deathblow prompt: name the key only on the first meeting (answer: yes, per class)

Recommendation (UI only; owner review): **the turn prompt names the Deathblow's answer and its key only in the first Deathblow fight of each class on a profile. From the next one it says "Stop it."**

| Element of a Deathblow fight | First Deathblow fight of this class on the profile (the guided run: Gorrak, G9) | Every later Deathblow fight of this class |
|---|---|---|
| Turn prompt | as today: "Round 3: Threshing Blow, about 85. Sap now [W], then Pass [X]." | **"Round 3: Threshing Blow, about 85. Stop it."** (no answer, no key chip; also for "Keep {spell} for round N") |
| Crimson answer ring on the bar (hud.js) | as today | **not drawn** (it names the key a second time) |
| "No answer ready: kill it first or brace for it." | as today | as today (a fact the bar does not show, not the answer) |
| LETHAL tag, heal hint when lethal and nothing answers | as today | as today |
| Rogue's "Pass [X]. Attacking breaks Sap." while Sap holds | as today | as today (it follows an answer already given; it is a rule warning) |
| Hover tooltip on the track entry ("Stop it now: [W] Sap ...") | as today | as today: the place to look for a player who stops to think |
| Autoplay on: "Autoplay will answer the Deathblow with ..." | as today | as today |

- **Why per class:** each class answers with a different tool (Sap and Pass, Binding Glyph, Lay Trap); a player who starts his first Hunter after a Rogue run has never been told the Hunter's answer.
- **Storage:** the UI's hint store with the profile (`tbwcr.hints.v2` seen ids, m3-onboarding.md 3.1): new ids `DB.rogue`, `DB.mage`, `DB.hunter`, marked seen when that class's first Deathblow fight ends (won, fled, rescued or died). "Play the guide again" resets them with the other hints.
- **Why:** it is the owner's principle for rare fights [stated: 18:46], and it answers the newcomer's "nothing to work out" without taking the lesson away: Gorrak still names the key, the casual tester's "the game told me the one thing to press and it worked" happens once per class. Deathblows come only in elite, rare and dungeon-boss fights, so the grind is untouched.
- **Wind-ups:** "Wind-up now: stop it with [4] Rime Burst" stays. Wind-ups are ordinary fights (the grind) and G8's lesson; the tactician's remark on it is noted for the owner, not acted on here.
- **Not measurable in the sim:** the bots read the views, not the prompt. QA's blind panel checks it: the share of second and later Deathblows a casual persona answers in zones 2-3. Draft fallback, not to build now: if a blind casual lands two Deathblows in a row without finding the answer, the next prompt names the key once more.

## 5. Measure (D118)

### 5.1 Set-up
- **Engine:** origin/main 1b4ab69 (D152 built). Arms on scratch copies of src/ and sim/ under sim/out/design-v3/ (git-ignored; src/ untouched): `patch.py` gates the arms by an environment value `V3` read into a scratch constant (`el` Gorrak's level rule, `gd` a damage factor on Gorrak in the guided zone, `bz` the bounty's XP timing, `sc` the script cap), `mk.sh` / `mk2.sh` build the trees, `run.sh` the cells, `read.mjs` the reader, `trace.mjs` the route trace. The scratch recorder adds one field (`tg`: rescues, Gorrak's outcome, guide ended).
- **Cells:** expedition map with the start camp (`--map expedition --prep`), P0 (`--profile fresh`: a first run, so the lean first run of D152 applies), `--guided` (zone 1 on TUTORIAL_SEED 8736; zones 2-6 on the run seed), `--warmup 0`, the X0 tables (`--risk-in sim/out/pass-v9v10/obs-P0.json --tables-in sim/out/pass-v12/exp/table/planner-P0-exp-prep/risk.json`), seeds 1000-1299, **300 runs per class, 900 per cell**, all three classes on their default trees.
- **Bots:**
  - **planner** with the D152 guided harness (it takes the engine's autoplay action on the map while the Roads are closed and Gorrak is open; sim/lib/runner.mjs).
  - **onebutton** (the slot-1 spell only, never reads intents; the planner outside fights), same harness: the player who ignores the prompt.
  - **follower** (scratch harness, the human-like route): the engine's autoplay for **every** action while the guide is on in zone 1 (map, camp, fights: it goes where the coach line points and answers the Deathblow as the prompt says), then the planner. It approximates the blind newcomer (who followed the guide, answered Gorrak's Deathblow and left by a Road); it plays fights better than a new human, so its HP numbers are a ceiling.
- **Runs:** 18 guided cells of 900 (16 200 runs) and two normal planner cells of 300 (5.5); about 16 800 runs.
- **Definitions:** B21 runs dying in zones 1-2 (planner target <= 12 %; onebutton reported); B63 zone 1 mean lowest HP of won non-boss fights and the share below 50 % (band 60-68 % / >= 22 % is for normal runs; the guided cell is reported, no target); B64 (level leaving zone 1 - 1) / zone 1 fights; B65 deaths per fight, last 3 of zone 1 -> first 3 of zone 2 (first <= max(1.5 × last, 1.0 %); "!" a fail); level leaving zone 1 = at the Road (before change 2's XP); level at zone 2 = at its first fight. Gorrak's fight is found by its enemy (`z1_gorrak` in the recorder's composition).

### 5.2 Single levers (guided; zone 1 per class Rogue / Mage / Hunter)
| Arm | Follower: Gorrak lowest HP (answered) | Onebutton: Gorrak | Onebutton B21; B65 zone 2 step | Level leaving zone 1 / at zone 2 (follower) |
|---|---|---|---|---|
| base | 50 / 82 / 80 % | won 100 % (2 / 20 / 14 % HP) | 14.4 %; 0.0 -> 0.9 % | 11 / 11 |
| BZ: bounty XP at zone 2 after a victory only | 50 / 82 / 80 % | won 100 % | 13.8 %; 0.0 -> 0.7 % | 9 / 11 (plays S4 at 9 against 5) |
| GL: Gorrak clamp(L + 1, 4, 8) | 37 / 65 / 67 % | **rescued 100 %** | **47.4 %; 0.0 -> 15.6 % !** (reaches zone 2 at 7) | 11 / 11 |
| L7: Gorrak clamp(L, 4, 8) (at your level) | 33 (potion) / 79 / 72 % | rescued 100 % | 45.9 %; 0.0 -> 14.6 % ! | 11 / 11 |
| GD 1.3: Gorrak damage × 1.3 | 36 / 77 / 75 % | rescued 100 % | 45.9 %; 0.0 -> 14.6 % ! | - |
| GD 1.15 | - | Rogue and Hunter rescued, Mage wins at 10 % | 41.7 %; 0.0 -> 12.6 % ! | - |

Readings: the onebutton bot wins Gorrak by 2-20 % of its HP, so **any** lever that makes his fight harder turns every unanswered Deathblow into a rescue; the level lever buys the most care for the classes whose control already cancels him (Mage, Hunter: +15-17 pp HP lost against +4-5 pp for damage × 1.3). Alone, each Gorrak lever leaves a player who lost to him at level 7 for zone 2 (B65 fails), which is what change 2 repairs.

### 5.3 The package (change 1 + change 2 = arm GLB2) against base, guided cell
| Measure | Planner base | **Planner package** | Follower base | **Follower package** | Onebutton base | **Onebutton package** |
|---|---|---|---|---|---|---|
| Win | 28.1 % | 31.1 % | 28.9 % | 28.1 % | 0.0 % | 0.0 % |
| **B21** died in zones 1-2 (zone 1) | 1.2 % (0) | **1.0 %** (0) | 1.1 % (0) | **0.3 %** (0) | 14.4 % (0) | **29.0 %** (0) |
| **B63** zone 1 mean lowest HP, won fights; share < 50 % | 83.0 %; 0.0 % | **78.5 %; 7.1 %** | 83.3 %; 0.0 % | **79.9 %; 6.7 %** | 67.6 %; 25.0 % | 82.0 %; 7.7 % (Gorrak lost, not counted) |
| Gorrak lowest HP, Rogue / Mage / Hunter | 50 / 82 / 82 % | **34 / 63 / 67 %** | 50 / 82 / 80 % | **37 / 65 / 67 %** | 2 / 20 / 14 % (won) | rescued (every run) |
| Deathblow answered / landed (Gorrak) | 900 / 0 | 900 / 0 | 900 / 0 | 900 / 0 | 0 / 900 | lost |
| Zone 1 potions per run | 0.00 | 0.33 (Rogue 1.0) | 0.00 | 0.00 | 1.00 | 0.33 |
| Rescues per run; guide ended by rescues | 0; 0 % | 0; 0 % | 0; 0 % | 0; 0 % | 0; 0 % | 2.67; 66.7 % |
| Zone 1 fights per run | 4.0 | 4.7 | 4.0 | 5.0 | 4.0 | 4.3 |
| **Level leaving zone 1** (median) | 11 | **9** | 11 | **10** | 11 | 7 |
| Level at zone 2's first fight (median) | 11 | 11 | 11 | 12 | 11 | 10 |
| B64 levels per fight (no guided target) | 2.50 | 1.73 | 2.50 | 1.80 | 2.50 | 1.47 |
| Player level - top enemy level, last zone 1 fight | +1.0 | +2.3 | +1.0 | +4.0 (S4 at 9 against 5) | +1.0 | +1.0 |
| **B65** zone 2 step | 0.0 -> 0.1 % | **0.0 -> 0.0 %** | 0.0 -> 0.1 % | **0.0 -> 0.0 %** | 0.0 -> 0.9 % | **0.0 -> 4.9 % !** |
| B65 zone 3 step | 0.4 -> 0.3 % | 0.3 -> 0.2 % | 0.4 -> 0.4 % | 0.1 -> 0.1 % | 4.8 -> 3.3 % | 10.2 -> 5.4 % |

Onebutton by class, package: B21 Rogue 48.0 %, Mage 12.7 %, Hunter 26.3 % (base 21.3 / 6.0 / 16.0 %). For reference, the onebutton bot on a normal first run (P0, not guided) has B21 34.9 % [source: changes-m3-v2.md 5.3, column F].

A variant that pays the road XP up to at least level 11 (arm GLB3, max(Cull XP, XP to level 11)) brings the onebutton bot to zone 2 at 11 but does not lower its B21 (34.9 %): what it misses after a lost Gorrak is his item choice and gear, not levels. Rejected (a new constant for no gain).

### 5.4 Reading
1. **The guided zone asks for care where the owner wants it: in the rare fight.** Gorrak with the Deathblow answered now costs a third to two thirds of the player's HP (Rogue 34-37 %; Mage 63-65 %; Hunter 67 %), was a fifth for Mage and Hunter. The scripted fights S1-S3 are untouched, so G7 and G8 play as before; G9 is learned in every run of every bot that reads the prompt; the Rogue now falls below ONB_POTION_HP in Gorrak's fight, so G11 gets its moment on the guided route [inference: lowest HP 34-37 % < 50 %; the planner drinks there, autoplay does not].
2. **Ignoring the one instruction now loses the fight**: the onebutton bot is rescued at Gorrak in every run (base: won every run), matching B59's intent for zone 1 specials (>= 25 %, ONEBTN_Z1_MIN) and the owner's 20:57 line. The rescue catches it; the road XP sends it to zone 2 at 10 instead of 7.
3. **Planner targets hold on the guided cell:** B21 1.0 % (<= 12 %), B65 zone 2 0.0 -> 0.0 % (passes), win 31.1 % (+3.0 pp). The player leaves zone 1 at 9-10 (was 11) and reaches zone 2's first fight at 11-12 (was 11).
4. **Cost, for the Lead to sign off:** the guided onebutton cell gets worse: B21 14.4 -> 29.0 %, its zone 2 step fails (0.0 -> 4.9 %), and the guide ends by rescues in 2 of 3 classes (Rogue and Hunter: 3 rescues each; [inference] the bot walks back into Gorrak after each rescue, since his node stays unresolved). It ends below the unguided masher (B21 34.9 %), so the guide no longer carries a player who ignores its prompt further than a normal first run would. Default: accept (owner principle, 20:57). If the Lead does not accept it, drop change 1 and keep change 2 alone (arm BZ: onebutton 13.8 %, but no care added at Gorrak).
5. **Still open (not in this package):** a human who stays after Gorrak fights S4 at 9 against level 5 (was 10-11 against 5), because scripts stay capped at ONB_SCRIPT_LEVEL_MAX 5. The next lever, if the blind panel still reports it: scripts after S3 at their node's own level (ring 2: 4-7, ring 3: 8-10 on TUTORIAL_SEED). Not measured as a package here (the limit is two changes); on the route it touches no fight before Gorrak.
6. Not measured: human reading. The follower plays fights like autoplay (a ceiling for a newcomer); a newcomer who answers the Deathblow late or misses a control turn will sit between the follower and the onebutton bot. The next blind panel should report Gorrak's lowest HP and whether a potion or the ward was used.

### 5.5 Normal runs do not change
Both changes act only in a guided run (`s.tutorial`; Gorrak's level only in the guided overlay, the road XP only on a guided lean first run). Checked: planner P0, normal expedition with the camp (no `--guided`), seeds 1000-1099, 100 per class, base and package on the same scratch tree: 300 of 300 runs identical in fight records (`fx`), outcome, level and XP by zone and source (`xz`). That sample reads B1 21.0 %, B21 9.0 %, B63 66.5 % / 23.5 %, B65 zone 2 1.9 -> 0.8 %. The normal-run values of B1, B21, B63 and B65 therefore stay those of changes-m3-v2.md 5.3 column F (B1 24.2 %, B21 9.2 %, B63 65.6 % / 25.5 %, B65 zone 2 2.2 -> 0.6 %).

## 6. Levers weighed and not chosen
| Lever | Why not |
|---|---|
| Scripts and Gorrak "at the node's own level" | Gorrak's node is level 5, so his own elite level is 6, the same as today's cap for a player at 6 or more: no change on the route. The scripts' nodes on the route are 4, 2 and 6: only S3 moves (5 -> 6). Lifting the cap for S1 would put a level 1 player against level 6-7 enemies on a ring 2 node (rescue). See 5.4 item 5 for S4 and later |
| Gorrak's damage (GD 1.3, 1.15) | Moves the Rogue most (50 -> 36 %) and the Mage and Hunter little (82 -> 77 %, 80 -> 75 %): their control already holds him. Same onebutton cost as the level |
| Gorrak at the player's level (L7) | Less care for Mage and Hunter than one level up (79 / 72 % against 65 / 67 %) for the same onebutton cost |
| Bounty XP at zone 2 after a victory only (BZ) | Fixes the out-levelling but adds no care; with change 1 a lost Gorrak would send the player to zone 2 at level 7 |
| Road XP up to level 11 (GLB3) | No gain over change 2 (5.3) and a new constant |

## 7. Change table
| # | Rule or constant (section) | Old | New | Target | Expected effect, measured | Type |
|---|---|---|---|---|---|---|
| 1 | Gorrak's level in the guided zone (2) | clamp(L, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX), max 6 | clamp(L + ELITE_LEVEL_OFFSET, ONB_ELITE_LEVEL_MIN, ONB_ELITE_LEVEL_MAX), **ONB_ELITE_LEVEL_MAX 8** | B63 guided (reported), B59 (d) spirit, B21, B65 | route: Gorrak 6 -> 8 at player 7; answered: lowest HP 50 / 82 / 80 -> 34-37 / 63-65 / 67 %; onebutton: won 100 % -> rescued 100 % | rule + number |
| 2 | Gorrak's bounty XP (3) | on his victory, in zone 1 | on arrival at zone 2's hub, once, on a guided lean first run, whatever his outcome; gold and items stay on his victory | B65, level leaving zone 1 | level leaving zone 1 11 -> 9-10; at zone 2 11 -> 11-12; B65 zone 2 0.0 -> 0.0 % (planner); onebutton reaches zone 2 at 10 (7 without it) | rule + content line |
| 3 | Deathblow prompt after the first meeting (4) | names the answer and key every time | names it in the first Deathblow fight of each class on the profile, then "Stop it."; no answer ring | owner principle (18:46); blind panel | not measurable in the sim | UI |

## 8. What each role builds
### 8.1 Core Gameplay Engineer
- constants.js: ONB_ELITE_LEVEL_MAX 6 -> 8; switches `GATES.gorrakLevel` (change 1) and `GATES.bountyRoad` (change 2), both on; off plays D152.
- tutorial.js `refreshOverlay`: Gorrak's level per section 2 (import ELITE_LEVEL_OFFSET).
- contracts.js `bountyReward`: with `bountyRoad` on, gold and items only (event `bounty { xp: 0, gold }`); new `bountyRoadXp(s, ev)`: the XP of 1.4 with `why: 'bounty'`, event `bounty { xp, gold: 0, road: true }`.
- nodes.js `enterZone`: for z = 2, after the `zone` event, call `bountyRoadXp` once when `s.tutorial && leanFirst(s) && GATES.gorrakBounty && GATES.bountyRoad` and `s.tutorial.roadPaid` is not set; then set it.
- Specs in the same commit: m3-onboarding.md 2.3 (Elite and Gorrak's bounty rows) and 12; expedition.md where 1.4 is folded; rules.md 13; engine-api.md (the `bounty` event's `road`). Mark "(M3 v3)".
- Tests: the route test (every class, 20 seeds) still fights Gorrak at player level + 1 (8 on the route), wins with the Deathblow answered, leaves by a Road with 0 rescues, and gets the bounty XP at zone 2's hub (not in zone 1); a guided run rescued at Gorrak gets the XP at zone 2 and no gold or item; a normal first run gets no bounty XP; golden hashes of guided runs change (expected), normal runs do not.

### 8.2 UI/UX Engineer
- Section 4: `deathblowPrompt` (tracks.js) and the answer ring (hud.js) read a per-class "taught" flag from the hint store (`DB.<class>`); the flag is set when that class's first Deathblow fight ends. The tooltip, LETHAL, "No answer ready", the Sap wait line and the autoplay line stay.
- The `bounty` event with `road: true` as a log line or toast at zone 2's hub (content `guide.bountyRoadLine`), next to the D150 "The guide ends here" toast, not over it.

### 8.3 Content Designer
`guide.bountyRoadLine` (draft): "The Bellwrights pay for the road you kept open: +{xp} XP." `guide.bountyLine` unchanged (now said with gold and the item choice only). The prompt text "Stop it." is the UI's (D150 one word for answering a Deathblow: "stopped").

### 8.4 Simulation & Balance Engineer
- Guided reports gain "level at zone 2's first fight" next to "level leaving zone 1" (the bounty XP now falls in zone 2's `xz` row).
- Optional: the follower harness of 5.1 (autoplay for every action while the guide is on in zone 1) as a named guided policy, so later guided measures have a human-like route.

### 8.5 QA
- Blind panel (next run): Gorrak's lowest HP and potion or ward use for the newcomer persona; the share of second and later Deathblows answered by the casual persona after section 4 is built.

## 9. Constant table (new or changed)
| Constant | Value | Unit | Section |
|---|---|---|---|
| ONB_ELITE_LEVEL_MAX | 8 (was 6) | Gorrak's highest level in the guided zone | 2 |
| ONB_ELITE_LEVEL_MIN | 4 (unchanged) | Gorrak's lowest level | 2 |
| ELITE_LEVEL_OFFSET | 1 (unchanged; now also read by the guided overlay) | levels Gorrak plays above the player | 2 |
| GATES.gorrakLevel | true (new switch) | change 1 on | 2 |
| GATES.bountyRoad | true (new switch) | change 2 on | 3 |
| Hint ids `DB.rogue`, `DB.mage`, `DB.hunter` | seen / not seen (UI, profile hint store) | the class's first Deathblow fight has ended | 4 |
