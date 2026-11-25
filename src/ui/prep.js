// prep.js - the start camp and the contracts on screen (docs/specs/expedition.md 2, 3, 9.1, 9.3; engine-api.md 13; M2b
// 2b.6; D128 lean camp). The prep screen of an expedition run with the start camp (phase PREP): one lean screen (D128,
// owner playtest 2026-11-12 20:19): the board's contracts as cards side by side (headline, one line of what to do, the
// pay in one line, Take / Drop), the camp's supplies and sight as small cards, the points left with the Reserve they make,
// and Set out, always in view at the bottom right; the rest (zone band, sites, exact XP, effects, refunds) in tooltips.
// Every number comes from R.prepView (the bridge's view.prep); radii and limits from the rules table (data.rules.prep).
// Mouse: click a card. Keys: 1-3 a contract, A-D an option, R reroll (only while the reroll is open), Enter set out; Tab
// moves between the cards. The contract tracker: one line per contract of the zone under the minimap (HUD), the full
// list in the quest log (L), each contract's tooltip, the hub's contract offer (take it from Reserve or swap a held one)
// and the site marks on the expedition map (mapView node `sites`: only the marks the player sees; a hidden node is never
// named). Presentation only: every click sends one engine action.
// D150 (owner 2026-11-14, naming rule): a contract's "Reward", not "Pays"; item 15: the heading "Supplies" with no
// subline, no "Unspent ... Echoes" line under the points left (the points' tooltip says what Reserve does); item 14: an
// offer's tooltip in three sentences (boardTip: what to win, the reward, the cost).
// D152 (changes-m3-v2.md 1.2-1.3): a lean first run's camp (prepView.first): no board, the two supplies, and over Set out
// what unspent points pay (content prep.unspentFirst); no Reserve is read or named.
// D159 (legacy.md 4.7 E6.1-E6.2, draft): under Economy v2 one name, "camp points" (content texts.economy: the camp's number
// and tooltip, Set out, the hub offer, the tracker); no "Reserve", "points left" or "Preparation points"; the second camp's line.
import { h, clear, moneyEl, fmtNum, lv, legacyShown, econShown, verbatim } from './util.js'; // Legacy: the hero scale and hero XP (identities off)
import { icon, consumableIcon } from './art-icons.js';
import { tip } from './tooltip.js';
import {
  CONTRACT_KIND, contractTitle, contractSentence, familyName, hubOfferSentence, contractKindText, contractSitesText,
  contractItemsText, levelsText, xpPayText, prepOptionEffect, prepFlavour, bandText, numWord, plural, econLine, campPoints,
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
// Economy v2 (D159, legacy.md 4.7 E6.1): one name, "camp points" (no "Reserve", "points left" or "Preparation points")
const pts = (n) => (econShown() ? campPoints(n) : `${n} ${plural(n, 'point')}`);
const econ = (ctx, id, vars) => econLine(ctx.data.content && ctx.data.content.texts, id, vars);
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
    h('div.tt-sub', `Zone ${c.z} · ${c.zoneName} · ${bandText(c.band)}`),
    h('div.tt-line.desc', contractSentence(c, ctx.data.content)),
    h('div.tt-line', contractSitesText(c, r, opts.has || {})));
  if (rw.choices) {
    // M2b v10 (expedition.md 3.1): contract XP has no level-difference modifier, so the amount is fixed (reward.xp).
    // Legacy (legacy.md 5.3): the pay in hero XP, without the levels-worth
    const xp = typeof rw.xp === 'number' && !legacyShown() ? ` (${fmtNum(rw.xp)} XP)` : '';
    box.appendChild(h('div.tt-line.num', 'Reward when its last site is won: ', h('b', xpPayText(rw)), ` at level ${lv(rw.cl)}${xp}, `, moneyEl(rw.gold), `, and ${contractItemsText(rw)}.`));
  }
  if (opts.progress) box.appendChild(h('div.tt-line', opts.progress));
  if (opts.status) box.appendChild(h('div.tt-sub', opts.status));
  if (opts.price) box.appendChild(h('div.tt-sub', opts.price));
  if (opts.warn) box.appendChild(h('div.tt-warn', opts.warn));
  if (opts.hint) box.appendChild(h('div.tt-hint', opts.hint));
  return box;
}
/**
 * D150 item 14 (the owner-approved cut list; Lead 2026-11-14): a start-camp offer's tooltip, three sentences under its
 * name: "Win 2 of its marked sites: Quest or Grind nodes that carry its mark on the map, most of them in Barleyreach Verge.
 * Other fights do not count. Reward: about 3 levels of XP, 3s 12c and 1 of 3 items. Cost: 2 points." (a Cull's sites are
 * the Quest or Grind nodes placeSites marked, contracts.js; Legacy bugs 2026-11-19, s0133: it said "Win 2 Quest or Grind
 * fights in ..."), and why it cannot be taken when it cannot.
 * The held contracts keep contractTip (sites, progress, state).
 */
