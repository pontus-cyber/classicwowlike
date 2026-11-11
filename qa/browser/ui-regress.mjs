#!/usr/bin/env node
/**
 * qa/browser/ui-regress.mjs - regression checks for the UI bugs fixed on 2026-11-09
 * (qa/bugs.md BUG-QA-01, 02, 03, 04, 05, 08, 09, 10, 11), for the M2 v2 UI changes (docs/specs/changes-m2-v2.md:
 * map rows from the engine, travel on early, Linked per Shard, the round time budget) and for the M2 v3 UI changes
 * (docs/specs/changes-m2-v3.md: zone danger, Second Breath not in the final fight, Ricochet Bolt at 40 %).
 *
 *   node tools/build.mjs --out /tmp/ui-game.html
 *   node qa/browser/ui-regress.mjs [--file /tmp/ui-game.html] [--sizes 1366x768,1920x1080] [--shots dir] [--parts A,B,C,D,E,F,G,H,I,J,K,L,M,N,O]
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
 *   B  real engine, a Hunter seed chosen at run time (bPick) at Instant speed, the engine's autoplay choices up to the camp: the clock
 *      across midnight, the travel button at every map step (and its tooltip when leaving early is legal), the
 *      camp panel, the bag menu at the right edge, an item used out of combat, Face Oruvath, and the boss fight
 *      played on the Autoplay switch with the Linked strength on the boss frame.
 *   C  mock engine, Mage at the boss at Instant speed: autoplay (key Z) to a victory; no banner over the summary.
 *   D  real engine, seed 9 Hunter at the default speed: manual rounds (the keys of the autoplay policy's choices) within
 *      PACE_ROUND_ANIM_S (D52: at 1920x1080 only the median is held to the round cap, headless rendering is slow there), an action key and a click during enemy animations finish them, and 2x, 4x and Instant from
 *      the settings window (setup outside fights: the engine's autoplay choices).
 *   E  real engine, seed 8 Hunter with a stored profile that holds Second Breath and Lost Technique I (Ricochet Bolt),
 *      at Instant speed, the engine's autoplay choices up to the camp: the resurrect badge and the character sheet in
 *      zone 1, at the camp and in the boss fight (only the charges that work there, Second Breath named as not working),
 *      the death screen when the hero dies at the boss with Second Breath unused, the Ricochet Bolt tooltip (spellbook),
 *      and zone danger in the zone banners, the minimap tooltip and the map tooltips of zone 3. Expected numbers come
 *      from the engine: a Node run of the same seed and profile (resurrectCharges, spellInfo, summary) and zoneDanger.
 *   F  M3 meta progression, real engine at Instant speed. A stored profile (Vigor of the Line, Wayfinder from the older catalogue, 70 Echoes,
 *      two earlier runs) and a Hunter run on the engine's autoplay choices to its death (the shortest such run of seeds
 *      1-80): the summary's balance after the run, "Spend Echoes" opens the Hall of Echoes, the balance and the run log,
 *      every offer of R.metaOffers in its kind's group with rank, cost and state, tooltips, buying Packed Satchel (UI,
 *      saved profile, Alchemist's Notes opens), Esc and the Echoes button, and a new run (seed typed in) that starts
 *      with the unlock (bridge view = a Node START_RUN with the bought profile). Then a profile after a first victory:
 *      Oaths bought for 0, the Oath switches on class select (SET_OATH), the Echo multiplier and the run's Oaths.
 *   G  M2 v4, real engine at Instant speed. A stored profile from the older catalogue (Wayfinder, removed in M2 v4) that
 *      owns the Oaths; class select with the Oath of Haste sworn; the run on the engine's autoplay choices: the first
 *      Travel on (tooltip cost and the tolls spent = TIME_TRAVEL, as a Node run), then the camp: the par on the camp
 *      panel, the tracker and the minimap tooltip is the engine's bossPar (Oath of Haste included), and the Ascendancy
 *      line is the engine's. The seed is chosen at run time (seeds 1-60 whose Node run reaches the camp; preferably one
 *      whose Ascendancy comes from the Oath alone: at least ASC_STEP_TIME past bossPar, less than that past BOSS_TIME_PAR).
 *   H  combat v2 display (docs/specs/combat-v2.md 10, M2b 2b.6), real engine at Instant speed. Hunter seed 16: the engage
 *      panel in round 1 only (the class's options from R.engageOptions and "any bar spell"), the opening ruler, every
 *      nameplate's and the target frame's track (INTENT_TRACK_LEN entries as the engine has them: a Node twin replays the
 *      page's engine actions, window.__ui.engineLog), the Lay Trap hover preview (= R.engagePreview), key W, and the trap's
 *      off-balance window: the marker and the bar's window highlight exactly where R.offBalance and R.spellInfo(...).window
 *      say. Mage seed 30: Pre-cast's spells, and Binding Glyph's FROZEN window (frost marker, bar highlight).
 *   I  the Heat meter (docs/specs/expedition.md H.4, H.5; engine-api.md 11; M2b 2b.6), real engine at Instant speed. A
 *      Hunter on a slow policy (every hub service, the reachable node that is no elite or dungeon with the most tolls, the
 *      most Grind waves; the engine's autoplay otherwise) to the summary. At the first hub and at the first map step in Warm, Hot and
 *      Scorched the meter (state, "N h in hand" / "N h past the line", "Boss +N %", the marker and the Star's line, the pay
 *      line) equals R.heatView of a Node twin (window.__ui.engineLog), and every service card and reachable node (and Travel
 *      on) shows R.heatPreview in its toll label, its tooltip and the meter's ghost; a node entered Hot has its badge and
 *      "This node pays Hot"; a toast and a log line come with every change of state; with every window open over the map
 *      and on every kind of screen met (hub, services, map, dialogs, fights, loot, camp, boss) the meter is in view and on
 *      top; the camp panel, tracker and minimap name heatView's par and Ascendancy; the boss frame's Ascendancy is the
 *      meter's "Boss +N %"; the summary's heat card (track points per zone record, tolls by state, over par) and the Echo
 *      line "Fights won in heat" match the engine's summary; loot marked "raised by heat" came from Hot or Scorched nodes.
 *      Then an expedition run (?expedition=1): the Dimming's marker and "Dimming: N tolls" at the hub, a move's preview, and
 *      a map step where the Dimming sets the state (marker, "· Dimming", the meter's tooltip) = heatView. Both seeds are
 *      chosen at run time on Node runs of the same choices (the UI's own item-bar actions included).
 *   J  combat v2.1 display (docs/specs/combat-v2.md 16, 10.9; M2b 2b.6), real engine at Instant speed, a Hunter seed chosen
 *      at run time (jPick: Node runs of the same choices). Stacked toasts on the map: the same message merges ("×3"), at most
 *      two show at once, a queued one follows, none covers the zone map. (A) an elite's engage round: the wind-up badge on
 *      exactly the track entries the engine flags `windup` (nameplate chips, target frame) and the line over the enemy
 *      ("Wind-up R3: answer it or it empowers"), the ruler's "Wind-up", each engage card's answered wind-ups = R.engagePreview
 *      (stagger; Send the Pet on a heavy one), the wind-up's tooltip (round, stakes from EMPOWER_DMG and STAGGER_DMG, what
 *      answers it) and the bar spells marked on hover; key W (Lay Trap): ANSWERED where the engine predicts cancel.stagger,
 *      then the STAGGERED badges (nameplate, target frame) = the engine's status and the log line. (B) a later fight where
 *      the Hunter passes: the wind-up lands, EMPOWERED badges = the engine's status, the log line. (C) a dungeon boss: its
 *      wind-up's tooltip (immune to control: an interrupt, a stun or control spell, or Disrupt), Lay Trap shows as Disrupt
 *      exactly as R.engageOptions says, key W logs the wind-up it stops, STAGGERED after it; then the same engage round
 *      loaded with no wind-up in view (window.__ui.loadState; the real content never shows a dungeon boss without one):
 *      greyed out with the engine's reason. After every combat key the bar marks exactly the usable spells that can answer
 *      a wind-up playing now (none without). Stacked toasts in a fight, and in the end-boss fight (jBossState: phase 2 with
 *      two Shards, a Shard targeted, loaded): merged, clear of the boss frame, the target frame, the ruler and nameplates.
 *      (D) a Rogue (jPickRogue: a seed whose autoplay run meets a wind-up playing while a bar spell can stop it): the bar
 *      marks that spell "Answer" as the engine's state says, hovering the wind-up marks every spell that can answer it,
 *      the spell's tooltip names the wind-up, and its key stops it ("is stopped by your ...", STAGGERED = the engine's).
 *   K  the Dev menu (owner feedback 2026-11-11; docs/specs/engine-api.md 12), real engine at Instant speed, seed 4: the corner
 *      button in view and clear of the minimap, the backquote key opens the menu fully in view; Start at (Mage, zone 4,
 *      level 35, the menu's own fields), Jump to the boss in phase 2, Fight an elite of zone 4 found by its id in the search;
 *      after each the view says so and the page's state equals a Node twin that replays the page's engine log
 *      (window.__ui.engineLog: R.debug for the dev ops, R.step for the rest; window.__ui.state = R.serialize); god mode
 *      from the World tab; the key closes it; ?dev=0 and the setting hide the button and the key. No console errors.
 *   L  owner feedback 2026-11-11 (08:03, 08:11, 08:14, 08:31), real engine at Instant speed. (1) the DoT preview: a level-11
 *      Hunter (Dev menu) casts Barbed Arrow; a set-up state (window.__ui.loadState) with DoTs on both enemies (one lethal),
 *      the player and the pet: every HP bar (nameplates, target frame, player and pet frames) marks R.pendingTicks of a Node
 *      twin exactly (data-dot, hatched width), the skull only where lethal, the tooltips' numbers and names; after Pass the
 *      lethal enemy is dead. (2) talent totals: Silent Footing clicked to 1/3 and 3/3 ("Now: +10 %", "Next rank: +20 %";
 *      "Now: +30 %", "Max rank"), Toxic Coating's formula, all = R.talentInfo; every one-percentage talent text states the
 *      engine's number. (3) the first-fight hint: the Rogue's first engage round lists Ambush, Sap, Premeditate on Q, W, E
 *      beside the panel, covering nothing; "Got it" stores it (tbwcr.hints.v1), a new Rogue run has none, a first Mage run
 *      has it until W. (4) a Healing Draught pulses at 30 % health, not at 50 % or on cooldown, and is never drunk for the
 *      player. (5) "Killed by" names Crown-Breaker, not its id; every content ability reads by its name. (6) the settings
 *      window shows Animation speed's four choices whole.
 *   M  the start camp and the contract tracker (docs/specs/expedition.md 9.1, 9.3; engine-api.md 13; M2b 2b.6), real engine
 *      at Instant speed, ?prep=1, seed 7. Class select's Enter opens the camp and a second Enter at once does not set out;
 *      the prep screen's numbers (points left, each offer's zone, price and sites, each option's price, bought and owned
 *      state, the held list, Reserve = N points = M Echoes) equal R.prepView of a Node twin (the page's engine log) after a
 *      click and the keys 2, A, G, R, a drop, a sell, a buy and key 3; Set out, every card and option fully in view; a contract's
 *      and an option's tooltip; Enter sets out (contracts and Reserve = R.contractView); on the map the tracker shows this
 *      zone's contracts (title, "N / M sites") clear of the zone map, site marks on exactly mapView's nodes, hidden ones
 *      unnamed; the quest log lists every contract; zone 2's hub (Dev menu Start at) shows its offer and Take pays from
 *      Reserve. Then seed 1 on the engine's autoplay choices to a completed contract: its reward window (title, +XP and gold
 *      = the engine's events, the item cards) and the choice. No console errors.
 *   N  the fog map (docs/specs/expedition.md 4-6, 9.2; M2b 2b.6), real engine at Instant speed, ?prep=1, seed M_SEED with
 *      Region Charts: every node's fog state (seen, remembered, type known, unknown), level, enemy count, site marks and moves,
 *      the region tints and rim names, the Roads' signposts, the Shardfall, the Dimming's wash and "dims in N" clocks = R.mapView
 *      of a Node twin (nothing the view hides is drawn); the disc round, in view and readable; again once the Dimming spread.
 *   O  the character sheet's Damage block (owner feedback 2026-11-11 11:58): bonus, main attack and pet ranges and averages, the
 *      Power and Weapon damage hovers = R.damageView of a Node twin, Hunter and Mage, at the hub and in a fight.
 *
 * Seeds were picked with the engine of 3559e0e (M2 v2): seed 30's first quest has two Guardians that last long
 * enough for the potion and Autoplay checks. M2 v3 (77c0ca5): seed 1's autoplay run no longer reaches the camp, so part B
 * moved to seed 51, whose engine autoplay run reached the camp hurt, with Trail Rations, could leave zone 1 early at level 9,
 * and whose boss fight reached phase 2 with 1 to 3 Shards. Seed 63 with the part E profile reached the camp holding a Boon
 * of Return and Second Breath; in the boss fight the Boon returned the hero once, then the hero died with Second Breath unused.
 * Combat v2 (e362fd0) changed every run: part B is now seed 20 and part E seed 8, picked by the same conditions on Node runs
 * of the engine's autoplay choices (seed 20 also passes phase 2 with 1 to 4 Shards). Heat's rarity step (7196e96) changed
 * every run's loot once: seed 20 no longer reaches the camp; seed 1 met part B's conditions again (engineer-2026-11-10f) until
 * the wind-ups of combat v2.1 (0bd5a55); since then part B, like part I, picks its seed on Node runs of the same choices.
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
// the Furnace's player-facing words (changes-m2b-v7.md table D: names, states, whole tolls; UX pass 2026-11-11)
import { HEAT_WORDS, tolls, ECHO_LINE } from '../../src/ui/ui-text.js';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/ui-game.html'));
const SIZES = arg('--sizes', '1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const SHOTS = arg('--shots', null);
const PARTS = arg('--parts', 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O').split(',');
const URL = pathToFileURL(FILE).href;
const NEUTRAL = 'rgb(240, 224, 192)'; // label colour of map nodes that hold no fight
const NBSP = /\u00a0/g;
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const R_LINK = { per: R.C.LINK_DR_PER_SHARD, cap: R.C.LINK_DR }; // Linked (rules 10.2, M2 v2)
const SLOWER = 1.4; // owner 2026-11-10: combat at the default speed at least 40 % slower than the M2 v2 round budget
// The M2 v2 round budget (PACE_ROUND_ANIM_S 1.5 s) the owner's "40 % slower" refers to (D47; src/ui/combat-feel.js
// OLD_ROUND_MS). Combat v2 raised PACE_ROUND_ANIM_S to 2.1 s = 1.4 × 1.5 s, so the floor is the larger of the two.
const BUDGET = Math.max(R.C.PACE_ROUND_ANIM_S * 1000, SLOWER * 1500) / SLOWER;
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
    phase: v.phase, time: v.time, autoplay: v.autoplay, step: v.node && v.node.step, round: v.combat ? v.combat.round : null, over: v.combat ? v.combat.over : null,
    hp: v.player && v.player.hp, maxHp: v.player && v.player.maxHp, itemBar: v.player && v.player.itemBar, outcome: v.summary && v.summary.outcome,
    bag: v.player ? v.player.bag.map((b) => (b ? { uid: b.uid, id: b.id, kind: b.kind, name: b.name, count: b.count } : null)) : [],
  };
});
const logLines = async (page) => (await page.locator('#combatlog .lines').innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${SIZE}-${name}.png`) }); };
// M2b v7 (changes-m2b-v7.md A row 10): no day clock; the minimap's clock is empty and hidden at every reading
const clockLabel = () => '';
/** Time labels on screen (toll chips, service and wave labels, the Furnace, the minimap, footers, the tracker): none says "Day N", "N h" or a decimal time. */
const timeLabelsBad = (page) => page.evaluate(() => [...document.querySelectorAll('#heat, #minimap, #tracker, .hrs, .mhrs, .bh, .sfoot, .mfoot, .mhead')].map((el) => el.innerText || '').join(' | ')
  .split(' | ').filter((t) => /\bDay \d|\d h\b|\d\.\d+ tolls?\b|\bhours?\b/i.test(t)));
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

    check('BUG-QA-09', 'no day clock (M2b v7): the minimap shows no clock at the start', (await page.locator('#minimap .clock').textContent()) === clockLabel(0) && !(await page.locator('#minimap .clock').isVisible()), await page.locator('#minimap .clock').textContent());
    { const bad = await timeLabelsBad(page); check('M2b-v7', 'hub: no time label says "Day N", "N h", hours or a decimal (tolls in whole numbers)', !bad.length, bad.join(' | ') || 'none'); }
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

    // ---- map: enemy count and archetypes in the tooltip (BUG-QA-02; combat v2 rules 7.14, mapView archetypes: one role
    // badge per archetype with its count), neutral labels for nodes without a fight
    let target = null;
    mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (!target && n.archetypes && n.archetypes.length >= 2) target = { r: ri + 1, l, n }; }));
    const roleName = (a) => a[0].toUpperCase() + a.slice(1);
    const groups = [...new Set(target.n.archetypes)].map((a) => { const k = target.n.archetypes.filter((x) => x === a).length; return `${k > 1 ? `${k} × ` : ''}${roleName(a)}`; });
    const want = `${target.n.type === 'grind' ? 'Wave 1' : 'Foes'}: ${target.n.archetypes.length} enemies`;
    await page.locator(`#screens button.mnode[data-row="${target.r}"][data-lane="${target.l}"]`).hover();
    const tipFoes = await page.getByRole('tooltip').locator('.tt-foes').evaluateAll((els) => els.map((el) => ({ k: el.querySelector('.k').textContent, archs: [...el.querySelectorAll('.arch')].map((a) => ({ text: a.textContent, icon: !!a.querySelector('img[src^="data:"]') })) })));
    await shot(page, 'A-map-tooltip');
    check('BUG-QA-02', `map tooltip tells the encounter size and archetypes (${target.n.type}, row ${target.r}: ${target.n.archetypes.join(', ')}): "${want}" and the badges ${groups.join(', ')}`,
      tipFoes.length === 1 && tipFoes[0].k === want && tipFoes[0].archs.map((a) => a.text).join(', ') === groups.join(', ') && tipFoes[0].archs.every((a) => a.icon),
      JSON.stringify(tipFoes));
    // a dungeon node lists every trash fight and the boss (mapView fights, bossArchetype)
    let dun = null;
    mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (!dun && n.type === 'dungeon') dun = { r: ri + 1, l, n }; }));
    if (dun) {
      await page.mouse.move(2, 2);
      await page.locator(`#screens button.mnode[data-row="${dun.r}"][data-lane="${dun.l}"]`).hover();
      const dFoes = await page.getByRole('tooltip').locator('.tt-foes').evaluateAll((els) => els.map((el) => ({ k: el.querySelector('.k').textContent, n: el.querySelectorAll('.arch').length })));
      const wantD = [...dun.n.fights.map((f, i) => `Fight ${i + 1}: ${f.length} ${f.length === 1 ? 'enemy' : 'enemies'}`), 'Boss: '];
      check('M2b-2b.6', `map tooltip of the dungeon (row ${dun.r}) lists its ${dun.n.fights.length} trash fights and the boss with role badges`,
        dFoes.length === wantD.length && dFoes.every((f, i) => f.k.startsWith(wantD[i]) && f.n >= 1), JSON.stringify(dFoes));
    }
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
    check('BUG-QA-09', `no day clock at ${v.time} tolls (M2b v7)`, (await page.locator('#minimap .clock').textContent()) === clockLabel(v.time), await page.locator('#minimap .clock').textContent());
    { const bad = await timeLabelsBad(page); check('M2b-v7', 'map: no time label says "Day N", "N h", hours or a decimal (tolls in whole numbers)', !bad.length, bad.join(' | ') || 'none'); }
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
 * as for a player. The clock is read after every change of the run's time, the travel button at every map step and the zone banner
 * after every change of zone.
 * stop.early: stop at the first map step where travelling on is legal under the exit level (the button's data-travel
 * is "early"); stop.zone: stop at the first map step in that zone or later; stop.travel: stop at the first map step where
 * the autoplay choice is TRAVEL_ON (before it is sent).
 */
const autoRun = (page, stop = {}) => page.evaluate(async (opt) => {
  const ui = window.__ui; const out = { clock: [], travel: [], early: null, at: null, banners: [] }; let last = -1;
  let zone = ui.view().zone ? ui.view().zone.idx : null;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (let n = 0; n < 4000; n++) {
    const v = ui.view();
    if (v.phase === 'CAMP' || v.phase === 'SUMMARY') break;
    if (v.phase === 'MAP' && !v.loot) { // with items waiting in the loot window the map is not on screen
      await frame();
      const b = document.querySelector('#screens .mhead button[data-travel]');
      const rec = { z: v.zone.idx, level: v.player.level, need: v.zone.travelLevel, exit: v.zone.exitLevel, travelOn: !!v.legal.travelOn, must: !!v.legal.mustTravel,
        row: v.zone.pos.row, kind: b ? b.dataset.travel : null, disabled: b ? b.disabled : null, label: b ? b.textContent : null };
      out.travel.push(rec);
      if (opt.early && rec.kind === 'early') { out.early = rec; return out; }
      if (opt.zone && v.zone.idx >= opt.zone) { out.at = rec; return out; }
    }
    const c = v.phase === 'MAP' ? ui.autoChoice() : null;
    if (opt.travel && c && c.type === 'ENGINE' && c.action.type === 'TRAVEL_ON') { out.at = out.travel[out.travel.length - 1]; return out; }
    await ui.act(c && c.type === 'ENGINE' && c.action.type === 'TRAVEL_ON' ? { type: 'TRAVEL_ON' } : { type: 'AUTO' });
    await ui.idle();
    const nv = ui.view();
    if (nv.zone && nv.zone.idx !== zone) { zone = nv.zone.idx; out.banners.push({ z: zone, b1: document.querySelector('#banner .b1').textContent, b2: document.querySelector('#banner .b2').textContent }); }
    const h = nv.time;
    if (h !== last && nv.phase !== 'SUMMARY') { last = h; await frame(); out.clock.push([nv.time, document.querySelector('#minimap .clock').textContent]); }
  }
  await ui.idle();
  return out;
}, stop);
/** The travel button state the engine's legality and levels call for (rules 1.5). */
const travelKind = (r) => (r.must ? 'done' : r.travelOn ? (r.level >= r.exit ? 'open' : 'early') : 'locked');

let B_PICK = null;
/**
 * Part B's seed, chosen at run time on Node runs of the same choices (the engine still changes under combat v2.1): the
 * engine's autoplay choices with the UI's own item-bar actions (iUiOwn), the first Hunter seed of 1-60 whose run has a
 * first legal Travel on below the exit level at the travel level, reaches the camp hurt with Trail Rations, then (rations
 * eaten, Face Oruvath, autoplay) has phase 2 with at least two different counts of living Shards. Seed 1 was the part's
 * seed for the engine of 7196e96; it reaches the camp unhurt with the wind-ups of 0bd5a55.
 */
function bPick() {
  if (B_PICK) return B_PICK;
  const run = (s, a) => { const prev = s; let t = R.step(s, a).state; for (const o of iUiOwn(prev, t)) t = R.step(t, o).state; return t; };
  for (let seed = 1; seed <= 60; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    let early = null;
    for (let n = 0; n < 6000 && s.phase !== 'CAMP' && s.phase !== 'ENDED'; n++) {
      if (early === null && s.phase === 'MAP' && !(s.loot && s.loot.length) && R.isLegal(s, { type: 'TRAVEL_ON' })) early = s.player.level < R.C.ZONE_LEVELS * s.zone.z && s.player.level === R.travelLevel(s);
      s = run(s, R.autoAction(s));
    }
    if (!early || s.phase !== 'CAMP') continue;
    const food = s.player.bag.find((it) => it.kind === 'cons' && it.id === 'trail_rations');
    if (!food || s.player.hp >= s.player.d.maxHp) continue;
    s = run(s, { type: 'USE_ITEM', itemId: 'trail_rations' });
    s = run(s, { type: 'FIGHT_BOSS' });
    s = run(s, { type: 'SET_AUTOPLAY', on: true });
    const counts = new Set();
    for (let n = 0; n < 3000 && s.phase !== 'ENDED'; n++) {
      if (s.fight && s.fight.boss && s.fight.boss.phase === 2) { const k = s.fight.enemies.filter((e) => e.alive && e.kind === 'shard').length; if (k > 0) counts.add(k); }
      s = run(s, R.autoAction(s));
    }
    if (counts.size >= 2) { B_PICK = { seed, shards: [...counts].sort() }; return B_PICK; }
  }
  throw new Error('no Hunter seed of 1-60 meets part B\'s conditions');
}

