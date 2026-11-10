// tracks.js - the combat v2 display (docs/specs/combat-v2.md 10; engine-api.md 1, 6): each enemy's intent track on its
// nameplate (chips, the next action largest) and in the target frame (rows), role badges with their pack role, the
// off-balance marker, the opening ruler (rounds 1..OPENING_ROUNDS with the threats the tracks show) and the engage panel
// (the class's three engage options plus "any bar spell", each previewed on the tracks from R.engagePreview on hover).
// Presentation only: every entry, target, estimate, option, preview and window comes from the engine through the bridge
// view (engine-bridge.js convTrack, convRole, engageView, legal.spells[].window, bridge.engagePreview).
import { h, add, clear, fmtNum } from './util.js';
import { abilityIcon, roleIcon, engageIcon, controlIcon, statusIcon, spellIcon } from './art-icons.js';
import { tip, spellTip } from './tooltip.js';
import { ROLE_INFO, CONTROL_WORD, ENGAGE_KIND, engageText, numWord, plural } from './ui-text.js';

/** Rounds the opening ruler numbers (combat-v2.md 10.4: rounds 1-5, the first 4-5 moves of the owner's feedback). */
export const OPENING_ROUNDS = 5;

const pct = (x) => `${Math.round((x || 0) * 100)} %`;
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const TGT_SHORT = { player: 'you', pet: 'pet', both: 'all', self: 'self', ally: 'ally' };
const DAMAGE_KINDS = new Set(['hit', 'rend', 'cleave', 'boss']);
const HEAL_KINDS = new Set(['heal', 'selfHeal', 'bolster']);
/** An entry that deals damage (its estimate is damage), one that heals or shields (its estimate is the amount), or neither. */
const isDamage = (x) => DAMAGE_KINDS.has(x.kind) || (x.kind == null && x.est > 0 && !x.support);
const isHeal = (x) => HEAL_KINDS.has(x.kind);
/** Notable entries: what the ruler places and what the track marks (heavy, cast, signature, pack roles). */
const notable = (x) => x.heavy || x.cast || x.signature || ['signal', 'bolster', 'heal', 'summon', 'cleave', 'curse', 'shieldAlly'].includes(x.kind);

/** Who an entry targets, in words. */
export function targetWord(x, v) {
  if (x.target === 'ally') {
    const a = v && v.combat ? v.combat.enemies.find((e) => e.idx === x.allyIdx) : null;
    return a ? a.name : 'an ally';
  }
  return { player: 'you', pet: 'your pet', both: 'you and your pet', self: 'itself' }[x.target] || '';
}

/** The engage hover preview (R.engagePreview) for one enemy's entry: { cancel, ob, window, pet } or null. */
function previewOf(pv, e, x) {
  const p = pv && pv.enemies ? pv.enemies.find((q) => q.u === e.idx) : null;
  if (!p) return null;
  const has = (list) => !!(list && list.includes(x.turn));
  const out = { cancel: has(p.cancelled), ob: has(p.offBalance), window: has(p.window), pet: has(p.pet) };
  return out.cancel || out.ob || out.window || out.pet ? out : null;
}

/**
 * What cancels an entry: the engine's (x.cancel: control now or still covering that turn, a trap), an interrupt that just
 * landed on the now-entry while the round plays, or the engage option previewed on hover.
 */
function cancelOf(e, x, p, ctx) {
  if (x.cancel) return x.cancel;
  if (x.now && e.intent && e.intent.interrupted) return { by: 'INTERRUPT', offBalance: !!x.cast, breaks: false };
  if (!(p && p.cancel)) return null;
  const by = ctx.ui.preview.ctl || 'PREVIEW';
  return { by, offBalance: p.ob, preview: true, breaks: by === 'SAPPED' || by === 'HEXED', option: ctx.ui.preview.name || null };
}

