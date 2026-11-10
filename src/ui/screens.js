// Centre screens by phase: class select, hub/camp, zone map, node dialogs, loot, quest rewards,
// vendor, trainer, shrine, rest, treasure and the run summary. Every button sends an action.
import { h, add, clear, fmtNum, moneyEl, moneyText, hoursText, clamp } from './util.js';
import { spellIcon, itemIcon, nodeIcon, icon, consumableIcon } from './art-icons.js';
import { drawPortrait, HERO_LOOKS, PET_LOOKS } from './art-actors.js';
import { tip, itemTip, spellTip } from './tooltip.js';
import { conColor, heroPortrait, travelState } from './hud.js';
import { numWord, plural, dangerAt, pct1 } from './ui-text.js';
import { createMeta, buildOaths, echoAmt } from './meta.js';

const NODE_NAME = { quest: 'Quest', grind: 'Grind', elite: 'Elite', dungeon: 'Dungeon', rest: 'Rest', vendor: 'Vendor', trainer: 'Trainer', treasure: 'Treasure', shrine: 'Shrine' };
const NO_FIGHT = new Set(['rest', 'vendor', 'trainer', 'shrine']); // nodes that hold no fight: labels in a neutral colour
const NEUTRAL = '#f0e0c0';
/** "Skulker, 2 × Caster" from one name per enemy. */
function nameGroups(names) {
  const counts = new Map();
  for (const nm of names) counts.set(nm, (counts.get(nm) || 0) + 1);
  return [...counts.entries()].map(([nm, k]) => (k > 1 ? `${k} × ${nm}` : nm)).join(', ');
}
/** What a node holds, in words; counts and offsets from the rules table (ctx.data.rules, the engine's constants). */
function nodeDesc(type, r) {
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  switch (type) {
    case 'quest': return `A quest giver needs help. One fight, then experience, gold and a choice of two rewards. ${cap(numWord(r.storyQuests))} quests in a zone complete its story.`;
    case 'grind': return `Fight 1 to ${r.grindMaxWaves} waves of ${numWord(r.grindWaveSize)} enemies. Steady experience, gold and more drops.`;
    case 'elite': return `One powerful enemy, ${numWord(r.eliteLevelOffset)} ${plural(r.eliteLevelOffset, 'level')} higher. High experience and a guaranteed good item.`;
    case 'dungeon': return `${cap(numWord(r.dungeonTrashFights))} fights and a dungeon boss. The best loot in the zone, and the most dangerous node.`;
    case 'rest': return 'Full health and mana, and rested experience: kills give double XP until it runs out.';
    case 'vendor': return 'Buy potions, rations and gear; sell junk and old equipment.';
    case 'trainer': return 'Learn new spells and train known ones to your level.';
    case 'treasure': return 'A chest with gold and an item. It may be guarded or trapped.';
    case 'shrine': return 'Choose one of two blessings.';
    default: return '';
  }
}

export function createScreens(root, ctx) {
  const layer = h('div#screens');
  root.appendChild(layer);
  let cur = { key: null, el: null };
  let createEl = null;
  // the Hall of Echoes lies over class select while it is open (meta.js); it is not one of the mounted screens
  const meta = createMeta(ctx);
  layer.appendChild(meta.el);

  function mount(key, build) {
    if (cur.key === key && cur.el) return cur.el;
    if (cur.el) cur.el.remove();
    const el = build();
    cur = { key, el };
    if (el) layer.appendChild(el);
    return el;
  }

  function update(v) {
    meta.sync(v);
    if (ctx.ui.overlay) { mount('overlay', () => null); return; }
    const p = v.player;
    if (v.phase === 'CREATE') { mount('create', () => (createEl = buildCreate(ctx))); updateCreate(createEl, v, ctx); return; }
    if (v.phase === 'SUMMARY') { mount('summary:' + (v.summary ? v.summary.seed + v.summary.outcome : ''), () => buildSummary(v, ctx)); return; }
    if (v.loot) { mount('loot:' + lootKey(v), () => (v.loot.kind === 'loot' ? buildLoot(v, ctx) : buildReward(v, ctx))); return; }
    const n = v.node;
    if ((v.phase === 'ZONE_HUB' || v.phase === 'CAMP') && n && n.origin === 'hub') { mount(`svc:${n.type}:${svcKey(v)}`, () => (n.type === 'trainer' ? buildTrainer(v, ctx) : buildVendor(v, ctx))); return; }
    if (v.phase === 'ZONE_HUB') { mount('hub:' + JSON.stringify(v.hub) + (p && p.talentPoints), () => buildHub(v, ctx)); return; }
    if (v.phase === 'CAMP') { mount('camp:' + JSON.stringify(v.hub) + v.hours + (p && p.level), () => buildCamp(v, ctx)); return; }
    if (v.phase === 'MAP') { mount('map:' + mapKey(v), () => buildMap(v, ctx, false)); return; }
    if (v.phase === 'NODE' && n) {
      if (n.step === 'combat' || (v.combat && !v.combat.over)) { mount('combat', () => null); return; }
      if (n.type === 'vendor') { mount('vendor:' + svcKey(v), () => buildVendor(v, ctx)); return; }
      if (n.type === 'trainer') { mount('trainer:' + svcKey(v), () => buildTrainer(v, ctx)); return; }
      mount(`node:${n.type}:${n.step}:${n.row}:${n.lane}:${n.fightNo}`, () => buildNode(v, ctx));
      return;
    }
    mount('none', () => null);
  }
  return { update, layer, meta, refresh() { cur.key = null; } };
}

const lootKey = (v) => `${v.loot.kind}|${v.loot.title}|${(v.loot.items || v.loot.choices || []).map((i) => i.uid).join(',')}|${v.player.bag.filter(Boolean).length}`;
const svcKey = (v) => `${v.player.gold}|${v.player.bag.map((s) => (s ? s.uid + ':' + (s.count || 1) : '-')).join(',')}|${v.player.spells.map((s) => s.id + s.tl).join(',')}|${v.player.talentPoints}|${(v.node.stock || []).length}`;
const mapKey = (v) => `${v.zone.idx}|${v.zone.pos.row}|${v.zone.pos.lane}|${v.player.level}|${v.legal.travelOn}|${v.hours}`;

