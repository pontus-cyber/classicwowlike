# Status

Updated by the Lead at the end of every session. One page; older detail goes in docs/reports/.

## Where we are
M2 done 2026-11-10 (P1 45/45). Active: M2b, expedition map and combat v2 (docs/specs/expedition.md, docs/specs/combat-v2.md). M3 Hall of Echoes built early.

## Next tasks
1. Done 12:00-13:50: v7 tolls in engine, UI and sim; tuning v8 in engine (945e460), game.html a9d5fec; v8 measured (report balance-2026-11-11c, P1 25 of 38 run). Next: v8 follow-up for B3 speedrunner PALL 19.2 %, B6 PALL spread 11.4, B7 Beastbond 0.57, B30 Echoes 276, B1 greedy 18.7; B11/B12/B53 belong to the expedition default.
2. Waiting on the owner: free potion at the end boss (half strength is the default, D77), pet revive (v8 appendix A), comments on the meta v2 proposal (docs/specs/meta-v2.md, draft).
3. Next: 2b.5 prep points and contracts (engine + content); fog map UI; 2b.4 fog-only bots; switch default map; UX open items 5, 6, 9, 10.

## Next (from the v11 measure, report balance-2026-11-11g)
- Engine: Delve price back to 2 (D93 guard tripped), EXPED_DROP_MULT 1.9 (cell 10), remove DUNGEON_DIM_HOLD (B4 dropped); Beastcall Horn stays 12 (row 8 void: PALL hunter lead is Ricochet Bolt).
- Designer: B43 (caught zones 21.7 %, Dimmed share 20.2 %) and B12 (31.8 / 30.8 min); PALL hunter via Ricochet Bolt; P10 profile under the 8.2 order. Flip criteria 2 and 3 pass, 1 fails on B43 and B12.

## Next (after engine v12, c0ab802)
- Sim: v12 sim rows (escapeV and planner price an outward Dimmed step at TIME_DIM_ESCAPE; speedrunner per balance.md 1; Ricochet arm via C.RICOCHET_BOUNCE_FRAC_GATED; drop the v11 row-8 test; measure-v11.sh patches) and the v12 measure; then the flip decision.
- Running: one-button study (owner 18:41/18:46), report docs/reports/mash-2026-11-11.md.
- UI: playtest items in BACKLOG (contract expiry warning, duplicate offers, card labels, heat toast flapping).

## Flip status (report balance-2026-11-11h, v12)
- Flip: no. B12 speedrun 32.3 min from SET_OUT on 71 wins (cap 30; O10 allows 0.5) and planner P0 19.3 % (floor 20 %). Ricochet gate passed (0.30 default, engineer). The v12 speedrunner policy (row 4) prices a level at 16.7 tolls and plays much worse; next pass: re-price it. Combat v13 (owner-approved 21:26) changes all win rates, so the next flip measure runs after v13 is in.

## v13 measure (report balance-2026-11-12)
- B59 passes both maps (one-button elite 50.6 %, rare 84.0 %, dungeon boss 79.4 %, zone 1 55.8 %); B60 rares pass with row 5; B61 autoplay held (Rogue zone 1 +6-9 pp: Sap breaks in round 2, no interrupt before level 6); B62 grind held. Gates: row 5 on, row 6 on (engineer to set).
- Flip: no, on B12 only (speedrun 31.3 min from SET_OUT with the v11 policy; spec policy too few wins). Owner question raised 2026-11-11 22:5x.

## Next (after engine v14, 5a6ee16)
- Sim: fix qa/sim v13.test setGates deepEqual (new switches sapHold, passStealth); setGates turns unnamed switches off, so the v14 cells need --gates rareHpMultZ1,firstMeetWindup,sapHold,passStealth; run the v14 list (about 20 min).
- Flip: waiting on the owner (B12 speedrun 31.3 min).

## Waiting on the owner
Nothing blocking. See docs/OWNER.md.

## Build
game.html at 91f9290 (tuning v6 engine, UX pass, the Furnace). Sent to the owner 2026-11-11 11:40.

