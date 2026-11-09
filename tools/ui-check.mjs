#!/usr/bin/env node
/**
 * tools/ui-check.mjs - headless click-through of the built game with screenshots.
 *
 * SETUP (once, outside the repo; the repo has no dependencies):
 *   mkdir -p /tmp/ui-tools && cd /tmp/ui-tools && npm init -y && npm i puppeteer-core@23
 * RUN:
 *   node tools/build.mjs
 *   UI_TOOLS=/tmp/ui-tools CHROME=/usr/bin/google-chrome node tools/ui-check.mjs [--out docs/handoffs/screens] [--sizes 1366x768,1920x1080] [--quick]
 *
 * It loads dist/game.html from disk (real engine; --mock adds ?mock=1), clicks class select -> hub ->
 * map -> a quest fight -> loot -> reward at each size, then starts a fixed-seed run that autoplay
 * drives to later screens: trainer, vendor, talents, character and bags, an elite or dungeon fight,
 * the camp, the boss and the run summary. It saves PNG screenshots, prints every console message,
 * page error and network request that is not the file itself, and exits 1 on any console error
 * or page error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, arg('--out', 'docs/handoffs/screens'));
const SIZES = arg('--sizes', '1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const QUICK = args.includes('--quick');
const MOCK = args.includes('--mock');
const QUERY = `?seed=4242${MOCK ? '&mock=1' : ''}`;
const FILE = path.resolve(ROOT, arg('--file', 'dist/game.html'));
const req = createRequire(path.join(process.env.UI_TOOLS || '/home/claude/tools-ui', 'index.js'));
const puppeteer = req('puppeteer-core');

fs.mkdirSync(OUT, { recursive: true });
const errors = []; const requests = []; const logs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(W, H, tag) {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('console', async (m) => {
    let text = m.text();
    if (/JSHandle@/.test(text)) { try { text = (await Promise.all(m.args().map((a) => a.evaluate((x) => (x instanceof Error ? x.stack || x.message : String(x)))))).join(' '); } catch { /* keep */ } }
    const line = `[${tag}] ${m.type()}: ${text}`; logs.push(line); if (m.type() === 'error') errors.push(line);
  });
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith('blob:') && u !== pathToFileURL(FILE).href + QUERY) requests.push(`[${tag}] ${u}`); });
  await page.goto(pathToFileURL(FILE).href + QUERY, { waitUntil: 'load' });
  await sleep(900);
  const shot = async (name) => { const f = path.join(OUT, `${tag}-${name}.png`); await page.screenshot({ path: f }); console.log(`  saved ${path.relative(ROOT, f)}`); };
  const idle = () => page.evaluate(() => window.__ui.idle());
  const view = () => page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, step: v.node && v.node.step, type: v.node && v.node.type, loot: v.loot && v.loot.kind, combat: !!(v.combat && !v.combat.over), over: v.combat && v.combat.over, level: v.player && v.player.level }; });
  const click = async (sel) => { const el = await page.$(sel); if (!el) throw new Error(`[${tag}] not found: ${sel}`); await el.click(); };
  const clickText = async (sel, text) => {
    const ok = await page.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.includes(t)); if (el) { el.click(); return true; } return false; }, sel, text);
    if (!ok) throw new Error(`[${tag}] no ${sel} with text "${text}"`);
  };
  await page.evaluate(() => window.__ui.settings.set('speed', 2));

  // 1. class select
  await shot('01-class-select');
  await clickText('.ccard', 'Hunter'); await idle(); await sleep(250);
  await page.type('#create input[type=text]', 'Kaelen');
  await shot('02-class-select-hunter');
  await clickText('button', 'Enter the world'); await idle(); await sleep(400);
  // 2. hub, with its trainer and vendor
  await shot('03-hub');
  await clickText('.svc-card', 'Trainer'); await idle(); await sleep(300); await shot('03b-trainer');
  await clickText('button', 'Done'); await idle();
  await clickText('.svc-card', 'Vendor'); await idle(); await sleep(300); await shot('03c-vendor');
  await clickText('button', 'Done'); await idle(); await sleep(200);
  await clickText('button', 'Set out'); await idle(); await sleep(300);
  // 3. map
  await page.hover('.mnode.reach'); await sleep(200);
  await shot('04-map');
  const lanes = await page.evaluate(() => { const v = window.__ui.view(); return v.legal.lanes.map((l) => [l, v.zone.rows[0][l].type]); });
  const pick = (lanes.find(([, t]) => t === 'quest') || lanes.find(([, t]) => t === 'grind') || lanes[0])[0];
  await page.click(`.mnode.reach[data-lane="${pick}"]`);
  await sleep(700); await shot('05-travel');
  await idle(); await sleep(300);
  let v = await view();
  // 4. node intro -> fight
  await shot('06-node-intro');
  if (v.type === 'grind') await clickText('.dialog button', '1 wave');
  else await page.evaluate(() => document.querySelector('#screens .dialog .btn.primary').click());
  await idle(); await sleep(300);
  await shot('07-combat-start');
  let shotMid = false;
  for (let i = 0; i < 60; i++) {
    v = await view();
    if (!v.combat) break;
    const slot = await page.evaluate(() => { const bs = [...document.querySelectorAll('#actionbar .ab[data-slot]')]; const i = bs.findIndex((b) => !b.classList.contains('off') && !b.classList.contains('empty')); return i; });
    if (slot >= 0) await page.click(`#actionbar .ab[data-slot="${slot}"]`); else await page.click('#actionbar .ab.basic');
    if (!shotMid && i === 1) { await sleep(420); await shot('08-combat-action'); shotMid = true; }
    await idle(); await sleep(60);
  }
  v = await view();
  if (v.loot === 'loot') { await sleep(250); await shot('09-loot'); await page.keyboard.press('Space'); await idle(); await sleep(300); }
  v = await view();
  if (v.loot === 'reward' || v.loot === 'story') { await shot('10-quest-reward'); await page.evaluate(() => document.querySelector('.icard').click()); await idle(); await sleep(300); }
  // items that wait in the loot window (bag full): equip or drop them
  for (let k = 0; k < 6; k++) {
    v = await view(); if (v.loot !== 'loot') break;
    if (k === 0) await shot('10b-loot-window');
    const b = await page.$('.loot .lrow .btn.small');
    if (b) { await b.click(); await idle(); } else { await page.keyboard.press('Space'); await idle(); }
  }
  v = await view();
  if (v.step === 'between') { await page.evaluate(() => [...document.querySelectorAll('.dialog button')].find((b) => /Stop|Leave/.test(b.textContent)).click()); await idle(); }
  await sleep(300);
  await shot('11-back-to-map');
  if (QUICK) { await browser.close(); return; }
  if (!MOCK) { await deepEngineRun(page, shot, idle, clickText); await browser.close(); return; }

  // 5. later screens through mock debug jumps
  const canDebug = await page.evaluate(() => window.__ui.canDebug);
  if (!canDebug) { console.log('  engine mode: skipping debug jumps'); await browser.close(); return; }
  await page.evaluate(() => window.__ui.act({ type: 'DEBUG_JUMP', to: 'zone', zone: 3, level: 24, gear: true, gold: 40000 }));
  await idle(); await sleep(500);
  await clickText('.svc-card', 'Trainer'); await idle(); await sleep(250);
  await shot('12-trainer');
  await clickText('button', 'Done'); await idle();
  await clickText('.svc-card', 'Vendor'); await idle(); await sleep(250);
  await shot('13-vendor');
  await clickText('button', 'Done'); await idle();
  await page.keyboard.press('KeyN'); await sleep(300);
  await shot('14-talents');
  await page.keyboard.press('Escape'); await sleep(100);
  await page.keyboard.press('KeyC'); await page.keyboard.press('KeyB'); await sleep(300);
  await shot('15-character-bags');
  await page.keyboard.press('Escape'); await sleep(100);
  // a dungeon / elite fight with several enemies
  await clickText('button', 'Set out'); await idle();
  await page.evaluate(() => window.__ui.settings.set('speed', 0));
  for (let r = 0; r < 8; r++) {
    const st = await page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, lanes: v.legal.lanes, row: v.zone.pos.row, rows: v.zone.rows.map((x) => x.map((n) => n.type)) }; });
    if (st.phase !== 'MAP') break;
    const nextRow = st.rows[st.row];
    const want = st.lanes.find((l) => nextRow[l] === 'dungeon') ?? st.lanes.find((l) => nextRow[l] === 'elite') ?? st.lanes[0];
    await page.evaluate((l) => window.__ui.act({ type: 'CHOOSE_NODE', lane: l }), want); await idle();
    const t = await page.evaluate(() => window.__ui.view().node && window.__ui.view().node.type);
    if (t === 'dungeon' || t === 'elite') {
      await page.evaluate(() => window.__ui.settings.set('speed', 2));
      await page.evaluate(() => document.querySelector('#screens .dialog .btn.primary').click()); await idle(); await sleep(300);
      await page.evaluate(() => window.__ui.act({ type: 'SET_AUTOPLAY', on: false }));
      await idle(); await sleep(200);
      await page.click('#actionbar .ab.basic'); await sleep(450);
      await shot('16-elite-or-dungeon-fight');
      await idle();
      break;
    }
    // leave non-combat nodes quickly
    await page.evaluate(async () => {
      const ui = window.__ui; let v = ui.view();
      for (let k = 0; k < 40 && v.phase === 'NODE'; k++) {
        if (v.loot) await ui.act(v.loot.kind === 'loot' ? { type: 'LOOT_TAKE_ALL' } : { type: 'CHOOSE_REWARD', i: 0 });
        else if (v.combat && !v.combat.over) await ui.act({ type: 'AUTO' });
        else if (v.node.step === 'intro') await ui.act(v.node.type === 'grind' ? { type: 'GRIND_SET_WAVES', n: 1 } : { type: 'ACCEPT' });
        else if (v.node.step === 'shrine') await ui.act({ type: 'CHOOSE_REWARD', i: 0 });
        else if (v.node.step === 'chest') await ui.act({ type: 'OPEN_CHEST' });
        else if (v.node.step === 'between') await ui.act({ type: 'CONTINUE' });
        else { const r = await ui.act({ type: 'LEAVE' }); if (!r.ok) await ui.act({ type: 'LOOT_CLOSE' }); }
        await ui.idle(); v = ui.view();
      }
    });
  }
  // boss
  await page.evaluate(() => window.__ui.settings.set('speed', 2));
  await page.evaluate(() => window.__ui.act({ type: 'DEBUG_JUMP', to: 'camp', level: 60, gear: true, hours: 136 }));
  await idle(); await sleep(400);
  await shot('17-camp');
  await clickText('button', 'Face Oruvath'); await sleep(1600);
  await shot('18-boss-intro');
  await idle(); await sleep(300);
  await page.evaluate(() => window.__ui.settings.set('speed', 0));
  for (let i = 0; i < 16; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(); }
  await page.evaluate(() => window.__ui.settings.set('speed', 2));
  await page.click('#actionbar .ab.basic'); await sleep(500);
  await shot('19-boss-fight');
  await idle();
  await page.evaluate(() => window.__ui.settings.set('speed', 0));
  for (let i = 0; i < 80; i++) { const ph = await page.evaluate(() => window.__ui.view().phase); if (ph !== 'BOSS') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(); }
  await sleep(600);
  await shot('20-run-summary');
  await browser.close();
}

