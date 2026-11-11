// Centre screens by phase: class select, hub/camp, zone map, node dialogs, loot, quest rewards,
// vendor, trainer, shrine, rest, treasure and the run summary (its Killed by line names the killing blow, never an id).
// Every button sends an action.
// Start camp and contracts (docs/specs/expedition.md 9.1, 9.3; prep.js): the prep screen in phase PREP, the hub's contract
// offer, a completed contract's reward choice, the site marks and the Spyglass on the expedition map.
// Heat (docs/specs/expedition.md H.4): every time-costing choice (map node, Travel on, hub and camp service, Camp wave,
// Grind waves, the next wave) shows its tolls and the state it ends in from R.heatView's previews (view.heat.next) in its
// tooltip, colours its toll label when the state changes, and moves a ghost marker on the meter while hovered; nodes
// entered Hot or Scorched and items heat raised carry a badge; the summary has a heat card (heat.js).
import { h, add, clear, fmtNum, moneyEl, moneyText, clamp } from './util.js';
import { spellIcon, itemIcon, nodeIcon, icon, consumableIcon, roleIcon } from './art-icons.js';
import { drawPortrait, HERO_LOOKS, PET_LOOKS } from './art-actors.js';
import { tip, itemTip, spellTip, hide as hideTip } from './tooltip.js';
import { conColor, heroPortrait, travelState } from './hud.js';
import { numWord, plural, pct1, ROLE_INFO, humanize, tolls, HEAT_WORDS } from './ui-text.js';
import { createMeta, buildOaths, echoAmt } from './meta.js';
import { heatKey, previewBlock, heatBadge, buildHeatSummary, fmtTime, HEAT_NAME } from './heat.js';
import { createPrepScreen, buildHubOffer, siteBadge, siteLines, contractTip, kindIcon } from './prep.js';
import { contractTitle } from './ui-text.js';

/** The heat preview of a time-costing engine action now (view.heat.next, R.heatView), or null. */
const heatOf = (v, action) => (v.heat && v.heat.next ? v.heat.next[heatKey(action)] || null : null);
/** While the element is hovered the meter shows where the action leaves the player (a ghost marker). */
function ghostOn(el, ctx, action) {
  el.addEventListener('pointerenter', () => { const p = heatOf(ctx.view, action); if (p && ctx.hud && ctx.hud.heat) ctx.hud.heat.setGhost(p); });
  el.addEventListener('pointerleave', () => { if (ctx.hud && ctx.hud.heat) ctx.hud.heat.setGhost(null); });
  return el;
}
/** A toll label coloured by the state the action ends in when that is a new state (H.4). */
function tollLabel(el, p) {
  if (!el) return el;
  if (p && p.change) { el.dataset.hs = p.state; el.classList.add('heat-chg'); }
  return el;
}

const NODE_NAME = { quest: 'Quest', grind: 'Grind', elite: 'Elite', dungeon: 'Dungeon', rest: 'Rest', vendor: 'Vendor', trainer: 'Trainer', treasure: 'Treasure', shrine: 'Shrine' };
const NO_FIGHT = new Set(['rest', 'vendor', 'trainer', 'shrine']); // nodes that hold no fight: labels in a neutral colour
const NEUTRAL = '#f0e0c0';
/**
 * A fight's pack as role badges (combat v2, rules 7.14: the map shows the enemy count and archetypes so a pull can be
 * planned): one chip per archetype with its count, "2 × Brute", in the order the engine lists the enemies.
 */
function archChips(list) {
  const counts = new Map();
  for (const a of list) counts.set(a, (counts.get(a) || 0) + 1);
  return h('span.archs', [...counts.entries()].map(([a, k]) => h('span.arch', { dataset: { arch: a } }, h('img', { src: roleIcon(a), alt: '' }), `${k > 1 ? `${k} × ` : ''}${(ROLE_INFO[a] || {}).name || humanize(a)}`)));
}
const enemies = (k) => `${k} ${k === 1 ? 'enemy' : 'enemies'}`;
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
    if (cur.el) { const hov = [...document.querySelectorAll(':hover')].pop(); if (hov && cur.el.contains(hov)) hideTip(); cur.el.remove(); } // a tooltip of a card that goes goes too
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
    // the start camp (expedition.md 9.1): one screen built once per run and patched on every view (focus stays put)
    if (v.phase === 'PREP' && v.prep) { const el = mount(`prep:${v.seed}`, () => createPrepScreen(v, ctx)); if (el && el.update) el.update(v); return; }
    if (v.phase === 'SUMMARY') { mount('summary:' + (v.summary ? v.summary.seed + v.summary.outcome : ''), () => buildSummary(v, ctx)); return; }
    if (v.loot) { mount('loot:' + lootKey(v), () => (v.loot.kind === 'loot' ? buildLoot(v, ctx) : buildReward(v, ctx))); return; }
    const n = v.node;
    if ((v.phase === 'ZONE_HUB' || v.phase === 'CAMP') && n && n.origin === 'hub') { mount(`svc:${n.type}:${svcKey(v)}`, () => (n.type === 'trainer' ? buildTrainer(v, ctx) : buildVendor(v, ctx))); return; }
    if (v.phase === 'ZONE_HUB') { mount('hub:' + JSON.stringify(v.hub) + (p && p.talentPoints) + hubContractKey(v), () => buildHub(v, ctx)); return; }
    if (v.phase === 'CAMP') { mount('camp:' + JSON.stringify(v.hub) + v.time + (p && p.level), () => buildCamp(v, ctx)); return; }
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
const mapKey = (v) => `${v.zone.idx}|${v.zone.pos.row}|${v.zone.pos.lane}|${v.zone.exp ? `${v.zone.exp.pos}|${v.zone.exp.spyglass}|${spy.armed}` : ''}|${v.player.level}|${v.legal.travelOn}|${v.time}`;
/** The hub's contract state in the hub screen's key (prep): the offer, Reserve and the held contracts. */
const hubContractKey = (v) => (v.contracts ? `|${v.contracts.reserve}|${v.contracts.held}|${v.contracts.hub ? `${v.contracts.hub.kind}${v.contracts.hub.reserve}${v.contracts.hub.swap.join(',')}` : '-'}` : '');
/** The Spyglass (expedition.md 2.4; prep): armed from the map's button, the next node clicked is looked at (USE_SPYGLASS). */
const spy = { armed: false };
/** Esc or a new screen disarms the Spyglass; true when it was armed. */
export function disarmSpyglass() { const was = spy.armed; spy.armed = false; return was; }

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
  // the map new runs get (the setting "Expedition map with start camp", ?expedition=1, ?prep=1): said on class select
  const mode = h('div.modechip.hidden');
  tip(mode, () => h('div', h('div.tt-name', mode.textContent), h('div.tt-line', 'A preview of the coming expedition map. Switch it in the settings (Esc) or the Dev menu.')));
  root.append(classes, details, h('div.bottom.panel', h('div.field', h('label', 'Name'), name), h('div.field', h('label', 'Seed'), seed), mode, echoes, go));
  return root;
}

