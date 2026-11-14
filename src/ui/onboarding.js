// M3 onboarding (docs/specs/m3-onboarding.md 2.4-2.7, 3, 4.3; U1, U2, U4, U6, U7; D135-D139): the coach line, the guided
// run's beat lines, the 37 first-time hints and the Packed Satchel nudge. Presentation only: the beats are the engine's
// (R.tutorialView `line`, `beat` events; engine-api.md 14), the hints and their seen state are the UI's
// (localStorage HINTS_KEY: { off, seen: { id: true }, nudge }). Lines come from the content table (src/content/tutorial.js,
// through the bridge's data.tutorial) with {placeholders} filled from the UI's key map and the engine's numbers.
//
// The coach line: one parchment strip at one place (bottom centre, over the action bar's control row; above whatever it
// would cover: the anchor, the bar, the engage panel, the Furnace, the target frame, Set out), an arrow towards its anchor
// and a soft ring on the anchor, "Got it", and "Skip guide" (guided run; a one-line confirm) or "Hints off". One at a time:
// a higher priority line (Deathblow > wind-up > lethal > potion > engage > the rest) takes the place; a hint that waits
// more than one step is dropped unseen; at most one new hint per step and ONB_HINTS_PER_FIGHT per fight. A line counts as
// seen when dismissed, done, or gone after ONB_HINT_MIN_MS on screen. Autoplay and fast mode never wait for a line.
// D142 (QA playtest 2026-11-13): a hint also counts as seen at its ONB_HINT_SHOWS-th showing, however short each was (a beat
// line's showing is a showing of the hint it stands in for); while a line is up, body.coach-up hides the turn prompt's
// "Opening move" line (style.css); the key chips follow the view: G3's key is the first bar spell that can be cast now
// (a Rogue's finisher in slot 1 cannot open a fight), and an engage option that takes a spell (the Mage's Pre-cast) names
// both keys, Q then the spell's key.
// D143 (M3 3.7, the Roads wait for Gorrak's fight; engine-2026-11-13c section 2) and the blind panel of 2026-11-13: while a
// walk, a travel or a fight's entry plays (ui.overlay) the coach line holds (no new line, the one up is out of sight); a map
// line (MAP_LINES: G2, G12, G13, G13.closed) waits until the map is the screen shown (after Set out, "Click a lit node" came
// during the walk out, before the map showed); G13.closed points at Gorrak's node (tutorialView.roads.node); G10 points at
// what its screen shows (the nearest site node on the map, the contract's tracker row in a fight); the closed line does not
// count for the Bell's hint H19; a toast says when the Roads open. ONB_HINT_SHOWS lives in src/constants.js (the bridge's
// data.tutorial.rules.hintShows).
// D147 (engine-2026-11-14 UI needs 1-2; m3-onboarding.md 2.6, 2.8): when ONB_RESCUE_MAX rescues end the guide (event
// guideSkipped, why 'rescues') a toast and the log say content guide.rescueCapLine, not the skip line; G8's joint line with
// G7 (G8.withEngage, S3's engage round) points at the engage panel's W button with a second marker on the wind-up badge,
// and counts for both beats' hints, H01 and H03 (LINE_BEATS).
import { h } from './util.js';
import { settings } from './settings.js';

export const HINTS_KEY = 'tbwcr.hints.v2';
const OLD_ENGAGE_KEY = 'tbwcr.hints.v1'; // the engage hint, per class (retired: H01)
const OLD_HEAT_KEY = 'tbwcr.heatIntro.v1'; // the Furnace note (retired: H16)
/** The UI's key map for the content's key placeholders (app.js onKey). */
export const KEYS = { key_spell1: '1', key_engage1: 'Q', key_engage2: 'W', key_engage3: 'E', key_pass: 'X', key_item1: '8', key_take_all: 'Space', key_bags: 'B', key_talents: 'N', key_spellbook: 'P', key_autoplay: 'Z', key_flee: 'F' };
const PER_CLASS = new Set(['H01', 'H04', 'H33', 'H34']);
// the hints a beat stands in for while the guide runs (spec 3.2 "Beat"), and the hints a beat's line marks seen
const BEAT_OF = { H01: 'G7', H02: 'G6', H03: 'G8', H04: 'G9', H06: 'G9', H09: 'G11', H11: 'G4', H15: 'G2', H16: 'G5', H18: 'G12', H19: 'G13', H20: 'G10', H21: 'G10', H23: 'G1', H30: 'G9' };
const HINT_OF_BEAT = { G1: 'H23', G2: 'H15', G4: 'H11', G5: 'H16', G6: 'H02', G7: 'H01', G8: 'H03', G9: 'H04', G10: 'H20', G11: 'H09', G12: 'H18', G13: 'H19' };
// priority (spec 2.5): Deathblow > wind-up > lethal > potion > engage > the rest
const PRIO = { G9: 6, H04: 6, G8: 5, H03: 5, H07: 4, G11: 3, H09: 3, H10: 3, G7: 2, H01: 2, H27: 2, NUDGE: 7 };
const prio = (id) => PRIO[id] || 1;
const FIGHT_BEATS = new Set(['G3', 'G6', 'G7', 'G8', 'G9', 'G11']); // beats whose line belongs to a fight on screen
// beat lines that belong to the expedition map on screen (QA playtest 2026-11-13: G12 showed over a quest dialog, with no
// Dimming in view): they wait until the map is the screen shown (mapShown). Blind panel 2026-11-13: G2 ("Click a lit node")
// came while the hero walked out of the hub, before the map showed. D143: G13.closed (it points at Gorrak's node). G10 is
// no map line (engine-2026-11-13c finding 2: as one it is never the top line on the autoplay route, whose first move enters
// a site): it shows where the engine has it, at the site's dialog or in its fight, its arrow at the contract's tracker row
export const MAP_LINES = new Set(['G2', 'G12', 'G12.caught', 'G13', 'G13.onRoad', 'G13.closed']);
/** Beat lines that stand for no hint (D143: the closed line is about Gorrak, not the Bell, so it does not make H19 seen). */
const NO_HINT_LINES = new Set(['G13.closed']);
/**
 * Beat lines that stand for more than their own beat (D147, m3-onboarding.md 2.8 item 2): G8's joint line is G7's engage-round
 * line and G8's wind-up line in one ("Both beats count as shown"), so its showings, its Got it and its rest count for H01
 * and H03. Learning stays per beat (the engine's `done` events: G7 on any ENGAGE, G8 on the wind-up answered).
 */
