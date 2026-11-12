// tracks.js - the combat v2 display (docs/specs/combat-v2.md 10; engine-api.md 1, 6): each enemy's intent track on its
// nameplate (chips, the next action largest) and in the target frame (rows), role badges with their pack role, the
// off-balance marker, the opening ruler (rounds 1..OPENING_ROUNDS with the threats the tracks show) and the engage panel
// (the class's three engage options plus "any bar spell", each previewed on the tracks from R.engagePreview on hover).
// Combat v2.1 (docs/specs/combat-v2.md 16, 10.9): wind-ups get a strong badge on their track entry, on the ruler and over
// the enemy (the nameplate's wind-up line, from the first round the track shows it), a tooltip with what answers it and the
// bar spells that can, the EMPOWERED and STAGGERED stacks as lasting badges with their damage, and Disrupt as the control
// option's label on a dungeon boss (greyed out with the engine's reason when no wind-up is visible).
// M2b v13 (docs/specs/changes-m2b-v13.md "UI needs" 1-4, 6): a Deathblow (the first wind-up of an elite, rare or dungeon
// boss) has its own crimson badge with a skull, apart from the ember wind-up badge, on its chip, row, ruler round and the
// line over the enemy, with its estimate and "MAIMS if it lands", readable in the engage round without hovering; the
// answers ready now (R.windupView answers: engage options in the engage round, bar spells in its round; "sure" and "now")
// are named with their keys on that line and the engage panel, and highlighted on the engage cards; "No answer ready" in
// red when windupView says ready is false; EMPOWERED from a Deathblow is its own "+100 %" badge; a first meeting's
// enemy is tagged "New". M2b v14 ("UI needs" 2): Sap on a lone enemy reads "Sure if you wait: press Pass next round; you
// stay hidden" (answer `wait`, `stealth`) on its card and in the tooltip, and the PASS answer is named with its key X.
// QA 2026-11-12 (playtest findings 2, 3, 8): a soft cancel (Sap, Hex: any damage breaks it) that has not cancelled yet reads
// "If you wait" (every enemy sapped: windupView's PASS answer) or "If not hit" on the chip, the row and the ruler, not
// ANSWERED, and the line over the enemy warns "Attacking breaks Sap: the Deathblow will land"; a damaging entry whose
// estimate is at least your health is marked LETHAL (line, row, chip, engage alert); a Deathblow aimed at your pet says
// what the engine does: it lands (MAIMED) if it hits your pet, Send the Pet makes the pet take it on purpose (answered).
// The first-fight hint (owner playtest 2026-11-11 08:03): beside the engage panel in the first engage round of each class,
// the three openers on keys Q, W, E; dismissed for good with "Got it" or the end of that round (localStorage HINT_KEY).
// Presentation only: every entry, target, estimate, option, preview and window comes from the engine through the bridge
// view (engine-bridge.js convTrack, convRole, engageView, legal.spells[].window, bridge.engagePreview).
import { h, add, clear, fmtNum } from './util.js';
import { abilityIcon, roleIcon, engageIcon, controlIcon, statusIcon, spellIcon, windupIcon, deathblowIcon } from './art-icons.js';
import { tip, spellTip } from './tooltip.js';
import { ROLE_INFO, CONTROL_WORD, ENGAGE_KIND, engageText, engageHint, numWord, plural, windupAnswers, windupStakes, deathblowStakes, sapWaitText } from './ui-text.js';

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

/**
 * The engage hover preview (R.engagePreview) for one enemy's entry: { cancel, ob, window, pet, stagger, disrupt } or null.
 * stagger (combat v2.1): the cancel answers this wind-up; disrupt: the option is a Disrupt on this enemy.
 */
function previewOf(pv, e, x) {
  const p = pv && pv.enemies ? pv.enemies.find((q) => q.u === e.idx) : null;
  if (!p) return null;
  const has = (list) => !!(list && list.includes(x.turn));
  const out = { cancel: has(p.cancelled), ob: has(p.offBalance), window: has(p.window), pet: has(p.pet), stagger: has(p.stagger), disrupt: !!p.disrupt };
  return out.cancel || out.ob || out.window || out.pet ? out : null;
}

/**
 * What cancels an entry: the engine's (x.cancel: control now or still covering that turn, a trap), an interrupt that just
 * landed on the now-entry while the round plays, or the engage option previewed on hover. stagger (combat v2.1): that
 * cancel answers the wind-up (the engine's cancel.stagger; an interrupted wind-up; the preview's stagger turns).
 */
function cancelOf(e, x, p, ctx) {
  if (x.cancel) return x.cancel;
  if (x.now && e.intent && e.intent.interrupted) return { by: 'INTERRUPT', offBalance: !!x.cast, breaks: false, stagger: !!x.windup };
  if (!(p && p.cancel)) return null;
  const by = p.disrupt ? 'TRAP' : ctx.ui.preview.ctl || 'PREVIEW';
  return { by, offBalance: p.ob, preview: true, breaks: by === 'SAPPED' || by === 'HEXED', option: ctx.ui.preview.name || null, stagger: !!p.stagger, disrupt: !!p.disrupt };
}

// ------------------------------------------------------------------ combat v2.1: wind-ups (combat-v2.md 16.2, rules 7.12)
/**
 * The wind-up state of an entry, or null when it is no wind-up: kind 'open' (it will play: answer it or it empowers),
 * 'answered' (the engine's predicted cancel answers it, or an interrupt stopped it; soft: Sap or Hex, which damage
 * breaks), 'preview' (the engage option hovered answers it: its cancel, or for a heavy one the pet taking it, which
 * engine-api.md 1 says Send the Pet answers while the pet lives), or 'void' (replaced for another reason than SILENCED:
 * neither answered nor landed). A now-entry replaced because SILENCED was answered.
 */
export function windupState(e, x, cancel, p) {
  if (!x.windup) return null;
  if (x.replaced && !cancel) return x.replaced.reason === 'silenced' ? { kind: 'answered', by: 'SILENCED' } : { kind: 'void', why: x.replaced.reason };
  // QA 2026-11-12: a TRAP on an enemy immune to control is Disrupt (any class): the answered line says "Disrupt", not "your trap"
  if (cancel && cancel.stagger) return cancel.preview ? { kind: 'preview', by: cancel.by, disrupt: !!cancel.disrupt } : { kind: 'answered', by: cancel.by, soft: !!cancel.breaks, disrupt: cancel.by === 'TRAP' && !!(cancel.disrupt || (e && e.ccImmune)) };
  if (p && p.pet && x.heavy) return { kind: 'preview', by: 'PET' };
  return { kind: 'open' };
}
/** The first wind-up of an enemy's track that still needs an answer, else the first one at all: { x, cancel, p, state } or null. */
export function firstWindup(e, ctx) {
  const pv = ctx.ui.preview && ctx.ui.preview.data;
  const list = entriesOf(e).filter((x) => x.windup).map((x) => { const p = previewOf(pv, e, x); const cancel = cancelOf(e, x, p, ctx); return { x, p, cancel, state: windupState(e, x, cancel, p) }; })
    .filter((w) => w.state && w.state.kind !== 'void');
  return list.find((w) => w.state.kind === 'open') || list[0] || null;
}
/** When a wind-up plays, in words: "now" or "R3". */
const whenText = (x) => (x.now ? 'now' : x.round != null ? `R${x.round}` : '');
/**
 * QA 2026-11-12 (finding 2): a wind-up answered by a soft cancel (Sap, Hex: any damage breaks it) that has not cancelled
 * it yet: 'wait' when waiting is the answer (windupView's PASS answer: every living enemy is sapped), 'nohit' otherwise
 * (it holds while that enemy takes no damage); null when the state is not such an answer.
 */
