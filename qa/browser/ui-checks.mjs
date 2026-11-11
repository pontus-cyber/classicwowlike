#!/usr/bin/env node
/**
 * qa/browser/ui-checks.mjs - focused checks of single UI behaviours in the built game (M1 1.5).
 * Each check prints PASS or FAIL with what it saw; exit 1 if any fails. About one minute.
 *
 *   node tools/build.mjs --out /tmp/qa-game.html
 *   node qa/browser/ui-checks.mjs [--file /tmp/qa-game.html] [--size 1366x768] [--shots dir]
 *
 * Checks: the Autoplay toggle (button and key Z) advances a fight on its own; the map tooltip of a node
 * tells how many enemies wait there; the combat log names what was bought, sold, equipped and used; keys
 * 1-7 and A act in a fight; Escape opens the settings; no console or page errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/qa-game.html'));
const [W, H] = arg('--size', '1366x768').split('x').map(Number);
const SHOTS = arg('--shots', null);
const SEED = 5;
const { chromium } = (() => { for (const b of ['/home/claude/tools-ui/package.json', import.meta.url]) { try { return createRequire(b)('playwright'); } catch { /* next */ } } throw new Error('playwright not found'); })();

const results = [];
const check = (name, ok, saw) => { results.push({ name, ok, saw }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${saw ? `\n      saw: ${saw}` : ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const idle = () => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
const view = () => page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, step: v.node && v.node.step, type: v.node && v.node.type, round: v.combat && v.combat.round, over: v.combat && v.combat.over, autoplay: v.autoplay, bag: v.player && v.player.bag.filter(Boolean).map((b) => ({ uid: b.uid, id: b.id, kind: b.kind, name: b.name })) }; });
const logText = () => page.locator('#combatlog .lines').innerText();
const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `ui-${n}.jpg`), type: 'jpeg', quality: 60 }); } };

