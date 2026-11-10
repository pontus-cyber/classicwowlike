// heat.js - the Heat meter and the texts that name heat (docs/specs/expedition.md H.4, H.5; engine-api.md 11; owner
// feedback 2026-11-10 14:05: an always-visible meter, like FTL's chasing red line). Presentation only: the state, the
// line, the heat, the projected boss Ascendancy, the Dimming's clock and every preview come from R.heatView and
// R.heatPreview through the bridge (view.heat, bridge.heatPreview); the thresholds and rewards the texts name come from
// the engine's constants (data.rules.heat). Nothing here computes a state, a line or a reward.
//
//   createHeatMeter(root, ctx)  the HUD meter, on every screen of a run but the summary: the four states (Clear, Warm,
//                               Hot, Scorched) as segments of one bar over HEAT_BAR_MIN..HEAT_BAR_MAX hours past the
//                               line, the Star's line (red) at heat 0, the player's marker (bar.marker, an arrow when
//                               bar.beyond), in an expedition zone the Dimming's marker, a ghost marker for the hovered
//                               choice, the numbers ("12 h in hand" / "8 h past the line", "Boss +4 %"), what the state
//                               or the node the player is in pays, a first-time note; noteStep: a toast on every change of
//                               state, after the step that made it has played.
//   heatKey(action)             the key of an hour-costing engine action in view.heat.next
//   heatTip(ctx), previewBlock  tooltip contents: the meter's explanation; "2 h · ends Warm" for a choice (map nodes,
//                               services, Grind waves, Travel on, expedition moves)
//   buildHeatSummary(sum, ctx)  the run summary's heat card: the hours-vs-line track per zone, hours by state, over par
//
// Colours (state = a fixed four-step scale, always named on the bar): Clear blue, Warm gold, Hot orange, Scorched crimson.
// Checked with the dataviz palette validator on the panel surface #17120c: adjacent CVD ΔE >= 14 (deutan), normal-vision
// ΔE >= 17, contrast >= 3:1; its categorical lightness band is not met on purpose (Warm -> Hot -> Scorched step down in
// lightness so the order survives colour blindness).
//
// The Dimming's marker (H.5) sits in the segment of its own state (stateDim, from the engine): left of the line one hour
// of the clock is one hour of the bar (the hours before the Dimming turns Warm), inside Warm and Hot the clock's
// HEAT_DIM thresholds are spread over the segment, and a Dimmed node sits in Scorched. Only the place inside the segment
// is drawn here; the state is the engine's.
import { h, clear, clamp } from './util.js';
import { tip } from './tooltip.js';

export const HEAT_NAME = { clear: 'Clear', warm: 'Warm', hot: 'Hot', scorched: 'Scorched' };
export const HEAT_COLOR = { clear: '#3f9bd6', warm: '#f0c75a', hot: '#ec7a2c', scorched: '#b8263f' };
const INTRO_KEY = 'tbwcr.heatIntro.v1'; // the first-time note was shown (localStorage)
const STATES = ['clear', 'warm', 'hot', 'scorched'];

/** Key of an hour-costing engine action in view.heat.next (the bridge keys heatView.next with it). */
export function heatKey(a) {
  if (!a) return '';
  switch (a.type) {
    case 'CHOOSE_NODE': return `CHOOSE_NODE:${a.lane}`;
    case 'SERVICE': return `SERVICE:${a.service}`;
    case 'GRIND_SET_WAVES': return `GRIND_SET_WAVES:${a.n}`;
    case 'MOVE': return `MOVE:${a.nodeId}`;
    case 'PASS_THROUGH': return `PASS_THROUGH:${a.nodeId}`;
    default: return a.type;
  }
}

