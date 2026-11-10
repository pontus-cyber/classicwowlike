// Hover tooltips for spells, items, talents, statuses and map nodes. Content is built from the
// view and the bridge's data tables; nothing here decides game rules.
import { h, clear, moneyEl, pct, fmtNum } from './util.js';
import { itemIcon } from './art-icons.js';
import { statusEffect } from './ui-text.js';

let el = null;
let current = null;

export function initTooltip(root) {
  el = h('div.tooltip', { role: 'tooltip' });
  root.appendChild(el);
  document.addEventListener('pointermove', (e) => { if (current) place(e.clientX, e.clientY); }, { passive: true });
}

function place(x, y) {
  const r = el.getBoundingClientRect();
  let tx = x + 18; let ty = y + 18;
  if (tx + r.width > window.innerWidth - 8) tx = x - r.width - 14;
  if (ty + r.height > window.innerHeight - 8) ty = Math.max(8, y - r.height - 14);
  el.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
}

/** Attach a tooltip to an element; build() returns DOM content (called on hover). */
export function tip(target, build) {
  target.addEventListener('pointerenter', (e) => show(build, e.clientX, e.clientY));
  target.addEventListener('pointerleave', hide);
  target.addEventListener('pointerdown', hide);
  return target;
}
export function show(build, x, y) {
  const content = typeof build === 'function' ? build() : build;
  if (!content) return;
  clear(el).appendChild(content);
  el.classList.add('on');
  current = build;
  place(x, y);
}
export function hide() { current = null; if (el) el.classList.remove('on'); }

// ------------------------------------------------------------------ builders
const STAT_NAMES = { sta: 'Stamina', agi: 'Agility', int: 'Intellect', spi: 'Spirit', power: 'Power', crit: 'Critical strike', armor: 'Armor', wd: 'Weapon damage' };
const SLOT_NAMES = { head: 'Head', neck: 'Neck', chest: 'Chest', hands: 'Hands', legs: 'Legs', feet: 'Feet', ring: 'Ring', trinket: 'Trinket', weapon: 'Weapon', offhand: 'Off-hand' };

export function statLine(k, v) {
  if (k === 'crit') return `+${(v * 100).toFixed(1)} % ${STAT_NAMES[k]}`;
  if (k === 'wd') return `${fmtNum(v)} ${STAT_NAMES[k]}`;
  if (k === 'armor') return `${fmtNum(v)} Armor`;
  return `+${fmtNum(v)} ${STAT_NAMES[k] || k}`;
}

export function itemTip(item, ctx, opts = {}) {
  if (!item) return null;
  const d = ctx.data;
  const box = h('div.tt-item');
  box.appendChild(h('div.tt-head', h('img.tt-icon', { src: itemIcon(item), alt: '' }), h('div', h('div.tt-name.r-' + (item.rarity || 'common'), item.name), item.kind === 'gear' ? h('div.tt-sub', `${SLOT_NAMES[item.slot] || item.slot} · Item level ${item.ilvl}`) : null)));
  // heat (rules 8.4): found in a node entered Hot or Scorched, one rarity higher (the bridge's heatUp)
  if (item.heatUp) box.appendChild(h('div.tt-line.heatup', { dataset: { hs: item.heatUp } }, `▲ Heat raised it one rarity (found ${item.heatUp[0].toUpperCase()}${item.heatUp.slice(1)})`));
  if (item.kind === 'gear') {
    const s = item.stats || {};
    if (s.wd) box.appendChild(h('div.tt-line', statLine('wd', s.wd)));
    if (s.armor) box.appendChild(h('div.tt-line', statLine('armor', s.armor)));
    for (const k of ['sta', 'agi', 'int', 'spi']) if (s[k]) box.appendChild(h('div.tt-line.stat', statLine(k, s[k])));
    for (const k of ['power', 'crit']) if (s[k]) box.appendChild(h('div.tt-line.affix', `Equip: ${statLine(k, s[k])}`));
    if (item.effectText) box.appendChild(h('div.tt-line.affix', item.effectText));
    const eq = ctx.view.player && ctx.view.player.equip[item.slot];
    if (opts.compare !== false && eq && eq.uid !== item.uid) {
      const a = ctx.bridge.itemScore(item); const b = ctx.bridge.itemScore(eq);
      const diff = Math.round((a - b) * 10) / 10;
      box.appendChild(h('div.tt-compare', diff > 0 ? h('span.up', `▲ Upgrade (+${diff} item score)`) : diff < 0 ? h('span.down', `▼ Weaker than ${eq.name} (${diff})`) : h('span', 'Same item score as equipped')));
      const deltas = [];
      for (const k of ['wd', 'armor', 'sta', 'agi', 'int', 'spi', 'power', 'crit']) {
        const dv = (item.stats[k] || 0) - (eq.stats[k] || 0);
        if (Math.abs(dv) > 1e-6) deltas.push(h('span.' + (dv > 0 ? 'up' : 'down'), `${dv > 0 ? '+' : ''}${k === 'crit' ? (dv * 100).toFixed(1) + ' %' : fmtNum(dv)} ${STAT_NAMES[k]}`));
      }
      if (deltas.length) box.appendChild(h('div.tt-deltas', deltas));
    } else if (opts.compare !== false && !eq && ctx.view.player) box.appendChild(h('div.tt-compare', h('span.up', '▲ Empty slot: an upgrade')));
  } else if (item.kind === 'consumable') {
    const c = d.consumables[item.id];
    if (c) box.appendChild(h('div.tt-line.use', c.text));
    if (item.count > 1) box.appendChild(h('div.tt-sub', `Stack: ${item.count} / ${item.stack}`));
  } else if (item.kind === 'junk') {
    box.appendChild(h('div.tt-sub', 'Junk. Sell it to a vendor.'));
  }
  const price = opts.price != null ? opts.price : null;
  if (price != null) box.appendChild(h('div.tt-price', 'Price: ', moneyEl(price)));
  else if (item.sell) box.appendChild(h('div.tt-price', 'Sells for: ', moneyEl(item.sell * (item.count || 1))));
  if (opts.hint) box.appendChild(h('div.tt-hint', opts.hint));
  return box;
}

