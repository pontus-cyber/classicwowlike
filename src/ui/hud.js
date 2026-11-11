// Persistent classic-MMO HUD: unit frames, enemy nameplates with intents, action bar, XP bar,
// minimap, micro menu, objective tracker, combat log and the raid-boss frame. It renders the view
// it is given and turns clicks into actions through ctx.act; it decides no rules.
// Combat v2 (docs/specs/combat-v2.md 10, drawn by tracks.js): the intent track on every nameplate and in the target frame,
// role badges, the off-balance marker, the opening ruler, the engage panel, and the window highlight on the action bar.
// Combat v2.1 (combat-v2.md 10.9): the wind-up line over each enemy (its nameplate), EMPOWERED and STAGGERED badges on the
// nameplate and the target frame, and the bar spells that can answer a wind-up marked (now: "Answer"; on hover: all).
// Heat (docs/specs/expedition.md H.4, drawn by heat.js): the meter, named the Furnace (changes-m2b-v7.md D), at the top centre (owner 2026-11-11
// 10:12); the minimap tooltip and the camp tracker line read the same R.heatView (view.heat).
// UX pass 2026-11-11 (docs/handoffs/ux-review-2026-11-11.md): the turn prompt over the action bar's right half (what to do
// now, read from the bar's own marks), nameplate parts that come and go hung under the health bar so the track never
// moves, and the zone's tracker lines hidden in a fight.
// DoT preview (owner feedback 2026-11-11 08:11; engine-api.md 6.1): on every HP bar of a fight (nameplates, the target, boss,
// player and pet frames) the HP that the ticks at the end of the round will take is a hatched end segment, with a skull
// when they kill; the bar's tooltip has the numbers (view `dot`, from R.pendingTicks). Low health: a healing potion on the
// item bar that can be drunk pulses below POTION_HINT_HP (owner playtest 08:03: a run ended with 0 potions used).
// M2b v6 (rules 7.5): while Packed Satchel's free potion of a fight is unused, the potions on the item bar show "Free".
// Contracts (docs/specs/expedition.md 9.3; prep.js): in a run with the start camp the tracker pins this zone's contracts
// (colour, title, progress) under the minimap, in fights and, narrowed beside the zone map, on the map; at the start camp
// (PREP) the HUD is hidden like on class select.
// M2b v13 (docs/specs/changes-m2b-v13.md "UI needs" 2, 3, 6, 8): MAIMED as a large lasting badge on the player frame
// ("Healing −50 %"), the potion buttons and tooltips with the cut amounts (R.potionInfo); the bar spells that answer an open
// Deathblow (R.windupView answers: now, or ready by its round) ringed in crimson; the turn prompt names the Deathblow's answer
// with its key or "No answer ready"; with autoplay on, the engage round says "Autoplay will answer the Deathblow with ..."
// (R.autoplayEngage); a first meeting's enemy is tagged "New".
import { h, add, clear, fmtNum, moneyEl, clamp, rgba } from './util.js';
import { spellIcon, basicIcon, consumableIcon, statusIcon, abilityIcon, icon, nodeIcon, NODE_COLORS } from './art-icons.js';
import { drawPortrait, HERO_LOOKS, PET_LOOKS, enemyLook, beastLook } from './art-actors.js';
import { THEMES } from './art-world.js';
import { tip, spellTip, basicTip, itemTip, statusTip } from './tooltip.js';
import { settings } from './settings.js';
import { linkedText, resurrectText, dangerRule, HEAT_WORDS, tolls, freeActionText } from './ui-text.js';
import { trackChips, trackRows, roleBadge, roleTags, offBalanceText, offBalanceTip, createRuler, createEngagePanel, windupBanner, stackBadges, entriesOf, answerKind, answersToShow } from './tracks.js';
import { createHeatMeter, standText, bossText, fmtTime, lineShown } from './heat.js';
import { trackerContracts } from './prep.js';

const RES_NAME = { energy: 'Energy', mana: 'Mana', focus: 'Focus' };
/** Combat v2.1: the wind-up stacks, drawn as large badges (stackBadges) instead of small status icons. */
const WINDUP_STACKS = new Set(['EMPOWERED', 'STAGGERED']);
/** M2b v13: MAIMED is drawn as its own large badge on the player frame (maimBadge), not as a small status icon. */
const PLAYER_BADGES = new Set(['MAIMED']);
export function conColor(cl, level) {
  const d = cl - level;
  if (d <= -6) return '#9d9d9d';
  if (d <= -3) return '#4fe05a';
  if (d <= 2) return '#ffe04a';
  if (d <= 4) return '#ff9a3a';
  return '#ff4a3a';
}

/**
 * Travel-on button state (rules 1.5) from the view: the engine's legality (legal.travelOn, legal.mustTravel) and
 * the zone's exit and travel-on levels. kind: 'done' (last row finished), 'open' (at or over the exit level),
 * 'early' (legal under the exit level), 'locked'.
 */
export function travelState(v) {
  const z = v.zone; const L = v.legal || {}; const lvl = v.player ? v.player.level : 0;
  const rows = z && z.rows ? z.rows.length : 0;
  const need = z ? z.travelLevel ?? z.exitLevel : 0;
  const kind = L.mustTravel ? 'done' : L.travelOn ? (lvl >= z.exitLevel ? 'open' : 'early') : 'locked';
  return { kind, need, exit: z ? z.exitLevel : 0, rows, level: lvl, under: z ? z.exitLevel - need : 0 };
}

/** A healing potion on the item bar pulses while health is below this share in a fight (UI hint only, no auto-drink). */
export const POTION_HINT_HP = 0.35;
const SKULL = () => icon('skull', null, { bare: true, tint: '#ffe0d8' });

function bar(cls) {
  const hp = cls.split(' ')[0] === 'hp';
  const el = h('div.bar.' + cls.split(' ').join('.'), h('div.ghost'), h('div.fill'), h('div.ward'),
    hp ? h('div.dot.hidden', { 'aria-hidden': 'true' }) : null, hp ? h('img.skull.hidden', { alt: '' }) : null, h('div.txt'));
  return el;
}
/**
 * One bar. wardVal: absorb shown after the fill. dot (HP bars in a fight): the DoT preview of the unit (view `dot`,
 * engine-bridge.js dotOf): `loss` HP at the end of the fill is hatched (the ticks at the end of the round take it), a skull
 * when they kill (`lethal`; a faint one when only crits would). data-dot carries "loss" or "loss:lethal" for the checks.
 */
function setBar(el, cur, max, text, wardVal = 0, dot = null) {
  const f = max > 0 ? clamp(cur / max, 0, 1) : 0;
  const fill = el.querySelector('.fill'); const ghost = el.querySelector('.ghost'); const ward = el.querySelector('.ward');
  fill.style.transform = `scaleX(${f})`;
  if (ghost) {
    const prev = Number(ghost.dataset.f || 1);
    if (f < prev) { ghost.style.transition = 'transform .9s .25s ease-in'; } else ghost.style.transition = 'none';
    ghost.style.transform = `scaleX(${f})`; ghost.dataset.f = f;
  }
  if (ward) { const w = max > 0 ? clamp(wardVal / max, 0, 1 - f) : 0; ward.style.left = `${f * 100}%`; ward.style.width = `${w * 100}%`; }
  const de = el.querySelector('.dot');
  if (de) {
    const loss = dot && cur > 0 ? Math.min(cur, dot.loss) : 0;
    const w = max > 0 ? clamp(loss / max, 0, f) : 0;
    const on = !!(dot && (w > 0 || dot.lethal));
    de.classList.toggle('hidden', !on); de.classList.toggle('lethal', !!(dot && dot.lethal));
    de.style.left = `${(f - w) * 100}%`; de.style.width = `${w * 100}%`;
    const sk = el.querySelector('.skull'); const maybe = !!(dot && !dot.lethal && dot.crit && dot.crit.lethal);
    sk.classList.toggle('hidden', !(dot && (dot.lethal || maybe))); sk.classList.toggle('maybe', maybe);
    if ((dot && (dot.lethal || maybe)) && !sk.getAttribute('src')) sk.src = SKULL();
    el.dataset.dot = on ? `${loss}${dot.lethal ? ':lethal' : ''}` : '';
    el.classList.toggle('dot-lethal', !!(dot && dot.lethal));
  }
  el.querySelector('.txt').textContent = text;
  el.classList.toggle('low', el.classList.contains('hp') && f < 0.3);
}
const RESURRECT_NAME = { boon: 'your Boon of Return', second_breath: 'Second Breath', ember: 'an Ember of Return' };
/**
 * Tooltip of an HP bar with a DoT preview (engine-api.md 6.1): what the ticks at the end of this round do, tick by tick,
 * and whether they kill. who: 'player', 'pet' or 'enemy'; name: the unit's name. null without a preview.
 */