/** Hours with at most one decimal (the line under the Oath of Haste is not whole): 12, 16.7. */
export const fmtH = (x) => String(Math.round(Math.abs(x) * 10) / 10);
/** Where the player stands against the line: "12 h in hand", "8 h past the line", "On the line". */
export function standText(x) {
  if (x.heat > 0) return `${fmtH(x.heat)} h past the line`;
  if (x.heat < 0) return `${fmtH(x.heat)} h in hand`;
  return 'On the line';
}
export const bossText = (asc) => `Boss +${Math.round((asc || 0) * 100)} %`;
/** A chance as "1 in 4" or "2 in 5" (the smallest denominator up to 10), else in per cent. */
export function chanceText(p) {
  for (let d = 2; d <= 10; d++) { const n = p * d; if (Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) >= 1) return `${Math.round(n)} in ${d}`; }
  return `${Math.round(p * 100)} %`;
}
/** What a state pays (rules 1.7.3, the engine's HEAT_GAIN and HEAT_RARITY_UP): "+35 % XP and gold, 1 in 4 drops a rarity up". */
export function payText(state, H, short = false) {
  if (!H || !state) return null;
  const g = H.gain[state] || 0; const u = H.rarityUp[state] || 0;
  if (!g && !u) return null;
  const parts = [];
  if (g) parts.push(`+${Math.round(g * 100)} % XP and gold`);
  if (u) parts.push(short ? `${chanceText(u)} drops up` : `${chanceText(u)} drops a rarity up`);
  return parts.join(short ? ' · ' : ', ');
}
/** The hottest state that pays nothing less than Hot (the first one with a reward): the "Hot pays" hint in Clear and Warm. */
function firstPaying(H) { return STATES.find((s) => (H.gain[s] || 0) > 0 || (H.rarityUp[s] || 0) > 0) || null; }
/**
 * Toast and log text when the meter's state changes (H.4 "Hot: the Unlit Star gains on you; spoils grow"); at the camp
 * (camp true) heat pays no spoils (H.3), so the text names only the cost.
 */
export function heatToast(hv, camp = false) {
  const dim = hv.by === 'dim';
  switch (hv.state) {
    case 'clear': return 'Clear: you are ahead of the Star\'s line';
    case 'warm': return dim ? 'Warm: the Dimming draws near' : 'Warm: the Star\'s line has caught you';
    case 'hot': return dim ? 'Hot: the Dimming closes in; spoils grow' : camp ? 'Hot: the Unlit Star gains on you' : 'Hot: the Unlit Star gains on you; spoils grow';
    case 'scorched': return dim ? 'Scorched: you stand in the Dimming' : camp ? 'Scorched: the Star burns close' : 'Scorched: the Star burns close; spoils are richest';
    default: return HEAT_NAME[hv.state] || '';
  }
}

/** Per cent across the bar of a value in hours past the line. */
const pctOf = (x, bar) => (100 * (clamp(x, bar.min, bar.max) - bar.min)) / Math.max(1e-9, bar.max - bar.min);
/** The four segments over the bar: [state, from, to] in hours past the line (HEAT_WARM_AT, HEAT_HOT_AT, HEAT_SCORCH_AT). */
function segments(H, bar) {
  return [['clear', bar.min, H.warmAt], ['warm', H.warmAt, H.hotAt], ['hot', H.hotAt, H.scorchAt], ['scorched', H.scorchAt, bar.max]];
}
/** Where the Dimming's marker sits on the bar (see the header): inside the segment of its state, the engine's stateDim. */
export function dimBarPos(dimIn, stateDim, H, bar) {
  const seg = segments(H, bar).find((x) => x[0] === stateDim);
  if (!seg) return null;
  const [, a, b] = seg; const pad = Math.min(0.8, (b - a) / 4);
  let x;
  if (stateDim === 'clear') x = H.warmAt - (dimIn - H.dimWarm);
  else if (stateDim === 'warm') x = a + ((H.dimWarm - dimIn) / Math.max(1e-9, H.dimWarm - H.dimHot)) * (b - a);
  else if (stateDim === 'hot') x = a + ((H.dimHot - dimIn) / Math.max(1e-9, H.dimHot)) * (b - a);
  else x = (a + b) / 2;
  return { x: clamp(x, a + pad, b - pad), beyond: stateDim === 'clear' && H.warmAt - (dimIn - H.dimWarm) < bar.min ? -1 : 0 };
}

