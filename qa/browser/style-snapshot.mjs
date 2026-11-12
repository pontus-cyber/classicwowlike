#!/usr/bin/env node
/**
 * qa/browser/style-snapshot.mjs - computed styles of fixed UI states, to prove that a CSS refactor changed nothing on
 * screen. Track R step R1 (docs/reviews/ui-architecture-2026-11-12.md, section 3; D119).
 *
 *   node tools/build.mjs --out /tmp/ui-game.html
 *   node qa/browser/style-snapshot.mjs [--file /tmp/ui-game.html] [--out /tmp/style-snapshot.json] [--size 1366x768] [--states a,b]
 *   node qa/browser/style-snapshot.mjs --compare before.json after.json
 *
 * Snapshot: each state in a fresh browser context at Instant speed, reached through the game's own controls and the
 * Dev menu's ops (window.__ui.dev), the mouse parked in the corner and focus cleared. Then every CSS animation is
 * frozen (finite ones finished, infinite ones paused at 0 ms) and, for every element under <body> and its ::before and
 * ::after, the computed colour, background, border, outline, shadow, filter, font and text properties and the box
 * (getBoundingClientRect, 0.01 px) and, for an <img>, a hash of its source (the icons are data URLs drawn in code) are
 * written to JSON, keyed by the element's path (tag#id.classes:nth-child).
 * The page is read twice, SAMPLE_GAP_MS apart: a value that changes between the two reads is moved by the frame loop
 * (nameplates follow the canvas actors) and is stored as unstable; compare skips it.
 *
 * Compare: prints one line per difference (state, path, property, before -> after) and nothing when the two snapshots
 * are equal; a summary goes to stderr. Exit 0 when equal, 1 when not, 2 on a usage error.
 *
 * States (STATES below): class select, the start camp, the zone hub, the fog map, the fog map with the Dimming two tolls
 * from the player, a Deathblow fight's engage round, MAIMED after the Deathblow lands, loot, the character sheet, the Hall of Echoes, the death summary, the settings window.
 * Playwright comes from /home/claude/tools-ui, a local install or /opt/npm-tools/node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as R from '../../src/rules.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SAMPLE_GAP_MS = 300;
const PROFILE_KEY = 'tbwcr.profile.v1'; // where the game keeps the meta profile (src/ui/engine-bridge.js)
const ELITE = 'z2_bargh'; // zone 2 elite with a heavy Deathblow (as ui-regress part P)

// computed properties read for every element and pseudo-element
const PROPS = [
  'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-clip',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'border-image-source', 'outline-color', 'outline-style', 'outline-width', 'outline-offset',
  'box-shadow', 'text-shadow', 'opacity', 'filter', 'backdrop-filter', 'mix-blend-mode',
  'fill', 'stroke', 'stroke-width', 'caret-color', 'accent-color', 'scrollbar-color', 'column-rule-color',
  'text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-underline-offset', '-webkit-text-stroke-color', '-webkit-text-fill-color',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'white-space',
  'display', 'visibility', 'position', 'z-index', 'transform', 'content',
];

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url, '/opt/npm-tools/node_modules/package.json', '/opt/npm-tools/package.json']) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found (looked in /home/claude/tools-ui, next to this file and in /opt/npm-tools)');
}

// ------------------------------------------------------------------ compare
if (args.includes('--compare')) {
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length !== 2) { console.error('usage: node qa/browser/style-snapshot.mjs --compare before.json after.json'); process.exit(2); }
  const [A, B] = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const out = []; let values = 0; let skipped = 0; let elements = 0;
  const names = [...new Set([...Object.keys(A.states), ...Object.keys(B.states)])];
  for (const st of names) {
    const a = A.states[st]; const b = B.states[st];
    if (!a || !b) { out.push(`${st}: state only in ${a ? files[0] : files[1]}`); continue; }
    if (a.error || b.error) { out.push(`${st}: not reached (${a.error || ''} ${b.error || ''})`.trim()); continue; }
    const keys = [...new Set([...Object.keys(a.elements), ...Object.keys(b.elements)])];
    for (const k of keys) {
      const x = a.elements[k]; const y = b.elements[k];
      if (!x || !y) { out.push(`${st}  ${k}: element only in ${x ? 'before' : 'after'}`); continue; }
      elements++;
      const ux = new Set(x['~'] || []); const uy = new Set(y['~'] || []);
      for (const p of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (p === '~') continue;
        if (ux.has(p) || uy.has(p)) { skipped++; continue; }
        values++;
        if (x[p] !== y[p]) out.push(`${st}  ${k}  ${p}: ${x[p]} -> ${y[p]}`);
      }
    }
  }
  if (out.length) console.log(out.join('\n'));
  console.error(`style-snapshot compare: ${names.length} states, ${elements} elements, ${values} values compared, ${skipped} unstable values skipped: ${out.length ? `${out.length} differences` : 'identical'}`);
  process.exitCode = out.length ? 1 : 0; // no process.exit(): a long diff into a pipe is written whole
} else {
// ------------------------------------------------------------------ snapshot
const FILE = path.resolve(arg('--file', '/tmp/ui-game.html'));
const OUT = path.resolve(arg('--out', '/tmp/style-snapshot.json'));
const [W, H] = arg('--size', '1366x768').split('x').map(Number);
const URL = pathToFileURL(FILE).href;
if (!fs.existsSync(FILE)) { console.error(`no build at ${FILE}: run node tools/build.mjs --out ${FILE}`); process.exit(2); }

/** A meta profile with Echoes to spend and two unlocks owned, so the Hall of Echoes shows every card state. */
function hallProfile() {
  let p = R.newProfile(); p.echoes = 100000;
  const offers = (R.metaOffers(p) || []).filter((o) => o.available && o.rank < o.ranks).slice(0, 2);
  for (const o of offers) p = R.buyMeta(p, o.id);
  p.echoes = 70; p.earned = p.spent + 70; p.runs = 2;
  return p;
}

