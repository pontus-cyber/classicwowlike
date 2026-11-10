// Campaign metrics (B31, B32) and their Markdown summary.
import { BAL } from './params.mjs';
import { rate, median } from './stats.mjs';
import { pct, num, table } from './output.mjs';

/** Largest drop of a block's win rate below the best earlier block (B32 dip), over the given blocks in order. */
function largestDip(blocks) {
  let dip = 0;
  for (let i = 1; i < blocks.length; i++) {
    const best = Math.max(...blocks.slice(0, i).map((x) => x.p));
    dip = Math.max(dip, best - blocks[i].p);
  }
  return dip;
}

/**
 * campaigns: playCampaign results (one class, or all classes pooled).
 * B32 dip (M2 v4): only blocks that hold at least CURVE_BLOCK_MIN_RUNS runs, all classes pooled, are counted.
 * `counted` (a Set of block labels such as '31-35') fixes the counted blocks, so per-class metrics use the pooled
 * decision; without it a block counts when this sample holds at least `minBlockRuns` runs in it. Every block is
 * still listed (blocks[i].counted); maxDipAll is the dip over all blocks (the pre-M2 v4 definition).
 */
export function campaignMetrics(campaigns, { counted = null, minBlockRuns = BAL.CURVE_BLOCK_MIN_RUNS } = {}) {
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
    if (n) {
      const runs = `${b * 5 + 1}-${b * 5 + 5}`;
      blocks.push({ runs, ...rate(k, n), counted: counted ? counted.has(runs) : n >= minBlockRuns });
    }
  }
  const span = (lo, hi) => {
    let k = 0;
    let n = 0;
    for (const c of campaigns) for (const r of c.runs) if (r.k >= lo && r.k <= hi) { n++; if (r.out === 'v') k++; }
    return rate(k, n);
  };
  const ech = [];
  for (const c of campaigns) for (const r of c.runs) ech.push(r.ech);
  return {
    n: campaigns.length, completed: done.length, censored, medianRuns: mid === Infinity ? `> ${BAL.CAMPAIGN_MAX_RUNS}` : mid,
    medianRunsCompleted: done.length ? median(done) : null, minRuns: done.length ? Math.min(...done) : null,
    wr1to5: span(1, 5), wr21to30: span(21, 30), blocks,
    maxDip: largestDip(blocks.filter((b) => b.counted)), maxDipAll: largestDip(blocks),
    countedBlocks: blocks.filter((b) => b.counted).map((b) => b.runs),
    echoesPerRun: ech.length ? ech.reduce((a, b) => a + b, 0) / ech.length : null,
    ownedAt80: campaigns.map((c) => c.runs[c.runs.length - 1].owned),
  };
}

/**
 * byClass: { cls: [campaign] }. Returns { all, per: { cls: metrics } }: the pooled metrics decide which blocks the
 * B32 dip counts (CURVE_BLOCK_MIN_RUNS pooled), and the per-class metrics use the same blocks.
 */
export function campaignMetricsByClass(byClass) {
  const all = campaignMetrics(Object.values(byClass).flat());
  const counted = new Set(all.countedBlocks);
  const per = Object.fromEntries(Object.entries(byClass).map(([c, x]) => [c, campaignMetrics(x, { counted })]));
  return { all, per };
}

/** Block list for the report: "1-5 34 % (n=750)", blocks left out of the dip check marked. */
export function blockList(blocks) {
  return blocks.map((b) => `${b.runs} ${pct(b.p, 0)} (n=${b.n}${b.counted ? '' : ', not counted'})`).join(', ');
}

/** byClass: { cls: [campaign] } (see campaignMetricsByClass). */
export function campaignMarkdown(meta, byClass) {
  const { all, per } = campaignMetricsByClass(byClass);
  const lines = [`# Campaigns`, '', `- ${meta.count} campaigns per class, at most ${meta.maxRuns} runs each; run seeds ${meta.seedStart} + campaign × ${meta.maxRuns} + run`, `- Commit ${meta.commit}; date ${meta.date}; risk table: ${meta.riskIn || 'RISK_PRIOR'} (frozen)`,
    `- B32 dip: blocks of 5 runs with at least ${BAL.CURVE_BLOCK_MIN_RUNS} runs, all classes pooled (CURVE_BLOCK_MIN_RUNS); counted: ${all.countedBlocks.join(', ') || 'none'}`, ''];
  lines.push(table(['Class', 'Completed', 'Median runs to full catalogue', 'Fewest runs', 'Win rate runs 1-5', 'Win rate runs 21-30', 'Largest dip between counted 5-run blocks', 'Largest dip, all blocks', 'Echoes per run'],
    [...Object.entries(per), ['all', all]].map(([c, m]) => [c, `${m.completed}/${m.n}`, `${m.medianRuns}`, `${m.minRuns ?? 'n/a'}`, pct(m.wr1to5.p), pct(m.wr21to30.p), pct(m.maxDip), pct(m.maxDipAll), num(m.echoesPerRun, 0)])));
  lines.push('');
  for (const [c, m] of [...Object.entries(per), ['all', all]]) lines.push(`Win rate by block of 5 runs, ${c}: ${blockList(m.blocks)}`, '');
  return `${lines.join('\n')}\n`;
}