// ------------------------------------------------------------------ the meter
/** host: where the meter lives (the action bar); noteRoot: where the first-time note goes (the HUD). */
export function createHeatMeter(host, ctx, noteRoot = host) {
  const H = ctx.data.rules && ctx.data.rules.heat;
  const els = {};
  els.state = h('span.ht-state', h('i.ht-dot'), h('b.ht-sname'), h('span.ht-by'));
  els.num = h('span.ht-num');
  els.boss = h('span.ht-boss');
  els.pay = h('span.ht-pay');
  els.dimTxt = h('span.ht-dim.hidden', h('i.ht-dia'), h('span'));
  els.segs = {};
  els.bar = h('div.ht-bar');
  els.line = h('div.ht-line', { 'aria-hidden': 'true' });
  els.span = h('div.ht-span.hidden'); // the hours a hovered choice spends: from the marker to the ghost
  els.ghost = h('div.ht-mark.ghost.hidden', h('i'));
  els.mark = h('div.ht-mark.run', h('i'), h('b.ht-arrow.hidden'));
  els.dmark = h('div.ht-mark.dim.hidden', h('i'));
  els.el = h('div#heat.panel.hidden', { role: 'group', 'aria-label': 'Heat' },
    h('div.ht-row', h('span.ht-title', 'Heat'), els.state, els.num, els.boss, els.dimTxt), els.bar, h('div.ht-row2', els.pay));
  host.appendChild(els.el);
  tip(els.el, () => heatTip(ctx));
  // the first-time note (H.4 wording: "Heat", "the Star's line"), once per browser profile, on the first hub until
  // "Got it" or setting out
  els.introBtn = h('button.btn.small', { type: 'button' }, 'Got it');
  els.intro = h('div#heat-intro.hidden', { role: 'note', 'aria-label': 'About heat' }, h('div.hi-t', 'Heat'), h('div.hi-b'), h('div.hi-f', els.introBtn));
  noteRoot.appendChild(els.intro);
  let introSeen = (() => { try { return !!localStorage.getItem(INTRO_KEY); } catch { return false; } })();
  const closeIntro = () => { introSeen = true; els.intro.classList.add('hidden'); try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage blocked */ } };
  els.introBtn.addEventListener('click', closeIntro);

  let built = false;
  let ghost = null; // the hovered choice's preview (engine-api.md 11.2), or null
  let ghostAt = null; // the phase and hours it was hovered at: a step clears it (the hovered element may be gone)

  function build() {
    if (built || !H) return;
    built = true;
    const bar = { min: H.barMin, max: H.barMax };
    for (const [s, a, b] of segments(H, bar)) {
      const seg = h('div.ht-seg', { dataset: { hs: s }, style: { left: `${pctOf(a, bar)}%`, width: `${pctOf(b, bar) - pctOf(a, bar)}%` } }, h('span', HEAT_NAME[s]));
      els.segs[s] = seg; els.bar.appendChild(seg);
    }
    els.line.style.left = `${pctOf(0, bar)}%`;
    els.bar.append(els.line, els.span, els.ghost, els.dmark, els.mark);
  }

  function update(v) {
    const hv = v.heat;
    const show = !!(hv && H && v.player && v.phase !== 'CREATE' && v.phase !== 'SUMMARY');
    els.el.classList.toggle('hidden', !show);
    if (!show) { els.intro.classList.add('hidden'); ghost = null; return; }
    build();
    if (ghost && ghostAt !== `${v.phase}|${hv.hours}|${hv.z}`) { ghost = null; ghostAt = null; }
    const bar = hv.bar;
    els.el.dataset.state = hv.state; els.el.dataset.by = hv.by;
    for (const s of STATES) els.segs[s].classList.toggle('on', s === hv.state);
    els.state.querySelector('.ht-sname').textContent = HEAT_NAME[hv.state];
    els.state.querySelector('.ht-by').textContent = hv.by === 'dim' ? ' · Dimming' : '';
    els.num.textContent = standText(hv);
    els.boss.textContent = bossText(hv.ascIfPar);
    // the player's marker; an arrow when the heat is off the bar (bar.beyond)
    els.mark.style.left = `${pctOf(bar.marker, bar)}%`;
    const arrow = els.mark.querySelector('.ht-arrow');
    arrow.classList.toggle('hidden', !bar.beyond); arrow.textContent = bar.beyond < 0 ? '◀' : bar.beyond > 0 ? '▶' : '';
    els.mark.classList.toggle('beyond', !!bar.beyond);
    els.mark.classList.toggle('sets', hv.by === 'run');
    // the Dimming's clock (expedition zones): its marker in its state's segment and "Dimming 3 h"
    const dp = hv.dimIn !== null && hv.dimIn !== undefined && hv.stateDim ? dimBarPos(hv.dimIn, hv.stateDim, H, bar) : null;
    els.dmark.classList.toggle('hidden', !dp);
    els.dimTxt.classList.toggle('hidden', !dp);
    if (dp) {
      els.dmark.style.left = `${pctOf(dp.x, bar)}%`;
      els.dmark.classList.toggle('sets', hv.by === 'dim');
      els.dimTxt.querySelector('span').textContent = hv.dimIn <= 0 ? 'Dimmed' : `Dimming ${fmtH(hv.dimIn)} h`;
      els.dimTxt.classList.toggle('sets', hv.by === 'dim');
    }
    // what pays now (rules 1.7.3): inside a node its entry state (heatView.node), on the map or the hub what a node entered
    // now pays, in Clear and Warm a quiet hint of what heat pays; at the camp and the boss nothing (expedition.md H.3)
    const atCamp = !!(v.zone && v.zone.camp);
    const inNode = !atCamp && hv.node && (hv.node.gain > 0 || hv.node.rarityUp > 0);
    const pays = atCamp ? null : inNode ? payText(hv.node.state, H, true) : payText(hv.state, H, true);
    const fp = firstPaying(H);
    let payLine = '';
    if (inNode) payLine = `This node pays ${HEAT_NAME[hv.node.state]}: ${pays}`;
    else if (atCamp) payLine = 'At the camp heat pays nothing; it strengthens the boss';
    else if (pays) payLine = `Spoils: ${pays}`;
    else if (fp && !(hv.node)) payLine = `${HEAT_NAME[fp]} pays ${payText(fp, H, true)}`;
    els.pay.classList.toggle('quiet', !inNode && !pays);
    els.pay.classList.toggle('node', !!inNode);
    els.pay.dataset.hs = inNode ? hv.node.state : hv.state;
    drawGhost(hv, payLine);
    els.el.setAttribute('aria-label', `Heat: ${HEAT_NAME[hv.state]}${hv.by === 'dim' ? ' (set by the Dimming)' : ''}, ${standText(hv)}, ${bossText(hv.ascIfPar)}${payLine ? `. ${payLine}` : ''}`);
    // the first-time note: on the hub (hidden while a service window is open), until "Got it" or setting out
    if (!introSeen) {
      const svcOpen = !!(v.node && v.node.origin === 'hub');
      if (v.phase === 'ZONE_HUB' && svcOpen) els.intro.classList.add('hidden');
      else if (v.phase === 'ZONE_HUB') {
        if (els.intro.classList.contains('hidden')) {
          const fpay = fp ? `${HEAT_NAME[fp]} from ${fmtH(fp === 'hot' ? H.hotAt : fp === 'scorched' ? H.scorchAt : H.warmAt)} h past it pays ${payText(fp, H)}.` : '';
          clear(els.intro.querySelector('.hi-b')).append(
            h('p', `Every hour counts against the Star's line (red). Left of it you are in the clear; past it, Oruvath grows stronger before you meet him (${bossText(hv.ascIfPar)} now).`),
            fpay ? h('p', `Running hot pays: ${fpay}`) : null,
            h('p.dim', 'Hover the meter, a node or a service to see the hours and where they leave you.'));
          els.intro.classList.remove('hidden');
        }
      } else if (!els.intro.classList.contains('hidden')) closeIntro();
    }
  }

  /** The ghost marker and the hours a hovered choice spends; the text row shows "→ 2 h · ends Warm" meanwhile. */
  function drawGhost(hv, payLine) {
    const p = ghost; const bar = hv.bar;
    els.ghost.classList.toggle('hidden', !p);
    els.span.classList.toggle('hidden', !p);
    if (p) {
      const gx = clamp(p.heat, bar.min, bar.max);
      els.ghost.style.left = `${pctOf(gx, bar)}%`;
      els.ghost.dataset.hs = p.state;
      const a = pctOf(bar.marker, bar); const b = pctOf(gx, bar);
      els.span.style.left = `${Math.min(a, b)}%`; els.span.style.width = `${Math.abs(b - a)}%`;
      els.span.classList.toggle('back', b < a); // leaving the zone: the line moves ahead, the heat drops
      clear(els.pay).append(h('i.ht-dot', { dataset: { hs: p.state } }), `→ ${fmtH(p.hours)} h${p.perWave ? ' a wave' : ''}${p.dimFight ? ' + Dimmed fight' : ''} · ends ${HEAT_NAME[p.state]}`);
      els.pay.classList.add('pv');
    } else {
      els.pay.classList.remove('pv');
      els.pay.textContent = payLine;
    }
  }

  /**
   * After a step has played (app.js act): a toast, a log line and a flash of the meter when the state changed within the
   * run (prev and next: the bridge's views before and after the step; not at a run's start or end).
   */
  function noteStep(prev, next) {
    const a = prev && prev.heat; const b = next && next.heat;
    if (!a || !b || a.state === b.state || !prev.player || !next.player || prev.seed !== next.seed) return;
    const msg = heatToast(b, !!(next.zone && next.zone.camp));
    ctx.ui.toast(msg, `heat-${b.state}`);
    if (ctx.hud) ctx.hud.log(`${msg}.`, b.state === 'clear' ? 'lg-sys' : 'lg-warn');
    els.el.classList.remove('flash'); void els.el.offsetWidth; els.el.classList.add('flash');
  }

  /** Show a hovered choice's preview on the bar (p: heatView.next entry or R.heatPreview), or clear it (null). */
  function setGhost(p) {
    const v = ctx.view;
    ghost = p && v && v.heat ? p : null;
    ghostAt = ghost ? `${v.phase}|${v.heat.hours}|${v.heat.z}` : null;
    if (v) update(v);
  }

  return { el: els.el, update, setGhost, noteStep, get ghost() { return ghost; }, introEl: els.intro };
}

