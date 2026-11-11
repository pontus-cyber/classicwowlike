#!/usr/bin/env node
/**
 * qa/browser/full-run.mjs - headless browser check of the built game (M1 1.5).
 *
 *   node tools/build.mjs --out /tmp/qa-game.html   # or test the repository's game.html (default)
 *   node qa/browser/full-run.mjs [--file /tmp/qa-game.html] [--sizes 1366x768,1920x1080]
 *        [--classes rogue,mage,hunter] [--seed 7] [--seeds rogue:7,mage:7,hunter:7] [--manual-zones 1]
 *        [--shots /tmp/qa/shots] [--json /tmp/qa/full-run.json] [--quiet]
 *
 * For every size and class: a fresh browser profile, one full run from class select to the run summary,
 * played only with the game's own controls (mouse clicks, drags and keys on buttons, cards, map nodes,
 * the action bar, bags, spellbook and talent windows). Combat is manual in zone 1 (each round is a click
 * on a spell, the basic attack, an item slot, Pass or Flee) and on autoplay after that (the Autoplay
 * toggle on the action bar). window.__ui is used only to read the view and to wait for animations.
 *
 * The choices come from qa/browser/policy.mjs. A Node twin of the run (src/rules.js, same seed, same
 * choices) is stepped alongside: after every action the UI must show the twin's state (time in tolls, level, XP,
 * HP, mana, gold, bags, equipment, bars, talents, zone position, fight round and enemy HP), and at the end
 * the summary screen must show the twin's summary. What the UI sends on its own (a newly bought or looted potion
 * put on a free item slot, window.__ui.ownActions) is applied to the twin too. Combat v2: the engage round's
 * ENGAGE choice is a click on the engage panel's option (keys Q, W, E on autoplay-broken fights).
 *
 * Fails (exit 1) on: a console error or page error, a failed request or any request besides the file,
 * a UI state that differs from the twin, a control that cannot be clicked or lies outside the viewport,
 * or a run that does not reach the summary. Prints one line per run and a JSON report with --json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { playerAction } from './policy.mjs';

const C = R.C;
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
// Default: the repository's game.html (the Lead's build). The old default /tmp/qa-game.html was a stale
// build from 2026-11-09 on this machine, so runs without --file tested old code (vendor log "You buy item.").
const FILE = path.resolve(arg('--file', new URL('../../game.html', import.meta.url).pathname));
if (!fs.existsSync(FILE)) { console.error(`no build at ${FILE}: node tools/build.mjs --out <file>, then --file <file>`); process.exit(2); }
console.log(`build: ${FILE} (${new Date(fs.statSync(FILE).mtimeMs).toISOString().slice(0, 16)}, ${Math.round(fs.statSync(FILE).size / 1024)} KB)`);
const SIZES = arg('--sizes', '1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const CLASSES = arg('--classes', 'rogue,mage,hunter').split(',');
const SEED = Number(arg('--seed', '7'));
const SEEDS = Object.fromEntries((arg('--seeds', '') || '').split(',').filter(Boolean).map((x) => x.split(':')).map(([c, n]) => [c, Number(n)]));
const MANUAL_ZONES = Number(arg('--manual-zones', '1'));
const SHOTS = arg('--shots', null);
const JSON_OUT = arg('--json', null);
const QUIET = args.includes('--quiet');
const MAX_STEPS = 12000;
const CLICK_TIMEOUT = 8000;
const AUTOPLAY_WAIT = 5000; // ms a fight on autoplay may sit on one round before the check calls autoplay stuck
const PET = 'ridgewolf';

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url]) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found (looked in /home/claude/tools-ui and next to this file)');
}
const { chromium } = loadPlaywright();
if (!fs.existsSync(FILE)) { console.error(`no build at ${FILE}: run node tools/build.mjs --out ${FILE}`); process.exit(2); }
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const FILE_URL = pathToFileURL(FILE).href;
const log = (...a) => { if (!QUIET) console.log(...a); };

// ------------------------------------------------------------------------------------------ view and twin
/** Runs in the page: the parts of the UI view that the checks compare (read only). */
function slimView() {
  const v = window.__ui.view();
  const p = v.player;
  return {
    phase: v.phase, time: v.time, autoplay: v.autoplay,
    player: p && {
      level: p.level, xp: p.xp, hp: p.hp, maxHp: p.maxHp, gold: p.gold, res: p.res, cp: p.cp, talentPoints: p.talentPoints,
      bag: p.bag.filter(Boolean).map((b) => `${b.uid}:${b.count || 1}`),
      equip: Object.entries(p.equip).filter(([, it]) => it).map(([k, it]) => `${k}:${it.uid}`).sort(),
      bar: p.bar, itemBar: p.itemBar, talents: p.talents, spells: p.spells.map((k) => `${k.id}:${k.tl}`),
      pet: p.pet && { hp: p.pet.hp, alive: p.pet.alive },
    },
    zone: v.zone && { idx: v.zone.idx, row: v.zone.pos.row, lane: v.zone.pos.lane, questsDone: v.zone.questsDone },
    node: v.node && { type: v.node.type, step: v.node.step, origin: v.node.origin || null, fightNo: v.node.fightNo },
    combat: v.combat && { round: v.combat.round, over: v.combat.over || null, enemies: v.combat.enemies.map((e) => `${e.idx}:${e.hp}:${e.alive ? 1 : 0}`) },
    loot: v.loot && { kind: v.loot.kind, gold: v.loot.gold || 0, xp: v.loot.xp || 0, trap: !!v.loot.trap, items: (v.loot.items || []).map((it) => ({ uid: it.uid, pending: !!it.pending })), choices: (v.loot.choices || []).length },
    summary: v.summary && { outcome: v.summary.outcome, level: v.summary.level, time: v.summary.time, fights: v.summary.fights, rounds: v.summary.rounds, quests: v.summary.quests, dungeons: v.summary.dungeons, kills: v.summary.kills, echoTotal: v.summary.echoTotal, seed: v.summary.seed },
    legal: v.legal && { lanes: v.legal.lanes, travelOn: v.legal.travelOn, flee: v.legal.flee },
  };
}

