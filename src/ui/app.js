// App orchestrator: owns the bridge, scene, HUD, screens and windows; turns input into actions and
// plays each step through the director. Presentation only.
// Input during a combat round (owner feedback 2026-11-10): an action key or button queues one next action, shown on the
// action bar, and pressing the same one again changes nothing, so mashing cannot run rounds together; Space or a click
// skips to the end of the hit on screen. Outside rounds any input finishes the step at once.
// Combat v2 (docs/specs/combat-v2.md 10.3): in the engage round the engage panel's options act on the current target (keys
// Q, W, E; the Mage's Pre-cast: Q, then a spell key), and hovering an option previews it on the tracks (R.engagePreview).
// Combat v2.1 (combat-v2.md 10.9): the wind-up hovered on a track, the ruler or a nameplate (the bar marks what answers it),
// and a wind-up's own telegraph. Toasts: the same message merges ("×2") and at most two show at once (a queue holds the
// rest), placed where no panel is: under the ruler in a fight, left of the zone map on the map.
// Dev tools (owner feedback 2026-11-11; engine-api.md 12): the Dev menu (dev-menu.js) opens with the backquote key or its
// corner button; each of its ops runs through devAct (the bridge's dev, R.debug) and the result is shown at once, as a
// loaded state (no animation). ?dev=0 or the settings hide it.
// Start camp (docs/specs/expedition.md 2, 9.1; prep.js): phase PREP shows the prep screen over the camp scene, its keys go
// to prepKey (1-8, A-I, R, Enter). Since D116 new runs start on the expedition map with the start camp; the Dev menu's
// setting "Classic map (old)" sets the map new runs get (the bridge's setRunMode; at class select at once). Esc also puts
// the map's armed Spyglass away.
// Sound (audio.js, docs/specs/audio.md; D127): each step is one audio step (the decision view's Deathblow telegraph and
// Furnace cues after it); a click on a button or card, an error toast and a window opening or closing have their cues.
import { createBridge, flags } from './engine-bridge.js';
import { Scene } from './scene.js';
import { createHud } from './hud.js';
import { createScreens, disarmSpyglass } from './screens.js';
import { prepKey } from './prep.js';
import { createWindows } from './windows.js';
import { Director } from './director.js';
import { initTooltip, hide as hideTip } from './tooltip.js';
import { createDevMenu } from './dev-menu.js';
import { createOnboarding } from './onboarding.js';
import { createAudio, CLICKABLE } from './audio.js';
import { settings } from './settings.js';
import { h, clear } from './util.js';
import { enemyLook } from './art-actors.js';
// telegraph colours (tokens.css --fx-tele-*): a heavy blow in orange (the target ring is red), a cast in its school's colour
// (an unknown school: magic's), a wind-up in ember red
import { TELE, TELE_CAST } from './theme.js';
import { HEAT_WORDS, tolls } from './ui-text.js';