// ------------------------------------------------------------------ tooltips
/** The meter's tooltip: where the player stands, what the boss gets, the four states and what they pay, the Dimming. */
export function heatTip(ctx) {
  const hv = ctx.view && ctx.view.heat; const H = ctx.data.rules.heat;
  if (!hv || !H) return null;
  const box = h('div.tt-heatbox');
  box.appendChild(h('div.tt-name', 'Heat'));
  box.appendChild(h('div.tt-line', `${standText(hv)}: ${fmtH(hv.hours)} h on the clock, the Star's line at ${fmtH(hv.line)} h.`));
  box.appendChild(h('div.tt-line.desc', `${bossText(hv.ascIfPar)} if you keep the line from here. The line reaches the par (${fmtH(hv.par)} h) at the camp; for every ${H.ascStepHours} h past the par Oruvath gains +${Math.round(H.ascPerStep * 100)} % health and damage (Ascendancy, at most +${Math.round(H.ascCap * 100)} %).`));
  const rows = [
    ['clear', 'ahead of the line'], ['warm', `${fmtH(H.warmAt)} to ${fmtH(H.hotAt)} h past`], ['hot', `${fmtH(H.hotAt)} to ${fmtH(H.scorchAt)} h past`], ['scorched', `${fmtH(H.scorchAt)} h or more past`],
  ];
  box.appendChild(h('div.tt-heatstates', rows.map(([s, when]) => h('div.hs' + (s === hv.state ? '.on' : ''), { dataset: { hs: s } }, h('i.ht-dot', { dataset: { hs: s } }), h('b', HEAT_NAME[s]), h('span.w', when), h('span.p', payText(s, H) || 'no reward')))));
  box.appendChild(h('div.tt-sub', 'A node pays the state you enter it in.'));
  if (hv.node) box.appendChild(h('div.tt-line', { style: { color: HEAT_COLOR[hv.node.state] === HEAT_COLOR.scorched ? '#ff8a96' : HEAT_COLOR[hv.node.state] } }, `This node was entered ${HEAT_NAME[hv.node.state]}: ${payText(hv.node.state, H) || 'no heat reward'}.`));
  if (hv.dimIn !== null && hv.dimIn !== undefined) {
    box.appendChild(h('div.tt-line.dimline', hv.dimIn <= 0 ? 'Dimming: your node is Dimmed (Scorched).' : `Dimming: your node dims in ${fmtH(hv.dimIn)} h (${HEAT_NAME.warm} at ${fmtH(H.dimWarm)} h or less, ${HEAT_NAME.hot} at ${fmtH(H.dimHot)} h or less, ${HEAT_NAME.scorched} once Dimmed).`));
    box.appendChild(h('div.tt-line', `The hotter clock sets the state: now ${hv.by === 'dim' ? `the Dimming (${HEAT_NAME[hv.stateDim]})` : `the line (${HEAT_NAME[hv.stateRun]})`}.`));
  }
  box.appendChild(h('div.tt-hint', 'Hover a node, a service or a wave to see its hours and where they leave you.'));
  return box;
}

