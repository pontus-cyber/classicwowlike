# Hand-off: meta progression v2 design (M3), 2026-11-11

From: Lead Game Designer. To: Lead (for the owner). Status: draft proposal; nothing built; rules.md and balance.md unchanged until the owner has reviewed it.
Spec: docs/specs/meta-v2.md. Owner inputs: docs/feedback/2026-11-11-1026-owner.md, answers 10:31 and decision 10:34 (Lead relay).

## Pitch for the owner (8 lines)
1. You create one character per class once and keep it. Every run is still a fresh climb from level 1 to 60 with new gear; the character is what grows.
2. The character has a persistent level, **Peal** (1-15). Each run pays Peal XP equal to its Echoes, win or lose; a lost run only gives less, never takes anything away.
3. Peal lifts two caps: talent points per run (10 at Peal 1, all 26 at Peal 14, plus one at Peal 15) and spell ranks (trained level 30 at Peal 1, no cap at Peal 15). Milestones add new spells (the Lost Techniques), the capstone, the Hunter's Stormhawk, titles and looks.
4. The first run is very hard (1 % wins for our bot), the second and third about 10 %; the first win comes after a median of 6 runs for the bot, likely 4-5 for a skilled player. Win rate then climbs to about 65 % by runs 16-20.
5. The hook: every first run ends with a Peal level-up and a welcome gift of 60 Echoes; the board opens on Packed Satchel (3 potions, the first one free each fight), so run 2 starts visibly stronger.
6. Echoes per run rise: +3 % per Peal level and deeper runs pay more (250 in run 1, about 510 by run 20). The Echo board stays account-wide; class-only items moved to the character, so nothing is bought twice.
7. **Undertakings**: before a run you may take one account-wide challenge ("defeat the first dungeon boss while the Furnace is Infernal") for Echoes and titles after the run. They are about how you play; contracts stay about where you go.
8. All HP and damage numbers ÷3 (boss 13 066 → 4 355 HP); measured balance-neutral. A fully grown character with a full board is exactly today's full-catalogue power, so long play cannot trivialise the boss.

## Decisions taken from the owner (built into the spec)
- One character per class (owner, 10:34); builds stay cheap to try: every run starts with no talents spent, plus saved build plans and a free first respec per run.
- A lost run never takes anything away (10:31).
- Account-wide quests chosen before a run → Undertakings (10:31).
- Onboarding nudge to Packed Satchel after run 1 (10:31).