/** The entries of an enemy to show: its track, or (mock, older engine) its single intent as a one-entry track. */
export function entriesOf(e) {
  if (e.track && e.track.length) return e.track;
  const it = e.intent;
  if (!it || it.id === 'unaware' || it.id === 'none') return [];
  return [{ turn: it.turn || 0, round: null, id: it.id, name: it.name, kind: it.kind || (it.selfHeal || it.mend ? 'heal' : it.support ? 'brace' : 'hit'), cast: it.cast, heavy: it.heavy, scripted: false, signature: false,
    school: it.school, target: it.target, allyIdx: it.allyIdx ?? null, est: it.est, support: it.support, now: true, cancel: null, replaced: null, boss: null }];
}

// ------------------------------------------------------------------ track entries
/** The number an entry shows: damage (to its target), a heal or shield amount (+N), or nothing. */
function amountText(x) {
  if (!x.est) return '';
  if (isHeal(x)) return `+${fmtNum(x.est)}`;
  return isDamage(x) ? fmtNum(x.est) : '';
}

/**
 * The track chips of a nameplate: the first entry large (icon, name, estimate and target), the others small (icon and
 * estimate; the target when it is not you). Marks: heavy, cast, signature, control that cancels the entry (now, or the
 * rounds its control status still covers), a cancelled heavy or cast that leaves it off-balance, and the hover preview of
 * an engage option. opts.allSmall: every chip small (Shards).
 */