const idle = (page) => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
const dev = async (page, op, a) => { await page.evaluate(([o, x]) => window.__ui.dev(o, x), [op, a]); await idle(page); };
const engineState = (page) => page.evaluate(() => { const s = window.__ui.state(); return typeof s === 'string' ? JSON.parse(s) : s; });
const until = async (page, fn, arg0, ms = 20000) => page.waitForFunction(fn, arg0, { timeout: ms, polling: 50 });
async function toFight(page, cls) {
  await dev(page, 'build', { classId: cls, zone: 2 });
  await dev(page, 'fight', { ids: [ELITE] });
}

/** Each state: the page query, an optional stored profile, and the steps that reach it. */
const STATES = {
  'class-select': { query: 'seed=7', go: async () => {} },
  'start-camp': {
    query: 'prep=1&seed=7',
    go: async (page) => {
      await page.locator('#create .ccard[data-cls="hunter"]').click();
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    },
  },
  // the zone hub after the camp (this was 'fog-map' until the hub came between the camp and the map, D128)
  'zone-hub': {
    query: 'prep=1&seed=7',
    go: async (page) => {
      await page.locator('#create .ccard[data-cls="hunter"]').click();
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
    },
  },
  // the fog map on setting out from the hub
  'fog-map': {
    query: 'prep=1&seed=7',
    go: async (page) => {
      await page.locator('#create .ccard[data-cls="hunter"]').click();
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
      const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) { await got.first().click(); await idle(page); }
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
      await until(page, () => !!document.querySelector('#screens .expmap'));
    },
  },
  // the fog map with the Dimming two tolls from the player (its wash, Dimmed nodes, the urgent clock): a Rogue's dev-built
  // expedition run in zone 1 on the engine's autoplay choices, god mode on
  'fog-map-dim': {
    query: 'seed=1',
    go: async (page) => {
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
      await idle(page); await until(page, () => !!document.querySelector('#screens .expmap .xclock.urgent'));
    },
  },
  'engage-deathblow': { query: 'seed=5&classic=1', go: async (page) => { await toFight(page, 'hunter'); } },
  maimed: {
    query: 'seed=5&classic=1',
    go: async (page) => {
      await toFight(page, 'hunter');
      for (let n = 0; n < 5; n++) {
        const s = await engineState(page);
        if (s.fight && s.fight.p.st.some((x) => x.id === 'MAIMED')) return;
        await page.keyboard.press('KeyX'); await idle(page);
      }
      throw new Error('MAIMED not reached');
    },
  },
  loot: {
    query: 'seed=5&classic=1',
    go: async (page) => {
      await toFight(page, 'hunter');
      for (let n = 0; n < 6 && !(await page.locator('#screens .loot').count()); n++) await dev(page, 'kill');
      await until(page, () => !!document.querySelector('#screens .loot'), null, 8000);
    },
  },
  character: {
    query: 'seed=5&classic=1',
    go: async (page) => { await dev(page, 'build', { classId: 'hunter', zone: 2 }); await page.evaluate(() => window.__ui.openWin('character')); await idle(page); },
  },
  'hall-of-echoes': {
    query: 'seed=7', profile: hallProfile,
    go: async (page) => { await page.locator('#create .btn.echoes').click(); await idle(page); },
  },
  'death-summary': {
    query: 'seed=5&classic=1',
    go: async (page) => {
      // a zone-1 Hunter against the elite at level 40 dies in round 2; key X passes each round
      await dev(page, 'build', { classId: 'hunter', zone: 1 });
      await dev(page, 'fight', { ids: [ELITE], level: 40 });
      for (let n = 0; n < 12 && (await page.evaluate(() => window.__ui.view().phase)) !== 'SUMMARY'; n++) { await page.keyboard.press('KeyX'); await idle(page); }
      await until(page, () => window.__ui.view().phase === 'SUMMARY', null, 8000);
    },
  },
  settings: {
    query: 'seed=5&classic=1',
    go: async (page) => { await dev(page, 'build', { classId: 'hunter', zone: 2 }); await page.evaluate(() => window.__ui.openWin('settings')); await idle(page); },
  },
};

