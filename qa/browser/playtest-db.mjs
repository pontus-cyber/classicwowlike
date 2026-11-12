/**
 * qa/browser/playtest-db.mjs - a manual-style playtest of the Deathblow fights (M2b v13/v14, QA 2b.8) in the built game.
 *
 *   node qa/browser/playtest-db.mjs [--file game.html] [--size 1366x768] [--class rogue] [--seed 3] [--exp] [--prep]
 *        [--specials 3] [--shots dir] [--name tag] [--zone-max 3]
 *
 * One run at Instant speed. Outside special fights the engine's autoplay choice is sent (AUTO); on the map a reachable
 * Elite or Dungeon node is preferred, and its tooltip is read first. In a special fight (an enemy with a Deathblow in
 * combat.windups) the round is played like a player: the key is read from what the screen says (the turn prompt "answer
 * with W Lay Trap", "wait with X Pass", else the first answer on the line over the enemy). The first special fight
 * answers the Deathblow, the second lets it land (basic attack until it plays), later ones answer it again. In the
 * first special fight's engage round the Autoplay hint is read (Z twice). After a landed Deathblow the MAIMED badge,
 * the potion's number and its tooltip are read. Every reading is printed (JSON lines) with a screenshot path.
 * A tool for the playtest notes, not a pass/fail check; it exits 1 only on a console or page error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const FILE = path.resolve(arg('--file', 'game.html'));
const [W, H] = arg('--size', '1366x768').split('x').map(Number);
const CLS = arg('--class', 'rogue');
const SEED = arg('--seed', '3');
const SPECIALS = Number(arg('--specials', '3'));
const ZONE_MAX = Number(arg('--zone-max', '3'));
const SHOTS = arg('--shots', '/tmp/pt-db');
const NAME = arg('--name', `${CLS}-${SEED}${has('--exp') ? '-exp' : ''}`);
fs.mkdirSync(SHOTS, { recursive: true });

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url]) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}
const { chromium } = loadPlaywright();
const out = (o) => console.log(JSON.stringify(o));
let shotN = 0;
const shot = async (page, tag) => { const p = path.join(SHOTS, `${NAME}-${String(++shotN).padStart(2, '0')}-${tag}.png`); await page.screenshot({ path: p }); return p; };
const idle = (page) => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });

/** What a player reads in a fight: the line over each enemy, the prompt, the engage panel, the bar, MAIMED, the log tail. */
const read = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const tp = document.querySelector('#turnprompt');
  const v = window.__ui.view();
  return {
    round: v.combat && v.combat.round, engage: !!(v.combat && v.combat.engage), over: v.combat && v.combat.over,
    hp: v.player && `${v.player.hp}/${v.player.maxHp}`,
    enemies: v.combat ? v.combat.enemies.map((e) => `${e.name}${e.hp <= 0 ? ' (dead)' : ''}`) : [],
    windups: (v.combat && v.combat.windups || []).map((w) => ({ db: !!w.deathblow, enemy: w.enemy, round: w.round, est: w.est, ready: w.ready, answers: (w.answers || []).map((a) => `${a.via}:${a.name}${a.sure ? '' : '?'}${a.now ? '' : '(later)'}${a.wait ? '(wait)' : ''}`) })),
    lines: [...document.querySelectorAll('#nameplates .np .wub')].filter(vis).map(t),
    prompt: vis(tp) ? t(tp) : null,
    cards: [...document.querySelectorAll('#engage .eg-opt')].filter(vis).map(t),
    alert: [...document.querySelectorAll('#engage .eg-db')].filter(vis).map(t),
    bar: [...document.querySelectorAll('#actionbar .ab[data-slot]')].filter((b) => b.classList.contains('db-now') || b.classList.contains('db-soon')).map((b) => `${b.dataset.slot}:${b.classList.contains('db-now') ? 'now' : 'soon'}:${t(b.querySelector('.atag'))}`),
    maim: vis(document.querySelector('#player-frame .maimb')) ? t(document.querySelector('#player-frame .maimb')) : null,
    items: [...document.querySelectorAll('#actionbar .ab[data-islot]')].map((b) => t(b.querySelector('.mtag'))).filter(Boolean),
    log: [...document.querySelectorAll('#combatlog .lines > *')].slice(-4).map(t),
    stealth: !!(v.player && (v.player.statuses || v.player.st || []).some && (v.player.statuses || v.player.st || []).some((x) => (x.id || x) === 'STEALTH')),
  };
});

