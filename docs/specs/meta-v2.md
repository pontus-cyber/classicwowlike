# Meta progression v2 (M3): persistent characters, Peal, Undertakings, number scale

Owner: Lead Game Designer, 2026-11-11. Status: **draft, proposal for the owner**. Nothing here is built; rules.md and balance.md are not changed until the owner has reviewed it. Pitch, open choices and the build plan: docs/handoffs/designer-meta2-2026-11-11.md.
Audience: owner, Lead, Core Gameplay Engineer (src/), UI/UX Engineer, Simulation & Balance Engineer (sim/), Content Designer, lore chat.

Sources: owner idea [stated: docs/feedback/2026-11-11-1026-owner.md]; owner answers 10:31 and decision 10:34 relayed by the Lead (marked [stated: Lead relay 10:31] and [stated: Lead relay 10:34]); today's meta [source: docs/specs/rules.md 11; balance.md B2, B3, B10, B30-B32]; start camp and contracts [source: docs/specs/expedition.md 2, 8.2]; the Furnace and tolls [source: docs/specs/changes-m2b-v7.md]; lore frame [source: docs/lore/world.md 6]. Measurements are from a designer scratch prototype on the real engine (section 12).

Every number is a named constant in the table of section 14. Names shown to the player (Peal, Undertakings, titles) are drafts for owner review.

---

## 1. What the owner asked for, and the answer in one line each

| # | Request | Answer in this spec |
|---|---|---|
| 1 | You level up your specific class: create the character once and keep playing it [stated] | One persistent character per class (decided by the owner, 10:34 [stated: Lead relay 10:34]); it has a persistent level, **Peal** (section 3) |
| 2 | The talent tree is capped, so you must level it up [stated] | A talent cap per run that rises with Peal, from 10 of 26 points to all 26, plus 1 (section 4.1) |
| 3 | Some abilities capped [stated] | A spell rank cap that rises with Peal, from trained level 30 to no cap (section 4.2); two class techniques unlock on the Peal ladder (4.3) |
| 4 | Progression more linear; first runs very hard, you need a couple of runs [stated] | Measured: run 1 wins 1 %, runs 2-3 about 10 %; first win after a median of 6 runs (planner bot; a skilled player sooner) (section 11) |
| 5 | Echoes per run go up so unlocks come faster [stated] | Echo yield +3 % per Peal level (+42 % at Peal 15); deeper runs pay more as well. Measured: 250 Echoes in run 1, about 520 by run 20 |
| 6 | Noticeable upgrades early so players get hooked [stated] | Every first run ends at Peal 2 or higher (two levels in the median run); 9 of 10 characters gain a Peal level in each of runs 2 and 3; a first-run grant buys Packed Satchel at once (section 6) |
| 7 | Reduce overall damage numbers, ÷2 or ÷3, before they escalate [stated] | One engine scale NUM_SCALE; recommended ÷3; measured balance-neutral (section 9) |
| 8 | The Echo board stays account-wide, alongside the characters [stated] | Kept; class-specific entries move to the character; nothing is bought twice (section 5) |
| 9 | A lost run only gives less; it never takes anything away [stated: Lead relay 10:31] | Death keeps all Peal XP and Echoes earned in the run; nothing is ever lost (3.4) |
| 10 | Account-wide quests chosen before a run, with bigger rewards after [stated: Lead relay 10:31] | **Undertakings** (section 7), distinct from contracts |
| 11 | First win hard but not that hard; propose a target [stated: Lead relay 10:31] | Runs to first win: median 4-7 for the planner bot (section 11, M1) |
| 12 | Onboarding: first Echoes and a tutorial nudge to buy the potion upgrade at once [stated: Lead relay 10:31] | Section 6 |
| 13 | Trying a different build on the same character must be cheap [stated: Lead relay 10:34] | Builds are chosen fresh every run (free by construction); saved build plans; respec rules in 3.5 |

---

## 2. Two layers, no double-dipping

| Layer | Scope | Grows by | Buys or unlocks | Never gives |
|---|---|---|---|---|
| **Character** (Peal) | one class | Peal XP from every run of that character (3.3) | talent cap, spell rank cap, class techniques, class pet, the extra talent point, titles and looks, build plan slots | economy, map information, items in drop pools, start kit, resurrects, account Echo income |
| **Account** (Echo board, Undertakings, Oaths) | every class | Echoes from every run of every character | stat ranks, start kit, economy, map and vision, unique items, Second Breath, Oaths, Undertaking slot | talent points, spell ranks, class spells, class pets |

Rules:
- **One source per power.** Every combat-power effect lives on exactly one layer. The board sells nothing class-specific; the Peal ladder sells nothing account-wide.
- **The character restores, it never exceeds.** At full Peal a character has exactly today's uncapped kit plus the three entries that move from the board (5.2). So a full Peal plus a full board equals today's full catalogue (PALL), whose planner win rate is already capped by B3 (55-75 %). Long-term play cannot go above the PALL power that is measured and tuned today; Oaths stay the challenge layer for experienced profiles (rules 11.5).
- **One link only.** The Peal level raises the character's Echo yield (income, not power; 6.3). It is the owner's "Echoes per run go up" [stated]. It speeds up the board, and the runs-to-full-board target (M4) accounts for it.

---

## 3. Characters

