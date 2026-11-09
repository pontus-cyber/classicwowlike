// Campaign metrics (B31, B32) and their Markdown summary.
import { BAL } from './params.mjs';
import { rate, median } from './stats.mjs';
import { pct, num, table } from './output.mjs';

/** campaigns: playCampaign results of one class. */
export function campaignMetrics(campaigns) {
  const done = campaigns.map((c) => c.complete).filter((x) => x !== null);
  const censored = campaigns.length - done.length;
  // Median with censored campaigns counted as > CAMPAIGN_MAX_RUNS.
  const all = campaigns.map((c) => (c.complete === null ? Infinity : c.complete)).sort((a, b) => a - b);
  const mid = all.length ? all[Math.floor((all.length - 1) / 2)] : null;
  const blocks = [];
  for (let b = 0; b < BAL.CAMPAIGN_MAX_RUNS / 5; b++) {
    let k = 0;
    let n = 0;
    for (const c of campaigns) for (const r of c.runs) if (r.k > b * 5 && r.k <= b * 5 + 5) { n++; if (r.out === 'v') k++; }
    if (n) blocks.push({ runs: `${b * 5 + 1}-${b * 5 + 5}`, ...rate(k, n) });
  }
  const span = (lo, hi) => {
    let k = 0;
    let n = 0;
    for (const c of campaigns) for (const r of c.runs) if (r.k >= lo && r.k <= hi) { n++; if (r.out === 'v') k++; }
    return rate(k, n);
  };
  let maxDip = 0;
  for (let i = 1; i < blocks.length; i++) {
    const best = Math.max(...blocks.slice(0, i).map((x) => x.p));
    maxDip = Math.max(maxDip, best - blocks[i].p);
  }
  const ech = [];
  for (const c of campaigns) for (const r of c.runs) ech.push(r.ech);
  return {
    n: campaigns.length, completed: done.length, censored, medianRuns: mid === Infinity ? `> ${BAL.CAMPAIGN_MAX_RUNS}` : mid,
    medianRunsCompleted: done.length ? median(done) : null, minRuns: done.length ? Math.min(...done) : null,
    wr1to5: span(1, 5), wr21to30: span(21, 30), blocks, maxDip,
    echoesPerRun: ech.length ? ech.reduce((a, b) => a + b, 0) / ech.length : null,
    ownedAt80: campaigns.map((c) => c.runs[c.runs.length - 1].owned),
  };
}

export function campaignMarkdown(meta, perClass) {
  const lines = [`# Campaigns`, '', `- ${meta.count} campaigns per class, at most ${meta.maxRuns} runs each; run seeds ${meta.seedStart} + campaign × ${meta.maxRuns} + run`, `- Commit ${meta.commit}; date ${meta.date}; risk table: ${meta.riskIn || 'RISK_PRIOR'} (frozen)`, ''];
  lines.push(table(['Class', 'Completed', 'Median runs to full catalogue', 'Fewest runs', 'Win rate runs 1-5', 'Win rate runs 21-30', 'Largest dip between 5-run blocks', 'Echoes per run'],
    Object.entries(perClass).map(([c, m]) => [c, `${m.completed}/${m.n}`, `${m.medianRuns}`, `${m.minRuns ?? 'n/a'}`, pct(m.wr1to5.p), pct(m.wr21to30.p), pct(m.maxDip), num(m.echoesPerRun, 0)])));
  lines.push('');
  for (const [c, m] of Object.entries(perClass)) {
    lines.push(`Win rate by block of 5 runs, ${c}: ${m.blocks.map((b) => `${b.runs} ${pct(b.p, 0)} (n=${b.n})`).join(', ')}`, '');
  }
  return `${lines.join('\n')}\n`;
}
