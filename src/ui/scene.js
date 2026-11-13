// The world canvas: painted parallax backdrop, the hero in the centre, enemies, set pieces and
// combat effects. Pure presentation: it is told what happened and animates it.
// Combat feel (owner feedback 2026-11-10, src/ui/combat-feel.js): actors run on their own clock (atime) that a hit-stop
// freezes for a moment at contact; hits knock the target back, flash, throw sparks and pop a damage number that slams in
// (crits larger and slower); screen shake scales with the share of health a hit took and is off under Reduce motion;
// heavy and cast intents hold a visible wind-up (telegraph) until the enemy acts; spells charge up and projectiles leave trails.
// Combat v2.1 (docs/specs/combat-v2.md 16): a wind-up intent has its own, hotter telegraph, and the moment one is answered
// (a frost shatter) or lands (an ember flare) has its effect (windupResult).
// UX pass 2026-11-11: floating words (Interrupted!, Off-balance!, Staggered!, statuses) have their own lane under the
// damage numbers and take turns in it (word()), so the words and the number of one moment never cover each other.
// QA 2026-11-12 (playtest finding 4): the Deathblow's headlines ("Deathblow landed: empowered", "Maimed: healing -50 %")
// have a lane of their own per actor (headline()): above the head of the hero or the pet (no nameplate there), under the
// word lane of an enemy (its nameplate is above), so they never cover a damage number, a pet's number or a Dodge.
// floatBoxes() lists the recent floats with their boxes for the browser checks.
// Track R5 (2026-11-12): the drawing moved to the art modules (set pieces to art-props.js; telegraphs, status marks,
// effects, floats, motes and the grade to art-fx.js). This file keeps layout and animation state: actors and where they
// stand, poses, effect records and their lifetimes, particle motion, the floats' lanes, slam and rise.
import { buildBackdrop, drawBackdrop, drawForeground, THEMES, GROUND_Y, oak, pine } from './art-world.js';
import { drawHumanoid, drawBeast, drawBoss, drawShard, HERO_LOOKS, PET_LOOKS, enemyLook, beastLook } from './art-actors.js';
import { drawProp as drawSetPiece, drawQuestMark } from './art-props.js';
import {
  floatFont, drawShadow, drawTargetRing, drawRankAura, drawWard, drawStun, burnSpark, drawFrozen, drawHex, drawSleep, drawOffBalance,
  drawTelegraph, drawCharge, drawBolt, drawCore, drawRays, drawRing, drawSlash, drawPillar, drawParticle, drawFloat, drawMote, drawGrade,
} from './art-fx.js';
import { clamp, lerp, ease, rgba, shade, prng } from './util.js';
import { settings } from './settings.js';
import { IMPACT, token } from './theme.js';

// floating text lanes (UX pass 2026-11-11): a damage or heal number (NUM_RE) slams in on the body and rises; every other
// float is a word in its own lane under the number: WORD_ROWS rows from WORD_DY0, WORD_ROW apart (px at 768 high), a
// row held WORD_HOLD s before the next word may take it (the word in it then fades in WORD_CUT s), words at most
// WORD_MAX px and rising WORD_RISE px
const NUM_RE = /^[-+\u2212]?[\d\s\u00a0\u2009\u202f.,]+!?$/;
const WORD_ROWS = 2; const WORD_DY0 = 34; const WORD_ROW = 27; const WORD_HOLD = 0.55; const WORD_CUT = 0.16; const WORD_MAX = 22; const WORD_RISE = 8;
// headline lane (QA 2026-11-12): HEAD_ROWS rows per actor, HEAD_ROW px apart; over the hero or pet the first row's middle
// is HEAD_DY0 px above the head; under an enemy it is HEAD_GAP px below the word lane's last row (px at 768 high)
const HEAD_ROWS = 2; const HEAD_DY0 = 18; const HEAD_ROW = 28; const HEAD_GAP = 30; const FLOG_MAX = 240;
const SCHOOL_COL = IMPACT; // theme.js: the --fx-impact-* tokens (frost: --school-frost)

