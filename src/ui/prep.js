// prep.js - the start camp and the contracts on screen (docs/specs/expedition.md 2, 3, 9.1, 9.3; engine-api.md 13; M2b
// 2b.6). The prep screen of an expedition run with the start camp (phase PREP): the points left in large type, the
// contract board (take, drop, reroll), supplies and vision perks with their prices and refunds, what the expedition holds
// and the Reserve preview, and Set out, always in view at the bottom right. Every number comes from R.prepView (the
// bridge's view.prep); radii and limits from the rules table (data.rules.prep). Mouse: click a card. Keys: 1-8 a contract,
// A-I an option, R reroll, Enter set out; Tab moves between the cards. The contract tracker: one line per contract of the
// zone under the minimap (HUD), the full list in the quest log (L), each contract's tooltip, the hub's contract offer
// (take it from Reserve or swap a held one) and the site marks on the expedition map (mapView node `sites`: only the
// marks the player sees; a hidden node is never named). Presentation only: every click sends one engine action.
import { h, clear, moneyEl } from './util.js';
import { icon, consumableIcon } from './art-icons.js';
import { tip } from './tooltip.js';
import {
  CONTRACT_KIND, contractTitle, contractSentence, familyName, hubOfferSentence, contractKindText, contractSitesText,
  contractItemsText, levelsText, prepOptionEffect, prepFlavour, bandText, numWord, plural,
} from './ui-text.js';

/** Contract colours (map marks, tracker dots, the held list): amber, teal, violet, rose. */
export const CONTRACT_COLORS = ['#f2b64c', '#4fcab6', '#b98cff', '#ff8a7a'];
const OFF_COLOR = '#8a7c66';
/**
 * Each held contract's colour: the colour of its number (k1 amber, k2 teal, ...), the next free one when two held
 * contracts would share one. cv: R.contractView (view.contracts). Contracts no longer held are grey.
 */
export function contractColors(cv) {
  const out = new Map(); if (!cv) return out;
  const used = new Set();
  for (const c of cv.contracts) {
    if (c.status !== 'active' && c.status !== 'later') { out.set(c.id, OFF_COLOR); continue; }
    const n = Number(String(c.id).replace(/\D/g, '')) || 1;
    let k = (n - 1) % CONTRACT_COLORS.length;
    for (let i = 0; i < CONTRACT_COLORS.length && used.has(k); i++) k = (k + 1) % CONTRACT_COLORS.length;
    used.add(k); out.set(c.id, CONTRACT_COLORS[k]);
  }
  return out;
}
const KIND_ICON = { cull: ['grind', 'blood'], bounty: ['elite', 'fire'], delve: ['dungeon', 'arcane'] };
export const kindIcon = (k) => icon(...(KIND_ICON[k] || ['quest', 'parchment']));
const OPT_ICON = {
  prep_draughts: () => consumableIcon('healing_draught'), prep_rations: () => consumableIcon('trail_rations'), prep_ember: () => consumableIcon('ember_of_return'),
  prep_bell: () => icon('bell', 'gold'), prep_mule: () => icon('junk', 'earth'), prep_charts: () => icon('chart', 'parchment'),
  prep_tracker: () => icon('step', 'nature'), prep_guide: () => icon('eye', 'frost'), prep_spyglass: () => icon('spyglass', 'steel'),
};
const optIcon = (id) => (OPT_ICON[id] ? OPT_ICON[id]() : icon('spark', 'gold'));
const BOARD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const OPT_KEYS = 'ABCDEFGHI';
const STATUS_WORD = { active: 'This zone', later: 'Later zone', complete: 'Complete', expired: 'Expired', abandoned: 'Given up' };
const pts = (n) => `${n} ${plural(n, 'point')}`;
const consName = (ctx) => (id) => (ctx.data.consumables[id] || {}).name || id;

// ------------------------------------------------------------------ tooltips
/**
 * A contract's tooltip: its sentence, zone and band, where its sites are and when the map shows them, what it pays, and
 * a state or action line. opts: { has: { guide, tracker }, price, hint, warn, status, progress, r (rules prep block) }.
 */