// ------------------------------------------------------------------ class select
function buildCreate(ctx) {
  const d = ctx.data;
  const root = h('div#create');
  root.appendChild(h('div.ctitle', h('div.t1', 'A classic fantasy roguelike'), h('div.t2', 'Choose your hero'), h('div.t3', `Level from 1 to ${d.rules.maxLevel} across ${numWord(d.rules.zoneCount)} zones, then face Oruvath, the Unlit Star.`)));
  const classes = h('div.classes');
  for (const id of ['rogue', 'mage', 'hunter']) {
    const c = d.classes[id];
    const cv = heroPortrait(id);
    const card = h('div.ccard.panel', { dataset: { cls: id }, style: { '--cc': c.color } }, cv, h('div', h('div.cn', { style: { color: c.color } }, c.name), h('div.cr', c.role)));
    card.addEventListener('click', () => ctx.act({ type: 'SELECT_CLASS', classId: id }));
    classes.appendChild(card);
  }
  classes.appendChild(h('div.oathslot')); // Oaths (rules 11.5) once the profile owns them; filled by updateCreate
  const details = h('div.details.panel', h('div.wtitle', h('div.title.dname'), h('div.subtitle.drole')), h('div.body'));
  const name = h('input', { type: 'text', maxLength: 16, placeholder: 'Your name', spellcheck: false, 'aria-label': 'Character name' });
  name.addEventListener('change', () => { if (ctx.view.phase === 'CREATE') ctx.act({ type: 'SET_NAME', name: name.value }); });
  name.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { ctx.act({ type: 'SET_NAME', name: name.value }); name.blur(); } });
  const seed = h('input.seed', { type: 'text', placeholder: 'random', inputMode: 'numeric', 'aria-label': 'Run seed' });
  seed.addEventListener('keydown', (e) => e.stopPropagation());
  seed.addEventListener('change', () => { if (ctx.view.phase === 'CREATE') ctx.act({ type: 'SET_SEED', seed: seed.value.trim() === '' ? null : seed.value.replace(/\D/g, '') }); });
  const go = h('button.btn.primary.big', 'Enter the world');
  go.addEventListener('click', async () => {
    name.blur(); seed.blur();
    if (name.value) await ctx.act({ type: 'SET_NAME', name: name.value });
    if (seed.value.trim()) await ctx.act({ type: 'SET_SEED', seed: seed.value.replace(/\D/g, '') });
    ctx.act({ type: 'START_RUN' });
  });
  // Hall of Echoes (meta progression, rules 11): engine mode only (the mock has no profile)
  let echoes = null;
  if (d.meta) {
    echoes = h('button.btn.echoes', { type: 'button', 'aria-label': 'Echoes' }, h('i.eg'), h('b.n', '0'), h('span.l', 'Echoes'), h('span.badge.hidden'));
    echoes.addEventListener('click', () => { name.blur(); seed.blur(); ctx.ui.openMeta(); });
    tip(echoes, () => {
      const m = ctx.view.meta; if (!m) return null;
      const reach = m.offers.filter((o) => o.affordable).length;
      return h('div', h('div.tt-name', 'Hall of Echoes'), h('div.tt-line.desc', 'Spend Echoes on lasting unlocks: stats, items in the drop pools, skills and more.'),
        h('div.tt-line.num', `${fmtNum(m.echoes)} Echoes · ${numWord(reach)} ${plural(reach, 'unlock')} within reach`), h('div.tt-hint', 'Click to open'));
    });
  }
  root.append(classes, details, h('div.bottom.panel', h('div.field', h('label', 'Name'), name), h('div.field', h('label', 'Seed'), seed), echoes, go));
  return root;
}

function updateCreate(root, v, ctx) {
  const d = ctx.data; const c = v.create; const cls = d.classes[c.classId];
  root.querySelectorAll('.ccard').forEach((el) => el.classList.toggle('sel', el.dataset.cls === c.classId));
  const m = v.meta;
  // Echoes button: the balance and how many unlocks it can buy (the engine's offers)
  const eb = root.querySelector('.bottom .echoes');
  if (eb && m) {
    eb.querySelector('.n').textContent = fmtNum(m.echoes);
    const reach = m.offers.filter((o) => o.affordable).length; const badge = eb.querySelector('.badge');
    badge.textContent = String(reach); badge.classList.toggle('hidden', !reach);
  }
  // Oaths (rules 11.5): only when the profile owns them (SET_OATH is legal)
  const slot = root.querySelector('.oathslot');
  const okey = m && m.oathsOwned ? JSON.stringify([c.oaths, m.next && m.next.oathMult]) : '';
  if (slot && slot.dataset.key !== okey) { slot.dataset.key = okey; clear(slot); if (okey) slot.appendChild(buildOaths(v, ctx)); }
  const det = root.querySelector('.details');
  // pets that need an unlock (Stormhawk) open after a purchase: part of the key
  const key = `${c.classId}|${c.petId}|${Object.values(d.pets).map((pd) => (pd.locked ? 1 : 0)).join('')}`;
  if (det.dataset.key === key) return;
  det.dataset.key = key;
  det.querySelector('.dname').textContent = cls.name;
  det.querySelector('.dname').style.color = cls.color;
  det.querySelector('.drole').textContent = cls.role;
  const body = clear(det.querySelector('.body'));
  body.appendChild(h('div.blurb', cls.blurb));
  body.appendChild(h('dl.kv', h('dt', 'Resource'), h('dd', { energy: 'Energy and combo points', mana: 'Mana', focus: 'Focus, plus a pet' }[cls.resource]), h('dt', 'Basic attack'), h('dd', cls.basic.name), h('dt', 'Primary stat'), h('dd', cls.primary === 'agi' ? 'Agility' : 'Intellect')));
  const starts = Object.values(d.spells).filter((s) => s.cls === c.classId && s.lvl === 1 && !(s.fx && (s.fx.meta || s.fx.talent)));
  body.appendChild(h('div', h('div.subtitle', { style: { marginBottom: '.5rem' } }, 'Starting spells'), h('div.startspells', starts.map((s) => tip(h('div.sp', h('img', { src: spellIcon(s.id, s), alt: '' }), s.name), () => h('div', h('div.tt-name', s.name), h('div.tt-line.desc', s.text)))))));
  if (c.classId === 'hunter') {
    const pets = h('div.pets');
    for (const [id, pd] of Object.entries(d.pets)) {
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 120;
      drawPortrait(cv.getContext('2d'), 120, PET_LOOKS[id], 'beast', { bg1: '#2e3a26' });
      const el = h('div.pet' + (c.petId === id ? '.sel' : '') + (pd.locked ? '.locked' : ''), cv, h('div.pn', pd.name));
      const unlockName = pd.meta && d.meta && d.meta.entries[pd.meta] ? d.meta.entries[pd.meta].name : null;
      tip(el, () => h('div', h('div.tt-name', pd.name), h('div.tt-line.desc', pd.text), pd.locked ? h('div.tt-warn', unlockName ? `Unlock it with ${unlockName} in the Hall of Echoes.` : 'Unlocked with meta progression') : null));
      if (!pd.locked) el.addEventListener('click', () => ctx.act({ type: 'SELECT_PET', petId: id }));
      pets.appendChild(el);
    }
    body.appendChild(h('div', h('div.subtitle', { style: { marginBottom: '.5rem' } }, 'Companion'), pets));
  }
}