export function softPending(v, e, x, st) {
  if (!st || st.kind !== 'answered' || !st.soft || x.now) return null;
  const w = windupItem(v, e, x);
  return w && w.answers.some((a) => a.via === 'pass') ? 'wait' : 'nohit';
}
/** The wind-ups that waiting answers now (windupView's PASS answers), as a key for the redraw checks. */
const waitKey = (v) => ((v && v.combat && v.combat.windups) || []).filter((w) => w.answers.some((a) => a.via === 'pass')).map((w) => `${w.u}:${w.turn}`).join(',');
/** The short label of a pending soft answer: "If you wait" / "If not hit" (the chip, the row's flag, the ruler). */
export const SOFT_TAG = { wait: 'If you wait', nohit: 'If not hit' };
/** Its words: "answered if you wait" / "answered if not hit". */
export const SOFT_WORDS = { wait: 'answered if you wait', nohit: 'answered if not hit' };
/** The warning while waiting answers a Deathblow (QA 2026-11-12): attacking breaks Sap and the Deathblow lands. */
export const SAP_BREAK_WARN = 'Attacking breaks Sap: the Deathblow will land';
/**
 * QA 2026-11-12 (finding 3): an entry that deals damage to you (target you, or you and your pet) whose estimate (est, the
 * windupView's for a Deathblow) is at least your current health: LETHAL.
 */
export function isLethal(v, x, est = x.est) {
  const hp = v && v.player ? v.player.hp : 0;
  return !!(hp > 0 && est && est >= hp && isDamage(x) && (x.target === 'player' || x.target === 'both'));
}
/** A hard cancel (not soft, not a preview) stops the entry: it cannot be lethal. */
const hardCancel = (c) => !!(c && !c.breaks && !c.preview);
/** "MAIMS if it lands"; a Deathblow aimed at your pet lands when it hits your pet, and still maims you (rules 7.12, 7.13 (3)). */
export const maimsText = (target) => (target === 'pet' ? 'MAIMS you if it hits your pet' : 'MAIMS if it lands');
/** The LETHAL badge (a skull and the word). */
const lethalBadge = (tag = 'span.db-lethal') => h(tag, { title: 'Its estimate is at least your health: it kills you if it lands' }, h('img', { src: deathblowIcon(), alt: '' }), 'LETHAL');

// ------------------------------------------------------------------ M2b v13: Deathblows (rules 7.12; engine-api.md 6.2)
/** The engine's windupView item (estimate, stakes, answers, ready) of wind-up x of enemy e, or null (view.combat.windups). */
export function windupItem(v, e, x) {
  const c = v && v.combat;
  return c && c.windups ? c.windups.find((w) => w.u === e.idx && w.turn === x.turn) || null : null;
}
/** The key of an answer: Q, W or E for an engage option (the panel's order), 1-7 for a bar spell, X for Pass (M2b v14); '' when none. */
export function answerKey(v, a) {
  if (a.via === 'pass') return 'X';
  if (a.via === 'engage') { const o = v.combat && v.combat.engage ? v.combat.engage.options.find((q) => q.id === a.id) : null; return (o && o.key) || ''; }
  const i = v.player ? v.player.bar.indexOf(a.id) : -1;
  return i >= 0 ? String(i + 1) : '';
}
/** An answer's label: the option or spell name (a Pre-cast with its spell), " ?" when it is a chance (sure false). */
export function answerName(a, ctx) {
  const nm = a.spellId ? `${a.name}: ${(ctx.data.spells[a.spellId] || { name: a.spellId }).name}` : a.name;
  return nm;
}
/**
 * The answers of a windupView item to name now: those usable this round (`now`), else those that will be ready in its
 * round; one per key and name, sure ones first. { list: [{ a, key, name }], when: 'now' | 'later' }.
 */
export function answersToShow(w, v, ctx) {
  if (!w) return { list: [], when: 'now' };
  const uniq = (xs) => { const seen = new Set(); return xs.filter((a) => { const k = `${a.via}:${a.id}:${a.spellId || ''}`; if (seen.has(k)) return false; seen.add(k); return true; }); };
  const order = (xs) => [...xs].sort((p, q) => (q.sure ? 1 : 0) - (p.sure ? 1 : 0));
  const now = uniq(order(w.answers.filter((a) => a.now)));
  const list = now.length ? now : uniq(order(w.answers));
  return { list: list.map((a) => ({ a, key: answerKey(v, a), name: answerName(a, ctx) })), when: now.length ? 'now' : 'later' };
}
/** The answers as inline elements: "W Lay Trap · E Send the Pet" (a chance marked "?"). */
function answerEls(list) {
  const out = [];
  list.forEach((x, i) => {
    if (i) out.push(h('span.sep', ' · '));
    // M2b v14: Sap that is sure if you wait reads "Sap, then wait" (no "?")
    out.push(h('span.ans-o', { dataset: { via: x.a.via, id: x.a.id, sure: x.a.sure ? '1' : '', wait: x.a.wait ? '1' : '' } }, x.key ? h('kbd', x.key) : null, ` ${x.name}${x.a.sure ? '' : x.a.wait ? ', then wait' : ' ?'}`));
  });
  return out;
}
/**
 * An answer's note in the Deathblow tooltip: a chance and why; M2b v14 (UI need 2): Sap "sure if you wait: press Pass next
 * round; you stay hidden" (`wait`, `stealth`), and the PASS answer "Sap stops it" while every enemy is sapped.
 */
function answerNote(a) {
  if (a.via === 'pass') return ` (Sap stops it${a.stealth ? '; you stay hidden' : ''})`;
  if (a.wait) return ` (${sapWaitText(a).replace(/^S/, 's')})`;
  return `${a.sure ? '' : ' (a chance)'}${a.breaks ? ' (any damage before its turn wakes it)' : ''}`;
}
/** What answers it, in the badge's words: "your trap", "Sapped", "your pet". */
function answeredBy(st) {
  if (!st) return '';
  if (st.by === 'PET') return 'your pet takes it';
  if (st.by === 'TRAP') return st.disrupt ? 'Disrupt' : 'your trap';
  if (st.by === 'INTERRUPT') return 'interrupted';
  if (st.by === 'SILENCED') return 'silenced';
  return CONTROL_WORD[st.by] || 'controlled';
}

/**
 * Can a bar spell answer a wind-up (rules 7.7, 7.12, 7.13 (3))? 'stop' for an interrupt, a stun-tagged spell or one
 * that controls (HEXED, FROZEN): these stop it on any enemy, a dungeon boss too; 'avoid' for a defensive spell against a
 * heavy one (a full dodge, a ward that takes it all, Mirrorshade, a taunt: the player loses 0 HP); else null. It reads
 * the engine's spell entry (tags as the engine's autoplay rule 3 does, and its hex or freeze), a stopgap until the engine
 * says per spell whether it answers (hand-off ui-2026-11-10g).
 */
export function answerKind(raw, x) {
  if (!raw || !x || !x.windup) return null;
  const tags = raw.tags || [];
  if (tags.includes('interrupt') || tags.includes('stun') || raw.hex || raw.freeze) return 'stop';
  if (x.heavy && (tags.includes('defensive') || raw.taunt)) return 'avoid';
  return null;
}
/**
 * The bar spells that can answer wind-up x of enemy e: [{ id, name, kind, cd, ok, late }] (cd: rounds of cooldown left
 * now, from the engine; late: still on cooldown in the wind-up's round).
 */
export function answersOnBar(v, ctx, x) {
  const p = v.player; if (!p || !x || !x.windup) return [];
  const c = v.combat; const L = (v.legal && v.legal.spells) || {};
  const out = [];
  for (const id of p.bar) {
    if (!id) continue;
    const sd = ctx.data.spells[id]; const kind = answerKind(sd && sd.raw, x);
    if (!kind) continue;
    const cd = c && c.cooldowns ? c.cooldowns[id] || 0 : 0;
    const wait = x.round != null && c ? x.round - c.round : 0;
    out.push({ id, name: sd.name, kind, cd, ok: !!(L[id] && L[id].ok), late: cd > wait });
  }
  return out;
}

