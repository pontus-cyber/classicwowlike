// The world canvas: painted parallax backdrop, the hero in the centre, enemies, set pieces and
// combat effects. Pure presentation: it is told what happened and animates it.
// Combat feel (owner feedback 2026-11-10, src/ui/combat-feel.js): actors run on their own clock (atime) that a hit-stop
// freezes for a moment at contact; hits knock the target back, flash, throw sparks and pop a damage number that slams in
// (crits larger and slower); screen shake scales with the share of health a hit took and is off under Reduce motion;
// heavy and cast intents hold a visible wind-up (telegraph) until the enemy acts; spells charge up and projectiles leave trails.
// Combat v2.1 (docs/specs/combat-v2.md 16): a wind-up intent has its own, hotter telegraph, and the moment one is answered
// (a frost shatter) or lands (an ember flare) has its effect (windupResult).
import { buildBackdrop, drawBackdrop, drawForeground, THEMES, GROUND_Y, oak, pine } from './art-world.js';
import { drawHumanoid, drawBeast, drawBoss, drawShard, HERO_LOOKS, PET_LOOKS, enemyLook, beastLook, glowBall } from './art-actors.js';
import { clamp, lerp, ease, rgba, shade, mix, prng } from './util.js';
import { settings } from './settings.js';

const SCHOOL_COL = { phys: '#f4ead6', fire: '#ff8a3a', frost: '#8fd6ff', arcane: '#c79bff', shadow: '#a07aff', nature: '#8fe07a', heal: '#7fffa0' };

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
      const last = [...this.texts].reverse().find((f) => f.id === id && !f.small);
      if (last) { this.texts.push({ ...last, text, color: style.color || '#ffffff', size: (style.size || 14) * this.u, small: true, crit: false, slam: false, weight: 0, y: last.y + (style.dy || 20 * this.u) }); return; }
    }
    const now = this.time; const st = this.fstack.get(id);
    const n = st && now - st.t < 0.6 ? Math.min(4, st.n + 1) : 0; this.fstack.set(id, { t: now, n });
    // numbers sit on the body (the nameplate is over the head); a second one beside the first, alternating sides
    const side = n ? (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 50 * this.u : 0;
    const jitter = (Math.random() - 0.5) * 16 * this.u;
    const w = clamp(style.weight || 0, 0, 1);
    const crit = !!style.crit; const small = !!style.small;
    this.texts.push({ id, x: an.x + jitter + side + (style.dx || 0), y: an.cy - (an.cy - an.top) * 0.15 + (style.dy || 0) - n * 6 * this.u, text, color: style.color || '#ffffff',
      size: (style.size || 22) * this.u * (small ? 1 : 1 + 0.4 * w), t0: now, life: style.life || (crit ? 2.0 : small ? 1.3 : 1.55), crit, small,
      weight: w, slam: !small && style.slam !== false && !settings.reduceMotion, rise: (crit ? 18 : small ? 34 : 28 - 10 * w) * this.u, outline: style.outline || 'rgba(0,0,0,0.85)' });
  }
  floatAt(x, y, text, style = {}) {
    this.texts.push({ x, y, text, color: style.color || '#fff', size: (style.size || 22) * this.u, t0: this.time, life: style.life || 1.4, crit: !!style.crit, weight: 0, slam: false, rise: 40 * this.u, outline: 'rgba(0,0,0,0.85)' });
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
    const col = SCHOOL_COL[school] || '#fff';
    const x = an.x - dir * an.w * 0.3; const y = an.cy;
    this.cores.push({ x, y, t0: this.time, life: 0.14 + 0.12 * power + (crit ? 0.06 : 0), r: (22 + 34 * power + (crit ? 22 : 0)) * u, color: col });
    const n = Math.round(8 + 16 * power + (crit ? 12 : 0));
    for (let i = 0; i < n; i++) {
      const ang = (dir ? (dir > 0 ? 0 : Math.PI) : Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 2.3;
      const sp = (110 + Math.random() * 250 * (0.6 + power)) * u;
      this.particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 50 * u, life: 0.22 + Math.random() * 0.3, t0: this.time,
        size: (1.4 + Math.random() * 1.8) * u, color: Math.random() < 0.3 ? '#ffffff' : col, g: 520, glow: true, streak: true });
    }
    this.rings.push({ x, y, t0: this.time, life: 0.28 + 0.12 * power, r0: 6 * u, r1: (32 + 46 * power + (crit ? 24 : 0)) * u, color: col, width: (2 + 2.6 * power) * u });
    if (school === 'phys') this.beams.push({ kind: 'slash', x, y, t0: this.time, life: 0.2 + 0.08 * power, color: '#ffffff', crit, size: 1 + 0.45 * power + (crit ? 0.25 : 0), dir });
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
    for (let i = 0; i < 16; i++) this.particles.push({ x: an.x + (Math.random() - 0.5) * an.w * 1.4, y: an.feet - Math.random() * 40 * this.u, vx: 0, vy: -(40 + Math.random() * 70) * this.u, life: 0.9 + Math.random() * 0.5, t0: this.time, size: 2.5 * this.u, color: '#9dffb8', g: 0, glow: true, plus: true });
  }
  /**
   * Combat v2.1: the moment a wind-up is answered (a frost-white shatter: core, starburst, a wide ring and shards thrown
   * out) or lands (an ember flare: a red core, a ring at the feet and sparks rising through the body).
   */
  windupResult(id, answered) {
    const an = this.anchor(id); if (!an) return;
    const u = this.u; const col = answered ? '#9fdcff' : '#ff5a2a'; const x = an.x; const y = an.cy;
    this.cores.push({ x, y, t0: this.time, life: 0.3, r: 64 * u, color: answered ? '#e8f8ff' : '#ffb07a' });
    this.rings.push({ x, y, t0: this.time, life: 0.55, r0: 12 * u, r1: 120 * u, color: col, width: 4 * u });
    if (answered) {
      this.rays.push({ x, y, t0: this.time, life: 0.45, r: 110 * u, color: col, rot: Math.random() * Math.PI });
      for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2; const sp = (160 + Math.random() * 260) * u; this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * u, life: 0.35 + Math.random() * 0.35, t0: this.time, size: (1.6 + Math.random() * 2) * u, color: Math.random() < 0.35 ? '#ffffff' : col, g: 420, glow: true, streak: true }); }
      this.shake(5);
    } else {
      this.rings.push({ x, y: an.feet, t0: this.time, life: 0.8, r0: 10 * u, r1: 80 * u, color: col, width: 3.5 * u, flat: true });
      for (let i = 0; i < 24; i++) this.particles.push({ x: x + (Math.random() - 0.5) * an.w * 1.2, y: an.feet - Math.random() * 30 * u, vx: (Math.random() - 0.5) * 30 * u, vy: -(120 + Math.random() * 140) * u, life: 0.6 + Math.random() * 0.4, t0: this.time, size: (2 + Math.random() * 1.6) * u, color: Math.random() < 0.4 ? '#ffd36a' : col, g: 0, glow: true });
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
    this.screenFlash('#ffe8a0', 0.25, 0.6);
    for (let i = 0; i < 60; i++) this.particles.push({ x: an.x + (Math.random() - 0.5) * 90 * this.u, y: an.feet - Math.random() * 30 * this.u, vx: (Math.random() - 0.5) * 40 * this.u, vy: -(120 + Math.random() * 220) * this.u, life: 1 + Math.random() * 1.2, t0: this.time, size: 3 * this.u, color: Math.random() < 0.5 ? '#ffe08a' : '#fff6d6', g: 30, glow: true });
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
  clearFx() { this.finishAll(); this.texts = []; this.rings = []; this.beams = []; this.particles = []; this.cores = []; this.rays = []; this.pillar = null; }

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

    // grade + vignette
    const th = THEMES[this.theme] || THEMES.farmland;
    ctx.fillStyle = th.grade; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (this.desat > 0) { ctx.fillStyle = `rgba(20,16,24,${0.55 * this.desat})`; ctx.fillRect(0, 0, W, H); }
    if (this.dim > 0.01) { ctx.fillStyle = `rgba(8,6,4,${this.dim})`; ctx.fillRect(0, 0, W, H); }
    if (this.flash) {
      const k = (this.time - this.flash.t0) / this.flash.life;
      if (k >= 1) this.flash = null; else { ctx.fillStyle = rgba(this.flash.color, this.flash.alpha * (1 - k)); ctx.fillRect(0, 0, W, H); }
    }
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
    if (tele) this.drawTelegraph(ctx, a, tele, gy);
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
    // shadow
    if (a.kind !== 'boss') {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      const w = (a.kind === 'beast' ? 46 : a.kind === 'shard' ? 22 : 30) * a.scale * (a.look && a.look.size || 1) * (a.look && a.look.build || 1);
      ctx.beginPath(); ctx.ellipse(x, gy + 2 * this.u, w, 7 * this.u, 0, 0, Math.PI * 2); ctx.fill();
    }
    // target / hover ring
    if (a.id.startsWith('enemy') && a.alive !== false && !a.deadT0 && (this.target === a.id || this.hover === a.id)) {
      const sel = this.target === a.id;
      const w = (a.kind === 'boss' ? 150 : a.kind === 'beast' ? 56 : 40) * a.scale;
      ctx.save();
      ctx.strokeStyle = sel ? 'rgba(255,90,70,0.95)' : 'rgba(255,230,160,0.6)'; ctx.lineWidth = (sel ? 3 : 2) * this.u;
      ctx.shadowColor = sel ? '#ff3a2a' : '#ffd27a'; ctx.shadowBlur = 10 * this.u;
      ctx.beginPath(); ctx.ellipse(x, gy + 2 * this.u, w, 11 * this.u, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // elite aura
    if ((a.rank === 'elite' || a.rank === 'rare' || a.rank === 'dboss') && a.alive !== false && !a.deadT0) {
      const col = a.rank === 'rare' ? '#d8e4ff' : a.rank === 'dboss' ? '#ff7a4a' : '#ffd27a';
      const g = ctx.createRadialGradient(x, gy - 50 * a.scale, 10, x, gy - 50 * a.scale, 90 * a.scale);
      g.addColorStop(0, rgba(col, 0.18 + 0.06 * Math.sin(t * 3))); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, gy - 50 * a.scale, 90 * a.scale, 0, Math.PI * 2); ctx.fill();
    }
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
    // ward bubble / status visuals
    if (a.fxWard) { const an = this.anchor(a.id); ctx.save(); ctx.strokeStyle = 'rgba(160,200,255,0.75)'; ctx.lineWidth = 2 * this.u; ctx.fillStyle = 'rgba(140,180,255,0.10)'; ctx.beginPath(); ctx.ellipse(an.x, an.cy - 8 * this.u, an.w * 1.1, (an.feet - an.top) * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (a.fxStun && a.alive !== false) { const an = this.anchor(a.id); for (let i = 0; i < 3; i++) { const ang = t * 4 + i * 2.1; ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(an.x + Math.cos(ang) * 16 * this.u, an.top - 4 * this.u + Math.sin(ang) * 4 * this.u, 3 * this.u, 0, Math.PI * 2); ctx.fill(); } }
    if (a.fxBurn && a.alive !== false) { const an = this.anchor(a.id); if (Math.random() < 0.4) this.particles.push({ x: an.x + (Math.random() - 0.5) * an.w, y: an.cy, vx: 0, vy: -60 * this.u, life: 0.5, t0: t, size: 2.5 * this.u, color: '#ff9a4a', g: 0, glow: true }); }
    if (a.fxFrozen && a.alive !== false) { const an = this.anchor(a.id); ctx.fillStyle = 'rgba(170,220,255,0.28)'; ctx.fillRect(an.x - an.w * 0.7, an.top, an.w * 1.4, an.feet - an.top); }
    if (a.fxHex && a.alive !== false) { const an = this.anchor(a.id); ctx.save(); ctx.strokeStyle = 'rgba(200,150,255,0.8)'; ctx.lineWidth = 2 * this.u; ctx.beginPath(); ctx.ellipse(an.x, an.feet, an.w, 10 * this.u, 0, t * 2, t * 2 + 4.5); ctx.stroke(); ctx.restore(); }
    if (a.fxSap && a.alive !== false && !a.deadT0) this.drawSleep(ctx, a);
    if (a.fxOffBal && a.alive !== false && !a.deadT0) this.drawOffBalance(ctx, a, gy);
  }

  /** Sapped (combat v2): drifting Z letters over the head. */
  drawSleep(ctx, a) {
    const an = this.anchor(a.id); if (!an) return;
    const t = this.time; const u = this.u;
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#d8ccff'; ctx.strokeStyle = 'rgba(20,10,40,0.85)'; ctx.lineWidth = 3 * u;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.55 + i / 3) % 1);
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.95;
      ctx.font = `900 ${(11 + 7 * k) * u}px Georgia, serif`;
      const x = an.x + (10 + 16 * k) * u; const y = an.top + 6 * u - 34 * k * u;
      ctx.strokeText('Z', x, y); ctx.fillText('Z', x, y);
    }
    ctx.restore();
  }

  /**
   * Off-balance (combat v2, rules 7.13): the enemy's guard is broken. A pulsing amber ring of broken segments at its feet,
   * a warm glow on its body and rising sparks, until the window closes.
   */
  drawOffBalance(ctx, a, gy) {
    const an = this.anchor(a.id); if (!an) return;
    const t = this.time; const u = this.u;
    const w = (a.kind === 'boss' ? 150 : a.kind === 'beast' ? 62 : 46) * a.scale / (a.kind === 'boss' ? 1 : 1.25);
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    ctx.save();
    const g = ctx.createRadialGradient(an.x, an.cy, 4 * u, an.x, an.cy, (an.feet - an.top) * 0.85);
    g.addColorStop(0, `rgba(255,190,70,${0.16 + 0.12 * pulse})`); g.addColorStop(1, 'rgba(255,170,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(an.x, an.cy, (an.feet - an.top) * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#ffb030'; ctx.shadowBlur = 14 * u; ctx.lineCap = 'round';
    const segs = 8; const rot = t * 0.9;
    for (let i = 0; i < segs; i++) {
      const a0 = rot + (i / segs) * Math.PI * 2; const a1 = a0 + (Math.PI * 2 / segs) * 0.62;
      ctx.strokeStyle = `rgba(255,${200 + 30 * pulse},90,${0.7 + 0.3 * pulse})`; ctx.lineWidth = (3 + 1.5 * pulse) * u;
      ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * (1.25 + 0.1 * pulse), 15 * u, 0, a0, a1); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.45) this.particles.push({ x: an.x + (Math.random() - 0.5) * w * 2, y: gy, vx: (Math.random() - 0.5) * 20 * u, vy: -(80 + Math.random() * 70) * u, life: 0.7, t0: t, size: 2.4 * u, color: '#ffc85a', g: 0, glow: true });
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
    o.fillStyle = rgba('#ffffff', 0.85 * clamp(flash, 0, 1)); o.fillRect(0, 0, pw, ph);
    o.globalCompositeOperation = 'source-over';
    ctx.drawImage(oc, 0, 0, pw, ph, left, top, bw, bh);
  }

  /** The telegraph under and around an enemy: a pulsing red ring for a heavy blow, a turning rune circle for a cast. */
  drawTelegraph(ctx, a, tele, gy) {
    const an = this.anchor(a.id); if (!an) return;
    const t = this.time; const u = this.u; const col = tele.color || '#ff4a2a';
    const w = (a.kind === 'boss' ? 150 : a.kind === 'beast' ? 60 : 44) * a.scale / (a.kind === 'boss' ? 1 : 1.4);
    const pulse = 0.5 + 0.5 * Math.sin(t * 6.5);
    ctx.save();
    const g = ctx.createRadialGradient(an.x, an.cy, 4 * u, an.x, an.cy, (an.feet - an.top) * 0.75);
    g.addColorStop(0, rgba(col, 0.16 + 0.12 * pulse)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(an.x, an.cy, (an.feet - an.top) * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = col; ctx.shadowBlur = 12 * u;
    if (tele.kind === 'windup') {
      // combat v2.1: a wind-up (rules 7.12) burns hotter: a thick ember ring, a turning rune ring outside it, rising embers
      const fast = 0.5 + 0.5 * Math.sin(t * 9);
      ctx.strokeStyle = rgba(col, 0.65 + 0.35 * fast); ctx.lineWidth = (3.5 + 2 * fast) * u;
      ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * (1.1 + 0.14 * fast), 13 * u, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba('#ffd36a', 0.55 + 0.3 * pulse); ctx.lineWidth = 2 * u; ctx.setLineDash([9 * u, 6 * u]); ctx.lineDashOffset = -t * 60 * u;
      ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * 1.6, 19 * u, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      if (Math.random() < 0.6) this.particles.push({ x: an.x + (Math.random() - 0.5) * w * 2, y: gy, vx: (Math.random() - 0.5) * 16 * u, vy: -(90 + Math.random() * 90) * u, life: 0.7, t0: t, size: 2.4 * u, color: Math.random() < 0.4 ? '#ffd36a' : col, g: 0, glow: true });
    } else if (tele.kind === 'heavy') {
      ctx.strokeStyle = rgba(col, 0.55 + 0.4 * pulse); ctx.lineWidth = (2.5 + 1.5 * pulse) * u;
      ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * (1.05 + 0.12 * pulse), 12 * u, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5 * u; ctx.strokeStyle = rgba(col, 0.35 * pulse);
      ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * 1.45, 17 * u, 0, 0, Math.PI * 2); ctx.stroke();
      if (Math.random() < 0.35) this.particles.push({ x: an.x + (Math.random() - 0.5) * w * 1.6, y: gy, vx: 0, vy: -(70 + Math.random() * 60) * u, life: 0.6, t0: t, size: 2 * u, color: col, g: 0, glow: true });
    } else {
      ctx.strokeStyle = rgba(col, 0.6 + 0.3 * pulse); ctx.lineWidth = 2 * u; ctx.setLineDash([7 * u, 5 * u]); ctx.lineDashOffset = -t * 40 * u;
      ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * 1.15, 13 * u, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      if (Math.random() < 0.5) { const ang = Math.random() * Math.PI * 2; const r = (34 + Math.random() * 20) * u; this.particles.push({ x: an.x + Math.cos(ang) * r, y: an.cy - 10 * u + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 1.8, vy: -Math.sin(ang) * r * 1.8, life: 0.5, t0: t, size: 2 * u, color: col, g: 0, glow: true }); }
    }
    ctx.restore();
  }

  drawProp(ctx, pr) {
    const u = this.u; const gy = this.groundY; const t = this.time;
    const x = pr.x != null ? pr.x : this.W * (pr.at || 0.66);
    if (pr.tx != null) pr.x = lerp(pr.x ?? pr.tx, pr.tx, Math.min(1, 0.06));
    const th = THEMES[this.theme] || THEMES.farmland;
    switch (pr.kind) {
      case 'campfire': campfire(ctx, x, gy, u, t); break;
      case 'tent': tent(ctx, x, gy, u, th); break;
      case 'cart': cart(ctx, x, gy, u, th); break;
      case 'stone': shrineStone(ctx, x, gy, u, t, th.accent); break;
      case 'chest': chest(ctx, x, gy, u, t, pr.open); break;
      case 'gate': gate(ctx, x, gy, u, t, th); break;
      case 'sign': signpost(ctx, x, gy, u, th); break;
      case 'npc': {
        drawHumanoid(ctx, x, gy, 1.4 * u, pr.look, { t: t + 3, flip: true });
        if (pr.mark) { // floating quest mark
          const y = gy - 190 * u + Math.sin(t * 3) * 4 * u;
          ctx.save(); ctx.font = `900 ${34 * u}px Georgia, serif`; ctx.textAlign = 'center';
          ctx.shadowColor = '#ffcc33'; ctx.shadowBlur = 16 * u; ctx.fillStyle = '#ffd94a'; ctx.fillText(pr.mark, x, y);
          ctx.shadowBlur = 0; ctx.lineWidth = 2 * u; ctx.strokeStyle = '#5a3a0a'; ctx.strokeText(pr.mark, x, y); ctx.restore();
        }
        break;
      }
      case 'banner': banner(ctx, x, gy, u, t, pr.color || th.ui.tint); break;
      case 'oak': oak(ctx, x, gy, u * 1.3, { near: shade(th.near, 0.1), leaf: shade(th.near, 0.12), light: th.light }, prng(7)); break;
      case 'pine': pine(ctx, x, gy, u * 1.6, th.near, prng(8)); break;
      default: break;
    }
  }

  drawFx(ctx, dt) {
    const t = this.time; const u = this.u;
    // charge-ups: an orb at the caster's hands grows and pulls sparks in; heavy ones draw a rune circle on the ground
    for (const c of [...this.charges]) {
      const k = (t - c.t0) / c.dur; const an = this.anchor(c.id);
      if (k >= 1 || !an) { this.charges.splice(this.charges.indexOf(c), 1); continue; }
      const toward = an.x < this.W * 0.5 ? 1 : -1;
      const hx = an.x + toward * 26 * u; const hy = an.cy - 24 * u;
      const r = (2 + (5 + 9 * c.w) * ease.in(k)) * u;
      glowBall(ctx, hx, hy, r, c.color);
      if (Math.random() < 0.6 + c.w * 0.4) { const ang = Math.random() * Math.PI * 2; const d = (30 + 40 * c.w) * u; this.particles.push({ x: hx + Math.cos(ang) * d, y: hy + Math.sin(ang) * d, vx: -Math.cos(ang) * d * 2.6, vy: -Math.sin(ang) * d * 2.6, life: 0.36, t0: t, size: (1.5 + c.w) * u, color: c.color, g: 0, glow: true }); }
      if (c.w > 0.55) {
        ctx.save(); ctx.strokeStyle = rgba(c.color, 0.25 + 0.55 * ease.out(k)); ctx.lineWidth = 2 * u; ctx.shadowColor = c.color; ctx.shadowBlur = 10 * u;
        ctx.setLineDash([9 * u, 5 * u]); ctx.lineDashOffset = -t * 60 * u;
        ctx.beginPath(); ctx.ellipse(an.x, an.feet + 2 * u, (40 + 30 * ease.out(k)) * u, (10 + 6 * ease.out(k)) * u, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    // projectiles, with trails
    for (const p of [...this.projectiles]) {
      const k = (t - p.t0) / p.dur;
      const ta = this.anchor(p.toId); if (ta) { p.to.x = ta.x; p.to.y = ta.cy; }
      if (k >= 1) { this.projectiles.splice(this.projectiles.indexOf(p), 1); p.resolve(); continue; }
      const ease1 = (q) => (p.kind === 'arrow' ? q : ease.in(q));
      const at = (q) => { const e = ease1(clamp(q, 0, 1)); return [lerp(p.from.x, p.to.x, e), lerp(p.from.y, p.to.y, e) - Math.sin(e * Math.PI) * p.arc]; };
      const [x, y] = at(k);
      const col = { fire: '#ff8a3a', frost: '#9fdcff', arcane: '#c79bff', shadow: '#9a6aff', nature: '#9be07a', comet: '#ffb05a', phys: '#ffffff', arrow: p.w > 0.5 ? '#ffd27a' : '#fff1d0' }[p.kind] || '#ffffff';
      // trail: a tapering streak along the flight path behind the shot (sampled from the path, so smooth at any frame rate)
      const len = (p.kind === 'arrow' ? 0.16 : 0.2) + 0.16 * p.w; const N = 10;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      let prevPt = at(k - len);
      for (let i = 1; i <= N; i++) {
        const f = i / N; const pt = at(k - len * (1 - f));
        ctx.strokeStyle = rgba(col, (p.kind === 'arrow' ? 0.45 : 0.6) * f * (0.6 + 0.6 * p.w));
        ctx.lineWidth = (p.kind === 'arrow' ? 1.4 + 2.6 * p.w : 3 + 7 * p.w + (p.kind === 'comet' ? 5 : 0)) * u * (0.25 + 0.75 * f);
        ctx.beginPath(); ctx.moveTo(prevPt[0], prevPt[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
        prevPt = pt;
      }
      ctx.restore();
      if (p.kind === 'arrow') {
        const ahead = at(k + 0.02); const ang = Math.atan2(ahead[1] - y, ahead[0] - x || 0.001);
        const sz = 1 + 0.35 * p.w;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sz, sz);
        if (p.w > 0.5) { ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 12 * u; }
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-26 * u, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = p.w > 0.5 ? '#ffe9a8' : '#d8dde3'; ctx.beginPath(); ctx.moveTo(0, -3 * u); ctx.lineTo(9 * u, 0); ctx.lineTo(0, 3 * u); ctx.fill();
        ctx.fillStyle = '#c84a3a'; ctx.fillRect(-28 * u, -3 * u, 6 * u, 6 * u); ctx.restore();
        if (p.w > 0.5 && Math.random() < 0.6) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 20 * u, vy: (Math.random() - 0.5) * 20 * u, life: 0.3, t0: t, size: 1.8 * u, color: '#ffd27a', g: 0, glow: true });
      } else {
        glowBall(ctx, x, y, ((p.kind === 'comet' ? 9 : 5) + 5 * p.w) * u, col);
        for (let i = 0; i < 2 + Math.round(p.w * 3); i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 30 * u, vy: (Math.random() - 0.5) * 30 * u, life: 0.35, t0: t, size: (2 + 1.5 * p.w) * u, color: col, g: 0, glow: true });
      }
    }
    // impact cores: a white-hot flash at the contact point
    for (const c of [...this.cores]) {
      const k = (t - c.t0) / c.life; if (k >= 1) { this.cores.splice(this.cores.indexOf(c), 1); continue; }
      const r = c.r * (0.45 + 0.75 * ease.out(Math.min(1, k * 2.2)));
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`); g.addColorStop(0.35, rgba(c.color, 0.75 * (1 - k))); g.addColorStop(1, rgba(c.color, 0));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // crit starbursts
    for (const b of [...this.rays]) {
      const k = (t - b.t0) / b.life; if (k >= 1) { this.rays.splice(this.rays.indexOf(b), 1); continue; }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        const len = b.r * (0.4 + 0.6 * ease.out(k)) * (i % 2 ? 0.6 : 1);
        ctx.fillStyle = rgba(i % 2 ? b.color : '#ffffff', 0.85 * (1 - k));
        ctx.beginPath(); ctx.moveTo(0, -2.5 * u); ctx.lineTo(len, 0); ctx.lineTo(0, 2.5 * u); ctx.fill();
      }
      ctx.restore();
    }
    // rings
    for (const r of [...this.rings]) {
      const k = (t - r.t0) / r.life; if (k >= 1) { this.rings.splice(this.rings.indexOf(r), 1); continue; }
      ctx.save(); ctx.strokeStyle = rgba(r.color, 1 - k); ctx.lineWidth = r.width * (1 - k * 0.5);
      ctx.beginPath(); if (r.flat) ctx.ellipse(r.x, r.y, lerp(r.r0, r.r1, ease.out(k)), lerp(r.r0, r.r1, ease.out(k)) * 0.22, 0, 0, Math.PI * 2); else ctx.arc(r.x, r.y, lerp(r.r0, r.r1, ease.out(k)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    // slashes
    for (const b of [...this.beams]) {
      const k = (t - b.t0) / b.life; if (k >= 1) { this.beams.splice(this.beams.indexOf(b), 1); continue; }
      const sz = b.size || 1;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-0.6); if (b.dir < 0) ctx.scale(-1, 1);
      ctx.strokeStyle = rgba('#ffffff', 1 - k); ctx.lineWidth = (b.crit ? 6 : 4) * u * sz * (1 - k); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 34 * u * sz, -1.1 + k * 0.6, 0.6 + k * 0.6); ctx.stroke(); ctx.restore();
    }
    // level-up pillar
    if (this.pillar) {
      const p = this.pillar; const k = (t - p.t0) / p.life;
      if (k >= 1) this.pillar = null;
      else {
        const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        const w = 70 * u * (0.6 + 0.4 * Math.sin(k * Math.PI));
        const g = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
        g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.5, `rgba(255,236,170,${0.55 * a})`); g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - w, 0, w * 2, p.feet);
        for (let i = 0; i < 3; i++) { const rk = (k * 2 + i / 3) % 1; ctx.strokeStyle = `rgba(255,224,140,${(1 - rk) * a})`; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.ellipse(p.x, p.feet - rk * 160 * u, 60 * u * (1 - rk * 0.4), 14 * u * (1 - rk * 0.4), 0, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
    // particles
    ctx.save();
    for (const q of [...this.particles]) {
      const k = (t - q.t0) / q.life; if (k >= 1) { this.particles.splice(this.particles.indexOf(q), 1); continue; }
      q.vy += (q.g || 0) * u * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const a = 1 - k;
      if (q.glow) { ctx.globalCompositeOperation = 'lighter'; }
      ctx.fillStyle = rgba(q.color, a);
      if (q.plus) { ctx.fillRect(q.x - q.size * 1.5, q.y - q.size * 0.4, q.size * 3, q.size * 0.8); ctx.fillRect(q.x - q.size * 0.4, q.y - q.size * 1.5, q.size * 0.8, q.size * 3); }
      else if (q.streak) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = q.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    // floating text: damage numbers slam in (crits larger, slower, shaking), then rise a little and fade
    for (const f of [...this.texts]) {
      const age = t - f.t0; const k = age / f.life; if (k >= 1) { this.texts.splice(this.texts.indexOf(f), 1); continue; }
      let sc = 1;
      if (f.slam) {
        const s0 = f.crit ? 2.1 : 1.5 + 0.35 * f.weight; const sd = f.crit ? 0.17 : 0.11; const rest = f.crit ? 1.1 : 1;
        sc = age < sd ? lerp(s0, rest * 0.92, ease.out(age / sd)) : age < sd + 0.08 ? lerp(rest * 0.92, rest, (age - sd) / 0.08) : rest;
      } else if (!f.small && age < 0.1) sc = 0.75 + 2.5 * age;
      const y = f.y - f.rise * ease.out(clamp(age / (f.crit ? 1.25 : 0.9), 0, 1));
      const jx = f.crit && f.slam && age < 0.32 ? Math.sin(age * 95) * 3.2 * u * (1 - age / 0.32) : 0;
      const a = k < 0.72 ? 1 : 1 - (k - 0.72) / 0.28;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x + jx, y); ctx.scale(sc, sc);
      ctx.font = `${f.small ? 700 : 800} ${f.size}px ${FCT_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, f.size * (f.crit ? 0.2 : 0.16)); ctx.strokeStyle = f.outline; ctx.lineJoin = 'round';
      if (f.crit) { ctx.shadowColor = f.color; ctx.shadowBlur = 16 * u; }
      ctx.strokeText(f.text, 0, 0); ctx.shadowBlur = 0; ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
      ctx.restore();
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
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + p.p * 7);
      ctx.globalCompositeOperation = 'lighter';
      if (k === 'wind') { ctx.strokeStyle = `rgba(255,255,255,${0.12 * p.s})`; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 60 * u * p.s, p.y + 2 * u); ctx.stroke(); continue; }
      const col = { pollen: '#fff4d0', motes: '#d8f0d0', dust: '#ffe0b0', wisps: '#8ff0d0', embers: '#ffab4a', stars: '#cfe4ff' }[k] || '#ffffff';
      const r = (k === 'wisps' ? 4 : k === 'embers' ? 1.8 : 1.5) * u * p.s;
      const a = (k === 'wisps' ? 0.35 + 0.45 * tw : k === 'stars' ? 0.3 + 0.6 * tw : 0.35 + 0.3 * tw) * (front ? 1 : 0.7);
      if (k === 'wisps' || k === 'embers') { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
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

export const FCT_FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, "Liberation Sans", sans-serif';

// ------------------------------------------------------------------ set pieces
function campfire(ctx, x, y, u, t) {
  for (const [dx, r] of [[-26, 0.25], [26, -0.25]]) { ctx.save(); ctx.translate(x + dx * u, y - 4 * u); ctx.rotate(r); ctx.fillStyle = '#4a3020'; ctx.fillRect(-22 * u, -5 * u, 44 * u, 10 * u); ctx.restore(); }
  const g = ctx.createRadialGradient(x, y - 30 * u, 4, x, y - 30 * u, 180 * u);
  g.addColorStop(0, `rgba(255,170,80,${0.35 + 0.05 * Math.sin(t * 9)})`); g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 30 * u, 180 * u, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i++) {
    const fl = 1 + Math.sin(t * (8 + i) + i) * 0.15;
    ctx.fillStyle = ['#ff6a1a', '#ffa83a', '#ffe08a'][i];
    ctx.beginPath(); ctx.moveTo(x - (16 - i * 5) * u, y - 6 * u);
    ctx.quadraticCurveTo(x - (10 - i * 3) * u, y - (30 - i * 4) * u * fl, x + Math.sin(t * 6 + i) * 3 * u, y - (52 - i * 12) * u * fl);
    ctx.quadraticCurveTo(x + (10 - i * 3) * u, y - (30 - i * 4) * u * fl, x + (16 - i * 5) * u, y - 6 * u); ctx.fill();
  }
}
function tent(ctx, x, y, u, th) {
  // Weathered canvas, toned toward the zone's own near colour so it sits in any light.
  const cloth = mix('#b09a72', th.near || '#3a3020', 0.38);
  const dark = shade(cloth, -0.34); const lit = shade(cloth, -0.06);
  ctx.strokeStyle = shade(cloth, -0.55); ctx.lineWidth = 1.2 * u;
  ctx.beginPath(); ctx.moveTo(x - 4 * u, y - 92 * u); ctx.lineTo(x - 96 * u, y + 2 * u); ctx.moveTo(x + 4 * u, y - 92 * u); ctx.lineTo(x + 96 * u, y + 2 * u); ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(x - 70 * u, y); ctx.lineTo(x, y - 90 * u); ctx.lineTo(x + 70 * u, y); ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath(); ctx.moveTo(x, y - 90 * u); ctx.lineTo(x + 70 * u, y); ctx.lineTo(x + 10 * u, y); ctx.fill();
  ctx.strokeStyle = shade(cloth, -0.45); ctx.lineWidth = 1.4 * u;
  for (const f of [0.35, 0.7]) { ctx.beginPath(); ctx.moveTo(x - 70 * u * f, y - 90 * u * (1 - f)); ctx.lineTo(x + 70 * u * f, y - 90 * u * (1 - f)); ctx.stroke(); }
  ctx.fillStyle = '#140e0a'; ctx.beginPath(); ctx.moveTo(x - 14 * u, y); ctx.lineTo(x, y - 50 * u); ctx.lineTo(x + 12 * u, y); ctx.fill();
  ctx.fillStyle = shade(cloth, -0.2); ctx.beginPath(); ctx.moveTo(x, y - 50 * u); ctx.lineTo(x + 12 * u, y); ctx.lineTo(x + 22 * u, y); ctx.fill();
  ctx.fillStyle = '#3a2614'; ctx.fillRect(x - 1.6 * u, y - 100 * u, 3.2 * u, 12 * u);
}
function cart(ctx, x, y, u, th) {
  ctx.fillStyle = '#6a4528'; ctx.fillRect(x - 70 * u, y - 52 * u, 140 * u, 30 * u);
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(x - 70 * u, y - 56 * u, 140 * u, 6 * u);
  for (const wx of [-42, 42]) { ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(x + wx * u, y - 16 * u, 16 * u, 0, Math.PI * 2); ctx.stroke(); }
  const stripes = ['#c8402e', '#f0e0c0'];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = stripes[i % 2]; ctx.beginPath(); ctx.moveTo(x - 80 * u + i * 20 * u, y - 112 * u); ctx.lineTo(x - 60 * u + i * 20 * u, y - 112 * u); ctx.lineTo(x - 60 * u + i * 20 * u, y - 98 * u); ctx.quadraticCurveTo(x - 70 * u + i * 20 * u, y - 92 * u, x - 80 * u + i * 20 * u, y - 98 * u); ctx.fill(); }
  ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 76 * u, y - 112 * u, 4 * u, 60 * u); ctx.fillRect(x + 72 * u, y - 112 * u, 4 * u, 60 * u);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#c84a3a', '#3a6ad8', '#4ab060', '#e0b040', '#9a5ad0'][i]; ctx.beginPath(); ctx.arc(x - 48 * u + i * 24 * u, y - 62 * u, 6 * u, 0, Math.PI * 2); ctx.fill(); }
}
function shrineStone(ctx, x, y, u, t, col) {
  const g = ctx.createRadialGradient(x, y - 70 * u, 4, x, y - 70 * u, 120 * u);
  g.addColorStop(0, rgba(col, 0.35 + 0.1 * Math.sin(t * 2))); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 70 * u, 120 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a5a62';
  ctx.beginPath(); ctx.moveTo(x - 24 * u, y); ctx.lineTo(x - 20 * u, y - 110 * u); ctx.lineTo(x, y - 128 * u); ctx.lineTo(x + 20 * u, y - 112 * u); ctx.lineTo(x + 26 * u, y); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(x, y - 128 * u); ctx.lineTo(x + 20 * u, y - 112 * u); ctx.lineTo(x + 26 * u, y); ctx.lineTo(x + 6 * u, y); ctx.fill();
  ctx.strokeStyle = rgba(col, 0.75 + 0.25 * Math.sin(t * 3)); ctx.lineWidth = 2.5 * u; ctx.shadowColor = col; ctx.shadowBlur = 12 * u;
  ctx.beginPath(); ctx.moveTo(x - 6 * u, y - 96 * u); ctx.lineTo(x + 6 * u, y - 80 * u); ctx.lineTo(x - 6 * u, y - 64 * u); ctx.lineTo(x + 6 * u, y - 48 * u); ctx.stroke(); ctx.shadowBlur = 0;
}
function chest(ctx, x, y, u, t, open) {
  if (open) { const g = ctx.createRadialGradient(x, y - 40 * u, 4, x, y - 40 * u, 110 * u); g.addColorStop(0, 'rgba(255,220,120,0.55)'); g.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 40 * u, 110 * u, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#6a3e1e'; ctx.fillRect(x - 40 * u, y - 40 * u, 80 * u, 40 * u);
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 40 * u, y - 40 * u, 80 * u, 5 * u); ctx.fillRect(x - 6 * u, y - 30 * u, 12 * u, 14 * u);
  ctx.fillStyle = '#7a4a24';
  if (open) { ctx.beginPath(); ctx.moveTo(x - 40 * u, y - 40 * u); ctx.lineTo(x - 44 * u, y - 84 * u); ctx.lineTo(x + 36 * u, y - 84 * u); ctx.lineTo(x + 40 * u, y - 40 * u); ctx.fill(); ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.ellipse(x, y - 40 * u, 34 * u, 6 * u, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(x - 40 * u, y - 40 * u); ctx.quadraticCurveTo(x, y - 70 * u, x + 40 * u, y - 40 * u); ctx.fill(); ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(x - 40 * u, y - 40 * u); ctx.quadraticCurveTo(x, y - 70 * u, x + 40 * u, y - 40 * u); ctx.stroke(); }
}
function gate(ctx, x, y, u, t, th) {
  ctx.fillStyle = shade(th.near, -0.2);
  ctx.beginPath(); ctx.moveTo(x - 130 * u, y); ctx.lineTo(x - 110 * u, y - 170 * u); ctx.lineTo(x - 30 * u, y - 210 * u); ctx.lineTo(x + 60 * u, y - 200 * u); ctx.lineTo(x + 140 * u, y - 150 * u); ctx.lineTo(x + 150 * u, y); ctx.fill();
  ctx.fillStyle = '#0c0a0a'; ctx.beginPath(); ctx.moveTo(x - 50 * u, y); ctx.lineTo(x - 50 * u, y - 90 * u); ctx.quadraticCurveTo(x, y - 150 * u, x + 50 * u, y - 90 * u); ctx.lineTo(x + 50 * u, y); ctx.fill();
  ctx.strokeStyle = shade(th.near, 0.25); ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(x - 50 * u, y); ctx.lineTo(x - 50 * u, y - 90 * u); ctx.quadraticCurveTo(x, y - 150 * u, x + 50 * u, y - 90 * u); ctx.lineTo(x + 50 * u, y); ctx.stroke();
  for (const tx of [-70, 70]) { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + tx * u - 3 * u, y - 100 * u, 6 * u, 26 * u); campfireMini(ctx, x + tx * u, y - 100 * u, u, t); }
}
function campfireMini(ctx, x, y, u, t) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, 50 * u); g.addColorStop(0, 'rgba(255,170,80,0.5)'); g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 50 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.moveTo(x - 5 * u, y); ctx.quadraticCurveTo(x, y - (16 + Math.sin(t * 10) * 3) * u, x + 5 * u, y); ctx.fill();
}
function signpost(ctx, x, y, u, th) {
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 3 * u, y - 90 * u, 6 * u, 90 * u);
  ctx.fillStyle = '#8a6038'; ctx.beginPath(); ctx.moveTo(x - 4 * u, y - 84 * u); ctx.lineTo(x + 46 * u, y - 84 * u); ctx.lineTo(x + 56 * u, y - 74 * u); ctx.lineTo(x + 46 * u, y - 64 * u); ctx.lineTo(x - 4 * u, y - 64 * u); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 4 * u, y - 58 * u); ctx.lineTo(x - 46 * u, y - 58 * u); ctx.lineTo(x - 56 * u, y - 48 * u); ctx.lineTo(x - 46 * u, y - 38 * u); ctx.lineTo(x + 4 * u, y - 38 * u); ctx.fill();
}
function banner(ctx, x, y, u, t, col) {
  ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 2.5 * u, y - 150 * u, 5 * u, 150 * u);
  const wave = Math.sin(t * 2) * 6 * u;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 2 * u, y - 146 * u); ctx.quadraticCurveTo(x + 30 * u, y - 140 * u + wave, x + 52 * u, y - 146 * u); ctx.lineTo(x + 52 * u, y - 96 * u); ctx.lineTo(x + 27 * u, y - 108 * u + wave); ctx.lineTo(x + 2 * u, y - 96 * u); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 6 * u, y - 140 * u, 42 * u, 4 * u);
}