function updateCreate(root, v, ctx) {
  const d = ctx.data; const c = v.create; const cls = d.classes[c.classId];
  const mc = root.querySelector('.modechip'); const rm = ctx.bridge.runMode ? ctx.bridge.runMode() : {};
  if (mc) { mc.textContent = rm.mapMode === 'expedition' ? (rm.prep ? 'Expedition map with start camp (preview)' : 'Expedition map (preview)') : ''; mc.classList.toggle('hidden', rm.mapMode !== 'expedition'); }
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
/**
 * A service card. heat: { ctx, action, v } adds the heat preview of the engine action (R.heatView next): the toll label
 * coloured by a new state, a tooltip with "1 toll, ends Smouldering" and the ghost marker on the meter while hovered.
 */
function svcCard(glyph, bg, name, meta, cost, used, onClick, heat = null) {
  const p = heat && !used ? heatOf(heat.v, heat.action) : null;
  const hrs = tollLabel(h('div.hrs', p ? tolls(p.time) : cost), p);
  const el = h('div.svc-card' + (used ? '.used' : ''), h('img', { src: icon(glyph, bg), alt: '' }), h('div', h('div.nm', name), h('div.meta', used ? 'Used this visit' : meta)), hrs);
  if (!used) el.addEventListener('click', onClick);
  if (p) {
    tip(el, () => h('div', h('div.tt-name', name), h('div.tt-line.desc', meta), previewBlock(heatOf(heat.ctx.view, heat.action) || p, heat.ctx)));
    ghostOn(el, heat.ctx, heat.action);
  }
  return el;
}

const hubSwap = { swap: false }; // the hub offer's swap list stays open across the hub screen's rebuilds
function buildHub(v, ctx) {
  const z = v.zone; const p = v.player; const used = (v.hub && v.hub.used) || {}; const hr = ctx.data.rules.time;
  const el = h('div.side.panel');
  el.append(h('div.wtitle', h('div', h('div.title', { style: { fontSize: '2.4rem' } }, z.hubName), h('div.subtitle', `${z.name} · levels ${z.band[0]}–${z.band[1]}`))));
  const body = h('div.body.col', { style: { padding: '1.2rem 1.6rem 1.6rem', gap: '.8rem' } });
  if (z.hubText || z.blurb) body.appendChild(h('div', { style: { font: 'italic 1.4rem var(--font-title)', color: 'var(--ink-dim)', marginBottom: '.4rem' } }, z.hubText || z.blurb));
  // the hub's contract offer (expedition.md 3.6; prep) first: it is only open before leaving the hub
  if (hubSwap.z !== z.idx) { hubSwap.swap = false; hubSwap.z = z.idx; }
  const offer = buildHubOffer(v, ctx, hubSwap);
  if (offer) body.appendChild(offer);
  const svc = (service) => ({ ctx, v, action: { type: 'SERVICE', service } });
  body.append(
    svcCard('tome', 'arcane', 'Trainer', 'Learn and rank up spells', tolls(hr.trainer), used.trainer, () => ctx.act({ type: 'HUB_SERVICE', service: 'trainer' }), svc('trainer')),
    svcCard('vendor', 'earth', 'Vendor', 'Potions, rations and gear', tolls(hr.vendor), used.vendor, () => ctx.act({ type: 'HUB_SERVICE', service: 'vendor' }), svc('vendor')),
    svcCard('rest', 'fire', 'Inn', 'Full rest and rested experience', tolls(hr.inn), used.inn, () => ctx.act({ type: 'HUB_SERVICE', service: 'inn' }), svc('inn')));
  if (p.talentPoints) body.appendChild(h('div.warn', { style: { fontSize: '1.25rem' } }, `You have ${p.talentPoints} unspent talent point${p.talentPoints > 1 ? 's' : ''}. Press N.`));
  const go = h('button.btn.primary.big', 'Set out');
  go.addEventListener('click', () => ctx.act({ type: 'LEAVE_HUB' }));
  el.append(body, h('div.sfoot', h('span.muted', `${HEAT_WORDS.Units} so far: ${fmtTime(v.time)}`), go));
  return el;
}

function buildCamp(v, ctx) {
  const z = v.zone; const used = (v.hub && v.hub.used) || {}; const R = ctx.data.rules; const hr = R.time;
  const asc = v.camp ? v.camp.asc : null; // the engine's Ascendancy if the boss were faced now
  const el = h('div.side.panel');
  el.append(h('div.wtitle', h('div', h('div.title', { style: { fontSize: '2.4rem' } }, z.hubName), h('div.subtitle', `${z.name} · the final camp`))));
  const body = h('div.body.col', { style: { padding: '1rem 1.6rem 1.2rem', gap: '.6rem' } });
  body.appendChild(h('div', { style: { font: 'italic 1.4rem var(--font-title)', color: 'var(--ink-dim)' } }, z.blurb || ''));
  const svc = (service) => ({ ctx, v, action: { type: 'SERVICE', service } });
  body.append(
    svcCard('tome', 'arcane', 'Trainer', 'Last chance to train', tolls(hr.trainer), used.trainer, () => ctx.act({ type: 'HUB_SERVICE', service: 'trainer' }), svc('trainer')),
    svcCard('vendor', 'earth', 'Quartermaster', `Level ${R.maxLevel} stock`, tolls(hr.vendor), used.vendor, () => ctx.act({ type: 'HUB_SERVICE', service: 'vendor' }), svc('vendor')),
    svcCard('rest', 'fire', 'Campfire', 'Full rest before the fight', tolls(hr.inn), used.inn, () => ctx.act({ type: 'HUB_SERVICE', service: 'inn' }), svc('inn')),
    svcCard('grind', 'steel', 'Camp wave', `Fight a wave of level ${R.campGrindLevel} enemies`, `${tolls(hr.grindWave)} a wave`, false, () => ctx.act({ type: 'CAMP_GRIND' }), { ctx, v, action: { type: 'CAMP_GRIND' } }));
  // the par and the Ascendancy: R.heatView's (the bridge's v.camp: at the Camp the line is the par, ascIfPar the boss's)
  const par = v.camp && v.camp.par ? ` (par ${fmtTime(v.camp.par)})` : '';
  const kv = h('dl.kv', h('dt', HEAT_WORDS.Units), h('dd', `${fmtTime(v.time)}${par}`), h('dt', 'Ascendancy'),
    asc == null ? h('dd.muted', 'Unknown') : h('dd', { class: asc > 0 ? 'bad' : 'good' }, asc > 0 ? `+${Math.round(asc * 100)} % health and damage` : 'None: you are on time'));
  const go = h('button.btn.primary.big', 'Face Oruvath');
  go.addEventListener('click', () => ctx.act({ type: 'FIGHT_BOSS' }));
  el.append(body, h('div.sfoot', kv, go));
  return el;
}

// ------------------------------------------------------------------ zone map
export function buildMap(v, ctx, readOnly) {
  const z = v.zone; const p = v.player; const L = v.legal || {};
  if (z.exp) return buildExpMap(v, ctx, readOnly);
  const win = h('div.mapwin.panel');
  const nextName = z.idx < ctx.data.rules.zoneCount ? 'the next zone' : 'the camp';
  const ts = travelState(v);
  const label = { done: 'Travel on (zone done)', open: 'Travel on', early: 'Travel on early', locked: `Travel on at level ${ts.need}` }[ts.kind];
  const travel = h('button.btn' + (L.travelOn ? '.primary' : ''), { dataset: { travel: ts.kind } }, label);
  travel.disabled = !L.travelOn || readOnly;
  travel.addEventListener('click', () => ctx.act({ type: 'TRAVEL_ON' }));
  tip(travel, () => h('div', h('div.tt-name', 'Travel on'),
    h('div.tt-line.desc', `Leave ${z.name} for ${nextName}.${travelCost(z, ctx)} Leaving early skips the remaining rows: fewer tolls, but less loot and gold.`),
    h('div.tt-line', ts.under > 0 ? `Open from level ${ts.need}, ${numWord(ts.under)} ${plural(ts.under, 'level')} below the exit level ${ts.exit}, or after row ${ts.rows}.` : `Open from level ${ts.exit}, or after row ${ts.rows}.`),
    ts.kind === 'locked' ? h('div.tt-warn', `Reach level ${ts.need} or finish row ${ts.rows} first (you are level ${p.level}).`) : null,
    ts.kind === 'early' ? h('div.tt-warn', `You are under the exit level (${ts.exit}): the next zone starts above your level. More risk, more experience.`) : null,
    ts.kind === 'done' ? h('div.tt-hint', `Row ${ts.rows} is done: the road leads on.`) : null,
    readOnly ? null : previewBlock(heatOf(ctx.view, { type: 'TRAVEL_ON' }), ctx, { leaves: true })));
  if (!readOnly) ghostOn(travel, ctx, { type: 'TRAVEL_ON' });
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
    // heat (H.4): a reachable node's tolls, in the colour of the state it ends in when that is a new one; a visited node
    // entered Hot or Scorched keeps a mark of what it paid
    const act = { type: 'CHOOSE_NODE', lane: l };
    const hp = reach && !readOnly ? heatOf(v, act) : null;
    if (hp) el.appendChild(tollLabel(h('div.mhrs', `${tolls(hp.time)}${hp.perWave ? '/wave' : ''}`), hp));
    if (n.visited && n.heat && ctx.data.rules.heat && (ctx.data.rules.heat.gain[n.heat] > 0 || ctx.data.rules.heat.rarityUp[n.heat] > 0)) el.appendChild(h('div.mheat', { dataset: { hs: n.heat } }));
    if (reach) el.addEventListener('click', () => ctx.act(act));
    tip(el, () => nodeTip(n, v, ctx, reach, reach && !readOnly ? heatOf(ctx.view, act) : null));
    if (hp) ghostOn(el, ctx, act);
    body.appendChild(el);
  }
  const legend = h('div.mlegend', Object.keys(NODE_NAME).map((t) => h('span', h('img', { src: nodeIcon(t), alt: '' }), NODE_NAME[t])));
  // row ruler
  for (let r = 1; r <= ROWS; r++) body.appendChild(h('div.mrow', { style: { left: `${PX(r) / 10}%` } }, `${r}`));
  const sq = ctx.data.rules.storyQuests;
  const story = h('div.dim', { style: { fontSize: '1.2rem', whiteSpace: 'nowrap' } }, `Story ${Math.min(sq, z.questsDone)}/${sq}`);
  win.append(head, body, h('div.mfoot', legend, story));
  if (readOnly) win.id = 'win-map';
  return win;
}
// ------------------------------------------------------------------ the fog map (expedition.md 4-6, 9.2; M2b 2b.6)
// Everything drawn comes from mapView (zone.exp, engine-api.md 10.3): rings, edges, every node's fog state, regions
// where `region` is given, landmarks, the Dimming (dimmed, dimsIn, dim.front), site marks and moves. Nothing else of the
// zone is read; the Shardfall's hop distances are counted on mapView's own edges (the skeleton is always visible, 5.1).
const SVGNS = 'http://www.w3.org/2000/svg';
const REGION_TINT = { wilds: '#7fa646', road: '#c8913c', haunt: '#8a6cc0', steads: '#e0bc52' };
const REGION_FEEL = { wilds: 'Wilds: beasts, open country', road: 'Road country: bandits and waystations', haunt: 'Haunt: ruins, casters and shrines', steads: 'Steads: farms, villages and rest' };
const XR = [0, 138, 262, 376]; // ring radii in the disc's 1000 units
const XCELL = [[0, 66], [66, 200], [200, 320], [320, 468]]; // each ring's band of the disc
const svgEl = (tag, attrs = {}, parent = null) => { const e = document.createElementNS(SVGNS, tag); for (const [k, x] of Object.entries(attrs)) e.setAttribute(k, x); if (parent) parent.appendChild(e); return e; };
const polar = (r, deg) => { const a = (deg * Math.PI) / 180; return [500 + r * Math.cos(a), 500 + r * Math.sin(a)]; };
/** A node's cell: the annular sector of its ring between the half-steps to its ring neighbours (the hub: a disc). */
function cellPath(ring, angle, step) {
  const [r0, r1] = XCELL[ring];
  if (ring === 0) return `M${500 - r1} 500 a${r1} ${r1} 0 1 0 ${2 * r1} 0 a${r1} ${r1} 0 1 0 ${-2 * r1} 0 Z`;
  const a0 = angle - step / 2 - 0.6; const a1 = angle + step / 2 + 0.6; const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(r1, a0); const [x1, y1] = polar(r1, a1); const [x2, y2] = polar(r0, a1); const [x3, y3] = polar(r0, a0);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r1} ${r1} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
}
/** Hops from `from` on the view's edges (breadth first). */
function hopsFrom(mv, from) {
  const nb = mv.nodes.map(() => []);
  for (const [a, b] of mv.edges) { nb[a].push(b); nb[b].push(a); }
  const d = mv.nodes.map(() => Infinity); d[from] = 0; const q = [from];
  while (q.length) { const x = q.shift(); for (const y of nb[x]) if (d[y] === Infinity) { d[y] = d[x] + 1; q.push(y); } }
  return d;
}
/** The circular mean of angles (degrees). */
function meanAngle(list) { let x = 0; let y = 0; for (const a of list) { x += Math.cos((a * Math.PI) / 180); y += Math.sin((a * Math.PI) / 180); } return (Math.atan2(y, x) * 180) / Math.PI; }
/** Where a Road leads: the next zone's name (zone 6's: the Camp). */
function roadTo(v, ctx) {
  const zs = ctx.data.zones || []; const z = v.zone.idx;
  if (zs[z] && zs[z].name) return zs[z].name;
  return (ctx.data.camp && ctx.data.camp.name) || 'the Camp';
}
/** The fog state of a node: 'seen' (in sight now), 'known' (seen before, or its type known), 'unknown'. */
function fogState(n, mv) { return n.hub ? 'seen' : n.know === 'full' ? (n.hops <= mv.vision.radius ? 'seen' : 'remembered') : n.know === 'type' ? 'typed' : 'unknown'; }