export class App {
  constructor() {
    // the map new runs get (D116): the expedition map with the start camp; the Dev menu's "Classic map (old)" or ?classic=1:
    // the classic map; ?expedition=1: the expedition without the start camp (a test switch)
    this.bridge = createBridge(settings.get('classicMap') ? { classic: true } : {});
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
    this.audio = createAudio(settings); // no sound before the first gesture (audio.js)
    const app = this;
    const ui = {
      target: null, overlay: false, dragging: false, fleeArmed: false, chestOpen: false,
      get playing() { return app.director.playing; },
      setTarget: (idx) => { ui.target = idx; app.scene.target = idx == null ? null : `enemy:${idx}`; app.queueRender(); },
      retarget: (v) => app.retarget(v),
      toast: (t, k) => app.toast(t, k), banner: (a, b, k, ms) => app.banner(a, b, k, ms), hideBanner: () => app.hideBanner(),
      toggleWin: (n) => app.windows.toggle(n), closeWin: (n) => app.windows.close(n), openWin: (n) => app.windows.open(n),
      attack: () => { if (app.refused(app.bridge.view.legal && app.bridge.view.legal.attack ? null : { type: 'ATTACK', target: app.validTarget(app.bridge.view) })) return; ui.fleeArmed = false; app.combatAct((t) => ({ type: 'ATTACK', target: t }), 'attack', 'Attack'); },
      castSlot: (i) => {
        const id = app.shown.player && app.shown.player.bar[i]; if (!id) return;
        if (ui.precastArmed && app.bridge.view.combat && app.bridge.view.combat.engage) { app.hud.flashSlot(i); app.engageAct('precast', id); return; }
        // blind panel 2026-11-13: a key the engine refuses (energy, mana, a combo point, a cooldown) says why at once, also
        // while a round plays (it used to be queued and refused only when the round ended)
        if (app.refused(app.spellRefusal(id))) return;
        ui.fleeArmed = false;
        app.combatAct((t) => ({ type: 'CAST', spellId: id, target: t }), `spell${i}`, (app.data.spells[id] || {}).name || id, () => app.hud.flashSlot(i));
      },
      useItemSlot: (i) => {
        const v = app.shown; if (!v.player || !v.player.itemBar[i]) return;
        if (v.combat && !v.combat.over) {
          const L = app.bridge.view.legal && app.bridge.view.legal.items ? app.bridge.view.legal.items[i] : null;
          if (app.refused(L && !L.ok && app.inFight() ? L.reason || 'Not usable now' : null)) return;
          ui.fleeArmed = false;
          app.combatAct((t) => ({ type: 'USE_ITEM', slot: i, target: t }), `item${i}`, (app.data.consumables[v.player.itemBar[i]] || {}).name || 'Item', () => app.hud.flashSlot(7 + i));
        } else { app.hud.flashSlot(7 + i); const it = v.player.bag.find((s) => s && s.id === v.player.itemBar[i]); if (it) app.act({ type: 'USE_ITEM', uid: it.uid }); }
      },
      // read the state when the action runs, so two quick presses (Z Z) turn it on and off again
      toggleAuto: () => app.act(() => ({ type: 'SET_AUTOPLAY', on: !app.bridge.view.autoplay })),
      pass: () => { ui.fleeArmed = false; app.combatAct(() => ({ type: 'PASS' }), 'pass', 'Pass'); },
      // Flee asks first (key F or the button: the same path). Blind panel 2026-11-13: F seemed to do nothing (its "press again"
      // toast waited behind others, faded, and the arming lapsed after 2.2 s). Now the ask is a box over the button (hud.js
      // #fleeask) that stays until acted on: F or the button again flees, any other action or Esc puts it away. A refused
      // flee says why (the button is greyed then)
      flee: () => {
        if (!app.inFight()) return;
        if (!app.bridge.view.legal || !app.bridge.view.legal.flee) { app.refused({ type: 'FLEE' }); return; }
        if (!ui.fleeArmed) { ui.fleeArmed = true; app.queueRender(); return; }
        ui.fleeArmed = false; app.queueRender(); app.combatAct(() => ({ type: 'FLEE' }), 'flee', 'Flee');
      },
      cancelFlee: () => { if (!ui.fleeArmed) return false; ui.fleeArmed = false; app.queueRender(); return true; },
      /** The queued next action ({ key, label }) or null. */
      get queued() { return app.next ? { key: app.next.key, label: app.next.label } : null; },
      // combat v2 engage round (docs/specs/combat-v2.md 10.3): the hovered option's preview on the tracks
      // ({ option, spellId, target, valid, ctl, data: R.engagePreview }), an engage option, Pre-cast armed (Mage, key Q)
      preview: null, precastArmed: false,
      setPreview: (p) => { ui.preview = p; app.queueRender(); },
      // combat v2.1: the wind-up hovered on a track, the ruler or a nameplate ({ idx, turn }): the bar marks what answers it
      wuHover: null,
      setWindupHover: (w) => { if (JSON.stringify(ui.wuHover) === JSON.stringify(w)) return; ui.wuHover = w; app.queueRender(); },
      engage: (id, spellId) => app.engageAct(id, spellId),
      armPrecast: () => { ui.precastArmed = !ui.precastArmed; app.queueRender(); },
      showDeath: (on, text) => app.showDeath(on, text),
      // Hall of Echoes (meta progression between runs): over class select; from the summary it opens after END_RUN
      openMeta: () => { hideTip(); app.windows.closeAll(); app.screens.meta.open(); app.queueRender(); },
      closeMeta: () => { app.screens.meta.close(); hideTip(); app.queueRender(); },
      get metaOpen() { return !!(app.screens && app.screens.meta.isOpen()); },
      // a screen that changed only in presentation (the map's armed Spyglass) is built again
      refreshScreens: () => { app.screens.refresh(); hideTip(); app.queueRender(); },
    };
    this.ui = ui;
    this.ctx = {
      bridge: this.bridge, data: this.data, scene: this.scene, ui, settings, audio: this.audio,
      get view() { return app.shown; },
      act: (a) => app.act(a),
      // the Dev menu (dev-menu.js): one dev op through the bridge (engine-api.md 12), and its messages
      dev: (op, args) => app.devAct(op, args),
      toast: (t, k) => app.toast(t, k),
      setShown: (v) => { app.shown = v; app.queueRender(); },
      syncScene: (v, o) => app.syncScene(v, o),
      get hud() { return app.hud; },
      get coach() { return app.coach; },
    };
    initTooltip(document.body);
    this.hud = createHud(this.root, this.ctx);
    this.screens = createScreens(this.root, this.ctx);
    this.windows = createWindows(this.root, this.ctx);
    // M3 onboarding (m3-onboarding.md 2.4-4.3; onboarding.js): the coach line, the beats, the hints and the nudge
    this.coach = createOnboarding(this.root, this.ctx);
    // toasts step aside when a window opens, closes or re-renders (placeToasts)
    // ... and a window opening or closing has its sound (a re-render replaces one window: no change in the count)
    this.winCount = 0;
    new MutationObserver(() => { this.placeToasts(); const n = this.root.querySelectorAll('#windows > .win').length; if (n !== this.winCount) this.audio.cue(n > this.winCount ? 'winOpen' : 'winClose'); this.winCount = n; }).observe(this.root.querySelector('#windows'), { childList: true });
    this.devMenu = createDevMenu(this.root, this.ctx, { allowed: () => flags.dev && this.bridge.mode === 'engine' });
    this.director = new Director(this.ctx);
    this.bannerEl = h('div#banner', h('div.b0'), h('div.b1'), h('div.b2'));
    this.toasts = h('div#toasts', { 'aria-live': 'polite' });
    this.toastQueue = []; // toasts waiting for room (toast below)
    this.skipHint = h('div#skiphint', 'Space or click to skip');
    this.next = null; // the one queued next action during a combat round: { make, key, label }
    this.deathEl = h('div.hidden', h('div.overlay-dark'), h('div.deathmsg', h('div.d1', 'You have died'), h('div.d2', 'No resurrection remains. Your journey ends here.')));
    this.root.append(this.bannerEl, this.toasts, this.skipHint, this.deathEl);
    this.bindInput();
    // "Classic map (old)" (Dev menu, World): the map of new runs; at class select the run changes now (D116: off by default)
    settings.on('change', (k) => {
      if (k !== 'classicMap') return;
      const classic = !!settings.get('classicMap');
      const r = this.bridge.setRunMode(classic ? { mapMode: 'rows' } : { mapMode: 'expedition', prep: true });
      if (r.now) { this.shown = this.bridge.view; this.syncScene(this.shown, { instant: true }); this.queueRender(); }
      if (r.ok) this.toast(classic ? `Classic map (old)${r.now ? '' : ': from the next run'}` : `Expedition map with start camp${r.now ? '' : ': from the next run'}`, 'info');
    });
    window.addEventListener('resize', () => { this.scene.resize(); this.applyScale(); this.syncScene(this.shown, { instant: true }); this.queueRender(); requestAnimationFrame(() => this.coach.place()); });
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
        this.audio.beginStep(rec.type);
        const playing = this.director.play(prev, res.view, res.events, action, { t0 });
        rec.round = this.director.round ? { budget: this.director.round.budget, avg: this.director.round.avg, plan: this.director.round.plan, tempo: this.director.round.tempo, speed: this.director.round.speed } : null;
        await playing;
        this.audio.view(prev, res.view); this.audio.endStep(); // the decision view's cues (Deathblow telegraph, Furnace)
        rec.end = performance.now();
        this.hud.heat.noteStep(prev, res.view); // heat (expedition.md H.4): a toast when the step changed the meter's state
        this.afterPlay();
        this.coach.onStep(prev, res.view, res.events, action);
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
    this.ui.precastArmed = false; this.ui.preview = null; this.ui.fleeArmed = false;
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
  /** A fight is on in the engine's view (a round may still be playing on screen). */
  inFight() { const v = this.bridge.view; return !!(v.combat && !v.combat.over); }
  /** Why the engine would refuse this bar spell now, or null (bridge legal.spells: not castable on any target). */
  spellRefusal(id) {
    if (!this.inFight()) return null;
    const L = this.bridge.view.legal && this.bridge.view.legal.spells ? this.bridge.view.legal.spells[id] : null;
    return L && !L.ok ? L.reason || 'Not usable now' : null;
  }
  /**
   * Refuse a combat key at once (blind panel 2026-11-13, item 7): why (a reason, or an action whose reason the engine gives)
   * as a refusal toast, nothing queued or sent. False when there is nothing to refuse.
   */
  refused(why) {
    if (!why || !this.inFight()) return false;
    const text = typeof why === 'string' ? why : this.bridge.why(why) || 'Not now';
    this.toast(text, 'err'); console.info(`[ui] refused at once: ${text}`);
    return true;
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
    if (!(v.combat && !v.combat.over)) { this.ui.wuHover = null; this.ui.fleeArmed = false; } // the fight is over: no hover, no ask
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
    let delay = settings.instant ? 30 : settings.get('autoDelay') / Math.max(1, settings.get('speed') || 1);
    // M2b v13 (UI needs 8): in an engage round where autoplay answers a wind-up (rule E2), its hint stays readable a moment
    if (!settings.instant && v.combat.engage && v.combat.autoEngage) delay = Math.max(delay, AUTO_HINT_MS / Math.max(1, settings.get('speed') || 1));
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
    this.coach.update(this.bridge.view);
    this.devMenu.update(this.bridge.view);
    document.body.dataset.phase = v.phase;
    // a fight on screen (the toasts move below the opening ruler, clear of the target frame; in the end-boss fight under the
    // boss frame, between the target frame and the boss's nameplate; style.css)
    document.body.classList.toggle('in-fight', !!(v.combat && !v.combat.over && !v.loot));
    document.body.classList.toggle('boss-fight', !!(v.combat && !v.combat.over && !v.loot && v.combat.isBoss));
    // a banner shown as a fight comes on screen (an elite's name) steps aside once its panels are drawn
    if (this.bannerEl.classList.contains('on') && document.body.classList.contains('in-fight')) this.placeBanner();
  }

  syncScene(v, opts = {}) {
    const s = this.scene;
    if (!v) return;
    if (v.phase === 'CREATE' || v.phase === 'PREP') {
      // class select and the start camp (expedition.md 9.1): the hero by the fire at dusk
      s.setTheme('dusk', false, true);
      if (v.phase === 'PREP') {
        s.setHero(v.player.classId, v.player.petId); s.clearEnemies();
        if (s.mode !== 'create' || opts.instant) s.setMode('create', { props: [{ kind: 'campfire', at: 0.635 }, { kind: 'tent', at: 0.77 }, { kind: 'banner', at: 0.37, color: this.data.classes[v.player.classId].color }], instant: opts.instant });
        return;
      }
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
      // telegraph: a heavy blow or a cast in the intent shows as a held wind-up until the enemy acts; combat v2.1: a wind-up
      // (rules 7.12) of any kind gets its own, hotter telegraph
      const it = e.intent;
      const tele = e.alive && !v.combat.over && it && !it.interrupted && !(it.support && !it.windup) && (it.heavy || it.cast) && it.id !== 'none' && it.id !== 'unaware';
      a.tele = tele ? (it.windup ? { kind: 'windup', color: TELE.windup } : { kind: it.heavy && !it.cast ? 'heavy' : 'cast', color: it.heavy && !it.cast ? TELE.heavy : TELE_CAST[it.school] || TELE_CAST.magic }) : null;
    }
  }

  // ------------------------------------------------------------------ banners & toasts
  banner(title, sub, kind = '', ms = 2000) {
    const b = this.bannerEl;
    b.className = 'on ' + kind;
    b.querySelector('.b0').textContent = kind === 'level' ? 'Level up' : kind === 'zone' ? 'Entering' : kind === 'boss' ? 'The end of the road' : '';
    b.querySelector('.b1').textContent = title;
    b.querySelector('.b2').textContent = sub || '';
    this.placeBanner(); this.placeToasts();
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = kind; this.placeToasts(); }, settings.instant ? Math.min(ms, 1200) : ms / Math.max(1, Math.min(2, settings.get('speed'))));
  }
  hideBanner() { clearTimeout(this.bannerT); this.bannerEl.classList.remove('on'); this.placeToasts(); }
  /**
   * Blind panel 2026-11-13 (item 6): in a fight the banner ("Level up" mid-fight, an elite's name, a boss phase) covered the
   * target frame's Next actions and the action numbers. It takes the first spot, from its own (top 30 %) down over the
   * field and then off centre, that covers no fight panel (BANNER_KEEP); with none free, the one that covers least. Outside
   * fights it stays put.
   */
  placeBanner() {
    const b = this.bannerEl; b.style.left = ''; b.style.top = '';
    if (!b.classList.contains('on') || !document.body.classList.contains('in-fight')) return;
    const keep = [...document.querySelectorAll(BANNER_KEEP)].filter((x) => !x.closest('.hidden')).map((x) => x.getBoundingClientRect()).filter((q) => q.width > 0 && q.height > 0);
    const r = b.getBoundingClientRect(); const W = innerWidth; const H = innerHeight;
    const cost = ([cx, cy]) => keep.reduce((k, q) => k + Math.max(0, Math.min(cx + r.width / 2, q.right) - Math.max(cx - r.width / 2, q.left)) * Math.max(0, Math.min(cy + r.height / 2, q.bottom) - Math.max(cy - r.height / 2, q.top)), 0);
    const spots = [];
    for (const fx of [0.5, 0.42, 0.58, 0.36]) for (const fy of [0.3, 0.44, 0.5, 0.56, 0.38]) spots.push([fx * W, Math.max(r.height / 2 + 4, Math.min(H - r.height / 2 - 4, fy * H))]);
    let best = spots[0]; let bestK = Infinity;
    for (const p of spots) { const k = cost(p); if (k < bestK - 0.5) { best = p; bestK = k; } if (k <= 0) break; }
    b.style.left = `${Math.round(best[0])}px`; b.style.top = `${Math.round(best[1])}px`;
  }
  /**
   * A short message in the toast stack. The same message while it is on screen merges into it ("Quest complete! ×2") and
   * its time starts again; at most TOAST_MAX show at once and the rest wait in a queue (the same message queued merges
   * too), so a burst (quests turned in at speed, a level, a heat change) never stacks over the map or the frames.
   */
  toast(text, kind = '') {
    if (kind === 'err') this.audio.cue('error');
    // a change of the heat state (heat.js, expedition.md H.4) shows at once and never merges. Only one heat toast is on
    // screen: a later change replaces it, so a burst (a zone change: Burning, Smouldering, Calm, ...) ends on the final
    // state and the stack keeps TOAST_MAX (QA playtest 2026-11-11 finding 1)
    const first = /^heat-/.test(kind);
    const key = `${kind}|${text}`;
    if (first) for (const t of [...this.toasts.children]) if (/\bheat-/.test(t.className)) { clearTimeout(t._toastT); t.remove(); }
    if (!first) {
      const live = [...this.toasts.children].find((t) => t.dataset.key === key);
      if (live) {
        live.dataset.n = String(Number(live.dataset.n || 1) + 1);
        live.textContent = `${text} ×${live.dataset.n}`;
        live.style.animation = 'none'; void live.offsetWidth; live.style.animation = ''; // the fade starts again
        this.armToast(live);
        return;
      }
      const q = this.toastQueue.find((x) => x.key === key);
      if (q) { q.n += 1; return; }
    }
    if (this.toasts.children.length >= TOAST_MAX) {
      // the heat change takes the place of the oldest other toast. QA playtest 2026-11-13 (finding 5): so does a refusal
      // ('err', why a key or click did nothing), of the oldest toast that is no refusal and no heat change (its line is in
      // the log); it waited behind two notes before, so a refused key looked as if nothing had happened
      const old = [...this.toasts.children].find((t) => !/\bheat-/.test(t.className) && (first || !/\berr\b/.test(t.className)));
      if (!first && !(kind === 'err' && old)) {
        this.toastQueue.push({ key, text, kind, n: 1 });
        if (this.toastQueue.length > TOAST_QUEUE) this.toastQueue.shift(); // a long burst: the oldest waiting message lapses
        return;
      }
      if (old) { clearTimeout(old._toastT); old.remove(); }
    }
    this.showToast({ key, text, kind, n: 1 });
  }
  showToast(x) {
    const t = h('div.toast' + (x.kind ? '.' + x.kind : ''), { dataset: { key: x.key, n: String(x.n) } }, x.n > 1 ? `${x.text} ×${x.n}` : x.text);
    this.toasts.appendChild(t);
    this.armToast(t);
    this.placeToasts();
  }
  /**
   * Toasts never cover an open window (UX review item 9). The stack keeps its place (style.css) while it is clear of every
   * open window; otherwise it moves sideways, at the same height, into the nearest gap between windows wide enough for
   * it; with no such gap it stays and goes under the windows. Called when a toast shows and
   * when windows open, close or re-render.
   */
  placeToasts() {
    const el = this.toasts;
    el.style.left = ''; el.style.top = ''; el.classList.remove('under-wins');
    if (!el.children.length) return;
    // blind panel 2026-11-13 (item 6): toasts drew over the centre banner ("Entering ...", "Level up"); while it shows, the
    // stack sits under it (then clear of the windows as below)
    const bn = this.bannerEl.classList.contains('on') ? this.bannerEl.getBoundingClientRect() : null;
    if (bn && bn.width > 0) {
      const r0 = el.getBoundingClientRect();
      if (r0.left < bn.right + 8 && r0.right > bn.left - 8 && r0.top < bn.bottom + 8 && r0.bottom > bn.top - 8) {
        const base0 = (el.offsetParent || document.body).getBoundingClientRect();
        el.style.left = `${r0.left + r0.width / 2 - base0.left}px`; el.style.top = `${bn.bottom + 10 - base0.top}px`;
      }
    }
    const wins = [...document.querySelectorAll('#windows > .win')].map((w) => w.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    if (!wins.length) return;
    const r = el.getBoundingClientRect(); const pad = 8;
    const hits = (x0, y0) => wins.some((w) => x0 < w.right + pad && x0 + r.width > w.left - pad && y0 < w.bottom + pad && y0 + r.height > w.top - pad);
    if (!hits(r.left, r.top)) return;
    const base = (el.offsetParent || document.body).getBoundingClientRect();
    const put = (x0, y0) => { el.style.left = `${x0 + r.width / 2 - base.left}px`; el.style.top = `${y0 - base.top}px`; };
    // sideways at the same height: candidate left edges next to each window, nearest the stack's own place first
    const xs = [pad, innerWidth - r.width - pad, ...wins.flatMap((w) => [w.right + pad, w.left - pad - r.width])]
      .filter((x0) => x0 >= pad && x0 + r.width <= innerWidth - pad).sort((a, b) => Math.abs(a - r.left) - Math.abs(b - r.left));
    const x = xs.find((x0) => !hits(x0, r.top));
    if (x !== undefined) { put(x, r.top); return; }
    // no gap at its height (moving it up or down would put it on the Furnace, the frames or the action bar): it stays
    // where it is, under the windows
    el.classList.add('under-wins');
  }
  /** A toast leaves after TOAST_MS; the next queued one takes its place while there is room. */
  armToast(t) {
    clearTimeout(t._toastT);
    t._toastT = setTimeout(() => {
      t.remove();
      while (this.toastQueue.length && this.toasts.children.length < TOAST_MAX) this.showToast(this.toastQueue.shift());
    }, TOAST_MS);
  }
  showDeath(on, text) {
    if (on) this.deathEl.querySelector('.d2').textContent = text || 'No resurrection remains. Your journey ends here.';
    this.deathEl.classList.toggle('hidden', !on);
    // blind panel 2026-11-13 (item 6): "You have died" drew over the target frame's Next actions; the fight's panels give
    // way while it shows (style.css body.dying)
    document.body.classList.toggle('dying', !!on);
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
    // combat v2.1: a hovered wind-up whose element was redrawn (the round moved on) gives no pointerleave; drop it here
    window.addEventListener('pointerover', (e) => { if (this.ui.wuHover && !(e.target.closest && e.target.closest('.tk.wu, .tr.wu, .wub, .rl-x.wu'))) this.ui.setWindupHover(null); });
    window.addEventListener('keydown', (e) => this.onKey(e));
    // sound: one document-level listener clicks for every button, card, slot or map node pressed (audio.js CLICKABLE)
    document.addEventListener('click', (e) => { if (e.isTrusted && e.target.closest && e.target.closest(CLICKABLE)) this.audio.cue('uiClick'); }, true);
  }

  onKey(e) {
    // the Dev menu (dev-menu.js): the backquote key opens and closes it, also from its own fields
    if (e.code === 'Backquote' && this.devMenu.enabled()) { e.preventDefault(); this.devMenu.toggle(); return; }
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
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
      if (this.ui.cancelFlee()) return; // the flee ask: Esc stays
      if (disarmSpyglass()) { this.ui.refreshScreens(); return; }
      if (this.windows.anyOpen()) this.windows.closeAll();
      else if (this.ui.metaOpen) this.ui.closeMeta();
      else this.windows.toggle('settings');
      hideTip(); return;
    }
    if (v.phase === 'CREATE') { if (code === 'Enter' && !this.ui.metaOpen && !e.repeat) this.act({ type: 'START_RUN' }); return; }
    // the start camp (prep.js): 1-8 contracts, A-I supplies and sight, R reroll, Enter set out; Tab and a focused card's
    // Space or Enter as the browser's own
    if (v.phase === 'PREP') { if (prepKey(e, this.ctx) === 'native') return; return; }
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

  /**
   * A dev op from the Dev menu (engine-api.md 12): queued after the step on screen (which finishes at once), sent to the
   * bridge (R.debug), and its result shown at once like a loaded state: no animation, the target, previews and the
   * queued action cleared, the scene redrawn. A toast and a log line say what changed; a refusal shows its reason.
   * Returns { ok, error }.
   */
  devAct(op, args = {}) {
    clearTimeout(this.autoTimer);
    if (this.director.playing) this.director.skip();
    this.next = null; this.hud.setQueued(null);
    const run = async () => {
      try {
        const r = this.bridge.dev(op, args);
        if (!r.ok) { this.toast(r.error, 'err'); return r; }
        this.ui.target = null; this.ui.preview = null; this.ui.precastArmed = false; this.ui.wuHover = null; this.ui.fleeArmed = false;
        this.scene.clearFx(); this.showDeath(false); hideTip();
        this.shown = this.bridge.view; this.syncScene(this.shown, { instant: true, enter: true }); this.retarget(this.shown);
        this.screens.refresh(); // the screen is built again from the result (a revealed map shows its nodes at once)
        this.windows.update(); this.queueRender();
        const text = devText(op, args, r, this.shown);
        this.toast(text, 'good'); this.hud.log(`Dev: ${text}`, 'lg-sys');
        return r;
      } catch (err) { console.error(err); return { ok: false, error: String(err) }; } finally { this.scheduleAuto(); }
    };
    const p = this.queue.then(run, run);
    this.queue = p;
    return p;
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
      /** M3 onboarding: the coach line on screen, every line shown so far, the hint store (onboarding.js). */
      coach: () => app.coach.test(),
      /** The action the engine's autoplay policy would choose now (not sent). */
      autoChoice: () => app.bridge.autoAction(),
      /** The event the director is playing now ({ t, side }), or null. */
      playingEvent: () => { const e = app.director.playing && app.director.cursor; return e ? { t: e.t, side: e.src ? e.src.side : null, dst: e.dst ? e.dst.side : null, beat: app.director.beatNo, inRound: app.director.inRound } : null; },
      skip: () => app.director.skip(),
      /** The queued next action during a combat round ({ key, label }) or null. */
      queued: () => (app.next ? { key: app.next.key, label: app.next.label } : null),
      settings,
      openWin: (n) => app.windows.open(n), closeWins: () => app.windows.closeAll(),
      /** A toast, as the game shows one (tests of where toasts go). */
      toast: (t, k) => app.toast(t, k),
      /** Whether the Hall of Echoes is open (it shows over class select). */
      metaOpen: () => app.ui.metaOpen,
      /** The engine actions applied to this run, in order (engine mode; a Node twin replays them). */
      engineLog: () => app.bridge.engineLog(),
      /** The recent floats with their boxes (scene.floatBoxes; QA 2026-11-12: the Deathblow's floats do not overlap). */
      floats: () => app.scene.floatBoxes(),
      /** Actions the UI sent on its own since the page loaded (copies), e.g. a new potion put on the item bar. */
      ownActions: () => app.ownActions.map((a) => ({ ...a })),
      /** The engage hover preview now shown on the tracks (combat v2), or null. */
      preview: () => (app.ui.preview ? { option: app.ui.preview.option, target: app.ui.preview.target, data: app.ui.preview.data } : null),
      /** The current target (enemy index) or null. */
      target: () => app.ui.target,
      /** The wind-up hovered on a track, the ruler or a nameplate ({ idx, turn }) or null (combat v2.1). */
      windupHover: () => (app.ui.wuHover ? { ...app.ui.wuHover } : null),
      /**
       * Replace the run with a state saved by R.serialize (engine mode; qa/browser/ui-regress.mjs part J shows a state the
       * real content never reaches). The view, the scene and the target follow; returns false in mock mode.
       */
      loadState: (serialized) => {
        if (app.busy() || !app.bridge.testLoad(serialized)) return false;
        app.ui.target = null; app.ui.preview = null; app.ui.precastArmed = false; app.ui.wuHover = null;
        app.scene.clearFx(); app.hud.clearLog();
        app.shown = app.bridge.view; app.syncScene(app.shown, { instant: true, enter: true }); app.retarget(app.shown); app.screens.refresh(); app.queueRender();
        return true;
      },
      canDebug: app.bridge.canDebug,
      /** The run as R.serialize has it (engine mode), for a Node twin to compare (qa/browser/ui-regress.mjs part K). */
      state: () => app.bridge.serialized(),
      /** Dev menu (engine-api.md 12): whether it is open; a dev op as the menu sends it. */
      devOpen: () => app.devMenu.isOpen(),
      dev: (op, args) => app.devAct(op, args),
      /** Sound (audio.js): { unlocked, state, muted, log: [{ cue, step, t, kept, sound }] }; the log is written locked or muted too. */
      audio: () => app.audio.info(),
    };
  }
}

