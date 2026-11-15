// heat.js - the Heat meter and the texts that name heat (docs/specs/expedition.md H.4, H.5; engine-api.md 11; owner
// feedback 2026-11-10 14:05: an always-visible meter, like FTL's chasing red line). Presentation only: the state, the
// line, the heat, the projected boss Ascendancy, the Dimming's clock and every preview come from R.heatView and
// R.heatPreview through the bridge (view.heat, bridge.heatPreview); the thresholds and rewards the texts name come from
// the engine's constants (data.rules.heat). Nothing here computes a state, a line or a reward.
// Owner 2026-11-11 10:12 (draft): the meter is named the Furnace (changes-m2b-v7.md table D: Calm, Smouldering, Burning,
// Infernal; whole tolls) and sits at the top centre, calm water on the cool side and embers on the hot side; its name and
// time unit come from ui-text.js HEAT_WORDS (a rename is one edit). The engine counts tolls (M2b v7: heatView.time,
// heatPreview.time, the summary's time and heat.timeByState, all whole numbers); nothing here rounds or converts them.
// D152 (changes-m3-v2.md 4): when the Dimming sets the state (heatView `by` 'dim') the meter reads "Your node dims in N
// tolls" or "You stand in the Dimming" (meterText), and the tolls figure moves to the tooltip's first line (dimTipLine).
//
//   createHeatMeter(root, ctx)  the HUD meter, on every screen of a run but the summary: the four states (Clear, Warm,
//                               Hot, Scorched) as segments of one bar over HEAT_BAR_MIN..HEAT_BAR_MAX tolls past the
//                               line, the Star's line (red) at heat 0, the player's marker (bar.marker, an arrow when
//                               bar.beyond), in an expedition zone the Dimming's marker, a ghost marker for the hovered
//                               choice, the numbers ("12 tolls in hand" / "8 tolls past the line", "Boss +4 %"), what the state
//                               or the node the player is in pays, a first-time note; noteStep: a toast on every change of
//                               state, after the step that made it has played.
//   heatKey(action)             the key of a time-costing engine action in view.heat.next
//   heatTip(ctx), previewBlock  tooltip contents: the meter's explanation; "3 tolls, ends Smouldering" for a choice (map nodes,
//                               services, Grind waves, Travel on, expedition moves)
//   buildHeatSummary(sum, ctx)  the run summary's heat card: the tolls-against-the-line track per zone, tolls by state, over par
//
// D150 (owner 2026-11-14, text pass; docs/feedback/2026-11-14-blind-wording.md items 1, 5, 6, 8, 25): the meter stays hidden
// in a guided first run until its coach line has shown (onboarding.js furnaceIntroduced); its one line reads "Calm · 18 tolls
// to spare" ("Boss +N %" only above 0), with no title, pay line or Dimming text (the map's chips and the Dimming panel keep
// the clock); the tooltip is one sentence and the four states; a choice's tooltip block is "Costs 3 tolls." and a bonus line
// only when the node would pay one; no toast on a change of state (the meter flashes, the log keeps a line). Naming rule: no
// "the Star's line", "par", "Ascendancy", "Pays" or "Spoils" in player text.
//
// Colours (state = a fixed four-step scale, always named on the bar): Clear blue, Warm gold, Hot orange, Scorched crimson.
// Checked with the dataviz palette validator on the panel surface #17120c: adjacent CVD ΔE >= 14 (deutan), normal-vision
// ΔE >= 17, contrast >= 3:1; its categorical lightness band is not met on purpose (Warm -> Hot -> Scorched step down in
// lightness so the order survives colour blindness).
//
// The Dimming's marker (H.5) sits in the segment of its own state (stateDim, from the engine): left of the line one toll
// of the clock is one toll of the bar (the tolls before the Dimming turns Warm), inside Warm and Hot the clock's
// HEAT_DIM thresholds are spread over the segment, and a Dimmed node sits in Scorched. Only the place inside the segment
// is drawn here; the state is the engine's.
import { h, add, clear, clamp } from './util.js';
import { tip } from './tooltip.js';
import { HEAT_WORDS as HW, tolls } from './ui-text.js';
import { HEAT } from './theme.js';