/**
 * Tooltip block of an hour-costing choice (engine-api.md 11.2): "Heat  2 h · ends Warm", what a node entered now pays
 * (`pays`), and where the player then stands. p: a heatView.next entry or an R.heatPreview result.
 */
export function previewBlock(p, ctx, opts = {}) {
  const H = ctx.data.rules.heat;
  if (!p || !H) return null;
  const box = h('div.tt-heat', { dataset: { hs: p.state } });
  const hrs = `${fmtH(p.hours)} h${p.perWave ? ' a wave' : ''}`;
  box.appendChild(h('div.th-l', h('span.k', 'Heat'), h('i.ht-dot', { dataset: { hs: p.state } }), `${hrs} · ends `, h('b', { dataset: { hs: p.state } }, HEAT_NAME[p.state]), p.change ? h('span.chg', ' (a new state)') : null));
  if (p.dimFight) box.appendChild(h('div.th-w', 'It ends in the Dimming: a Dimmed encounter follows (its hour included).'));
  if (p.pays) {
    const pt = payText(p.pays, H);
    box.appendChild(h('div.th-p' + (pt ? '.paid' : ''), { dataset: { hs: p.pays } }, `Pays ${HEAT_NAME[p.pays]}: ${pt || 'no heat reward'}`));
  }
  if (opts.leaves) box.appendChild(h('div.th-s', 'The next zone moves the Star\'s line ahead.'));
  box.appendChild(h('div.th-s', `Then ${standText(p).replace(/^On the line$/, 'on the line')} · ${bossText(p.ascIfPar)}${p.dimIn !== null && p.dimIn !== undefined && !p.dimFight ? ` · Dimming ${p.dimIn <= 0 ? 'here' : `${fmtH(p.dimIn)} h`}` : ''}`));
  return box;
}