## Session log
| Session | Date | Tasks | Agents (model/effort) | Tokens |
|---|---|---|---|---|
| 1 | 2026-11-09 | Repo scaffold, M0 done, start 1.1, 1.3, 1.4 | Lead Game Designer (Opus/high, 205k tokens); Core Gameplay Eng (Opus/max); UI/UX Eng (Opus/max); Content Designer (Sonnet/medium) | 1.34M total |
| 2 | 2026-11-09 18:48 | Resume sim and QA after server restart; start UI bug fixes | UI/UX Eng (Opus/max) | pending |
| 3 | 2026-11-09 19:41 | Close M1; start M2 design pass and engine fixes | Designer (Opus/high), Core Gameplay Eng (Opus/max) | pending |
| 4 | 2026-11-09 19:47 | No new task; agents running | none | 0 |
| 5 | 2026-11-09 20:14 | Design pass reviewed; start sim and UI for M2 v2 | Sim Eng (Opus/max), UI/UX Eng (Opus/max) | pending |
| 6 | 2026-11-09 20:47 | No new task; three agents running | none | 0 |
| 7 | 2026-11-09 21:00-21:47 | Engine and UI M2 v2 reviewed, tests 169/56/31 pass, build sent | none new | engine 602k, UI 476k |
| 8 | 2026-11-09 22:3x | Balance re-measure reviewed (41/69); v3 design pass queued for 2026-11-10 | none new | sim total about 1.4M |
| 9 | 2026-11-09 22:47 | Resume v3 design pass after server restart; last session of the day | Designer (Opus/high) | pending |
| 10 | 2026-11-10 04:56 | Owner restart; engine M2 v3 done; sim re-measure and UI text fixes running | Core Gameplay Eng (Opus/max, 369k), Sim Eng (Opus/max), UI/UX Eng (Opus/max) | pending |
| 11 | 2026-11-10 06:24 | M2 v3 measured 53/72; build sent; start v4 design pass and M3 meta screen | Sim Eng (508k), UI/UX Eng (409k + running), Designer (Opus/high) | pending |
| 12 | 2026-11-10 07:10 | v4 design pass reviewed; D40 stop rule; engine, sim, UI started | Designer (312k), UI/UX (542k), Engineer/Sim/UI (Opus/max) | pending |
| 13 | 2026-11-10 07:40-08:46 | Restart recovery; M2 v4 engine/UI/sim done; D41 code map; v5 design pass started | Engineer (338k), UI (318k), Sim (358k), Docs (Sonnet, 132k), Designer (Opus/high) | about 1.1M |
| 14 | 2026-11-10 09:56-11:50 | M2 v5 built and measured, M2 closed (P1 45/45); expedition and combat-v2 specs; M2b started; combat feel UI done, build sent | Designer x3 (Opus/high), Engineer, Sim, UI (Opus/max) | about 2.6M |
| 15 | 2026-11-10 11:50-17:50 | Combat v2 engine, Rogue fixes D48-D49, content, combat v2 UI, heat design+engine+UI, combat v2.1 design+engine, expedition map engine, regions; daily report | Engineer, Sim, UI (Opus/max); designers (Opus/high); content (Sonnet/medium) | about 6.3M |
| 16 | 2026-11-10 20:47 | Restart recovery (server stopped agents about 18:37): sim resumed; UI restarted fresh on the uncommitted work; three non-original names replaced (lore chat finding) | Sim, UI (Opus/max), Content (Sonnet/medium) | pending |
| 17 | 2026-11-11 07:41-08:53 | Owner playtests (Rogue x5); Dev menu built; heat value in bots (ASC step finding); tuning pass v6 and DoT/hints task started | Engineer x2, Sim (Opus/max), Designer (Opus/high) | about 1.4M |
| 18 | 2026-11-11 08:53-11:48 | DoT preview, talent totals, hints; tuning v6 design+engine; v7 names (the Furnace, tolls); meta v2 proposal; UX pass; restart recovery | Engineer x3, UI, Sim (Opus/max); designers x3 (Opus/high) | about 2.9M |
| 19 | 2026-11-11 11:48-14:50 | v7 tolls in engine, UI, sim; tuning v8 designed, built, measured (P1 25/38); game.html a9d5fec; owner feedback: damage stats, pet revive, potion drops. Started: 2b.5 engine, 2b.4 fog bots, v9 follow-up spec | Engineer x2, Sim x2 (Opus/max); designer (Opus/high) | about 2.6M |
| 20 | 2026-11-11 14:50-17:50 | Fog-only bots + leak test (2b.4 done); prep and contracts in engine, content texts, prep screen and tracker (preview setting); tuning v9, v10, v11 designed and built; v9+v10 measured (flip criteria not met: expedition wins 15-19 % / 47 %); meta 8.2 entries. Started: v11 measure, fog map UI + damage stats | Engineer x3, Sim x3, UI (Opus/max); designer x3 (Opus/high); content (Sonnet) | about 5M |
| 21 | 2026-11-11 17:50-20:50 | QA fixes and playtest (ui-checks/part I were test faults; toasts, fog-map labels, M key); fog map and Damage block; tuning v12 designed and built; one-button study (grind easy, special fights hard; misses: zone 1 specials, new enemies, potions); experimental log X1-X3; night sessions on. Started: v12 sim rows + flip measure; UI playtest fixes | Engineer, Sim x2, UI, QA (Opus/max-high); designer (Opus/high) | about 3M |
| 22 | 2026-11-11 20:50-23:50 | Playtest UI fixes (zone-leave warning, unique offers, labels, toasts, tooltips); v12 measured (flip no: B12, P0); combat v13 approved by the owner, built (engine + display) and measured (B59-B62 pass; gates 5-6 on; Rogue zone 1 gap); flip blocked on B12 only, owner asked. Started: v14 spec (Rogue Deathblow answer, gates on) | Engineer, Sim x2, UI x2 (Opus/max); designer x2 (Opus/high) | about 3.5M |
| 23 | 2026-11-11 23:50 - 2026-11-12 02:50 | v14 designed and built (Rogue waits on Sap, hidden elite Deathblow type, gates on); game.html 30d565a. Started: v14 measure | Engineer (Opus/max); designer (Opus/high); Sim (Opus/max) | about 1M |
| 24 | 2026-11-12 02:50-05:50 | v14 measured (Rogue zone 1 Deathblows answered 100 %, deaths 14 % / 8 %; B59, B61, B62 hold; D114). Started: QA pass on the v14 build with per-class playtests | Sim (Opus/max); QA (Opus/high) | about 0.8M |
| 25 | 2026-11-12 05:50-08:50 | QA pass on v14 (258/258, 5 fixes); owner rule D115 (Lead decides); flip to the expedition with start camp (D116, b1a399f) and sim fix (D118); health check; Fable for art direction (3 directions, owner picks) and UI architecture review (D117). Started: combat display fixes (lethal warning, Rogue wait, floats, pet Deathblow); UI architecture review | Engineer, UI (Opus/max); QA (Opus/high); Art director, architect (Fable) | about 2M |
| 26 | 2026-11-12 08:50-11:50 | Combat display fixes (LETHAL, Rogue wait, floats, pet Deathblow); UI architecture review (Track R, D119); art direction A chosen (D120), owner leads art (D121); R1-R2 tokens; art proposal 1 (Lantern colours, Dev switch) sent; task list for owner visibility; Fable paused (D122). Started: R3, v15 spec | UI x2 (Opus/max); architect, art director (Fable); designer (Opus/high) | about 1.8M |
| 27 | 2026-11-12 11:50-14:50 | R3 (JS colours in the palette); v15 designed, built, measured and applied (Belk HP kept, Swift passage off, Mawgrim HP 0.95; D123-D126); qa all green. Started: R4 tokens, sound proposal | UI, Engineer x2, Sim (Opus/max-high); designer x2 (Opus/high) | about 1.7M |
| 28 | 2026-11-12 14:50-17:50 | R4 (type, spacing, layer tokens); sound proposal with preview sent (owner steer); 2b.8 done. M2b waits for the owner playtest (2b.9). Started: R5 | UI (Opus/max); designer (Opus/high) | about 0.6M |
| 29 | 2026-11-12 17:50-20:50 | R5 done (Track R steps 1-5 complete); owner playtest feedback (D128: lean camp, 3 contracts, calmer map); sound approved (D127); art steer (D129: dark HUD kept, paper map). Running: lean camp and map (engineer), sound build (UI); no new agents this slot (2 max-effort running, D53) | Engineer, UI (Opus/max) | about 0.4M |
| 30 | 2026-11-12 20:50-23:50 | Owner playtest applied: lean camp (3 offers, 4 options) and calmer map (D128, D130); sound built (D127, D131); art steer (D129); lean-camp measure (PALL 48 %) then board across the run (D132) measured in band (P0 28 %, PALL 54 %, D133). Started: paper map + Dimming cue + hawk portrait (UI); autoplay camp Ember first (engine) | Engineer x3, UI, Sim x2 (Opus/max-high) | about 2.2M |
| 31 | 2026-11-12 23:50 - 2026-11-13 02:50 | Paper map (D129), Dimming glass cue, hawk portrait, last colours to tokens; autoplay camp Ember first (D133-D134); game.html bade240. Started: autoplay camp measure, M3 onboarding spec | UI, Engineer (Opus/max-high); Sim, designer (Opus/high) | about 1M |
| 32 | 2026-11-13 02:50-05:50 | Autoplay camp measured and kept (D136, +7.5 pp); M3 onboarding spec accepted (D135, owner questions O15-O17 on defaults); M2b closed after the owner's playtest; M3 active. Started: tutorial seed script (3.2) | Sim (Opus/high) | about 0.5M |
| 33 | 2026-11-13 05:50-08:50 | Tutorial seed 8736 chosen (D137, 3.2 done). Started: guided-run engine (3.4), guided-run content table (3.3) | Sim (Opus/high); Engineer (Opus/max); Content (Opus/high) | about 0.4M |
| 34 | 2026-11-13 08:50-11:50 | M3 guided run: content (03d3072, D138), engine (9cad27f, D139), UI (cd61e9b, D140); game.html fe6106b; sim fixed profiles set welcome. Started: QA new-player playtest (3.6), engine coach-line order (D141) | Engineer x2, UI (Opus/max-high); content (Opus/high); QA (Opus/high) | about 2M |
| 35 | 2026-11-13 14:50-17:50 | M3 3.7 first pass: guided Roads wait for Gorrak's fight, G10/G12 returns (engine 7fa9d81); one instruction while a coach line is up, hints seen after 2 showings, keys from the view, Rogue round-1 cause found (UI 43e409d); D143; tests 725/725, ui-regress A,R 56/56; game.html built. Next: Gorrak gate after S3 + measure, G13.closed anchor in UI | Engineer, UI (Opus/max) | about 0.9M |
| 36 | 2026-11-13 17:50-20:50 | Blind tester pilot done (D144, about 0.4M). Engine: Gorrak gate after S3, guide and text fixes, class-stat rewards behind rewardPrimary (D145, 1d035ec); zone 2 inner-ring quest cap (D146, 321f2aa). Sim: zone 1 to zone 2 step measured (balance-2026-11-13c). UI blind-panel batch still running | UI, Engineer (Opus/max); Sim (Opus/high) | about 1.8M |
| 37 | 2026-11-13 20:50-23:50 | Usage limit paused agents 20:50-21:40. UI blind-panel batch landed (faa9b7b); game.html d3c8ee5 (754 tests, 108 browser checks). Designer: zone 1 damage lever, B63-B65, B15 re-set, S3/S4 swap (D147) | Designer (Opus/high); UI (Opus/max) | about 0.7M |
| 38 | 2026-11-13 23:50 - 2026-11-14 02:50 | D147 engine landed: rescue loop fix, zone 1 damage x1.25, S3/S4 swap (D148; 769 tests). Sim: bar guard, B14 expedition band. Build held (part R 1/108 after the swap) | Engineer (Opus/max); Sim (Opus/medium) | about 0.7M |
| 39 | 2026-11-14 02:50-05:50 | UI wiring for D147 and part R updated (baeb652); Designer G8 fix for all classes (D149, spec b4c96ce); game.html 764dc1e built (772 tests, 118 browser checks) | UI (Opus/max); Designer (Opus/high) | about 0.7M |
| 40 | 2026-11-14 05:50-08:50 | D149 built (fcfde14): S3 wind-up on turn 1, G8 for every class following the line (20/20 each), G8 joint line clears after round 1, content lines for skip and rescues left; game.html 6391ae3 (776 tests, 118 browser checks) | Engineer (Opus/max) | about 0.4M |
| 41 | 2026-11-14 08:50-11:50 | G8 line only while an answer exists, roadsOpenLine (45f4c85); UI content lines, hub toast placement, part R after D149 (ffd69ec); game.html built (780 tests, 123 browser checks). M3 3.7 done | Engineer, UI (Opus/high) | about 0.35M |
| 42 | 2026-11-14 11:50-14:50 | M3 3.8 started: blind panel round 2 on 2609a70, explorer and competitive (Fable/high), impatient skipper (Sonnet/high, varies the model) | 3 blind testers | running |