// ------------------------------------------------------------------ hub & camp
function svcCard(glyph, bg, name, meta, hours, used, onClick) {
  const el = h('div.svc-card' + (used ? '.used' : ''), h('img', { src: icon(glyph, bg), alt: '' }), h('div', h('div.nm', name), h('div.meta', used ? 'Used this visit' : meta)), h('div.hrs', hours));
  if (!used) el.addEventListener('click', onClick);
  return el;
}

function buildHub(v, ctx) {
  const z = v.zone; const p = v.player; const used = (v.hub && v.hub.used) || {}; const hr = ctx.data.rules.hours;
  const el = h('div.side.panel');
  el.append(h('div.wtitle', h('div', h('div.title', { style: { fontSize: '2.4rem' } }, z.hubName), h('div.subtitle', `${z.name} · levels ${z.band[0]}–${z.band[1]}`))));
  const body = h('div.body.col', { style: { padding: '1.2rem 1.6rem 1.6rem', gap: '.8rem' } });
  if (z.hubText || z.blurb) body.appendChild(h('div', { style: { font: 'italic 1.4rem var(--font-title)', color: 'var(--ink-dim)', marginBottom: '.4rem' } }, z.hubText || z.blurb));
  body.append(
    svcCard('tome', 'arcane', 'Trainer', 'Learn and rank up spells', `${hr.trainer} h`, used.trainer, () => ctx.act({ type: 'HUB_SERVICE', service: 'trainer' })),
    svcCard('vendor', 'earth', 'Vendor', 'Potions, rations and gear', `${hr.vendor} h`, used.vendor, () => ctx.act({ type: 'HUB_SERVICE', service: 'vendor' })),
    svcCard('rest', 'fire', 'Inn', 'Full rest and rested experience', `${hr.inn} h`, used.inn, () => ctx.act({ type: 'HUB_SERVICE', service: 'inn' })));
  if (p.talentPoints) body.appendChild(h('div.warn', { style: { fontSize: '1.25rem' } }, `You have ${p.talentPoints} unspent talent point${p.talentPoints > 1 ? 's' : ''}. Press N.`));
  const go = h('button.btn.primary.big', 'Set out');
  go.addEventListener('click', () => ctx.act({ type: 'LEAVE_HUB' }));
  el.append(body, h('div.sfoot', h('span.muted', `Day clock: ${v.hours} h`), go));
  return el;
}

function buildCamp(v, ctx) {
  const z = v.zone; const used = (v.hub && v.hub.used) || {}; const R = ctx.data.rules; const hr = R.hours;
  const asc = v.camp ? v.camp.asc : null; // the engine's Ascendancy if the boss were faced now
  const el = h('div.side.panel');
  el.append(h('div.wtitle', h('div', h('div.title', { style: { fontSize: '2.4rem' } }, z.hubName), h('div.subtitle', `${z.name} · the final camp`))));
  const body = h('div.body.col', { style: { padding: '1rem 1.6rem 1.2rem', gap: '.6rem' } });
  body.appendChild(h('div', { style: { font: 'italic 1.4rem var(--font-title)', color: 'var(--ink-dim)' } }, z.blurb || ''));
  body.append(
    svcCard('tome', 'arcane', 'Trainer', 'Last chance to train', `${hr.trainer} h`, used.trainer, () => ctx.act({ type: 'HUB_SERVICE', service: 'trainer' })),
    svcCard('vendor', 'earth', 'Quartermaster', `Level ${R.maxLevel} stock`, `${hr.vendor} h`, used.vendor, () => ctx.act({ type: 'HUB_SERVICE', service: 'vendor' })),
    svcCard('rest', 'fire', 'Campfire', 'Full rest before the fight', `${hr.inn} h`, used.inn, () => ctx.act({ type: 'HUB_SERVICE', service: 'inn' })),
    svcCard('grind', 'steel', 'Camp wave', `Fight a wave of level ${R.campGrindLevel} enemies`, `${hr.grindWave} h`, false, () => ctx.act({ type: 'CAMP_GRIND' })));
  const par = v.camp && v.camp.par ? ` (par ${v.camp.par} h)` : '';
  const kv = h('dl.kv', h('dt', 'Time'), h('dd', `${v.hours} h${par}`), h('dt', 'Ascendancy'),
    asc == null ? h('dd.muted', 'Unknown') : h('dd', { class: asc > 0 ? 'bad' : 'good' }, asc > 0 ? `+${Math.round(asc * 100)} % health and damage` : 'None: you are on time'));
  const go = h('button.btn.primary.big', 'Face Oruvath');
  go.addEventListener('click', () => ctx.act({ type: 'FIGHT_BOSS' }));
  el.append(body, h('div.sfoot', kv, go));
  return el;
}