export const LINE_BEATS = { 'G8.withEngage': ['G7', 'G8'] };
/** The hints a beat line stands in for (pure; spec 3.2 "Beat"): its beat's hint, both beats' for a joint line, none for a closed line. */
export function lineHints(id, line = null) {
  if (NO_HINT_LINES.has(line)) return [];
  return (LINE_BEATS[line] || [id]).map((b) => HINT_OF_BEAT[b]).filter(Boolean);
}
/** The log line when the guide is skipped (draft; content has none): the Skip guide link, or a skip from Settings. */
export const SKIP_LINE = 'You skip the guide. New things get one hint each.';
/**
 * What the game says when the guide ends early (pure; event `guideSkipped`): content guide.rescueCapLine when the
 * ONB_RESCUE_MAX-th rescue ended it (D147: why 'rescues'), else SKIP_LINE.
 */
export function guideSkippedLine(e, T, num = {}) {
  const raw = e && e.why === 'rescues' && T && T.guide ? T.guide.rescueCapLine : null;
  return raw ? lineParts(raw, num).map((x) => (typeof x === 'string' ? x : x.key)).join('') : SKIP_LINE;
}
/** Hint lines that leave their hint unseen (D144: H05's shield line; the plain line is still to be taught). */
const UNSEEN_ALT = { H05: new Set(['shield']) };
const leavesUnseen = (x) => !!(x && x.kind === 'hint' && UNSEEN_ALT[x.id] && UNSEEN_ALT[x.id].has(x.alt));
const BOTTOM_REM = 14.8; // the coach line's place: its bottom edge over the action bar's control row (1366x768: y 620)
/** D143, draft (no content line yet): the toast when the guided zone's Roads open. */
export const ROADS_OPEN_LINE = 'The Roads are open: take one on to the next zone.';

// ------------------------------------------------------------------ the hint store (spec 3.1)
function readJson(k) { try { const x = JSON.parse(localStorage.getItem(k) || 'null'); return x && typeof x === 'object' ? x : null; } catch { return null; } }
/**
 * The stored hints, with the v1 keys moved over on first load (tbwcr.hints.v1 engage: H01 per class; heatIntro: H16):
 * { off, seen: { key: true }, nudge, shows: { key: showings so far } (D142), stats: { won, auto } (H31) }.
 */
export function loadHints() {
  let x = readJson(HINTS_KEY);
  if (!x) {
    x = { off: false, seen: {}, nudge: { summary: 0, hall: false }, shows: {} };
    const old = readJson(OLD_ENGAGE_KEY);
    for (const [cls, on] of Object.entries((old && old.engage) || {})) if (on) x.seen[`H01:${cls}`] = true;
    try { if (localStorage.getItem(OLD_HEAT_KEY)) x.seen.H16 = true; } catch { /* storage blocked */ }
    saveHints(x);
  }
  return { off: !!x.off, seen: { ...(x.seen || {}) }, nudge: { summary: 0, hall: false, ...(x.nudge || {}) }, shows: { ...(x.shows || {}) }, stats: { ...(x.stats || {}) } };
}
export function saveHints(x) { try { localStorage.setItem(HINTS_KEY, JSON.stringify(x)); } catch { /* storage blocked: kept for this page */ } }
export const hints = {
  state: null,
  /** Showings after which a hint counts as seen (ONB_HINT_SHOWS, src/constants.js, through the bridge; set by createOnboarding). */
  need: null,
  get() { if (!this.state) this.state = loadHints(); return this.state; },
  save() { saveHints(this.get()); },
  seen(id) { return !!this.get().seen[id]; },
  mark(id) { if (!id || this.get().seen[id]) return; this.get().seen[id] = true; this.save(); },
  /** D142 (3): one more showing of a hint; at its ONB_HINT_SHOWS-th it counts as seen, however short each showing was. */
  noteShown(id, need = this.need) {
    if (!id) return;
    const s = this.get();
    if (s.seen[id]) return;
    s.shows[id] = (s.shows[id] || 0) + 1;
    if (need > 0 && s.shows[id] >= need) s.seen[id] = true;
    this.save();
  },
  get off() { return this.get().off; },
  setOff(on) { this.get().off = !!on; this.save(); },
  /** Settings "Reset hints": every hint shows again (the nudge too; the showings count from zero). */
  reset() { const s = this.get(); s.seen = {}; s.shows = {}; s.nudge = { summary: 0, hall: false }; this.save(); },
  /** Dev menu "Reset onboarding": the hint store as on a new profile (tbwcr.hints.v2 and the retired v1 keys removed; hints on). */
  clear() {
    for (const k of [HINTS_KEY, OLD_ENGAGE_KEY, OLD_HEAT_KEY]) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } }
    this.state = null; this.get();
  },
};

// ------------------------------------------------------------------ lines
/**
 * A content line's parts with its placeholders filled (pure): strings, and { key } for each key chip. keys: the key map
 * (KEYS with the view's keys over it, lineKeys); a key given as a list is pressed in turn ("Q then 1"). Unknown placeholders
 * stay visible.
 */
export function lineParts(raw, num = {}, keys = KEYS) {
  const out = [];
  String(raw || '').split(/(\{[a-zA-Z0-9_]+\})/).forEach((part) => {
    const m = /^\{([a-zA-Z0-9_]+)\}$/.exec(part);
    if (!m) { if (part) out.push(part); return; }
    const k = keys[m[1]] || KEYS[m[1]];
    if (k) { (Array.isArray(k) ? k : [k]).forEach((x, i) => { if (i) out.push(' then '); out.push({ key: x }); }); return; }
    out.push(num[m[1]] != null ? String(num[m[1]]) : part);
  });
  return out;
}
/** A content line with its placeholders filled: { text, nodes } (keys as key chips). */
export function fillLine(raw, num = {}, keys = KEYS) {
  const parts = lineParts(raw, num, keys);
  return { text: parts.map((x) => (typeof x === 'string' ? x : x.key)).join(''), nodes: parts.map((x) => (typeof x === 'string' ? x : h('span.kbd', x.key))) };
}
/**
 * The bar slot (0-6) of the first spell that can be cast now (`legal.spells` ok), one cast on an enemy first (spells: the
 * bridge's data.spells, for `target`); -1 outside a fight or with none (pure). QA playtest 2026-11-13 (finding 5): a Rogue
 * whose slot 1 holds Severing Flourish (a finisher: no combo points in round 1) was told "Press 1" and nothing happened.
 */
export function attackSlot(v, spells = null) {
  const p = v && v.player; const c = v && v.combat;
  if (!p || !c || c.over) return -1;
  const L = (v.legal && v.legal.spells) || {};
  const ok = (id) => !!(id && L[id] && L[id].ok);
  const i = p.bar.findIndex((id) => ok(id) && (!spells || !spells[id] || spells[id].target === 'enemy'));
  return i >= 0 ? i : p.bar.findIndex(ok);
}
/**
 * The key placeholders that follow the view (pure; D142 (4)): {key_spell1} names attackSlot's key; {key_engage1} names
 * two keys when the first engage option takes a spell (the Mage's Pre-cast: Q arms it, then the spell's bar key, app.js).
 */