export function boardTip(o, ctx, opts = {}) {
  const rw = o.reward || {};
  const what = o.kind === 'delve' ? `Clear ${o.dungeon || "the zone's dungeon"}, its boss included.`
    : o.kind === 'bounty' ? `Hunt down ${o.name || 'a named elite'} in ${o.regionName || 'its region'}.`
      : `Win ${o.need} fights on Quest or Grind nodes that carry its mark, most of them in ${o.regionName || 'its region'}. Other fights do not count.`;
  const lv = rw.xpFrac || 0; const n = lv >= 1 ? Math.round(lv) : Math.round(lv * 10) / 10;
  // Economy v2 (engine-2026-11-19c UI need 7): the board's XP is what the contract pays (reward.xp), so no "about"
  const pay = [legacyShown() && typeof rw.xp === 'number' ? `${econShown() ? '' : 'about '}${xpPayText(rw)}` : `about ${n} ${n === 1 ? 'level' : 'levels'} of XP`, rw.gold ? moneyEl(rw.gold) : null, rw.choices ? `1 of ${rw.choices} items` : null].filter(Boolean);
  const list = pay.flatMap((x, i) => (i === 0 ? [x] : [i === pay.length - 1 ? ' and ' : ', ', x]));
  return h('div.tt-contract.tt-board',
    h('div.tt-row', h('div.tt-name', contractTitle(o, ctx.data.content)), h('span.ctag', { dataset: { kind: o.kind } }, CONTRACT_KIND[o.kind] || o.kind)),
    h('div.tt-line.desc', what),
    h('div.tt-line.num', 'Reward: ', ...list, '.'),
    h('div.tt-line', `Cost: ${pts(o.price)}.`),
    opts.warn ? h('div.tt-warn', opts.warn) : null);
}
function optionTip(o, ctx, key, why) {
  const r = ctx.data.rules.prep;
  const fl = prepFlavour(o.id, ctx.data.content);
  return h('div.tt-contract',
    h('div.tt-row', h('div.tt-name', o.name), h('span.ctag', { dataset: { kind: o.kind } }, o.kind === 'vision' ? 'Map' : 'Supply')),
    h('div.tt-line', prepOptionEffect(o, r, consName(ctx), ctx.data.content)),
    fl ? h('div.tt-line.flav', fl) : null,
    h('div.tt-sub', o.owned ? 'Owned already (Hall of Echoes or the run\'s options): nothing to buy.' : `${pts(o.price)}${o.kind === 'vision' ? ', for the whole run' : ', in effect when you set out'} · sold back for a full refund until you set out`),
    !o.owned && !o.bought && why ? h('div.tt-warn', why) : null,
    o.owned ? null : h('div.tt-hint', o.bought ? `Click or press ${key} to sell it back (+${pts(o.price)})` : `Click or press ${key} to buy it`));
}