export function contractTip(c, ctx, opts = {}) {
  const r = opts.r || ctx.data.rules.prep || { vision: 1, guide: 1, tracker: 2, bountyPlaced: 2 };
  const rw = c.reward || {};
  const box = h('div.tt-contract',
    h('div.tt-row', h('div.tt-name', contractTitle(c, ctx.data.content)), h('span.ctag', { dataset: { kind: c.kind } }, CONTRACT_KIND[c.kind] || c.kind)),
    h('div.tt-sub', `Zone ${c.z} · ${c.zoneName} · ${bandText(c.band)} · ${c.need} ${plural(c.need, 'site')}`),
    h('div.tt-line.desc', contractSentence(c, ctx.data.content)),
    h('div.tt-line', contractSitesText(c, r, opts.has || {})));
  if (rw.choices) {
    box.appendChild(h('div.tt-line.num', 'Pays at once on its last site: ', h('b', levelsText(rw.xpFrac)), ` at level ${rw.cl} (less when you are above it), `, moneyEl(rw.gold), `, and ${contractItemsText(rw)}.`));
  }
  if (opts.progress) box.appendChild(h('div.tt-line', opts.progress));
  if (opts.status) box.appendChild(h('div.tt-sub', opts.status));
  if (opts.price) box.appendChild(h('div.tt-sub', opts.price));
  if (opts.warn) box.appendChild(h('div.tt-warn', opts.warn));
  if (opts.hint) box.appendChild(h('div.tt-hint', opts.hint));
  return box;
}
function optionTip(o, ctx, key, why) {
  const r = ctx.data.rules.prep;
  const fl = prepFlavour(o.id, ctx.data.content);
  return h('div.tt-contract',
    h('div.tt-row', h('div.tt-name', o.name), h('span.ctag', { dataset: { kind: o.kind } }, o.kind === 'vision' ? 'Sight' : 'Supply')),
    h('div.tt-line', prepOptionEffect(o, r, consName(ctx), ctx.data.content)),
    fl ? h('div.tt-line.flav', fl) : null,
    h('div.tt-sub', o.owned ? 'Owned already (Hall of Echoes or the run\'s options): nothing to buy.' : `${pts(o.price)}${o.kind === 'vision' ? ', for the whole run' : ', in effect when you set out'} · sold back for a full refund until you set out`),
    !o.owned && !o.bought && why ? h('div.tt-warn', why) : null,
    o.owned ? null : h('div.tt-hint', o.bought ? `Click or press ${key} to sell it back (+${pts(o.price)})` : `Click or press ${key} to buy it`));
}

// ------------------------------------------------------------------ the prep screen
/** Has the run the perk (owned from meta or bought now)? For the sites lines of the board's tooltips. */
const hasPerks = (pv) => {
  const on = (id) => { const o = pv.options.find((x) => x.id === id); return !!(o && (o.owned || o.bought)); };
  return { guide: on('prep_guide'), tracker: on('prep_tracker') };
};

/**
 * The start camp screen (expedition.md 9.1): built once per run's PREP, then patched on every view (update), so focus and
 * hover stay on the card the player is using. Returns the root with root.update(v).
 */
