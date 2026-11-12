// Sound (docs/specs/audio.md from docs/audio/README.md; D127). Every cue is synthesised with Web Audio (oscillators, noise,
// envelopes, filters) as in the approved preview, docs/audio/preview.html; no file is ever loaded. Pure, Node-tested part
// (qa/ui/audio.test.mjs): cuesFor (a director event), viewCues (the decision view: Deathblow telegraph, Furnace, the
// Dimming near the player), actionCues, keepOfStep (the Instant rule), META/RANK/PROTECTED. createAudio(settings): master
// -> sfx, ui, music (reserved, M4) -> compressor; nothing before the first trusted pointer or key press; voice limit and
// priority; speed tails; the log for testApi().audio(). Spec sections: audio.md 2 (cues), 3 (mixer, unlock, voices, speed), 5 (constants).
const N = { D2: 73.42, D3: 146.83, Eb3: 155.56, A3: 220, D4: 293.66, E4: 329.63, Eb4: 311.13, Fs4: 369.99, A4: 440, B4: 493.88,
  D5: 587.33, Fs5: 739.99, A5: 880, D6: 1174.66, E6: 1318.51, B6: 1975.53 };
export const MAX_VOICES = 8;
export const SAME_MAX = 2;
export const RETRIGGER_S = 0.05;
export const FADE_S = 0.02;
export const HEAVY_POWER = 0.6; // combat-feel.js hitPower at or above: a heavy hit
export const HEAVY_SHARE = 0.15; // or this share of the target's maximum health
export const TAIL = { 0: 0.4, 1: 1, 2: 0.6, 4: 0.4 }; // release tails by speed (0: Instant)
export const DIM_NEAR = 2; // the Dimming's cue: the player's node dims in this many tolls or fewer (README cue 10)
const SFX_TRIM = 0.9; // the preview's effects bus under the effects slider
/** Cue: [rank (higher wins a voice and the Instant step), length at 1x in s (voice count)]. */
export const META = { deathblowTelegraph: [100, 2], deathblowLanded: [99, 2.2], deathblowAnswered: [98, 1.4], maimed: [97, 1.8],
  deathblowFirstShow: [96, 2], playerDeath: [95, 1.6], levelUp: [90, 1.7], dimmingSpread: [80, 1.6], kill: [70, 1], windupLanded: [66, 1], windupAnswered: [65, 1],
  crit: [60, 0.55], homewardBell: [58, 3.4], arrive: [57, 1.3], loot: [55, 1], furnaceUp: [52, 0.6], furnaceCalm: [51, 1], interrupt: [45, 0.25],
  hitHeavy: [40, 0.32], potion: [36, 0.35], heal: [32, 0.6], dodge: [28, 0.15], error: [26, 0.15], hitLight: [20, 0.15], uiClick: [18, 0.05],
  winOpen: [14, 0.15], winClose: [13, 0.1], tick: [10, 0.1] };
export const RANK = Object.fromEntries(Object.entries(META).map(([k, v]) => [k, v[0]]));
/** Never stolen or dropped: the Deathblow's cues and the player's death. */
export const PROTECTED = new Set(['deathblowTelegraph', 'deathblowFirstShow', 'deathblowAnswered', 'deathblowLanded', 'maimed', 'playerDeath']);
const UI_CUES = new Set(['uiClick', 'error', 'winOpen', 'winClose']);
/** The reserved glass voice (README rule 1: the Dimming and the Unlit Star only): two sines a few Hz apart, beating. */
export const GLASS = [1760, 1767];
const TONAL = new Set(['levelUp', 'deathblowAnswered', 'windupAnswered', 'loot', 'heal', 'arrive', 'homewardBell', 'furnaceCalm']);
const BIG = new Set(['elite', 'rare', 'dboss', 'boss']);
const BELLS = { uncommon: 1, rare: 2, epic: 3, legendary: 3 };
const HEAT_ORDER = ['clear', 'warm', 'hot', 'scorched'];
/** What a click sounds on (one document-level listener in app.js). */
export const CLICKABLE = 'button, [role="button"], [role="switch"], .card, .icard, .svc-card, .ccard, .slot, .oathslot, .mnode, .toggle';

