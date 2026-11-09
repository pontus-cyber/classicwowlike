// The world canvas: painted parallax backdrop, the hero in the centre, enemies, set pieces and
// combat effects. Pure presentation: it is told what happened and animates it.
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

  act(id, kind, dur) {
    const a = this.actors.get(id); if (!a) return;
    a.act = { kind, t0: this.time, dur: Math.max(0.05, dur / 1000) };
  }
  hitFlash(id) { const a = this.actors.get(id); if (a) a.flashT = this.time; }
  kill(id) { const a = this.actors.get(id); if (a) { a.deadT0 = this.time; a.alive = false; } }
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
    return { x: a.x + (a.lunge || 0), feet: gy, top, cy, w, alive: a.alive !== false && !a.deadT0, visible: a.visible !== false };
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
  float(id, text, style = {}) {
    const an = this.anchor(id); if (!an) return;
    const jitter = (Math.random() - 0.5) * 40 * this.u;
    this.texts.push({ x: an.x + jitter + (style.dx || 0), y: an.top - 6 * this.u + (style.dy || 0), text, color: style.color || '#ffffff', size: (style.size || 22) * this.u,
      t0: this.time, life: (style.life || 1.3), crit: !!style.crit, vy: style.vy || -46 * this.u, outline: style.outline || 'rgba(0,0,0,0.85)', small: style.small });
  }
  floatAt(x, y, text, style = {}) {
    this.texts.push({ x, y, text, color: style.color || '#fff', size: (style.size || 22) * this.u, t0: this.time, life: style.life || 1.4, crit: !!style.crit, vy: style.vy || -40 * this.u, outline: 'rgba(0,0,0,0.85)' });
  }

  burst(x, y, color, n = 14, spread = 160, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const sp = (0.3 + Math.random()) * spread * this.u;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0) * this.u, life: 0.35 + Math.random() * 0.4, t0: this.time,
        size: (opts.size || 3) * this.u * (0.5 + Math.random()), color, g: opts.g ?? 260, glow: opts.glow ?? true });
    }
  }
  impact(id, school = 'phys', crit = false) {
    const an = this.anchor(id); if (!an) return;
    const col = SCHOOL_COL[school] || '#fff';
    this.burst(an.x, an.cy, col, crit ? 26 : 14, crit ? 240 : 150);
    this.rings.push({ x: an.x, y: an.cy, t0: this.time, life: 0.35, r0: 6 * this.u, r1: (crit ? 70 : 44) * this.u, color: col, width: (crit ? 4 : 2.5) * this.u });
    if (school === 'phys') this.beams.push({ kind: 'slash', x: an.x, y: an.cy, t0: this.time, life: 0.22, color: '#ffffff', crit });
    this.hitFlash(id);
    if (crit && settings.get('shake')) this.shake(7);
  }
  shake(amt) { if (settings.get('shake')) this.shakeAmt = Math.max(this.shakeAmt, amt * this.u); }
  screenFlash(color, alpha = 0.35, life = 0.35) { this.flash = { color, alpha, t0: this.time, life }; }
  heal(id) {
    const an = this.anchor(id); if (!an) return;
    for (let i = 0; i < 16; i++) this.particles.push({ x: an.x + (Math.random() - 0.5) * an.w * 1.4, y: an.feet - Math.random() * 40 * this.u, vx: 0, vy: -(40 + Math.random() * 70) * this.u, life: 0.9 + Math.random() * 0.5, t0: this.time, size: 2.5 * this.u, color: '#9dffb8', g: 0, glow: true, plus: true });
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

  /** Fire a projectile between two actors; resolves at impact. */
  projectile(fromId, toId, kind = 'arcane', dur = 380) {
    const fa = this.anchor(fromId); const ta = this.anchor(toId);
    if (!fa || !ta) return Promise.resolve();
    const d = settings.dur(dur);
    if (!d) return Promise.resolve();
    return new Promise((resolve) => {
      const from = { x: fa.x + (fromId === 'player' ? 34 : -34) * this.u, y: fa.cy - 18 * this.u };
      this.projectiles.push({ from, toId, to: { x: ta.x, y: ta.cy }, t0: this.time, dur: d / 1000, kind, resolve, arc: kind === 'arrow' ? 26 * this.u : kind === 'comet' ? -120 * this.u : 0 });
    });
  }
  finishAll() { // skip: land projectiles at once
    for (const p of this.projectiles) p.resolve();
    this.projectiles = [];
    for (const a of this.actors.values()) { a.act = null; if (a.deadT0) a.dead = 1; }
  }
  /** Drop floating text, rings, beams and sparks left from a fight (e.g. behind the run summary). */
  clearFx() { this.finishAll(); this.texts = []; this.rings = []; this.beams = []; this.particles = []; this.pillar = null; }

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
    const t = this.time;
    let act = null;
    if (a.act) { const p = (t - a.act.t0) / a.act.dur; if (p >= 1) a.act = null; else act = { kind: a.act.kind, p }; }
    let lunge = 0;
    if (act && act.kind === 'melee' && (a.kind === 'humanoid') && a.id === 'player') lunge = Math.sin(clamp(act.p, 0, 1) * Math.PI) * (a.lungeDist || 120) * this.u;
    if (act && act.kind === 'melee' && a.id.startsWith('enemy') && a.kind !== 'boss') lunge = -Math.sin(clamp(act.p, 0, 1) * Math.PI) * 60 * this.u;
    a.lunge = lunge;
    const flash = a.flashT ? clamp(1 - (t - a.flashT) / 0.18, 0, 1) : 0;
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
    const anim = { t: t + (a.born || 0) * 0.37 + (a.id.length * 0.9), walk: moving ? 1 : 0, phase: a.phase, act, flash, dead, flip: a.flip, bossPhase: this.bossPhase };
    if (a.kind === 'humanoid') drawHumanoid(ctx, x, gy, a.scale, a.look, anim);
    else if (a.kind === 'beast' || a.kind === 'hawk') drawBeast(ctx, x, gy, a.scale, a.look, anim);
    else if (a.kind === 'boss') drawBoss(ctx, x, gy, a.scale, anim);
    else if (a.kind === 'shard') drawShard(ctx, x, gy, a.scale, anim);
    ctx.restore();
    // ward bubble / status visuals
    if (a.fxWard) { const an = this.anchor(a.id); ctx.save(); ctx.strokeStyle = 'rgba(160,200,255,0.75)'; ctx.lineWidth = 2 * this.u; ctx.fillStyle = 'rgba(140,180,255,0.10)'; ctx.beginPath(); ctx.ellipse(an.x, an.cy - 8 * this.u, an.w * 1.1, (an.feet - an.top) * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (a.fxStun && a.alive !== false) { const an = this.anchor(a.id); for (let i = 0; i < 3; i++) { const ang = t * 4 + i * 2.1; ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(an.x + Math.cos(ang) * 16 * this.u, an.top - 4 * this.u + Math.sin(ang) * 4 * this.u, 3 * this.u, 0, Math.PI * 2); ctx.fill(); } }
    if (a.fxBurn && a.alive !== false) { const an = this.anchor(a.id); if (Math.random() < 0.4) this.particles.push({ x: an.x + (Math.random() - 0.5) * an.w, y: an.cy, vx: 0, vy: -60 * this.u, life: 0.5, t0: t, size: 2.5 * this.u, color: '#ff9a4a', g: 0, glow: true }); }
    if (a.fxFrozen && a.alive !== false) { const an = this.anchor(a.id); ctx.fillStyle = 'rgba(170,220,255,0.28)'; ctx.fillRect(an.x - an.w * 0.7, an.top, an.w * 1.4, an.feet - an.top); }
    if (a.fxHex && a.alive !== false) { const an = this.anchor(a.id); ctx.save(); ctx.strokeStyle = 'rgba(200,150,255,0.8)'; ctx.lineWidth = 2 * this.u; ctx.beginPath(); ctx.ellipse(an.x, an.feet, an.w, 10 * this.u, 0, t * 2, t * 2 + 4.5); ctx.stroke(); ctx.restore(); }
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
    // projectiles
    for (const p of [...this.projectiles]) {
      const k = (t - p.t0) / p.dur;
      const ta = this.anchor(p.toId); if (ta) { p.to.x = ta.x; p.to.y = ta.cy; }
      if (k >= 1) { this.projectiles.splice(this.projectiles.indexOf(p), 1); p.resolve(); continue; }
      const e = p.kind === 'arrow' ? k : ease.in(k * 0.6 + 0.4 * k);
      const x = lerp(p.from.x, p.to.x, e); const y = lerp(p.from.y, p.to.y, e) - Math.sin(e * Math.PI) * p.arc;
      const col = { fire: '#ff8a3a', frost: '#9fdcff', arcane: '#c79bff', shadow: '#9a6aff', nature: '#9be07a', comet: '#ffb05a', phys: '#ffffff' }[p.kind] || '#ffffff';
      if (p.kind === 'arrow') {
        const ang = Math.atan2(lerp(p.from.y, p.to.y, e + 0.02) - Math.sin((e + 0.02) * Math.PI) * p.arc - y, (p.to.x - p.from.x) * 0.02 || 1);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-26 * u, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = '#d8dde3'; ctx.beginPath(); ctx.moveTo(0, -3 * u); ctx.lineTo(8 * u, 0); ctx.lineTo(0, 3 * u); ctx.fill();
        ctx.fillStyle = '#c84a3a'; ctx.fillRect(-28 * u, -3 * u, 6 * u, 6 * u); ctx.restore();
      } else {
        glowBall(ctx, x, y, (p.kind === 'comet' ? 9 : 6) * u, col);
        for (let i = 0; i < 2; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 30 * u, vy: (Math.random() - 0.5) * 30 * u, life: 0.35, t0: t, size: 2.5 * u, color: col, g: 0, glow: true });
      }
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
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-0.6);
      ctx.strokeStyle = rgba('#ffffff', 1 - k); ctx.lineWidth = (b.crit ? 6 : 4) * u * (1 - k); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 34 * u, -1.1 + k * 0.6, 0.6 + k * 0.6); ctx.stroke(); ctx.restore();
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
      else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    // floating text
    for (const f of [...this.texts]) {
      const k = (t - f.t0) / f.life; if (k >= 1) { this.texts.splice(this.texts.indexOf(f), 1); continue; }
      const pop = f.crit ? (k < 0.12 ? 0.6 + ease.back(k / 0.12) * 0.75 : 1.35 - Math.min(0.2, (k - 0.12))) : (k < 0.1 ? 0.7 + 3 * k : 1);
      const y = f.y + f.vy * Math.min(k * f.life, 1.0) * (f.crit ? 0.6 : 1);
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x, y); ctx.scale(pop, pop);
      ctx.font = `${f.small ? 700 : 800} ${f.size}px ${FCT_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, f.size * 0.16); ctx.strokeStyle = f.outline; ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
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
