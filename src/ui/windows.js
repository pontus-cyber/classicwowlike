// Toggleable windows: character sheet, bags, spellbook, talents, quest log, settings, zone map.
import { h, clear, fmtNum, moneyEl, pct } from './util.js';
import { spellIcon, itemIcon, slotIcon, talentIcon, icon } from './art-icons.js';
import { drawHumanoid, HERO_LOOKS } from './art-actors.js';
import { tip, itemTip, spellTip, talentTip, SLOT_NAMES } from './tooltip.js';
import { dragSource, dropTarget } from './hud.js';
import { buildMap } from './screens.js';
import { settings } from './settings.js';
import { resurrectText } from './ui-text.js';
import { flags } from './engine-bridge.js';

const TREE_BG = {
  bladework: ['#3a3f4a', '#14161c'], shadowcraft: ['#2e2440', '#0e0a16'], venomcraft: ['#24361a', '#0a1208'],
  pyromancy: ['#4a1e10', '#160806'], rimecraft: ['#16324a', '#060e18'], arcanism: ['#2e1a4a', '#0c0618'],
  beastbond: ['#3a2c18', '#120c06'], marksmanship: ['#2c3a1e', '#0c1208'], wildcraft: ['#1e3a2e', '#08140e'],
};

export function createWindows(root, ctx) {
  const layer = h('div#windows');
  root.appendChild(layer);
  const open = new Map(); // name -> element
  let ctxMenu = null;

  function frame(name, title, sub, body) {
    const el = h('div.win.panel#win-' + name, h('div.wtitle', h('div', h('div.title', title), sub ? h('div.subtitle', sub) : null), closeX(name)), body);
    return el;
  }
  function closeX(name) { const b = h('button.xbtn', { 'aria-label': 'Close' }, '×'); b.addEventListener('click', () => close(name)); return b; }

  const builders = {
    character(v) {
      const p = v.player;
      const slotEl = (s) => {
        const it = p.equip[s];
        const el = h('div.slot' + (it ? '.q-' + it.rarity : ''), h('img', { src: it ? itemIcon(it) : slotIcon(s), alt: '' }));
        tip(el, () => (it ? itemTip(it, ctx, { compare: false, hint: v.legal.outOfCombat ? 'Right-click to unequip' : null }) : h('div', h('div.tt-name', SLOT_NAMES[s]), h('div.tt-sub', 'Empty'))));
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (it) ctx.act({ type: 'UNEQUIP', slot: s }); });
        return el;
      };
      const model = h('div.model');
      const cv = h('canvas', { width: 520, height: 700 });
      model.appendChild(cv);
      const g = cv.getContext('2d');
      const bg = g.createRadialGradient(260, 260, 40, 260, 340, 420);
      bg.addColorStop(0, '#4a3a26'); bg.addColorStop(1, '#0c0a08'); g.fillStyle = bg; g.fillRect(0, 0, 520, 700);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(260, 640, 120, 20, 0, 0, Math.PI * 2); g.fill();
      drawHumanoid(g, 250, 636, 4.6, HERO_LOOKS[p.classId], { t: 1.2 });
      const s = p.stats;
      const stat = (k, val) => h('div', h('span', k), h('b', val));
      const resName = { energy: 'Energy', mana: 'Mana', focus: 'Focus' }[p.res.kind];
      // resurrect charges (rules 9, M2 v3): what a death would use now; Second Breath not in the final fight
      const rt = resurrectText(p, !!(v.combat && v.combat.isBoss && !v.combat.over));
      const body = h('div', h('div.paperdoll', h('div.colslots', ['head', 'neck', 'chest', 'hands', 'legs'].map(slotEl)), model, h('div.colslots', ['feet', 'ring', 'trinket', 'weapon', 'offhand'].map(slotEl))),
        h('div.statgrid', stat('Health', `${fmtNum(p.hp)} / ${fmtNum(p.maxHp)}`), stat(resName, `${fmtNum(p.res.cur)} / ${fmtNum(p.res.max)}`),
          stat('Stamina', fmtNum(s.sta)), stat('Agility', fmtNum(s.agi)), stat('Intellect', fmtNum(s.int)), stat('Spirit', fmtNum(s.spi)),
          stat('Power', fmtNum(s.power)), stat('Critical strike', pct(s.crit, 1)), stat('Dodge', pct(s.dodge, 1)), stat('Armor', fmtNum(s.armor)),
          stat('Weapon damage', fmtNum(s.wd || 0)), stat('Crit damage', `× ${(s.critMult || 1.5).toFixed(2)}`),
          h('div.wide.resline', h('span', 'Resurrections'), h('b', rt.list)), rt.note ? h('div.wide.resnote', rt.note) : null));
      return frame('character', `${p.name}`, `Level ${p.level} ${p.className}`, body);
    },
    bags(v) {
      const p = v.player;
      const grid = h('div.baggrid');
      p.bag.forEach((it, i) => {
        if (!it) { grid.appendChild(h('div.slot', { style: { cursor: 'default' } })); return; }
        const up = it.kind === 'gear' && ctx.bridge.itemScore(it) > ctx.bridge.itemScore(p.equip[it.slot]);
        const el = h('div.slot.q-' + it.rarity, h('img', { src: itemIcon(it), alt: '' }), it.count > 1 ? h('span.cnt', String(it.count)) : null, up ? h('span.upg', '▲') : null);
        tip(el, () => itemTip(it, ctx, { hint: it.kind === 'gear' ? 'Right-click to equip · click for options' : it.kind === 'consumable' ? 'Right-click to use · drag to the item bar' : 'Click for options' }));
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); quick(it); });
        el.addEventListener('click', (e) => { if (!ctx.ui.dragging) menu(e, it, v); });
        if (it.kind === 'consumable') dragSource(el, ctx, () => ({ kind: 'item', item: it, icon: itemIcon(it) }));
        grid.appendChild(el);
      });
      const used = p.bag.filter(Boolean).length;
      return frame('bags', 'Bags', `${used} / ${p.bag.length} slots`, h('div', grid, h('div.bagfoot', h('span.muted', 'Gold'), moneyEl(p.gold))));
    },
    spellbook(v) {
      const p = v.player; const d = ctx.data;
      const list = h('div.splist', p.spells.map((k) => {
        const sp = d.spells[k.id];
        const slot = p.bar.indexOf(k.id);
        const row = h('div.sprow' + (slot >= 0 ? '.onbar' : ''), h('img', { src: spellIcon(k.id, sp), alt: '' }), h('div', h('div.nm', sp.name), h('div.meta', `Rank ${k.rank} · trained to level ${k.tl}${sp.cd ? ` · ${sp.cd} round cooldown` : ''}`)), slot >= 0 ? h('span.pill', `Slot ${slot + 1}`) : h('span.pill.muted', 'Not on bar'));
        tip(row, () => spellTip(k.id, ctx, { hint: v.legal.outOfCombat ? 'Drag onto the action bar (slots 1–7). The bar order is also the autoplay priority.' : 'Bar changes only out of combat' }));
        dragSource(row, ctx, () => (v.legal.outOfCombat ? { kind: 'spell', id: k.id, icon: spellIcon(k.id, sp) } : null));
        return row;
      }));
      const unknown = Object.values(d.spells).filter((s) => s.cls === p.classId && !(s.fx && (s.fx.meta || s.fx.talent)) && !p.spells.some((k) => k.id === s.id));
      const next = unknown.sort((a, b) => a.lvl - b.lvl).slice(0, 3);
      return frame('spellbook', 'Spellbook', `${p.spells.length} spells known · 7 bar slots`, h('div', list, next.length ? h('div.muted', { style: { padding: '0 1.4rem 1.2rem', fontSize: '1.15rem' } }, `Next at a trainer: ${next.map((s) => `${s.name} (${s.lvl})`).join(', ')}`) : null));
    },
    talents(v) {
      const p = v.player; const d = ctx.data; const cls = d.classes[p.classId];
      const L = v.legal.talents || {};
      const trees = h('div.trees');
      for (const [treeId, treeName] of cls.trees) {
        const bgc = TREE_BG[treeId] || ['#2a2a2a', '#0a0a0a'];
        const spent = (p.talentSpent || {})[treeId] || 0;
        const tiers = h('div.tiers');
        for (let tier = 1; tier <= 5; tier++) {
          const row = h('div.tier', h('span.gate', tier > 1 ? `${(tier - 1) * 4}` : ''));
          for (const t of Object.values(d.talents).filter((x) => x.tree === treeId && x.tier === tier)) {
            const st = L[t.id] || { rank: p.talents[t.id] || 0 };
            const rank = p.talents[t.id] || 0;
            const cls2 = rank >= t.ranks ? '.max' : st.canSpend ? '.can' + (rank ? '.some' : '') : st.locked ? '.locked' : rank ? '.some' : '';
            const el = h('div.tal' + cls2, h('img', { src: talentIcon(t), alt: '' }), h('span.rk', `${rank}/${t.ranks}`));
            tip(el, () => talentTip(t, L[t.id], ctx));
            el.addEventListener('click', () => { if (st.canSpend) ctx.act({ type: 'SPEND_TALENT', talentId: t.id }); });
            row.appendChild(el);
          }
          tiers.appendChild(row);
        }
        trees.appendChild(h('div.tree', { style: { background: `radial-gradient(ellipse at 50% 0%, ${bgc[0]}, ${bgc[1]} 80%)` } }, h('div.th', h('div.title', treeName), h('div.dim', `${spent} points`)), tiers));
      }
      const foot = h('div.talfoot', h('span', 'Unspent points: ', h('b', String(p.talentPoints))), h('span.muted', p.level < 10 ? 'Talents unlock at level 10.' : 'One point every 2 levels. Reset at a trainer.'));
      return frame('talents', 'Talents', `${p.className} · level ${p.level}`, h('div', trees, foot));
    },
    questlog(v) {
      const z = v.zone; const n = v.node;
      const body = h('div.col', { style: { padding: '1.2rem 1.6rem 1.6rem' } });
      if (n && n.type === 'quest') body.appendChild(h('div', h('div.title', { style: { fontSize: '1.6rem' } }, n.title), h('div.dim', n.text)));
      else body.appendChild(h('div.muted', 'No active quest. Quests are taken at quest nodes on the zone map.'));
      const sq = ctx.data.rules.storyQuests;
      if (z) body.appendChild(h('div', h('div.title', { style: { fontSize: '1.5rem', marginTop: '.6rem' } }, `${z.name}: story`), h('div.dim', `Complete ${sq} quests in this zone for a rare reward and bonus experience. Done: ${Math.min(sq, z.questsDone)} / ${sq}${z.storyDone ? ' (finished)' : ''}.`)));
      return frame('questlog', 'Quest log', null, body);
    },
    settings() {
      const s = settings.all();
      const seg = (key, opts) => {
        const el = h('div.seg', opts.map(([val, label]) => { const b = h('button' + (s[key] === val ? '.on' : ''), label); b.addEventListener('click', () => { settings.set(key, val); refresh('settings'); }); return b; }));
        return el;
      };
      // reduceMotion shows what is in force (the system's setting until the player chooses)
      const on = (key) => (key === 'reduceMotion' ? settings.reduceMotion : !!s[key]);
      const LABEL = { speedrun: 'Speedrun mode', skipTravel: 'Skip travel scenes', shake: 'Screen shake', reduceMotion: 'Reduce motion', showLog: 'Combat log', devTools: 'Dev tools' };
      const tog = (key) => { const b = h('div.toggle' + (on(key) ? '.on' : ''), { role: 'switch', 'aria-checked': on(key) ? 'true' : 'false', 'aria-label': LABEL[key] || key }, h('div.sw')); b.addEventListener('click', () => { settings.set(key, !on(key)); refresh('settings'); }); return b; };
      const body = h('div.col', { style: { padding: '1rem 1.6rem 1.6rem', gap: 0 } },
        h('div.setrow', h('div', h('div', 'Animation speed'), h('div.muted', 'Space or a click skips to the end of the hit on screen. A key pressed while a round plays is queued as your next action.')), seg('speed', [[1, '1×'], [2, '2×'], [4, '4×'], [0, 'Instant']])),
        h('div.setrow', h('div', h('div', 'Speedrun mode'), h('div.muted', 'Instant animations, no travel scenes, fast autoplay.')), tog('speedrun')),
        h('div.setrow', h('div', 'Skip travel scenes'), tog('skipTravel')),
        h('div.setrow', h('div', h('div', 'Autoplay pace'), h('div.muted', 'Pause between autoplay rounds.')), seg('autoDelay', [[700, 'Calm'], [350, 'Normal'], [120, 'Quick'], [40, 'Rush']])),
        h('div.setrow', h('div', 'Screen shake'), tog('shake')),
        h('div.setrow', h('div', h('div', 'Reduce motion'), h('div.muted', 'No screen shake, smaller recoil, numbers without the slam.')), tog('reduceMotion')),
        h('div.setrow', h('div', 'Combat log'), tog('showLog')),
        // the Dev menu (dev-menu.js): hidden for good with ?dev=0 and with the mock engine
        flags.dev && ctx.bridge.mode === 'engine' ? h('div.setrow', h('div', h('div', 'Dev tools'), h('div.muted', 'The DEV button in the corner and the ` key: start anywhere, jump to the boss, any fight.')), tog('devTools')) : null,
        h('div', { style: { marginTop: '1.2rem' } }, h('div.title', { style: { fontSize: '1.5rem', marginBottom: '.6rem' } }, 'Keys'),
          h('div.keys', h('span.kbd', '1–7'), 'Spells', h('span.kbd', '8 9 0'), 'Items', h('span.kbd', 'A'), 'Basic attack', h('span.kbd', 'Tab'), 'Next target',
            h('span.kbd', 'Z'), 'Autoplay', h('span.kbd', 'F F'), 'Flee', h('span.kbd', 'X'), 'Pass', h('span.kbd', 'Space'), 'Skip a hit / take loot',
            h('span.kbd', 'C B P'), 'Character, bags, spells', h('span.kbd', 'N L M'), 'Talents, quests, map')),
        h('div.muted', { style: { marginTop: '1.2rem', fontSize: '1.1rem' } }, `Engine: ${ctx.bridge.mode}${globalThis.__BUILD__ ? ` · build ${globalThis.__BUILD__}` : ''}`));
      return frame('settings', 'Menu and settings', null, body);
    },
    map(v) {
      if (!v.zone || !v.zone.rows || !v.zone.rows.length) return frame('map', 'Map', null, h('div.muted', { style: { padding: '2rem' } }, 'No zone map here.'));
      const el = buildMap(v, ctx, true);
      el.classList.add('win');
      return el;
    },
  };

  function quick(it) {
    if (it.kind === 'gear') ctx.act({ type: 'EQUIP', uid: it.uid });
    else if (it.kind === 'consumable') ctx.act({ type: 'USE_ITEM', uid: it.uid });
  }
  function menu(e, it, v) {
    closeMenu();
    const items = [];
    const ooc = v.legal.outOfCombat;
    if (it.kind === 'gear') items.push(['Equip', ooc, () => ctx.act({ type: 'EQUIP', uid: it.uid })]);
    if (it.kind === 'consumable') {
      const c = ctx.data.consumables[it.id];
      if (c && (c.use === 'out' || c.use === 'both')) items.push(['Use', ooc, () => ctx.act({ type: 'USE_ITEM', uid: it.uid })]);
      if (c && (c.use === 'combat' || c.use === 'both')) {
        for (let s = 0; s < 3; s++) items.push([`Put on item slot ${['8', '9', '0'][s]}`, ooc, () => ctx.act({ type: 'SET_ITEM_BAR', slot: s, itemId: it.id })]);
      }
    }
    items.push(['Discard', ooc, () => ctx.act({ type: 'DISCARD', uid: it.uid })]);
    ctxMenu = h('div.ctxmenu.panel', items.map(([label, ok, fn]) => { const b = h('button', label); b.disabled = !ok; b.addEventListener('click', () => { closeMenu(); fn(); }); return b; }));
    ctxMenu.style.left = `${e.clientX}px`; ctxMenu.style.top = `${e.clientY}px`;
    document.body.appendChild(ctxMenu);
    // keep the whole menu inside the window: its size grows with the UI scale and the number of entries
    const r = ctxMenu.getBoundingClientRect(); const pad = 6;
    ctxMenu.style.left = `${Math.max(pad, Math.min(e.clientX, window.innerWidth - r.width - pad))}px`;
    ctxMenu.style.top = `${Math.max(pad, Math.min(e.clientY, window.innerHeight - r.height - pad))}px`;
    setTimeout(() => window.addEventListener('pointerdown', onAway), 0);
  }
  function onAway(e) { if (ctxMenu && !ctxMenu.contains(e.target)) closeMenu(); }
  function closeMenu() { if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; window.removeEventListener('pointerdown', onAway); } }

  function render(name) {
    const v = ctx.view; if (!v.player && name !== 'settings') return null;
    const el = builders[name](v);
    const old = open.get(name);
    if (old) old.replaceWith(el); else layer.appendChild(el);
    open.set(name, el);
    return el;
  }
  function refresh(name) { if (open.has(name)) render(name); }
  function toggle(name) { if (open.has(name)) close(name); else openWin(name); }
  function openWin(name) {
    if (!builders[name]) return;
    if (name === 'talents' || name === 'settings' || name === 'map') for (const n of ['talents', 'settings', 'map']) if (n !== name) close(n);
    if (name === 'character' || name === 'spellbook' || name === 'questlog') for (const n of ['character', 'spellbook', 'questlog']) if (n !== name) close(n);
    render(name);
  }
  function close(name) { const el = open.get(name); if (el) { el.remove(); open.delete(name); } closeMenu(); }
  function closeAll() { for (const n of [...open.keys()]) close(n); }
  function update() { for (const n of open.keys()) render(n); }
  return { toggle, open: openWin, close, closeAll, update, isOpen: (n) => open.has(n), anyOpen: () => open.size > 0 };
}