export function createPrepScreen(v, ctx) {
  const root = h('div#prep', { dataset: { mounted: String(performance.now()) } });
  const pv0 = v.prep;
  const zone1 = (pv0.board.find((o) => o.z === 1) || pv0.board[0] || {}).zoneName || 'the first zone';
  root.appendChild(h('div.pp-head',
    h('div', h('div.pp-t1', 'The start camp'), h('div.pp-t2', `Before the road to ${zone1}: choose your contracts, supplies and sight. Points you keep become Reserve.`)),
    h('div.pp-keys', h('span.kbd', '1–8'), 'contracts', h('span.kbd', 'A–I'), 'supplies and sight', h('span.kbd', 'R'), 'reroll', h('span.kbd', 'Enter'), 'set out')));
  // column 1: the contract board
  const reroll = h('button.btn.small#pp-reroll', { type: 'button' });
  reroll.addEventListener('click', () => { reroll.blur(); ctx.act({ type: 'REROLL_BOARD' }); });
  tip(reroll, () => {
    const pv = ctx.view.prep; if (!pv) return null; const why = pv.reroll.can ? null : ctx.bridge.why({ type: 'REROLL_BOARD' });
    return h('div', h('div.tt-name', 'Reroll the board'), h('div.tt-line', `New offers for every contract you have not taken. ${pts(pv.reroll.price)}, not refunded.`),
      h('div.tt-sub', `${pv.reroll.max - pv.reroll.used} of ${pv.reroll.max} rerolls left`), why ? h('div.tt-warn', why) : h('div.tt-hint', 'Click or press R'));
  });
  const slotsEl = h('span.pp-slots');
  const cards = h('div.pp-cards');
  const cardEls = pv0.board.map((o, i) => {
    const b = h('button.pp-card', { type: 'button', dataset: { index: String(i) } });
    // a mouse click leaves no focus behind (Enter then sets out); a keyboard press (Tab, then Enter or Space) keeps it
    b.addEventListener('click', (e) => { if (e.detail) b.blur(); boardAct(ctx, i); });
    tip(b, () => {
      const pv = ctx.view.prep; const x = pv && pv.board[i]; if (!x) return null;
      const why = x.taken || x.canTake ? null : ctx.bridge.why({ type: 'TAKE_CONTRACT', index: i });
      return contractTip(x, ctx, { has: hasPerks(pv), price: `${pts(x.price)} · refunded if you drop it before you set out`, warn: why,
        hint: x.taken ? `Click or press ${BOARD_KEYS[i]} to drop it (+${pts(x.price)})` : `Click or press ${BOARD_KEYS[i]} to take it` });
    });
    cards.appendChild(b);
    return b;
  });
  const board = h('section.pp-board.panel', h('div.pp-sh', h('div', h('div.title', 'Contract board'), h('div.pp-sub', slotsEl)), reroll), cards);
  // column 2: supplies and vision perks
  const optEls = new Map();
  const optList = (kind) => h('div.pp-opts', pv0.options.filter((o) => o.kind === kind).map((o) => {
    const i = pv0.options.findIndex((x) => x.id === o.id);
    const b = h('button.pp-opt', { type: 'button', dataset: { id: o.id, kind: o.kind } });
    b.addEventListener('click', (e) => { if (e.detail) b.blur(); optionAct(ctx, o.id); });
    tip(b, () => { const pv = ctx.view.prep; const x = pv && pv.options.find((y) => y.id === o.id); return x ? optionTip(x, ctx, OPT_KEYS[i], x.why ? cap1(x.why) : null) : null; });
    optEls.set(o.id, { el: b, key: OPT_KEYS[i] });
    return b;
  }));
  const shop = h('section.pp-shop.panel',
    h('div.pp-sh', h('div', h('div.title', 'Supplies'), h('div.pp-sub', 'Into your bags when you set out'))), optList('supply'),
    h('div.pp-sh', h('div', h('div.title', 'Sight'), h('div.pp-sub', 'Vision perks for the whole run'))), optList('vision'));
  // column 3: your expedition
  const big = h('b.pm-n'); const of = h('span.pm-of'); const pips = h('div.pm-pips');
  const held = h('ol.pm-held'); const bought = h('div.pm-bought'); const reserve = h('div.pm-reserve');
  const mine = h('section.pp-mine.panel',
    h('div.pp-sh', h('div.title', 'Your expedition')),
    h('div.pm-points', big, h('div', h('div.pm-l', 'points left'), of)), pips,
    h('div.pm-h', 'Contracts'), held, h('div.pm-h', 'Supplies and sight'), bought, reserve);
  root.appendChild(h('div.pp-cols', board, shop, mine));
  // Set out: always in view, bottom right (QA finding BUG-QA-10)
  const go = h('button.btn.primary.big#pp-go', { type: 'button' }, 'Set out', h('span.k', 'Enter'));
  go.addEventListener('click', () => { go.blur(); ctx.act({ type: 'SET_OUT' }); });
  tip(go, () => {
    const pv = ctx.view.prep; if (!pv) return null;
    return h('div', h('div.tt-name', 'Set out'), h('div.tt-line', `Leave the camp for ${zone1}. Supplies go into your bags and the perks last the run.`),
      h('div.tt-line.num', pv.left ? `${pts(pv.left)} unspent become Reserve: ${pv.reserve.echoes} Echoes at the end of the run, or hub contracts on the way.` : 'Every point is spent: no Reserve.'),
      pv.held ? null : h('div.tt-warn', 'You hold no contract: the zones then pay only what you find.'));
  });
  root.appendChild(h('div.pp-foot', go));

  let last = null;
  root.update = (vv) => {
    const pv = vv.prep; if (!pv) return;
    const prev = last; last = pv;
    if (!prev || prev.left !== pv.left) { big.textContent = String(pv.left); if (prev) { big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); } }
    of.textContent = `of ${pv.points}${pv.spent ? ` · ${pv.spent} spent` : ''}`;
    clear(pips); for (let k = 0; k < pv.points; k++) pips.appendChild(h('i' + (k < pv.left ? '.on' : '')));
    slotsEl.textContent = `${pv.held} of ${pv.slots} contract slots used · one offer per zone, the rest for any zone`;
    reroll.textContent = ''; reroll.append(`Reroll · ${pts(pv.reroll.price)}`, h('span.pp-left', `${pv.reroll.max - pv.reroll.used} left`), h('span.k', 'R'));
    reroll.disabled = false; reroll.classList.toggle('disabled', !pv.reroll.can);
    const colors = contractColors(vv.contracts);
    pv.board.forEach((o, i) => {
      const b = cardEls[i]; if (!b) return;
      const sig = JSON.stringify(o);
      if (b.dataset.sig === sig) return;
      const was = b.dataset.taken === '1';
      b.dataset.sig = sig; b.dataset.kind = o.kind; b.dataset.zone = String(o.z); b.dataset.taken = o.taken ? '1' : '0';
      b.classList.toggle('taken', o.taken); b.classList.toggle('cant', !o.taken && !o.canTake);
      const held1 = o.taken && vv.contracts ? vv.contracts.contracts.find((c) => c.status !== 'abandoned' && c.from === 'board' && c.z === o.z && c.kind === o.kind && c.region === o.region && c.family === o.family && c.template === o.template) : null;
      b.style.setProperty('--cc', held1 ? colors.get(held1.id) || OFF_COLOR : 'transparent');
      b.setAttribute('aria-label', `${contractTitle(o, ctx.data.content)}, zone ${o.z}, ${pts(o.price)}${o.taken ? ', taken' : ''}`);
      clear(b).append(
        h('div.pc-top', h('span.kbd', BOARD_KEYS[i]), h('span.pc-zone', `Zone ${o.z} · ${o.zoneName}`), h('span.pc-band', `${o.band[0]}–${o.band[1]}`), h('span.pc-price', { title: '' }, String(o.price))),
        h('div.pc-kind', h('img', { src: kindIcon(o.kind), alt: '' }), h('b', CONTRACT_KIND[o.kind] || o.kind), h('span.pc-need', `${o.need} ${plural(o.need, 'site')}`)),
        // the target on one line, where it is on the next (a long Bounty never runs into the pay line)
        h('div.pc-target', o.kind === 'delve' ? o.dungeon || "the zone's dungeon" : o.kind === 'bounty' ? o.name || 'a named elite' : familyName(o.family, ctx.data.content)),
        h('div.pc-where', o.kind === 'delve' ? `the dungeon of ${o.zoneName}` : `${o.kind === 'bounty' ? 'roaming' : 'in'} ${o.regionName || 'its region'}`),
        h('div.pc-reward', h('span.xp', levelsText(o.reward.xpFrac)), moneyEl(o.reward.gold), h('span.it', h('i.r-rare', '◆'), h('i.r-epic', '◆'), ` 1 of ${o.reward.choices}`)),
        h('div.pc-act', o.taken ? [h('span.seal', h('img', { src: icon('seal', 'blood'), alt: '' }), 'Taken'), h('span.pc-btn', 'Drop')] : h('span.pc-btn', 'Take')));
      if (o.taken && !was && prev) { b.classList.remove('stamp'); void b.offsetWidth; b.classList.add('stamp'); }
    });
    for (const o of pv.options) {
      const x = optEls.get(o.id); if (!x) continue;
      const sig = JSON.stringify(o); if (x.el.dataset.sig === sig) continue;
      x.el.dataset.sig = sig;
      x.el.classList.toggle('bought', o.bought); x.el.classList.toggle('owned', o.owned); x.el.classList.toggle('cant', !o.bought && !o.owned && !o.canBuy);
      x.el.disabled = o.owned;
      x.el.setAttribute('aria-label', `${o.name}, ${o.owned ? 'owned' : o.bought ? 'bought' : pts(o.price)}`);
      clear(x.el).append(h('img', { src: optIcon(o.id), alt: '' }),
        h('div.po-txt', h('div.po-nm', o.name, h('span.kbd', x.key)), h('div.po-fx', prepOptionEffect(o, ctx.data.rules.prep, consName(ctx), ctx.data.content))),
        h('div.po-right', o.owned ? h('span.po-own', 'Owned') : [h('span.pc-price', String(o.price)), h('span.po-act', o.bought ? 'Sell' : 'Buy')]));
    }
    // your expedition: held contracts in slot order, empty slots, purchases, the Reserve preview
    clear(held);
    const list = (vv.contracts ? vv.contracts.contracts : []).filter((c) => c.status === 'active' || c.status === 'later');
    for (let k = 0; k < pv.slots; k++) {
      const c = list[k];
      if (!c) { held.appendChild(h('li.empty', 'Empty slot')); continue; }
      const li = h('li', { style: { '--cc': colors.get(c.id) || OFF_COLOR }, dataset: { contract: c.id } }, h('i.dot'), h('span.z', `Zone ${c.z}`), h('span.t', contractTitle(c, ctx.data.content)));
      tip(li, () => contractTip(c, ctx, { has: hasPerks(ctx.view.prep || pv) }));
      held.appendChild(li);
    }
    clear(bought);
    const got = pv.options.filter((o) => o.bought || o.owned);
    if (!got.length) bought.appendChild(h('div.muted', 'Nothing yet.'));
    for (const o of got) bought.appendChild(h('span.pm-chip' + (o.owned ? '.own' : ''), h('img', { src: optIcon(o.id), alt: '' }), o.name, o.owned ? h('i', ' (owned)') : null));
    clear(reserve).append(h('div.pm-rl', `Unspent: ${pts(pv.reserve.points)} = ${pv.reserve.echoes} Echoes, usable at hubs`),
      h('div.muted', 'Reserve pays for a hub contract on the way; what is left at the end of the run becomes Echoes.'));
  };
  root.update(v);
  return root;
}
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Take or drop board contract i (the engine says why when it cannot). */
function boardAct(ctx, i) {
  const pv = ctx.view.prep; const o = pv && pv.board[i]; if (!o) return;
  ctx.act(o.taken ? { type: 'DROP_CONTRACT', index: i } : { type: 'TAKE_CONTRACT', index: i });
}
/** Buy or sell option id; an owned perk only says so. */
function optionAct(ctx, id) {
  const pv = ctx.view.prep; const o = pv && pv.options.find((x) => x.id === id); if (!o) return;
  if (o.owned) { ctx.toast(`${o.name}: owned already`, 'info'); return; }
  ctx.act(o.bought ? { type: 'SELL_PREP', id } : { type: 'BUY_PREP', id });
}

