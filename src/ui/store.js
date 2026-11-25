// The client's one door to localStorage (docs/specs/demo.md 2.4, D171): every tbwcr.* key the full game uses is read and
// written here. In the demo (the demo build, src/build-flags.js DEMO_BUILD; or C.GATES.demo, the team's ?demo=1 and the
// tests) a key tbwcr.X lives under DEMO_STORAGE_PREFIX + X (tbwcr.demo.X), so a team build opened on the same machine never
// mixes with it. Storage that throws or is missing (a private window, a blocked frame) is reported by `ok()`; reads then
// give null and writes do nothing (the game plays on without saving). `clearDemo()` removes every demo key (Settings,
// Start over). Presentation only: no rules here.
import { DEMO_BUILD } from '../build-flags.js';
import { GATES, DEMO_STORAGE_PREFIX } from '../constants.js';

const FULL_PREFIX = 'tbwcr.';
/** The demo's keys are in use: the demo build, or the demo switch on (?demo=1 in a team build, the tests). */
export const demoKeys = () => DEMO_BUILD || !!GATES.demo;
/** The stored name of a full-game key (tbwcr.X) now: tbwcr.demo.X in the demo, else the key itself. */
export function keyOf(k) {
  return demoKeys() && k.startsWith(FULL_PREFIX) && !k.startsWith(DEMO_STORAGE_PREFIX) ? DEMO_STORAGE_PREFIX + k.slice(FULL_PREFIX.length) : k;
}
const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export const store = {
  /** The stored string, or null (no value, no storage). */
  get(k) { try { const s = ls(); return s ? s.getItem(keyOf(k)) : null; } catch { return null; } },
  /** Store a string; false when storage refused it. */
  set(k, v) { try { const s = ls(); if (!s) return false; s.setItem(keyOf(k), v); return true; } catch { return false; } },
  remove(k) { try { const s = ls(); if (s) s.removeItem(keyOf(k)); } catch { /* storage blocked */ } },
  /** Storage works in this page: a test key can be written and removed (demo.md 2.4: else hero select says it cannot save). */
  ok() {
    try {
      const s = ls(); if (!s) return false;
      const t = keyOf('tbwcr.store.test');
      s.setItem(t, '1'); s.removeItem(t);
      return true;
    } catch { return false; }
  },
  /** Every demo key removed (demo.md 2.4, Start over); the full game's keys are never touched. */
  clearDemo() {
    try {
      const s = ls(); if (!s) return;
      const keys = [];
      for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(DEMO_STORAGE_PREFIX)) keys.push(k); }
      for (const k of keys) s.removeItem(k);
    } catch { /* storage blocked */ }
  },
};
