#!/usr/bin/env node
/**
 * qa/browser/demo/long-session.mjs - the long session (docs/specs/demo.md 5.4): one tab, scripted play, at least 8 runs.
 *
 *   node qa/browser/demo/long-session.mjs [--file demo.html] [--minutes 120] [--min-runs 8] [--max-runs 40] [--speed instant|1|2|4]
 *        [--size 1920x1080] [--json out.json]
 *
 * "120 minutes of scripted play" is counted in pace minutes: each finished run adds the summary's own estimate of its autoplay
 * play time (summary.estMinutes.auto, the same figure the player sees); the session ends when the sum reaches --minutes and
 * at least --min-runs runs are done (the demo's cap is met within that: the harness records every hero's level at each run end).
 * The session is played at --speed (default instant: a pass at normal speed would take the 120 minutes in real time; run it with
 * --speed 1 --max-runs 8 for the real-time pass, or --speed 4 for the fast-speed pass). Classes rotate rogue, mage, hunter in
 * one browser profile, so heroes and Legacy carry over run after run exactly as in a player's tab.
 * Pass: no console error or warning; JS heap after a forced GC at the end at most 1.5x the heap after the first run; DOM node
 * count at the end at most 1.2x after the first run (both read at hero select); the bridge's per-run log (window.__ui.engineLog)
 * is cleared at each run start (its length at the start of run N stays within a small constant of run 1's).
 */
import { reloadKeep, FILE_URL, EXPECT, arg, report, buildLine, chromium, idle, view, startRun, playToSummary, endRun, setSpeed, memory, watch, clean, CLASSES } from './lib.mjs';

const MIN = Number(arg('--minutes', '120')), MINRUNS = Number(arg('--min-runs', '8')), MAXRUNS = Number(arg('--max-runs', '40'));
const SPEED = { instant: 'Instant', 1: '1×', 2: '2×', 4: '4×' }[arg('--speed', 'instant')] || 'Instant';
const [W, H] = arg('--size', '1920x1080').split('x').map(Number);
const LIM = { heap: 1.5, dom: 1.2 };
console.log(buildLine());
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H } }); const page = await ctx.newPage(); const res = watch(page);
await page.goto(FILE_URL); await page.waitForFunction(() => window.__ui); await idle(page);
await setSpeed(page, SPEED);
const runs = []; let pace = 0; let mem1 = null; const t0 = Date.now();
for (let n = 0; n < MAXRUNS && (pace < MIN || n < MINRUNS); n++) {
  const cls = CLASSES[n % CLASSES.length];
  await startRun(page, cls);
  const logStart = await page.evaluate(() => window.__ui.engineLog().length);
  const r = await playToSummary(page);
  const v = await view(page);
  const row = { run: n + 1, cls, ended: r.ended, steps: r.n, outcome: v.summary && v.summary.outcome, paceMin: v.summary && v.summary.est ? v.summary.est.auto : null, level: v.summary && v.summary.level, hero: v.summary && v.summary.hero, logStart, logEnd: await page.evaluate(() => window.__ui.engineLog().length) };
  if (!r.ended) { row.stuck = true; runs.push(row); console.log(`run ${row.run} ${cls}: DID NOT END after ${r.n} steps`); break; }
  pace += row.paceMin || 0;
  await endRun(page); await idle(page);
  const heroes = await page.evaluate(() => { const m = window.__ui.view().meta; return m && m.heroes ? JSON.parse(JSON.stringify(m.heroes)) : null; });
  row.heroes = heroes;
  row.mem = await memory(page); if (n === 0) mem1 = row.mem;
  runs.push(row);
  console.log(`run ${row.run} ${cls}: ${row.outcome}, ${r.n} steps, ${row.paceMin} pace min (sum ${pace}), summary level ${row.level}, log at start ${logStart}, ${((Date.now() - t0) / 1000).toFixed(0)} s elapsed`);
}
const memN = await memory(page);
// diagnostic: the same storage in a fresh page. Nodes that are only there in the long-lived tab are a leak; the rest is content (heroes, run log, hall rows).
const nodesLive = memN && memN.nodes; await reloadKeep(page); await idle(page); const memFresh = await memory(page);
const out = { runs, paceMinutes: pace, speed: SPEED, mem1, memN, memFresh, console: { errors: res.errors, warnings: res.warnings, pageErrors: res.pageErrors } };
const checks = [];
const check = (name, ok, text) => { checks.push({ name, ok, text }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${text}`); };
check('session length', runs.length >= MINRUNS && runs.every((r) => r.ended) && pace >= MIN, `${runs.length} runs, ${pace} pace minutes (need >= ${MINRUNS} runs, >= ${MIN} min), speed ${SPEED}, ${((Date.now() - t0) / 60000).toFixed(1)} real min`);
check('console clean', clean(res), `${res.errors.length} errors, ${res.warnings.length} warnings, ${res.pageErrors.length} page errors${res.errors.length ? ': ' + res.errors[0] : ''}`);
if (mem1 && memN) {
  check('heap at the end vs after run 1', memN.heapMB <= LIM.heap * mem1.heapMB, `${mem1.heapMB.toFixed(1)} MB -> ${memN.heapMB.toFixed(1)} MB = ${(memN.heapMB / mem1.heapMB).toFixed(2)}x (limit ${LIM.heap}x)`);
  check('DOM nodes at the end vs after run 1', memN.nodes <= LIM.dom * mem1.nodes, `${mem1.nodes} -> ${memN.nodes} = ${(memN.nodes / mem1.nodes).toFixed(2)}x (limit ${LIM.dom}x)`);
}
if (memFresh) console.log(`info: DOM nodes at hero select per run: ${runs.map((r) => r.mem && r.mem.nodes).join(', ')} (elements in the document: ${runs.map((r) => r.mem && r.mem.dom).join(', ')}); the same storage in a fresh page: ${memFresh.nodes} nodes (${memFresh.dom} elements), ${memFresh.heapMB.toFixed(1)} MB, ${memFresh.listeners} listeners (long tab: ${nodesLive} nodes, ${memN.listeners} listeners)`);
const starts = runs.map((r) => r.logStart);
check("bridge's per-run log cleared at each run start", Math.max(...starts) <= starts[0] * 2 + 20, `engineLog length at the start of each run: ${starts.join(', ')}`);
const top = Math.max(...runs.map((r) => (r.hero && r.hero.level) || 0));
console.log(`info: highest hero level in a run summary ${top}${EXPECT === 'demo' ? ' (cap 7: expect it to reach 7 and stop)' : ' (full build: no demo cap)'}`);
if (EXPECT === 'demo') check('demo cap reached and held', top === 7, `highest hero level ${top} (expect exactly 7)`);
out.checks = checks;
await browser.close();
report('long-session', out);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
