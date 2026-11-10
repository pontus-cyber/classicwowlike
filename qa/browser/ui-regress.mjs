#!/usr/bin/env node
/**
 * qa/browser/ui-regress.mjs - regression checks for the UI bugs fixed on 2026-11-09
 * (qa/bugs.md BUG-QA-01, 02, 03, 04, 05, 08, 09, 10, 11), for the M2 v2 UI changes (docs/specs/changes-m2-v2.md:
 * map rows from the engine, travel on early, Linked per Shard, the round time budget) and for the M2 v3 UI changes
 * (docs/specs/changes-m2-v3.md: zone danger, Second Breath not in the final fight, Ricochet Bolt at 40 %).
 *
 *   node tools/build.mjs --out /tmp/ui-game.html
 *   node qa/browser/ui-regress.mjs [--file /tmp/ui-game.html] [--sizes 1366x768,1920x1080] [--shots dir] [--parts A,B,C,D,E,F]
 *
 * Every check drives the game's own controls: mouse clicks, hovers and keys on buttons, cards, map nodes,
 * the action bar, the bags and the Autoplay switch. window.__ui is used to read the view and to wait for
 * animations. As setup only, it also reaches late states fast: the camp (the engine's autoplay choices
 * through the AUTO helper, as tools/ui-check.mjs does) and, for the victory banner, a boss fight in the
 * mock engine (DEBUG_JUMP), because no seed of the real engine wins the boss fight today.
 *
 * Parts, each in a fresh browser context, for every size:
 *   A  real engine, seed 30 Hunter at 1x speed: vendor, item bar, the map (the engine's rows and lanes, the
 *      travel button before the travel level), map tooltip and labels, a fight played with keys A and 8, the
 *      Autoplay switch and key Z, quest reward, equip from the bags, the clock.
 *   B  real engine, seed 51 Hunter at Instant speed, the engine's autoplay choices up to the camp: the clock
 *      across midnight, the travel button at every map step (and its tooltip when leaving early is legal), the
 *      camp panel, the bag menu at the right edge, an item used out of combat, Face Oruvath, and the boss fight
 *      played on the Autoplay switch with the Linked strength on the boss frame.
 *   C  mock engine, Mage at the boss at Instant speed: autoplay (key Z) to a victory; no banner over the summary.
 *   D  real engine, seed 9 Hunter at the default speed: manual rounds (the keys of the autoplay policy's choices) within
 *      PACE_ROUND_ANIM_S, an action key and a click during enemy animations finish them, and 2x, 4x and Instant from
 *      the settings window (setup outside fights: the engine's autoplay choices).
 *   E  real engine, seed 63 Hunter with a stored profile that holds Second Breath and Lost Technique I (Ricochet Bolt),
 *      at Instant speed, the engine's autoplay choices up to the camp: the resurrect badge and the character sheet in
 *      zone 1, at the camp and in the boss fight (only the charges that work there, Second Breath named as not working),
 *      the death screen when the hero dies at the boss with Second Breath unused, the Ricochet Bolt tooltip (spellbook),
 *      and zone danger in the zone banners, the minimap tooltip and the map tooltips of zone 3. Expected numbers come
 *      from the engine: a Node run of the same seed and profile (resurrectCharges, spellInfo, summary) and zoneDanger.
 *   F  M3 meta progression, real engine at Instant speed. A stored profile (Vigor of the Line and Wayfinder, 70 Echoes,
 *      two earlier runs) and a Hunter run on the engine's autoplay choices to its death (the shortest such run of seeds
 *      1-80): the summary's balance after the run, "Spend Echoes" opens the Hall of Echoes, the balance and the run log,
 *      every offer of R.metaOffers in its kind's group with rank, cost and state, tooltips, buying Packed Satchel (UI,
 *      saved profile, Alchemist's Notes opens), Esc and the Echoes button, and a new run (seed typed in) that starts
 *      with the unlock (bridge view = a Node START_RUN with the bought profile). Then a profile after a first victory:
 *      Oaths bought for 0, the Oath switches on class select (SET_OATH), the Echo multiplier and the run's Oaths.
 *
 * Seeds were picked with the engine of 3559e0e (M2 v2): seed 30's first quest has two Guardians that last long
 * enough for the potion and Autoplay checks. M2 v3 (77c0ca5): seed 1's autoplay run no longer reaches the camp, so part B
 * moved to seed 51, whose engine autoplay run reaches the camp hurt, with Trail Rations, may leave zone 1 early at level 9,
 * and whose boss fight reaches phase 2 with 1 to 3 Shards. Seed 63 with the part E profile reaches the camp holding a Boon
 * of Return and Second Breath; in the boss fight the Boon returns the hero once, then the hero dies with Second Breath unused.
 *
 * Prints PASS or FAIL per check with what it saw; exit 1 if any check fails or a page logs an error.
 * Playwright comes from /home/claude/tools-ui (or a local install).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as R from '../../src/rules.js';
import { CONTENT } from '../../src/content/index.js';
import { zoneDanger } from '../../src/engine/combat.js'; // zone danger multiplier (rules 7.6, M2 v3); not in the rules.js API

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/ui-game.html'));
const SIZES = arg('--sizes', '1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const SHOTS = arg('--shots', null);
const PARTS = arg('--parts', 'A,B,C,D,E,F').split(',');
const URL = pathToFileURL(FILE).href;
const NEUTRAL = 'rgb(240, 224, 192)'; // label colour of map nodes that hold no fight
const NBSP = /\u00a0/g;
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const R_LINK = { per: R.C.LINK_DR_PER_SHARD, cap: R.C.LINK_DR }; // Linked (rules 10.2, M2 v2)
const BUDGET = R.C.PACE_ROUND_ANIM_S * 1000; // round time budget at the default speed (rules 3, M2 v2)
// Steps with these events hold a moment that has its own place in the pacing model (level-up, fight end, boss phase).
const MOMENTS = ['victory', 'levelUp', 'defeat', 'resurrect', 'bossPhase'];
const PROFILE_KEY = 'tbwcr.profile.v1'; // where the game keeps the meta profile (src/ui/engine-bridge.js)
const HISTORY_KEY = 'tbwcr.history.v1'; // the game's run log (src/ui/engine-bridge.js)

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url]) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found (looked in /home/claude/tools-ui and next to this file)');
}
const { chromium } = loadPlaywright();
if (!fs.existsSync(FILE)) { console.error(`no build at ${FILE}: run node tools/build.mjs --out ${FILE}`); process.exit(2); }
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let SIZE = '';
const check = (bug, name, ok, saw) => {
  results.push({ size: SIZE, bug, name, ok: !!ok, saw });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${SIZE}  ${bug}  ${name}${saw ? `\n      saw: ${saw}` : ''}`);
};

// ------------------------------------------------------------------ page helpers
/** A page of the build. profile: a meta profile stored where the game reads it (localStorage) before it loads. */
async function open(browser, W, H, query, profile = null) {
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  if (profile) await context.addInitScript(([key, json]) => { try { localStorage.setItem(key, json); } catch { /* storage blocked */ } }, [PROFILE_KEY, JSON.stringify(profile)]);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`request ${r.url()}`); });
  await page.goto(`${URL}?${query}`);
  await page.waitForFunction(() => window.__ui);
  return { context, page, errors };
}
const idle = (page) => page.evaluate(async () => { await window.__ui.idle(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
const view = (page) => page.evaluate(() => {
  const v = window.__ui.view();
  return {
    phase: v.phase, hours: v.hours, autoplay: v.autoplay, step: v.node && v.node.step, round: v.combat ? v.combat.round : null, over: v.combat ? v.combat.over : null,
    hp: v.player && v.player.hp, maxHp: v.player && v.player.maxHp, itemBar: v.player && v.player.itemBar, outcome: v.summary && v.summary.outcome,
    bag: v.player ? v.player.bag.map((b) => (b ? { uid: b.uid, id: b.id, kind: b.kind, name: b.name, count: b.count } : null)) : [],
  };
});
const logLines = async (page) => (await page.locator('#combatlog .lines').innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${SIZE}-${name}.png`) }); };
const clockLabel = (h) => { const t = h + 6; return `Day ${Math.floor(t / 24) + 1}, ${String(t % 24).padStart(2, '0')}:00 · ${h} h`; };
/** Wait until the fight's round passes `r` (or the fight is over); false on timeout. */
const roundPast = (page, r, ms) => page.waitForFunction((r0) => { const x = window.__ui.view(); return !(x.combat && !x.combat.over) || x.combat.round > r0; }, r, { timeout: ms, polling: 50 }).then(() => true, () => false);

/** Where an element lies: inside the window, not cut by a scrolling ancestor, and the element on top at its centre. */
function placement(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const inside = r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    let clippedBy = null;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!/(auto|scroll|hidden)/.test(`${cs.overflowX} ${cs.overflowY}`)) continue;
      const ar = a.getBoundingClientRect();
      if (r.top < ar.top - 0.5 || r.bottom > ar.bottom + 0.5 || r.left < ar.left - 0.5 || r.right > ar.right + 0.5) { clippedBy = a.className || a.id || a.tagName; break; }
    }
    const cx = (r.left + r.right) / 2; const cy = (r.top + r.bottom) / 2;
    const top = document.elementFromPoint(cx, cy);
    return { inside, clippedBy, onTop: !!top && (top === el || el.contains(top)), cx, cy, rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
  });
}
const placeText = (p) => `rect ${p.rect.join(',')}${p.inside ? '' : ' (outside the window)'}${p.clippedBy ? ` (cut by .${p.clippedBy})` : ''}${p.onTop ? '' : ' (covered)'}`;
const fullyShown = (p) => p.inside && !p.clippedBy && p.onTop;

/** Open the bags with the micro-menu button, click the item with this uid, return the context-menu locator. */
async function bagMenu(page, uid) {
  if (!(await page.locator('#win-bags').count())) { await page.getByRole('button', { name: 'Bags' }).click(); await idle(page); }
  const v = await view(page);
  const i = v.bag.findIndex((b) => b && b.uid === uid);
  await page.locator('#win-bags .baggrid .slot').nth(i).click();
  return page.locator('.ctxmenu');
}
const closeBags = async (page) => { if (await page.locator('#win-bags').count()) { await page.locator('#win-bags').getByRole('button', { name: 'Close' }).click(); await idle(page); } };

// ------------------------------------------------------------------ part A: early game, real engine, 1x
async function partA(browser, W, H) {
  const SEED = 30;
  // The same run in Node, for the map facts the map and the tooltip must show.
  let twin = R.newRun({ classId: 'rogue', seed: SEED, content: CONTENT });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) twin = R.step(twin, a).state;
  const mv = R.mapView(twin);
  const ROWS = mv.rows.length; const LANES = mv.rows[0].length;
  const need = R.travelLevel(twin); const exit = R.C.ZONE_LEVELS; // zone 1

  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}`);
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);

    check('BUG-QA-09', 'the clock starts on day 1 at 06:00', (await page.locator('#minimap .clock').innerText()) === clockLabel(0), await page.locator('#minimap .clock').innerText());
    const setOut = await placement(page.getByRole('button', { name: 'Set out' }));
    check('BUG-QA-10', 'hub: "Set out" is in view without scrolling', fullyShown(setOut), placeText(setOut));

    // ---- vendor: buy, the item bar, sell
    await page.locator('#screens .svc-card', { hasText: 'Vendor' }).click(); await idle(page);
    const stock = (name) => page.locator('.vendor-cols > div').nth(0).locator('.trow').filter({ has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) });
    const mine = (name) => page.locator('.vendor-cols > div').nth(1).locator('.trow').filter({ has: page.locator('.nm', { hasText: new RegExp(`^${name}( ×\\d+)?$`) }) });
    await stock('Healing Draught').getByRole('button', { name: 'Buy' }).click(); await idle(page);
    let log = await logLines(page);
    check('BUG-QA-03', 'log names the item bought', log.includes('You buy Healing Draught.'), log.filter((l) => /buy/i.test(l)).join(' | '));
    const slot8 = page.getByRole('button', { name: 'Item slot 8: Healing Draught' });
    check('BUG-QA-04', 'a bought potion goes to the free item slot 8, and the log says so', (await slot8.count()) === 1 && log.some((l) => /^Healing Draught goes on item slot 8/.test(l)),
      `${(await view(page)).itemBar.join(',')} | ${log.filter((l) => /item slot/.test(l)).join(' | ')}`);
    // A slot the player clears stays clear when more of the same potion is bought.
    await slot8.click({ button: 'right' }); await idle(page);
    await stock('Healing Draught').getByRole('button', { name: 'Buy' }).click(); await idle(page);
    check('BUG-QA-04', 'a potion already in the bags is not put back on a slot the player cleared', (await page.getByRole('button', { name: 'Empty item slot 8' }).count()) === 1, (await view(page)).itemBar.join(','));
    // ...and the bag menu still puts it there.
    let v = await view(page);
    const menu = await bagMenu(page, v.bag.find((b) => b && b.id === 'healing_draught').uid);
    await menu.getByRole('button', { name: 'Put on item slot 8' }).click(); await idle(page);
    await closeBags(page);
    check('BUG-QA-04', 'the bag menu puts the potion on item slot 8', (await slot8.count()) === 1, (await view(page)).itemBar.join(','));
    await mine('Trail Rations').getByRole('button', { name: 'Sell' }).click(); await idle(page);
    log = await logLines(page);
    const sold = log.find((l) => /^You sell /.test(l)) || '';
    check('BUG-QA-03', 'log names the item sold and the copper received', /^You sell Trail Rations for [1-9][\d ]* copper\.$/.test(sold) && !log.some((l) => /^You receive \d/.test(l)), log.filter((l) => /sell|receive/i.test(l)).join(' | '));
    await stock('Trail Rations').getByRole('button', { name: 'Buy' }).click(); await idle(page);
    log = await logLines(page);
    check('BUG-QA-04', 'food (out of combat only) stays off the item bar', log.includes('You buy Trail Rations.') && (await page.getByRole('button', { name: 'Empty item slot 9' }).count()) === 1, (await view(page)).itemBar.join(','));
    await page.getByRole('button', { name: 'Done' }).click(); await idle(page);

    // ---- map (M2 v2): the engine's rows and lanes, the travel button and the tracker before the travel level
    await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
    await page.mouse.move(2, 2);
    const nodeCount = await page.locator('#screens button.mnode').count();
    const ruler = await page.locator('#screens .mrow').allInnerTexts();
    const lastRow = [];
    for (let l = 0; l < LANES; l++) lastRow.push(await placement(page.locator(`#screens button.mnode[data-row="${ROWS}"][data-lane="${l}"]`)));
    check('M2v2-50', `the map draws the engine's ${ROWS} rows of ${LANES} lanes (ZONE_CHOICE_ROWS ${R.C.ZONE_CHOICE_ROWS}), the last row in view`,
      ROWS === R.C.ZONE_CHOICE_ROWS && nodeCount === ROWS * LANES && ruler.join(',') === Array.from({ length: ROWS }, (_, i) => i + 1).join(',') && lastRow.every(fullyShown),
      `${nodeCount} nodes, ruler ${ruler.join(',')}; last row: ${lastRow.map(placeText).join(' | ')}`);
    const tb = page.locator('#screens .mhead button[data-travel]');
    const tbText = (await tb.innerText()).trim(); const tbKind = await tb.getAttribute('data-travel'); const tbOff = await tb.isDisabled();
    await tb.hover();
    const tbTip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    await shot(page, 'A-map-travel');
    await page.mouse.move(2, 2);
    check('M2v2-45', `travel button at level 1: disabled, "Travel on at level ${need}" (R.travelLevel), tooltip names level ${need}, the exit level ${exit} and row ${ROWS}`,
      tbOff && tbKind === 'locked' && tbText === `Travel on at level ${need}` && tbTip.includes(`Open from level ${need}`) && tbTip.includes(`below the exit level ${exit}`) && tbTip.includes(`Reach level ${need} or finish row ${ROWS} first (you are level 1).`),
      `"${tbText}" (${tbKind}, disabled ${tbOff}) | ${tbTip.replace(/\n/g, ' / ')}`);
    const tracker = (await page.locator('#tracker').innerText()).replace(/\n/g, ' / ');
    check('M2v2-50', `tracker: "Travel on at level ${need} (or after row ${ROWS})" and "Row 0 of ${ROWS}"`, tracker.includes(`Travel on at level ${need} (or after row ${ROWS})`) && tracker.includes(`Row 0 of ${ROWS}`), tracker);

    // ---- map: enemy counts in the tooltip, neutral labels for nodes without a fight
    let target = null;
    mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (!target && n.archetypes && new Set(n.archetypes).size < n.archetypes.length) target = { r: ri + 1, l, n }; }));
    const names = target.n.archetypes.map((a) => a[0].toUpperCase() + a.slice(1));
    const groups = [...new Set(names)].map((nm) => { const k = names.filter((x) => x === nm).length; return k > 1 ? `${k} × ${nm}` : nm; }).join(', ');
    const want = `${target.n.type === 'grind' ? 'Wave 1' : 'Foes'}: ${names.length} enemies (${groups})`;
    await page.locator(`#screens button.mnode[data-row="${target.r}"][data-lane="${target.l}"]`).hover();
    const tipText = await page.getByRole('tooltip').innerText();
    await shot(page, 'A-map-tooltip');
    check('BUG-QA-02', `map tooltip tells the encounter size (${target.n.type}, row ${target.r}: ${target.n.archetypes.join(', ')})`, tipText.includes(want), `${tipText.replace(/\n/g, ' / ')} (wanted "${want}")`);
    await page.mouse.move(2, 2);
    const labels = await page.locator('#screens button.mnode').evaluateAll((els) => els.map((b) => ({ row: b.dataset.row, lane: b.dataset.lane, text: b.querySelector('.cl').textContent, color: getComputedStyle(b.querySelector('.cl')).color })));
    const calm = labels.filter((x) => /^(Rest|Vendor|Trainer|Shrine)$/.test(x.text));
    const fights = labels.filter((x) => /^(Quest|Grind|Elite|Dungeon|Treasure) \d+$/.test(x.text));
    check('BUG-QA-08', `map labels of nodes without a fight are neutral (${calm.length} nodes: ${[...new Set(calm.map((x) => x.text))].join(', ')})`,
      calm.length > 0 && calm.every((x) => x.color === NEUTRAL) && fights.some((x) => x.color !== NEUTRAL), calm.filter((x) => x.color !== NEUTRAL).map((x) => `${x.text} r${x.row} ${x.color}`).join(' | ') || `fight labels ${[...new Set(fights.map((x) => x.color))].join(' ')}`);

    // ---- a fight: key A until the hero is hurt, key 8, the Autoplay switch, key Z (the row 1 quest with most enemies)
    const quests = mv.rows[0].map((n, l) => ({ n, l })).filter((x) => x.n.type === 'quest').sort((a, b) => b.n.archetypes.length - a.n.archetypes.length);
    const lane = quests[0].l;
    await page.locator(`#screens button.mnode.reach[data-row="1"][data-lane="${lane}"]`).click(); await idle(page);
    await page.getByRole('button', { name: 'Accept' }).click(); await idle(page);
    // The engine sends no heal of 0 (M2 v2 engine): take a hit first, so the potion has something to heal.
    for (let i = 0; i < 4; i++) { v = await view(page); if (v.over || v.hp < v.maxHp) break; await page.keyboard.press('KeyA'); await idle(page); }
    v = await view(page);
    const r0 = v.round; const hurt = `${v.hp}/${v.maxHp}`;
    await page.keyboard.press('Digit8'); await idle(page);
    v = await view(page); log = await logLines(page);
    check('BUG-QA-04', 'key 8 drinks the potion in a fight (the round advances)', v.round > r0 && log.includes('You use Healing Draught.'), `round ${r0} -> ${v.round}`);
    check('BUG-QA-03', `the potion's heal names its source in the log (drunk at ${hurt} health)`, log.some((l) => /^Healing Draught heals you for [1-9]/.test(l)), log.filter((l) => /heals|You use/.test(l)).join(' | '));
    const sw = page.getByRole('switch', { name: 'Autoplay' });
    const r1 = v.round;
    await sw.click();
    const moved = await roundPast(page, r1, 8000);
    v = await view(page);
    await shot(page, 'A-autoplay');
    check('BUG-QA-01', 'clicking the Autoplay switch plays the next round with no other input', moved && (await sw.getAttribute('aria-checked')) === 'true', `autoplay ${v.autoplay}, round ${r1} -> ${v.round}, over ${v.over}`);
    if (!v.over) {
      await page.keyboard.press('KeyZ'); await idle(page);
      const r2 = (await view(page)).round;
      await page.waitForTimeout(2500);
      v = await view(page);
      const stayed = !v.over && v.round === r2;
      check('BUG-QA-01', 'key Z switches autoplay off: the round then waits for the player', stayed && (await sw.getAttribute('aria-checked')) === 'false', `autoplay ${v.autoplay}, round ${r2} -> ${v.round} in 2.5 s`);
      if (stayed) {
        await page.keyboard.press('KeyZ');
        const moved2 = await roundPast(page, r2, 8000);
        v = await view(page);
        check('BUG-QA-01', 'key Z switches it on again: the fight goes on by itself', moved2 && v.autoplay, `autoplay ${v.autoplay}, round ${r2} -> ${v.round}`);
      }
    } else check('BUG-QA-01', 'key Z off and on (the fight lasted long enough to test)', false, 'the fight ended on the first autoplay round');
    const ended = await page.waitForFunction(() => { const x = window.__ui.view(); return !(x.combat && !x.combat.over); }, null, { timeout: 30000, polling: 100 }).then(() => true, () => false);
    v = await view(page);
    check('BUG-QA-01', 'autoplay plays the fight to its end', ended && v.phase === 'NODE', `phase ${v.phase}, over ${v.over}, round ${v.round}`);

    // ---- loot, quest reward, equip from the bags
    await idle(page);
    if (await page.locator('#screens .loot').count()) { await page.locator('#screens .loot .foot').getByRole('button', { name: /Continue|Take all/ }).click(); await idle(page); }
    const before = new Set((await view(page)).bag.filter(Boolean).map((b) => b.uid));
    await page.locator('#screens .choice-cards .icard').first().click(); await idle(page);
    v = await view(page);
    const reward = v.bag.find((b) => b && b.kind === 'gear' && !before.has(b.uid));
    if (reward) {
      const m = await bagMenu(page, reward.uid);
      await m.getByRole('button', { name: 'Equip' }).click(); await idle(page);
      log = await logLines(page);
      check('BUG-QA-03', 'log names the item equipped from the bags', log.includes(`Equipped ${reward.name}.`), log.filter((l) => /Equipped/.test(l)).join(' | '));
      await closeBags(page);
    } else check('BUG-QA-03', 'log names the item equipped from the bags', false, 'no quest reward reached the bags');
    v = await view(page);
    check('BUG-QA-09', `the clock matches the hours (${v.hours} h)`, (await page.locator('#minimap .clock').innerText()) === clockLabel(v.hours), await page.locator('#minimap .clock').innerText());
  } catch (e) {
    check('-', 'part A ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part A: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part B: the camp, real engine, Instant
/**
 * Setup steps in the page: the engine's autoplay choices (AUTO) until the camp or the run's end. A TRAVEL_ON choice on
 * the map is sent as the UI's TRAVEL_ON action (what the Travel on button sends), so the zone travel and its banner play
 * as for a player. The clock is read after every hour change, the travel button at every map step and the zone banner
 * after every change of zone.
 * stop.early: stop at the first map step where travelling on is legal under the exit level (the button's data-travel
 * is "early"); stop.zone: stop at the first map step in that zone or later.
 */
const autoRun = (page, stop = {}) => page.evaluate(async (opt) => {
  const ui = window.__ui; const out = { clock: [], travel: [], early: null, at: null, banners: [] }; let last = -1;
  let zone = ui.view().zone ? ui.view().zone.idx : null;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let n = 0; n < 4000; n++) {
    const v = ui.view();
    if (v.phase === 'CAMP' || v.phase === 'SUMMARY') break;
    if (v.phase === 'MAP') {
      await frame();
      const b = document.querySelector('#screens .mhead button[data-travel]');
      const rec = { z: v.zone.idx, level: v.player.level, need: v.zone.travelLevel, exit: v.zone.exitLevel, travelOn: !!v.legal.travelOn, must: !!v.legal.mustTravel,
        row: v.zone.pos.row, kind: b ? b.dataset.travel : null, disabled: b ? b.disabled : null, label: b ? b.textContent : null };
      out.travel.push(rec);
      if (opt.early && rec.kind === 'early') { out.early = rec; return out; }
      if (opt.zone && v.zone.idx >= opt.zone) { out.at = rec; return out; }
    }
    const c = v.phase === 'MAP' ? ui.autoChoice() : null;
    await ui.act(c && c.type === 'ENGINE' && c.action.type === 'TRAVEL_ON' ? { type: 'TRAVEL_ON' } : { type: 'AUTO' });
    await ui.idle();
    const nv = ui.view();
    if (nv.zone && nv.zone.idx !== zone) { zone = nv.zone.idx; out.banners.push({ z: zone, b1: document.querySelector('#banner .b1').textContent, b2: document.querySelector('#banner .b2').textContent }); }
    const h = nv.hours;
    if (h !== last && nv.phase !== 'SUMMARY') { last = h; await frame(); out.clock.push([nv.hours, document.querySelector('#minimap .clock').textContent]); }
  }
  await ui.idle();
  return out;
}, stop);
/** The travel button state the engine's legality and levels call for (rules 1.5). */
const travelKind = (r) => (r.must ? 'done' : r.travelOn ? (r.level >= r.exit ? 'open' : 'early') : 'locked');

async function partB(browser, W, H) {
  const SEED = 51; // M2 v3: seed 1's autoplay run dies before the camp (zone danger)
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    // Setup: the engine's autoplay choices up to the first map step where leaving early is legal, then to the camp.
    const first = await autoRun(page, { early: true });
    let earlyTip = null;
    if (first.early) {
      await page.locator('#screens .mhead button[data-travel]').hover();
      earlyTip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
      await shot(page, 'B-travel-early');
      await page.mouse.move(2, 2);
    }
    const rest = await autoRun(page);
    const samples = [...first.clock, ...rest.clock];
    const steps = [...first.travel, ...rest.travel];
    const e = first.early;
    check('M2v2-45', `travel on early: at level ${e ? e.level : '?'} in zone ${e ? e.z : '?'} the button is enabled, "Travel on early", and the tooltip warns about the exit level`,
      !!e && e.level === e.need && e.need === e.exit - R.C.TRAVEL_EARLY_LEVELS && !e.disabled && e.label === 'Travel on early' && !!earlyTip && earlyTip.includes(`You are under the exit level (${e.exit})`),
      e ? `${JSON.stringify(e)} | ${(earlyTip || '').replace(/\n/g, ' / ')}` : 'no map step allowed leaving early');
    const wrongSteps = steps.filter((r) => r.kind !== travelKind(r) || r.disabled !== !r.travelOn || r.need !== r.exit - R.C.TRAVEL_EARLY_LEVELS || (r.kind === 'locked' && r.label !== `Travel on at level ${r.need}`));
    const kinds = steps.reduce((m, r) => ({ ...m, [r.kind]: (m[r.kind] || 0) + 1 }), {});
    check('M2v2-45', `the travel button follows the engine at all ${steps.length} map steps (travelLevel = exit level - ${R.C.TRAVEL_EARLY_LEVELS})`, steps.length > 0 && !wrongSteps.length,
      wrongSteps.length ? wrongSteps.slice(0, 3).map((r) => JSON.stringify(r)).join(' | ') : JSON.stringify(kinds));
    let v = await view(page);
    if (v.phase !== 'CAMP') throw new Error(`setup did not reach the camp (phase ${v.phase})`);
    const wrong = samples.filter(([h, txt]) => txt !== clockLabel(h));
    const midnight = samples.find(([h]) => h >= 18);
    check('BUG-QA-09', `the clock matches the hours at ${samples.length} readings (0 to ${v.hours} h) and turns to day 2 at midnight`, !wrong.length && midnight && /^Day 2, /.test(midnight[1]),
      wrong.length ? wrong.slice(0, 3).map(([h, t]) => `${h} h: "${t}"`).join(' | ') : `first reading past 17 h: "${midnight && midnight[1]}"`);

    // ---- the camp panel
    await page.waitForTimeout(1500); // the zone banner fades
    await shot(page, 'B-camp');
    const face = page.getByRole('button', { name: 'Face Oruvath' });
    const pf = await placement(face);
    check('BUG-QA-10', 'camp: "Face Oruvath" is in view without scrolling', fullyShown(pf), placeText(pf));
    const foot = page.locator('#screens .side .sfoot');
    const time = await placement(foot.locator('dd').nth(0));
    const asc = await placement(foot.locator('dd').nth(1));
    const footText = (await foot.innerText()).replace(/\n/g, ' ');
    check('BUG-QA-10', 'camp: the time and the Ascendancy lines are in view', fullyShown(time) && fullyShown(asc) && /Time/.test(footText) && /Ascendancy/.test(footText), `${footText} | ${placeText(time)} | ${placeText(asc)}`);
    const cards = page.locator('#screens .side .svc-card');
    const cardPl = [];
    for (let i = 0; i < await cards.count(); i++) cardPl.push(await placement(cards.nth(i)));
    check('BUG-QA-10', `camp: all ${cardPl.length} service cards are in view`, cardPl.length === 4 && cardPl.every(fullyShown), cardPl.map(placeText).join(' | '));

    // ---- the bag menu at the right edge (BUG-QA-11), and an item used out of combat (BUG-QA-03)
    await page.keyboard.press('KeyB'); await idle(page);
    v = await view(page);
    const filled = v.bag.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    const right = filled.filter((i) => i % 4 === 3);
    for (const [label, idx] of [['right column, first row', right[0] ?? filled[filled.length - 1]], ['last row', filled[filled.length - 1]]]) {
      await page.locator('#win-bags .baggrid .slot').nth(idx).click();
      const mb = await page.locator('.ctxmenu').boundingBox();
      check('BUG-QA-11', `bag menu of the item in the ${label} (slot ${idx + 1}) lies inside the window`, mb && mb.x >= 0 && mb.y >= 0 && mb.x + mb.width <= W && mb.y + mb.height <= H,
        mb ? `menu ${Math.round(mb.x)},${Math.round(mb.y)} to ${Math.round(mb.x + mb.width)},${Math.round(mb.y + mb.height)} in ${W}x${H}` : 'no menu');
      await page.mouse.click(W / 2, 40); // click away to close the menu
    }
    await shot(page, 'B-bag-menu');
    const food = v.bag.find((b) => b && b.id === 'trail_rations');
    if (food && v.hp < v.maxHp) {
      const m = await bagMenu(page, food.uid);
      await m.getByRole('button', { name: 'Use' }).click(); await idle(page);
      const log = await logLines(page);
      check('BUG-QA-03', 'an item used from the bags is named, and so is the heal it gives', log.includes('You use Trail Rations.') && log.some((l) => /^Trail Rations heals you for [1-9]/.test(l)), log.slice(-3).join(' | '));
    } else check('BUG-QA-03', 'an item used from the bags is named, and so is the heal it gives', false, `setup: no Trail Rations or full health (${v.hp}/${v.maxHp})`);
    await closeBags(page);

    // ---- Face Oruvath with a plain mouse click where it is drawn, then the fight on the Autoplay switch
    const pf2 = await placement(face);
    await page.mouse.click(pf2.cx, pf2.cy); await idle(page);
    v = await view(page);
    check('BUG-QA-10', 'a click on "Face Oruvath" (no scrolling) starts the boss fight', v.phase === 'BOSS', `phase ${v.phase}`);
    // Linked (M2 v2): record the boss frame's phase line with the Shards alive on screen whenever it changes.
    await page.evaluate(() => {
      window.__linked = [];
      const box = document.querySelector('#boss-frame .binfo');
      new MutationObserver(() => {
        const c = window.__ui.shown().combat; const el = box.querySelector('.bphase');
        if (!c || !c.boss || !el) return;
        const shards = c.enemies.filter((x) => x.rank === 'shard' && x.alive && !x.hidden).length;
        const rec = { phase: c.boss.phase, shards, text: el.textContent.replace(/\u00a0/g, ' ') };
        const last = window.__linked[window.__linked.length - 1];
        if (!last || last.text !== rec.text || last.shards !== shards) window.__linked.push(rec);
      }).observe(box, { childList: true, subtree: true, characterData: true });
    });
    const sw = page.getByRole('switch', { name: 'Autoplay' });
    await sw.click();
    const done = await page.waitForFunction(() => window.__ui.view().phase === 'SUMMARY', null, { timeout: 90000, polling: 200 }).then(() => true, () => false);
    v = await view(page);
    check('BUG-QA-01', 'the boss fight plays to its end on the Autoplay switch alone', done, `phase ${v.phase}, round ${v.round}`);
    const linked = (await page.evaluate(() => window.__linked)).filter((r) => r.phase === 2);
    const want = (n) => (n > 0 ? `Phase 2 · Linked −${Math.round(Math.min(R_LINK.cap, R_LINK.per * n) * 100)} % (${n} ${n === 1 ? 'Shard' : 'Shards'})` : 'Phase 2 · Link broken');
    const badLinked = linked.filter((r) => r.text !== want(r.shards));
    const counts = [...new Set(linked.filter((r) => r.shards > 0).map((r) => r.shards))].sort();
    check('M2v2-2', `boss frame: Linked −${Math.round(R_LINK.per * 100)} % per living Shard, at most −${Math.round(R_LINK.cap * 100)} % (phase 2 with ${counts.join(', ') || 'no'} Shards)`,
      counts.length >= 2 && !badLinked.length,
      badLinked.length ? badLinked.slice(0, 3).map((r) => `${r.shards} Shards: "${r.text}" (wanted "${want(r.shards)}")`).join(' | ') : counts.map((n) => `"${want(n)}"`).join(', '));
    if (done) {
      await page.locator('#screens .summary').waitFor({ timeout: 10000 });
      check('BUG-QA-05', `no banner over the run summary (${v.outcome})`, !(await page.locator('#banner').evaluate((b) => b.classList.contains('on'))), await page.locator('#banner').getAttribute('class'));
    }
  } catch (e) {
    check('-', 'part B ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part B: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part C: a victory, mock engine, Instant
async function partC(browser, W, H) {
  let done = false;
  for (const seed of [1, 2, 3, 4]) {
    const { context, page, errors } = await open(browser, W, H, `mock=1&seed=${seed}&speed=instant`);
    try {
      await page.locator('#create .ccard[data-cls="mage"]').click(); await idle(page);
      await page.evaluate(async () => { await window.__ui.act({ type: 'DEBUG_JUMP', to: 'boss', level: 60, gear: true, classId: 'mage' }); await window.__ui.idle(); });
      await page.keyboard.press('KeyZ');
      await page.locator('#screens .summary').waitFor({ timeout: 60000 });
      const v = await view(page);
      if (v.outcome !== 'victory') { await context.close(); continue; }
      const on = await page.locator('#banner').evaluate((b) => b.classList.contains('on'));
      await page.waitForTimeout(450);
      const opacity = await page.locator('#banner').evaluate((b) => Number(getComputedStyle(b).opacity));
      await shot(page, 'C-victory-summary');
      check('BUG-QA-05', `the victory banner is gone when the run summary appears (mock, Mage seed ${seed})`, !on && opacity < 0.05, `banner "on" ${on}, opacity after 0.45 s ${opacity}`);
      check('-', 'part C: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
      done = true;
      await context.close();
      break;
    } catch (e) {
      check('-', `part C (seed ${seed}) ran to the end`, false, e.message.split('\n')[0]);
      await context.close();
      done = true;
      break;
    }
  }
  if (!done) check('BUG-QA-05', 'the victory banner is gone when the run summary appears', false, 'no mock seed 1-4 won the boss fight');
}

// ------------------------------------------------------------------ part D: round time, real engine, default speed
/**
 * One manual combat round played with a key. Setup only: every step outside a fight (map, intros, rewards, hub)
 * is the engine's autoplay choice (AUTO helper, as in part B). In a fight it presses the key of the action the
 * autoplay policy would choose (1-7, A, X, 8-0), so the hero lives through many fights. Returns the step's timing
 * record (window.__ui.plays()) with the records after it, or null when the key was refused.
 * during: optional async function called while the step plays (e.g. a second input during enemy animations).
 */
async function fightStep(page, during) {
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, step: x.node && x.node.step, round: x.combat && x.combat.round, over: x.combat && x.combat.over }; });
    if (s.phase === 'SUMMARY') throw new Error('the hero died during the round-time checks');
    if (!(s.round && !s.over && s.step !== 'intro')) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); continue; }
    const key = await page.evaluate(() => {
      const v = window.__ui.view(); const c = window.__ui.autoChoice(); const a = (c && c.action) || c || {};
      if (a.type === 'CAST' && v.player.bar.includes(a.spellId)) return `Digit${v.player.bar.indexOf(a.spellId) + 1}`;
      if (a.type === 'USE_ITEM' && a.slot != null) return ['Digit8', 'Digit9', 'Digit0'][a.slot];
      if (a.type === 'PASS') return 'KeyX';
      return 'KeyA';
    });
    const k = await page.evaluate(() => window.__ui.plays().length);
    await page.keyboard.press(key);
    if (during) await during(page);
    await idle(page);
    const plays = await page.evaluate(() => window.__ui.plays());
    return plays.length > k ? { ...plays[k], next: plays.slice(k + 1) } : null;
  }
  return null;
}
/** Wait until the director plays an enemy's action (true) or the step is over (false). */
const enemyOnScreen = (page) => page.waitForFunction(() => { const e = window.__ui.playingEvent(); return !e ? 'idle' : e.t === 'action' && e.side === 'enemy' ? 'enemy' : false; }, null, { timeout: 3000, polling: 'raf' })
  .then((h) => h.jsonValue(), () => 'timeout').then((x) => x === 'enemy');