### 3.1 Roster (decided: one per class)
- The profile holds at most one character per class: Rogue, Mage, Hunter (CHAR_PER_CLASS 1) [stated: Lead relay 10:34]. Reason recorded by the owner: it protects the player's invested time; trying other play styles stays cheap through new runs and builds.
- A character is created once: class, name, look (cosmetic, 3.6). It is never deleted by play. A "retire and start over" button (resets that character to Peal 1, keeps the account) is a menu option behind a confirmation, for players who want the climb again (owner review: default on).
- The title screen shows three character cards (empty slot: "Create"), each with Peal, Peal XP bar, runs, wins, best result and title.

### 3.2 A run with a persistent character
- `Set out` starts a run with the chosen character: in-run level 1, 0 XP, starting gear, START_GOLD, spells of level 1, no talents spent, as today (rules 1.2). The roguelike run is unchanged: level 1-60 through the zones, then the boss.
- The character's Peal sets the run's caps (section 4) and unlocks (4.3); the account board applies as today (rules 11.4).
- Hunter: the pet is chosen at `Set out` from the character's pets (Ridgewolf, Thornback Boar, Duskcat; Stormhawk from Peal STORMHAWK_PEAL).

### 3.3 Peal XP
- Each run, the character gains **Peal XP equal to the run's Echoes before the Peal yield and the Oath multiplier** (rules 11.1 lines plus the Undertaking reward, 7.4). One number for the player: "+212 Echoes, +212 Peal".
- Peal levels 1..PEAL_MAX (15). Cumulative Peal XP needed: table PEAL_XP (section 14). Peal 2 needs only 20 XP, and the first run of a character always ends at Peal 2 or higher (PEAL_FIRST_RUN_MIN), so every first run ends with a level-up. (Prototype: 6 of 90 first runs died early with fewer than 20 Echoes; the rule covers them.)
- Peal XP and levels are never lost.

### 3.4 Death and the run [stated: Lead relay 10:31]
- A run ends on death exactly as today (rules 9). The character survives. The run pays Peal XP and Echoes for how far it got (rules 11.1 lines scale with progress), and any Undertaking completed before the death (7.4).
- Nothing persistent is taken away by a lost run: no Peal XP loss, no durability, no gear loss beyond the run's own gear, no Echo cost to retry.
- Fiction (for the lore chat): the Homeward Bell rings when its bearer falls and carries the Wayfarer back to the muster yard, alive; the run's gear and gold are left on the road. This **changes docs/lore/world.md 6**, which says each Wayfarer is a new person; the lore chat owns that change (section 13).

### 3.5 Builds and respec [stated: Lead relay 10:34]
- Talents, spells and the action bar are chosen inside every run, from level 10 on, as today. A new run is a free respec by construction: nothing of the last run's build carries over.
- **Build plans** (UI, no rule change): each character stores up to PLAN_SLOTS saved talent plans and one bar layout per plan. At `Set out` the player may pick a plan; points are then spent automatically in the plan's order as levels come, within the talent cap, and the player can deviate at any time. Plans are free to edit between runs. A plan that wants more points than the cap shows the excess points greyed with "Peal n unlocks this".
- In-run respec at a trainer keeps its price (RESPEC_V × V(L), rules 6) because it is a run decision. Change: the **first respec of each run is free** (RESPEC_FREE_FIRST), so trying a different tree when the run turns is cheap. [assumption: small power effect; measure with the planner, which does not respec today]

### 3.6 Cosmetics and records
- Titles at Peal 5, 10 and 15 and for Hard Undertakings (7.3); shown on the character card and the run summary. Draft titles (owner review): Peal 5 "Roadworn", Peal 10 "Bell-carried", Peal 15 "of the Long Road".
- Looks: a cloak colour and a bell charm per Peal 5 / 10 / 15; drawn in code by the UI (no new art pipeline).
- Records per character: runs, wins, best zone and row, fastest win (tolls and estimated minutes), bosses killed, deaths by zone. No gameplay effect.
- Gear is **not** kept (option O4 in the hand-off argues the alternatives). Reason: gear is the run's main source of variance and decisions (drops, rewards, vendors), and keeping it would add power outside the budget of section 2 and shorten the 45-minute arc.

---

## 4. The Peal ladder

### 4.1 Talent cap
- `talentCap(peal)` = PEAL_LADDER[peal].talents. Talent points earned in a run (rules 6) are `min(level points, talentCap) + meta points at 60`; the extra point at level 60 (Ancestral Insight, moved to the character) comes at Peal PEAL_INSIGHT. Points over the cap are shown as locked pips in the talent window: "Peal n unlocks 2 more points".
- Tier gates are unchanged (TALENT_TIER_GATE 4; the capstone needs 16 points in its tree, so it needs a cap of at least 17). The ladder reaches 17 at Peal 5: **"Capstone unlocked"** is one of the milestone screens.

### 4.2 Spell rank cap
- `rankCap(peal)` = PEAL_LADDER[peal].rank (a trained level). Training (rules 5.2) raises a spell's tl to `min(L, rankCap)`; learning sets `tl = min(L, rankCap)`; talent spells use `min(L, rankCap)` instead of L. A spell whose tl already equals `min(L, rankCap)` is not trainable (the trainer shows "at your rank cap", no gold is spent).
- Basic attacks (Strike, Spark, Auto Shot) and pet damage use L as today: the cap is on spells only.
- Rank cap 60 means no cap (every value of L in 1..60 passes).
- Why a rank cap and not locked spells: locking each class's two top spells measured 0.0 % wins for the Mage (it lives on Pyre Comet and Starlance Barrage) but 28.5 % for the Rogue (33.0 % uncapped) [source: scratch cell `lock`, 200 runs per class]. A rank cap weakens every class in steps (rank cap 30: Rogue 16.5, Mage 10.0, Hunter 18.5 %).