/** What a dev op did, for its toast and log line (dev-menu.js; presentation only). */
function devText(op, args, r, v) {
  const p = v.player;
  const where = v.zone ? (v.zone.camp ? v.zone.name : `${v.zone.name} (zone ${v.zone.idx})`) : '';
  switch (op) {
    case 'build': return `${p ? `Level ${p.level} ${p.className}` : 'A new run'} at ${where}`;
    case 'camp': return `At ${where}`;
    case 'boss': return `End-boss fight, phase ${args.phase || 1}`;
    case 'nextZone': return `On to ${where}`;
    case 'fight': return `Fight: ${v.combat ? v.combat.enemies.map((e) => e.name).join(', ') : 'started'}`;
    case 'kill': return 'Target killed';
    case 'refill': return 'Health and resources refilled';
    case 'god': return v.dev && v.dev.god ? 'God mode on: you take no damage' : 'God mode off';
    case 'give': { const g = r.note || {}; return [g.gold ? `${g.gold} copper` : '', g.potions ? `${g.potions} potions` : '', g.talentPoints ? `${g.talentPoints} talent points` : ''].filter(Boolean).join(', ') + (g.gold || g.potions || g.talentPoints ? ' given' : 'Nothing fits in the bags'); }
    case 'time': case 'heat': return `${tolls(v.time)}${v.heat ? `, ${HEAT_WORDS.state[v.heat.state] || v.heat.state}` : ''}`;
    case 'reveal': return 'Map revealed';
    case 'mapMode': return args.mode === 'expedition' ? 'Expedition map' : 'Classic map (old)';
    case 'echoes': return `${args.n} Echoes given`;
    case 'catalogue': return 'Every unlock in the catalogue';
    case 'resetOnboarding': return 'Onboarding reset: the next run is guided, the welcome is paid again, every hint shows again';
    case 'seed': return `New run on seed ${args.seed}`;
    default: return `Dev: ${op}`;
  }
}