export function trackChips(box, e, ctx, opts = {}) {
  const v = ctx.view; const list = entriesOf(e);
  const pv = ctx.ui.preview && ctx.ui.preview.data;
  const key = `${JSON.stringify(list.map((x) => [x.turn, x.id, x.est, x.target, x.allyIdx, x.cancel && x.cancel.by, x.replaced && x.replaced.reason, x.now]))}|${pv ? JSON.stringify(pv.enemies.find((q) => q.u === e.idx) || null) : ''}|${opts.allSmall ? 1 : 0}|${e.intent && e.intent.interrupted ? 'I' : ''}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key; clear(box);
  list.forEach((x, i) => {
    const big = i === 0 && !opts.allSmall;
    const p = previewOf(pv, e, x);
    const cancel = cancelOf(e, x, p, ctx);
    const ob = !!(cancel && cancel.offBalance);
    const petHit = !!(p && p.pet);
    const tgt = petHit ? 'pet' : x.target;
    const cls = ['tk', big ? 'big' : 'sm', x.now ? 'now' : '', x.heavy ? 'heavy' : '', x.cast ? 'cast' : '', x.signature ? 'sig' : '', cancel ? 'cancel' : '',
      cancel && (cancel.breaks || cancel.preview) ? 'soft' : '', ob ? 'ob' : '', p ? 'pv' : '', p && p.window ? 'pvwin' : '', isHeal(x) || x.support ? 'sup' : ''].filter(Boolean);
    const amt = amountText(x);
    const el = h(`div.${cls.join('.')}`, { dataset: { turn: x.turn, round: x.round ?? '', id: x.id, est: x.est || 0 } },
      x.round != null ? h('span.r', String(x.round)) : null,
      h('img', { src: abilityIcon(x), alt: '' }),
      big ? h('span.tx', h('span.tn', x.name), h('span.tv', amt ? h('b', amt) : null, tgt && tgt !== 'self' && (amt || tgt !== 'player') ? h('i', `▸ ${TGT_SHORT[tgt] || tgt}`) : null))
        : h('span.tv', amt ? h('b', amt) : null, tgt && tgt !== 'player' && tgt !== 'self' ? h('i', TGT_SHORT[tgt] || tgt) : null),
      x.signature ? h('i.b-sig', '★') : null,
      x.replaced && !cancel ? h('i.b-rep', '↺') : null,
      cancel ? h('img.b-ctl', { src: cancel.by === 'PREVIEW' ? statusIcon('STUN') : controlIcon(cancel.by), alt: '' }) : null,
      ob ? h('i.b-ob', 'OFF-BAL') : null,
      p && p.window && !ob ? h('i.b-ob.frost', 'WINDOW') : null);
    tip(el, () => entryTip(e, x, ctx, { cancel, ob, petHit, preview: p }));
    box.appendChild(el);
  });
}

/**
 * The target frame's track: one row per entry with the round (or "Now"), the action, its marks, the target in words and
 * the estimate; the engage round says the enemy does not act this round.
 */
export function trackRows(box, e, ctx) {
  const v = ctx.view; const list = entriesOf(e);
  const pv = ctx.ui.preview && ctx.ui.preview.data;
  const unaware = e.intent && e.intent.id === 'unaware';
  const key = `${JSON.stringify(list.map((x) => [x.turn, x.id, x.est, x.target, x.allyIdx, x.cancel && x.cancel.by, x.replaced && x.replaced.reason, x.now]))}|${unaware}|${e.intent && e.intent.interrupted ? 'I' : ''}|${pv ? JSON.stringify(pv.enemies.find((q) => q.u === e.idx) || null) : ''}|${(e.role && JSON.stringify(e.role)) || ''}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key; clear(box);
  if (!list.length && !unaware) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.appendChild(h('div.tr-h', unaware ? h('span.zz', h('img', { src: abilityIcon({ id: 'unaware' }), alt: '' }), 'Unaware: it does not act this round') : h('span', 'Next actions')));
  for (const x of list) {
    const p = previewOf(pv, e, x);
    const cancel = cancelOf(e, x, p, ctx);
    const ob = !!(cancel && cancel.offBalance);
    const petHit = !!(p && p.pet);
    const tgt = petHit ? 'pet' : x.target;
    const flags = [x.heavy ? h('span.flag.heavy', 'Heavy') : null, x.cast ? h('span.flag.cast', 'Cast') : null, x.signature ? h('span.flag.sig', '★ Signature') : null];
    let sub = '';
    if (cancel) sub = `${cap(CONTROL_WORD[cancel.by] || 'controlled')}${cancel.offBalance ? '' : ': skipped'}`;
    else if (x.replaced) sub = `${x.replaced.from} → ${x.name}: ${x.replaced.reason}`;
    else if (petHit) sub = 'Your pet takes it (Send the Pet)';
    else { const w = targetWord({ ...x, target: tgt }, v); sub = isDamage(x) ? `Hits ${w}` : w && w !== 'itself' && x.kind !== 'curse' ? `On ${w}` : supportWord(x); }
    const amt = amountText(x);
    const row = h(`div.tr${x.now ? '.now' : ''}${x.heavy ? '.heavy' : ''}${x.cast ? '.cast' : ''}${cancel ? '.cancel' : ''}${cancel && (cancel.breaks || cancel.preview) ? '.soft' : ''}${ob ? '.ob' : ''}${p ? '.pv' : ''}`,
      { dataset: { turn: x.turn, round: x.round ?? '', id: x.id } },
      h('span.rt', x.now ? 'Now' : x.round != null ? `R${x.round}` : ''),
      h('img', { src: abilityIcon(x), alt: '' }),
      h('div.tm', h('div.tn', h('span.nm', x.name), flags), h('div.ts', sub, ob ? h('b.obt', ' → off-balance') : null, p && p.window && !ob ? h('b.obt.frost', ' → frozen window') : null)),
      amt ? h(`div.td${isHeal(x) ? '.heal' : ''}`, amt) : null);
    tip(row, () => entryTip(e, x, ctx, { cancel, ob, petHit, preview: p }));
    box.appendChild(row);
  }
}
const supportWord = (x) => ({ brace: 'Braces itself', selfShield: 'Shields itself', selfHeal: 'Heals itself', heal: 'Mends itself', bolster: 'Shields itself', signal: 'Calls a reinforcement', summon: 'Calls for help', curse: 'Curses you' }[x.kind] || '');

