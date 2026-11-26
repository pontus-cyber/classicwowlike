// The demo's player-facing lines and its demo-end block (docs/specs/demo.md 1.3, 1.4, 2.4, 3.1, 3.2, 4.3; D171). Every
// line here is a draft for D.5 (the owner approves every line); the Content Designer may move them to content. Zone, class,
// camp and boss names come from the bridge (ctx.data.demo, the view), never typed here. Presentation only.
import { h, fmtNum } from './util.js';
import { numWord } from './ui-text.js';

/** The demo's lines (draft). `{x}` placeholders are filled by fill(). */
export const DEMO_TEXT = {
  heading: 'End of the demo',
  madeIt: 'You made it through {zones}.',
  runs: 'Runs so far: {n}',
  hero: '{who}, level {level}',
  hall: 'Legacy hall: {owned} of {total} unlocks owned',
  capReached: '{who} has reached level {cap}, the demo\'s highest.',
  fullGame: 'The full game goes on past {last}: {more} more zones and a final boss.',
  nextRun: 'Next run',
  hallButton: 'Legacy hall',
  leaveLine: 'Leaving {last} ends this demo run. You keep your levels and Legacy points.',
  roadSign: 'End of the demo',
  cannotSave: 'This browser window cannot save your progress.',
  startOver: 'Start over',
  startOverNote: 'Deletes your heroes and Legacy unlocks and starts the demo from the beginning.',
  startOverAsk: 'Start over? Your heroes and Legacy unlocks are deleted.',
  startOverConfirm: 'Start over: click again',
  capLevel: 'Level {cap}: the demo\'s highest',
  hallAllOwned: 'You own every unlock in the demo.',
  heroIntro: 'Your hero keeps its level from run to run, up to level {cap} in the demo.',
  // MD D.5 (draft): demo variants of full-game lines that name what the demo never reaches. Wired (L1): heat.js reads
  // furnaceLine in the demo for the meter's tooltip and the hub intro; the tutorial's G5, H16 and H17 read TUTORIAL.demo.
  furnaceLine: 'Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll.',
  // demo.md 1.2a (R2-1, draft): the demo's end needs C.DEMO_END_WINS fights won in its last zone; before that, leaving ends
  // the run early. The zone 2 Bell reads (and looks) unlike zone 1's.
  bellDone: 'End the demo run',
  bellEarly: 'End this run early',
  askDone: 'End the demo run?',
  askEarly: 'End this run early?',
  progress: 'Demo end: {wins} of {need} fights won here',
  progressDone: 'Demo end reached: leave by a Road or the Bell',
  earlyLine: 'Leaving now ends this run early. Win {more} more {fights} in {last} to finish the demo; an early leave earns nothing for {last}.',
  leftHeading: '{who} left {last} early',
  leftLine: 'The demo ends after {need} fights won in {last}. This run won {wins} there.',
  welcomeWaits: 'Your first-run welcome waits for the next run.',
};

/** A line with its placeholders filled. */
export const fill = (id, vars = {}) => DEMO_TEXT[id].replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
/** "Amberfold Downs and Greywater Fens" (an "and" list of names). */
export const andList = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** The demo is on in this page (the demo build, or ?demo=1 in a team build): ctx.data.demo. */
export const demoOn = (ctx) => !!(ctx && ctx.data && ctx.data.demo);
/** Standing in the demo's last zone (its Roads and the Bell end the run): the view's zone index is DEMO_LAST_ZONE or more. */
export const atDemoExit = (v, ctx) => demoOn(ctx) && !!(v && v.zone && !v.zone.camp && v.zone.idx >= ctx.data.demo.lastZone);
/** demo.md 1.2a: the map view's demoExit ({ wins, need, done }) of the demo's last zone, or null. */
export const demoExitOf = (v) => (v && v.zone && v.zone.exp && v.zone.exp.demoExit) || null;
/** demo.md 1.2a: leaving the demo's last zone now ends the run early (fewer than need fights won there). */
export const demoEarly = (v, ctx) => atDemoExit(v, ctx) && !!demoExitOf(v) && !demoExitOf(v).done;
const lastName = (ctx) => ctx.data.demo.zones[ctx.data.demo.lastZone - 1];
/**
 * The zone 2 leave line (demo.md 1.3), with the zone's name from content; demo.md 1.2a: before the demo end is reached,
 * the early line (how many fights are still to win).
 */