async function partB(browser, W, H) {
  const pick = bPick(); const SEED = pick.seed;
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  check('-', `part B seed ${SEED} (chosen on Node runs: early travel, the camp hurt with Trail Rations, phase 2 with ${pick.shards.join(', ')} Shards)`, true, '');
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
    check('BUG-QA-09', `no day clock at ${samples.length} readings (0 to ${v.time} tolls, M2b v7)`, !wrong.length && !!midnight,
      wrong.length ? wrong.slice(0, 3).map(([h, t]) => `${h} tolls: "${t}"`).join(' | ') : `none past 17 tolls shows a clock`);

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
    check('BUG-QA-10', 'camp: the time (Tolls, M2b v7) and the Ascendancy lines are in view', fullyShown(time) && fullyShown(asc) && footText.includes(HEAT_WORDS.Units) && /Ascendancy/.test(footText), `${footText} | ${placeText(time)} | ${placeText(asc)}`);
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

    // ---- manual rounds at the default speed: input to the end of the step (the action bar is live again).
    // Owner 2026-11-10: rounds at least 40 % slower than the M2 v2 budget (PACE_ROUND_ANIM_S); the UI's round cap is
    // the budget each round reports (src/ui/combat-feel.js roundPace).
    const rounds = [];
    for (let i = 0; i < 40 && rounds.filter((r) => !isMoment(r)).length < 12; i++) { const r = await fightStep(page); if (r) rounds.push(r); }
    const plain = rounds.filter((r) => !isMoment(r)); const ms = plain.map(roundMs);
    const budgets = [...new Set(plain.map((r) => r.round && r.round.budget))];
    const SLOW = SLOWER * BUDGET;
    // D52: headless rendering at 1920x1080 runs at about 10 fps, so there only the median is held to the cap; at 1366x768 every round is
    const maxCapped = !(W >= 1920 && H >= 1080);
    check('M2v2-52', `default speed (${speed0}x): rounds without a level-up or fight end take at least ${SLOW} ms at the median (D47: 1.4 × the M2 v2 budget = PACE_ROUND_ANIM_S ${R.C.PACE_ROUND_ANIM_S} s) and ${maxCapped ? 'at most the round cap' : 'at the median at most the round cap (D52)'}`,
      speed0 === 1 && plain.length >= 8 && budgets.length === 1 && budgets[0] >= SLOW && median(ms) >= SLOW && (maxCapped ? Math.max(...ms) <= budgets[0] : median(ms) <= budgets[0]),
      `${plain.length} rounds: median ${median(ms)} ms, max ${Math.max(...ms)} ms, cap ${budgets.join('/')} ms, tempo ${plain.map((r) => r.round ? r.round.tempo.toFixed(2) : '-').join(' ')}; with moments: ${rounds.filter(isMoment).map(roundMs).join(', ') || 'none'} ms`);

    // ---- key A pressed twice during enemy animations: the round plays on, A is queued once (visible), one attack follows
    let keyTest = null; let shown = false;
    for (let i = 0; i < 8 && !keyTest; i++) {
      let pressed = false;
      const r = await fightStep(page, async (pg) => {
        if (await enemyOnScreen(pg)) {
          await pg.keyboard.press('KeyA'); await pg.keyboard.press('KeyA'); pressed = true;
          shown = (await pg.locator('#actionbar .ab.basic.queued').count()) === 1 && /Next: Attack/.test(await pg.locator('#actionbar .qtag').innerText());
        }
      });
      if (r && pressed) keyTest = r;
    }
    const attacks = keyTest ? keyTest.next.filter((x) => x.type === 'ATTACK').length : 0;
    check('M2v2-52', 'key A twice during enemy animations: the round is not cut short, the attack is queued once and shown on the bar, then plays',
      !!keyTest && keyTest.skippedAt == null && keyTest.queued === 'attack' && shown && attacks === 1 && roundMs(keyTest) <= keyTest.round.budget,
      keyTest ? `round ${roundMs(keyTest)} ms, queued ${keyTest.queued}, bar shows it: ${shown}, attacks after it: ${attacks}` : 'no round with an enemy action on screen');

    // ---- a click on the scene during an enemy's action skips that hit only; the round goes on and no action follows
    let clickTest = null;
    for (let i = 0; i < 8 && !clickTest; i++) {
      let clicked = false;
      const r = await fightStep(page, async (pg) => { if (await enemyOnScreen(pg)) { await pg.mouse.click(Math.round(W * 0.5), Math.round(H * 0.16)); clicked = true; } });
      if (r && clicked && r.hitSkips.length) clickTest = r;
    }
    check('M2v2-52', 'a click during an enemy action skips to the end of that hit only (the round is not finished at once, no action follows)',
      !!clickTest && clickTest.hitSkips.length === 1 && clickTest.skippedAt == null && !clickTest.next.length,
      clickTest ? `hit skipped ${Math.round(clickTest.hitSkips[0].at - clickTest.input)} ms into the round (event ${clickTest.hitSkips[0].event}); round ended ${Math.round(clickTest.end - clickTest.hitSkips[0].at)} ms later; steps after it: ${clickTest.next.length}` : 'no round with an enemy action on screen');
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
const E_SEED = 8; // combat v2 (e362fd0): seed 63's run spends Second Breath before the camp; seed 8 keeps it, as 63 did before
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
    const multi = pickNode((n) => n.type === 'dungeon') || pickNode((n) => n.type === 'elite' && n.archetypes.length > 1) || pickNode((n) => n.type === 'elite');
    for (const { n, r, l } of [plain, multi].filter(Boolean)) {
      // enemies as the engine builds the fights (src/engine/nodes.js): quest and grind at cl; elite at its level, its
      // escort at cl; dungeon trash at its level, the dungeon boss at bossLevel (M2 v4: dungeon variants take half)
      const foes = n.type === 'dungeon' ? [[n.level, 'trash'], [n.bossLevel, 'dboss']] : n.type === 'elite' ? [[n.level, 'elite'], ...(n.archetypes.length > 1 ? [[n.cl, 'normal']] : [])] : [[n.cl, 'normal']];
      const levels = foes.map(([lv]) => lv);
      const ds = foes.map(([lv, va]) => R.zoneDanger(lv, va) - 1); const lo = Math.min(...ds); const hi = Math.max(...ds);
      const line = `Zone danger: enemies here deal ${hi > lo ? 'up to ' : ''}+${pct1(hi)} damage (above level ${FROM}).`;
      const t = await tipOf(page, page.locator(`#screens button.mnode[data-row="${r}"][data-lane="${l}"]`), `E-map-zone3-${n.type}`);
      tips.push({ n, r, levels, line, t, ok: t.includes(line) });
    }
    check('M2v3-1', `zone 3 map tooltips: the zone danger line with the engine's zoneDanger at the enemies' levels and variants (${tips.map((x) => `${x.n.type} r${x.r}: levels ${x.levels.join('/')}`).join('; ')})`,
      tips.length === 2 && tips.every((x) => x.ok), tips.map((x) => `${x.ok ? 'ok' : 'WRONG'} "${x.t}" (wanted "${x.line}")`).join(' | '));
    const mm3 = await tipOf(page, page.locator('#minimap .disc'));
    const step = R.zoneDanger(FROM + 10, 'normal') - 1; const dstep = R.zoneDanger(FROM + 10, 'trash') - 1;
    const rule = `Enemies above level ${FROM} hit harder: +${pct1(step)} damage per 10 levels (in dungeons +${pct1(dstep)}).`;
    check('M2v4-10', `zone 3: the minimap tooltip states the rule from the engine's zoneDanger (ZONE_DANGER_STEP ${R.C.ZONE_DANGER_STEP}, DUNGEON_DANGER_FRAC ${R.C.DUNGEON_DANGER_FRAC})`,
      step === R.C.ZONE_DANGER_STEP && mm3.includes(rule), `${mm3} (wanted "${rule}")`);

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
const F_OWNED = ['vigor']; // unlocks the stored profile holds before the run, bought by the engine's rules
// M2 v4 removed Wayfinder (80 Echoes) from the catalogue: the stored profile also holds it, as a profile saved under the
// older catalogue does. The engine ignores the unknown id (no effect, no refund); the Hall and class select must not break.
const F_OLD = { id: 'wayfinder', cost: 80 };
const F_ECHOES = 70; // its balance: with the run's Echoes, Packed Satchel is affordable
const F_BUY = 'satchel'; // the unlock bought in the check (60): it shows at run start (Healing Draughts in the bags)
const F_NEXT_SEED = 7; // typed into the Seed field for the run after the purchase
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // the game's number format (util.js fmtNum)
/** The part F profile, bought by the engine's own rules. */
function fProfile() {
  let p = R.newProfile(); p.echoes = 100000;
  for (const id of F_OWNED) p = R.buyMeta(p, id);
  p.unlocks[F_OLD.id] = 1; p.spent += F_OLD.cost;
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
      cards.length === offers.length && !wrong.length && states.affordable && states.unaffordable && states.locked, // owned: after the purchase below (M2 v4: Vigor has 4 ranks)
      wrong.length ? wrong.slice(0, 4).map((o) => `${o.id}: ${JSON.stringify(cards.find((x) => x.id === o.id) || 'missing')} (engine ${stateOf(o)} ${o.rank}/${o.ranks} cost ${o.nextCost})`).join(' | ') : `${cards.length} cards: ${JSON.stringify(states)}`);
    const fxOf = (id) => (cards.find((c) => c.id === id) || {}).fx || '';
    const reqOf = (id) => (cards.find((c) => c.id === id) || {}).req || '';
    const want = [
      ['vigor', `+${Math.round(M.vigor.hpPct * 1000) / 10} % max health per rank`], ['pockets', `+${M.pockets.slots} bag slots per rank`], // M2b v6: 0.5 %
      ['satchel', `Start with ${M.satchel.potions} ${R.C.CONSUMABLE.healing_draught.name}s`],
      ['heirloom_blade', `item level ${M.heirloom_blade.ilvl}`], ['sp_h1', R.C.SPELL[M.sp_h1.spell].name],
    ];
    const badFx = want.filter(([id, t]) => !fxOf(id).includes(t));
    check('M3-1', `effect texts carry the catalogue's numbers (${want.map(([id]) => id).join(', ')}); locked cards name what they need (Alchemist's Notes: ${M[M.alchemist.req[0]].name})`,
      !badFx.length && reqOf('alchemist').includes(M[M.alchemist.req[0]].name) && reqOf('second_breath').includes('reached once'),
      badFx.length ? badFx.map(([id, t]) => `${id}: "${fxOf(id)}" (wanted "${t}")`).join(' | ') : `alchemist "${reqOf('alchemist')}", second_breath "${reqOf('second_breath')}"`);

    // ---- M2 v4: the stored profile holds Wayfinder (older catalogue): no card for it, no text for it, Swift Boots not locked by it
    const hallText = await hall.innerText();
    const sb = cards.find((c) => c.id === 'swift_boots');
    if (M[F_OLD.id]) check('M2v4-7', `the engine still lists ${F_OLD.id} (before M2 v4): no check of the removed entry`, true, '');
    else check('M2v4-7', `a profile holding ${F_OLD.id} (removed in M2 v4): the Hall shows no card or text for it, ${M.swift_boots.name} is ${sb && sb.state} (req ${JSON.stringify(M.swift_boots.req)}), the saved unlock stays`,
      !cards.some((c) => c.id === F_OLD.id) && !/Wayfinder|costs no time/i.test(hallText) && sb && sb.state !== 'locked' && !sb.req && (saved.unlocks || {})[F_OLD.id] === 1,
      `cards ${cards.map((c) => c.id).join(',')} | swift_boots ${JSON.stringify(sb)} | saved unlocks ${JSON.stringify(saved.unlocks)}`);

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
        && texts.haste.includes(`${tolls(R.C.OATH_HASTE_TIME)} sooner`) && texts.thrift.includes(`×${R.C.OATH_THRIFT_MULT}`) && texts.frailty.includes('No resurrections'),
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

// ------------------------------------------------------------------ part G: M2 v4, real engine, Instant
/** The part G profile: owns the Oaths (after a victory) and still holds Wayfinder from the older catalogue (F_OLD). */
function gProfile() {
  let p = R.newProfile(); p.reachedBoss = true; p.bossKills = 1; p.firstKill.hunter = true; p.runs = 5; p.echoes = 30; p.earned = 30 + F_OLD.cost;
  p = R.buyMeta(p, 'oaths');
  p.unlocks[F_OLD.id] = 1; p.spent += F_OLD.cost;
  return p;
}
let G_TWIN = null;
/** The Node run of a seed (Hunter, Ridgewolf, Oath of Haste, the engine's autoplay choices): the first travel and the camp. */
function gRun(seed, profile) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, profile });
  for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'SET_OATH', oath: 'haste', on: true }, { type: 'START_RUN' }]) s = R.step(s, a).state;
  let travel = null;
  for (let n = 0; n < 20000 && s.phase !== 'CAMP' && s.phase !== 'ENDED' && s.phase !== 'SUMMARY'; n++) {
    const a = R.autoAction(s);
    const r = R.step(s, a);
    if (!travel && a.type === 'TRAVEL_ON') travel = { z: s.zone.z, before: s.time, spent: r.state.time - s.time };
    s = r.state;
  }
  if (s.phase !== 'CAMP') return null;
  const f = R.step(s, { type: 'FIGHT_BOSS' }).state.fight;
  return { seed, travel, time: s.time, par: R.bossPar(s), asc: f.boss.asc };
}
function gTwin() {
  if (G_TWIN) return G_TWIN;
  const profile = gProfile(); const runs = [];
  // preferred: Ascendancy only because of the Oath (at least one ASC_STEP_TIME past bossPar, less than one past BOSS_TIME_PAR)
  const onlyOath = (r) => r.time >= r.par + R.C.ASC_STEP_TIME && r.time < R.C.BOSS_TIME_PAR + R.C.ASC_STEP_TIME;
  for (let seed = 1; seed <= 60 && !runs.some(onlyOath); seed++) { const r = gRun(seed, profile); if (r && r.travel) runs.push(r); }
  if (!runs.length) throw new Error('no seed of 1-60 reaches the camp');
  const pick = runs.find(onlyOath) || runs[0];
  G_TWIN = { profile, ...pick };
  return G_TWIN;
}

async function partG(browser, W, H) {
  const twin = gTwin();
  const { context, page, errors } = await open(browser, W, H, `seed=${twin.seed}&speed=instant`, twin.profile);
  try {
    const PAR = R.C.BOSS_TIME_PAR - R.C.OATH_HASTE_TIME; // rules 1.7 with the Oath of Haste: what bossPar must give
    await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
    const sw = page.getByRole('switch', { name: R.C.OATH.haste.name });
    await sw.click(); await idle(page);
    const create = await page.evaluate(() => window.__ui.view().create.oaths);
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    let v = await page.evaluate(() => ({ phase: window.__ui.view().phase, oaths: window.__ui.view().oaths }));
    check('M2v4-7', `class select with a profile holding ${F_OLD.id} (older catalogue) and the Oaths: Oath of Haste sworn (${JSON.stringify(create)}), the run starts (seed ${twin.seed})`,
      JSON.stringify(create) === '["haste"]' && v.phase === 'ZONE_HUB' && JSON.stringify(v.oaths) === '["haste"]', JSON.stringify({ create, ...v }));

    // ---- the first Travel on: its tooltip and the tolls it spends
    const r1 = await autoRun(page, { travel: true });
    if (!r1.at) throw new Error('setup: no Travel on choice before the camp');
    await page.waitForTimeout(300);
    const btn = page.locator('#screens .mhead button[data-travel]');
    const tTip = await tipOf(page, btn, 'G-travel');
    const h0 = (await view(page)).time;
    await btn.click(); await idle(page);
    const h1 = (await view(page)).time;
    check('M2v4-7', `Travel on with ${F_OLD.id} in the profile (zone ${r1.at.z}): the tooltip says "Costs ${tolls(R.C.TIME_TRAVEL)}.", the time moves ${h0} -> ${h1} tolls (Node run: +${twin.travel.spent} at ${twin.travel.before})`,
      tTip.includes(`Costs ${tolls(R.C.TIME_TRAVEL)}.`) && !/no time/i.test(tTip) && h1 - h0 === R.C.TIME_TRAVEL && twin.travel.spent === R.C.TIME_TRAVEL && h0 === twin.travel.before,
      tTip);

    // ---- the camp: par from bossPar with the Oath of Haste, and the engine's Ascendancy
    await autoRun(page);
    v = await view(page);
    if (v.phase !== 'CAMP') throw new Error(`setup did not reach the camp (phase ${v.phase})`);
    await page.waitForTimeout(1500); // the zone banner fades
    const foot = (await page.locator('#screens .side .sfoot').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const track = (await page.locator('#tracker').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const mm = await tipOf(page, page.locator('#minimap .disc'));
    await shot(page, 'G-camp-haste');
    const ascText = twin.asc > 0 ? `+${Math.round(twin.asc * 100)} % health and damage` : 'None: you are on time';
    check('M2v4-par', `camp with the Oath of Haste at ${v.time} tolls: panel "${v.time} (par ${twin.par})", tracker "Tolls: ${v.time} (par ${twin.par})", minimap "past ${twin.par} (Ascendancy)" = bossPar (${R.C.BOSS_TIME_PAR} - ${R.C.OATH_HASTE_TIME}), Ascendancy "${ascText}" (the engine's)`,
      twin.par === PAR && v.time === twin.time && foot.includes(`${v.time} (par ${twin.par})`) && foot.includes(ascText) && track.includes(`${HEAT_WORDS.Units}: ${v.time} (par ${twin.par})`)
        && mm.includes(`past ${twin.par} (Ascendancy)`) && !foot.includes(`par ${R.C.BOSS_TIME_PAR})`),
      `panel "${foot}" | tracker "${track}" | minimap "${mm}"`);
  } catch (e) {
    check('-', 'part G ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part G: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part H: combat v2 display, real engine
// Seeds chosen with the engine of e362fd0 (combat v2, D49): Hunter seed 16's first fight is a brute (Heavy Smash on its
// turn 2) and a skulker (Signal on its turn 3); Mage seed 30's is a beast and a guardian (its ward is the beast).
const H_SEED = 16;
const H_MAGE_SEED = 30;

/** A Node twin of the page's run: the same seed, then every engine action the page applied (window.__ui.engineLog). */
function makeTwin(seed) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT }); let n = 0;
  return {
    get s() { return s; },
    async sync(page) {
      const log = await page.evaluate(() => window.__ui.engineLog());
      for (const a of log.slice(n)) s = R.step(s, a).state;
      n = log.length;
      return s;
    },
  };
}
/** What a track shows (engine-api.md 6): its entries, the now-entry as it will be played (a replaced one: the basic attack). */
function wantTrack(e) {
  const it = e.intent || {};
  return e.track.map((x) => {
    const now = e.turn >= 1 && x.turn === e.turn; const live = now && !it.cancelled;
    return { turn: x.turn, id: live && it.replaced ? it.id : x.id, est: (live ? it.est : x.est) || 0 };
  });
}
/** The combat v2 display on the page: engage panel, ruler, nameplate chips, target frame rows, off-balance, bar windows. */
const v2dom = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  const cur = document.querySelector('#ruler .rl-c.cur');
  return {
    engage: vis(document.querySelector('#engage')), options: [...document.querySelectorAll('#engage .eg-opt[data-opt]')].map((c) => c.dataset.opt),
    spells: [...document.querySelectorAll('#engage .eg-sp')].map((b) => b.dataset.spell), any: !!document.querySelector('#engage .eg-any'),
    ruler: vis(document.querySelector('#ruler')), rulerCur: cur ? Number(cur.dataset.round) : null,
    np: [...document.querySelectorAll('#nameplates .np')].filter((el) => !el.classList.contains('dead')).map((el) => ({
      idx: Number(el.dataset.idx), offbal: el.classList.contains('offbal'), obal: vis(el.querySelector('.obal')) ? el.querySelector('.obal').textContent : null,
      frost: el.querySelector('.obal').classList.contains('frost'), role: (el.querySelector('img.role') || { dataset: {} }).dataset.role || null,
      chips: [...el.querySelectorAll('.trk .tk')].map((c) => ({ turn: Number(c.dataset.turn), id: c.dataset.id, est: Number(c.dataset.est), cancel: c.classList.contains('cancel'), ob: c.classList.contains('ob'), big: c.classList.contains('big') })),
    })),
    rows: [...document.querySelectorAll('#target-frame .ttrack .tr')].map((r) => ({ turn: Number(r.dataset.turn), id: r.dataset.id })),
    targetOffbal: document.querySelector('#target-frame').classList.contains('offbal'),
    bar: [...document.querySelectorAll('#actionbar .ab[data-slot]')].map((b) => ({ slot: Number(b.dataset.slot), window: b.classList.contains('window'), else: b.classList.contains('window-else') })),
  };
});
const chipText = (c) => c.map((x) => `${x.turn}:${x.id}:${x.est}`).join(' ');
/** Every living enemy's nameplate shows INTENT_TRACK_LEN chips that match the twin's track; the target frame shows the target's. */
function tracksMatch(d, s, target) {
  const bad = [];
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const np = d.np.find((x) => x.idx === e.idx); const want = wantTrack(e);
    if (!np) { bad.push(`no nameplate for ${e.idx}`); continue; }
    if (want.length !== R.C.INTENT_TRACK_LEN || chipText(np.chips) !== chipText(want) || !np.chips[0].big) bad.push(`${e.name}: page ${chipText(np.chips)} vs engine ${chipText(want)}`);
  }
  const t = s.fight.enemies[target];
  if (t && t.alive && d.rows.map((r) => `${r.turn}:${r.id}`).join(' ') !== wantTrack(t).map((x) => `${x.turn}:${x.id}`).join(' ')) bad.push(`target frame rows ${JSON.stringify(d.rows)}`);
  return bad;
}
/** The bar's window highlight follows the engine: R.spellInfo(...).window on the current target (else on another enemy). */
function windowsMatch(d, s, target) {
  const bad = [];
  s.player.bar.forEach((id, slot) => {
    if (!id) return;
    const b = d.bar.find((x) => x.slot === slot);
    const legal = R.isLegal(s, { type: 'CAST', spellId: id, target: R.C.SPELL[id].target === 'enemy' ? target : null });
    const all = R.C.SPELL[id].target === 'all';
    const here = legal && (all ? R.spellInfo(s, id, null).window : R.spellInfo(s, id, target).window);
    const there = legal && !here && !all && s.fight.enemies.some((e) => e.alive && e.idx !== target && R.spellInfo(s, id, e.idx).window);
    if (!!b.window !== !!here || !!b.else !== !!there) bad.push(`${id}: page window ${b.window}/${b.else}, engine ${here}/${there}`);
  });
  return bad;
}
/** Every living enemy's off-balance marker follows R.offBalance (the ribbon names its extra damage taken). */
function offBalanceMatch(d, s) {
  const bad = [];
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const ob = R.offBalance(s, e.idx); const np = d.np.find((x) => x.idx === e.idx);
    if (!np) continue;
    const pct = ob ? `+${Math.round(ob.taken * 100)} %` : null;
    if (!!np.offbal !== !!ob || (ob && !(np.obal || '').includes(pct)) || (ob && np.frost !== (ob.status === 'FROZEN'))) bad.push(`${e.name}: page ${np.offbal} "${np.obal}", engine ${JSON.stringify(ob)}`);
  }
  return bad;
}