/**
 * Keys on the prep screen (expedition.md 9.1): 1-8 take or drop a contract, A-I buy or sell an option, R reroll, Enter
 * set out (not within PREP_ENTER_GUARD_MS of the screen opening, never on a held key, so the Enter that started the run
 * cannot also end the camp). Tab, Space and Enter on a focused card work as the browser's own. Returns true when handled.
 */
export function prepKey(e, ctx) {
  const v = ctx.view; const pv = v.prep; if (!pv) return false;
  const code = e.code;
  const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('#prep button');
  if (code === 'Tab') return 'native';
  if ((code === 'Space' || code === 'Enter') && focused) return 'native';
  if (/^Digit[1-8]$/.test(code)) { e.preventDefault(); boardAct(ctx, Number(code[5]) - 1); return true; }
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter && OPT_KEYS.includes(letter[1])) { e.preventDefault(); const o = pv.options[OPT_KEYS.indexOf(letter[1])]; if (o) optionAct(ctx, o.id); return true; }
  if (code === 'KeyR') { e.preventDefault(); ctx.act({ type: 'REROLL_BOARD' }); return true; }
  if (code === 'Enter' || code === 'NumpadEnter') {
    e.preventDefault();
    const el = document.getElementById('prep');
    const age = el ? performance.now() - Number(el.dataset.mounted || 0) : 0;
    if (e.repeat || age < PREP_ENTER_GUARD_MS) return true;
    ctx.act({ type: 'SET_OUT' });
    return true;
  }
  if (code === 'Space') { e.preventDefault(); return true; }
  return true; // the game's other keys (spells, windows) do nothing at the camp
}
const PREP_ENTER_GUARD_MS = 700;