export const HEAT_NAME = HW.state; // Calm, Smouldering, Burning, Infernal (ui-text.js HEAT_WORDS)
export const HEAT_COLOR = HEAT; // the --heat-* tokens of tokens.css (theme.js), read when used
const INTRO_KEY = 'tbwcr.heatIntro.v1'; // the first-time note was shown (localStorage)
const STATES = ['clear', 'warm', 'hot', 'scorched'];

/** Key of a time-costing engine action in view.heat.next (the bridge keys heatView.next with it). */
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

/** A time value in tolls, written as its whole number (the engine's values are whole, M2b v7). */
export const fmtTime = (x) => String(Math.abs(x));
/** The Star's line as shown: the engine's line, whole tolls rounded up per zone (changes-m2b-v7.md A row 2, D70). */
export const lineShown = (line) => line;
/**
 * Where the player stands against this zone's line (the meter's main number; D150): "12 tolls to spare", "No tolls to spare",
 * "8 tolls overspent"; heat is the engine's whole number of tolls past the line.
 */
export function standText(x) {
  if (x.heat > 0) return `${tolls(x.heat)} overspent`;
  if (x.heat < 0) return `${tolls(-x.heat)} to spare`;
  return 'No tolls to spare';
}
/**
 * The meter's line after the state's name (D152, changes-m3-v2.md 4): the tolls against the line (standText) while the run
 * clock sets the state (heatView `by` 'run'); when the Dimming near the player sets it (`by` 'dim'), the Dimming's own
 * words, as on the map: "Your node dims in N tolls", or "You stand in the Dimming" (dimIn 0 or less).
 */
export function meterText(x) {
  if (x.by !== 'dim' || x.dimIn == null) return standText(x);
  // newcomer check 2026-11-15 (s0133: "Burning" with 3 tolls to spare, the reason only on hover): the line says why
  return x.dimIn > 0 ? DIM_NEAR_WORDS : 'You stand in the Dimming';
}
/** Newcomer check 2026-11-15 (draft): the meter's line while the Dimming near the player sets the state. */
export const DIM_NEAR_WORDS = 'The Dimming is near';
/**
 * D152 (changes-m3-v2.md 4, draft): the tooltip's first line while the Dimming sets the state: the player's node's clock
 * (newcomer check 2026-11-15: the meter's line no longer holds it) and the tolls against the line.
 */
export function dimTipLine(x) {
  const n = Math.abs(x.heat || 0);
  const mine = x.dimIn > 0 ? `Your node dims in ${tolls(x.dimIn)}. ` : '';
  return `${mine}Tolls: ${x.heat > 0 ? `${n} overspent` : x.heat < 0 ? `${n} to spare` : 'none to spare'}. The Dimming near you sets the Furnace now.`;
}
/** Newcomer check 2026-11-15 (s0017-s0133, draft): the tooltip's one line on the diamond (the Dimming's marker). */
export const DIM_MARK_LINE = '◆ The Dimming near you. Whichever marker is further right sets the state.';
export const bossText = (asc) => `Boss +${Math.round((asc || 0) * 100)} %`;
/** D150 item 1: "Boss +N %" only when the boss would be stronger (above 0), else ''. */
export const bossShown = (asc) => (Math.round((asc || 0) * 100) > 0 ? bossText(asc) : '');
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
/**
 * The log line when the meter's state changes (D150 item 25: no toast; the meter flashes): "The Furnace: Burning · 3 tolls
 * overspent", the meter's own line.
 */
export function heatToast(hv) {
  return `${HW.Name}: ${HEAT_NAME[hv.state] || hv.state} · ${meterText(hv)}.`;
}

