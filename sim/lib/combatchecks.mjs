// Combat v2 metrics and target checks (combat-v2.md 12: B48-B54, the changed B5, B15, B16; B53 with the pacing of
// section 9) from run records. Pure functions of the records (the recorder's fx, f2 and rep fields), used by
// sim/combatreport.mjs; every check returns { id, pri, metric, value, target, ok, note }.
import { C } from './engine.mjs';
import { C2 } from './params.mjs';
import { FIGHT_KINDS } from './recorder.mjs';
import { rate, wilson, quantile, median, diffRate } from './stats.mjs';
import { CLASS_ENGAGE, engageKind } from './view.mjs';
import { pct, num } from './output.mjs';

const FK = Object.fromEntries(FIGHT_KINDS.map((k, i) => [k, i]));
const NON_BOSS = new Set([FK.quest, FK.grind, FK.elite, FK.trash, FK.dboss, FK.treasure, FK.camp]);
/** The designer's scratch count (sim/out/combat2/an.py, spec section 13): quest, grind, elite, trash, dungeon boss. */
const SCRATCH_KINDS = new Set([FK.quest, FK.grind, FK.elite, FK.trash, FK.dboss]);
const pp = (x) => x / 100;
const ok = (r) => r.out !== 'x';

/** Non-boss fights and deaths (fx outcome 0) of records; kinds: a Set of fight kind codes. */
export function deathRate(records, kinds = NON_BOSS) {
  let fights = 0;
  let deaths = 0;
  for (const r of records) {
    if (!ok(r)) continue;
    for (const f of r.fx) {
      if (!kinds.has(f[0])) continue;
      fights++;
      if (f[2] === 0) deaths++;
    }
  }
  return { fights, deaths, per1000: fights ? (1000 * deaths) / fights : null };
}

/** Ratio of two death rates with a 95 % interval (log ratio, Poisson counts). */
export function deathRatio(a, b) {
  if (!a.fights || !b.fights || !b.deaths) return { v: null, ci: [null, null] };
  const v = a.per1000 / b.per1000;
  if (!a.deaths) return { v, ci: [0, null] };
  const se = Math.sqrt(1 / a.deaths + 1 / b.deaths);
  return { v, ci: [v * Math.exp(-1.96 * se), v * Math.exp(1.96 * se)] };
}

/** Paired difference of a 0/1 run outcome on the seeds two cells share: { v, ci, n }. */
export function pairedDiff(a, b, f) {
  const bs = new Map();
  for (const r of b) if (ok(r)) bs.set(`${r.cls}|${r.seed}`, r);
  const d = [];
  for (const r of a) {
    if (!ok(r)) continue;
    const o = bs.get(`${r.cls}|${r.seed}`);
    if (o) d.push(f(r) - f(o));
  }
  if (!d.length) return { v: null, ci: [null, null], n: 0 };
  const m = d.reduce((x, y) => x + y, 0) / d.length;
  const sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, d.length - 1));
  const h = (1.96 * sd) / Math.sqrt(d.length);
  return { v: m, ci: [m - h, m + h], n: d.length };
}
const reach = (r) => r.rb;
const win = (r) => (r.out === 'v' ? 1 : 0);
export const reachRate = (records) => { const x = records.filter(ok); return rate(x.filter((r) => r.rb).length, x.length); };
export const winRate = (records) => { const x = records.filter(ok); return rate(x.filter((r) => r.out === 'v').length, x.length); };

/** f2 rows of non-boss fights with their fx row: [{ fx, f2, cls }]. */
function fightPairs(records, filter = () => true) {
  const out = [];
  for (const r of records) {
    if (!ok(r) || !r.f2) continue;
    r.fx.forEach((fx, i) => { const f2 = r.f2[i]; if (f2 && NON_BOSS.has(fx[0]) && filter(fx, f2)) out.push({ fx, f2, cls: r.cls }); });
  }
  return out;
}

/** B50 replays of masher records: { n, opener, auto, control } (rates of replays that survive). */
export function replayStats(records) {
  const reps = [];
  for (const r of records) if (ok(r) && r.rep) reps.push(...r.rep);
  const n = reps.length;
  const k = (i) => reps.filter((x) => x[i] !== 0).length;
  return { n, opener: rate(k(2), n), auto: rate(k(3), n), control: rate(k(4), n) };
}