/** A small badge for a node entered Hot or Scorched (its rewards) or an item heat raised; null in Clear and Warm. */
export function heatBadge(state, ctx, kind = 'node') {
  const H = ctx.data.rules.heat;
  if (!H || !state || !(H.gain[state] > 0 || H.rarityUp[state] > 0)) return null;
  const el = h('span.heat-badge', { dataset: { hs: state } }, kind === 'item' ? '▲ Heat' : `${HEAT_NAME[state]} spoils`);
  tip(el, () => h('div', h('div.tt-name', kind === 'item' ? 'Raised by heat' : `Entered ${HEAT_NAME[state]}`),
    h('div.tt-line.desc', kind === 'item' ? `Found in a node entered ${HEAT_NAME[state]}: heat raised this item one rarity.` : `This node pays ${payText(state, H)}.`)));
  return el;
}

// ------------------------------------------------------------------ run summary
/**
 * The summary's heat card (H.4, engine-api.md 11.3): the hours-vs-line track as a chart (per zone the heat on arrival
 * and when left, over the four state bands and the Star's line), the hours spent in each state, and the end against the
 * line or the par. sum: the bridge's summary (sum.heat, sum.hours, sum.par).
 */
export function buildHeatSummary(sum, ctx) {
  const H = ctx.data.rules.heat; const ht = sum.heat;
  if (!H || !ht || !ht.trackPerZone || !ht.trackPerZone.length) return null;
  const zc = ctx.data.rules.zoneCount;
  const recs = ht.trackPerZone.map((r) => ({ ...r, a: r.entry - r.line, b: r.exit - r.line }));
  const last = recs[recs.length - 1];
  const over = sum.hours - sum.par;
  const card = h('div.card.heatcard');
  const endLine = sum.reachedCamp
    ? `${fmtH(sum.hours)} h, par ${fmtH(sum.par)} h: ${over > 0 ? `${fmtH(over)} h over par` : over < 0 ? `${fmtH(over)} h under par` : 'on par'}`
    : `${fmtH(sum.hours)} h, the Star's line at ${fmtH(last.line)} h: ${standText({ heat: last.b })}`;
  // hours by state: a thin bar of the run's hours with the figures beside it, in the card's head next to the end line
  const tot = ht.hoursByState.reduce((a, b) => a + b, 0) || 1;
  const strip = h('div.hc-strip', { role: 'img', 'aria-label': `Hours by state: ${STATES.map((s, i) => `${HEAT_NAME[s]} ${ht.hoursByState[i]} h`).join(', ')}` },
    STATES.map((s, i) => (ht.hoursByState[i] > 0 ? h('i', { dataset: { hs: s }, style: { flexGrow: String(ht.hoursByState[i] / tot) } }) : null)));
  card.appendChild(h('div.hc-head', h('h3', 'Heat'), h('div.hc-hours', strip,
    h('span.hc-leg', STATES.map((s, i) => h('span', h('i.ht-dot', { dataset: { hs: s } }), `${HEAT_NAME[s]} ${fmtH(ht.hoursByState[i])} h`)))), h('span.hc-end', endLine)));
  card.appendChild(heatChart(recs, H, zc));
  const hotNodes = ht.nodesByState[2] + ht.nodesByState[3];
  const hotFights = ht.fightsByState[2] + ht.fightsByState[3];
  card.appendChild(h('div.hc-foot', `Nodes entered: ${STATES.map((s, i) => `${ht.nodesByState[i]} ${HEAT_NAME[s]}`).join(' · ')}. Fights won in heat: ${hotFights}${hotNodes ? '' : ' (no node entered Hot or Scorched)'}. Hover a point for its hours.`));
  return card;
}

