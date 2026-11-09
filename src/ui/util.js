// Small shared helpers for the visual client (no game rules here).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

/** Deterministic visual randomness (art only, never game rules). */
export function prng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function strHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ------------------------------------------------------------------ colour
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = hexToRgb(a); const B = hexToRgb(b);
  return rgbToHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}
export const shade = (hex, amt) => (amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt));
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

// ------------------------------------------------------------------ DOM
/** h('div.cls#id', { attr, on: { click } , style: {} }, children...) */
export function h(tag, props, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag);
  const el = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { children.unshift(props); props = null; }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

// ------------------------------------------------------------------ formatting
export function fmtNum(n) {
  const s = String(Math.round(n));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
/** Copper -> parts; UI shows 100 c = 1 s, 100 s = 1 g (rules.md 0). */
export function moneyParts(copper) {
  const c = Math.max(0, Math.round(copper || 0));
  return { g: Math.floor(c / 10000), s: Math.floor((c % 10000) / 100), c: c % 100 };
}
export function moneyEl(copper, opts = {}) {
  const { g, s, c } = moneyParts(copper);
  const parts = [];
  const coin = (v, cls) => h('span.coin.' + cls, fmtNum(v));
  if (g) parts.push(coin(g, 'g'));
  if (g || s) parts.push(coin(s, 's'));
  if (!opts.short || !(g || s) || c) parts.push(coin(c, 'c'));
  return h('span.money', parts);
}
export function moneyText(copper) {
  const { g, s, c } = moneyParts(copper);
  return [g ? `${g} g` : '', g || s ? `${s} s` : '', `${c} c`].filter(Boolean).join(' ');
}
export const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)} %`;
export function hoursText(h) {
  const day = Math.floor(h / 24) + 1; const hr = h % 24;
  return { day, hour: hr, label: `Day ${day}, ${String((hr + 6) % 24).padStart(2, '0')}:00` };
}

/** Promise that resolves after ms; a skip token resolves it early. */
export function wait(ms, token) {
  if (!ms || ms <= 0 || (token && token.skipped)) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); if (token) token.waiters.delete(done); resolve(); }
    if (token) token.waiters.add(done);
  });
}
export class SkipToken {
  constructor() { this.skipped = false; this.waiters = new Set(); }
  skip() { this.skipped = true; for (const w of [...this.waiters]) w(); }
}

export function emitter() {
  const m = new Map();
  return {
    on(ev, fn) { if (!m.has(ev)) m.set(ev, new Set()); m.get(ev).add(fn); return () => m.get(ev).delete(fn); },
    emit(ev, ...a) { const s = m.get(ev); if (s) for (const fn of [...s]) fn(...a); },
  };
}

export const deepClone = (o) => (o === undefined ? o : structuredClone(o));