/** The key a player would press for the Deathblow answer, from the screen's words. */
function answerKey(r) {
  const p = r.prompt || '';
  let m = /wait with X Pass/.exec(p); if (m) return 'KeyX';
  m = /answer with ([QWE1-7X])\b/.exec(p); if (m) return /\d/.test(m[1]) ? `Digit${m[1]}` : `Key${m[1]}`;
  for (const l of r.lines) { const k = /Answer: ([QWE1-7X]) /.exec(l) || /Wait: ([X]) Pass/.exec(l); if (k) return /\d/.test(k[1]) ? `Digit${k[1]}` : `Key${k[1]}`; }
  return null;
}
/** The key of the engine's autoplay choice (as a player who plays the rotation). */
const autoKey = (page) => page.evaluate(() => {
  const v = window.__ui.view(); const c = window.__ui.autoChoice(); const a = (c && c.action) || c || {};
  if (a.type === 'ENGAGE') { const i = (v.combat.engageOptions || v.combat.engage.options || []).findIndex ? null : null; return { engage: a.option, spellId: a.spellId || null }; }
  if (a.type === 'CAST' && v.player.bar.includes(a.spellId)) return `Digit${v.player.bar.indexOf(a.spellId) + 1}`;
  if (a.type === 'USE_ITEM' && a.slot != null) return ['Digit8', 'Digit9', 'Digit0'][a.slot];
  if (a.type === 'PASS') return 'KeyX';
  return 'KeyA';
});

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  const q = `seed=${SEED}&speed=instant${has('--exp') ? '&expedition=1' : ''}${has('--prep') ? '&prep=1' : ''}`;
  await page.goto(`${pathToFileURL(FILE).href}?${q}`);
  await page.waitForFunction(() => window.__ui);
  await page.evaluate((cls) => window.__ui.act({ type: 'SELECT_CLASS', classId: cls }), CLS); await idle(page);
  if (CLS === 'hunter') { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
  await page.evaluate(() => window.__ui.act({ type: 'START_RUN' })); await idle(page);
  out({ ev: 'start', name: NAME, q, phase: await page.evaluate(() => window.__ui.view().phase) });
  if (has('--prep')) out({ ev: 'prep', shot: await shot(page, 'prep') });

  let specials = 0; let mode = null; let fightKey = null; let hinted = false; let maimRead = false; let seenTips = new Set();
  for (let n = 0; n < 3000; n++) {
    const v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, z: x.zone && x.zone.idx, level: x.player && x.player.level, combat: !!(x.combat && !x.combat.over), step: x.node && x.node.step, loot: !!x.loot, round: x.combat && x.combat.round, key: x.combat ? `${x.time}:${x.combat.enemies.map((e) => e.id || e.name).join(',')}` : null, special: !!(x.combat && (x.combat.windups || []).some((w) => w.deathblow)), kinds: x.combat ? x.combat.enemies.map((e) => e.kind || e.rank || '').join(',') : '' }; });
    if (v.phase === 'SUMMARY' || v.phase === 'ENDED') { out({ ev: 'end', phase: v.phase, shot: await shot(page, 'summary') }); break; }
    if (v.z != null && v.z > ZONE_MAX) { out({ ev: 'stop', why: `zone ${v.z}`, level: v.level }); break; }
    if (specials >= SPECIALS && !v.combat) { out({ ev: 'stop', why: `${specials} special fights`, level: v.level, z: v.z }); await shot(page, 'stop'); break; }

    // the map: read reachable Elite/Dungeon tooltips, prefer one
    if (v.phase === 'MAP' && !v.loot && specials < SPECIALS) {
      const reach = await page.evaluate(() => [...document.querySelectorAll('#screens button.mnode.reach')].map((b, i) => ({ i, label: b.getAttribute('aria-label') })));
      const want = reach.find((r) => /^(Elite|Dungeon)/.test(r.label));
      if (want) {
        const btn = page.locator('#screens button.mnode.reach').nth(want.i);
        await btn.hover(); await page.waitForTimeout(200);
        const tip = (await page.getByRole('tooltip').innerText().catch(() => '')).replace(/\s+/g, ' ');
        const k = `${v.z}:${want.label}`;
        if (!seenTips.has(k)) { seenTips.add(k); out({ ev: 'maptip', z: v.z, level: v.level, node: want.label, tip, shot: await shot(page, 'maptip') }); }
        await btn.click(); await idle(page); await page.mouse.move(2, 2);
        continue;
      }
    }

    if (v.combat && v.special && v.step !== 'intro') {
      if (fightKey !== v.key) {
        fightKey = v.key; specials++; mode = specials === 2 ? 'land' : 'answer';
        const r = await read(page);
        out({ ev: 'special', n: specials, mode, z: v.z, level: v.level, read: r, shot: await shot(page, `special${specials}-engage`) });
        if (!hinted && r.engage) {
          hinted = true;
          await page.evaluate(() => { window.__ui.settings.set('autoDelay', 9000); window.__ui.settings.set('speed', 1); });
          await page.keyboard.press('KeyZ'); await page.waitForTimeout(600);
          const h = await read(page);
          out({ ev: 'autohint', prompt: h.prompt, shot: await shot(page, 'autohint') });
          await page.keyboard.press('KeyZ'); await page.waitForTimeout(300); await idle(page);
          await page.evaluate(() => { window.__ui.settings.set('speed', 0); window.__ui.settings.set('autoDelay', 350); });
        }
      }
      const r = await read(page);
      const pending = r.windups.find((w) => w.db);
      let key;
      if (pending && mode === 'answer') key = answerKey(r);
      else if (pending && mode === 'land') key = r.engage ? 'KeyX' : 'KeyA';
      if (!key) { const a = await autoKey(page); key = typeof a === 'string' ? a : null; if (!key) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); continue; } }
      const before = r;
      await page.keyboard.press(key); await idle(page); await page.mouse.move(2, 2);
      const after = await read(page);
      const dbLog = after.log.filter((l) => /Deathblow|maimed|Maimed|Sapped|stopped/i.test(l));
      out({ ev: 'round', n: specials, mode, round: before.round, key, prompt: before.prompt, lines: before.lines, bar: before.bar, alert: before.alert, after: { hp: after.hp, maim: after.maim, items: after.items, log: dbLog, stealth: after.stealth } });
      if (pending && (dbLog.length || after.maim)) out({ ev: 'resolved', n: specials, shot: await shot(page, `special${specials}-r${before.round}-${mode}`) });
      if (after.maim && !maimRead) {
        maimRead = true;
        const slot = page.locator('#actionbar .ab[data-islot]').first();
        if (await slot.count()) { await slot.hover(); await page.waitForTimeout(250); }
        const tip = (await page.getByRole('tooltip').innerText().catch(() => '')).replace(/\s+/g, ' ');
        out({ ev: 'maimed', maim: after.maim, items: after.items, potionTip: tip, shot: await shot(page, 'maimed-potion') });
        await page.mouse.move(2, 2);
      }
      continue;
    }
    await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
  }
  out({ ev: 'errors', errors });
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