// ------------------------------------------------------------------ zone map
export function buildMap(v, ctx, readOnly) {
  const z = v.zone; const p = v.player; const L = v.legal || {};
  const win = h('div.mapwin.panel');
  const nextName = z.idx < ctx.data.rules.zoneCount ? 'the next zone' : 'the camp';
  const ts = travelState(v);
  const label = { done: 'Travel on (zone done)', open: 'Travel on', early: 'Travel on early', locked: `Travel on at level ${ts.need}` }[ts.kind];
  const travel = h('button.btn' + (L.travelOn ? '.primary' : ''), { dataset: { travel: ts.kind } }, label);
  travel.disabled = !L.travelOn || readOnly;
  travel.addEventListener('click', () => ctx.act({ type: 'TRAVEL_ON' }));
  tip(travel, () => h('div', h('div.tt-name', 'Travel on'),
    h('div.tt-line.desc', `Leave ${z.name} for ${nextName}.${travelCost(z, ctx)} Leaving early skips the remaining rows: fewer hours, but less loot and gold.`),
    h('div.tt-line', ts.under > 0 ? `Open from level ${ts.need}, ${numWord(ts.under)} ${plural(ts.under, 'level')} below the exit level ${ts.exit}, or after row ${ts.rows}.` : `Open from level ${ts.exit}, or after row ${ts.rows}.`),
    ts.kind === 'locked' ? h('div.tt-warn', `Reach level ${ts.need} or finish row ${ts.rows} first (you are level ${p.level}).`) : null,
    ts.kind === 'early' ? h('div.tt-warn', `You are under the exit level (${ts.exit}): the next zone starts above your level. More risk, more experience.`) : null,
    ts.kind === 'done' ? h('div.tt-hint', `Row ${ts.rows} is done: the road leads on.`) : null));
  const head = h('div.mhead', h('div', h('div.title', z.name), h('div.subtitle', `Levels ${z.band[0]}–${z.band[1]} · ${z.blurb || ''}`)), h('div.row', readOnly ? closeBtn(ctx, 'map') : null, readOnly ? null : travel));
  const body = h('div.mbody.parchment');
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000'); svg.setAttribute('preserveAspectRatio', 'none');
  body.appendChild(svg);
  // horizontal: hub on the left, the last row on the right; lanes top to bottom. Rows and lanes as the engine's map has them.
  const ROWS = z.rows.length; const LANES = ROWS ? z.rows[0].length : 0;
  const PX = (r) => 60 + (r * 880) / Math.max(1, ROWS); const PY = (l) => (LANES > 1 ? 200 + (l * 600) / (LANES - 1) : 500);
  const mid = (LANES - 1) / 2; // the hub sits level with the middle lane
  const line = (x1, y1, x2, y2, cls) => {
    const ln = document.createElementNS(svgNS, 'line');
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    const st = { base: ['#7a5a30', 3, '10 12', 0.55], path: ['#9a2a1a', 6, '', 0.9], reach: ['#c8901a', 5, '2 10', 0.95] }[cls];
    ln.setAttribute('stroke', st[0]); ln.setAttribute('stroke-width', st[1]); ln.setAttribute('stroke-linecap', 'round'); ln.setAttribute('vector-effect', 'non-scaling-stroke');
    if (st[2]) ln.setAttribute('stroke-dasharray', st[2]); ln.setAttribute('opacity', st[3]);
    svg.appendChild(ln);
  };
  const path = z.path || [];
  const onPath = (r1, l1, r2, l2) => path.some((pp, i) => pp.row === r2 && pp.lane === l2 && (r1 === 0 ? i === 0 : path[i - 1] && path[i - 1].row === r1 && path[i - 1].lane === l1));
  const reachable = new Set(readOnly ? [] : (L.lanes || []).map((l) => `${z.pos.row + 1}:${l}`));
  for (let l = 0; l < LANES; l++) line(PX(0), PY(mid), PX(1), PY(l), onPath(0, null, 1, l) ? 'path' : z.pos.row === 0 && reachable.has(`1:${l}`) ? 'reach' : 'base');
  for (let r = 1; r < ROWS; r++) for (let l = 0; l < LANES; l++) for (const nl of [l - 1, l, l + 1]) {
    if (nl < 0 || nl >= LANES) continue;
    const cls = onPath(r, l, r + 1, nl) ? 'path' : (z.pos.row === r && z.pos.lane === l && reachable.has(`${r + 1}:${nl}`)) ? 'reach' : 'base';
    line(PX(r), PY(l), PX(r + 1), PY(nl), cls);
  }
  // hub node
  const hub = h('div.mnode.hubnode' + (z.pos.row === 0 ? '.here' : '.visited'), { style: { left: `${PX(0) / 10}%`, top: `${PY(mid) / 10}%` } }, h('div.ring', h('img', { src: nodeIcon('hub'), alt: '' })), h('div.cl', { style: { color: '#f0e0c0' } }, 'Hub'));
  tip(hub, () => h('div.tt-node', h('div.tt-name', z.hubName), h('div.tt-sub', 'Zone hub: trainer, vendor and inn')));
  body.appendChild(hub);
  for (let r = 1; r <= ROWS; r++) for (let l = 0; l < LANES; l++) {
    const n = z.rows[r - 1][l];
    const reach = reachable.has(`${r}:${l}`);
    const here = z.pos.row === r && z.pos.lane === l;
    const closed = !n.visited && !reach && r <= z.pos.row;
    const el = h('button.mnode' + (reach ? '.reach' : '') + (n.visited ? '.visited' : '') + (here ? '.here' : '') + (closed ? '.closed' : ''), { style: { left: `${PX(r) / 10}%`, top: `${PY(l) / 10}%` }, 'aria-label': `${NODE_NAME[n.type]} level ${n.cl}`, dataset: { row: r, lane: l } },
      h('div.ring', h('img', { src: nodeIcon(n.type), alt: '' })), h('div.cl', { style: { color: NO_FIGHT.has(n.type) ? NEUTRAL : conColor(n.cl, p.level) } }, NO_FIGHT.has(n.type) ? NODE_NAME[n.type] : `${NODE_NAME[n.type]} ${n.cl}`));
    if (here) el.appendChild(flagSvg());
    if (reach) el.addEventListener('click', () => ctx.act({ type: 'CHOOSE_NODE', lane: l }));
    tip(el, () => nodeTip(n, v, ctx, reach));
    body.appendChild(el);
  }
  const legend = h('div.mlegend', Object.keys(NODE_NAME).map((t) => h('span', h('img', { src: nodeIcon(t), alt: '' }), NODE_NAME[t])));
  // row ruler
  for (let r = 1; r <= ROWS; r++) body.appendChild(h('div.mrow', { style: { left: `${PX(r) / 10}%` } }, `${r}`));
  const sq = ctx.data.rules.storyQuests;
  const story = h('div.dim', { style: { fontSize: '1.2rem', whiteSpace: 'nowrap' } }, `Story ${Math.min(sq, z.questsDone)}/${sq} · ${v.hours} h`);
  win.append(head, body, h('div.mfoot', legend, story));
  if (readOnly) win.id = 'win-map';
  return win;
}
/** The hours Travel on costs now, from the engine (a dry TRAVEL_ON; meta Wayfinder makes it 0); the mock's own number in mock mode. */
function travelCost(z, ctx) {
  const hrs = z.travelHours !== undefined ? z.travelHours : ctx.data.rules.hours.travel;
  const why = ctx.data.meta && ctx.data.meta.entries.wayfinder ? ` (${ctx.data.meta.entries.wayfinder.name})` : '';
  return hrs == null ? '' : hrs > 0 ? ` Costs ${hrs} h.` : ` Costs no time${why}.`;
}
function flagSvg() {
  const d = h('div.flagm');
  d.innerHTML = '<svg viewBox="0 0 24 30" width="100%" height="100%"><rect x="3" y="2" width="2.4" height="27" fill="#3a2410"/><path d="M5.4 3 L22 7 L5.4 13 Z" fill="#c0281a" stroke="#4a0a04" stroke-width="1"/></svg>';
  return d;
}
function closeBtn(ctx, win) { const b = h('button.xbtn', '×'); b.addEventListener('click', () => ctx.ui.closeWin(win)); return b; }

/**
 * Zone danger of a fight node (rules 7.6, M2 v3), or null: the extra damage of its enemies, from the rules table.
 * Enemy levels as the engine builds the fights: quest and grind enemies at the node's level; an elite at its own
 * level and its escort (a second enemy) at the node's; dungeon trash at its level and the dungeon boss at its own.
 * With more than one level the line says "up to" the highest.
 */