/** Tooltip of a track entry: what, when, to whom, how hard, its marks, and what control or a preview does to it. */
export function entryTip(e, x, ctx, o = {}) {
  const v = ctx.view; const n = (ctx.data.v2 && ctx.data.v2.num) || {};
  const when = x.now ? 'This round' : x.round != null ? `Round ${x.round}` : '';
  const turn = x.turn ? ` · its turn ${x.turn}` : '';
  const tgt = o.petHit ? 'pet' : x.target;
  const w = targetWord({ ...x, target: tgt }, v);
  const lines = [];
  if (x.boss) {
    for (const a of x.boss.actions) lines.push(h('div.tt-line.num', `${a.name}${a.est ? `: about ${fmtNum(a.est)} to ${targetWord(a, v) || 'you'}` : ''}`));
    if (x.boss.brand) lines.push(h('div.tt-line', 'A Brand stack lands at the end of this round.'));
    if (x.boss.shards) lines.push(h('div.tt-line', 'A wave of Dimming Shards comes at the start of this round.'));
    if (x.boss.alt) lines.push(h('div.tt-warn', `If phase ${x.boss.ifPhase} starts first: ${x.boss.alt.join(' + ')}`));
  } else if (isDamage(x) && x.est) lines.push(h('div.tt-line.num', `Estimated damage to ${w}: about ${fmtNum(x.est)}${x.hits > 1 ? ` (${x.hits} hits)` : ''}`));
  else if (isHeal(x) && x.est) lines.push(h('div.tt-line.num', `${x.kind === 'bolster' ? 'Shield' : 'Heal'} on ${w || 'an ally'}: about ${fmtNum(x.est)}`));
  else { const sw = supportWord(x) || (w ? `On ${w}` : ''); if (sw) lines.push(h('div.tt-line', sw)); }
  if (x.kind === 'signal') lines.push(h('div.tt-warn', `Signal: at the end of that round ${numWord(n.signalAdds || 1)} more ${plural(n.signalAdds || 1, 'enemy joins', 'enemies join')}. Kill, interrupt or control it first.`));
  if (x.heavy) lines.push(h('div.tt-warn', 'Heavy: a telegraphed big hit. Stun or control it on that turn to cancel it (it is then off-balance), or let a shield, a dodge or your pet take it.'));
  if (x.cast) lines.push(h('div.tt-hint', 'Cast: interrupt it or control the caster on that turn to cancel it; a cancelled cast leaves it off-balance.'));
  if (x.signature) lines.push(h('div.tt-line', { style: { color: '#ffd36a' } }, '★ Signature: its strongest ability, on a scripted turn.'));
  else if (x.scripted && !x.boss) lines.push(h('div.tt-sub', 'Opening move: the same for every enemy of its role.'));
  if (x.replaced) lines.push(h('div.tt-warn', `${x.replaced.from} → ${x.name}: ${x.replaced.reason}.`));
  if (o.cancel) {
    const word = CONTROL_WORD[o.cancel.by] || 'controlled';
    if (o.cancel.preview) lines.push(h('div.tt-hint', `With this opening: cancelled${o.ob ? ', and it is off-balance afterwards' : ''}.`));
    else lines.push(h('div.tt-hint', `${x.now ? 'Cancelled this round' : 'Cancelled while it lasts'}: ${word}${o.cancel.breaks ? '. Any damage wakes it' : ''}.${o.ob ? ' A cancelled heavy blow or cast leaves it off-balance.' : ''}`));
  }
  if (o.preview && o.preview.window) lines.push(h('div.tt-hint', 'With this opening: frozen on that turn, which counts as off-balance.'));
  if (o.petHit) lines.push(h('div.tt-hint', 'With this opening: your pet takes this hit.'));
  return h('div.tt-spell', h('div.tt-row', h('div.tt-name', `${e.name}: ${x.name}`), h('div.tt-rank', `${when}${turn}`)), lines);
}

