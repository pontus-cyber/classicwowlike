// Markdown summary of one batch invocation (one or three classes of a cell).
import { profileLabel } from './profiles.mjs';
import { pct, num, rateCell, medCell, table } from './output.mjs';
import { tableSummary } from './risk.mjs';

export function cellMarkdown({ name, cell, perClass, meta }) {
  const lines = [];
  lines.push(`# Batch: ${name}`, '');
  lines.push(`- Bot: ${cell.bot}; profile: ${profileLabel(cell.prof)}; tree: ${cell.trees ? JSON.stringify(cell.trees) : cell.tree}; style: ${cell.style || 'balanced'}; variant: ${cell.variant || 'none'}${cell.pet ? `; pet: ${cell.pet}` : ''}`);
  lines.push(`- Seeds: ${meta.seedStart} - ${meta.seedStart + meta.runs - 1} per class (${meta.runs} runs per class); risk warm-up: ${meta.warmupNote}`);
  lines.push(`- Commit: ${meta.commit}; date: ${meta.date}; Node ${process.version}; workers: ${meta.workers}`);
  lines.push(`- Wall time: ${num(meta.wallMs / 1000, 1)} s for ${meta.totalRuns} runs (${num(meta.totalRuns / (meta.wallMs / 60000), 0)} runs/min on ${meta.workers} workers)`, '');
  const head = ['Metric', ...Object.keys(perClass)];
  const row = (label, f) => [label, ...Object.values(perClass).map((x) => f(x.metrics))];
  lines.push(table(head, [
    row('Win rate', (m) => rateCell(m.win)),
    row('Reach the boss', (m) => rateCell(m.boss)),
    row('Wins / boss fights', (m) => rateCell(m.bossWin)),
    row('Median minutes, runs at boss (bot profile)', (m) => medCell(m.minutesBoss)),
    row('Median minutes, wins (manual / autoplay)', (m) => `${num(m.minutesWinManual.v)} / ${num(m.minutesWinAuto.v)}`),
    row('Median hours at boss / Ascendancy', (m) => `${num(m.hoursBoss.v, 0)} / ${num(m.ascBoss.v, 2)}`),
    row('Level 60 at boss', (m) => rateCell(m.lvl60)),
    row('Mean equipped ilvl at boss', (m) => num(m.ilvlBoss.v)),
    row('Rare-or-better slots at boss', (m) => pct(m.rareShareBoss.v)),
    row('Nodes / fights (runs at boss, median)', (m) => `${num(m.nodesBoss.v, 0)} / ${num(m.fightsBoss.v, 0)}`),
    row('Rounds: normal / elite / dungeon boss / end boss', (m) => `${num(m.rounds.normal.v, 0)} / ${num(m.rounds.elite.v, 0)} / ${num(m.rounds.dboss.v, 0)} / ${num(m.rounds.boss.v, 0)}`),
    row('Runs dying early / mid / late (share of runs)', (m) => ['early', 'mid', 'late'].map((k) => pct(m.deathStageRuns[k].p, 1)).join(' / ')),
    row('Deaths early / mid / late / boss (share of deaths)', (m) => ['early', 'mid', 'late', 'boss'].map((k) => pct(m.deathStage[k].p, 0)).join(' / ')),
    row('Mean lowest HP in won non-boss fights, Z1..Z6 (%)', (m) => m.tension.zones.map((z) => num(z.v === null ? null : z.v * 100, 0)).join(' / ')),
    row('Won non-boss fights dipping below CLOSE_FIGHT_HP', (m) => pct(m.closeFights.p)),
    row('Boss losses phase 1 / 2 / 3 / enrage', (m) => ['1', '2', '3', 'enrage'].map((k) => pct(m.bossLossPhase[k].p, 0)).join(' / ')),
    row('Echoes per run (all / wins)', (m) => `${num(m.echoes.v, 0)} / ${num(m.echoesWin.v, 0)}`),
    row('Rests / potions per run (runs at boss)', (m) => `${num(m.rests.v)} / ${num(m.potions.v)}`),
    row('Level leaving Z1..Z6 (median)', (m) => m.travelLv.map((x) => num(x.v, 0)).join(', ')),
    row('Trainer visits covering TRAIN_ALL', (m) => pct(m.trainAfford.p)),
    row('Ember bought by the boss (runs at boss)', (m) => pct(m.emberBuy.p)),
    row('Errors / stuck runs', (m) => `${m.errors}`),
    row('ms per run (one worker)', (m) => num(m.msPerRun.v, 1)),
  ]));
  lines.push('');
  for (const [cls, x] of Object.entries(perClass)) {
    if (!x.table) continue;
    lines.push(`Risk table, ${cls} (final): P(death) at full HP by CL - L = -2, 0, 2, 4, 6, 8; observed entries and deaths`, '');
    lines.push(table(['Type', 'Entries', 'Deaths', 'Rate', 'dl -2', '0', '2', '4', '6', '8'],
      tableSummary(x.table, x.obs).map((r) => [r.type, r.entries, r.deaths, pct(r.rate, 2), ...r.pFullHpByDl.map((p) => pct(p, 1))])));
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