### 4.3 Ladder (default)

| Peal | Talent cap | Rank cap | Unlock | Peal XP (cumulative) |
|---|---|---|---|---|
| 1 | 10 | 30 | - | 0 |
| 2 | 12 | 32 | **Technique I** (Ghostblade Rush / Chrono Sigil / Ricochet Bolt learnable) | 20 |
| 3 | 14 | 34 | - | 180 |
| 4 | 16 | 36 | build plan slot 2 | 380 |
| 5 | 17 | 38 | **capstone reachable**; title "Roadworn"; look | 600 |
| 6 | 18 | 41 | - | 850 |
| 7 | 19 | 44 | - | 1 150 |
| 8 | 20 | 46 | build plan slot 3; Hunter: **Stormhawk** pet | 1 500 |
| 9 | 21 | 48 | - | 1 900 |
| 10 | 22 | 50 | **Technique II** (Bloodprice Gambit / Mirrorshade / Beastcall Horn learnable); title "Bell-carried"; look | 2 350 |
| 11 | 23 | 52 | - | 2 850 |
| 12 | 24 | 54 | - | 3 400 |
| 13 | 25 | 56 | - | 4 000 |
| 14 | 26 | 58 | - | 4 650 |
| 15 | 26 (+1 at level 60) | 60 (none) | **Ancestral Insight** (+1 talent point at 60); title "of the Long Road"; look | 5 350 |

Every level gives something visible: a talent point or two, a rank cap step, and on the milestone levels a new spell, the capstone, a pet or a title. The steps are largest at Peals 2-5 (2 points and 2 rank levels each, plus Technique I and the capstone), which is the hook.

### 4.4 Power by Peal (measured, fixed caps, fresh board)
Planner bot, P0 board, rows map, 150-200 runs per class, seeds 1000 onward (designer scratch, section 12). Reach = runs that reach the end boss.

| Caps (talents, rank) | Nearest Peal | Rogue | Mage | Hunter | All | Reach (all) |
|---|---|---|---|---|---|---|
| 10, 30 | 1 | 2.0 % | 0.7 % | 0.0 % | 0.9 % | 75 % |
| 13, 34 | 2-3 | 9.3 % | 0.0 % | 0.0 % | 3.1 % | 75 % |
| 16, 38 | 4-5 | 14.7 % | 2.7 % | 0.7 % | 6.0 % | 76 % |
| 17, 40 | 5-6 | 16.7 % | 5.3 % | 4.0 % | 8.7 % | 78 % |
| 20, 46 | 8 | 22.0 % | 12.0 % | 10.0 % | 14.7 % | 78 % |
| 23, 52 | 11 | 22.7 % | 20.7 % | 20.7 % | 21.3 % | 78 % |
| none (today) | 15 | 33.0 % | 28.0 % | 38.5 % | 33.2 % | 78 % |

Single levers (same method): talent cap 0 / 6 / 11 / 16 / 21: 0.0 / 1.5 / 6.3 / 13.2 / 21.2 %; rank cap 30 / 40 / 50: 15.0 / 21.3 / 26.3 %.

What this shows:
- The caps bite at the **end boss**, not in the zones: reach stays at 75-78 % at every cap (talent cap 0 is the exception, 57 %). A capped character still plays a full run and learns the road; Oruvath is the wall. [inference: talents and late spell ranks matter most in the 30-45-round boss fight]
- Class spread is wide under the capstone: the Hunter's default tree (Marksmanship) puts its power in the capstone (talent cap 16: Hunter 3.0 %, Rogue 19.0 %); the Mage is the most rank-sensitive (rank cap 50: Mage 17.0 % against 28.0 % uncapped). The campaign (section 11) shows that the spread closes by Peal 8-10; per-class ladders are the tuning lever if M5 fails (section 11).

---

## 5. The Echo board v2 (account)

### 5.1 Kept on the board
Vigor of the Line, Edge of the Line, Keen Lineage, Quick Study, Prospector, Packed Satchel, Heirloom Blade, Deeper Pockets, Trainer's Ledger, Scout's Eye (Pathfinder in the expedition, expedition.md 8.2), Swift Boots, Alchemist's Notes, Cache of the Wanderer, Relics of the Deep, Second Breath, Oaths; and the expedition entries when that map ships (Cartographer, Old Hand, Quartermaster). New: **Bellwright's Ledger** (one more Undertaking slot, 7.2).

### 5.2 Moved to the character (no longer sold for Echoes)
| Entry | Was | Now |
|---|---|---|
| Lost Technique I (per class) | 150 Echoes each | Peal PEAL_TECH1 |
| Lost Technique II (per class) | 300 Echoes each | Peal PEAL_TECH2 |
| Stormhawk Companion | 250 Echoes | Hunter, Peal STORMHAWK_PEAL |
| Ancestral Insight (+1 talent point at 60) | 500 Echoes | Peal PEAL_INSIGHT |