// ------------------------------------------------------------------ roles
/** The role badge of an enemy (an <img> with its tooltip), or null. */
export function roleBadge(e, ctx) {
  if (!e.role) return null;
  const el = h('img.role', { src: roleIcon(e.role.id), alt: (ROLE_INFO[e.role.id] || {}).name || e.role.id, dataset: { role: e.role.id } });
  tip(el, () => roleTip(e, ctx));
  return el;
}
/** Short pack-role tags beside the name: Lookout (Signal round), Ward / Protector, Bloodlust, immune to control. */
export function roleTags(e, ctx) {
  const v = ctx.view; const r = e.role; const out = [];
  if (r && r.lookout) out.push(h('span.rtag.look', `Signal R${r.lookout}`));
  if (r && r.ward != null) out.push(h('span.rtag.ward', `Guards ${shortName(v, r.ward)}`));
  if (r && r.guardedBy && r.guardedBy.length) out.push(h('span.rtag.ward', 'Ward'));
  if (r && r.bloodlust) out.push(h('span.rtag.blood', `+${pct(r.bloodlust)}`));
  return out;
}
const shortName = (v, idx) => { const e = v.combat && v.combat.enemies.find((x) => x.idx === idx); return e ? e.name.split(' ').slice(-1)[0] : 'ally'; };

/** Role tooltip: the role, its opening script (engine), what it asks of you and its pack role now. */
export function roleTip(e, ctx) {
  const r = e.role; if (!r) return null;
  const info = ROLE_INFO[r.id] || { name: r.id, text: '', asks: '' };
  const d = ctx.data.v2; const v = ctx.view; const n = (d && d.num) || {};
  const script = d && d.scripts[r.id] ? d.scripts[r.id].map((id) => { const a = (d.scriptActions[id] || (d.actions[r.id] || []).find((x) => x.id === id)); return a ? `${a.name}${a.heavy ? ' (heavy)' : a.cast ? ' (cast)' : ''}` : id; }) : [];
  const lines = [h('div.tt-line.desc', info.text)];
  if (script.length) lines.push(h('div.tt-line', `Opening: ${script.join(', ')}`));
  if (info.asks) lines.push(h('div.tt-hint', info.asks));
  if (r.lookout) lines.push(h('div.tt-warn', `Lookout: signals for help in round ${r.lookout}.`));
  if (r.ward != null) lines.push(h('div.tt-line', `Protects ${(v.combat.enemies.find((x) => x.idx === r.ward) || {}).name || 'an ally'} (its ward).`));
  if (r.guardedBy && r.guardedBy.length) lines.push(h('div.tt-line', `Ward of ${r.guardedBy.map((i) => (v.combat.enemies.find((x) => x.idx === i) || {}).name).filter(Boolean).join(', ')}: its guardian shields it.`));
  if (r.id === 'beast') lines.push(h('div.tt-line.num', `Bloodlust: +${pct(r.bloodlust || 0)} damage now; +${pct(n.bloodlustStep)} per turn it acts, at most +${pct(n.bloodlustMax)}.`));
  if (r.id === 'mender' && n.bolsterPct) lines.push(h('div.tt-line.num', `Bolster: shields its weakest ally for ${pct(n.bolsterPct)} of that ally's health.`));
  if (e.ccImmune) lines.push(h('div.tt-warn', 'Immune to control: stuns, Sap, freezes and traps do not work on it.'));
  return h('div.tt-spell', h('div.tt-row', h('div.tt-name', `${info.name}`), h('div.tt-kind.bad', 'Role')), lines);
}

// ------------------------------------------------------------------ off-balance
/**
 * The off-balance ribbon text: "Off-balance +30 % dmg · +20 % crit" (FROZEN windows say Frozen); short: the nameplate's
 * "Off-balance +30 %" (the tooltip and the target frame give the rest).
 */