export class Scene {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 1; this.H = 1; this.dpr = 1;
    this.backdrops = new Map();
    this.theme = 'farmland'; this.hub = false;
    this.bd = null; this.prevBd = null; this.fade = 1;
    this.scroll = 0; this.speed = 0; this.targetSpeed = 0;
    this.time = 0; this.last = 0;
    this.actors = new Map();
    this.props = [];
    this.particles = []; this.texts = []; this.projectiles = []; this.rings = []; this.beams = [];
    this.wrows = new Map(); // word lanes per actor (word())
    this.hrows = new Map(); this.flog = []; // headline lanes per actor (headline()); recent floats (floatBoxes())
    // rects (CSS px, as getBoundingClientRect) a headline keeps clear of: the coach line (onboarding.js sets it while it shows)
    this.keepOut = [];
    this.ambient = []; this.shakeAmt = 0; this.flash = null; this.pillar = null; this.dim = 0; this.targetDim = 0;
    this.atime = 0; this.freeze = 0; // actor clock and hit-stop (s left)
    this.charges = []; this.cores = []; this.rays = []; this.fstack = new Map();
    this.mode = 'create';
    this.target = null; this.hover = null;
    this.desat = 0;
    this.resize();
  }

  resize() {
    const W = Math.max(320, window.innerWidth); const H = Math.max(240, window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    this.backdrops.clear();
    this.bd = this.getBackdrop(this.theme, this.hub); this.prevBd = null;
    this.u = H / 768;
    this.layout(true);
    this.seedAmbient();
  }

  getBackdrop(theme, hub) {
    const key = `${theme}|${hub ? 1 : 0}`;
    if (!this.backdrops.has(key)) this.backdrops.set(key, buildBackdrop(theme, this.W, this.H, { hub, seed: hub ? 991 : 1234 + theme.length * 7 }));
    return this.backdrops.get(key);
  }

  setTheme(theme, hub = false, instant = false) {
    if (theme === this.theme && hub === this.hub && this.bd) return;
    const next = this.getBackdrop(theme, hub);
    if (instant || settings.instant || !this.bd) { this.bd = next; this.prevBd = null; this.fade = 1; }
    else { this.prevBd = this.bd; this.bd = next; this.fade = 0; }
    const changed = theme !== this.theme;
    this.theme = theme; this.hub = hub;
    if (changed) this.seedAmbient();
  }

  get groundY() { return this.H * GROUND_Y; }

  // ------------------------------------------------------------------ actors
  setHero(classId, petId) {
    const s = 1.5 * this.u;
    const a = this.actors.get('player') || { id: 'player', x: this.W * 0.5, act: null, flashT: 0, alpha: 1 };
    Object.assign(a, { kind: 'humanoid', look: HERO_LOOKS[classId] || HERO_LOOKS.rogue, scale: s, flip: false, classId, visible: true, dead: 0, deadT0: 0 });
    this.actors.set('player', a);
    if (petId && PET_LOOKS[petId]) {
      const p = this.actors.get('pet') || { id: 'pet', x: this.W * 0.4, act: null, flashT: 0, alpha: 1 };
      Object.assign(p, { kind: PET_LOOKS[petId].kind === 'hawk' ? 'hawk' : 'beast', look: PET_LOOKS[petId], scale: s * 0.95, flip: false, visible: true, dead: 0, deadT0: 0 });
      this.actors.set('pet', p);
    } else this.actors.delete('pet');
    this.layout();
  }

  /** Sync enemy actors with the combat view. */
  setEnemies(enemies, theme, opts = {}) {
    const keep = new Set();
    const list = enemies || [];
    for (const e of list) {
      const id = `enemy:${e.idx}`; keep.add(id);
      let a = this.actors.get(id);
      if (!a || a.uid !== e.uid) {
        a = { id, uid: e.uid, act: null, flashT: 0, alpha: 1, x: opts.enterFromRight ? this.W + 120 * this.u : null, dead: e.alive ? 0 : 1, deadT0: 0, born: this.time };
        if (e.rank === 'boss') { a.kind = 'boss'; a.scale = 1.05 * this.u; }
        else if (e.rank === 'shard' || e.arch === 'shard') { a.kind = 'shard'; a.scale = 1.1 * this.u; }
        else if (e.arch === 'beast') { a.kind = 'beast'; a.look = beastLook(theme, e.name, e.rank); a.scale = 1.45 * this.u; }
        else { a.kind = 'humanoid'; a.look = enemyLook(e.arch, theme, e.rank, e.name); a.scale = 1.42 * this.u; }
        a.rank = e.rank; a.name = e.name; a.flip = true; a.visible = !e.hidden;
        this.actors.set(id, a);
      }
      a.alive = e.alive; a.hidden = !!e.hidden; a.visible = !e.hidden;
      if (!e.alive && !a.deadT0 && !a.dead) a.dead = 1;
    }
    for (const id of [...this.actors.keys()]) if (id.startsWith('enemy:') && !keep.has(id)) this.actors.delete(id);
    this.layout();
  }

  clearEnemies() { for (const id of [...this.actors.keys()]) if (id.startsWith('enemy:')) this.actors.delete(id); this.target = null; }

  setMode(mode, opts = {}) {
    this.mode = mode;
    this.modeOpts = opts;
    if (opts.props !== undefined) this.props = opts.props;
    this.layout(opts.instant);
  }

  layout(instant = false) {
    const W = this.W; const m = this.mode;
    const hero = this.actors.get('player'); const pet = this.actors.get('pet');
    let hx = 0.5, px = 0.42;
    if (m === 'create') { hx = 0.5; px = 0.4; }
    else if (m === 'hub' || m === 'camp') { hx = 0.24; px = 0.17; }
    else if (m === 'map') { hx = 0.15; px = 0.085; }
    else if (m === 'travel') { hx = 0.5; px = 0.42; }
    else if (m === 'node') { hx = 0.3; px = 0.22; }
    else if (m === 'combat') { hx = 0.27; px = 0.37; }
    else if (m === 'boss') { hx = 0.2; px = 0.3; }
    else if (m === 'summary') { hx = 0.5; px = 0.42; }
    const big = m === 'create' ? 1.45 : 1;
    if (hero) { hero.tx = W * hx; hero.scale = 1.5 * this.u * big; if (instant || hero.x == null) hero.x = hero.tx; }
    if (pet) { pet.tx = W * px; pet.scale = 1.42 * this.u * big; if (instant || pet.x == null) pet.x = pet.tx; }
    const enemies = [...this.actors.values()].filter((a) => a.id.startsWith('enemy:'));
    const boss = enemies.find((a) => a.kind === 'boss');
    const others = enemies.filter((a) => a.kind !== 'boss');
    if (boss) { boss.tx = W * 0.72; if (instant || boss.x == null) boss.x = boss.tx; }
    if (boss) {
      // Shards float between the hunter's side and the star; dead ones stay where they fell.
      const live = others.filter((a) => a.alive !== false && a.visible !== false);
      const slots = live.length <= 2 ? [0.43, 0.55] : [0.37, 0.45, 0.53, 0.61];
      live.forEach((a, i) => { a.tx = W * (slots[i] ?? (0.4 + i * 0.07)); a.dy = (i % 2 ? -56 : 6) * this.u; if (instant || a.x == null) a.x = a.tx; });
      return;
    }
    const n = others.length;
    const slots = n === 1 ? [0.7] : n === 2 ? [0.62, 0.79] : n === 3 ? [0.57, 0.7, 0.84] : [0.52, 0.63, 0.74, 0.85, 0.94];
    others.forEach((a, i) => { a.tx = W * (slots[i] ?? (0.55 + i * 0.1)); a.dy = n === 3 && i === 1 ? -10 * this.u : (i % 2) * 6 * this.u; if (instant || a.x == null) a.x = a.tx; });
  }

  /**
   * Start an action pose. dur in ms (already scaled). opts.contact: the share of dur at which the pose reaches its contact
   * key (melee strike, cast or bow release), so the wind-up stretches to the director's anticipation time; opts.from:
   * the pose to start from (an enemy holding its telegraph wind-up).
   */
  act(id, kind, dur, opts = {}) {
    const a = this.actors.get(id); if (!a) return;
    a.act = { kind, t0: this.atime, dur: Math.max(0.05, dur / 1000), contact: opts.contact ?? null, from: opts.from || 0, heavy: !!opts.heavy };
  }
  /** White flash on an actor; hold: seconds it stays full (the hit-stop). */
  hitFlash(id, hold = 0, strength = 1) { const a = this.actors.get(id); if (a) { a.flashT = this.time + hold; a.flashK = strength; } }
  kill(id) { const a = this.actors.get(id); if (a) { a.deadT0 = this.time; a.alive = false; } }
  /** Hit-stop: actors freeze for ms (contact frame); effects keep moving. */
  hitStop(ms) { if (ms > 0) this.freeze = Math.max(this.freeze, ms / 1000); }
  /** Recoil: push an actor away from the attacker (dir -1 left, +1 right) by a distance that grows with power, then back over ms. */
  knock(id, dir, power, ms) {
    const a = this.actors.get(id); if (!a || !dir) return;
    const far = (8 + 24 * clamp(power, 0, 1)) * this.u * (settings.reduceMotion ? 0.3 : 1) * (a.kind === 'boss' ? 0.35 : 1);
    a.kb = { t0: this.atime, dur: Math.max(0.15, ms / 1000), dist: far, dir };
  }
  revive(id) { const a = this.actors.get(id); if (a) { a.deadT0 = 0; a.dead = 0; a.alive = true; } }

  /** Screen anchor of an actor (CSS px): feet, head top, centre. */
  anchor(id) {
    const a = this.actors.get(id);
    if (!a) return null;
    const gy = this.groundY + (a.dy || 0);
    let top = gy - 112 * a.scale; let cy = gy - 60 * a.scale; let w = 50 * a.scale;
    if (a.kind === 'beast') { top = gy - 64 * a.scale * (a.look.size || 1); cy = gy - 30 * a.scale; w = 60 * a.scale * (a.look.size || 1); }
    if (a.kind === 'hawk') { top = gy - 105 * a.scale; cy = gy - 72 * a.scale; }
    if (a.kind === 'shard') { top = gy - 125 * a.scale; cy = gy - 72 * a.scale; w = 30 * a.scale; }
    if (a.kind === 'boss') { top = gy - 380 * a.scale; cy = gy - 210 * a.scale; w = 150 * a.scale; }
    if (a.kind === 'humanoid' && a.look && a.look.build) top = gy - 112 * a.scale * Math.sqrt(a.look.build);
    // steadyX: x without the tremble of a held telegraph, for what must stay readable over the actor (its nameplate)
    return { x: a.x + (a.lunge || 0), steadyX: a.x + (a.lunge || 0) - (a.tremble || 0), feet: gy, top, cy, w, alive: a.alive !== false && !a.deadT0, visible: a.visible !== false };
  }

  pick(x, y) {
    let best = null;
    for (const a of this.actors.values()) {
      if (!a.id.startsWith('enemy:') || a.alive === false || a.deadT0 || a.visible === false) continue;
      const an = this.anchor(a.id);
      if (x > an.x - an.w * 0.8 && x < an.x + an.w * 0.8 && y > an.top - 20 && y < an.feet + 10) {
        const d = Math.abs(x - an.x);
        if (!best || d < best.d) best = { id: a.id, d };
      }
    }
    return best ? Number(best.id.split(':')[1]) : null;
  }

  // ------------------------------------------------------------------ effects
  /**
   * Floating text over an actor. Damage numbers (style.weight 0..1 = the hit's power) slam in from a larger size and rise
   * a little; heavier hits are larger and rise less; crits are larger still, shake and linger. Numbers sit on the body,
   * below the nameplate; a second one on the same actor within 0.6 s goes beside the first, alternating sides.
   */
  float(id, text, style = {}) {
    const an = this.anchor(id); if (!an) return;
    if (style.under) { // a note under the number just shown on this actor (absorbed damage)
      const last = [...this.texts].reverse().find((f) => f.id === id && !f.small && !f.word);
      if (last) { this.texts.push({ ...last, text, color: style.color || token('--ink-bright'), size: (style.size || 14) * this.u, small: true, crit: false, slam: false, weight: 0, y: last.y + (style.dy || 20 * this.u) }); return; }
    }
    const now = this.time;
    if (style.lane === 'head') { this.headline(id, an, text, style); return; }
    if (!NUM_RE.test(text)) { this.word(id, an, text, style); return; }
    const st = this.fstack.get(id);
    const n = st && now - st.t < 0.6 ? Math.min(4, st.n + 1) : 0; this.fstack.set(id, { t: now, n });
    // numbers sit on the body (the nameplate is over the head); a second one beside the first, alternating sides
    const side = n ? (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 50 * this.u : 0;
    const jitter = (Math.random() - 0.5) * 16 * this.u;
    const w = clamp(style.weight || 0, 0, 1);
    const crit = !!style.crit; const small = !!style.small;
    const f = { id, x: an.x + jitter + side + (style.dx || 0), y: an.cy - (an.cy - an.top) * 0.15 + (style.dy || 0) - n * 6 * this.u, text, color: style.color || token('--ink-bright'),
      size: (style.size || 22) * this.u * (small ? 1 : 1 + 0.4 * w), t0: now, life: style.life || (crit ? 2.0 : small ? 1.3 : 1.55), crit, small,
      weight: w, slam: !small && style.slam !== false && !settings.reduceMotion, rise: (crit ? 18 : small ? 34 : 28 - 10 * w) * this.u, outline: style.outline || token('--fx-float-outline') };
    this.texts.push(f); this.logFloat(f);
  }
  /**
   * A headline over an actor (QA 2026-11-12): "Deathblow landed: empowered", "Deathblow answered: staggered", "Maimed:
   * healing -50 %". Its own lane: HEAD_ROWS rows above the head of the hero or the pet, under the word lane of an enemy; a
   * second headline on the same actor takes the next row. No slam (it pops from smaller), kept inside the canvas.
   */
  headline(id, an, text, style) {
    const u = this.u; const now = this.time;
    const rows = this.hrows.get(id) || Array.from({ length: HEAD_ROWS }, () => 0);
    this.hrows.set(id, rows);
    let r = rows.findIndex((t) => t <= now);
    if (r < 0) r = rows.indexOf(Math.min(...rows));
    const life = style.life || 2.2;
    const above = !String(id).startsWith('enemy:');
    const numY = an.cy - (an.cy - an.top) * 0.15;
    const y = above ? an.top - (HEAD_DY0 + r * HEAD_ROW) * u : numY + (WORD_DY0 + (WORD_ROWS - 1) * WORD_ROW + HEAD_GAP + r * HEAD_ROW) * u;
    const f = { id, x: an.x + (style.dx || 0), y, text, color: style.color || token('--ink-bright'), size: (style.size || 22) * u, t0: now, life, crit: true, small: false,
      word: true, head: true, weight: 0, slam: false, rise: (above ? 6 : 0) * u, outline: style.outline || token('--fx-float-outline') };
    const half = this.textWidth(f) / 2 + 8 * u;
    f.x = clamp(f.x, half, Math.max(half, this.W - half));
    // blind panel 2026-11-13 (item 6): an enemy's headline ("Deathblow answered: staggered") sat under the coach line at the
    // bottom centre. It moves sideways clear of a keep-out rect (right, else left), else over the enemy's head
    const box = (x, y) => ({ l: x - half, r: x + half, t: y - f.size / 2 - f.rise, b: y + f.size / 2 });
    const hit = (b) => this.keepOut.find((k) => b.l < k.right + 6 && b.r > k.left - 6 && b.t < k.bottom + 4 && b.b > k.top - 4);
    const k = hit(box(f.x, f.y));
    if (k) {
      const xs = [k.right + 8 + half, this.W - half, k.left - 8 - half, half].filter((x) => x >= half - 0.5 && x <= this.W - half + 0.5);
      const x = xs.find((xx) => !hit(box(xx, f.y)));
      if (x !== undefined) f.x = x; else f.y = an.top - (HEAD_DY0 + r * HEAD_ROW) * u;
    }
    rows[r] = now + life * 0.85;
    this.texts.push(f); this.logFloat(f);
  }
  /** The width of a float's text at rest (its font as drawn). */
  textWidth(f) {
    const c = this.ctx; c.save(); c.font = floatFont(f); // art-fx.js: the font drawFloat draws with
    const w = c.measureText(f.text).width; c.restore();
    return w + Math.max(2, f.size * (f.crit ? 0.2 : 0.16));
  }
  logFloat(f) { this.flog.push(f); if (this.flog.length > FLOG_MAX) this.flog.splice(0, this.flog.length - FLOG_MAX); }
  /**
   * The recent floats with their boxes at rest, for the browser checks (QA 2026-11-12): { id, text, x, y (top and bottom of
   * the path it rises along), w, t0, t1 (the end of its opaque time, or when the next word took its row), lane ('num',
   * 'word', 'head') }, and the scene clock.
   */
  floatBoxes() {
    const out = this.flog.map((f) => {
      const w = this.textWidth(f); const h = f.size;
      const t1 = Math.min(f.t0 + f.life * 0.72, f.cut != null ? f.cut : Infinity);
      return { id: f.id, text: f.text, x0: f.x - w / 2, x1: f.x + w / 2, y0: f.y - f.rise - h / 2, y1: f.y + h / 2, t0: f.t0, t1, lane: f.head ? 'head' : f.word ? 'word' : 'num' };
    });
    return { now: this.time, floats: out };
  }
  /**
   * A word over an actor (Interrupted!, Off-balance!, Staggered!, Dodge, a status...; UX pass 2026-11-11): words have
   * their own lane under the number lane (numbers rise away from it), in WORD_ROWS rows centred on the actor. A word takes
   * the first row that is free when it starts; a row is free WORD_HOLD s after its word started, and the word still in
   * it then fades out quickly. When every row is held, the word waits its turn (it is not drawn until it starts), so the
   * words of one moment come one after another and never cover the damage number or each other.
   */
  word(id, an, text, style) {
    const u = this.u; const now = this.time;
    const rows = this.wrows.get(id) || Array.from({ length: WORD_ROWS }, () => ({ free: 0, f: null }));
    this.wrows.set(id, rows);
    let r = 0;
    for (let i = 1; i < rows.length; i++) if (Math.max(now, rows[i].free) < Math.max(now, rows[r].free)) r = i;
    const start = Math.max(now, rows[r].free);
    const old = rows[r].f; if (old && this.texts.includes(old)) old.cut = start; // the word before it in this row makes room
    const numY = an.cy - (an.cy - an.top) * 0.15;
    const crit = !!style.crit;
    const f = { id, x: an.x + (style.dx || 0), y: numY + (WORD_DY0 + r * WORD_ROW) * u, text, color: style.color || token('--ink-bright'),
      size: Math.min(style.size || 20, WORD_MAX) * u, t0: start, life: style.life || (crit ? 1.9 : 1.5), crit, small: !crit, word: true,
      weight: 0, slam: crit && !settings.reduceMotion, rise: WORD_RISE * u, outline: style.outline || token('--fx-float-outline') };
    rows[r] = { free: start + WORD_HOLD, f };
    this.texts.push(f); this.logFloat(f);
  }
  floatAt(x, y, text, style = {}) {
    this.texts.push({ x, y, text, color: style.color || token('--ink-bright'), size: (style.size || 22) * this.u, t0: this.time, life: style.life || 1.4, crit: !!style.crit, weight: 0, slam: false, rise: 40 * this.u, outline: token('--fx-float-outline') });
  }

  burst(x, y, color, n = 14, spread = 160, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const sp = (0.3 + Math.random()) * spread * this.u;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0) * this.u, life: 0.35 + Math.random() * 0.4, t0: this.time,
        size: (opts.size || 3) * this.u * (0.5 + Math.random()), color, g: opts.g ?? 260, glow: opts.glow ?? true });
    }
  }
  /**
   * The contact of a hit: a white-hot core at the side facing the attacker, sparks thrown away from it, a ring, a slash for
   * physical hits and a starburst for crits. o: { crit, power 0..1, dir (-1 hit from the right, +1 from the left), hold
   * (s of hit-stop: the target stays white) }; a boolean o is the crit flag (older callers).
   */
  impact(id, school = 'phys', o = false) {
    const opts = typeof o === 'object' && o ? o : { crit: !!o };
    const an = this.anchor(id); if (!an) return;
    const crit = !!opts.crit; const power = clamp(opts.power ?? (crit ? 0.7 : 0.35), 0, 1); const dir = opts.dir || 0; const u = this.u;
    const col = SCHOOL_COL[school] || token('--fx-light');
    const x = an.x - dir * an.w * 0.3; const y = an.cy;
    this.cores.push({ x, y, t0: this.time, life: 0.14 + 0.12 * power + (crit ? 0.06 : 0), r: (22 + 34 * power + (crit ? 22 : 0)) * u, color: col });
    const n = Math.round(8 + 16 * power + (crit ? 12 : 0));
    for (let i = 0; i < n; i++) {
      const ang = (dir ? (dir > 0 ? 0 : Math.PI) : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 2.3;
      const sp = (110 + Math.random() * 250 * (0.6 + power)) * u;
      this.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 50 * u, life: 0.22 + Math.random() * 0.3, t0: this.time,
        size: (1.4 + Math.random() * 1.8) * u, color: Math.random() < 0.3 ? token('--fx-light') : col, g: 520, glow: true, streak: true });
    }
    this.rings.push({ x, y, t0: this.time, life: 0.28 + 0.12 * power, r0: 6 * u, r1: (32 + 46 * power + (crit ? 24 : 0)) * u, color: col, width: (2 + 2.6 * power) * u });
    if (school === 'phys') this.beams.push({ kind: 'slash', x, y, t0: this.time, life: 0.2 + 0.08 * power, color: token('--fx-light'), crit, size: 1 + 0.45 * power + (crit ? 0.25 : 0), dir });
    if (crit) this.rays.push({ x, y, t0: this.time, life: 0.34, r: (64 + 46 * power) * u, color: col, rot: Math.random() * Math.PI });
    this.hitFlash(id, opts.hold || 0);
  }
  /** Screen shake (px at 768 high); none when shake is off or under Reduce motion. */
  shake(amt) { if (settings.get('shake') && !settings.reduceMotion) this.shakeAmt = Math.max(this.shakeAmt, amt * this.u); }
  /** Screen shake for a hit that took `share` of the target's maximum health: none under 3 %, up to 11 px on the hero's side (6 on enemies). */
  shakeHit(share, onPlayerSide, crit = false) {
    if (share < 0.03) return;
    const k = Math.pow(clamp((share - 0.03) / 0.3, 0, 1), 0.7);
    this.shake(k * (onPlayerSide ? 11 : 6) * (crit ? 1.25 : 1) + 0.6);
  }
  /**
   * A spell or a heavy shot charging up for ms: an orb at the hands grows and draws sparks in; a heavy one (weight > 0.55)
   * adds a rune circle under the caster.
   */
  charge(id, color, ms, weight = 0.5) {
    if (!(ms > 0) || !this.actors.get(id)) return;
    this.charges.push({ id, t0: this.time, dur: ms / 1000, color, w: clamp(weight, 0, 1) });
  }
  screenFlash(color, alpha = 0.35, life = 0.35) { this.flash = { color, alpha, t0: this.time, life }; }
  heal(id) {
    const an = this.anchor(id); if (!an) return;
    for (let i = 0; i < 16; i++) this.particles.push({ x: an.x + (Math.random() - 0.5) * an.w * 1.4, y: an.feet - Math.random() * 40 * this.u, vx: 0, vy: -(40 + Math.random() * 70) * this.u, life: 0.9 + Math.random() * 0.5, t0: this.time, size: 2.5 * this.u, color: token('--fx-heal-plus'), g: 0, glow: true, plus: true });
  }
  /**
   * Combat v2.1: the moment a wind-up is answered (a frost-white shatter: core, starburst, a wide ring and shards thrown
   * out) or lands (an ember flare: a red core, a ring at the feet and sparks rising through the body).
   */
  windupResult(id, answered) {
    const an = this.anchor(id); if (!an) return;
    const u = this.u; const col = answered ? token('--fx-answer') : token('--fx-tele-windup'); const x = an.x; const y = an.cy;
    this.cores.push({ x, y, t0: this.time, life: 0.3, r: 64 * u, color: answered ? token('--fx-answer-core') : token('--fx-ember-core') });
    this.rings.push({ x, y, t0: this.time, life: 0.55, r0: 12 * u, r1: 120 * u, color: col, width: 4 * u });
    if (answered) {
      this.rays.push({ x, y, t0: this.time, life: 0.45, r: 110 * u, color: col, rot: Math.random() * Math.PI });
      for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2; const sp = (160 + Math.random() * 260) * u; this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * u, life: 0.35 + Math.random() * 0.35, t0: this.time, size: (1.6 + Math.random() * 2) * u, color: Math.random() < 0.35 ? token('--fx-light') : col, g: 420, glow: true, streak: true }); }
      this.shake(5);
    } else {
      this.rings.push({ x, y: an.feet, t0: this.time, life: 0.8, r0: 10 * u, r1: 80 * u, color: col, width: 3.5 * u, flat: true });
      for (let i = 0; i < 24; i++) this.particles.push({ x: x + (Math.random() - 0.5) * an.w * 1.2, y: an.feet - Math.random() * 30 * u, vx: (Math.random() - 0.5) * 30 * u, vy: -(120 + Math.random() * 140) * u, life: 0.6 + Math.random() * 0.4, t0: this.time, size: (2 + Math.random() * 1.6) * u, color: Math.random() < 0.4 ? token('--accent-hi') : col, g: 0, glow: true });
      this.shake(4);
    }
    this.hitFlash(id, 0, answered ? 0.7 : 0.5);
  }
  aura(id, color, life = 0.9) {
    const an = this.anchor(id); if (!an) return;
    this.rings.push({ x: an.x, y: an.feet, t0: this.time, life, r0: 10 * this.u, r1: 70 * this.u, color, width: 3 * this.u, flat: true });
    for (let i = 0; i < 12; i++) this.particles.push({ x: an.x + (Math.random() - 0.5) * an.w, y: an.feet - Math.random() * 90 * this.u, vx: 0, vy: -50 * this.u, life: 0.8, t0: this.time, size: 2.2 * this.u, color, g: 0, glow: true });
  }
  levelUp(id = 'player') {
    const an = this.anchor(id); if (!an) return;
    this.pillar = { x: an.x, feet: an.feet, t0: this.time, life: 2.2 };
    this.screenFlash(token('--fx-levelup-flash'), 0.25, 0.6);
    for (let i = 0; i < 60; i++) this.particles.push({ x: an.x + (Math.random() - 0.5) * 90 * this.u, y: an.feet - Math.random() * 30 * this.u, vx: (Math.random() - 0.5) * 40 * this.u, vy: -(120 + Math.random() * 220) * this.u, life: 1 + Math.random() * 1.2, t0: this.time, size: 3 * this.u, color: Math.random() < 0.5 ? token('--accent-pale') : token('--fx-levelup-mote'), g: 30, glow: true });
  }

  /**
   * Fire a projectile between two actors; resolves at impact. dur: flight time in ms, already scaled by the caller (speed,
   * tempo). opts.weight 0..1: a heavier shot is larger and leaves a brighter, longer trail.
   */
  projectile(fromId, toId, kind = 'arcane', dur = 380, opts = {}) {
    const fa = this.anchor(fromId); const ta = this.anchor(toId);
    if (!fa || !ta) return Promise.resolve();
    const d = dur;
    if (!d) return Promise.resolve();
    return new Promise((resolve) => {
      const from = { x: fa.x + (fa.x < ta.x ? 34 : -34) * this.u, y: fa.cy - 18 * this.u };
      this.projectiles.push({ from, toId, to: { x: ta.x, y: ta.cy }, t0: this.time, dur: d / 1000, kind, resolve, w: clamp(opts.weight || 0, 0, 1),
        arc: kind === 'arrow' ? 26 * this.u : kind === 'comet' ? 150 * this.u : 0 });
    });
  }
  /** Skip one hit: land the projectiles in flight and drop charge-ups at once. */
  landFlights() {
    for (const p of this.projectiles) p.resolve();
    this.projectiles = []; this.charges = []; this.freeze = 0;
  }
  finishAll() { // skip the step: land projectiles at once, end every pose
    this.landFlights();
    for (const a of this.actors.values()) { a.act = null; a.kb = null; if (a.deadT0) a.dead = 1; }
  }
  /** Drop floating text, rings, beams and sparks left from a fight (e.g. behind the run summary). */
  clearFx() { this.finishAll(); this.texts = []; this.wrows.clear(); this.hrows.clear(); this.flog = []; this.rings = []; this.beams = []; this.particles = []; this.cores = []; this.rays = []; this.pillar = null; }

  seedAmbient() {
    const kind = (THEMES[this.theme] || {}).particles;
    this.ambient = [];
    const n = { pollen: 40, motes: 50, wind: 26, dust: 50, wisps: 18, embers: 70, stars: 50 }[kind] || 30;
    const rnd = prng(42);
    for (let i = 0; i < n; i++) this.ambient.push({ x: rnd() * this.W, y: rnd() * this.H, s: 0.5 + rnd(), p: rnd() * 10, kind });
  }

  // ------------------------------------------------------------------ frame
  frame(now) {
    const t = now / 1000;
    const dt = this.last ? Math.min(0.05, t - this.last) : 0.016;
    this.last = t; this.time += dt;
    // the actor clock stops during a hit-stop
    const adt = this.freeze > 0 ? Math.max(0, dt - this.freeze) : dt;
    this.freeze = Math.max(0, this.freeze - dt); this.atime += adt;
    const ctx = this.ctx; const W = this.W; const H = this.H; const u = this.u;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // scrolling
    this.speed = lerp(this.speed, this.targetSpeed, Math.min(1, dt * 3.2));
    this.scroll += this.speed * dt;
    if (this.prevBd) { this.fade = Math.min(1, this.fade + dt / 1.4); if (this.fade >= 1) this.prevBd = null; }
    this.dim = lerp(this.dim, this.targetDim, Math.min(1, dt * 5));

    // shake
    let sx = 0, sy = 0;
    if (this.shakeAmt > 0.2) { sx = (Math.random() - 0.5) * this.shakeAmt; sy = (Math.random() - 0.5) * this.shakeAmt; this.shakeAmt *= Math.pow(0.02, dt); } else this.shakeAmt = 0;
    ctx.save(); ctx.translate(sx, sy);

    if (this.prevBd) drawBackdrop(ctx, this.prevBd, this.scroll, this.time, 1, true);
    drawBackdrop(ctx, this.bd, this.scroll, this.time, this.prevBd ? ease.inOut(this.fade) : 1, true);

    this.drawAmbient(ctx, dt, false);
    // props (set pieces) scroll with the ground
    for (const pr of this.props) this.drawProp(ctx, pr);

    // actors sorted by depth
    const walking = Math.abs(this.speed) > 5;
    const list = [...this.actors.values()].filter((a) => a.visible !== false).sort((a, b) => (a.dy || 0) - (b.dy || 0));
    for (const a of list) {
      if (a.tx != null) a.x = lerp(a.x ?? a.tx, a.tx, Math.min(1, dt * (a.id.startsWith('enemy') ? 3.2 : 4)));
      const moving = walking && (a.id === 'player' || a.id === 'pet') || (a.tx != null && Math.abs(a.x - a.tx) > 3);
      a.phase = (a.phase || 0) + dt * (moving ? (a.kind === 'beast' ? 9 : 7.5) : 0);
      this.drawActor(ctx, a, moving);
    }
    if (this.prevBd) drawForeground(ctx, this.prevBd, this.scroll, 1 - ease.inOut(this.fade));
    drawForeground(ctx, this.bd, this.scroll, this.prevBd ? ease.inOut(this.fade) : 1);

    this.drawFx(ctx, dt);
    this.drawAmbient(ctx, dt, true);
    ctx.restore();

    // grade + vignette, desaturation, dim and the screen flash (art-fx.js drawGrade); the flash ends here
    const th = THEMES[this.theme] || THEMES.farmland;
    let flash = null;
    if (this.flash) {
      const k = (this.time - this.flash.t0) / this.flash.life;
      if (k >= 1) this.flash = null; else flash = { color: this.flash.color, alpha: this.flash.alpha * (1 - k) };
    }
    drawGrade(ctx, W, H, th.grade, this.desat, this.dim, flash);
  }

  drawActor(ctx, a, moving) {
    const gy = this.groundY + (a.dy || 0);
    const t = this.time; const at = this.atime; const u = this.u;
    let act = null;
    let windup = false;
    if (a.act) { const raw = (at - a.act.t0) / a.act.dur; if (raw >= 1) a.act = null; else { act = { kind: a.act.kind, p: poseP(a.act, raw) }; windup = a.act.heavy && a.act.contact != null && raw < a.act.contact; } }
    // telegraph: an enemy whose next action is heavy or a cast holds its wind-up until it acts
    const tele = a.tele && !a.teleSpent && a.alive !== false && !a.deadT0 && a.visible !== false ? a.tele : null;
    let tremble = 0;
    if (tele && !act && a.kind !== 'boss' && a.kind !== 'shard') {
      act = a.kind === 'humanoid' ? { kind: tele.kind === 'cast' ? 'cast' : 'smash', p: tele.kind === 'cast' ? TELE_POSE.cast : TELE_POSE.smash } : { kind: 'hit', p: 0.5 };
      if (!settings.reduceMotion) tremble = Math.sin(t * 38) * (tele.kind === 'heavy' ? 1.6 : 0.7) * u;
    }
    if (windup && !settings.reduceMotion) tremble = Math.sin(t * 44) * 2 * u;
    if (tele) { // art-fx.js; drawn at the anchor of the last frame (before this frame's lunge), as before R5
      const an = this.anchor(a.id);
      const spark = an ? drawTelegraph(ctx, an, gy, a.kind, a.scale, tele, u, t) : null; if (spark) this.particles.push(spark);
    }
    let lunge = 0;
    if (act && act.kind === 'melee' && (a.kind === 'humanoid') && a.id === 'player') lunge = Math.sin(clamp(act.p, 0, 1) * Math.PI) * (a.lungeDist || 120) * u;
    if (act && act.kind === 'melee' && a.id === 'pet') lunge = Math.sin(clamp(act.p, 0, 1) * Math.PI) * 70 * u;
    if (act && (act.kind === 'melee' || act.kind === 'smash') && a.id.startsWith('enemy') && a.kind !== 'boss' && !(tele && !a.act)) lunge = -Math.sin(clamp(act.p, 0, 1) * Math.PI) * 60 * u;
    // recoil from a hit
    let kbx = 0;
    if (a.kb) { const k = (at - a.kb.t0) / a.kb.dur; if (k >= 1) a.kb = null; else kbx = a.kb.dir * a.kb.dist * (k < 0.18 ? ease.out(k / 0.18) : 1 - ease.inOut((k - 0.18) / 0.82)); }
    lunge += kbx + tremble;
    a.lunge = lunge; a.tremble = tremble; // anchor(): nameplates follow the lunge and recoil, not the telegraph's tremble
    const flash = a.flashT ? clamp(1 - (t - a.flashT) / 0.2, 0, 1) * (a.flashK ?? 1) : 0;
    let dead = a.dead || 0;
    if (a.deadT0) { dead = clamp((t - a.deadT0) / 0.7, 0, 1); if (dead >= 1) a.dead = 1; }
    const alpha = (a.alpha ?? 1) * (a.kind === 'humanoid' && a.id === 'player' && this.stealth ? 0.55 : 1) * (dead > 0 && a.id !== 'player' ? 1 - clamp((dead - 0.6) / 0.4, 0, 0.75) : 1);
    const x = a.x + lunge;
    // shadow, the target / hover ring, the rank aura (art-fx.js)
    drawShadow(ctx, a.kind, x, gy, a.scale, a.look, u);
    if (a.id.startsWith('enemy') && a.alive !== false && !a.deadT0 && (this.target === a.id || this.hover === a.id)) drawTargetRing(ctx, a.kind, x, gy, a.scale, u, this.target === a.id);
    if (a.alive !== false && !a.deadT0) drawRankAura(ctx, a.rank, x, gy, a.scale, t);
    ctx.save(); ctx.globalAlpha *= alpha;
    const anim = { t: at + (a.born || 0) * 0.37 + (a.id.length * 0.9), walk: moving ? 1 : 0, phase: a.phase, act, flash: 0, dead, flip: a.flip, bossPhase: this.bossPhase };
    const draw = (c) => {
      if (a.kind === 'humanoid') drawHumanoid(c, x, gy, a.scale, a.look, anim);
      else if (a.kind === 'beast' || a.kind === 'hawk') drawBeast(c, x, gy, a.scale, a.look, anim);
      else if (a.kind === 'boss') drawBoss(c, x, gy, a.scale, { ...anim, flash });
      else if (a.kind === 'shard') drawShard(c, x, gy, a.scale, anim);
    };
    // the hit flash tints only the actor's own pixels (drawn on a scratch canvas), not the scene behind it
    if (flash > 0.02 && a.kind !== 'boss') this.drawFlashed(ctx, a, x, gy, flash, draw);
    else draw(ctx);
    ctx.restore();
    // ward bubble / status visuals (art-fx.js); a burning actor throws an ember now and then
    if (!(a.fxWard || a.fxStun || a.fxBurn || a.fxFrozen || a.fxHex || a.fxSap || a.fxOffBal)) return;
    const an = this.anchor(a.id); const live = a.alive !== false;
    if (a.fxWard) drawWard(ctx, an, u);
    if (a.fxStun && live) drawStun(ctx, an, u, t);
    if (a.fxBurn && live) { const spark = burnSpark(an, u, t); if (spark) this.particles.push(spark); }
    if (a.fxFrozen && live) drawFrozen(ctx, an);
    if (a.fxHex && live) drawHex(ctx, an, u, t);
    if (a.fxSap && live && !a.deadT0) drawSleep(ctx, an, u, t);
    if (a.fxOffBal && live && !a.deadT0) { const spark = drawOffBalance(ctx, an, gy, a.kind, a.scale, u, t); if (spark) this.particles.push(spark); }
  }

  /** Draw an actor through a scratch canvas and tint its pixels white by `flash` (the contact frame of a hit). */
  drawFlashed(ctx, a, x, gy, flash, draw) {
    const u = this.u; const k = (a.look && a.look.size) || 1;
    const bw = 340 * u * k; const bh = 360 * u * k; const left = x - bw / 2; const top = gy - bh + 30 * u;
    const dpr = this.dpr; const pw = Math.ceil(bw * dpr); const ph = Math.ceil(bh * dpr);
    const oc = this.flashCanvas || (this.flashCanvas = document.createElement('canvas'));
    if (oc.width < pw || oc.height < ph) { oc.width = Math.max(oc.width, pw); oc.height = Math.max(oc.height, ph); }
    const o = oc.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, pw, ph);
    o.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    draw(o);
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-atop';
    o.fillStyle = rgba(token('--fx-light'), 0.85 * clamp(flash, 0, 1)); o.fillRect(0, 0, pw, ph);
    o.globalCompositeOperation = 'source-over';
    ctx.drawImage(oc, 0, 0, pw, ph, left, top, bw, bh);
  }

  /** A set piece (art-props.js), an NPC (art-actors.js) or a tree (art-world.js) on the ground line; an arriving one slides in. */
  drawProp(ctx, pr) {
    const u = this.u; const gy = this.groundY; const t = this.time;
    const x = pr.x != null ? pr.x : this.W * (pr.at || 0.66);
    if (pr.tx != null) pr.x = lerp(pr.x ?? pr.tx, pr.tx, Math.min(1, 0.06));
    const th = THEMES[this.theme] || THEMES.farmland;
    if (pr.kind === 'npc') {
      drawHumanoid(ctx, x, gy, 1.4 * u, pr.look, { t: t + 3, flip: true });
      if (pr.mark) drawQuestMark(ctx, pr.mark, x, gy, u, t); // floating quest mark
    } else if (pr.kind === 'oak') oak(ctx, x, gy, u * 1.3, { near: shade(th.near, 0.1), leaf: shade(th.near, 0.12), light: th.light }, prng(7));
    else if (pr.kind === 'pine') pine(ctx, x, gy, u * 1.6, th.near, prng(8));
    else drawSetPiece(ctx, pr.kind, x, gy, u, t, th, pr);
  }

  /** Effects (art-fx.js draws them): this keeps the records, ends them, moves the particles and lays out the floats. */
  drawFx(ctx, dt) {
    const t = this.time; const u = this.u;
    // charge-ups: an orb at the caster's hands grows and pulls sparks in; heavy ones draw a rune circle on the ground
    for (const c of [...this.charges]) {
      const k = (t - c.t0) / c.dur; const an = this.anchor(c.id);
      if (k >= 1 || !an) { this.charges.splice(this.charges.indexOf(c), 1); continue; }
      const spark = drawCharge(ctx, an, an.x < this.W * 0.5 ? 1 : -1, k, c.w, c.color, u, t); if (spark) this.particles.push(spark);
    }
    // projectiles, with trails: the flight path is here, the shot and its trail in art-fx.js
    for (const p of [...this.projectiles]) {
      const k = (t - p.t0) / p.dur;
      const ta = this.anchor(p.toId); if (ta) { p.to.x = ta.x; p.to.y = ta.cy; }
      if (k >= 1) { this.projectiles.splice(this.projectiles.indexOf(p), 1); p.resolve(); continue; }
      const ease1 = (q) => (p.kind === 'arrow' ? q : ease.in(q));
      const at = (q) => { const e = ease1(clamp(q, 0, 1)); return [lerp(p.from.x, p.to.x, e), lerp(p.from.y, p.to.y, e) - Math.sin(e * Math.PI) * p.arc]; };
      for (const s of drawBolt(ctx, p.kind, p.w, k, at, u, t)) this.particles.push(s);
    }
    // impact cores (a white-hot flash at the contact point), crit starbursts, rings, slashes
    for (const c of [...this.cores]) { const k = (t - c.t0) / c.life; if (k >= 1) { this.cores.splice(this.cores.indexOf(c), 1); continue; } drawCore(ctx, c, k); }
    for (const b of [...this.rays]) { const k = (t - b.t0) / b.life; if (k >= 1) { this.rays.splice(this.rays.indexOf(b), 1); continue; } drawRays(ctx, b, k, u); }
    for (const r of [...this.rings]) { const k = (t - r.t0) / r.life; if (k >= 1) { this.rings.splice(this.rings.indexOf(r), 1); continue; } drawRing(ctx, r, k); }
    for (const b of [...this.beams]) { const k = (t - b.t0) / b.life; if (k >= 1) { this.beams.splice(this.beams.indexOf(b), 1); continue; } drawSlash(ctx, b, k, u); }
    // level-up pillar
    if (this.pillar) { const k = (t - this.pillar.t0) / this.pillar.life; if (k >= 1) this.pillar = null; else drawPillar(ctx, this.pillar, k, u); }
    // particles: they move here
    ctx.save();
    for (const q of [...this.particles]) {
      const k = (t - q.t0) / q.life; if (k >= 1) { this.particles.splice(this.particles.indexOf(q), 1); continue; }
      q.vy += (q.g || 0) * u * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      drawParticle(ctx, q, 1 - k);
    }
    ctx.restore();
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    // floating text: damage numbers slam in (crits larger, slower, shaking), then rise a little and fade
    for (const f of [...this.texts]) {
      const age = t - f.t0; const k = age / f.life;
      const cutK = f.cut != null && t > f.cut ? (t - f.cut) / WORD_CUT : 0; // a word whose row the next word took
      if (k >= 1 || cutK >= 1) { this.texts.splice(this.texts.indexOf(f), 1); continue; }
      if (age < 0) continue; // a word waiting for its row
      let sc = 1;
      if (f.slam) {
        const s0 = f.word ? 1.45 : f.crit ? 2.1 : 1.5 + 0.35 * f.weight; const sd = f.crit ? 0.17 : 0.11; const rest = f.crit && !f.word ? 1.1 : 1;
        sc = age < sd ? lerp(s0, rest * 0.92, ease.out(age / sd)) : age < sd + 0.08 ? lerp(rest * 0.92, rest, (age - sd) / 0.08) : rest;
      } else if (!f.small && age < 0.1) sc = 0.75 + 2.5 * age;
      const y = f.y - f.rise * ease.out(clamp(age / (f.crit ? 1.25 : 0.9), 0, 1));
      const jx = f.crit && f.slam && age < 0.32 ? Math.sin(age * 95) * 3.2 * u * (1 - age / 0.32) : 0;
      const a = (k < 0.72 ? 1 : 1 - (k - 0.72) / 0.28) * (1 - cutK);
      drawFloat(ctx, f, f.x + jx, y, sc, a, u);
    }
  }

  drawAmbient(ctx, dt, front) {
    const u = this.u; const t = this.time; const W = this.W; const H = this.H; const sp = this.speed;
    ctx.save();
    for (let i = 0; i < this.ambient.length; i++) {
      const p = this.ambient[i];
      if ((i % 3 === 0) !== front) continue;
      const k = p.kind;
      let vx = -sp * (front ? 0.9 : 0.35) * 0.05, vy = 0;
      if (k === 'pollen') { vx += 8 * u; vy = Math.sin(t + p.p) * 6 * u; }
      if (k === 'motes') { vx += 4 * u; vy = -3 * u + Math.sin(t * 0.7 + p.p) * 4 * u; }
      if (k === 'wind') { vx += -260 * u * p.s; }
      if (k === 'dust') { vx += -30 * u * p.s; vy = Math.sin(t + p.p) * 5 * u; }
      if (k === 'wisps') { vx += Math.sin(t * 0.5 + p.p) * 10 * u; vy = Math.cos(t * 0.6 + p.p) * 8 * u; }
      if (k === 'embers') { vx += 10 * u; vy = -40 * u * p.s; }
      if (k === 'stars') { vy = -10 * u * p.s; }
      p.x += vx * dt - sp * dt * (front ? 0.6 : 0.15); p.y += vy * dt;
      if (p.x < -20) p.x += W + 40; if (p.x > W + 20) p.x -= W + 40; if (p.y < -20) p.y += H + 40; if (p.y > H + 20) p.y -= H + 40;
      drawMote(ctx, p, front, u, t);
    }
    ctx.restore();
  }
}