export function dotTip(dot, who, name) {
  if (!dot) return null;
  const n = (x) => fmtNum(x);
  const head = dot.lethal ? 'Lethal at the end of this round' : 'Damage over time this round';
  const lines = dot.ticks.map((t) => h('div.tt-line.num', `${t.name}: ${t.immune ? 'no damage (immune)' : t.sidestep ? `avoided (Death's Sidestep, ${n(t.absorbed)})` : n(t.amount)}${t.absorbed && !t.sidestep ? ` (${n(t.absorbed)} absorbed)` : ''}`));
  let verdict;
  if (dot.lethal && who === 'player') verdict = dot.resurrect ? `It would kill you; ${RESURRECT_NAME[dot.resurrect] || 'a resurrect'} would bring you back.` : 'It will kill you unless you heal, cleanse or shield first.';
  else if (dot.lethal && who === 'pet') verdict = `It will kill ${name}.`;
  else if (dot.lethal) verdict = `It will kill ${name} after its turn: no need to attack it this round.`;
  else verdict = `Leaves ${name === 'you' ? 'you' : name} at ${n(dot.hpAfter)} health.`;
  return h('div.tt-spell.tt-dot',
    h('div.tt-row', h('div.tt-name' + (dot.lethal ? '.bad' : ''), head), h('div.tt-kind.bad', `−${n(dot.loss)} HP`)),
    lines,
    dot.heal ? h('div.tt-line.num', { style: { color: '#7fe0a0' } }, `Healed meanwhile: ${n(dot.heal)}`) : null,
    h(dot.lethal ? 'div.tt-warn' : 'div.tt-line', verdict),
    dot.crit ? h('div.tt-sub', `With critical ticks: ${n(dot.crit.amount)} damage${dot.crit.lethal && !dot.lethal ? ', enough to kill' : ''}.`) : null,
    h('div.tt-sub', 'Damage over time ticks at the end of the round, after every action. Hits and heals before then are not counted.'));
}
/**
 * Status icons of a unit: buffs first, then debuffs after a divider. A buff has a round green frame, a debuff a square
 * red frame with a corner notch (shape and place tell them apart without colour). Rounds left sit in the lower right
 * corner (gold on the last round), stacks in the upper left; the tooltip states the exact effect (statusTip).
 */
function statusRow(container, statuses, ctx) {
  const list = statuses || [];
  const key = list.map((s) => `${s.id}:${s.rounds}:${s.stacks}:${s.value}:${s.tick}:${s.amount}`).join('|');
  if (container.dataset.key === key) return;
  container.dataset.key = key;
  clear(container);
  const bad = (s) => !!((ctx.data.statuses || {})[s.id] || {}).debuff;
  const cell = (s) => {
    const info = (ctx.data.statuses || {})[s.id] || { name: s.id };
    const left = s.rounds && s.rounds < 90 ? s.rounds : null;
    const el = h('div.st' + (bad(s) ? '.bad' : '.buff') + (left === 1 ? '.ending' : ''),
      { dataset: { id: s.id }, 'aria-label': `${info.name}${s.stacks > 1 ? ` ×${s.stacks}` : ''}${left ? `, ${left} ${left === 1 ? 'round' : 'rounds'} left` : ''}` },
      h('img', { src: statusIcon(s.id), alt: '' }), s.stacks > 1 ? h('span.s', String(s.stacks)) : null, left ? h('span.n', String(left)) : null);
    tip(el, () => statusTip(s, ctx));
    return el;
  };
  const buffs = list.filter((s) => !bad(s)); const debuffs = list.filter(bad);
  for (const s of buffs) container.appendChild(cell(s));
  if (buffs.length && debuffs.length) container.appendChild(h('i.st-sep'));
  for (const s of debuffs) container.appendChild(cell(s));
}
const portraitCache = new Map();
function portrait(key, draw) {
  if (!portraitCache.has(key)) {
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160;
    try { draw(cv.getContext('2d'), 160); } catch { /* ignore */ }
    portraitCache.set(key, cv);
  }
  const src = portraitCache.get(key);
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160;
  cv.getContext('2d').drawImage(src, 0, 0);
  return cv;
}
export function heroPortrait(classId) { return portrait('hero:' + classId, (c, s) => drawPortrait(c, s, HERO_LOOKS[classId], 'humanoid', { bg1: '#4a3a26' })); }
export function petPortrait(petId) { return portrait('pet:' + petId, (c, s) => drawPortrait(c, s, PET_LOOKS[petId], 'beast', { bg1: '#2e3a26' })); }
function enemyPortrait(e, theme) {
  return portrait(`en:${e.arch}:${e.rank}:${theme}:${e.name}`, (c, s) => {
    if (e.rank === 'boss') drawPortrait(c, s, null, 'boss', { bg1: '#2a2048', bg2: '#05040a' });
    else if (e.rank === 'shard' || e.arch === 'shard') drawPortrait(c, s, null, 'shard', { bg1: '#2a2048', bg2: '#05040a' });
    else if (e.arch === 'beast') drawPortrait(c, s, beastLook(theme, e.name, e.rank), 'beast', { bg1: '#4a2a22' });
    else drawPortrait(c, s, enemyLook(e.arch, theme, e.rank, e.name), 'humanoid', { bg1: '#4a2a22' });
  });
}

export function createHud(root, ctx) {
  const els = {};
  // ------------------------------------------------------------ player frame
  // resurrect charges (rules 9, M2 v3): what a death would use now; in the end-boss fight without Second Breath
  els.resc = h('div.resc.hidden', { 'aria-label': 'Resurrect charges' }, h('img', { src: icon('ember', 'heal'), alt: '' }), h('span.n'));
  els.player = h('div#player-frame.uf',
    h('div.portrait'), h('div.lvl', { style: { left: '5.4rem', top: '5.4rem' } }),
    h('div.plate', h('div.name', h('span.pn'), h('span.cls')), bar('hp'), bar('res mana'), h('div.cp.hidden', Array.from({ length: ctx.data.rules.cpMax }, () => h('i'))), h('div.strow', h('div.statuses'), els.resc),
      h('div.maimb.hidden', { 'aria-live': 'polite' }, h('img', { src: statusIcon('MAIMED'), alt: '' }), h('span.mn', 'Maimed'), h('b.mv'))));
  tip(els.player.querySelector('.maimb'), () => { const m = ((ctx.view.player || {}).statuses || []).find((x) => x.id === 'MAIMED'); return m ? statusTip(m, ctx) : null; });
  els.pet = h('div#pet-frame.uf.hidden', h('div.portrait'), h('div.plate', h('div.name', h('span.pn'), h('span.cls', 'Pet')), bar('hp'), h('div.statuses')));
  els.target = h('div#target-frame.uf.hidden', h('div.portrait'), h('div.lvl', { style: { left: '5.4rem', top: '5.4rem' } }),
    h('div.plate', h('div.name', h('span.rb'), h('span.pn'), h('span.tag')), h('div.obal.hidden'), bar('hp enemy'), h('div.wstk.hidden'), h('div.statuses'), h('div.ttrack')));
  tip(els.target.querySelector('.obal'), () => { const c = ctx.view.combat; const e = c && c.enemies.find((x) => x.idx === ctx.ui.target); return e ? offBalanceTip(e) : null; });
  // the DoT preview's numbers on each HP bar (engine-api.md 6.1); none without a preview
  tip(els.target.querySelector('.bar.hp'), () => { const c = ctx.view.combat; const e = c && c.enemies.find((x) => x.idx === ctx.ui.target); return e ? dotTip(e.dot, 'enemy', e.name) : null; });
  tip(els.player.querySelector('.bar.hp'), () => { const p = ctx.view.player; return p ? dotTip(p.dot, 'player', 'you') : null; });
  tip(els.pet.querySelector('.bar.hp'), () => { const p = ctx.view.player; return p && p.pet ? dotTip(p.pet.dot, 'pet', p.pet.name) : null; });
  els.bossWarn = h('div.bwarn.hidden');
  els.boss = h('div#boss-frame.panel.hidden', h('div.bname'), h('div', { style: { position: 'relative' } }, bar('hp boss'), h('div.mark', { style: { left: '70%' } }), h('div.mark', { style: { left: '40%' } })), h('div.binfo'), els.bossWarn);
  tip(els.boss.querySelector('.bar.hp'), () => { const c = ctx.view.combat; const b = c && c.enemies.find((e) => e.rank === 'boss'); return b ? dotTip(b.dot, 'enemy', b.name) : null; });
  els.nameplates = h('div#nameplates');
  // ------------------------------------------------------------ action bar
  els.actionbar = h('div#actionbar.panel');
  els.basic = h('button.ab.basic', { title: '' }, h('img'), h('span.key', 'A'), h('span.ab-label', 'Attack'));
  els.spells = Array.from({ length: 7 }, (_, i) => h('button.ab', { dataset: { slot: i } }, h('img'), h('span.key', String(i + 1)), h('span.cost'), h('div.cd')));
  els.items = Array.from({ length: 3 }, (_, i) => h('button.ab', { dataset: { islot: i } }, h('img'), h('span.key', ['8', '9', '0'][i]), h('span.cnt'), h('div.cd')));
  els.auto = h('button.toggle', { type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Autoplay' }, h('span.sw'), h('span', 'Autoplay'), h('span.kbd', 'Z'));
  els.pass = h('button.btn.small', 'Pass', h('span.k', 'X'));
  els.flee = h('button.btn.small', 'Flee', h('span.k', 'F'));
  // the queued next action during a combat round (app.combatAct): a tag over the bar, the button ringed
  els.qtag = h('div.qtag.hidden', { 'aria-live': 'polite' });
  // "what to do now" on the player's turn in a fight (UX pass 2026-11-11): one line over the action bar that names the
  // most urgent thing the bar already marks (the engage options, a wind-up to answer, low health, an off-balance window)
  els.turn = h('div#turnprompt.hidden', { 'aria-live': 'polite' }, h('span.tp-k'), h('span.tp-t'));
  els.actionbar.append(
    h('div.grp', els.basic), h('div.sep'), h('div.grp', els.spells), h('div.sep'), h('div.grp', els.items),
    h('div.ctrl.panel', els.auto, els.pass, els.flee), els.qtag, els.turn);
  // ------------------------------------------------------------ xp bar
  els.xp = h('div#xpbar', h('div.rested'), h('div.fill'), h('div.ticks'), h('div.txt'));
  // ------------------------------------------------------------ minimap
  els.mmCanvas = h('canvas', { width: 292, height: 292 });
  els.minimap = h('div#minimap', h('div.zname'), h('div.mmwrap', h('div.disc', els.mmCanvas), h('div.clock')));
  // ------------------------------------------------------------ micro menu
  const mm = (key, label, glyph, bg, win) => {
    const b = h('button.mm', { 'aria-label': label }, h('img', { src: icon(glyph, bg), alt: '' }), h('span.mk', key));
    b.addEventListener('click', () => ctx.ui.toggleWin(win));
    tip(b, () => h('div', h('div.tt-name', label), h('div.tt-sub', `Key: ${key}`)));
    return b;
  };
  els.mmTalents = mm('N', 'Talents', 'stars3', 'gold', 'talents');
  els.micro = h('div#micromenu.panel', mm('C', 'Character', 'helm', 'steel', 'character'), mm('B', 'Bags', 'junk', 'earth', 'bags'), mm('P', 'Spellbook', 'tome', 'arcane', 'spellbook'),
    els.mmTalents, mm('L', 'Quest log', 'quest', 'parchment', 'questlog'), mm('M', 'Zone map', 'target', 'earth', 'map'), mm('Esc', 'Menu and settings', 'sun', 'dark', 'settings'));
  els.gold = h('div.goldline');
  // ------------------------------------------------------------ tracker & log
  els.tracker = h('div#tracker');
  els.logLines = h('div.lines');
  els.logToggle = h('button.xbtn', { style: { width: '1.9rem', height: '1.9rem', fontSize: '1rem' } }, '–');
  els.log = h('div#combatlog', h('div.lh', h('span', 'Combat log'), els.logToggle), els.logLines);
  els.logToggle.addEventListener('click', () => { els.log.classList.toggle('min'); els.logToggle.textContent = els.log.classList.contains('min') ? '+' : '–'; });

  root.append(els.nameplates, els.player, els.pet, els.target, els.boss, els.minimap, els.tracker, els.log, els.actionbar, els.micro, els.gold, els.xp);
  // combat v2: the opening ruler over the enemies and the engage panel of round 1 (tracks.js)
  const ruler = createRuler(root, ctx);
  const engage = createEngagePanel(root, ctx);
  els.ruler = ruler.el; els.engage = engage.el;
  // the Heat meter (heat.js), always shown in a run but on the summary: over the action bar's right half, beside the
  // Autoplay controls (over its left half), where no screen panel, window or frame reaches at 16:9 (1366x768, 1920x1080)
  const heat = createHeatMeter(root, ctx, root); // at the top centre (owner 2026-11-11 10:12)
  els.heat = heat.el;

  // ------------------------------------------------------------ input wiring
  els.basic.addEventListener('click', () => ctx.ui.attack());
  tip(els.basic, () => ctx.view.player && basicTip(ctx));
  els.spells.forEach((b, i) => {
    b.addEventListener('click', () => ctx.ui.castSlot(i));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); const p = ctx.view.player; if (p && p.bar[i] && ctx.view.legal.outOfCombat) ctx.act({ type: 'SET_BAR', slot: i, spellId: null }); });
    tip(b, () => {
      const p = ctx.view.player; if (!p) return null;
      const id = p.bar[i]; if (!id) return h('div', h('div.tt-name', `Empty slot ${i + 1}`), h('div.tt-hint', 'Drag a spell here from the spellbook (P).'));
      const L = ctx.view.legal.spells && ctx.view.legal.spells[id];
      const c = ctx.view.combat;
      // OFF_BALANCE window (combat v2): where this spell would land in a window (legal.spells[id].window, R.spellInfo)
      let win = null;
      if (L && L.ok && L.window && c && !c.over) {
        const names = (L.window === 'all' ? c.enemies.filter((e) => e.alive && e.offBalance) : c.enemies.filter((e) => L.window.includes(e.idx))).map((e) => e.name);
        const onTarget = L.window === 'all' || L.window.includes(ctx.ui.target);
        win = onTarget ? `Off-balance window: lands on ${names.join(', ')} for more damage and more crits.` : `Off-balance window on ${names.join(', ')}: target it first (click its nameplate or Tab).`;
      }
      const tipEl = spellTip(id, ctx, { reason: L && !L.ok && c && !c.over ? L.reason : null, hint: ctx.view.legal.outOfCombat ? 'Right-click to clear · drag to reorder' : `Key: ${i + 1}` });
      if (win && tipEl) tipEl.insertBefore(h('div.tt-line', { style: { color: '#ffc25a', fontWeight: 700 } }, win), tipEl.children[2] || null);
      // combat v2.1: the wind-ups this round that the spell can answer (rules 7.7, 7.12)
      const sd = ctx.data.spells[id];
      const wus = c && !c.over ? c.enemies.filter((e) => e.alive && e.intent && e.intent.windup && !e.intent.interrupted && !e.intent.cancelled)
        .map((e) => ({ e, x: entriesOf(e).find((x) => x.now && x.windup) })).filter((w) => w.x && answerKind(sd && sd.raw, w.x)) : [];
      if (wus.length && tipEl) {
        const w = wus[0]; const k = answerKind(sd.raw, w.x);
        tipEl.insertBefore(h('div.tt-line', { style: { color: '#9fdcff', fontWeight: 700 } }, k === 'avoid' ? `Wind-up this round: ${w.e.name}'s ${w.x.name} is heavy; avoid it entirely (no health lost) and it is answered.`
          : `Wind-up this round: ${w.e.name}'s ${w.x.name}. This can stop it: answered, staggered for the rest of the fight.${sd.target === 'enemy' && w.e.idx !== ctx.ui.target ? ' Target it first.' : ''}`), tipEl.children[2] || null);
      }
      return tipEl;
    });
    dropTarget(b, ctx, (d) => { if (d.kind === 'spell') ctx.act({ type: 'SET_BAR', slot: i, spellId: d.id }); });
    dragSource(b, ctx, () => { const p = ctx.view.player; const id = p && p.bar[i]; return id && ctx.view.legal.outOfCombat ? { kind: 'spell', id, icon: spellIcon(id, ctx.data.spells[id]) } : null; });
  });
  els.items.forEach((b, i) => {
    b.addEventListener('click', () => ctx.ui.useItemSlot(i));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); const p = ctx.view.player; if (p && p.itemBar[i] && ctx.view.legal.outOfCombat) ctx.act({ type: 'SET_ITEM_BAR', slot: i, itemId: null }); });
    tip(b, () => {
      const p = ctx.view.player; if (!p) return null;
      const id = p.itemBar[i];
      if (!id) return h('div', h('div.tt-name', `Empty item slot ${['8', '9', '0'][i]}`), h('div.tt-hint', 'Drag a potion or flask here from your bags (B).'));
      const it = p.bag.find((s) => s && s.id === id) || { kind: 'consumable', id, name: ctx.data.consumables[id].name, rarity: 'common' };
      const L = ctx.view.legal.items && ctx.view.legal.items[i];
      // M2b v6 (rules 7.5): the fight's first potion is a free action with Packed Satchel; M2b v8: at FREE_POTION_MULT strength,
      // and what it restores now is the engine's number (R.potionInfo through the bridge: L.heal, L.mana)
      const restores = L && L.free ? [L.heal ? `${fmtNum(L.heal)} health` : null, L.mana ? `${fmtNum(L.mana)} mana` : null].filter(Boolean).join(' and ') : '';
      const tipEl = itemTip(it, ctx, { hint: L && !L.ok ? L.reason : L && L.free ? `${freeActionText(L.mult)}: your first potion this fight costs no turn${restores ? ` and restores ${restores} now` : ''}. Right-click to clear` : 'Right-click to clear' });
      // M2b v13 (rules 7.5): MAIMED cuts it; the amount is the engine's (R.potionInfo through the bridge: L.heal, L.maim)
      if (tipEl && L && L.maim > 0 && L.heal > 0) tipEl.insertBefore(h('div.tt-warn.maim', `Maimed: restores ${fmtNum(L.heal)} health now (healing you receive −${Math.round(L.maim * 100)} % for the rest of this fight).`), tipEl.children[2] || null);
      return tipEl;
    });
    dropTarget(b, ctx, (d) => { if (d.kind === 'item' && d.item.kind === 'consumable') ctx.act({ type: 'SET_ITEM_BAR', slot: i, itemId: d.item.id }); });
  });
  els.auto.addEventListener('click', () => ctx.ui.toggleAuto());
  tip(els.auto, () => h('div', h('div.tt-name', 'Autoplay'), h('div.tt-line.desc', 'When on, the game picks each combat action for you (bar order is the priority). You can switch at any time, also mid-fight.'), h('div.tt-sub', 'Key: Z')));
  els.pass.addEventListener('click', () => ctx.ui.pass());
  els.flee.addEventListener('click', () => ctx.ui.flee());
  tip(els.flee, () => h('div', h('div.tt-name', 'Flee'), h('div.tt-line.desc', 'Try to escape. On success you leave the node with no further rewards.'), ctx.view.legal.fleeChance != null ? h('div.tt-line.num', `Chance: ${Math.round(ctx.view.legal.fleeChance * 100)} %`) : null, h('div.tt-sub', 'Key: F (press twice)')));
  tip(els.pass, () => h('div', h('div.tt-name', 'Pass'), h('div.tt-line.desc', 'Do nothing this round. Resources still regenerate.'), h('div.tt-sub', 'Key: X')));
  els.minimap.querySelector('.disc').addEventListener('click', () => ctx.ui.toggleWin('map'));
  tip(els.minimap.querySelector('.disc'), () => {
    const v = ctx.view; if (!v.zone) return null; const R = ctx.data.rules;
    const danger = v.zone.danger > 0 ? dangerRule(R) : null; // zone danger (rules 7.6): zone.danger from the engine's zoneDanger
    // the par and the line from R.heatView (the meter's numbers; the Oath of Haste included); v.par without heat (mock)
    const hv = v.heat; const par = hv ? hv.par : v.par;
    return h('div', h('div.tt-name', v.zone.name), h('div.tt-sub', `Levels ${v.zone.band[0]}–${v.zone.band[1]}`),
      hv ? h('div.tt-line', `${HEAT_WORDS.Name}: ${standText(hv)} (the Star's line: ${lineShown(hv.line)}) · ${bossText(hv.ascIfPar)}`) : null,
      h('div.tt-line.desc', `Oruvath grows stronger for every ${tolls(R.ascStepTime)} past ${fmtTime(par)} (Ascendancy).`),
      danger ? h('div.tt-warn.danger', danger) : null, h('div.tt-hint', 'Click or press M for the zone map'));
  });
  tip(els.resc, () => { const v = ctx.view; return v.player ? resurrectTip(v) : null; });
  tip(els.xp, () => {
    const p = ctx.view.player; if (!p) return null;
    return h('div', h('div.tt-name', `Level ${p.level}`), h('div.tt-line', `${fmtNum(p.xp)} / ${fmtNum(p.xpToNext)} experience`), p.rested ? h('div.tt-line', { style: { color: '#9fb8ff' } }, `Rested: ${fmtNum(p.rested)} (kills give double XP)`) : h('div.tt-sub', 'Not rested. Rest at an inn or campfire.'));
  });
  els.target.addEventListener('click', () => {});

  const npEls = new Map();
  let lastLogKey = '';

  function update(v) {
    const p = v.player;
    // the start camp (PREP, expedition.md 9.1) is one full screen: no HUD around it, as on class select
    const inGame = !!p && v.phase !== 'CREATE' && v.phase !== 'PREP';
    for (const el of [els.player, els.actionbar, els.xp, els.minimap, els.micro, els.log, els.tracker, els.gold]) el.classList.toggle('hidden', !inGame || v.phase === 'SUMMARY');
    const panelUp = v.phase === 'ZONE_HUB' || v.phase === 'CAMP' || v.phase === 'MAP' || !!v.loot || (v.node && v.node.step !== 'combat' && !(v.combat && !v.combat.over));
    // contracts (expedition.md 9.3; prep): on the map the tracker stays, narrowed to the column under the minimap, clear of the map
    const onMap = v.phase === 'MAP' && !!v.contracts && !v.loot;
    els.tracker.classList.toggle('dimmed', !!(inGame && panelUp && !onMap));
    els.tracker.classList.toggle('narrow', onMap);
    if (!inGame) { els.pet.classList.add('hidden'); els.target.classList.add('hidden'); els.boss.classList.add('hidden'); syncNameplates(v); ruler.update(v); engage.update(v); heat.update(v); return; }
    heat.update(v);
    const th = THEMES[(v.zone && v.zone.theme) || 'farmland'];
    // player
    const pf = els.player;
    if (pf.dataset.cls !== p.classId) { pf.dataset.cls = p.classId; clear(pf.querySelector('.portrait')).appendChild(heroPortrait(p.classId)); }
    pf.querySelector('.pn').textContent = p.name;
    pf.querySelector('.cls').textContent = p.className;
    pf.querySelector('.lvl').textContent = p.level;
    const ward = (p.statuses || []).find((s) => s.id === 'WARD');
    setBar(pf.querySelector('.bar.hp'), p.hp, p.maxHp, `${fmtNum(p.hp)} / ${fmtNum(p.maxHp)}`, ward ? ward.value : 0, p.dot);
    const rb = pf.querySelector('.bar.res');
    rb.className = 'bar res ' + p.res.kind;
    setBar(rb, p.res.cur, p.res.max, `${fmtNum(p.res.cur)} / ${fmtNum(p.res.max)}`);
    const cp = pf.querySelector('.cp');
    cp.classList.toggle('hidden', p.classId !== 'rogue');
    [...cp.children].forEach((c, i) => c.classList.toggle('on', i < (p.cp || 0)));
    statusRow(pf.querySelector('.statuses'), (p.statuses || []).filter((x) => !PLAYER_BADGES.has(x.id)), ctx);
    // M2b v13 (rules 7.4): MAIMED, large and lasting: "Maimed · Healing −50 %" (the status's value: MAIM_HEAL)
    const maim = (p.statuses || []).find((x) => x.id === 'MAIMED');
    const mb = pf.querySelector('.maimb');
    if (!!maim !== !mb.classList.contains('hidden') && maim) mb.classList.add('fresh');
    mb.classList.toggle('hidden', !maim);
    if (maim) { const t = `Healing −${Math.round((maim.value || 0) * 100)} %`; if (mb.querySelector('.mv').textContent !== t) mb.querySelector('.mv').textContent = t; mb.dataset.value = maim.value || 0; } else mb.classList.remove('fresh');
    // resurrect badge: the charges that work now; dimmed at 0 when a Second Breath is held in the final fight
    const rt = resurrectText(p, !!(v.combat && v.combat.isBoss && !v.combat.over));
    els.resc.classList.toggle('hidden', !rt.count && !rt.note);
    els.resc.classList.toggle('none', !rt.count);
    els.resc.querySelector('.n').textContent = String(rt.count);
    // pet: its frame sits under the player frame, which grows with the player's status icons
    if (p.pet && v.phase !== 'SUMMARY') {
      els.pet.classList.remove('hidden');
      const below = pf.offsetTop + pf.offsetHeight;
      if (below > 0) els.pet.style.top = `${Math.round(below + parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5)}px`;
      if (els.pet.dataset.pet !== p.pet.id) { els.pet.dataset.pet = p.pet.id; clear(els.pet.querySelector('.portrait')).appendChild(petPortrait(p.pet.id)); }
      els.pet.querySelector('.pn').textContent = p.pet.name;
      setBar(els.pet.querySelector('.bar.hp'), p.pet.alive ? p.pet.hp : 0, p.pet.maxHp, p.pet.alive ? `${fmtNum(p.pet.hp)} / ${fmtNum(p.pet.maxHp)}` : 'Dead', 0, p.pet.alive ? p.pet.dot : null);
      els.pet.style.opacity = p.pet.alive ? 1 : 0.55;
      statusRow(els.pet.querySelector('.statuses'), p.pet.statuses, ctx);
    } else els.pet.classList.add('hidden');
    // the engage panel (combat v2) starts under the player and pet frames, which grow with their status icons
    if (!els.engage.classList.contains('hidden') || (v.combat && v.combat.engage)) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const low = Math.max(pf.offsetTop + pf.offsetHeight, els.pet.classList.contains('hidden') ? 0 : els.pet.getBoundingClientRect().bottom);
      els.engage.style.top = `${Math.round(Math.max(19.5 * rem, low + 1.2 * rem))}px`;
    }
    // target & boss
    const c = v.combat;
    const inFight = c && !c.over;
    const tgt = c ? c.enemies.find((e) => e.idx === ctx.ui.target && e.alive && !e.hidden) : null;
    els.target.classList.toggle('under-boss', !!(c && c.isBoss));
    if (tgt && !(c.isBoss && tgt.rank === 'boss')) {
      els.target.classList.remove('hidden');
      els.target.classList.toggle('elite', tgt.rank === 'elite' || tgt.rank === 'dboss');
      els.target.classList.toggle('rare', tgt.rank === 'rare');
      const tkey = `${tgt.uid}`;
      if (els.target.dataset.key !== tkey) { els.target.dataset.key = tkey; clear(els.target.querySelector('.portrait')).appendChild(enemyPortrait(tgt, v.zone && v.zone.theme)); }
      const nm = els.target.querySelector('.pn'); nm.textContent = tgt.name;
      const tag = els.target.querySelector('.tag');
      const tagKey = JSON.stringify([tgt.uid, tgt.rank, tgt.role, tgt.ccImmune, tgt.firstMeet]);
      if (tag.dataset.key !== tagKey) {
        tag.dataset.key = tagKey; clear(tag);
        if (tgt.firstMeet) tag.appendChild(h('span.rank-tag.new', 'New')); // M2b v13: a first meeting (rules 7.12, gated)
        if (tgt.rank === 'elite' || tgt.rank === 'dboss') tag.appendChild(h('span.rank-tag', tgt.rank === 'dboss' ? 'Boss' : 'Elite'));
        if (tgt.rank === 'rare') tag.appendChild(h('span.rank-tag.rare', 'Rare'));
        add(tag, roleTags(tgt, ctx));
        const rb = clear(els.target.querySelector('.rb')); const badge = roleBadge(tgt, ctx); if (badge) rb.appendChild(badge);
      }
      const lv = els.target.querySelector('.lvl'); lv.textContent = tgt.level; lv.style.color = conColor(tgt.level, p.level);
      const tw = (tgt.statuses || []).find((s) => s.id === 'WARD');
      setBar(els.target.querySelector('.bar.hp'), tgt.hp, tgt.maxHp, `${fmtNum(tgt.hp)} / ${fmtNum(tgt.maxHp)}  ·  ${Math.ceil((tgt.hp / tgt.maxHp) * 100)} %`, tw ? tw.value : 0, inFight ? tgt.dot : null);
      stackBadges(els.target.querySelector('.wstk'), tgt, ctx); // combat v2.1: EMPOWERED / STAGGERED, large (their small icons stay out of the row)
      statusRow(els.target.querySelector('.statuses'), (tgt.statuses || []).filter((s) => !WINDUP_STACKS.has(s.id)), ctx);
      // the off-balance marker (combat v2, rules 7.13) and the intent track (rules 7.11)
      const ob = els.target.querySelector('.obal'); const obOn = !!(tgt.offBalance && inFight);
      ob.classList.toggle('hidden', !obOn); ob.classList.toggle('frost', !!(obOn && tgt.offBalance.status === 'FROZEN')); if (obOn) ob.textContent = offBalanceText(tgt.offBalance);
      els.target.classList.toggle('offbal', obOn);
      const tr = els.target.querySelector('.ttrack');
      if (inFight) trackRows(tr, tgt, ctx); else { tr.classList.add('hidden'); tr.dataset.key = ''; }
    } else els.target.classList.add('hidden');
    const boss = c && c.isBoss ? c.enemies.find((e) => e.rank === 'boss') : null;
    if (boss) {
      els.boss.classList.remove('hidden');
      els.boss.querySelector('.bname').textContent = boss.name;
      setBar(els.boss.querySelector('.bar.hp'), boss.hp, boss.maxHp, `${fmtNum(boss.hp)} / ${fmtNum(boss.maxHp)}  ·  ${Math.ceil((boss.hp / boss.maxHp) * 100)} %`, 0, inFight ? boss.dot : null);
      const b = c.boss || {};
      const tg = b.telegraph || {};
      const brand = (p.statuses || []).find((s) => s.id === 'BRAND');
      const when = (n) => (n <= 0 ? 'this round' : n === 1 ? 'next round' : `in ${n}`);
      const enrage = tg.enrageInRounds != null ? `Final Dark ${when(tg.enrageInRounds)}` : b.enrageRound ? `Final Dark at round ${b.enrageRound}` : '';
      const extra = [tg.litanyInRounds != null ? `Litany ${when(tg.litanyInRounds)}` : null, tg.shardsInRounds != null ? `Shards ${when(tg.shardsInRounds)}` : null, tg.pulseInRounds != null ? `Pulse ${when(tg.pulseInRounds)}` : null, tg.crushNextRound ? 'Crush next round!' : null].filter(Boolean).join(' · ');
      // Linked strength from the Shards alive on screen (the view shown while a round plays) and the rules table
      const lk = b.linked; const R = ctx.data.rules;
      const shards = c.enemies.filter((e) => e.rank === 'shard' && e.alive && !e.hidden).length;
      const dr = lk ? R.linkDr[Math.min(shards, R.linkDr.length - 1)] : 0;
      const phase = h('span.bphase', 'Phase ', h('b', String(b.phase || 1)));
      if (b.phase === 2 && lk) {
        // no-break spaces keep "−45 %" and "(3 Shards)" whole when the line wraps
        if (shards > 0) phase.append(' · Linked ', h('b.linked', `−${Math.round(dr * 100)}\u00a0%`), ` (${shards}\u00a0${shards === 1 ? 'Shard' : 'Shards'})`);
        else phase.append(' · Link broken');
        tip(phase, () => h('div', h('div.tt-name', 'Linked'), h('div.tt-line.desc', linkedText(R, 'tip'))));
      } else if (b.phase === 2) phase.append(' · Linked');
      else if (b.phase === 3) phase.append(' · Eclipse');
      clear(els.boss.querySelector('.binfo')).append(
        phase,
        h('span', 'Brand ', h('b', String(brand ? brand.stacks : 0)), tg.brandInRounds != null ? (tg.brandInRounds <= 0 ? ' · lands this round' : ` · next ${when(tg.brandInRounds)}`) : ''),
        h('span', 'Round ', h('b', String(c.round)), enrage ? ` · ${enrage}` : ''),
        h('span', 'Ascendancy ', h('b', `+${Math.round((b.asc || 0) * 100)} %`)));
      els.bossWarn.textContent = extra; els.bossWarn.classList.toggle('hidden', !extra);
    } else els.boss.classList.add('hidden');
    syncNameplates(v);
    ruler.update(v);
    engage.update(v);
    // action bar
    updateBar(v);
    // xp
    const xf = p.xpToNext ? clamp(p.xp / p.xpToNext, 0, 1) : 1;
    const rf = p.xpToNext ? clamp((p.xp + (p.rested || 0)) / p.xpToNext, 0, 1) : 0;
    els.xp.querySelector('.fill').style.width = `${xf * 100}%`;
    els.xp.querySelector('.fill').classList.toggle('rest', (p.rested || 0) > 0);
    const rs = els.xp.querySelector('.rested'); rs.style.left = `${xf * 100}%`; rs.style.width = `${Math.max(0, rf - xf) * 100}%`;
    els.xp.querySelector('.txt').textContent = !p.xpToNext ? `Level ${p.level} · maximum level` : `Level ${p.level}  ·  ${fmtNum(p.xp)} / ${fmtNum(p.xpToNext)} XP (${Math.floor(xf * 100)} %)${p.rested ? `  ·  Rested ${fmtNum(p.rested)}` : ''}`;
    // minimap & clock
    if (v.zone) {
      els.minimap.querySelector('.zname').textContent = v.zone.name;
      // no day clock (changes-m2b-v7.md A row 10): the Furnace is the time display; the minimap names the zone only
      els.minimap.querySelector('.clock').textContent = '';
      drawMinimap(els.mmCanvas, v, th);
    }
    // talents badge
    let badge = els.mmTalents.querySelector('.badge');
    if (p.talentPoints > 0) { if (!badge) { badge = h('span.badge'); els.mmTalents.appendChild(badge); } badge.textContent = p.talentPoints; } else if (badge) badge.remove();
    clear(els.gold).appendChild(moneyEl(p.gold));
    updateTracker(v);
  }

  function syncNameplates(v) {
    const c = v.combat;
    const live = new Set();
    // four or more enemies side by side (adds, a Signal): narrower nameplates so their tracks do not overlap
    els.nameplates.classList.toggle('tight', !!(c && !c.isBoss && c.enemies.filter((e) => e.alive && !e.hidden).length >= 4));
    if (c && v.player) {
      for (const e of c.enemies) {
        if (e.hidden) continue;
        const id = e.uid || e.idx; live.add(String(id));
        let el = npEls.get(String(id));
        if (!el) {
          // what comes and goes during a round (the off-balance chip, tags, stack badges, statuses) hangs under the health
          // bar (.under, out of the flow), so the wind-up line, the track and the name above it never move (UX pass 2026-11-11)
          el = h('div.np', h('div.wub.hidden'), h('div.trk'), h('div.castbar.hidden', h('i')), h('div.nm', h('span.rb'), h('span.lv'), h('span.n'), h('span.newtag.hidden', 'New')),
            bar('hp enemy'), h('div.under', h('div.obal.hidden'), h('div.ntag.hidden', h('span.zz.hidden', 'Unaware'), h('span.rtags')), h('div.wstk.hidden'), h('div.sts')));
          el.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.ui.setTarget(e.idx); });
          el.addEventListener('pointerenter', () => { ctx.scene.hover = `enemy:${e.idx}`; });
          el.addEventListener('pointerleave', () => { ctx.scene.hover = null; });
          tip(el.querySelector('.obal'), () => { const x = ctx.view.combat && ctx.view.combat.enemies.find((q) => q.idx === Number(el.dataset.idx)); return x ? offBalanceTip(x) : null; });
          tip(el.querySelector('.bar'), () => { const x = ctx.view.combat && ctx.view.combat.enemies.find((q) => q.idx === Number(el.dataset.idx)); return x && x.alive ? dotTip(x.dot, 'enemy', x.name) : null; });
          els.nameplates.appendChild(el); npEls.set(String(id), el);
        }
        el.dataset.idx = e.idx;
        el.classList.toggle('dead', !e.alive);
        el.classList.toggle('sel', ctx.ui.target === e.idx);
        el.classList.toggle('boss', e.rank === 'boss');
        el.classList.toggle('shard', e.rank === 'shard' || e.arch === 'shard');
        const lv = el.querySelector('.lv'); lv.textContent = e.rank === 'boss' ? '??' : e.level; lv.style.color = conColor(e.level, v.player.level);
        el.querySelector('.n').textContent = e.name + (e.rank === 'elite' ? ' (Elite)' : e.rank === 'rare' ? ' (Rare)' : e.rank === 'dboss' ? ' (Boss)' : '');
        el.querySelector('.newtag').classList.toggle('hidden', !(e.firstMeet && e.alive)); // M2b v13: first meeting (gated)
        setBar(el.querySelector('.bar'), e.hp, e.maxHp, `${Math.ceil((e.hp / e.maxHp) * 100)} %`, ((e.statuses || []).find((s) => s.id === 'WARD') || {}).value || 0, e.alive && !c.over ? e.dot : null);
        statusRow(el.querySelector('.sts'), (e.statuses || []).filter((s) => !WINDUP_STACKS.has(s.id)), ctx);
        // combat v2.1: the lasting stacks of its wind-ups, and the wind-up line over it (from the round its track shows one)
        stackBadges(el.querySelector('.wstk'), e, ctx);
        // role badge and pack-role tags (combat v2, rules 7.12)
        const roleKey = JSON.stringify([e.role, e.ccImmune]);
        if (el.dataset.role !== roleKey) {
          el.dataset.role = roleKey;
          const rb = clear(el.querySelector('.rb')); const badge = roleBadge(e, ctx); if (badge) rb.appendChild(badge);
          clear(el.querySelector('.rtags')); add(el.querySelector('.rtags'), roleTags(e, ctx));
        }
        const it = e.intent;
        const showIntent = it && e.alive && !c.over;
        const zz = !!(showIntent && it.id === 'unaware');
        el.querySelector('.zz').classList.toggle('hidden', !zz);
        el.querySelector('.ntag').classList.toggle('hidden', !(zz || (e.alive && el.querySelector('.rtags').childElementCount)));
        // the intent track (rules 7.11): the next actions in order, the first largest
        const trk = el.querySelector('.trk');
        trk.classList.toggle('hidden', !showIntent);
        if (showIntent) trackChips(trk, e, ctx, { allSmall: e.rank === 'shard' || e.arch === 'shard' });
        const wub = el.querySelector('.wub');
        if (showIntent) windupBanner(wub, e, ctx); else { wub.classList.add('hidden'); wub.dataset.key = ''; }
        // the off-balance marker (rules 7.13)
        const obOn = !!(e.offBalance && e.alive && !c.over);
        el.classList.toggle('offbal', obOn);
        const ob = el.querySelector('.obal'); ob.classList.toggle('hidden', !obOn); ob.classList.toggle('frost', !!(obOn && e.offBalance.status === 'FROZEN'));
        if (obOn) { const t = offBalanceText(e.offBalance, true); if (ob.textContent !== t) ob.textContent = t; }
        // engage hover: the enemies the option may target, and the one previewed (combat v2, rules 7.10)
        const pv = ctx.ui.preview;
        el.classList.toggle('eg-valid', !!(pv && pv.valid && pv.valid.includes(e.idx) && pv.target !== e.idx));
        el.classList.toggle('eg-pv', !!(pv && pv.target === e.idx && pv.target != null));
        el.classList.toggle('eg-invalid', !!(pv && pv.valid && pv.valid.length && !pv.valid.includes(e.idx) && e.alive));
        const cb = el.querySelector('.castbar');
        const casting = !!(showIntent && it.cast && !it.interrupted && !(it.cancelled));
        cb.classList.toggle('hidden', !casting);
        if (casting) cb.querySelector('i').style.transform = `scaleX(${it.channel ? it.channel[0] / it.channel[1] : 0.5})`;
      }
    }
    for (const [id, el] of npEls) if (!live.has(id)) { el.remove(); npEls.delete(id); }
  }

  /**
   * Called every frame: keep nameplates over their actors, on whole pixels and without the tremble of a held telegraph
   * (combat v2.1: the wind-up line and the track must stay readable while the enemy winds up).
   */
  function placeNameplates() {
    for (const el of npEls.values()) {
      const an = ctx.scene.anchor(`enemy:${el.dataset.idx}`);
      if (!an || !an.visible) { el.style.opacity = 0; continue; }
      el.style.opacity = '';
      el.style.left = `${Math.round(an.steadyX ?? an.x)}px`;
      el.style.top = `${Math.round(an.top - 4)}px`;
    }
  }

  function updateBar(v) {
    const p = v.player; const L = v.legal || {};
    const c = v.combat; const fight = c && !c.over && !ctx.ui.playing;
    els.basic.querySelector('img').src = basicIcon(p.classId);
    els.basic.classList.toggle('off', !fight);
    // combat v2.1 (combat-v2.md 10.9): the wind-ups that play this round (an intent still to come: not interrupted or
    // cancelled) and the one hovered on a track, the ruler or a nameplate; answerKind reads each spell's engine entry
    const wuNow = fight ? c.enemies.filter((e) => e.alive && !e.hidden && e.intent && e.intent.windup && !e.intent.interrupted && !e.intent.cancelled)
      .map((e) => ({ e, x: entriesOf(e).find((x) => x.now && x.windup) || { windup: true, heavy: !!e.intent.heavy, now: true } })) : [];
    // M2b v13: the bar spells that answer an open Deathblow (R.windupView answers via 'spell'): now, or ready by its round
    const dbSp = {};
    if (fight) for (const w of (c.windups || []).filter((q) => q.deathblow && !(q.cancel && q.cancel.stagger && !q.cancel.breaks))) for (const a of w.answers) if (a.via === 'spell') { const o = dbSp[a.id]; if (!o || (a.now && !o.now)) dbSp[a.id] = { now: a.now, sure: a.sure, round: w.round, inRounds: w.inRounds }; }
    const hv = ctx.ui.wuHover; const hvE = hv && c ? c.enemies.find((e) => e.idx === hv.idx) : null;
    const hvX = hvE ? entriesOf(hvE).find((x) => x.turn === hv.turn && x.windup) || null : null;
    p.bar.forEach((id, i) => {
      const b = els.spells[i];
      const img = b.querySelector('img'); const cost = b.querySelector('.cost'); const cd = b.querySelector('.cd');
      if (!id) { b.classList.add('empty'); b.setAttribute('aria-label', `Empty slot ${i + 1}`); img.removeAttribute('src'); img.style.visibility = 'hidden'; cost.textContent = ''; cd.textContent = ''; cd.style.background = ''; b.classList.remove('off', 'nores', 'hint'); return; }
      b.classList.remove('empty'); img.style.visibility = '';
      const sp = ctx.data.spells[id];
      b.setAttribute('aria-label', `Slot ${i + 1}: ${sp.name}`);
      const src = spellIcon(id, sp); if (img.getAttribute('src') !== src) img.src = src;
      const s = L.spells && L.spells[id];
      const cdLeft = c && c.cooldowns ? c.cooldowns[id] || 0 : 0;
      cost.textContent = sp.cost ? (sp.cost[0] === 'M' ? '' : sp.cost[1]) : '';
      const ok = fight && s && s.ok;
      b.classList.toggle('off', !ok && !(s && /enough/.test(s.reason || '')));
      b.classList.toggle('nores', !!(fight && s && !s.ok && /enough/.test(s.reason || '')));
      if (cdLeft > 0 && c && !c.over) {
        const frac = clamp(cdLeft / Math.max(1, sp.cd || cdLeft), 0, 1);
        cd.style.background = `conic-gradient(rgba(0,0,0,.74) ${frac * 360}deg, rgba(0,0,0,.18) 0)`; cd.textContent = cdLeft;
      } else { cd.style.background = ''; cd.textContent = ''; }
      const intr = fight && ok && sp.tags.includes('interrupt') && c.enemies.some((e) => e.alive && e.intent && e.intent.cast && !e.intent.interrupted);
      b.classList.toggle('hint', !!intr);
      // OFF_BALANCE window (combat v2, rules 7.13): the spell lands in a window on the current target (an area spell: on
      // any enemy), from R.spellInfo(...).window; "elsewhere" when only another enemy is off-balance
      const w = fight && ok && s ? s.window : null;
      const here = !!(w && (w === 'all' || w.includes(ctx.ui.target)));
      const there = !!(w && !here && w.length);
      b.classList.toggle('window', here); b.classList.toggle('window-else', there);
      let wt = b.querySelector('.wtag'); let wText = null;
      if (here || there) {
        const src = here ? (w === 'all' ? c.enemies.find((x) => x.alive && x.offBalance) : c.enemies.find((x) => x.idx === ctx.ui.target)) : null;
        wText = here ? (src && src.offBalance ? `+${Math.round(src.offBalance.taken * 100)}%` : 'Window') : '⇄ target';
        if (!wt) { wt = h('span.wtag'); b.appendChild(wt); }
        wt.textContent = wText;
      } else if (wt) wt.remove();
      // Pre-cast armed in the engage round (combat v2): the spells it can cast for free
      const eg = fight && c.engage && ctx.ui.precastArmed ? c.engage.options.find((o) => o.spells) : null;
      b.classList.toggle('precast', !!(eg && eg.spells.some((x) => x.spellId === id)));
      // combat v2.1: answer the wind-up now ("Answer": stops it; "Avoid": a defensive spell against a heavy one; "⇄ target"
      // when the wind-up is on another enemy than the target), and every spell that can answer a hovered wind-up
      const kinds = wuNow.map((w) => ({ w, k: answerKind(sp.raw, w.x) })).filter((z) => z.k);
      const usable = !!(ok && kinds.length);
      const onTgt = kinds.some((z) => z.k === 'avoid' || sp.target !== 'enemy' || z.w.e.idx === ctx.ui.target);
      const stop = usable && kinds.some((z) => z.k === 'stop'); const avoid = usable && !stop;
      b.classList.toggle('wu-ans', stop && onTgt); b.classList.toggle('wu-else', stop && !onTgt); b.classList.toggle('wu-avoid', avoid);
      b.classList.toggle('wu-hl', !!(hvX && answerKind(sp.raw, hvX)));
      const db = dbSp[id] || null;
      b.classList.toggle('db-now', !!(db && db.now)); b.classList.toggle('db-soon', !!(db && !db.now));
      b.dataset.db = db ? `${db.now ? 'now' : `r${db.round}`}${db.sure ? '' : '?'}` : '';
      let at = b.querySelector('.atag');
      if (stop || avoid) {
        if (!at) { at = h('span.atag'); b.appendChild(at); }
        // one tag: side by side the two would overlap on the button. A window on the target joins it ("Answer · +50%");
        // one on another enemy gives way to the wind-up, which plays this round (the button keeps its window class)
        const aText = avoid ? 'Avoid' : onTgt ? 'Answer' : '⇄ target';
        at.textContent = wText && here ? `${aText} · ${wText}` : aText;
        at.classList.toggle('db', !!(db && db.now)); at.classList.remove('soon');
        if (wt) wt.remove();
      } else if (db && !db.now && !(here || there)) {
        // a Deathblow answer ready by its round (not now): "R3" in crimson, so the player keeps it for then (an off-balance
        // window's tag, which is about this round, keeps the button)
        if (!at) { at = h('span.atag'); b.appendChild(at); }
        at.textContent = `R${db.round}`; at.classList.add('db', 'soon');
      } else if (at) at.remove();
    });
    p.itemBar.forEach((id, i) => {
      const b = els.items[i]; const img = b.querySelector('img'); const cnt = b.querySelector('.cnt'); const cd = b.querySelector('.cd');
      const key = ['8', '9', '0'][i];
      if (!id) { b.classList.add('empty'); b.setAttribute('aria-label', `Empty item slot ${key}`); img.style.visibility = 'hidden'; cnt.textContent = ''; cd.textContent = ''; cd.style.background = ''; b.classList.remove('off'); return; }
      b.classList.remove('empty'); img.style.visibility = '';
      b.setAttribute('aria-label', `Item slot ${key}: ${(ctx.data.consumables[id] || { name: id }).name}`);
      const src = consumableIcon(id); if (img.getAttribute('src') !== src) img.src = src;
      const s = L.items && L.items[i];
      const count = p.bag.reduce((a, it) => a + (it && it.id === id ? it.count : 0), 0);
      cnt.textContent = count;
      b.classList.toggle('off', !(s && s.ok) || ctx.ui.playing);
      // low health (owner playtest 2026-11-11 08:03): a healing potion that can be drunk now pulses; nothing is drunk for you
      const heals = !!(ctx.data.consumables[id] && ctx.data.consumables[id].heal);
      const pulse = !!(fight && heals && s && s.ok && count > 0 && p.maxHp > 0 && p.hp / p.maxHp < POTION_HINT_HP);
      b.classList.toggle('pulse', pulse);
      if (pulse) b.setAttribute('aria-label', `Item slot ${key}: ${(ctx.data.consumables[id] || { name: id }).name}. Low health: drink it`);
      // the free mark (M2b v6, rules 7.5): Packed Satchel's free potion of this fight is unused and this is a potion
      const free = !!(fight && s && s.free && count > 0);
      let ft = b.querySelector('.ftag');
      if (free && !ft) { ft = h('span.ftag', 'Free'); b.appendChild(ft); } else if (!free && ft) ft.remove();
      if (free) b.setAttribute('aria-label', `${b.getAttribute('aria-label')}. ${freeActionText(s.mult)}`); // M2b v8: "Free action, half strength (Packed Satchel)"
      if (s && s.cd) { cd.style.background = `conic-gradient(rgba(0,0,0,.74) ${clamp(s.cd / ctx.data.rules.potionCd, 0, 1) * 360}deg, rgba(0,0,0,.18) 0)`; cd.textContent = s.cd; } else { cd.style.background = ''; cd.textContent = ''; }
      // M2b v13 (rules 7.5): MAIMED: a healing potion shows what it restores now, the engine's cut amount (R.potionInfo heal)
      const maimed = !!(c && !c.over && s && s.maim > 0 && s.heal > 0 && count > 0);
      let mt = b.querySelector('.mtag');
      if (maimed) { if (!mt) { mt = h('span.mtag'); b.appendChild(mt); } mt.textContent = `+${fmtNum(s.heal)}`; mt.dataset.heal = s.heal; b.setAttribute('aria-label', `${b.getAttribute('aria-label')}. Maimed: restores ${fmtNum(s.heal)} health`); } else if (mt) mt.remove();
      b.classList.toggle('maimed', maimed);
    });
    els.auto.classList.toggle('on', !!v.autoplay);
    els.auto.setAttribute('aria-checked', v.autoplay ? 'true' : 'false');
    els.pass.disabled = !fight; els.flee.disabled = !fight || !L.flee;
    els.flee.firstChild.textContent = ctx.ui.fleeArmed ? 'Confirm?' : 'Flee';
    turnPrompt(v, fight && !v.autoplay, fight && v.autoplay);
  }

  /**
   * The turn prompt: shown only while the game waits for the player in a fight. It reads the marks updateBar just set on
   * the bar (no rule of its own): in order, the engage round, a wind-up to answer now (or that nothing on the bar can),
   * a potion to drink at low health, an off-balance window on the target, else the plain choice.
   */
  function turnPrompt(v, mine, auto = false) {
    const c = v.combat;
    // M2b v13 (UI needs 8): with autoplay on, in the engage round of a special fight, what autoplay will answer (rule E2)
    const ae = auto && c && c.engage ? c.autoEngage : null;
    els.turn.classList.toggle('hidden', !mine && !ae);
    els.actionbar.classList.toggle('your-turn', !!mine);
    if (ae) {
      els.turn.querySelector('.tp-k').textContent = `Autoplay · R${c.round}`;
      const tEl = els.turn.querySelector('.tp-t');
      const t = `Autoplay will answer the ${ae.windup.deathblow ? 'Deathblow' : 'wind-up'} with ${ae.name}`;
      const sig = `auto:${t}:${ae.enemy}`;
      if (tEl.dataset.sig !== sig) { tEl.dataset.sig = sig; clear(tEl); tEl.append(t, h('span.tp-s', ` (${ae.enemy}'s ${ae.windup.name})`)); }
      els.turn.dataset.kind = ae.windup.deathblow ? 'auto-db' : 'auto';
      return;
    }
    if (!mine) return;
    const name = (b) => (b.getAttribute('aria-label') || '').replace(/^(Item slot|Slot) [0-9]+: /, '').replace(/\..*$/, '');
    const key = (b) => b.querySelector('.key').textContent;
    const kb = (k) => h('kbd', k);
    const first = (cls) => [...els.spells, ...els.items].find((b) => b.classList.contains(cls) && !b.classList.contains('empty'));
    let k = 'Your turn'; let parts;
    const ans = first('wu-ans'); const els2 = first('wu-else'); const avoid = first('wu-avoid'); const pot = first('pulse'); const win = first('window');
    const wuLive = c.enemies.some((e) => e.alive && !e.hidden && e.intent && e.intent.windup && !e.intent.interrupted && !e.intent.cancelled);
    // M2b v13: an open Deathblow in view comes first: its answer now with its key, or "no answer ready" (R.windupView)
    const dbw = (c.windups || []).find((w) => w.deathblow && !(w.cancel && w.cancel.stagger && !w.cancel.breaks));
    const dbSh = dbw ? answersToShow(dbw, v, ctx) : null;
    let dbKind = null;
    if (dbw && (c.engage || dbw.inRounds <= 1)) {
      const when = dbw.inRounds === 0 ? 'now' : `in R${dbw.round}`;
      const first = dbSh.list.find((x) => x.key) || null;
      k = 'Deathblow';
      if (!dbw.ready) { parts = [`Deathblow ${when}: `, h('b.tp-no', 'No answer ready'), dbw.inRounds > 0 ? '. Kill it first or brace for it' : '']; dbKind = 'deathblow-no'; }
      else if (first && dbSh.when === 'now' && first.a.target != null && first.a.target !== (ctx.ui.target ?? c.target)) { parts = [`Deathblow ${when} on ${dbw.enemy}: `, kb('Tab'), ' to it, then ', kb(first.key), ` ${first.name}`]; dbKind = 'deathblow'; }
      else if (first && dbSh.when === 'now') { parts = [`Deathblow ${when}: answer with `, kb(first.key), ` ${first.name}${first.a.sure ? '' : ' (a chance)'}`]; dbKind = 'deathblow'; }
      else if (first) { parts = [`Deathblow ${when}: keep `, kb(first.key), ` ${first.name} for round ${dbw.round}`]; dbKind = 'deathblow'; }
    }
    if (dbKind) { /* the Deathblow's line above */ }
    else if (c.engage) { k = 'Opening move'; parts = ['Open with ', kb('Q'), ' ', kb('W'), ' ', kb('E'), ' (left panel) or any bar key: they do not act yet']; }
    else if (ans) parts = ['Wind-up now: answer with ', kb(key(ans)), ` ${name(ans)}`];
    else if (els2) parts = ['Wind-up on another enemy: ', kb('Tab'), ' to it, then ', kb(key(els2)), ` ${name(els2)}`];
    else if (avoid) parts = ['Heavy wind-up now: ', kb(key(avoid)), ` ${name(avoid)} can blunt it`];
    else if (wuLive) parts = ['Wind-up now: nothing on your bar can stop it this round'];
    else if (pot) parts = ['Low health: ', kb(key(pot)), ` ${name(pot)}`];
    else if (win) parts = ['Off-balance: ', kb(key(win)), ` ${name(win)} hits ${(win.querySelector('.wtag') || {}).textContent || 'harder'}`];
    else parts = ['Choose ', kb('1'), '–', kb('7'), ', ', kb('A'), ' attack or ', kb('X'), ' pass'];
    const kEl = els.turn.querySelector('.tp-k'); const tEl = els.turn.querySelector('.tp-t');
    kEl.textContent = `${k} · R${c.round}`;
    const sig = parts.map((x) => (typeof x === 'string' ? x : `[${x.textContent}]`)).join('');
    if (tEl.dataset.sig !== sig) { tEl.dataset.sig = sig; clear(tEl); tEl.append(...parts); }
    els.turn.dataset.kind = dbKind || (c.engage ? 'engage' : ans || els2 || avoid || wuLive ? 'windup' : pot ? 'potion' : win ? 'window' : 'plain');
  }

  function updateTracker(v) {
    const lines = [];
    const z = v.zone; const p = v.player; const n = v.node; const R = ctx.data.rules;
    if (n && v.phase === 'NODE') {
      if (n.type === 'quest') { const k = n.mobs ? n.mobs.length : 1; lines.push(['h', n.title || 'Quest']); lines.push(['l', n.step === 'reward' || n.step === 'story' ? 'Return to ' + (n.giver || 'the quest giver') : `Defeat ${k} ${k === 1 ? 'enemy' : 'enemies'}`]); }
      else if (n.type === 'dungeon') { const all = R.dungeonTrashFights + 1; lines.push(['h', n.dungeon]); lines.push(['l', `Fight ${Math.max(1, n.fightNo)} of ${all}${n.fightNo >= all ? ': ' + n.bossName : ''}`]); }
      else if (n.type === 'grind') { lines.push(['h', 'Grind']); lines.push(['l', n.wavesChosen ? `Wave ${n.waves} of ${n.wavesChosen}` : 'Choose how many waves']); }
      else if (n.type === 'elite') { lines.push(['h', n.rare ? 'Rare elite' : 'Elite']); lines.push(['l', `Defeat ${n.eliteName}`]); }
    }
    const nNode = lines.length;
    // contracts of this zone (expedition.md 9.3; prep.js), after the node's lines and before the zone's
    const cv = v.contracts;
    const cKey = cv ? JSON.stringify([z && z.idx, cv.held, cv.reserve, cv.contracts.map((c) => [c.id, c.status, c.progress])]) : '';
    if (z && !z.camp && z.rows && z.rows.length) {
      const sq = R.storyQuests; const t = travelState(v);
      lines.push(['h', z.name]);
      lines.push([z.storyDone ? 'd' : 'l', `Story: ${Math.min(sq, z.questsDone)} / ${sq} quests${z.storyDone ? ' (done)' : ''}`]);
      // travel on (rules 1.5): legal from travelLevel, under the exit level when the engine allows it
      if (t.kind === 'done' || (t.rows && z.pos.row >= t.rows)) lines.push(['d', `Row ${t.rows} done: travel on`]);
      else if (p.level >= t.exit) lines.push(['d', `Level ${t.exit} reached: you may travel on`]);
      else if (p.level >= t.need) lines.push(['d', `Level ${t.need}: you may travel on early (exit level ${t.exit})`]);
      else lines.push(['l', `Travel on at level ${t.need} (or after row ${t.rows})`]);
      lines.push(['l', `Row ${z.pos.row} of ${t.rows}`]);
    } else if (z) { lines.push(['h', z.name]); lines.push(['l', `${HEAT_WORDS.Units}: ${fmtTime(v.time)} (par ${fmtTime(v.heat ? v.heat.par : v.par)})`]); } // heatView's par, as the meter
    const key = JSON.stringify(lines) + nNode + cKey;
    if (els.tracker.dataset.key === key) return;
    els.tracker.dataset.key = key; clear(els.tracker);
    // the zone's lines (.zl) give way in a fight (style.css body.in-fight), the node's lines stay
    const line = ([k, t], i) => h((k === 'h' ? 'div.tk-h' : 'div.tk-l' + (k === 'd' ? '.done' : '')) + (i >= nNode ? '.zl' : ''), t);
    lines.slice(0, nNode).forEach((x, i) => els.tracker.appendChild(line(x, i)));
    if (cv && z && !z.camp) els.tracker.append(...trackerContracts(v, ctx));
    lines.slice(nNode).forEach((x, i) => els.tracker.appendChild(line(x, i + nNode)));
  }

  function log(text, cls = 'lg-hit') {
    const el = h('div.' + cls, text);
    els.logLines.appendChild(el);
    while (els.logLines.children.length > 120) els.logLines.firstChild.remove();
    els.logLines.scrollTop = els.logLines.scrollHeight;
  }
  function clearLog() { clear(els.logLines); }
  settings.on('change', (k) => { if (k === 'showLog') els.log.style.display = settings.get('showLog') ? '' : 'none'; });
  if (!settings.get('showLog')) els.log.style.display = 'none';

  /** Show the queued next action (key: 'attack', 'spellN', 'itemN', 'pass', 'flee'; null clears it). */
  function setQueued(key, label = '') {
    const btn = (k) => (k === 'attack' ? els.basic : k === 'pass' ? els.pass : k === 'flee' ? els.flee : /^spell\d$/.test(k) ? els.spells[Number(k.slice(5))] : /^item\d$/.test(k) ? els.items[Number(k.slice(4))] : null);
    for (const b of [els.basic, els.pass, els.flee, ...els.spells, ...els.items]) b.classList.remove('queued');
    els.qtag.classList.toggle('hidden', !key);
    if (!key) return;
    const b = btn(key); if (b) b.classList.add('queued');
    els.qtag.textContent = `Next: ${label}`;
  }

  return { update, placeNameplates, log, clearLog, els, setQueued, heat, flashSlot(i) { const b = els.spells[i] || els.items[i - 7]; if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 120); } } };
}