export function spellTip(id, ctx, opts = {}) {
  const sp = ctx.data.spells[id];
  if (!sp) return null;
  const info = ctx.bridge.describeSpell(id) || {};
  const box = h('div.tt-spell');
  box.appendChild(h('div.tt-row', h('div.tt-name', sp.name), info.rank ? h('div.tt-rank', info.rank) : null));
  box.appendChild(h('div.tt-row', h('div.tt-sub', info.cost || ''), h('div.tt-sub', info.cd || (sp.cd ? `${sp.cd} round cooldown` : 'No cooldown'))));
  box.appendChild(h('div.tt-line.desc', sp.text));
  for (const l of info.lines || []) box.appendChild(h(/^Before/.test(l) ? 'div.tt-sub' : 'div.tt-line.num', l));
  if (info.flavour) box.appendChild(h('div.tt-sub', { style: { fontStyle: 'italic' } }, info.flavour));
  if (sp.tags && sp.tags.length) box.appendChild(h('div.tt-tags', sp.tags.map((t) => h('span.tag', t))));
  if (info.trained) box.appendChild(h('div.tt-hint', info.trained));
  if (opts.reason) box.appendChild(h('div.tt-warn', opts.reason));
  if (opts.hint) box.appendChild(h('div.tt-hint', opts.hint));
  return box;
}

export function basicTip(ctx) {
  const p = ctx.view.player; const cls = ctx.data.classes[p.classId];
  return h('div.tt-spell', h('div.tt-name', cls.basic.name), h('div.tt-sub', 'Free · basic attack'), h('div.tt-line.desc', 'Your basic attack. Costs nothing; use it when nothing better is ready.'), h('div.tt-hint', 'Key: A'));
}

export function talentTip(t, st, ctx) {
  const box = h('div.tt-spell');
  box.appendChild(h('div.tt-row', h('div.tt-name', t.name), h('div.tt-rank', `Rank ${st ? st.rank : 0}/${t.ranks}`)));
  box.appendChild(h('div.tt-line.desc', t.text));
  if (st && st.locked) box.appendChild(h('div.tt-warn', `Requires ${st.need} points in this tree (${st.spentTree} spent)`));
  else if (st && st.canSpend) box.appendChild(h('div.tt-hint', 'Click to learn'));
  else if (st && st.reason && st.reason !== 'Maxed') box.appendChild(h('div.tt-warn', st.reason));
  return box;
}

/** A status: buff or debuff, its exact effect from the engine's status object and rules table, time left and source. */
export function statusTip(s, ctx) {
  const info = (ctx.data.statuses || {})[s.id] || { name: s.id, text: '' };
  const fx = statusEffect(s, ctx.data.rules, info);
  return h('div.tt-spell.tt-status',
    h('div.tt-row', h('div.tt-name' + (info.debuff ? '.bad' : '.good'), info.name + (s.stacks > 1 ? ` ×${s.stacks}` : '')), h('div.tt-kind' + (info.debuff ? '.bad' : '.good'), info.debuff ? 'Debuff' : 'Buff')),
    fx.effect ? h('div.tt-line.desc', fx.effect) : null,
    fx.lines.map((l) => h('div.tt-line.num', l)),
    h('div.tt-sub', fx.duration), fx.source ? h('div.tt-sub', fx.source) : null);
}

export { SLOT_NAMES, STAT_NAMES, pct };
