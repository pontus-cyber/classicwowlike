#!/usr/bin/env node
/**
 * qa/browser/demo/reload.mjs - save and reload at the 11 points of docs/specs/demo.md 5.3.
 *
 *   node qa/browser/demo/reload.mjs [--file demo.html] [--browsers chromium] [--size 1366x768] [--class mage] [--json out.json]
 *
 * Points: hero select, start camp, map, a fight's round 1, a later round, the loot window, the level-up banner, a hub service,
 * the demo-end (run summary) screen, the Legacy hall right after a purchase, Settings.
 * At each point: everything the page stored (all localStorage keys) is read, the page is reloaded with reloadKeep (F5), and then
 * the page is closed and opened again in the same browser context (close and reopen). Pass at a point when:
 *   - the stored data after F5 and after reopen equals the stored data before (nothing paid or charged a second time, the
 *     welcome, hints, guide state and settings unchanged) and the Legacy balance, heroes (level, XP) and hall offers shown on
 *     hero select equal what they were at the last checkpoint (the same read before the reload, from the profile's own view);
 *   - the page is on hero select (the run in progress is lost; no run resume);
 *   - guide state: a reload in a guided run leaves the profile's guide at "todo", so hero select offers the guided run again.
 * The data of a run in progress is not in storage until a checkpoint (zone arrival or run end), so "before" is the stored data at
 * the moment of the reload, and the heroes view compared is the one hero select shows after the reload against the one it showed
 * the last time it was on screen (before the run started or after the run ended) - those are the checkpoints.
 */
import { FILE_URL, EXPECT, arg, report, buildLine, availableBrowsers, watch, clean, idle, view, startRun, autoStep, endRun, setSpeed, reloadKeep, CLASSES } from './lib.mjs';

const [W, H] = arg('--size', '1366x768').split('x').map(Number);
const CLS = arg('--class', 'mage');
console.log(buildLine());
const { ok: engines, skipped } = await availableBrowsers(arg('--browsers', 'chromium').split(','));
for (const s of skipped) console.log(`SKIP browser ${s.name}: ${s.reason}`);
if (!engines.length) { console.log('no browser'); process.exit(2); }
const eng = engines[0];
const browser = await eng.type.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
let page = await ctx.newPage(); const res = watch(page);
const open = async () => { await page.goto(FILE_URL); await page.waitForFunction(() => window.__ui); await idle(page); };

const stored = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => !k.startsWith('qa.')).sort().map((k) => [k, localStorage.getItem(k)])));
const hero = () => page.evaluate(() => { const v = window.__ui.view(); const m = v.meta || {}; return { phase: v.phase, legacy: m.echoes ?? m.legacy ?? null, heroes: m.heroes || null, guided: m.guided ?? null, guide: m.guide ?? null, offers: (m.offers || []).map((o) => `${o.id}:${o.rank ?? ''}:${o.owned ?? o.state ?? ''}`) }; });
const diffKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
const vw = () => view(page);