// ------------------------------------------------------------------ the prep screen
/** The contract's headline: the family (Cull), the elite (Bounty) or the dungeon (Delve), capitalised. */
const cardTitle = (o, content) => cap1(o.kind === 'delve' ? o.dungeon || "the zone's dungeon" : o.kind === 'bounty' ? o.name || 'a named elite' : familyName(o.family, content));
/**
 * What to do, one line (D128): "Win 2 marked sites in Millbrook Steadings", "Hunt it in ...", "Clear it, boss included".
 * Legacy bugs 2026-11-19 (blind returning player s0133: "never counted ordinary fights in the region"): only the nodes that
 * carry the contract's mark count (contracts.js siteWon), so the line says "marked" and the tooltip says which nodes.
 */
const doLine = (o) => (o.kind === 'delve' ? 'Clear the dungeon, its boss included'
  : o.kind === 'bounty' ? `Hunt it down in ${o.regionName || 'its region'}` : `Win ${o.need} marked ${plural(o.need, 'site')} in ${o.regionName || 'its region'}`);

/**
 * The start camp screen (expedition.md 9.1; D128, owner playtest 2026-11-12 20:19: "strip it ... 3 simple choices"): one
 * lean screen. The board's offers as cards side by side (key, kind, zone, price; the headline; one line of what to do;
 * the pay in one line; Take / Drop), the camp's options as small cards (icon, name, key, price, Buy / Sell or Owned), the
 * points left with the Reserve they make, and Set out at the bottom right. Zone band, sites, exact XP, an option's effect
 * and refunds are in the tooltips. A reroll button only while R.prepView says the reroll is open (GATES.campReroll).
 * Built once per run's PREP, then patched on every view (update), so focus and hover stay on the card in use. Returns the
 * root with root.update(v).
 */