async function partH(browser, W, H) {
  // ---- Hunter: engage round, the tracks, the Lay Trap preview, the trap's off-balance window
  {
    const { context, page, errors } = await open(browser, W, H, `seed=${H_SEED}&speed=instant`);
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const twin = makeTwin(H_SEED);
      for (let i = 0; i < 200; i++) { const v = await view(page); if (v.round && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      let s = await twin.sync(page);
      const brute = s.fight.enemies.find((e) => e.arch === 'brute'); const skulker = s.fight.enemies.find((e) => e.arch === 'skulker');
      await page.locator(`#nameplates .np[data-idx="${brute.idx}"]`).click(); await idle(page);
      let d = await v2dom(page);
      const want = R.engageOptions(s).map((o) => o.id);
      await shot(page, 'H-engage');
      check('M2b-2b.6', `round 1 (R.isEngageRound): the engage panel offers the class's options ${want.join(', ')} in order and "any bar spell"; the opening ruler marks round 1`,
        R.isEngageRound(s) && d.engage && d.options.join(',') === want.join(',') && d.any && d.ruler && d.rulerCur === 1, JSON.stringify({ engage: d.engage, options: d.options, any: d.any, ruler: d.ruler, cur: d.rulerCur }));
      let bad = tracksMatch(d, s, brute.idx);
      check('M2b-2b.6', `each nameplate and the target frame show the enemy's ${R.C.INTENT_TRACK_LEN} track entries in order, as the engine has them (Node twin of the page's actions)`, !bad.length, bad.join(' | ') || d.np.map((x) => `${x.idx}: ${chipText(x.chips)}`).join(' | '));
      check('M2b-2b.6', 'role badges: brute and skulker; the skulker that will Signal is tagged with its round', d.np.find((x) => x.idx === brute.idx).role === 'brute' && d.np.find((x) => x.idx === skulker.idx).role === 'skulker'
        && (await page.locator(`#nameplates .np[data-idx="${skulker.idx}"] .rtag.look`).textContent()) === `Signal R${skulker.turn0 + skulker.track.find((x) => x.id === 'signal').turn - 1}`, d.np.map((x) => `${x.idx} ${x.role}`).join(', '));
      // hover Lay Trap with the brute targeted: the preview the page shows is R.engagePreview's, drawn on the brute's chips
      await page.locator('#engage .eg-opt[data-opt="lay_trap"]').hover(); await page.waitForTimeout(150);
      const pv = await page.evaluate(() => window.__ui.preview());
      const wantPv = R.engagePreview(s, { type: 'ENGAGE', option: 'lay_trap', target: brute.idx });
      d = await v2dom(page);
      const chips = d.np.find((x) => x.idx === brute.idx).chips;
      const pvRow = wantPv.enemies.find((x) => x.u === brute.idx) || { cancelled: [], offBalance: [] };
      await shot(page, 'H-engage-preview');
      check('M2b-2b.6', `hovering Lay Trap previews R.engagePreview on the brute's track: cancelled turn(s) ${pvRow.cancelled.join(',')}, off-balance on ${pvRow.offBalance.join(',')}`,
        pv && JSON.stringify(pv.data) === JSON.stringify(wantPv) && chips.filter((c) => c.cancel).map((c) => c.turn).join(',') === pvRow.cancelled.join(',') && chips.filter((c) => c.ob).map((c) => c.turn).join(',') === pvRow.offBalance.join(','),
        `page ${JSON.stringify(pv && pv.data)} chips ${JSON.stringify(chips.map((c) => [c.turn, c.cancel, c.ob]))}; engine ${JSON.stringify(wantPv)}`);
      await page.mouse.move(2, 2);
      // W: Lay Trap on the brute. Round 2: no engage panel, no window yet
      await page.keyboard.press('KeyW'); await idle(page);
      s = await twin.sync(page); d = await v2dom(page);
      const last = (await page.evaluate(() => window.__ui.engineLog())).slice(-1)[0];
      bad = [...tracksMatch(d, s, brute.idx), ...offBalanceMatch(d, s), ...windowsMatch(d, s, brute.idx)];
      check('M2b-2b.6', 'key W sends ENGAGE lay_trap on the target; round 2: no engage panel (ENGAGE is legal in round 1 only), the ruler moves to round 2, tracks, markers and bar match the engine',
        last.type === 'ENGAGE' && last.option === 'lay_trap' && last.target === brute.idx && s.fight.round === 2 && !R.isEngageRound(s) && !d.engage && d.rulerCur === 2 && !bad.length,
        `${JSON.stringify(last)}; round ${s.fight.round}, engage panel ${d.engage}, ruler ${d.rulerCur}; ${bad.join(' | ')}`);
      // attack until the trap springs on the Heavy Smash: the brute is off-balance for the next action
      let opened = null;
      for (let r = 0; r < 4 && !opened; r++) {
        await page.keyboard.press('KeyA'); await idle(page);
        s = await twin.sync(page); d = await v2dom(page);
        if (!s.fight || s.fight.over) break;
        if (d.engage) { check('M2b-2b.6', `no engage panel in round ${s.fight.round}`, false, 'the panel is shown'); break; }
        if (s.fight.enemies.some((e) => e.alive && R.offBalance(s, e.idx))) opened = { round: s.fight.round, d, s };
      }
      if (opened) {
        await shot(page, 'H-offbalance');
        const tgt = await page.evaluate(() => window.__ui.target());
        bad = [...offBalanceMatch(opened.d, opened.s), ...windowsMatch(opened.d, opened.s, tgt), ...tracksMatch(opened.d, opened.s, tgt)];
        const bchips = opened.d.np.find((x) => x.idx === brute.idx).chips;
        check('M2b-2b.6', `round ${opened.round}: the trap cancels the brute's Heavy Smash (now chip struck, off-balance) and the off-balance marker and the bar's window highlight appear where R.offBalance and R.spellInfo(...).window say`,
          !bad.length && bchips[0].cancel && bchips[0].ob && opened.d.np.find((x) => x.idx === brute.idx).offbal && opened.d.bar.some((b) => b.window) && (tgt !== brute.idx || opened.d.targetOffbal),
          `${bad.join(' | ')} brute now chip ${JSON.stringify(bchips[0])}; bar ${JSON.stringify(opened.d.bar.filter((b) => b.window || b.else))}`);
      } else check('M2b-2b.6', 'the trap opens an off-balance window on the brute within 4 rounds', false, 'no enemy off-balance');
    } catch (e) {
      check('-', 'part H (Hunter) ran to the end', false, e.message.split('\n')[0]);
    }
    check('-', 'part H (Hunter): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- Mage: Pre-cast lists the engine's spells; Binding Glyph freezes the beast, which counts as off-balance
  {
    const { context, page, errors } = await open(browser, W, H, `seed=${H_MAGE_SEED}&speed=instant`);
    try {
      await page.locator('#create .ccard[data-cls="mage"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const twin = makeTwin(H_MAGE_SEED);
      for (let i = 0; i < 200; i++) { const v = await view(page); if (v.round && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      let s = await twin.sync(page);
      const beast = s.fight.enemies.find((e) => e.arch === 'beast') || s.fight.enemies[0];
      await page.locator(`#nameplates .np[data-idx="${beast.idx}"]`).click(); await idle(page);
      let d = await v2dom(page);
      const pre = R.engageOptions(s).find((o) => o.id === 'precast');
      check('M2b-2b.6', `Mage engage round: Pre-cast offers the bar spells R.engageOptions lists (${pre.spells.map((x) => x.spellId).join(', ')})`, d.engage && d.spells.join(',') === pre.spells.map((x) => x.spellId).join(','), JSON.stringify(d.spells));
      await page.keyboard.press('KeyW'); await idle(page);
      s = await twin.sync(page); d = await v2dom(page);
      const ob = R.offBalance(s, beast.idx);
      await shot(page, 'H-mage-frozen');
      const bad = [...offBalanceMatch(d, s), ...windowsMatch(d, s, beast.idx), ...tracksMatch(d, s, beast.idx)];
      check('M2b-2b.6', 'Binding Glyph: the frozen beast is marked as an off-balance window (FROZEN, frost ribbon) and the bar highlights the spells that land in it, as the engine says',
        ob && ob.status === 'FROZEN' && !bad.length && d.np.find((x) => x.idx === beast.idx).frost && d.bar.some((b) => b.window), `${JSON.stringify(ob)}; ${bad.join(' | ')}`);
    } catch (e) {
      check('-', 'part H (Mage) ran to the end', false, e.message.split('\n')[0]);
    }
    check('-', 'part H (Mage): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part I: the heat meter, real engine
// Both seeds are chosen at run time on Node runs (the engine still changes under combat v2.1): iPick for the rows run on
// the slow policy, iExpPick for the expedition run (?expedition=1) on the engine's autoplay choices.
const HNAME = HEAT_WORDS.state; // Calm, Smouldering, Burning, Infernal (M2b v7)
const fh = (x) => String(Math.round(Math.abs(x))); // whole tolls (M2b v7: no decimals)
const lineS = (l) => Math.ceil(l - 1e-9); // the Star's line as shown: the engine's, whole and rounded up (changes-m2b-v7.md A row 2)
const stand = (x) => { const past = Math.floor(x.heat + 1e-9); const hand = Math.ceil(-x.heat - 1e-9); return x.heat > 0 && past > 0 ? `${tolls(past)} past the line` : x.heat < 0 && hand > 0 ? `${tolls(hand)} in hand` : 'On the line'; };
const bossTxt = (a) => `Boss +${Math.round((a || 0) * 100)} %`;
const barPct = (x) => (100 * (Math.min(R.C.HEAT_BAR_MAX, Math.max(R.C.HEAT_BAR_MIN, x)) - R.C.HEAT_BAR_MIN)) / (R.C.HEAT_BAR_MAX - R.C.HEAT_BAR_MIN);
const chanceTxt = (p) => { for (let d = 2; d <= 10; d++) { const n = p * d; if (Math.abs(n - Math.round(n)) < 1e-9 && Math.round(n) >= 1) return `${Math.round(n)} in ${d}`; } return `${Math.round(p * 100)} %`; };
/** What a state pays in the meter's short words and the tooltips' long ones (HEAT_GAIN, HEAT_RARITY_UP). */
const payTxt = (s, short) => {
  const g = R.C.HEAT_GAIN[s] || 0; const u = R.C.HEAT_RARITY_UP[s] || 0;
  if (!g && !u) return null;
  return [g ? `+${Math.round(g * 100)} % XP and gold` : null, u ? (short ? `${chanceTxt(u)} drops up` : `${chanceTxt(u)} drops a rarity up`) : null].filter(Boolean).join(short ? ' · ' : ', ');
};
const FIRST_PAYING = R.C.HEAT_STATES.find((s) => payTxt(s, true));
/** The meter's pay line for a heatView (the view shown at the camp, in a node, elsewhere). */
function wantPay(hv, camp) {
  if (camp) return `At the camp ${HEAT_WORDS.name} pays nothing; it strengthens the boss`;
  if (hv.node && (hv.node.gain > 0 || hv.node.rarityUp > 0)) return `This node pays ${HNAME[hv.node.state]}: ${payTxt(hv.node.state, true)}`;
  if (payTxt(hv.state, true)) return `Spoils: ${payTxt(hv.state, true)}`;
  return hv.node ? '' : `${HNAME[FIRST_PAYING]} pays ${payTxt(FIRST_PAYING, true)}`;
}
/** The meter as drawn: its state, texts, the marker, line and Dimming positions (style.left, per cent of the bar). */
const meterDom = (page) => page.evaluate(() => {
  const m = document.querySelector('#heat'); if (!m) return null;
  const q = (s) => m.querySelector(s); const t = (s) => (q(s) ? q(s).textContent.replace(/ /g, ' ') : null);
  const pc = (s) => (q(s) ? parseFloat(q(s).style.left) : null);
  return { shown: !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none', state: m.dataset.state, by: m.dataset.by, sname: t('.ht-sname'), by2: t('.ht-by'), num: t('.ht-num'),
    boss: t('.ht-boss'), pay: t('.ht-pay'), on: [...m.querySelectorAll('.ht-seg.on')].map((x) => x.dataset.hs), mark: pc('.ht-mark.run'), line: pc('.ht-line'),
    runSets: q('.ht-mark.run').classList.contains('sets'), dimShown: !q('.ht-mark.dim').classList.contains('hidden'), dim: pc('.ht-mark.dim'), dimSets: q('.ht-mark.dim').classList.contains('sets'),
    dimTxt: q('.ht-dim').classList.contains('hidden') ? null : t('.ht-dim span'), ghost: q('.ht-mark.ghost').classList.contains('hidden') ? null : pc('.ht-mark.ghost'),
    arrow: q('.ht-arrow').classList.contains('hidden') ? null : t('.ht-arrow') };
});
/** Is the meter inside the window and on top at five points (no panel, window or frame over it)? */
const meterCover = (page) => page.evaluate(() => {
  const m = document.querySelector('#heat'); const r = m.getBoundingClientRect(); const bad = [];
  for (const [fx, fy] of [[0.5, 0.5], [0.04, 0.2], [0.96, 0.2], [0.04, 0.85], [0.96, 0.85]]) {
    const x = r.left + r.width * fx; const y = r.top + r.height * fy; const el = document.elementFromPoint(x, y);
    if (!el || !el.closest('#heat')) bad.push(`${Math.round(x)},${Math.round(y)} under ${el ? (el.id ? `#${el.id}` : `.${[...el.classList].join('.')}` || el.tagName) : 'nothing'}`);
  }
  const inside = r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  return { ok: inside && !bad.length && !m.classList.contains('hidden'), text: `rect ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')}${inside ? '' : ' (outside)'}${bad.length ? ` covered at ${bad.join('; ')}` : ''}` };
});
/** Differences between the meter drawn and R.heatView (an empty list when they agree). */
function meterDiff(d, hv, camp) {
  const out = [];
  const eq = (k, got, want) => { if (got !== want) out.push(`${k} "${got}" (want "${want}")`); };
  const near = (k, got, want) => { if (got == null || Math.abs(got - want) > 0.05) out.push(`${k} ${got} (want ${want.toFixed(2)})`); };
  if (!d || !d.shown) return ['meter not shown'];
  eq('state', d.state, hv.state); eq('name', d.sname, HNAME[hv.state]); eq('by', d.by, hv.by); eq('numbers', d.num, stand(hv)); eq('boss', d.boss, bossTxt(hv.ascIfPar));
  eq('segment', d.on.join(','), hv.state); eq('pay line', d.pay, wantPay(hv, camp));
  near('marker', d.mark, barPct(hv.bar.marker)); near('line', d.line, barPct(0));
  eq('arrow', d.arrow, hv.bar.beyond < 0 ? '◀' : hv.bar.beyond > 0 ? '▶' : null);
  if (hv.dimIn === null || hv.dimIn === undefined) { if (d.dimShown || d.dimTxt) out.push('a Dimming marker without a Dimming clock'); } else {
    eq('Dimming text', d.dimTxt, hv.dimIn <= 0 ? 'Dimmed' : `Dimming: ${tolls(hv.dimIn)}`);
    const seg = { clear: [R.C.HEAT_BAR_MIN, R.C.HEAT_WARM_AT], warm: [R.C.HEAT_WARM_AT, R.C.HEAT_HOT_AT], hot: [R.C.HEAT_HOT_AT, R.C.HEAT_SCORCH_AT], scorched: [R.C.HEAT_SCORCH_AT, R.C.HEAT_BAR_MAX] }[hv.stateDim];
    if (!d.dimShown || d.dim < barPct(seg[0]) || d.dim > barPct(seg[1])) out.push(`Dimming marker ${d.dim} outside ${hv.stateDim} (${barPct(seg[0]).toFixed(1)}-${barPct(seg[1]).toFixed(1)})`);
    eq('the clock that sets the state', `${d.dimSets ? 'dim' : ''}${d.runSets ? 'run' : ''}`, hv.by); eq('by text', d.by2, hv.by === 'dim' ? ' · Dimming' : '');
  }
  return out;
}
/** A Node twin like makeTwin, with newRun options (mapMode). */
function makeTwinOpts(seed, opts) {
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, ...opts }); let n = 0;
  return { get s() { return s; }, async sync(page) { const log = await page.evaluate(() => window.__ui.engineLog()); for (const a of log.slice(n)) s = R.step(s, a).state; n = log.length; return s; } };
}
/** The tooltip's heat block (.tt-heat) and the meter's ghost while an element is hovered. */
async function hoverHeat(page, locator) {
  await locator.hover(); await page.waitForTimeout(60);
  const r = await page.evaluate(() => {
    const tt = document.querySelector('.tooltip.on .tt-heat'); const m = document.querySelector('#heat');
    const g = m.querySelector('.ht-mark.ghost');
    return { tip: tt ? [...tt.children].map((x) => x.textContent.replace(/ /g, ' ')) : null, ghost: g.classList.contains('hidden') ? null : parseFloat(g.style.left), pay: m.querySelector('.ht-pay').textContent };
  });
  await page.mouse.move(2, 2); await page.waitForTimeout(30);
  r.after = await page.evaluate(() => document.querySelector('#heat .ht-mark.ghost').classList.contains('hidden'));
  return r;
}
/** Differences between a hovered choice's tooltip block and ghost and R.heatPreview p. */
function previewDiff(r, p, opts = {}) {
  const out = [];
  if (!r.tip) return ['no heat block in the tooltip'];
  const hrs = `${tolls(p.time)}${p.perWave ? ' a wave' : ''}`;
  const head = r.tip[0];
  if (!head.includes(`${hrs}, ends ${HNAME[p.state]}`)) out.push(`head "${head}" (want "${hrs}, ends ${HNAME[p.state]}")`);
  if (head.includes('(a new state)') !== !!p.change) out.push(`"(a new state)" ${head.includes('(a new state)')} (change ${p.change})`);
  const pays = r.tip.find((x) => x.startsWith('Pays '));
  const wantPays = p.pays ? `Pays ${HNAME[p.pays]}: ${payTxt(p.pays, false) || 'no reward'}` : null;
  if ((pays || null) !== wantPays) out.push(`pays "${pays}" (want "${wantPays}")`);
  const then = r.tip.find((x) => x.startsWith('Then '));
  const wantThen = `Then ${stand(p).replace(/^On the line$/, 'on the line')} · ${bossTxt(p.ascIfPar)}${p.dimIn !== null && p.dimIn !== undefined && !p.dimFight ? ` · Dimming ${p.dimIn <= 0 ? 'here' : `in ${tolls(p.dimIn)}`}` : ''}`;
  if (then !== wantThen) out.push(`"${then}" (want "${wantThen}")`);
  if (r.ghost == null || Math.abs(r.ghost - barPct(p.heat)) > 0.05) out.push(`ghost ${r.ghost} (want ${barPct(p.heat).toFixed(2)})`);
  const wantGhost = `→ ${hrs}${p.dimFight ? ' + Dimmed fight' : ''}, ends ${HNAME[p.state]}`;
  if (r.pay !== wantGhost) out.push(`meter "${r.pay}" (want "${wantGhost}")`);
  if (!r.after) out.push('the ghost stays after the hover');
  if (opts.chip !== undefined) {
    const want = `${tolls(p.time)}${p.perWave ? '/wave' : ''}`;
    if (!opts.chip || opts.chip.text !== want || (opts.chip.hs || null) !== (p.change ? p.state : null)) out.push(`toll label ${JSON.stringify(opts.chip)} (want "${want}"${p.change ? ` in ${p.state}` : ''})`);
  }
  return out;
}
/**
 * The slow policy, one pure function for the page (slowRun) and the Node seed pick (iPick): every hub service, the
 * reachable node that is no elite or dungeon with the most tolls (a Grind counts its most waves), the most Grind waves;
 * null: the engine's autoplay choice. x: { phase, svcOpen, services, mapChoices: [{ lane, time, perWave, type }], waves,
 * maxWaves }. Returns a UI action (HUB_SERVICE, CHOOSE_NODE, GRIND_SET_WAVES) or null.
 */
function iSlowChoice(x) {
  if (x.phase === 'ZONE_HUB' && !x.svcOpen) { for (const s of ['trainer', 'vendor', 'inn']) if (x.services[s]) return { type: 'HUB_SERVICE', service: s }; }
  const safe = x.mapChoices.filter((c) => c.type !== 'elite' && c.type !== 'dungeon'); const pool = safe.length ? safe : x.mapChoices;
  if (pool.length) { const val = (c) => c.time * (c.perWave ? x.maxWaves : 1); return { type: 'CHOOSE_NODE', lane: [...pool].sort((a, b) => val(b) - val(a) || a.lane - b.lane)[0].lane }; }
  if (x.waves.length) return { type: 'GRIND_SET_WAVES', n: Math.max(...x.waves) };
  return null;
}
const I_USE = { any: 'both', both: 'both', out: 'out', combat: 'combat', passive: 'passive' };
/** What the UI sends on its own after a step (app.js placeNewItems): a new combat consumable onto a free item-bar slot. */
function iUiOwn(prev, next) {
  const p = next.player; if (!p || next.fight || !['ZONE_HUB', 'MAP', 'NODE', 'CAMP'].includes(next.phase)) return [];
  const had = new Set(((prev.player && prev.player.bag) || []).filter((it) => it.kind === 'cons').map((it) => it.id));
  const fresh = [];
  for (const it of p.bag) {
    if (it.kind !== 'cons' || had.has(it.id) || fresh.includes(it.id) || p.itemBar.includes(it.id)) continue;
    const c = R.C.CONSUMABLE[it.id]; const use = I_USE[c.use] || 'both';
    if (!(use === 'combat' || use === 'both') || (c.mana && R.C.CLASS[p.classId].resource !== 'mana')) continue;
    fresh.push(it.id);
  }
  const free = p.itemBar.map((id, i) => (id ? -1 : i)).filter((i) => i >= 0);
  return fresh.slice(0, free.length).map((id, k) => ({ type: 'SET_ITEM_BAR', slot: free[k], itemId: id }));
}
/**
 * True when this step put into the loot window a gear drop that heat raised one rarity: the bridge's heatSteps test (the
 * same step with the node entered in Clear rolls the same items; an item whose rarity differs was raised), limited to the
 * drops the loot window shows, since part I records raised items from the loot window.
 */
function iRaised(before, action, r) {
  const paid = before.node ? before.node.heat : null;
  if (!paid || !((R.C.HEAT_RARITY_UP || {})[paid] > 0)) return false;
  const p0 = before.player;
  const known = new Set([...(p0 ? [...(p0.bag || []), ...Object.values(p0.equipped || {})] : []), ...(before.loot || [])].filter(Boolean).map((it) => it.uid));
  const shown = new Set((r.state.loot || []).map((it) => it.uid));
  const drops = r.events.filter((e) => e.t === 'loot' && e.item && e.item.kind === 'gear' && !known.has(e.item.uid));
  if (!drops.some((e) => shown.has(e.item.uid))) return false;
  try {
    const alt = R.deserialize(R.serialize(before), before.content);
    alt.node.heat = 'clear'; if (alt.fight) alt.fight.heat = 'clear';
    const altDrops = R.step(alt, action).events.filter((e) => e.t === 'loot' && e.item && e.item.kind === 'gear' && !known.has(e.item.uid));
    return altDrops.length === drops.length && drops.some((e, i) => shown.has(e.item.uid) && e.item.rarity !== altDrops[i].item.rarity);
  } catch { return false; }
}
let I_PICK = null;
/**
 * The seed for part I, chosen at run time (the engine changes): the first Hunter seed of 1-80 whose run on the slow policy
 * (a Node run of the same choices, with the UI's own item-bar actions) meets a map step in Warm and in Hot, a node entered
 * Hot, a Grind's wave choice, the camp, the boss fight and a loot window with an item that heat raised (iRaised).
 */
function iPick() {
  if (I_PICK) return I_PICK;
  const INTRO = new Set(['quest', 'elite', 'dungeon', 'treasure']);
  for (let seed = 1; seed <= 80; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    const met = {};
    for (let n = 0; n < 6000 && s.phase !== 'ENDED'; n++) {
      const hv = R.heatView(s);
      const onMap = s.phase === 'MAP' && hv && !s.zone.camp && !(s.loot && s.loot.length);
      if (onMap && hv.next.some((c) => c.action.type === 'CHOOSE_NODE')) met[hv.state] = met[hv.state] ?? s.time;
      if (s.node && s.node.heat === 'hot' && ((INTRO.has(s.node.type) && s.fight && !(s.node.k || 0) && s.fight.round <= 1) || s.node.stage === 'grindSetup')) met.hotNode = met.hotNode ?? s.time;
      if (s.node && s.node.type === 'grind' && s.node.stage === 'grindSetup') met.grind = met.grind ?? s.time;
      if (s.phase === 'CAMP') met.camp = met.camp ?? s.time;
      if (s.fight && s.fight.boss) met.boss = met.boss ?? s.time;
      const x = { phase: s.phase, svcOpen: !!s.service, services: {}, mapChoices: [], waves: [], maxWaves: R.C.GRIND_MAX_WAVES };
      for (const sv of ['trainer', 'vendor', 'inn']) x.services[sv] = R.isLegal(s, { type: 'SERVICE', service: sv });
      if (onMap && s.zone.rows) { const row = R.mapView(s).rows[s.zone.pos.r]; x.mapChoices = hv.next.filter((c) => c.action.type === 'CHOOSE_NODE').map((c) => ({ lane: c.action.lane, time: c.time, perWave: c.perWave, type: row[c.action.lane].type })); }
      if (s.node && s.node.type === 'grind' && s.node.stage === 'grindSetup' && hv) x.waves = hv.next.filter((c) => c.action.type === 'GRIND_SET_WAVES').map((c) => c.action.n);
      const c = iSlowChoice(x);
      const act = !c ? R.autoAction(s) : c.type === 'HUB_SERVICE' ? { type: 'SERVICE', service: c.service } : c;
      const prev = s; const r = R.step(s, act); s = r.state;
      if (met.raised === undefined && iRaised(prev, act, r)) met.raised = s.time;
      for (const o of iUiOwn(prev, s)) s = R.step(s, o).state;
    }
    if (['warm', 'hot', 'hotNode', 'grind', 'camp', 'boss', 'raised'].every((k) => met[k] !== undefined)) { I_PICK = { seed, met }; return I_PICK; }
  }
  throw new Error('no Hunter seed of 1-80 meets part I\'s conditions on the slow policy');
}
let I_EXP_PICK = null;
/** The expedition seed: the first Hunter seed of 1-40 whose autoplay run meets a map step where the Dimming sets the state. */
function iExpPick() {
  if (I_EXP_PICK) return I_EXP_PICK;
  for (let seed = 1; seed <= 40; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'expedition' });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    for (let n = 0; n < 3000 && s.phase !== 'ENDED'; n++) {
      const hv = R.heatView(s);
      if (s.phase === 'MAP' && hv && hv.by === 'dim' && !(s.loot && s.loot.length)) { I_EXP_PICK = { seed, time: s.time, z: s.zone.z }; return I_EXP_PICK; }
      const prev = s; s = R.step(s, R.autoAction(s)).state;
      for (const o of iUiOwn(prev, s)) s = R.step(s, o).state;
    }
  }
  throw new Error('no Hunter seed of 1-40 meets a map step where the Dimming sets the state');
}
/**
 * The slow policy in the page (setup, as autoRun; iSlowChoice on the view). Runs until a stop condition holds (a string,
 * or { key: source } to learn which) or the run ends. On the way it records every change of the meter's state, the heat
 * toasts and log lines, the coverage of the meter in each new kind of screen, and the items the loot window marks as
 * raised by heat.
 */
const slowRun = (page, stopSrc) => page.evaluate(async ([src, choiceSrc, maxWaves, stateNames]) => {
  const ui = window.__ui;
  const conds = Object.entries(typeof src === 'string' ? { stop: src } : src).map(([k, c]) => [k, new Function('v', `return (${c})(v)`)]);
  const stop = (v) => { const hit = conds.find(([, f]) => f(v)); return hit ? hit[0] : null; };
  const rec = window.__heat || (window.__heat = { states: [], toasts: [], logs: [], kinds: {}, raised: [] });
  if (!window.__heatObs) {
    window.__heatObs = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && [...n.classList].some((c) => c.startsWith('heat-'))) rec.toasts.push({ text: n.textContent, cls: n.className }); });
    window.__heatObs.observe(document.querySelector('#toasts'), { childList: true });
    const states = new RegExp(`^(${stateNames.join('|')}): `); // the Furnace's state names (passed in: HEAT_WORDS.state)
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent && states.test(n.textContent)) rec.logs.push(n.textContent); }).observe(document.querySelector('#combatlog .lines'), { childList: true });
  }
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const kindOf = (v) => (v.phase === 'SUMMARY' ? null : v.loot ? `loot:${v.loot.kind}` : v.node && v.node.origin === 'hub' ? `service:${v.node.type}` : v.combat && !v.combat.over ? (v.combat.isBoss ? 'boss fight' : v.combat.engage ? 'engage round' : 'fight')
    : v.phase === 'NODE' && v.node ? `node:${v.node.type}:${v.node.step}` : v.phase);
  const cover = () => {
    const m = document.querySelector('#heat'); const r = m.getBoundingClientRect(); const bad = [];
    for (const [fx, fy] of [[0.5, 0.5], [0.04, 0.2], [0.96, 0.2], [0.04, 0.85], [0.96, 0.85]]) { const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!el || !el.closest('#heat')) bad.push(el ? el.id || el.className || el.tagName : 'nothing'); }
    const inside = r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    return { ok: inside && !bad.length && !m.classList.contains('hidden'), bad, rect: [r.left, r.top, r.right, r.bottom].map(Math.round) };
  };
  const choose = new Function('x', `return (${choiceSrc})(x)`);
  const slow = (v) => {
    const onMap = v.phase === 'MAP' && v.heat && v.zone.rows.length && !v.loot;
    const x = { phase: v.phase, svcOpen: !!(v.node && v.node.origin === 'hub'), services: v.legal.services || {}, mapChoices: [], waves: [], maxWaves };
    if (onMap) { const row = v.zone.rows[v.zone.pos.row]; x.mapChoices = v.heat.list.filter((c) => c.action.type === 'CHOOSE_NODE').map((c) => ({ lane: c.action.lane, time: c.time, perWave: c.perWave, type: row[c.action.lane].type })); }
    if (v.phase === 'NODE' && v.node && v.node.type === 'grind' && v.node.step === 'intro' && v.heat) x.waves = v.heat.list.filter((c) => c.action.type === 'GRIND_SET_WAVES').map((c) => c.action.n);
    return choose(x) || { type: 'AUTO' };
  };
  for (let n = 0; n < 5000; n++) {
    const v = ui.view();
    if (v.heat && rec.states[rec.states.length - 1] !== v.heat.state) rec.states.push(v.heat.state);
    const k = kindOf(v);
    if (k && !rec.kinds[k]) { await frame(); rec.kinds[k] = cover(); }
    if (v.loot && v.loot.items && v.loot.items.some((it) => it.heatUp && !rec.raised.some((x) => x.uid === it.uid))) {
      await frame();
      const rows = [...document.querySelectorAll('#screens .loot .lrow')].map((r) => ({ nm: r.querySelector('.nm') ? r.querySelector('.nm').firstChild.textContent : '', badge: !!r.querySelector('.heat-badge') }));
      for (const it of v.loot.items) if (it.heatUp && !rec.raised.some((x) => x.uid === it.uid)) rec.raised.push({ uid: it.uid, name: it.name, heatUp: it.heatUp, node: v.node ? v.node.heat : null, lootShown: !!document.querySelector('#screens .loot'), badge: rows.some((r) => r.nm.startsWith(it.name) && r.badge) });
    }
    const hit = stop(v);
    if (hit) { await frame(); return { stopped: true, key: hit, phase: v.phase, time: v.time }; }
    if (v.phase === 'SUMMARY') return { stopped: false, phase: v.phase, time: v.time };
    await ui.act(slow(v)); await ui.idle();
  }
  return { stopped: false, phase: ui.view().phase };
}, [stopSrc, iSlowChoice.toString(), R.C.GRIND_MAX_WAVES, Object.values(HEAT_WORDS.state)]);

