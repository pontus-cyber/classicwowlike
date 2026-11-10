// Default talent tree per class and profile group (balance.md 1.3 "Default tree", M2 v5, D43): the switch rule
// with TREE_SWITCH_Z, the best point estimate used by the B5 fallback (balance.md 1.3 "B5 fallback"), and the group
// of a meta profile. Used by sim/pass.mjs (choosing), sim/report.mjs (reporting) and sim/run.mjs (defaults).
import { BAL, SIM } from './params.mjs';

/** Profile group of a meta profile name: 'PALL' for the full catalogue, else 'P0' (P0, P10, campaigns). */
export function profileGroup(prof) {
  return ['all', 'pall', 'metaall'].includes(String(prof).toLowerCase()) ? 'PALL' : 'P0';
}

/** The recorded default trees (the incumbents) of a profile group: { rogue, mage, hunter }. */
export function defaultTrees(group) {
  return { ...(group === 'PALL' ? SIM.DEFAULT_TREE_PALL : SIM.DEFAULT_TREE) };
}

/** Order of two trees by win rate, then reach-the-boss rate, then the lower index first. */
function better(byTree, a, b) {
  const x = byTree[a];
  const y = byTree[b];
  return y.win.p - x.win.p || y.boss.p - x.boss.p || a - b;
}

/**
 * The switch rule for one class. byTree[t] = { win: { p, n }, boss: { p } } of the planner cell with tree t
 * (every tree of the class, same profile group). A challenger c clears when
 *   p_c - p_i > z × sqrt(p_c (1 - p_c) / n_c + p_i (1 - p_i) / n_i);
 * of those that clear, the highest win rate wins (equal: higher reach-the-boss rate); none clears: the incumbent.
 * Returns { tree, incumbent, switched, best: the best challenger's row, rows: one row per challenger
 * { tree, p, n, gap, threshold, clears } }.
 */
export function treeSwitch(byTree, incumbent, z = BAL.TREE_SWITCH_Z) {
  const inc = byTree[incumbent];
  const rows = [];
  for (let t = 0; t < byTree.length; t++) {
    if (t === incumbent) continue;
    const c = byTree[t];
    const se = Math.sqrt((c.win.p * (1 - c.win.p)) / c.win.n + (inc.win.p * (1 - inc.win.p)) / inc.win.n);
    const gap = c.win.p - inc.win.p;
    rows.push({ tree: t, p: c.win.p, n: c.win.n, gap, threshold: z * se, clears: gap > z * se });
  }
  const order = (a, b) => better(byTree, a.tree, b.tree);
  const best = rows.slice().sort(order)[0] || null;
  const winner = rows.filter((r) => r.clears).sort(order)[0] || null;
  const tree = winner ? winner.tree : incumbent;
  return { tree, incumbent, switched: tree !== incumbent, best, rows, incP: inc.win.p, incN: inc.win.n };
}

/** Tree with the best win-rate point estimate, no incumbent rule (B5 fallback): ties by reach-the-boss rate. */
export function bestPointTree(byTree) {
  return [...byTree.keys()].sort((a, b) => better(byTree, a, b))[0];
}