export function offBalanceText(ob, short = false) {
  if (!ob) return '';
  if (short) return `${ob.status === 'FROZEN' ? 'Frozen' : 'Off-balance'} +${pct(ob.taken)}`;
  return `${ob.status === 'FROZEN' ? 'Frozen' : 'Off-balance'} · +${pct(ob.taken)} dmg · +${pct(ob.crit)} crit`;
}
export function offBalanceTip(e) {
  const ob = e.offBalance; if (!ob) return null;
  return h('div.tt-spell', h('div.tt-name', { style: { color: '#ffc25a' } }, `${e.name} is off-balance`),
    h('div.tt-line.desc', `${ob.status === 'FROZEN' ? 'Frozen, which counts as off-balance' : 'Its big move failed'}: it takes ${pct(ob.taken)} more damage from you and your pet, your hits on it crit ${pct(ob.crit)} more often, and it cannot dodge.`),
    h('div.tt-hint', 'Spend your burst now: the glowing spells on your bar land in the window.'),
    h('div.tt-sub', ob.rounds == null ? 'While it lasts' : `${ob.rounds} ${plural(ob.rounds, 'round')} left (your next action)`));
}

// ------------------------------------------------------------------ opening ruler
/**
 * The opening ruler (combat-v2.md 10.4): rounds 1..OPENING_ROUNDS of a fight with an engage round, the current one marked;
 * per round the notable entries of every living enemy's track (heavy, cast, signature, Signal, Bolster, Mend) and the damage
 * the tracks estimate on you; rounds the tracks do not reach yet show "?". Hidden in the end-boss fight and after the opening.
 */
export function createRuler(root, ctx) {
  const el = h('div#ruler.hidden', { 'aria-label': 'Opening ruler' });
  root.appendChild(el);
  let lastKey = '';
  function update(v) {
    const c = v.combat;
    const show = !!(c && !c.over && !c.isBoss && c.hasEngage && c.round <= OPENING_ROUNDS && v.phase !== 'SUMMARY' && !v.loot);
    el.classList.toggle('hidden', !show);
    if (!show) { lastKey = ''; return; }
    const pv = ctx.ui.preview && ctx.ui.preview.data;
    const cols = [];
    for (let r = 1; r <= OPENING_ROUNDS; r++) cols.push({ r, threats: [], dmg: 0, known: r <= c.round, cancelled: 0 });
    for (const e of c.enemies) {
      if (!e.alive || e.hidden) continue;
      for (const x of entriesOf(e)) {
        const col = cols[(x.round || 0) - 1]; if (!col) continue;
        col.known = true;
        const p = previewOf(pv, e, x);
        const cancelled = !!(x.cancel || (p && p.cancel));
        if (!cancelled && isDamage(x) && (x.target === 'player' || x.target === 'both') && !(p && p.pet)) col.dmg += x.est || 0;
        if (notable(x)) col.threats.push({ e, x, cancelled, ob: !!((x.cancel && x.cancel.offBalance) || (p && p.ob)) });
      }
    }
    const key = JSON.stringify([c.round, cols.map((k) => [k.known, k.dmg, k.threats.map((t) => [t.e.idx, t.x.turn, t.x.id, t.cancelled, t.ob])])]);
    if (key === lastKey) return;
    lastKey = key; clear(el);
    el.appendChild(h('div.rl-h', h('span.rl-t', 'Opening'), h('span.rl-s', c.round === 1 ? 'Plan your first moves' : `Round ${c.round} of ${OPENING_ROUNDS}`)));
    const row = h('div.rl-cols');
    for (const k of cols) {
      const state = k.r < c.round ? 'past' : k.r === c.round ? 'cur' : 'next';
      const engage = k.r === 1;
      const head = h('div.rl-n', engage ? h('span', '1 · Engage') : h('span', `Round ${k.r}`), state === 'cur' ? h('b.rl-now', 'Now') : null);
      const body = h('div.rl-b');
      if (engage) body.appendChild(h('div.rl-q', 'They do not act'));
      else if (!k.known) body.appendChild(h('div.rl-q', '?'));
      else {
        const icons = h('div.rl-ic');
        for (const t of k.threats.slice(0, 4)) {
          const ic = h(`div.rl-x${t.x.heavy ? '.heavy' : ''}${t.x.cast ? '.cast' : ''}${t.cancelled ? '.cancel' : ''}${t.ob ? '.ob' : ''}`,
            h('img', { src: abilityIcon(t.x), alt: '' }), t.e.role ? h('img.rl-role', { src: roleIcon(t.e.role.id), alt: '' }) : null);
          ic.addEventListener('click', () => ctx.ui.setTarget(t.e.idx));
          tip(ic, () => entryTip(t.e, t.x, ctx, { cancel: t.x.cancel || (t.cancelled ? { by: 'PREVIEW', preview: true, offBalance: t.ob } : null), ob: t.ob }));
          icons.appendChild(ic);
        }
        if (k.threats.length > 4) icons.appendChild(h('span.rl-more', `+${k.threats.length - 4}`));
        body.appendChild(icons);
        body.appendChild(h(`div.rl-d${k.dmg ? '' : '.none'}`, k.dmg ? `≈ ${fmtNum(k.dmg)} to you` : 'no hits on you'));
      }
      const col = h(`div.rl-c.${state}${engage ? '.eng' : ''}`, { dataset: { round: k.r } }, head, body);
      tip(col.querySelector('.rl-n'), () => h('div', h('div.tt-name', engage ? 'Round 1: Engage' : `Round ${k.r}`),
        h('div.tt-line.desc', engage ? 'The enemies have not noticed you: they do not act this round. Choose your opening.' : k.known ? 'Big moves the tracks show for this round, and the damage they estimate on you.' : 'The tracks do not reach this round yet.')));
      row.appendChild(col);
    }
    el.appendChild(row);
  }
  return { el, update };
}

