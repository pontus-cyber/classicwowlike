// Small pure helpers shared by the engine modules. No game rules here.

const EPS = 1e-9;

/** Round half away from zero (rules 0, "Integers"). A tiny epsilon absorbs float noise such as 2.4999999999. */
export function rnd(x) {
  return x < 0 ? -Math.round(-x + EPS) : Math.round(x + EPS);
}

/** Floor with the same float-noise guard (5.999999999 -> 6). */
export function flr(x) {
  return Math.floor(x + EPS);
}

export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Fractions such as Ascendancy are kept at 6 decimals so 0.04 × 3 prints as 0.12. */
export function frac6(x) {
  return Math.round(x * 1e6) / 1e6;
}

/** Deep copy of plain JSON data (objects, arrays, primitives). Key order is preserved. */
export function deepClone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const n = v.length;
    const a = new Array(n);
    for (let i = 0; i < n; i++) a[i] = deepClone(v[i]);
    return a;
  }
  const o = {};
  for (const k in v) o[k] = deepClone(v[k]);
  return o;
}

/** Copy of a game state. `content` is shared (immutable data, never copied). */
export function cloneState(s) {
  const o = {};
  for (const k in s) o[k] = k === 'content' ? s[k] : deepClone(s[k]);
  return o;
}

/** Freeze a plain data tree in place (content is treated as immutable). */
export function deepFreeze(v) {
  if (v === null || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const k of Object.keys(v)) deepFreeze(v[k]);
  return v;
}

/** Error thrown for an illegal action. `code` = 'ILLEGAL_ACTION'. */
export class IllegalActionError extends Error {
  constructor(message, action) {
    super(message);
    this.name = 'IllegalActionError';
    this.code = 'ILLEGAL_ACTION';
    this.action = action;
  }
}

export function fail(msg) {
  throw new IllegalActionError(msg);
}
