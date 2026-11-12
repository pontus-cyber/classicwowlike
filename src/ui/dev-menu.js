// The Dev menu (owner feedback 2026-11-11 07:41: "in-game dev tools from a menu, so he can test any stage without playing
// through"; docs/specs/engine-api.md 12). A corner button and the backquote key (`) open a panel with six tabs: Start at
// (class, pet, zone, level, item level, rarity, map mode, talents), Jump (the Camp, the end-boss fight in phase 1, 2 or 3,
// the next zone), Fight (a searchable list of every enemy template by zone and type, the target killed, health and
// resources refilled), Give (gold, potions, talent points, Echoes, the full catalogue), World (the run's tolls and heat, the map
// revealed, god mode, the map mode, "Classic map (old)" for new runs: D116 made the expedition map with the start camp the
// default, the classic map stays for testing here only) and Seed (the seed, copy it, a new run on a seed). On by default; ?dev=0 or the
// settings hide it. Presentation only: every button sends one dev op through the bridge (ctx.dev -> engine-bridge.js dev
// -> R.debug); the numbers it shows (levels, limits, kinds) come from the bridge's data.dev.
import { h, clear, fmtNum, moneyEl } from './util.js';
import { HEAT_WORDS, tolls } from './ui-text.js';

const TABS = [['start', 'Start at'], ['jump', 'Jump'], ['fight', 'Fight'], ['give', 'Give'], ['world', 'World'], ['seed', 'Seed']];
const KIND_NAME = { normal: 'Normal', elite: 'Elite', rare: 'Rare', trash: 'Dungeon trash', dboss: 'Dungeon boss' };
const HEAT_LABEL = HEAT_WORDS.state; // Calm, Smouldering, Burning, Infernal (ui-text.js)
const RUN_PHASES = ['ZONE_HUB', 'MAP', 'NODE', 'CAMP', 'BOSS'];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Create the Dev menu in the HUD root. ctx: the app context (view, data, settings) plus dev(op, args) -> Promise<{ ok,
 * error }> (App.devAct) and toast(text, kind). Returns { el, button, open, close, toggle, isOpen, enabled, update }.
 */