/** Per cent across the bar of a value in tolls past the line. */
const pctOf = (x, bar) => (100 * (clamp(x, bar.min, bar.max) - bar.min)) / Math.max(1e-9, bar.max - bar.min);
/** The four segments over the bar: [state, from, to] in tolls past the line (HEAT_WARM_AT, HEAT_HOT_AT, HEAT_SCORCH_AT). */
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
  els.state = h('span.ht-state', h('i.ht-dot'), h('b.ht-sname'));
  els.num = h('span.ht-num');
  els.boss = h('span.ht-boss');
  els.segs = {};
  els.bar = h('div.ht-bar');
  els.line = h('div.ht-line', { 'aria-hidden': 'true' });
  els.span = h('div.ht-span.hidden'); // the tolls a hovered choice spends: from the marker to the ghost
  els.ghost = h('div.ht-mark.ghost.hidden', h('i'));
  els.mark = h('div.ht-mark.run', h('i'), h('b.ht-arrow.hidden'));
  els.dmark = h('div.ht-mark.dim.hidden', h('i'));
  // the meter at the top centre of the HUD (owner 2026-11-11 10:12): the calm side (still water) left, the hot side (embers,
  // molten glow) right, the player's pointer moving between them; .ht-calm and .ht-core are decoration only
  // D150 item 1: one line, "Calm · 18 tolls to spare" (Boss only above 0), over the bar; the name is the tooltip's title
  els.el = h('div#heat.panel.hidden', { role: 'group', 'aria-label': HW.Name },
    h('div.ht-row', els.state, h('span.ht-sep', '·'), els.num, els.boss), els.bar);
  host.appendChild(els.el);
  tip(els.el, () => heatTip(ctx));
  // the first-time note (H.4 wording: "Heat", "the Star's line"), once per browser profile, on the first hub until
  // "Got it" or setting out
  els.introBtn = h('button.btn.small', { type: 'button' }, 'Got it');
  els.intro = h('div#heat-intro.hidden', { role: 'note', 'aria-label': `About ${HW.name}` }, h('div.hi-t', HW.Name), h('div.hi-b'), h('div.hi-f', els.introBtn));
  noteRoot.appendChild(els.intro);
  // M3 (m3-onboarding.md 3.3, U4): the first-time note is retired into hint H16 (onboarding.js); its seen state moved over
  let introSeen = true;
  const closeIntro = () => { introSeen = true; els.intro.classList.add('hidden'); try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage blocked */ } };
  els.introBtn.addEventListener('click', closeIntro);

  let built = false;
  let ghost = null; // the hovered choice's preview (engine-api.md 11.2), or null
  let ghostAt = null; // the phase and run time it was hovered at: a step clears it (the hovered element may be gone)

  function build() {
    if (built || !H) return;
    built = true;
    const bar = { min: H.barMin, max: H.barMax };
    for (const [s, a, b] of segments(H, bar)) {
      // D150 item 1: the segments carry no names (the line above names the state, the tooltip all four)
      const seg = h('div.ht-seg', { dataset: { hs: s }, 'aria-label': HEAT_NAME[s], style: { left: `${pctOf(a, bar)}%`, width: `${pctOf(b, bar) - pctOf(a, bar)}%` } });
      els.segs[s] = seg; els.bar.appendChild(seg);
    }
    els.line.style.left = `${pctOf(0, bar)}%`;
    const hot0 = pctOf(H.hotAt, bar);
    els.bar.append(h('div.ht-calm', { 'aria-hidden': 'true', style: { width: `${pctOf(0, bar)}%` } }),
      h('div.ht-core', { 'aria-hidden': 'true', style: { left: `${hot0}%`, width: `${100 - hot0}%` } }, h('i'), h('i'), h('i')),
      els.line, els.span, els.ghost, els.dmark, els.mark);
  }

  /**
   * The header row fits its frame (blind panel 2026-11-13: "SMOULDERING · Dimming 4 tolls in hand ..." spilled out): when it
   * overflows, #heat.tight closes the gaps, then #heat.tighter drops the title. Measured again when the row's text changes
   * and once the web fonts are in.
   */
  let fitSig = null;
  function fitHeader() {
    const row = els.el.querySelector('.ht-row');
    if (!row || els.el.classList.contains('hidden')) return;
    const sig = row.textContent;
    if (sig === fitSig) return;
    fitSig = sig;
    els.el.classList.remove('tight', 'tighter');
    const over = () => row.scrollWidth > row.clientWidth + 1;
    if (over()) { els.el.classList.add('tight'); if (over()) els.el.classList.add('tighter'); }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitSig = null; fitHeader(); });

  function update(v) {
    const hv = v.heat;
    // D150 item 1: in a guided first run the meter waits for its coach line (onboarding.js furnaceIntroduced: the line is up or
    // has shown, the guide is skipped or over, hints are off, or the run is not guided)
    const intro = !ctx.coach || !ctx.coach.furnaceIntroduced || ctx.coach.furnaceIntroduced(v);
    const show = !!(hv && H && v.player && v.phase !== 'CREATE' && v.phase !== 'SUMMARY' && intro);
    els.el.classList.toggle('hidden', !show);
    if (!show) { els.intro.classList.add('hidden'); ghost = null; return; }
    build();
    if (ghost && ghostAt !== `${v.phase}|${hv.time}|${hv.z}`) { ghost = null; ghostAt = null; }
    const bar = hv.bar;
    els.el.dataset.state = hv.state; els.el.dataset.by = hv.by;
    for (const s of STATES) els.segs[s].classList.toggle('on', s === hv.state);
    els.state.querySelector('.ht-sname').textContent = HEAT_NAME[hv.state];
    queueMicrotask(fitHeader); // after the texts below are set
    els.num.textContent = meterText(hv); // D152: the Dimming's words when it sets the state
    const boss = bossShown(hv.ascIfPar);
    els.boss.textContent = boss; els.boss.classList.toggle('hidden', !boss);
    // the player's marker; an arrow when the heat is off the bar (bar.beyond)
    els.mark.style.left = `${pctOf(bar.marker, bar)}%`;
    const arrow = els.mark.querySelector('.ht-arrow');
    arrow.classList.toggle('hidden', !bar.beyond); arrow.textContent = bar.beyond < 0 ? '◀' : bar.beyond > 0 ? '▶' : '';
    els.mark.classList.toggle('beyond', !!bar.beyond);
    els.mark.classList.toggle('sets', hv.by === 'run');
    // the Dimming's marker (expedition zones) in its state's segment; its clock in words is the map's (D150 item 8)
    const dp = hv.dimIn !== null && hv.dimIn !== undefined && hv.stateDim ? dimBarPos(hv.dimIn, hv.stateDim, H, bar) : null;
    els.dmark.classList.toggle('hidden', !dp);
    if (dp) {
      els.dmark.style.left = `${pctOf(dp.x, bar)}%`;
      els.dmark.classList.toggle('sets', hv.by === 'dim');
    }
    drawGhost(hv);
    els.el.setAttribute('aria-label', `${HW.Name}: ${HEAT_NAME[hv.state]}, ${meterText(hv)}${boss ? `, ${boss}` : ''}`);
    // the first-time note: on the hub (hidden while a service window is open), until "Got it" or setting out
    if (!introSeen) {
      const svcOpen = !!(v.node && v.node.origin === 'hub');
      if (v.phase === 'ZONE_HUB' && svcOpen) els.intro.classList.add('hidden');
      else if (v.phase === 'ZONE_HUB') {
        if (els.intro.classList.contains('hidden')) {
          add(clear(els.intro.querySelector('.hi-b')), h('p', FURNACE_LINE));
          els.intro.classList.remove('hidden');
        }
      } else if (!els.intro.classList.contains('hidden')) closeIntro();
    }
  }

  /** The ghost marker and the span of tolls a hovered choice spends (its words are the choice's own tooltip, D150). */
  function drawGhost(hv) {
    const p = ghost; const bar = hv.bar;
    els.ghost.classList.toggle('hidden', !p);
    els.span.classList.toggle('hidden', !p);
    els.el.dataset.ghost = p ? p.state : '';
    if (p) {
      const gx = clamp(p.heat, bar.min, bar.max);
      els.ghost.style.left = `${pctOf(gx, bar)}%`;
      els.ghost.dataset.hs = p.state;
      const a = pctOf(bar.marker, bar); const b = pctOf(gx, bar);
      els.span.style.left = `${Math.min(a, b)}%`; els.span.style.width = `${Math.abs(b - a)}%`;
      els.span.classList.toggle('back', b < a); // leaving the zone: the line moves ahead, the heat drops
    }
  }

  /**
   * After a step has played (app.js act): a toast, a log line and a flash of the meter when the state changed within the
   * run (prev and next: the bridge's views before and after the step; not at a run's start or end).
   */
  function noteStep(prev, next) {
    const a = prev && prev.heat; const b = next && next.heat;
    if (!a || !b || a.state === b.state || !prev.player || !next.player || prev.seed !== next.seed) return;
    // D150 item 25: no toast ("Smouldering: the Dimming draws near." said nothing the meter does not); the meter flashes
    // and the log keeps one line
    if (ctx.hud) ctx.hud.log(heatToast(b), b.state === 'clear' ? 'lg-sys' : 'lg-warn');
    els.el.classList.remove('flash'); void els.el.offsetWidth; els.el.classList.add('flash');
  }

  /** Show a hovered choice's preview on the bar (p: heatView.next entry or R.heatPreview), or clear it (null). */
  function setGhost(p) {
    const v = ctx.view;
    ghost = p && v && v.heat ? p : null;
    ghostAt = ghost ? `${v.phase}|${v.heat.time}|${v.heat.z}` : null;
    if (v) update(v);
  }

  return { el: els.el, update, setGhost, noteStep, get ghost() { return ghost; }, introEl: els.intro };
}