/** Real engine: a fixed-seed Hunter run driven by autoplay, pausing for screenshots. */
async function deepEngineRun(page, shot, idle, clickText) {
  const auto = (n = 1) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) { const r = await window.__ui.act({ type: 'AUTO' }); if (!r || !r.ok) return false; } return true; }, n);
  const v = () => page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, zone: x.zone && x.zone.idx, node: x.node && x.node.type, step: x.node && x.node.step, origin: x.node && x.node.origin, combat: !!(x.combat && !x.combat.over), kind: x.combat && x.combat.kind, loot: x.loot && x.loot.kind, level: x.player && x.player.level, hub: x.hub && x.hub.used }; });
  await page.evaluate(() => window.__ui.settings.set('speed', 0));
  // new run, fixed seed
  await page.evaluate(async () => { const ui = window.__ui; let x = ui.view(); for (let i = 0; i < 4000 && x.phase !== 'SUMMARY'; i++) { await ui.act({ type: 'AUTO' }); x = ui.view(); } await ui.act({ type: 'END_RUN' }); });
  await idle();
  await page.evaluate(async () => { const ui = window.__ui; await ui.act({ type: 'SELECT_CLASS', classId: 'hunter' }); await ui.act({ type: 'SET_SEED', seed: 4 }); await ui.act({ type: 'START_RUN' }); });
  await idle();
  let s = await v(); let guard = 0;
  // pure autoplay from here; screenshots never change the run
  while ((s.level < 12 || s.phase !== 'MAP') && s.phase !== 'SUMMARY' && guard++ < 3000) { await auto(); s = await v(); }
  await page.keyboard.press('KeyN'); await sleep(300); await shot('14-talents'); await page.keyboard.press('Escape'); await sleep(100);
  await page.keyboard.press('KeyC'); await page.keyboard.press('KeyB'); await sleep(300); await shot('15-character-bags'); await page.keyboard.press('Escape'); await sleep(100);
  // a fight with two or more enemies, shown mid-round
  const groupFight = () => page.evaluate(() => { const x = window.__ui.view(); const c = x.combat; return !!(c && !c.over && x.node && x.node.step === 'combat' && c.enemies.filter((e) => e.alive).length >= 2); });
  while (!(await groupFight()) && s.phase !== 'SUMMARY' && guard++ < 4000) { await auto(); s = await v(); }
  if (await groupFight()) {
    await page.evaluate(() => window.__ui.settings.set('speed', 1));
    page.evaluate(() => window.__ui.act({ type: 'AUTO' }));
    await sleep(900);
    await shot('16-group-fight');
    await idle();
    await page.evaluate(() => window.__ui.settings.set('speed', 0));
  }
  // camp and boss
  await page.evaluate(() => window.__ui.settings.set('speed', 0));
  while (s.phase !== 'CAMP' && s.phase !== 'SUMMARY' && guard++ < 6000) { await auto(); s = await v(); }
  if (s.phase === 'CAMP') {
    await page.evaluate(() => window.__ui.settings.set('speed', 2));
    await sleep(700); await shot('17-camp');
    await clickText('button', 'Face Oruvath'); await sleep(1700); await shot('18-boss-intro');
    await idle();
    await page.evaluate(() => window.__ui.settings.set('speed', 0));
    for (let i = 0; i < 14; i++) { await auto(); await idle(); }
    await page.evaluate(() => window.__ui.settings.set('speed', 1));
    page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await sleep(1100);
    await shot('19-boss-fight');
    await idle();
    await page.evaluate(() => window.__ui.settings.set('speed', 0));
  }
  while (s.phase !== 'SUMMARY' && guard++ < 6000) { await auto(); s = await v(); }
  await sleep(800);
  await shot('20-run-summary');
}

for (const [W, H] of SIZES) {
  console.log(`checking ${W}x${H}`);
  try { await run(W, H, `${W}x${H}`); } catch (e) { errors.push(`[${W}x${H}] check failed: ${e.stack || e.message}`); }
}
console.log('\nconsole messages:', logs.length ? '\n  ' + logs.join('\n  ') : 'none');
console.log('network requests besides the file:', requests.length ? '\n  ' + requests.join('\n  ') : 'none');
console.log('console errors / page errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
process.exit(errors.length ? 1 : 0);