export function leaveLine(ctx, v = null) {
  const de = demoExitOf(v);
  if (de && !de.done) { const more = de.need - de.wins; return fill('earlyLine', { more: numWord(more), fights: more === 1 ? 'fight' : 'fights', last: lastName(ctx) }); }
  return fill('leaveLine', { last: lastName(ctx) });
}
/** demo.md 1.2a: the zone 2 Bell's button ("End the demo run" / "End this run early"), null outside the demo's last zone. */
export const bellLabelDemo = (v, ctx) => (atDemoExit(v, ctx) && demoExitOf(v) ? DEMO_TEXT[demoExitOf(v).done ? 'bellDone' : 'bellEarly'] : null);
/** demo.md 1.2a: the map header's progress chip in the demo's last zone, null elsewhere. */
export function demoProgress(v, ctx) {
  const de = atDemoExit(v, ctx) ? demoExitOf(v) : null;
  if (!de) return null;
  return h('div.demoprog' + (de.done ? '.done' : ''), { dataset: { demoWins: String(de.wins), demoNeed: String(de.need) } }, de.done ? DEMO_TEXT.progressDone : fill('progress', { wins: de.wins, need: de.need }));
}
/**
 * demo.md 1.2a: the summary head of a demo run left early (outcome 'left'; summary demoLeft { zone, wins, need, welcome }):
 * "Vex left Greywater Fens early", the demo end's rule and what this run won, and the welcome line when it waits.
 */
export function buildLeftHead(s, ctx) {
  const named = s.name && s.name.toLowerCase() !== String(s.className).toLowerCase() ? s.name : `Your ${s.className}`;
  const d = s.demoLeft;
  return h('div.demoleft', { dataset: { demo: 'left' } },
    h('div.t1.subtitle', 'The run has ended'),
    h('div.t2', fill('leftHeading', { who: named, last: lastName(ctx) })),
    h('div.dl-line', fill('leftLine', { need: numWord(d.need), last: lastName(ctx), wins: d.wins > 0 ? numWord(d.wins) : 'none' })),
    d.welcome ? h('div.dl-welcome', DEMO_TEXT.welcomeWaits) : null);
}
/** "Vex, Rogue" or "Rogue" (a hero without a name of its own). */
const whoOf = (x) => (x.name ? `${x.name}, ${x.className}` : x.className);

/**
 * The demo block over the summary of a run that ended at the cut (demo.md 1.4): heading, what this run did, so far (runs,
 * heroes with a run, the hall), the cap line (only when the run's hero is at the demo's cap), the full game's line.
 * s: the view's summary (demo, cap, name, className); after: view.meta.after (its `demo`: runs, heroes, owned, total).
 * The run's own lines (level, fights, Legacy, Kept / Left behind) are the summary's, under it. Buttons are the caller's.
 */
export function buildDemoBlock(s, after, ctx) {
  const d = ctx.data.demo;
  const so = after && after.demo;
  const named = s.name && s.name.toLowerCase() !== String(s.className).toLowerCase() ? s.name : null;
  const lines = [
    h('div.dm-made', fill('madeIt', { zones: andList(s.demo.zones) })),
    so ? h('div.dm-sofar', [fill('runs', { n: fmtNum(so.runs) }), ...so.heroes.map((x) => fill('hero', { who: whoOf(x), level: x.level }))].join(' · ')) : null,
    so ? h('div.dm-hall', fill('hall', { owned: so.owned, total: so.total })) : null,
    s.cap === 'demo' ? h('div.dm-cap', fill('capReached', { who: named || `Your ${s.className}`, cap: d.heroMax })) : null,
    h('div.dm-full', fill('fullGame', { last: d.zones[d.lastZone - 1], more: numWord(d.moreZones), boss: d.boss })),
  ];
  return h('div.demoend', { dataset: { demo: 'end' } }, h('div.dm-h', DEMO_TEXT.heading), ...lines.filter(Boolean));
}

/** Words of an element's visible text (demo.md 1.4: the demo block holds at most DEMO_END_MAX_WORDS). */
export const wordCount = (text) => (String(text).match(/[A-Za-z0-9][\w'’-]*/g) || []).length;

/** The hero select and HUD line of a capped hero (demo.md 3.1): "Level 7: the demo's highest". */
export const capLevelText = (ctx) => fill('capLevel', { cap: ctx.data.demo.heroMax });