A saved profile that owns any of them gets its Echoes refunded (migration, 10.4).

### 5.3 Prices
The board is smaller (4 460 Echoes of today's 6 560 stay) and income is higher (yield, first-run grant, Undertakings), so prices rise × BOARD_PRICE_MULT 1.5, rounded to 10, **except Packed Satchel, which stays at 60** (the onboarding purchase, section 6). Full price list in section 14 (BOARD_COST). Board total: **6 710 Echoes** (expedition entries extra). Measured: the first character fills the board after a median of 18 runs, the same run in which it reaches Peal 15 (section 11).

---

## 6. Onboarding and Echo income

### 6.1 First run [stated: Lead relay 10:31]
1. The first run of a profile is played with a fresh character at Peal 1. It is expected to end in a death (1 % of planner runs win).
2. The summary pays the run's Echoes plus **the Bellwrights' welcome**, ECHO_FIRST_RUN 60 Echoes, once per profile. Every first run can therefore afford Packed Satchel (60) (measured: 100 % of 90 campaigns; median run-1 income 250 with the grant).
3. The summary shows the Peal level-up first ("Peal 2: +2 talent points next run, rank cap 32, new technique: Chrono Sigil") and then opens the Echo board with **Packed Satchel highlighted** and a one-line tutorial: "Buy Packed Satchel: start every run with 3 Healing Draughts, and the first potion in each fight costs no turn." The `Set out` button stays disabled until the player buys it or closes the tip ("Later").
4. Run 2 starts with three potions and a visibly stronger character. Measured win rate run 2: 8 % (run 1: 1 %).

### 6.2 Summary screen order (every run)
Outcome and death line → Peal XP bar filling, level-ups with their unlocks → Undertaking result → Echo lines (rules 11.1), with "Peal yield +n %" and Undertaking reward as lines → buttons: Echo board, Set out again.

### 6.3 Echo yield
`echoes = round((base + undertaking) × (1 + ECHO_YIELD_PER_PEAL × (peal - 1)) × oathMult) + firstRunGrant`, where base is the sum of the rules 11.1 lines and `peal` is the character's Peal at `Set out`. ECHO_YIELD_PER_PEAL 0.03 gives +42 % at Peal 15. Measured mean Echoes per run (all income, pooled classes): run 1 250, run 5 334, run 10 392, run 15 439, run 20 509, run 25 524.

---

## 7. Undertakings (account-wide quests) [stated: Lead relay 10:31]

### 7.1 What they are
An Undertaking is a challenge the player takes before a run, with an objective about **how** the run is played and a reward paid after the run (Echoes, and on Hard ones a title). Name draft: Undertakings (owner review; "contracts" stays the expedition's in-run quest).

### 7.2 Rules
- From the profile's second run (UNDERTAKING_FROM_RUN 2), the start screen shows UNDERTAKING_OFFERS 3 Undertakings drawn from the pool for the chosen class (stream hash(profileSeed, "und", profile.runs)); the player takes at most UNDERTAKING_SLOTS (1; 2 with Bellwright's Ledger) or none. Taking one is free.
- The engine tracks the objective during the run; the run summary marks it complete or not. Completion pays at SUMMARY, also on a death if the objective was met before it.
- A failed Undertaking costs nothing [stated: a lost run never takes anything away]; offers not taken are redrawn next run; a Hard Undertaking, once completed, leaves the pool (its title is kept).
- Undertakings never change the run's rules, power, map or loot. They only add a goal.

### 7.3 Pool (draft, 12 entries; Content writes the text)
| id | Tier | Objective (engine check) | Reward |
|---|---|---|---|
| u_infernal_dungeon | Hard | Defeat the first dungeon boss of the run in a node entered Infernal (`scorched`, rules 1.7.3) [stated: owner's example] | UND_REWARD_HARD + title |
| u_calm_road | Hard | Reach the Camp without entering any node Smouldering or hotter | UND_REWARD_HARD + title |
| u_dry_satchel | Medium | Reach zone 4 without drinking a potion | UND_REWARD_MEDIUM |
| u_elite_tally | Medium | Kill 4 elites in one run | UND_REWARD_MEDIUM |
| u_two_dungeons | Medium | Clear 2 dungeons | UND_REWARD_MEDIUM |
| u_rare_hunter | Medium | Kill 2 rare elites | UND_REWARD_MEDIUM |
| u_burning_three | Medium | Win 3 fights in nodes entered Burning or Infernal | UND_REWARD_MEDIUM |
| u_lean_purse | Medium | Reach the boss without buying from a vendor | UND_REWARD_MEDIUM |
| u_silencer | Easy | Interrupt 5 enemy casts | UND_REWARD_EASY |
| u_quest_road | Easy | Complete 12 quests | UND_REWARD_EASY |
| u_litany | Hard | In the end-boss fight, stop every Collapse Litany before it resolves and reach phase 3 | UND_REWARD_HARD + title |
| u_star | Hard (offered after the first boss kill) | Defeat Oruvath with no resurrect used | UND_REWARD_HARD + title |

Class-specific variants (e.g. "win a fight from Sap", "a kill by Thousand Cuts") are Content's to add; the pool per class must keep at least 6 Easy-or-Medium entries.

### 7.4 Rewards and income
UND_REWARD_EASY 40, UND_REWARD_MEDIUM 80, UND_REWARD_HARD 150 Echoes. The reward is part of the run's Echo base, so it also counts as Peal XP and gets the Peal yield (6.3). Budget: Undertakings should be at most UND_ECHO_SHARE_MAX 20 % of a profile's Echo income over its first 30 runs (target M7). The prototype modelled them as +50 Echoes in every run from run 2 that reaches the boss (12.3), 11 % of its income; the real completion rates are a sim task.

### 7.5 Undertakings and contracts (no duplication)
| | Contracts (expedition.md 2) | Undertakings |
|---|---|---|
| Scope | one run | account |
| Chosen | start camp, for preparation points | start camp, free, own panel |
| Objective | **where**: sites in a region (kill the boars in the Barley Reach) | **how**: Furnace states, restraint, mastery, boss mechanics |
| Reward | in-run: items, XP, gold, story reward | after the run: Echoes, Peal XP, titles |
| Fails | expires in the run | nothing lost, offered again later |

No Undertaking names a region, site or contract, and no contract pays Echoes beyond its existing Echo line (expedition.md 8.1). They can help each other (a dungeon contract makes "Clear 2 dungeons" likelier), which is intended. In today's rows map (no start camp) Undertakings are taken on the character card before `Set out`.

---

## 8. What a player sees per run (example, measured medians)
| Run | Peal at start | Talent cap / rank cap | New this run | Win rate (planner) |
|---|---|---|---|---|
| 1 | 1 | 10 / 30 | - | 1 % |
| 2 | 3 | 14 / 34 | Technique I; board: Packed Satchel, Vigor 1 | 8 % |
| 3 | 4 | 16 / 36 | build plan 2; board: Edge 1 and two more ranks | 12 % |
| 4 | 5 | 17 / 38 | capstone, title | 13 % |
| 5 | 6 | 18 / 41 | more board ranks | 26 % |
| 10 | 10 | 22 / 50 | Technique II | 32 % (runs 6-10) |
| 15 | 13 | 25 / 56 | | 48 % (runs 11-15) |
| 20 | 15 | all | Ancestral Insight; board nearly full | 65 % (runs 16-20) |

---

## 9. Number scale [stated: ÷2 or ÷3]

### 9.1 Rule
One constant **NUM_SCALE** multiplies every hit-point quantity and every amount of damage, healing and absorb, before that amount is rounded:
1. every max HP: player (rules 4.2), enemies (12.2), the end boss and its Shards (10.1); the pet's HP follows the player's;
2. every damage amount at pipeline step 1 (rules 7.2), which also covers DoT ticks, intent estimates and the DoT preview (all use the same snapshot), the Brand tick and Final Dark;
3. every flat heal and ward formula (Arcane Ward, Mend Companion and the like);
4. Mindguard's mana price per damage ÷ NUM_SCALE (2 → 6 at ÷3), because mana is not scaled.

Not scaled: every percentage of max HP (potions, rations, Rest, post-fight regen, Heat Haze, enemy heals and shields, treasure traps), mana, energy, focus, armor (mitigation is a ratio), XP, gold, Echoes. MIN_HIT_DAMAGE stays 1. Phase 2 (optional, later): fold the factor into the tables so every constant shows the number the player sees, then NUM_SCALE = 1.

### 9.2 Measured (planner P0, 200 runs per class, paired seeds)
| Scale | Win | Paired difference (95 %) | Reach | Z1-Z2 deaths (share of runs) | Rounds per run | End-boss rounds (wins, median) |
|---|---|---|---|---|---|---|
| 1 (today) | 33.2 % | - | 77.7 % | 19.0 % | 293 | 37 |
| ÷2 | 33.5 % | +0.3 pp (± 2.6) | 76.8 % | 19.3 % | 290 | 37 |
| ÷3 | 34.8 % | +1.7 pp (± 2.6) | 78.8 % | 18.7 % | 295 | 37 |

Both are balance-neutral within the measurement; 90 % of runs end the same way, the rest move both ways through rounding.

### 9.3 What it looks like, and what rounds badly
| Value (today) | Today | ÷2 | ÷3 |
|---|---|---|---|
| Enemy hit, normal, level 1 | 6.6 | 3 (-9 %) | 2 (-9 %) |
| Enemy hit, level 5 / 10 / 60 | 17 / 30 / 160 | 9 / 15 / 80 | 6 / 10 / 53 |
| Enemy HP, level 1 / 60 | 32 / 740 | 16 / 370 | 11 / 247 |
| Mage / Rogue HP, level 1 | 130 / 200 | 65 / 100 | 43 / 67 |
| Rogue HP, level 60, no gear | 2 265 | 1 133 | 755 |
| Spark, level 1 | 10.3 | 5 (-3 %) | 3 (-13 %) |
| Ember Bolt, tl 1 | 32.6 | 16 | 11 |
| Barbed Arrow tick, tl 1 | 5.7 | 3 (+5 %) | 2 (+5 %) |
| Toxic Coating, 1 stack, rank 1, level 10 | 3.5 | 2 (+14 %) | 1 (-14 %) |
| Open Vein tick, 1 CP, tl 10 | 10.3 | 5 (-3 %) | 3 (-13 %) |
| Brand tick, 1 stack | 41 | 21 | 14 |
| Collapse Litany | 995 | 498 | 332 |
| End boss HP | 13 066 | 6 533 | 4 355 |

Rounds badly (÷3 more than ÷2):
- **Small DoT ticks** (Toxic Coating at low rank, Barbed Arrow and Open Vein early, small Ignites): errors up to ±14 % per tick at ÷3. Fix (default on): **tick remainder carry** (DOT_CARRY): each DoT/HoT keeps the unrounded part of its tick and adds it to the next tick, so the total over its duration matches the unrounded total within 1. The DoT preview uses the same carried values.
- **Level 1-5 hits**: the ±10 % variance disappears (2.2 × 0.9-1.1 always rounds to 2), so zone-1 hits repeat the same number. This reads cleanly for planning; it is not a balance change (measured above).
- **MIN_HIT_DAMAGE 1**: a 1-damage hit is a larger share of an 11-HP level-1 enemy. No measured effect.
- **Mindguard** (mana not scaled): its rate must move with the scale (9.1 point 4), or it becomes 3 × cheaper.
- **Text**: tooltips must show computed values, never formula constants; QA goldens with HP numbers all change.

Recommendation: **÷3** (NUM_SCALE 1/3, stored as the exact fraction): level-60 numbers stay in the hundreds (boss 4 355 HP, hits 50-250), close to the board-game scale of the turn-based games the owner cites; ÷2 is the fallback if zone 1 feels flat in play.

---

## 10. Engine and data (for the Core Gameplay Engineer)

### 10.1 Profile v2
```
profile = { v: 2, echoes, earned, spent, unlocks, reachedBoss, bossKills, firstKill, runs, welcomed,
            characters: { rogue|mage|hunter: { name, look, peal, pealXp, runs, wins, best, titles: [], plans: [], created } },
            undertakings: { done: [ids], offers: [ids] } }
```
- `createCharacter(profile, classId, name, look)`, `retireCharacter(profile, classId)`.
- `pealOf(xp)`, `pealView(profile, classId)`: level, XP to next, caps, next unlock.
- `undertakingOffers(profile, classId)`, `TAKE_UNDERTAKING(id)` at CREATE/PREP.
- `newRun({ profile, classId, ... })` reads the character: `s.meta.talentCap`, `s.meta.rankCap`, `s.meta.spells` (techniques by Peal), `s.meta.stormhawk`, `s.meta.talentPoints` (Insight at Peal 15), `s.meta.peal`, `s.undertaking`.
- `talentPointsEarned`: `min(level points, talentCap) + meta points at 60 + dev points` (rules 6).
- Training, learning and talent spells as 4.2.
- `echoes(facts, profile)`: new lines `undertaking`, `pealYield`, `welcome` (6.3).
- `applyRunToProfile`: adds Peal XP to the character (3.3), runs/wins/best, Undertaking done, `welcomed`.
- Summary: `peal { before, after, xp, unlocks: [] }`, `undertaking { id, done, reward }`.

### 10.2 Undertaking checks
Each objective is a small predicate over run stats the engine already keeps or must add: node entry states (heat stats, rules 1.7.4), dungeons and boss kills per node with its entry state, potions used by zone, elites and rares killed, interrupts landed (new counter), vendor buys (vendorTx), quests, Litany outcomes in the boss fight (new), resurrects used. No new random draws; streams unchanged except the profile stream for offers.

### 10.3 Number scale
NUM_SCALE as 9.1, applied at the six points listed (max HP of player, enemy, boss, Shard; the snapshot; the Brand tick; flat heals and wards; Mindguard). DOT_CARRY: a `carry` field on each periodic status.

### 10.4 Migration
A v1 profile becomes v2: board ranks kept; Echoes of moved entries refunded (sp_*, stormhawk, talent_pt at today's prices); no characters (the player creates them); `welcomed` = true if `runs > 0` (no grant); board prices change to section 14 for future ranks only.

---

## 11. Targets (proposed; replace B31 and B32, extend B2, B3, B10, B30)

Campaign v2: a fresh profile, one character, the planner bot, the default tree of the P0 group, buys the board in the standard order (without the moved entries) after every run, takes an Undertaking from run 2; CAMPAIGN_V2_RUNS runs; N_CAMPAIGNS_V2 per class.

| ID | Metric | Target | Measured (prototype, ladder default, 30 campaigns per class) |
|---|---|---|---|
| M1 | Curve (replaces B32) | win rate run 1 <= WR_RUN1_MAX 5 %; runs 2-3 <= WR_RUN23_MAX 15 %; runs to first win median RUNS_FIRST_WIN 4-7, p90 <= RUNS_FIRST_WIN_P90 12; runs 6-10 WR_RUNS_6_10 20-40 %; runs 11-15 WR_RUNS_11_15 35-55 %; runs 21-30 WR_RUNS_21_30_V2 55-75 %; blocks of 5 non-decreasing within CURVE_DIP_PP | run 1 1 %; runs 2-3 10 %; first win median 6 (p10 3, p90 10); 6-10 32 %; 11-15 48 %; 21-30 67 %; blocks 12 → 32 → 48 → 65 → 68 → 66 % (one dip of 2 pp) |
| M2 | Hook | run 1 ends at Peal >= 2 in 100 % (rule); share of campaigns gaining >= 1 Peal level in each of runs 2 and 3 >= HOOK_SHARE_MIN 0.90; run 1 affords Packed Satchel in 100 % | run 1 93 % without the rule; runs 2 / 3: 90 / 97 %; 100 % |
| M3 | Echo income rises | mean Echoes of runs 11-20 >= ECHO_RISE_MIN 1.4 × runs 1-3 | 1.64 × (459 against 279) |
| M4 | Pace (replaces B31) | runs to Peal 15, median PEAL_MAX_RUNS 16-24; runs to full board (first character), median BOARD_RUNS_V2 16-26; no campaign under BOARD_RUNS_MIN_V2 12 | 18; 18 |
| M5 | Class spread on the climb | runs to first win, per-class median within ±CLASS_FIRST_WIN_SPREAD 2 of the pooled median; runs 11-15 per class within ±CLASS_BAND_PP | 5 / 6 / 7 (pooled 6): pass; runs 11-15 37 / 55 / 51 % (pooled 48): Rogue -11 pp and Mage +7 pp fail the ±5 pp band |
| M6 | Power budget (extends B10) | (a) Peal 15 + full board reproduces today's PALL cell run for run; (b) character gap: planner at Peal 15 minus Peal 1, P0 board, CHAR_GAP 25-40 pp; (c) B10 unchanged at Peal 15 | (a) by construction, to verify in the engine; (b) 33.2 - 0.9 = 32.3 pp; (c) unchanged |
| M7 | Undertakings | completion per offered Undertaking 25-65 % per tier mix (UND_COMPLETE band); Undertaking Echoes <= UND_ECHO_SHARE_MAX of income over runs 1-30 | not measured; the proxy was 11 % of income |
| N1 | Number scale neutral | planner P0 win rate, paired, within ±NUM_SCALE_TOL 3 pp of NUM_SCALE 1; Z1-Z2 deaths within ±2 pp; B16 bands hold | ÷3: +1.7 pp (± 2.6); deaths -0.3 pp; boss 37 rounds |

B1-B9 and B11-B29 keep their definitions and are measured at **Peal 15** (equal to today's uncapped kit), so today's tuning work carries over. B2 (P10) and B3 (PALL) stay as fixed-profile cells at Peal 15. B30 (Echoes per run) is replaced by M3 plus the new income lines.

Expected human curve: a skilled manual player wins 8-25 pp more than the planner at full power (B5 MANUAL_GAP), so the first win should come around runs 4-5 [inference: from B5, not measured on capped characters; the tactician bot is too slow to run 2 700-run campaigns here].

---

## 12. Prototype (how the numbers above were made)

### 12.1 Setup
A `git clone --shared` of main 5e2a5e8 in the git-ignored sim/out/meta2/eng, engine switches through `globalThis.__M2` set from an environment variable or the campaign script: `tcap` (talent cap in `talentPointsEarned`), `tlcap` (spell tl cap in `spellTl`, talent spells included), `lock` (spells removed from `trainerSpells`), `k` (NUM_SCALE at the points of 9.1). Planner bot (PLANNER_TIME_MULT 3), rows map, risk table from the M2b v6 designer warm-up (sim/out/v6/risk-warm-P0.json in the wt-design worktree's scratch, frozen), 1 worker. Fixed-cap cells: `sim/run.mjs`, 150-200 runs per class, seeds 1000 onward. Campaigns: `sim/m2campaign.mjs` (new scratch script), 30 campaigns × 30 runs per class, seeds 7 000 000 + 1000 c + k.

### 12.2 Ladders tried (campaign, pooled classes)
| Ladder | Change | Run 1 | Runs 2-3 | First win (median, p10-p90) | 6-10 | 11-15 | 21-25 | Peal 15 / full board (runs) |
|---|---|---|---|---|---|---|---|---|
| v1 (20 campaigns, 25 runs) | caps 10/30 → 13/34 → 16/38 → 17/40 (Peals 1-4), faster XP; Technique I at 5; yield 0.05; board prices × 1 | 2 % | 20 % | 4 (2-10) | 42 % | 55 % | 68 % | 19 / 12 |
| v2 (20 × 30) | the default caps; slower XP (200, 450, 750, ...); Technique I at 2; yield 0.03 | 2 % | 11 % | 7 (2-11) | 31 % | 48 % | 67 % | 21 / 13; hook run 3 only 58 % |
| **v3 = default** (30 × 30) | v2 caps; XP 20, 180, 380, 600, 850 ...; board prices × 1.5 except Packed Satchel | 1 % | 10 % | 6 (3-10) | 32 % | 48 % | 68 % | 18 / 18 |

Per class (v3): runs to first win Rogue 5 (2-9), Mage 6 (3-9), Hunter 7 (4-10); runs 1 / 2 / 3 Rogue 3 / 20 / 20 %, Mage 0 / 3 / 17 %, Hunter 0 / 0 / 0 %; runs 16-20 Rogue 50, Mage 67, Hunter 77 %. The Hunter starts slowest (capstone-heavy tree) and ends strongest; the Rogue starts fastest and ends weakest.

### 12.3 Limits of the prototype
- Planner bot only; the bot does not adapt its tree to the cap (the Hunter keeps Marksmanship) and does not use build plans or the free respec.
- The rank cap was modelled as an effective-level cap while training still cost gold; the spec rule (4.2) stops training at the cap, which saves gold and is slightly kinder.
- Undertakings were a proxy: +50 Echoes (and Peal XP) in every run from run 2 that reached the boss (91 % of those runs).
- The first-run Peal rule (PEAL_FIRST_RUN_MIN) was not in the prototype (6 of 90 first runs ended at Peal 1).
- Rows map, not the expedition map; no Oaths.
- 90 campaigns pooled: single-run win rates carry about ±3-5 pp of noise, 5-run blocks about ±3 pp.

---

## 13. Notes for other roles
- **Lore chat**: world.md 6 says each Wayfarer is a new person and Echoes pass to the next one. With persistent characters, the Bell carries its fallen bearer home alive and remembers; Echoes become the Bellwrights' shared memory (the board), and Peal the bearer's own bell growing louder. The names Peal and Undertakings and the three titles need the originality check of style.md 5. Checked here: "Mettle" is a named system in The Lord of the Rings Online, "Roadcraft" a released game (2025), "Veteran Rank" a system in The Elder Scrolls Online: all avoided.
- **Content**: Undertaking texts (7.3), titles, the Bellwrights' welcome line, milestone screen texts.
- **UI**: section 10 of the hand-off lists the screens.

---

## 14. Constant table

| Constant | Value | Unit |
|---|---|---|
| CHAR_PER_CLASS | 1 | characters per class per profile (owner decision 10:34) |
| PEAL_MAX | 15 | levels |
| PEAL_XP | 2: 20, 3: 180, 4: 380, 5: 600, 6: 850, 7: 1150, 8: 1500, 9: 1900, 10: 2350, 11: 2850, 12: 3400, 13: 4000, 14: 4650, 15: 5350 | cumulative Peal XP to reach the level |
| PEAL_LADDER.talents | 1-15: 10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 26 | talent cap |
| PEAL_LADDER.rank | 1-15: 30, 32, 34, 36, 38, 41, 44, 46, 48, 50, 52, 54, 56, 58, 60 | spell rank cap (trained level; 60 = none) |
| PEAL_TECH1 | 2 | Peal (Lost Technique I spell) |
| PEAL_TECH2 | 10 | Peal (Lost Technique II spell) |
| STORMHAWK_PEAL | 8 | Peal (Hunter) |
| PEAL_INSIGHT | 15 | Peal (+1 talent point at level 60; META.talent_pt.points) |
| PEAL_TITLES | 5, 10, 15 | Peal |
| PLAN_SLOTS | 1; 2 from Peal 4; 3 from Peal 8 | build plans |
| PEAL_FIRST_RUN_MIN | 2 | Peal at the end of a character's first run, at least |
| RESPEC_FREE_FIRST | 1 | free respecs per run |
| ECHO_FIRST_RUN | 60 | Echoes, once per profile (= Packed Satchel's price) |
| ECHO_YIELD_PER_PEAL | 0.03 | × per Peal level above 1 |
| BOARD_PRICE_MULT | 1.5 | × today's price, rounded to 10; not Packed Satchel |
| BOARD_COST | vigor 120/180/260/350; edge 120/180/260/350; keen 230/380; quick_study 150/270/420; prospector 90/170/260; satchel 60; heirloom_blade 120; pockets 80/150; ledger 180; scout 150; swift_boots 300; alchemist 230; cache 300; relics 600; second_breath 750; oaths 0; und_ledger 300 | Echoes per rank (total 6 710 without und_ledger) |
| UNDERTAKING_FROM_RUN | 2 | profile run |
| UNDERTAKING_OFFERS | 3 | offers per run |
| UNDERTAKING_SLOTS | 1 (2 with Bellwright's Ledger) | Undertakings per run |
| UND_REWARD_EASY | 40 | Echoes |
| UND_REWARD_MEDIUM | 80 | Echoes |
| UND_REWARD_HARD | 150 | Echoes |
| UND_ECHO_SHARE_MAX | 0.20 | share of Echo income, runs 1-30 |
| UND_COMPLETE | 0.25-0.65 | completion rate per offered Undertaking |
| NUM_SCALE | 1/3 (exact fraction) | × every HP, damage, heal and absorb amount (9.1) |
| DOT_CARRY | on | periodic effects carry the unrounded remainder of each tick |
| NUM_SCALE_TOL | 0.03 | win-rate difference (N1) |
| CAMPAIGN_V2_RUNS | 30 | runs per campaign |
| N_CAMPAIGNS_V2 | 50 | campaigns per class |
| WR_RUN1_MAX | 0.05 | rate |
| WR_RUN23_MAX | 0.15 | rate |
| RUNS_FIRST_WIN | 4-7 | runs (median) |
| RUNS_FIRST_WIN_P90 | 12 | runs |
| WR_RUNS_6_10 | 0.20-0.40 | rate |
| WR_RUNS_11_15 | 0.35-0.55 | rate |
| WR_RUNS_21_30_V2 | 0.55-0.75 | rate |
| HOOK_SHARE_MIN | 0.90 | share of campaigns |
| ECHO_RISE_MIN | 1.4 | × |
| PEAL_MAX_RUNS | 16-24 | runs (median) |
| BOARD_RUNS_V2 | 16-26 | runs (median, first character) |
| BOARD_RUNS_MIN_V2 | 12 | runs |
| CLASS_FIRST_WIN_SPREAD | 2 | runs |
| CHAR_GAP | 0.25-0.40 | rate difference |