function nodeDanger(n, r) {
  const levels = n.type === 'quest' || n.type === 'grind' ? [n.cl]
    : n.type === 'elite' ? [n.level ?? n.cl, ...(n.enemyNames && n.enemyNames.length > 1 ? [n.cl] : [])]
      : n.type === 'dungeon' ? [n.level ?? n.cl, n.bossLevel ?? n.cl] : null;
  if (!levels) return null;
  const lo = dangerAt(r, Math.min(...levels)); const hi = dangerAt(r, Math.max(...levels));
  if (!(hi > 0)) return null;
  return `Zone danger: enemies here deal ${hi > lo ? 'up to ' : ''}+${pct1(hi)} damage (above level ${r.dangerFrom}).`;
}

function nodeTip(n, v, ctx, reach) {
  const p = v.player;
  const box = h('div.tt-node');
  box.appendChild(h('div.tt-row', h('div.tt-name', NODE_NAME[n.type] + (n.type === 'elite' && n.rare && n.rareVisible ? ' (rare)' : '')), h('div', { style: { color: NO_FIGHT.has(n.type) ? NEUTRAL : conColor(n.cl, p.level), fontWeight: 800 } }, `Level ${n.cl}`)));
  if (n.type === 'quest') add(box, h('div.tt-line', { style: { color: '#ffd88a', fontWeight: 700 } }, n.title), h('div.tt-sub', `From ${n.giver}`));
  if (n.type === 'elite') add(box, h('div.tt-line', { style: { color: '#ffb08a', fontWeight: 700 } }, n.eliteName || 'An elite'), n.level ? h('div.tt-sub', `Elite level ${n.level}`) : null);
  if (n.type === 'dungeon') add(box, h('div.tt-line', { style: { color: '#c8a8ff', fontWeight: 700 } }, n.dungeon), h('div.tt-sub', `Boss: ${n.bossName}`));
  if (n.enemyNames && n.enemyNames.length) {
    const k = n.enemyNames.length;
    box.appendChild(h('div.tt-line.foes', `${n.type === 'grind' ? 'Wave 1: ' : 'Foes: '}${k} ${k === 1 ? 'enemy' : 'enemies'} (${nameGroups(n.enemyNames)})`));
  }
  box.appendChild(h('div.tt-line.desc', nodeDesc(n.type, ctx.data.rules)));
  const danger = nodeDanger(n, ctx.data.rules);
  if (danger) box.appendChild(h('div.tt-warn.danger', danger));
  const hrs = ctx.data.nodeHours ? ctx.data.nodeHours[n.type] : null;
  if (hrs != null) box.appendChild(h('div.tt-sub', n.type === 'grind' ? `Takes ${hrs} h per wave` : `Takes ${hrs} h`));
  if (n.visited) box.appendChild(h('div.tt-hint', 'Visited'));
  else if (reach) box.appendChild(h('div.tt-hint', 'Click to travel here'));
  else box.appendChild(h('div.tt-warn', 'Not reachable from your position'));
  return box;
}

// ------------------------------------------------------------------ node dialogs
function dialog(title, sub, content, actions, opts = {}) {
  const el = h('div.dialog.panel.rightside' + (opts.cls ? '.' + opts.cls : ''), { style: opts.style || {} },
    h('div.wtitle', h('div', h('div.title', { style: { fontSize: '2.2rem' } }, title), sub ? h('div.subtitle', sub) : null), opts.badge || null),
    h('div.body', content, actions && actions.length ? h('div.actions', actions) : null));
  return el;
}
function btn(label, onClick, cls = '') { const b = h('button.btn' + cls, label); b.addEventListener('click', onClick); return b; }

function foeList(v, list, ctx) {
  const p = v.player;
  const counts = new Map();
  for (const t of list || []) counts.set(t.name, (counts.get(t.name) || 0) + 1);
  return h('div.foes', [...counts.entries()].map(([nm, k]) => h('div.foe', h('span.con', { style: { color: conColor(v.node.cl, p.level) } }, String(v.node.cl)), `${k > 1 ? k + ' × ' : ''}${nm}`)));
}