async function partI(browser, W, H) {
  const pick = iPick(); const I_SEED = pick.seed;
  const twin = makeTwin(I_SEED);
  const { context, page, errors } = await open(browser, W, H, `seed=${I_SEED}&speed=instant`);
  check('-', `part I seed ${I_SEED} (chosen on Node runs of the slow policy: ${JSON.stringify(pick.met)})`, true, '');
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    // ---- the first hub: the meter, the first-time note, the service cards' previews
    let s = await twin.sync(page); let hv = R.heatView(s);
    const note = await page.locator('#heat-intro').evaluate((el) => ({ shown: !el.classList.contains('hidden'), text: el.textContent, role: el.getAttribute('role') }));
    await shot(page, 'I-hub');
    let d = await meterDom(page); let diff = meterDiff(d, hv, false);
    check('M2b-heat', `hub (${s.time} tolls): the meter shows R.heatView: ${HNAME[hv.state]}, "${stand(hv)}", "${bossTxt(hv.ascIfPar)}", the marker at ${hv.bar.marker} and the Star's line at 0 on a ${R.C.HEAT_BAR_MIN} to ${R.C.HEAT_BAR_MAX} toll bar`, !diff.length, diff.join(' | ') || JSON.stringify(d));
    check('M2b-heat', 'first-time note on the first hub: "Heat", the Star\'s line, what heat pays (role note, not a tooltip)', note.shown && note.role === 'note' && /Star's line/.test(note.text) && note.text.includes(payTxt(FIRST_PAYING, false)), note.text.slice(0, 160));
    const svc = [];
    for (const service of ['trainer', 'vendor', 'inn']) {
      const card = page.locator('#screens .svc-card', { has: page.locator('.nm', { hasText: { trainer: 'Trainer', vendor: 'Vendor', inn: 'Inn' }[service] }) });
      const p = R.heatPreview(s, { type: 'SERVICE', service });
      const chip = await card.locator('.hrs').evaluate((el) => ({ text: el.textContent, hs: el.dataset.hs || null }));
      const r = await hoverHeat(page, card);
      svc.push(`${service}: ${previewDiff(r, p, { chip }).join(', ') || 'ok'}`);
    }
    check('M2b-heat', 'hub: each service card\'s toll label, tooltip ("1 toll, ends Calm", what follows) and the ghost on the meter equal R.heatPreview(SERVICE)', svc.every((x) => x.endsWith('ok')), svc.join(' | '));
    await page.getByRole('button', { name: 'Got it' }).click();
    check('M2b-heat', '"Got it" closes the first-time note', await page.locator('#heat-intro').evaluate((el) => el.classList.contains('hidden')), '');
    // ---- the run on the slow policy: checkpoints in the order the run meets them (the first map step in Warm, Hot and
    // Scorched, the first node entered Hot, the first Grind)
    const grindCheck = async () => {
      s = await twin.sync(page);
      const btns = page.locator('#screens .dialog .actions button');
      const out = [];
      for (let i = 0; i < await btns.count(); i++) {
        const b = btns.nth(i); const label = (await b.innerText()).replace(NBSP, ' ');
        const n = Number((/^(\d+) wave/.exec(label) || [])[1]);
        const p = R.heatPreview(s, { type: 'GRIND_SET_WAVES', n });
        const chip = await b.locator('.bh').evaluate((x) => ({ text: x.textContent, hs: x.dataset.hs || null }));
        const r = await hoverHeat(page, b);
        out.push(`${label}: ${p ? previewDiff(r, p, { chip }).join(', ') || 'ok' : 'no preview'}`);
      }
      check('M2b-heat', `Grind (${s.time} tolls): each wave button's tolls, tooltip and the meter's ghost equal R.heatPreview(GRIND_SET_WAVES n)`, out.length > 0 && out.every((x) => x.endsWith('ok')), out.join(' | '));
    };
    const mapCheck = async (label) => {
      s = await twin.sync(page); hv = R.heatView(s);
      d = await meterDom(page); diff = meterDiff(d, hv, false);
      check('M2b-heat', `${label} (zone ${s.zone.z}, ${s.time} tolls): the meter equals R.heatView (${HNAME[hv.state]}, "${stand(hv)}", "${bossTxt(hv.ascIfPar)}", pay line "${wantPay(hv, false)}")`, !diff.length, diff.join(' | ') || `${d.state} ${d.num} ${d.boss} marker ${d.mark}`);
      const nodes = page.locator('#screens button.mnode.reach');
      const out = [];
      for (let i = 0; i < await nodes.count(); i++) {
        const el = nodes.nth(i); const lane = Number(await el.getAttribute('data-lane'));
        const p = R.heatPreview(s, { type: 'CHOOSE_NODE', lane });
        const chip = await el.locator('.mhrs').evaluate((x) => ({ text: x.textContent, hs: x.dataset.hs || null })).catch(() => null);
        const r = await hoverHeat(page, el);
        out.push(`lane ${lane} (${fh(p.time)} tolls, ${p.state}${p.change ? ', new' : ''}): ${previewDiff(r, p, { chip }).join(', ') || 'ok'}`);
      }
      const tb = page.locator('#screens .mhead button[data-travel]');
      if (!(await tb.isDisabled())) { const p = R.heatPreview(s, { type: 'TRAVEL_ON' }); const r = await hoverHeat(page, tb); out.push(`Travel on (${fh(p.time)} tolls, ${p.state}): ${previewDiff(r, p).join(', ') || 'ok'}`); }
      check('M2b-heat', `${label}: every reachable node's toll label, tooltip and the meter's ghost (and Travel on's) equal R.heatPreview`, out.length > 0 && out.every((x) => x.endsWith('ok')), out.join(' | '));
    };
    const mapIn = (st) => `(v) => v.phase === 'MAP' && v.heat && v.heat.state === '${st}' && v.heat.list.some((x) => x.action.type === 'CHOOSE_NODE')`;
    const todo = { warm: mapIn('warm'), hot: mapIn('hot'), scorched: mapIn('scorched'), hotNode: "(v) => v.phase === 'NODE' && v.node && v.node.heat === 'hot' && v.node.step === 'intro'",
      grind: "(v) => v.phase === 'NODE' && v.node && v.node.type === 'grind' && v.node.step === 'intro' && !!v.heat" };
    while (Object.keys(todo).length) {
      const r = await slowRun(page, todo);
      if (!r.stopped) break;
      delete todo[r.key];
      if (r.key === 'grind') { await grindCheck(); continue; }
      if (r.key === 'hotNode') {
        // a node entered Hot: the dialog badge and the meter's "This node pays Hot"
        s = await twin.sync(page); hv = R.heatView(s);
        d = await meterDom(page); diff = meterDiff(d, hv, false);
        const badgeTxt = await page.locator('#screens .dialog .wtitle .heat-badge').innerText().catch(() => null);
        await shot(page, 'I-node-hot');
        check('M2b-heat', `a ${s.node.type} node entered Hot: the dialog badge "${HNAME.hot} spoils" and the meter's "This node pays Hot: ${payTxt('hot', true)}" (heatView.node)`,
          !diff.length && hv.node && hv.node.state === 'hot' && (badgeTxt || '').toLowerCase().includes(`${HNAME.hot} spoils`.toLowerCase()), `${diff.join(' | ')} | badge "${badgeTxt}" | node ${JSON.stringify(hv.node)}`);
        continue;
      }
      await shot(page, `I-map-${r.key}`);
      await mapCheck(`map step in ${HNAME[r.key]}`);
      if (r.key === 'warm') {
        // windows over the map: the meter stays uncovered
        const wins = [];
        for (const w of ['character', 'bags', 'spellbook', 'talents', 'questlog', 'map', 'settings']) {
          await page.evaluate((x) => window.__ui.openWin(x), w); await page.waitForTimeout(80);
          const c = await meterCover(page); wins.push(`${w}: ${c.ok ? 'ok' : c.text}`);
          await page.evaluate(() => window.__ui.closeWins()); await page.waitForTimeout(40);
        }
        check('M2b-heat', 'with each window open over the map (character, bags, spellbook, talents, quest log, zone map, settings) the meter is in view and uncovered', wins.every((x) => x.endsWith('ok')), wins.join(' | '));
      }
    }
    const missed = Object.keys(todo).filter((k) => k !== 'scorched');
    if (missed.length) throw new Error(`setup: the slow run of seed ${I_SEED} never met ${missed.join(', ')}`);
    // ---- state changes: a toast and a log line each, in the heat colours
    let rec = await page.evaluate(() => window.__heat);
    const changes = rec.states.slice(1).map((x, i) => ({ from: rec.states[i], to: x }));
    const toastStates = rec.toasts.map((t) => (/heat-(\w+)/.exec(t.cls) || [])[1]);
    const okToasts = changes.length >= 3 && toastStates.length === changes.length && changes.every((c, i) => toastStates[i] === c.to && rec.toasts[i].text.startsWith(`${HNAME[c.to]}:`));
    check('M2b-heat', `a toast on each change of state (${changes.length} so far: ${rec.states.join(' > ')}), named and coloured by the new state`, okToasts,
      `toasts: ${rec.toasts.map((t) => t.text).join(' | ')}`);
    check('M2b-heat', 'the combat log has a line for each change of state, the toast\'s text', rec.logs.length === rec.toasts.length && rec.logs.every((l, i) => l === `${rec.toasts[i].text}.`),
      rec.logs.slice(0, 6).join(' | '));

    // ---- the camp: panel, tracker and minimap read heatView, as the meter
    const rc = await slowRun(page, "(v) => v.phase === 'CAMP' && !(v.node && v.node.origin === 'hub') && !v.combat");
    if (!rc.stopped) throw new Error(`setup: the slow run did not reach the camp (${rc.phase})`);
    await page.waitForTimeout(1500); // the zone banner fades
    s = await twin.sync(page); hv = R.heatView(s);
    d = await meterDom(page); diff = meterDiff(d, hv, true);
    const foot = (await page.locator('#screens .side .sfoot').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const track = (await page.locator('#tracker').innerText()).replace(NBSP, ' ').replace(/\n/g, ' ');
    const mm = await tipOf(page, page.locator('#minimap .disc'));
    const ascText = hv.ascIfPar > 0 ? `+${Math.round(hv.ascIfPar * 100)} % health and damage` : 'None: you are on time';
    await shot(page, 'I-camp');
    check('M2b-heat', `camp (${s.time} tolls): the meter (line = par ${fh(hv.par)}, ${HNAME[hv.state]}, "${bossTxt(hv.ascIfPar)}", "At the camp the Furnace pays nothing") equals R.heatView`, !diff.length, diff.join(' | '));
    check('M2b-heat', `camp: the panel "(par ${fh(hv.par)})" and "${ascText}", the tracker "Tolls: ... (par ${fh(hv.par)})", the minimap "${HEAT_WORDS.Name}: ${stand(hv)} ... · ${bossTxt(hv.ascIfPar)}" read heatView like the meter`,
      foot.includes(`${s.time} (par ${fh(hv.par)})`) && foot.includes(ascText) && track.includes(`${HEAT_WORDS.Units}: ${s.time} (par ${fh(hv.par)})`) && mm.includes(`${HEAT_WORDS.Name}: ${stand(hv)} (the Star's line: ${lineS(hv.line)}) · ${bossTxt(hv.ascIfPar)}`) && mm.includes(`past ${fh(hv.par)} (Ascendancy)`),
      `panel "${foot}" | tracker "${track}" | minimap "${mm}"`);
    // ---- the boss fight: the meter's "Boss +N %" is the boss frame's Ascendancy
    const rb = await slowRun(page, "(v) => !!(v.combat && v.combat.isBoss && !v.combat.over)");
    if (rb.stopped) {
      s = await twin.sync(page); hv = R.heatView(s);
      d = await meterDom(page);
      const binfo = (await page.locator('#boss-frame .binfo').innerText()).replace(NBSP, ' ');
      check('M2b-heat', `boss fight: the meter's "${bossTxt(hv.ascIfPar)}" is the boss's Ascendancy (+${Math.round(s.fight.boss.asc * 100)} %, the boss frame)`, d.boss === bossTxt(s.fight.boss.asc) && binfo.includes(`Ascendancy +${Math.round(s.fight.boss.asc * 100)} %`), `${d.boss} | ${binfo.replace(/\n/g, ' ')}`);
    } else check('M2b-heat', 'boss fight reached', false, rb.phase);

    // ---- the summary: the heat card and the Echo line
    const rs = await slowRun(page, "(v) => v.phase === 'SUMMARY'");
    await idle(page); await page.locator('#screens .summary .heatcard').waitFor({ timeout: 10000 });
    s = await twin.sync(page);
    const sm = s.result ? s.result.summary : R.summary(s);
    const card = await page.locator('#screens .summary .heatcard').evaluate((el) => ({ end: el.querySelector('.hc-end').textContent, leg: el.querySelector('.hc-leg').textContent, dots: el.querySelectorAll('.hc-chart .dot').length,
      xv: [...el.querySelectorAll('.hc-chart .xv')].map((x) => x.textContent), foot: el.querySelector('.hc-foot').textContent, strip: el.querySelector('.hc-strip').getAttribute('aria-label') }));
    const recs = sm.heat.trackPerZone; const par = R.bossPar(s); const over = sm.time - par;
    const signedH = (v) => { const k = v > 0 ? Math.floor(v + 1e-9) : Math.ceil(-v - 1e-9); return v > 0 && k ? `+${k}` : v < 0 && k ? `−${k}` : '0'; };
    const wantEnd = sm.reached && sm.reached.camp ? `${HEAT_WORDS.Units}: ${fh(sm.time)} (par ${fh(par)}) · ${over > 0 ? `${tolls(over)} over par` : over < 0 ? `${tolls(over)} under par` : 'on par'}${sm.ascendancy ? ` · Ascendancy +${Math.round(sm.ascendancy * 100)} %` : ''}` : null; // the bridge's summary.asc = R.summary ascendancy
    const timeOk = card.leg.startsWith(`${HEAT_WORDS.Units} in each state: `) && R.C.HEAT_STATES.every((st, i) => card.leg.includes(`${HNAME[st]} ${fh(sm.heat.timeByState[i])}`));
    await shot(page, 'I-summary');
    check('M2b-heat', `summary: the heat card's track has ${recs.length} zone records (${recs.length * 2} points, each zone's heat when left under it), tolls by state ${sm.heat.timeByState.join('/')} and "${wantEnd}" (time - bossPar)`,
      rs.phase === 'SUMMARY' && card.dots === recs.length * 2 && card.xv.join(',') === recs.map((r) => signedH(r.exit - r.line)).join(',') && timeOk && (!wantEnd || card.end === wantEnd),
      JSON.stringify(card));
    const echo = await page.locator('#screens .summary .card').nth(2).innerText();
    const line = sm.echoes.lines.find((l) => l.id === 'heat');
    check('M2b-heat', `summary: the Echo line of fights won in heat reads "${ECHO_LINE.heat} (${line ? line.count : 0})" with its ${line ? line.echoes : 0} Echoes (summary.echoes.lines "heat")`,
      !!line && new RegExp(`${ECHO_LINE.heat}${line.count > 1 ? ` \\(${line.count}\\)` : ''}\\s*\\+${line.echoes}\\b`).test(echo) && !/Heat \(\d+\)/.test(echo), echo.replace(/\n/g, ' / '));
    // ---- loot heat raised: badges only on items found in a node entered Hot or Scorched
    rec = await page.evaluate(() => window.__heat);
    const raisedOk = rec.raised.length > 0 && rec.raised.every((x) => x.badge && (x.heatUp === 'hot' || x.heatUp === 'scorched') && x.node === x.heatUp && R_UP_OK(x.heatUp));
    check('M2b-heat', `loot heat raised a rarity is marked "▲ Heat" (${rec.raised.length} items), only in nodes entered Hot or Scorched`, raisedOk, JSON.stringify(rec.raised.slice(0, 4)));
    // ---- coverage: the meter is in view and on top on every kind of screen met
    const kinds = Object.entries(rec.kinds);
    const need = ['ZONE_HUB', 'service:vendor', 'service:trainer', 'MAP', 'engage round', 'fight', 'loot:loot', 'CAMP', 'boss fight'];
    check('M2b-heat', `the meter is in view and uncovered on every screen of the run (${kinds.length} kinds: ${kinds.map(([k]) => k).join(', ')})`,
      need.every((k) => rec.kinds[k]) && kinds.every(([, c]) => c.ok), kinds.filter(([, c]) => !c.ok).map(([k, c]) => `${k}: ${c.bad.join(',')} ${c.rect.join(',')}`).join(' | ') || `missing: ${need.filter((k) => !rec.kinds[k]).join(', ')}`);
    check('M2b-heat', 'the meter is hidden on the summary', !(await meterDom(page)).shown, '');
  } catch (e) {
    check('-', 'part I ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part I: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partIExp(browser, W, H);
}
const R_UP_OK = (st) => (R.C.HEAT_RARITY_UP[st] || 0) > 0;

/** Part I, expedition runs (?expedition=1): the Dimming's marker and the clock that sets the state. */
async function partIExp(browser, W, H) {
  const I_EXP_SEED = iExpPick().seed;
  const twin = makeTwinOpts(I_EXP_SEED, { mapMode: 'expedition' });
  const { context, page, errors } = await open(browser, W, H, `seed=${I_EXP_SEED}&speed=instant&expedition=1`);
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    let s = await twin.sync(page); let hv = R.heatView(s);
    let d = await meterDom(page); let diff = meterDiff(d, hv, false);
    check('M2b-heat-exp', `expedition hub (mapMode ${s.mapMode}): the Dimming's marker and "Dimming: ${tolls(hv.dimIn)}"; the line sets the state (by ${hv.by})`, s.mapMode === 'expedition' && !diff.length && d.dimShown && hv.by === 'run', diff.join(' | ') || JSON.stringify(d));
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Set out' }).click(); await idle(page);
    s = await twin.sync(page);
    const mv = R.mapView(s);
    const out = [];
    for (const m of mv.moves.slice(0, 3)) {
      const el = page.locator(`#screens .expmap button.mnode.reach[data-node="${m.nodeId}"]`);
      const p = R.heatPreview(s, { type: 'MOVE', nodeId: m.nodeId });
      const r = await hoverHeat(page, el);
      out.push(`node ${m.nodeId}: ${previewDiff(r, p).join(', ') || 'ok'}`);
    }
    check('M2b-heat-exp', 'expedition map (preview): a move\'s tooltip and the ghost equal R.heatPreview(MOVE), the Dimming tolls after it included', out.length > 0 && out.every((x) => x.endsWith('ok')), out.join(' | '));
    const r = await page.evaluate(async () => {
      const ui = window.__ui;
      for (let n = 0; n < 2000; n++) { const v = ui.view(); if (v.phase === 'SUMMARY') return { ok: false }; if (v.phase === 'MAP' && v.heat && v.heat.by === 'dim') { await new Promise((q) => requestAnimationFrame(() => requestAnimationFrame(q))); return { ok: true, n }; } await ui.act({ type: 'AUTO' }); await ui.idle(); }
      return { ok: false };
    });
    if (!r.ok) throw new Error(`setup: seed ${I_EXP_SEED}'s expedition run met no map step where the Dimming sets the state`);
    s = await twin.sync(page); hv = R.heatView(s);
    d = await meterDom(page); diff = meterDiff(d, hv, false);
    await shot(page, 'I-exp-dim');
    const tip = await tipOf(page, page.locator('#heat'));
    check('M2b-heat-exp', `the Dimming sets the state (zone toll ${s.time - s.zone.start}: ${HNAME[hv.stateDim]} by the Dimming, ${HNAME[hv.stateRun]} by the line): "${HNAME[hv.state]} · Dimming", "Dimming: ${tolls(hv.dimIn)}", its marker in ${hv.stateDim} and marked as the clock that sets it`,
      !diff.length && hv.by === 'dim' && d.by === 'dim', diff.join(' | ') || JSON.stringify(d));
    check('M2b-heat-exp', 'the meter\'s tooltip names the clock that sets the state', tip.includes(`The hotter clock sets the state: now the Dimming (${HNAME[hv.stateDim]}).`), tip);
  } catch (e) {
    check('-', 'part I (expedition) ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part I (expedition): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part J: combat v2.1 display (wind-ups, stacks, Disrupt)
/**
 * Can a bar spell answer a wind-up? The UI's documented reading of the engine's spell entry (src/ui/tracks.js answerKind, a
 * stopgap until the engine says it per spell): 'stop' for an interrupt, a stun-tagged spell or one that applies HEXED or
 * FROZEN (rules 7.7: these stop it, on a dungeon boss too); 'avoid' for a defensive spell or a taunt against a heavy one.
 */
function jAnswerKind(id, x) {
  const sp = R.C.SPELL[id]; if (!sp || !x || !x.windup) return null;
  const t = sp.tags || [];
  if (t.includes('interrupt') || t.includes('stun') || sp.hex || sp.freeze) return 'stop';
  if (x.heavy && (t.includes('defensive') || sp.taunt)) return 'avoid';
  return null;
}
const J_WINDUP_FIGHTS = new Set(['elite', 'rare', 'dboss']);
/** What a wind-up's tooltip says answers it (src/ui/ui-text.js windupAnswers): an enemy that can be controlled, one immune to control. */
const J_ANSWERS = {
  control: 'Answer it with an interrupt, a stun or control on its turn, or with an engage option that covers that turn',
  immune: 'Answer it with an interrupt, a stun or a control spell on its turn (it cannot be controlled: each interrupts it), or with Disrupt in the engage round',
};
/**
 * An elite, rare or dungeon-boss round (not the engage round) whose wind-up plays now while a bar spell that stops it (an
 * interrupt or a stun, jAnswerKind 'stop') is legal on it: { idx, name, ability, heavy, spellId, slot } or null.
 */
function jStopNow(s) {
  if (!(s.fight && !s.fight.over && J_WINDUP_FIGHTS.has(s.fight.kind) && !R.isEngageRound(s))) return null;
  const legal = R.legalActions(s);
  for (const e of s.fight.enemies) {
    if (!(e.alive && e.intent && e.intent.windup && !e.intent.interrupted && !e.intent.cancelled)) continue;
    const x = e.track.find((y) => y.turn === e.turn && y.windup); if (!x) continue;
    for (const [slot, id] of s.player.bar.entries()) {
      if (id && jAnswerKind(id, x) === 'stop' && legal.some((a) => a.type === 'CAST' && a.spellId === id && (a.target === e.idx || a.target == null))) {
        return { idx: e.idx, name: e.name, ability: x.name, turn: x.turn, heavy: !!x.heavy, spellId: id, slot };
      }
    }
  }
  return null;
}
let J_BOSS = null;
/**
 * An end-boss state in phase 2 with at least two Shards alive (a Node run of the engine's autoplay choices, the first Hunter
 * seed of 1-60 that gets there), serialized for window.__ui.loadState: { seed, ser, shard (a living Shard's index) }.
 */
function jBossState() {
  if (J_BOSS) return J_BOSS;
  for (let seed = 1; seed <= 60; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    for (let n = 0; n < 6000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; n++) {
      const f = s.fight; const shards = f && !f.over && f.kind === 'boss' ? f.enemies.filter((e) => e.alive && e.kind === 'shard') : [];
      if (shards.length >= 2) { J_BOSS = { seed, ser: R.serialize(s), shard: shards[0].idx }; return J_BOSS; }
      s = R.step(s, R.autoAction(s)).state;
    }
  }
  throw new Error('no Hunter seed of 1-60 reaches the end boss with two Shards alive');
}
let J_ROGUE = null;
/**
 * The Rogue seed for part J's bar check, chosen at run time: the first Rogue seed of 1-40 whose run on the engine's
 * autoplay choices (a Node run with the UI's own item-bar actions) meets jStopNow, a wind-up playing with a bar spell that
 * stops it (Throat Jab, Temple Blow).
 */
function jPickRogue() {
  if (J_ROGUE) return J_ROGUE;
  for (let seed = 1; seed <= 40; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'rogue' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    for (let n = 0; n < 4000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; n++) {
      const w = jStopNow(s);
      if (w) { J_ROGUE = { seed, kind: s.fight.kind, ...w }; return J_ROGUE; }
      const prev = s; s = R.step(s, R.autoAction(s)).state;
      for (const o of iUiOwn(prev, s)) s = R.step(s, o).state;
    }
  }
  throw new Error('no Rogue seed of 1-40 meets a wind-up with a bar spell that stops it');
}
/** The first living enemy (immune to control or not) whose track shows a wind-up in turns 1..INTENT_TRACK_LEN, or null. */
const jFoe = (s, immune = false) => s.fight.enemies.find((e) => e.alive && !!e.ccImmune === immune && e.track.some((x) => x.windup && x.turn >= 1 && x.turn <= R.C.INTENT_TRACK_LEN)) || null;
const jRound = (e, x) => (e.turn0 || 1) + x.turn - 1;
const jStack = (e, id) => { const st = (e.st || []).find((x) => x.id === id); return st ? { id, stacks: st.stacks, value: st.value } : null; };
const jPct = (x) => `${Math.round((x || 0) * 100)} %`;
let J_PICK = null;
/**
 * The seed for part J, chosen at run time (the engine still changes): the first Hunter seed of 1-40 whose run on these
 * choices (a Node run with the UI's own item-bar actions) meets (A) an elite or rare fight whose engage round shows a
 * wind-up that Lay Trap answers, and the trap answers it; (B) a later elite, rare or dungeon-boss fight whose wind-up lands
 * while the Hunter passes; (C) a dungeon-boss fight where Lay Trap is Disrupt. Elsewhere: the engine's autoplay choices.
 */
function jPick() {
  if (J_PICK) return J_PICK;
  for (let seed = 1; seed <= 40; seed++) {
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT });
    for (const a of [{ type: 'SELECT_CLASS', classId: 'hunter' }, { type: 'SELECT_PET', petId: 'ridgewolf' }, { type: 'START_RUN' }]) s = R.step(s, a).state;
    const step = (a) => { const prev = s; const r = R.step(s, a); s = r.state; const ev = [...r.events]; for (const o of iUiOwn(prev, s)) { const r2 = R.step(s, o); s = r2.state; ev.push(...r2.events); } return ev; };
    const over = () => s.phase === 'SUMMARY' || s.phase === 'ENDED';
    const until = (pred) => { for (let n = 0; n < 3000 && !over(); n++) { if (pred()) return true; step(R.autoAction(s)); } return false; };
    const inFight = () => !!(s.fight && !s.fight.over);
    // (A) Lay Trap answers an elite's wind-up
    if (!until(() => s.fight && R.isEngageRound(s) && (s.fight.kind === 'elite' || s.fight.kind === 'rare') && jFoe(s))) continue;
    const a = jFoe(s); const kindA = s.fight.kind;
    const pvA = R.engagePreview(s, { type: 'ENGAGE', option: 'lay_trap', target: a.idx });
    if (!pvA || !(pvA.enemies.find((q) => q.u === a.idx) || { stagger: [] }).stagger.length) continue;
    let staggered = step({ type: 'ENGAGE', option: 'lay_trap', target: a.idx }).some((e) => e.t === 'stagger' && e.u === a.idx);
    for (let n = 0; n < 300 && inFight(); n++) if (step(R.autoAction(s)).some((e) => e.t === 'stagger' && e.u === a.idx)) staggered = true;
    if (!staggered || over()) continue;
    // (B) a wind-up lands while the Hunter passes
    if (!until(() => s.fight && R.isEngageRound(s) && J_WINDUP_FIGHTS.has(s.fight.kind) && (jFoe(s) || jFoe(s, true)))) continue;
    const kindB = s.fight.kind; let landed = false;
    for (let n = 0; n < 6 && inFight() && !landed; n++) if (step({ type: 'PASS' }).some((e) => e.t === 'empower')) landed = true;
    if (!landed) continue;
    for (let n = 0; n < 300 && inFight(); n++) step(R.autoAction(s));
    if (over()) continue;
    // (C) Disrupt on a dungeon boss
    if (!until(() => s.fight && R.isEngageRound(s) && s.fight.kind === 'dboss')) continue;
    const boss = s.fight.enemies.find((e) => e.alive && e.ccImmune);
    const ctl = (R.engageOptions(s) || []).find((o) => o.id === 'lay_trap');
    if (!boss || !ctl || !ctl.disrupt.includes(boss.idx)) continue;
    J_PICK = { seed, a: `${kindA} ${a.name}`, b: kindB, c: boss.name };
    return J_PICK;
  }
  throw new Error('no Hunter seed of 1-40 meets part J\'s conditions');
}
/** The combat v2.1 display on the page: wind-up chips, rows, lines over enemies, stack badges, the ruler, the bar, the engage cards. */
const j21dom = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  const wst = (root) => [...root.querySelectorAll('.wstk .wst')].map((b) => ({ id: b.dataset.id, stacks: Number(b.dataset.stacks), value: Number(b.dataset.value), text: b.textContent }));
  const tf = document.querySelector('#target-frame');
  return {
    np: [...document.querySelectorAll('#nameplates .np')].filter((el) => !el.classList.contains('dead')).map((el) => {
      const wub = el.querySelector('.wub');
      return { idx: Number(el.dataset.idx), chips: [...el.querySelectorAll('.trk .tk')].map((c) => ({ turn: Number(c.dataset.turn), windup: c.dataset.windup || '', ribbon: (c.querySelector('.b-wu') || {}).textContent || '' })),
        wub: vis(wub) ? { text: wub.textContent, turn: Number(wub.dataset.turn), state: wub.dataset.state } : null, wst: wst(el) };
    }),
    rows: vis(tf) ? [...tf.querySelectorAll('.ttrack .tr')].map((r) => ({ turn: Number(r.dataset.turn), windup: r.dataset.windup || '' })) : [],
    twst: vis(tf) ? wst(tf) : [],
    ruler: vis(document.querySelector('#ruler')) ? [...document.querySelectorAll('#ruler .rl-c')].map((c) => ({ round: Number(c.dataset.round), wu: (c.querySelector('.rl-wu') || {}).textContent || '' })) : [],
    bar: [...document.querySelectorAll('#actionbar .ab[data-slot]')].map((b) => ({ slot: Number(b.dataset.slot), ans: b.classList.contains('wu-ans'), else: b.classList.contains('wu-else'), avoid: b.classList.contains('wu-avoid'), hl: b.classList.contains('wu-hl'),
      tag: (b.querySelector('.atag') || {}).textContent || '', wtag: !!b.querySelector('.wtag') })),
    cards: [...document.querySelectorAll('#engage .eg-opt[data-opt]')].map((c) => ({ opt: c.dataset.opt, disrupt: c.dataset.disrupt === '1', answers: c.dataset.answers || '', off: c.classList.contains('off'),
      name: (c.querySelector('.eg-name') || {}).textContent || '', was: (c.querySelector('.eg-was') || {}).textContent || '', tg: (c.querySelector('.eg-tg') || {}).textContent || '' })),
    engage: vis(document.querySelector('#engage')),
  };
});
/** The wind-up badges follow the engine: a chip and a target-frame row carry one exactly for the entries the engine flags `windup`. */
function jBadgesMatch(d, s, target) {
  const bad = [];
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const np = d.np.find((x) => x.idx === e.idx); if (!np) { bad.push(`no nameplate for ${e.idx}`); continue; }
    const want = e.track.map((x) => `${x.turn}:${x.windup ? 1 : 0}`).join(' '); const saw = np.chips.map((c) => `${c.turn}:${c.windup ? 1 : 0}`).join(' ');
    if (want !== saw) bad.push(`${e.name} chips ${saw} vs engine ${want}`);
    // a now-entry replaced for another reason than SILENCED is neither answered nor landed: no line for it (tracks.js)
    const voidNow = (x) => e.turn >= 1 && x.turn === e.turn && e.intent && e.intent.replaced && !e.intent.cancelled && e.intent.replaced.reason !== 'silenced';
    const first = e.track.find((x) => x.windup && !voidNow(x));
    if (!!np.wub !== !!first) bad.push(`${e.name}: wind-up line ${np.wub ? 'shown' : 'hidden'}, engine ${first ? `wind-up on turn ${first.turn}` : 'none'}`);
  }
  const t = s.fight.enemies[target];
  if (t && t.alive && d.rows.length && d.rows.map((r) => `${r.turn}:${r.windup ? 1 : 0}`).join(' ') !== t.track.map((x) => `${x.turn}:${x.windup ? 1 : 0}`).join(' ')) bad.push(`target frame rows ${JSON.stringify(d.rows)}`);
  return bad;
}
/** EMPOWERED and STAGGERED badges = the engine's statuses ({ stacks, value }) on every living enemy and on the target frame. */
function jStacksMatch(d, s, target) {
  const bad = [];
  const want = (e) => ['EMPOWERED', 'STAGGERED'].map((id) => jStack(e, id)).filter(Boolean);
  const same = (page, w) => page.length === w.length && w.every((x) => page.some((p) => p.id === x.id && p.stacks === x.stacks && Math.abs(p.value - x.value) < 1e-9 && p.text.includes(`${x.id === 'EMPOWERED' ? '+' : '−'}${jPct(x.value)} dmg`)));
  for (const e of s.fight.enemies.filter((x) => x.alive)) {
    const np = d.np.find((x) => x.idx === e.idx); if (!np) continue;
    if (!same(np.wst, want(e))) bad.push(`${e.name}: page ${JSON.stringify(np.wst)} vs engine ${JSON.stringify(want(e))}`);
  }
  const t = s.fight.enemies[target];
  if (t && t.alive && !same(d.twst, want(t))) bad.push(`target frame ${JSON.stringify(d.twst)} vs engine ${JSON.stringify(want(t))}`);
  return bad;
}
/** The bar marks what answers a wind-up playing this round, as the engine's state says (its intent, legality, the spell entries). */
function jBarMatch(d, s, target) {
  const bad = [];
  const now = s.fight.enemies.filter((e) => e.alive && e.intent && e.intent.windup && !e.intent.interrupted && !e.intent.cancelled)
    .map((e) => ({ e, x: e.track.find((x) => x.turn === e.turn && x.windup) || { windup: true, heavy: !!e.intent.heavy } }));
  const legal = R.legalActions(s);
  s.player.bar.forEach((id, slot) => {
    if (!id) return;
    const b = d.bar.find((x) => x.slot === slot); const sp = R.C.SPELL[id];
    const kinds = now.map((w) => ({ w, k: jAnswerKind(id, w.x) })).filter((z) => z.k);
    const ok = legal.some((a) => a.type === 'CAST' && a.spellId === id) && kinds.length > 0;
    const onTgt = kinds.some((z) => z.k === 'avoid' || sp.target !== 'enemy' || z.w.e.idx === target);
    const stop = ok && kinds.some((z) => z.k === 'stop');
    const want = { ans: stop && onTgt, else: stop && !onTgt, avoid: ok && !stop };
    if (b.ans !== want.ans || b.else !== want.else || b.avoid !== want.avoid) bad.push(`${id}: page ${JSON.stringify({ ans: b.ans, else: b.else, avoid: b.avoid })} vs ${JSON.stringify(want)}`);
  });
  return bad;
}
/** Each engage card's "answers the wind-up" = R.engagePreview on its target: cancelled wind-ups, and Send the Pet's heavy ones. */
function jCardsMatch(d, s, target) {
  const bad = [];
  for (const o of R.engageOptions(s) || []) {
    if (o.spells) continue;
    const c = d.cards.find((x) => x.opt === o.id); if (!c) { bad.push(`no card ${o.id}`); continue; }
    const none = o.targets.length === 1 && o.targets[0] === null;
    const t = none ? null : o.targets.includes(target) ? target : o.targets[0];
    let want = [];
    if (!o.reason && (none || t != null)) {
      const pv = R.engagePreview(s, { type: 'ENGAGE', option: o.id, target: t });
      for (const q of (pv && pv.enemies) || []) {
        const e = s.fight.enemies[q.u];
        for (const x of e.track) if (x.windup && (q.stagger.includes(x.turn) || (x.heavy && q.pet.includes(x.turn)))) want.push({ k: `${e.idx}:${x.turn}`, r: jRound(e, x) });
      }
      want = want.sort((a, b) => a.r - b.r);
    }
    if (c.answers !== want.map((w) => w.k).join(' ')) bad.push(`${o.id}: page answers "${c.answers}" vs engine "${want.map((w) => w.k).join(' ')}"`);
    const dis = !o.reason && t != null && o.targets.includes(target) && o.disrupt.includes(target);
    if (c.disrupt !== dis || (dis && (c.name !== 'Disrupt' || c.was !== o.name)) || (!dis && c.name !== o.name)) bad.push(`${o.id}: page ${c.disrupt ? 'Disrupt' : 'no Disrupt'} "${c.name}" (${c.was}) vs engine disrupt ${JSON.stringify(o.disrupt)} on ${target}`);
    if (c.off !== !!o.reason || (o.reason && c.tg !== `${o.reason[0].toUpperCase()}${o.reason.slice(1)}`)) bad.push(`${o.id}: page off ${c.off} "${c.tg}" vs engine reason ${JSON.stringify(o.reason)}`);
  }
  return bad;
}
/** Toasts on screen: their text and box, and the boxes of the panels they must not cover. */
const jToasts = (page) => page.evaluate(() => {
  const box = (el) => { if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') return null; const r = el.getBoundingClientRect(); return r.width ? [r.left, r.top, r.right, r.bottom] : null; };
  return { toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => ({ text: t.textContent, box: box(t) })),
    panels: [['map', '#screens .mapwin'], ['player frame', '#player-frame'], ['pet frame', '#pet-frame'], ['target frame', '#target-frame'], ['ruler', '#ruler'], ['engage panel', '#engage'], ['boss frame', '#boss-frame'],
      ['combat log', '#combatlog'], ['heat meter', '#heat'], ...[...document.querySelectorAll('#nameplates .np:not(.dead)')].map((el, i) => [`nameplate ${i}`, el])]
      .map(([n, sel]) => [n, box(typeof sel === 'string' ? document.querySelector(sel) : sel)]).filter(([, b]) => b) };
});
const jOverlaps = (t) => t.toasts.flatMap((x) => t.panels.filter(([, b]) => x.box && x.box[0] < b[2] && x.box[2] > b[0] && x.box[1] < b[3] && x.box[3] > b[1]).map(([n]) => `"${x.text}" over the ${n}`));
/** A burst of messages: the same refused action three times and two others; the UI's toasts are its answer. */
const jBurst = (page) => page.evaluate(() => { for (const t of ['NOPE', 'NOPE', 'NOPE', 'NOPE_TWO', 'NOPE_THREE']) window.__ui.act({ type: t }); });