/**
 * The expedition zone map (rules 1.9, engine-api.md 10.3; expedition.md 9.2): the zone disc with its rings, paths,
 * region tints and names (where mapView gives a node's region), the Roads as signposts on the rim with the zone they lead
 * to, the Shardfall as a cracked star, the Dimming as a dark wash over Dimmed nodes with "dims in N" on every node within
 * two hops of its front, fog (seen, remembered, type only, unknown), contract site marks, the player's node and the moves
 * (MOVE on a click, PASS_THROUGH in the list). Every move shows its heat preview (MOVE, PASS_THROUGH, TAKE_ROAD, RING_BELL).
 */
function buildExpMap(v, ctx, readOnly) {
  const z = v.zone; const mv = z.exp; const p = v.player;
  const win = h('div.mapwin.panel.expmap' + (spy.armed && !readOnly ? '.spying' : ''));
  const acts = [];
  if (!readOnly && mv.onRoad) acts.push(['Take the Road', { type: 'TAKE_ROAD' }]);
  if (!readOnly && mv.bell && mv.bell.charges > 0) acts.push([`Ring the Bell (${mv.bell.charges})`, { type: 'RING_BELL' }]);
  const btns = acts.map(([label, a]) => {
    const b = btn(label, () => ctx.act(a), a.type === 'TAKE_ROAD' ? '.primary' : '');
    tip(b, () => h('div', h('div.tt-name', label), a.type === 'RING_BELL' ? h('div.tt-line', `${mv.texts && mv.texts.homeward_bell ? mv.texts.homeward_bell + ' ' : ''}Rung on the map: ${tolls(mv.bell.channelTime)} to ring, then the next zone's hub.`) : h('div.tt-line', `Leave for ${roadTo(v, ctx)}.`), previewBlock(heatOf(ctx.view, a), ctx, { leaves: true })));
    return ghostOn(b, ctx, a);
  });
  // the Spyglass (expedition.md 2.4; prep): arm it, then click any node: it and its neighbours come into full view, no tolls
  if (!readOnly && mv.spyglass > 0) {
    const sb = btn(spy.armed ? 'Choose a node…' : `Spyglass (${mv.spyglass})`, () => { spy.armed = !spy.armed; ctx.ui.refreshScreens(); }, spy.armed ? '.primary.spyon' : '');
    sb.dataset.spyglass = String(mv.spyglass);
    tip(sb, () => h('div', h('div.tt-name', 'Spyglass'), h('div.tt-line', 'Look at any node of the zone, however far: it and its neighbours come into full view. Costs no tolls.'),
      h('div.tt-sub', `${mv.spyglass} ${plural(mv.spyglass, 'look')} left`), h('div.tt-hint', spy.armed ? 'Click a node on the map · Esc or this button to stop' : 'Click, then click a node')));
    btns.unshift(sb);
  } else if (spy.armed) spy.armed = false;
  const dm = mv.dim || {}; const off = !!dm.off;
  win.appendChild(h('div.mhead', h('div', h('div.title', z.name), h('div.subtitle', `Levels ${z.band[0]}–${z.band[1]} · zone toll ${mv.zt}`)), h('div.row', readOnly ? closeBtn(ctx, 'map') : null, ...btns)));

  // ---- the disc
  const disc = h('div.xdisc');
  const svg = svgEl('svg', { viewBox: '0 0 1000 1000', class: 'xsvg' });
  disc.appendChild(svg);
  const defs = svgEl('defs', {}, svg);
  defs.innerHTML = '<radialGradient id="xg-land" cx="50%" cy="46%" r="55%"><stop offset="0" stop-color="#e9d6a8"/><stop offset=".62" stop-color="#d6bb84"/><stop offset=".9" stop-color="#a98552"/><stop offset="1" stop-color="#6e5130"/></radialGradient>'
    + '<radialGradient id="xg-dim" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#140a26" stop-opacity=".95"/><stop offset=".7" stop-color="#1e1038" stop-opacity=".85"/><stop offset="1" stop-color="#2a1650" stop-opacity="0"/></radialGradient>'
    + '<filter id="xf-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>'
    + '<filter id="xf-mist" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="38"/><feGaussianBlur stdDeviation="7"/></filter>'
    + '<filter id="xf-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 .35  0 0 0 0 .24  0 0 0 0 .12  0 0 0 .22 0" result="gc"/><feComposite in="gc" in2="SourceGraphic" operator="in"/></filter>'
    + '<clipPath id="xc-disc"><circle cx="500" cy="500" r="468"/></clipPath>';
  // land: the painted parchment disc, a grain over it, the rim
  svgEl('circle', { cx: 500, cy: 500, r: 482, fill: '#3a2814', opacity: 0.55, filter: 'url(#xf-soft)' }, svg);
  svgEl('circle', { cx: 500, cy: 500, r: 468, fill: 'url(#xg-land)' }, svg);
  svgEl('circle', { cx: 500, cy: 500, r: 468, fill: '#000', filter: 'url(#xf-ink)' }, svg);
  const per = {}; for (const n of mv.nodes) per[n.ring] = (per[n.ring] || 0) + 1;
  const step = (ring) => 360 / Math.max(1, per[ring] || 1);
  // regions: a soft tint on every node whose region the view gives (seen, or Region Charts); names on the rim
  const gReg = svgEl('g', { 'clip-path': 'url(#xc-disc)', filter: 'url(#xf-soft)', opacity: 0.66, class: 'xregions' }, svg);
  const regAngles = new Map();
  for (const n of mv.nodes) {
    if (n.hub || n.region == null || !mv.regions[n.region]) continue;
    svgEl('path', { d: cellPath(n.ring, n.angle, step(n.ring)), fill: REGION_TINT[mv.regions[n.region].kind] || '#a08a60', 'data-region': n.region }, gReg);
    if (n.ring >= 2) { if (!regAngles.has(n.region)) regAngles.set(n.region, []); regAngles.get(n.region).push(n.angle); }
  }
  // rings and the rim
  for (const r of XR.slice(1)) svgEl('circle', { cx: 500, cy: 500, r, fill: 'none', stroke: '#6a4a26', 'stroke-width': 1.6, 'stroke-dasharray': '3 9', opacity: 0.45 }, svg);
  svgEl('circle', { cx: 500, cy: 500, r: 468, fill: 'none', stroke: '#4a3018', 'stroke-width': 5, opacity: 0.8 }, svg);
  svgEl('circle', { cx: 500, cy: 500, r: 458, fill: 'none', stroke: '#8a6a3a', 'stroke-width': 1.2, opacity: 0.6 }, svg);
  // region names along the rim, at the middle of the region's known nodes
  for (const [ri, angs] of regAngles) {
    const reg = mv.regions[ri]; if (!reg || !reg.name) continue;
    const mid = meanAngle(angs); const span = 70; const r = 437;
    const top = Math.sin((mid * Math.PI) / 180) < 0.05; // upper half: read clockwise; lower half: counter-clockwise, so the text stands upright
    const [ax, ay] = polar(r, top ? mid - span / 2 : mid + span / 2); const [bx, by] = polar(r, top ? mid + span / 2 : mid - span / 2);
    const id = `xr-arc-${ri}`;
    svgEl('path', { id, d: `M${ax.toFixed(1)} ${ay.toFixed(1)} A${r} ${r} 0 0 ${top ? 1 : 0} ${bx.toFixed(1)} ${by.toFixed(1)}`, fill: 'none' }, defs);
    const t = svgEl('text', { class: 'xrname', 'text-anchor': 'middle', dy: 7, 'data-region': ri }, svg);
    const tp = svgEl('textPath', { href: `#${id}`, startOffset: '50%' }, t);
    tp.textContent = reg.name;
  }
  // fog: mist over every node the player has not seen
  const gFog = svgEl('g', { 'clip-path': 'url(#xc-disc)', filter: 'url(#xf-mist)', class: 'xfogwash' }, svg);
  for (const n of mv.nodes) if (!n.hub && n.know !== 'full') svgEl('path', { d: cellPath(n.ring, n.angle, step(n.ring)), fill: n.know === 'type' ? '#cfc8bc' : '#b4b0aa', opacity: n.know === 'type' ? 0.34 : 0.52 }, gFog);
  // the Dimming: a dark wash over every Dimmed node, from the Shardfall outward (a landmark: drawn over the fog, 5.1)
  const gDim = svgEl('g', { 'clip-path': 'url(#xc-disc)', class: 'xdimwash' }, svg);
  for (const n of mv.nodes) if (n.dimmed) svgEl('path', { d: cellPath(n.ring, n.angle, step(n.ring)), fill: '#1a0d30', opacity: 0.8, filter: 'url(#xf-soft)' }, gDim);
  // paths: every edge; the ones from the player's node lit
  const XY = (n) => polar(XR[n.ring], n.angle);
  for (const [a, b] of mv.edges) {
    const na = mv.nodes[a]; const nb = mv.nodes[b];
    const [x1, y1] = XY(na); const [x2, y2] = XY(nb);
    const near = !readOnly && (a === mv.pos || b === mv.pos);
    const known = na.know !== 'none' && nb.know !== 'none';
    // a path between two nodes of the same ring bends along it, as roads round a hill
    let d = `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    if (na.ring === nb.ring && na.ring > 0) d = `M${x1.toFixed(1)} ${y1.toFixed(1)} A${XR[na.ring]} ${XR[na.ring]} 0 0 ${((nb.angle - na.angle + 540) % 360) - 180 > 0 ? 1 : 0} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    svgEl('path', { d, fill: 'none', stroke: near ? '#f2c25a' : '#5a3c1c', 'stroke-width': near ? 5 : known ? 3.2 : 2.4, 'stroke-dasharray': near ? '3 9' : known ? '11 9' : '4 10', 'stroke-linecap': 'round', opacity: near ? 0.95 : known ? 0.62 : 0.4, class: near ? 'xedge near' : 'xedge' }, svg);
  }
  // the Shardfall: a cracked star of cold light
  const sf = mv.nodes[mv.shardfall];
  if (sf) {
    const [sx, sy] = XY(sf); const g = svgEl('g', { class: 'xshard', transform: `translate(${sx.toFixed(1)} ${sy.toFixed(1)})` }, svg);
    svgEl('circle', { r: 58, fill: '#7a5cff', opacity: 0.28, filter: 'url(#xf-soft)' }, g);
    const pts = []; for (let i = 0; i < 16; i++) { const rr = i % 2 ? 17 : 44 - (i % 4 === 0 ? 0 : 8); const a = (i * Math.PI) / 8 - Math.PI / 2; pts.push(`${(rr * Math.cos(a)).toFixed(1)},${(rr * Math.sin(a)).toFixed(1)}`); }
    svgEl('polygon', { points: pts.join(' '), fill: '#cfc2ff', stroke: '#2a1660', 'stroke-width': 3, opacity: 0.85 }, g);
    svgEl('path', { d: 'M-4 -30 L3 -8 L-6 4 L5 22 M3 -8 L16 -4 M-6 4 L-20 9', fill: 'none', stroke: '#1a0c40', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, g);
  }
  // ---- the Roads: signposts on the rim with the zone they lead to
  const to = roadTo(v, ctx);
  (mv.roads || []).forEach((rid, i) => {
    const n = mv.nodes[rid]; if (!n) return;
    const side = Math.abs(Math.cos((n.angle * Math.PI) / 180)) > 0.6; // at the left or right edge: the board stands above its post
    const [x, y] = polar(side ? 484 : 478, n.angle); const right = Math.cos((n.angle * Math.PI) / 180) >= 0;
    const name = mv.roadNames && mv.roadNames[i] ? mv.roadNames[i] : 'Road';
    const sign = h('div.xroad' + (side ? '.side' : right ? '.r' : '.l') + (n.dimmed ? '.dimmed' : '') + (n.id === mv.pos ? '.on' : ''), { style: { left: `${x / 10}%`, top: `${y / 10}%` }, dataset: { road: rid } },
      h('span.xpost'), h('span.xsign', h('b', side ? to : `${right ? '' : '« '}${to}${right ? ' »' : ''}`)));
    tip(sign, () => h('div', h('div.tt-name', name), h('div.tt-line', `A Road out of the zone, to ${to}.`), h('div.tt-sub', `Standing on it: Take the Road · ${tolls(mv.travelTime)}`), n.dimmed ? h('div.tt-warn', 'Dimmed: a fight with Shardspawn first, then the Road can still be taken.') : null));
    disc.appendChild(sign);
  });

  // ---- nodes
  const front = off ? -Infinity : dm.front ?? -1;
  const sfHops = sf ? hopsFrom(mv, mv.shardfall) : mv.nodes.map(() => Infinity);
  const moves = new Map(mv.moves.map((m) => [m.nodeId, m]));
  const finite = (x) => x != null && Number.isFinite(x);
  for (const n of mv.nodes) {
    const [x, y] = XY(n); const m = readOnly ? null : moves.get(n.id);
    const fog = fogState(n, mv);
    const type = n.hub ? 'hub' : n.know !== 'none' && n.type ? n.type : null;
    const here = n.id === mv.pos;
    const full = n.know === 'full';
    const band = mv.bands && mv.bands[n.ring] ? mv.bands[n.ring] : null;
    const label = n.hub ? 'Hub' : full && n.cl ? String(n.cl) : n.know === 'type' && band ? `${band[0]}–${band[1]}` : '?';
    const el = h(`button.mnode.x-${fog}` + (m ? '.reach' : '') + (n.done && !n.hub ? '.visited' : '') + (here ? '.here' : '') + (n.dimmed ? '.dimmed' : '') + (n.lost ? '.lost' : '') + (type ? '' : '.fog') + (n.hub ? '.xhub' : '') + (n.shardfall ? '.xsf' : '') + (n.road ? '.xrd' : ''),
      { style: { left: `${x / 10}%`, top: `${y / 10}%` }, 'aria-label': `${type ? NODE_NAME[type] || 'Hub' : 'Unknown'} node ${n.id}`, dataset: { node: n.id, fog } },
      h('div.ring', type ? h('img', { src: nodeIcon(type), alt: '' }) : h('span.fogq', '?')),
      h('div.cl' + (n.know === 'type' ? '.band' : ''), { style: { color: full && n.cl && !n.hub && !NO_FIGHT.has(n.type) ? conColor(n.cl, p.level) : NEUTRAL } }, label));
    if (here) el.appendChild(flagSvg());
    // enemy count on a seen fight node (BUG-QA-02)
    const foes = full && !n.hub && !n.done ? (n.type === 'dungeon' ? null : n.archetypes && n.archetypes.length ? n.archetypes.length : null) : null;
    if (foes) el.appendChild(h('div.xfoes', { dataset: { foes } }, `×${foes}`));
    const marks = siteBadge(n, v); // contract site marks (prep): only the ones the player sees; a hidden node stays unnamed
    if (marks) el.appendChild(marks);
    // the Dimming's clock: "dims in N" on every node within two hops of its front; the player's own count stands out at 2 or less
    const near = !off && !n.dimmed && finite(n.dimsIn) && sfHops[n.id] <= front + 2;
    if (near || (here && !off && !n.dimmed && finite(n.dimsIn) && n.dimsIn <= 2)) el.appendChild(h('div.xclock' + (here && n.dimsIn <= 2 ? '.urgent' : '') + (n.dimsIn <= 2 ? '.soon' : ''), { dataset: { dimsIn: n.dimsIn } }, here && n.dimsIn <= 2 ? `Dims in ${n.dimsIn}!` : `dims in ${n.dimsIn}`));
    const act = { type: 'MOVE', nodeId: n.id };
    const hp = m ? heatOf(v, act) : null;
    if (hp) el.appendChild(tollLabel(h('div.mhrs', tolls(hp.time)), hp));
    if (n.done && n.heat && ctx.data.rules.heat && (ctx.data.rules.heat.gain[n.heat] > 0 || ctx.data.rules.heat.rarityUp[n.heat] > 0)) el.appendChild(h('div.mheat', { dataset: { hs: n.heat } }));
    const look = { type: 'USE_SPYGLASS', nodeId: n.id };
    if (!readOnly) el.addEventListener('click', () => { if (spy.armed) { spy.armed = false; ctx.act(look); } else if (m) ctx.act(act); });
    if (m) ghostOn(el, ctx, act);
    tip(el, () => expNodeTip(n, mv, v, ctx, m, here, readOnly, act));
    disc.appendChild(el);
  }

  // ---- side columns: the Dimming and the key (left), regions and moves (right)
  const me = mv.nodes[mv.pos];
  const left = h('div.xside.xleft');
  const dimBox = h('div.xpanel.xdimp' + (me && !off && finite(me.dimsIn) && me.dimsIn <= 2 ? '.urgent' : ''), h('div.xph', 'The Dimming'));
  if (off) dimBox.appendChild(h('div.xpl.muted', 'Not in this run.'));
  else {
    dimBox.appendChild(h('div.xpl', front < 0 ? `Starts to spread in ${tolls(dm.nextIn)}` : `Spreads again in ${tolls(dm.nextIn)}`));
    if (me) dimBox.appendChild(h('div.xpl.xmine', { dataset: { dimsIn: me.dimmed ? 0 : me.dimsIn } }, me.dimmed ? 'You stand in the Dimming!' : `Your node dims in ${tolls(me.dimsIn)}`));
    dimBox.appendChild(h('div.xpl.muted', `${mv.nodes.filter((n) => n.dimmed).length} of ${mv.nodes.length} nodes Dimmed`));
  }
  tip(dimBox, () => h('div', h('div.tt-name', 'The Dimming'), mv.texts && mv.texts.dimming ? h('div.tt-line', mv.texts.dimming) : null,
    h('div.tt-line', `It spreads ${dm.frontHops} hops every ${tolls(dm.frontTime)} from the Shardfall, after ${tolls(dm.grace)} in the zone.`),
    h('div.tt-sub', 'Entering or standing in a Dimmed node starts a fight with Shardspawn; its content is lost. Leave by a Road or the Bell.')));
  const key = h('div.xpanel.xkey', h('div.xph', 'Key'),
    h('div.xk', h('i.xk-seen'), 'Seen: in sight'), h('div.xk', h('i.xk-rem'), 'Remembered'), h('div.xk', h('i.xk-typed'), 'Type known'), h('div.xk', h('i.xk-unk'), 'Unknown'),
    h('div.xk', h('i.xk-dim'), 'Dimmed'), h('div.xk', h('i.xk-shard'), 'Shardfall'));
  tip(key, () => h('div', h('div.tt-name', 'What you see'), h('div.tt-line', `Nodes within ${mv.vision.radius} ${plural(mv.vision.radius, 'hop')} of you are in full view; a node once seen stays on the map.`),
    mv.vision.typeRadius ? h('div.tt-line', `Pathfinder: node types within ${mv.vision.typeRadius} hops.`) : null, mv.vision.regions ? h('div.tt-line', 'Your charts show every region.') : h('div.tt-line', 'A region shows where you have seen its land.')));
  left.append(dimBox, key);
  const right = h('div.xside.xright');
  const regBox = h('div.xpanel.xregp', h('div.xph', 'Regions'));
  mv.regions.forEach((r, i) => {
    const seen = mv.nodes.some((n) => n.region === i);
    const row = h('div.xreg' + (seen ? '' : '.unseen'), { dataset: { region: i } }, h('i', { style: { background: REGION_TINT[r.kind] || '#a08a60' } }), h('span', r.name || REGION_FEEL[r.kind] || r.kind));
    tip(row, () => h('div', h('div.tt-name', r.name || r.kind), h('div.tt-line', REGION_FEEL[r.kind] || r.kind), h('div.tt-sub', seen ? (mv.vision.regions ? 'Charted' : 'Seen in part') : 'Not yet found')));
    regBox.appendChild(row);
  });
  right.appendChild(regBox);
  // the moves: enter or walk (MOVE) and pass through (PASS_THROUGH), each with its tolls and heat
  if (!readOnly) {
    const list = h('div.xpanel.expmoves', h('div.xph', 'Moves'), mv.moves.map((m) => {
      const n = mv.nodes[m.nodeId]; const name = n.hub ? 'Hub' : n.know !== 'none' && n.type ? NODE_NAME[n.type] || n.type : 'Unknown';
      const go = { type: 'MOVE', nodeId: m.nodeId }; const pass = { type: 'PASS_THROUGH', nodeId: m.nodeId };
      const b1 = ghostOn(btn(`${m.via === 'enter' ? 'Enter' : 'Walk to'} ${name} · ${tolls(m.time)}`, () => ctx.act(go), '.small'), ctx, go);
      tip(b1, () => previewBlock(heatOf(ctx.view, go), ctx));
      const b2 = m.passTime != null ? ghostOn(btn(`Pass · ${tolls(m.passTime)}`, () => ctx.act(pass), '.small'), ctx, pass) : null;
      if (b2) tip(b2, () => h('div', h('div.tt-line', 'Walk through without resolving it.'), previewBlock(heatOf(ctx.view, pass), ctx)));
      // hovering a move lights its node on the map
      const lit = (on) => { const el = disc.querySelector(`.mnode[data-node="${m.nodeId}"]`); if (el) el.classList.toggle('lit', on); };
      const row = h('div.em' + (m.dimmed ? '.dimmed' : ''), b1, b2);
      row.addEventListener('mouseenter', () => lit(true)); row.addEventListener('mouseleave', () => lit(false));
      return row;
    }));
    right.appendChild(list);
  }
  const body = h('div.mbody.parchment.xbody', left, disc, right);
  win.append(body);
  if (readOnly) win.id = 'win-map';
  // labels of neighbouring nodes (levels, toll labels, Dimming clocks) step aside once the disc has its size
  // (again when the web fonts are in, which changes the labels' widths, and once the window's opening animation is over)
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => declutterLabels(disc)).observe(disc);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => declutterLabels(disc));
  setTimeout(() => declutterLabels(disc), 400);
  return win;
}
/**
 * The fog map's node labels never overlap each other or another node (small screens crowd the hub's ring). Greedy, in
 * order of importance: levels, the player's own clock, toll labels, then the other clocks. A label keeps its place
 * (style.css) when it is free; otherwise it takes the first free spot around its own node (above, below, right, left,
 * the corners, then one more row out), set with the CSS `translate` property so the label's own transform stays. With no
 * free spot it keeps the one that overlaps least. Presentation only: what a label says does not change.
 */