const roundMs = (r) => Math.round(r.end - r.input);
const isMoment = (r) => r.events.some((t) => MOMENTS.includes(t));

async function setSpeed(page, label) {
  await page.keyboard.press('Escape');
  await page.locator('#win-settings').getByRole('button', { name: label, exact: true }).click();
  await page.locator('#win-settings').getByRole('button', { name: 'Close' }).click();
  await idle(page);
}

async function partD(browser, W, H) {
  const SEED = 9;
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}`); // the default animation speed
  try {
    const speed0 = await page.evaluate(() => window.__ui.settings.get('speed'));
    await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);

    // ---- manual rounds at the default speed: input to the end of the step (the action bar is live again)
    const rounds = [];
    for (let i = 0; i < 40 && rounds.filter((r) => !isMoment(r)).length < 12; i++) { const r = await fightStep(page); if (r) rounds.push(r); }
    const plain = rounds.filter((r) => !isMoment(r)); const ms = plain.map(roundMs);
    const budgets = [...new Set(plain.map((r) => r.round && r.round.budget))];
    check('M2v2-52', `default speed (${speed0}x): every manual round without a level-up or fight end is on screen for at most PACE_ROUND_ANIM_S (${BUDGET} ms)`,
      speed0 === 1 && plain.length >= 8 && budgets.length === 1 && budgets[0] === BUDGET && Math.max(...ms) <= BUDGET,
      `${plain.length} rounds: median ${median(ms)} ms, max ${Math.max(...ms)} ms, tempo ${plain.map((r) => r.round ? r.round.tempo.toFixed(2) : '-').join(' ')}; with moments: ${rounds.filter(isMoment).map(roundMs).join(', ') || 'none'} ms`);

    // ---- an action key during enemy animations finishes them at once, then plays the new action
    let keyTest = null;
    for (let i = 0; i < 8 && !keyTest; i++) {
      let pressed = false;
      const r = await fightStep(page, async (pg) => { if (await enemyOnScreen(pg)) { await pg.keyboard.press('KeyA'); pressed = true; } });
      if (r && pressed && r.skippedAt) keyTest = r;
    }
    const keyNext = keyTest && keyTest.next.find((x) => x.type === 'ATTACK');
    check('M2v2-52', 'key A during enemy animations finishes them at once and the attack follows', !!keyTest && keyTest.end - keyTest.skippedAt <= 100 && !!keyNext && (isMoment(keyNext) || roundMs(keyNext) <= BUDGET),
      keyTest ? `first step ended ${Math.round(keyTest.end - keyTest.skippedAt)} ms after the key (${Math.round(keyTest.skippedAt - keyTest.input)} ms into it); attack ${keyNext ? `${roundMs(keyNext)} ms` : 'not played'}` : 'no round with an enemy action on screen');

    // ---- a click on the scene during enemy animations finishes them (and is no action)
    let clickTest = null;
    for (let i = 0; i < 8 && !clickTest; i++) {
      let clicked = false;
      const r = await fightStep(page, async (pg) => { if (await enemyOnScreen(pg)) { await pg.mouse.click(Math.round(W * 0.5), Math.round(H * 0.16)); clicked = true; } });
      if (r && clicked && r.skippedAt) clickTest = r;
    }
    check('M2v2-52', 'a click on the scene during enemy animations finishes them at once', !!clickTest && clickTest.end - clickTest.skippedAt <= 100 && !clickTest.next.length,
      clickTest ? `step ended ${Math.round(clickTest.end - clickTest.skippedAt)} ms after the click (${Math.round(clickTest.skippedAt - clickTest.input)} ms into it); steps after it: ${clickTest.next.length}` : 'no round with an enemy action on screen');
    await shot(page, 'D-fight');

    // ---- 2x, 4x and Instant from the settings window: each faster than the one before
    const med = { 1: median(ms) };
    for (const [label, sp] of [['2×', 2], ['4×', 4], ['Instant', 0]]) {
      await setSpeed(page, label);
      const got = [];
      for (let i = 0; i < 30 && got.length < 5; i++) { const r = await fightStep(page); if (r && !isMoment(r)) got.push(r); }
      med[sp] = median(got.map(roundMs));
    }
    check('M2v2-52', 'speeds 2x, 4x and Instant (settings window) each play a round faster than the speed before',
      med[2] < med[1] && med[4] < med[2] && med[0] < med[4] && med[0] <= 150, `median per round: 1x ${med[1]} ms, 2x ${med[2]} ms, 4x ${med[4]} ms, Instant ${med[0]} ms`);
  } catch (e) {
    check('-', 'part D ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part D: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part E: M2 v3, real engine with a profile, Instant
const E_SEED = 63;
/** The part E profile: Second Breath and Lost Technique I (Hunter: Ricochet Bolt), bought by the engine's own rules. */
function eProfile() {
  let p = R.newProfile(); p.echoes = 100000; p.reachedBoss = true; // Second Breath requires "reached the boss once"
  for (const id of ['second_breath', 'sp_h1']) p = R.buyMeta(p, id);
  return p;
}
let E_TWIN = null;
/** The same run in Node (the engine's autoplay choices, as the AUTO helper): facts at the start, in zone 3, at the camp, at the boss, at the end. */
function eTwin(profile) {
  if (E_TWIN) return E_TWIN;
  let s = R.newRun({ classId: 'rogue', seed: E_SEED, content: CONTENT, profile });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
  const start = R.resurrectCharges(s);
  let map3 = null;
  for (let n = 0; n < 20000 && s.phase !== 'CAMP' && s.phase !== 'ENDED'; n++) {
    if (!map3 && s.phase === 'MAP' && s.zone.z >= 3) map3 = R.mapView(s);
    s = R.step(s, R.autoAction(s)).state;
  }
  if (s.phase !== 'CAMP') throw new Error(`the Node run of seed ${E_SEED} does not reach the camp (${s.phase})`);
  const camp = R.resurrectCharges(s); const bolt = R.spellInfo(s, 'ricochet_bolt', null).amount; const known = !!s.player.spells.ricochet_bolt;
  s = R.step(s, { type: 'FIGHT_BOSS' }).state;
  const boss = R.resurrectCharges(s);
  s = R.step(s, { type: 'SET_AUTOPLAY', on: true }).state;
  const sources = [];
  for (let n = 0; n < 5000 && s.phase !== 'ENDED' && s.phase !== 'SUMMARY'; n++) { const r = R.step(s, R.autoAction(s)); s = r.state; for (const e of r.events) if (e.t === 'resurrect') sources.push(e.source); }
  const sm = R.summary(s);
  E_TWIN = { start, map3, camp, bolt, known, boss, sources, outcome: sm.outcome, deathAt: sm.death ? sm.death.nodeType : null, metaLeft: s.player.res.meta };
  return E_TWIN;
}
const RES_NAMES = { boon: R.C.BOON.return.name, second_breath: R.C.META.second_breath.name, ember: R.C.CONSUMABLE.ember_of_return.name };
const NOT_FINAL = `${RES_NAMES.second_breath} does not work in the final fight.`;
/** The resurrect list for resurrectCharges().now: names in the engine's order, ×n for more than one, Second Breath marked. */
function resList(now, bossFight) {
  const counts = new Map(); for (const k of now) counts.set(k, (counts.get(k) || 0) + 1);
  const items = [...counts].map(([k, n]) => `${RES_NAMES[k]}${n > 1 ? ` ×${n}` : ''}${k === 'second_breath' ? ' (not in the final fight)' : ''}`);
  return items.length ? items.join(', ') : bossFight ? 'None in this fight' : 'None';
}
const pct1 = (x) => `${Math.round(x * 1000) / 10} %`;
/** Hover an element and read its tooltip (one line, " / " between lines); shotName: a screenshot while it shows. */
const tipOf = async (page, locator, shotName) => {
  await locator.hover();
  const t = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ').replace(/\n/g, ' / ');
  if (shotName) await shot(page, shotName);
  await page.mouse.move(2, 2);
  return t;
};
/** The player frame's resurrect badge: shown, dimmed, its number, where it lies and its tooltip. */
async function badge(page, shotName) {
  const b = page.locator('#player-frame .resc');
  const st = await b.evaluate((el) => ({ hidden: el.classList.contains('hidden'), none: el.classList.contains('none'), n: el.querySelector('.n').textContent }));
  const pl = st.hidden ? null : await placement(b);
  return { ...st, pl, tip: st.hidden ? null : await tipOf(page, b, shotName) };
}
const badgeText = (b) => `badge ${b.hidden ? 'hidden' : `"${b.n}"${b.none ? ' dimmed' : ''}, ${placeText(b.pl)}, tooltip "${b.tip}"`}`;
/** The character sheet's resurrect row and note: key C opens the sheet, key C closes it. */
async function sheetRes(page, shotName) {
  await page.keyboard.press('KeyC'); await idle(page);
  const w = page.locator('#win-character');
  const line = (await w.locator('.resline b').innerText()).trim();
  const note = (await w.locator('.resnote').count()) ? (await w.locator('.resnote').innerText()).trim() : null;
  const pl = await placement(w.locator('.resline'));
  if (shotName) await shot(page, shotName);
  await page.keyboard.press('KeyC'); await idle(page);
  return { line, note, pl };
}
const sheetText = (s) => `sheet "${s.line}"${s.note ? ` note "${s.note}"` : ''} ${placeText(s.pl)}`;

async function partE(browser, W, H) {
  const profile = eProfile();
  const { context, page, errors } = await open(browser, W, H, `seed=${E_SEED}&speed=instant`, profile);
  try {
    const twin = eTwin(profile);
    const FROM = R.C.ZONE_DANGER_FROM;
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    const banners = [{ z: 1, b1: await page.locator('#banner .b1').innerText(), b2: await page.locator('#banner .b2').innerText() }];

    // ---- zone 1 (Second Breath works on the journey): the badge and the character sheet
    let bd = await badge(page); let sh = await sheetRes(page, 'E-sheet-zone1');
    let want = resList(twin.start.now, false);
    check('M2v3-2', `zone 1 hub: the resurrect badge shows ${twin.start.now.length} and, like the character sheet, lists "${want}" (resurrectCharges.now)`,
      twin.start.now.includes('second_breath') && !bd.hidden && !bd.none && bd.n === String(twin.start.now.length) && fullyShown(bd.pl) && bd.tip.includes(want) && !bd.tip.includes(NOT_FINAL)
        && sh.line === want && !sh.note && fullyShown(sh.pl), `${badgeText(bd)} | ${sheetText(sh)}`);
    const mm1 = await tipOf(page, page.locator('#minimap .disc'));
    check('M2v3-1', `zone 1 (levels 1-${R.C.ZONE_LEVELS}): the minimap tooltip has no zone danger line`, !/hit harder/.test(mm1), mm1);

    // ---- setup: the engine's autoplay choices to the first map of zone 3, then the map and minimap tooltips there
    const r1 = await autoRun(page, { zone: 3 });
    if (!r1.at) throw new Error('setup did not reach a map of zone 3');
    await page.waitForTimeout(300);
    const rows = twin.map3.rows; const tips = [];
    // a node of the engine's zone 3 map: { n, r (row, from 1), l (lane) }
    const pickNode = (pred) => { for (const [ri, row] of rows.entries()) for (const [l, n] of row.entries()) if (pred(n)) return { n, r: ri + 1, l }; return null; };
    const plain = pickNode((n) => n.type === 'quest' || n.type === 'grind');
    const multi = pickNode((n) => n.type === 'dungeon' || (n.type === 'elite' && n.archetypes.length > 1)) || pickNode((n) => n.type === 'elite');
    for (const { n, r, l } of [plain, multi].filter(Boolean)) {
      // enemy levels as the engine builds the fights (src/engine/nodes.js): quest and grind at cl; elite at its level,
      // its escort at cl; dungeon trash at its level, the dungeon boss at bossLevel
      const levels = n.type === 'dungeon' ? [n.level, n.bossLevel] : n.type === 'elite' ? [n.level, ...(n.archetypes.length > 1 ? [n.cl] : [])] : [n.cl];
      const lo = zoneDanger(Math.min(...levels)) - 1; const hi = zoneDanger(Math.max(...levels)) - 1;
      const line = `Zone danger: enemies here deal ${hi > lo ? 'up to ' : ''}+${pct1(hi)} damage (above level ${FROM}).`;
      const t = await tipOf(page, page.locator(`#screens button.mnode[data-row="${r}"][data-lane="${l}"]`), `E-map-zone3-${n.type}`);
      tips.push({ n, r, levels, line, t, ok: t.includes(line) });
    }
    check('M2v3-1', `zone 3 map tooltips: the zone danger line with the engine's zoneDanger at the enemies' levels (${tips.map((x) => `${x.n.type} r${x.r}: levels ${x.levels.join('/')}`).join('; ')})`,
      tips.length === 2 && tips.every((x) => x.ok), tips.map((x) => `${x.ok ? 'ok' : 'WRONG'} "${x.t}" (wanted "${x.line}")`).join(' | '));
    const mm3 = await tipOf(page, page.locator('#minimap .disc'));
    const rule = `Enemies above level ${FROM} hit harder: +${Math.round(R.C.ZONE_DANGER_STEP * 100)} % damage per 10 levels.`;
    check('M2v3-1', `zone 3: the minimap tooltip states the rule from ZONE_DANGER_FROM ${FROM} and ZONE_DANGER_STEP ${R.C.ZONE_DANGER_STEP}`, mm3.includes(rule), `${mm3} (wanted "${rule}")`);

    // ---- setup: on to the camp; then the zone banners of the whole run
    const r2 = await autoRun(page);
    let v = await view(page);
    if (v.phase !== 'CAMP') throw new Error(`setup did not reach the camp (phase ${v.phase})`);
    banners.push(...r1.banners, ...r2.banners);
    const zb = banners.filter((b) => b.z <= R.C.ZONE_COUNT);
    const bandOf = (z) => [R.C.ZONE_LEVELS * (z - 1) + 1, R.C.ZONE_LEVELS * z];
    const wantBanner = (z) => { const [a, b] = bandOf(z); return `Levels ${a}–${b}${b > FROM ? ` · Enemies above level ${FROM} hit harder` : ''}`; };
    const badB = zb.filter((b) => b.b2 !== wantBanner(b.z));
    check('M2v3-1', `zone banners: "Enemies above level ${FROM} hit harder" in the zones whose levels pass ${FROM}, not before (${zb.length} zones)`,
      zb.length === R.C.ZONE_COUNT && !badB.length, badB.length ? badB.map((b) => `zone ${b.z}: "${b.b2}" (wanted "${wantBanner(b.z)}")`).join(' | ') : zb.map((b) => `${b.z}: "${b.b2}"`).join(' | '));

    // ---- the camp: Second Breath held, not for the final fight
    await page.waitForTimeout(1300); // the zone banner fades
    bd = await badge(page); sh = await sheetRes(page, 'E-sheet-camp');
    want = resList(twin.camp.now, false);
    check('M2v3-2', `camp: the badge shows ${twin.camp.now.length} and, like the character sheet, lists "${want}"`,
      twin.camp.now.includes('second_breath') && !bd.hidden && bd.n === String(twin.camp.now.length) && bd.tip.includes(want) && sh.line === want && !sh.note && fullyShown(sh.pl),
      `${badgeText(bd)} | ${sheetText(sh)}`);

    // ---- Ricochet Bolt (row 7): the spellbook tooltip, from the spell's constants and spellInfo
    const sp = R.C.SPELL.ricochet_bolt; const b = twin.bolt;
    await page.keyboard.press('KeyP'); await idle(page);
    const row = page.locator('#win-spellbook .sprow').filter({ has: page.locator('.nm', { hasText: /^Ricochet Bolt$/ }) });
    const boltTip = (await row.count()) ? await tipOf(page, row, 'E-ricochet') : '';
    await page.keyboard.press('KeyP'); await idle(page);
    const desc = `then up to ${['no', 'one', 'two', 'three', 'four'][sp.bounces] || sp.bounces} other ${sp.bounces === 1 ? 'enemy' : 'enemies'} for ${Math.round(sp.bounceFrac * 100)} % of the damage`;
    const amt = `Deals about ${b.amount} physical damage to the target, then about ${b.bounceAmount} to up to`;
    check('M2v3-7', `Ricochet Bolt tooltip: "${desc}" (bounces ${sp.bounces}, bounceFrac ${sp.bounceFrac}), the spellInfo amounts ${b.amount} and ${b.bounceAmount}, no "70 %", no "Hits every enemy"`,
      twin.known && boltTip.includes(desc) && boltTip.includes(amt) && !/70 %/.test(boltTip) && !/Hits every enemy/.test(boltTip), boltTip || 'no Ricochet Bolt row in the spellbook');

    // ---- the boss fight: only the charges that work there; Second Breath named as not working
    await page.getByRole('button', { name: 'Face Oruvath' }).click(); await idle(page);
    v = await view(page);
    if (v.phase !== 'BOSS') throw new Error(`Face Oruvath did not start the boss fight (phase ${v.phase})`);
    bd = await badge(page, 'E-badge-boss'); sh = await sheetRes(page, 'E-sheet-boss');
    want = resList(twin.boss.now, true);
    check('M2v3-2', `boss fight, round ${v.round}: the badge shows ${twin.boss.now.length} (resurrectCharges.now: ${twin.boss.now.join(', ') || 'none'}); badge and sheet list "${want}" and say "${NOT_FINAL}"`,
      !twin.boss.now.includes('second_breath') && twin.boss.secondBreath > 0 && !bd.hidden && bd.n === String(twin.boss.now.length) && bd.tip.includes(want) && bd.tip.includes(NOT_FINAL)
        && !bd.tip.includes('Second Breath (not') && sh.line === want && sh.note === NOT_FINAL, `${badgeText(bd)} | ${sheetText(sh)}`);

    // ---- the fight on autoplay (key Z): badge numbers, the resurrect banner and the death screen
    await page.evaluate(() => {
      const rec = window.__e = { counts: [], banners: [], death: [] };
      const bdg = document.querySelector('#player-frame .resc');
      const note = () => { const x = { n: bdg.querySelector('.n').textContent, none: bdg.classList.contains('none'), hidden: bdg.classList.contains('hidden') }; const l = rec.counts[rec.counts.length - 1]; if (!l || l.n !== x.n || l.none !== x.none || l.hidden !== x.hidden) rec.counts.push(x); };
      note(); new MutationObserver(note).observe(bdg, { attributes: true, childList: true, subtree: true, characterData: true });
      const bn = document.querySelector('#banner');
      new MutationObserver(() => { const t = `${bn.querySelector('.b1').textContent} | ${bn.querySelector('.b2').textContent}`; if (rec.banners[rec.banners.length - 1] !== t) rec.banners.push(t); }).observe(bn, { childList: true, subtree: true, characterData: true });
      const dm = document.querySelector('.deathmsg').parentElement;
      new MutationObserver(() => { if (!dm.classList.contains('hidden')) rec.death.push(dm.querySelector('.d2').textContent); }).observe(dm, { attributes: true });
    });
    await page.keyboard.press('KeyZ');
    const done = await page.waitForFunction(() => window.__ui.view().phase === 'SUMMARY', null, { timeout: 120000, polling: 200 }).then(() => true, () => false);
    await idle(page);
    const rec = await page.evaluate(() => window.__e);
    v = await view(page);
    const resBanners = rec.banners.filter((t) => /^Resurrected/.test(t));
    const wantBanners = twin.sources.map((x) => `Resurrected | ${RES_NAMES[x]} returns you to the fight`);
    check('M2v3-2', `boss fight: the resurrects played are the engine's (${twin.sources.join(', ') || 'none'}), and Second Breath is not one of them`,
      done && JSON.stringify(resBanners) === JSON.stringify(wantBanners) && !twin.sources.includes('second_breath'), `${resBanners.join(' / ') || 'no resurrect banner'} (wanted ${wantBanners.join(' / ') || 'none'})`);
    const counts = rec.counts.map((c) => `${c.hidden ? 'hidden' : c.n}${c.none ? ' dimmed' : ''}`);
    check('M2v3-2', 'boss fight: after the last charge that works there, the badge shows 0, dimmed (Second Breath held)',
      done && twin.metaLeft > 0 && rec.counts.length >= 2 && rec.counts[0].n === String(twin.boss.now.length) && rec.counts.some((c) => c.n === '0' && c.none && !c.hidden), counts.join(' -> '));
    const deathText = `${NOT_FINAL} Your journey ends here.`;
    check('M2v3-2', `death in the boss fight with Second Breath unused (${twin.outcome}, at the ${twin.deathAt}): the death screen says "${deathText}"`,
      done && v.outcome === 'death' && twin.deathAt === 'boss' && twin.metaLeft > 0 && rec.death.length >= 1 && rec.death.every((t) => t === deathText), rec.death.join(' | ') || 'no death screen');
  } catch (e) {
    check('-', 'part E ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part E: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part F: M3 meta progression, real engine, Instant
const F_OWNED = ['vigor', 'wayfinder']; // unlocks the stored profile holds before the run
const F_ECHOES = 70; // its balance: with the run's Echoes, Packed Satchel is affordable
const F_BUY = 'satchel'; // the unlock bought in the check (60): it shows at run start (Healing Draughts in the bags)
const F_NEXT_SEED = 7; // typed into the Seed field for the run after the purchase
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // the game's number format (util.js fmtNum)
/** The part F profile, bought by the engine's own rules. */
function fProfile() {
  let p = R.newProfile(); p.echoes = 100000;
  for (const id of F_OWNED) p = R.buyMeta(p, id);
  p.echoes = F_ECHOES; p.earned = p.spent + F_ECHOES; p.runs = 2;
  return p;
}
/** A Hunter (Ridgewolf) run on the engine's autoplay choices with this profile, to SUMMARY; null if it reaches the camp. */
function fRun(seed, profile) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, profile });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
  let n = 0;
  for (; n < 5000 && s.phase !== 'SUMMARY' && s.phase !== 'CAMP'; n++) s = R.step(s, R.autoAction(s)).state;
  return s.phase === 'SUMMARY' ? { s, n } : null;
}
let F_TWIN = null;
/** The seed of the part F run (the shortest of seeds 1-80 that ends before the camp at level 3 or more) and its facts. */
function fTwin() {
  if (F_TWIN) return F_TWIN;
  const profile = fProfile();
  let best = null;
  for (let seed = 1; seed <= 80; seed++) { const r = fRun(seed, profile); if (r && R.summary(r.s).level >= 3 && (!best || r.n < best.n)) best = { seed, ...r }; }
  if (!best) throw new Error('no seed of 1-80 ends before the camp at level 3 or more');
  const sum = R.summary(best.s);
  const ended = R.step(best.s, { type: 'END_RUN' }).state.result; // what END_RUN stores
  const bought = R.buyMeta(ended.profile, F_BUY);
  let next = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: F_NEXT_SEED, content: CONTENT, profile: bought });
  next = R.step(next, { type: 'START_RUN' }).state;
  F_TWIN = { seed: best.seed, steps: best.n, profile, sum, ended, bought, next };
  return F_TWIN;
}
/** Cards of the Hall of Echoes as drawn: id, group kind, state, rank text, the Buy button's text, effect and requirement lines. */
const metaCards = (page) => page.locator('#meta .mcard').evaluateAll((els) => els.map((el) => ({
  id: el.dataset.id, kind: el.closest('.mgroup').dataset.kind, state: el.dataset.state, rk: el.querySelector('.rk').textContent,
  buy: el.querySelector('.buy') ? el.querySelector('.buy').textContent.replace(/ /g, ' ').trim() : null, disabled: el.querySelector('.buy') ? el.querySelector('.buy').disabled : null,
  tag: el.querySelector('.mtag') ? el.querySelector('.mtag').textContent : null, fx: el.querySelector('.mc-fx').textContent, req: el.querySelector('.mc-req') ? el.querySelector('.mc-req').textContent : null,
})));
const stateOf = (o) => (o.rank >= o.ranks ? 'owned' : !o.available ? 'locked' : o.affordable ? 'affordable' : 'unaffordable'); // as the card shows R.metaOffers
const savedProfile = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), PROFILE_KEY);
const sameProfile = (a, b) => !!a && !!b && ['echoes', 'earned', 'spent', 'runs', 'bossKills', 'reachedBoss'].every((k) => a[k] === b[k]) && JSON.stringify(a.unlocks) === JSON.stringify(b.unlocks) && JSON.stringify(a.firstKill) === JSON.stringify(b.firstKill);
const profText = (p) => (p ? `echoes ${p.echoes}, earned ${p.earned}, spent ${p.spent}, runs ${p.runs}, unlocks ${JSON.stringify(p.unlocks)}` : 'none');

