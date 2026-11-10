// Hall of Echoes: the meta progression screen between runs (rules 11). Shown over class select, opened from class
// select or from the run summary ("Spend Echoes"). It reads the profile view of the bridge (view.meta: balance, the
// engine's offers from R.metaOffers, the run log, the next run from a dry START_RUN) and sends META_BUY. Costs, ranks,
// states and effects come from the engine; this file only lays them out and animates the changes.
import { h, clear, fmtNum } from './util.js';
import { icon, spellIcon } from './art-icons.js';
import { tip, hide as hideTip } from './tooltip.js';
import { settings } from './settings.js';
import { META_KIND, metaEffect, metaReqText, nextRunLines, oathEffect, numWord, plural, pct1 } from './ui-text.js';

/** Icon of an unlock: its spell for the Lost Techniques, else a glyph for its effect. */
const META_ICON = {
  vigor: ['heart', 'blood'], edge: ['slash', 'steel'], keen: ['target', 'gold'], quick_study: ['tome', 'arcane'], prospector: ['coin', 'gold'],
  talent_pt: ['stars3', 'epic'], satchel: ['potion', 'blood'], heirloom_blade: ['dagger', 'uncommon'], pockets: ['junk', 'earth'],
  ledger: ['tome', 'parchment'], scout: ['eye', 'nature'], swift_boots: ['boot', 'frost'],
  alchemist: ['potion', 'epic'], cache: ['gem', 'rare'], relics: ['gem', 'epic'], starforged: ['comet', 'gold'],
  stormhawk: ['bolt', 'frost'], second_breath: ['ember', 'heal'], oaths: ['rune', 'blood'],
};
export function metaIcon(m) {
  if (m && m.spell) return spellIcon(m.spell);
  const g = META_ICON[m && m.id] || ['spark', 'arcane'];
  return icon(g[0], g[1]);
}
/** Catalogue columns: the kinds of rules 11.2 in catalogue order, laid out in four columns of about equal height. */
const COLUMN_OF = { stat: 0, 'start kit': 1, economy: 1, map: 1, items: 2, resurrect: 2, challenge: 2, skill: 3 };
const COLUMNS = 4;
const BUY_GAP_MS = 350; // a double click buys one rank, not two

/** The Echo gem and an amount: "◆ 1 240". */
export function echoAmt(n, cls = '') { return h('span.eamt' + cls, h('i.eg'), fmtNum(n)); }

/** State of an offer for the card: owned (every rank), affordable, unaffordable (available, too few Echoes) or locked. */
export function offerState(o) { return o.rank >= o.ranks ? 'owned' : !o.available ? 'locked' : o.affordable ? 'affordable' : 'unaffordable'; }

