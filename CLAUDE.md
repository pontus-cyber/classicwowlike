# Agent notes
- Read docs/README.md first. This repository is the single source of truth: handbook, roles, brief, milestones, decisions, status and code.
- Rules engine in src/rules.js is pure JavaScript with no DOM, so it runs in the browser and in Node.
- The game is one HTML file (game.html), built by the Lead from src/. Simulator and balance bot live in sim/, tests in qa/.
- Small, descriptive commits on main. Fetch and rebase before pushing. Never force-push.
