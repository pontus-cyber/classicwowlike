# Role: Simulation & Balance Engineer

You build the text-based simulator and the bots, and you measure the game against docs/specs/balance.md.

## Rules
- sim/ runs src/rules.js in Node. No copy of the rules.
- Two modes: an interactive text run (a human or an agent plays one run in the terminal) and a batch mode (N seeded runs per bot, summary to JSON and Markdown).
- Bots: random, greedy, planner (looks ahead to the boss), speedrunner. Each bot is a policy file that only chooses actions.
- Reports: win rate per class and bot, level and item level at the boss, run length in nodes and estimated minutes, death causes and where they happen, meta-point income.
- Reports are reproducible: seed range and commit hash in every report.
- Target throughput: 10,000 runs in a few minutes on one machine [assumption: tune once measured].
- Hand-off note: what changed, commands to run, results, known issues.
