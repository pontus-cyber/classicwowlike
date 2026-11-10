// Persistent classic-MMO HUD: unit frames, enemy nameplates with intents, action bar, XP bar,
// minimap, micro menu, objective tracker, combat log and the raid-boss frame. It renders the view
// it is given and turns clicks into actions through ctx.act; it decides no rules.
import { h, add, clear, fmtNum, moneyEl, hoursText, clamp, rgba } from './util.js';
import { spellIcon, basicIcon, consumableIcon, statusIcon, abilityIcon, icon, nodeIcon, NODE_COLORS } from './art-icons.js';
import { drawPortrait, HERO_LOOKS, PET_LOOKS, enemyLook, beastLook } from './art-actors.js';
import { THEMES } from './art-world.js';
import { tip, spellTip, basicTip, itemTip, statusTip } from './tooltip.js';
import { settings } from './settings.js';
import { linkedText, resurrectText, dangerRule } from './ui-text.js';

const RES_NAME = { energy: 'Energy', mana: 'Mana', focus: 'Focus' };
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

function bar(cls) {
  const el = h('div.bar.' + cls.split(' ').join('.'), h('div.ghost'), h('div.fill'), h('div.ward'), h('div.txt'));
  return el;
}
function setBar(el, cur, max, text, wardVal = 0) {
  const f = max > 0 ? clamp(cur / max, 0, 1) : 0;
  const fill = el.querySelector('.fill'); const ghost = el.querySelector('.ghost'); const ward = el.querySelector('.ward');
  fill.style.transform = `scaleX(${f})`;
  if (ghost) {
    const prev = Number(ghost.dataset.f || 1);
    if (f < prev) { ghost.style.transition = 'transform .9s .25s ease-in'; } else ghost.style.transition = 'none';
    ghost.style.transform = `scaleX(${f})`; ghost.dataset.f = f;
  }
  if (ward) { const w = max > 0 ? clamp(wardVal / max, 0, 1 - f) : 0; ward.style.left = `${f * 100}%`; ward.style.width = `${w * 100}%`; }
  el.querySelector('.txt').textContent = text;
  el.classList.toggle('low', el.classList.contains('hp') && f < 0.3);
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
    h('div.plate', h('div.name', h('span.pn'), h('span.cls')), bar('hp'), bar('res mana'), h('div.cp.hidden', Array.from({ length: ctx.data.rules.cpMax }, () => h('i'))), h('div.strow', h('div.statuses'), els.resc)));
  els.pet = h('div#pet-frame.uf.hidden', h('div.portrait'), h('div.plate', h('div.name', h('span.pn'), h('span.cls', 'Pet')), bar('hp'), h('div.statuses')));
  els.target = h('div#target-frame.uf.hidden', h('div.portrait'), h('div.lvl', { style: { left: '5.4rem', top: '5.4rem' } }),
    h('div.plate', h('div.name', h('span.pn'), h('span.tag')), bar('hp enemy'), h('div.statuses'), h('div.intent')));
  els.bossWarn = h('div.bwarn.hidden');
  els.boss = h('div#boss-frame.panel.hidden', h('div.bname'), h('div', { style: { position: 'relative' } }, bar('hp boss'), h('div.mark', { style: { left: '70%' } }), h('div.mark', { style: { left: '40%' } })), h('div.binfo'), els.bossWarn);
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
  els.actionbar.append(
    h('div.grp', els.basic), h('div.sep'), h('div.grp', els.spells), h('div.sep'), h('div.grp', els.items),
    h('div.ctrl.panel', els.auto, els.pass, els.flee), els.qtag);
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
      return spellTip(id, ctx, { reason: L && !L.ok && ctx.view.combat && !ctx.view.combat.over ? L.reason : null, hint: ctx.view.legal.outOfCombat ? 'Right-click to clear · drag to reorder' : `Key: ${i + 1}` });
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
      return itemTip(it, ctx, { hint: L && !L.ok ? L.reason : 'Right-click to clear' });
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
    // v.par: the run's par from the engine's bossPar (the Oath of Haste included)
    return h('div', h('div.tt-name', v.zone.name), h('div.tt-sub', `Levels ${v.zone.band[0]}–${v.zone.band[1]}`), h('div.tt-line', `In-game time: ${v.hours} h`), h('div.tt-line.desc', `The boss grows stronger for every ${R.ascStepHours} h past ${v.par} h (Ascendancy).`),
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
    const inGame = !!p && v.phase !== 'CREATE';
    for (const el of [els.player, els.actionbar, els.xp, els.minimap, els.micro, els.log, els.tracker, els.gold]) el.classList.toggle('hidden', !inGame || v.phase === 'SUMMARY');
    const panelUp = v.phase === 'ZONE_HUB' || v.phase === 'CAMP' || v.phase === 'MAP' || !!v.loot || (v.node && v.node.step !== 'combat' && !(v.combat && !v.combat.over));
    els.tracker.classList.toggle('dimmed', !!(inGame && panelUp));
    if (!inGame) { els.pet.classList.add('hidden'); els.target.classList.add('hidden'); els.boss.classList.add('hidden'); syncNameplates(v); return; }
    const th = THEMES[(v.zone && v.zone.theme) || 'farmland'];
    // player
    const pf = els.player;
    if (pf.dataset.cls !== p.classId) { pf.dataset.cls = p.classId; clear(pf.querySelector('.portrait')).appendChild(heroPortrait(p.classId)); }
    pf.querySelector('.pn').textContent = p.name;
    pf.querySelector('.cls').textContent = p.className;
    pf.querySelector('.lvl').textContent = p.level;
    const ward = (p.statuses || []).find((s) => s.id === 'WARD');
    setBar(pf.querySelector('.bar.hp'), p.hp, p.maxHp, `${fmtNum(p.hp)} / ${fmtNum(p.maxHp)}`, ward ? ward.value : 0);
    const rb = pf.querySelector('.bar.res');
    rb.className = 'bar res ' + p.res.kind;
    setBar(rb, p.res.cur, p.res.max, `${fmtNum(p.res.cur)} / ${fmtNum(p.res.max)}`);
    const cp = pf.querySelector('.cp');
    cp.classList.toggle('hidden', p.classId !== 'rogue');
    [...cp.children].forEach((c, i) => c.classList.toggle('on', i < (p.cp || 0)));
    statusRow(pf.querySelector('.statuses'), p.statuses, ctx);
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
      setBar(els.pet.querySelector('.bar.hp'), p.pet.alive ? p.pet.hp : 0, p.pet.maxHp, p.pet.alive ? `${fmtNum(p.pet.hp)} / ${fmtNum(p.pet.maxHp)}` : 'Dead');
      els.pet.style.opacity = p.pet.alive ? 1 : 0.55;
      statusRow(els.pet.querySelector('.statuses'), p.pet.statuses, ctx);
    } else els.pet.classList.add('hidden');
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
      const tag = els.target.querySelector('.tag'); clear(tag);
      if (tgt.rank === 'elite' || tgt.rank === 'dboss') tag.appendChild(h('span.rank-tag', tgt.rank === 'dboss' ? 'Boss' : 'Elite'));
      if (tgt.rank === 'rare') tag.appendChild(h('span.rank-tag.rare', 'Rare'));
      const lv = els.target.querySelector('.lvl'); lv.textContent = tgt.level; lv.style.color = conColor(tgt.level, p.level);
      const tw = (tgt.statuses || []).find((s) => s.id === 'WARD');
      setBar(els.target.querySelector('.bar.hp'), tgt.hp, tgt.maxHp, `${fmtNum(tgt.hp)} / ${fmtNum(tgt.maxHp)}  ·  ${Math.ceil((tgt.hp / tgt.maxHp) * 100)} %`, tw ? tw.value : 0);
      statusRow(els.target.querySelector('.statuses'), tgt.statuses, ctx);
      renderIntent(els.target.querySelector('.intent'), tgt.intent, v, true);
    } else els.target.classList.add('hidden');
    const boss = c && c.isBoss ? c.enemies.find((e) => e.rank === 'boss') : null;
    if (boss) {
      els.boss.classList.remove('hidden');
      els.boss.querySelector('.bname').textContent = boss.name;
      setBar(els.boss.querySelector('.bar.hp'), boss.hp, boss.maxHp, `${fmtNum(boss.hp)} / ${fmtNum(boss.maxHp)}  ·  ${Math.ceil((boss.hp / boss.maxHp) * 100)} %`);
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
      const ht = hoursText(v.hours || 0);
      els.minimap.querySelector('.clock').textContent = `${ht.label} · ${v.hours} h`;
      drawMinimap(els.mmCanvas, v, th);
    }
    // talents badge
    let badge = els.mmTalents.querySelector('.badge');
    if (p.talentPoints > 0) { if (!badge) { badge = h('span.badge'); els.mmTalents.appendChild(badge); } badge.textContent = p.talentPoints; } else if (badge) badge.remove();
    clear(els.gold).appendChild(moneyEl(p.gold));
    updateTracker(v);
  }

  function renderIntent(box, it, v, detailed) {
    const key = it ? `${it.id}|${it.name}|${it.est}|${it.target}|${it.interrupted}|${it.label}|${it.channel}` : 'none';
    if (box.dataset.key === key) return;
    box.dataset.key = key; clear(box);
    if (!it) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const who = it.target === 'pet' ? 'your pet' : it.target === 'both' ? 'you and your pet' : it.target === 'player' ? 'you' : it.target === 'self' ? 'itself' : it.target === 'ally' ? 'an ally' : '';
    add(box, h('img', { src: abilityIcon(it), alt: '' }),
      h('div', h('div.what', it.name, it.channel ? ` ${it.channel[0]}/${it.channel[1]}` : ''), h('div.who', it.label || (who ? `Targets ${who}` : it.id === 'unaware' ? 'Has not noticed you' : '')),
        h('div.row', { style: { gap: '.4rem', marginTop: '.2rem' } }, it.cast && !it.interrupted ? h('span.flag.cast', 'Cast · interruptible') : null, it.heavy ? h('span.flag.heavy', 'Heavy') : null, it.interrupted ? h('span.flag.int', 'Interrupted') : null)),
      it.est ? h('div.dmg', it.selfHeal || it.mend ? `+${fmtNum(it.est)}` : `≈ ${fmtNum(it.est)}`) : null);
    if (it.next) box.appendChild(h('div.flag.heavy', it.next));
  }

  function syncNameplates(v) {
    const c = v.combat;
    const live = new Set();
    if (c && v.player) {
      for (const e of c.enemies) {
        if (e.hidden) continue;
        const id = e.uid || e.idx; live.add(String(id));
        let el = npEls.get(String(id));
        if (!el) {
          el = h('div.np', h('div.bubble'), h('div.castbar.hidden', h('i')), h('div.nm', h('span.lv'), h('span.n')), bar('hp enemy'), h('div.sts'));
          el.addEventListener('click', (ev) => { ev.stopPropagation(); ctx.ui.setTarget(e.idx); });
          el.addEventListener('pointerenter', () => { ctx.scene.hover = `enemy:${e.idx}`; });
          el.addEventListener('pointerleave', () => { ctx.scene.hover = null; });
          tip(el.querySelector('.bubble'), () => intentTip(e, ctx));
          els.nameplates.appendChild(el); npEls.set(String(id), el);
        }
        el.dataset.idx = e.idx;
        el.classList.toggle('dead', !e.alive);
        el.classList.toggle('sel', ctx.ui.target === e.idx);
        el.classList.toggle('boss', e.rank === 'boss');
        el.classList.toggle('shard', e.rank === 'shard' || e.arch === 'shard');
        const lv = el.querySelector('.lv'); lv.textContent = e.rank === 'boss' ? '??' : e.level; lv.style.color = conColor(e.level, v.player.level);
        el.querySelector('.n').textContent = e.name + (e.rank === 'elite' ? ' (Elite)' : e.rank === 'rare' ? ' (Rare)' : '');
        setBar(el.querySelector('.bar'), e.hp, e.maxHp, `${Math.ceil((e.hp / e.maxHp) * 100)} %`, ((e.statuses || []).find((s) => s.id === 'WARD') || {}).value || 0);
        statusRow(el.querySelector('.sts'), e.statuses, ctx);
        const it = e.intent; const bub = el.querySelector('.bubble');
        const showIntent = it && e.alive && !c.over;
        bub.classList.toggle('hidden', !showIntent);
        if (showIntent) {
          const k = `${it.id}|${it.est}|${it.target}|${it.interrupted}|${it.channel}`;
          if (bub.dataset.key !== k) {
            bub.dataset.key = k; clear(bub);
            const tgtTxt = it.target === 'pet' ? '▸ pet' : it.target === 'both' ? '▸ all' : it.target === 'player' ? '▸ you' : '';
            add(bub, h('img', { src: abilityIcon(it), alt: '' }), h('span.bn', it.name + (it.channel ? ` ${it.channel[0]}/${it.channel[1]}` : '')),
              it.est && !(it.selfHeal || it.mend || it.shield) ? h('span.bd', fmtNum(it.est)) : null, tgtTxt ? h('span.bt', tgtTxt) : null);
          }
          bub.className = 'bubble' + (it.cast && !it.interrupted ? ' cast' : '') + (it.heavy && !it.cast ? ' heavy' : '') + (it.id === 'unaware' || it.id === 'none' ? ' quiet' : '') + (it.interrupted ? ' interrupted' : '');
        }
        const cb = el.querySelector('.castbar');
        cb.classList.toggle('hidden', !(showIntent && it.cast && !it.interrupted));
        if (showIntent && it.cast) cb.querySelector('i').style.transform = `scaleX(${it.channel ? it.channel[0] / it.channel[1] : 0.5})`;
      }
    }
    for (const [id, el] of npEls) if (!live.has(id)) { el.remove(); npEls.delete(id); }
  }

  /** Called every frame: keep nameplates over their actors. */
  function placeNameplates() {
    for (const el of npEls.values()) {
      const an = ctx.scene.anchor(`enemy:${el.dataset.idx}`);
      if (!an || !an.visible) { el.style.opacity = 0; continue; }
      el.style.opacity = '';
      el.style.left = `${an.x}px`;
      el.style.top = `${an.top - 4}px`;
    }
  }

  function updateBar(v) {
    const p = v.player; const L = v.legal || {};
    const c = v.combat; const fight = c && !c.over && !ctx.ui.playing;
    els.basic.querySelector('img').src = basicIcon(p.classId);
    els.basic.classList.toggle('off', !fight);
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
      if (s && s.cd) { cd.style.background = `conic-gradient(rgba(0,0,0,.74) ${clamp(s.cd / ctx.data.rules.potionCd, 0, 1) * 360}deg, rgba(0,0,0,.18) 0)`; cd.textContent = s.cd; } else { cd.style.background = ''; cd.textContent = ''; }
    });
    els.auto.classList.toggle('on', !!v.autoplay);
    els.auto.setAttribute('aria-checked', v.autoplay ? 'true' : 'false');
    els.pass.disabled = !fight; els.flee.disabled = !fight || !L.flee;
    els.flee.firstChild.textContent = ctx.ui.fleeArmed ? 'Confirm?' : 'Flee';
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
    } else if (z) { lines.push(['h', z.name]); lines.push(['l', `Boss par: ${v.par} h · now ${v.hours} h`]); }
    const key = JSON.stringify(lines);
    if (els.tracker.dataset.key === key) return;
    els.tracker.dataset.key = key; clear(els.tracker);
    for (const [k, t] of lines) els.tracker.appendChild(h(k === 'h' ? 'div.tk-h' : 'div.tk-l' + (k === 'd' ? '.done' : ''), t));
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

  return { update, placeNameplates, log, clearLog, els, setQueued, flashSlot(i) { const b = els.spells[i] || els.items[i - 7]; if (b) { b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 120); } } };
}