function buildNode(v, ctx) {
  const n = v.node; const p = v.player;
  const left = 'calc(50% + 12rem)';
  if (n.type === 'quest' && n.step === 'intro') {
    return dialog(n.title, `Quest · level ${n.cl}`, [
      h('div.qtext.parchment', h('div.giver', `${n.giver} says:`), h('div', `“${n.text}”`)),
      h('div.subtitle', 'Enemies'), foeList(v, n.mobs, ctx),
      h('div.dim', { style: { fontSize: '1.2rem' } }, 'Reward: experience, gold and a choice of two items.'),
    ], [btn('Accept', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left });
  }
  if (n.type === 'grind' && n.step === 'intro') {
    const R = ctx.data.rules;
    const w = (k) => btn(`${k} wave${k > 1 ? 's' : ''} · ${k * R.hours.grindWave} h`, () => ctx.act({ type: 'GRIND_SET_WAVES', n: k }), k === 2 ? '.primary' : '');
    const waves = Array.from({ length: R.grindMaxWaves }, (_, i) => w(i + 1));
    return dialog('Grind', `Level ${n.cl}`, [h('div.dim', { style: { fontSize: '1.35rem' } }, nodeDesc('grind', R)), h('div.subtitle', 'Enemies'), foeList(v, n.mobs, ctx), h('div.muted', 'You can stop after any wave.')], waves, { left });
  }
  if (n.type === 'elite' && n.step === 'intro') {
    const e = n.elite || {};
    return dialog(n.eliteName, `${n.rare ? 'Rare elite' : 'Elite'} · level ${n.cl}`, [
      e.text ? h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, e.text) : null,
      h('dl.kv', h('dt', 'Threat'), h('dd.bad', 'High: elites hit hard and have special abilities'), h('dt', 'Reward'), h('dd', 'Large experience, gold and a guaranteed good item'), n.add ? h('dt', 'Escort') : null, n.add ? h('dd', n.add.name) : null),
    ], [btn('Engage', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left, badge: h('span.rank-tag' + (n.rare ? '.rare' : ''), n.rare ? 'Rare' : 'Elite') });
  }
  if (n.type === 'dungeon' && n.step === 'intro') {
    return dialog(n.dungeon, `Dungeon · level ${n.cl}`, [
      n.dungeonText ? h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, n.dungeonText) : null,
      h('dl.kv', h('dt', 'Fights'), h('dd', `${ctx.data.rules.dungeonTrashFights} groups, then ${n.bossName}`), h('dt', 'Between fights'), h('dd', 'You may eat, change gear, or leave with what you have'), h('dt', 'Warning'), h('dd.bad', 'No fleeing from the dungeon boss')),
    ], [btn('Enter the dungeon', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left });
  }
  if (n.type === 'treasure' && n.step === 'intro') {
    return dialog('Treasure', `Level ${n.cl}`, [h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, n.text || ''), h('div.warn', `A guardian watches the chest: ${n.guard ? n.guard.name : 'an enemy'}.`)], [btn('Fight the guardian', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left });
  }
  if (n.type === 'treasure' && n.step === 'chest') {
    return dialog('Treasure', `Level ${n.cl}`, [h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, n.text || 'The chest is yours.')], [btn('Open the chest', () => ctx.act({ type: 'OPEN_CHEST' }), '.primary')], { left });
  }
  if (n.step === 'between') {
    const hpTxt = `Health ${fmtNum(p.hp)} / ${fmtNum(p.maxHp)}${p.res.kind === 'mana' ? ` · Mana ${fmtNum(p.res.cur)} / ${fmtNum(p.res.max)}` : ''}`;
    const rations = p.bag.find((s) => s && s.id === 'trail_rations');
    const eat = rations ? btn(`Eat Trail Rations (${rations.count})`, () => ctx.act({ type: 'USE_ITEM', uid: rations.uid })) : null;
    if (n.type === 'grind') return dialog('Grind', `Wave ${n.waves} of ${n.wavesChosen} done`, [h('div.dim', hpTxt)], [eat, btn('Stop here', () => ctx.act({ type: 'GRIND_STOP' })), btn('Next wave', () => ctx.act({ type: 'CONTINUE' }), '.primary')].filter(Boolean), { left });
    const trash = ctx.data.rules.dungeonTrashFights; // the boss is fight trash + 1
    return dialog(n.dungeon, `Fight ${n.fightNo} of ${trash + 1} cleared`, [h('div.dim', hpTxt), n.fightNo === trash ? h('div.warn', `Next: ${n.bossName}. There is no fleeing from the boss.`) : null],
      [eat, btn('Leave the dungeon', () => ctx.act({ type: 'DUNGEON_LEAVE' })), btn(n.fightNo === trash ? 'Face the boss' : 'Press on', () => ctx.act({ type: 'CONTINUE' }), '.primary')].filter(Boolean), { left });
  }
  if (n.type === 'rest') {
    return dialog('Rest', 'Campfire', [h('div', { style: { font: 'italic 1.5rem var(--font-title)', color: 'var(--ink-dim)' } }, 'You rest by the fire until the ache leaves your bones.'),
      h('dl.kv', h('dt', 'Health'), h('dd.good', 'Full'), h('dt', p.res.kind === 'mana' ? 'Mana' : 'Resource'), h('dd.good', 'Full'), p.pet ? h('dt', 'Pet') : null, p.pet ? h('dd.good', 'Restored') : null, h('dt', 'Rested'), h('dd', { style: { color: '#9fb8ff' } }, `${fmtNum(p.rested)} XP: kills give double experience`))],
    [btn('Continue', () => ctx.act({ type: 'LEAVE' }), '.primary')], { left });
  }
  if (n.type === 'shrine') {
    const cards = h('div.choice-cards', (n.boons || []).map((b, i) => {
      const c = h('div.icard', h('img', { src: icon(boonGlyph(b.id), 'heal'), alt: '' }), h('div', h('div.nm', { style: { color: '#9fe0b0' } }, b.name), h('div.meta', b.text)));
      c.addEventListener('click', () => ctx.act({ type: 'CHOOSE_REWARD', i }));
      return c;
    }));
    return dialog('Shrine', 'Choose one blessing', [h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, n.text || 'An old shrine hums softly.'), cards], [], { left });
  }
  return null;
}
const boonGlyph = (id) => ({ return: 'ember', insight: 'stars3', fury: 'flame', plenty: 'coin', mending: 'cross', clarity: 'tome' }[id] || 'spark');