/** The same fields from the twin's engine state. */
function slimTwin(s) {
  const p = s.player;
  const f = s.fight;
  const kind = C.CLASS[p.classId].resource;
  return {
    time: s.time,
    player: {
      level: p.level, xp: p.xp, hp: p.hp, maxHp: p.d.maxHp, gold: p.gold,
      res: kind === 'mana' ? { kind, cur: p.mana, max: p.d.maxMana } : f ? { kind, cur: f.p[kind], max: f.p[`${kind}Max`] } : null,
      bag: p.bag.map((b) => `${b.uid}:${b.qty || 1}`),
      equip: Object.entries(p.equipped).filter(([, it]) => it).map(([k, it]) => `${k}:${it.uid}`).sort(),
      bar: p.bar, itemBar: p.itemBar, talents: p.talents, spells: (p.spellOrder || Object.keys(p.spells)).map((id) => `${id}:${p.spells[id].tl}`),
      pet: p.pet && { hp: p.pet.hp, alive: p.pet.alive },
    },
    zone: s.zone && !s.zone.camp && s.zone.z <= 6 ? { idx: s.zone.z, row: s.zone.pos.r, lane: s.zone.pos.l, questsDone: s.zone.questsDone || 0 } : null,
    combat: f && { round: f.round, enemies: f.enemies.map((e) => `${e.idx}:${e.hp}:${e.alive ? 1 : 0}`) },
  };
}

function diff(a, b, pre = '') {
  const out = [];
  if (a === b) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diff(a[k], b[k], pre ? `${pre}.${k}` : k));
    return out;
  }
  if ((a === null || a === undefined) && (b === null || b === undefined)) return out;
  out.push(`${pre}: ui ${JSON.stringify(a)} vs engine ${JSON.stringify(b)}`);
  return out;
}

/** Compare the UI view with the twin. Fight fields only while the UI shows the live fight. */
function compare(v, s) {
  const t = slimTwin(s);
  const ui = { time: v.time, player: { ...v.player }, zone: v.zone && v.zone.idx <= 6 ? v.zone : null };
  delete ui.player.cp; delete ui.player.talentPoints;
  if (!s.fight) { if (t.player.res && t.player.res.kind !== 'mana') t.player.res = null; if (ui.player.res && ui.player.res.kind !== 'mana') ui.player.res = null; }
  const out = diff(ui, { time: t.time, player: t.player, zone: t.zone });
  if (s.fight && v.combat && !v.combat.over && !v.loot) out.push(...diff(v.combat.round, t.combat.round, 'combat.round'), ...diff(v.combat.enemies, t.combat.enemies, 'combat.enemies'));
  return out;
}