/** The hours-vs-line chart (inline SVG): state bands, the Star's line at 0, per zone arrival -> leaving, and the step down
 * at each new zone (the line moves ahead). Hover a point for its numbers; the last value is labelled at its end. */
function heatChart(recs, H, zc) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 880; const HT = 122; const L = 64; const R = 54; const T = 8; const B = 28;
  const vals = recs.flatMap((r) => [r.a, r.b]);
  const lo = Math.min(H.barMin, Math.floor(Math.min(...vals) / 10) * 10); const hi = Math.max(H.barMax, Math.ceil(Math.max(...vals) / 10) * 10);
  const y = (v) => T + ((hi - v) / (hi - lo)) * (HT - T - B);
  const n = recs.length; const colW = (W - L - R) / n;
  const x0 = (i) => L + i * colW + colW * 0.18; const x1 = (i) => L + i * colW + colW * 0.82;
  const el = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); for (const c of kids) if (c) e.appendChild(c); return e; };
  const txt = (x, yy, s, attrs = {}) => { const t = el('text', { x, y: yy, ...attrs }); t.textContent = s; return t; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${HT}`, class: 'hc-chart', role: 'img',
    'aria-label': `Heat per zone, hours past the Star's line on arrival and when left: ${recs.map((r) => `${r.z > zc ? 'camp' : `zone ${r.z}`} ${signed(r.a)} to ${signed(r.b)}`).join('; ')}` });
  // state bands (a wash of each state's colour) and their names at the left
  const bands = [['clear', lo, H.warmAt], ['warm', H.warmAt, H.hotAt], ['hot', H.hotAt, H.scorchAt], ['scorched', H.scorchAt, hi]];
  for (const [s, a, b] of bands) {
    svg.appendChild(el('rect', { x: L, y: y(b), width: W - L - R, height: Math.max(0, y(a) - y(b)), class: `band b-${s}` }));
    svg.appendChild(txt(L - 8, (y(a) + y(b)) / 2 + 4, HEAT_NAME[s], { class: 'bl', 'text-anchor': 'end' }));
  }
  // hairline grid at the band edges, the Star's line (red) at 0
  for (const v of [H.hotAt, H.scorchAt]) svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
  svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), class: 'starline' }));
  svg.appendChild(txt(W - R + 6, y(0) + 4, 'line', { class: 'sl' }));
  // the track: within a zone from arrival to leaving (2 px), the drop to the next zone's arrival (1 px)
  const pts = [];
  recs.forEach((r, i) => {
    if (i > 0) svg.appendChild(el('line', { x1: x1(i - 1), y1: y(recs[i - 1].b), x2: x0(i), y2: y(r.a), class: 'jump' }));
    svg.appendChild(el('line', { x1: x0(i), y1: y(r.a), x2: x1(i), y2: y(r.b), class: 'seg' }));
    pts.push([x0(i), y(r.a), r, 'a'], [x1(i), y(r.b), r, 'b']);
    svg.appendChild(txt(L + i * colW + colW / 2, HT - B + 13, r.z > zc ? 'Camp' : `Zone ${r.z}`, { class: 'xl', 'text-anchor': 'middle' }));
    svg.appendChild(txt(L + i * colW + colW / 2, HT - B + 25, signed(r.b), { class: 'xv', 'text-anchor': 'middle' }));
  });
  // one series: every point in the series colour; the band behind it names the state
  for (const [px, py, r, k] of pts) {
    const v = k === 'a' ? r.a : r.b;
    const g = el('g', { class: 'pt', tabindex: '0' }, el('circle', { cx: px, cy: py, r: 12, class: 'hit' }), el('circle', { cx: px, cy: py, r: 4.5, class: 'dot' }));
    const zoneName = r.z > zc ? 'Camp' : `Zone ${r.z}`;
    tip(g, () => h('div', h('div.tt-name', `${zoneName}, ${k === 'a' ? 'arrival' : 'leaving'}`), h('div.tt-line', `${fmtH(k === 'a' ? r.entry : r.exit)} h on the clock, the Star's line at ${fmtH(r.line)} h`),
      h('div.tt-line', { style: { fontWeight: 700 } }, standText({ heat: v }))));
    svg.appendChild(g);
  }
  const lr = recs[recs.length - 1];
  svg.appendChild(txt(x1(recs.length - 1) + 9, y(lr.b) + 4, signed(lr.b), { class: 'endv' }));
  return h('div.hc-wrap', svg);
}
/** "+8 h" past the line, "−12 h" in hand. */
function signed(v) { return v > 0 ? `+${fmtH(v)} h` : v < 0 ? `−${fmtH(v)} h` : '0 h'; }