// ------------------------------------------------------------------ pure: events and views to cues
/** Cues of one director event. info: { power (tm.power), heavy (a heavy blow), rank (the enemy's) }. */
export function cuesFor(e, info = {}) {
  const one = (cue, o) => [{ cue, ...o }];
  switch (e && e.t) {
    case 'damage': {
      if (e.immune) return [];
      if (e.miss) return one('dodge');
      const taken = !!e.dst && (e.dst.side === 'player' || e.dst.side === 'pet');
      if (e.tick) return one('tick', { taken });
      const share = e.maxHp ? Math.min(1, (e.amount || 0) / e.maxHp) : 0;
      const w = Math.min(1.25, 0.8 + share * 1.5); // a big hit is heard as big
      if (e.crit) return one('crit', { taken, w });
      const heavy = !(e.src && e.src.side === 'pet') && (!!info.heavy || (info.power || 0) >= HEAVY_POWER || share >= HEAVY_SHARE);
      return one(heavy ? 'hitHeavy' : 'hitLight', { taken, w });
    }
    case 'death':
      if (!e.dst || e.despawn) return [];
      return e.dst.side === 'player' ? one('playerDeath') : e.dst.side === 'enemy' ? one('kill', { big: BIG.has(info.rank) }) : [];
    case 'levelUp': return one('levelUp');
    case 'windup': {
      const ok = e.result === 'answered';
      if (!e.deathblow) return one(ok ? 'windupAnswered' : 'windupLanded');
      return ok ? one('deathblowAnswered') : [{ cue: 'deathblowLanded' }, ...(e.maimed ? [{ cue: 'maimed' }] : [])];
    }
    case 'heal': return (e.amount || 0) > 0 ? one('heal', { enemy: !!e.dst && e.dst.side === 'enemy', maimed: !!e.maimed }) : [];
    case 'interrupt': case 'trapSprung': return one('interrupt');
    case 'action': return e.kind === 'item' ? one('potion') : [];
    case 'gotItem': return one('loot', { rarity: e.rarity, heatUp: !!e.heatUp });
    default: return [];
  }
}
export const newMemo = () => ({ told: new Set(), seen: new Set() });
/**
 * The decision view after a step (memo: newMemo(), one per page). The telegraph once per Deathblow (enemy uid, turn) when
 * an enemy's now-entry is one nothing answers yet (a SAPPED cancel breaks on damage: still a threat); else the quieter
 * first show the first time a track shows one in the engage round. The Furnace: up a state, or back to Calm.
 */
export function viewCues(prev, next, memo) {
  const out = [];
  const f = next && next.combat;
  if (f && !f.over) {
    let tele = false; let first = false;
    for (const en of f.enemies || []) {
      if (!en.alive || !Array.isArray(en.track)) continue;
      const now = en.track.find((x) => x.now && x.deathblow);
      const key = `${en.uid}:${now ? now.turn : ''}`;
      if (now && (!now.cancel || now.cancel.breaks) && !memo.told.has(key)) { memo.told.add(key); tele = true; }
      if (f.engage && en.track.some((x) => x.deathblow) && !memo.seen.has(en.uid)) { memo.seen.add(en.uid); first = true; }
    }
    if (tele) out.push({ cue: 'deathblowTelegraph' }); else if (first) out.push({ cue: 'deathblowFirstShow' });
  }
  const a = prev && prev.heat; const b = next && next.heat;
  if (a && b && a.state !== b.state && prev.player && next.player && prev.seed === next.seed) {
    const i = HEAT_ORDER.indexOf(b.state);
    if (i > HEAT_ORDER.indexOf(a.state)) out.push({ cue: 'furnaceUp', level: i }); else if (i === 0) out.push({ cue: 'furnaceCalm' });
  }
  if (dimmingNear(prev, next)) out.push({ cue: 'dimmingSpread' });
  return out;
}
/** Cue 10 (README 2): in a step of one zone the Dimming reached new nodes (map view diff), and now the player's node is
 * Dimmed, dims in DIM_NEAR tolls or fewer, or a node next to it was just Dimmed. A spread far from him is silent. */