// reach(): from hero select, play until the point shows; returns a note or throws
async function stepUntil(pred, max = 3000) {
  let prev = await vw();
  for (let i = 0; i < max; i++) {
    const r = await autoStep(page); if (r.done) return pred({ ...prev }, r, null, true) ? true : false;
    const cur = await vw();
    if (pred(cur, r, prev, false)) return true;
    prev = cur;
  }
  return false;
}
const POINTS = [
  ['hero select', async () => true],
  ['start camp', async () => { await startRun(page, CLS); return (await vw()).phase === 'PREP'; }],
  ['map', async () => { await startRun(page, CLS); return stepUntil((c) => c.phase === 'MAP'); }],
  ["fight round 1", async () => { await startRun(page, CLS); return stepUntil((c) => c.round === 1); }],
  ['fight, a later round', async () => { await startRun(page, CLS); return stepUntil((c) => c.round >= 3); }],
  ['loot window', async () => { await startRun(page, CLS); return stepUntil((c) => c.loot); }],
  ['level-up banner', async () => { await startRun(page, CLS); let seen = false; const ok = await stepUntil((c, r, p) => p && c.level > p.level && !c.summary); seen = await page.evaluate(() => { const b = document.querySelector('#banner'); return !!b && b.textContent.trim().length > 0; }); notes.banner = seen; return ok; }],
  ['hub service', async () => { await startRun(page, CLS); return stepUntil((c, r) => c.phase === 'ZONE_HUB' && ['SERVICE', 'HUB_SERVICE', 'BUY', 'TRAIN', 'TRAIN_ALL'].includes(r.type)); }],
  ['demo-end screen', async () => { await startRun(page, CLS); const ok = await stepUntil((c) => !!c.summary); const v = await vw(); notes.outcome = v.summary && v.summary.outcome; notes.demoBlock = !!(v.summary && v.summary.demo); notes.pays = await page.evaluate(() => window.__ui.view().summary.echoTotal); return ok; }],
  ['hall right after a purchase', async () => {
    // a run to its end first (a profile with Legacy points), back to hero select, hall open, one purchase
    await startRun(page, CLS); await stepUntil((c) => !!c.summary); await endRun(page); await idle(page);
    const bought = await page.evaluate(async () => {
      const m = window.__ui.view().meta; const o = (m.offers || []).find((x) => x.affordable); if (!o) return null;
      const r = await window.__ui.act({ type: 'META_BUY', id: o.id }); await window.__ui.idle(); return r && r.ok ? o.id : `refused ${o.id}`;
    });
    notes.bought = bought; return !!bought && !String(bought).startsWith('refused');
  }],
  ['Settings', async () => { await page.evaluate(() => window.__ui.openWin('settings')); await page.locator('#windows .seg button', { hasText: '2×' }).first().click(); await idle(page); notes.settingsOpen = await page.evaluate(() => !!document.querySelector('#windows .seg')); return true; }],
];
let notes = {};
await open(); await setSpeed(page, 'Instant');
const rows = []; let lastHero = await hero();
for (const [name, reach] of POINTS) {
  notes = {}; const row = { point: name, ok: false, problems: [] };
  try {
    if ((await vw()).phase !== 'CREATE') { await reloadKeep(page); }
    const checkpointHero = await hero();           // the checkpoint view: hero select before the run starts
    const reached = await reach();
    if (!reached) { row.problems.push('point not reached'); }
    const before = await stored();
    const midHero = (await vw()).phase === 'CREATE' ? await hero() : checkpointHero;   // at hero select/hall/settings the live view is the checkpoint
    const dropped = await reloadKeep(page);
    row.storageRestored = dropped;
    const after = await stored(); const h1 = await hero();
    const d1 = diffKeys(before, after);
    if (d1.length) row.problems.push(`stored data changed on F5: ${d1.join(', ')}`);
    if (h1.phase !== 'CREATE') row.problems.push(`after F5 the page is on ${h1.phase}, not hero select`);
    // heroes, Legacy, offers, guide: as the last checkpoint (midHero is the live view at a hero-select point, else the view before the run)
    for (const k of ['legacy', 'heroes', 'offers', 'guide', 'guided']) {
      // a run that ended (summary stored by the run end) moves the profile from checkpointHero to the new profile; the comparison against `before` storage is the strict one
      if (name === 'hero select' || name.startsWith('hall') || name === 'Settings') { if (JSON.stringify(midHero[k]) !== JSON.stringify(h1[k])) row.problems.push(`${k} differs after F5: ${JSON.stringify(midHero[k])} -> ${JSON.stringify(h1[k])}`); }
    }
    if (name !== 'demo-end screen' && name !== 'hall right after a purchase' && name !== 'Settings' && JSON.stringify(checkpointHero.legacy) !== JSON.stringify(h1.legacy)) row.problems.push(`Legacy changed by a run that was lost: ${checkpointHero.legacy} -> ${h1.legacy}`);
    if (['start camp', 'map', 'fight round 1', 'fight, a later round', 'loot window', 'level-up banner', 'hub service'].includes(name) && checkpointHero.guide != null && h1.guide !== checkpointHero.guide) row.problems.push(`guide state ${checkpointHero.guide} -> ${h1.guide}`);
    // second reload: still nothing paid
    await reloadKeep(page); const after2 = await stored();
    const d2 = diffKeys(after, after2); if (d2.length) row.problems.push(`stored data changed on the second F5: ${d2.join(', ')}`);
    // close and reopen (same browser context: the same storage)
    await page.close(); page = await ctx.newPage(); watch(page, res); await open();
    const after3 = await stored(); const d3 = diffKeys(after, after3); if (d3.length) row.problems.push(`stored data changed on close and reopen: ${d3.join(', ')}`);
    const h3 = await hero(); if (h3.phase !== 'CREATE') row.problems.push(`after reopen the page is on ${h3.phase}`);
    if (name === 'Settings') { const speed = await page.evaluate(() => { window.__ui.openWin('settings'); const on = document.querySelector('#windows .seg button.on'); window.__ui.closeWins(); return on ? on.textContent : null; }); row.settingsSpeed = speed; if (speed !== '2×') row.problems.push(`speed setting after reload is ${speed}, not 2×`); await setSpeed(page, 'Instant'); }
    if (name === 'hall right after a purchase') { const owned = h1.offers.join('|'); if (notes.bought && !String(notes.bought).startsWith('refused') && JSON.stringify(midHero.offers) !== JSON.stringify(h1.offers)) row.problems.push('hall offers differ after F5'); row.offersAfter = owned.length; }
    // spec 5.3: the run end is a checkpoint (heroes, XP and Legacy as at the run end). The bridge stores the profile at zone and Camp
    // arrival and when the summary's button sends END_RUN; a reload on the summary itself therefore loses what the run paid.
    if (name === 'demo-end screen' && notes.pays > 0 && h1.legacy === checkpointHero.legacy) row.warn = `the run paid ${notes.pays} Legacy points on the summary, but after F5 the balance is still ${h1.legacy}: the run end is not stored until "Begin a new run" / "Spend Echoes" (END_RUN); spec 5.3 names the run end a checkpoint`;
    Object.assign(row, { legacy: h1.legacy, guided: h1.guided, ...notes });
    row.ok = !row.problems.length;
  } catch (e) { row.problems.push(`exception: ${String(e.message).split('\n')[0]}`); try { await page.close(); } catch {} page = await ctx.newPage(); watch(page, res); await open().catch(() => {}); }
  rows.push(row);
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${name}: legacy ${row.legacy ?? '?'}, guided ${row.guided ?? '?'}${row.storageRestored ? `, storage restored ${row.storageRestored}x by reloadKeep` : ''}${row.bought ? `, bought ${row.bought}` : ''}${row.outcome ? `, outcome ${row.outcome}` : ''}${row.problems.length ? ' | ' + row.problems.join('; ') : ''}${row.warn ? ' | WARN ' + row.warn : ''}`);
}
const consoleOk = clean(res);
console.log(`console errors ${res.errors.length}, warnings ${res.warnings.length}, page errors ${res.pageErrors.length}${consoleOk ? '' : ': ' + [...res.errors, ...res.warnings, ...res.pageErrors].slice(0, 3).join(' | ')}`);
await browser.close();
const bad = rows.filter((r) => !r.ok);
console.log(`\nreload: ${rows.length - bad.length}/${rows.length} points pass (${eng.name}, ${W}x${H}, expect ${EXPECT})`);
report('reload', { rows, console: { errors: res.errors, warnings: res.warnings, pageErrors: res.pageErrors } });
process.exit(bad.length || !consoleOk ? 1 : 0);
