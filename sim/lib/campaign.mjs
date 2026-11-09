// Campaign (balance.md 1.4): a planner profile plays consecutive runs from P0 and buys in the standard order
// whenever affordable, until the catalogue is complete or CAMPAIGN_MAX_RUNS runs (B31, B32).
import { R, C } from './engine.mjs';
import { runWithBot } from './runner.mjs';
import { campaignBuy, catalogueComplete } from './profiles.mjs';

/** cell: { bot, cls, tree }; seeds: one per run (at most CAMPAIGN_MAX_RUNS); table: risk lookup (frozen). */
export function playCampaign(cell, index, seeds, table) {
  let profile = R.newProfile();
  const runs = [];
  let complete = null;
  for (let k = 0; k < seeds.length; k++) {
    const { record, state } = runWithBot({ ...cell, prof: 'campaign' }, seeds[k], table, { profile, trainCheck: false });
    if (state.result) profile = state.result.profile;
    const buy = campaignBuy(profile, cell.cls);
    profile = buy.profile;
    const owned = Object.values(C.META).reduce((n, m) => n + Math.min(m.ranks, profile.unlocks[m.id] || 0), 0);
    runs.push({ k: k + 1, out: record.out, rb: record.rb, lvl: record.lvl, ech: record.ech, bought: buy.bought, echoes: profile.echoes, owned, err: record.err });
    if (catalogueComplete(profile)) { complete = k + 1; break; }
  }
  return { index, cls: cell.cls, complete, runs, spent: profile.spent, earned: profile.earned };
}