export function dimmingNear(prev, next) {
  const a = prev && prev.zone && prev.zone.exp; const b = next && next.zone && next.zone.exp;
  if (!a || !b || a.z !== b.z || prev.seed !== next.seed || !Array.isArray(a.nodes) || !Array.isArray(b.nodes) || a.nodes.length !== b.nodes.length) return false;
  const fresh = new Set(b.nodes.map((n, i) => (n.dimmed && !a.nodes[i].dimmed ? i : -1)).filter((i) => i >= 0));
  const me = b.nodes[b.pos];
  if (!fresh.size || !me) return false;
  if (me.dimmed || (Number.isFinite(me.dimsIn) && me.dimsIn <= DIM_NEAR)) return true;
  return (b.edges || []).some(([x, y]) => (x === b.pos && fresh.has(y)) || (y === b.pos && fresh.has(x)));
}
/** Cues an action starts itself (the Homeward Bell's channel). */
export const actionCues = (type) => (type === 'RING_BELL' ? [{ cue: 'homewardBell' }] : []);
/** Instant or a skipped step: indices kept, the top-ranked cue and every protected one. */
export function keepOfStep(list) {
  let top = -1;
  list.forEach((c, i) => { if (top < 0 || (RANK[c.cue] || 0) > (RANK[list[top].cue] || 0)) top = i; });
  return new Set(list.map((c, i) => (i === top || PROTECTED.has(c.cue) ? i : -1)).filter((i) => i >= 0));
}