// ------------------------------------------------------------------ the tracker (HUD), the quest log, the hub, the map
/** "1 / 2 sites", "Complete", ... for a contract of the tracker. */
export function progressText(c) {
  if (c.status === 'complete') return 'Complete';
  if (c.status === 'expired' || c.status === 'abandoned') return STATUS_WORD[c.status];
  return `${c.progress} / ${c.need} ${plural(c.need, 'site')}`;
}
/**
 * The tracker's contract lines (expedition.md 9.3): the current zone's contracts pinned under the minimap (dot in the
 * contract's colour, title, progress), then how many wait for later zones. [] when the run has no start camp.
 */
export function trackerContracts(v, ctx) {
  const cv = v.contracts; if (!cv) return [];
  const z = v.zone && !v.zone.camp ? v.zone.idx : null;
  const colors = contractColors(cv);
  const here = cv.contracts.filter((c) => c.z === z && c.status !== 'abandoned');
  const later = cv.contracts.filter((c) => c.status === 'later');
  const out = [h('div.tk-h.tk-ch', `Contracts ${cv.held}/${cv.slots}`, h('span.tk-res', ` · Reserve ${cv.reserve}`))];
  if (!here.length) out.push(h('div.tk-l.tk-none', z ? 'None in this zone' : 'None'));
  for (const c of here) {
    const el = h('div.tk-c' + (c.status === 'complete' ? '.done' : c.status === 'expired' ? '.gone' : ''), { dataset: { contract: c.id, status: c.status }, style: { '--cc': colors.get(c.id) || OFF_COLOR } },
      h('span.t', h('i.dot'), contractTitle(c, ctx.data.content)), h('span.pr', progressText(c)));
    tip(el, () => contractTip(c, ctx, { status: STATUS_WORD[c.status], progress: c.status === 'active' ? `Sites won: ${c.progress} of ${c.need}. The map marks the sites you see.` : null }));
    out.push(el);
  }
  if (later.length) out.push(h('div.tk-l.tk-later', `Later: ${later.length} ${plural(later.length, 'contract')} (zone ${[...new Set(later.map((c) => c.z))].join(', ')}) · L`));
  return out;
}
/** The quest log's body in a run with the start camp: every contract by status, with slots and Reserve. */
export function buildContractLog(v, ctx) {
  const cv = v.contracts; const colors = contractColors(cv);
  const body = h('div.col.clog', { style: { padding: '1rem 1.6rem 1.4rem' } });
  body.appendChild(h('div.cl-head', h('span.muted', `${cv.held} of ${cv.slots} slots held · Reserve ${cv.reserve} ${plural(cv.reserve, 'point')}`)));
  const z = v.zone && !v.zone.camp ? v.zone.idx : null;
  const groups = [['This zone', (c) => c.status === 'active' || (c.z === z && c.status === 'complete')], ['Later zones', (c) => c.status === 'later'],
    ['Finished', (c) => !(c.status === 'active' || c.status === 'later') && !(c.z === z && c.status === 'complete')]];
  for (const [title, pred] of groups) {
    const list = cv.contracts.filter(pred); if (!list.length) continue;
    body.appendChild(h('div.cl-sub', title));
    for (const c of list) {
      const pct = c.status === 'complete' ? 1 : c.need ? c.progress / c.need : 0;
      const row = h('div.cl-row', { dataset: { contract: c.id, status: c.status }, style: { '--cc': colors.get(c.id) || OFF_COLOR } },
        h('img', { src: kindIcon(c.kind), alt: '' }),
        h('div.cl-mid', h('div.cl-t', h('i.dot'), contractTitle(c, ctx.data.content)), h('div.cl-s', `Zone ${c.z} · ${c.zoneName} · ${c.from === 'hub' ? 'from the hub' : 'from the start camp'}`),
          h('div.cl-bar', h('i', { style: { width: `${Math.round(pct * 100)}%` } }))),
        h('div.cl-st', h('b', progressText(c)), h('span', STATUS_WORD[c.status])));
      tip(row, () => contractTip(c, ctx, { status: STATUS_WORD[c.status] }));
      body.appendChild(row);
    }
  }
  if (!cv.contracts.length) body.appendChild(h('div.muted', 'You hold no contract. Each hub from the second zone on offers one, paid from Reserve.'));
  return body;
}
/**
 * The hub's contract offer (expedition.md 3.6): its sentence and reward; Take pays its price from Reserve (needs a free
 * slot); Swap gives up one held contract for it (no refund, progress lost). Only before the player leaves the hub. null
 * without an offer.
 */