export function createDevMenu(root, ctx, { allowed }) {
  const d = ctx.data;
  const D = d.dev;
  // the mock engine (?mock=1) has no dev tools: no button, no menu, the key does nothing
  if (!D) return { el: null, button: null, open() {}, close() {}, toggle() {}, isOpen: () => false, enabled: () => false, update() {}, tab() {} };
  const button = h('button#devbtn', { type: 'button', 'aria-label': 'Dev tools', title: 'Dev tools (`)' }, h('span', 'D'), h('span', 'E'), h('span', 'V'));
  const panel = h('div#devmenu.panel.hidden', { role: 'dialog', 'aria-label': 'Dev tools' });
  root.append(button, panel);
  let tab = 'start';
  let built = null; // the tab on screen: { tab, refresh(view) }
  // form values kept while the menu is open and between tabs
  const form = { classId: null, petId: null, zone: null, level: '', ilvl: '', rarity: D.defaults.RARITY, mapMode: null, talents: 'auto',
    q: '', fzone: 'all', fkind: 'all', flevel: '', gold: '10000', potions: String(D.defaults.POTIONS), points: '1', echoes: '1000', time: '', seed: '' };

  const enabled = () => allowed() && ctx.settings.get('devTools') !== false;
  const isOpen = () => !panel.classList.contains('hidden');
  const inRun = (v) => !!(v && v.player && RUN_PHASES.includes(v.phase));
  /** A button that sends a dev op; focus leaves it afterwards so Space and the game's keys go to the game. */
  const opBtn = (label, op, args, cls = '') => {
    const b = h('button.btn.small' + cls, { type: 'button' }, label);
    b.addEventListener('click', async () => {
      b.blur();
      const a = typeof args === 'function' ? args() : args;
      if (a === null) return;
      await ctx.dev(op, a || {});
    });
    return b;
  };
  const field = (label, input, hint = null) => h('label.dm-f', h('span.dm-l', label), input, hint ? h('span.dm-h', hint) : null);
  const select = (key, options, onChange = null) => {
    const el = h('select', { dataset: { f: key } }, options.map(([val, label]) => h('option', { value: String(val) }, label)));
    el.value = String(form[key]);
    el.addEventListener('change', () => { form[key] = el.value; if (onChange) onChange(el.value); });
    return el;
  };
  const number = (key, { min, max, placeholder = '', step = 1 } = {}) => {
    const el = h('input', { type: 'number', min: String(min), ...(max != null ? { max: String(max) } : {}), step: String(step), placeholder: String(placeholder), dataset: { f: key } });
    el.value = form[key];
    el.addEventListener('input', () => { form[key] = el.value; });
    return el;
  };
  /** A whole number from a form field, or null with a toast naming the field. */
  const whole = (key, label, min, max = Infinity, blankOk = false) => {
    const raw = String(form[key]).trim();
    if (raw === '' && blankOk) return undefined;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) { ctx.toast(`${label}: a whole number ${max < Infinity ? `from ${min} to ${max}` : `of at least ${min}`}`, 'err'); return null; }
    return n;
  };

  // ---------------------------------------------------------------- tabs
  const builders = {
    start(v) {
      const cur = v.player || v.create || {};
      if (!form.classId) form.classId = cur.classId || 'rogue';
      if (!form.petId) form.petId = (v.player && v.player.petId) || (v.create && v.create.petId) || Object.keys(d.pets)[0];
      if (form.zone === null) form.zone = v.zone && !v.zone.camp ? v.zone.idx : v.zone && v.zone.camp ? D.zoneCount + 1 : 1;
      // the map of the run on screen; at class select the map new runs get (D116: the expedition with the start camp)
      const rm = ctx.bridge.runMode ? ctx.bridge.runMode() : {};
      const createKey = rm.mapMode === 'rows' ? 'rows' : rm.prep === false ? 'expedition' : 'expedition-camp';
      if (!form.mapMode) form.mapMode = v.phase === 'CREATE' ? createKey : v.contracts ? 'expedition-camp' : v.mapMode || 'rows';
      const zones = Array.from({ length: D.zoneCount }, (_, i) => [i + 1, `${i + 1} · ${(d.zones[i] || {}).name || `Zone ${i + 1}`}`]);
      const lvl = number('level', { min: 1, max: D.maxLevel, placeholder: D.firstLevel[form.zone - 1] });
      const pet = select('petId', Object.values(d.pets).map((p) => [p.id, `${p.name}${p.locked ? ' (locked)' : ''}`]));
      const syncPet = () => { pet.disabled = form.classId !== 'hunter'; };
      const cls = select('classId', Object.values(d.classes).map((c) => [c.id, c.name]), syncPet);
      syncPet();
      const zone = select('zone', [...zones, [D.zoneCount + 1, `${D.zoneCount + 1} · ${(d.camp && d.camp.name) || 'The Camp'}`]], (z) => { form.zone = Number(z); lvl.placeholder = String(D.firstLevel[form.zone - 1]); });
      const go = opBtn('Start here', 'build', () => {
        const level = whole('level', 'Level', 1, D.maxLevel, true);
        const ilvl = whole('ilvl', 'Item level', 1, D.ilvlMax, true);
        if (level === null || ilvl === null) return null;
        // "Expedition with start camp": newRun prep (engine-api.md 13), set out with nothing bought, every point Reserve;
        // "Expedition without start camp": prep false (D116: debug.build's default is the camp)
        const camp = form.mapMode === 'expedition-camp';
        return { classId: form.classId, petId: form.classId === 'hunter' ? form.petId : null, zone: Number(form.zone), level, ilvl, rarity: form.rarity, mapMode: camp ? 'expedition' : form.mapMode, ...(form.mapMode === 'rows' ? {} : { prep: camp }), talents: form.talents };
      }, '.primary');
      go.dataset.dev = 'start';
      const body = h('div.dm-grid',
        field('Class', cls), field('Pet', pet), field('Zone', zone), field('Level', lvl, 'blank: the zone\'s first'),
        field('Item level', number('ilvl', { min: 1, max: D.ilvlMax, placeholder: 'level' }), 'blank: the level'),
        field('Rarity', select('rarity', D.rarities.map((r) => [r, cap(r)]))),
        field('Map', select('mapMode', [['expedition-camp', 'Expedition with start camp'], ['expedition', 'Expedition without start camp'], ['rows', 'Classic map (old)']])),
        field('Talents', select('talents', [['auto', 'Spent (default build)'], ['unspent', 'Unspent']])));
      return { el: h('div', body, h('div.dm-acts', go), h('div.dm-note', 'A new run in the zone\'s hub (the Camp: at the Camp), gear in every slot, every spell trained, potions and gold. The seed is the Seed tab\'s.')), refresh() {} };
    },
    jump(v) {
      const btns = [opBtn('To the Camp', 'camp'), opBtn('Next zone', 'nextZone')];
      const boss = [1, 2, 3].map((n) => { const b = opBtn(`Boss phase ${n}`, 'boss', { phase: n }); b.dataset.dev = `boss${n}`; return b; });
      const all = [...btns, ...boss];
      const why = h('div.dm-note');
      return {
        el: h('div', h('div.dm-acts', btns), h('div.dm-sub', 'End-boss fight'), h('div.dm-acts', boss), why,
          h('div.dm-note', 'Leaves whatever is open (a fight, a node, a service, the loot window). The character and the time so far stay; Next zone costs the travel tolls.')),
        refresh(vv) {
          const ok = inRun(vv);
          for (const b of all) b.disabled = !ok;
          all[1].disabled = !ok || !!(vv.zone && vv.zone.camp);
          why.textContent = ok ? '' : 'Start a run first (Start at, or Enter the world).';
        },
      };
    },
    fight(v) {
      const list = h('div.dm-list', { role: 'list' });
      const count = h('span.dm-h');
      const search = h('input', { type: 'search', placeholder: 'Search name or id', 'aria-label': 'Search enemies', dataset: { f: 'q' } });
      search.value = form.q;
      const draw = () => {
        const q = form.q.trim().toLowerCase();
        const rows = D.enemies.filter((x) => (form.fzone === 'all' || String(x.zone) === form.fzone) && (form.fkind === 'all' || x.kind === form.fkind)
          && (!q || x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q)));
        clear(list);
        for (const x of rows) {
          const b = opBtn('Fight', 'fight', () => { const level = whole('flevel', 'Level', 1, D.maxLevel, true); return level === null ? null : { ids: [x.id], level }; });
          b.dataset.enemy = x.id;
          b.disabled = !inRun(ctx.bridge.view);
          list.appendChild(h('div.dm-row', { role: 'listitem', dataset: { enemy: x.id } },
            h('div.dm-rn', h('b', x.name), h('span.dm-k.k-' + x.kind, KIND_NAME[x.kind] || x.kind)),
            h('div.dm-rm', `${cap(x.archetype)} · zone ${x.zone ?? '-'} · `, h('code', x.id)), b));
        }
        count.textContent = `${rows.length} of ${D.enemies.length}`;
      };
      search.addEventListener('input', () => { form.q = search.value; draw(); });
      const zoneSel = select('fzone', [['all', 'All zones'], ...Array.from({ length: D.zoneCount }, (_, i) => [String(i + 1), `Zone ${i + 1}`])], draw);
      const kindSel = select('fkind', [['all', 'All types'], ...D.kinds.map((k) => [k, KIND_NAME[k]])], draw);
      const lvl = number('flevel', { min: 1, max: D.maxLevel, placeholder: 'yours' });
      draw();
      const kill = opBtn('Kill target', 'kill', () => ({ target: ctx.ui.target }));
      kill.dataset.dev = 'kill';
      const refill = opBtn('Heal and refill', 'refill');
      return {
        el: h('div', h('div.dm-filter', search, zoneSel, kindSel), h('div.dm-filter', field('Level', lvl, 'blank: yours'), count), list,
          h('div.dm-acts', kill, refill), h('div.dm-note', 'The fight replaces whatever is open; won or fled, you are back where you were. Kills pay XP, coin and loot.')),
        refresh(vv) {
          const ok = inRun(vv);
          for (const b of list.querySelectorAll('button')) b.disabled = !ok;
          kill.disabled = !(ok && vv.combat && !vv.combat.over);
          refill.disabled = !ok;
          lvl.placeholder = vv.player ? String(vv.player.level) : 'yours';
        },
      };
    },
    give(v) {
      const gold = number('gold', { min: 1 });
      const preview = h('span.dm-h');
      const showGold = () => { clear(preview); const n = Number(form.gold); if (Number.isInteger(n) && n > 0) preview.appendChild(moneyEl(n)); };
      gold.addEventListener('input', showGold); showGold();
      const runOnly = [
        opBtn('Give', 'give', () => { const n = whole('gold', 'Gold', 1); return n === null ? null : { gold: n }; }),
        opBtn('Give', 'give', () => { const n = whole('potions', 'Potions', 1, 100); return n === null ? null : { potions: n }; }),
        opBtn('Give', 'give', () => { const n = whole('points', 'Talent points', 1, 100); return n === null ? null : { talentPoints: n }; }),
      ];
      const ech = opBtn('Give', 'echoes', () => { const n = whole('echoes', 'Echoes', 1); return n === null ? null : { n }; });
      const full = opBtn('Unlock the full catalogue', 'catalogue');
      return {
        el: h('div',
          h('div.dm-line', field('Gold (copper)', gold, null), preview, runOnly[0]),
          h('div.dm-line', field('Potions', number('potions', { min: 1, max: 100 }), null), runOnly[1]),
          h('div.dm-line', field('Talent points', number('points', { min: 1, max: 100 }), null), runOnly[2]),
          h('div.dm-sub', 'Profile (kept between runs)'),
          h('div.dm-line', field('Echoes', number('echoes', { min: 1 }), null), ech),
          h('div.dm-acts', full),
          h('div.dm-note', 'Potions: Healing Draughts while the bags take them (a Mage gets Mana Draughts too). Echoes and the catalogue go to your saved profile.')),
        refresh(vv) { for (const b of runOnly) b.disabled = !inRun(vv); },
      };
    },
    world(v) {
      const time = number('time', { min: 0, placeholder: v.time ?? 0 });
      const now = h('span.dm-h');
      const set = opBtn('Set', 'time', () => { const n = whole('time', HEAT_WORDS.Units, 0); return n === null ? null : { time: n }; });
      const heat = D.heatStates.map((st) => { const b = opBtn(HEAT_LABEL[st] || cap(st), 'heat', { state: st }); b.dataset.heat = st; return b; });
      const reveal = opBtn('Reveal the map', 'reveal');
      const god = h('div.toggle', { role: 'switch', 'aria-label': 'God mode', tabindex: '0' }, h('div.sw'), 'God mode');
      god.addEventListener('click', () => ctx.dev('god', { on: !(ctx.bridge.view.dev && ctx.bridge.view.dev.god) }));
      const modes = [['expedition', 'Expedition'], ['rows', 'Classic (old)']].map(([m, label]) => { const b = h('button', { type: 'button' }, label); b.dataset.mode = m; b.addEventListener('click', () => { b.blur(); ctx.dev('mapMode', { mode: m }); }); return b; });
      // the map new runs get (the setting of the same name, D116): off, the expedition map with the start camp (the default)
      const camp = h('div.toggle', { role: 'switch', 'aria-label': 'Classic map (old)', tabindex: '0', dataset: { dev: 'classic' } }, h('div.sw'), 'Classic map (old) for new runs');
      camp.addEventListener('click', () => ctx.settings.set('classicMap', !ctx.settings.get('classicMap')));
      // the Lantern colour theme, a proposal for the owner (docs/art/proposal-1; D120, D121): data-theme on <html>, colours only
      const theme = h('div.toggle', { role: 'switch', 'aria-label': 'Theme: Lantern (proposal)', tabindex: '0', dataset: { dev: 'theme' } }, h('div.sw'), 'Theme: Lantern (proposal)');
      theme.addEventListener('click', () => ctx.settings.set('lanternTheme', ctx.settings.theme !== 'lantern'));
      return {
        el: h('div',
          h('div.dm-line', field(HEAT_WORDS.Units, time, null), set, now),
          h('div.dm-sub', `${HEAT_WORDS.Name} (the run's own clock)`), h('div.dm-acts', heat),
          h('div.dm-acts', reveal, god),
          h('div.dm-sub', 'Map'), h('div.seg.dm-seg', modes), h('div.dm-acts', camp),
          h('div.dm-sub', 'Look'), h('div.dm-acts', theme),
          h('div.dm-note', 'God mode: you take no damage (a heavy blow counts as avoided). A run with it, or with any tool here, is a dev run: no Echoes. Map: the zone is drawn again in that mode, you at its hub. New runs start at the start camp on the expedition map; Classic map (old) starts them on the classic map instead, from class select (at once there) or the next run.')),
        refresh(vv) {
          const ok = inRun(vv);
          set.disabled = !ok; for (const b of heat) b.disabled = !ok;
          reveal.disabled = !ok || !!(vv.zone && vv.zone.camp);
          const on = !!(vv.dev && vv.dev.god);
          god.classList.toggle('on', on); god.setAttribute('aria-checked', on ? 'true' : 'false'); god.classList.toggle('disabled', !ok);
          for (const b of modes) b.classList.toggle('on', (vv.mapMode || 'rows') === b.dataset.mode);
          const co = !!ctx.settings.get('classicMap'); camp.classList.toggle('on', co); camp.setAttribute('aria-checked', co ? 'true' : 'false');
          const lo = ctx.settings.theme === 'lantern'; theme.classList.toggle('on', lo); theme.setAttribute('aria-checked', lo ? 'true' : 'false');
          time.placeholder = String(vv.time ?? 0);
          now.textContent = vv.heat ? `now ${tolls(vv.time)} · ${HEAT_LABEL[vv.heat.state] || vv.heat.state}` : '';
        },
      };
    },
    seed(v) {
      const cur = h('code.dm-seed');
      const copy = h('button.btn.small', { type: 'button' }, 'Copy');
      copy.addEventListener('click', async () => {
        copy.blur();
        const text = cur.textContent;
        let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; } catch { /* no clipboard (file://): select it instead */ }
        if (!ok) { const r = document.createRange(); r.selectNodeContents(cur); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { ok = document.execCommand('copy'); } catch { ok = false; } }
        ctx.toast(ok ? `Seed ${text} copied` : `Seed ${text} selected: copy it with Ctrl+C`, ok ? 'good' : 'info');
      });
      const restart = opBtn('Restart with this seed', 'seed', () => { const n = whole('seed', 'Seed', 0, 0xffffffff); return n === null ? null : { seed: n }; });
      return {
        el: h('div', h('div.dm-line', h('span.dm-l', 'Current seed'), cur, copy), h('div.dm-line', field('Seed', number('seed', { min: 0, placeholder: 'any whole number' }), null), restart),
          h('div.dm-note', 'Restart: a new run on this seed at class select, the class and pet kept. Start at uses the current seed.')),
        refresh(vv) { cur.textContent = String(vv.seed ?? (vv.create ? vv.create.seed : '')); },
      };
    },
  };

  // ---------------------------------------------------------------- frame
  const status = h('span.dm-run');
  const tabsEl = h('div.dm-tabs', { role: 'tablist' });
  const body = h('div.dm-body', { role: 'tabpanel' });
  const close = h('button.xbtn', { type: 'button', 'aria-label': 'Close dev tools' }, '×');
  close.addEventListener('click', () => setOpen(false));
  for (const [id, label] of TABS) {
    const b = h('button.dm-tab', { type: 'button', role: 'tab', dataset: { tab: id } }, label);
    b.addEventListener('click', () => { b.blur(); tab = id; build(); });
    tabsEl.appendChild(b);
  }
  panel.append(h('div.dm-head', h('div.title', 'Dev tools'), status, close),
    h('div.dm-warn', 'For testing. A run changed here is a dev run: no Echoes, your profile stays as it was.'), tabsEl, body);
  button.addEventListener('click', () => { button.blur(); setOpen(!isOpen()); });

  function build() {
    const v = ctx.bridge.view;
    for (const b of tabsEl.children) { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
    const t = builders[tab](v);
    clear(body).appendChild(t.el);
    built = { tab, refresh: t.refresh };
    refresh(v);
  }
  function refresh(v) {
    if (!v) return;
    status.textContent = v.dev ? (v.dev.god ? 'Dev run · god mode' : 'Dev run') : '';
    if (built) built.refresh(v);
  }
  function setOpen(on) {
    if (on && !enabled()) return;
    panel.classList.toggle('hidden', !on);
    button.classList.toggle('on', on);
    if (on) build();
  }
  function update(v) {
    const en = enabled();
    button.classList.toggle('hidden', !en);
    if (!en && isOpen()) setOpen(false);
    if (isOpen()) refresh(v);
  }
  ctx.settings.on('change', (k) => { if (k === 'devTools') update(ctx.bridge.view); if ((k === 'classicMap' || k === 'lanternTheme') && isOpen()) refresh(ctx.bridge.view); });
  update(ctx.bridge.view);
  return { el: panel, button, open: () => setOpen(true), close: () => setOpen(false), toggle: () => setOpen(!isOpen()), isOpen, enabled, update, tab: (id) => { if (builders[id]) { tab = id; if (isOpen()) build(); } } };
}