// ------------------------------------------------------------------ synthesis: the preview's building blocks
const LP = 'lowpass'; const HP = 'highpass'; const BP = 'bandpass'; const TRI = 'triangle';
const gain = (ac, v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
function build(ac) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25; comp.connect(ac.destination);
  const master = gain(ac, 0.7, comp); const duck = gain(ac, 1, master); // the player's death ducks all but itself
  const bus = { sfx: gain(ac, SFX_TRIM, duck), ui: gain(ac, 0.6, duck), music: gain(ac, 1, duck), over: gain(ac, SFX_TRIM, master) };
  const verb = ac.createConvolver(); verb.connect(duck); // one small timber room: 1.6 s of decaying, low-passed noise
  const n = Math.floor(ac.sampleRate * 1.6); const ir = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / n, 3.2); } }
  verb.buffer = ir;
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return { ac, master, duck, bus, verbIn: gain(ac, 0.5, verb), nb, fresh: true, ducked: false, release: false };
}
// I: a cue instance { ac, G, t0, T (tail), pv (pitch), lv (level), ig (dry), iw (wet send) }. Params: t start, a attack,
// d decay (× T), p peak, f Hz (× pv), to glide or sweep target, w room send, lp low-pass (lpTo: closing), ty type, q.
function voice(I, w) { const g = gain(I.ac, 0, I.ig); if (w) g.connect(gain(I.ac, w, I.iw)); return g; }
function env(g, t, a, p, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, p), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(I, { ty = 'sine', f, t = 0, a = 0.005, d = 0.2, p = 0.3, to, toT, w = 0, lp, lpTo, dt = 0 }) {
  const ac = I.ac; const s = I.t0 + t; d *= I.T;
  const g = voice(I, w); env(g, s, a, p * I.lv, d);
  const o = ac.createOscillator(); o.type = ty; o.detune.value = dt;
  o.frequency.setValueAtTime(f * I.pv, s); if (to) o.frequency.exponentialRampToValueAtTime(to * I.pv, s + (toT ? toT * I.T : a + d));
  if (lp) { const fl = ac.createBiquadFilter(); fl.type = LP; fl.frequency.setValueAtTime(lp, s); if (lpTo) fl.frequency.exponentialRampToValueAtTime(lpTo, s + a + d); o.connect(fl); fl.connect(g); } else o.connect(g);
  o.start(s); o.stop(s + a + d + 0.05);
}
function noise(I, { t = 0, a = 0.002, d = 0.1, p = 0.3, ty = BP, f = 1000, q = 1, to, w = 0 }) {
  const ac = I.ac; const s = I.t0 + t; d *= I.T;
  const src = ac.createBufferSource(); src.buffer = I.G.nb; src.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = ty; fl.Q.value = q;
  fl.frequency.setValueAtTime(f * I.pv, s); if (to) fl.frequency.exponentialRampToValueAtTime(to * I.pv, s + a + d);
  const g = voice(I, w); env(g, s, a, p * I.lv, d);
  src.connect(fl); fl.connect(g); src.start(s, Math.random() * 1.5); src.stop(s + a + d + 0.05);
}
/** A small warm bell: sine partials, the upper ones die first. */
const bell = (I, f, { t = 0, p = 0.14, d = 1.2, w = 0.5 } = {}) => { for (const [m, k, dk] of [[1, 1, 1], [2, 0.42, 0.6], [3.01, 0.2, 0.4], [4.2, 0.08, 0.25]]) tone(I, { f: f * m, t, a: 0.004, d: d * dk, p: p * k, w }); };
/** The Deathblow's reserved voice: inharmonic partials through a low-pass, a hollow gong. */
function gong(I, f, { t = 0, p = 0.3, d = 2, glide = 1, w = 0.5 } = {}) {
  for (const [m, k, dk] of [[1, 1, 1], [1.414, 0.6, 0.75], [2, 0.35, 0.55], [2.83, 0.2, 0.4], [4.07, 0.1, 0.25]]) tone(I, { f: f * m, to: glide !== 1 ? f * m * glide : 0, t, a: 0.012, d: d * dk, p: p * k, w, lp: 1800 });
}
const CUE = {
  uiClick(I) { noise(I, { d: 0.035, p: 1.4, f: 2400, q: 3 }); tone(I, { ty: TRI, f: 1100, to: 800, d: 0.04, p: 0.12 }); },
  hitLight(I) { noise(I, { d: 0.09, p: 0.35, ty: LP, f: 2500, to: 600 }); tone(I, { f: 180, to: 90, d: 0.1, p: 0.35 }); },
  tick(I) { noise(I, { d: 0.06, p: 0.125, ty: LP, f: 2500, to: 600 }); tone(I, { f: 180, to: 90, d: 0.07, p: 0.125 }); }, // -9 dB
  hitHeavy(I, o = {}) {
    const k = o.w || 1;
    noise(I, { d: 0.015, p: 0.2 * k, ty: HP, f: 3000 }); tone(I, { f: 120, to: 42, a: 0.003, d: 0.28, p: 0.7 * k });
    tone(I, { ty: TRI, f: 70, to: 40, d: 0.2, p: 0.3 * k, lp: 300 }); noise(I, { d: 0.22, p: 0.5 * k, ty: LP, f: 1500, to: 300, w: o.taken ? 0 : 0.1 });
  },
  crit(I, o) {
    CUE.hitHeavy(I, o); tone(I, { ty: TRI, f: 660, to: 1320, d: 0.06, p: 0.08 });
    bell(I, N.E6, { t: 0.01, p: 0.09, d: 0.5, w: 0.4 }); bell(I, N.B6, { t: 0.03, p: 0.05, d: 0.4, w: 0.4 }); noise(I, { d: 0.06, p: 0.12, ty: HP, f: 5000 });
  },
  kill(I, o) {
    tone(I, { f: 80, to: 40, d: 0.3, p: 0.5 }); noise(I, { d: 0.4, p: 0.3, ty: LP, f: 800, to: 150, w: o.big ? 0.4 : 0 });
    bell(I, N.A3, { t: 0.05, p: 0.07, d: 0.9, w: o.big ? 0.6 : 0.2 }); if (o.big) bell(I, N.D4, { t: 0.22, p: 0.07, d: 1.2, w: 0.6 });
  },
  playerDeath(I) { CUE.hitHeavy(I, { w: 1.1 }); tone(I, { ty: TRI, f: N.D4, to: N.A3, t: 0.15, a: 0.05, d: 1.3, p: 0.14, lp: 1800, lpTo: 260, w: 0.4 }); },
  levelUp(I) { // the full pentatonic run belongs to level-up alone
    [N.D4, N.E4, N.Fs4, N.A4, N.B4, N.D5].forEach((f, i) => bell(I, f, { t: i * 0.07, p: 0.14, d: 1.2, w: 0.6 }));
    for (const dt of [-7, 7]) tone(I, { ty: 'sawtooth', f: N.D3, a: 0.25, d: 1.4, p: 0.05, lp: 900, dt, w: 0.5 });
    tone(I, { ty: 'sawtooth', f: N.A3, a: 0.25, d: 1.4, p: 0.04, lp: 900, w: 0.5 }); noise(I, { t: 0.3, a: 0.3, d: 0.6, p: 0.04, ty: HP, f: 6000, w: 0.5 });
  },
  deathblowTelegraph(I, o = {}) { // a breath in, the drum (not on the first show), the gong, a beating minor second
    const k = o.quiet ? 0.5 : 1;
    noise(I, { a: 0.45, d: 0.2, p: 0.25 * k, ty: LP, f: 150, to: 900 }); if (!o.quiet) tone(I, { f: 90, to: 50, t: 0.45, d: 0.4, p: 0.6 });
    gong(I, N.D2, { t: 0.45, p: 0.35 * k, d: 2.2 });
    for (const f of [N.D3, N.Eb3]) tone(I, { f, t: 0.45, a: 0.05, d: 1.4, p: 0.12 * k, w: 0.3 });
  },
  deathblowFirstShow(I) { CUE.deathblowTelegraph(I, { quiet: true }); },
  deathblowAnswered(I) { // a parry clack, rising bells, the second resolved to a fifth
    noise(I, { d: 0.05, p: 0.5, f: 1800, q: 3 }); tone(I, { ty: TRI, f: 900, to: 600, d: 0.06, p: 0.15 });
    [N.D5, N.Fs5, N.A5, N.D6].forEach((f, i) => bell(I, f, { t: 0.08 + i * 0.08, p: 0.2 - i * 0.03, d: 1, w: 0.6 }));
    for (const f of [N.D3, N.A3]) tone(I, { f, t: 0.08, a: 0.1, d: 1, p: 0.08, w: 0.4 });
  },
  deathblowLanded(I) { CUE.hitHeavy(I, { w: 1.3 }); gong(I, N.D2 * 0.707, { t: 0.02, p: 0.4, d: 2.5, glide: 0.88, w: 0.6 }); noise(I, { d: 1.2, p: 0.25, ty: LP, f: 400, to: 120 }); },
  maimed(I) { // two muffled heartbeats, a falling sigh
    tone(I, { f: 62, to: 45, t: 0.7, d: 0.18, p: 0.55 }); tone(I, { f: 62, to: 45, t: 0.95, d: 0.18, p: 0.45 });
    tone(I, { ty: TRI, f: N.E4, to: N.Eb4, toT: 0.7, t: 1, a: 0.08, d: 0.7, p: 0.1, lp: 900, w: 0.3 });
  },
  windupAnswered(I) { noise(I, { d: 0.05, p: 0.45, f: 1800, q: 3 }); bell(I, N.D5, { t: 0.06, p: 0.16, d: 0.9 }); bell(I, N.A5, { t: 0.14, p: 0.12, d: 0.9 }); },
  windupLanded(I) { CUE.hitHeavy(I, { w: 1.1 }); bell(I, N.D3, { t: 0.02, p: 0.2, d: 0.9, w: 0.3 }); }, // a low dong: no gong, no tritone
  interrupt(I) { noise(I, { a: 0.1, d: 0.02, p: 0.3, f: 600, to: 2400, q: 2 }); tone(I, { ty: TRI, f: 600, to: 300, t: 0.1, d: 0.12, p: 0.12 }); },
  heal(I, o) { // a fifth; an enemy's quieter and lower; cut by MAIMED: muffled
    const f = o.enemy ? N.A3 : N.D4;
    for (const [m, p] of [[1, 0.12], [1.5, 0.08]]) tone(I, { f: f * m, to: f * m * 1.03, a: 0.06, d: 0.5, p: p * (o.enemy ? 0.6 : 1), w: 0.5, lp: o.maimed ? 700 : 0 });
  },
  potion(I) { noise(I, { d: 0.03, p: 0.5, f: 900, q: 4 }); for (let i = 0; i < 3; i++) noise(I, { t: 0.09 + i * 0.07, d: 0.05, p: 0.2, ty: LP, f: 450 + i * 120, q: 6 }); },
  dodge(I) { noise(I, { a: 0.03, d: 0.09, p: 0.3, f: 600, to: 2500, q: 1.5 }); },
  loot(I, o) { // cloth, or bells by rarity; heat raised it: embers first
    let t = 0;
    if (o.heatUp) { for (let i = 0; i < 4; i++) noise(I, { t: i * 0.04, d: 0.012, p: 0.15, ty: HP, f: 3500 }); t = 0.18; }
    const n = BELLS[o.rarity] || 0;
    if (!n) { tone(I, { f: 140, to: 90, t, d: 0.12, p: 0.25 }); noise(I, { t, d: 0.08, p: 0.15, ty: LP, f: 900 }); return; }
    [N.A4, N.D5, N.Fs5].slice(0, n).forEach((f, i) => bell(I, f, { t: t + i * 0.09, p: 0.1, d: 0.9 }));
    if (n >= 3) tone(I, { f: N.D3, t, a: 0.2, d: 0.9, p: 0.06, w: 0.5 });
  },
  furnaceUp(I, o) { noise(I, { a: 0.12, d: 0.35, p: 0.3, ty: LP, f: 200, to: 1200 }); for (let i = 0; i < 2 * (o.level || 1); i++) noise(I, { t: 0.15 + i * 0.07, d: 0.012, p: 0.12, ty: HP, f: 3000 }); },
  furnaceCalm(I) { for (const m of [1, 1.004]) tone(I, { f: N.D4 * m, a: 0.12, d: 0.9, p: 0.06, w: 0.5 }); },
  error(I) { tone(I, { f: 160, to: 120, d: 0.06, p: 0.3 }); tone(I, { f: 160, to: 120, t: 0.07, d: 0.06, p: 0.25 }); },
  winOpen(I) { noise(I, { a: 0.04, d: 0.08, p: 0.25, f: 400, to: 1600, q: 1.2 }); },
  winClose(I) { noise(I, { a: 0.02, d: 0.06, p: 0.2, f: 1600, to: 400, q: 1.2 }); },
  arrive(I) { bell(I, N.A4, { p: 0.12, d: 1 }); bell(I, N.D5, { t: 0.12, p: 0.11, d: 1.2 }); },
  homewardBell(I) { bell(I, N.D5, { p: 0.14, d: 2.5, w: 0.8 }); bell(I, N.D5, { t: 0.9, p: 0.12, d: 2.5, w: 0.8 }); },
  dimmingSpread(I) { // the reserved glass voice: a cold swell sinking, glass beating at 7 Hz, a low swell, a lantern puffed out
    noise(I, { a: 0.7, d: 0.9, p: 0.3, f: 3000, to: 350, q: 8, w: 0.7 });
    for (const f of GLASS) tone(I, { f, a: 0.6, d: 1, p: 0.05, w: 0.8 });
    tone(I, { f: 55, a: 0.6, d: 0.8, p: 0.25 }); noise(I, { t: 1.25, d: 0.25, p: 0.2, ty: LP, f: 900, to: 200 });
  },
};
export const CUE_NAMES = Object.keys(CUE);