async function partJ(browser, W, H) {
  const pick = jPick(); const SEED = pick.seed;
  const twin = makeTwin(SEED);
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  check('-', `part J seed ${SEED} (chosen on Node runs: Lay Trap answers the ${pick.a}'s wind-up, a wind-up lands in a ${pick.b} fight, Disrupt on ${pick.c})`, true, '');
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const nowBad = []; let nowSeen = 0; let barSeen = 0;
  /** AUTO until pred(twin state) holds with the fight on screen. */
  const until = async (pred, label) => {
    for (let n = 0; n < 2500; n++) {
      const s = await twin.sync(page); const v = await view(page);
      if (v.phase === 'SUMMARY') throw new Error(`the run ended before ${label}`);
      if (pred(s) && v.step === 'combat' && v.round) { await frame(); return s; }
      await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
    }
    throw new Error(`no ${label} within 2500 steps`);
  };
  /**
   * One combat action: a key, or 'AUTO' (the engine's autoplay choice, as the Node pick); returns { s } (the twin after it).
   * After it the bar's wind-up marks are checked against the engine's state (none in a round without a wind-up playing).
   */
  const press = async (key) => {
    if (key === 'AUTO') await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); else await page.keyboard.press(key);
    await idle(page); await page.mouse.move(2, 2); await frame();
    const s = await twin.sync(page);
    if (s.fight && !s.fight.over) {
      const d = await j21dom(page); const tgt = await page.evaluate(() => window.__ui.target());
      barSeen++; if (s.fight.enemies.some((e) => e.alive && e.intent && e.intent.windup)) nowSeen++;
      nowBad.push(...jBarMatch(d, s, tgt));
    }
    return { s };
  };
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page); await page.mouse.move(2, 2);
    // ---- stacked toasts on the map: merged and at most two at once, clear of the zone map
    for (let n = 0; n < 60; n++) { const v = await view(page); if (v.phase === 'MAP' && !(await page.evaluate(() => !!window.__ui.view().loot))) break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
    await frame();
    await jBurst(page); await page.waitForTimeout(250);
    const tm = await jToasts(page);
    await shot(page, 'J-toasts-map');
    const merged = tm.toasts.find((t) => /NOPE" ×3$/.test(t.text));
    check('M2b-2b.6', `stacked toasts on the map merge and queue: the same message three times is one toast "×3", at most 2 show at once, none over the zone map, a unit frame, the log or the heat meter`,
      tm.toasts.length <= 2 && !!merged && !jOverlaps(tm).length && tm.panels.some(([n]) => n === 'map'), `${JSON.stringify(tm.toasts.map((t) => t.text))}; ${jOverlaps(tm).join(', ')}`);
    await page.waitForTimeout(2900);
    const tq = await jToasts(page);
    check('M2b-2b.6', 'a queued toast shows when one leaves (NOPE_THREE after the first two)', tq.toasts.some((t) => t.text.includes('NOPE_THREE')), JSON.stringify(tq.toasts.map((t) => t.text)));
    await page.waitForTimeout(2900);

    // ---- (A) an elite's wind-up, from the engage round: badges, the line over it, the ruler, the tooltip, the engage cards
    let s = await until((x) => x.fight && R.isEngageRound(x) && (x.fight.kind === 'elite' || x.fight.kind === 'rare') && jFoe(x), 'an elite fight with a wind-up');
    const a = jFoe(s); const wx = a.track.find((x) => x.windup); const wRound = jRound(a, wx);
    await page.locator(`#nameplates .np[data-idx="${a.idx}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    let d = await j21dom(page);
    await shot(page, 'J-windup-engage');
    let bad = jBadgesMatch(d, s, a.idx);
    const line = d.np.find((x) => x.idx === a.idx).wub;
    check('M2b-2b.6', `engage round of the ${s.fight.kind} fight: the wind-up badge is on exactly the entries the engine flags (chips, target frame), and over ${a.name}: "Wind-up R${wRound}: answer it or it empowers"`,
      !bad.length && line && line.turn === wx.turn && line.text.includes(`Wind-up R${wRound}`) && line.text.includes('answer it or it empowers'), `${bad.join(' | ')}; line ${JSON.stringify(line)}`);
    const col = d.ruler.find((c) => c.round === wRound);
    check('M2b-2b.6', `the opening ruler marks round ${wRound} "Wind-up"`, wRound > 5 || (col && col.wu === 'Wind-up'), JSON.stringify(d.ruler));
    bad = jCardsMatch(d, s, a.idx);
    check('M2b-2b.6', 'each engage card says which wind-ups it answers exactly as R.engagePreview does (stagger, Send the Pet on a heavy one) on its target', !bad.length, bad.join(' | ') || JSON.stringify(d.cards.map((c) => [c.opt, c.answers])));
    // hover the wind-up chip: the tooltip says what answers it; the bar marks every spell that can
    await page.locator(`#nameplates .np[data-idx="${a.idx}"] .trk .tk[data-turn="${wx.turn}"]`).hover(); await page.waitForTimeout(200); await frame();
    const tip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    const hv = await page.evaluate(() => window.__ui.windupHover());
    d = await j21dom(page);
    const wantHl = s.player.bar.map((id, slot) => (id && jAnswerKind(id, wx) ? slot : null)).filter((x) => x !== null);
    const sawHl = d.bar.filter((b) => b.hl).map((b) => b.slot);
    await shot(page, 'J-windup-tooltip');
    check('M2b-2b.6', `hovering the wind-up: its tooltip gives the round, the stakes (−${jPct(R.C.STAGGER_DMG)} / +${jPct(R.C.EMPOWER_DMG)}) and what answers it${wx.heavy ? ' (heavy: a full dodge, a ward or the pet too)' : ''}; the bar marks the spells that can (slots ${wantHl.join(',') || 'none'})`,
      tip.includes(`Wind-up, round ${wRound}`) && tip.includes(`−${jPct(R.C.STAGGER_DMG)}`) && tip.includes(`+${jPct(R.C.EMPOWER_DMG)}`) && tip.includes(J_ANSWERS.control) && !tip.includes('Disrupt') && tip.includes('full dodge') === !!wx.heavy
        && hv && hv.idx === a.idx && hv.turn === wx.turn && sawHl.join(',') === wantHl.join(','), `hover ${JSON.stringify(hv)}; bar ${sawHl.join(',')}; tooltip: ${tip.replace(/\n/g, ' / ')}`);
    await page.mouse.move(2, 2);
    // W: Lay Trap on it; then the engine's autoplay choices: the trap answers it, STAGGERED as the engine has it
    let r = await press('KeyW');
    const sent = (await page.evaluate(() => window.__ui.engineLog())).slice(-1)[0];
    d = await j21dom(page);
    const pred = (r.s.fight.enemies[a.idx].track.find((x) => x.turn === wx.turn) || {}).cancel;
    check('M2b-2b.6', `key W sends Lay Trap on ${a.name}; the engine predicts its wind-up answered (cancel.stagger) and the page says so (ANSWERED, "your trap answers it")`,
      sent.type === 'ENGAGE' && sent.option === 'lay_trap' && sent.target === a.idx && pred && pred.stagger && (d.np.find((x) => x.idx === a.idx).chips.find((c) => c.turn === wx.turn) || {}).windup === 'answered'
        && (d.np.find((x) => x.idx === a.idx).wub || { text: '' }).text.includes('your trap'), `${JSON.stringify(sent)}; cancel ${JSON.stringify(pred)}; ${JSON.stringify(d.np.find((x) => x.idx === a.idx))}`);
    let answered = null;
    for (let n = 0; n < 60 && r.s.fight && !r.s.fight.over && !answered; n++) {
      r = await press('AUTO'); // the engine's autoplay choices, as in the Node pick
      const st = r.s.fight && r.s.fight.enemies[a.idx] && jStack(r.s.fight.enemies[a.idx], 'STAGGERED');
      if (st) answered = { s: r.s, d: await j21dom(page), tgt: await page.evaluate(() => window.__ui.target()), log: await logLines(page) };
    }
    if (answered) {
      await shot(page, 'J-answered');
      bad = jStacksMatch(answered.d, answered.s, answered.tgt);
      const logOk = answered.log.some((l) => l.startsWith(`Wind-up answered: ${a.name}'s ${wx.name}`) && l.includes(`Staggered: −${jPct(R.C.STAGGER_DMG)} damage`));
      check('M2b-2b.6', `answered: the STAGGERED badge on ${a.name} (nameplate and target frame) equals the engine's status, and the log says "Wind-up answered"`, !bad.length && logOk, `${bad.join(' | ')}; log ${answered.log.slice(-4).join(' / ')}`);
    } else check('M2b-2b.6', `the trap answers ${a.name}'s wind-up`, false, 'no STAGGERED status');
    for (let n = 0; n < 300 && twin.s.fight && !twin.s.fight.over; n++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); await twin.sync(page); }

    // ---- (B) a wind-up lands while the Hunter passes: EMPOWERED as the engine has it
    s = await until((x) => x.fight && R.isEngageRound(x) && J_WINDUP_FIGHTS.has(x.fight.kind) && (jFoe(x) || jFoe(x, true)), 'a second fight with a wind-up');
    let landed = null;
    for (let n = 0; n < 6 && !landed; n++) {
      r = await press('KeyX');
      const e = r.s.fight && r.s.fight.enemies.find((x) => x.alive && jStack(x, 'EMPOWERED'));
      if (e) landed = { s: r.s, e, d: await j21dom(page), tgt: await page.evaluate(() => window.__ui.target()), log: await logLines(page) };
    }
    if (landed) {
      await shot(page, 'J-landed');
      bad = jStacksMatch(landed.d, landed.s, landed.tgt);
      check('M2b-2b.6', `landed: the EMPOWERED badge on ${landed.e.name} equals the engine's status (+${jPct(jStack(landed.e, 'EMPOWERED').value)} dmg) and the log says "Wind-up landed"`,
        !bad.length && landed.log.some((l) => l.startsWith(`Wind-up landed: ${landed.e.name}'s`) && l.includes(`Empowered: +${jPct(R.C.EMPOWER_DMG)} damage`)), `${bad.join(' | ')}; log ${landed.log.slice(-4).join(' / ')}`);
    } else check('M2b-2b.6', 'a wind-up lands while the Hunter passes', false, 'no EMPOWERED status');
    for (let n = 0; n < 300 && twin.s.fight && !twin.s.fight.over; n++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); await twin.sync(page); }

    // ---- (C) a dungeon boss: the control option is Disrupt, as R.engageOptions says
    s = await until((x) => x.fight && R.isEngageRound(x) && x.fight.kind === 'dboss', 'a dungeon-boss fight');
    const boss = s.fight.enemies.find((e) => e.alive && e.ccImmune);
    await page.locator(`#nameplates .np[data-idx="${boss.idx}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    d = await j21dom(page);
    await shot(page, 'J-disrupt');
    bad = [...jCardsMatch(d, s, boss.idx), ...jBadgesMatch(d, s, boss.idx)];
    const ctlOpt = R.engageOptions(s).find((o) => o.id === 'lay_trap');
    check('M2b-2b.6', `dungeon boss ${boss.name}: Lay Trap shows as "Disrupt" exactly where R.engageOptions lists it (disrupt ${JSON.stringify(ctlOpt.disrupt)}), enabled, with the wind-up it answers`,
      !bad.length && d.cards.some((c) => c.opt === 'lay_trap' && c.disrupt && !c.off), bad.join(' | ') || JSON.stringify(d.cards));
    // the boss's wind-up tooltip: an enemy immune to control is answered by an interrupt, a stun or control spell, or Disrupt
    const bx = boss.track.find((x) => x.windup);
    await page.locator(`#nameplates .np[data-idx="${boss.idx}"] .trk .tk[data-turn="${bx.turn}"]`).hover(); await page.waitForTimeout(200);
    const btip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    check('M2b-2b.6', `the dungeon boss's wind-up tooltip says what answers it on an enemy immune to control ("${J_ANSWERS.immune.slice(0, 60)}...")`, btip.includes(J_ANSWERS.immune), btip.replace(/\n/g, ' / '));
    await page.mouse.move(2, 2); await frame();
    const bossTrack = JSON.parse(R.serialize(s)); // the state of this engage round, for the greyed-out check below
    r = await press('KeyW');
    const dx = boss.track.find((x) => x.windup);
    const log1 = await logLines(page);
    check('M2b-2b.6', `key W sends Disrupt; the log names the wind-up it will stop ("Disrupt (Lay Trap): ${boss.name} will miss ${dx.name} in round ${jRound(boss, dx)}")`,
      log1.some((l) => l === `Disrupt (Lay Trap): ${boss.name} will miss ${dx.name} in round ${jRound(boss, dx)}.`), log1.slice(-3).join(' / '));
    answered = null;
    for (let n = 0; n < 8 && r.s.fight && !r.s.fight.over && !answered; n++) {
      r = await press('KeyA');
      if (r.s.fight && r.s.fight.enemies[boss.idx] && jStack(r.s.fight.enemies[boss.idx], 'STAGGERED')) answered = { s: r.s, d: await j21dom(page), tgt: await page.evaluate(() => window.__ui.target()), log: await logLines(page) };
    }
    if (answered) {
      await shot(page, 'J-disrupt-answered');
      bad = jStacksMatch(answered.d, answered.s, answered.tgt);
      check('M2b-2b.6', 'Disrupt answers the boss\'s wind-up: its STAGGERED badge equals the engine\'s status and the log says "cancelled by your Disrupt"',
        !bad.length && answered.log.some((l) => l.startsWith(`Wind-up answered: ${boss.name}'s ${dx.name} is cancelled by your Disrupt`)), `${bad.join(' | ')}; ${answered.log.slice(-3).join(' / ')}`);
    } else check('M2b-2b.6', 'Disrupt answers the boss\'s wind-up', false, 'no STAGGERED status');
    check('M2b-2b.6', `in every round met (${barSeen}, ${nowSeen} with a wind-up playing), the bar marked exactly the usable spells that can answer one now (none without)`, barSeen > 0 && !nowBad.length, nowBad.slice(0, 4).join(' | '));

    // ---- Disrupt greyed out with the engine's reason: the same engage round with no wind-up in view (a state the real
    // content never reaches: every dungeon boss shows its turn-2 wind-up; loaded through the test hook)
    for (const e of bossTrack.fight.enemies) if (e.ccImmune) for (const x of e.track) delete x.windup;
    const grey = R.deserialize(JSON.stringify(bossTrack), CONTENT);
    const loaded = await page.evaluate((str) => window.__ui.loadState(str), JSON.stringify(bossTrack));
    await idle(page); await page.mouse.move(2, 2); await frame();
    d = await j21dom(page);
    await shot(page, 'J-disrupt-grey');
    const gOpt = R.engageOptions(grey).find((o) => o.id === 'lay_trap');
    bad = [...jCardsMatch(d, grey, boss.idx), ...jBadgesMatch(d, grey, boss.idx)];
    check('M2b-2b.6', `no wind-up in view: Lay Trap is greyed out with the engine's reason ("${gOpt.reason}"), not Disrupt; no wind-up badge`, loaded && !bad.length && d.cards.some((c) => c.opt === 'lay_trap' && c.off && !c.disrupt), bad.join(' | ') || JSON.stringify(d.cards));
    // ---- stacked toasts in a fight: merged, at most two, clear of the target frame, the ruler, the engage panel and nameplates
    await jBurst(page); await page.waitForTimeout(250);
    const tf = await jToasts(page);
    await shot(page, 'J-toasts-fight');
    check('M2b-2b.6', 'stacked toasts in a fight merge, at most 2 show at once, and none covers a unit frame, the ruler, the engage panel, a nameplate, the log or the heat meter',
      tf.toasts.length <= 2 && tf.toasts.some((t) => /NOPE" ×3$/.test(t.text)) && !jOverlaps(tf).length, `${JSON.stringify(tf.toasts.map((t) => t.text))}; ${jOverlaps(tf).join(', ')}`);
    // ---- the end-boss fight (phase 2, two Shards, a Shard targeted: its frame sits under the boss frame), loaded: the
    // toasts go between the target frame and the boss's nameplate, under the boss frame
    const bs = jBossState();
    await page.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 12000 });
    const bLoaded = await page.evaluate((str) => window.__ui.loadState(str), bs.ser);
    await idle(page); await frame();
    await page.locator(`#nameplates .np[data-idx="${bs.shard}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    await jBurst(page); await page.waitForTimeout(250);
    const tb = await jToasts(page);
    await shot(page, 'J-toasts-boss');
    check('M2b-2b.6', `stacked toasts in the end-boss fight (seed ${bs.seed}, phase 2 with Shards, a Shard targeted) merge, at most 2 show, and none covers the boss frame, a unit frame, a nameplate, the log or the heat meter`,
      bLoaded && tb.toasts.length <= 2 && tb.toasts.some((t) => /NOPE" ×3$/.test(t.text)) && tb.panels.some(([n]) => n === 'boss frame') && tb.panels.some(([n]) => n === 'target frame') && !jOverlaps(tb).length,
      `${JSON.stringify(tb.toasts.map((t) => t.text))}; ${jOverlaps(tb).join(', ')}`);
  } catch (e) {
    check('-', 'part J ran to the end', false, e.message.split('\n')[0]);
  }
  check('-', 'part J: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partJRogue(browser, W, H);
}

/**
 * Part J, Rogue (jPickRogue): a wind-up plays this round and a bar spell can stop it. The bar marks exactly the spells the
 * engine's state allows ("Answer"), hovering the wind-up marks every bar spell that can answer it, the spell's tooltip names
 * the wind-up, and its key stops it: the log's "is stopped by your ..." and STAGGERED = the engine's status.
 */
async function partJRogue(browser, W, H) {
  const pick = jPickRogue(); const SEED = pick.seed;
  const twin = makeTwin(SEED);
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  const spName = R.C.SPELL[pick.spellId].name;
  check('-', `part J (Rogue) seed ${SEED} (chosen on Node runs: ${pick.name}'s ${pick.ability} in a ${pick.kind} fight, ${spName} on the bar can stop it)`, true, '');
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  try {
    await page.locator('#create .ccard[data-cls="rogue"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page); await page.mouse.move(2, 2);
    let s = null;
    for (let n = 0; n < 2500 && !s; n++) {
      const t = await twin.sync(page); const v = await view(page);
      if (v.phase === 'SUMMARY') throw new Error('the run ended before the wind-up');
      if (jStopNow(t) && v.step === 'combat' && v.round) { s = t; break; }
      await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
    }
    if (!s) throw new Error('no wind-up with an answer on the bar within 2500 steps');
    const w = jStopNow(s);
    await page.locator(`#nameplates .np[data-idx="${w.idx}"]`).click(); await idle(page); await page.mouse.move(2, 2); await frame();
    let d = await j21dom(page); const tgt = await page.evaluate(() => window.__ui.target());
    let bad = jBarMatch(d, s, tgt);
    const b = d.bar.find((x) => x.slot === w.slot);
    await shot(page, 'J-rogue-answer');
    check('M2b-2b.6', `a wind-up plays this round (${w.name}'s ${w.ability}): the bar marks exactly the usable spells that can stop it, ${spName} (key ${w.slot + 1}) tagged "Answer"`,
      tgt === w.idx && !bad.length && !!b && b.ans && b.tag.startsWith('Answer') && !b.wtag, `${bad.join(' | ')}; target ${tgt}; slot ${JSON.stringify(b)}`);
    // UX pass 2026-11-11: the turn prompt over the action bar names the answer and its key; the bar is framed as your turn
    const tp = await page.evaluate(() => { const el = document.querySelector('#turnprompt'); const r = el.getBoundingClientRect(); const bar = document.querySelector('#actionbar');
      const c = (x, y) => { const e = document.elementFromPoint(x, y); return e ? e.closest('#actionbar .ab, #actionbar .ctrl') : null; };
      return { shown: !el.classList.contains('hidden'), kind: el.dataset.kind, text: el.textContent.replace(/\s+/g, ' ').trim(), turn: bar.classList.contains('your-turn'),
        inView: r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0, overBar: [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5]].some(([fx, fy]) => c(r.left + r.width * fx, r.top + r.height * fy)) }; });
    check('UX-1', `turn prompt on the wind-up round: "Wind-up now: answer with ${w.slot + 1} ${spName}", the bar framed as your turn, in view and covering no bar button`,
      tp.shown && tp.kind === 'windup' && tp.text.includes(`Wind-up now: answer with ${w.slot + 1} ${spName}`) && tp.turn && tp.inView && !tp.overBar, JSON.stringify(tp));
    // hovering the wind-up's chip marks every bar spell that can answer it (stop or, for a heavy one, avoid)
    await page.locator(`#nameplates .np[data-idx="${w.idx}"] .trk .tk[data-turn="${w.turn}"]`).hover(); await page.waitForTimeout(200); await frame();
    d = await j21dom(page);
    const x = s.fight.enemies[w.idx].track.find((y) => y.turn === w.turn);
    const wantHl = s.player.bar.map((id, slot) => (id && jAnswerKind(id, x) ? slot : null)).filter((q) => q !== null);
    const sawHl = d.bar.filter((q) => q.hl).map((q) => q.slot);
    check('M2b-2b.6', `hovering the wind-up marks every bar spell that can answer it (keys ${wantHl.map((q) => q + 1).join(', ')})`, wantHl.includes(w.slot) && sawHl.join(',') === wantHl.join(','), `saw ${sawHl.map((q) => q + 1).join(', ') || 'none'}`);
    await page.mouse.move(2, 2); await frame();
    // the spell's tooltip names the wind-up it can stop
    await page.locator(`#actionbar .ab[data-slot="${w.slot}"]`).hover(); await page.waitForTimeout(200);
    const tip = (await page.getByRole('tooltip').innerText()).replace(NBSP, ' ');
    check('M2b-2b.6', `${spName}'s tooltip names the wind-up it can stop this round`, tip.includes(`Wind-up this round: ${w.name}'s ${w.ability}. This can stop it`), tip.replace(/\n/g, ' / '));
    await page.mouse.move(2, 2); await frame();
    // its key stops it, played at the default speed (D47): the moment on screen, the round within its cap; then answered by
    // the interrupt, STAGGERED = the engine's status, the log line
    await setSpeed(page, '1×'); await page.mouse.move(2, 2); await frame();
    const k0 = await page.evaluate(() => performance.now()); // plays() keeps the last 200 steps: find the round by its input time
    await page.keyboard.press(`Digit${w.slot + 1}`);
    const atMoment = await page.waitForFunction(() => { const e = window.__ui.playingEvent(); return !!(e && e.t === 'windup'); }, null, { timeout: 6000, polling: 'raf' }).then(() => true, () => false);
    const tpDuring = atMoment ? await page.evaluate(() => document.querySelector('#turnprompt').classList.contains('hidden')) : null;
    if (atMoment) { await page.waitForTimeout(150); await shot(page, 'J-rogue-moment'); }
    await idle(page);
    const rec = (await page.evaluate(() => window.__ui.plays())).find((r) => r.input >= k0) || null;
    { const after = await page.evaluate(() => { const v = window.__ui.view(); return { hidden: document.querySelector('#turnprompt').classList.contains('hidden'), live: !!(v.combat && !v.combat.over) }; });
      check('UX-1', 'the turn prompt is hidden while the round plays (at the wind-up\'s moment) and back when the game waits again', atMoment && tpDuring === true && (!after.live || !after.hidden), `during the moment: hidden ${tpDuring}; after: ${JSON.stringify(after)}`); }
    const ms = rec ? roundMs(rec) : null; const cap = rec && rec.round ? rec.round.budget : null;
    // D52: headless rendering at 1920x1080 runs at about 10 fps, so there a single round is reported and not held to the cap
    const capHeld = !(W >= 1920 && H >= 1080);
    check('M2v2-52', `at the default speed the round with the wind-up's moment ("Staggered!", its beat) plays within the round cap (D47)${capHeld ? '' : ' (1920x1080: reported only, D52)'}`,
      atMoment && !!rec && rec.events.includes('windup') && cap != null && (!capHeld || ms <= cap), `round ${ms} ms, cap ${cap} ms, tempo ${rec && rec.round ? rec.round.tempo.toFixed(2) : '-'}, moment seen ${atMoment}; events ${rec ? rec.events.join(' ') : '-'}`);
    await setSpeed(page, 'Instant');
    await page.mouse.move(2, 2); await frame();
    s = await twin.sync(page);
    const sent = (await page.evaluate(() => window.__ui.engineLog())).slice(-1)[0];
    d = await j21dom(page); const log = await logLines(page);
    const e = s.fight && s.fight.enemies[w.idx];
    const st = e && jStack(e, 'STAGGERED');
    bad = s.fight && !s.fight.over ? jStacksMatch(d, s, await page.evaluate(() => window.__ui.target())) : [];
    await shot(page, 'J-rogue-stopped');
    check('M2b-2b.6', `key ${w.slot + 1} casts ${spName} on ${w.name}: the wind-up is stopped ("Wind-up answered: ${w.name}'s ${w.ability} is stopped by your ${spName}") and the STAGGERED badge equals the engine's status`,
      !!sent && sent.type === 'CAST' && sent.spellId === w.spellId && !!st && !bad.length && log.some((l) => l.startsWith(`Wind-up answered: ${w.name}'s ${w.ability} is stopped by your ${spName}.`)),
      `${JSON.stringify(sent)}; stack ${JSON.stringify(st)}; ${bad.join(' | ')}; log ${log.slice(-3).join(' / ')}`);
  } catch (e) {
    await shot(page, 'J-rogue-error');
    check('-', 'part J (Rogue) ran to the end', false, e.message.split('\n').slice(0, 4).join(' / '));
  }
  check('-', 'part J (Rogue): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part K: the Dev menu (engine-api.md 12)
/** Replay a page's engine log in Node: dev ops through R.debug (build with the content), engine actions through R.step. */
function devTwin(log) {
  let s = null;
  for (const e of log) {
    if (e.type === 'DEV') s = e.fn === 'build' ? R.debug.build({ ...e.args[0], content: CONTENT }).state : R.debug[e.fn](s, ...e.args).state;
    else s = R.step(s, e).state;
  }
  return s;
}
async function partK(browser, W, H) {
  const SEED = 4;
  const ELITE = R.debug.enemies(CONTENT).find((x) => x.kind === 'elite' && x.zone === 4);
  const { context, page, errors } = await open(browser, W, H, `seed=${SEED}&speed=instant`);
  const panel = page.locator('#devmenu');
  const f = (key) => page.locator(`#devmenu [data-f="${key}"]`);
  const tab = async (name) => { await panel.getByRole('tab', { name }).click(); await idle(page); };
  /** The page's state against the Node twin of its engine log. */
  const twinCheck = async (what) => {
    const [log, state] = await page.evaluate(() => [window.__ui.engineLog(), window.__ui.state()]);
    let twin = null; let err = null;
    try { twin = R.serialize(devTwin(log)); } catch (e) { err = e.message; }
    const errs = twin ? R.debug.validate(R.deserialize(state, CONTENT), { steps: false }) : [];
    check('DEV-K', `${what}: the page's state equals the engine's (a Node twin of ${log.length} logged ops) and passes R.debug.validate`, !err && twin === state && !errs.length,
      err || (twin !== state ? `differs (${log.map((x) => x.fn || x.type).join(', ')})` : errs.join('; ')));
  };
  try {
    const btn = page.locator('#devbtn');
    const bp = await placement(btn);
    await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
    check('DEV-K', 'the DEV corner button is in view and on top', fullyShown(bp), placeText(bp));
    const clearOfMap = async () => page.evaluate(() => {
      const b = document.getElementById('devbtn').getBoundingClientRect();
      return [...document.querySelectorAll('#minimap, #minimap .zname, #tracker')].map((el) => el.getBoundingClientRect()).every((r) => r.width === 0 || b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
    });
    await page.keyboard.press('Backquote'); await idle(page);
    const pp = await placement(panel);
    check('DEV-K', 'the backquote key opens the Dev menu, fully in view', await page.evaluate(() => window.__ui.devOpen()) && fullyShown(pp), placeText(pp));
    // ---- Start at: Mage, zone 4, level 35 (the menu's own fields)
    await tab('Start at');
    await f('classId').selectOption('mage');
    await f('zone').selectOption('4');
    await f('level').fill('35');
    await panel.getByRole('button', { name: 'Start here' }).click(); await idle(page);
    let v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, zone: x.zone && x.zone.idx, level: x.player && x.player.level, cls: x.player && x.player.classId, dev: x.dev }; });
    check('DEV-K', 'Start at: a level 35 Mage in the hub of zone 4, marked a dev run', v.phase === 'ZONE_HUB' && v.zone === 4 && v.level === 35 && v.cls === 'mage' && !!v.dev, JSON.stringify(v));
    check('DEV-K', 'the DEV button covers no part of the minimap, its zone name (17 letters, the longest) or the tracker', await clearOfMap(), await btn.evaluate((el) => JSON.stringify(el.getBoundingClientRect())));
    await twinCheck('Start at');
    // ---- Jump: the end-boss fight in phase 2
    await tab('Jump');
    await panel.locator('[data-dev="boss2"]').click(); await idle(page);
    v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, boss: x.combat && x.combat.boss && x.combat.boss.phase, shards: x.combat ? x.combat.enemies.filter((e) => e.rank === 'shard' && e.alive).length : 0, level: x.player.level }; });
    check('DEV-K', `Jump: the end-boss fight in phase 2 with ${R.C.SHARD_COUNT} Shards, the Mage still level 35`, v.phase === 'BOSS' && v.boss === 2 && v.shards === R.C.SHARD_COUNT && v.level === 35, JSON.stringify(v));
    await twinCheck('Boss phase 2');
    // ---- Fight: an elite of zone 4 by its id
    await tab('Fight');
    await f('q').fill(ELITE.id); await idle(page);
    const rows = await panel.locator('.dm-row').evaluateAll((els) => els.map((e) => e.dataset.enemy));
    check('DEV-K', `Fight: searching "${ELITE.id}" lists exactly that template`, rows.length === 1 && rows[0] === ELITE.id, rows.join(', '));
    await panel.locator(`button[data-enemy="${ELITE.id}"]`).click(); await idle(page);
    v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, node: x.node && x.node.type, enemies: x.combat ? x.combat.enemies.map((e) => ({ tpl: e.tplId, level: e.level, rank: e.rank })) : null }; });
    check('DEV-K', `Fight: ${ELITE.name} (${ELITE.id}), an elite at level 35, in a dev fight`, v.phase === 'NODE' && v.node === 'dev' && v.enemies && v.enemies.length === 1 && v.enemies[0].tpl === ELITE.id && v.enemies[0].level === 35 && v.enemies[0].rank === 'elite',
      JSON.stringify(v));
    await twinCheck('Elite fight');
    const tf = await placement(page.locator('#devmenu'));
    check('DEV-K', 'the menu stays in view in the fight', fullyShown(tf), placeText(tf));
    await shot(page, 'K-elite-fight');
    // ---- World: god mode on
    await tab('World');
    await panel.getByRole('switch', { name: 'God mode' }).click(); await idle(page);
    v = await page.evaluate(() => window.__ui.view().dev);
    check('DEV-K', 'World: god mode on (the view and the menu say so)', !!(v && v.god) && (await panel.locator('.dm-run').innerText()) === 'Dev run · god mode', JSON.stringify(v));
    await twinCheck('God mode');
    // ---- the key closes it; the setting hides the button and the key
    await page.keyboard.press('Backquote'); await idle(page);
    check('DEV-K', 'the backquote key closes the menu', !(await page.evaluate(() => window.__ui.devOpen())) && !(await panel.isVisible()), '');
    await page.evaluate(() => window.__ui.settings.set('devTools', false)); await idle(page);
    await page.keyboard.press('Backquote'); await idle(page);
    check('DEV-K', 'the setting hides the button and the key', !(await btn.isVisible()) && !(await page.evaluate(() => window.__ui.devOpen())), '');
    await page.evaluate(() => window.__ui.settings.set('devTools', true)); await idle(page);
  } catch (e) {
    await shot(page, 'K-error');
    check('DEV-K', 'part K ran to the end', false, e.message.split('\n').slice(0, 4).join(' / '));
  }
  check('DEV-K', 'part K: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  // ?dev=0: no button, the key does nothing
  const off = await open(browser, W, H, `seed=${SEED}&speed=instant&dev=0`);
  await off.page.keyboard.press('Backquote'); await idle(off.page);
  check('DEV-K', '?dev=0: no Dev button, the key opens nothing', !(await off.page.locator('#devbtn').isVisible()) && !(await off.page.evaluate(() => window.__ui.devOpen())), '');
  check('DEV-K', '?dev=0: no console errors', off.errors.length === 0, off.errors.join(' | '));
  await off.context.close();
}