export function createPrepScreen(v, ctx) {
  const root = h('div#prep', { dataset: { mounted: String(performance.now()) } });
  const pv0 = v.prep;
  // D152 (changes-m3-v2.md 1.2-1.3): a lean first run (prepView.first) has no board, no contract slots and no Reserve: the
  // camp shows its two supplies, the points left and, over Set out, what unspent points pay (content prep.unspentFirst)
  const first = !!pv0.first;
  // Legacy bugs 2026-11-19 (blind returning player s0241): every run sets out for zone 1, so its name comes from the content;
  // the board's first offer named "the road to Greywater Fens" when the board held no zone 1 contract
  const zone1 = ctx.data.zone1Name || (pv0.board.find((o) => o.z === 1) || {}).zoneName || 'the first zone';
  const nB = pv0.board.length; const nO = pv0.options.length;
  root.classList.toggle('first', first);
  // Economy v2 (legacy.md 4.7 E6.2): the first camp after the lean first run says what grew (prepView + the bridge's secondCamp)
  const grown = pv0.secondCamp ? econ(ctx, 'second_camp', { points: pv0.points }) : '';
  root.appendChild(h('div.pp-head',
    h('div', h('div.pp-t1', 'The start camp'), h('div.pp-t2', first ? `Pick your supplies for the road to ${zone1}.` : `Pick your contracts and supplies for the road to ${zone1}.`), grown ? h('div.pp-grown', grown) : null),
    h('div.pp-keys', nB ? [h('span.kbd', nB > 1 ? `1–${nB}` : '1'), 'contracts'] : null, nO ? [h('span.kbd', nO > 1 ? `A–${OPT_KEYS[nO - 1]}` : 'A'), 'supplies'] : null, h('span.kbd', 'Enter'), 'set out')));
  // the contracts: cards side by side
  const reroll = h('button.btn.small#pp-reroll', { type: 'button' });
  reroll.addEventListener('click', () => { reroll.blur(); ctx.act({ type: 'REROLL_BOARD' }); });
  tip(reroll, () => {
    const pv = ctx.view.prep; if (!pv) return null; const why = pv.reroll.can ? null : ctx.bridge.why({ type: 'REROLL_BOARD' });
    return h('div', h('div.tt-name', 'Reroll the board'), h('div.tt-line', `New offers for every contract you have not taken. ${pts(pv.reroll.price)}, not refunded.`),
      h('div.tt-sub', `${pv.reroll.max - pv.reroll.used} of ${pv.reroll.max} rerolls left`), why ? h('div.tt-warn', why) : h('div.tt-hint', 'Click or press R'));
  });
  const cards = h('div.pp-cards', { style: { '--n': String(Math.max(1, nB)) } });
  const cardEls = pv0.board.map((o, i) => {
    const b = h('button.pp-card', { type: 'button', dataset: { index: String(i) } });
    // a mouse click leaves no focus behind (Enter then sets out); a keyboard press (Tab, then Enter or Space) keeps it
    b.addEventListener('click', (e) => { if (e.detail) b.blur(); boardAct(ctx, i); });
    tip(b, () => {
      const pv = ctx.view.prep; const x = pv && pv.board[i]; if (!x) return null;
      const why = x.taken || x.canTake ? null : ctx.bridge.why({ type: 'TAKE_CONTRACT', index: i });
      return boardTip(x, ctx, { warn: why }); // D150 item 14: three sentences (the card shows its key)
    }, { avoid: '#prep .pp-card' });
    cards.appendChild(b);
    return b;
  });
  const board = first ? null : h('section.pp-board', h('div.pp-sh', h('div.pp-lab', 'Contracts'), h('div.pp-sub', 'Up to three at a time. Each gives its reward when its task is done.'), reroll), cards);
  // the options: small cards in one row
  const optEls = new Map();
  const opts = h('div.pp-opts', { style: { '--n': String(Math.max(1, nO)) } }, pv0.options.map((o, i) => {
    const b = h('button.pp-opt', { type: 'button', dataset: { id: o.id, kind: o.kind } });
    b.addEventListener('click', (e) => { if (e.detail) b.blur(); optionAct(ctx, o.id); });
    tip(b, () => { const pv = ctx.view.prep; const x = pv && pv.options.find((y) => y.id === o.id); return x ? optionTip(x, ctx, OPT_KEYS[i], x.why ? cap1(x.why) : null) : null; }, { avoid: '#prep .pp-opt' });
    optEls.set(o.id, { el: b, key: OPT_KEYS[i] });
    return b;
  }));
  // D150 item 15: the heading "Supplies", no subline (each card's tooltip says what it does and for how long)
  const shop = nO ? h('section.pp-shop', h('div.pp-sh', h('div.pp-lab', 'Supplies')), opts) : null;
  // the points left and Set out: always in view, bottom right (QA finding BUG-QA-10)
  // D150 item 15: no "Unspent: N points = N Echoes, usable at hubs" line (it contradicted the tooltip: Reserve first)
  const big = h('b.pm-n');
  const points = h('div.pm-points', big, h('div', h('div.pm-l', econShown() ? econ(ctx, 'camp_points') : 'points left')));
  tip(points, () => {
    const pv = ctx.view.prep; if (!pv) return null;
    // Economy v2 (legacy.md 4.7 E6.1): "Camp points" and the content's tooltip line (they buy contracts here and at a hub,
    // and do not carry over); a lean first run adds what unspent points do (prep.unspentFirst: they are lost)
    if (econShown()) {
      return h('div', h('div.tt-name', 'Camp points'), h('div.tt-line', `${pv.points} this run${pv.spent ? `; ${pv.spent} spent` : ''}.`), h('div.tt-line.desc', econ(ctx, 'camp_points_tip')),
        pv.first ? h('div.tt-line.num', verbatim(unspentLine(pv, ctx))) : h('div.tt-sub', `${pv.held} of ${pv.slots} contract slots used`));
    }
    if (pv.first) return h('div', h('div.tt-name', 'Preparation points'), h('div.tt-line', `${pv.points} to spend on supplies${pv.spent ? `; ${pv.spent} spent` : ''}.`), h('div.tt-line.num', verbatim(unspentLine(pv, ctx))));
    const rs = pv.reserve || { points: 0, echoes: 0 }; // engine-2026-11-14f UI need 2: never read a missing Reserve
    return h('div', h('div.tt-name', 'Preparation points'), h('div.tt-line', `${pv.points} to spend on contracts and supplies${pv.spent ? `; ${pv.spent} spent` : ''}.`),
      h('div.tt-line.num', `Unspent points become Reserve: it buys a hub contract on the way, and what is left at the end of the run becomes Echoes${rs.points ? ` (${rs.echoes} for the ${pts(rs.points)} left now)` : ''}.`),
      h('div.tt-sub', `${pv.held} of ${pv.slots} contract slots used`));
  });
  const go = h('button.btn.primary.big#pp-go', { type: 'button' }, 'Set out', h('span.k', 'Enter'));
  go.addEventListener('click', () => { go.blur(); if (ctx.coach && ctx.coach.holdSetOut(ctx.view)) return; ctx.act({ type: 'SET_OUT' }); });
  tip(go, () => {
    const pv = ctx.view.prep; if (!pv) return null;
    if (pv.first) return h('div', h('div.tt-name', 'Set out'), h('div.tt-line', `Leave the camp for ${zone1}. Supplies go into your bags.`), pv.left ? h('div.tt-line.num', verbatim(unspentLine(pv, ctx))) : null);
    if (econShown()) {
      return h('div', h('div.tt-name', 'Set out'), h('div.tt-line', `Leave the camp for ${zone1}. Supplies go into your bags and the perks last the run.`),
        h('div.tt-line.num', econ(ctx, 'set_out', { contracts: pv.held, points: pv.left })),
        pv.held ? null : h('div.tt-warn', 'You hold no contract: the zones then pay only what you find.'));
    }
    const rs = pv.reserve || { points: 0, echoes: 0 };
    return h('div', h('div.tt-name', 'Set out'), h('div.tt-line', `Leave the camp for ${zone1}. Supplies go into your bags and the perks last the run.`),
      h('div.tt-line.num', pv.left ? `${pts(pv.left)} unspent become Reserve: ${rs.echoes} Echoes at the end of the run, or hub contracts on the way.` : 'Every point is spent: no Reserve.'),
      pv.held ? null : h('div.tt-warn', 'You hold no contract: the zones then pay only what you find.'));
  });
  // a first run: the line over Set out (prep.unspentFirst), while points are left
  const unspent = h('div.pp-unspent');
  root.append(h('div.pp-main', board, shop), h('div.pp-foot', points, h('div.pp-go', unspent, go)));

  let last = null;
  root.update = (vv) => {
    const pv = vv.prep; if (!pv) return;
    const prev = last; last = pv;
    if (!prev || prev.left !== pv.left) { big.textContent = String(pv.left); if (prev) { big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); } }
    unspent.textContent = pv.first && pv.left ? unspentLine(pv, ctx) : '';
    unspent.classList.toggle('hidden', !(pv.first && pv.left));
    reroll.classList.toggle('hidden', !pv.reroll.open);
    if (pv.reroll.open) {
      reroll.textContent = ''; reroll.append(`Reroll · ${pts(pv.reroll.price)}`, h('span.pp-left', `${pv.reroll.max - pv.reroll.used} left`), h('span.k', 'R'));
      reroll.classList.toggle('disabled', !pv.reroll.can);
    }
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
        h('div.pc-top', h('span.kbd', BOARD_KEYS[i]), h('img', { src: kindIcon(o.kind), alt: '' }), h('b.pc-kind', CONTRACT_KIND[o.kind] || o.kind), h('span.pc-zone', `Zone ${o.z}`), priceTag(o.price)),
        h('div.pc-target', cardTitle(o, ctx.data.content)),
        h('div.pc-do', doLine(o)),
        // the pay in one line, every number with its word (QA playtest 2026-11-11 finding 5)
        payLine(o.reward, 'div.pc-reward'),
        h('div.pc-act', o.taken ? h('span.seal', h('img', { src: icon('seal', 'blood'), alt: 'Taken' }), 'Taken') : null, h('span.pc-btn', o.taken ? 'Drop' : 'Take')));
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
        h('div.po-txt', h('div.po-nm', h('span.kbd', x.key), h('span.po-name', o.name)), h('div.po-kd', o.kind === 'vision' ? 'Map' : 'Supply')),
        h('div.po-right', o.owned ? h('span.po-own', 'Owned') : [h('span.pc-price', String(o.price)), h('span.po-act', o.bought ? 'Sell' : 'Buy')]));
    }
  };
  root.update(v);
  return root;
}
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/**
 * A first run's unspent points line (D152, content prep.unspentFirst, draft): "Points you do not spend: +N Echoes ...". The
 * content line reads its Legacy wording under GATES.legacy (TUTORIAL.legacy), so it is shown verbatim (no word swap); the
 * fallback, without content, says Legacy points while a Legacy profile or run is shown.
 */
