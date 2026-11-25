// Screenshots for the Lantern Gouache proof slice (docs/art/proof-slice-2026-11-25.md; MD D.4, D120, D121, D129): the
// real client at 1366x768 with the art switch off (today's look) and on (?art=lantern), same seeds, same states, plus one
// side-by-side image per state (current left, Lantern right). States are reached with the Dev ops (window.__ui.dev) at
// Instant speed, as in docs/art/proposal-1/shots.mjs.
//   node tools/build.mjs --out /tmp/tbwcr-wt-ui/game.html
//   NODE_PATH=/opt/npm-tools/node_modules node docs/art/proof-slice/shots.mjs --file /tmp/tbwcr-wt-ui/game.html
//        [--out docs/art/proof-slice] [--arts current,lantern] [--states a,b] [--no-pair]
// Exit 1 when a state is not reached or a page logs a console error.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/tbwcr-wt-ui/game.html'));
const OUT = path.resolve(arg('--out', path.dirname(fileURLToPath(import.meta.url))));
const ARTS = arg('--arts', 'current,lantern').split(',');
const PICK = arg('--states', null);
const HINTS_KEY = 'tbwcr.hints.v2';
function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url, '/opt/npm-tools/node_modules/package.json', '/opt/npm-tools/package.json']) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const idle = (page) => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
const dev = async (page, op, a) => { await page.evaluate(([o, x]) => window.__ui.dev(o, x), [op, a]); await idle(page); };
const gotIt = async (page) => { const b = page.getByRole('button', { name: 'Got it' }); if (await b.count()) { await b.first().click(); await idle(page); } };
const toCamp = async (page) => {
  await page.locator('#create .ccard[data-cls="hunter"]').click();
  await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
};
/** A fight past its engage round (one Pass), so the Engage panel no longer covers the hero. */
const fight = (classId, zone, ids, passes = 1) => async (page) => {
  await dev(page, 'build', { classId, zone });
  await dev(page, 'fight', { ids });
  await gotIt(page);
  for (let i = 0; i < passes; i++) { await page.keyboard.press('KeyX'); await idle(page); await gotIt(page); }
};
/** HUD, screens and nameplates hidden: only the scene canvas is seen (the close-ups of the actors). */
const bare = async (page) => { await page.addStyleTag({ content: '#app > :not(#world), body > :not(#app) { visibility: hidden !important; }' }); await idle(page); };
/** A class in a zone 1 fight, HUD hidden; the shot is cropped round the hero (and the Hunter's pet), at 2x pixels. */
const actor = (classId) => async (page) => { await fight(classId, 1, ['z1_hedge_ogre'], 0)(page); await bare(page); };
const ACTOR_CLIP = { x: 190, y: 330, width: 560, height: 300 };
const STATES = {
  '1-zone1-fight': { query: 'seed=5&classic=1', go: fight('rogue', 1, ['z1_hedge_ogre', 'z1_scarecrow_hexer', 'z1_barn_wolf']) },
  '2-zone2-elite-fight': { query: 'seed=5&classic=1', go: fight('hunter', 2, ['z2_bargh'], 0) },
  '3-map': { query: 'prep=1&seed=7', go: async (page) => {
      await toCamp(page);
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
      await gotIt(page);
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
      await page.waitForSelector('#screens .expmap', { timeout: 8000 });
      await gotIt(page);
    },
  },
  // the map later in a run: places seen, the Dimming two tolls away (reached as the style snapshot's fog-map-dim state)
  '3b-map-dimming': { query: 'seed=1', go: async (page) => {
      await dev(page, 'build', { classId: 'rogue', zone: 1, mapMode: 'expedition', prep: true, seed: 1 });
      await dev(page, 'god', { on: true });
      const ok = await page.evaluate(async () => {
        const ui = window.__ui;
        for (let n = 0; n < 200; n++) {
          const v = ui.view();
          if (v.phase === 'MAP' && v.zone && v.zone.exp) { const me = v.zone.exp.nodes[v.zone.exp.pos]; if (Number.isFinite(me.dimsIn) && me.dimsIn <= 2 && !me.dimmed) return true; }
          await ui.act({ type: 'AUTO' }); await ui.idle();
        }
        return false;
      });
      if (!ok) throw new Error('the Dimming never came within 2 tolls of the player');
      await idle(page); await gotIt(page);
    },
  },
  '4-camp': { query: 'prep=1&seed=7', go: toCamp },
  '5-actor-hunter': { query: 'seed=5&classic=1', go: actor('hunter'), clip: ACTOR_CLIP },
  '6-actor-rogue': { query: 'seed=5&classic=1', go: actor('rogue'), clip: ACTOR_CLIP },
  '7-actor-mage': { query: 'seed=5&classic=1', go: actor('mage'), clip: ACTOR_CLIP },
  // close-ups of the enemies at 2x pixels, HUD hidden: zone 1's three families, zone 2's elite
  '8-enemies-zone1': { query: 'seed=5&classic=1', go: async (page) => { await fight('rogue', 1, ['z1_hedge_ogre', 'z1_scarecrow_hexer', 'z1_barn_wolf'])(page); await bare(page); }, clip: { x: 660, y: 330, width: 640, height: 300 } },
  '9-elite-zone2': { query: 'seed=5&classic=1', go: async (page) => { await fight('hunter', 2, ['z2_bargh'], 0)(page); await bare(page); }, clip: { x: 760, y: 300, width: 400, height: 330 } },
};

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
let bad = 0;
const names = PICK ? PICK.split(',') : Object.keys(STATES);
const files = {};
for (const name of names) {
  const st = STATES[name]; if (!st) { console.log(`unknown state ${name}`); bad++; continue; }
  for (const art of ARTS) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: st.clip ? 2 : 1 });
    await context.addInitScript(([k]) => { try { localStorage.setItem(k, JSON.stringify({ off: true, seen: {} })); } catch { /* ignore */ } }, [HINTS_KEY]);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(`${pathToFileURL(FILE).href}?${st.query}&speed=instant&guide=0&art=${art}`);
      await page.waitForFunction(() => window.__ui);
      await idle(page);
      await st.go(page);
      await page.mouse.move(1, 1);
      await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
      await page.waitForFunction(() => !document.querySelector('#boot, .toast, #banner.on'), null, { timeout: 8000, polling: 100 }).catch(() => {});
      await idle(page);
      await page.waitForTimeout(600);
      const got = await page.evaluate(() => document.documentElement.dataset.art || 'current');
      if (got !== art) throw new Error(`art is ${got}, wanted ${art}`);
      const file = path.join(OUT, `${name}-${art}-1366.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 88, ...(st.clip ? { clip: st.clip } : {}) });
      (files[name] ||= {})[art] = file;
      console.log(`${path.basename(file)}${errors.length ? `  console errors: ${errors.join(' | ')}` : ''}`);
      if (errors.length) bad++;
    } catch (e) { console.log(`${name} ${art} NOT REACHED: ${e.message.split('\n')[0]}`); bad++; } finally { await context.close(); }
  }
}
// side by side: current on the left, Lantern on the right, with a label strip
if (!args.includes('--no-pair')) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  for (const [name, f] of Object.entries(files)) {
    if (!f.current || !f.lantern) continue;
    const a = fs.readFileSync(f.current).toString('base64'); const b = fs.readFileSync(f.lantern).toString('base64');
    const data = await page.evaluate(async ([a64, b64, title]) => {
      const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/jpeg;base64,${s}`; });
      const [A, B] = await Promise.all([load(a64), load(b64)]);
      const gap = 16; const head = 34; const cv = document.createElement('canvas');
      cv.width = A.width + B.width + gap; cv.height = Math.max(A.height, B.height) + head;
      const c = cv.getContext('2d'); c.fillStyle = '#16120e'; c.fillRect(0, 0, cv.width, cv.height);
      c.font = '600 18px system-ui, sans-serif'; c.fillStyle = '#efe4c8'; c.textBaseline = 'middle';
      c.fillText(`${title}  -  current (art switch off)`, 10, head / 2); c.fillText('Lantern Gouache proof slice (?art=lantern, draft)', A.width + gap + 10, head / 2);
      c.drawImage(A, 0, head); c.drawImage(B, A.width + gap, head);
      return cv.toDataURL('image/jpeg', 0.86).split(',')[1];
    }, [a, b, name]);
    const out = path.join(OUT, `${name}-side-by-side.jpg`);
    fs.writeFileSync(out, Buffer.from(data, 'base64'));
    console.log(path.basename(out));
  }
  await page.close();
}
await browser.close();
process.exitCode = bad ? 1 : 0;