// ------------------------------------------------------------------ tooltips
/** D150 item 5: the meter's one sentence (its tooltip, and the retired first-time note). */
export const FURNACE_LINE = 'Every move costs tolls. Overspend and fights pay more, but the final boss gets stronger.';
/** The four states as the tooltip's table rows (D150 item 5): [state, when, bonus or ''] from the engine's thresholds. */
export function stateRows(H) {
  return [['clear', 'Tolls to spare'], ['warm', `Up to ${H.hotAt} overspent`], ['hot', `${H.hotAt} to ${H.scorchAt} overspent`], ['scorched', `${H.scorchAt} or more overspent`]]
    .map(([st, when]) => [st, when, payText(st, H) || '']);
}
/** The meter's tooltip (D150 item 5): the one sentence and the four states, the current one marked. */
export function heatTip(ctx) {
  const hv = ctx.view && ctx.view.heat; const H = ctx.data.rules.heat;
  if (!hv || !H) return null;
  const box = h('div.tt-heatbox');
  box.appendChild(h('div.tt-name', HW.Name));
  // D152 (changes-m3-v2.md 4): while the Dimming sets the state, the tolls figure moves here, as the first line
  if (hv.by === 'dim') box.appendChild(h('div.tt-line.ht-dimtip', dimTipLine(hv)));
  box.appendChild(h('div.tt-line.desc', FURNACE_LINE));
  if (hv.dimIn != null && hv.stateDim) box.appendChild(h('div.tt-line.ht-dimmark', DIM_MARK_LINE)); // the diamond is on the bar
  box.appendChild(h('div.tt-heatstates', stateRows(H).map(([st, when, pay]) => h('div.hs' + (st === hv.state ? '.on' : ''), { dataset: { hs: st } }, h('i.ht-dot', { dataset: { hs: st } }), h('b', HEAT_NAME[st]), h('span.w', when), h('span.p', pay)))));
  return box;
}