export function unspentLine(pv, ctx) {
  const raw = (ctx.data.tutorial && ctx.data.tutorial.table && ctx.data.tutorial.table.prep && ctx.data.tutorial.table.prep.unspentFirst)
    || `Points you do not spend: +{echoes} ${legacyShown() ? 'Legacy points' : 'Echoes'} at the end of the run.`;
  return raw.replace('{echoes}', String((pv.unspent && pv.unspent.echoes) || 0));
}
/** A price in preparation points: the number on its seal and the word next to it. */
const priceTag = (n) => h('span.pc-cost', { 'aria-label': pts(n) }, h('span.pc-price', String(n)), h('span.pc-pl', plural(n, 'pt')));
/**
 * What a contract pays, every number with its word (QA playtest 2026-11-11 finding 5): "Pays 1.5 levels of XP · gold 9 56
 * (coins) · choose 1 of 3 ◆◆" (rarity marks: the reward table's rare and epic). rw: an offer's reward (R.prepView).
 */
function payLine(rw, tag, items = true) {
  return h(tag, h('span.pl', 'Reward'), h('span.xp', xpPayText(rw)), h('span.gd', h('span.pl', 'gold'), moneyEl(rw.gold)), items ? itemsChip(rw) : null);
}
/** "choose 1 of 3 ◆◆": the item choice and the rarities it can be (the reward table's rare and epic). */
function itemsChip(rw) {
  const marks = ['rare', 'epic'].filter((r) => !rw.rarity || rw.rarity[r] > 0).map((r) => h(`i.r-${r}`, '◆'));
  return h('span.it', `choose 1 of ${rw.choices}`, h('span.mk', marks));
}

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
 * Keys on the prep screen (expedition.md 9.1; D128): 1-3 take or drop a contract (one key per offer), A-D buy or sell
 * an option (one letter per option shown), R reroll only while the reroll is open, Enter set out (not within
 * PREP_ENTER_GUARD_MS of the screen opening, never on a held key, so the Enter that started the run cannot also end the
 * camp). Tab, Space and Enter on a focused card work as the browser's own. Returns true when handled.
 */