function declutterLabels(disc) {
  if (!disc.isConnected) return;
  const nodes = [...disc.querySelectorAll(':scope > .mnode')];
  const labs = [];
  for (const n of nodes) for (const el of n.querySelectorAll(':scope > .cl, :scope > .mhrs, :scope > .xclock')) { el.style.translate = ''; labs.push({ el, n }); }
  const shown = labs.filter(({ el }) => el.getClientRects().length > 0);
  // in the disc's own pixels: the window may still be scaling in (its opening animation), which moves and scales every rect
  const D = disc.getBoundingClientRect(); const k = D.width / (disc.offsetWidth || D.width || 1) || 1;
  const box = (r) => ({ l: (r.left - D.left) / k, t: (r.top - D.top) / k, r: (r.right - D.left) / k, b: (r.bottom - D.top) / k });
  const ring = new Map(nodes.map((n) => [n, box((n.querySelector('.ring') || n).getBoundingClientRect())]));
  const fixed = nodes.flatMap((n) => [...n.querySelectorAll(':scope > .xfoes, :scope > .xsite')].map((x) => ({ n, b: box(x.getBoundingClientRect()) })));
  const rank = ({ el }) => (el.classList.contains('cl') ? 0 : el.classList.contains('urgent') ? 1 : el.classList.contains('mhrs') ? 2 : 3);
  shown.sort((a, b) => rank(a) - rank(b));
  const placed = [];
  const area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  for (const lab of shown) {
    const nat = box(lab.el.getBoundingClientRect()); const w = nat.r - nat.l; const ht = nat.b - nat.t;
    const R = ring.get(lab.n); const cx = (R.l + R.r) / 2; const cy = (R.t + R.b) / 2; const g = 2;
    const at = (x, y) => ({ l: x, t: y, r: x + w, b: y + ht });
    const cand = [nat, at(cx - w / 2, R.t - g - ht), at(cx - w / 2, R.b + g), at(R.r + g, cy - ht / 2), at(R.l - g - w, cy - ht / 2),
      at(R.r + g, R.t - ht), at(R.l - g - w, R.t - ht), at(R.r + g, R.b), at(R.l - g - w, R.b),
      at(cx - w / 2, R.t - 2 * (g + ht)), at(cx - w / 2, R.b + 2 * g + ht), at(nat.l, nat.b + g), at(nat.l, nat.t - g - ht),
      at(R.r + g, R.t - 2 * ht - g), at(R.l - g - w, R.t - 2 * ht - g), at(R.r + g, R.b + ht + g), at(R.l - g - w, R.b + ht + g),
      at(nat.l, nat.b + ht + 2 * g), at(nat.l, nat.t - 2 * (g + ht))];
    // then any spot near the node, nearest first (at most a label's width sideways and three rows up or down)
    const near = [];
    for (let dx = -w; dx <= w + 0.1; dx += w / 4) for (let dy = -3 * ht; dy <= 3 * ht + 0.1; dy += ht / 2) near.push(at(cx - w / 2 + dx, (lab.el.classList.contains('mhrs') ? R.t - g - ht : R.b + g) + dy));
    const d2 = (c) => (c.l - nat.l) ** 2 + (c.t - nat.t) ** 2;
    cand.push(...near.sort((a, b) => d2(a) - d2(b)));
    // text on text is the worst, then a label on a node's icon; a small "?" marker of an unknown node may be touched
    const cost = (c) => {
      let k = 0;
      for (const [n, b] of ring) if (n !== lab.n) k += area(c, b) * (n.classList.contains('x-unknown') ? 0.3 : 2);
      if (lab.el.classList.contains('cl')) { /* its own ring is fine to touch */ } else k += 2 * area(c, R);
      for (const f of fixed) k += 2 * area(c, f.b);
      for (const p of placed) k += 4 * area(c, p);
      return k;
    };
    let best = cand[0]; let bestK = cost(best);
    for (const c of cand.slice(1)) { if (bestK <= 0) break; const k = cost(c); if (k < bestK - 0.5) { best = c; bestK = k; } }
    if (best !== cand[0]) lab.el.style.translate = `${(best.l - nat.l).toFixed(1)}px ${(best.t - nat.t).toFixed(1)}px`;
    placed.push(best);
  }
  // a node's labels are drawn inside its own layer (the node's transform): nodes with toll labels or clocks sit over
  // plain nodes, the player's own urgent clock over all, so no label hides under a neighbour's ring
  for (const n of nodes) n.style.zIndex = n.classList.contains('here') ? '' : n.querySelector(':scope > .mhrs, :scope > .xclock') ? '3' : '';
}
/** The tooltip of a node of the fog map: only what mapView gives of it. */
function expNodeTip(n, mv, v, ctx, m, here, readOnly, act) {
  const z = v.zone; const p = v.player;
  const type = n.hub ? 'hub' : n.know !== 'none' ? n.type : null;
  const full = n.know === 'full';
  const box = h('div.tt-node');
  const lvl = full && n.cl && !n.hub ? h('div', { style: { color: NO_FIGHT.has(n.type) ? NEUTRAL : conColor(n.cl, p.level), fontWeight: 800 } }, `Level ${n.cl}`) : null;
  box.appendChild(h('div.tt-row', h('div.tt-name', n.hub ? z.hubName : type ? NODE_NAME[type] || type : 'Unknown'), lvl));
  const band = mv.bands && mv.bands[n.ring];
  const reg = n.region != null && mv.regions[n.region] ? mv.regions[n.region] : null;
  box.appendChild(h('div.tt-sub', [n.hub ? 'Zone hub: trainer, vendor and inn' : `Ring ${n.ring}${band ? ` · levels ${band[0]}–${band[1]}` : ''}`, reg && reg.name ? reg.name : null].filter(Boolean).join(' · ')));
  const fog = fogState(n, mv);
  if (fog === 'unknown') box.appendChild(h('div.tt-line.muted', 'Unknown: not seen yet. Its ring gives its level range.'));
  else if (fog === 'typed') box.appendChild(h('div.tt-line.muted', 'Known from afar: its type only.'));
  else if (fog === 'remembered') box.appendChild(h('div.tt-line.muted', 'Remembered: seen before, out of sight now.'));
  if (full && !n.hub) {
    if (n.type === 'quest' && n.title) box.appendChild(h('div.tt-line', { style: { color: '#ffd88a', fontWeight: 700 } }, n.title));
    if (n.type === 'dungeon' && n.name) box.appendChild(h('div.tt-line', { style: { color: '#c8a8ff', fontWeight: 700 } }, n.name));
    if (n.type === 'dungeon' && n.fights && n.fights.length) {
      n.fights.forEach((f, i) => box.appendChild(h('div.tt-foes', h('span.k', `Fight ${i + 1}: ${enemies(f.length)}`), archChips(f))));
      if (n.bossArchetype) box.appendChild(h('div.tt-foes', h('span.k', 'Boss'), archChips([n.bossArchetype])));
    } else if (n.archetypes && n.archetypes.length) box.appendChild(h('div.tt-foes', h('span.k', `${n.type === 'grind' ? 'Wave 1' : n.type === 'treasure' ? 'Guard' : 'Foes'}: ${enemies(n.archetypes.length)}`), archChips(n.archetypes)));
    else if (n.type === 'treasure' && n.guarded === false) box.appendChild(h('div.tt-line', 'Unguarded'));
    if (n.type) box.appendChild(h('div.tt-line.desc', nodeDesc(n.type, ctx.data.rules)));
    if (n.lost) box.appendChild(h('div.tt-warn', 'Lost to the Dimming: it can no longer be done.'));
    else if (n.done) box.appendChild(h('div.tt-hint', 'Done'));
  }
  if (n.road) { const i = (mv.roads || []).indexOf(n.id); box.appendChild(h('div.tt-line', `${mv.roadNames && mv.roadNames[i] ? mv.roadNames[i] : 'A Road'}: leads to ${roadTo(v, ctx)}`)); }
  if (n.shardfall) box.appendChild(h('div.tt-line', mv.texts && mv.texts.shardfall ? mv.texts.shardfall : 'The Shardfall: the Dimming starts here.'));
  if (n.dimmed) box.appendChild(h('div.tt-warn', 'Dimmed: entering or staying here starts a fight with Shardspawn.'));
  else if (n.dimsIn != null && Number.isFinite(n.dimsIn)) box.appendChild(h(n.dimsIn <= 2 ? 'div.tt-warn' : 'div.tt-sub', `Dims in ${tolls(n.dimsIn)}`));
  for (const ln of siteLines(n, ctx.view, ctx)) box.appendChild(ln);
  if (spy.armed && !readOnly) { box.appendChild(h('div.tt-hint', 'Click to look here through the Spyglass')); return box; }
  if (m) {
    box.appendChild(h('div.tt-line', m.via === 'enter' ? 'Click to enter' : 'Click to walk here'));
    box.appendChild(previewBlock(heatOf(ctx.view, act), ctx));
    if (m.passTime != null) box.appendChild(h('div.tt-hint', 'Pass through it from the list of moves.'));
  } else if (here) box.appendChild(h('div.tt-hint', 'You are here'));
  else if (!readOnly) box.appendChild(h('div.tt-warn', 'Not next to you'));
  return box;
}
/** The tolls Travel on costs now, from the engine (a dry TRAVEL_ON); the mock's own number in mock mode. */
function travelCost(z, ctx) {
  const hrs = z.travelTime !== undefined ? z.travelTime : ctx.data.rules.time.travel;
  return hrs == null ? '' : hrs > 0 ? ` Costs ${tolls(hrs)}.` : ' Costs no time.';
}
function flagSvg() {
  const d = h('div.flagm');
  d.innerHTML = '<svg viewBox="0 0 24 30" width="100%" height="100%"><rect x="3" y="2" width="2.4" height="27" fill="#3a2410"/><path d="M5.4 3 L22 7 L5.4 13 Z" fill="#c0281a" stroke="#4a0a04" stroke-width="1"/></svg>';
  return d;
}
function closeBtn(ctx, win) { const b = h('button.xbtn', '×'); b.addEventListener('click', () => ctx.ui.closeWin(win)); return b; }