/**
 * Tooltip block of a time-costing choice (engine-api.md 11.2; D150 item 6): "Costs 3 tolls." (a wave: "Costs 3 tolls a
 * wave."; ending in the Dimming: "Costs 4 tolls, then a fight in the Dimming."), and a bonus line only when a node entered
 * now would pay one (`pays`): "Burning bonus: +35 % XP and gold, 1 in 2 drops a rarity up." p: a heatView.next entry or an
 * R.heatPreview result.
 */
export function costText(p) {
  if (!p) return '';
  return `Costs ${tolls(p.time)}${p.perWave ? ' a wave' : ''}${p.dimFight ? ', then a fight in the Dimming' : ''}.`;
}
export function previewBlock(p, ctx) {
  const H = ctx.data.rules.heat;
  if (!p || !H) return null;
  const box = h('div.tt-heat', { dataset: { hs: p.state } });
  box.appendChild(h('div.th-l', costText(p)));
  const pt = p.pays ? payText(p.pays, H) : null;
  if (pt) box.appendChild(h('div.th-p.paid', { dataset: { hs: p.pays } }, `${HEAT_NAME[p.pays]} bonus: ${pt}.`));
  return box;
}

/** A small badge for a node entered Hot or Scorched (its rewards) or an item heat raised; null in Clear and Warm. */
export function heatBadge(state, ctx, kind = 'node') {
  const H = ctx.data.rules.heat;
  if (!H || !state || !(H.gain[state] > 0 || H.rarityUp[state] > 0)) return null;
  const el = h('span.heat-badge', { dataset: { hs: state } }, kind === 'item' ? `▲ ${HW.Name}` : `${HEAT_NAME[state]} bonus`);
  tip(el, () => h('div', h('div.tt-name', kind === 'item' ? `Raised by ${HW.name}` : `Entered ${HEAT_NAME[state]}`),
    h('div.tt-line.desc', kind === 'item' ? `Found in a node entered ${HEAT_NAME[state]}: ${HW.name} raised this item one rarity.` : `${payText(state, H)}.`)));
  return el;
}