/** Tooltip of the resurrect badge (rules 9, M2 v3). */
export function resurrectTip(v) {
  const rt = resurrectText(v.player, !!(v.combat && v.combat.isBoss && !v.combat.over));
  return h('div', h('div.tt-name', 'Resurrect charges'), h('div.tt-line', rt.list), rt.note ? h('div.tt-warn', rt.note) : null,
    h('div.tt-sub', 'When you die, the first charge returns you to the fight at once.'));
}

// ------------------------------------------------------------------ minimap
function drawMinimap(cv, v, th) {
  const c = cv.getContext('2d'); const S = cv.width; const z = v.zone;
  const g = c.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, th.ground); g.addColorStop(1, th.near);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  // painterly speckle
  for (let i = 0; i < 160; i++) { const x = (i * 97) % S; const y = (i * 61 + i * i) % S; c.fillStyle = rgba(i % 2 ? th.mid : th.path, 0.25); c.beginPath(); c.arc(x, y, 3 + (i % 5), 0, Math.PI * 2); c.fill(); }
  if (!z || !z.rows || !z.rows.length) {
    c.fillStyle = rgba(th.accent, 0.8); c.beginPath(); c.arc(S / 2, S / 2, 14, 0, Math.PI * 2); c.fill();
    return;
  }
  const ROWS = z.rows.length; const LANES = z.rows[0].length; // as the engine's map has them
  const row = z.pos.row; const lane = z.pos.lane == null ? (LANES - 1) / 2 : z.pos.lane;
  const cy = S * 0.62; const dy = 54; const dx = 64;
  const pos = (r, l) => [S / 2 + (l - lane) * dx, cy - (r - row) * dy];
  c.lineWidth = 6; c.lineCap = 'round';
  for (let r = Math.max(0, row - 1); r < Math.min(ROWS, row + 3); r++) {
    for (let l = 0; l < LANES; l++) {
      if (r === 0 && l !== lane && row !== 0) continue;
      for (const nl of [l - 1, l, l + 1]) {
        if (nl < 0 || nl >= LANES) continue;
        const a = r === 0 ? [S / 2, cy + row * dy] : pos(r, l); const b = pos(r + 1, nl);
        c.strokeStyle = rgba(th.path, 0.85); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
    }
  }
  for (let r = Math.max(1, row - 1); r <= Math.min(ROWS, row + 3); r++) {
    for (let l = 0; l < LANES; l++) {
      const n = z.rows[r - 1][l]; const [x, y] = pos(r, l);
      const col = { quest: '#ffd84a', grind: '#c8c8c8', elite: '#ff5a4a', dungeon: '#b07aff', rest: '#ff9a3a', vendor: '#e0b070', trainer: '#9a8aff', treasure: '#ffe08a', shrine: '#7fe0a0' }[n.type] || '#fff';
      c.fillStyle = n.visited ? 'rgba(40,30,20,0.85)' : col; c.strokeStyle = '#1a120a'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  }
  // player arrow
  const [px, py] = row === 0 ? [S / 2, cy] : pos(row, lane);
  c.save(); c.translate(px, py); c.fillStyle = '#ffe9a0'; c.strokeStyle = '#3a2400'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, -16); c.lineTo(11, 12); c.lineTo(0, 6); c.lineTo(-11, 12); c.closePath(); c.fill(); c.stroke(); c.restore();
  // rim shading
  const rim = c.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S * 0.5);
  rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = rim; c.fillRect(0, 0, S, S);
}