/** In the page: freeze CSS animations and read the computed styles of every element. */
function readStyles(props) {
  for (const a of document.getAnimations()) {
    try {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (t && Number.isFinite(t.endTime)) a.finish(); else { a.pause(); a.currentTime = 0; }
    } catch { /* an animation that cannot be set is read as it is */ }
  }
  const pathOf = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const idx = e.parentElement ? [...e.parentElement.children].indexOf(e) + 1 : 1;
      const cls = typeof e.className === 'string' && e.className.trim() ? `.${e.className.trim().split(/\s+/).sort().join('.')}` : '';
      parts.unshift(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${cls}:${idx}`);
    }
    return parts.join('>');
  };
  const out = {};
  const read = (cs) => { const o = {}; for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
  for (const el of [document.body, ...document.body.querySelectorAll('*')]) {
    const k = pathOf(el);
    const o = read(getComputedStyle(el));
    const r = el.getBoundingClientRect();
    o.box = [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100).join(',');
    // an image's source (icons are drawn in code into data URLs, art-icons.js): length and an FNV-1a hash (R4)
    if (el.tagName === 'IMG') { const s = el.getAttribute('src') || ''; let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } o.src = `${s.length}:${h.toString(16)}`; }
    out[k] = o;
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      const c = ps.getPropertyValue('content');
      if (c && c !== 'none' && c !== 'normal') out[`${k}${pseudo}`] = read(ps);
    }
  }
  return out;
}

async function snapshot(browser, name, st) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  if (st.profile) await context.addInitScript(([key, json]) => { try { localStorage.setItem(key, json); } catch { /* storage blocked */ } }, [PROFILE_KEY, JSON.stringify(st.profile())]);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${URL}?${st.query}&speed=instant`);
    await page.waitForFunction(() => window.__ui);
    await idle(page);
    await st.go(page);
    await page.mouse.move(1, 1);
    await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
    // the boot screen, toasts and the banner leave on timers: wait until none is left (at most 8 s), then read twice
    await page.waitForFunction(() => !document.querySelector('#boot, .toast, #banner.on'), null, { timeout: 8000, polling: 100 }).catch(() => {});
    await idle(page);
    const a = await page.evaluate(readStyles, PROPS);
    await page.waitForTimeout(SAMPLE_GAP_MS);
    const b = await page.evaluate(readStyles, PROPS);
    let unstable = 0;
    for (const [k, o] of Object.entries(a)) {
      const o2 = b[k];
      if (!o2) { o['~'] = Object.keys(o); unstable += o['~'].length; continue; }
      const u = Object.keys(o).filter((p) => o[p] !== o2[p]);
      if (u.length) { o['~'] = u; unstable += u.length; }
    }
    const count = Object.keys(a).length;
    console.log(`${name.padEnd(18)} ${String(count).padStart(5)} elements, ${unstable} unstable values${errors.length ? `, console errors: ${errors.join(' | ')}` : ''}`);
    return { elements: a, count, unstable, errors };
  } catch (e) {
    console.log(`${name.padEnd(18)} NOT REACHED: ${e.message.split('\n')[0]}`);
    return { error: e.message.split('\n')[0], elements: {}, errors };
  } finally {
    await context.close();
  }
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const pick = arg('--states', null);
const result = { meta: { file: FILE, size: `${W}x${H}`, props: PROPS.length, sampleGapMs: SAMPLE_GAP_MS, at: new Date().toISOString() }, states: {} };
let bad = 0;
for (const [name, st] of Object.entries(STATES)) {
  if (pick && !pick.split(',').includes(name)) continue;
  result.states[name] = await snapshot(browser, name, st);
  if (result.states[name].error || result.states[name].errors.length) bad++;
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)${bad ? `; ${bad} states with errors` : ''}`);
process.exit(bad ? 1 : 0);
}
