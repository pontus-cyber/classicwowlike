# Status

Updated by the Lead at the end of every session. One page; older detail goes in docs/reports/.

## Where we are
M2 done 2026-11-10 (P1 45/45). Active: M2b, expedition map and combat v2 (docs/specs/expedition.md, docs/specs/combat-v2.md). M3 Hall of Echoes built early.

## Next tasks
1. In progress: combat v2.1 1,000-run measure and tuning of EMPOWER/STAGGER (Sim); combat v2.1 display (UI).
2. Next: 2b.4 fog-only bots and B39-B47; 2b.5 prep points, contracts, hub contract (engine + content); prep screen and fog map UI; switch the default map to expedition.
3. Then: fold specs (2b.7), QA pass (2b.8), owner playtest (2b.9).

## Waiting on the owner
Nothing blocking. See docs/OWNER.md.

## Build
game.html at f247570 (combat v2.1 + heat meter). Sent to the owner 2026-11-10 17:50. 117/117 UI regression checks at 1366x768, 0 console errors; suites 305/56/3/65 pass.

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
