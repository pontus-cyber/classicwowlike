#!/usr/bin/env node
/**
 * qa/browser/pace.mjs - how long one manual combat round stays on screen (balance.md section 5 asks QA to
 * measure PACE_MANUAL_ROUND_S in the first playable build). Plays zone 1 fights by pressing key 1 and
 * times each round from the key press until the animations end, at a chosen animation speed. This is the
 * floor of a manual round: a player's decision time comes on top.
 *
 *   node qa/browser/pace.mjs [--file /tmp/qa-game.html] [--speed 1] [--rounds 30] [--class mage] [--seed 9]
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/qa-game.html'));
const SPEED = Number(arg('--speed', '1'));
const ROUNDS = Number(arg('--rounds', '30'));
const CLS = arg('--class', 'mage');
const SEED = Number(arg('--seed', '9'));
const { chromium } = (() => { for (const b of ['/home/claude/tools-ui/package.json', import.meta.url]) { try { return createRequire(b)('playwright'); } catch { /* next */ } } throw new Error('playwright not found'); })();

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto(`${pathToFileURL(FILE).href}?seed=${SEED}&speed=${SPEED}`);
await page.waitForFunction(() => window.__ui);
const idle = () => page.evaluate(() => window.__ui.idle());
const v = () => page.evaluate(() => { const x = window.__ui.view(); return { round: x.combat && x.combat.round, over: x.combat && x.combat.over, step: x.node && x.node.step, phase: x.phase }; });
await page.locator(`#create .ccard[data-cls="${CLS}"]`).click(); await idle();
await page.getByRole('button', { name: 'Enter the world' }).click(); await idle();
await page.getByRole('button', { name: 'Set out' }).click(); await idle();
const travel = [];
const times = [];
for (let i = 0; i < 400 && times.length < ROUNDS; i++) {
  const s = await v();
  if (s.phase === 'SUMMARY') break;
  if (s.phase === 'MAP') {
    const l = await page.evaluate(() => { const x = window.__ui.view(); const row = x.zone.rows[x.zone.pos.row] || []; return x.legal.lanes.find((k) => ['grind', 'quest'].includes(row[k] && row[k].type)) ?? x.legal.lanes[0]; });
    if (l === undefined) break;
    const t = Date.now();
    await page.locator(`#screens button.mnode.reach[data-lane="${l}"]`).click(); await idle();
    travel.push(Date.now() - t);
    continue;
  }
  if (s.step === 'intro') {
    const g = page.getByRole('button', { name: '3 waves · 3 tolls' });
    if (await g.count()) await g.click(); else await page.locator('#screens .dialog .btn.primary').click();
    await idle(); continue;
  }
  if (s.over || !s.round) {
    if (s.step === 'between') { await page.getByRole('button', { name: /Next wave|Press on|Face the boss/ }).click(); await idle(); continue; }
    const c = page.locator('#screens .btn.primary, #screens .icard');
    if (await c.count()) { await c.first().click(); await idle(); continue; }
    break;
  }
  const t = Date.now();
  await page.keyboard.press('Digit1');
  await idle();
  times.push(Date.now() - t);
}
await browser.close();
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
console.log(`speed ${SPEED}×, ${CLS}: ${times.length} rounds, median ${med(times)} ms per round (min ${Math.min(...times)}, max ${Math.max(...times)}); travel to a node median ${med(travel)} ms (${travel.length} trips)`);
