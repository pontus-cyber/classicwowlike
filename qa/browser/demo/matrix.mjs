#!/usr/bin/env node
/**
 * qa/browser/demo/matrix.mjs - the browser matrix (docs/specs/demo.md 5.2).
 *
 *   node qa/browser/demo/matrix.mjs [--file demo.html] [--browsers chromium,firefox,webkit] [--sizes 1366x768,1920x1080]
 *        [--modes disk,iframe,iframe-nosave] [--classes rogue,mage,hunter] [--json out.json]
 *
 * Browsers: chromium is what Playwright has here (Chrome and Edge share its engine; Edge is Chromium-based, so the Edge row
 * is the Chromium row run on a Windows machine in D.8). firefox and webkit (the stand-in for Safari and other engines we
 * cannot install) run when their executables exist and are listed as SKIPPED with the launch error when not.
 * Sizes: 1366x768 and 1920x1080 inner size at 100 % zoom. (1920x1080 at 125 % display scaling is a report-only row: --scale-row
 * adds it as deviceScaleFactor 1.25 with the same inner size.)
 * Modes: disk (file://), iframe (a hosting page on a local http server, build framed with sandbox="allow-scripts allow-same-origin"),
 *        iframe-nosave (sandbox="allow-scripts" only: an opaque origin, storage throws; the 2.4 line must show and the game must play on).
 * Each cell: open, hero select, one run on the engine's autoplay choices to the end screen (classes rotate across the cells),
 * storage check, no console error or warning, no request besides the build. The ui-regress screens are a separate script
 * (node qa/browser/ui-regress.mjs --file <build>); this one does not repeat them.
 */
import { FILE, FILE_URL, EXPECT, arg, flag, report, buildLine, availableBrowsers, serve, watch, clean, gameFrame, idle, view, startRun, playToSummary, setSpeed, CLASSES } from './lib.mjs';

const SIZES = arg('--sizes', '1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const MODES = arg('--modes', 'disk,iframe,iframe-nosave').split(',');
const CLS = arg('--classes', CLASSES.join(',')).split(',');
const SAVE_LINE = 'This browser window cannot save your progress.';
console.log(buildLine());
const { ok: engines, skipped } = await availableBrowsers();
for (const s of skipped) console.log(`SKIP browser ${s.name}: ${s.reason}`);
if (!engines.length) { console.log('no browser could be launched'); process.exit(2); }
for (const e of engines) console.log(`browser ${e.name} ${e.version}${e.name === 'chromium' ? ' (stands for Chrome and Edge, both Chromium)' : ''}`);

const srv = await serve();
const rows = []; let n = 0;
const scales = flag('--scale-row') ? [[1920, 1080, 1.25]] : [];
for (const eng of engines) {
  const browser = await eng.type.launch({ headless: true });
  for (const [W, H, dsf = 1] of [...SIZES.map(([w, h]) => [w, h, 1]), ...scales]) {
    for (const mode of MODES) {
      const cls = CLS[n++ % CLS.length];
      const cell = { browser: eng.name, size: `${W}x${H}${dsf !== 1 ? ` @${dsf}` : ''}`, mode, cls, reportOnly: dsf !== 1, ok: false, notes: [] };
      const t0 = Date.now();
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
      const page = await ctx.newPage(); cell.hostOrigin = srv.origin; watch(page, cell);
      try {
        if (mode === 'disk') await page.goto(FILE_URL);
        else await page.goto(`${srv.origin}/` + (mode === 'iframe' ? '?sandbox=allow-scripts%20allow-same-origin' : '?sandbox=allow-scripts'));
        const h = mode === 'disk' ? page : await (async () => { for (let i = 0; i < 100 && !gameFrame(page); i++) await page.waitForTimeout(50); return gameFrame(page); })();
        await h.waitForFunction(() => window.__ui, null, { timeout: 15000 }); await idle(h);
        cell.loadMs = Date.now() - t0;
        const store = await h.evaluate(() => { try { localStorage.setItem('qa.probe', '1'); const ok = localStorage.getItem('qa.probe') === '1'; localStorage.removeItem('qa.probe'); return ok; } catch { return false; } });
        const text = await h.evaluate(() => document.body.innerText);
        cell.storage = store; cell.saveLine = text.includes(SAVE_LINE);
        // fits the window: the game's own root must not be wider or taller than the viewport
        cell.fits = await h.evaluate(() => { const r = document.documentElement; return r.scrollWidth <= innerWidth + 1 && r.scrollHeight <= innerHeight + 1; });
        await setSpeed(h, 'Instant');
        await startRun(h, cell.cls);
        const r = await playToSummary(h);
        const v = await view(h);
        cell.ended = r.ended; cell.steps = r.n; cell.outcome = v.summary && v.summary.outcome; cell.demoBlock = !!(v.summary && v.summary.demo);
        const needSaveLine = mode === 'iframe-nosave';
        const storageOk = needSaveLine ? (!store && (cell.saveLine || EXPECT !== 'demo')) : store;
        if (needSaveLine && !cell.saveLine) cell.notes.push(EXPECT === 'demo' ? 'MISSING the 2.4 line in a window that cannot save' : 'no 2.4 line (full build has none; expected only in the demo)');
        if (EXPECT === 'demo' && !cell.demoBlock && r.ended) cell.notes.push('summary has no demo block');
        cell.ok = r.ended && storageOk && cell.fits && clean(cell) && cell.requests.length === 0 && (EXPECT !== 'demo' || (cell.outcome === 'demo' || cell.outcome === 'death') );
        if (!r.ended) cell.notes.push('run did not reach the end screen');
        if (!cell.fits) cell.notes.push('page scrolls at this window size');
        if (cell.requests.length) cell.notes.push(`requests: ${cell.requests.slice(0, 3).join(' ')}`);
      } catch (e) { cell.notes.push(`exception: ${String(e.message).split('\n')[0]}`); }
      cell.ms = Date.now() - t0;
      await ctx.close();
      rows.push(cell);
      console.log(`${cell.ok ? 'PASS' : 'FAIL'}${cell.reportOnly ? ' (report-only)' : ''} ${cell.browser} ${cell.size} ${cell.mode} ${cell.cls}: outcome ${cell.outcome}, ${cell.steps} steps, load ${cell.loadMs} ms, storage ${cell.storage}, 2.4 line ${cell.saveLine}, console errors ${cell.errors.length + cell.pageErrors.length}, warnings ${cell.warnings.length}${cell.notes.length ? ' | ' + cell.notes.join('; ') : ''}`);
    }
  }
  await browser.close();
}
await srv.close();
const bad = rows.filter((r) => !r.ok && !r.reportOnly);
console.log(`\nmatrix: ${rows.length - bad.length}/${rows.length} cells pass; skipped browsers: ${skipped.map((s) => s.name).join(', ') || 'none'}`);
report('matrix', { rows, skipped: skipped, engines: engines.map((e) => `${e.name} ${e.version}`) });
process.exit(bad.length ? 1 : 0);