export function createMeta(ctx) {
  const el = h('div#meta.hidden', { role: 'dialog', 'aria-label': 'Hall of Echoes' });
  let open = false; let lastKey = null; let prev = null; let shownRun = 0; let ticker = null; let tickerT = null; let balT = null; let lastBuy = 0;

  function setOpen(on) {
    open = !!on;
    if (!on) { el.classList.add('hidden'); hideTip(); }
    lastKey = null; prev = null; // the first render after opening counts the last run's Echoes in
  }

  /** Called on every render: shows the screen in CREATE while it is open; it stays pending through SUMMARY (Spend Echoes). */
  function sync(v) {
    if (!open || !v.meta) { el.classList.add('hidden'); if (open && v.phase !== 'SUMMARY') setOpen(false); return; }
    if (v.phase !== 'CREATE') { el.classList.add('hidden'); if (v.phase !== 'SUMMARY') setOpen(false); return; }
    el.classList.remove('hidden');
    const m = v.meta;
    const key = JSON.stringify([m.echoes, m.unlocks, m.runs, v.create.classId, v.create.petId, v.create.oaths, m.lastRun && m.lastRun.n]);
    if (key === lastKey) return;
    lastKey = key;
    const scroll = el.querySelector('.mbody') ? el.querySelector('.mbody').scrollTop : 0;
    render(v);
    const body = el.querySelector('.mbody'); if (body) body.scrollTop = scroll;
    effects(prev, m);
    prev = m;
  }

  // ------------------------------------------------------------------ layout
  function render(v) {
    const m = v.meta; const D = ctx.data.meta; const d = ctx.data;
    const lines = nextRunLines(m.next, D, d);
    const nowOf = new Map(lines.map((l) => [l.id, l.text]));
    const reach = m.offers.filter((o) => o.affordable).length;
    const win = h('div.mwin.panel');
    // header: title, feedback line, balance, close
    const bal = h('div.mbal', h('i.eg.big'), h('b.n', fmtNum(m.echoes)), h('span.u', 'Echoes'), h('span.delta'));
    tip(bal, () => h('div', h('div.tt-name', 'Echoes'), h('div.tt-line.desc', `Every run earns Echoes: for levels, zones, dungeons, elites and quests, and for facing ${D.names.boss}. They buy lasting unlocks here.`),
      h('div.tt-line.num', `Earned ${fmtNum(m.earned)} · spent ${fmtNum(m.spent)}`), h('div.tt-sub', `${numWord(reach)} ${plural(reach, 'unlock')} within reach`)));
    const close = h('button.xbtn', { 'aria-label': 'Close' }, '×');
    close.addEventListener('click', () => ctx.ui.closeMeta());
    ticker = h('div.mtick', { 'aria-live': 'polite' });
    win.appendChild(h('div.mhead',
      h('div.mh-l', h('div.title', 'Hall of Echoes'), h('div.subtitle', 'Echoes from every run buy lasting unlocks. Each applies from the start of your next run.')),
      ticker, h('div.mh-r', bal, h('div.mh-sub', `earned ${fmtNum(m.earned)} · spent ${fmtNum(m.spent)}`)), close));
    win.appendChild(history(m));
    // catalogue: groups of the engine's kinds, in catalogue order
    const cols = Array.from({ length: COLUMNS }, () => h('div.mcol'));
    for (const kind of D.kinds) {
      const offers = m.offers.filter((o) => o.kind === kind);
      if (!offers.length) continue;
      const [title, line] = META_KIND[kind] || [kind, ''];
      const owned = offers.reduce((a, o) => a + o.rank, 0); const total = offers.reduce((a, o) => a + o.ranks, 0);
      const head = h('div.mg-h', h('span.t', title), h('span.c', `${owned}/${total}`));
      tip(head, () => h('div', h('div.tt-name', title), h('div.tt-line.desc', line), h('div.tt-sub', `${owned} of ${total} ${plural(total, 'rank')} owned`)));
      const grp = h('div.mgroup', { dataset: { kind } }, head, offers.map((o) => card(o, m, nowOf)));
      const col = COLUMN_OF[kind] ?? cols.reduce((best, c, i) => (c.childElementCount < cols[best].childElementCount ? i : best), 0);
      cols[Math.min(COLUMNS - 1, col)].appendChild(grp);
    }
    win.appendChild(h('div.mbody', cols));
    // the next run, from the engine's dry START_RUN
    const n = m.next;
    const chip = (l) => {
      const e = D.entries[l.id]; const c = h('span.mn-chip', { dataset: { id: l.id } }, l.text);
      tip(c, () => h('div', h('div.tt-name', e ? e.name : l.text), e ? h('div.tt-line.desc', metaEffect(e, D, d).long) : null, h('div.tt-line.use', `Your next run: ${l.text}`)));
      return c;
    };
    const list = h('div.mn-list', lines.length ? lines.map(chip) : h('span.muted', 'Nothing yet. Every unlock you buy shows here, and applies from the first step of the run.'));
    const other = otherClassLines(m, n, D, d);
    win.appendChild(h('div.mnext', h('div.mn-h', h('span.t', 'Your next run'), n ? h('span.dim', `as ${n.className}`) : null), list, other ? h('div.mn-other.muted', other) : null));
    const back = h('button.btn.primary', 'Choose your hero');
    back.addEventListener('click', () => ctx.ui.closeMeta());
    win.appendChild(h('div.mfoot', h('span.muted', 'Hover an unlock for details. Esc returns to class select.'), back));
    clear(el).appendChild(win);
    idleTicker(m);
  }

  /** One unlock: icon, name, rank, effect, requirement, and the Buy button with its cost (or Owned / Locked). */
  function card(o, m, nowOf) {
    const D = ctx.data.meta; const e = D.entries[o.id] || { id: o.id, kind: o.kind };
    const fx = metaEffect(e, D, ctx.data);
    const state = offerState(o);
    const pips = o.ranks > 1 ? h('span.pips', Array.from({ length: o.ranks }, (_, i) => h('i' + (i < o.rank ? '.on' : '')))) : null;
    let right;
    if (state === 'owned') right = h('span.mtag.owned', o.ranks > 1 ? 'Max rank' : 'Owned');
    else {
      const b = h('button.buy', { type: 'button', 'aria-label': `Buy ${o.name}`, dataset: { id: o.id } }, state === 'locked' ? null : h('span.bl', 'Buy'), o.nextCost > 0 ? echoAmt(o.nextCost) : h('span.free', 'Free'));
      b.disabled = state !== 'affordable';
      b.addEventListener('click', (ev) => { ev.stopPropagation(); buy(o.id); });
      right = b;
    }
    const req = state === 'locked' ? h('div.mc-req', `Needs ${o.req.map((r) => metaReqText(r, D, true)).join(' and ')}`) : null;
    const el2 = h('div.mcard', { dataset: { id: o.id, state } }, h('img.ic', { src: metaIcon(e), alt: '' }),
      h('div.mc-t', h('span.nm', o.name), h('span.rk', `${o.rank}/${o.ranks}`), pips), right,
      h('div.mc-fx', fx.short), req);
    el2.classList.add(state);
    if (o.rank > 0 && state !== 'owned') el2.classList.add('some');
    tip(el2, () => cardTip(o, e, fx, state, m, nowOf));
    return el2;
  }

  function cardTip(o, e, fx, state, m, nowOf) {
    const D = ctx.data.meta;
    const [kindName] = META_KIND[o.kind] || [o.kind];
    const box = h('div.tt-spell.tt-meta');
    box.appendChild(h('div.tt-row', h('div.tt-name', o.name), h('div.tt-rank', `Rank ${o.rank}/${o.ranks}`)));
    box.appendChild(h('div.tt-sub', o.ranks > 1 ? `${kindName} · ${o.ranks} ranks` : kindName));
    box.appendChild(h('div.tt-line.desc', fx.long || fx.short));
    for (const line of fx.more || []) box.appendChild(h('div.tt-line.stat', line));
    if (nowOf.has(o.id)) box.appendChild(h('div.tt-line.use', `Your next run: ${nowOf.get(o.id)}`));
    else if (o.rank > 0) box.appendChild(h('div.tt-line.num', ownedNote(o, e, m)));
    if (state === 'owned') box.appendChild(h('div.tt-hint', o.ranks > 1 ? 'Every rank is yours.' : 'Yours for every run to come.'));
    else {
      box.appendChild(h('div.tt-price', o.rank > 0 ? 'Next rank: ' : 'Cost: ', o.nextCost > 0 ? echoAmt(o.nextCost) : 'free'));
      if (state === 'locked') {
        const met = (r) => (r === 'flag:reachedBoss' ? m.reachedBoss : r === 'flag:bossKill' ? m.bossKills > 0 : (m.offers.find((x) => x.id === r) || { rank: 0 }).rank > 0);
        for (const r of o.req) box.appendChild(h(met(r) ? 'div.tt-hint' : 'div.tt-warn', `${met(r) ? '✓' : '✗'} Requires: ${metaReqText(r, D)}`));
      } else if (state === 'unaffordable') box.appendChild(h('div.tt-warn', `You need ${fmtNum(o.nextCost - m.echoes)} more Echoes.`));
      else box.appendChild(h('div.tt-hint', 'Click Buy to learn it. It applies from your next run.'));
    }
    return box;
  }

  /** An owned unlock that does not show in the next run: Oaths wait on class select; a class's skill waits for that class. */
  function ownedNote(o, e, m) {
    const d = ctx.data; const cls = (id) => (d.classes[id] || { name: id }).name;
    if (o.id === 'oaths') return 'Owned. Swear them on class select, under the class cards.';
    if (e.spell && d.spells[e.spell]) return `Owned. It works on ${cls(d.spells[e.spell].cls)} runs.`;
    if (e.pet) return `Owned. It works on ${cls('hunter')} runs.`;
    return `Owned${o.ranks > 1 ? `: rank ${o.rank}` : ''}.`;
  }

  /** Run log: totals from the profile, and per class the runs, best level, furthest point, kills and first-kill bonus. */
  function history(m) {
    const D = ctx.data.meta; const d = ctx.data; const H = m.history;
    const tot = h('div.mh-tot', h('span', 'Runs ', h('b', fmtNum(m.runs))), h('span', `${D.names.boss} defeated `, h('b', fmtNum(m.bossKills))));
    if (H.logged < m.runs) tot.appendChild(h('span.muted', `${m.runs - H.logged} earlier ${plural(m.runs - H.logged, 'run')} before the log`));
    tip(tot, () => h('div', h('div.tt-name', 'Your runs'), h('div.tt-line', `${fmtNum(m.runs)} ${plural(m.runs, 'run')} ended, ${fmtNum(m.bossKills)} with ${D.names.boss} defeated.`),
      h('div.tt-line.desc', `Every run earns Echoes. The first victory with each class adds +${fmtNum(D.num.firstKill)} Echoes.`),
      H.logged < m.runs ? h('div.tt-sub', 'Best levels and places are logged from the runs this game has seen.') : null));
    const chips = Object.entries(H.classes).map(([id, c]) => {
      const cd = d.classes[id] || { name: id, color: '#ccc' };
      const fk = c.firstKill ? h('span.fk.good', 'First-kill bonus ✓') : h('span.fk.wait', 'First-kill bonus ', echoAmt(D.num.firstKill, '.plus'));
      const body = c.runs ? `${c.runs} ${plural(c.runs, 'run')} · best level ${c.bestLevel}${c.best ? ` · ${c.best}` : ''} · slain ${c.kills}×` : 'No runs yet';
      const chip = h('div.mh-cls', { dataset: { cls: id }, style: { '--cc': cd.color } }, h('span.cn', cd.name), fk, h('span.cb', body));
      tip(chip, () => h('div', h('div.tt-name', { style: { color: cd.color } }, cd.name),
        h('div.tt-line', c.runs ? `${c.runs} ${plural(c.runs, 'run')} logged. Best level ${c.bestLevel}${c.best ? `; furthest: ${c.best}` : ''}.` : 'No run logged yet.'),
        h('div.tt-line', `${D.names.boss} defeated ${c.kills} ${plural(c.kills, 'time')}.`),
        h(c.firstKill ? 'div.tt-hint' : 'div.tt-line.use', c.firstKill ? `First-kill bonus claimed (+${fmtNum(D.num.firstKill)} Echoes).` : `The first ${cd.name} to defeat ${D.names.boss} earns +${fmtNum(D.num.firstKill)} Echoes.`)));
      return chip;
    });
    return h('div.mhist', tot, h('div.mh-chips', chips));
  }

  /** Owned skills that apply to another class only (the dry START_RUN is for the class chosen). */
  function otherClassLines(m, n, D, d) {
    if (!n) return null;
    const names = Object.values(D.entries).filter((e) => e.spell && (m.unlocks[e.id] || 0) > 0 && d.spells[e.spell] && d.spells[e.spell].cls !== n.classId).map((e) => d.spells[e.spell].name);
    if ((m.unlocks.stormhawk || 0) > 0 && n.classId !== 'hunter') names.push(`${(d.pets.stormhawk || {}).name || 'Stormhawk'} (Hunter)`);
    return names.length ? `Owned for other classes: ${names.join(', ')}.` : null;
  }

  // ------------------------------------------------------------------ actions and feedback
  /** One rank per click; a second click within BUY_GAP_MS (a double click) buys nothing more. */
  function buy(id) {
    hideTip();
    const t = performance.now();
    if (t - lastBuy < BUY_GAP_MS) return;
    lastBuy = t;
    ctx.act({ type: 'META_BUY', id });
  }

  /** What changed since the last render: Echoes (count to the new balance), ranks bought, unlocks newly available. */
  function effects(before, m) {
    const D = ctx.data.meta;
    const lr = m.lastRun;
    if (!before) {
      // just opened: the Echoes of the run that has just ended count up once
      if (lr && lr.n !== shownRun && lr.gained > 0) {
        shownRun = lr.n;
        countBalance(lr.before, lr.after);
        say(`+${fmtNum(lr.gained)} Echoes from ${lr.name}'s run${lr.firstKill ? `, with the first-kill bonus of the ${lr.className}` : ''}.`, 'gain');
      } else if (lr) shownRun = lr.n;
      return;
    }
    if (before.echoes !== m.echoes) countBalance(before.echoes, m.echoes);
    const bought = m.offers.filter((o) => o.rank > ((before.offers.find((x) => x.id === o.id) || { rank: 0 }).rank));
    const opened = m.offers.filter((o) => o.available && o.rank === 0 && !(before.offers.find((x) => x.id === o.id) || {}).available);
    const lines = nextRunLines(m.next, D, ctx.data);
    for (const o of bought) {
      flash(`.mcard[data-id="${o.id}"]`, 'fx-bought', 1300);
      flash(`.mn-chip[data-id="${o.id}"]`, 'fx-fresh', 2200);
      const card = el.querySelector(`.mcard[data-id="${o.id}"] .pips i:nth-child(${o.rank})`); if (card) card.classList.add('new');
    }
    for (const o of opened) flash(`.mcard[data-id="${o.id}"]`, 'fx-opened', 1600);
    if (bought.length) {
      const o = bought[0]; const line = lines.find((l) => l.id === o.id);
      const extra = opened.length ? ` Now open: ${opened.map((x) => x.name).join(', ')}.` : '';
      const where = line ? ` Next run: ${line.text}.` : o.id === 'oaths' ? ' Swear them on class select.' : '';
      say(`${o.name}${o.ranks > 1 ? `, rank ${o.rank} of ${o.ranks}` : ''}: learned.${where}${extra}`, 'buy');
    }
  }

  function flash(sel, cls, ms) {
    const t = el.querySelector(sel); if (!t) return;
    if (settings.instant) ms = Math.min(ms, 600);
    t.classList.remove(cls); void t.offsetWidth; t.classList.add(cls);
    setTimeout(() => t.classList.remove(cls), ms);
  }

  /** The balance counts from one value to the next, and the difference floats up beside it. */
  function countBalance(a, b) {
    const n = el.querySelector('.mbal .n'); const dl = el.querySelector('.mbal .delta');
    if (!n) return;
    clearInterval(balT);
    const diff = b - a;
    if (dl && diff) { dl.textContent = `${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff))}`; dl.className = 'delta ' + (diff > 0 ? 'up' : 'down'); void dl.offsetWidth; dl.classList.add('on'); }
    const ms = settings.instant ? 0 : Math.min(1100, 350 + Math.abs(diff) * 2);
    if (!ms) { n.textContent = fmtNum(b); return; }
    const t0 = performance.now();
    n.textContent = fmtNum(a);
    el.querySelector('.mbal').classList.add('counting');
    balT = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms); const e = 1 - Math.pow(1 - k, 3);
      n.textContent = fmtNum(Math.round(a + (b - a) * e));
      if (k >= 1) { clearInterval(balT); n.textContent = fmtNum(b); const mb = el.querySelector('.mbal'); if (mb) mb.classList.remove('counting'); }
    }, 30);
  }

  function say(text, kind) {
    if (!ticker) return;
    clearTimeout(tickerT);
    ticker.className = 'mtick on k-' + kind;
    ticker.textContent = text;
    tickerT = setTimeout(() => { if (ticker) ticker.classList.remove('on'); }, kind === 'buy' ? 6000 : 8000);
  }
  function idleTicker(m) {
    if (!ticker) return;
    const reach = m.offers.filter((o) => o.affordable);
    ticker.className = 'mtick idle';
    ticker.textContent = reach.length ? `${cap(numWord(reach.length))} ${plural(reach.length, 'unlock')} within reach.` : m.offers.every((o) => o.rank >= o.ranks) ? 'Every unlock is yours.' : 'Every run earns Echoes, even a short one.';
  }

  return {
    el, sync,
    isOpen: () => open,
    open: () => setOpen(true),
    close: () => setOpen(false),
  };
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Oaths on class select (rules 11.5) when the profile owns them: a switch per Oath with its effect, sending SET_OATH,
 * and the Echo multiplier of the Oaths sworn, from the engine (dry START_RUN summary).
 */
