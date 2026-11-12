// Screenshots for art proposal 1 (docs/art/proposal-1/README.md): the real client at 1366x768 in the current theme and
// in the Lantern proposal (?theme=lantern), same five states, same seeds. States are reached as in
// qa/browser/style-snapshot.mjs (Dev ops through window.__ui, Instant speed).
//   node tools/build.mjs --out /tmp/art-game.html
//   node docs/art/proposal-1/shots.mjs --file /tmp/art-game.html [--out docs/art/proposal-1] [--themes current,lantern]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/art-game.html'));
const OUT = path.resolve(arg('--out', path.dirname(fileURLToPath(import.meta.url))));
const THEMES = arg('--themes', 'current,lantern').split(',');
const ELITE = 'z2_bargh';
function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url, '/opt/npm-tools/node_modules/package.json', '/opt/npm-tools/package.json']) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const idle = (page) => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
const dev = async (page, op, a) => { await page.evaluate(([o, x]) => window.__ui.dev(o, x), [op, a]); await idle(page); };
const engineState = (page) => page.evaluate(() => { const s = window.__ui.state(); return typeof s === 'string' ? JSON.parse(s) : s; });
const toFight = async (page) => { await dev(page, 'build', { classId: 'hunter', zone: 2 }); await dev(page, 'fight', { ids: [ELITE] }); };
const toCamp = async (page) => {
  await page.locator('#create .ccard[data-cls="hunter"]').click();
  await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
};
/** Close a first-time tip ("Got it") when one is open, so it does not cover the screen under test. */
const gotIt = async (page) => { const b = page.getByRole('button', { name: 'Got it' }); if (await b.count()) { await b.first().click(); await idle(page); } };
const STATES = {
  '1-combat-deathblow': { query: 'seed=5&classic=1', go: toFight },
  '2-maimed': {
    query: 'seed=5&classic=1',
    go: async (page) => {
      await toFight(page);
      for (let n = 0; n < 5; n++) {
        const s = await engineState(page);
        if (s.fight && s.fight.p.st.some((x) => x.id === 'MAIMED')) return;
        await page.keyboard.press('KeyX'); await idle(page);
      }
      throw new Error('MAIMED not reached');
    },
  },
  '3-fogmap': { query: 'prep=1&seed=7', go: async (page) => {
      await toCamp(page);
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page); // the camp -> the zone hub
      await gotIt(page);
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page); // the hub -> the fog map
      await page.waitForSelector('#screens .expmap', { timeout: 8000 });
    },
  },
  '4-start-camp': { query: 'prep=1&seed=7', go: toCamp },
  '5-character': { query: 'seed=5&classic=1', go: async (page) => { await dev(page, 'build', { classId: 'hunter', zone: 2 }); await gotIt(page); await page.evaluate(() => window.__ui.openWin('character')); await idle(page); } },
};

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let bad = 0;
for (const theme of THEMES) {
  for (const [name, st] of Object.entries(STATES)) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${pathToFileURL(FILE).href}?${st.query}&speed=instant&theme=${theme}`);
      await page.waitForFunction(() => window.__ui);
      await idle(page);
      await st.go(page);
      await page.mouse.move(1, 1);
      await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
      await page.waitForFunction(() => !document.querySelector('#boot, .toast, #banner.on'), null, { timeout: 8000, polling: 100 }).catch(() => {});
      await idle(page);
      await page.waitForTimeout(400);
      const got = await page.evaluate(() => document.documentElement.dataset.theme || 'current');
      if (got !== theme) throw new Error(`theme is ${got}, wanted ${theme}`);
      const file = path.join(OUT, `${name}-${theme}-1366.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
      console.log(`${path.basename(file)}${errors.length ? `  console errors: ${errors.join(' | ')}` : ''}`);
      if (errors.length) bad++;
    } catch (e) { console.log(`${name} ${theme} NOT REACHED: ${e.message.split('\n')[0]}`); bad++; } finally { await context.close(); }
  }
}
await browser.close();
process.exitCode = bad ? 1 : 0;