async function partF(browser, W, H) {
  const twin = fTwin();
  const { context, page, errors } = await open(browser, W, H, `seed=${twin.seed}&speed=instant`, twin.profile);
  try {
    const M = R.C.META; const after = twin.ended.profile;
    // ---- setup: a Hunter run on the engine's autoplay choices to its end
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    await autoRun(page);
    let v = await view(page);
    if (v.phase !== 'SUMMARY') throw new Error(`setup: seed ${twin.seed} did not end the run (phase ${v.phase})`);
    await page.locator('#screens .summary').waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const sumAfter = (await page.locator('#screens .summary .echo.after').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const spend = page.locator('#screens .summary .sfoot').getByRole('button', { name: /^Spend Echoes/ });
    check('M3-1', `summary (seed ${twin.seed}, ${twin.sum.outcome} at level ${twin.sum.level}, +${twin.sum.echoes.total} Echoes): the balance after the run is the engine's END_RUN profile (${after.echoes}), "Spend Echoes" is there`,
      sumAfter.includes(fmt(after.echoes)) && (await spend.count()) === 1, `"${sumAfter}", Spend Echoes buttons: ${await spend.count()}`);

    // ---- Spend Echoes: END_RUN, then the Hall of Echoes over class select
    await spend.click(); await idle(page);
    v = await view(page);
    const hall = page.locator('#meta');
    const bal = (await hall.locator('.mbal .n').innerText()).trim();
    const tick = (await hall.locator('.mtick').innerText()).trim();
    const saved = await savedProfile(page);
    await shot(page, 'F-hall-after-run');
    check('M3-1', `"Spend Echoes" opens the Hall of Echoes at class select: balance ${after.echoes}, "+${twin.ended.echoes} Echoes from Hunter's run", and the saved profile is END_RUN's`,
      v.phase === 'CREATE' && (await hall.isVisible()) && bal === fmt(after.echoes) && tick.includes(`+${fmt(twin.ended.echoes)} Echoes from ${twin.sum.name}'s run`) && sameProfile(saved, after),
      `phase ${v.phase}, Hall shown ${await hall.isVisible()}, balance "${bal}", ticker "${tick}" | saved: ${profText(saved)} | END_RUN: ${profText(after)}`);
    const hist = (await hall.locator('.mhist').innerText()).replace(/\n/g, ' / ');
    const hunter = (await hall.locator('.mh-cls[data-cls="hunter"]').innerText()).replace(/\n/g, ' / ');
    const zoneName = CONTENT.zones[twin.sum.reached.zone - 1].name;
    const log = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), HISTORY_KEY);
    check('M3-2', `run log: runs ${after.runs} (profile), Hunter "1 run · best level ${twin.sum.level} · ${zoneName} · slain 0×" and the first-kill bonus of ${R.C.ECHO_FIRST_KILL_CLASS} Echoes waiting; log in localStorage`,
      hist.includes(`Runs ${after.runs}`) && hunter.includes(`1 run · best level ${twin.sum.level} · ${zoneName} · slain 0×`) && hunter.includes(`First-kill bonus`) && hunter.includes(fmt(R.C.ECHO_FIRST_KILL_CLASS))
        && !!log && log.classes.hunter && log.classes.hunter.runs === 1 && log.classes.hunter.bestLevel === twin.sum.level,
      `${hist} | log ${JSON.stringify(log)}`);

    // ---- the catalogue: every offer of R.metaOffers in its kind's group, with rank, cost and state
    const offers = R.metaOffers(after);
    const cards = await metaCards(page);
    const wrong = offers.filter((o) => {
      const c = cards.find((x) => x.id === o.id);
      if (!c) return true;
      const cost = o.nextCost == null ? null : o.nextCost > 0 ? fmt(o.nextCost) : 'Free';
      return c.kind !== o.kind || c.state !== stateOf(o) || c.rk !== `${o.rank}/${o.ranks}` || (stateOf(o) === 'owned' ? !c.tag : !(c.buy && c.buy.endsWith(cost)) || c.disabled !== !o.affordable);
    });
    const states = cards.reduce((m, c) => ({ ...m, [c.state]: (m[c.state] || 0) + 1 }), {});
    check('M3-1', `catalogue: all ${offers.length} offers of R.metaOffers, each in its kind's group (${[...new Set(offers.map((o) => o.kind))].join(', ')}), with rank/ranks, next cost and state`,
      cards.length === offers.length && !wrong.length && states.owned && states.affordable && states.unaffordable && states.locked,
      wrong.length ? wrong.slice(0, 4).map((o) => `${o.id}: ${JSON.stringify(cards.find((x) => x.id === o.id) || 'missing')} (engine ${stateOf(o)} ${o.rank}/${o.ranks} cost ${o.nextCost})`).join(' | ') : `${cards.length} cards: ${JSON.stringify(states)}`);
    const fxOf = (id) => (cards.find((c) => c.id === id) || {}).fx || '';
    const reqOf = (id) => (cards.find((c) => c.id === id) || {}).req || '';
    const want = [
      ['vigor', `+${Math.round(M.vigor.hpPct * 100)} % max health per rank`], ['pockets', `+${M.pockets.slots} bag slots per rank`],
      ['satchel', `Start with ${M.satchel.potions} ${R.C.CONSUMABLE.healing_draught.name}s`], ['wayfinder', `(was ${R.C.HOURS_TRAVEL} h)`],
      ['heirloom_blade', `item level ${M.heirloom_blade.ilvl}`], ['starforged', `ilvl ${M.starforged.ilvl}`], ['sp_h1', R.C.SPELL[M.sp_h1.spell].name],
    ];
    const badFx = want.filter(([id, t]) => !fxOf(id).includes(t));
    check('M3-1', `effect texts carry the catalogue's numbers (${want.map(([id]) => id).join(', ')}); locked cards name what they need (Alchemist's Notes: ${M[M.alchemist.req[0]].name})`,
      !badFx.length && reqOf('alchemist').includes(M[M.alchemist.req[0]].name) && reqOf('second_breath').includes('reached once'),
      badFx.length ? badFx.map(([id, t]) => `${id}: "${fxOf(id)}" (wanted "${t}")`).join(' | ') : `alchemist "${reqOf('alchemist')}", second_breath "${reqOf('second_breath')}"`);

    // ---- tooltips: an affordable card and a locked one
    const tSat = await tipOf(page, hall.locator(`.mcard[data-id="${F_BUY}"] .mc-fx`));
    const tAlc = await tipOf(page, hall.locator('.mcard[data-id="alchemist"] .mc-fx'));
    const costRe = new RegExp(`Cost:[\\s/]*${fmt(M[F_BUY].costs[0])}\\b`);
    check('M3-4', `tooltips: name, rank, cost (${M[F_BUY].costs[0]}) and "Click Buy" on ${M[F_BUY].name}; the requirement not met on ${M.alchemist.name}`,
      tSat.includes(M[F_BUY].name) && tSat.includes('Rank 0/1') && costRe.test(tSat) && tSat.includes('Click Buy') && tAlc.includes(`✗ Requires: Own ${M[M.alchemist.req[0]].name}`),
      `${tSat} || ${tAlc}`);

    // ---- buy Packed Satchel
    const cost = offers.find((o) => o.id === F_BUY).nextCost;
    await hall.locator(`.mcard[data-id="${F_BUY}"]`).getByRole('button', { name: `Buy ${M[F_BUY].name}` }).click(); await idle(page);
    await page.waitForTimeout(150);
    const bal2 = (await hall.locator('.mbal .n').innerText()).trim();
    const cards2 = await metaCards(page);
    const sat = cards2.find((c) => c.id === F_BUY); const alc = cards2.find((c) => c.id === 'alchemist');
    const tick2 = (await hall.locator('.mtick').innerText()).trim();
    const chip = (await hall.locator(`.mn-chip[data-id="${F_BUY}"]`).count()) ? (await hall.locator(`.mn-chip[data-id="${F_BUY}"]`).innerText()).trim() : null;
    const saved2 = await savedProfile(page);
    const offers2 = R.metaOffers(twin.bought);
    await shot(page, 'F-hall-bought');
    check('M3-1', `Buy ${M[F_BUY].name} (${cost}): balance ${after.echoes} -> ${twin.bought.echoes}, the card is owned 1/1, the saved profile is R.buyMeta's`,
      bal2 === fmt(twin.bought.echoes) && sat && sat.state === 'owned' && sat.rk === '1/1' && sameProfile(saved2, twin.bought),
      `balance "${bal2}", card ${JSON.stringify(sat)} | saved: ${profText(saved2)} | buyMeta: ${profText(twin.bought)}`);
    check('M3-2', `purchase feedback: "${M[F_BUY].name}: learned. Next run: ${M[F_BUY].potions} ${R.C.CONSUMABLE.healing_draught.name}s in your bags", the next-run line, and ${M.alchemist.name} opens (${stateOf(offers2.find((o) => o.id === 'alchemist'))})`,
      tick2.includes(`${M[F_BUY].name}: learned.`) && tick2.includes(`${M[F_BUY].potions} ${R.C.CONSUMABLE.healing_draught.name}s in your bags`) && tick2.includes(`Now open: ${M.alchemist.name}`)
        && chip === `${M[F_BUY].potions} ${R.C.CONSUMABLE.healing_draught.name}s in your bags` && alc && alc.state === stateOf(offers2.find((o) => o.id === 'alchemist')) && alc.state !== 'locked',
      `ticker "${tick2}" | chip "${chip}" | alchemist ${JSON.stringify(alc)}`);

    // ---- Esc closes the Hall; the Echoes button opens it again; "Choose your hero" closes it
    await page.keyboard.press('Escape'); await idle(page);
    const closed = !(await hall.isVisible()) && (await page.locator('#create .ccard').first().isVisible());
    const eb = page.getByRole('button', { name: 'Echoes', exact: true });
    const ebText = (await eb.innerText()).replace(/\n/g, ' ');
    await eb.click(); await idle(page);
    const reopened = await hall.isVisible();
    await hall.getByRole('button', { name: 'Choose your hero' }).click(); await idle(page);
    check('M3-4', `Esc closes the Hall (class select shows), the Echoes button ("${ebText}") opens it again, "Choose your hero" closes it`,
      closed && ebText.includes(fmt(twin.bought.echoes)) && reopened && !(await hall.isVisible()), `closed by Esc ${closed}, reopened ${reopened}, open now ${await hall.isVisible()}`);

    // ---- the next run starts with the unlock: the bridge's view against a Node START_RUN with the bought profile
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('textbox', { name: 'Run seed' }).fill(String(F_NEXT_SEED));
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    v = await view(page);
    const got = await page.evaluate(() => { const p = window.__ui.view().player; return { maxHp: p.maxHp, slots: p.bag.length, potions: p.bag.filter((b) => b && b.id === 'healing_draught').reduce((a, b) => a + b.count, 0), items: p.bag.filter(Boolean).map((b) => `${b.id || b.name}x${b.count || 1}`).join(',') }; });
    const nt = twin.next; const ntPot = nt.player.bag.filter((b) => b.kind === 'cons' && b.id === 'healing_draught').reduce((a, b) => a + b.qty, 0);
    const ntItems = nt.player.bag.map((b) => `${b.kind === 'cons' ? b.id : b.name}x${b.qty || 1}`).join(',');
    check('M3-1', `new run (seed ${F_NEXT_SEED}): the bridge's view starts with ${M[F_BUY].potions} Healing Draughts (${M[F_BUY].name}), ${R.bagCapacity(nt)} bag slots and ${nt.player.d.maxHp} max health (Vigor 1), as the engine's START_RUN with the bought profile`,
      v.phase === 'ZONE_HUB' && got.potions === M[F_BUY].potions && got.potions === ntPot && got.slots === R.bagCapacity(nt) && got.maxHp === nt.player.d.maxHp && got.items === ntItems,
      `phase ${v.phase}, view ${JSON.stringify(got)} | engine: potions ${ntPot}, slots ${R.bagCapacity(nt)}, maxHp ${nt.player.d.maxHp}, items ${ntItems}`);
  } catch (e) {
    check('-', 'part F ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part F: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partFOaths(browser, W, H);
}

/** Part F, Oaths: a profile after the first victory (Hunter); Oaths cost 0 and need a victory (rules 11.2, 11.5). */
async function partFOaths(browser, W, H) {
  let p = R.newProfile(); p.reachedBoss = true; p.bossKills = 1; p.firstKill.hunter = true; p.runs = 4; p.echoes = 40; p.earned = 40;
  const { context, page, errors } = await open(browser, W, H, 'seed=11&speed=instant', p);
  try {
    const O = R.C.OATH; const hall = page.locator('#meta');
    await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
    const before = await page.locator('#create .oaths').count();
    await page.getByRole('button', { name: 'Echoes', exact: true }).click(); await idle(page);
    const card = (await metaCards(page)).find((c) => c.id === 'oaths');
    await hall.locator('.mcard[data-id="oaths"]').getByRole('button', { name: `Buy ${R.C.META.oaths.name}` }).click(); await idle(page);
    const owned = (await metaCards(page)).find((c) => c.id === 'oaths');
    await page.keyboard.press('Escape'); await idle(page);
    const sw = (id) => page.getByRole('switch', { name: O[id].name });
    const texts = {};
    for (const id of R.C.OATH_IDS) texts[id] = (await sw(id).innerText()).replace(/\n/g, ' ');
    check('M3-3', `Oaths (cost ${R.C.META.oaths.costs[0]}, needs a victory): no switches before; bought in the Hall (${card && card.state} -> ${owned && owned.state}); then a switch per Oath on class select with its effect`,
      before === 0 && card && card.state === 'affordable' && /^Buy\s*Free$/.test(card.buy) && owned && owned.state === 'owned'
        && texts.haste.includes(`${R.C.OATH_HASTE_HOURS} h shorter`) && texts.thrift.includes(`×${R.C.OATH_THRIFT_MULT}`) && texts.frailty.includes('No resurrections'),
      `before ${before}, card ${JSON.stringify(card)} -> ${JSON.stringify(owned)} | ${JSON.stringify(texts)}`);
    const tHaste = await tipOf(page, sw('haste'));
    await sw('haste').click(); await idle(page);
    await sw('thrift').click(); await idle(page);
    const v = await page.evaluate(() => window.__ui.view().create.oaths);
    // the engine's multiplier for these Oaths: a Node START_RUN with them sworn
    let tw = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 11, content: CONTENT, profile: R.buyMeta(p, 'oaths') });
    for (const o of ['haste', 'thrift']) tw = R.step(tw, { type: 'SET_OATH', oath: o, on: true }).state;
    const mult = R.summary(R.step(tw, { type: 'START_RUN' }).state).echoes.oathMult;
    const foot = (await page.locator('#create .oaths .of').innerText()).trim();
    const checked = await Promise.all(R.C.OATH_IDS.map((id) => sw(id).getAttribute('aria-checked')));
    await shot(page, 'F-create-oaths');
    check('M3-3', `switches send SET_OATH: create.oaths ${JSON.stringify(v)}, aria-checked ${checked.join('/')}, "Echoes from this run ×${mult}" (the engine's oathMult); tooltip "+${Math.round(R.C.OATH_ECHO_BONUS * 100)} % Echoes"`,
      JSON.stringify(v) === '["haste","thrift"]' && checked.join(',') === 'true,false,true' && foot === `Echoes from this run ×${mult}` && tHaste.includes(`+${Math.round(R.C.OATH_ECHO_BONUS * 100)} % Echoes`),
      `foot "${foot}" | tooltip "${tHaste}"`);
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    const run = await page.evaluate(() => ({ phase: window.__ui.view().phase, oaths: window.__ui.view().oaths }));
    check('M3-3', 'the run starts with the Oaths sworn (the bridge view of the run)', run.phase === 'ZONE_HUB' && JSON.stringify(run.oaths) === '["haste","thrift"]', JSON.stringify(run));
  } catch (e) {
    check('-', 'part F (Oaths) ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part F (Oaths): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ run
const browser = await chromium.launch({ headless: true });
for (const [W, H] of SIZES) {
  SIZE = `${W}x${H}`;
  if (PARTS.includes('A')) await partA(browser, W, H);
  if (PARTS.includes('B')) await partB(browser, W, H);
  if (PARTS.includes('C')) await partC(browser, W, H);
  if (PARTS.includes('D')) await partD(browser, W, H);
  if (PARTS.includes('E')) await partE(browser, W, H);
  if (PARTS.includes('F')) await partF(browser, W, H);
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed${bad.length ? `; failed: ${bad.map((r) => `${r.size} ${r.bug} ${r.name}`).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