// ------------------------------------------------------------------ the player
/** { beginStep, endStep, event, view, cue, unlock, info }; settings: settings.js (a stub in Node). */
export function createAudio(settings) {
  let G = null; let stepNo = 0; let step = null; let lightBeat = null;
  const log = []; const live = []; const last = new Map(); const memo = newMemo();
  const now = () => performance.now() / 1000;
  const speed = () => (settings.instant ? 0 : settings.get('speed') || 1);
  const vol = (k) => Math.max(0, Math.min(1, Number(settings.get(k)) || 0));
  const busOf = (name) => (UI_CUES.has(name) ? 'ui' : name === 'playerDeath' ? 'over' : 'sfx');
  const audible = (name) => !!G && !settings.get('soundMuted') && vol('soundMaster') > 0 && vol(busOf(name) === 'ui' ? 'soundUi' : 'soundSfx') > 0;
  const ramp = (prm, v, s = 0.02) => { const t = G.ac.currentTime; prm.cancelScheduledValues(t); prm.setValueAtTime(prm.value, t); prm.linearRampToValueAtTime(v, t + s); };
  function apply() {
    if (!G) return;
    ramp(G.master.gain, settings.get('soundMuted') ? 0 : vol('soundMaster')); ramp(G.bus.ui.gain, vol('soundUi'));
    for (const b of [G.bus.sfx, G.bus.over]) ramp(b.gain, SFX_TRIM * vol('soundSfx'));
  }
  /** The first trusted pointer or key press builds the context (the browser's autoplay rule); later ones resume it. */
  function unlock(ev) {
    if (ev && ev.isTrusted === false) return;
    if (!G) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return; try { G = build(new AC()); } catch { return; } apply(); }
    if (G.ac.state === 'suspended' && !(globalThis.document && document.hidden)) G.ac.resume().catch(() => {});
  }
  if (typeof globalThis.addEventListener === 'function') for (const t of ['pointerdown', 'keydown']) globalThis.addEventListener(t, unlock, true);
  if (globalThis.document) document.addEventListener('visibilitychange', () => { if (G) (document.hidden ? G.ac.suspend() : G.ac.resume()).catch(() => {}); });
  if (settings.on) settings.on('change', (k) => { if (/^sound/.test(k)) apply(); });

  function unduck() { if (G && G.ducked && G.release) { ramp(G.duck.gain, 1, 0.3); G.ducked = false; G.release = false; } }
  function steal(v) { live.splice(live.indexOf(v), 1); if (v.I) for (const n of [v.I.ig, v.I.iw]) ramp(n.gain, 0, FADE_S); }
  function render(name, c, T) {
    const ac = G.ac; const t0 = ac.currentTime + (G.fresh ? 0.1 : 0.02); G.fresh = false; // a new context gets a moment
    const jit = TONAL.has(name) ? 0.004 : 0.03; // pitch ±3 % (bells ±0.4 %, so they stay on the scale), level ±1.5 dB
    const I = { ac, G, t0, T, pv: (1 + (Math.random() * 2 - 1) * jit) * (c.taken ? 0.92 : 1), lv: Math.pow(10, ((Math.random() * 2 - 1) * 1.5) / 20),
      ig: gain(ac, 1, G.bus[busOf(name)]), iw: gain(ac, 1, G.verbIn) };
    CUE[name](I, c);
    if (name === 'playerDeath') { // all but the death itself: to 30 % over 0.8 s, then silence for the death screen
      const p = G.duck.gain; p.cancelScheduledValues(t0); p.setValueAtTime(p.value, t0); p.linearRampToValueAtTime(0.3, t0 + 0.8); p.linearRampToValueAtTime(0.0001, t0 + 2.4);
      G.ducked = true; G.release = false;
    }
    return I;
  }
  /** The voice rules, then the sound when unlocked and not muted; e: the cue's log entry. */
  function play(c, e) {
    const name = c.cue; const t = now(); const sp = speed(); const rank = RANK[name] || 0; const prot = PROTECTED.has(name);
    const drop = () => { e.kept = false; return e; };
    if (!CUE[name]) return drop();
    if (sp === 4 && (name === 'hitLight' || name === 'tick') && c.beat != null) { if (c.beat === lightBeat) return drop(); lightBeat = c.beat; }
    if (!prot && t - (last.has(name) ? last.get(name) : -1) < RETRIGGER_S) return drop();
    for (let i = live.length - 1; i >= 0; i--) if (live[i].end <= t) live.splice(i, 1);
    const same = live.filter((v) => v.name === name);
    if (same.length >= SAME_MAX && !prot) steal(same[0]);
    if (live.length >= MAX_VOICES) {
      const v = live.filter((x) => !x.prot).sort((a, b) => a.rank - b.rank || a.t0 - b.t0)[0];
      if (v && (prot || v.rank <= rank)) steal(v); else if (!prot) return drop();
    }
    last.set(name, t); e.kept = true;
    const vc = { name, rank, prot, t0: t, end: t + META[name][1] * TAIL[sp], I: null };
    live.push(vc);
    if (audible(name)) { unduck(); vc.I = render(name, c, TAIL[sp]); e.sound = true; }
    return e;
  }
  /** Ask for a cue: always logged; a step's cue in a fast step (Instant, skipped) waits for endStep's choice. */
  function ask(c, direct = false) {
    const e = { cue: c.cue, step: stepNo, t: Math.round(now() * 1000), kept: false, sound: false };
    log.push(e); if (log.length > 2000) log.shift();
    if (step && step.fast && !direct) step.pending.push([c, e]); else play(c, e);
    return e;
  }
  function endStep() {
    if (!step) return;
    const s = step; step = null;
    const keep = keepOfStep(s.pending.map(([c]) => c));
    s.pending.forEach(([c, e], i) => { if (keep.has(i)) play(c, e); });
    if (G && G.ducked) G.release = true; // the death screen stays silent until the next step or click
  }
  return {
    /** A step starts (app.js act): fast at Instant; the action's own cues. */
    beginStep(type) { endStep(); stepNo += 1; unduck(); step = { fast: !!settings.instant, pending: [] }; for (const c of actionCues(type)) ask(c); },
    endStep,
    /** One director event; info.fast: the step was skipped or is Instant (only its top cue will play). */
    event(e, info = {}) { if (step && info.fast) step.fast = true; for (const c of cuesFor(e, info)) ask({ ...c, beat: info.beat }); },
    /** The decision view after a step. */
    view(prev, next) { for (const c of viewCues(prev, next, memo)) ask(c); },
    /** A cue from outside the event loop (click, error, windows, arrival): never held by the Instant rule. */
    cue(name, o = {}) { return ask({ cue: name, ...o }, true); },
    unlock,
    /** Test hook (testApi().audio()): { unlocked, state, muted, log: [{ cue, step, t, kept, sound }] }. */
    info: () => ({ unlocked: !!G, state: G ? G.ac.state : null, muted: !!settings.get('soundMuted'), log: log.map((x) => ({ ...x })) }),
  };
}
