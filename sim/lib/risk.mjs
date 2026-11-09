// Death-risk table (balance.md 1.1): death rate by (node type, CL - L, HP fraction at entry), learned from the
// simulator's own runs and refreshed every SIM_RISK_REFRESH runs; RISK_PRIOR before data exists.
// It also learns the mean HP-fraction change of a node (exit - entry), which the planners use to predict the
// HP at the next node. Estimates shrink with RISK_SHRINK pseudo-observations: (type, dl, hp) toward (type, dl),
// and (type, dl) toward RISK_PRIOR (P(death)) or the type mean (HP change). P(death) is then made monotone.
import { SIM } from './params.mjs';

// Node types of the table. Quests are split by encounter size and elites by the visible add (rules 2.1, 2.3):
// a 3-mob quest and a 1-mob quest are different risks, and both sizes are visible on the map.
export const RISK_TYPES = ['quest1', 'quest2', 'quest3', 'grind', 'elite', 'elite2', 'dungeon', 'treasure', 'camp'];
/** Report group of a risk type (quest1-3 -> quest, elite2 -> elite). */
export const RISK_GROUP = { quest1: 'quest', quest2: 'quest', quest3: 'quest', grind: 'grind', elite: 'elite', elite2: 'elite', dungeon: 'dungeon', treasure: 'treasure', camp: 'camp' };
/** Risk type of a map node (mapView cell). */
export function riskType(v) {
  if (v.type === 'quest') return `quest${Math.max(1, Math.min(3, v.archetypes ? v.archetypes.length : 2))}`;
  if (v.type === 'elite') return v.archetypes && v.archetypes.length > 1 ? 'elite2' : 'elite';
  return v.type;
}
export const TYPE_CODE = Object.fromEntries(RISK_TYPES.map((t, i) => [t, i]));

/** dl = CL - L, clamped to the table range. */
export const dlKey = (dl) => Math.max(SIM.RISK_DL_MIN, Math.min(SIM.RISK_DL_MAX, Math.round(dl)));
/** HP fraction at entry -> bucket 0..3 (< 0.25, < 0.5, < 0.75, >= 0.75). */
export const hpKey = (h) => (h < 0.25 ? 0 : h < 0.5 ? 1 : h < 0.75 ? 2 : 3);

/** Empty observation set: per key [entries, deaths, sum of HP change]. */
export function newObs() {
  return { full: {}, td: {}, t: {}, runs: 0 };
}

function add(map, key, died, dh) {
  const c = map[key] || (map[key] = [0, 0, 0]);
  c[0] += 1;
  c[1] += died;
  c[2] += dh;
}

/** Add one node entry: [typeCode, dl, hpEntryPct, died, hpExitPct] (record format, see recorder.mjs). */
export function addEntry(obs, e) {
  const t = RISK_TYPES[e[0]];
  const dl = dlKey(e[1]);
  const hb = hpKey(e[2] / 100);
  const dh = e[3] ? 0 : (e[4] - e[2]) / 100;
  add(obs.full, `${t}|${dl}|${hb}`, e[3], dh);
  add(obs.td, `${t}|${dl}`, e[3], dh);
  add(obs.t, t, e[3], dh);
}

export function addRecord(obs, rec) {
  if (rec.ne) for (const e of rec.ne) addEntry(obs, e);
  obs.runs += 1;
}

export function mergeObs(a, b) {
  const out = newObs();
  for (const o of [a, b]) {
    for (const k of ['full', 'td', 't']) {
      for (const [key, c] of Object.entries(o[k])) {
        const d = out[k][key] || (out[k][key] = [0, 0, 0]);
        d[0] += c[0]; d[1] += c[1]; d[2] += c[2];
      }
    }
    out.runs += o.runs;
  }
  return out;
}

/**
 * Lookup table built from observations: { p: {key: P(death)}, dh: {key: mean HP change}, runs }.
 * Keys are `${type}|${dl}|${hb}` for every type, dl in range and hb 0..3, so lookups never miss.
 */
export function buildTable(obs) {
  const k = SIM.RISK_SHRINK;
  const p = {};
  const dh = {};
  // Survivor HP change is averaged over entries that did not die.
  const meanDh = (c, prior) => {
    const alive = c ? c[0] - c[1] : 0;
    return alive > 0 ? (c[2] + k * prior) / (alive + k) : prior;
  };
  for (const t of RISK_TYPES) {
    // Unseen (type, dl) cells keep RISK_PRIOR: the type mean would carry the risk of other level differences.
    const pt = SIM.RISK_PRIOR[RISK_GROUP[t]];
    const ht = meanDh(obs.t[t], SIM.HP_DELTA_PRIOR[RISK_GROUP[t]]);
    for (let dl = SIM.RISK_DL_MIN; dl <= SIM.RISK_DL_MAX; dl++) {
      const ctd = obs.td[`${t}|${dl}`];
      const ptd = ((ctd ? ctd[1] : 0) + k * pt) / ((ctd ? ctd[0] : 0) + k);
      const htd = meanDh(ctd, ht);
      for (let hb = 0; hb < 4; hb++) {
        const key = `${t}|${dl}|${hb}`;
        const c = obs.full[key];
        p[key] = ((c ? c[1] : 0) + k * ptd) / ((c ? c[0] : 0) + k);
        dh[key] = meanDh(c, htd);
      }
    }
  }
  // Monotone: P(death) never falls as content gets harder (dl up) or HP at entry gets lower (bucket down), so
  // a cell with no data inherits the risk of the nearest easier cell instead of the type mean.
  for (const t of RISK_TYPES) {
    for (let hb = 3; hb >= 0; hb--) {
      let run = 0;
      for (let dl = SIM.RISK_DL_MIN; dl <= SIM.RISK_DL_MAX; dl++) {
        const key = `${t}|${dl}|${hb}`;
        if (hb < 3) p[key] = Math.max(p[key], p[`${t}|${dl}|${hb + 1}`]);
        run = Math.max(run, p[key]);
        p[key] = run;
      }
    }
  }
  return { p, dh, runs: obs.runs };
}

export function priorTable() {
  return buildTable(newObs());
}

export function riskP(table, type, dl, hp) {
  return table.p[`${type}|${dlKey(dl)}|${hpKey(hp)}`];
}

export function riskDh(table, type, dl, hp) {
  return table.dh[`${type}|${dlKey(dl)}|${hpKey(hp)}`];
}

/** Compact view for reports: P(death) by type and dl at full HP (bucket 3), and per-type totals. */
export function tableSummary(table, obs) {
  const rows = [];
  for (const t of RISK_TYPES) {
    const ct = obs ? obs.t[t] : null;
    const cells = [];
    for (let dl = -2; dl <= 8; dl += 2) cells.push(table.p[`${t}|${dl}|3`]);
    rows.push({ type: t, entries: ct ? ct[0] : 0, deaths: ct ? ct[1] : 0, rate: ct && ct[0] ? ct[1] / ct[0] : null, pFullHpByDl: cells });
  }
  return rows;
}