export function buildHubOffer(v, ctx, state = { swap: false }) {
  const cv = v.contracts; const o = cv && cv.hub; if (!o) return null;
  const colors = contractColors(cv);
  const box = h('div.hubc', { dataset: { kind: o.kind } });
  const head = h('div.hc-head', h('img', { src: kindIcon(o.kind), alt: '' }), h('div', h('div.hc-t', 'Contract on offer'), h('div.hc-s', hubOfferSentence(o, v.zone.hubName, ctx.data.content))));
  tip(head, () => contractTip(o, ctx, { price: `${pts(o.price)} of Reserve (you have ${cv.reserve}) · or a swap` }));
  const rw = o.reward;
  const take = h('button.btn.small' + (o.reserve ? '.primary' : '.disabled'), { type: 'button', dataset: { hub: 'reserve' } }, `Take · ${o.price} Reserve`);
  take.addEventListener('click', () => ctx.act({ type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }));
  tip(take, () => h('div', h('div.tt-name', 'Take it from Reserve'), h('div.tt-line', `Pay ${pts(o.price)} of your ${cv.reserve} Reserve. It needs a free slot (${cv.held} of ${cv.slots} used). Only before you leave this hub.`),
    o.reserve ? h('div.tt-hint', 'Click to take it') : h('div.tt-warn', ctx.bridge.why({ type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }) || 'Not now')));
  const swapBtn = h('button.btn.small' + (o.swap.length ? '' : '.disabled'), { type: 'button', dataset: { hub: 'swap' } }, state.swap ? 'Keep my contracts' : 'Swap…');
  tip(swapBtn, () => h('div', h('div.tt-name', 'Swap'), h('div.tt-line', 'Give up one contract you hold and take this one for free. No refund; its progress is lost. Only before you leave this hub.')));
  const list = h('div.hc-swap' + (state.swap ? '' : '.hidden'), cv.contracts.filter((c) => o.swap.includes(c.id)).map((c) => {
    const b = h('button.hc-give', { type: 'button', dataset: { contract: c.id }, style: { '--cc': colors.get(c.id) || OFF_COLOR } }, h('i.dot'), h('span', `Give up: ${contractTitle(c, ctx.data.content)}`), h('span.muted', ` · zone ${c.z}, ${progressText(c)}`));
    b.addEventListener('click', () => ctx.act({ type: 'TAKE_HUB_CONTRACT', mode: 'swap', contractId: c.id }));
    tip(b, () => contractTip(c, ctx, { warn: `Given up for the offer: no refund, ${c.progress ? `its ${c.progress} ${plural(c.progress, 'site')} won are lost` : 'nothing won yet'}.` }));
    return b;
  }));
  swapBtn.addEventListener('click', () => { if (!o.swap.length) return; state.swap = !state.swap; list.classList.toggle('hidden', !state.swap); swapBtn.textContent = state.swap ? 'Keep my contracts' : 'Swap…'; });
  const pay = h('div.hc-rw', h('span.xp', levelsText(rw.xpFrac)), moneyEl(rw.gold), h('span.it', h('i.r-rare', '◆'), h('i.r-epic', '◆'), ` 1 of ${rw.choices}`));
  tip(pay, () => h('div', h('div.tt-name', 'Pays at once on its last site'), h('div.tt-line', `${levelsText(rw.xpFrac)} at level ${rw.cl}, gold, and ${contractItemsText(rw)}.`)));
  box.append(head, h('div.hc-row', pay, h('div.hc-acts', take, swapBtn)), list);
  return box;
}
/**
 * The site marks of a map node (mapView node `sites`: held contracts with a site there, only where the player sees
 * marks): one dot per contract in its colour. null without marks.
 */
export function siteBadge(n, v) {
  if (!n.sites || !n.sites.length) return null;
  const colors = contractColors(v.contracts);
  return h('div.xsite', { dataset: { sites: n.sites.join(',') } }, n.sites.map((id) => h('i', { style: { background: colors.get(id) || OFF_COLOR } })));
}
/** Tooltip lines for a node's site marks: "Contract site: Cull ..." per contract (never the node's own type if hidden). */
export function siteLines(n, v, ctx) {
  if (!n.sites || !n.sites.length || !v.contracts) return [];
  const colors = contractColors(v.contracts);
  return n.sites.map((id) => {
    const c = v.contracts.contracts.find((x) => x.id === id);
    return h('div.tt-line.site', { style: { '--cc': colors.get(id) || OFF_COLOR } }, h('i.dot'), c ? `Contract site: ${contractTitle(c, ctx.data.content)} (${progressText(c)})` : 'Contract site');
  });
}
export { numWord };
