#!/usr/bin/env node
/**
 * qa/browser/demo-campaign.mjs - headless campaign of the demo build (docs/specs/demo.md 1-4, 5.1 A1, A6-A9; D171, task D.3).
 *
 *   NODE_PATH=/opt/npm-tools/node_modules node qa/browser/demo-campaign.mjs [--file /tmp/x/demo.html] [--runs 4]
 *        [--size 1366x768] [--shots /tmp/tbwcr-<worktree>/demo-shots] [--quiet]
 *
 * Without --file it always builds this worktree's demo (tools/build.mjs --demo) fresh to /tmp/tbwcr-<worktree folder>/demo.html first
 * (the old file is deleted before the build; a missing or older-than-a-minute file after the build is an error).
 * The page is opened with URL switches (?legacy=0&dev=1&debug=1&seed=5&classic=1&mock=1&demo=0&art=lantern): the demo build
 * must read none of them. Then: two campaigns of --runs runs each (classes in turn), the first from a fresh page, the second
 * after Settings > Start over. Every run is played by the engine's autoplay (the UI's AUTO step, instant speed) from hero
 * select to the summary. Checks:
 *   - every run ends at the demo-end screen (outcome demo: the demo block, at most DEMO_END_MAX_WORDS words, Next run and
 *     Legacy hall buttons, no Oruvath line, no play-time line, no Seed row) or by death (the normal summary, no demo block);
 *     at least one run per campaign reaches the demo-end screen
 *   - the view never shows zone 3 or later, the Camp or a boss fight
 *   - hero select: no Seed field, no mode chip; no Dev menu element; the backquote key opens nothing; the art and theme are
 *     today's (no data-art / data-theme on <html>); a Hunter shows no Stormhawk
 *   - the Legacy hall lists exactly seven cards and no level-20 wing
 *   - Start over: the profile is new (no runs, no Legacy points, no heroes), and the next run is the guided one
 *   - text logic (hand-off content-2026-11-25 L1, L3, L4): the Furnace meter's tooltip at the first hub is the demo line (no
 *     "final boss") and its "Boss +N %" is never shown; the hall's five stat and kit cards read one rank; Settings has no
 *     "Engine: ... build ..." line
 *   - demo.md 1.2a (R2-1, draft): on zone 2's map the header shows the progress chip and the Bell button reads "End the demo
 *     run" / "End this run early" with its own look (class demoexit); one extra run leaves zone 2 early by that button and
 *     its confirm: outcome left, the early-leave head ("left ... early", no demo block, no "made it through")
 *   - storage: every key the page wrote starts with tbwcr.demo.
 *   - no request besides the file, no console error or page error; the file holds no <a href> and no window.open
 * Screenshots (--shots): the demo-end screen and the Legacy hall. Exit 1 on any failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REPO, BUILD_DIR } from './build-path.mjs';
import * as R from '../../src/rules.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const QUIET = args.includes('--quiet');
const RUNS = Number(arg('--runs', '4'));
const [W, H] = arg('--size', '1366x768').split('x').map(Number);
const SHOTS = arg('--shots', path.join(BUILD_DIR, 'demo-shots'));
let FILE = arg('--file', null);
if (!FILE) {
  FILE = path.join(BUILD_DIR, 'demo.html');
  fs.rmSync(FILE, { force: true }); // never test an earlier file: a failed build leaves nothing behind
  const r = spawnSync(process.execPath, [path.join(REPO, 'tools/build.mjs'), '--demo', '--out', FILE, '--quiet'], { cwd: REPO, encoding: 'utf8' });
  if (r.status !== 0) { console.error(`demo build failed:\n${r.stdout}${r.stderr}`); process.exit(2); }
  if (!fs.existsSync(FILE) || Date.now() - fs.statSync(FILE).mtimeMs > 60000) { console.error(`demo build did not write a fresh ${FILE}`); process.exit(2); }
}
FILE = path.resolve(FILE);
fs.mkdirSync(SHOTS, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const log = (...x) => { if (!QUIET) console.log(...x); };
const fails = [];
const check = (ok, what) => { if (!ok) { fails.push(what); console.log(`FAIL ${what}`); } };

// the file itself (A8): no link and no window.open anywhere in the built page
const html = fs.readFileSync(FILE, 'utf8');
check(!/<a\s[^>]*href/i.test(html), 'the built file holds an <a href>');
check(!/window\.open\s*\(/.test(html), 'the built file calls window.open');
const urls = [...html.matchAll(/https?:\/\/[^\s'"`)<]+/g)].map((m) => m[0]);
const urlsOther = urls.filter((u) => u !== 'http://www.w3.org/2000/svg');
check(urlsOther.length === 0, `the built file holds URLs other than the SVG namespace: ${[...new Set(urlsOther)].slice(0, 5).join(', ')}`);
log(`file: ${FILE} (${Math.round(fs.statSync(FILE).size / 1024)} KB); URL strings: ${urls.length} (all the SVG namespace identifier, never fetched)`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H } });
const page = await context.newPage();
const errors = [];
const requests = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('request', (r) => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) requests.push(r.url()); });
const url = `${pathToFileURL(FILE).href}?legacy=0&dev=1&debug=1&seed=5&classic=1&mock=1&demo=0&art=lantern&theme=lantern&speed=1&guide=0`;
await page.goto(url);
await page.waitForFunction(() => !!window.__ui, null, { timeout: 20000 });
const idle = () => page.evaluate(() => window.__ui.idle());
await page.evaluate(() => { const s = window.__ui.settings; s.set('speed', 0); s.set('skipTravel', true); s.set('autoDelay', 0); });

// A6, A7: the URL switches did nothing; nothing for developers
const boot = await page.evaluate(() => ({
  mode: window.__ui.mode, seed: window.__ui.view().seed, phase: window.__ui.view().phase, mapMode: window.__ui.view().mapMode,
  art: document.documentElement.dataset.art || null, theme: document.documentElement.dataset.theme || null,
  seedField: !!document.querySelector('#create .seedf, #create input.seed'), modeChip: !!document.querySelector('#create .modechip'),
  dev: !!document.querySelector('.devmenu, #devmenu, [class*="devmenu"], #dev-menu, .dm-tab, .dm-win'), guide: window.__ui.view().meta && window.__ui.view().meta.guided,
  canDebug: window.__ui.canDebug,
}));
log('boot', JSON.stringify(boot));
check(boot.mode === 'engine', 'mock engine in the demo');
check(boot.seed !== 5, '?seed=5 was read');
check(boot.mapMode === 'expedition', '?classic=1 was read');
check(!boot.art && !boot.theme, '?art= or ?theme= was read');
check(!boot.seedField && !boot.modeChip, 'hero select shows a Seed field or the mode chip');
check(!boot.dev, 'a Dev menu element is on the page');
check(boot.guide === true, '?guide=0 was read (the guided first run is not offered on a new profile)');
await page.keyboard.press('Backquote'); await idle();
check(!(await page.evaluate(() => window.__ui.devOpen())), 'the backquote key opened the Dev menu');
const devOp = await page.evaluate(() => window.__ui.dev('give', { gold: 100 }));
check(!devOp || devOp.ok === false, 'a dev op ran in the demo');
check(!(await page.evaluate(() => /\bSeed\b/.test(document.body.innerText))), 'hero select shows the word Seed');

const CLASSES = ['rogue', 'mage', 'hunter'];
let shotEnd = false; let shotHall = false; let hubTip = null; const signs = {}; const z2bell = [];
/** L1: the Furnace meter's tooltip text (hover #heat), or '' when it could not be hovered. */
async function heatTipText() {
  try {
    await page.locator('#heat').hover({ timeout: 3000 });
    const t = await page.getByRole('tooltip').innerText({ timeout: 3000 });
    await page.mouse.move(2, 2);
    return t;
  } catch { return ''; }
}
async function oneRun(n, cls) {
  await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle();
  if (cls === 'hunter') check(!(await page.evaluate(() => [...document.querySelectorAll('#create .pets .pet .pn')].some((x) => /stormhawk/i.test(x.textContent)))), 'hero select offers Stormhawk');
  await page.getByRole('button', { name: 'Enter the world' }).click(); await idle();
  let maxZone = 0; let steps = 0;
  for (; steps < 6000; steps++) {
    const v = await page.evaluate(() => { const x = window.__ui.view(); const bt = document.querySelector('#heat .ht-boss'); return { phase: x.phase, z: x.zone ? x.zone.idx : 0, camp: !!(x.zone && x.zone.camp), boss: !!(x.combat && x.combat.isBoss), bossTxt: bt ? bt.textContent.trim() : '' }; });
    if (v.phase === 'SUMMARY') break;
    if (v.bossTxt) { check(false, `run ${n}: the Furnace meter shows "${v.bossTxt}" in the demo`); }
    if (v.phase === 'ZONE_HUB' && !hubTip) hubTip = await heatTipText();
    // demo blind round 1 C (draft): the Roads' signs name the goal: "Next zone" in zone 1, "End of the demo" in zone 2
    if (v.phase === 'MAP' && !signs[v.z]) {
      const ws = await page.evaluate(() => [...document.querySelectorAll('#screens .expmap .xroad .xsign b')].map((b) => b.textContent.replace(/[«»]/g, '').trim()));
      if (ws.length) signs[v.z] = ws;
    }
    // demo.md 1.2a: zone 2's map: the progress chip and the Bell's own label and look
    if (v.phase === 'MAP' && v.z === 2 && z2bell.length < 6) {
      // sampled once the map screen shows zone 2 (its header title is zone 2's name; it is rebuilt after the travel animation)
      const x = await page.evaluate(() => { const t = document.querySelector('#screens .expmap .mhead .title'); if (!t || t.textContent !== window.__ui.view().zone.name) return null; const b = document.querySelector('#screens .expmap .mhead [data-leave="RING_BELL"]'); const c = document.querySelector('#screens .expmap .mhead .demoprog'); return { chip: c ? c.textContent : null, bell: b ? b.textContent : null, cls: b ? b.className : '' }; });
      if (x) z2bell.push(x);
    }
    maxZone = Math.max(maxZone, v.z);
    if (v.z > 2 || v.camp || v.boss || v.phase === 'CAMP' || v.phase === 'BOSS') { check(false, `run ${n}: zone ${v.z}, camp ${v.camp}, boss ${v.boss}`); break; }
    const r = await page.evaluate(() => window.__ui.act({ type: 'AUTO' }));
    await idle();
    if (r && r.ok === false && /Nothing to do/.test(r.error || '')) break;
  }
  await idle();
  // the summary screen may wait for a banner or overlay of the run's last step
  await page.waitForSelector('.summary .sfoot button', { timeout: 15000 }).catch(() => null);
  const out = await page.evaluate(() => {
    const v = window.__ui.view(); const s = v.summary || {};
    const block = document.querySelector('.summary .demoend');
    const kv = [...document.querySelectorAll('.summary dl.kv dt')].map((x) => x.textContent);
    return {
      phase: v.phase, outcome: s.outcome, demo: !!s.demo, block: !!block, text: block ? block.innerText : '', kv,
      next: !!document.querySelector('.summary [data-demo="next"]'), hall: !!document.querySelector('.summary [data-demo="hall"]'),
      seedWord: /\bSeed\b/.test(document.querySelector('.summary') ? document.querySelector('.summary').innerText : ''),
      hero: s.hero ? s.hero.level : null,
    };
  });
  const words = (out.text.match(/[A-Za-z0-9][\w'’-]*/g) || []).length;
  log(`run ${n} ${cls}: ${out.outcome} after ${steps} steps, max zone ${maxZone}, hero ${out.hero}, demo block ${out.block} (${words} words)`);
  check(out.phase === 'SUMMARY', `run ${n}: no summary`);
  check(['demo', 'death', 'left'].includes(out.outcome), `run ${n}: outcome ${out.outcome}`);
  check(!out.kv.includes('Oruvath') && !out.kv.includes('Play time') && !out.kv.includes('Seed') && !out.seedWord, `run ${n}: Oruvath, Play time or Seed on the summary (${out.kv.join(', ')})`);
  if (out.outcome === 'demo') {
    check(out.block && out.next && out.hall, `run ${n}: the demo-end screen lacks its block or buttons`);
    check(words <= R.C.DEMO_END_MAX_WORDS, `run ${n}: the demo block has ${words} words (at most ${R.C.DEMO_END_MAX_WORDS})`);
    if (!shotEnd) { await page.screenshot({ path: path.join(SHOTS, `demo-end-${W}x${H}.png`) }); shotEnd = true; log(`  demo block: ${out.text.replace(/\n/g, ' | ')}`); }
    // demo blind round 1 D: "Same hero" is on the demo-end screen too; used once, it starts the next run at the start camp
    check(await page.locator('.summary [data-same]').count() === 1, `run ${n}: no Same hero button on the demo-end screen`);
    await page.locator('.summary [data-demo="next"]').click();
  } else {
    check(await page.locator('.summary [data-same]').count() === 1, `run ${n}: no Same hero button on the summary`);
    check(!out.block, `run ${n}: a death shows the demo block`);
    await page.getByRole('button', { name: 'Begin a new run' }).click();
  }
  await idle();
  check((await page.evaluate(() => window.__ui.view().phase)) === 'CREATE', `run ${n}: not back at hero select`);
  return out.outcome;
}
async function hall() {
  await page.locator('#create .bottom .echoes').click(); await idle();
  const h = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#meta .mcard:not(.wing)')].map((x) => x.dataset.id), wing: document.querySelectorAll('#meta .mcard.wing').length }));
  log(`hall: ${h.cards.join(', ')} (wing cards ${h.wing})`);
  check(h.cards.length === R.C.DEMO_HALL.length && R.C.DEMO_HALL.every((id) => h.cards.includes(id)), `the hall lists ${h.cards.join(', ')}`);
  check(h.wing === 0, 'the hall shows the level-20 wing');
  // L3: the five stat and kit entries read one rank: the card's line and the tooltip's long line, as the hand-off gives them
  const ONE = {
    vigor: ['+3 % max health', 'Every hero starts with 3 % more maximum health.'],
    edge: ['+2 % Power', 'Every hero has 2 % more Power: more damage from every attack and spell.'],
    quick_study: ['+5 % experience', 'Every hero earns 5 % more experience: levels come sooner.'],
    pockets: ['+8 bag slots', 'Your bags hold 8 more items.'],
    quartermaster: ['+2 camp points', 'On the expedition map you have two more camp points to spend at the start camp.'],
  };
  for (const [id, [short, long]] of Object.entries(ONE)) {
    const fx = page.locator(`#meta .mcard[data-id="${id}"] .mc-fx`);
    const card = (await fx.innerText()).replace(/\s+/g, ' ').trim();
    await fx.hover(); const tt = (await page.getByRole('tooltip').innerText()).replace(/\s+/g, ' ');
    await page.mouse.move(2, 2);
    check(card === short && tt.includes(long) && !/per rank|each rank|rank I\b|in all/.test(`${card} ${tt}`), `hall card ${id}: "${card}" / "${tt}" (want "${short}" / "${long}")`);
  }
  if (!shotHall) { await page.screenshot({ path: path.join(SHOTS, `demo-hall-${W}x${H}.png`) }); shotHall = true; }
  await page.keyboard.press('Escape'); await idle();
}
async function campaign(label) {
  const outs = [];
  for (let i = 0; i < RUNS; i++) outs.push(await oneRun(`${label}.${i + 1}`, CLASSES[i % 3]));
  check(outs.includes('demo'), `campaign ${label}: no run reached the demo-end screen (${outs.join(', ')})`);
  if (outs.length > 1) await hall();
  return outs;
}
const c1 = await campaign('A');
// L1: the meter's tooltip at the first hub
log(`hub tooltip: ${hubTip && hubTip.replace(/\n/g, ' | ').slice(0, 160)}`);
check(!!hubTip && hubTip.includes('Every move costs tolls. Overspend and fights pay more, but the Dimming spreads with every toll.') && !/final boss|\bboss\b/i.test(hubTip), `the Furnace tooltip at the hub: "${hubTip}"`);
log(`road signs: ${JSON.stringify(signs)}`);
check(!!signs[1] && signs[1].every((x) => x === 'Next zone'), `zone 1's Road signs read "Next zone": ${JSON.stringify(signs[1])}`);
check(!!signs[2] && signs[2].every((x) => x === 'End of the demo'), `zone 2's Road signs read "End of the demo": ${JSON.stringify(signs[2])}`);
const before = await page.evaluate(() => window.__ui.view().meta);
// Start over (demo.md 2.4): Settings, two clicks
await page.evaluate(() => window.__ui.openWin('settings')); await idle();
const setText = await page.evaluate(() => document.querySelector('#win-settings').innerText);
check(!/Engine:|\bbuild\b/i.test(setText), `Settings shows the engine and build line: ${setText.replace(/\n/g, ' | ').slice(-120)}`);
const so = page.locator('#win-settings [data-startover]');
check(await so.count() === 1, 'Settings has no Start over');
await so.click(); await so.click(); await idle();
const after = await page.evaluate(() => { const m = window.__ui.view().meta; return { phase: window.__ui.view().phase, runs: m.runs, legacy: m.echoes, heroes: (m.heroes || []).filter(Boolean).length, guided: m.guided }; });
log(`start over: before runs ${before.runs}, Legacy ${before.echoes}; after ${JSON.stringify(after)}`);
check(after.phase === 'CREATE' && after.runs === 0 && after.legacy === 0 && after.heroes === 0 && after.guided === true, 'Start over did not give a new profile with the guided run');
const c2 = await campaign('B');
// demo.md 1.2a (R2-1, draft): the zone 2 Bell before three wins, then an early leave by it
log(`zone 2 map (chip, Bell): ${JSON.stringify(z2bell.slice(0, 3))}`);
check(z2bell.length > 0 && z2bell.every((x) => x.chip && /^Demo end/.test(x.chip)), `zone 2's map lacks the demo end chip: ${JSON.stringify(z2bell.slice(0, 2))}`);
check(z2bell.filter((x) => x.bell).every((x) => /demoexit/.test(x.cls) && /^End (the demo run|this run early)$/.test(x.bell.trim())), `zone 2's Bell button: ${JSON.stringify(z2bell.filter((x) => x.bell).slice(0, 2))}`);
async function earlyRun(cls) {
  await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle();
  await page.getByRole('button', { name: 'Enter the world' }).click(); await idle();
  for (let i = 0; i < 6000; i++) {
    const v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, z: x.zone ? x.zone.idx : 0 }; });
    if (v.phase === 'SUMMARY' || (v.phase === 'MAP' && v.z === 2)) break;
    if (v.phase === 'ZONE_HUB' && v.z === 2) { await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(); continue; }
    await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle();
  }
  // the map screen is rebuilt after the zone travel's animation: wait for zone 2's header (its demo end chip) first
  await page.waitForSelector('#screens .expmap .mhead .demoprog', { timeout: 15000 }).catch(() => null);
  const bell = page.locator('#screens .expmap .mhead [data-leave="RING_BELL"]');
  if (await bell.count() !== 1) {
    log(`early run (${cls}): no Bell button on zone 2's map (died, or the charge was rung in zone 1); next class`);
    if ((await page.evaluate(() => window.__ui.view().phase)) !== 'SUMMARY') await page.evaluate(() => window.__ui.act({ type: 'ABANDON_RUN' }));
    for (let i = 0; i < 400 && (await page.evaluate(() => window.__ui.view().phase)) !== 'SUMMARY'; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(); }
    await page.waitForSelector('.summary .sfoot button', { timeout: 15000 }).catch(() => null);
    await page.getByRole('button', { name: 'Begin a new run' }).click().catch(() => null); await idle();
    return null;
  }
  check((await bell.innerText()).trim() === 'End this run early' && /early/.test(await bell.getAttribute('class')), `early run: the Bell reads "${await bell.innerText()}"`);
  await bell.click(); await idle();
  const ask = await page.locator('#screens .leavewarn .lw-t').innerText().catch(() => '');
  const line = await page.locator('#screens .leavewarn .lw-demo').innerText().catch(() => '');
  check(ask === 'End this run early?' && /ends this run early/.test(line), `early run: the confirm reads "${ask}" / "${line}"`);
  await page.locator('#screens .leavewarn [data-go="RING_BELL"]').click(); await idle();
  for (let i = 0; i < 400; i++) { if ((await page.evaluate(() => window.__ui.view().phase)) === 'SUMMARY') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(); }
  await page.waitForSelector('.summary .sfoot button', { timeout: 15000 }).catch(() => null);
  const out = await page.evaluate(() => { const s = window.__ui.view().summary || {}; const sm = document.querySelector('.summary'); return { outcome: s.outcome, left: !!document.querySelector('.summary .demoleft'), end: !!document.querySelector('.summary .demoend'), text: sm ? sm.innerText : '' }; });
  log(`early run: ${out.outcome}; head ${out.text.split('\n').slice(0, 4).join(' | ')}`);
  if (out.outcome === 'death') return out.outcome; // a Dimmed fight before the Bell killed the hero
  check(out.outcome === 'left' && out.left && !out.end && !/made it through/i.test(out.text) && /left .* early/.test(out.text), `early run: ${JSON.stringify({ ...out, text: out.text.slice(0, 200) })}`);
  await page.screenshot({ path: path.join(SHOTS, `demo-left-${W}x${H}.png`) });
  await page.getByRole('button', { name: 'Begin a new run' }).click(); await idle();
  return out.outcome;
}
let early = null;
for (const cls of CLASSES) { early = await earlyRun(cls); if (early) break; }
check(early !== null, 'no early-leave run could be played (no class reached zone 2 with a Bell charge)');
const keys = await page.evaluate(() => Object.keys(localStorage));
check(keys.length > 0 && keys.every((k) => k.startsWith('tbwcr.demo.')), `storage keys outside tbwcr.demo.: ${keys.filter((k) => !k.startsWith('tbwcr.demo.')).join(', ')}`);
check(requests.length === 0, `requests besides the file: ${requests.slice(0, 3).join(', ')}`);
check(errors.length === 0, `console: ${errors.slice(0, 3).join(' | ')}`);
await browser.close();
console.log(`demo campaign ${W}x${H}: A ${c1.join(', ')} · B ${c2.join(', ')} · early ${early} · keys ${keys.length} · ${fails.length ? `FAIL (${fails.length})` : 'pass'}`);
console.log(`screenshots: ${SHOTS}`);
process.exitCode = fails.length ? 1 : 0;