/** Engage-round choices of multi-enemy fights per class: { cls: { n, counts: { option: k } } }. */
export function engageShares(records) {
  const out = {};
  for (const { f2, cls } of fightPairs(records, (fx, f) => f[0] >= 2 && f[1])) {
    const o = (out[cls] = out[cls] || { n: 0, counts: {} });
    const label = f2[1];
    const id = label.includes(':') && !label.startsWith('spell:') ? label.split(':')[1] : 'other';
    o.n++;
    o.counts[id] = (o.counts[id] || 0) + 1;
  }
  return out;
}

/** OFF_BALANCE windows in non-boss fights: { opened, used, share }. */
export function windowStats(records) {
  let opened = 0;
  let used = 0;
  for (const { f2 } of fightPairs(records)) { opened += f2[4]; used += f2[5]; }
  return { opened, used, share: rate(used, opened) };
}

/** B54: multi-enemy fights whose first target differs from the default target. */
export function firstTargetStats(records) {
  let n = 0;
  let k = 0;
  for (const { f2 } of fightPairs(records, (fx, f) => f[0] >= 2 && (f[8] === 0 || f[8] === 1))) { n++; k += f2[8]; }
  return rate(k, n);
}

/** Pace terms of combat v2 (section 9): the engine's values when it has them, else the spec's. */
export function v2Pace() {
  const anim = typeof C.PACE_ROUND_ANIM_S === 'number' && C.PACE_ROUND_ANIM_S >= C2.PACE_ROUND_ANIM_S ? C.PACE_ROUND_ANIM_S : C2.PACE_ROUND_ANIM_S;
  const decide = typeof C.PACE_ROUND_DECIDE_S === 'number' ? C.PACE_ROUND_DECIDE_S : C2.PACE_ROUND_DECIDE_S;
  const engage = typeof C.PACE_ENGAGE_S === 'number' ? C.PACE_ENGAGE_S : C2.PACE_ENGAGE_S;
  const source = typeof C.PACE_ENGAGE_S === 'number' && C.PACE_ROUND_ANIM_S === C2.PACE_ROUND_ANIM_S ? 'engine' : 'combat-v2.md 9 (engine not updated yet)';
  return { round: anim + decide, fight: C.PACE_FIGHT_OVERHEAD_S, engage, source };
}

/** Manual combat minutes of a run at v2 pacing: rounds × round + fights × overhead + engage per non-boss fight. */
export function combatMinutes(r, pace = v2Pace()) {
  const engageFights = r.fights - (r.rb ? 1 : 0);
  return (r.rounds * pace.round + r.fights * pace.fight + engageFights * pace.engage) / 60;
}

/** Median rounds of won fights by group (B16), v2 groups. */
export function roundsByGroup(records) {
  const groups = { normal: [FK.quest, FK.grind, FK.treasure], elite: [FK.elite], dboss: [FK.dboss], boss: [FK.boss] };
  const out = {};
  for (const [g, kinds] of Object.entries(groups)) {
    const xs = [];
    for (const r of records) if (ok(r)) for (const f of r.fx) if (f[2] === 1 && kinds.includes(f[0])) xs.push(f[1]);
    out[g] = { n: xs.length, v: xs.length ? median(xs) : null };
  }
  return out;
}

const inBand = (v, [lo, hi]) => v !== null && v !== undefined && v >= lo && v <= hi;
const rc = (r) => (r && r.n ? `${pct(r.p)} (${pct(r.ci[0])} - ${pct(r.ci[1])}; n=${r.n})` : 'n/a');
const dc = (d) => (d && d.v !== null ? `${d.v >= 0 ? '+' : ''}${num(d.v * 100, 1)} pp (${num(d.ci[0] * 100, 1)} - ${num(d.ci[1] * 100, 1)})` : 'n/a');

/**
 * Every combat v2 check from the cells' records (all classes pooled): cells = { planner, masher, opener, tactician }
 * (arrays of records; any may be missing). Returns rows { id, pri, metric, value, target, ok, note }.
 */