/**
 * Zone danger of a fight node (rules 7.6, M2 v3; dungeons M2 v4), or null: the extra damage of its enemies, n.danger
 * { lo, hi } from the engine's zoneDanger (the bridge). When the enemies differ, the line says "up to" the highest.
 */
function nodeDanger(n, r) {
  const d = n.danger;
  if (!d || !(d.hi > 0)) return null;
  return `Zone danger: enemies here deal ${d.hi > d.lo ? 'up to ' : ''}+${pct1(d.hi)} damage (above level ${r.dangerFrom}).`;
}

function nodeTip(n, v, ctx, reach, hp = null) {
  const p = v.player;
  const box = h('div.tt-node');
  box.appendChild(h('div.tt-row', h('div.tt-name', NODE_NAME[n.type] + (n.type === 'elite' && n.rare && n.rareVisible ? ' (rare)' : '')), h('div', { style: { color: NO_FIGHT.has(n.type) ? NEUTRAL : conColor(n.cl, p.level), fontWeight: 800 } }, `Level ${n.cl}`)));
  if (n.type === 'quest') add(box, h('div.tt-line', { style: { color: '#ffd88a', fontWeight: 700 } }, n.title), h('div.tt-sub', `From ${n.giver}`));
  if (n.type === 'elite') add(box, h('div.tt-line', { style: { color: '#ffb08a', fontWeight: 700 } }, n.eliteName || 'An elite'), n.level ? h('div.tt-sub', `Elite level ${n.level}`) : null);
  if (n.type === 'dungeon') add(box, h('div.tt-line', { style: { color: '#c8a8ff', fontWeight: 700 } }, n.dungeon), h('div.tt-sub', `Boss: ${n.bossName}`));
  // the enemies (combat v2, mapView): count and role badges per fight; a dungeon lists each trash fight and its boss
  if (n.type === 'dungeon' && n.fights && n.fights.length) {
    n.fights.forEach((f, i) => box.appendChild(h('div.tt-foes', h('span.k', `Fight ${i + 1}: ${enemies(f.length)}`), archChips(f))));
    if (n.bossArchetype) box.appendChild(h('div.tt-foes', h('span.k', `Boss: ${n.bossName || 'the boss'}`), archChips([n.bossArchetype])));
  } else if (n.archetypes && n.archetypes.length) {
    box.appendChild(h('div.tt-foes', h('span.k', `${n.type === 'grind' ? 'Wave 1' : n.type === 'treasure' ? 'Guard' : 'Foes'}: ${enemies(n.archetypes.length)}`), archChips(n.archetypes)));
  } else if (n.type === 'treasure' && n.guarded === false) box.appendChild(h('div.tt-line', 'Unguarded'));
  else if (n.enemyNames && n.enemyNames.length) box.appendChild(h('div.tt-line.foes', `Foes: ${n.enemyNames.join(', ')}`)); // mock engine: names only
  box.appendChild(h('div.tt-line.desc', nodeDesc(n.type, ctx.data.rules)));
  const danger = nodeDanger(n, ctx.data.rules);
  if (danger) box.appendChild(h('div.tt-warn.danger', danger));
  // the tolls: from the heat preview when the node can be entered now (R.heatView, the engine's tolls and the state the
  // node ends in, H.4), else the node type's tolls
  const hrs = ctx.data.nodeTime ? ctx.data.nodeTime[n.type] : null;
  if (hp) box.appendChild(previewBlock(hp, ctx));
  else if (hrs != null) box.appendChild(h('div.tt-sub', n.type === 'grind' ? `Takes ${tolls(hrs)} per wave` : `Takes ${tolls(hrs)}`));
  const H = ctx.data.rules.heat;
  if (n.visited && n.heat && H) box.appendChild(h('div.tt-sub', `Entered ${HEAT_NAME[n.heat]}${H.gain[n.heat] > 0 || H.rarityUp[n.heat] > 0 ? ': it paid heat spoils' : ''}`));
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
  // a node entered Hot or Scorched shows what it pays (its entry state, rules 1.7.3) in the dialog's title
  const hb = heatBadge(n.heat, ctx);
  if (n.type === 'quest' && n.step === 'intro') {
    return dialog(n.title, `Quest · level ${n.cl}`, [
      h('div.qtext.parchment', h('div.giver', `${n.giver} says:`), h('div', `“${n.text}”`)),
      h('div.subtitle', 'Enemies'), foeList(v, n.mobs, ctx),
      h('div.dim', { style: { fontSize: '1.2rem' } }, 'Reward: experience, gold and a choice of two items.'),
    ], [btn('Accept', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left, badge: hb });
  }
  if (n.type === 'grind' && n.step === 'intro') {
    const R = ctx.data.rules;
    // the waves on offer are the engine's (heatView lists GRIND_SET_WAVES per legal n) with their tolls and the state they
    // end in; without heat (mock) the rules table's
    const offered = v.heat ? (v.heat.list || []).filter((x) => x.action.type === 'GRIND_SET_WAVES').map((x) => x.action.n) : [];
    const ks = offered.length ? offered : Array.from({ length: R.grindMaxWaves }, (_, i) => i + 1);
    const w = (k) => {
      const a = { type: 'GRIND_SET_WAVES', n: k }; const hp = heatOf(v, a);
      const b = btn('', () => ctx.act(a), k === Math.min(2, ks.length) ? '.primary' : '');
      b.append(`${k} wave${k > 1 ? 's' : ''} · `, tollLabel(h('span.bh', tolls(hp ? hp.time : k * R.time.grindWave)), hp));
      if (hp) { tip(b, () => previewBlock(heatOf(ctx.view, a), ctx)); ghostOn(b, ctx, a); }
      return b;
    };
    const waves = ks.map(w);
    return dialog('Grind', `Level ${n.cl}`, [h('div.dim', { style: { fontSize: '1.35rem' } }, nodeDesc('grind', R)), h('div.subtitle', 'Enemies'), foeList(v, n.mobs, ctx), h('div.muted', 'You can stop after any wave.')], waves, { left, badge: heatBadge(n.heat, ctx) });
  }
  if (n.type === 'elite' && n.step === 'intro') {
    const e = n.elite || {};
    return dialog(n.eliteName, `${n.rare ? 'Rare elite' : 'Elite'} · level ${n.cl}`, [
      e.text ? h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, e.text) : null,
      h('dl.kv', h('dt', 'Threat'), h('dd.bad', 'High: elites hit hard and have special abilities'), h('dt', 'Reward'), h('dd', 'Large experience, gold and a guaranteed good item'), n.add ? h('dt', 'Escort') : null, n.add ? h('dd', n.add.name) : null),
    ], [btn('Engage', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left, badge: h('span.row', { style: { gap: '.5rem' } }, hb, h('span.rank-tag' + (n.rare ? '.rare' : ''), n.rare ? 'Rare' : 'Elite')) });
  }
  if (n.type === 'dungeon' && n.step === 'intro') {
    return dialog(n.dungeon, `Dungeon · level ${n.cl}`, [
      n.dungeonText ? h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, n.dungeonText) : null,
      h('dl.kv', h('dt', 'Fights'), h('dd', `${ctx.data.rules.dungeonTrashFights} groups, then ${n.bossName}`), h('dt', 'Between fights'), h('dd', 'You may eat, change gear, or leave with what you have'), h('dt', 'Warning'), h('dd.bad', 'No fleeing from the dungeon boss')),
    ], [btn('Enter the dungeon', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left, badge: hb });
  }
  if (n.type === 'treasure' && n.step === 'intro') {
    return dialog('Treasure', `Level ${n.cl}`, [h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, n.text || ''), h('div.warn', `A guardian watches the chest: ${n.guard ? n.guard.name : 'an enemy'}.`)], [btn('Fight the guardian', () => ctx.act({ type: 'ACCEPT' }), '.primary')], { left, badge: hb });
  }
  if (n.type === 'treasure' && n.step === 'chest') {
    return dialog('Treasure', `Level ${n.cl}`, [h('div', { style: { font: 'italic 1.45rem var(--font-title)', color: 'var(--ink-dim)' } }, n.text || 'The chest is yours.')], [btn('Open the chest', () => ctx.act({ type: 'OPEN_CHEST' }), '.primary')], { left, badge: hb });
  }
  if (n.step === 'between') {
    const hpTxt = `Health ${fmtNum(p.hp)} / ${fmtNum(p.maxHp)}${p.res.kind === 'mana' ? ` · Mana ${fmtNum(p.res.cur)} / ${fmtNum(p.res.max)}` : ''}`;
    const rations = p.bag.find((s) => s && s.id === 'trail_rations');
    const eat = rations ? btn(`Eat Trail Rations (${rations.count})`, () => ctx.act({ type: 'USE_ITEM', uid: rations.uid })) : null;
    // the next fight: a Grind wave costs tolls (heatView's NEXT_FIGHT); the dungeon's fights cost none
    const next = (label) => { const b = btn(label, () => ctx.act({ type: 'CONTINUE' }), '.primary'); const hp = heatOf(v, { type: 'NEXT_FIGHT' }); if (hp) { tip(b, () => previewBlock(heatOf(ctx.view, { type: 'NEXT_FIGHT' }), ctx)); ghostOn(b, ctx, { type: 'NEXT_FIGHT' }); } return b; };
    if (n.type === 'grind') return dialog('Grind', `Wave ${n.waves} of ${n.wavesChosen} done`, [h('div.dim', hpTxt)], [eat, btn('Stop here', () => ctx.act({ type: 'GRIND_STOP' })), next('Next wave')].filter(Boolean), { left, badge: hb });
    const trash = ctx.data.rules.dungeonTrashFights; // the boss is fight trash + 1
    return dialog(n.dungeon, `Fight ${n.fightNo} of ${trash + 1} cleared`, [h('div.dim', hpTxt), n.fightNo === trash ? h('div.warn', `Next: ${n.bossName}. There is no fleeing from the boss.`) : null],
      [eat, btn('Leave the dungeon', () => ctx.act({ type: 'DUNGEON_LEAVE' })), next(n.fightNo === trash ? 'Face the boss' : 'Press on')].filter(Boolean), { left, badge: hb });
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
  // spoils of a node entered Hot or Scorched (its heat state, rules 1.7.3): a badge by the title
  win.appendChild(h('div.wtitle', h('div.row', { style: { gap: '.8rem', alignItems: 'center' } }, h('div.title', L.title || 'Loot'), heatBadge(v.node && v.node.heat, ctx)), closeLootBtn(ctx)));
  const rows = h('div.rows');
  if (L.gold) rows.appendChild(h('div.lrow', { style: { cursor: 'default' } }, h('img', { src: icon('coin', 'gold'), alt: '' }), h('div', h('div.nm', moneyEl(L.gold)), h('div.meta', 'Coins (already in your purse)'))));
  if (L.xp) rows.appendChild(h('div.lrow', { style: { cursor: 'default' } }, h('img', { src: icon('stars3', 'epic'), alt: '' }), h('div', h('div.nm', { style: { color: '#d0a8ff' } }, `${fmtNum(L.xp)} experience`), h('div.meta', 'Earned in this fight'))));
  if (L.trap) rows.appendChild(h('div.lrow', { style: { cursor: 'default' } }, h('img', { src: icon('trap', 'blood'), alt: '' }), h('div', h('div.nm.bad', 'A needle trap!'), h('div.meta', 'You lost some health opening it.'))));
  (L.items || []).forEach((it, i) => {
    const up = it.kind === 'gear' && ctx.bridge.itemScore(it) > ctx.bridge.itemScore(p.equip[it.slot]);
    const meta = it.kind === 'gear' ? `${cap(it.slot)} · ilvl ${it.ilvl}` : it.kind === 'junk' ? 'Junk' : 'Consumable';
    const tag = it.inBag ? h('span.good', ' · in your bags') : up ? h('span.good', ' · ▲ upgrade') : null;
    const r = h('div.lrow.' + (it.rarity || 'common'), h('img', { src: itemIcon(it), alt: '' }), h('div.grow', h('div.nm.r-' + it.rarity, it.name + (it.count > 1 ? ` ×${it.count}` : ''), it.heatUp ? heatBadge(it.heatUp, ctx, 'item') : null), h('div.meta', meta, tag)));
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
    const c = h('div.icard', h('img', { src: itemIcon(it), alt: '' }), h('div', h('div.nm.r-' + it.rarity, it.name, it.heatUp ? heatBadge(it.heatUp, ctx, 'item') : null), h('div.meta', `${cap(it.slot)} · item level ${it.ilvl}`), h('div.stats', stats || ' '), h('div.upg.' + (up > 0 ? 'good' : 'muted'), up > 0 ? `▲ Upgrade (+${Math.round(up * 10) / 10})` : 'Not an upgrade')));
    c.addEventListener('click', () => ctx.act({ type: 'CHOOSE_REWARD', i }));
    tip(c, () => itemTip(it, ctx, { hint: 'Click to choose this reward' }));
    return c;
  }));
  if (L.kind === 'contract') {
    // a completed contract (expedition.md 3.1, 9.3): paid at once on its last site; its item choice as the story's
    const c = L.contract;
    const head = h('div.qtext.parchment.ctr', c ? h('div.giver', h('img', { src: kindIcon(c.kind), alt: '' }), contractTitle(c, ctx.data.content)) : null, h('div.turnin', `“A runner from ${L.hubName || 'the hub'} brings your pay. Well done.”`));
    if (c) tip(head, () => contractTip(c, ctx, { status: 'Complete' }));
    return dialog('Contract complete', c ? `Zone ${c.z} · ${c.zoneName}` : '', [head,
      h('div.row', { style: { gap: '2rem' } }, L.xp ? h('span', { style: { color: '#d0a8ff', fontWeight: 700, fontSize: '1.35rem' } }, `+${fmtNum(L.xp)} XP`) : null, L.gold ? h('span', moneyEl(L.gold)) : null),
      h('div.subtitle', 'Choose one reward'), cards,
      p.bag.every(Boolean) ? h('div.warn', 'Your bags are full: discard something first (B).') : null,
    ], [], { style: { width: '60rem' }, cls: 'contract-reward' });
  }
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
    h('div.subtitle', `${s.name} · level ${s.level} ${s.className}${s.petId ? ' with ' + ctx.data.pets[s.petId].name : ''} · ${s.zone}`),
    // a dev run (engine-api.md 12): the dev tools changed it, so it earns no Echoes
    s.dev ? h('div.devrun', `Dev run${s.dev.god ? ' · god mode' : ''}`) : null));
  const kv = (pairs) => h('dl.kv', pairs.flatMap(([k, val]) => [h('dt', k), h('dd', val)]));
  const card1 = h('div.card', h('h3', 'The journey'), kv([
    ['Reached', `${s.zone}${s.row ? `, row ${s.row}` : ''}`], [HEAT_WORDS.Units, `${fmtTime(s.time)}${s.par ? ` (par ${fmtTime(s.par)})` : ''}`], ['Ascendancy', s.asc ? `+${Math.round(s.asc * 100)} %` : 'none'],
    ['Estimated time', `${s.estMinutes.manual} min manual · ${s.estMinutes.auto} min autoplay`], ['Fights', `${s.fights} (${s.rounds} rounds)`], ['Seed', String(s.seed)],
    // the killing blow by its display name (the bridge's actionName; without a name only the killer)
    ...(s.death ? [['Killed by', h('span.killed', { dataset: { ability: s.death.ability || '' } }, s.death.ability ? `${s.death.killer} (${s.death.ability})` : s.death.killer)], ['Where', `${s.death.node}, round ${s.death.round}`]] : []),
  ]));
  const card2 = h('div.card', h('h3', 'Deeds'), kv([
    ['Kills', `${s.kills.normal} normal · ${s.kills.elite} elite · ${s.kills.rare} rare · ${s.kills.boss} boss`], ['Quests', s.contracts ? String(s.quests) : `${s.quests} (${s.story} stories)`],
    // contracts (expedition.md 8.1; prep): the summary's expedition.contracts
    ...(s.contracts ? [['Contracts', `${s.contracts.completed} of ${s.contracts.taken} completed${s.contracts.expired ? ` · ${s.contracts.expired} expired` : ''}${s.contracts.abandoned ? ` · ${s.contracts.abandoned} given up` : ''} · Reserve left ${s.contracts.reserve}`]] : []),
    ['Dungeons cleared', String(s.dungeons)],
    ['Gold', `earned ${moneyText(s.goldEarned)} · spent ${moneyText(s.goldSpent)}`], ['Potions used', String(s.potions)], ['Resurrections', String(s.resurrects)],
    ['Damage', `dealt ${fmtNum(s.dealt)} · taken ${fmtNum(s.taken)}`], ['Top spells', s.topSpells.map(([n, d]) => `${n} ${fmtNum(d)}`).join(', ') || '—'],
  ]), h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.8rem' } }, s.equipped.map((it) => tip(h('div.slot.q-' + it.rarity, h('img', { src: itemIcon(it), alt: '' })), () => itemTip(it, ctx, { compare: false })))));
  // Echoes (rules 11.1): the engine's lines; the balance after the run from the bridge's dry END_RUN (view.meta.after)
  const after = v.meta && v.meta.after;
  const oathLine = s.echoMult && s.echoMult !== 1 ? h('div.echo', h('span.dim', `${s.oaths.join(', ')}`), h('b', `×${Math.round(s.echoMult * 100) / 100}`)) : null;
  const devLine = s.dev ? h('div.echo.devline', h('span', `A dev run earns no Echoes (${s.dev.withheld} withheld)`)) : null;
  const card3 = h('div.card', h('h3', 'Echoes earned'), s.echoes.map(([k, n]) => h('div.echo', h('span.dim', k), h('b', `+${n}`))), oathLine, devLine, h('div.echo.total', h('span', 'Total'), h('span', `${s.echoTotal} Echoes`)),
    after ? h('div.echo.after', h('span.dim', 'Your Echoes after this run'), echoAmt(after.echoes)) : null,
    h('div.muted', { style: { marginTop: '.8rem', fontSize: '1.1rem' } }, after
      ? (after.affordable ? `Echoes buy lasting unlocks between runs. ${cap(numWord(after.affordable))} ${plural(after.affordable, 'unlock')} within reach.` : 'Echoes buy lasting unlocks between runs. Keep them for the next one.')
      : 'Echoes buy lasting unlocks between runs.'));
  // heat (H.4, engine-api.md 11.3): the tolls-against-the-line track per zone, tolls by state, the end against the line or the par
  win.appendChild(h('div.sbody', card1, card2, card3, s.heat ? buildHeatSummary(s, ctx) : null));
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