// ------------------------------------------------------------------ engage panel
/**
 * The engage panel (combat-v2.md 10.3) in the engage round of every fight but the end boss: the class's strike, control
 * and setup options as large buttons (keys Q, W, E) with their effect in one line and the target they would hit, plus
 * "any bar spell". Hovering an option previews it on the tracks (R.engagePreview through ctx.ui.setPreview) and marks the
 * enemies it may target. Pre-cast lists the bar spells it can cast for free.
 */
export function createEngagePanel(root, ctx) {
  const el = h('div#engage.panel.hidden', { 'aria-label': 'Engage' });
  root.appendChild(el);
  let lastKey = '';
  const nameOf = (v, i) => { const e = v.combat.enemies.find((x) => x.idx === i); return e ? e.name : '?'; };
  /** The target an option would use: the current target if it may, else none (the card says whom to choose). */
  const pick = (v, targets) => {
    if (!targets || !targets.length) return { ok: false, t: null };
    if (targets.length === 1 && targets[0] === null) return { ok: true, t: null, none: true };
    return targets.includes(ctx.ui.target) ? { ok: true, t: ctx.ui.target } : { ok: false, t: null, first: targets[0] };
  };
  function update(v) {
    const c = v.combat; const eg = c && !c.over ? c.engage : null;
    const show = !!(eg && !ctx.ui.playing && !v.autoplay && !v.loot && v.phase !== 'SUMMARY' && !(v.node && v.node.step === 'intro'));
    el.classList.toggle('hidden', !show);
    document.body.classList.toggle('engage-round', show);
    if (!show) { lastKey = ''; return; }
    const key = JSON.stringify([eg, ctx.ui.target, ctx.ui.precastArmed, v.player.classId]);
    if (key === lastKey) return;
    lastKey = key; clear(el);
    const d = ctx.data.v2 || { options: {}, num: {} };
    el.appendChild(h('div.eg-h', h('div.title', 'Engage'), h('div.eg-sub', h('b', 'They have not noticed you: enemies do not act this round.'), ' Read their tracks, pick a target, then open.')));
    const opts = h('div.eg-opts');
    for (const o of eg.options) {
      const data = d.options[o.id] || { id: o.id };
      const sel = o.spells ? null : pick(v, o.targets);
      const off = !!o.reason;
      let tline;
      if (off) tline = h('div.eg-tg.bad', o.reason);
      else if (o.spells) tline = h('div.eg-tg', ctx.ui.precastArmed ? 'Now press a spell key (1–7) or click a spell:' : 'Choose a spell:');
      else if (sel.none) tline = h('div.eg-tg.ok', 'No target needed');
      else if (sel.ok) tline = h('div.eg-tg.ok', `On ${nameOf(v, sel.t)}`);
      else tline = h('div.eg-tg.warn', `Choose a target: ${o.targets.map((i) => nameOf(v, i)).join(', ')}`);
      const card = h(`div.eg-opt.k-${o.kind}${off ? '.off' : ''}${o.spells && ctx.ui.precastArmed ? '.armed' : ''}`, { role: o.spells ? null : 'button', tabindex: '-1', dataset: { opt: o.id }, 'aria-label': `${o.name} (${ENGAGE_KIND[o.kind] || o.kind})` },
        h('img.eg-ic', { src: engageIcon(o.id), alt: '' }),
        h('div.eg-main', h('div.eg-nm', h('span.eg-name', o.name), h('span.eg-kind', ENGAGE_KIND[o.kind] || o.kind), o.key ? h('span.kbd', o.key) : null),
          h('div.eg-txt', engageText(data, d.num)), tline));
      if (o.spells && !off) {
        const row = h('div.eg-spells');
        for (const sp of o.spells) {
          const sd = ctx.data.spells[sp.spellId] || { name: sp.spellId };
          const slot = v.player.bar.indexOf(sp.spellId);
          const b = h('button.eg-sp', { type: 'button', 'aria-label': `Pre-cast ${sd.name}`, dataset: { spell: sp.spellId } }, h('img', { src: spellIcon(sp.spellId, sd), alt: '' }), slot >= 0 ? h('span.k', String(slot + 1)) : null);
          b.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.ui.engage(o.id, sp.spellId); });
          b.addEventListener('pointerenter', () => hover(v, o, sp));
          b.addEventListener('pointerleave', () => ctx.ui.setPreview(null));
          tip(b, () => spellTip(sp.spellId, ctx, { hint: 'Pre-cast: no mana; its cooldown starts. Click to open with it.' }));
          row.appendChild(b);
        }
        card.querySelector('.eg-main').appendChild(row);
      }
      if (!o.spells) {
        card.addEventListener('click', () => ctx.ui.engage(o.id));
        card.addEventListener('pointerenter', () => hover(v, o, null));
        card.addEventListener('pointerleave', () => ctx.ui.setPreview(null));
      } else card.addEventListener('click', () => ctx.ui.armPrecast());
      opts.appendChild(card);
    }
    const any = h('div.eg-any', { dataset: { opt: 'bar' } }, h('span', h('b', 'Or open with any bar spell '), h('span.kbd', '1–7'), ', your attack ', h('span.kbd', 'A'), ' or a potion. They still do not act.'));
    any.addEventListener('pointerenter', () => document.body.classList.add('eg-bar-hint'));
    any.addEventListener('pointerleave', () => document.body.classList.remove('eg-bar-hint'));
    opts.appendChild(any);
    el.appendChild(opts);
  }
  /** Hover: preview the option on its target (the current target if it may, else its first valid one). */
  function hover(v, o, sp) {
    const targets = sp ? sp.targets : o.targets;
    if (o.reason || !targets || !targets.length) { ctx.ui.setPreview({ option: o.id, valid: [], data: null }); return; }
    const t = targets.length === 1 && targets[0] === null ? null : targets.includes(ctx.ui.target) ? ctx.ui.target : targets[0];
    const data = ctx.bridge.engagePreview(o.id, t, sp ? sp.spellId : undefined);
    const ctl = { sap: 'SAPPED', binding_glyph: 'FROZEN', lay_trap: 'TRAP' }[o.id] || (sp ? { hexbind: 'HEXED', rime_burst: 'FROZEN' }[sp.spellId] : null) || null;
    const name = sp ? (ctx.data.spells[sp.spellId] || {}).name || o.name : o.name;
    ctx.ui.setPreview({ option: o.id, name, spellId: sp ? sp.spellId : null, target: t, valid: targets.filter((x) => x !== null), ctl, data });
  }
  return { el, update };
}