/** Held pose of a telegraph wind-up (pose progress): the weapon raised, or the hands up for a cast. */
const TELE_POSE = { melee: 0.26, smash: 0.26, cast: 0.42 };
/** Pose keys (pose progress) at contact: the melee strike lands, a cast or a bow is released. */
const POSE_KEY = { melee: 0.5, smash: 0.5, cast: 0.6, shoot: 0.6 };
/**
 * Pose progress of an action at real progress raw: the wind-up up to the contact key fills act.contact of the time. A melee
 * wind-up raises the weapon and holds it, then strikes in the last 30 % (anticipation); a cast or a bow draw eases into
 * full draw and holds there until the release.
 */
function poseP(act, raw) {
  const key = POSE_KEY[act.kind];
  if (act.contact == null || key == null) return raw;
  const c = clamp(act.contact, 0.05, 0.95); const from = Math.min(act.from || 0, key);
  if (raw >= c) return key + (1 - key) * ((raw - c) / (1 - c));
  const k = raw / c;
  if (act.kind === 'melee' || act.kind === 'smash') {
    const top = Math.max(0.33, from); const split = 0.7;
    return k < split ? from + (top - from) * ease.out(k / split) : top + (key - top) * ease.in((k - split) / (1 - split));
  }
  return from + (key - from) * ease.out(k);
}