/** The wind-up's lines for a tooltip: when, the stakes, what answers it, the bar spells that can, and its state. */
export function windupLines(e, x, ctx, st) {
  const v = ctx.view; const n = (ctx.data.v2 && ctx.data.v2.num) || {};
  const w = x.deathblow ? windupItem(v, e, x) : null;
  const lines = x.deathblow
    ? [h('div.tt-line.wu.db', h('img', { src: deathblowIcon(), alt: '' }), h('b', `Deathblow${x.round != null ? `, round ${x.round}` : ''}`), `: ${e.name}'s signature${n.deathblowMult && isDamage(x) ? `, at ×${n.deathblowMult} damage` : ''}. It decides the fight.`),
      (w ? w.est : x.est) && isDamage(x) ? h('div.tt-line.num.db', `Estimated damage to ${targetWord(x, v) || 'you'}: about ${fmtNum(w ? w.est : x.est)}`) : null,
      h('div.tt-line.num', w ? deathblowStakes(w) : windupStakes(n)), h('div.tt-hint', windupAnswers(x.heavy, !!e.ccImmune))]
    : [h('div.tt-line.wu', h('img', { src: windupIcon(), alt: '' }), h('b', `Wind-up${x.round != null ? `, round ${x.round}` : ''}`), `: ${e.name}'s signature, telegraphed from the round it shows.`),
      h('div.tt-line.num', windupStakes(n)), h('div.tt-hint', windupAnswers(x.heavy, !!e.ccImmune))];
  if (w && (!st || st.kind === 'open')) {
    const sh = answersToShow(w, v, ctx);
    if (!w.ready) lines.push(h('div.tt-warn.db-no', 'No answer ready: nothing you have now can stop it. Kill it first, or be ready to take it.'));
    else if (sh.list.length) lines.push(h('div.tt-line.db-a', `${sh.when === 'now' ? 'Answer it now' : `Ready by round ${w.round}`}: ${sh.list.map((q) => `${q.key ? `[${q.key}] ` : ''}${q.name}${answerNote(q.a)}`).join(', ')}.`));
  }
  const bar = answersOnBar(v, ctx, x);
  if (bar.length) {
    const word = (b) => `${b.name}${b.kind === 'avoid' ? ' (avoid)' : ''}${b.cd ? ` (${b.late ? `cooldown ${b.cd}: not ready by then` : `ready in ${b.cd}`})` : ''}`;
    lines.push(h('div.tt-line', { style: { color: '#ffd36a' } }, `On your bar: ${bar.map(word).join(', ')}.`));
  } else if (!x.now) lines.push(h('div.tt-sub', 'Nothing on your bar answers it: plan your engage round, or kill it first.'));
  if (x.deathblow && x.target === 'pet' && isDamage(x)) lines.push(h('div.tt-warn', 'Aimed at your pet: if it hits your pet it lands all the same (empowered, and you are maimed). Send the Pet makes your pet take it on purpose: answered.'));
  if (isLethal(v, x, w ? w.est : x.est) && !(st && st.kind === 'answered' && !st.soft)) lines.push(h('div.tt-warn.lethal', `LETHAL: about ${fmtNum(w ? w.est : x.est)} against your ${fmtNum(v.player.hp)} health.`));
  const soft = softPending(v, e, x, st);
  if (soft === 'wait') lines.push(h('div.tt-hint.ans', `${cap(answeredBy(st))}: ${SOFT_WORDS.wait} (press Pass); it will be staggered. ${SAP_BREAK_WARN}.`));
  else if (st && st.kind === 'answered') lines.push(h('div.tt-hint.ans', st.by === 'SILENCED' ? 'Silenced: it cannot cast it. Answered: staggered.' : `${answeredBy(st)[0].toUpperCase()}${answeredBy(st).slice(1)}: answered${st.soft ? ' while it takes no damage' : ''}; it will be staggered.`));
  if (st && st.kind === 'preview') lines.push(h('div.tt-hint.ans', st.by === 'PET' ? 'With this opening your pet takes it: answered while the pet lives.' : 'With this opening it is answered: staggered.'));
  if (st && st.kind === 'void') lines.push(h('div.tt-sub', `Replaced (${st.why}): neither answered nor landed.`));
  return lines;
}

/** Hovering a wind-up (chip, row, banner, ruler) marks the bar spells that can answer it (ctx.ui.setWindupHover). */
function windupHover(el, e, x, ctx) {
  if (!x.windup) return;
  el.addEventListener('pointerenter', () => ctx.ui.setWindupHover({ idx: e.idx, turn: x.turn }));
  el.addEventListener('pointerleave', () => ctx.ui.setWindupHover(null));
}

/**
 * The wind-up line over an enemy (its nameplate, combat-v2.md 10.9), from the first round its track shows the wind-up:
 * "Wind-up R3: answer it or it empowers"; once answered (a trap, control, an interrupt) or previewed, what answers it.
 * box: the nameplate's .wub element; hidden when no wind-up is in view.
 */
export function windupBanner(box, e, ctx) {
  const w = e.alive ? firstWindup(e, ctx) : null;
  const wi = w && w.x.deathblow ? windupItem(ctx.view, e, w.x) : null;
  const key = w ? JSON.stringify([e.idx, w.x.turn, w.x.round, w.x.now, w.state, w.x.name, !!(w.cancel && w.cancel.done), w.cancel && w.cancel.by, w.x.deathblow, wi && [wi.est, wi.ready, wi.maims, wi.answers.map((a) => [a.id, a.now, a.sure])],
    w.x.target, w.x.est, isLethal(ctx.view, w.x, wi ? wi.est : w.x.est),
    wi && ctx.view.combat.engage ? ctx.view.combat.engage.options.map((o) => o.key) : null]) : '';
  if (box.dataset.key === key) return;
  box.dataset.key = key; clear(box);
  box.classList.toggle('hidden', !w);
  if (!w) return;
  const { x, state } = w;
  const ans = state.kind === 'answered' || state.kind === 'preview';
  // stopped this round (its cancel is done, or an interrupt landed): the line says so until the round ends
  const stopped = state.kind === 'answered' && x.now && (!w.cancel || w.cancel.done || w.cancel.by === 'INTERRUPT');
  box.className = `wub${ans ? ' ans' : ''}${state.kind === 'preview' ? ' pv' : ''}${x.now && !stopped ? ' now' : ''}`;
  box.dataset.turn = x.turn; box.dataset.state = stopped ? 'stopped' : state.kind; box.dataset.deathblow = ''; box.dataset.est = ''; box.dataset.ready = '';
  const n = (ctx.data.v2 && ctx.data.v2.num) || {};
  const msg = stopped ? `staggered${n.staggerDmg != null ? `: −${Math.round(n.staggerDmg * 100)} % dmg` : ''}` : state.kind === 'open' ? 'answer it or it empowers'
    : state.kind === 'preview' ? (state.by === 'PET' ? 'your pet takes it: answered' : 'this opening answers it') : `${answeredBy(state)}: answered${state.soft ? ' if not hit' : ''}`;
  if (x.deathblow) {
    // M2b v13: the Deathblow's own badge (crimson, a skull), its estimate, "MAIMS if it lands" and the answers ready now
    const wi = windupItem(ctx.view, e, x);
    const est = wi ? wi.est : x.est;
    box.classList.add('db'); box.dataset.deathblow = '1'; box.dataset.est = est || 0;
    box.append(h('span.wu-b', h('img', { src: deathblowIcon(), alt: '' }), stopped ? 'Deathblow stopped' : `Deathblow ${whenText(x)}`));
    const lethal = isLethal(ctx.view, x, est) && (state.kind === 'open' || !!softPending(ctx.view, e, x, state));
    box.dataset.lethal = lethal ? '1' : '';
    if (state.kind === 'open') {
      if (est && isDamage(x)) box.append(h('span.db-est', `≈ ${fmtNum(est)}`));
      if (lethal) box.append(lethalBadge());
      if (x.target === 'pet' && isDamage(x)) box.append(h('span.db-pet', '▸ your pet'));
      if (!wi || wi.maims) box.append(h('span.db-m', maimsText(x.target)));
      else box.append(h('span.db-m', `+${Math.round((wi.empower || 0) * 100)} % if it lands`));
      if (wi) {
        box.dataset.ready = wi.ready ? '1' : '';
        const sh = answersToShow(wi, ctx.view, ctx);
        if (!wi.ready) box.append(h('span.db-a.no', 'No answer ready'));
        else if (sh.list.length) box.append(h(`span.db-a${sh.when === 'now' ? '.now' : ''}`, h('span.db-al', sh.when === 'now' ? 'Answer: ' : `${whenText(x)}: `), answerEls(sh.list.slice(0, 3))));
      }
    } else {
      // M2b v14 (UI need 2): Sap holds while every enemy is sapped: waiting answers it (windupView's PASS answer, key X)
      const pass = !stopped && wi ? wi.answers.filter((a) => a.via === 'pass' && a.now) : [];
      if (pass.length) {
        box.append(h('span.wu-t', `${answeredBy(state)}: answered if you wait`), h('span.db-a.now', h('span.db-al', ' Wait: '), answerEls(pass.map((a) => ({ a, key: answerKey(ctx.view, a), name: answerName(a, ctx) })))));
        // QA 2026-11-12 (finding 2): until Sap cancels it, attacking breaks Sap and the Deathblow lands
        box.append(h('span.db-warn', lethal ? lethalBadge('b.db-lethal') : null, `${SAP_BREAK_WARN}${lethal ? ' and kill you' : ''}`));
      } else box.append(h('span.wu-t', msg));
    }
  } else {
    const lethal = state.kind === 'open' && isLethal(ctx.view, x);
    box.dataset.lethal = lethal ? '1' : '';
    box.append(h('span.wu-b', h('img', { src: windupIcon(), alt: '' }), stopped ? 'Wind-up stopped' : `Wind-up ${whenText(x)}`), lethal ? lethalBadge() : null, h('span.wu-t', msg));
  }
  tip(box, () => h('div.tt-spell', h('div.tt-row', h('div.tt-name', `${e.name}: ${x.windupOf ? x.windupOf.name : x.name}`), h('div.tt-rank', x.now ? 'This round' : `Round ${x.round}`)), windupLines(e, x, ctx, state)));
  windupHover(box, e, x, ctx);
}