/** Tooltip of the resurrect badge (rules 9, M2 v3). */
export function resurrectTip(v) {
  const rt = resurrectText(v.player, !!(v.combat && v.combat.isBoss && !v.combat.over));
  return h('div', h('div.tt-name', 'Resurrect charges'), h('div.tt-line', rt.list), rt.note ? h('div.tt-warn', rt.note) : null,
    h('div.tt-sub', 'When you die, the first charge returns you to the fight at once.'));
}

function intentTip(e, ctx) {
  const it = e.intent; if (!it) return null;
  const who = it.target === 'pet' ? 'your pet' : it.target === 'both' ? 'you and your pet' : it.target === 'player' ? 'you' : it.target;
  return h('div', h('div.tt-name', `${e.name}: ${it.name}`), it.label ? h('div.tt-line', it.label) : null,
    it.est && !(it.selfHeal || it.mend || it.shield) ? h('div.tt-line.num', `Estimated damage to ${who}: about ${fmtNum(it.est)}`) : null,
    it.cast && !it.interrupted ? h('div.tt-hint', 'A cast: interrupt it, or stun / freeze / hex the caster, to cancel it.') : null,
    it.heavy ? h('div.tt-warn', 'Heavy: a telegraphed big hit. Shield up, stun it, or heal after.') : null,
    it.next ? h('div.tt-warn', it.next) : null, h('div.tt-sub', 'Click to target'));
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