// ------------------------------------------------------------------ run summary
/**
 * The summary's heat card (H.4, engine-api.md 11.3): the tolls-against-the-line track as a chart (per zone the heat on
 * arrival and when left, over the four state bands and the Star's line), the tolls spent in each state, and the end against the
 * line or the par. sum: the bridge's summary (sum.heat, sum.time, sum.par).
 */
export function buildHeatSummary(sum, ctx) {
  const H = ctx.data.rules.heat; const ht = sum.heat;
  if (!H || !ht || !ht.trackPerZone || !ht.trackPerZone.length) return null;
  const zc = ctx.data.rules.zoneCount;
  const recs = ht.trackPerZone.map((r) => ({ ...r, a: r.entry - r.line, b: r.exit - r.line }));
  const last = recs[recs.length - 1];
  const over = sum.time - sum.par;
  const card = h('div.card.heatcard');
  // D150 naming rule: no par, line or Ascendancy in player text; the run's tolls, and what they did to Oruvath or the last zone
  const endLine = sum.reachedCamp
    ? `${HW.Units}: ${fmtTime(sum.time)} · ${over > 0 ? `${tolls(over)} overspent` : `${tolls(-over)} to spare`} · Oruvath ${sum.asc ? `+${Math.round(sum.asc * 100)} %` : 'at his base strength'}`
    : `${HW.Units}: ${fmtTime(sum.time)} · ${standText({ heat: last.b })} in the last zone`;
  // tolls by state: a thin bar of the run's tolls with the figures beside it, in the card's head next to the end line
  const tot = ht.timeByState.reduce((a, b) => a + b, 0) || 1;
  const strip = h('div.hc-strip', { role: 'img', 'aria-label': `${HW.Units} in each state: ${STATES.map((s, i) => `${HEAT_NAME[s]} ${fmtTime(ht.timeByState[i])}`).join(' · ')}` },
    STATES.map((s, i) => (ht.timeByState[i] > 0 ? h('i', { dataset: { hs: s }, style: { flexGrow: String(ht.timeByState[i] / tot) } }) : null)));
  card.appendChild(h('div.hc-head', h('h3', HW.Name), h('div.hc-time', strip,
    h('span.hc-leg', `${HW.Units} in each state: `, STATES.map((s, i) => h('span', h('i.ht-dot', { dataset: { hs: s } }), `${HEAT_NAME[s]} ${fmtTime(ht.timeByState[i])}`)))), h('span.hc-end', endLine)));
  card.appendChild(h('div.hc-cap', `${HW.Units} overspent (above 0) or to spare (below), per zone`));
  card.appendChild(heatChart(recs, H, zc));
  const hotNodes = ht.nodesByState[2] + ht.nodesByState[3];
  const hotFights = ht.fightsByState[2] + ht.fightsByState[3];
  card.appendChild(h('div.hc-foot', `Nodes entered: ${STATES.map((s, i) => `${ht.nodesByState[i]} ${HEAT_NAME[s]}`).join(' · ')}. Fights won in heat: ${hotFights}${hotNodes ? '' : ` (no node entered ${HEAT_NAME.hot} or ${HEAT_NAME.scorched})`}. Hover a point for its ${HW.units}.`));
  return card;
}