export function lineKeys(v, spells = null) {
  const out = {};
  const i = attackSlot(v, spells);
  if (i >= 0) out.key_spell1 = String(i + 1);
  const c = v && v.combat && !v.combat.over ? v.combat : null;
  const o = c && c.engage ? c.engage.options[0] : null;
  if (o && o.spells && o.spells.length && !o.reason && v.player) {
    const j = v.player.bar.findIndex((id) => id && o.spells.some((x) => x.spellId === id));
    if (j >= 0) out.key_engage1 = [KEYS.key_engage1, String(j + 1)];
  }
  return out;
}
/** The raw content line of a coach line id: G<n> (the beat's line), G<n>.<key> (alt / byClass), H<nn> (the hint). */
export function rawLine(T, id, cls, alt) {
  if (!T || !id) return null;
  const [base, key] = id.split('.');
  if (base[0] === 'G') {
    const b = T.beats.find((x) => x.id === base); if (!b) return null;
    if (!key) return b.line || (b.byClass ? b.byClass[cls] : null) || null;
    return (b.alt && b.alt[key]) || (b.byClass && b.byClass[key]) || null;
  }
  const x = T.hints.find((y) => y.id === base); if (!x) return null;
  if (x.sameAs) return rawLine(T, alt ? `${x.sameAs}.${alt}` : x.sameAs === 'G9' ? `G9.${cls}` : x.sameAs, cls);
  // a hint's own other line (D144: H05 alt.shield), by `alt` or as H05.shield
  const k = alt || key;
  return (k && x.alt && x.alt[k]) || x.line || null;
}

// ------------------------------------------------------------------ anchors
const q = (sel) => { for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && !el.closest('.hidden')) return el; } return null; };
const npOf = (pred) => (v) => { const c = v.combat; if (!c) return null; const e = c.enemies.find((x) => x.alive && !x.hidden && pred(x)); return e ? q(`#nameplates .np[data-idx="${e.idx}"] .trk`) || q('#nameplates .np .trk') : null; };
const itemSlot = (v, pick) => { const L = (v.legal && v.legal.items) || []; const i = L.findIndex(pick); return i >= 0 ? q(`#actionbar .ab[data-islot="${i}"]`) : q('#actionbar .ab[data-islot="0"]'); };
const nodeEl = (v, pred) => { const mv = v.zone && v.zone.exp; if (!mv) return null; const n = mv.nodes.find((x) => pred(x, mv)); return n ? q(`#screens .mnode[data-node="${n.id}"]`) : null; };
/** The zone map is the screen shown (shown: the view on screen, app.shown) and no walk, travel or fight entry plays over it. */
const mapShown = (ui, shown) => !(ui && ui.overlay) && !!shown && onMap(shown);
/** D143: the map node of the nearest contract site with a mark in view (a reachable one first, then fewest hops). */
const siteNodeEl = (v) => {
  const mv = v.zone && v.zone.exp; if (!mv) return null;
  const reach = new Set((mv.moves || []).map((m) => m.nodeId));
  const sites = mv.nodes.filter((n) => n.sites && n.sites.length && !n.done).sort((a, b) => (reach.has(b.id) - reach.has(a.id)) || ((a.hops ?? 99) - (b.hops ?? 99)));
  for (const n of sites) { const el = q(`#screens .mnode[data-node="${n.id}"]`); if (el) return el; }
  return q('#screens .mnode .xsite');
};
const entries = (v) => (v.combat && !v.combat.over ? v.combat.enemies.filter((e) => e.alive && !e.hidden).flatMap((e) => (e.track || []).map((x) => ({ e, x }))) : []);
const ANCHOR = {
  G1: () => q('#prep .pp-card'), G2: () => q('#screens .mnode.here'), G3: (v, d) => q(`#actionbar .ab[data-slot="${Math.max(0, attackSlot(v, d && d.spells))}"]`), G4: () => q('#screens .dialog'),
  G5: () => q('#heat'), G6: npOf((e) => (e.track || []).some((x) => x.heavy || x.cast)), G7: () => q('#engage'),
  G8: () => q('#nameplates .wub:not(.db)') || q('#nameplates .tk.wu'), G9: () => q('#nameplates .wub.db') || q('#engage .eg-db'),
  G10: (v) => (v.loot ? q('#screens .dialog') : inFight(v) ? (document.body.classList.contains('engage-round') ? null : q('#tracker .tk-c[data-status="active"]')) : onMap(v) ? siteNodeEl(v) : q('#screens .dialog')), G11: (v) => itemSlot(v, (x) => x && x.heal > 0), G12: () => q('#screens .xdimp'),
  // the Road's button on a Road, else the Bell's (the header's first button can be the Spyglass)
  G13: (v) => (v.zone && v.zone.exp && v.zone.exp.onRoad ? q('#screens .mhead .btn[data-leave="TAKE_ROAD"]') : null) || q('#screens .mhead .btn[data-leave="RING_BELL"]') || q('#screens .mhead .btn') || q('#screens .mnode.here'),
};
/**
 * Anchors of single lines of a beat. D143: G13.closed at Gorrak's node, whose fight opens the Roads (tutorialView.roads.node).
 * D147 (m3-onboarding.md 2.8 item 2): G8's joint line at the engage panel's W button (key_engage2: each class's control
 * option, which answers a normal enemy's wind-up; tracks.js marks each card with its key); once the engage round is over
 * (the engine keeps the line until the wind-up is answered or lands, or the fight ends) at the wind-up badge, G8's own.
 */
