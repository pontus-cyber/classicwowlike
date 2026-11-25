// Player-facing presentation settings (animation speed, fast mode, screen shake, reduce motion, the Dev menu) and the Dev
// menu's "Classic map (old)": the map new runs get. Since D116 new runs start on the expedition map with the start camp
// (expedition.md 2, 9.1); the classic map is kept for testing, in the Dev menu only. Persisted in localStorage when
// available. Nothing here changes game rules: the map mode is a newRun option the engine already has. Sound (audio.js,
// docs/specs/audio.md; D127): master, effects and interface volumes and mute, on at 70 % / 60 % UI after the first gesture.
// The colour theme (data-theme, ?theme=) and the art style (data-art, ?art=; the Lantern proof slice) are set on <html> here.
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
  classicMap: false,   // Dev menu: new runs on the classic map (old, rules 1.4); off: the expedition map with the start camp (D116)
  lanternTheme: false, // Dev menu: the Lantern colour theme, a proposal (docs/art/proposal-1; D120, D121); off: the current look
  lanternArt: false,   // Dev menu: the Lantern Gouache proof slice, a proposal (docs/art/proof-slice-2026-11-25.md; D121, MD D.4)
  soundMaster: 0.7,    // sound (audio.js): master volume 0..1
  soundSfx: 1,         // effects bus
  soundUi: 0.6,        // interface bus: clicks, windows, errors
  soundMuted: false,
};

function load() {
  try {
    const raw = globalThis.localStorage && localStorage.getItem(KEY);
    if (raw) { const s = { ...DEFAULTS, ...JSON.parse(raw) }; delete s.expeditionCamp; return s; } // the preview setting before D116
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
// The colour theme: data-theme on <html> picks the block of tokens.css; no attribute is the current look. ?theme=lantern or
// ?theme=current wins for this page and is not saved; the Dev menu's switch (the lanternTheme setting) takes over when used.
let urlTheme = null;
try { const t = new URLSearchParams(location.search).get('theme'); if (t === 'lantern' || t === 'current') urlTheme = t; } catch { /* no location */ }
function applyTheme() {
  const theme = urlTheme || (state.lanternTheme ? 'lantern' : 'current');
  try { if (theme === 'lantern') document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme; } catch { /* no document (Node) */ }
}
applyTheme();
// The art style: data-art="lantern" on <html> turns on the Lantern Gouache proof slice (docs/art/proof-slice-2026-11-25.md,
// draft): painted actors and zone 1-2 backdrops on the canvas, the painted chart, the camp at dusk, and red kept for danger.
// It is apart from the colour theme: the HUD keeps today's dark panels (D129). No attribute is today's look. ?art=lantern or
// ?art=current wins for this page and is not saved; the Dev menu's switch (the lanternArt setting) takes over when used.
let urlArt = null;
try { const a = new URLSearchParams(location.search).get('art'); if (a === 'lantern' || a === 'current') urlArt = a; } catch { /* no location */ }
function applyArt() {
  const art = urlArt || (state.lanternArt ? 'lantern' : 'current');
  try { if (art === 'lantern') document.documentElement.dataset.art = art; else delete document.documentElement.dataset.art; } catch { /* no document (Node) */ }
}
applyArt();

export const settings = {
  get(k) { return state[k]; },
  all() { return { ...state }; },
  set(k, v) {
    state[k] = v;
    if (k === 'lanternTheme') { urlTheme = null; applyTheme(); }
    if (k === 'lanternArt') { urlArt = null; applyArt(); }
    if (k === 'speedrun') {
      if (v) Object.assign(state, { speed: 0, skipTravel: true, autoDelay: 60 });
      else Object.assign(state, { speed: 1, skipTravel: false, autoDelay: DEFAULTS.autoDelay });
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    ev.emit('change', k, v);
  },
  on: ev.on,
  /** The colour theme on screen: 'lantern' or 'current'. */
  get theme() { return urlTheme || (state.lanternTheme ? 'lantern' : 'current'); },
  /** The art style on screen: 'lantern' (the proof slice) or 'current'. */
  get art() { return urlArt || (state.lanternArt ? 'lantern' : 'current'); },
  /** Scale a duration in ms by the animation speed (0 = instant). */
  dur(ms) { return state.speed === 0 ? 0 : ms / state.speed; },
  get instant() { return state.speed === 0; },
  /** Reduce motion: the player's choice, or the system's prefers-reduced-motion until the player chooses. */
  get reduceMotion() {
    if (state.reduceMotion != null) return !!state.reduceMotion;
    try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
  },
};