## Open choices, with the default the team builds on
| # | Choice | Default | Alternatives |
|---|---|---|---|
| O1 | Name of the character level | **Peal** (the Wayfarer's bell growing louder) | "Wayfarer level" (plain). Avoided: Mettle (LOTRO), Roadcraft (a 2025 game), Veteran Rank (ESO) |
| O2 | Curve speed | **Ladder v3**: first win median 6 runs (bot), full power by run 18 | Gentler v1: first win median 4, board full by run 12, more wins in runs 2-5 (20 %) |
| O3 | Number scale | **÷3** (NUM_SCALE 1/3) with tick remainder carry | ÷2: zone-1 hits keep some variance (3-4 instead of always 2); boss 6 533 HP |
| O4 | Gear between runs | **None kept** (roguelike run) | A cosmetic wardrobe (looks of found gear, no stats) later; one heirloom slot only with a power budget |
| O5 | Retire a character and climb again | **Allowed**, behind a confirmation | Not offered |
| O6 | Undertakings | **Name "Undertakings"; 1 slot (2 with a 300-Echo board entry); 3 offers per run; 40 / 80 / 150 Echoes by tier; from run 2** | More slots; Peal XP without Echoes |
| O7 | First in-run respec free | **Yes** | Keep today's price |
| O8 | Old profiles | **Moved board entries refunded; characters start at Peal 1** | Seed each character's Peal from the profile's past Echoes |
| O9 | Per-class Peal ladders | **One ladder for all classes**; per-class tuning only if target M5 fails in the full measure | Per-class ladders now (prototype: Rogue strongest early, Hunter strongest late) |

## Measured curve (designer scratch, real engine, planner bot, 30 campaigns × 30 runs per class)
| Run | 1 | 2 | 3 | 4 | 5 | 6-10 | 11-15 | 16-20 | 21-25 | 26-30 |
|---|---|---|---|---|---|---|---|---|---|---|
| Win rate (all classes) | 1 % | 8 % | 12 % | 13 % | 26 % | 32 % | 48 % | 65 % | 68 % | 66 % |
| Peal at start (median) | 1 | 3 | 4 | 5 | 6 | 7-10 | 10-13 | 13-15 | 15 | 15 |

- Runs to first win: median 6 (p10 3, p90 10); Rogue 5, Mage 6, Hunter 7.
- Echoes per run (mean, all income): run 1 250, run 5 334, run 10 392, run 15 439, run 20 509; runs 11-20 are 1.64 × runs 1-3.
- Peal 15 and the full board both after a median of 18 runs.
- Hook: 93 % of first runs gained a Peal level before the first-run rule (now 100 % by rule); 90 % / 97 % in runs 2 / 3; 100 % of first runs could buy Packed Satchel.
- Power by Peal (fixed caps, fresh board): Peal 1 0.9 %, Peal 2-3 3.1 %, Peal 5-6 8.7 %, Peal 8 14.7 %, Peal 11 21.3 %, Peal 15 33.2 % (today's fresh profile). The caps bite at the end boss: reach stays at 75-78 %.
- Number scale (paired, 200 runs per class): ÷2 +0.3 pp, ÷3 +1.7 pp (± 2.6); Z1-Z2 deaths and boss rounds unchanged.
- Known misses: runs 11-15 per class (Rogue 37 %, Mage 55 %, Hunter 51 %) fail a ±5 pp class band; Undertakings were a proxy (+50 Echoes when a run reaches the boss).

## Targets
New M1-M7 and N1 (meta-v2.md 11) replace B31 and B32 and extend B2, B3, B10 and B30. B1-B29 are measured at Peal 15, which equals today's uncapped character, so current tuning carries over.

## Implementation plan (after owner review)
| Step | Who | Work | Size |
|---|---|---|---|
| 0 | Designer | Fold the approved parts into rules.md (1.2, 5.2, 6, 9, 11, 13) and balance.md (M1-M7, N1); D-entries | small |
| E1 | Core Gameplay Engineer | Profile v2 and migration; characters; Peal XP and ladder; talent and rank caps; Echo lines (yield, welcome); board: moved entries, prices; summary `peal` block; tests | medium-large |
| E2 | Core Gameplay Engineer | Undertakings: pool data, offers stream, take action, 12 predicates (two new counters: interrupts landed, Litany outcomes), summary and Echo line; tests | medium |
| E3 | Core Gameplay Engineer | NUM_SCALE at the six points, tick remainder carry, Mindguard rate; regenerate QA goldens | small-medium (touches every HP golden) |
| U1 | UI/UX Engineer | Title screen with 3 character cards and creation; `Set out` flow (pet, plan, Undertaking); talent window locked pips and cap text; trainer rank-cap text; summary with Peal bar and milestone screens; Echo board onboarding highlight and tip | large |
| U2 | UI/UX Engineer | Undertakings panel and in-run tracker line; build plan editor; titles and looks on the card and summary | medium |
| S1 | Simulation & Balance Engineer | Campaign v2 runner (port of the scratch m2campaign.mjs); Undertaking policy for the bot; cap-aware tree choice; M1-M7 and N1 in the report; Peal-15 identity check with today's PALL cell | medium |
| C1 | Content Designer, lore chat | Undertaking texts and titles; welcome and milestone lines; world.md 6 change (the Bell carries its bearer home alive) | small |

Order: 0 → E1 with S1 and U1 in parallel → E2 with U2 → E3 any time after E1 (independent; best before the next UI polish pass, since every number on screen changes). M2b work (expedition map, prep) is not blocked; Undertakings sit on its start camp when it ships and on the character card until then.

## Notes for the Lead
- Lore conflict: docs/lore/world.md 6 says each Wayfarer is a new person. Persistent characters need the lore chat to revise it (proposal in meta-v2.md 13). Not edited here.
- Name checks done here: Mettle (a LOTRO system), Roadcraft (a 2025 release) and Veteran Rank (ESO) were rejected; Peal, Undertakings and the titles still need the style.md 5 check by the lore chat.
- The caps make the end boss the wall for new characters; the zones stay as hard as today (reach 75-78 % at every cap). If the owner wants early runs to end earlier, that is a content lever (zone danger), not a meta one.
- Hunter's Marksmanship puts its power in the capstone (talent cap 16: 3 % wins against the Rogue's 19 %); the ladder reaches the capstone at Peal 5 (run 4) to keep that window short.

## Commits, files, checks
- Commit: this hand-off and docs/specs/meta-v2.md only (hash in the Lead report).
- Prototype (git-ignored): sim/out/meta2/eng (clone of 5e2a5e8 with switches in src/engine/progress.js, spells.js, nodes.js, damage.js, combat.js, boss.js, stats.js and sim/lib/engine.mjs; new sim/m2campaign.mjs), grid.sh / gridc.sh (fixed-cap cells), an.mjs (campaign tables), ladder1-3.json, results in sim/out/meta2/o.
- Reproduce: `cd sim/out/meta2/eng && node sim/m2campaign.mjs <class> 30 30 ../ladder3.json ../o/camp3-<class>.json`, then `node ../an.mjs camp3`; fixed cells `../gridc.sh 150 all - name='{"tcap":17,"tlcap":40}'`; number scale `../gridc.sh 200 all - k3='{"k":0.3333333333}'`.
- Checked by: fixed-cap cells (planner P0, 150-200 runs per class, 16 cells), three campaign ladders (60-90 campaigns each), two number-scale cells paired with the baseline. No engine, UI or test file of the repository was changed.