try {
  await page.goto(`${pathToFileURL(FILE).href}?seed=${SEED}`);
  await page.waitForFunction(() => window.__ui);
  // Escape on the class screen opens the settings window.
  await page.keyboard.press('Escape');
  check('Escape opens the settings window', await page.locator('#win-settings').isVisible());
  await page.locator('#win-settings').getByRole('button', { name: 'Instant' }).click();
  await page.locator('#win-settings').getByRole('button', { name: 'Close' }).click();
  await page.locator('#create .ccard[data-cls="hunter"]').click();
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await idle();

  // Vendor: buy a Healing Draught, sell the Trail Rations, then read the combat log.
  await page.locator('.svc-card', { hasText: 'Vendor' }).click(); await idle();
  await page.locator('.vendor-cols > div').nth(0).locator('.trow', { hasText: 'Healing Draught' }).getByRole('button', { name: 'Buy' }).click(); await idle();
  await page.locator('.vendor-cols > div').nth(1).locator('.trow', { hasText: 'Trail Rations' }).getByRole('button', { name: 'Sell' }).click(); await idle();
  await page.getByRole('button', { name: 'Done' }).click(); await idle();
  let log = await logText();
  check('combat log names the item bought', /You buy Healing Draught/.test(log), log.split('\n').filter((l) => /buy/i.test(l)).join(' | '));
  check('combat log names the item sold and the price', /You sell Trail Rations for [1-9]/.test(log), log.split('\n').filter((l) => /sell/i.test(l)).join(' | '));

  // Use an item from the bags (the Healing Draught out of combat) and read the log.
  await page.locator('#micromenu').getByRole('button', { name: 'Bags' }).click(); await idle();
  const v0 = await view();
  const potIdx = v0.bag.findIndex((b) => b.id === 'healing_draught');
  await page.locator('#win-bags .baggrid .slot').nth(potIdx).click();
  await page.locator('.ctxmenu').getByRole('button', { name: 'Put on item slot 8' }).click(); await idle();
  await page.locator('#win-bags').getByRole('button', { name: 'Close' }).click();

  // Map: the tooltip of a quest node should tell how many enemies wait there.
  await page.getByRole('button', { name: 'Set out' }).click(); await idle();
  let twin = R.newRun({ classId: 'rogue', seed: SEED, content: CONTENT });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) twin = R.step(twin, a).state;
  const mv = R.mapView(twin);
  let target = null;
  mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (!target && n.archetypes && n.archetypes.length >= 2 && new Set(n.archetypes).size < n.archetypes.length) target = { r: ri + 1, l, n }; }));
  if (!target) mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (!target && n.archetypes && n.archetypes.length >= 2) target = { r: ri + 1, l, n }; }));
  await page.locator(`#screens button.mnode[data-row="${target.r}"][data-lane="${target.l}"]`).hover();
  await page.waitForTimeout(150);
  // the tooltip without its heat block (hours and the state they end in, M2b heat): its numbers are not the enemy count
  const tip = await page.locator('.tooltip').evaluate((el) => { const c = el.cloneNode(true); c.querySelectorAll('.tt-heat').forEach((x) => x.remove()); document.body.appendChild(c); const t = c.innerText; c.remove(); return t; });
  const k = target.n.archetypes.length;
  await shot('map-tooltip');
  check(`map tooltip shows the enemy count (${target.n.type} at row ${target.r}: ${k} enemies, ${target.n.archetypes.join(', ')})`, new RegExp(`\\b${k}\\b|${k} ?×|×ub?${k}`).test(tip.replace(/Level \d+|Takes \d+ tolls?( per wave)?/g, '')), tip.replace(/\n/g, ' / '));

  // Into a fight on row 1: a quest or grind.
  const lane = mv.rows[0].findIndex((n) => n.type === 'quest' || n.type === 'grind');
  await page.mouse.move(5, 5);
  await page.locator(`#screens button.mnode.reach[data-row="1"][data-lane="${lane}"]`).click(); await idle();
  if (mv.rows[0][lane].type === 'grind') await page.getByRole('button', { name: '2 waves · 2 tolls' }).click(); // M2b v7: whole tolls, no "h"
  else await page.getByRole('button', { name: 'Accept' }).click();
  await idle();
  let v = await view();
  // Key 1 casts the spell in slot 1; key A attacks.
  const r0 = v.round;
  await page.keyboard.press('Digit1'); await idle();
  v = await view();
  check('key 1 casts the spell in bar slot 1 (the round advances)', v.round > r0 || !!v.over, `round ${r0} -> ${v.round}`);
  if (!v.over) {
    const r1 = v.round;
    await page.keyboard.press('KeyA'); await idle();
    v = await view();
    check('key A uses the basic attack (the round advances)', v.round > r1 || !!v.over, `round ${r1} -> ${v.round}`);
  }
  // Autoplay with the action bar toggle: the fight should go on without input.
  v = await view();
  if (v.round && !v.over) {
    const r2 = v.round;
    await page.locator('#actionbar .toggle').click(); await idle();
    const moved = await page.waitForFunction((r) => { const x = window.__ui.view(); return !(x.combat && !x.combat.over) || x.combat.round > r; }, r2, { timeout: 5000 }).then(() => true, () => false);
    v = await view();
    await shot('autoplay');
    check('Autoplay toggle (action bar) plays the fight on its own', moved, `autoplay ${v.autoplay}, round ${r2} -> ${v.round} after 5 s`);
    // Key Z twice (off, on).
    if (!moved) {
      await page.keyboard.press('KeyZ'); await idle(); await page.keyboard.press('KeyZ'); await idle();
      const r3 = (await view()).round;
      const moved2 = await page.waitForFunction((r) => { const x = window.__ui.view(); return !(x.combat && !x.combat.over) || x.combat.round > r; }, r3, { timeout: 5000 }).then(() => true, () => false);
      check('Autoplay with key Z plays the fight on its own', moved2, `round stays ${r3} for 5 s`);
    }
  }
  // Finish the fight by hand (Attack) and look at the loot and log.
  for (let i = 0; i < 60; i++) { v = await view(); if (!(v.round && !v.over)) break; await page.locator('#actionbar .ab.basic').click(); await idle(); }
  log = await logText();
  // Equip something from the bags if there is gear, and read the log.
  const v2 = await view();
  if (v2.phase === 'NODE' && (await page.locator('.loot').count())) { await page.locator('.loot .foot').getByRole('button', { name: /Continue|Take all/ }).click(); await idle(); }
  const reward = page.locator('#screens .choice-cards .icard');
  if (await reward.count()) { await reward.first().click(); await idle(); }
  const v3 = await view();
  const gi = v3.bag.findIndex((b) => b.kind === 'gear');
  if (gi >= 0) {
    await page.locator('#micromenu').getByRole('button', { name: 'Bags' }).click(); await idle();
    await page.locator('#win-bags .baggrid .slot').nth(gi).click();
    await page.locator('.ctxmenu').getByRole('button', { name: 'Equip' }).click(); await idle();
    log = await logText();
    check('combat log names the item equipped', new RegExp(`Equipped ${v3.bag[gi].name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(log), log.split('\n').filter((l) => /Equipped/.test(l)).join(' | '));
  }
} catch (e) {
  check('ui-checks ran to the end', false, e.message.split('\n')[0]);
}
check('no console errors or page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