// ------------------------------------------------------------------ drag and drop (bar editing)
let drag = null;
export function dragSource(el, ctx, get) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const d = get(); if (!d) return;
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev) => {
      if (!drag && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
        drag = { data: d, ghost: h('img.dragghost', { src: d.icon, alt: '' }) };
        document.body.appendChild(drag.ghost);
        ctx.ui.dragging = true;
      }
      if (drag) { drag.ghost.style.left = `${ev.clientX - 25}px`; drag.ghost.style.top = `${ev.clientY - 25}px`; }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (drag) {
        drag.ghost.remove();
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        const zone = target && target.closest('[data-drop]');
        if (zone && zone._onDrop) zone._onDrop(drag.data);
        else if (drag.data.kind === 'spell' && drag.data.fromSlot != null) { /* dropped outside: no change */ }
        drag = null;
        setTimeout(() => { ctx.ui.dragging = false; }, 0);
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
}
export function dropTarget(el, ctx, onDrop) {
  el.dataset.drop = '1';
  el._onDrop = onDrop;
  el.addEventListener('pointerenter', () => { if (drag) el.classList.add('drop'); });
  el.addEventListener('pointerleave', () => el.classList.remove('drop'));
  el.addEventListener('pointerup', () => el.classList.remove('drop'));
}
export { NODE_COLORS, nodeIcon };
