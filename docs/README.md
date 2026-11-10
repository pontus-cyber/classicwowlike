# Team handbook

A small agent team builds this game for the owner. The Lead plans, delegates, integrates and reports. The owner sets the goal, answers questions and plays the builds.

## Start here (every agent, every session)
1. The Lead reads every file in docs/ that the task touches. Other roles read only "Rules for all agents" below, their own role file and the files named in their task.
2. Do the work your role file describes.
3. The Lead records the result in docs/STATUS.md. Other roles write a short hand-off note in docs/handoffs/.

## Team
Add a role only when a task needs one, and log the reason in docs/DECISIONS.md.

| Title | File | Owns | Effort |
|---|---|---|---|
| Owner / CEO (the user) | none | Goal, decisions marked "owner", play-testing, the tasks in docs/OWNER.md | |
| Lead Developer | docs/team/lead.md | Plan, delegation, review, integration, builds, status, reports | high |
| Lead Game Designer | docs/team/designer.md | Rules spec, formulas, talents, boss, meta progression, balance targets | high |
| Core Gameplay Engineer | docs/team/engineer.md | src/rules.js: the pure, seeded rules engine | max |
| UI/UX & Visual Engineer | docs/team/ui.md | Visual client: HUD, scrolling world, art in code, animation, feel | max |
| Simulation & Balance Engineer | docs/team/sim.md | Text simulator, bots, balance reports | max |
| Playtest & QA Lead | docs/team/qa.md | Test plans, automated checks, headless runs, playtest notes, bug list | max |
| Content Designer | docs/team/content.md | Zones, quests, dungeons, items, names and text, within the designer's ranges | medium |

## Files
| Path | Purpose | Who writes |
|---|---|---|
| docs/BRIEF.md | What we are building | Lead, after owner approval |
| docs/MILESTONES.md | Milestones, tasks, done-when lines | Lead |
| docs/DECISIONS.md | Every decision with reason and status | Lead (others propose) |
| docs/STATUS.md | One page: where we are, next tasks, blockers, build, cost | Lead |
| docs/OWNER.md | Tasks only the owner can do, with dates | Lead writes, owner ticks |
| docs/specs/*.md | Rules and content specs | Designer, Engineer |
| docs/reports/*.md | Report to the owner when something changed | Lead |
| docs/feedback/*.md | Owner feedback written down by any chat | Any |
| docs/handoffs/*.md | Hand-off notes to the Lead | Each role |
| src/ | Game source | Engineer |
| sim/ | Simulator runner and balance bot | Engineer |
| qa/ | Test scripts | QA |
| game.html | The build the owner plays | Lead only |

## Rules for all agents
- Never do anything public or paid. No accounts, no purchases, no publishing beyond private previews.
- Never wait for the owner. Ask with a default, continue on the default, and redo only what his answer changes.
- Owner tasks come first: put every step that needs him on day 1, one step each, in docs/OWNER.md.
- Specs before code. Every number in a spec is a named constant in one table at the end of the spec.
- Measure before claiming. A task is done only when QA has run its checks, or the Lead has run it, and the result is written down.
- Tag factual claims in specs and reports: [stated] from the owner, [source] from a named file or page, [inference] say from what, [assumption] must be verified.
- Original content only: no names, characters, art or text from existing games.
- Plain, professional English. No hype.
- Keep the code accountable (D41). Every code file starts with a header comment: what it does and which spec section it implements. Adding, moving or deleting a file means updating the file table in docs/ARCHITECTURE.md in the same commit; qa/docs/code-map.test.mjs fails otherwise. A new rule, number or API change goes into its spec (rules.md, balance.md, engine-api.md) in the same commit as the code.
- Every hand-off note lists the commits, the files changed and how the change was checked. The Lead rejects work that breaks these rules.