/**
 * The lasting result of an enemy's wind-ups (combat v2.1): its EMPOWERED and STAGGERED statuses (engine-api.md 6:
 * { stacks, value }, value = the damage it deals more or less) as large badges, "+15 % dmg" / "−30 % dmg", into box.
 */
export function stackBadges(box, e, ctx) {
  const st = (id) => (e.statuses || []).find((s) => s.id === id) || null;
  const em = e.alive ? st('EMPOWERED') : null; const sg = e.alive ? st('STAGGERED') : null;
  // M2b v13: EMPOWERED's Deathblow share (deathblows, deathblowValue) is its own badge, "Deathblow +100 % dmg"; the other
  // stacks keep the Empowered badge. data-value is each badge's own share; together they are the engine's value.
  const dbS = em ? em.deathblows || 0 : 0; const dbV = em ? em.deathblowValue || 0 : 0;
  const db = em && dbS > 0 ? { id: 'EMPOWERED', stacks: dbS, value: dbV } : null;
  const emRest = em && em.stacks - dbS > 0 ? { id: 'EMPOWERED', stacks: em.stacks - dbS, value: Math.round((em.value - dbV) * 1e6) / 1e6 } : null;
  const key = JSON.stringify([emRest && [emRest.stacks, emRest.value], sg && [sg.stacks, sg.value], db && [db.stacks, db.value]]);
  if (box.dataset.key === key) return;
  const before = box.dataset.key ? JSON.parse(box.dataset.key) : [null, null, null];
  box.dataset.key = key; clear(box);
  box.classList.toggle('hidden', !em && !sg);
  const pctOf = (x) => `${Math.round((x || 0) * 100)} %`;
  const badge = (s, kind, prev) => {
    const isDb = kind === 'emp.db';
    const el = h(`div.wst.${kind}`, { dataset: { id: s.id, stacks: s.stacks, value: s.value, part: isDb ? 'deathblow' : '' } },
      h('img', { src: isDb ? deathblowIcon() : statusIcon(s.id), alt: '' }), h('span.wn', isDb ? 'Deathblow' : kind === 'emp' ? 'Empowered' : 'Staggered'), s.stacks > 1 ? h('span.wx', `×${s.stacks}`) : null,
      h('b', `${kind === 'stg' ? '−' : '+'}${pctOf(s.value)} dmg`));
    if (!prev || prev[0] !== s.stacks) el.classList.add('fresh'); // a new stack: the badge pops (style.css)
    tip(el, () => stackTip(e, ctx));
    return el;
  };
  if (db) box.appendChild(badge(db, 'emp.db', before[2]));
  if (emRest) box.appendChild(badge(emRest, 'emp', before[0]));
  if (sg) box.appendChild(badge(sg, 'stg', before[1]));
}
/** Tooltip of the stack badges: each stack, the damage it deals now in sum, and why. */
export function stackTip(e, ctx) {
  const n = (ctx.data.v2 && ctx.data.v2.num) || {};
  const st = (id) => (e.statuses || []).find((s) => s.id === id) || null;
  const em = st('EMPOWERED'); const sg = st('STAGGERED');
  const pctOf = (x) => `${Math.round((x || 0) * 100)} %`;
  const net = (em ? em.value : 0) - (sg ? sg.value : 0);
  const dbS = em ? em.deathblows || 0 : 0;
  return h('div.tt-spell', h('div.tt-name', `${e.name}: its wind-ups`),
    em && dbS ? h('div.tt-line', { style: { color: '#ff6a6a', fontWeight: 700 } }, `Deathblow landed: +${pctOf(em.deathblowValue)} damage for the rest of the fight.`) : null,
    em && em.stacks > dbS ? h('div.tt-line', { style: { color: '#ff9a8a' } }, `Empowered ×${em.stacks - dbS}: +${pctOf(em.value - (em.deathblowValue || 0))} damage (${em.stacks - dbS} ${plural(em.stacks - dbS, 'wind-up')} landed${n.empowerDmg != null ? `, +${pctOf(n.empowerDmg)} each` : ''}).`) : null,
    sg ? h('div.tt-line', { style: { color: '#9fdcff' } }, `Staggered ×${sg.stacks}: −${pctOf(sg.value)} damage (${sg.stacks} ${plural(sg.stacks, 'wind-up')} answered${n.staggerDmg != null ? `, −${pctOf(n.staggerDmg)} each` : ''}).`) : null,
    em && sg ? h('div.tt-line.num', `Together: ${net >= 0 ? '+' : '−'}${pctOf(Math.abs(net))} damage.`) : null,
    h('div.tt-sub', 'For the rest of the fight. Its estimates on the track include it.'));
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
  const key = `${JSON.stringify(list.map((x) => [x.turn, x.id, x.est, x.target, x.allyIdx, x.cancel && x.cancel.by, x.cancel && x.cancel.stagger, x.replaced && x.replaced.reason, x.now, x.windup, x.deathblow]))}|${pv ? JSON.stringify(pv.enemies.find((q) => q.u === e.idx) || null) : ''}|${opts.allSmall ? 1 : 0}|${e.intent && e.intent.interrupted ? 'I' : ''}|${v.player ? v.player.hp : ''}|${waitKey(v)}`;
  if (box.dataset.key === key) return;
  box.dataset.key = key; clear(box);
  list.forEach((x, i) => {
    const big = i === 0 && !opts.allSmall;
    const p = previewOf(pv, e, x);
    const cancel = cancelOf(e, x, p, ctx);
    const ob = !!(cancel && cancel.offBalance);
    const petHit = !!(p && p.pet);
    const tgt = petHit ? 'pet' : x.target;
    // combat v2.1: a wind-up's ribbon says WIND-UP, ANSWERED (a cancel answers it) or ANSWERS IT (the opening previewed)
    const wu = windupState(e, x, cancel, p);
    // QA 2026-11-12: a soft answer not yet made says so ("IF YOU WAIT" / "IF NOT HIT"), not ANSWERED
    const soft = softPending(v, e, x, wu);
    const wuRib = wu && wu.kind === 'open' ? (x.deathblow ? 'DEATHBLOW' : 'WIND-UP') : soft ? SOFT_TAG[soft].toUpperCase() : wu && wu.kind === 'answered' ? 'ANSWERED' : wu && wu.kind === 'preview' ? 'ANSWERS IT' : null;
    const lethal = !hardCancel(cancel) && !(wu && wu.kind === 'answered' && !soft) && isLethal(v, x, x.deathblow ? (windupItem(v, e, x) || x).est : x.est);
    const cls = ['tk', big ? 'big' : 'sm', x.now ? 'now' : '', x.heavy ? 'heavy' : '', x.cast ? 'cast' : '', x.signature && !x.windup ? 'sig' : '', cancel ? 'cancel' : '',
      cancel && (cancel.breaks || cancel.preview) ? 'soft' : '', ob ? 'ob' : '', p ? 'pv' : '', p && p.window ? 'pvwin' : '', isHeal(x) || x.support ? 'sup' : '',
      wu && wu.kind !== 'void' ? 'wu' : '', wu ? `wu-${wu.kind}` : '', x.deathblow && wu && wu.kind !== 'void' ? 'db' : '', x.firstMeet && wu ? 'fm' : '', lethal ? 'lethal' : ''].filter(Boolean);
    const amt = amountText(x);
    const el = h(`div.${cls.join('.')}`, { dataset: { turn: x.turn, round: x.round ?? '', id: x.id, est: x.est || 0, windup: wu ? wu.kind : '', deathblow: x.deathblow ? '1' : '', soft: soft || '', lethal: lethal ? '1' : '' } },
      x.round != null ? h('span.r', String(x.round)) : null,
      h('img', { src: abilityIcon(x), alt: '' }),
      big ? h('span.tx', h('span.tn', x.name), h('span.tv', amt ? h('b', amt) : null, tgt && tgt !== 'self' && (amt || tgt !== 'player') ? h('i', `▸ ${TGT_SHORT[tgt] || tgt}`) : null))
        : h('span.tv', amt ? h('b', amt) : null, tgt && tgt !== 'player' && tgt !== 'self' ? h('i', TGT_SHORT[tgt] || tgt) : null),
      x.signature && !x.windup ? h('i.b-sig', '★') : null,
      x.replaced && !cancel ? h('i.b-rep', '↺') : null,
      cancel ? h('img.b-ctl', { src: cancel.by === 'PREVIEW' ? statusIcon('STUN') : controlIcon(cancel.by), alt: '' }) : null,
      wuRib ? h(`i.b-wu${wu.kind !== 'open' ? '.ans' : ''}${soft ? '.soft' : ''}${x.deathblow ? '.db' : ''}`, soft ? { title: cap(SOFT_WORDS[soft]) } : {}, wuRib) : null,
      ob && !wuRib ? h('i.b-ob', 'OFF-BAL') : null,
      p && p.window && !ob && !wuRib ? h('i.b-ob.frost', 'WINDOW') : null);
    tip(el, () => entryTip(e, x, ctx, { cancel, ob, petHit, preview: p, wu }));
    windupHover(el, e, x, ctx);
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
  const key = `${JSON.stringify(list.map((x) => [x.turn, x.id, x.est, x.target, x.allyIdx, x.cancel && x.cancel.by, x.cancel && x.cancel.stagger, x.replaced && x.replaced.reason, x.now, x.windup, x.deathblow]))}|${unaware}|${e.intent && e.intent.interrupted ? 'I' : ''}|${pv ? JSON.stringify(pv.enemies.find((q) => q.u === e.idx) || null) : ''}|${(e.role && JSON.stringify(e.role)) || ''}|${v.player ? v.player.hp : ''}|${waitKey(v)}`;
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
    const wu = windupState(e, x, cancel, p);
    const soft = softPending(v, e, x, wu); // QA 2026-11-12: "If you wait" until Sap cancels it
    const lethal = !hardCancel(cancel) && !(wu && wu.kind === 'answered' && !soft) && isLethal(v, x, x.deathblow ? (windupItem(v, e, x) || x).est : x.est);
    // combat v2.1: a wind-up shows one flag (it is always a cast; "heavy" goes to the line below), so its name keeps its room
    const flags = wu ? [h(`span.flag.wu${wu.kind !== 'open' ? '.ans' : ''}${soft ? '.soft' : ''}${x.deathblow && wu.kind === 'open' ? '.db' : ''}`, soft ? { title: cap(SOFT_WORDS[soft]) } : {}, wu.kind === 'open' ? (x.deathblow ? 'Deathblow' : 'Wind-up') : wu.kind === 'void' ? 'Wind-up ↺' : soft ? SOFT_TAG[soft] : 'Answered')]
      : [x.heavy ? h('span.flag.heavy', 'Heavy') : null, x.cast ? h('span.flag.cast', 'Cast') : null, x.signature ? h('span.flag.sig', '★ Signature') : null];
    if (lethal) flags.push(h('span.flag.lethal', 'Lethal'));
    let sub = '';
    if (cancel && soft) sub = `${cap(CONTROL_WORD[cancel.by] || 'controlled')}: ${SOFT_WORDS[soft]}`;
    else if (cancel) sub = `${cap(CONTROL_WORD[cancel.by] || 'controlled')}${cancel.offBalance || (wu && wu.kind !== 'open') ? '' : ': skipped'}`;
    else if (x.replaced) sub = `${x.replaced.from} → ${x.name}: ${x.replaced.reason}`;
    else if (petHit) sub = 'Your pet takes it (Send the Pet)';
    else { const w = targetWord({ ...x, target: tgt }, v); sub = isDamage(x) ? `Hits ${w}` : w && w !== 'itself' && x.kind !== 'curse' ? `On ${w}` : supportWord(x); }
    if (wu && x.heavy && !cancel && !x.replaced) sub = `Heavy · ${sub ? sub[0].toLowerCase() + sub.slice(1) : ''}`;
    const amt = amountText(x);
    const row = h(`div.tr${x.now ? '.now' : ''}${x.heavy ? '.heavy' : ''}${x.cast ? '.cast' : ''}${cancel ? '.cancel' : ''}${cancel && (cancel.breaks || cancel.preview) ? '.soft' : ''}${ob ? '.ob' : ''}${p ? '.pv' : ''}${wu ? `${wu.kind !== 'void' ? '.wu' : ''}.wu-${wu.kind}` : ''}${x.deathblow && wu && wu.kind !== 'void' ? '.db' : ''}${lethal ? '.lethal' : ''}`,
      { dataset: { turn: x.turn, round: x.round ?? '', id: x.id, windup: wu ? wu.kind : '', deathblow: x.deathblow ? '1' : '', soft: soft || '', lethal: lethal ? '1' : '' } },
      h('span.rt', x.now ? 'Now' : x.round != null ? `R${x.round}` : ''),
      h('img', { src: abilityIcon(x), alt: '' }),
      h('div.tm', h('div.tn', h('span.nm', x.name), flags), h('div.ts', sub,
        wu && (wu.kind === 'answered' || wu.kind === 'preview') ? h('b.wut', ' → staggered') : wu && wu.kind === 'open' && !x.replaced ? h(`b.wuo${x.deathblow ? '.db' : ''}`, x.deathblow ? ` · ${rowStake(v, e, x)}` : ' · answer it') : null,
        ob ? h('b.obt', ' → off-balance') : null, p && p.window && !ob ? h('b.obt.frost', ' → frozen window') : null)),
      amt ? h(`div.td${isHeal(x) ? '.heal' : ''}`, amt) : null);
    tip(row, () => entryTip(e, x, ctx, { cancel, ob, petHit, preview: p, wu }));
    windupHover(row, e, x, ctx);
    box.appendChild(row);
  }
}
/** A Deathblow row's stakes, as the line over the enemy: "MAIMS if it lands", or "+100 % if it lands" once you are MAIMED. */
const rowStake = (v, e, x) => { const w = windupItem(v, e, x); return !w || w.maims ? maimsText(x.target) : `+${Math.round((w.empower || 0) * 100)} % if it lands`; };
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
  // combat v2.1: a wind-up (always a cast) says what answers it instead of the Heavy and Cast hints
  const wu = o.wu !== undefined ? o.wu : windupState(e, x, o.cancel, o.preview);
  if (wu) lines.push(...windupLines(e, x, ctx, wu));
  else {
    if (x.heavy) lines.push(h('div.tt-warn', 'Heavy: a telegraphed big hit. Stun or control it on that turn to cancel it (it is then off-balance), or let a shield, a dodge or your pet take it.'));
    if (x.cast) lines.push(h('div.tt-hint', 'Cast: interrupt it or control the caster on that turn to cancel it; a cancelled cast leaves it off-balance.'));
  }
  if (x.signature && !x.windup) lines.push(h('div.tt-line', { style: { color: '#ffd36a' } }, '★ Signature: its strongest ability, on a scripted turn.'));
  else if (x.scripted && !x.boss && !x.windup) lines.push(h('div.tt-sub', 'Opening move: the same for every enemy of its role.'));
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
  // combat v2.1 (rules 7.7, 7.10): a stun or control spell still interrupts its casts and wind-ups, and the engage round's
  // control option is Disrupt on it while its track shows a wind-up
  if (e.ccImmune) lines.push(h('div.tt-warn', 'Immune to control: stuns, Sap, freezes and traps do not hold it.'),
    h('div.tt-hint', 'A stun or control spell still interrupts its casts and wind-ups; in the engage round your control option is Disrupt.'));
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
        // combat v2.1: a wind-up is marked on its round, answered when a cancel (or the previewed opening) answers it
        const wu = windupState(e, x, cancelOf(e, x, p, ctx), p);
        if (notable(x)) col.threats.push({ e, x, cancelled, ob: !!((x.cancel && x.cancel.offBalance) || (p && p.ob)), wu: wu ? wu.kind : null, wuState: wu, db: !!x.deathblow, soft: softPending(v, e, x, wu) });
      }
    }
    for (const k of cols) k.threats.sort((a, b) => (b.db ? 2 : b.wu ? 1 : 0) - (a.db ? 2 : a.wu ? 1 : 0)); // Deathblows, then wind-ups first: they are what the opening is about
    const key = JSON.stringify([c.round, cols.map((k) => [k.known, k.dmg, k.threats.map((t) => [t.e.idx, t.x.turn, t.x.id, t.cancelled, t.ob, t.wu, t.db, t.soft])])]);
    if (key === lastKey) return;
    lastKey = key; clear(el);
    el.appendChild(h('div.rl-h', h('span.rl-t', 'Opening'), h('span.rl-s', c.round === 1 ? 'Plan your first moves' : `Round ${c.round} of ${OPENING_ROUNDS}`)));
    const row = h('div.rl-cols');
    for (const k of cols) {
      const state = k.r < c.round ? 'past' : k.r === c.round ? 'cur' : 'next';
      const engage = k.r === 1;
      const wuOpen = k.threats.some((t) => t.wu === 'open'); const wuAns = !wuOpen && k.threats.some((t) => t.wu === 'answered' || t.wu === 'preview');
      const dbOpen = k.threats.some((t) => t.wu === 'open' && t.db);
      // QA 2026-11-12: a soft answer not yet made reads "If you wait" / "If not hit" (any hard answer in that round: Answered)
      const softT = wuAns && !k.threats.some((t) => (t.wu === 'answered' && !t.soft) || t.wu === 'preview') ? (k.threats.find((t) => t.soft) || {}).soft : null;
      const head = h('div.rl-n', engage ? h('span', '1 · Engage') : h('span', `Round ${k.r}`),
        wuOpen || wuAns ? h(`b.rl-wu${wuAns ? '.ans' : ''}${softT ? '.soft' : ''}${dbOpen ? '.db' : ''}`, softT ? { title: cap(SOFT_WORDS[softT]) } : {}, softT ? SOFT_TAG[softT] : wuAns ? 'Answered' : dbOpen ? 'Deathblow' : 'Wind-up') : state === 'cur' ? h('b.rl-now', 'Now') : null);
      const body = h('div.rl-b');
      if (engage) body.appendChild(h('div.rl-q', 'They do not act'));
      else if (!k.known) body.appendChild(h('div.rl-q', '?'));
      else {
        const icons = h('div.rl-ic');
        for (const t of k.threats.slice(0, 4)) {
          const ic = h(`div.rl-x${t.x.heavy ? '.heavy' : ''}${t.x.cast ? '.cast' : ''}${t.cancelled ? '.cancel' : ''}${t.ob ? '.ob' : ''}${t.wu ? `${t.wu !== 'void' ? '.wu' : ''}.wu-${t.wu}` : ''}${t.db && t.wu && t.wu !== 'void' ? '.db' : ''}`,
            { dataset: { idx: t.e.idx, turn: t.x.turn, windup: t.wu || '', deathblow: t.db ? '1' : '' } },
            h('img', { src: abilityIcon(t.x), alt: '' }), t.e.role ? h('img.rl-role', { src: roleIcon(t.e.role.id), alt: '' }) : null,
            t.wu && t.wu !== 'void' ? h('img.rl-wui', { src: t.db ? deathblowIcon() : windupIcon(), alt: '' }) : null);
          ic.addEventListener('click', () => ctx.ui.setTarget(t.e.idx));
          tip(ic, () => entryTip(t.e, t.x, ctx, { cancel: t.x.cancel || (t.cancelled ? { by: 'PREVIEW', preview: true, offBalance: t.ob } : null), ob: t.ob, wu: t.wuState }));
          windupHover(ic, t.e, t.x, ctx);
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
 * Combat v2.1: on a dungeon boss the control option is labelled Disrupt (R.engageOptions `disrupt`) with the wind-up its
 * trap stops; on a target it may not take, the engine's reason (R.whyIllegal); every option and Pre-cast spell whose
 * preview answers a wind-up (R.engagePreview `stagger`, or Send the Pet's pet turns on a heavy one) says so.
 */
// The first-fight hint (owner playtest 2026-11-11 08:03: he never found Sap): beside the engage panel in the first engage
// round a class meets, its three openers with their keys; "Got it" or the end of that round puts it away for good. Kept per
// class in this browser's saved game (localStorage HINT_KEY), like the Heat note.
export const HINT_KEY = 'tbwcr.hints.v1';
const loadHints = () => { try { const x = JSON.parse(localStorage.getItem(HINT_KEY) || '{}'); return x && typeof x === 'object' ? x : {}; } catch { return {}; } };
const saveHints = (x) => { try { localStorage.setItem(HINT_KEY, JSON.stringify(x)); } catch { /* storage blocked: shown again next page */ } };

export function createEngagePanel(root, ctx) {
  const el = h('div#engage.panel.hidden', { 'aria-label': 'Engage' });
  root.appendChild(el);
  const hintBtn = h('button.btn.small', { type: 'button' }, 'Got it');
  const hint = h('div#engage-hint.panel.hidden', { role: 'note', 'aria-label': 'Your opening move' }, h('i.eh-arrow'), h('div.eh-t', 'Your opening move'), h('div.eh-b'), h('div.eh-f', h('span.eh-once'), hintBtn));
  root.appendChild(hint);
  let hints = loadHints();
  let hintFor = null; // the class whose hint is on screen
  const hintSeen = (cls) => !!(hints.engage && hints.engage[cls]);
  const markSeen = (cls) => { hints = { ...hints, engage: { ...(hints.engage || {}), [cls]: true } }; saveHints(hints); };
  hintBtn.addEventListener('click', (ev) => { ev.stopPropagation(); if (hintFor) markSeen(hintFor); hintFor = null; hint.classList.add('hidden'); });
  /** The hint for this engage round, beside the panel (its right edge, its top), or away once the round is over. */
  function updateHint(v, show, eg) {
    const cls = v.player && v.player.classId;
    if (!show || !cls || hintSeen(cls)) {
      if (hintFor && !show) markSeen(hintFor); // shown, and the engage round is over: done
      if (!show || (cls && hintSeen(cls))) { hintFor = null; hint.classList.add('hidden'); }
      return;
    }
    if (hintFor !== cls) {
      hintFor = cls;
      const d = ctx.data.v2 || { options: {}, num: {} };
      const cname = (ctx.data.classes[cls] || {}).name || 'hero';
      const keys = eg.options.map((o) => o.key).filter(Boolean).join(', ');
      clear(hint.querySelector('.eh-b')).append(
        h('p', `Before they act, open with one of three moves from the Engage panel${keys ? ` (keys ${keys})` : ''}, on your target:`),
        h('ul.eh-opts', eg.options.map((o) => h('li', { dataset: { opt: o.id } }, o.key ? h('span.kbd', o.key) : null, h('b', o.name), h('span.eh-k', ` ${ENGAGE_KIND[o.kind] || o.kind}: `), engageHint(d.options[o.id] || o, d.num)))),
        h('p.dim', 'Hover one to see what it does to their tracks.'));
      hint.querySelector('.eh-once').textContent = `Shown once for the ${cname}.`;
    }
    hint.classList.remove('hidden');
    // right of the panel, below the target frame (its track rows are read in this round)
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const tf = document.getElementById('target-frame');
    const below = tf && !tf.classList.contains('hidden') ? tf.offsetTop + tf.offsetHeight + 0.8 * rem : 0;
    hint.style.left = `${Math.round(el.offsetLeft + el.offsetWidth + 1.4 * rem)}px`;
    hint.style.top = `${Math.round(Math.max(el.offsetTop, below))}px`;
  }
  let lastKey = '';
  const nameOf = (v, i) => { const e = v.combat.enemies.find((x) => x.idx === i); return e ? e.name : '?'; };
  /** The target an option would use: the current target if it may, else none (the card says whom to choose). */
  const pick = (v, targets) => {
    if (!targets || !targets.length) return { ok: false, t: null };
    if (targets.length === 1 && targets[0] === null) return { ok: true, t: null, none: true };
    return targets.includes(ctx.ui.target) ? { ok: true, t: ctx.ui.target } : { ok: false, t: null, first: targets[0] };
  };
  /**
   * The wind-ups an option answers on target t (combat v2.1): from R.engagePreview, the cancelled turns whose entry is a
   * wind-up (`stagger`), and for Send the Pet a heavy wind-up among its pet turns (engine-api.md 1). [{ e, x }] in round order.
   */
  const answersOf = (v, id, t, spellId) => {
    const pv = ctx.bridge.engagePreview(id, t, spellId);
    if (!pv || !pv.enemies) return [];
    const out = [];
    for (const q of pv.enemies) {
      const e = v.combat.enemies.find((x) => x.idx === q.u); if (!e) continue;
      for (const x of entriesOf(e)) if (x.windup && ((q.stagger || []).includes(x.turn) || (x.heavy && (q.pet || []).includes(x.turn)))) out.push({ e, x });
    }
    return out.sort((a, b) => (a.x.round || 0) - (b.x.round || 0));
  };
  const answerTag = (list) => {
    if (!list.length) return null;
    const db = list.some((w) => w.x.deathblow); // M2b v13: an option that answers a Deathblow says so, in its colour
    return h(`div.eg-ans${db ? '.db' : ''}`, h('img', { src: db ? deathblowIcon() : windupIcon(), alt: '' }),
      `Answers ${db ? (list.length > 1 ? 'the Deathblow and a wind-up' : 'the Deathblow') : list.length > 1 ? `${list.length} wind-ups` : 'the wind-up'} (${list.map((w) => `R${w.x.round}`).join(', ')}): staggered`);
  };
  /**
   * M2b v13 (UI needs 1, 2): the Deathblow alert at the head of the panel: each open Deathblow in view (R.windupView), when,
   * whose, its estimate, "MAIMS if it lands", and the answers ready now with their keys ("No answer ready" in red).
   */
  const deathblowAlert = (v) => {
    const list = (v.combat.windups || []).filter((w) => w.deathblow && !(w.cancel && w.cancel.stagger && !w.cancel.breaks));
    if (!list.length) return null;
    return list.map((w) => {
      const sh = answersToShow(w, v, ctx);
      return h('div.eg-db', { dataset: { u: w.u, turn: w.turn, ready: w.ready ? '1' : '' } },
        h('img.eg-dbi', { src: deathblowIcon(), alt: '' }),
        h('div.eg-dbm', h('div.eg-dbt', h('b', `Deathblow, round ${w.round}`), `: ${w.enemy}'s ${w.name}${w.est && DAMAGE_KINDS.has(w.kind) ? `, ≈ ${fmtNum(w.est)} to ${w.target === 'pet' ? 'your pet' : 'you'}` : ''}. `,
          isLethal(v, { kind: w.kind, target: w.target, est: w.est }, w.est) ? lethalBadge('b.db-lethal') : null, h('b.eg-dbmaim', w.maims ? `${maimsText(w.target)}.` : `+${Math.round(w.empower * 100)} % if it lands.`)),
          !w.ready ? h('div.eg-dba.no', 'No answer ready')
            : h('div.eg-dba', sh.when === 'now' ? 'Answer it now: ' : `Ready by round ${w.round}: `, answerEls(sh.list.slice(0, 4)))));
    });
  };
  const pctOf = (x) => `${Math.round((x || 0) * 100)} %`;
  /** Disrupt's line on the card (rules 7.10): the wind-up its trap stops, from R.engagePreview (ans), and the result. */
  const disruptText = (v, t, ans) => {
    const n = (ctx.data.v2 && ctx.data.v2.num) || {};
    const w = ans[0];
    const what = w ? `${w.x.name} in round ${w.x.round}` : 'its first visible wind-up';
    return `A trap stops its first wind-up, ${what}: staggered${n.staggerDmg != null ? ` (−${pctOf(n.staggerDmg)} damage for the fight)` : ''} and off-balance.`;
  };
  /** Tooltip of a Disrupt card, or of a control option the current target may not take (the engine's reason). */
  const disruptTip = (v, o, t, disrupt, notHere) => {
    const n = (ctx.data.v2 && ctx.data.v2.num) || {};
    const e = v.combat.enemies.find((x) => x.idx === t);
    const nm = e ? e.name : 'This enemy';
    const lines = [];
    if (disrupt) {
      lines.push(h('div.tt-line.desc', `${nm} cannot be controlled, so ${o.name} becomes Disrupt: a trap that springs on its first wind-up in its next ${numWord(n.trackLen || 3)} turns. That wind-up is cancelled: answered, so it is staggered, and it is off-balance for your next action.`));
      if (n.signatureTurn2) lines.push(h('div.tt-hint', `A dungeon boss winds up a second time on its turn ${n.signatureTurn2}: answer that one with an interrupt or a stun (a heavy one: a full dodge, a ward or your pet).`));
    } else if (notHere) {
      lines.push(h('div.tt-warn', notHere));
      lines.push(h('div.tt-line.desc', 'On an enemy immune to control, a control option works only as Disrupt, while its track shows a wind-up.'));
    }
    return h('div.tt-spell', h('div.tt-row', h('div.tt-name', disrupt ? `Disrupt (${o.name})` : o.name), h('div.tt-kind', 'Control')), lines);
  };
  function update(v) {
    const c = v.combat; const eg = c && !c.over ? c.engage : null;
    const show = !!(eg && !ctx.ui.playing && !v.autoplay && !v.loot && v.phase !== 'SUMMARY' && !(v.node && v.node.step === 'intro'));
    el.classList.toggle('hidden', !show);
    document.body.classList.toggle('engage-round', show);
    updateHint(v, show, eg);
    if (!show) { lastKey = ''; return; }
    const key = JSON.stringify([eg, ctx.ui.target, ctx.ui.precastArmed, v.player.classId, (c.windups || []).filter((w) => w.deathblow).map((w) => [w.u, w.turn, w.est, w.ready, w.answers])]);
    if (key === lastKey) return;
    lastKey = key; clear(el);
    const d = ctx.data.v2 || { options: {}, num: {} };
    el.appendChild(h('div.eg-h', h('div.title', 'Engage'), h('div.eg-sub', h('b', 'They have not noticed you: enemies do not act this round.'), ' Read their tracks, pick a target, then open.')));
    const dba = deathblowAlert(v); if (dba) el.append(...dba);
    // the engage options that answer an open Deathblow (R.windupView answers, via 'engage'): { option id: [answer] }
    const dbAns = {};
    for (const w of (v.combat.windups || []).filter((q) => q.deathblow)) for (const a of w.answers) if (a.via === 'engage') (dbAns[a.id] = dbAns[a.id] || []).push({ ...a, round: w.round });
    const opts = h('div.eg-opts');
    const cur = ctx.ui.target;
    for (const o of eg.options) {
      const data = d.options[o.id] || { id: o.id };
      const sel = o.spells ? null : pick(v, o.targets);
      const off = !!o.reason;
      // combat v2.1: on an enemy immune to control the control option is Disrupt (R.engageOptions `disrupt`); on one it
      // may not take (a dungeon boss without a visible wind-up) the card says the engine's reason (R.whyIllegal)
      const here = sel && sel.ok && sel.t != null ? sel.t : null;
      const disrupt = !off && here != null && (o.disrupt || []).includes(here);
      const notHere = !off && !o.spells && cur != null && o.why && o.why[cur] ? o.why[cur] : null;
      const at = o.spells ? null : sel.none ? null : here != null ? here : sel.first ?? null;
      const ans = off || o.spells || (at == null && !sel.none) ? [] : answersOf(v, o.id, at, undefined);
      let tline;
      if (off) tline = h('div.eg-tg.bad', o.reason);
      else if (o.spells) tline = h('div.eg-tg', ctx.ui.precastArmed ? 'Now press a spell key (1–7) or click a spell:' : 'Choose a spell:');
      else if (sel.none) tline = h('div.eg-tg.ok', 'No target needed');
      else if (sel.ok) tline = h('div.eg-tg.ok', `On ${nameOf(v, sel.t)}`);
      else if (notHere) tline = h('div.eg-tg.bad', notHere, h('span.eg-alt', ` Choose: ${o.targets.map((i) => nameOf(v, i)).join(', ')}`));
      else tline = h('div.eg-tg.warn', `Choose a target: ${o.targets.map((i) => nameOf(v, i)).join(', ')}`);
      const name = disrupt ? 'Disrupt' : o.name;
      // M2b v13: the card is an answer to a Deathblow (windupView): highlighted; "sure" false (Sap, Rime Burst) marked a chance
      const dbA = dbAns[o.id] || [];
      const dbSure = dbA.some((a) => a.sure);
      const dbWait = dbSure ? null : dbA.find((a) => a.wait) || null; // M2b v14 (UI need 2): Sap, sure if you wait
      const card = h(`div.eg-opt.k-${o.kind}${off ? '.off' : ''}${notHere ? '.off-here' : ''}${disrupt ? '.disrupt' : ''}${ans.length ? '.answers' : ''}${o.spells && ctx.ui.precastArmed ? '.armed' : ''}${dbA.length ? '.db-ans' : ''}`,
        { role: o.spells ? null : 'button', tabindex: '-1', dataset: { opt: o.id, disrupt: disrupt ? '1' : '', answers: ans.map((w) => `${w.e.idx}:${w.x.turn}`).join(' '), db: dbA.length ? (dbSure ? 'sure' : dbWait ? 'wait' : 'chance') : '' }, 'aria-label': `${name}${disrupt ? ` (${o.name})` : ''} (${ENGAGE_KIND[o.kind] || o.kind})` },
        h('img.eg-ic', { src: engageIcon(o.id), alt: '' }),
        h('div.eg-main', h('div.eg-nm', h('span.eg-name', name), disrupt ? h('span.eg-was', o.name) : null, h('span.eg-kind', ENGAGE_KIND[o.kind] || o.kind), o.key ? h('span.kbd', o.key) : null),
          h('div.eg-txt', disrupt ? disruptText(v, here, ans) : engageText(data, d.num)), tline, answerTag(ans),
          dbWait ? h('div.eg-dbc.wait', sapWaitText(dbWait))
            : dbA.length && !dbSure ? h('div.eg-dbc', dbA.some((a) => a.breaks) ? 'A chance: any damage before its turn wakes it' : 'A chance: it can fail') : null));
      if (dbA.length) card.prepend(h('i.eg-dbtag', 'Deathblow'));
      if (disrupt || notHere) tip(card, () => disruptTip(v, o, here ?? cur, disrupt, notHere));
      if (o.spells && !off) {
        const row = h('div.eg-spells');
        let any = [];
        for (const sp of o.spells) {
          const sd = ctx.data.spells[sp.spellId] || { name: sp.spellId };
          const slot = v.player.bar.indexOf(sp.spellId);
          const t = sp.targets.length === 1 && sp.targets[0] === null ? null : sp.targets.includes(cur) ? cur : sp.targets[0];
          const sa = answersOf(v, o.id, t, sp.spellId);
          if (sa.length && !any.length) any = sa.map((w) => ({ ...w, spell: sd.name }));
          const spDb = sa.some((w) => w.x.deathblow);
          const b = h(`button.eg-sp${sa.length ? '.ans' : ''}${spDb ? '.db' : ''}`, { type: 'button', 'aria-label': `Pre-cast ${sd.name}`, dataset: { spell: sp.spellId, db: spDb ? '1' : '' } }, h('img', { src: spellIcon(sp.spellId, sd), alt: '' }), slot >= 0 ? h('span.k', String(slot + 1)) : null,
            sa.length ? h('img.eg-spw', { src: spDb ? deathblowIcon() : windupIcon(), alt: '' }) : null);
          b.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.ui.engage(o.id, sp.spellId); });
          b.addEventListener('pointerenter', () => hover(v, o, sp));
          b.addEventListener('pointerleave', () => ctx.ui.setPreview(null));
          tip(b, () => spellTip(sp.spellId, ctx, { hint: `Pre-cast: no mana; its cooldown starts.${sa.length ? ` It answers the wind-up (${sa.map((w) => `R${w.x.round}`).join(', ')}).` : ''} Click to open with it.` }));
          row.appendChild(b);
        }
        card.querySelector('.eg-main').appendChild(row);
        if (any.length) { const adb = any.some((w) => w.x.deathblow); card.querySelector('.eg-main').appendChild(h(`div.eg-ans${adb ? '.db' : ''}`, h('img', { src: adb ? deathblowIcon() : windupIcon(), alt: '' }), `${any[0].spell} answers the ${adb ? 'Deathblow' : 'wind-up'} (${any.map((w) => `R${w.x.round}`).join(', ')}): staggered`)); }
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
