// Player-facing presentation settings (animation speed, fast mode, screen shake, reduce motion, the Dev menu, the map new
// runs get: "Expedition map with start camp", a preview of expedition.md 2 and 9.1). Persisted in localStorage when
// available. Nothing here changes game rules: the map mode is a newRun option the engine already has.
import { emitter } from './util.js';

const KEY = 'tbwcr.ui.settings.v1';
const DEFAULTS = {
  speed: 1,            // animation speed multiplier: 1, 2, 4, or 0 = instant
  skipTravel: false,   // jump straight to the node
  autoDelay: 350,      // ms between autoplay rounds at speed 1
  showLog: true,       // combat log panel
  shake: true,         // screen shake on heavy hits
  speedrun: false,     // preset: instant animations, no travel, short autoplay delay
  reduceMotion: null,  // no screen shake, small recoil, no number slam; null follows the system's reduced-motion setting
  devTools: true,      // the Dev menu (dev-menu.js, engine-api.md 12): its corner button and the backquote key
  expeditionCamp: false, // new runs on the expedition map with the start camp (expedition.md 2, 9.1; a preview, off: classic map)
};

function load() {
  try {
    const raw = globalThis.localStorage && localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* storage blocked (sandbox / file://): use defaults */ }
  return { ...DEFAULTS };
}

const ev = emitter();
const state = load();
try {
  const sp = new URLSearchParams(location.search).get('speed');
  const n = sp === 'instant' ? 0 : Number(sp);
  if (sp !== null && [0, 1, 2, 4].includes(n)) state.speed = n;
} catch { /* no location */ }

export const settings = {
  get(k) { return state[k]; },
  all() { return { ...state }; },
  set(k, v) {
    state[k] = v;
    if (k === 'speedrun') {
      if (v) Object.assign(state, { speed: 0, skipTravel: true, autoDelay: 60 });
      else Object.assign(state, { speed: 1, skipTravel: false, autoDelay: DEFAULTS.autoDelay });
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    ev.emit('change', k, v);
  },
  on: ev.on,
  /** Scale a duration in ms by the animation speed (0 = instant). */
  dur(ms) { return state.speed === 0 ? 0 : ms / state.speed; },
  get instant() { return state.speed === 0; },
  /** Reduce motion: the player's choice, or the system's prefers-reduced-motion until the player chooses. */
  get reduceMotion() {
    if (state.reduceMotion != null) return !!state.reduceMotion;
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
  },
};
