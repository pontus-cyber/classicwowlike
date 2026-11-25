/**
 * qa/browser/demo/lib.mjs - shared helpers of the demo stability harness (docs/specs/demo.md 5.2-5.4, MD D.6).
 *
 * Every script of this folder takes --file <build> (default: the worktree's game.html; the demo build is demo.html) and
 * drives the page only through the game's own test API (window.__ui: view, act, autoChoice, idle) and its real controls
 * (class cards, "Enter the world"). Nothing here reads src/: the same scripts run on game.html and on demo.html.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
export const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
export const flag = (k) => args.includes(k);

export const FILE = path.resolve(arg('--file', path.join(REPO, 'game.html')));
if (!fs.existsSync(FILE)) { console.error(`no build at ${FILE}: node tools/build.mjs [--demo] --out <file>, then --file <file>`); process.exit(2); }
export const FILE_URL = pathToFileURL(FILE).href;
/** 'demo' when the file is named demo*.html or --expect demo; else 'full'. Decides what a pass means in fuzz.mjs and the demo-only checks. */
export const EXPECT = arg('--expect', /demo/i.test(path.basename(FILE)) ? 'demo' : 'full');
export const OUT_JSON = arg('--json', null);

export function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url]) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found (looked in /home/claude/tools-ui and next to this file)');
}
const PW = loadPlaywright();

/** The engines Playwright can launch here. Chromium stands for Chrome and Edge (Edge is Chromium-based); firefox and webkit
 *  (the stand-in for Safari) run when their executables are installed and are reported as skipped, with the reason, when not. */
export async function availableBrowsers(want = (arg('--browsers', 'chromium,firefox,webkit')).split(',')) {
  const ok = []; const skipped = [];
  for (const name of want) {
    try { const b = await PW[name].launch({ headless: true }); const version = b.version(); await b.close(); ok.push({ name, type: PW[name], version }); }
    catch (e) { skipped.push({ name, reason: String(e.message).split('\n')[0].replace(/\s+/g, ' ').slice(0, 160) }); }
  }
  return { ok, skipped };
}
export const chromium = PW.chromium;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const pct = (arr, p) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)]; };
export const median = (arr) => pct(arr, 0.5);