export function buildOaths(v, ctx) {
  const D = ctx.data.meta; const m = v.meta; const sworn = new Set(v.create.oaths || []);
  const box = h('div.oaths.panel');
  box.appendChild(h('div.oh', h('span.title', 'Oaths'), h('span.dim', `+${pct1(D.num.oathEcho)} Echoes each`)));
  for (const id of D.oathIds) {
    const o = D.oaths[id]; const on = sworn.has(id); const fx = oathEffect(o, D);
    const b = h('button.oath' + (on ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': o.name, dataset: { oath: id } },
      h('span.sw'), h('span.ot', h('b', o.name), h('span.os', fx.short)));
    b.addEventListener('click', () => ctx.act({ type: 'SET_OATH', oath: id, on: !on }));
    tip(b, () => h('div', h('div.tt-name', o.name), h('div.tt-line.desc', fx.long), h('div.tt-line.use', `+${pct1(D.num.oathEcho)} Echoes from the run for each Oath sworn.`), h('div.tt-hint', on ? 'Sworn. Click to take it back.' : 'Click to swear it for the next run.')));
    box.appendChild(b);
  }
  const mult = m.next ? m.next.oathMult : 1;
  box.appendChild(h('div.of' + (sworn.size ? '.on' : ''), sworn.size ? `Echoes from this run ×${Math.round(mult * 100) / 100}` : 'No Oath sworn: a normal run.'));
  return box;
}
