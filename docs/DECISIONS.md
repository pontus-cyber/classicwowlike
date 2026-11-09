# Decisions

Status: final, owner review (built on, easy to change), team (delegated to the Lead).

| ID | Decision | Reason | By | Status |
|---|---|---|---|---|
| D1 | Team: Lead, Lead Game Designer, Core Gameplay Engineer, UI/UX & Visual Engineer, Simulation & Balance Engineer, Playtest & QA Lead, Content Designer (see README.md) | Owner asked for a full studio with a high quality bar; each role owns one area | Owner 2026-11-09 | final |
| D2 | Scheduled Lead sessions five times a day (about 08:47, 11:47, 14:47, 17:47, 20:47 Stockholm). A session that cannot move the active milestone ends at once without starting agents. The 17:47 session sends the daily report and build. The owner can also start a session by writing in the Lead chat. Implemented as a chain in the Lead chat: each session books the next one (send_later), so the session keeps repo access and owner messages | Owner wants continuous work; the early-exit rule keeps blocked sessions cheap. Replaces the setup rule "no clock-driven sessions" | Owner 2026-11-09 | final |
| D3 | Maximum effort for Core Gameplay Engineer, UI/UX & Visual Engineer, Simulation & Balance Engineer and Playtest & QA Lead. High for Lead and Lead Game Designer. Medium for Content Designer | Owner wants the quality bar set from the start on the code, feel and balance work. Replaces "maximum only after a failed review" | Owner 2026-11-09 | final |
| D4 | Builds are sent to the owner as a file in chat; a private preview is optional | Download links broke in an earlier project | Setup | final |
| D5 | Rules engine is pure and seeded, separate from the UI | Enables tests, replays, the simulator and the balance bot | Setup | final |
| D6 | Platform: desktop browser first, one HTML file, plain JavaScript, canvas 2D | Owner confirmed browser first | Owner 2026-11-09 | final |
| D7 | Classes: Rogue, Mage, Hunter from the first playable build | Picking a class is part of the intended feel | Owner 2026-11-09 | final |
| D8 | Combat: auto-resolve by default; the player can take manual control of any fight. Action bar holds at most 7 spells plus usable items | Keeps the pace up while leaving room for skill | Owner 2026-11-09 | final |
| D9 | Run length target: about 45 minutes to the boss kill; a speedrun route must exist | Owner target | Owner 2026-11-09 | final |
| D10 | Death with no resurrect ends the run; summary screen and meta points scaled by progress | Owner rule | Owner 2026-11-09 | final |
| D11 | Art: stylised 2D painted look drawn in code, parallax world scrolling past a centred character; no pixel art | Owner choice | Owner 2026-11-09 | final |
| D12 | Repository: github.com/pontus-cyber/classicwowlike, branch main | Owner created it | Owner 2026-11-09 | final |