const LINE_ANCHOR = {
  'G13.closed': (v) => { const t = v.tutorial; const id = t && t.roads && t.roads.node != null ? t.roads.node : t && t.elite ? t.elite.node : null; return id == null ? null : q(`#screens .mnode[data-node="${id}"]`); },
  'G8.withEngage': (v, d) => q(`#engage .eg-opt[data-key="${KEYS.key_engage2}"]`) || ANCHOR.G8(v, d),
};
/** Second markers of single lines (D147, spec 2.8 item 2): G8's joint line also rings the wind-up badge (class coach-also). */
const LINE_ALSO = { 'G8.withEngage': ANCHOR.G8 };
// ------------------------------------------------------------------ the 37 hints (spec 3.2): trigger, anchor, moment, done
// ctx: 'fight' (gone when the fight ends or two rounds on), 'map' (gone at the next map step), else 'screen' (gone when
// `when` no longer holds). Each `when` reads the view, the step's events (ev) and the UI.
const inFight = (v) => !!(v.combat && !v.combat.over && !v.loot);
const onMap = (v) => v.phase === 'MAP' && !!(v.zone && v.zone.exp) && !v.node;
const seenNode = (v, pred) => { const mv = v.zone && v.zone.exp; return !!(mv && onMap(v) && mv.nodes.some((n) => n.know && n.know !== 'none' && pred(n))); };
const has = (ev, t, f) => ev.some((e) => e.t === t && (!f || f(e)));
const status = (u, id) => !!(u && (u.statuses || []).some((s) => s.id === id));
const HINTS = {
  H01: { ctx: 'fight', when: (c) => inFight(c.v) && !!c.v.combat.engage && c.v.combat.kind !== 'dboss', anchor: () => q('#engage'), done: (c) => c.a === 'ENGAGE', gone: (c) => !(c.v.combat && c.v.combat.engage) },
  H02: { ctx: 'fight', when: (c) => inFight(c.v) && entries(c.v).length > 0, anchor: npOf(() => true) },
  H03: { ctx: 'fight', when: (c) => entries(c.v).some(({ x }) => x.windup && !x.deathblow), anchor: ANCHOR.G8, done: (c) => has(c.ev, 'windup', (e) => e.result === 'answered' && !e.deathblow) },
  H04: { ctx: 'fight', when: (c) => entries(c.v).some(({ x }) => x.deathblow), anchor: ANCHOR.G9, done: (c) => has(c.ev, 'windup', (e) => e.result === 'answered' && e.deathblow) },
  // D144 (engine-2026-11-13d UI need 2): the off-balance enemy's shield would take the whole hit (offBalance.absorbs): the
  // shield line ("break it, then spend your big hit"), and H05 stays unseen so the plain line is taught in a later window
  H05: { ctx: 'fight', when: (c) => inFight(c.v) && c.v.combat.enemies.some((e) => e.alive && e.offBalance), anchor: () => q('#target-frame .obal') || q('#target-frame'),
    alt: (c) => (c.v.combat.enemies.some((e) => e.alive && e.offBalance && e.offBalance.absorbs) ? 'shield' : undefined) },
  H06: { ctx: 'fight', when: (c) => inFight(c.v) && status(c.v.player, 'MAIMED'), anchor: () => q('#player-frame .maimb') || q('#player-frame') },
  H07: { ctx: 'fight', when: (c) => inFight(c.v) && !!q('#nameplates .db-lethal, #engage .db-lethal'), anchor: () => q('#nameplates .db-lethal') || q('#engage .db-lethal') },
  H08: { ctx: 'fight', when: (c) => inFight(c.v) && c.v.combat.enemies.some((e) => e.alive && e.dot && (e.dot.total || e.dot.amount || e.dot.ticks)), anchor: () => q('#target-frame .bar.hp') },
  H09: { ctx: 'fight', when: (c) => inFight(c.v) && c.v.player.hp < c.r.potionHp * c.v.player.maxHp && ((c.v.legal && c.v.legal.items) || []).some((x) => x && x.ok && x.heal > 0), anchor: (v) => itemSlot(v, (x) => x && x.ok && x.heal > 0), done: (c) => c.a === 'USE_ITEM' },
  H10: { ctx: 'fight', when: (c) => inFight(c.v) && ((c.v.legal && c.v.legal.items) || []).some((x) => x && x.free), anchor: (v) => itemSlot(v, (x) => x && x.free), done: (c) => c.a === 'USE_ITEM' },
  H11: { ctx: 'screen', when: (c) => !!(c.v.loot && c.v.loot.kind === 'loot' && (c.v.loot.items || []).length), anchor: () => q('#screens .dialog'), done: (c) => c.a === 'LOOT_TAKE_ALL' || c.a === 'LOOT_EQUIP' },
  H12: { ctx: 'map', when: (c) => has(c.ev, 'levelUp', (e) => (e.newSpells || []).length > 0), anchor: () => q('#screens .mnode.xhub') || q('#minimap') },
  H13: { ctx: 'map', when: (c) => has(c.ev, 'learn', (e) => c.v.player && !c.v.player.bar.includes(e.id)), anchor: () => q('#actionbar'), done: (c) => c.a === 'SET_BAR' },
  H14: { ctx: 'screen', when: (c) => !inFight(c.v) && !!c.v.player && c.v.player.talentPoints > 0, anchor: () => q('#micromenu .mm[aria-label="Talents"]'), done: (c) => c.a === 'SPEND_TALENT' },
  H15: { ctx: 'map', when: (c) => onMap(c.v), anchor: () => q('#screens .mnode.here') },
  H16: { ctx: 'map', when: (c) => onMap(c.v) && !!c.v.heat && c.v.zone.exp.nodes.some((n) => n.done && !n.hub), anchor: () => q('#heat') },
  H17: { ctx: 'screen', when: (c) => !!(c.v.node && (c.v.node.heat === 'hot' || c.v.node.heat === 'scorched')), anchor: () => q('#heat') },
  H18: { ctx: 'map', when: (c) => seenNode(c.v, (n) => n.dimmed), anchor: () => q('#screens .xdimp') },
  H19: { ctx: 'map', when: (c) => onMap(c.v) && bellMoment(c.v) !== null, anchor: ANCHOR.G13, alt: (c) => bellMoment(c.v), done: (c) => c.a === 'TAKE_ROAD' || c.a === 'RING_BELL' },
  H20: { ctx: 'map', when: (c) => onMap(c.v) && !!q('#screens .mnode .xsite'), anchor: () => q('#screens .mnode .xsite') },
  H21: { ctx: 'screen', when: (c) => !!(c.v.loot && c.v.loot.kind === 'contract'), anchor: () => q('#screens .dialog') },
  H22: { ctx: 'screen', when: (c) => c.v.phase === 'ZONE_HUB' && !c.v.node && !!q('#screens .hub-contract, #screens [data-hub-offer]'), anchor: () => q('#screens .hub-contract, #screens [data-hub-offer]') },
  H23: { ctx: 'screen', when: (c) => c.v.phase === 'PREP', anchor: () => q('#prep .pp-foot .pp-pts') || q('#prep .pp-foot') },
  H24: { ctx: 'map', when: (c) => seenNode(c.v, (n) => n.type === 'elite' && !n.done), anchor: (v) => nodeEl(v, (n) => n.type === 'elite' && n.know !== 'none' && !n.done) },
  H25: { ctx: 'fight', when: (c) => inFight(c.v) && c.v.combat.enemies.some((e) => e.alive && (e.rare || e.rank === 'rare')), anchor: () => q('#target-frame') },
  H26: { ctx: 'map', when: (c) => seenNode(c.v, (n) => n.type === 'dungeon' && !n.done), anchor: (v) => nodeEl(v, (n) => n.type === 'dungeon' && n.know !== 'none' && !n.done) },
  H27: { ctx: 'fight', when: (c) => inFight(c.v) && !!c.v.combat.engage && c.v.combat.kind === 'dboss', anchor: () => q('#engage'), done: (c) => c.a === 'ENGAGE' },
  H28: { ctx: 'screen', when: (c) => !!q('#screens .vendor-cols'), anchor: () => q('#screens .vendor-cols') },
  H29: { ctx: 'map', when: (c) => seenNode(c.v, (n) => n.type === 'rest' && !n.done), anchor: (v) => nodeEl(v, (n) => n.type === 'rest' && n.know !== 'none' && !n.done) },
  H30: { ctx: 'fight', when: (c) => inFight(c.v) && !!q('#actionbar .ctrl .btn.db-now, #actionbar .ctrl .btn.ans'), anchor: () => q('#actionbar .ctrl .btn.db-now, #actionbar .ctrl .btn.ans'), done: (c) => c.a === 'PASS' },
  H31: { ctx: 'fight', when: (c) => inFight(c.v) && c.v.combat.round <= 1 && !c.v.autoplay && (c.store.stats || {}).won >= c.r.autoplayAfter && !(c.store.stats || {}).auto, anchor: () => q('#actionbar .ctrl .toggle'), done: (c) => c.a === 'SET_AUTOPLAY' },
  H32: { ctx: 'fight', when: (c) => inFight(c.v) && !c.v.combat.isBoss && !!(c.v.legal && c.v.legal.flee) && c.v.player.hp < c.r.fleeHp * c.v.player.maxHp, anchor: () => [...document.querySelectorAll('#actionbar .ctrl .btn')].find((b) => /Flee/.test(b.textContent)) || null, done: (c) => c.a === 'FLEE' },
  H33: { ctx: 'fight', when: (c) => inFight(c.v) && !!(c.v.player.pet && c.v.player.pet.alive), anchor: () => q('#pet-frame') },
  H34: { ctx: 'fight', when: (c) => inFight(c.v) && status(c.v.player, 'STEALTH'), anchor: () => q('#player-frame .statuses') || q('#player-frame') },
  H35: { ctx: 'screen', when: (c) => c.v.phase === 'CAMP' && !c.v.node && !c.v.combat, anchor: () => q('#screens .title') },
  H36: { ctx: 'fight', when: (c) => inFight(c.v) && !!c.v.combat.isBoss, anchor: () => q('#boss-frame') },
  H37: { ctx: 'screen', when: (c) => c.ui.metaOpen && c.v.phase === 'CREATE' && !c.nudgeHall, anchor: () => q('#meta .mbal') },
};
/** G13 / H19's moment on the map: 'onRoad' on a Road, '' (the far line) far from every Road with the node dimming soon, else null. */
function bellMoment(v) {
  const mv = v.zone && v.zone.exp; if (!mv) return null;
  const me = mv.nodes[mv.pos]; if (!me || me.hub) return null;
  if (me.road) return 'onRoad';
  const near = (mv.moves || []).some((m) => mv.nodes[m.nodeId] && mv.nodes[m.nodeId].road);
  return !near && Number.isFinite(me.dimsIn) && me.dimsIn <= 4 ? '' : null;
}

