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

/** Bootstrap 95 % interval of a quantile (fixed seed, SIM.BOOT_N resamples). */
export function bootQuantile(values, q = 0.5, nBoot = SIM.BOOT_N) {
  if (values.length < 2) return [quantile(values, q), quantile(values, q)];
  const rng = makeRng(SIM.BOOT_SEED);
  const n = values.length;
  const est = new Float64Array(nBoot);
  const buf = new Float64Array(n);
  for (let b = 0; b < nBoot; b++) {
    for (let i = 0; i < n; i++) buf[i] = values[Math.floor(nextFloat(rng) * n)];
    buf.sort();
    const pos = (n - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    est[b] = buf[lo] + (buf[hi] - buf[lo]) * (pos - lo);
  }
  est.sort();
  return [est[Math.floor(0.025 * (nBoot - 1))], est[Math.ceil(0.975 * (nBoot - 1))]];
}

export function med(values) {
  return { n: values.length, v: median(values), ci: bootQuantile(values, 0.5) };
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