export function combatChecks(cells) {
  const rows = [];
  const add = (id, pri, metric, value, target, okv, note = '') => rows.push({ id, pri, metric, value, target, ok: okv, note });
  const { planner, masher, opener, tactician } = cells;
  // B48
  if (opener && planner) {
    const a = deathRate(opener);
    const b = deathRate(planner);
    const r = deathRatio(a, b);
    add('B48', 'P1', `Opening value (a): non-boss deaths per 1 000 fights, opener / planner (opener ${num(a.per1000, 2)}, planner ${num(b.per1000, 2)}; ${a.deaths}/${a.fights} and ${b.deaths}/${b.fights})`,
      r.v === null ? 'n/a' : `${num(r.v, 2)} (${num(r.ci[0], 2)} - ${num(r.ci[1], 2)})`, `<= ${C2.OPEN_DEATH_RATIO_MAX}`, r.v === null ? null : r.v <= C2.OPEN_DEATH_RATIO_MAX);
    const d = pairedDiff(opener, planner, reach);
    add('B48', 'P1', `Opening value (b): reach the boss, opener - planner, paired seeds (opener ${pct(reachRate(opener).p)}, planner ${pct(reachRate(planner).p)})`, dc(d), `>= +${C2.OPEN_REACH_GAIN_MIN} pp`, d.v === null ? null : d.v >= pp(C2.OPEN_REACH_GAIN_MIN));
  }
  // B49
  if (masher && planner) {
    const m = reachRate(masher);
    const g = pairedDiff(planner, masher, reach);
    const okv = m.p >= C2.MASH_REACH_MIN && g.v >= pp(C2.MASH_GAP_MIN);
    add('B49', 'P1', `Mashing works, to an extent: masher reach the boss (planner - masher, paired: ${dc(g)})`, rc(m), `>= ${pct(C2.MASH_REACH_MIN, 0)} and <= planner - ${C2.MASH_GAP_MIN} pp`, okv);
  }
  // B50
  if (masher) {
    const x = replayStats(masher);
    add('B50', 'P1', `The opening decides: masher non-boss deaths that survive with the opener's first ${C2.OPEN_ROUNDS} rounds, masher after (autoplay's first ${C2.OPEN_ROUNDS} rounds instead: ${pct(x.auto.p)}; masher replayed: ${pct(x.control.p)}, must be 0 %)`,
      rc(x.opener), `>= ${pct(C2.OPEN_DECIDES_MIN, 0)}`, x.n ? x.opener.p >= C2.OPEN_DECIDES_MIN : null, x.control.k ? 'replay control failed' : '');
  }
  // B51
  if (opener) {
    const sh = engageShares(opener);
    for (const cls of Object.keys(CLASS_ENGAGE)) {
      const o = sh[cls];
      if (!o) { add('B51', 'P2', `Engage diversity, ${cls}`, 'n/a', '', null); continue; }
      const parts = CLASS_ENGAGE[cls].map((id) => ({ id, p: (o.counts[id] || 0) / o.n }));
      const other = (o.counts.other || 0) / o.n;
      const okv = parts.every((x) => x.p >= C2.ENGAGE_SHARE_MIN && x.p <= C2.ENGAGE_SHARE_MAX);
      add('B51', 'P2', `Engage diversity, ${cls}: opener's engage-round choices in multi-enemy fights (n=${o.n})`, `${parts.map((x) => `${x.id} ${pct(x.p, 0)}`).join(', ')}; bar spell or other ${pct(other, 0)}`, `each >= ${pct(C2.ENGAGE_SHARE_MIN, 0)}, none > ${pct(C2.ENGAGE_SHARE_MAX, 0)}`, okv);
    }
  }
  // B52
  if (opener && masher) {
    const o = windowStats(opener);
    const m = windowStats(masher);
    const gap = o.share.n && m.share.n ? o.share.p - m.share.p : null;
    add('B52', 'P2', `Windows used by planning: OFF_BALANCE windows hit with a spell, non-boss fights (opener ${o.used}/${o.opened}, masher ${m.used}/${m.opened}; gap ${gap === null ? 'n/a' : `${num(gap * 100, 1)} pp`})`,
      `opener ${rc(o.share)}`, `opener >= ${pct(C2.WINDOW_USE_MIN, 0)}; opener - masher >= ${C2.WINDOW_GAP_MIN} pp`, o.share.n ? o.share.p >= C2.WINDOW_USE_MIN && gap >= pp(C2.WINDOW_GAP_MIN) : null);
  }
  // B53
  if (planner) {
    const pace = v2Pace();
    const xs = planner.filter((r) => ok(r) && r.rb).map((r) => combatMinutes(r, pace));
    const v = xs.length ? median(xs) : null;
    add('B53', 'P1', `Combat time budget: median manual combat minutes, planner P0 runs reaching the boss (${num(pace.round, 1)} s per round, ${pace.fight} + ${pace.engage} s per fight; pacing from ${pace.source})`, `${num(v, 1)} min (n=${xs.length})`, `<= ${C2.COMBAT_MIN_MAX} min`, v === null ? null : v <= C2.COMBAT_MIN_MAX);
  }
  // B54
  if (opener) {
    const x = firstTargetStats(opener);
    add('B54', 'P2', 'First target differs from the default target, opener, multi-enemy fights', rc(x), `>= ${pct(C2.FIRST_TARGET_DIFF_MIN, 0)}`, x.n ? x.p >= C2.FIRST_TARGET_DIFF_MIN : null);
  }
  // B5 (changed)
  if (tactician && planner) {
    const d = diffRate(winRate(tactician), winRate(planner));
    add('B5', 'P1', `Tactician - planner win rate, P0 (tactician ${pct(winRate(tactician).p)}, planner ${pct(winRate(planner).p)})`, dc(d), `${C2.MANUAL_GAP_V2[0]} - ${C2.MANUAL_GAP_V2[1]} pp (MANUAL_GAP_V2)`, d.v === null ? null : inBand(d.v, C2.MANUAL_GAP_V2.map(pp)));
    if (opener) {
      const o = diffRate(winRate(opener), winRate(planner));
      add('B5', 'diag', `Opener - planner win rate, P0 (opener ${pct(winRate(opener).p)}); share of the tactician's gap`, `${dc(o)}; ${d.v > 0 ? num(o.v / d.v, 2) : 'n/a'} × (tactician - planner)`, `>= ${C2.OPEN_SHARE_MIN} × (tactician - planner)`, d.v > 0 ? o.v >= C2.OPEN_SHARE_MIN * d.v : null);
    }
  }
  // B15 (changed), B16 (changed)
  if (planner) {
    const xs = planner.filter((r) => ok(r) && r.rb).map((r) => r.fights);
    const v = xs.length ? median(xs) : null;
    add('B15', 'P2', 'Fights per run incl. boss, planner P0 runs reaching the boss', `${num(v, 0)} (n=${xs.length})`, `${C2.FIGHTS_V2[0]} - ${C2.FIGHTS_V2[1]} (FIGHTS_V2)`, v === null ? null : inBand(v, C2.FIGHTS_V2));
    const rg = roundsByGroup(planner);
    for (const [g, label, b] of [['normal', 'normal encounter', C2.ROUNDS_V2.normal], ['elite', 'elite', C2.ROUNDS_V2.elite], ['dboss', 'dungeon boss', C2.ROUNDS_V2.dboss], ['boss', 'end boss', C2.ROUNDS_BOSS_V2]]) {
      const x = rg[g];
      add('B16', 'P1', `Fight length incl. the engage round, ${label} (planner P0, won fights)`, `${num(x.v, 1)} rounds (n=${x.n})`, `${b[0]} - ${b[1]}`, x.n ? inBand(x.v, b) : null);
    }
  }
  return rows;
}