// ------------------------------------------------------------------ loot & rewards
function buildLoot(v, ctx) {
  const L = v.loot; const p = v.player;
  const win = h('div.loot.panel.rightside');
  win.appendChild(h('div.wtitle', h('div.title', L.title || 'Loot'), closeLootBtn(ctx)));
  const rows = h('div.rows');
  if (L.gold) rows.appendChild(h('div.lrow', { style: { cursor: 'default' } }, h('img', { src: icon('coin', 'gold'), alt: '' }), h('div', h('div.nm', moneyEl(L.gold)), h('div.meta', 'Coins (already in your purse)'))));
  if (L.xp) rows.appendChild(h('div.lrow', { style: { cursor: 'default' } }, h('img', { src: icon('stars3', 'epic'), alt: '' }), h('div', h('div.nm', { style: { color: '#d0a8ff' } }, `${fmtNum(L.xp)} experience`), h('div.meta', 'Earned in this fight'))));
  if (L.trap) rows.appendChild(h('div.lrow', { style: { cursor: 'default' } }, h('img', { src: icon('trap', 'blood'), alt: '' }), h('div', h('div.nm.bad', 'A needle trap!'), h('div.meta', 'You lost some health opening it.'))));
  (L.items || []).forEach((it, i) => {
    const up = it.kind === 'gear' && ctx.bridge.itemScore(it) > ctx.bridge.itemScore(p.equip[it.slot]);
    const meta = it.kind === 'gear' ? `${cap(it.slot)} · ilvl ${it.ilvl}` : it.kind === 'junk' ? 'Junk' : 'Consumable';
    const tag = it.inBag ? h('span.good', ' · in your bags') : up ? h('span.good', ' · ▲ upgrade') : null;
    const r = h('div.lrow.' + (it.rarity || 'common'), h('img', { src: itemIcon(it), alt: '' }), h('div.grow', h('div.nm.r-' + it.rarity, it.name + (it.count > 1 ? ` ×${it.count}` : '')), h('div.meta', meta, tag)));
    if (it.pending) {
      const acts = h('div.row', { style: { gap: '.35rem' } });
      if (it.kind === 'gear') acts.appendChild(miniBtn('Equip', () => ctx.act({ type: 'LOOT_EQUIP', i })));
      acts.appendChild(miniBtn('Take', () => ctx.act({ type: 'LOOT_TAKE', i })));
      acts.appendChild(miniBtn('Drop', () => ctx.act({ type: 'LOOT_DROP', i })));
      r.appendChild(acts);
      r.style.cursor = 'default';
    } else if (!it.inBag) r.addEventListener('click', () => ctx.act({ type: 'LOOT_TAKE', i }));
    else r.style.cursor = 'default';
    tip(r, () => itemTip(it, ctx, { hint: it.pending ? 'Waiting in the loot window: equip, take or drop it' : it.inBag ? 'Already in your bags' : 'Click to take' }));
    rows.appendChild(r);
  });
  if (!(L.items || []).length && !L.gold && !L.xp) rows.appendChild(h('div.muted', { style: { padding: '1rem' } }, 'Nothing of value.'));
  win.appendChild(rows);
  const pending = (L.items || []).filter((it) => it.pending || (!it.inBag && L.items && !('inBag' in it))).length;
  const full = p.bag.every(Boolean) && (L.items || []).some((it) => it.kind === 'gear' && !it.inBag);
  const take = btn(pending ? 'Take all' : 'Continue', () => ctx.act({ type: 'LOOT_TAKE_ALL' }), '.primary');
  take.appendChild(h('span.k', 'Space'));
  win.appendChild(h('div.foot', full ? h('span.warn', 'Bags full: discard (B)') : h('span.muted.nowrap', `Bags ${p.bag.filter(Boolean).length}/${p.bag.length}`), h('div.row', { style: { gap: '.6rem' } }, pending ? btn('Leave', () => ctx.act({ type: 'LOOT_CLOSE' })) : null, take)));
  return win;
}
function miniBtn(label, fn) { const b = h('button.btn.small', label); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; }
function closeLootBtn(ctx) { const b = h('button.xbtn', '×'); b.addEventListener('click', () => ctx.act({ type: 'LOOT_CLOSE' })); return b; }
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function buildReward(v, ctx) {
  const L = v.loot; const p = v.player;
  const cards = h('div.choice-cards', (L.choices || []).map((it, i) => {
    const up = ctx.bridge.itemScore(it) - ctx.bridge.itemScore(p.equip[it.slot]);
    const stats = Object.entries(it.stats || {}).filter(([k, val]) => ['sta', 'agi', 'int', 'spi', 'power'].includes(k) && val > 0).map(([k, val]) => `+${val} ${k.toUpperCase()}`).join('  ');
    const c = h('div.icard', h('img', { src: itemIcon(it), alt: '' }), h('div', h('div.nm.r-' + it.rarity, it.name), h('div.meta', `${cap(it.slot)} · item level ${it.ilvl}`), h('div.stats', stats || ' '), h('div.upg.' + (up > 0 ? 'good' : 'muted'), up > 0 ? `▲ Upgrade (+${Math.round(up * 10) / 10})` : 'Not an upgrade')));
    c.addEventListener('click', () => ctx.act({ type: 'CHOOSE_REWARD', i }));
    tip(c, () => itemTip(it, ctx, { hint: 'Click to choose this reward' }));
    return c;
  }));
  const story = L.kind === 'story';
  return dialog(story ? 'Story complete' : 'Quest complete', L.title, [
    h('div.qtext.parchment', L.giver ? h('div.giver', `${L.giver} says:`) : null, h('div.turnin', `“${L.text}”`)),
    h('div.row', { style: { gap: '2rem' } }, L.xp ? h('span', { style: { color: '#d0a8ff', fontWeight: 700, fontSize: '1.35rem' } }, `+${fmtNum(L.xp)} XP`) : null, L.gold ? h('span', moneyEl(L.gold)) : null),
    h('div.subtitle', story ? 'Choose one rare reward' : 'Choose your reward'), cards,
    p.bag.every(Boolean) ? h('div.warn', 'Your bags are full: discard something first (B).') : null,
  ], [], { style: { width: '60rem' } });
}

// ------------------------------------------------------------------ vendor & trainer
function buildVendor(v, ctx) {
  const n = v.node; const p = v.player;
  const stock = h('div.list', (n.stock || []).map((it, i) => {
    const r = h('div.trow' + (it.sold ? '.locked' : ''), h('img', { src: itemIcon(it), alt: '' }), h('div', h('div.nm.r-' + it.rarity, it.name), h('div.meta', it.kind === 'gear' ? `${cap(it.slot)} · ilvl ${it.ilvl}` : 'Consumable')),
      h('div.right', it.sold ? h('span.muted', 'Sold') : moneyEl(it.price), it.sold ? null : h('button.btn.small' + (p.gold < it.price ? '.disabled' : ''), 'Buy')));
    if (!it.sold) r.querySelector('button').addEventListener('click', () => ctx.act({ type: 'BUY', i }));
    tip(r, () => itemTip(it, ctx, { price: it.price }));
    return r;
  }));
  const bag = h('div.list', p.bag.filter(Boolean).map((it) => {
    const r = h('div.trow', h('img', { src: itemIcon(it), alt: '' }), h('div', h('div.nm.r-' + it.rarity, it.name + (it.count > 1 ? ` ×${it.count}` : '')), h('div.meta', it.sell ? moneyText(it.sell * (it.count || 1)) : it.kind === 'gear' ? `${cap(it.slot)} · ilvl ${it.ilvl}` : it.kind === 'junk' ? 'Junk' : 'Consumable')), h('div.right', h('button.btn.small', 'Sell')));
    r.querySelector('button').addEventListener('click', () => ctx.act({ type: 'SELL', uid: it.uid }));
    tip(r, () => itemTip(it, ctx, {}));
    return r;
  }));
  const hasJunk = p.bag.some((s) => s && s.kind === 'junk');
  const win = h('div.svc.panel.rightside', { style: { width: '74rem' } },
    h('div.wtitle', h('div', h('div.title', n.origin === 'hub' ? 'Vendor' : 'Wandering merchant'), h('div.subtitle', 'Buy and sell')), h('div.row', moneyEl(p.gold))),
    h('div.vendor-cols', h('div', h('h3', 'For sale'), stock), h('div', h('h3', 'Your bags'), bag)),
    h('div.row', { style: { justifyContent: 'flex-end', padding: '0 1.4rem 1.4rem' } }, hasJunk ? btn('Sell junk', () => ctx.act({ type: 'SELL_JUNK' })) : null, btn('Done', () => ctx.act({ type: 'LEAVE' }), '.primary')));
  return win;
}