/** The fight's panels a banner in a fight keeps clear of (placeBanner). */
const BANNER_KEEP = '#target-frame, #boss-frame, #ruler, #nameplates .np, #engage, #turnprompt, #actionbar, #player-frame, #pet-frame, #tracker, #coach, #fleeask';
/** M2b v13: how long autoplay's engage round holds at 1x when it shows "Autoplay will answer the Deathblow with ..." (ms). */
const AUTO_HINT_MS = 1600;
// toasts: on screen at most TOAST_MAX at once for TOAST_MS each (the CSS fade is 2.6 s); at most TOAST_QUEUE wait
const TOAST_MAX = 2;
const TOAST_MS = 2700;
const TOAST_QUEUE = 6;

function npcLook(theme, kind) {
  const base = enemyLook(kind === 'merchant' ? 'mender' : kind === 'trainer' ? 'caster' : 'mender', theme, 'normal');
  if (kind === 'giver') return { ...base, cloth: '#6a5232', cloth2: '#8a6a42', trim: '#e0b860', hood: null, robe: false, weapon: 'none', handGlow: null, build: 1, crouch: 0, float: false, eyes: '#2a1d14', pants: '#4a3a24', boots: '#2a1c10' };
  if (kind === 'merchant') return { ...base, cloth: '#7a3a2a', cloth2: '#a8583a', trim: '#e8c060', hood: null, robe: true, weapon: 'none', orb: null, build: 1.08, float: false, eyes: '#2a1d14' };
  return { ...base, cloth: '#2a2a5a', cloth2: '#4a4a8a', trim: '#e8c060', robe: true, weapon: 'staff', orb: '#ffd36a', handGlow: null, float: false, hood: 'cowl' };
}
export { flags };