/** The tolls-against-the-line chart (inline SVG): state bands, the Star's line at 0, per zone arrival -> leaving, and the step down
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
    'aria-label': `${HW.Units} overspent per zone, on arrival and when left: ${recs.map((r) => `${r.z > zc ? 'camp' : `zone ${r.z}`} ${signed(r.a)} to ${signed(r.b)}`).join('; ')}` });
  // state bands (a wash of each state's colour) and their names at the left
  const bands = [['clear', lo, H.warmAt], ['warm', H.warmAt, H.hotAt], ['hot', H.hotAt, H.scorchAt], ['scorched', H.scorchAt, hi]];
  for (const [s, a, b] of bands) {
    svg.appendChild(el('rect', { x: L, y: y(b), width: W - L - R, height: Math.max(0, y(a) - y(b)), class: `band b-${s}` }));
    svg.appendChild(txt(L - 8, (y(a) + y(b)) / 2 + 4, HEAT_NAME[s], { class: 'bl', 'text-anchor': 'end' }));
  }
  // hairline grid at the band edges, the Star's line (red) at 0
  for (const v of [H.hotAt, H.scorchAt]) svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
  svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), class: 'starline' }));
  svg.appendChild(txt(W - R + 6, y(0) + 4, '0', { class: 'sl' }));
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
    tip(g, () => h('div', h('div.tt-name', `${zoneName}, ${k === 'a' ? 'arrival' : 'leaving'}`), h('div.tt-line', { style: { fontWeight: 700 } }, standText({ heat: v }))));
    svg.appendChild(g);
  }
  const lr = recs[recs.length - 1];
  svg.appendChild(txt(x1(recs.length - 1) + 9, y(lr.b) + 4, signed(lr.b), { class: 'endv' }));
  return h('div.hc-wrap', svg);
}
/** "+8" past the line, "−12" in hand (whole tolls). */
function signed(v) { const k = v > 0 ? Math.floor(v + 1e-9) : Math.ceil(-v - 1e-9); return v > 0 && k ? `+${k}` : v < 0 && k ? `−${k}` : '0'; }