// ------------------------------------------------------------------ part L: DoT preview, talent totals, hints, Killed by
// Owner feedback 2026-11-11 (08:03, 08:11, 08:14, 08:31). The preview's numbers come from R.pendingTicks of a Node twin of
// the page's run; set-up states (window.__ui.loadState) put DoTs on every kind of unit at once, a lethal one included.
import('../../src/ui/engine-bridge.js').then((m) => { L_BRIDGE.actionName = m.actionName; }).catch(() => {});
import('../../src/ui/ui-text.js').then((m) => { L_BRIDGE.text = m; }).catch(() => {});
const L_BRIDGE = { actionName: null, text: null };
/** A dev-built fight (R.debug) past its engage round, edited, serialized for window.__ui.loadState. */
function lFight(cls, seed, zone, edit) {
  let s = R.debug.build({ content: CONTENT, classId: cls, seed, zone }).state;
  const foes = R.debug.enemies(CONTENT).filter((x) => x.zone === zone && x.kind === 'normal').slice(0, 2).map((x) => x.id);
  s = R.debug.encounter(s, { ids: foes }).state;
  s = R.step(s, { type: 'PASS' }).state;
  const o = JSON.parse(R.serialize(s));
  if (edit) edit(o);
  return JSON.stringify(o);
}
/** Every HP bar of the HUD: where it is, its preview mark (data-dot), the hatched width and the fill's share, the skull. */
const hpBars = (page) => page.evaluate(() => [...document.querySelectorAll('.bar.hp')].filter((b) => b.offsetParent).map((b) => {
  const frame = b.closest('#player-frame, #pet-frame, #target-frame, #boss-frame, .np');
  const dot = b.querySelector('.dot'); const sk = b.querySelector('.skull');
  // the hatched width as set (share of the bar); its box eases over .3 s when the target frame changes enemy
  return { where: frame.id || `np${frame.dataset.idx}`, dot: b.dataset.dot || '', w: dot && !dot.classList.contains('hidden') ? parseFloat(dot.style.width) / 100 : 0,
    skull: !!sk && !sk.classList.contains('hidden') && getComputedStyle(sk).display !== 'none', lethal: !!dot && dot.classList.contains('lethal') };
}));
/** The marks R.pendingTicks of state s asks for, per bar ('player-frame', 'pet-frame', 'target-frame', 'np<idx>'). */
function wantMarks(s, target) {
  const out = {};
  const mark = (u, maxHp) => {
    const x = R.pendingTicks(s, u);
    if (!x || (!x.amount && !x.absorbed && !x.lethal)) return { dot: '', w: 0 };
    const loss = Math.min(x.hp, Math.max(0, x.hp - (x.lethal ? 0 : x.hpAfter)));
    return { dot: `${loss}${x.lethal ? ':lethal' : ''}`, w: loss / maxHp, lethal: x.lethal };
  };
  out['player-frame'] = mark('player', s.player.d.maxHp);
  if (s.player.pet && s.player.pet.alive) out['pet-frame'] = mark('pet', s.player.d.petMaxHp);
  for (const e of s.fight.enemies) if (e.alive) out[`np${e.idx}`] = mark(e.idx, e.maxHp);
  if (target != null && s.fight.enemies[target] && s.fight.enemies[target].alive) out['target-frame'] = out[`np${target}`];
  return out;
}
function marksMatch(bars, want) {
  const bad = [];
  for (const [where, w] of Object.entries(want)) {
    const b = bars.find((x) => x.where === where);
    if (!b) { bad.push(`${where}: no bar`); continue; }
    if (b.dot !== w.dot || Math.abs(b.w - w.w) > 0.02 || (!!w.lethal !== b.lethal) || (!!w.lethal !== b.skull)) bad.push(`${where}: page ${JSON.stringify(b)}, engine ${JSON.stringify(w)}`);
  }
  return bad;
}
const tipText = async (page, locator) => { await locator.hover(); await page.waitForTimeout(180); const t = await page.locator('.tooltip.on').innerText().catch(() => ''); await page.mouse.move(2, 2); return t.replace(NBSP, ' '); };

