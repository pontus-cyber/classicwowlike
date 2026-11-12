// theme.js - one palette for JavaScript and canvas: the colour tokens of tokens.css, read from the page. Track R step R3
// (docs/reviews/ui-architecture-2026-11-12.md, section 3; D119). tokens.css is the only place a token's value is written;
// this module reads it, so the DOM and the canvas cannot disagree and a theme block (data-theme on <html>) reaches both.
//
//   token(name)      the value of a token ('--heat-clear' or 'heat-clear') under the theme now on <html>, as tokens.css
//                    writes it (hex or rgba()). Read with getComputedStyle once per theme and cached; the cache is cleared
//                    when data-theme on <html> changes. A name tokens.css does not define gives '' and one console error.
//   family(map)      a frozen object whose keys read their tokens when used: family({ clear: '--heat-clear' }).clear is
//                    token('--heat-clear') now. Nothing is read at import, so Node can import a module that uses one.
//   onTheme(fn)      fn(version) after a theme change cleared the cache (art-icons.js drops its cached icons)
//   themeVersion()   a number that changes with every theme change (for caches keyed by colour)
//
// The shared families (JavaScript only reads colours through these or token(); a value is never written here):
//   HEAT       the Furnace's four states (heat.js; the CSS heat rules use the same tokens)
//   CON        level difference: an enemy's level against the player's (hud.js conColor)
//   RARITY     item rarity (the same tokens as the CSS)
//   CAST       a spell's glow while it is cast and on its target, by school (director.js)
//   BOLT       projectiles by kind (scene.js)
//   IMPACT     the core and sparks of a hit, by school (scene.js)
//   ICON_BG    icon backgrounds, [light, deep] by school, material, rarity and danger (art-icons.js)
// Where a member has the exact value and the role of an older token it reads that token (frost: --school-frost-text,
// --school-frost); every other member has its own token in tokens.css with the value the code had before R3.

const cache = new Map();
const listeners = new Set();
const missing = new Set();
let version = 0;
let watching = false;

function watch() {
  if (watching) return;
  watching = true;
  try {
    new MutationObserver(() => { cache.clear(); version++; for (const fn of listeners) fn(version); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch { /* no document (Node) */ }
}

/** The value of a colour token under the current theme ('' when there is no page or no such token). */
export function token(name) {
  const n = name.startsWith('--') ? name : `--${name}`;
  const hit = cache.get(n);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return '';
  watch();
  const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  if (!v) {
    if (!missing.has(n)) { missing.add(n); console.error(`theme.js: no token ${n} in tokens.css`); }
    return '';
  }
  cache.set(n, v);
  return v;
}

/** A frozen object of lazy token reads: each key's value is token(map[key]) when it is used. */
export function family(map) {
  const o = Object.create(null);
  for (const [k, n] of Object.entries(map)) {
    Object.defineProperty(o, k, Array.isArray(n) ? { get: () => n.map(token), enumerable: true } : { get: () => token(n), enumerable: true });
  }
  return Object.freeze(o);
}

/** Call fn(version) after every theme change; returns a function that stops it. */
export function onTheme(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const themeVersion = () => version;

export const HEAT = family({ clear: '--heat-clear', warm: '--heat-warm', hot: '--heat-hot', scorched: '--heat-scorched' });
export const CON = family({ trivial: '--con-trivial', easy: '--con-easy', even: '--con-even', hard: '--con-hard', deadly: '--con-deadly' });
export const RARITY = family({ junk: '--r-junk', common: '--r-common', uncommon: '--r-uncommon', rare: '--r-rare', epic: '--r-epic' });
export const CAST = family({
  fire: '--fx-cast-fire', frost: '--school-frost-text', arcane: '--fx-cast-arcane', shadow: '--fx-cast-shadow',
  nature: '--fx-cast-nature', magic: '--fx-cast-magic', phys: '--fx-cast-phys',
});
export const BOLT = family({
  fire: '--fx-bolt-fire', frost: '--school-frost-text', arcane: '--fx-bolt-arcane', shadow: '--fx-bolt-shadow',
  nature: '--fx-bolt-nature', comet: '--fx-bolt-comet', phys: '--fx-bolt-phys', arrow: '--fx-bolt-arrow', arrowLight: '--fx-bolt-arrow-light',
});
export const IMPACT = family({
  phys: '--fx-impact-phys', fire: '--fx-impact-fire', frost: '--school-frost', arcane: '--fx-impact-arcane',
  shadow: '--fx-impact-shadow', nature: '--fx-impact-nature', heal: '--fx-impact-heal',
});
// 'danger' is the Deathblow, MAIMED and EMPOWERED (R4), apart from 'blood' (damage); same values in the current look
const ICON_KEYS = ['steel', 'blood', 'danger', 'shadow', 'gold', 'fire', 'frost', 'arcane', 'nature', 'heal', 'poison', 'earth', 'dark',
  'parchment', 'junk', 'common', 'uncommon', 'rare', 'epic'];
export const ICON_BG = family(Object.fromEntries(ICON_KEYS.map((k) => [k, [`--icon-${k}`, `--icon-${k}-deep`]])));