export function prepKey(e, ctx) {
  const v = ctx.view; const pv = v.prep; if (!pv) return false;
  const code = e.code;
  const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('#prep button');
  if (code === 'Tab') return 'native';
  if ((code === 'Space' || code === 'Enter') && focused) return 'native';
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (digit) { e.preventDefault(); const i = Number(digit[1]) - 1; if (i < pv.board.length) boardAct(ctx, i); return true; }
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter && code === 'KeyR' && pv.reroll.open) { e.preventDefault(); ctx.act({ type: 'REROLL_BOARD' }); return true; }
  if (letter && OPT_KEYS.indexOf(letter[1]) >= 0 && OPT_KEYS.indexOf(letter[1]) < pv.options.length) { e.preventDefault(); optionAct(ctx, pv.options[OPT_KEYS.indexOf(letter[1])].id); return true; }
  if (code === 'Enter' || code === 'NumpadEnter') {
    e.preventDefault();
    const el = document.getElementById('prep');
    const age = el ? performance.now() - Number(el.dataset.mounted || 0) : 0;
    if (e.repeat || age < PREP_ENTER_GUARD_MS) return true;
    if (ctx.coach && ctx.coach.holdSetOut(ctx.view)) return true; // M3 G1: the first Set out without a contract asks once
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
  // D144 (engine-2026-11-13d UI need 10; casual s0079: "Contracts 1/4" became "0/4" on completing one): the slots held,
  // said as slots, and the contracts done this run
  const won = cv.contracts.filter((c) => c.status === 'complete').length;
  const out = [h('div.tk-h.tk-ch', `Contract slots ${cv.held}/${cv.slots}`, won ? h('span.tk-done', ` · ${won} done`) : null, h('span.tk-res', ` · ${econShown() ? econ(ctx, 'tracker', { points: cv.reserve }) : `Reserve ${cv.reserve}`}`))];
  if (!here.length) out.push(h('div.tk-l.tk-none', z ? 'None in this zone' : 'None'));
  for (const c of here) {
    const el = h('div.tk-c' + (c.status === 'complete' ? '.done' : c.status === 'expired' ? '.gone' : ''), { dataset: { contract: c.id, status: c.status }, style: { '--cc': colors.get(c.id) || OFF_COLOR } },
      h('span.t', h('i.dot'), contractTitle(c, ctx.data.content)), h('span.pr', progressText(c)));
    tip(el, () => contractTip(c, ctx, { status: STATUS_WORD[c.status], progress: c.status === 'active' ? `Sites won: ${c.progress} of ${c.need}. Only nodes with its mark count; the map marks the sites you see.` : null,
      warn: c.status === 'active' ? 'Expires when you leave this zone (a Road or the Bell): no reward.' : null }));
    out.push(el);
  }
  // held contracts of this zone expire when the player leaves it (expedition.md 3.1; QA playtest 2026-11-11 finding 3)
  const active = here.filter((c) => c.status === 'active').length;
  if (active) out.push(h('div.tk-l.tk-exp', { dataset: { expire: String(active) } }, active === 1 ? 'Expires when you leave this zone' : `${active === 2 ? 'Both' : `All ${active}`} expire when you leave this zone`));
  if (later.length) out.push(h('div.tk-l.tk-later', `Later: ${later.length} ${plural(later.length, 'contract')} (zone ${[...new Set(later.map((c) => c.z))].join(', ')}) · L`));
  return out;
}
/** The quest log's body in a run with the start camp: every contract by status, with slots and Reserve. */
export function buildContractLog(v, ctx) {
  const cv = v.contracts; const colors = contractColors(cv);
  const body = h('div.col.clog', { style: { padding: '1rem 1.6rem 1.4rem' } });
  body.appendChild(h('div.cl-head', h('span.muted', `${cv.held} of ${cv.slots} slots held · ${econShown() ? econ(ctx, 'tracker', { points: cv.reserve }) : `Reserve ${cv.reserve} ${plural(cv.reserve, 'point')}`}`)));
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
  if (!cv.contracts.length) body.appendChild(h('div.muted', `You hold no contract. Each hub from the second zone on offers one, paid ${econShown() ? 'in camp points' : 'from Reserve'}.`));
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
  const box = h('div.hubc', { dataset: { kind: o.kind, hubOffer: o.id || o.kind } }); // data-hub-offer: hint H22's anchor (onboarding.js)
  const head = h('div.hc-head', h('img', { src: kindIcon(o.kind), alt: '' }), h('div', h('div.hc-t', 'Contract on offer'), h('div.hc-s', hubOfferSentence(o, v.zone.hubName, ctx.data.content))));
  tip(head, () => contractTip(o, ctx, { price: econShown() ? `${pts(o.price)} (you have ${cv.reserve}) · or a swap` : `${pts(o.price)} of Reserve (you have ${cv.reserve}) · or a swap` }));
  const rw = o.reward;
  const take = h('button.btn.small' + (o.reserve ? '.primary' : '.disabled'), { type: 'button', dataset: { hub: 'reserve' } }, econShown() ? econ(ctx, 'hub_offer', { price: o.price, points: cv.reserve }).replace(/\.$/, '') : `Take · ${o.price} Reserve`);
  // blind panel 2026-11-13 (item 8): the hub keeps the offer's height after a take (screens.js buildHub), so nothing moves
  const taken = () => { state.taken = { z: v.zone.idx, h: Math.round(box.getBoundingClientRect().height), title: contractTitle(o, ctx.data.content) }; };
  take.addEventListener('click', () => { if (o.reserve) taken(); ctx.act({ type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }); });
  tip(take, () => h('div', h('div.tt-name', econShown() ? 'Take it for camp points' : 'Take it from Reserve'), h('div.tt-line', econShown() ? `Pay ${pts(o.price)} of your ${cv.reserve}. It needs a free slot (${cv.held} of ${cv.slots} used). Only before you leave this hub.` : `Pay ${pts(o.price)} of your ${cv.reserve} Reserve. It needs a free slot (${cv.held} of ${cv.slots} used). Only before you leave this hub.`),
    o.reserve ? h('div.tt-hint', 'Click to take it') : h('div.tt-warn', ctx.bridge.why({ type: 'TAKE_HUB_CONTRACT', mode: 'reserve' }) || 'Not now')));
  const swapBtn = h('button.btn.small' + (o.swap.length ? '' : '.disabled'), { type: 'button', dataset: { hub: 'swap' } }, state.swap ? 'Keep my contracts' : 'Swap…');
  tip(swapBtn, () => h('div', h('div.tt-name', 'Swap'), h('div.tt-line', 'Give up one contract you hold and take this one for free. No refund; its progress is lost.')));
  const list = h('div.hc-swap' + (state.swap ? '' : '.hidden'), cv.contracts.filter((c) => o.swap.includes(c.id)).map((c) => {
    const b = h('button.hc-give', { type: 'button', dataset: { contract: c.id }, style: { '--cc': colors.get(c.id) || OFF_COLOR } }, h('i.dot'), h('span', `Give up: ${contractTitle(c, ctx.data.content)}`), h('span.muted', ` · zone ${c.z}, ${progressText(c)}`));
    b.addEventListener('click', () => { taken(); ctx.act({ type: 'TAKE_HUB_CONTRACT', mode: 'swap', contractId: c.id }); });
    tip(b, () => contractTip(c, ctx, { warn: `Given up for the offer: no refund, ${c.progress ? `its ${c.progress} ${plural(c.progress, 'site')} won are lost` : 'nothing won yet'}.` }));
    return b;
  }));
  swapBtn.addEventListener('click', () => { if (!o.swap.length) return; state.swap = !state.swap; list.classList.toggle('hidden', !state.swap); swapBtn.textContent = state.swap ? 'Keep my contracts' : 'Swap…'; });
  const pay = payLine(rw, 'div.hc-rw');
  tip(pay, () => h('div', h('div.tt-name', 'Reward when its last site is won'), h('div.tt-line', `${xpPayText(rw)} at level ${lv(rw.cl)}${typeof rw.xp === 'number' && !legacyShown() ? ` (${fmtNum(rw.xp)} XP)` : ''}, gold, and ${contractItemsText(rw)}.`)));
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
