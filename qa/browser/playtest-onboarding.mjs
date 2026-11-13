#!/usr/bin/env node
/**
 * qa/browser/playtest-onboarding.mjs - the M3 new-player playtest checklist (docs/specs/m3-onboarding.md 7.2) as a scripted
 * Playwright session per class, played as a new player would: a fresh browser profile (no storage), the guide on, the
 * hints on, real engine at Instant speed.
 *
 *   node tools/build.mjs --out /tmp/qa-game.html
 *   node qa/browser/playtest-onboarding.mjs [--file /tmp/qa-game.html] [--classes rogue,mage,hunter] [--size 1366x768]
 *        [--seed 7] [--shots /tmp/qa/onb] [--json /tmp/qa/onb.json] [--max-steps 3000]
 *
 * The player follows the coach line: in a fight, a line with a key chip (1, Q, W, E, X, 8) is answered by pressing that key
 * once (the first key the line names); a key that changes nothing is logged and the engine's choice (AUTO) is taken. Every
 * other decision is the engine's autoplay choice (AUTO), as the twin in ui-regress part R. Recorded per class:
 * - every coach line shown (id, text, steps on screen, how it left: Got it, done, gave way), a screenshot at its first showing;
 * - what it overlapped (the bar, the engage buttons, the Furnace, the target frame, Set out, its anchor) and how many other
 *   panels were open with it (clutter: toasts, windows, the loot window, the quest dialog, the tooltip);
 * - steps and tolls to leave zone 1 (ONB1), rescues (ONB2), keys from a line that did nothing;
 * - the five questions of 7.2 as "taught on screen": the beat or hint lines that answer each were shown;
 * - after the run: the summary's welcome line and nudge, clicks from the summary to Packed Satchel bought;
 * - the second run: H10 (the free potion) in its first fight, and the Guided first run toggle no longer offered.
 * Exit 1 on a console error, a page error or a session that does not reach zone 2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/qa-game.html'));
if (!fs.existsSync(FILE)) { console.error(`no build at ${FILE}: node tools/build.mjs --out ${FILE}`); process.exit(2); }
const CLASSES = arg('--classes', 'rogue,mage,hunter').split(',');
const [W, H] = arg('--size', '1366x768').split('x').map(Number);
const SEED = Number(arg('--seed', '7'));
const SHOTS = arg('--shots', null);
const JSON_OUT = arg('--json', null);
const MAX_STEPS = Number(arg('--max-steps', '3000'));
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const URL = pathToFileURL(FILE).href;

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url, '/opt/npm-tools/node_modules/package.json']) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const { chromium } = loadPlaywright();

const KEY_CODE = { 1: 'Digit1', 2: 'Digit2', 8: 'Digit8', Q: 'KeyQ', W: 'KeyW', E: 'KeyE', X: 'KeyX' };
// the 7.2 questions and the lines that teach them (beat or the hint it stands in for)
const QUESTIONS = [
  ['Q1 icons above an enemy', ['G6', 'H02']],
  ['Q2 round 1, Q/W/E', ['G7', 'H01']],
  ['Q3 Deathblow and the class answer', ['G9', 'H04']],
  ['Q4 the Furnace and the Star\'s line', ['G5', 'H16']],
  ['Q5 the Dimming and the two ways out', ['G12', 'H18'], ['G13', 'H19']],
];

const idle = (page) => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
const state = (page) => page.evaluate(() => {
  const v = window.__ui.view(); const c = window.__ui.coach();
  const vis = (q) => [...document.querySelectorAll(q)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('.hidden') && getComputedStyle(e).visibility !== 'hidden'; });
  const coachEl = document.getElementById('coach');
  const coachRect = coachEl && !coachEl.classList.contains('hidden') ? coachEl.getBoundingClientRect() : null;
  const over = [];
  if (coachRect) {
    const sel = { bar: '#actionbar', engage: '#engage .eg-opt, #engage button', furnace: '#heat', target: '#target-frame', setOut: '#pp-go', anchor: '.coach-on', loot: '#screens .loot', dialog: '#screens .node-intro, #screens .dialog' };
    for (const [k, q] of Object.entries(sel)) for (const x of vis(q)) { const b = x.getBoundingClientRect(); if (!(b.right <= coachRect.left || b.left >= coachRect.right || b.bottom <= coachRect.top || b.top >= coachRect.bottom)) over.push(k); }
  }
  return {
    phase: v.phase, z: v.zone ? v.zone.idx : null, time: v.time, cls: v.player ? v.player.classId : null,
    fight: !!(v.combat && !v.combat.over && !v.loot), round: v.combat ? v.combat.round : null, engaged: !!(v.combat && v.combat.engaged),
    hp: v.player ? v.player.hp : null, maxHp: v.player ? v.player.maxHp : null,
    t: v.tutorial ? { rescues: v.tutorial.rescues, ended: v.tutorial.ended, skipped: v.tutorial.skipped, script: v.tutorial.script } : null,
    coach: c.shown, keys: coachEl ? [...coachEl.querySelectorAll('.kbd')].map((k) => k.textContent) : [],
    over: [...new Set(over)],
    clutter: { toasts: vis('#toasts .toast').length, windows: vis('.win:not(.hidden), .window:not(.hidden)').length, tooltip: vis('.tooltip.on').length, loot: vis('#screens .loot').length, banner: vis('#banner.on').length },
    sig: JSON.stringify([v.phase, v.time, v.combat ? [v.combat.round, v.combat.engaged, v.combat.enemies.map((e) => e.hp)] : null, v.player ? [v.player.hp, v.player.mana] : null]),
  };
});

async function session(browser, cls) {
  const res = { cls, size: `${W}x${H}`, lines: [], keyMisses: [], rescues: 0, zone1: null, overlaps: [], clutter: [], errors: [], notes: [], shots: [] };
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') res.errors.push(m.text()); });
  page.on('pageerror', (e) => res.errors.push(e.message));
  const shot = async (name) => { if (!SHOTS) return; const f = path.join(SHOTS, `${cls}-${name}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 72 }); res.shots.push(f); };
  const t0 = Date.now();
  try {
    await page.goto(`${URL}?seed=${SEED}&speed=instant`);
    await page.waitForFunction(() => window.__ui); await idle(page);
    const tg = page.locator('#create .toggle.guide');
    res.toggle = (await tg.count()) ? await tg.getAttribute('aria-checked') : 'absent';
    await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle(page);
    await shot('00-class-select');
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    let cur = null; let n = 0; const pressed = new Set();
    let zone1Steps = null;
    for (; n < MAX_STEPS; n++) {
      const s = await state(page);
      if (s.phase === 'SUMMARY') break;
      if (s.t) res.rescues = s.t.rescues;
      // the coach line: a new line is logged with a screenshot
      const id = s.coach ? `${s.coach.id}` : null;
      if (id !== (cur && cur.id)) {
        if (cur) cur.left = { step: n, phase: s.phase };
        cur = id ? { id, kind: s.coach.kind, text: s.coach.text, step: n, phase: s.phase, zone: s.z, keys: s.keys } : null;
        if (cur) {
          res.lines.push(cur);
          if (!res.lines.slice(0, -1).some((x) => x.id === id)) await shot(`${String(res.lines.length).padStart(2, '0')}-${id.replace(/[^\w.]/g, '_')}`);
        }
      }
      if (s.coach && s.over.length) res.overlaps.push(`${s.coach.id} (${s.phase}): ${s.over.join(',')}`);
      const busy = s.clutter.toasts + s.clutter.windows + s.clutter.tooltip + s.clutter.loot + s.clutter.banner;
      if (s.coach && busy >= 2) res.clutter.push(`${s.coach.id} (${s.phase}): ${JSON.stringify(s.clutter)}`);
      // leaving zone 1: the guide's end
      if (zone1Steps === null && s.z !== null && s.z >= 1 && s.phase !== 'PREP' && s.t && s.t.ended) {
        zone1Steps = n; res.zone1 = { steps: n, tolls: s.time, ms: Date.now() - t0 };
        await shot('50-zone2');
      }
      // follow the line: press its key once in a fight
      const k = s.fight && s.coach && s.keys.find((x) => KEY_CODE[x]);
      const tag = s.coach ? `${s.coach.id}:${k}` : null;
      if (k && !pressed.has(tag)) {
        pressed.add(tag);
        await page.keyboard.press(KEY_CODE[k]); await idle(page);
        const s2 = await state(page);
        if (s2.sig === s.sig) res.keyMisses.push(`${s.coach.id} "${s.coach.text}": key ${k} changed nothing (round ${s.round})`);
        continue;
      }
      await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
      if (zone1Steps !== null && n - zone1Steps > 40 && !res.autoplayOn) {
        // past zone 1 a new player turns autoplay on (H31); the run is played on to its end
        res.autoplayOn = true;
      }
    }
    if (cur) cur.left = { step: n, phase: 'end' };
    res.steps = n;
    const s = await state(page);
    res.phase = s.phase;
    if (s.phase === 'SUMMARY') {
      await page.waitForFunction(() => document.querySelector('#screens .summary'), null, { timeout: 15000 });
      await page.waitForTimeout(1200);
      const sum = await page.evaluate(() => ({ outcome: window.__ui.view().summary && window.__ui.view().summary.outcome, level: window.__ui.view().summary && window.__ui.view().summary.level, welcome: [...document.querySelectorAll('.echo.welcome')].map((e) => e.textContent.trim()), glow: !!document.querySelector('.sfoot .btn.glow'), line: (document.querySelector('.sfoot .nudgeline') || {}).textContent || '', lines: document.querySelectorAll('#screens .summary .echo').length }));
      res.summary = sum;
      await shot('60-summary');
      // clicks from the summary to Packed Satchel bought
      let clicks = 0;
      await page.getByRole('button', { name: /^Spend Echoes/ }).click(); clicks++; await idle(page); await page.waitForTimeout(250);
      await shot('61-hall');
      const hall = await page.evaluate(() => ({ nudge: !!document.querySelector('#meta .mcard.nudge[data-id="satchel"]'), coach: window.__ui.coach().shown }));
      res.hall = hall;
      const buy = page.locator('#meta .mcard[data-id="satchel"] button.buy');
      if (await buy.count() && await buy.isEnabled()) { await buy.click(); clicks++; await idle(page); }
      const owned = await page.evaluate(() => { try { const p = JSON.parse(localStorage.getItem('tbwcr.profile.v1')); return (p.unlocks && p.unlocks.satchel) || 0; } catch { return 0; } });
      res.satchel = { owned, clicks };
      await shot('62-hall-bought');
      // the second run: no guide toggle, H10 in the first fight
      const back = page.getByRole('button', { name: /^(Back|Close|Done)/ });
      if (await back.count()) { await back.first().click(); await idle(page); } else { await page.keyboard.press('Escape'); await idle(page); }
      res.toggle2 = (await page.locator('#create .toggle.guide').count()) ? 'shown' : 'absent';
      await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let h10 = null; let fights = 0;
      for (let m = 0; m < 160 && !h10; m++) {
        const x = await state(page);
        if (x.fight) fights = 1;
        if (x.coach && x.coach.id === 'H10') { h10 = x.coach.text; await shot('70-run2-H10'); }
        if (fights && !x.fight && m > 20 && !h10) break;
        await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
      }
      res.run2 = { h10 };
    }
  } catch (e) {
    res.notes.push(`stopped: ${e.message.split('\n')[0]}`);
    await shot('99-error');
  }
  res.ms = Date.now() - t0;
  // the questions: taught on screen when a line that answers it was shown
  const shownIds = new Set(res.lines.map((x) => x.id.split('.')[0]));
  res.questions = QUESTIONS.map(([q, ...alts]) => [q, alts.every((ids) => ids.some((i) => shownIds.has(i)))]);
  await context.close();
  return res;
}

const browser = await chromium.launch();
const all = [];
for (const cls of CLASSES) {
  const r = await session(browser, cls);
  all.push(r);
  const lines = r.lines.map((x) => `${x.id}@${x.step}${x.left ? `-${x.left.step}` : ''}`).join(' ');
  console.log(`\n${cls} ${r.size}: ${r.phase || '?'} after ${r.steps} steps, ${(r.ms / 1000).toFixed(0)} s; zone 1 left ${r.zone1 ? `at step ${r.zone1.steps}, ${r.zone1.tolls} tolls` : 'NOT left'}; rescues ${r.rescues}; console errors ${r.errors.length}`);
  console.log(`  lines: ${lines}`);
  console.log(`  questions taught: ${r.questions.map(([q, ok]) => `${q.split(' ')[0]} ${ok ? 'yes' : 'NO'}`).join(', ')}`);
  if (r.keyMisses.length) console.log(`  keys that did nothing: ${r.keyMisses.join(' | ')}`);
  if (r.overlaps.length) console.log(`  overlaps (${r.overlaps.length}): ${[...new Set(r.overlaps)].slice(0, 6).join(' | ')}`);
  if (r.clutter.length) console.log(`  busy screens (${r.clutter.length}): ${[...new Set(r.clutter)].slice(0, 6).join(' | ')}`);
  if (r.summary) console.log(`  summary: ${JSON.stringify(r.summary)}; hall ${JSON.stringify(r.hall)}; satchel ${JSON.stringify(r.satchel)}; toggle run 2 ${r.toggle2}; run 2 H10 ${r.run2 && r.run2.h10 ? 'shown' : 'NOT shown'}`);
  for (const e of r.errors) console.log(`  error: ${e}`);
  for (const x of r.notes) console.log(`  note: ${x}`);
}
await browser.close();
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(all, null, 1));
const bad = all.filter((r) => r.errors.length || !r.zone1);
console.log(`\nplaytest-onboarding: ${all.length - bad.length}/${all.length} sessions reached zone 2 without console errors`);
process.exit(bad.length ? 1 : 0);