/** A name for the screen on show, for the once-per-screen layout check. */
function screenKind(v) {
  if (v.loot) return `loot-${v.loot.kind}`;
  if (v.phase === 'ZONE_HUB' || v.phase === 'CAMP') return `${v.phase === 'CAMP' ? 'camp' : 'hub'}${v.node && v.node.origin === 'hub' ? `-${v.node.type}` : ''}`;
  if (v.phase === 'BOSS') return 'combat-boss';
  if (v.phase === 'NODE' && v.node) {
    if (v.combat && !v.combat.over) return `combat-${v.combat.enemies.length >= 3 ? '3' : v.combat.enemies.length}`;
    return `node-${v.node.type}-${v.node.step}`;
  }
  return v.phase.toLowerCase();
}

// ------------------------------------------------------------------------------------------ one run
async function playOne(browser, W, H, cls) {
  const seed = SEEDS[cls] ?? SEED;
  const tag = `${W}x${H} ${cls}`;
  const res = { size: `${W}x${H}`, cls, seed, ok: false, outcome: null, steps: 0, uiActions: 0, keys: 0, ms: 0, console: [], consoleErrors: [], pageErrors: [], requests: [], failedRequests: [],
    divergences: [], layout: [], problems: [], notes: [], shots: [], summary: null, twinSummary: null, reached: null, build: null };
  const t0 = Date.now();
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (m) => { const line = `${m.type()}: ${m.text()}`; res.console.push(line); if (m.type() === 'error') res.consoleErrors.push(line); });
  page.on('pageerror', (e) => res.pageErrors.push(e.stack || e.message));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith('blob:') && u.split('?')[0] !== FILE_URL) res.requests.push(u); });
  page.on('requestfailed', (r) => { const u = r.url(); if (!u.startsWith('data:')) res.failedRequests.push(`${u} ${r.failure() && r.failure().errorText}`); });

  const view = () => page.evaluate(slimView);
  // Wait for queued actions and animations, then two frames so the screens have re-rendered.
  const idle = () => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  const shot = async (name) => {
    if (!SHOTS) return;
    const f = path.join(SHOTS, `${W}x${H}-${cls}-${name}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 60 });
    res.shots.push(f);
  };
  const shotOnce = new Set();
  const shotFirst = async (name) => { if (!shotOnce.has(name)) { shotOnce.add(name); await shot(name); } };

  /** Click a control the way a player does; checks that it is inside the viewport. */
  async function click(loc, label, opts = {}) {
    const first = loc.first();
    for (let attempt = 0; ; attempt++) {
      try {
        await first.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT });
        // A control clipped by a scrolling panel is invisible until the player scrolls: a layout finding for a
        // primary button (the one a screen is about), a note for anything else (long lists scroll by design).
        const clip = await first.evaluate((el) => {
          const r = el.getBoundingClientRect();
          for (let p = el.parentElement; p; p = p.parentElement) {
            if (!/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) continue;
            const pr = p.getBoundingClientRect();
            if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1) return { panel: p.className.split(' ').slice(0, 3).join('.'), primary: el.matches('.btn.primary') };
          }
          return null;
        }).catch(() => null);
        if (clip) {
          const msg = `${label}: hidden in a scrolling panel (${clip.panel}); visible only after scrolling`;
          if (clip.primary) { if (!res.layout.includes(msg)) res.layout.push(msg); } else if (!res.notes.includes(msg)) res.notes.push(msg);
        }
        await first.scrollIntoViewIfNeeded({ timeout: CLICK_TIMEOUT });
        const box = await first.boundingBox();
        if (!box || box.x < -1 || box.y < -1 || box.x + box.width > W + 1 || box.y + box.height > H + 1) {
          const msg = `${label}: outside the ${W}x${H} viewport (${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}` : 'no box'})`;
          if (!res.layout.includes(msg)) res.layout.push(msg);
        }
        await first.click({ timeout: CLICK_TIMEOUT, button: opts.button || 'left' });
        break;
      } catch (e) {
        // A screen that re-renders between finding and clicking (vendor list after a purchase): find it again.
        if (attempt < 3 && /not attached|detached/.test(e.message)) { await idle(); continue; }
        await shot(`fail-${res.uiActions}`);
        throw new Error(`cannot click ${label}: ${e.message.split('\n')[0]}`);
      }
    }
    res.uiActions++;
    await idle();
  }
  const button = (name, within = page) => within.getByRole('button', { name, exact: typeof name === 'string' });

  /** Once per screen kind: every visible panel lies inside the viewport, and right-side panels clear the minimap. */
  const laidOut = new Set();
  async function checkLayout(kind) {
    if (laidOut.has(kind)) return;
    laidOut.add(kind);
    if (kind.startsWith('combat')) await page.waitForTimeout(700); // enemies walk in on the canvas
    const found = await page.evaluate(([W, H]) => {
      const out = [];
      const sel = ['#screens .side', '#screens .dialog', '#screens .mapwin', '#screens .loot', '#screens .svc', '#screens .summary', '#screens #create .bottom', '#windows .win',
        '#actionbar', '#player-frame', '#pet-frame', '#target-frame', '#boss-frame', '#minimap', '#micromenu', '#xpbar', '#tracker', '#nameplates .np:not(.dead)'];
      const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && !el.classList.contains('hidden'); };
      for (const s of sel) for (const el of document.querySelectorAll(s)) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2) out.push(`${s} at ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)} leaves the ${W}x${H} viewport`);
      }
      const mm = document.querySelector('#minimap');
      if (mm && vis(mm)) {
        const m = mm.getBoundingClientRect();
        for (const el of document.querySelectorAll('#screens .side, #screens .dialog.rightside, #screens .loot, #screens .svc')) {
          if (!vis(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top) out.push(`${el.className.split(' ').slice(0, 2).join('.')} overlaps the minimap`);
        }
      }
      return out;
    }, [W, H]);
    for (const f of found) { const msg = `${kind}: ${f}`; if (!res.layout.includes(msg)) res.layout.push(msg); }
    if (found.length) await shot(`layout-${kind}`);
  }

  async function openWindow(name, key) {
    if (await page.locator(`#win-${key}`).count()) return page.locator(`#win-${key}`);
    await click(button(name, page.locator('#micromenu')), `micro menu ${name}`);
    const w = page.locator(`#win-${key}`);
    await w.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT });
    await checkLayout(`window-${key}`);
    return w;
  }
  async function closeWindow(key) {
    const w = page.locator(`#win-${key}`);
    if (await w.count()) await click(w.getByRole('button', { name: 'Close' }), `close ${key}`);
  }
  async function bagMenu(s, uid, item) {
    const idx = s.player.bag.findIndex((b) => b.uid === uid);
    if (idx < 0) throw new Error(`item ${uid} not in the bag`);
    const w = await openWindow('Bags', 'bags');
    await click(w.locator('.baggrid .slot').nth(idx), `bag slot ${idx}`);
    await click(page.locator('.ctxmenu').getByRole('button', { name: item, exact: true }), `bag menu ${item}`);
    await closeWindow('bags');
  }
  async function setTarget(t) {
    if (t == null) return;
    const sel = await page.locator('#nameplates .np.sel').getAttribute('data-idx').catch(() => null);
    if (sel !== null && Number(sel) === t) return;
    await click(page.locator(`#nameplates .np[data-idx="${t}"]`), `nameplate ${t}`);
  }

  async function key(k, label) { await page.keyboard.press(k); res.uiActions++; res.keys++; await idle(); }

  // ---- engine action -> UI controls (opts.keys: combat by keyboard: 1-7, A, 8 9 0, X, F F)
  async function perform(a, s, v, opts = {}) {
    const p = s.player;
    const camp = s.phase === 'CAMP';
    if (opts.keys && s.fight) {
      switch (a.type) {
        case 'CAST': if (C.SPELL[a.spellId].target === 'enemy') await setTarget(a.target); return key(`Digit${p.bar.indexOf(a.spellId) + 1}`, `key cast ${a.spellId}`);
        case 'ATTACK': await setTarget(a.target); return key('KeyA', 'key attack');
        case 'USE_ITEM': return key(['Digit8', 'Digit9', 'Digit0'][a.slot], 'key item');
        case 'PASS': return key('KeyX', 'key pass');
        case 'FLEE': await key('KeyF', 'key flee'); return key('KeyF', 'key flee (confirm)');
        case 'ENGAGE': {
          // combat v2: Q, W, E are the class's engage options in order; the Mage's Pre-cast is Q, then the spell's key
          if (a.target != null) await setTarget(a.target);
          const k = C.ENGAGE_OPTIONS[p.classId].indexOf(a.option);
          if (a.option === 'precast') { await key('KeyQ', 'key engage Pre-cast'); return key(`Digit${p.bar.indexOf(a.spellId) + 1}`, `key pre-cast ${a.spellId}`); }
          return key(['KeyQ', 'KeyW', 'KeyE'][k], `key engage ${a.option}`);
        }
        default: break;
      }
    }
    switch (a.type) {
      case 'SERVICE': {
        const name = { trainer: 'Trainer', vendor: camp ? 'Quartermaster' : 'Vendor', inn: camp ? 'Campfire' : 'Inn' }[a.service];
        return click(page.locator('.svc-card', { has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) }), `service ${name}`);
      }
      case 'CAMP_GRIND': return click(page.locator('.svc-card', { hasText: 'Camp wave' }), 'Camp wave');
      case 'FIGHT_BOSS': return click(button('Face Oruvath'), 'Face Oruvath');
      case 'LEAVE': return click(button('Done'), 'Done');
      case 'LEARN': return click(page.locator('.svc .trow', { has: page.locator('.nm', { hasText: new RegExp(`^${C.SPELL[a.spellId].name}$`) }) }).getByRole('button', { name: 'Learn' }), `Learn ${a.spellId}`);
      case 'TRAIN': return click(page.locator('.svc .trow', { has: page.locator('.nm', { hasText: new RegExp(`^${C.SPELL[a.spellId].name}$`) }) }).getByRole('button', { name: /^Train to/ }), `Train ${a.spellId}`);
      case 'TRAIN_ALL': return click(button('Train all'), 'Train all');
      case 'BUY': return click(page.locator('.vendor-cols > div').nth(0).locator('.trow').nth(a.index).getByRole('button', { name: 'Buy' }), `Buy ${a.index}`);
      case 'SELL': {
        const idx = p.bag.findIndex((b) => b.uid === a.itemId);
        return click(page.locator('.vendor-cols > div').nth(1).locator('.trow').nth(idx).getByRole('button', { name: 'Sell' }), `Sell ${a.itemId}`);
      }
      case 'SELL_JUNK': return click(button('Sell junk'), 'Sell junk');
      case 'LEAVE_HUB': return click(button('Set out'), 'Set out');
      case 'CHOOSE_NODE': return click(page.locator(`#screens button.mnode.reach[data-row="${s.zone.pos.r + 1}"][data-lane="${a.lane}"]`), `map node row ${s.zone.pos.r + 1} lane ${a.lane}`);
      case 'TRAVEL_ON': return click(button(/^Travel on/), 'Travel on');
      case 'GRIND_SET_WAVES': return click(button(`${a.n} wave${a.n > 1 ? 's' : ''} · ${a.n} h`), `grind ${a.n}`);
      case 'NEXT_FIGHT': return click(button(s.node.type === 'grind' ? 'Next wave' : s.node.k === C.DUNGEON_TRASH_FIGHTS - 1 ? 'Face the boss' : 'Press on'), 'next fight');
      case 'GRIND_STOP': return click(button('Stop here'), 'Stop here');
      case 'DUNGEON_LEAVE': return click(button('Leave the dungeon'), 'Leave the dungeon');
      case 'CHOOSE_REWARD': return click(page.locator('#screens .choice-cards .icard').nth(a.index), `reward ${a.index}`);
      case 'LOOT_TAKE': case 'LOOT_DROP': case 'EQUIP': {
        const li = s.loot.findIndex((it) => it.uid === a.itemId);
        if (li >= 0) {
          const off = (v.loot.gold ? 1 : 0) + (v.loot.xp ? 1 : 0) + (v.loot.trap ? 1 : 0);
          const row = page.locator('.loot .rows .lrow').nth(off + li);
          return click(row.getByRole('button', { name: { LOOT_TAKE: 'Take', LOOT_DROP: 'Drop', EQUIP: 'Equip' }[a.type], exact: true }), `loot ${a.type} ${li}`);
        }
        if (a.type !== 'EQUIP') throw new Error(`${a.type}: ${a.itemId} not in the loot window`);
        return bagMenu(s, a.itemId, 'Equip');
      }
      case 'DISCARD': return bagMenu(s, a.itemId, 'Discard');
      case 'USE_ITEM': {
        if (s.fight) return click(page.locator(`#actionbar .ab[data-islot="${a.slot}"]`), `item slot ${a.slot}`);
        const it = p.bag.find((b) => b.kind === 'cons' && b.id === a.itemId);
        return bagMenu(s, it.uid, 'Use');
      }
      case 'SET_ITEM_BAR': {
        if (a.itemId === null) return click(page.locator(`#actionbar .ab[data-islot="${a.slot}"]`), `clear item slot ${a.slot}`, { button: 'right' });
        const it = p.bag.find((b) => b.kind === 'cons' && b.id === a.itemId);
        return bagMenu(s, it.uid, `Put on item slot ${['8', '9', '0'][a.slot]}`);
      }
      case 'SPEND_TALENT': {
        const t = C.TALENT[a.talentId];
        const j = Object.values(C.TALENT).filter((x) => x.cls === t.cls && x.tree === t.tree && x.tier === t.tier).findIndex((x) => x.id === t.id);
        const w = await openWindow('Talents', 'talents');
        await shotFirst('talents');
        await click(w.locator('.tree').nth(t.tree).locator('.tier').nth(t.tier - 1).locator('.tal').nth(j), `talent ${a.talentId}`);
        return closeWindow('talents');
      }
      case 'SET_BAR': {
        const slot = page.locator(`#actionbar .ab[data-slot="${a.slot}"]`);
        if (a.spellId === null) return click(slot, `clear bar slot ${a.slot}`, { button: 'right' });
        const k = p.spellOrder.indexOf(a.spellId);
        const w = await openWindow('Spellbook', 'spellbook');
        const row = w.locator('.sprow').nth(k);
        await row.scrollIntoViewIfNeeded();
        const from = await row.boundingBox();
        const to = await slot.boundingBox();
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 - 20, { steps: 3 });
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
        await page.mouse.up();
        res.uiActions++;
        await idle();
        return closeWindow('spellbook');
      }
      case 'SET_AUTOPLAY': return click(page.locator('#actionbar .toggle'), 'Autoplay toggle');
      case 'CAST': {
        if (C.SPELL[a.spellId].target === 'enemy') await setTarget(a.target);
        return click(page.locator(`#actionbar .ab[data-slot="${p.bar.indexOf(a.spellId)}"]`), `cast ${a.spellId}`);
      }
      case 'ATTACK': await setTarget(a.target); return click(page.locator('#actionbar .ab.basic'), 'Attack');
      case 'ENGAGE': {
        // combat v2: the engage panel's option card on the current target; Pre-cast: the spell's button in its card
        if (a.target != null) await setTarget(a.target);
        if (a.option === 'precast') return click(page.locator(`#engage .eg-opt[data-opt="precast"] .eg-sp[data-spell="${a.spellId}"]`), `engage Pre-cast ${a.spellId}`);
        return click(page.locator(`#engage .eg-opt[data-opt="${a.option}"]`), `engage ${a.option}`);
      }
      case 'PASS': return click(button(/^Pass/), 'Pass');
      case 'FLEE': await click(button(/^Flee/), 'Flee'); return click(button(/^Confirm/), 'Flee (confirm)');
      default: throw new Error(`no UI mapping for ${a.type}`);
    }
  }

  try {
    await page.goto(`${FILE_URL}?seed=${seed}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ui && window.__ui.view, null, { timeout: 15000 });
    res.build = await page.evaluate(() => globalThis.__BUILD__ || null);
    await shotFirst('create');
    await checkLayout('create');
    // Settings through the settings window: instant animations, quick autoplay, no travel scenes.
    await page.keyboard.press('Escape');
    const sw = page.locator('#win-settings');
    await sw.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT });
    await click(sw.getByRole('button', { name: 'Instant' }), 'settings Instant');
    await click(sw.getByRole('button', { name: 'Rush' }), 'settings Rush');
    await click(sw.locator('.setrow', { hasText: 'Skip travel scenes' }).locator('.toggle'), 'settings Skip travel');
    await closeWindow('settings');

    // Character creation through the class cards, pet portraits, name and seed fields.
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT });
    await click(page.locator(`#create .ccard[data-cls="${cls}"]`), `class card ${cls}`);
    s = R.step(s, { type: 'SELECT_CLASS', classId: cls }).state;
    if (cls === 'hunter') {
      s = R.step(s, { type: 'SELECT_PET', petId: 'ridgewolf' }).state; // the UI picks the first pet with the class
      await click(page.locator('#create .pets .pet', { hasText: C.PET[PET].name }), `pet ${PET}`);
      s = R.step(s, { type: 'SELECT_PET', petId: PET }).state;
    }
    const name = `Qa${cls[0].toUpperCase()}${cls.slice(1)}`;
    await page.getByRole('textbox', { name: 'Character name' }).fill(name);
    await page.getByRole('textbox', { name: 'Run seed' }).fill(String(seed));
    await click(button('Enter the world'), 'Enter the world');
    for (const a of [{ type: 'SET_NAME', name }, { type: 'SET_SEED', seed }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    let v = await view();
    if (v.phase !== 'ZONE_HUB') throw new Error(`after Enter the world the phase is ${v.phase}`);
    await shotFirst('hub');

    let autoplay = false;
    let autoplayBroken = false;
    // The UI puts a newly bought or looted combat consumable on a free item slot by itself (src/ui/app.js placeNewItems,
    // BUG-QA-04): it sends SET_ITEM_BAR without input. The twin applies the same actions (window.__ui.ownActions) before
    // every comparison, after the action that brought the item.
    let ownSeen = 0;
    const mirrorOwn = async () => {
      const own = await page.evaluate(() => (window.__ui.ownActions ? window.__ui.ownActions() : []));
      for (const a of own.slice(ownSeen)) {
        if (!R.isLegal(s, a)) { res.problems.push(`the UI's own ${JSON.stringify(a)} is not legal in the twin: ${R.whyIllegal(s, a)}`); continue; }
        s = R.step(s, a).state;
      }
      ownSeen = own.length;
    };
    for (let step = 0; step < MAX_STEPS; step++) {
      res.steps = step;
      await mirrorOwn();
      v = await view();
      if (v.phase === 'SUMMARY' || s.phase === 'SUMMARY') break;
      await checkLayout(screenKind(v));
      // While the game plays a fight on autoplay the twin lags behind until the fight ends; compare after it.
      const autoFight = s.fight && autoplay && !autoplayBroken && !(v.node && v.node.step === 'intro');
      const d0 = autoFight ? [] : compare(v, s);
      if (d0.length) { res.divergences.push({ step, before: 'next action', diffs: d0.slice(0, 12), phase: s.phase }); break; }
      // Presentation windows that do not change the engine state.
      if (v.loot && v.loot.kind === 'loot' && !(s.loot && s.loot.length)) {
        await shotFirst('loot');
        await click(page.locator('.loot .foot').getByRole('button', { name: /^(Continue|Take all)/ }), 'loot Continue');
        continue;
      }
      if (v.node && v.node.step === 'intro' && s.fight) {
        const label = { quest: 'Accept', elite: 'Engage', dungeon: 'Enter the dungeon', treasure: 'Fight the guardian' }[v.node.type];
        await shotFirst(`intro-${v.node.type}`);
        await click(button(label), `intro ${label}`);
        continue;
      }
      if (v.node && v.node.step === 'rest' && !s.service) { await click(button('Continue'), 'rest Continue'); continue; }
      if (v.node && v.node.step === 'chest') { await click(button('Open the chest'), 'Open the chest'); continue; }
      if ((v.loot && (v.loot.kind === 'reward' || v.loot.kind === 'story'))) await shotFirst(`reward-${v.loot.kind}`);
      // Autoplay fights: the game acts on its own; wait, then step the twin with the same policy.
      if (s.fight && autoplay && !autoplayBroken) {
        const r0 = v.combat ? v.combat.round : 0;
        const moved = await page.waitForFunction((r) => { const x = window.__ui.view(); return x.phase === 'SUMMARY' || !(x.combat && !x.combat.over) || x.combat.round > r; }, r0, { timeout: AUTOPLAY_WAIT, polling: 50 }).then(() => true, () => false);
        if (!moved) {
          autoplayBroken = true;
          res.problems.push(`Autoplay is on but the fight does not advance: round ${r0} for ${AUTOPLAY_WAIT / 1000} s (zone ${s.zone ? s.zone.z : '?'}, ${s.fight.kind} fight); the rest of the run clicks autoplay's choice each round`);
          await shot('autoplay-stuck');
          continue;
        }
        if (s.phase === 'BOSS') {
          await page.waitForFunction(() => { const x = window.__ui.view(); return x.phase !== 'BOSS' || (x.combat && x.combat.round >= 4); }, null, { timeout: 120000, polling: 100 });
          await shotFirst('boss-fight');
        }
        await page.waitForFunction(() => { const x = window.__ui.view(); return x.phase === 'SUMMARY' || !(x.combat && !x.combat.over); }, null, { timeout: 300000, polling: 100 });
        await idle();
        let n = 0;
        while (s.fight && n++ < 2000) s = R.step(s, R.autoAction(s)).state;
        continue;
      }
      // Turn autoplay on after the manual zones (out of combat, with the action bar toggle).
      const inManual = s.zone && !s.zone.camp && s.zone.z <= MANUAL_ZONES && s.phase !== 'CAMP' && s.phase !== 'BOSS';
      if (!inManual && !autoplay && !s.fight) {
        await perform({ type: 'SET_AUTOPLAY', on: true }, s, v);
        s = R.step(s, { type: 'SET_AUTOPLAY', on: true }).state;
        autoplay = true;
        continue;
      }
      // In fights after the manual zones (autoplay broken): click what autoplay would have chosen.
      const a = playerAction(s, { manual: !(s.fight && autoplay) });
      if (!a) throw new Error(`policy has no action in ${s.phase}`);
      if (s.fight && !autoplay) await shotFirst('manual-combat');
      if (s.phase === 'BOSS' && s.fight.round >= 4) await shotFirst('boss-fight');
      if (s.phase === 'MAP') await shotFirst(s.zone.z === 1 ? 'map' : `map-z${s.zone.z}`);
      if (s.phase === 'CAMP') await shotFirst('camp');
      await perform(a, s, v, { keys: s.fight && autoplay });
      s = R.step(s, a).state;
    }
    v = await view();
    if (v.phase !== 'SUMMARY') {
      if (!res.divergences.length) res.problems.push(`run did not reach the summary (UI phase ${v.phase}, engine phase ${s.phase})`);
    } else {
      await page.waitForFunction(() => document.querySelector('#screens .summary'), null, { timeout: 15000 });
      await idle();
      await page.waitForTimeout(3500); // the victory banner fades
      await checkLayout('summary');
      await shot('summary');
      const twin = R.summary(s);
      res.twinSummary = { outcome: twin.outcome, level: twin.level, time: twin.time, fights: twin.fights, rounds: twin.rounds, quests: twin.quests, dungeons: twin.dungeons, kills: twin.kills, echoTotal: twin.echoes ? twin.echoes.total : null, seed: twin.seed };
      res.summary = v.summary;
      res.outcome = v.summary && v.summary.outcome;
      res.reached = twin.reached;
      const ds = diff(v.summary, res.twinSummary, 'summary');
      if (ds.length) res.divergences.push({ step: res.steps, before: 'summary', diffs: ds });
      const text = await page.locator('#screens .summary').innerText();
      if (!/Victory|The run has ended/i.test(text)) res.problems.push('summary screen lacks its heading');
      // A new run starts from the summary, and the profile (Echoes) is kept.
      await click(button('Begin a new run'), 'Begin a new run');
      const after = await view();
      if (after.phase !== 'CREATE') res.problems.push(`Begin a new run led to ${after.phase}`);
      const prof = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('tbwcr.profile.v1')); } catch { return null; } });
      if (!prof || !prof.runs) res.problems.push('profile not saved after the run');
      else res.notes.push(`profile after the run: ${prof.echoes} Echoes, ${prof.runs} run(s)`);
    }
  } catch (e) {
    res.problems.push(`${e.message}`);
  }
  res.ms = Date.now() - t0;
  await context.close();
  res.ok = !res.problems.length && !res.divergences.length && !res.consoleErrors.length && !res.pageErrors.length && !res.requests.length && !res.failedRequests.length && !res.layout.length && !!res.summary;
  log(`${tag}: ${res.ok ? 'PASS' : 'FAIL'} ${res.outcome || '-'} level ${res.summary ? res.summary.level : '?'} at ${res.reached ? (res.reached.camp ? 'camp/boss' : `zone ${res.reached.zone} row ${res.reached.row}`) : '?'}; ${res.steps} decisions, ${res.uiActions} clicks and keys (${res.keys} keys), ${(res.ms / 1000).toFixed(0)} s; console errors ${res.consoleErrors.length}, page errors ${res.pageErrors.length}, requests ${res.requests.length}, divergences ${res.divergences.length}, layout ${res.layout.length}${res.problems.length ? `; problems: ${res.problems.join(' | ')}` : ''}`);
  for (const d of res.divergences) log(`   divergence at step ${d.step} (${d.before}): ${d.diffs.join('; ')}`);
  for (const l of res.layout) log(`   layout: ${l}`);
  for (const e of [...res.consoleErrors, ...res.pageErrors]) log(`   error: ${e}`);
  return res;
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const [W, H] of SIZES) for (const cls of CLASSES) results.push(await playOne(browser, W, H, cls));
await browser.close();
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} runs passed (build ${results[0] && results[0].build})`);
process.exit(bad.length ? 1 : 0);