async function partL(browser, W, H) {
  // ---- (1) DoT preview: a cast that applies a DoT, then a set-up state with DoTs on every unit, one lethal
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      await page.locator('#create .ccard[data-cls="hunter"]').click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
      const foes = R.debug.enemies(CONTENT).filter((x) => x.zone === 2 && x.kind === 'normal').slice(0, 2).map((x) => x.id);
      await page.evaluate((ids) => window.__ui.dev('fight', { ids }), foes); await idle(page);
      await page.keyboard.press('KeyX'); await idle(page); // past the engage round
      let s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
      const slot = s.player.bar.indexOf('barbed_arrow');
      const target = await page.evaluate(() => window.__ui.target());
      if (slot >= 0) {
        await page.keyboard.press(`Digit${slot + 1}`); await idle(page);
        s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
        const tgt = await page.evaluate(() => window.__ui.target());
        const bad = s.fight && !s.fight.over ? marksMatch(await hpBars(page), wantMarks(s, tgt)) : ['the fight ended'];
        await shot(page, 'L-barbed');
        check('OWN-L', 'Barbed Arrow cast: every HP bar marks what R.pendingTicks of the engine state says (hatched width = HP lost / max HP), the target included',
          !bad.length && R.pendingTicks(s, target) && R.pendingTicks(s, target).amount > 0, bad.join(' | ') || JSON.stringify(R.pendingTicks(s)));
      } else check('OWN-L', 'Barbed Arrow is on the level-11 Hunter\'s bar', false, JSON.stringify(s.player.bar));
      // set-up state: DoTs on both enemies (enemy 1 lethal: 3 × 9 Poison on 20 HP), on the player and on the pet
      const ser = lFight('hunter', 5, 2, (o) => {
        const [e0, e1] = o.fight.enemies;
        e0.st.push({ id: 'BLEED', src: 'barbed_arrow', dur: 3, full: 4, tick: Math.round(e0.hp * 0.3), canCrit: false, stacks: 1 });
        e1.hp = 20; e1.st.push({ id: 'POISON', dur: 3, full: 4, tick: 9, stacks: 3, max: 5, canCrit: false });
        o.fight.p.st.push({ id: 'BLEED', src: 'rend@1', by: 1, dur: 2, full: 3, tick: 14, canCrit: false });
        o.fight.pet.st.push({ id: 'BLEED', src: 'rend@0', by: 0, dur: 2, full: 3, tick: 11, canCrit: false });
        o.player.hp = Math.round(o.player.d.maxHp * 0.6);
      });
      await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
      await page.locator('#nameplates .np[data-idx="1"]').click(); await idle(page); await page.mouse.move(2, 2);
      s = R.deserialize(ser, CONTENT);
      const bars = await hpBars(page);
      let bad = marksMatch(bars, wantMarks(s, 1));
      await shot(page, 'L-dot-preview');
      check('OWN-L', 'set-up state: nameplates, target frame, player and pet frames mark R.pendingTicks exactly; the lethal Poison has the skull on its nameplate and the target frame, the others none',
        !bad.length && bars.filter((b) => b.skull).map((b) => b.where).sort().join(',') === 'np1,target-frame', bad.join(' | ') || JSON.stringify(bars));
      const tt = await tipText(page, page.locator('#target-frame .bar.hp'));
      const t1 = R.pendingTicks(s, 1);
      check('OWN-L', `target frame tooltip: lethal, ${t1.amount} from Poison ×3, "no need to attack it"`, /Lethal/.test(tt) && tt.includes(`Poison ×3: ${t1.amount}`) && /no need to attack/.test(tt), tt);
      const pt = await tipText(page, page.locator('#player-frame .bar.hp'));
      const enemy1 = s.fight.enemies[1].name;
      check('OWN-L', `player frame tooltip: the rend's tick by name and enemy (Rend (${enemy1}): ${R.pendingTicks(s, 'player').amount}), never an id`, pt.includes(`Rend (${enemy1}): ${R.pendingTicks(s, 'player').amount}`) && !/@|_/.test(pt), pt);
      // the round plays: the poisoned enemy dies at its end, as previewed; the marks follow the new state
      await page.keyboard.press('KeyX'); await idle(page);
      const log = await page.evaluate(() => window.__ui.engineLog());
      let t = R.deserialize(ser, CONTENT); for (const a of log) t = R.step(t, a).state;
      bad = t.fight && !t.fight.over ? marksMatch(await hpBars(page), wantMarks(t, await page.evaluate(() => window.__ui.target()))) : [];
      check('OWN-L', 'after Pass: the enemy the preview called lethal is dead (engine), its bar is gone, and the other bars mark the new R.pendingTicks',
        t.fight && !t.fight.enemies[1].alive && !(await page.locator('#nameplates .np[data-idx="1"]:not(.dead)').count()) && !bad.length, bad.join(' | ') || `enemy 1 alive: ${t.fight && t.fight.enemies[1].alive}`);
    } catch (e) {
      await shot(page, 'L-error-dot');
      check('OWN-L', 'part L (DoT preview) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (DoT preview): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2) talent totals: Silent Footing and Toxic Coating rank by rank, from R.talentInfo
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant');
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 20, talents: 'unspent' })); await idle(page);
      await page.keyboard.press('KeyN'); await idle(page);
      const cell = (id) => page.locator(`#win-talents .tal[data-id="${id}"]`);
      const want = [];
      for (let r = 1; r <= 3; r++) {
        await cell('r_b1').click(); await idle(page);
        const s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
        const info = R.talentInfo(s, 'r_b1');
        const txt = await tipText(page, cell('r_b1'));
        const nowWant = `Now: +${Math.round(info.now.pct * 100)} %`;
        const nextWant = info.next ? `Next rank: +${Math.round(info.next.pct * 100)} %` : 'Max rank';
        want.push(`${r}/3 ${nowWant} · ${nextWant}`);
        if (r === 1 || r === 3) {
          check('OWN-L', `Silent Footing ${r}/3: the tooltip says "${nowWant}" and "${nextWant}" (R.talentInfo)`, txt.includes(nowWant) && txt.includes(nextWant) && txt.includes(`Rank ${r}/3`), txt);
          if (r === 3) await shot(page, 'L-talent-max');
        }
      }
      await cell('r_c1').click(); await idle(page);
      const s = devTwin(await page.evaluate(() => window.__ui.engineLog()));
      const tc = R.talentInfo(s, 'r_c1');
      const txt = await tipText(page, cell('r_c1'));
      check('OWN-L', `Toxic Coating 1/3: "Now: Poison ticks ${tc.now.base} per stack", "Next rank: ... ${tc.next.base}" (the formula with the character's level and Power)`,
        txt.includes(`Now: Poison ticks ${tc.now.base} per stack`) && txt.includes(`Next rank: Poison ticks ${tc.next.base} per stack`), txt);
      // every talent text with one per-rank percentage names the engine's number (the texts were behind M2 v2 and v5)
      const T = L_BRIDGE.text;
      const PCT = new Set(['pct', 'crit', 'dodge', 'hpPct', 'manaPct', 'powerPct', 'petHpPct', 'petDmgPct', 'chance', 'healPct', 'share', 'marked', 'wardPct', 'strength', 'chill']);
      const off = Object.keys(R.C.TALENT).filter((id) => { const k = R.C.TALENT_PER_RANK[id]; if (!T || k.length !== 1 || !PCT.has(k[0])) return false; return !T.talentText(id, CONTENT).replace(/\+/g, '').includes(T.pct2(R.C.TALENT[id][k[0]])); });
      check('OWN-L', 'every talent text with one per-rank percentage states the engine\'s number (C.TALENT)', T && !off.length, off.map((id) => `${id}: "${T.talentText(id, CONTENT)}" vs ${T.pct2(R.C.TALENT[id][R.C.TALENT_PER_RANK[id][0]])}`).join(' | '));
    } catch (e) {
      await shot(page, 'L-error-talent');
      check('OWN-L', 'part L (talent totals) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (talent totals): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (3) the first-fight hint: once per class in this browser's saved game; (4) the low-health potion pulse
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=16&speed=instant');
    const toFight = async () => { for (let i = 0; i < 200; i++) { const v = await view(page); if (v.round && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); } };
    const newRun = async (cls) => {
      await page.goto(`${URL}?seed=16&speed=instant`); await page.waitForFunction(() => window.__ui);
      await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await toFight();
    };
    try {
      const hint = page.locator('#engage-hint');
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await toFight();
      const twin = makeTwin(16); twin.s.create.classId = 'rogue';
      const s = await twin.sync(page);
      const opts = R.engageOptions(s);
      const items = await page.locator('#engage-hint .eh-opts li').evaluateAll((els) => els.map((e) => ({ opt: e.dataset.opt, key: (e.querySelector('.kbd') || {}).textContent, text: e.textContent })));
      const hp = await placement(hint);
      const clear = await page.evaluate(() => {
        const r = document.getElementById('engage-hint').getBoundingClientRect();
        const hit = (q) => [...document.querySelectorAll(q)].filter((x) => x.offsetParent).some((x) => { const b = x.getBoundingClientRect(); return b.width && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom); });
        return { engage: hit('#engage'), target: hit('#target-frame'), np: hit('#nameplates .np'), ruler: hit('#ruler'), bar: hit('#actionbar'), arrowAtPanel: Math.abs(r.left - document.getElementById('engage').getBoundingClientRect().right) < 40 };
      });
      await shot(page, 'L-hint');
      check('OWN-L', `Rogue's first engage round: the hint is in view beside the engage panel and lists ${opts.map((o) => o.name).join(', ')} on keys Q, W, E (R.engageOptions), Sap among them`,
        R.isEngageRound(s) && fullyShown(hp) && items.map((x) => `${x.opt}:${x.key}`).join(',') === opts.map((o, i) => `${o.id}:${'QWE'[i]}`).join(',') && items.some((x) => /Sap/.test(x.text) && /skips its next/.test(x.text)) && clear.arrowAtPanel,
        `${placeText(hp)} ${JSON.stringify(items)}`);
      check('OWN-L', 'the hint covers no engage card, target frame, nameplate, opening ruler or action bar', !clear.engage && !clear.target && !clear.np && !clear.ruler && !clear.bar, JSON.stringify(clear));
      await page.locator('#engage-hint button').click(); await idle(page);
      const stored = await page.evaluate((k) => localStorage.getItem(k), 'tbwcr.hints.v1');
      check('OWN-L', '"Got it" hides it and stores it for the Rogue (localStorage tbwcr.hints.v1)', !(await hint.isVisible()) && JSON.parse(stored || '{}').engage && JSON.parse(stored).engage.rogue === true, stored);
      await newRun('rogue');
      check('OWN-L', 'a new Rogue run (page reloaded): its first engage round shows no hint', (await view(page)).round === 1 && !(await hint.isVisible()), '');
      await newRun('mage');
      const shownMage = await hint.isVisible();
      await page.keyboard.press('KeyW'); await idle(page);
      const st2 = await page.evaluate((k) => localStorage.getItem(k), 'tbwcr.hints.v1');
      check('OWN-L', 'a first Mage run shows the hint; opening with W ends the engage round and stores it for the Mage too', shownMage && !(await hint.isVisible()) && JSON.parse(st2).engage.mage === true, st2);
      // (4) the potion: below POTION_HINT_HP with a Healing Draught ready the slot pulses; never drunk for the player
      const at = (frac, cd) => lFight('hunter', 5, 2, (o) => { o.player.hp = Math.round(o.player.d.maxHp * frac); if (cd) o.fight.p.potionReady = o.fight.round + 2; });
      const potSlot = async () => page.evaluate(() => { const v = window.__ui.view(); const i = v.player.itemBar.findIndex((x) => x === 'healing_draught'); const b = document.querySelector(`#actionbar .ab[data-islot="${i}"]`); return { i, pulse: !!b && b.classList.contains('pulse'), label: b ? b.getAttribute('aria-label') : '' }; });
      await page.evaluate((x) => window.__ui.loadState(x), at(0.3)); await idle(page); await page.mouse.move(2, 2);
      const low = await potSlot();
      await shot(page, 'L-potion');
      await page.waitForTimeout(700);
      const drank = (await page.evaluate(() => window.__ui.engineLog())).some((a) => a.type === 'USE_ITEM');
      await page.evaluate((x) => window.__ui.loadState(x), at(0.5)); await idle(page);
      const high = await potSlot();
      await page.evaluate((x) => window.__ui.loadState(x), at(0.3, true)); await idle(page);
      const cool = await potSlot();
      check('OWN-L', 'Healing Draught on the item bar: pulses at 30 % health ("Low health: drink it"), not at 50 %, not while the potion cooldown runs, and is never drunk for the player',
        low.i >= 0 && low.pulse && /Low health/.test(low.label) && !high.pulse && !cool.pulse && !drank, JSON.stringify({ low, high, cool, drank }));
    } catch (e) {
      await shot(page, 'L-error-hint');
      check('OWN-L', 'part L (hints) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (hints): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (5) Killed by: the killing blow by its display name, never its id; (6) the settings window at this size
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=1&speed=instant');
    try {
      const names = L_BRIDGE.actionName ? Object.keys(CONTENT.abilities).filter((id) => L_BRIDGE.actionName(id) !== CONTENT.abilities[id].name) : ['(bridge not loaded)'];
      check('OWN-L', `every content ability (${Object.keys(CONTENT.abilities).length}) reads by its content name (the bridge's actionName)`, !names.length, names.join(', '));
      let s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT });
      s = R.step(s, { type: 'START_RUN' }).state;
      for (let i = 0; i < 20000 && s.phase !== 'SUMMARY' && s.phase !== 'ENDED'; i++) s = R.step(s, R.autoAction(s)).state;
      const o = JSON.parse(R.serialize(s));
      if (o.phase === 'SUMMARY' && o.death) {
        o.death.killer = { idx: 0, name: 'Aldrec Barrow-King', ability: 'ab_z3_king_aldrec_heavy_blow' };
        await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
        await page.evaluate((x) => window.__ui.loadState(x), JSON.stringify(o)); await idle(page);
        const line = await page.locator('.killed').innerText();
        await shot(page, 'L-killed-by');
        check('OWN-L', 'the run summary names the killing blow: "Aldrec Barrow-King (Crown-Breaker)", not "Ab Z3 King Aldrec Heavy Blow"', line === `Aldrec Barrow-King (${CONTENT.abilities.ab_z3_king_aldrec_heavy_blow.name})`, line);
      } else check('OWN-L', 'a Rogue autoplay run (seed 1) ends in a death', false, `${o.phase} ${o.outcome}`);
      await page.goto(`${URL}?seed=1&speed=instant`); await page.waitForFunction(() => window.__ui);
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.openWin('settings')); await idle(page);
      const segs = await page.locator('#win-settings .setrow').first().locator('.seg button').all();
      const ps = []; for (const b of segs) ps.push({ t: await b.innerText(), p: await placement(b) });
      await shot(page, 'L-settings');
      check('OWN-L', 'settings window: Animation speed shows all four choices (1×, 2×, 4×, Instant) whole and in view', ps.length === 4 && ps.every((x) => fullyShown(x.p)) && ps.map((x) => x.t).join(',') === '1×,2×,4×,Instant',
        ps.map((x) => `${x.t} ${placeText(x.p)}`).join(' | '));
    } catch (e) {
      await shot(page, 'L-error-summary');
      check('OWN-L', 'part L (summary, settings) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('OWN-L', 'part L (summary, settings): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part M: the start camp and the contract tracker
// docs/specs/expedition.md 9.1, 9.3, engine-api.md 13 (M2b 2b.6): real engine at Instant speed, ?prep=1, seed M_SEED.
// Every number on the prep screen, the tracker, the map's site marks and the hub offer is compared with a Node twin
// that replays the page's engine log (R.step; R.debug for the Dev menu's build).
const M_SEED = 7;
function mTwin(seed) {
  return {
    async sync(page) {
      const log = await page.evaluate(() => window.__ui.engineLog());
      let s = null;
      for (const a of log) {
        if (a.type === 'DEV' && a.fn === 'build') s = R.debug.build({ ...a.args[0], content: CONTENT }).state;
        else if (a.type === 'DEV') s = R.debug[a.fn](s, ...a.args).state;
        else { if (!s) s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'expedition', prep: true }); s = R.step(s, a).state; }
      }
      return s || R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'expedition', prep: true });
    },
  };
}
async function partM(browser, W, H) {
  const { context, page, errors } = await open(browser, W, H, `seed=${M_SEED}&speed=instant&prep=1`);
  const twin = mTwin(M_SEED);
  const T = await import('../../src/ui/ui-text.js');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pagePrep = () => page.evaluate(() => window.__ui.view().prep);
  try {
    await page.keyboard.press('Enter');
    // Enter again at once (a double press of the key that started the run): the camp stays open (prep.js's guard). The
    // second press is sent the moment the screen is there, so a slow machine cannot stretch the gap past the guard.
    const age = await page.evaluate(async () => {
      for (let i = 0; i < 400 && !document.getElementById('prep'); i++) await new Promise((r) => setTimeout(r, 10));
      const el = document.getElementById('prep'); const a = el ? performance.now() - Number(el.dataset.mounted) : null;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true }));
      return a;
    });
    await idle(page);
    let s = await twin.sync(page); let pv = R.prepView(s);
    const ui0 = await page.evaluate(() => ({ phase: window.__ui.view().phase, bar: document.querySelector('#actionbar').classList.contains('hidden'), n: document.querySelector('#prep .pm-n') && document.querySelector('#prep .pm-n').textContent }));
    check('M-prep', `class select's Enter opens the start camp (phase ${ui0.phase}); a second Enter ${Math.round(age)} ms after it opened does not set out; no HUD around it`, ui0.phase === 'PREP' && s.phase === 'PREP' && ui0.bar && age != null && age < 700, JSON.stringify({ ...ui0, age }));
    const dom = () => page.evaluate(() => ({
      left: document.querySelector('#prep .pm-n').textContent, reserve: document.querySelector('#prep .pm-rl').textContent,
      cards: [...document.querySelectorAll('#prep .pp-card')].map((b) => ({ zone: b.querySelector('.pc-zone').textContent, price: b.querySelector('.pc-price').textContent, need: b.querySelector('.pc-need').textContent, taken: b.classList.contains('taken') })),
      opts: [...document.querySelectorAll('#prep .pp-opt')].map((b) => ({ id: b.dataset.id, price: (b.querySelector('.pc-price') || {}).textContent || null, bought: b.classList.contains('bought'), owned: b.classList.contains('owned') })),
      held: [...document.querySelectorAll('#prep .pm-held li:not(.empty)')].length,
    }));
    const domDiff = (d, x) => {
      const out = [];
      if (d.left !== String(x.left)) out.push(`points left ${d.left} (engine ${x.left})`);
      if (!d.reserve.includes(`${x.reserve.points} ${x.reserve.points === 1 ? 'point' : 'points'} = ${x.reserve.echoes} Echoes`)) out.push(`reserve "${d.reserve}" (engine ${x.reserve.points} = ${x.reserve.echoes})`);
      x.board.forEach((o, i) => { const c = d.cards[i]; if (!c || c.zone !== `Zone ${o.z} · ${o.zoneName}` || c.price !== String(o.price) || c.need !== `${o.need} ${o.need === 1 ? 'site' : 'sites'}` || c.taken !== o.taken) out.push(`card ${i + 1} ${JSON.stringify(c)} (engine zone ${o.z}, ${o.price}, ${o.need}, taken ${o.taken})`); });
      x.options.forEach((o) => { const c = d.opts.find((y) => y.id === o.id); if (!c || c.bought !== o.bought || c.owned !== o.owned || (!o.owned && c.price !== String(o.price))) out.push(`option ${o.id} ${JSON.stringify(c)}`); });
      if (d.held !== x.held) out.push(`held list ${d.held} (engine ${x.held})`);
      return out;
    };
    let d = await dom();
    check('M-prep', `the screen's numbers = R.prepView: ${pv.left} of ${pv.points} points left, ${pv.board.length} offers (zone, price, sites), ${pv.options.length} options, Reserve ${pv.reserve.points} = ${pv.reserve.echoes} Echoes`, same(await pagePrep(), JSON.parse(JSON.stringify(pv))) && !domDiff(d, pv).length, domDiff(d, pv).join(' | '));
    // everything in view: Set out at the bottom right, every card and option uncut (BUG-QA-10)
    const goP = await placement(page.locator('#pp-go'));
    check('M-prep', 'Set out is in view at the bottom right, on top', fullyShown(goP) && goP.rect[2] > W * 0.8 && goP.rect[3] > H * 0.85, placeText(goP));
    const cut = [];
    for (const sel of ['#prep .pp-card', '#prep .pp-opt', '#pp-reroll']) { const n = await page.locator(sel).count(); for (let i = 0; i < n; i++) { const p = await placement(page.locator(sel).nth(i)); if (!p.inside || p.clippedBy) cut.push(`${sel} ${i} ${placeText(p)}`); } }
    check('M-prep', 'every contract card, option and the reroll button is fully in view (nothing below the fold)', !cut.length, cut.join(' | '));
    // mouse and keys: take (click), take (key 2), buy (A), buy a vision perk (G), reroll (R), drop (click the taken card)
    const steps = [['click card 1', () => page.locator('#prep .pp-card').nth(0).click()], ['key 2', () => page.keyboard.press('Digit2')],
      ['key A', () => page.keyboard.press('KeyA')], ['key G', () => page.keyboard.press('KeyG')], ['key R', () => page.keyboard.press('KeyR')],
      ['click card 2 (drop)', () => page.locator('#prep .pp-card').nth(1).click()], ['click Field Draughts (sell)', () => page.locator('#prep .pp-opt[data-id="prep_draughts"]').click()],
      ['click Field Draughts (buy)', () => page.locator('#prep .pp-opt[data-id="prep_draughts"]').click()], ['key 3', () => page.keyboard.press('Digit3')]];
    const bad = [];
    for (const [what, fn] of steps) {
      await fn(); await idle(page);
      s = await twin.sync(page); pv = R.prepView(s); d = await dom();
      const diff = domDiff(d, pv);
      if (!same(await pagePrep(), JSON.parse(JSON.stringify(pv))) || diff.length) bad.push(`${what}: ${diff.join(', ') || 'view differs'}`);
    }
    const log = await page.evaluate(() => window.__ui.engineLog().map((a) => a.type));
    check('M-prep', `mouse and keys send TAKE, DROP, BUY, SELL, REROLL (log ${log.slice(1).join(' ')}); after each the screen = R.prepView (left ${pv.left}, held ${pv.held}, rerolls ${pv.reroll.used})`,
      !bad.length && ['TAKE_CONTRACT', 'DROP_CONTRACT', 'BUY_PREP', 'SELL_PREP', 'REROLL_BOARD'].every((t) => log.includes(t)), bad.join(' | '));
    // tooltips: a contract says where its sites are and what it pays; an option says what it does
    await page.mouse.move(2, 2);
    const k = pv.board.findIndex((o) => o.kind === 'cull'); const o = pv.board[k >= 0 ? k : 0];
    await page.locator('#prep .pp-card').nth(k >= 0 ? k : 0).hover(); await page.waitForTimeout(80);
    const tt1 = await page.evaluate(() => (document.querySelector('.tooltip.on') || {}).innerText || '');
    const want1 = [T.contractSentence(o, CONTENT), o.kind === 'cull' ? 'Sites: Quest or Grind nodes' : 'site', `${Math.round(o.reward.xpFrac * 10) / 10} levels of XP`];
    check('M-prep', `a contract's tooltip: its sentence, its sites and its pay (${want1[0]})`, want1.every((x) => tt1.replace(NBSP, ' ').includes(x)), tt1.replace(/\n/g, ' / '));
    const spy = pv.options.find((x) => x.id === 'prep_spyglass');
    await page.locator('#prep .pp-opt[data-id="prep_spyglass"]').hover(); await page.waitForTimeout(80);
    const tt2 = await page.evaluate(() => (document.querySelector('.tooltip.on') || {}).innerText || '');
    const want2 = T.prepOptionEffect(spy, { vision: R.C.VISION_RADIUS, guide: R.C.GUIDE_RADIUS_BONUS, tracker: R.C.TRACKER_RADIUS, bountyPlaced: R.C.BOUNTY_PLACED, bellMax: R.C.BELL_MAX_CHARGES, emberMax: R.C.EMBER_MAX_CARRIED }, (id) => R.C.CONSUMABLE[id].name);
    check('M-prep', `an option's tooltip says what it does in one line ("${want2}") and its refund`, tt2.includes(want2) && /full refund/.test(tt2), tt2.replace(/\n/g, ' / '));
    await page.mouse.move(2, 2);
    await shot(page, 'M-prep');
    // Set out (Enter, after the guard): the purchases take effect, Reserve, zone 1's hub
    await page.waitForTimeout(750);
    await page.keyboard.press('Enter'); await idle(page);
    s = await twin.sync(page);
    const cv = R.contractView(s); const pc = await page.evaluate(() => window.__ui.view().contracts);
    check('M-track', `Enter sets out (phase ${s.phase}): the contracts and Reserve on screen = R.contractView (held ${cv.held}, Reserve ${cv.reserve})`, s.phase === 'ZONE_HUB' && same(pc, JSON.parse(JSON.stringify(cv))), JSON.stringify(pc && { held: pc.held, reserve: pc.reserve }));
    // the map: the tracker pins this zone's contracts; site marks exactly where mapView has them; hidden nodes unnamed
    const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) await got.first().click();
    await page.locator('#screens .side .btn.primary').click(); await idle(page);
    s = await twin.sync(page);
    const mv = R.mapView(s); const cv2 = R.contractView(s);
    const here = cv2.contracts.filter((c) => c.z === 1 && c.status !== 'abandoned');
    const tr = await page.evaluate(() => ({ dimmed: document.querySelector('#tracker').classList.contains('dimmed'), rows: [...document.querySelectorAll('#tracker .tk-c')].map((e) => ({ id: e.dataset.contract, t: e.querySelector('.t').textContent, pr: e.querySelector('.pr').textContent })) }));
    const trBad = here.filter((c) => { const r = tr.rows.find((x) => x.id === c.id); return !r || r.t !== T.contractTitle(c, CONTENT) || r.pr !== `${c.progress} / ${c.need} ${c.need === 1 ? 'site' : 'sites'}`; });
    check('M-track', `on the map the tracker shows this zone's ${here.length} ${here.length === 1 ? 'contract' : 'contracts'} with title and progress (= R.contractView), not dimmed`, s.phase === 'MAP' && !tr.dimmed && tr.rows.length === here.length && !trBad.length, JSON.stringify(tr));
    const trP = await page.locator('#tracker').evaluate((el) => { const r = el.getBoundingClientRect(); const m = document.querySelector('#screens .mapwin').getBoundingClientRect(); return { overlap: r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top, r: [r.left, r.right].map(Math.round), m: [m.left, m.right].map(Math.round) }; });
    check('M-track', 'the tracker on the map stays clear of the zone map', !trP.overlap, JSON.stringify(trP));
    const marks = await page.evaluate(() => [...document.querySelectorAll('.expmap .mnode')].filter((n) => n.querySelector('.xsite')).map((n) => ({ id: Number(n.dataset.node), sites: n.querySelector('.xsite').dataset.sites, label: n.querySelector('.cl').textContent, aria: n.getAttribute('aria-label') })));
    const want = mv.nodes.filter((n) => n.sites).map((n) => ({ id: n.id, sites: n.sites.join(','), know: n.know }));
    const mBad = want.filter((w) => { const m = marks.find((x) => x.id === w.id); return !m || m.sites !== w.sites || (w.know === 'none' && (m.label !== '?' || !/^Unknown/.test(m.aria))); });
    check('M-track', `site marks on exactly the ${want.length} nodes mapView marks (${want.filter((w) => w.know === 'none').length} hidden: shown as "?", never named)`, marks.length === want.length && !mBad.length, JSON.stringify({ marks, want }));
    await shot(page, 'M-map');
    // the quest log is the contract list
    await page.keyboard.press('KeyL'); await idle(page);
    const rows = await page.locator('#win-questlog .cl-row').count();
    check('M-track', `the quest log (L) lists every contract of the run (${cv2.contracts.length})`, rows === cv2.contracts.length, `${rows} rows`);
    await page.keyboard.press('KeyL'); await idle(page);
    // the hub contract: a run at zone 2's hub (Dev menu Start at, the start camp left with every point as Reserve)
    await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, mapMode: 'expedition', prep: true })); await idle(page);
    s = await twin.sync(page);
    const off = R.contractView(s).hub;
    const hc = await page.evaluate(() => { const e = document.querySelector('.hubc'); return e ? { s: e.querySelector('.hc-s').textContent, take: e.querySelector('[data-hub="reserve"]').textContent } : null; });
    check('M-hub', `zone 2's hub shows its contract offer (${off ? T.contractTitle(off, CONTENT) : 'none'}) with its price in Reserve`, !!off && !!hc && hc.s === T.hubOfferSentence(off, CONTENT.zones[1].hubName, CONTENT) && hc.take.includes(`${off.price} Reserve`), JSON.stringify(hc));
    const res0 = R.contractView(s).reserve;
    await page.locator('.hubc [data-hub="reserve"]').click(); await idle(page);
    s = await twin.sync(page);
    const cv3 = R.contractView(s); const pc3 = await page.evaluate(() => window.__ui.view().contracts);
    check('M-hub', `Take pays from Reserve (${res0} -> ${cv3.reserve}) and the offer is held from the hub; the page = R.contractView`, cv3.reserve === res0 - off.price && cv3.contracts.some((c) => c.from === 'hub') && !cv3.hub && same(pc3, JSON.parse(JSON.stringify(cv3))) && !(await page.locator('.hubc').count()), JSON.stringify({ reserve: pc3.reserve, hub: pc3.hub }));
  } catch (e) {
    await shot(page, 'M-error');
    check('-', 'part M (start camp and contracts) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part M: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
  await partMReward(browser, W, H);
}
/** Part M, a completed contract: seed 1 on the engine's autoplay choices (its start camp takes contracts) to the reward. */
async function partMReward(browser, W, H) {
  const { context, page, errors } = await open(browser, W, H, 'seed=1&speed=instant&prep=1');
  const T = await import('../../src/ui/ui-text.js');
  try {
    await page.keyboard.press('Enter'); await idle(page);
    let L = null;
    for (let i = 0; i < 1500 && !L; i++) {
      const v = await page.evaluate(() => { const x = window.__ui.view(); return { loot: x.loot && x.loot.kind === 'contract' ? x.loot : null, phase: x.phase }; });
      if (v.loot) { L = v.loot; break; }
      if (v.phase === 'SUMMARY') break;
      await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
    }
    if (!L) throw new Error('seed 1 completed no contract on the autoplay choices');
    // the engine's pay: replay the log, sum the XP and gold events after the step's contract complete event
    const log = await page.evaluate(() => window.__ui.engineLog());
    let s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT, mapMode: 'expedition', prep: true }); let pay = null;
    for (const a of log) { const r = R.step(s, a); s = r.state; const k = r.events.findIndex((e) => e.t === 'contract' && e.what === 'complete'); if (k >= 0) { const after = r.events.slice(k + 1).filter((e) => e.why === 'contract'); pay = { id: r.events[k].id, xp: after.filter((e) => e.t === 'xp').reduce((x, e) => x + e.amount, 0), gold: after.filter((e) => e.t === 'gold').reduce((x, e) => x + e.amount, 0) }; } }
    const c = R.contractView(s).contracts.find((x) => x.id === pay.id);
    const dlg = await page.evaluate(() => { const d = document.querySelector('.dialog.contract-reward'); return d ? { title: d.querySelector('.wtitle .title').textContent, text: d.innerText, cards: d.querySelectorAll('.choice-cards .icard').length } : null; });
    check('M-reward', `a completed contract shows its reward choice: "${c ? T.contractTitle(c, CONTENT) : '?'}", +${pay.xp} XP and its gold (the engine's events), ${s.node.rewards[0].items.length} items to choose from`,
      !!dlg && dlg.title === 'Contract complete' && dlg.text.includes(T.contractTitle(c, CONTENT)) && L.xp === pay.xp && L.gold === pay.gold && /\+[\d,.\s\u202f\u00a0]+ XP/.test(dlg.text) && dlg.cards === s.node.rewards[0].items.length,
      JSON.stringify({ dlg: dlg && { title: dlg.title, cards: dlg.cards }, view: { xp: L.xp, gold: L.gold }, engine: pay }));
    await shot(page, 'M-reward');
    await page.locator('.dialog.contract-reward .choice-cards .icard').first().click(); await idle(page);
    const after = await page.evaluate(() => { const x = window.__ui.view(); return { loot: x.loot && x.loot.kind, log: window.__ui.engineLog().slice(-1)[0] }; });
    check('M-reward', 'choosing a card sends CHOOSE_REWARD and closes the window', after.log.type === 'CHOOSE_REWARD' && after.loot !== 'contract', JSON.stringify(after));
  } catch (e) {
    await shot(page, 'M-reward-error');
    check('-', 'part M (contract reward) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part M (contract reward): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part N: the fog map (expedition.md 4-6, 9.2; M2b 2b.6)
// Real engine at Instant speed, ?prep=1, seed M_SEED: two contracts and Region Charts bought, set out. Every node's fog
// state, the regions, Roads, the Shardfall, the Dimming's wash and clocks, site marks and moves are compared with
// R.mapView of a Node twin (mTwin); nothing the view hides is drawn. Then the run on the engine's autoplay choices until
// the Dimming has spread, and the same checks again.
/** The fog map's DOM, as the checks read it. */
const fogDom = (page) => page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
  const disc = document.querySelector('#screens .expmap .xdisc');
  return {
    disc: disc ? r(disc) : null,
    nodes: [...document.querySelectorAll('#screens .expmap .mnode')].map((n) => ({ id: Number(n.dataset.node), fog: n.dataset.fog, img: !!n.querySelector('.ring img'), label: n.querySelector('.cl').textContent,
      aria: n.getAttribute('aria-label'), foes: n.querySelector('.xfoes') ? Number(n.querySelector('.xfoes').dataset.foes) : null, clock: n.querySelector('.xclock') ? Number(n.querySelector('.xclock').dataset.dimsIn) : null,
      reach: n.classList.contains('reach'), here: n.classList.contains('here'), dimmed: n.classList.contains('dimmed'), sites: n.querySelector('.xsite') ? n.querySelector('.xsite').dataset.sites : null, rect: r(n), size: n.getBoundingClientRect().width })),
    tints: [...document.querySelectorAll('#screens .expmap .xregions path')].map((x) => Number(x.dataset.region)),
    names: [...document.querySelectorAll('#screens .expmap .xrname')].map((x) => ({ region: Number(x.dataset.region), text: x.textContent })),
    legend: document.querySelectorAll('#screens .expmap .xreg').length,
    roads: [...document.querySelectorAll('#screens .expmap .xroad')].map((x) => ({ id: Number(x.dataset.road), text: x.innerText.replace(/\s+/g, ' '), rect: r(x) })),
    sides: [...document.querySelectorAll('#screens .expmap .xside .xpanel')].map(r),
    shard: document.querySelectorAll('#screens .expmap .xshard').length, wash: document.querySelectorAll('#screens .expmap .xdimwash path').length,
    mine: (document.querySelector('#screens .expmap .xmine') || {}).dataset ? Number(document.querySelector('#screens .expmap .xmine').dataset.dimsIn) : null,
    moves: document.querySelectorAll('#screens .expmap .expmoves .em').length,
  };
});
/** What the fog map must show of R.mapView mv; a list of differences (empty = equal). */
function fogDiff(d, mv, nextZone) {
  const out = [];
  const fogOf = (n) => (n.hub ? 'seen' : n.know === 'full' ? (n.hops <= mv.vision.radius ? 'seen' : 'remembered') : n.know === 'type' ? 'typed' : 'unknown');
  if (d.nodes.length !== mv.nodes.length) out.push(`${d.nodes.length} nodes drawn (view ${mv.nodes.length})`);
  // hops from the Shardfall on the view's edges, for the clocks within two hops of the front
  const nb = mv.nodes.map(() => []); for (const [a, b] of mv.edges) { nb[a].push(b); nb[b].push(a); }
  const hs = mv.nodes.map(() => Infinity); hs[mv.shardfall] = 0; const q = [mv.shardfall];
  while (q.length) { const x = q.shift(); for (const y of nb[x]) if (hs[y] === Infinity) { hs[y] = hs[x] + 1; q.push(y); } }
  const front = mv.dim.off ? -Infinity : mv.dim.front;
  const moves = new Set(mv.moves.map((m) => m.nodeId));
  for (const n of mv.nodes) {
    const e = d.nodes.find((x) => x.id === n.id);
    if (!e) { out.push(`node ${n.id} missing`); continue; }
    const f = fogOf(n);
    if (e.fog !== f) out.push(`node ${n.id} fog ${e.fog} (view ${f})`);
    if (n.know === 'none' && !n.hub && (e.img || e.label !== '?' || !/^Unknown/.test(e.aria) || e.foes !== null)) out.push(`hidden node ${n.id} shows more than the view: ${JSON.stringify(e)}`);
    if (n.know === 'type' && (e.label !== `${mv.bands[n.ring][0]}–${mv.bands[n.ring][1]}` || e.foes !== null || !e.img)) out.push(`type-known node ${n.id}: label ${e.label}, foes ${e.foes}`);
    if (n.know === 'full' && !n.hub && n.cl && e.label !== String(n.cl)) out.push(`seen node ${n.id} level ${e.label} (view ${n.cl})`);
    const foes = n.know === 'full' && !n.hub && !n.done && n.type !== 'dungeon' && n.archetypes && n.archetypes.length ? n.archetypes.length : null;
    if (e.foes !== foes) out.push(`node ${n.id} enemy count ${e.foes} (view ${foes})`);
    const clock = !mv.dim.off && !n.dimmed && Number.isFinite(n.dimsIn) && (hs[n.id] <= front + 2 || (n.id === mv.pos && n.dimsIn <= 2)) ? n.dimsIn : null;
    if (e.clock !== clock) out.push(`node ${n.id} clock ${e.clock} (view ${clock}: dimsIn ${n.dimsIn}, ${hs[n.id]} hops from the Shardfall, front ${front})`);
    if (e.reach !== moves.has(n.id)) out.push(`node ${n.id} reachable ${e.reach}`);
    if (e.here !== (n.id === mv.pos)) out.push(`node ${n.id} here ${e.here}`);
    if (e.dimmed !== !!n.dimmed) out.push(`node ${n.id} dimmed ${e.dimmed}`);
    if ((e.sites || null) !== (n.sites ? n.sites.join(',') : null)) out.push(`node ${n.id} sites ${e.sites} (view ${n.sites})`);
  }
  const tintWant = mv.nodes.filter((n) => !n.hub && n.region != null).map((n) => n.region).sort();
  if (JSON.stringify([...d.tints].sort()) !== JSON.stringify(tintWant)) out.push(`region tints on ${d.tints.length} nodes (view gives ${tintWant.length} regions)`);
  const nameWant = [...new Set(mv.nodes.filter((n) => n.ring >= 2 && n.region != null).map((n) => n.region))].sort();
  if (JSON.stringify(d.names.map((x) => x.region).sort()) !== JSON.stringify(nameWant) || d.names.some((x) => x.text !== mv.regions[x.region].name)) out.push(`region names ${JSON.stringify(d.names)} (view: ${nameWant})`);
  if (d.legend !== mv.regions.length) out.push(`legend ${d.legend} regions`);
  if (d.roads.length !== mv.roads.length || d.roads.some((r) => !mv.roads.includes(r.id) || !r.text.includes(nextZone))) out.push(`roads ${JSON.stringify(d.roads.map((r) => r.text))} (view ${mv.roads}, to ${nextZone})`);
  if (d.shard !== 1) out.push(`${d.shard} Shardfall stars`);
  if (d.wash !== mv.nodes.filter((n) => n.dimmed).length) out.push(`Dimming wash on ${d.wash} nodes (view ${mv.nodes.filter((n) => n.dimmed).length})`);
  const me = mv.nodes[mv.pos]; if (d.mine !== (me.dimmed ? 0 : me.dimsIn)) out.push(`"your node dims in" ${d.mine} (view ${me.dimsIn})`);
  if (d.moves !== mv.moves.length) out.push(`${d.moves} moves listed (view ${mv.moves.length})`);
  return out;
}
/** The disc is round and in view, every node inside it and big enough to read, no signpost on a side panel. */
function fogLayout(d, W, H) {
  const out = [];
  const [l, t, r, b] = d.disc || [0, 0, 0, 0];
  if (!d.disc || Math.abs((r - l) - (b - t)) > 2 || l < 0 || t < 0 || r > W || b > H) out.push(`disc ${d.disc}`);
  if ((r - l) < 0.45 * H) out.push(`disc ${r - l} px high, under 45 % of the window`);
  for (const n of d.nodes) { const [nl, nt, nr, nb] = n.rect; if (nl < l - 4 || nt < t - 4 || nr > r + 4 || nb > b + 4) out.push(`node ${n.id} outside the disc ${n.rect}`); if (n.size < 24) out.push(`node ${n.id} ${n.size} px`); }
  for (const s of d.roads) for (const p of d.sides) if (s.rect[0] < p[2] && s.rect[2] > p[0] && s.rect[1] < p[3] && s.rect[3] > p[1]) out.push(`signpost ${s.text} ${s.rect} over a side panel ${p}`);
  return out;
}
/** Labels of the fog map (level, toll label, clock) that overlap another label, or the icon of another node that is not
 * an unknown "?" marker, by more than 2 px. */
