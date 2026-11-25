#!/usr/bin/env node
/**
 * qa/browser/demo/perf.mjs - load time, file size and frame time (docs/specs/demo.md 5.4).
 *
 *   node qa/browser/demo/perf.mjs [--file demo.html] [--loads 5] [--throttle 4] [--sample-s 6] [--class mage] [--json out.json]
 *
 * - file size at most DEMO_FILE_MB_MAX (3) MB (MiB: 3 * 1048576 bytes);
 * - load to hero select from disk at most DEMO_LOAD_S (3) s: --loads fresh browser contexts, the slowest counts (also reports the median);
 * - frame time p95 at most DEMO_FRAME_P95_MS (20) ms on the map and in fights at 1920x1080 at 1x animation speed, in headless Chromium
 *   with 4x CPU throttling (CDP Emulation.setCPUThrottlingRate) as the stand-in for a mid laptop. Frames are requestAnimationFrame
 *   intervals sampled for --sample-s seconds: on the map with nothing moving, in a fight between rounds with nothing playing
 *   (idle fight), and in a fight with autoplay playing its rounds at 1x. Chromium only (CDP). The owner's own machine in D.8 is
 *   the real check.
 * - "nothing moving" (D175): before the map and idle-fight samples the page is given up to --settle-s seconds to come to rest
 *   (the hero walks to the map's mark first; on a slow machine that takes several seconds of frames). A build with the scene
 *   hook window.__ui.sceneFrames ends the wait as soon as its canvas holds still (stale); a build without it waits the full time.
 */
import fs from 'node:fs';
import { FILE, FILE_URL, EXPECT, arg, report, buildLine, chromium, idle, view, startRun, autoStep, setSpeed, sampleFrames, pct, median, watch, clean } from './lib.mjs';

const LOADS = Number(arg('--loads', '5')), THROTTLE = Number(arg('--throttle', '4')), SAMPLE = Number(arg('--sample-s', '6')) * 1000, CLS = arg('--class', 'mage');
const SETTLE = Number(arg('--settle-s', '20')) * 1000;
const LIM = { fileMB: 3, loadS: 3, frameMs: 20 };
console.log(buildLine());
const out = { checks: [] };
const check = (name, ok, text) => { out.checks.push({ name, ok, text }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${text}`); };

const bytes = fs.statSync(FILE).size;
check('file size', bytes <= LIM.fileMB * 1048576, `${(bytes / 1048576).toFixed(2)} MB (limit ${LIM.fileMB} MB)`);

const browser = await chromium.launch({ headless: true });
// load: a fresh context each time (no cache, no storage), hero select visible
const loads = [];
for (let i = 0; i < LOADS; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage();
  const t0 = Date.now(); await page.goto(FILE_URL); await page.waitForSelector('#create .ccard', { state: 'visible', timeout: 30000 }); loads.push((Date.now() - t0) / 1000);
  await ctx.close();
}
out.loads = loads;
check('load to hero select (disk)', Math.max(...loads) <= LIM.loadS, `slowest ${Math.max(...loads).toFixed(2)} s, median ${median(loads).toFixed(2)} s over ${LOADS} loads (limit ${LIM.loadS} s)`);

// frames: 1920x1080, 4x CPU throttling, 1x animation speed
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } }); const page = await ctx.newPage(); const res = watch(page);
await page.goto(FILE_URL); await page.waitForFunction(() => window.__ui); await idle(page);
await setSpeed(page, 'Instant'); // travel to the map and the fight fast, sample at 1x
const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
await startRun(page, CLS);
let v = await view(page);
for (let i = 0; i < 80 && v.phase !== 'MAP'; i++) { await autoStep(page); v = await view(page); }
const mapOk = v.phase === 'MAP';
/** Wait until the scene holds still (window.__ui.sceneFrames().stale), at most SETTLE ms; the full SETTLE on a build without the hook. Returns ms waited. */
const settle = async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < SETTLE) { if (await page.evaluate(() => !!(window.__ui.sceneFrames && window.__ui.sceneFrames().stale))) break; await page.waitForTimeout(250); }
  return Date.now() - t0;
};
if (mapOk) { await setSpeed(page, '1×'); out.mapSettleMs = await settle(); }
const map = mapOk ? await sampleFrames(page, SAMPLE) : [];
await setSpeed(page, 'Instant');
// into a fight (past its intro dialog): first between rounds with nothing playing, then autoplay at 1x
let fightOk = false;
for (let i = 0; i < 200 && !fightOk; i++) { v = await view(page); if (v.round >= 1 && !v.over && !(await page.evaluate(() => { const x = window.__ui.view(); return !!(x.node && x.node.step === 'intro'); }))) { fightOk = true; break; } await autoStep(page); }
let fight = []; let idleFight = [];
if (fightOk) {
  await setSpeed(page, '1×');
  out.idleFightSettleMs = await settle();
  idleFight = await sampleFrames(page, SAMPLE);
  await page.evaluate(() => window.__ui.act({ type: 'SET_AUTOPLAY', on: true }));
  fight = await sampleFrames(page, SAMPLE);
  const inFight = await page.evaluate(() => { const x = window.__ui.view(); return !!(x.combat && !x.combat.over) || x.phase === 'NODE'; });
  out.fightStillOn = inFight;
}
const stat = (a) => ({ n: a.length, p50: +pct(a, 0.5).toFixed(1), p95: +pct(a, 0.95).toFixed(1), p99: +pct(a, 0.99).toFixed(1), max: +Math.max(...a).toFixed(1) });
out.map = map.length ? stat(map) : null; out.idleFight = idleFight.length ? stat(idleFight) : null; out.fight = fight.length ? stat(fight) : null;
check('frame time p95, map', !!out.map && out.map.p95 <= LIM.frameMs, out.map ? `p95 ${out.map.p95} ms (p50 ${out.map.p50}, p99 ${out.map.p99}, max ${out.map.max}, ${out.map.n} frames; limit ${LIM.frameMs} ms)` : 'map not reached');
check('frame time p95, idle fight', !!out.idleFight && out.idleFight.p95 <= LIM.frameMs, out.idleFight ? `p95 ${out.idleFight.p95} ms (p50 ${out.idleFight.p50}, p99 ${out.idleFight.p99}, max ${out.idleFight.max}, ${out.idleFight.n} frames; limit ${LIM.frameMs} ms)` : 'no fight reached');
check('frame time p95, fight', !!out.fight && out.fight.p95 <= LIM.frameMs, out.fight ? `p95 ${out.fight.p95} ms (p50 ${out.fight.p50}, p99 ${out.fight.p99}, max ${out.fight.max}, ${out.fight.n} frames; limit ${LIM.frameMs} ms)` : 'no fight reached');
check('no console error or warning during the frame samples', clean(res), `${res.errors.length} errors, ${res.warnings.length} warnings, ${res.pageErrors.length} page errors`);
await browser.close();
report('perf', out);
process.exit(out.checks.every((c) => c.ok) ? 0 : 1);