/** Console collector for a page: errors and warnings (spec 5.2: none from game code), page errors, requests besides the file. */
export function watch(page, res = {}) {
  Object.assign(res, { console: [], errors: [], warnings: [], pageErrors: [], requests: [], failed: [] });
  page.on('console', (m) => {
    const t = m.type(); const line = `${t}: ${m.text()}`.slice(0, 300);
    if (/An iframe which has both allow-scripts and allow-same-origin/.test(line)) return; // the hosting page's own sandbox warning, not game code
    if (t === 'error') res.errors.push(line); else if (t === 'warning') res.warnings.push(line);
  });
  page.on('pageerror', (e) => res.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('request', (r) => { const u = r.url(); if (u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') return; if (u.split('?')[0] === FILE_URL) return; if (res.hostOrigin && (u.startsWith(res.hostOrigin + '/?') || u === res.hostOrigin + '/' || u.startsWith(res.hostOrigin + '/game.html'))) return; res.requests.push(u); });
  page.on('requestfailed', (r) => { const u = r.url(); if (!u.startsWith('data:')) res.failed.push(`${u} ${r.failure() && r.failure().errorText}`); });
  return res;
}
export const clean = (res) => !res.errors.length && !res.warnings.length && !res.pageErrors.length && !res.failed.length;

/**
 * reloadKeep(page): page.reload() that makes sure localStorage and sessionStorage survived (qa/team/qa.md, qa-2026-11-19:
 * headless Chromium sometimes starts a reloaded page with empty storage). Same logic as qa/browser/ui-regress.mjs (that file
 * is a script and cannot be imported). `where` is a Page; for an iframe the top page is reloaded and the frame found again by
 * the caller. Returns how many times storage had to be put back (reported, not hidden).
 */
export async function reloadKeep(page, ready = () => !!window.__ui) {
  const token = `${Date.now()}-${Math.random()}`;
  const snap = await page.evaluate((t) => {
    const all = (st) => Object.fromEntries(Object.keys(st).map((k) => [k, st.getItem(k)]));
    localStorage.setItem('qa.reload', t); sessionStorage.setItem('qa.reload', t); return { local: all(localStorage), session: all(sessionStorage) };
  }, token);
  let dropped = 0;
  for (let n = 0; n < 3; n++) {
    await page.reload(); await page.waitForFunction(ready);
    const kept = await page.evaluate((t) => localStorage.getItem('qa.reload') === t && sessionStorage.getItem('qa.reload') === t, token);
    if (kept) break;
    dropped += 1;
    await page.evaluate((x) => { localStorage.clear(); sessionStorage.clear(); for (const [k, v] of Object.entries(x.local)) localStorage.setItem(k, v); for (const [k, v] of Object.entries(x.session)) sessionStorage.setItem(k, v); }, snap);
  }
  await page.evaluate(() => { localStorage.removeItem('qa.reload'); sessionStorage.removeItem('qa.reload'); });
  return dropped;
}

/** A local web server for the "inside an iframe" cell: / is a hosting page that frames /game.html. Plain http on 127.0.0.1
 *  (no certificate here), the closest local stand-in for an https hosting page; the iframe is cross-origin from nothing and
 *  same-origin with the build, as on a host that serves both. `sandbox` adds a sandbox attribute (itch.io-style:
 *  "allow-scripts allow-same-origin" keeps storage; "allow-scripts" alone gives an opaque origin and blocks it). */
export async function serve(buildFile = FILE) {
  const html = fs.readFileSync(buildFile);
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/game.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return; }
    if (u.pathname === '/') {
      const sb = u.searchParams.get('sandbox'); const q = u.searchParams.get('q') || '';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><title>host page</title><style>html,body{margin:0;height:100%;background:#222}iframe{border:0;width:100%;height:100%}</style>` +
        `<iframe id="g" src="/game.html${q}" ${sb ? `sandbox="${sb}"` : ''} allow="autoplay; fullscreen"></iframe>`);
      return;
    }
    res.writeHead(404); res.end('no');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

/** A "handle" is the Page or the Frame that holds the game; both have evaluate, locator, getByRole and waitForFunction. */
export const gameFrame = (page) => page.frames().find((f) => f !== page.mainFrame() && /game\.html/.test(f.url())) || null;
export const idle = (h) => h.evaluate(() => window.__ui.idle());
export const view = (h) => h.evaluate(() => {
  const v = window.__ui.view(); let f = null; try { f = JSON.parse(window.__ui.state()).fight; } catch { /* no state */ }
  const lines = [];
  return { phase: v.phase, zoneIdx: v.zone ? v.zone.idx : null, camp: !!(v.zone && v.zone.camp), summary: v.summary ? { outcome: v.summary.outcome, reachedCamp: !!v.summary.reachedCamp, reachedBoss: !!v.summary.reachedBoss, est: v.summary.estMinutes, level: v.summary.level, hero: v.summary.hero || null, demo: v.summary.demo || null } : null,
    round: f ? f.round : null, over: false, enemies: v.combat && !f ? [] : (f && f.enemies ? f.enemies.map((e) => e.name || e.id || '') : []), loot: !!v.loot, level: v.player ? v.player.level : null, meta: v.meta ? { echoes: v.meta.echoes, guided: v.meta.guided, guide: v.meta.guide, runs: v.meta.runs, heroes: v.meta.heroes } : null, lines };
});

export const CLASSES = ['rogue', 'mage', 'hunter'];

/** Class card, then "Enter the world" (the real controls); the page must be on hero select. */
export async function startRun(h, cls, { seed = null } = {}) {
  await h.waitForSelector(`#create .ccard[data-cls="${cls}"]`, { state: 'visible' });
  await h.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle(h);
  if (seed != null) await h.evaluate((s) => window.__ui.act({ type: 'SET_SEED', seed: String(s) }), seed);
  await h.getByRole('button', { name: 'Enter the world' }).click(); await idle(h);
}

/** The labels of the intro dialog's button by node type (qa/browser/full-run.mjs). A fight's intro is read before the fight is shown. */
const INTRO = ['Accept', 'Engage', 'Enter the dungeon', 'Fight the guardian'];
/** One engine-autoplay step through the page's own action path (what the autoplay switch would send). When a node's intro dialog
 *  is up, the step is a click on its button, as a player's first move; the next call then plays the fight. */
export async function autoStep(h) {
  const intro = await h.evaluate(() => { const x = window.__ui.view(); const s = JSON.parse(window.__ui.state()); return !x.summary && x.node && x.node.step === 'intro' && !!s.fight; });
  if (intro) {
    for (const label of INTRO) {
      const b = h.getByRole('button', { name: label, exact: true });
      if (await b.count() && await b.first().isVisible()) { await b.first().click({ timeout: 5000 }); await idle(h); return { done: false, type: `intro:${label}`, ok: true }; }
    }
  }
  return h.evaluate(async () => {
    const x = window.__ui.view(); if (x.summary) return { done: true };
    const a = window.__ui.autoChoice(); const r = await window.__ui.act(a); await window.__ui.idle();
    return { done: false, type: a && a.action ? a.action.type : a && a.type, ok: !!(r && r.ok) };
  });
}

/** Play the run in progress to its summary on the engine's autoplay choices. `onStep(view, stepResult, n)` may stop early by returning true. */
export async function playToSummary(h, { max = 6000, onStep = null } = {}) {
  let n = 0;
  for (; n < max; n++) {
    const r = await autoStep(h);
    if (r.done) return { n, ended: true };
    if (onStep && await onStep(r, n)) return { n, ended: false };
  }
  return { n, ended: false, stuck: true };
}

/** The summary screen's own button (END_RUN: back to hero select). */
export async function endRun(h) { await h.evaluate(async () => { await window.__ui.act({ type: 'END_RUN' }); await window.__ui.idle(); }); }

/** Heap and DOM size of a Chromium page after a forced GC (CDP). null on engines without CDP. */
export async function memory(page) {
  let cdp; try { cdp = await page.context().newCDPSession(page); } catch { return null; }
  try {
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('Performance.enable');
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    const dom = await page.evaluate(() => document.getElementsByTagName('*').length).catch(() => null); // attached elements; nodes - dom is detached or text/comment nodes
    return { heapMB: m.JSHeapUsedSize / 1048576, nodes: m.Nodes, dom, listeners: m.JSEventListeners };
  } finally { await cdp.detach().catch(() => {}); }
}

export function report(name, res) {
  if (OUT_JSON) { fs.mkdirSync(path.dirname(path.resolve(OUT_JSON)), { recursive: true }); fs.writeFileSync(path.resolve(OUT_JSON), JSON.stringify({ script: name, file: FILE, expect: EXPECT, ...res }, null, 1)); }
}
export const buildLine = () => `build: ${FILE} (${(fs.statSync(FILE).size / 1048576).toFixed(2)} MB, ${new Date(fs.statSync(FILE).mtimeMs).toISOString().slice(0, 16)}), expect: ${EXPECT}`;

/** Animation speed through the Settings window's own buttons (the demo build reads no URL parameter, so ?speed= is not used).
 *  label: 'Instant', '4×', '2×' or '1×'. The setting is stored, so it survives a reload. */
export async function setSpeed(h, label) {
  await h.evaluate(() => window.__ui.openWin('settings'));
  await h.locator('#windows .seg button', { hasText: label }).first().click();
  await h.evaluate(() => window.__ui.closeWins()); await idle(h);
}

/** Frame times (ms between requestAnimationFrame callbacks) over `ms` milliseconds of whatever the page is doing. */
export function sampleFrames(h, ms) {
  return h.evaluate((dur) => new Promise((resolve) => {
    const d = []; let last = performance.now(); const t0 = last;
    const tick = (t) => { d.push(t - last); last = t; if (t - t0 < dur) requestAnimationFrame(tick); else resolve(d.slice(1)); };
    requestAnimationFrame(tick);
  }), ms);
}