const fogOverlaps = (page) => page.evaluate(() => {
  const nodes = [...document.querySelectorAll('#screens .expmap .xdisc > .mnode')];
  const labs = nodes.flatMap((n) => [...n.querySelectorAll(':scope > .mhrs, :scope > .xclock, :scope > .cl')].filter((e) => e.getClientRects().length).map((e) => ({ n: n.dataset.node, c: e.className.split(' ')[0], t: e.textContent, r: e.getBoundingClientRect() })));
  const rings = nodes.map((n) => ({ n: n.dataset.node, unknown: n.classList.contains('x-unknown'), r: n.querySelector('.ring').getBoundingClientRect() }));
  const ov = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const out = [];
  labs.forEach((a, i) => {
    for (const b of labs.slice(i + 1)) if (ov(a.r, b.r)) out.push(`${a.c} "${a.t}" of node ${a.n} on ${b.c} "${b.t}" of node ${b.n}`);
    for (const g of rings) if (g.n !== a.n && !g.unknown && ov(a.r, g.r)) out.push(`${a.c} "${a.t}" of node ${a.n} on node ${g.n}`);
  });
  return out;
});
async function partN(browser, W, H) {
  const { context, page, errors } = await open(browser, W, H, `seed=${M_SEED}&speed=instant&prep=1`);
  const twin = mTwin(M_SEED);
  const nextZone = CONTENT.zones[1].name;
  try {
    await page.keyboard.press('Enter'); await idle(page); await page.waitForTimeout(750);
    await page.locator('#prep .pp-card').nth(0).click(); await idle(page);
    await page.locator('#prep .pp-card').nth(1).click(); await idle(page);
    await page.locator('#prep .pp-opt[data-id="prep_charts"]').click(); await idle(page);
    await page.keyboard.press('Enter'); await idle(page);
    const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) await got.first().click();
    await page.locator('#screens .side .btn.primary').click(); await idle(page);
    let s = await twin.sync(page); let mv = R.mapView(s);
    let d = await fogDom(page); let diff = fogDiff(d, mv, nextZone);
    const fogs = (x) => ['seen', 'remembered', 'typed', 'unknown'].map((f) => `${x.nodes.filter((n) => n.fog === f).length} ${f}`).join(', ');
    check('N-fog', `zone 1 after setting out with Region Charts: every node's fog state (${fogs(d)}), level, enemy count, site marks and moves = R.mapView; hidden nodes show "?" only`, s.phase === 'MAP' && !diff.length, diff.slice(0, 6).join(' | '));
    check('N-fog', `regions: a tint on the ${d.tints.length} nodes whose region the view gives, ${d.names.length} names on the rim, the legend; ${d.roads.length} Roads signposted to ${nextZone}; the Shardfall's star; "your node dims in ${d.mine}"`, mv.vision.regions && d.names.length === mv.regions.length && !diff.length, JSON.stringify({ names: d.names, roads: d.roads.map((r) => r.text) }));
    const ovl = await fogOverlaps(page);
    check('N-fog', `around the hub at ${W}x${H}: no level, toll label or Dimming clock overlaps another label or a known node's icon (screens.js declutterLabels)`, !ovl.length, ovl.slice(0, 6).join(' | '));
    const lay = fogLayout(d, W, H);
    check('N-fog', `readable at ${W}x${H}: the disc round and in view (${d.disc && d.disc[2] - d.disc[0]} px), every node inside it and at least 24 px, no signpost over a side panel`, !lay.length, lay.slice(0, 5).join(' | '));
    // a hover: the move's tooltip names the node and its tolls; a hidden node's names nothing
    const hid = mv.nodes.find((n) => n.know === 'none' && !n.shardfall && !n.road);
    const t1 = await tipOf(page, page.locator(`#screens .expmap .mnode[data-node="${hid.id}"]`));
    check('N-fog', `a hidden node's tooltip: "Unknown", its ring's levels ${mv.bands[hid.ring].join('–')} and its region (charts), nothing of its content`, /^Unknown/.test(t1) && t1.includes(`levels ${mv.bands[hid.ring][0]}–${mv.bands[hid.ring][1]}`) && !/Level \d|Foes|Wave|Click to/.test(t1), t1);
    await shot(page, 'N-fog-start');
    // the run on the engine's autoplay choices until the Dimming has spread two hops, then the map again
    const r = await page.evaluate(async () => {
      const ui = window.__ui;
      for (let n = 0; n < 600; n++) { const v = ui.view(); if (v.phase === 'SUMMARY') return false; if (v.phase === 'MAP' && v.zone && v.zone.exp && v.zone.exp.z === 1 && v.zone.exp.dim.front >= 1) return true; if (v.zone && v.zone.exp && v.zone.exp.z > 1) return false; await ui.act({ type: 'AUTO' }); await ui.idle(); }
      return false;
    });
    if (!r) throw new Error(`setup: seed ${M_SEED}'s run left zone 1 before the Dimming spread`);
    await idle(page); await page.mouse.move(2, 2);
    s = await twin.sync(page); mv = R.mapView(s);
    d = await fogDom(page); diff = fogDiff(d, mv, nextZone);
    check('N-fog', `the Dimming spread (front ${mv.dim.front}, zone toll ${mv.zt}): its wash on the ${d.wash} Dimmed nodes, "dims in N" on the ${d.nodes.filter((n) => n.clock !== null).length} nodes within two hops of the front, the rest as R.mapView`, mv.dim.front >= 1 && d.wash > 0 && !diff.length, diff.slice(0, 6).join(' | '));
    await page.waitForTimeout(2500); await shot(page, 'N-fog-dim');
    // M on the map screen: the map is already the screen, a toast says so and no second map opens
    await page.keyboard.press('KeyM'); await page.waitForTimeout(120);
    const mToast = await page.locator('#toasts .toast').allInnerTexts();
    check('N-fog', 'M on the fog map screen opens no second map and a toast says the map is the screen', !(await page.locator('#win-map').count()) && mToast.some((t) => /zone map is the screen/.test(t)), mToast.join(' | '));
    // toasts never cover an open window: bags and the quest log open, two toasts
    const toastClear = async () => page.evaluate(() => {
      const wins = [...document.querySelectorAll('#windows > .win')].map((w) => w.getBoundingClientRect());
      const ts = [...document.querySelectorAll('#toasts .toast')].map((t) => t.getBoundingClientRect());
      // under the windows: the stack's z-index below the windows' (same stacking context, #hud), so a window paints over it
      const under = document.querySelector('#toasts').classList.contains('under-wins') && Number(getComputedStyle(document.querySelector('#toasts')).zIndex) < Math.min(...[...document.querySelectorAll('#windows > .win')].map((w) => Number(getComputedStyle(w).zIndex) || 30));
      const hit = under ? [] : ts.filter((t) => wins.some((w) => t.left < w.right && t.right > w.left && t.top < w.bottom && t.bottom > w.top));
      return { n: ts.length, wins: wins.length, under, hit: hit.length };
    });
    const tw = [];
    for (const set of [['bags', 'questlog'], ['character', 'bags'], ['talents'], ['settings']]) {
      await page.evaluate(() => window.__ui.closeWins());
      for (const w of set) await page.evaluate((x) => window.__ui.openWin(x), w);
      await page.waitForTimeout(80);
      await page.evaluate(() => { window.__ui.toast('Test toast one', 'info'); window.__ui.toast('Test toast two, a longer line of text', 'good'); });
      await page.waitForTimeout(80);
      const c = await toastClear(); tw.push(`${set.join('+')}: ${c.n} toasts, ${c.hit} over a window${c.under ? ' (under the windows)' : ''}`);
      if (set[0] === 'bags') await shot(page, 'N-toast-windows');
    }
    await page.evaluate(() => window.__ui.closeWins());
    check('N-fog', 'toasts never cover an open window (bags + quest log, character + bags, talents, settings): they move aside or go under', tw.every((x) => / 0 over a window/.test(x)), tw.join(' | '));
    // M in a node of an expedition run: the fog map, read-only, in a window
    const left = await page.evaluate(async () => { const ui = window.__ui; for (let n = 0; n < 40; n++) { const v = ui.view(); if (v.phase !== 'MAP' && v.phase !== 'SUMMARY' && v.zone && v.zone.exp) return v.phase; await ui.act({ type: 'AUTO' }); await ui.idle(); } return null; });
    await idle(page); await page.keyboard.press('KeyM'); await page.waitForTimeout(150);
    const mw = await page.evaluate(() => { const w = document.querySelector('#win-map'); if (!w) return null; const r = w.getBoundingClientRect(); return { exp: w.classList.contains('expmap'), nodes: w.querySelectorAll('.mnode').length, reach: w.querySelectorAll('.mnode.reach').length, moves: !!w.querySelector('.expmoves'), r: [r.left, r.top, r.right, r.bottom].map(Math.round) }; });
    await shot(page, 'N-map-window');
    check('N-fog', `M in an expedition run off the map screen (${left}): the fog map opens read-only in a window (no moves), fully in view`, !!mw && mw.exp && mw.nodes > 10 && !mw.reach && !mw.moves && mw.r[0] >= 0 && mw.r[1] >= 0 && mw.r[2] <= W && mw.r[3] <= H, JSON.stringify(mw));
    await page.keyboard.press('KeyM');
  } catch (e) {
    await shot(page, 'N-error');
    check('-', 'part N (fog map) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part N: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ part O: the character sheet's Damage block
// Owner feedback 2026-11-11 11:58: every number of the block and the Power / Weapon damage hovers = R.damageView of a
// Node twin; a Hunter (pet line) and a Mage (no Weapon damage on Ember Bolt), in a hub and in a fight.
async function partO(browser, W, H) {
  for (const cls of ['hunter', 'mage']) {
    const { context, page, errors } = await open(browser, W, H, 'seed=12&speed=instant');
    const twin = makeTwinOpts(12, {});
    try {
      await page.locator(`#create .ccard[data-cls="${cls}"]`).click();
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) await got.first().click();
      const read = async () => {
        if (!(await page.locator('#win-character').count())) { await page.keyboard.press('KeyC'); await idle(page); }
        return page.evaluate(() => {
          const b = document.querySelector('#win-character .dmgblock'); if (!b) return null;
          const row = (sel) => { const e = b.querySelector(sel); return e ? { name: e.querySelector('.dk').textContent, range: e.querySelector('.dr').textContent, avg: e.querySelector('.da').textContent, lo: Number(e.dataset.lo), hi: Number(e.dataset.hi), mean: Number(e.dataset.avg) } : null; };
          return { pct: Number(b.querySelector('.dmbonus').dataset.pct), bonus: b.querySelector('.dmbonus .dr').textContent, main: row('.dmmain'), pet: row('.dmpet') };
        });
      };
      const cmp = (ui, dv) => {
        const out = [];
        if (!ui) return ['no Damage block'];
        if (ui.pct !== dv.pct) out.push(`bonus ${ui.pct} (engine ${dv.pct})`);
        const one = (u, x, what) => { if (!u) { out.push(`${what} missing`); return; } if (u.lo !== x.lo || u.hi !== x.hi || u.mean !== x.avg || u.range.replace(/[\s,  ]/g, '') !== `${x.lo}–${x.hi}` || !u.avg.includes(String(Math.round(x.avg * 100) / 100))) out.push(`${what} ${JSON.stringify(u)} (engine ${x.lo}-${x.hi}, ${x.avg})`); };
        one(ui.main, dv.main, dv.main.name);
        if (dv.pet) one(ui.pet, dv.pet, 'pet'); else if (ui.pet) out.push('a pet line without a pet');
        return out;
      };
      let s = await twin.sync(page); let dv = R.damageView(s);
      let ui = await read(); let diff = cmp(ui, dv);
      check('O-sheet', `${cls} at the hub: Damage bonus ${ui && ui.bonus}, ${dv.main.name} ${dv.main.lo}–${dv.main.hi} avg ${dv.main.avg}${dv.pet ? `, ${dv.pet.name} ${dv.pet.lo}–${dv.pet.hi}` : ''} = R.damageView`, !diff.length, diff.join(' | '));
      const tp = await tipOf(page, page.locator('#win-character .statgrid div').filter({ hasText: 'Power' }).first());
      const tw = await tipOf(page, page.locator('#win-character .statgrid div').filter({ hasText: 'Weapon damage' }).first());
      const n2 = (x) => (Math.round(x * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
      const wantW = dv.perWd > 0 ? `1 Weapon damage = +${n2(dv.perWd)} damage on ${dv.main.name}` : `Weapon damage does not add to ${dv.main.name}`;
      check('O-sheet', `${cls}: hovering Power and Weapon damage gives the value per point ("1 Power = +${n2(dv.perPower)} damage on ${dv.main.name}"; "${wantW}")`, tp.includes(`1 Power = +${n2(dv.perPower)} damage on ${dv.main.name}`) && tw.includes(wantW), `${tp} || ${tw}`);
      const tm = await tipOf(page, page.locator('#win-character .dmmain'));
      check('O-sheet', `${cls}: the main attack's tooltip has its crit range and chance (${dv.main.critLo}–${dv.main.critHi})`, tm.includes(`A critical hit: ${dv.main.critLo}–${dv.main.critHi}`), tm);
      const pl = await placement(page.locator('#win-character .dmgblock'));
      check('O-sheet', `${cls}: the Damage block is fully in view in the character window`, fullyShown(pl), placeText(pl));
      if (cls === 'hunter') await shot(page, 'O-sheet');
      // in a fight: the engine's numbers with the fight's buffs
      await page.keyboard.press('KeyC'); await idle(page);
      const r = await page.evaluate(async () => { const ui = window.__ui; for (let n = 0; n < 300; n++) { const v = ui.view(); if (v.combat && !v.combat.over) return true; if (v.phase === 'SUMMARY') return false; await ui.act({ type: 'AUTO' }); await ui.idle(); } return false; });
      if (!r) throw new Error('setup: no fight reached');
      s = await twin.sync(page); dv = R.damageView(s);
      ui = await read(); diff = cmp(ui, dv);
      check('O-sheet', `${cls} in a fight (round ${s.fight.round}): the block = R.damageView`, !diff.length, diff.join(' | '));
    } catch (e) {
      await shot(page, `O-error-${cls}`);
      check('-', `part O (${cls}) ran to the end`, false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', `part O (${cls}): no console errors, page errors or requests`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
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
  if (PARTS.includes('G')) await partG(browser, W, H);
  if (PARTS.includes('H')) await partH(browser, W, H);
  if (PARTS.includes('I')) await partI(browser, W, H);
  if (PARTS.includes('J')) await partJ(browser, W, H);
  if (PARTS.includes('K')) await partK(browser, W, H);
  if (PARTS.includes('L')) await partL(browser, W, H);
  if (PARTS.includes('M')) await partM(browser, W, H);
  if (PARTS.includes('N')) await partN(browser, W, H);
  if (PARTS.includes('O')) await partO(browser, W, H);
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed${bad.length ? `; failed: ${bad.map((r) => `${r.size} ${r.bug} ${r.name}`).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
