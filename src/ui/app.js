// App orchestrator: owns the bridge, scene, HUD, screens and windows; turns input into actions and
// plays each step through the director. Presentation only.
import { createBridge, flags } from './engine-bridge.js';
import { Scene } from './scene.js';
import { createHud } from './hud.js';
import { createScreens } from './screens.js';
import { createWindows } from './windows.js';
import { Director } from './director.js';
import { initTooltip, hide as hideTip } from './tooltip.js';
import { settings } from './settings.js';
import { h, clear } from './util.js';
import { enemyLook } from './art-actors.js';

export class App {
  constructor() {
    this.bridge = createBridge();
    this.data = this.bridge.data;
    this.scene = new Scene(document.getElementById('world'));
    this.root = document.getElementById('hud');
    this.shown = this.bridge.view;
    this.queue = Promise.resolve();
    this.pending = 0;
    this.renderQueued = false;
    this.autoTimer = null;
    const app = this;
    const ui = {
      target: null, overlay: false, dragging: false, fleeArmed: false, chestOpen: false,
      get playing() { return app.director.playing; },
      setTarget: (idx) => { ui.target = idx; app.scene.target = idx == null ? null : `enemy:${idx}`; app.queueRender(); },
      retarget: (v) => app.retarget(v),
      toast: (t, k) => app.toast(t, k), banner: (a, b, k, ms) => app.banner(a, b, k, ms),
      toggleWin: (n) => app.windows.toggle(n), closeWin: (n) => app.windows.close(n), openWin: (n) => app.windows.open(n),
      attack: () => app.combatAct((t) => ({ type: 'ATTACK', target: t })),
      castSlot: (i) => { const id = app.shown.player && app.shown.player.bar[i]; if (id) { app.hud.flashSlot(i); app.combatAct((t) => ({ type: 'CAST', spellId: id, target: t })); } },
      useItemSlot: (i) => { const v = app.shown; if (!v.player || !v.player.itemBar[i]) return; app.hud.flashSlot(7 + i); if (v.combat && !v.combat.over) app.combatAct((t) => ({ type: 'USE_ITEM', slot: i, target: t })); else { const it = v.player.bag.find((s) => s && s.id === v.player.itemBar[i]); if (it) app.act({ type: 'USE_ITEM', uid: it.uid }); } },
      toggleAuto: () => app.act({ type: 'SET_AUTOPLAY', on: !app.bridge.view.autoplay }),
      pass: () => app.combatAct(() => ({ type: 'PASS' })),
      flee: () => {
        if (!app.shown.legal || !app.shown.legal.flee) return;
        if (!ui.fleeArmed) { ui.fleeArmed = true; app.queueRender(); app.toast('Press Flee again to run', 'info'); clearTimeout(app.fleeT); app.fleeT = setTimeout(() => { ui.fleeArmed = false; app.queueRender(); }, 2200); return; }
        ui.fleeArmed = false; app.combatAct(() => ({ type: 'FLEE' }));
      },
      showDeath: (on) => app.showDeath(on),
    };
    this.ui = ui;
    this.ctx = {
      bridge: this.bridge, data: this.data, scene: this.scene, ui, settings,
      get view() { return app.shown; },
      act: (a) => app.act(a),
      setShown: (v) => { app.shown = v; app.queueRender(); },
      syncScene: (v, o) => app.syncScene(v, o),
      get hud() { return app.hud; },
    };
    initTooltip(document.body);
    this.hud = createHud(this.root, this.ctx);
    this.screens = createScreens(this.root, this.ctx);
    this.windows = createWindows(this.root, this.ctx);
    this.director = new Director(this.ctx);
    this.bannerEl = h('div#banner', h('div.b0'), h('div.b1'), h('div.b2'));
    this.toasts = h('div#toasts');
    this.skipHint = h('div#skiphint', 'Space or click to skip');
    this.deathEl = h('div.hidden', h('div.overlay-dark'), h('div.deathmsg', h('div.d1', 'You have died'), h('div.d2', 'No resurrection remains. Your journey ends here.')));
    this.root.append(this.bannerEl, this.toasts, this.skipHint, this.deathEl);
    this.bindInput();
    window.addEventListener('resize', () => { this.scene.resize(); this.applyScale(); this.syncScene(this.shown, { instant: true }); this.queueRender(); });
    this.applyScale();
    this.syncScene(this.shown, { instant: true });
    this.render();
    const loop = (now) => { this.scene.frame(now); this.hud.placeNameplates(); this.skipHint.classList.toggle('on', this.director.playing && (performance.now() - (this.playStart || 0)) > 700 && !settings.instant); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    globalThis.__ui = this.testApi();
    const boot = document.getElementById('boot'); if (boot) { boot.classList.add('gone'); setTimeout(() => boot.remove(), 700); }
  }

  applyScale() {
    const s = Math.max(0.72, Math.min(1.8, Math.min(window.innerWidth / 1366, window.innerHeight / 768)));
    document.documentElement.style.fontSize = `${(10 * s).toFixed(2)}px`;
  }

  // ------------------------------------------------------------------ actions
  act(action) {
    this.pending++;
    if (this.director.playing) this.director.skip();
    const run = async () => {
      try {
        const prev = this.bridge.view;
        const res = this.bridge.dispatch(action);
        if (!res.ok) { if (res.error) { this.toast(res.error, 'err'); console.info(`[ui] action ${action.type} refused: ${res.error}`); } return res; }
        if (action.type === 'START_RUN' || action.type === 'END_RUN') this.ui.target = null;
        this.playStart = performance.now();
        await this.director.play(prev, res.view, res.events, action);
        this.afterPlay();
        return res;
      } catch (err) { console.error(err); this.shown = this.bridge.view; this.queueRender(); return { ok: false, error: String(err) }; } finally { this.pending--; }
    };
    const p = this.queue.then(run, run);
    this.queue = p;
    return p;
  }

  combatAct(make) {
    const v = this.bridge.view;
    if (!v.combat || v.combat.over) return;
    const t = this.validTarget(v);
    this.act(make(t));
  }
  validTarget(v) {
    const c = v.combat; if (!c) return 0;
    const cur = c.enemies.find((e) => e.idx === this.ui.target && e.alive && !e.hidden);
    if (cur) return cur.idx;
    const t = c.enemies.find((e) => e.idx === c.target && e.alive) || c.enemies.find((e) => e.alive && !e.hidden);
    return t ? t.idx : 0;
  }
  retarget(v) {
    const c = v.combat;
    if (!c || c.over) return;
    const cur = c.enemies.find((e) => e.idx === this.ui.target && e.alive && !e.hidden);
    if (!cur) this.ui.setTarget(this.validTarget(v));
  }

  afterPlay() {
    const v = this.bridge.view;
    this.ui.chestOpen = v.node && v.node.type === 'treasure' && v.node.step === 'opened' ? true : v.node && v.node.type === 'treasure' ? this.ui.chestOpen : false;
    if (v.combat && !v.combat.over) this.retarget(v); else if (!v.combat) this.ui.setTarget(null);
    this.windows.update();
    this.scheduleAuto();
  }

  scheduleAuto() {
    clearTimeout(this.autoTimer);
    const v = this.bridge.view;
    if (!v.autoplay || !v.combat || v.combat.over || this.pending > 0) return;
    const delay = settings.instant ? 30 : settings.get('autoDelay') / Math.max(1, settings.get('speed') || 1);
    this.autoTimer = setTimeout(() => {
      const vv = this.bridge.view;
      if (!vv.autoplay || !vv.combat || vv.combat.over || this.pending > 0) return;
      this.act(this.bridge.autoAction());
    }, delay);
  }

  // ------------------------------------------------------------------ rendering
  queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => { this.renderQueued = false; this.render(); });
  }
  render() {
    const v = this.shown;
    if (!this.ui.overlay) this.syncScene(v);
    this.hud.update(v);
    this.screens.update(v);
    if (!this.director.playing) this.windows.update();
    document.body.dataset.phase = v.phase;
  }

  syncScene(v, opts = {}) {
    const s = this.scene;
    if (!v) return;
    if (v.phase === 'CREATE') {
      s.setTheme('dusk', false, true);
      s.setHero(v.create.classId, v.create.classId === 'hunter' ? v.create.petId : null);
      s.clearEnemies();
      if (s.mode !== 'create' || opts.instant) s.setMode('create', { props: [{ kind: 'campfire', at: 0.635 }, { kind: 'tent', at: 0.77 }, { kind: 'banner', at: 0.37, color: this.data.classes[v.create.classId].color }], instant: opts.instant });
      else { const b = s.props.find((p) => p.kind === 'banner'); if (b) b.color = this.data.classes[v.create.classId].color; }
      return;
    }
    if (!v.player) return;
    s.setHero(v.player.classId, v.player.petId);
    if (v.player.pet && !v.player.pet.alive) { const a = s.actors.get('pet'); if (a && !a.deadT0) a.dead = 1; } else { const a = s.actors.get('pet'); if (a && v.player.pet && v.player.pet.alive) { a.dead = 0; a.deadT0 = 0; } }
    const theme = v.phase === 'CAMP' || v.phase === 'BOSS' ? 'observatory' : (v.zone && v.zone.theme) || 'farmland';
    s.setTheme(theme, v.phase === 'ZONE_HUB' || v.phase === 'CAMP', opts.instant);
    const c = v.combat;
    const W = s.W;
    const arrive = (props) => props.map((p) => (opts.arrive ? { ...p, x: W * (p.at || 0.6) + W * 0.75, tx: W * (p.at || 0.6) } : { ...p, x: W * (p.at || 0.6) }));
    if (c && (!c.over || v.loot || c.over === 'victory' || c.over === 'defeat')) {
      s.setEnemies(c.enemies, theme, { enterFromRight: opts.enter || opts.arrive });
      s.setMode(c.isBoss ? 'boss' : 'combat', { props: [] });
      if (this.ui.target == null && !c.over) this.ui.setTarget(this.validTarget(v));
      this.applyStatusFx(v);
      return;
    }
    s.clearEnemies();
    this.applyStatusFx(v);
    if (v.phase === 'ZONE_HUB') { s.setMode('hub', { props: arrive([{ kind: 'banner', at: 0.4 }, { kind: 'campfire', at: 0.5 }]) }); return; }
    if (v.phase === 'CAMP') { s.setMode('camp', { props: arrive([{ kind: 'banner', at: 0.34, color: '#6a7ad8' }, { kind: 'campfire', at: 0.42 }, { kind: 'tent', at: 0.53 }]) }); return; }
    if (v.phase === 'MAP') { if (!opts.keepMode) s.setMode('map', { props: [] }); return; }
    if (v.phase === 'SUMMARY') { s.setMode('summary', { props: [] }); return; }
    if (v.phase === 'NODE' && v.node) {
      const n = v.node; const props = [];
      const th = theme;
      if (n.type === 'quest') props.push({ kind: 'sign', at: 0.41 }, { kind: 'npc', at: 0.52, look: npcLook(th, 'giver'), mark: n.step === 'reward' || n.step === 'story' ? '?' : '!' });
      if (n.type === 'rest') props.push({ kind: 'tent', at: 0.55 }, { kind: 'campfire', at: 0.44 });
      if (n.type === 'vendor') props.push({ kind: 'cart', at: 0.52 }, { kind: 'npc', at: 0.42, look: npcLook(th, 'merchant') });
      if (n.type === 'trainer') props.push({ kind: 'banner', at: 0.42 }, { kind: 'npc', at: 0.5, look: npcLook(th, 'trainer') });
      if (n.type === 'shrine') props.push({ kind: 'stone', at: 0.49 });
      if (n.type === 'treasure') props.push({ kind: 'chest', at: 0.49, open: this.ui.chestOpen || n.step === 'opened' });
      if (n.type === 'dungeon') props.push({ kind: 'gate', at: 0.52 });
      if (n.type === 'elite' || n.type === 'grind' || n.type === 'camp_grind') props.push({ kind: th === 'highlands' ? 'pine' : 'oak', at: 0.5 });
      s.setMode('node', { props: arrive(props) });
    }
  }

  applyStatusFx(v) {
    const s = this.scene; const p = v.player;
    const has = (u, id) => u && (u.statuses || []).some((x) => x.id === id);
    const hero = s.actors.get('player');
    if (hero) { hero.fxWard = has(p, 'WARD'); }
    s.stealth = has(p, 'STEALTH');
    if (v.combat) for (const e of v.combat.enemies) {
      const a = s.actors.get(`enemy:${e.idx}`); if (!a) continue;
      a.fxStun = has(e, 'STUN'); a.fxFrozen = has(e, 'FROZEN'); a.fxHex = has(e, 'HEXED'); a.fxBurn = has(e, 'BURN'); a.fxWard = has(e, 'WARD');
    }
  }

  // ------------------------------------------------------------------ banners & toasts
  banner(title, sub, kind = '', ms = 2000) {
    const b = this.bannerEl;
    b.className = 'on ' + kind;
    b.querySelector('.b0').textContent = kind === 'level' ? 'Level up' : kind === 'zone' ? 'Entering' : kind === 'boss' ? 'The end of the road' : '';
    b.querySelector('.b1').textContent = title;
    b.querySelector('.b2').textContent = sub || '';
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = kind; }, settings.instant ? Math.min(ms, 1200) : ms / Math.max(1, Math.min(2, settings.get('speed'))));
  }
  toast(text, kind = '') {
    const t = h('div.toast' + (kind ? '.' + kind : ''), text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2700);
  }
  showDeath(on) { this.deathEl.classList.toggle('hidden', !on); }

  // ------------------------------------------------------------------ input
  bindInput() {
    const cv = this.scene.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (this.director.playing) { this.director.skip(); return; }
      const idx = this.scene.pick(e.clientX, e.clientY);
      if (idx != null) this.ui.setTarget(idx);
    });
    cv.addEventListener('pointermove', (e) => { const idx = this.scene.pick(e.clientX, e.clientY); this.scene.hover = idx == null ? null : `enemy:${idx}`; cv.style.cursor = idx == null ? '' : 'pointer'; });
    this.root.addEventListener('pointerdown', (e) => { if (this.director.playing && !e.target.closest('button, .win, input')) this.director.skip(); }, true);
    window.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  onKey(e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const v = this.shown; const code = e.code;
    const inFight = v.combat && !v.combat.over;
    if (code === 'Space') {
      e.preventDefault();
      if (this.director.playing) { this.director.skip(); return; }
      if (v.loot && v.loot.kind === 'loot') { this.act({ type: 'LOOT_TAKE_ALL' }); return; }
      const prim = this.root.querySelector('#screens .dialog .btn.primary, #screens .side .btn.primary');
      if (prim && !prim.disabled) prim.click();
      return;
    }
    if (code === 'Escape') { if (this.windows.anyOpen()) this.windows.closeAll(); else this.windows.toggle('settings'); hideTip(); return; }
    if (v.phase === 'CREATE') { if (code === 'Enter') this.act({ type: 'START_RUN' }); return; }
    if (/^Digit[1-7]$/.test(code)) { this.ui.castSlot(Number(code[5]) - 1); return; }
    if (code === 'Digit8') { this.ui.useItemSlot(0); return; }
    if (code === 'Digit9') { this.ui.useItemSlot(1); return; }
    if (code === 'Digit0') { this.ui.useItemSlot(2); return; }
    if (code === 'Tab') {
      e.preventDefault();
      if (!inFight) return;
      const alive = v.combat.enemies.filter((x) => x.alive && !x.hidden);
      if (!alive.length) return;
      const i = alive.findIndex((x) => x.idx === this.ui.target);
      this.ui.setTarget(alive[(i + (e.shiftKey ? alive.length - 1 : 1)) % alive.length].idx);
      return;
    }
    const map = { KeyA: () => this.ui.attack(), KeyZ: () => this.ui.toggleAuto(), KeyX: () => this.ui.pass(), KeyF: () => this.ui.flee(),
      KeyC: () => this.windows.toggle('character'), KeyB: () => this.windows.toggle('bags'), KeyP: () => this.windows.toggle('spellbook'),
      KeyN: () => this.windows.toggle('talents'), KeyL: () => this.windows.toggle('questlog'), KeyM: () => this.windows.toggle('map') };
    if (map[code]) { e.preventDefault(); map[code](); }
  }

  // ------------------------------------------------------------------ test hooks (headless checks)
  testApi() {
    const app = this;
    return {
      mode: this.bridge.mode,
      view: () => app.bridge.view,
      shown: () => app.shown,
      act: (a) => app.act(a),
      idle: async () => { for (let i = 0; i < 400 && (app.pending > 0 || app.director.playing); i++) await new Promise((r) => setTimeout(r, 25)); await app.queue; },
      skip: () => app.director.skip(),
      settings,
      openWin: (n) => app.windows.open(n), closeWins: () => app.windows.closeAll(),
      canDebug: app.bridge.canDebug,
    };
  }
}

function npcLook(theme, kind) {
  const base = enemyLook(kind === 'merchant' ? 'mender' : kind === 'trainer' ? 'caster' : 'mender', theme, 'normal');
  if (kind === 'giver') return { ...base, cloth: '#6a5232', cloth2: '#8a6a42', trim: '#e0b860', hood: null, robe: false, weapon: 'none', handGlow: null, build: 1, crouch: 0, float: false, eyes: '#2a1d14', pants: '#4a3a24', boots: '#2a1c10' };
  if (kind === 'merchant') return { ...base, cloth: '#7a3a2a', cloth2: '#a8583a', trim: '#e8c060', hood: null, robe: true, weapon: 'none', orb: null, build: 1.08, float: false, eyes: '#2a1d14' };
  return { ...base, cloth: '#2a2a5a', cloth2: '#4a4a8a', trim: '#e8c060', robe: true, weapon: 'staff', orb: '#ffd36a', handGlow: null, float: false, hood: 'cowl' };
}
export { flags };
