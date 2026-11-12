#!/usr/bin/env node
/**
 * qa/browser/canvas-shot.mjs - the pixels of the scene canvas (#world) in fixed states, with time and randomness under
 * control, to prove that a palette refactor changed no canvas pixel. Track R step R3 (docs/reviews/ui-architecture-
 * 2026-11-12.md, section 3; D119). The style snapshot (style-snapshot.mjs) reads the DOM; this reads the canvas.
 *
 *   node tools/build.mjs --out /tmp/ui-game.html
 *   node qa/browser/canvas-shot.mjs [--file /tmp/ui-game.html] [--out /tmp/canvas-shot] [--size 1366x768] [--states a,b]
 *                                   [--theme lantern]
 *   node qa/browser/canvas-shot.mjs --compare dirA dirB
 *
 * Shot: each state in a fresh context. Math.random is a fixed-seed generator and the page clock is Playwright's fake
 * clock, paused from the start: timers, requestAnimationFrame and performance.now advance only in the script's steps
 * (STEP_MS at a time), so the frame loop, particles, idle motion and the director's waits run the same way on every
 * run. The state is reached with the Dev menu's ops (window.__ui.dev), the clock is run on until the director is idle,
 * then SETTLE_MS more, and the canvas is read with getImageData: <state>.rgba (raw), <state>.png (to look at) and a
 * SHA-256 in shots.json.
 *
 * Compare: one line per state that differs (pixels changed, largest channel difference, bounding box) and nothing when
 * every state is equal; a summary on stderr. Exit 0 when equal, 1 when not, 2 on a usage error.
 * Playwright comes from /home/claude/tools-ui, a local install or /opt/npm-tools/node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const STEP_MS = 50; // clock step while waiting for the game
const SETTLE_MS = 1500; // clock run after the director is idle, before the read
const ELITE = 'z2_bargh'; // zone 2 elite with a heavy Deathblow (as ui-regress part P and the style snapshot)

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url, '/opt/npm-tools/node_modules/package.json', '/opt/npm-tools/package.json']) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found (looked in /home/claude/tools-ui, next to this file and in /opt/npm-tools)');
}

// ------------------------------------------------------------------ compare
if (args.includes('--compare')) {
  const i = args.indexOf('--compare'); const [a, b] = [args[i + 1], args[i + 2]];
  if (!a || !b) { console.error('usage: node qa/browser/canvas-shot.mjs --compare dirA dirB'); process.exit(2); }
  const ja = JSON.parse(fs.readFileSync(path.join(a, 'shots.json'), 'utf8'));
  const jb = JSON.parse(fs.readFileSync(path.join(b, 'shots.json'), 'utf8'));
  let diff = 0; let n = 0;
  for (const name of new Set([...Object.keys(ja.states), ...Object.keys(jb.states)])) {
    const sa = ja.states[name]; const sb = jb.states[name]; n++;
    if (!sa || !sb) { console.log(`${name}: only in ${sa ? a : b}`); diff++; continue; }
    if (sa.sha256 === sb.sha256) continue;
    diff++;
    if (sa.w !== sb.w || sa.h !== sb.h) { console.log(`${name}: size ${sa.w}x${sa.h} -> ${sb.w}x${sb.h}`); continue; }
    const pa = fs.readFileSync(path.join(a, `${name}.rgba`)); const pb = fs.readFileSync(path.join(b, `${name}.rgba`));
    let px = 0; let max = 0; let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
    for (let p = 0; p < pa.length; p += 4) {
      const d = Math.max(Math.abs(pa[p] - pb[p]), Math.abs(pa[p + 1] - pb[p + 1]), Math.abs(pa[p + 2] - pb[p + 2]), Math.abs(pa[p + 3] - pb[p + 3]));
      if (!d) continue;
      px++; if (d > max) max = d;
      const x = (p / 4) % sa.w; const y = Math.floor(p / 4 / sa.w);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    console.log(`${name}: ${px} pixels differ (largest channel difference ${max}), box ${x0},${y0} to ${x1},${y1}`);
  }
  console.error(`${n} states compared, ${diff} differ`);
  process.exit(diff ? 1 : 0);
}

// ------------------------------------------------------------------ shots
const FILE = path.resolve(arg('--file', 'game.html'));
const OUT = path.resolve(arg('--out', '/tmp/canvas-shot'));
const [W, H] = arg('--size', '1366x768').split('x').map(Number);
const THEME = arg('--theme', null);

/** Each state: the page query and the Dev ops that reach it (run without waiting; the script runs the clock). */
const STATES = {
  'class-select': { query: 'seed=7', ops: [] },
  'engage-deathblow': { query: 'seed=5&classic=1', ops: [['build', { classId: 'hunter', zone: 2 }], ['fight', { ids: [ELITE] }]] },
  'mage-fight': { query: 'seed=5&classic=1', ops: [['build', { classId: 'mage', zone: 3 }], ['fight', { ids: [ELITE] }]] },
  'zone1-travel': { query: 'seed=5&classic=1', ops: [['build', { classId: 'warrior', zone: 1 }]] },
  // the Deathblow lands (key X passes each round): its floats, the MAIMED flash and the hero's aura, read 400 ms on
  maimed: { query: 'seed=5&classic=1', settle: 400, ops: [['build', { classId: 'hunter', zone: 2 }], ['fight', { ids: [ELITE] }], ['key', 'KeyX'], ['key', 'KeyX']] },
  // a mage round at normal speed, read 700 ms into it: projectiles, school glows and floats in flight
  'mage-round': { query: 'seed=5&classic=1', speed: 'normal', settle: 700, noWait: true, ops: [['build', { classId: 'mage', zone: 3 }], ['fight', { ids: [ELITE] }], ['key', 'KeyX'], ['key', 'Digit1']] },
};
const pick = arg('--states', null);
const names = pick ? pick.split(',') : Object.keys(STATES);

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const out = { file: FILE, size: `${W}x${H}`, theme: THEME || 'default', states: {} };
const errors = [];
try {
  for (const name of names) {
    const st = STATES[name]; if (!st) throw new Error(`unknown state ${name}`);
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await context.addInitScript(() => {
      let s = 0x2f6b9d1; // mulberry32
      Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: console: ${m.text()}`); });
    await page.clock.install({ time: new Date('2026-11-12T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-12T12:00:01Z'));
    const q = `${st.query}${st.speed ? '' : '&speed=instant'}${THEME ? `&theme=${THEME}` : ''}`;
    await page.goto(`${pathToFileURL(FILE).href}?${q}`, { waitUntil: 'load' });
    const run = async (ms) => { for (let t = 0; t < ms; t += STEP_MS) await page.clock.runFor(STEP_MS); };
    const ready = async () => {
      for (let i = 0; i < 400; i++) {
        const ok = await page.evaluate(() => !!(window.__ui && window.__ui.view) && window.__devDone !== false && !window.__ui.playingEvent());
        if (ok) return; await run(STEP_MS);
      }
      throw new Error(`${name}: the game did not become idle`);
    };
    await run(500); await ready();
    for (const [k, [op, a]] of st.ops.entries()) {
      if (op === 'key') await page.keyboard.press(a);
      else await page.evaluate(([o, x]) => { window.__devDone = false; Promise.resolve(window.__ui.dev(o, x)).finally(() => { window.__devDone = true; }); }, [op, a]);
      if (st.noWait && k === st.ops.length - 1) break;
      await run(1000); await ready();
    }
    await run(st.settle ?? SETTLE_MS);
    const shot = await page.evaluate(() => {
      const cv = document.getElementById('world');
      const c = cv.getContext('2d'); const d = c.getImageData(0, 0, cv.width, cv.height).data;
      let bin = ''; for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
      return { w: cv.width, h: cv.height, rgba: btoa(bin), png: cv.toDataURL('image/png'), theme: document.documentElement.dataset.theme || 'current' };
    });
    const rgba = Buffer.from(shot.rgba, 'base64');
    fs.writeFileSync(path.join(OUT, `${name}.rgba`), rgba);
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.png.split(',')[1], 'base64'));
    out.states[name] = { w: shot.w, h: shot.h, theme: shot.theme, sha256: crypto.createHash('sha256').update(rgba).digest('hex') };
    console.error(`${name}: ${shot.w}x${shot.h} ${shot.theme} ${out.states[name].sha256.slice(0, 16)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
out.errors = errors;
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(out, null, 1));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
