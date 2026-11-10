// App orchestrator: owns the bridge, scene, HUD, screens and windows; turns input into actions and
// plays each step through the director. Presentation only.
// Input during a combat round (owner feedback 2026-11-10): an action key or button queues one next action, shown on the
// action bar, and pressing the same one again changes nothing, so mashing cannot run rounds together; Space or a click
// skips to the end of the hit on screen. Outside rounds any input finishes the step at once.
// Combat v2 (docs/specs/combat-v2.md 10.3): in the engage round the engage panel's options act on the current target (keys
// Q, W, E; the Mage's Pre-cast: Q, then a spell key), and hovering an option previews it on the tracks (R.engagePreview).
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
    this.plays = []; // test hook: timing of the last played steps (testApi().plays)
    this.ownActions = []; // test hook: actions the UI sent on its own, not from input (a new potion put on the item bar)
    this.renderQueued = false;
    this.autoTimer = null;
    const app = this;
    const ui = {
      target: null, overlay: false, dragging: false, fleeArmed: false, chestOpen: false,
      get playing() { return app.director.playing; },
      setTarget: (idx) => { ui.target = idx; app.scene.target = idx == null ? null : `enemy:${idx}`; app.queueRender(); },
      retarget: (v) => app.retarget(v),
      toast: (t, k) => app.toast(t, k), banner: (a, b, k, ms) => app.banner(a, b, k, ms), hideBanner: () => app.hideBanner(),
      toggleWin: (n) => app.windows.toggle(n), closeWin: (n) => app.windows.close(n), openWin: (n) => app.windows.open(n),
      attack: () => app.combatAct((t) => ({ type: 'ATTACK', target: t }), 'attack', 'Attack'),
      castSlot: (i) => {
        const id = app.shown.player && app.shown.player.bar[i]; if (!id) return;
        if (ui.precastArmed && app.bridge.view.combat && app.bridge.view.combat.engage) { app.hud.flashSlot(i); app.engageAct('precast', id); return; }
        app.combatAct((t) => ({ type: 'CAST', spellId: id, target: t }), `spell${i}`, (app.data.spells[id] || {}).name || id, () => app.hud.flashSlot(i));
      },
      useItemSlot: (i) => { const v = app.shown; if (!v.player || !v.player.itemBar[i]) return; if (v.combat && !v.combat.over) app.combatAct((t) => ({ type: 'USE_ITEM', slot: i, target: t }), `item${i}`, (app.data.consumables[v.player.itemBar[i]] || {}).name || 'Item', () => app.hud.flashSlot(7 + i)); else { app.hud.flashSlot(7 + i); const it = v.player.bag.find((s) => s && s.id === v.player.itemBar[i]); if (it) app.act({ type: 'USE_ITEM', uid: it.uid }); } },
      // read the state when the action runs, so two quick presses (Z Z) turn it on and off again
      toggleAuto: () => app.act(() => ({ type: 'SET_AUTOPLAY', on: !app.bridge.view.autoplay })),
      pass: () => app.combatAct(() => ({ type: 'PASS' }), 'pass', 'Pass'),
      flee: () => {
        if (!app.bridge.view.legal || !app.bridge.view.legal.flee) return;
        if (!ui.fleeArmed) { ui.fleeArmed = true; app.queueRender(); app.toast('Press Flee again to run', 'info'); clearTimeout(app.fleeT); app.fleeT = setTimeout(() => { ui.fleeArmed = false; app.queueRender(); }, 2200); return; }
        ui.fleeArmed = false; app.combatAct(() => ({ type: 'FLEE' }), 'flee', 'Flee');
      },
      /** The queued next action ({ key, label }) or null. */
      get queued() { return app.next ? { key: app.next.key, label: app.next.label } : null; },
      // combat v2 engage round (docs/specs/combat-v2.md 10.3): the hovered option's preview on the tracks
      // ({ option, spellId, target, valid, ctl, data: R.engagePreview }), an engage option, Pre-cast armed (Mage, key Q)
      preview: null, precastArmed: false,
      setPreview: (p) => { ui.preview = p; app.queueRender(); },
      engage: (id, spellId) => app.engageAct(id, spellId),
      armPrecast: () => { ui.precastArmed = !ui.precastArmed; app.queueRender(); },
      showDeath: (on, text) => app.showDeath(on, text),
      // Hall of Echoes (meta progression between runs): over class select; from the summary it opens after END_RUN
      openMeta: () => { hideTip(); app.windows.closeAll(); app.screens.meta.open(); app.queueRender(); },
      closeMeta: () => { app.screens.meta.close(); hideTip(); app.queueRender(); },
      get metaOpen() { return !!(app.screens && app.screens.meta.isOpen()); },
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
    this.next = null; // the one queued next action during a combat round: { make, key, label }
    this.deathEl = h('div.hidden', h('div.overlay-dark'), h('div.deathmsg', h('div.d1', 'You have died'), h('div.d2', 'No resurrection remains. Your journey ends here.')));
    this.root.append(this.bannerEl, this.toasts, this.skipHint, this.deathEl);
    this.bindInput();
    window.addEventListener('resize', () => { this.scene.resize(); this.applyScale(); this.syncScene(this.shown, { instant: true }); this.queueRender(); });
    this.applyScale();
    this.syncScene(this.shown, { instant: true });
    this.render();
    const loop = (now) => {
      this.scene.frame(now); this.hud.placeNameplates();
      const hint = this.director.playing && (performance.now() - (this.playStart || 0)) > 700 && !settings.instant;
      this.skipHint.classList.toggle('on', hint);
      if (hint) { const txt = this.director.inRound ? 'Space or click: skip this hit' : 'Space or click to skip'; if (this.skipHint.textContent !== txt) this.skipHint.textContent = txt; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    globalThis.__ui = this.testApi();
    const boot = document.getElementById('boot'); if (boot) { boot.classList.add('gone'); setTimeout(() => boot.remove(), 700); }
  }

  applyScale() {
    const s = Math.max(0.72, Math.min(1.8, Math.min(window.innerWidth / 1366, window.innerHeight / 768)));
    document.documentElement.style.fontSize = `${(10 * s).toFixed(2)}px`;
  }

  // ------------------------------------------------------------------ actions
  /**
   * Queue an action (or a function that returns one when its turn comes) and play its events. Input while a step other
   * than a combat round plays finishes that step's animations at once; a combat round plays on (combat actions wait in
   * the one-slot queue of combatAct, other actions after the round).
   */
  act(actionOrFn) {
    const tIn = performance.now();
    this.pending++;
    if (!this.director.inRound) this.skipPlay();
    const run = async () => {
      try {
        const action = typeof actionOrFn === 'function' ? actionOrFn() : actionOrFn;
        if (!action) return { ok: false, error: null };
        const prev = this.bridge.view;
        const t0 = performance.now(); // the round's time budget starts before the engine step
        const res = this.bridge.dispatch(action);
        if (!res.ok) { if (res.error) { this.toast(res.error, 'err'); console.info(`[ui] action ${action.type} refused: ${res.error}`); } return res; }
        if (action.type === 'START_RUN' || action.type === 'END_RUN') this.ui.target = null;
        this.playStart = performance.now();
        const rec = { type: action.type === 'ENGINE' ? action.action.type : action.type, input: tIn, t0, events: res.events.map((e) => e.t), round: null, end: null, skippedAt: null, hitSkips: [], queued: null };
        this.plays.push(rec); if (this.plays.length > 200) this.plays.shift();
        const playing = this.director.play(prev, res.view, res.events, action, { t0 });
        rec.round = this.director.round ? { budget: this.director.round.budget, avg: this.director.round.avg, plan: this.director.round.plan, tempo: this.director.round.tempo, speed: this.director.round.speed } : null;
        await playing;
        rec.end = performance.now();
        this.hud.heat.noteStep(prev, res.view); // heat (expedition.md H.4): a toast when the step changed the meter's state
        this.afterPlay();
        this.placeNewItems(prev, res.view);
        return res;
      } catch (err) { console.error(err); this.shown = this.bridge.view; this.queueRender(); return { ok: false, error: String(err) }; } finally {
        this.pending--;
        // The queued next action plays when nothing else is queued or playing; else autoplay's next round is planned.
        if (this.pending === 0 && !this.flushNext()) this.scheduleAuto();
      }
    };
    const p = this.queue.then(run, run);
    this.queue = p;
    return p;
  }

  /** Test hook: the step that was playing when an input skipped it. */
  notePlaySkip(t) { const r = this.plays[this.plays.length - 1]; if (r && r.end == null && r.skippedAt == null) r.skippedAt = t; }
  /** Space or a click: in a combat round skip to the end of the hit on screen; any other step finishes at once. */
  skipPlay() {
    if (!this.director.playing) return;
    const now = performance.now();
    if (this.director.inRound) {
      const beat = this.director.skipHit();
      const r = this.plays[this.plays.length - 1];
      if (beat != null && r && r.end == null) r.hitSkips.push({ at: now, beat, event: this.director.cursor ? this.director.cursor.t : null });
      return;
    }
    this.director.skip(); this.notePlaySkip(now);
  }
  /** Is a step queued or playing (a combat action now waits in the one-slot queue)? */
  busy() { return this.pending > 0 || this.director.playing; }

  /**
   * A combat action. While a step resolves it becomes the one queued next action, shown on the action bar: the same key
   * again changes nothing, another action replaces it. onTake runs when the input is taken (the slot's press flash).
   */
  combatAct(make, key = null, label = '', onTake = null) {
    const v = this.bridge.view;
    if (!v.combat || v.combat.over) return;
    if (this.busy() && key) {
      if (this.next && this.next.key === key) return; // a repeated press while the round resolves: ignored
      this.next = { make, key, label };
      const r = this.plays[this.plays.length - 1]; if (r && r.end == null) r.queued = key;
      if (onTake) onTake();
      this.hud.setQueued(key, label); this.queueRender();
      return;
    }
    if (onTake) onTake();
    const t = this.validTarget(v);
    this.act(make(t));
  }
  /** Play the queued next action once nothing else is queued or playing; true when one was sent. */
  flushNext() {
    const n = this.next; if (!n) return false;
    this.next = null; this.hud.setQueued(null);
    const v = this.bridge.view;
    if (!v.combat || v.combat.over || v.phase === 'SUMMARY') return false; // the fight ended: the queued action lapses
    this.act(n.make(this.validTarget(v)));
    return true;
  }
  /**
   * An engage option (combat v2, rules 7.10) from the engage panel or keys Q, W, E: sent as ENGAGE on the current target
   * when the option may target it (R.engageOptions targets); options without a target take none; Pre-cast needs the spell.
   * A target the option cannot take, or an option the engine greys out, is refused with its reason (no action is sent).
   */
  engageAct(id, spellId = null) {
    const v = this.bridge.view; const eg = v.combat && !v.combat.over ? v.combat.engage : null;
    if (!eg) return;
    const o = eg.options.find((x) => x.id === id); if (!o) return;
    if (o.reason) { this.toast(`${o.name}: ${o.reason}`, 'err'); return; }
    let targets = o.targets;
    if (o.spells) {
      const sp = o.spells.find((x) => x.spellId === spellId);
      if (!sp) { if (spellId) this.toast(`${o.name}: ${(this.data.spells[spellId] || {}).name || spellId} cannot be cast now`, 'err'); else { this.ui.armPrecast(); } return; }
      targets = sp.targets;
    }
    const none = targets.length === 1 && targets[0] === null;
    const cur = this.validTarget(v);
    if (!none && !targets.includes(cur)) {
      const names = targets.map((i) => (v.combat.enemies.find((e) => e.idx === i) || {}).name).filter(Boolean);
      this.toast(`${o.name}: not on ${(v.combat.enemies.find((e) => e.idx === cur) || {}).name || 'that target'}. Choose ${names.join(' or ')}.`, 'err');
      return;
    }
    this.ui.precastArmed = false; this.ui.preview = null;
    const label = spellId ? `${o.name}: ${(this.data.spells[spellId] || {}).name || spellId}` : o.name;
    this.combatAct(() => ({ type: 'ENGAGE', option: id, spellId: spellId || undefined, target: none ? null : cur }), `engage-${id}`, label);
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
    // the engage round is over: no preview, Pre-cast no longer armed
    if (!(v.combat && v.combat.engage)) { this.ui.precastArmed = false; this.ui.preview = null; document.body.classList.remove('eg-bar-hint'); }
    this.ui.chestOpen = v.node && v.node.type === 'treasure' && v.node.step === 'opened' ? true : v.node && v.node.type === 'treasure' ? this.ui.chestOpen : false;
    if (v.combat && !v.combat.over) this.retarget(v); else if (!v.combat) this.ui.setTarget(null);
    this.windows.update();
  }

  /**
   * A combat consumable that has just come into the bags (bought, looted) goes to a free item-bar slot,
   * as the engine puts a newly learned spell on a free spell slot. The UI sends SET_ITEM_BAR for it.
   * Items already in the bags are left alone, so a slot the player cleared stays clear.
   */
  placeNewItems(prev, next) {
    const p = next.player;
    if (!p || !['ZONE_HUB', 'MAP', 'NODE', 'CAMP'].includes(next.phase) || !next.legal || !next.legal.outOfCombat) return;
    const had = new Set(((prev && prev.player && prev.player.bag) || []).filter((it) => it && it.kind === 'consumable').map((it) => it.id));
    const fresh = [];
    for (const it of p.bag) {
      if (!it || it.kind !== 'consumable' || had.has(it.id) || fresh.includes(it.id) || p.itemBar.includes(it.id)) continue;
      const c = this.data.consumables[it.id];
      if (!c || !(c.use === 'combat' || c.use === 'both') || (c.mana && p.res.kind !== 'mana')) continue;
      fresh.push(it.id);
    }
    const free = p.itemBar.map((id, i) => (id ? -1 : i)).filter((i) => i >= 0);
    fresh.slice(0, free.length).forEach((id, k) => {
      const slot = free[k]; const key = ['8', '9', '0'][slot]; const nm = this.data.consumables[id].name;
      const a = { type: 'SET_ITEM_BAR', slot, itemId: id };
      this.ownActions.push(a); // test hook: actions the UI sends on its own (qa/browser/full-run.mjs mirrors them in its twin)
      this.act(a).then((r) => {
        if (r && r.ok) { this.toast(`${nm} is on item slot ${key}`, 'good'); this.hud.log(`${nm} goes on item slot ${key} (key ${key}).`, 'lg-sys'); }
      });
    });
  }

  /** While autoplay is on in a fight, play the engine's autoplay choice after the autoplay pause. */
  scheduleAuto() {
    clearTimeout(this.autoTimer);
    const v = this.bridge.view;
    if (!v.autoplay || !v.combat || v.combat.over || this.pending > 0) return;
    const delay = settings.instant ? 30 : settings.get('autoDelay') / Math.max(1, settings.get('speed') || 1);
    this.autoTimer = setTimeout(() => {
      const vv = this.bridge.view;
      if (!vv.autoplay || !vv.combat || vv.combat.over || this.pending > 0) return;
      this.act(() => this.bridge.autoAction()).then((res) => {
        // never retry a refused choice in a loop: switch autoplay off and say why
        if (res && !res.ok && this.bridge.view.autoplay) { this.toast('Autoplay stopped', 'err'); this.act({ type: 'SET_AUTOPLAY', on: false }); }
      });
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
    s.setTheme(theme, v.phase === 'ZONE_HUB', opts.instant);
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
    if (v.phase === 'SUMMARY') { if (s.mode !== 'summary') s.clearFx(); s.setMode('summary', { props: [] }); return; }
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
      a.fxSap = has(e, 'SAPPED');
      a.fxOffBal = !!(e.offBalance && e.alive && !v.combat.over); // combat v2: the off-balance marker under the enemy
      // telegraph: a heavy blow or a cast in the intent shows as a held wind-up until the enemy acts
      const it = e.intent;
      const tele = e.alive && !v.combat.over && it && !it.interrupted && !it.support && (it.heavy || it.cast) && it.id !== 'none' && it.id !== 'unaware';
      a.tele = tele ? { kind: it.heavy && !it.cast ? 'heavy' : 'cast', color: it.heavy && !it.cast ? HEAVY_COL : TELE_COL[it.school] || '#b48aff' } : null;
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
  hideBanner() { clearTimeout(this.bannerT); this.bannerEl.classList.remove('on'); }
  toast(text, kind = '') {
    const t = h('div.toast' + (kind ? '.' + kind : ''), text);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2700);
  }
  showDeath(on, text) {
    if (on) this.deathEl.querySelector('.d2').textContent = text || 'No resurrection remains. Your journey ends here.';
    this.deathEl.classList.toggle('hidden', !on);
  }

  // ------------------------------------------------------------------ input
  bindInput() {
    const cv = this.scene.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (this.director.playing) { this.skipPlay(); return; }
      const idx = this.scene.pick(e.clientX, e.clientY);
      if (idx != null) this.ui.setTarget(idx);
    });
    cv.addEventListener('pointermove', (e) => { const idx = this.scene.pick(e.clientX, e.clientY); this.scene.hover = idx == null ? null : `enemy:${idx}`; cv.style.cursor = idx == null ? '' : 'pointer'; });
    this.root.addEventListener('pointerdown', (e) => { if (this.director.playing && !e.target.closest('button, .win, input')) this.skipPlay(); }, true);
    window.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  onKey(e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const v = this.shown; const code = e.code;
    const inFight = v.combat && !v.combat.over;
    if (code === 'Space') {
      e.preventDefault();
      if (this.director.playing) { this.skipPlay(); return; }
      if (v.loot && v.loot.kind === 'loot') { this.act({ type: 'LOOT_TAKE_ALL' }); return; }
      const prim = this.root.querySelector('#screens .dialog .btn.primary, #screens .side .btn.primary');
      if (prim && !prim.disabled) prim.click();
      return;
    }
    if (code === 'Escape') {
      if (this.ui.precastArmed) { this.ui.precastArmed = false; this.queueRender(); return; }
      if (this.windows.anyOpen()) this.windows.closeAll();
      else if (this.ui.metaOpen) this.ui.closeMeta();
      else this.windows.toggle('settings');
      hideTip(); return;
    }
    if (v.phase === 'CREATE') { if (code === 'Enter' && !this.ui.metaOpen) this.act({ type: 'START_RUN' }); return; }
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
    // engage options in the engage round (combat v2): Q strike, W control, E setup (Pre-cast: Q arms it, then a spell key)
    const eg = this.bridge.view.combat && !this.bridge.view.combat.over ? this.bridge.view.combat.engage : null;
    if (eg && /^Key[QWE]$/.test(code)) {
      e.preventDefault();
      const o = eg.options[{ KeyQ: 0, KeyW: 1, KeyE: 2 }[code]];
      if (o) { if (o.spells && !o.reason) this.ui.armPrecast(); else this.ui.engage(o.id); }
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
      /** Timing of the last played steps: { type, input, t0, end, skippedAt, events, round: { budget, plan, tempo, speed } }. */
      plays: () => app.plays.map((p) => ({ ...p })),
      /** The action the engine's autoplay policy would choose now (not sent). */
      autoChoice: () => app.bridge.autoAction(),
      /** The event the director is playing now ({ t, side }), or null. */
      playingEvent: () => { const e = app.director.playing && app.director.cursor; return e ? { t: e.t, side: e.src ? e.src.side : null, dst: e.dst ? e.dst.side : null, beat: app.director.beatNo, inRound: app.director.inRound } : null; },
      skip: () => app.director.skip(),
      /** The queued next action during a combat round ({ key, label }) or null. */
      queued: () => (app.next ? { key: app.next.key, label: app.next.label } : null),
      settings,
      openWin: (n) => app.windows.open(n), closeWins: () => app.windows.closeAll(),
      /** Whether the Hall of Echoes is open (it shows over class select). */
      metaOpen: () => app.ui.metaOpen,
      /** The engine actions applied to this run, in order (engine mode; a Node twin replays them). */
      engineLog: () => app.bridge.engineLog(),
      /** Actions the UI sent on its own since the page loaded (copies), e.g. a new potion put on the item bar. */
      ownActions: () => app.ownActions.map((a) => ({ ...a })),
      /** The engage hover preview now shown on the tracks (combat v2), or null. */
      preview: () => (app.ui.preview ? { option: app.ui.preview.option, target: app.ui.preview.target, data: app.ui.preview.data } : null),
      /** The current target (enemy index) or null. */
      target: () => app.ui.target,
      canDebug: app.bridge.canDebug,
    };
  }
}

// telegraph colours: a heavy blow in orange (the target ring is red), a cast in its school's colour
const HEAVY_COL = '#ff9a1f';
const TELE_COL = { fire: '#ff8a3a', frost: '#8fd6ff', arcane: '#c79bff', shadow: '#a07aff', nature: '#8fe07a', magic: '#b48aff', phys: '#ffb08a' };

function npcLook(theme, kind) {
  const base = enemyLook(kind === 'merchant' ? 'mender' : kind === 'trainer' ? 'caster' : 'mender', theme, 'normal');
  if (kind === 'giver') return { ...base, cloth: '#6a5232', cloth2: '#8a6a42', trim: '#e0b860', hood: null, robe: false, weapon: 'none', handGlow: null, build: 1, crouch: 0, float: false, eyes: '#2a1d14', pants: '#4a3a24', boots: '#2a1c10' };
  if (kind === 'merchant') return { ...base, cloth: '#7a3a2a', cloth2: '#a8583a', trim: '#e8c060', hood: null, robe: true, weapon: 'none', orb: null, build: 1.08, float: false, eyes: '#2a1d14' };
  return { ...base, cloth: '#2a2a5a', cloth2: '#4a4a8a', trim: '#e8c060', robe: true, weapon: 'staff', orb: '#ffd36a', handGlow: null, float: false, hood: 'cowl' };
}
export { flags };