function buildTrainer(v, ctx) {
  const p = v.player; const list = v.legal.trainer || [];
  const rows = h('div.list', list.map((e) => {
    const sp = ctx.data.spells[e.id];
    let right;
    const afford = e.affordable !== undefined ? e.affordable : p.gold >= e.cost;
    const price = e.cost != null ? moneyEl(e.cost) : h('span.bad', 'Need more gold');
    if (e.state === 'learnable') right = h('div.right', price, btnSmall('Learn', afford, () => ctx.act({ type: 'LEARN', spellId: e.id })));
    else if (e.state === 'trainable') right = h('div.right', price, btnSmall(`Train to ${p.level}`, afford, () => ctx.act({ type: 'TRAIN', spellId: e.id })));
    else if (e.state === 'current') right = h('div.right', h('span.good', `Rank ${e.rank} · level ${e.tl}`));
    else right = h('div.right', h('span.muted', `Requires level ${e.lvl}`));
    const r = h('div.trow' + (e.state === 'locked' ? '.locked' : ''), h('img', { src: spellIcon(e.id, sp), alt: '' }), h('div', h('div.nm', sp.name), h('div.meta', `Level ${e.lvl} · ${sp.text}`)), right);
    tip(r, () => spellTip(e.id, ctx));
    return r;
  }));
  const trainAll = list.some((e) => e.state === 'trainable');
  const spent = Object.values(p.talents || {}).reduce((a, b) => a + b, 0);
  return h('div.svc.panel.rightside', {},
    h('div.wtitle', h('div', h('div.title', 'Trainer'), h('div.subtitle', 'Spells grow only when trained to your level')), h('div.row', moneyEl(p.gold))),
    rows,
    h('div.row', { style: { justifyContent: 'space-between', padding: '.4rem 1.4rem 1.4rem' } },
      spent ? btn('Reset talents', () => ctx.act({ type: 'RESPEC' })) : h('span'),
      h('div.row', trainAll ? btn('Train all', () => ctx.act({ type: 'TRAIN_ALL' })) : null, btn('Done', () => ctx.act({ type: 'LEAVE' }), '.primary'))));
}
function btnSmall(label, ok, fn) { const b = h('button.btn.small' + (ok ? '' : '.disabled'), label); b.addEventListener('click', fn); return b; }

// ------------------------------------------------------------------ summary
function buildSummary(v, ctx) {
  const s = v.summary; if (!s) return null;
  const win = h('div.summary.panel.center');
  const won = s.outcome === 'victory';
  win.appendChild(h('div.shead', h('div.t1.subtitle', { style: { letterSpacing: '.4em', textTransform: 'uppercase' } }, won ? 'Victory' : 'The run has ended'),
    h('div.t2', { style: { color: won ? '#ffe08a' : '#e8a090' } }, won ? 'Oruvath has fallen' : `${s.name} has fallen`),
    h('div.subtitle', `${s.name} · level ${s.level} ${s.className}${s.petId ? ' with ' + ctx.data.pets[s.petId].name : ''} · ${s.zone}`)));
  const kv = (pairs) => h('dl.kv', pairs.flatMap(([k, val]) => [h('dt', k), h('dd', val)]));
  const card1 = h('div.card', h('h3', 'The journey'), kv([
    ['Reached', `${s.zone}${s.row ? `, row ${s.row}` : ''}`], ['In-game time', `${s.hours} h`], ['Ascendancy', s.asc ? `+${Math.round(s.asc * 100)} %` : 'none'],
    ['Estimated time', `${s.estMinutes.manual} min manual · ${s.estMinutes.auto} min autoplay`], ['Fights', `${s.fights} (${s.rounds} rounds)`], ['Seed', String(s.seed)],
    ...(s.death ? [['Killed by', `${s.death.killer} (${s.death.ability})`], ['Where', `${s.death.node}, round ${s.death.round}`]] : []),
  ]));
  const card2 = h('div.card', h('h3', 'Deeds'), kv([
    ['Kills', `${s.kills.normal} normal · ${s.kills.elite} elite · ${s.kills.rare} rare · ${s.kills.boss} boss`], ['Quests', `${s.quests} (${s.story} stories)`], ['Dungeons cleared', String(s.dungeons)],
    ['Gold', `earned ${moneyText(s.goldEarned)} · spent ${moneyText(s.goldSpent)}`], ['Potions used', String(s.potions)], ['Resurrections', String(s.resurrects)],
    ['Damage', `dealt ${fmtNum(s.dealt)} · taken ${fmtNum(s.taken)}`], ['Top spells', s.topSpells.map(([n, d]) => `${n} ${fmtNum(d)}`).join(', ') || '—'],
  ]), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.8rem' } }, s.equipped.map((it) => tip(h('div.slot.q-' + it.rarity, h('img', { src: itemIcon(it), alt: '' })), () => itemTip(it, ctx, { compare: false })))));
  // Echoes (rules 11.1): the engine's lines; the balance after the run from the bridge's dry END_RUN (view.meta.after)
  const after = v.meta && v.meta.after;
  const oathLine = s.echoMult && s.echoMult !== 1 ? h('div.echo', h('span.dim', `${s.oaths.join(', ')}`), h('b', `×${Math.round(s.echoMult * 100) / 100}`)) : null;
  const card3 = h('div.card', h('h3', 'Echoes earned'), s.echoes.map(([k, n]) => h('div.echo', h('span.dim', k), h('b', `+${n}`))), oathLine, h('div.echo.total', h('span', 'Total'), h('span', `${s.echoTotal} Echoes`)),
    after ? h('div.echo.after', h('span.dim', 'Your Echoes after this run'), echoAmt(after.echoes)) : null,
    h('div.muted', { style: { marginTop: '.8rem', fontSize: '1.1rem' } }, after
      ? (after.affordable ? `Echoes buy lasting unlocks between runs. ${cap(numWord(after.affordable))} ${plural(after.affordable, 'unlock')} within reach.` : 'Echoes buy lasting unlocks between runs. Keep them for the next one.')
      : 'Echoes buy lasting unlocks between runs.'));
  win.appendChild(h('div.sbody', card1, card2, card3));
  const again = btn('Begin a new run', () => ctx.act({ type: 'END_RUN' }), v.meta ? '.big' : '.primary.big');
  // Spend Echoes: END_RUN stores the profile, then the Hall of Echoes opens over class select
  const spend = v.meta ? btn('Spend Echoes', () => { ctx.ui.openMeta(); ctx.act({ type: 'END_RUN' }); }, '.primary.big') : null;
  if (spend && after && after.affordable) spend.appendChild(h('span.badge', String(after.affordable)));
  if (spend) tip(spend, () => h('div', h('div.tt-name', 'Hall of Echoes'), h('div.tt-line.desc', 'Spend the Echoes of this run and the runs before on lasting unlocks.'),
    after ? h('div.tt-line.num', `${fmtNum(after.echoes)} Echoes · ${numWord(after.affordable)} ${plural(after.affordable, 'unlock')} within reach`) : null, h('div.tt-hint', 'Then choose your next hero.')));
  if (v.meta) tip(again, () => h('div', h('div.tt-name', 'Begin a new run'), h('div.tt-line.desc', 'Back to class select. Your Echoes are kept: the Hall of Echoes is there too.')));
  win.appendChild(h('div.sfoot', spend, again));
  return win;
}