// ------------------------------------------------------------------ the coach line
export function createOnboarding(root, ctx) {
  const T = ctx.data.tutorial ? ctx.data.tutorial.table : null;
  const num = ctx.data.tutorial ? ctx.data.tutorial.num : {};
  const r = ctx.data.tutorial ? ctx.data.tutorial.rules : { hintMinMs: 1500, hintsPerFight: 2, queueMax: 2, potionHp: 0.5, fleeHp: 0.25, autoplayAfter: 5 };
  const okBtn = h('button.co-ok', { type: 'button', title: 'Got it' }, 'Got it');
  const skipBtn = h('button.co-skip', { type: 'button' });
  const textEl = h('span.co-t');
  const arrow = h('i.co-arrow');
  const el = h('div#coach.hidden', { role: 'status', 'aria-live': 'polite' }, arrow, textEl, okBtn, skipBtn);
  root.appendChild(el);
  let cur = null; // { id, key, kind: 'beat'|'hint'|'nudge'|'confirm', text, anchorFn, anchorEl, alsoFn, alsoEl, at, step, fight, round, moment, lineId }
  let queue = []; // hints waiting: { id, key, step, ... }
  let stepNo = 0;
  let fightNo = 0; let fightHints = 0; let lastHintStep = -1;
  const dismissed = new Set(); // beat line ids put away with Got it (shown again when the engine opens the line anew)
  const cool = new Map(); // hint key -> moment key it was dropped in (no second try in the same moment)
  const log = []; // test hook: every line shown { id, text, kind, step, at }
  let confirm = false;
  let nudgeHall = false; // the Hall was opened from the summary's glowing Spend Echoes
  let lastV = null;
  const store = () => hints.get();
  const cls = () => (lastV && lastV.player ? lastV.player.classId : lastV && lastV.create ? lastV.create.classId : 'rogue');
  const keyOf = (id) => (PER_CLASS.has(id) ? `${id}:${cls()}` : id);
  /** The stored keys of the hints a beat's line stands in for (spec 3.2 "Beat"; D147: both for G8's joint line; lineHints). */
  const beatHintKeys = (id, line = null) => lineHints(id, line).map(keyOf);
  const markAll = (keys) => { for (const k of keys) hints.mark(k); };
  hints.need = r.hintShows || null; // ONB_HINT_SHOWS (src/constants.js) through the bridge
  const guiding = (v) => !!(v && v.tutorial && v.tutorial.on && !v.tutorial.skipped && !v.tutorial.ended);
  const momentOf = (spec, v) => (spec.ctx === 'fight' ? `f${fightNo}` : spec.ctx === 'map' ? `m${v.zone ? `${v.zone.idx}:${v.zone.exp ? v.zone.exp.pos : ''}` : ''}` : `s${v.phase}:${v.node ? v.node.type : ''}:${v.loot ? v.loot.kind : ''}`);

  function lineFor(id, alt) {
    if (id === 'NUDGE') return fillLine(T.nudge.hallLine, num);
    const raw = rawLine(T, id, cls(), alt);
    return raw ? fillLine(raw, num, { ...KEYS, ...lineKeys(lastV, ctx.data.spells) }) : null;
  }
  function show(x) {
    const line = lineFor(x.lineId || x.id, x.alt);
    if (!line) return;
    unmark();
    cur = { ...x, text: line.text, at: performance.now(), step: stepNo };
    confirm = false;
    textEl.replaceChildren(...line.nodes);
    renderButtons();
    el.classList.remove('hidden');
    document.body.classList.add('coach-up'); // D142 (2): the turn prompt's "Opening move" line gives way (style.css)
    el.dataset.id = x.lineId || x.id; el.dataset.kind = x.kind;
    el.classList.toggle('instant', !!settings.reduceMotion);
    // D142 (3): a showing of a hint, or of the beat line that stands in for it, counts towards ONB_HINT_SHOWS (D147: G8's
    // joint line is a showing of H01 and of H03)
    if (x.kind === 'hint' && !leavesUnseen(x)) hints.noteShown(x.key);
    else if (x.kind === 'beat') for (const k of beatHintKeys(x.id, x.lineId)) hints.noteShown(k);
    log.push({ id: x.lineId || x.id, key: x.key || null, text: line.text, kind: x.kind, step: stepNo, at: Math.round(performance.now()) });
    if (log.length > 400) log.shift();
    place();
  }
  function renderButtons() {
    const guided = cur && cur.kind === 'beat' && guiding(lastV);
    okBtn.textContent = cur && cur.kind === 'nudge' ? T.nudge.later : 'Got it';
    skipBtn.textContent = guided ? 'Skip guide' : 'Hints off';
    skipBtn.classList.toggle('hidden', !!(cur && cur.kind === 'nudge'));
  }
  /** The ring off the line's anchor and its second marker (D147). */
  function unmark() {
    if (cur && cur.anchorEl) cur.anchorEl.classList.remove('coach-on');
    if (cur && cur.alsoEl) cur.alsoEl.classList.remove('coach-also');
  }
  /** Put the line away. seen: the hint counts as seen (Got it, done, or its moment ended after ONB_HINT_MIN_MS). */
  function hide(seenNow) {
    if (!cur) return;
    const long = performance.now() - cur.at >= r.hintMinMs;
    if (leavesUnseen(cur)) cool.set(cur.key, cur.moment); // not seen, and not again in this fight
    else if (cur.kind === 'hint' && (seenNow || long)) hints.mark(cur.key);
    unmark();
    cur = null; confirm = false;
    el.classList.add('hidden');
    document.body.classList.remove('coach-up');
    if (ctx.scene) ctx.scene.keepOut = []; // the scene's headlines need not keep clear of it any more
  }
  okBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm) { confirm = false; textEl.replaceChildren(...lineFor(cur.lineId || cur.id, cur.alt).nodes); renderButtons(); place(); return; }
    if (!cur) return;
    if (cur.kind === 'beat') { dismissed.add(cur.lineId); markAll(beatHintKeys(cur.id, cur.lineId)); }
    if (cur.kind === 'nudge') { store().nudge.hall = true; hints.save(); nudgeHall = false; document.querySelectorAll('#meta .mcard.nudge').forEach((x) => x.classList.remove('nudge')); }
    hide(true);
    advance(lastV);
  });
  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!cur) return;
    if (cur.kind === 'beat' && guiding(lastV)) {
      if (!confirm) {
        // one-line confirm (task brief): the strip asks, Skip sends SKIP_GUIDE, Keep it puts the line back
        confirm = true;
        textEl.replaceChildren('Skip the guide for this run? First-time hints stay on.');
        okBtn.textContent = 'Keep it'; skipBtn.textContent = 'Skip';
        place(); return;
      }
      confirm = false; hide(false); ctx.act({ type: 'SKIP_GUIDE' });
      return;
    }
    hints.setOff(true); hide(false); queue = [];
    ctx.toast('Hints off. Settings can turn them on again.', 'info');
  });

  // ---------------------------------------------------------------- placement (spec 2.5)
  const PROTECT = ['#actionbar', '#engage .eg-opt, #engage button', '#heat', '#target-frame', '#pp-go', '#boss-frame', '#turnprompt'];
  const visible = (x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !x.closest('.hidden') ? b : null; };
  function place() {
    if (!cur || el.classList.contains('hidden')) return;
    const anchorEl = cur.anchorFn ? safe(() => cur.anchorFn(lastV, ctx.data)) : null;
    if (cur.anchorEl !== anchorEl) { if (cur.anchorEl) cur.anchorEl.classList.remove('coach-on'); cur.anchorEl = anchorEl; }
    // on every placement: a re-render can set the element's class anew (tracks.js windupBanner sets the badge's className)
    if (anchorEl && !anchorEl.classList.contains('coach-on')) anchorEl.classList.add('coach-on');
    // D147: the line's second marker (G8's joint line: the wind-up badge), unless it is the anchor itself
    const found = cur.alsoFn ? safe(() => cur.alsoFn(lastV, ctx.data)) : null;
    const alsoEl = found && found !== anchorEl ? found : null;
    if (cur.alsoEl !== alsoEl) { if (cur.alsoEl) cur.alsoEl.classList.remove('coach-also'); cur.alsoEl = alsoEl; }
    if (alsoEl && !alsoEl.classList.contains('coach-also')) alsoEl.classList.add('coach-also');
    el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.transform = '';
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const W = innerWidth; const H = innerHeight; const gap = 0.8 * rem;
    let b = el.getBoundingClientRect();
    const w = b.width; const hh = b.height;
    const rects = PROTECT.flatMap((s) => [...document.querySelectorAll(s)].map(visible).filter(Boolean));
    const ar = anchorEl ? visible(anchorEl) : null;
    if (ar) rects.push(ar);
    const sr = alsoEl ? visible(alsoEl) : null; // the second marker is not covered either
    if (sr) rects.push(sr);
    const hits = (x, y) => rects.find((k) => x < k.right + 2 && x + w > k.left - 2 && y < k.bottom + 2 && y + hh > k.top - 2);
    // the one place: bottom centre, its bottom edge BOTTOM_REM over the window's bottom (over the bar's control row)
    let x = (W - w) / 2; let y = H - BOTTOM_REM * rem - hh;
    if (cur.kind === 'nudge' && ar) { x = Math.min(Math.max(ar.left + ar.width / 2 - w / 2, gap), W - w - gap); y = ar.bottom + gap; if (y + hh > H - gap) y = ar.top - hh - gap; }
    for (let i = 0; i < 10; i++) { const k = hits(x, y); if (!k) break; y = k.top - hh - gap; }
    if (y < gap) { y = H - BOTTOM_REM * rem - hh; for (let i = 0; i < 10; i++) { const k = hits(x, y); if (!k) break; y = k.bottom + gap; } }
    y = Math.min(Math.max(gap, y), H - hh - gap);
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; el.style.bottom = 'auto';
    // the arrow towards the anchor
    b = el.getBoundingClientRect();
    // blind panel 2026-11-13 (item 6): the scene's headlines over an enemy keep clear of the line (scene.js headline)
    if (ctx.scene) ctx.scene.keepOut = [{ left: b.left, top: b.top, right: b.right, bottom: b.bottom }];
    arrow.className = 'co-arrow';
    if (!ar) { arrow.classList.add('none'); return; }
    const cx = ar.left + ar.width / 2; const cy = ar.top + ar.height / 2;
    if (cy < b.top || cy > b.bottom) {
      arrow.classList.add(cy < b.top ? 'up' : 'down');
      arrow.style.left = `${Math.round(Math.min(Math.max(cx - b.left, 1.2 * rem), b.width - 1.2 * rem))}px`; arrow.style.top = '';
    } else { arrow.classList.add(cx < b.left ? 'left' : 'right'); arrow.style.left = ''; arrow.style.top = `${Math.round(b.height / 2)}px`; }
  }
  const safe = (fn) => { try { return fn(); } catch { return null; } };

  // ---------------------------------------------------------------- what to show
  /**
   * The engine's beat line to show now, or null: tutorialView.line (D141: the engine rests a line after ONB_LINE_STEPS steps
   * unlearned and brings it back on its trigger). The open list is read only so that a fight's beat waits until the fight is
   * on screen (the quest's intro dialog comes first: the bridge shows no combat), a map line until the map is on screen, and
   * a line put away with "Got it" stays away; resting entries are skipped.
   */
  function beatNow(v) {
    const t = v && v.tutorial;
    if (!t || !guiding(v) || hints.off || !T) return null;
    const ok = (x) => x && x.line && !x.rest && !dismissed.has(x.line) && (!FIGHT_BEATS.has(x.id) || inFight(v)) && (!MAP_LINES.has(x.line) || (onMap(v) && mapShown(ctx.ui, ctx.view)));
    const top = (t.open || []).find((x) => x.line === t.line);
    const o = ok(top) ? top : (t.open || []).find(ok);
    if (!o) return null;
    return { id: o.id, lineId: o.line, kind: 'beat', anchorFn: LINE_ANCHOR[o.line] || ANCHOR[o.id] || null, alsoFn: LINE_ALSO[o.line] || null };
  }
  function advance(v) {
    if (!v) return;
    // D141: a beat line the engine has rested counts its hint seen when it was on screen long enough (spec 3.1)
    if (cur && cur.kind === 'beat' && v.tutorial && (v.tutorial.open || []).some((o) => o.id === cur.id && o.rest) && performance.now() - cur.at >= r.hintMinMs) markAll(beatHintKeys(cur.id, cur.lineId));
    const b = beatNow(v);
    if (b && (!cur || cur.kind === 'hint' || (cur.kind === 'beat' && cur.lineId !== b.lineId)) && !(cur && cur.kind === 'nudge') && !(cur && cur.kind === 'hint' && prio(cur.id) > prio(b.id))) {
      if (cur && cur.kind === 'hint') hide(false);
      show(b); return;
    }
    if (cur && cur.kind === 'beat' && !b) hide(false);
    if (!cur && queue.length) {
      const x = queue.shift();
      if (stepNo - x.step <= 1 && safe(() => HINTS[x.id].when(ctxOf(v, [], null)))) showHint(x, v);
    }
  }
  function showHint(x, v) {
    if (inFight(v)) fightHints += 1;
    lastHintStep = stepNo;
    show({ id: x.id, key: x.key, kind: 'hint', alt: x.alt, anchorFn: HINTS[x.id].anchor, fight: fightNo, round: v.combat ? v.combat.round : 0, moment: x.moment });
  }
  const ctxOf = (v, ev, a) => ({ v, ev: ev || [], a: a ? a.type : null, ui: ctx.ui, r, store: store(), nudgeHall });

  /** The current hint's moment is over: the fight ended or moved two rounds on, the map step was taken, its screen left. */
  function hintGone(v, c) {
    const spec = HINTS[cur.id];
    if (cur.moment !== momentOf(spec, v)) return true;
    if (spec.ctx === 'fight') return !inFight(v) || (v.combat.round - cur.round) >= 2 || (spec.gone && safe(() => spec.gone(c)));
    if (spec.gone) return !!safe(() => spec.gone(c));
    return spec.ctx === 'screen' && !safe(() => spec.when(c));
  }

  /** After every played step (App.act): the beats' events, the hints' triggers, the pace and the queue. */
  function onStep(prev, v, events, action) {
    stepNo += 1; lastV = v;
    const a = action ? (action.type === 'ENGINE' ? action.action : action) : null;
    const ev = events || [];
    if (has(ev, 'fightStart')) { fightNo += 1; fightHints = 0; }
    const st = store();
    // the hint store's counters: fights won (H31) and autoplay used
    if (has(ev, 'victory')) { st.stats = { ...(st.stats || {}), won: ((st.stats || {}).won || 0) + 1 }; hints.save(); }
    if (a && a.type === 'SET_AUTOPLAY' && a.on) { st.stats = { ...(st.stats || {}), auto: true }; hints.save(); }
    // beats: a line opened or changed is shown again even if an earlier showing was put away; a beat done marks its hint
    for (const e of ev) {
      if (e.t !== 'beat') continue;
      if ((e.what === 'open' || e.what === 'line') && e.line) dismissed.delete(e.line);
      if (e.what === 'done') { markAll(beatHintKeys(e.id)); if (e.id === 'G10') hints.mark('H21'); }
    }
    // the guide ends early: Skip guide, or (D147) the ONB_RESCUE_MAX-th rescue, whose line (content guide.rescueCapLine)
    // also shows as a toast next to the rescue's banner: from now on a death ends the run
    const skipped = ev.find((e) => e.t === 'guideSkipped');
    if (skipped) {
      dismissed.clear(); if (cur && cur.kind === 'beat') hide(false);
      const cap = skipped.why === 'rescues';
      const line = guideSkippedLine(skipped, T, num);
      if (cap) ctx.toast(line, 'long'); // style.css .toast.long: two lines, clear of the hub's panel
      ctx.hud.log(line, cap ? 'lg-warn' : 'lg-sys');
    }
    if (has(ev, 'guideEnd') && T) ctx.toast(T.guide.endLine, 'good');
    // D143: the guided zone's Roads open (Gorrak's fight over, or he can no longer be fought): say so once. Draft text (no
    // content line yet: T.guide.roadsOpenLine when the Content Designer adds one)
    const shut = (x) => !!(x && x.tutorial && x.tutorial.roads && x.tutorial.roads.closed);
    if (T && shut(prev) && !shut(v) && v.zone && prev.zone && v.zone.idx === prev.zone.idx && v.phase !== 'SUMMARY') ctx.toast(T.guide.roadsOpenLine || ROADS_OPEN_LINE, 'good');
    const c = ctxOf(v, ev, a);
    // the line on screen: done, or its moment over
    if (cur && cur.kind === 'hint') {
      const spec = HINTS[cur.id];
      if (spec.done && safe(() => spec.done(c))) hide(true);
      else if (hintGone(v, c)) hide(false);
    }
    if (cur && cur.kind === 'nudge' && !(ctx.ui.metaOpen && v.phase === 'CREATE')) closeNudge();
    queue = queue.filter((x) => stepNo - x.step <= 1);
    // new hints this step (one per step and ONB_HINTS_PER_FIGHT per fight; the rest wait one step, then drop)
    if (!hints.off && T) {
      const found = [];
      for (const id of Object.keys(HINTS)) {
        const key = keyOf(id);
        if (hints.seen(key) || (cur && cur.key === key) || queue.some((x) => x.key === key)) continue;
        if (guiding(v) && BEAT_OF[id]) continue; // the beat stands in for it
        const spec = HINTS[id];
        const moment = momentOf(spec, v);
        if (cool.get(key) === moment) continue;
        if (!safe(() => spec.when(c))) continue;
        found.push({ id, key, moment, step: stepNo, alt: spec.alt ? safe(() => spec.alt(c)) : undefined });
      }
      found.sort((x, y) => prio(y.id) - prio(x.id));
      for (const x of found) {
        const fightCap = inFight(v) && fightHints >= r.hintsPerFight;
        if (fightCap) { cool.set(x.key, x.moment); continue; }
        if (!cur && lastHintStep !== stepNo && !beatNow(v)) { showHint(x, v); continue; }
        if (cur && cur.kind === 'hint' && prio(x.id) > prio(cur.id) && lastHintStep !== stepNo) { hide(false); showHint(x, v); continue; }
        if (queue.length < r.queueMax) queue.push(x); else cool.set(x.key, x.moment);
      }
      for (const x of queue) if (x.step < stepNo) cool.set(x.key, x.moment);
    }
    advance(v);
    place();
  }

  // ---------------------------------------------------------------- the nudge (spec 4.3)
  /** The summary shows the nudge: the welcome was paid (first summary) or the Satchel is still not bought (once more). */
  function summaryNudge(v) {
    if (!T || !v || v.phase !== 'SUMMARY' || !v.summary || v.summary.dev || !v.meta) return false;
    const owned = (v.meta.unlocks[T.nudge.unlock] || 0) > 0;
    if (owned) return false;
    const n = store().nudge.summary;
    const welcome = (v.summary.echoes || []).some((x) => x[2] === 'welcome');
    return welcome ? n <= 1 : n === 1;
  }
  let nudgeRun = null;
  /** Called by the summary screen when it shows the nudge (counts once per run summary). */
  function noteSummary(v) {
    const id = `${v.summary.seed}:${v.summary.level}:${v.time}`;
    if (nudgeRun === id) return;
    nudgeRun = id; store().nudge.summary += 1; hints.save();
  }
  function armHall() { if (!store().nudge.hall) nudgeHall = true; }
  function closeNudge() {
    if (cur && cur.kind === 'nudge') hide(false);
    if (nudgeHall) { store().nudge.hall = true; hints.save(); }
    nudgeHall = false;
    document.querySelectorAll('#meta .mcard.nudge').forEach((x) => x.classList.remove('nudge'));
  }

  /** Every render: the Hall nudge, placement, and the hints of screens that open without a step (the Hall, a window). */
  function update(v) {
    lastV = v;
    // a walk, a travel or a fight's entry plays (D143, blind panel 2026-11-13): no line comes or goes; the one up waits out of sight
    const held = !!ctx.ui.overlay;
    el.classList.toggle('held', held);
    if (held) return;
    if (nudgeHall && ctx.ui.metaOpen && v.phase === 'CREATE' && T) {
      const card = document.querySelector(`#meta .mcard[data-id="${T.nudge.unlock}"]`);
      const owned = v.meta && (v.meta.unlocks[T.nudge.unlock] || 0) > 0;
      if (owned) closeNudge();
      else if (card) {
        card.classList.add('nudge');
        if (!cur || cur.kind !== 'nudge') { if (cur) hide(false); show({ id: 'NUDGE', kind: 'nudge', anchorFn: () => document.querySelector(`#meta .mcard[data-id="${T.nudge.unlock}"]`) }); }
      }
    } else if (nudgeHall && v.phase === 'CREATE' && !ctx.ui.metaOpen) closeNudge();
    // the Hall (H37) opens without an engine step
    if (!cur && !hints.off && T && ctx.ui.metaOpen && v.phase === 'CREATE' && !nudgeHall && !hints.seen('H37')) show({ id: 'H37', key: 'H37', kind: 'hint', anchorFn: HINTS.H37.anchor, moment: momentOf(HINTS.H37, v) });
    if (cur && cur.kind === 'hint' && cur.id === 'H37' && !(ctx.ui.metaOpen && v.phase === 'CREATE')) hide(false);
    if (cur && cur.kind === 'hint' && HINTS[cur.id].ctx === 'screen' && HINTS[cur.id] !== HINTS.H37 && !safe(() => HINTS[cur.id].when(ctxOf(v, [], null)))) hide(false);
    if (cur && hints.off && cur.kind !== 'nudge') hide(false);
    if (cur && cur.kind === 'beat' && !beatNow(v)) hide(false);
    if (!cur || cur.kind === 'hint') advance(v); // a beat line that waited for its screen takes a hint's place once it shows
    place();
  }

  /** G6 (spec 2.4): hovering a track entry is the beat's "learned"; the line goes and H02 is seen. */
  document.addEventListener('pointerover', (e) => {
    if (!cur || !(cur.id === 'G6' || cur.id === 'H02')) return;
    if (!(e.target.closest && e.target.closest('#nameplates .tk, #nameplates .trk, #target-frame .ttrack, #ruler'))) return;
    if (cur.kind === 'beat') { dismissed.add(cur.lineId); hints.mark('H02'); }
    hide(true);
  });

  /** G1 (spec 2.4 "If not"): the first Set out with no contract in a guided run shows the alt line once; true: hold it. */
  let setOutWarned = false;
  function holdSetOut(v) {
    if (setOutWarned || !v || !guiding(v) || !v.prep || v.prep.held > 0 || hints.off) return false;
    setOutWarned = true;
    if (cur) hide(false);
    show({ id: 'G1', lineId: 'G1.noContract', kind: 'beat', anchorFn: () => q('#pp-go') });
    return true;
  }

  return {
    el, onStep, update, place, summaryNudge, noteSummary, armHall, closeNudge, holdSetOut,
    /** Settings "Reset hints" / "Hints" / "Play the guide again". */
    reset() { hints.reset(); dismissed.clear(); cool.clear(); queue = []; hide(false); },
    /** Dev menu "Reset onboarding": the hint store cleared as on a new profile (hints on, nothing seen, no nudge). */
    clear() { hints.clear(); dismissed.clear(); cool.clear(); queue = []; hide(false); },
    setOff(on) { hints.setOff(on); if (on) { hide(false); queue = []; } },
    /** Test hook: the line on screen and every line shown so far. */
    test() { return { shown: cur ? { id: cur.lineId || cur.id, kind: cur.kind, text: el.querySelector('.co-t').textContent } : null, log: log.map((x) => ({ ...x })), store: JSON.parse(JSON.stringify(store())), queue: queue.map((x) => x.id) }; },
  };
}

/** D143: the line of a closed Road (mapView Road nodes `closed`): G13's closed line (content beat G13 alt.closed), or null. */
export function closedRoadLine(data) {
  const T = data.tutorial && data.tutorial.table;
  const raw = T ? rawLine(T, 'G13.closed') : null;
  return raw ? fillLine(raw, data.tutorial.num || {}).text : null;
}
/** The gate line of Gorrak's barred node (D138): content elite.gate.barredLine with {n} = the scripted fights still to come. */
export function gateLine(data, tv) {
  const T = data.tutorial && data.tutorial.table;
  if (!T || !tv || !tv.elite) return null;
  return tv.elite.barred ? fillLine(T.elite.gate.barredLine, { n: tv.elite.left }).text : null;
}