/**
 * Opening pairs (replayOpenings) of autoplay records: per opening (auto, opener, masher) { n, deaths, per1000, hp
 * (mean end HP fraction), pot (potions per fight) } and the fights where the opener ends with more / less HP than
 * autoplay (by more than 2 % of max HP). kinds: fight kind codes to keep (default all non-boss).
 */
export function openingPairs(records, kinds = NON_BOSS) {
  const names = ['auto', 'opener', 'masher'];
  const out = Object.fromEntries(names.map((k) => [k, { n: 0, deaths: 0, hp: 0, pot: 0 }]));
  let better = 0;
  let worse = 0;
  for (const r of records) {
    if (!ok(r) || !r.pr) continue;
    for (const p of r.pr) {
      if (!kinds.has(p[1])) continue;
      names.forEach((k, i) => {
        const o = out[k];
        o.n++;
        if (p[2 + 3 * i] === 0) o.deaths++;
        o.hp += p[3 + 3 * i] / 1000;
        o.pot += p[4 + 3 * i];
      });
      if (p[6] > p[3] + 20) better++; else if (p[6] < p[3] - 20) worse++;
    }
  }
  for (const o of Object.values(out)) { o.per1000 = o.n ? (1000 * o.deaths) / o.n : null; o.hp = o.n ? o.hp / o.n : null; o.pot = o.n ? o.pot / o.n : null; }
  return { ...out, better, worse };
}

/** Engage-round share table per class (B51 detail): rows [cls, n, option shares..., other]. */
export function engageTable(records) {
  const sh = engageShares(records);
  return Object.keys(CLASS_ENGAGE).map((cls) => {
    const o = sh[cls] || { n: 0, counts: {} };
    return [cls, o.n, ...CLASS_ENGAGE[cls].map((id) => `${id} (${engageKind(id)}) ${o.n ? pct((o.counts[id] || 0) / o.n, 0) : 'n/a'}`), o.n ? pct((o.counts.other || 0) / o.n, 0) : 'n/a'];
  });
}

export { NON_BOSS, SCRATCH_KINDS, wilson, quantile };
