// Statistics for the reports (balance.md 2): Wilson intervals for rates, bootstrap intervals for medians.
import { makeRng, nextFloat } from './engine.mjs';
import { SIM } from './params.mjs';

/** Wilson score interval (95 %) for k successes in n. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function rate(k, n) {
  return { k, n, p: n ? k / n : null, ci: wilson(k, n) };
}

/** Quantile with linear interpolation (q in 0..1) of a numeric array. */
export function quantile(values, q) {
  if (!values.length) return null;
  const a = Float64Array.from(values).sort();
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

export const median = (values) => quantile(values, 0.5);
export const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/**
 * Bootstrap 95 % interval of a quantile (fixed seed, SIM.BOOT_N resamples). A resample's quantile is read from the
 * counts of its draws per distinct value (no sort), which gives the same result as sorting the resample.
 */
export function bootQuantile(values, q = 0.5, nBoot = SIM.BOOT_N) {
  if (values.length < 2) return [quantile(values, q), quantile(values, q)];
  const rng = makeRng(SIM.BOOT_SEED);
  const n = values.length;
  const distinct = Float64Array.from(new Set(values)).sort();
  const index = new Map();
  distinct.forEach((v, i) => index.set(v, i));
  const bucket = new Int32Array(n);
  for (let i = 0; i < n; i++) bucket[i] = index.get(values[i]);
  const k = distinct.length;
  const cnt = new Int32Array(k);
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const est = new Float64Array(nBoot);
  for (let b = 0; b < nBoot; b++) {
    cnt.fill(0);
    for (let i = 0; i < n; i++) cnt[bucket[Math.floor(nextFloat(rng) * n)]] += 1;
    let c = 0;
    let vlo = null;
    let vhi = null;
    for (let j = 0; j < k; j++) {
      c += cnt[j];
      if (vlo === null && c > lo) vlo = distinct[j];
      if (c > hi) { vhi = distinct[j]; break; }
    }
    est[b] = vlo + (vhi - vlo) * (pos - lo);
  }
  est.sort();
  return [est[Math.floor(0.025 * (nBoot - 1))], est[Math.ceil(0.975 * (nBoot - 1))]];
}

/**
 * Median with its bootstrap interval. The interval is computed on first read of `ci` (most medians in a cell are
 * never shown with one) and is not enumerable, so summary.json keeps { n, v } only.
 */
export function med(values) {
  const out = { n: values.length, v: median(values) };
  let ci = null;
  Object.defineProperty(out, 'ci', { enumerable: false, get: () => (ci || (ci = bootQuantile(values, 0.5))) });
  return out;
}

export function avg(values) {
  if (!values.length) return { n: 0, v: null, ci: [null, null] };
  const m = mean(values);
  const sd = Math.sqrt(values.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, values.length - 1));
  const h = (1.96 * sd) / Math.sqrt(values.length);
  return { n: values.length, v: m, ci: [m - h, m + h] };
}

/** Interval of a difference of two independent rates (normal approximation). */
export function diffRate(a, b) {
  if (!a.n || !b.n) return { v: null, ci: [null, null] };
  const v = a.p - b.p;
  const se = Math.sqrt((a.p * (1 - a.p)) / a.n + (b.p * (1 - b.p)) / b.n);
  return { v, ci: [v - 1.96 * se, v + 1.96 * se] };
}
