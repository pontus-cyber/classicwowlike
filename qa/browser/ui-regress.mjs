#!/usr/bin/env node
/**
 * qa/browser/ui-regress.mjs - regression checks for the UI bugs fixed on 2026-11-09
 * (qa/bugs.md BUG-QA-01, 02, 03, 04, 05, 08, 09, 10, 11), for the M2 v2 UI changes (docs/specs/changes-m2-v2.md:
 * map rows from the engine, travel on early, Linked per Shard, the round time budget) and for the M2 v3 UI changes
 * (docs/specs/changes-m2-v3.md: zone danger, Second Breath not in the final fight, Ricochet Bolt at 40 %).
 *
 *   node tools/build.mjs --out /tmp/ui-game.html
 *   node qa/browser/ui-regress.mjs [--file /tmp/ui-game.html] [--sizes 1366x768,1920x1080] [--shots dir] [--parts A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S]
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
 *      beside the panel, covering nothing; since M3 hint H01 on the coach line: "Got it" stores it (tbwcr.hints.v2 seen
 *      H01:rogue; a wind-up's H03 may come first, higher priority), a new Rogue run has none, a first Mage run
 *      has it until W. (4) a Healing Draught pulses at 30 % health, not at 50 % or on cooldown, and is never drunk for the
 *      player. (5) "Killed by" names Crown-Breaker, not its id; every content ability reads by its name. (6) the settings
 *      window shows Animation speed's four choices whole.
 *   M  the start camp and the contract tracker (docs/specs/expedition.md 9.1, 9.3; engine-api.md 13; M2b 2b.6), real engine
 *      at Instant speed, ?prep=1, seed 7. Class select's Enter opens the camp and a second Enter at once does not set out;
 *      the prep screen's numbers (points left, each offer's zone, price and sites, each option's price, bought and owned
 *      state, the held list, Reserve = N points = M Echoes) equal R.prepView of a Node twin (the page's engine log) after a
 *      click and the keys 2, A, C, R (no reroll: D128), a drop, a sell, a buy and key 3; D128 (a lean camp): 3 cards side by side
 *      and at most 4 options, no reroll button, a card's headline, one line of what to do and the pay in one line; Set out,
 *      every card and option fully in view; a contract's
 *      and an option's tooltip; Enter sets out (contracts and Reserve = R.contractView); on the map the tracker shows this
 *      zone's contracts (title, "N / M sites") clear of the zone map, site marks on exactly mapView's nodes, hidden ones
 *      unnamed; the quest log lists every contract; zone 2's hub (Dev menu Start at) shows its offer and Take pays from
 *      Reserve. Then seed 1 on the engine's autoplay choices to a completed contract: its reward window (title, +XP and gold
 *      = the engine's events, the item cards) and the choice. No console errors.
 *   N  the fog map (docs/specs/expedition.md 4-6, 9.2; M2b 2b.6; D128: icons about 70 %, text labels only on the player's
 *      node, the reachable nodes and contract sites, a quiet node's clock as its number), real engine at Instant speed, ?prep=1, seed M_SEED with
 *      Region Charts: every node's fog state (seen, remembered, type known, unknown), level, enemy count, site marks and moves,
 *      the region tints and rim names, the Roads' signposts, the Shardfall, the Dimming's wash and "dims in N" clocks = R.mapView
 *      of a Node twin (nothing the view hides is drawn); the disc round, in view and readable; again once the Dimming spread.
 *   O  the character sheet's Damage block (owner feedback 2026-11-11 11:58): bonus, main attack and pet ranges and averages, the
 *      Power and Weapon damage hovers = R.damageView of a Node twin, Hunter and Mage, at the hub and in a fight.
 *   P  the Deathblow (docs/specs/changes-m2b-v13.md "UI needs"; engine-api.md 6.2), real engine at Instant speed, Dev menu fights
 *      against the zone-2 elite Bargh the Drowned King; every number from a Node twin of the page's engine log (R.windupView,
 *      R.autoplayEngage, R.potionInfo, the statuses). Hunter: in the engage round the Deathblow's badge over the enemy (round,
 *      estimate, "MAIMS if it lands"), its chip, row and ruler round = windupView; the engage cards that answer it and the
 *      answers named on the badge = windupView's engage answers (keys, sure); the autoplay hint = R.autoplayEngage; round 2:
 *      "No answer ready" in red (ready false); landed: MAIMED on the player frame, the potion's cut amount on its button and
 *      tooltip = R.potionInfo (half the amount before), "Deathblow +100 % dmg" on the nameplate and target frame, the log line.
 *      Rogue: Sap marked a chance, Throat Jab kept for round 3 ("R3"), then answering now; its key answers it ("Deathblow
 *      answered"). The map tooltips of elite and dungeon nodes name the Deathblow and its kind = mapView. A loaded state with
 *      a first meeting shows "New" on that enemy only. M2b v14 (changes-m2b-v14.md "UI needs" 1-3): against the lone elite
 *      Sap's card reads "Sure if you wait: ..." (windupView `wait`); the Rogue's autoplay hint "..., then wait a round"
 *      (autoplayEngage `wait`); after Sap, round 2's Pass button has the answer ring, the line names "X Pass" and the prompt
 *      says to wait; X: Sap cancels the Deathblow and the Rogue stays in STEALTH; a hidden elite's map line has its type only.
 *      QA 2026-11-12 (playtest findings 2, 3, 4, 8): in that waiting round the chip, the row and the ruler say "If you wait"
 *      (the row "answered if you wait"), not ANSWERED, the line and the prompt warn "Attacking breaks Sap: the Deathblow will
 *      land", the attack button is marked "Breaks Sap"; once Sap cancels it, no "If you wait". A loaded state with health
 *      under the Deathblow's estimate and MAIMED: LETHAL on the line, the chip, the row and the prompt, whose heal hint names
 *      the potion's cut amount (R.potionInfo); none when the estimate is under health. A Deathblow aimed at the pet (loaded
 *      state): "MAIMS you if it hits your pet" on the line, the row and the alert (the engine lands it on a pet hit, s07d).
 *      At speed 1, a landed Deathblow's "Deathblow landed: empowered" and "Maimed: healing −50 %" sit in their own lane and
 *      overlap no damage number, pet number, Dodge or other float shown at the same time (window.__ui.floats()).
 *   Q  sound (docs/specs/audio.md; D127), real engine, the cue log of window.__ui.audio() and a count of AudioContexts made.
 *      Before any gesture (steps sent through window.__ui only): a new run to its first level-up and a Deathblow that lands
 *      on a Hunter log levelUp, deathblowTelegraph (once, before it lands), deathblowLanded and maimed, and nothing sounds:
 *      no AudioContext, every entry sound false. Then a click: the context exists, uiClick sounds. A Rogue answers the
 *      Deathblow (deathblowAnswered); in god mode at 4x, attacks until a crit and a kill (hitLight or hitHeavy, crit, kill,
 *      all sounding); a Mage passes until it dies (playerDeath). Every Instant step keeps at most one cue that is not a
 *      Deathblow cue or the death. The Dimming (cue 10): a Rogue's expedition run in zone 1 logs dimmingSpread in exactly
 *      the steps where the front reached new nodes near the player (the rule worked out from the two map views), and it
 *      sounds unless a higher-ranked cue of the same Instant step won. No console errors.
 *
 *   R  the guided first run and the first-time hints (M3 3.5; m3-onboarding.md 2.4-2.7, 3, 4.3, 7.1): see partR. The parts
 *      before R open with the guide off (?guide=0) and the hints off (tbwcr.hints.v2), part L(3) with hints on (H01).
 *      R(6)-(7), D142 (M3 3.7, playtest-2026-11-13 findings 2-5): G3's key, the turn prompt under a coach line, a refused
 *      key's reason, the Mage's "Q then N", a hint seen after two showings.
 *   S  M3 3.7: the D143 UI to-dos and the blind tester panel of 2026-11-13 (D144; docs/handoffs/ui-2026-11-13d.md items
 *      1-10) and the UI needs of docs/handoffs/engine-2026-11-13d.md (checks D144-n): see partS.
 *
 * D116 (the flip): new runs start on the expedition map with the start camp. The parts written for the classic map (A-L, O,
 * P) open the page with ?classic=1 (open() adds it unless the query names a map) and their Node twins pass mapMode 'rows';
 * part I's expedition run (?expedition=1) is the expedition without the start camp (twin prep: false); M and N use ?prep=1.
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
import { HEAT_WORDS, tolls, ECHO_LINE, deathblowKind, deathblowAnswers, sapWaitText } from '../../src/ui/ui-text.js';
import { RANK as Q_RANK, DIM_NEAR as Q_DIM_NEAR } from '../../src/ui/audio.js';
import { MAP_LINES, ROADS_OPEN_LINE, fillLine } from '../../src/ui/onboarding.js'; // D143: the beat lines that wait for the map on screen; the Roads' toast
const ONB_HINT_SHOWS = R.C.ONB_HINT_SHOWS; // D142 (3): showings after which a hint counts as seen (src/constants.js since D143)

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(arg('--file', '/tmp/ui-game.html'));
const SIZES = arg('--sizes', '1366x768,1920x1080').split(',').map((s) => s.split('x').map(Number));
const SHOTS = arg('--shots', null);
const PARTS = arg('--parts', 'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S').split(',');
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
const HINTS_KEY = 'tbwcr.hints.v2'; // first-time hints (src/ui/onboarding.js, m3-onboarding.md 3.1)

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
/**
 * A page of the build. profile: a meta profile stored where the game reads it (localStorage) before it loads. D116: new
 * runs start on the expedition map with the start camp; the parts written for the classic map get ?classic=1 here unless
 * the query names a map (prep=1, expedition=1, classic=) or the mock engine.
 */
async function open(browser, W, H, query, profile = null, opts = {}) {
  if (!/(^|&)(prep|expedition|classic|mock|fresh)=/.test(query)) query += '&classic=1';
  // M3 (part R): the parts written before the guided run open with the guide off (?guide=0) and the first-time hints off
  // (tbwcr.hints.v2 stored as off, unless the page stored its own), so their seeds and screens are as before
  if (!opts.guide && !/(^|&)guide=/.test(query)) query += '&guide=0';
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  if (profile) await context.addInitScript(([key, json]) => { try { localStorage.setItem(key, json); } catch { /* storage blocked */ } }, [PROFILE_KEY, JSON.stringify(profile)]);
  if (!opts.hints) await context.addInitScript((key) => { try { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ off: true, seen: {} })); } catch { /* storage blocked */ } }, HINTS_KEY);
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
  let twin = R.newRun({ classId: 'rogue', seed: SEED, content: CONTENT, mapMode: 'rows' });
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
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
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
  let s = R.newRun({ classId: 'rogue', seed: E_SEED, content: CONTENT, profile, mapMode: 'rows' });
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
      Math.abs(step - R.C.ZONE_DANGER_STEP) < 1e-9 && mm3.includes(rule), `${mm3} (wanted "${rule}")`);

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
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, profile, mapMode: 'rows' });
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
  let next = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: F_NEXT_SEED, content: CONTENT, profile: bought, mapMode: 'rows' });
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
    let tw = R.newRun({ classId: 'hunter', petId: 'ridgewolf', seed: 11, content: CONTENT, profile: R.buyMeta(p, 'oaths'), mapMode: 'rows' });
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
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, profile, mapMode: 'rows' });
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
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' }); let n = 0;
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
  let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows', ...opts }); let n = 0;
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
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
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
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'expedition', prep: false });
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
  const rec = window.__heat || (window.__heat = { states: [], toasts: [], logs: [], kinds: {}, raised: [], maxHeat: 0, maxAll: 0 });
  if (!window.__heatObs) {
    window.__heatObs = new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.classList && [...n.classList].some((c) => c.startsWith('heat-'))) rec.toasts.push({ text: n.textContent, cls: n.className });
      const all = [...document.querySelectorAll('#toasts .toast')];
      rec.maxAll = Math.max(rec.maxAll, all.length); rec.maxHeat = Math.max(rec.maxHeat, all.filter((t) => /\bheat-/.test(t.className)).length);
    });
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
    const note = await page.locator('#heat-intro').evaluate((el) => ({ shown: !el.classList.contains('hidden') }));
    await shot(page, 'I-hub');
    let d = await meterDom(page); let diff = meterDiff(d, hv, false);
    check('M2b-heat', `hub (${s.time} tolls): the meter shows R.heatView: ${HNAME[hv.state]}, "${stand(hv)}", "${bossTxt(hv.ascIfPar)}", the marker at ${hv.bar.marker} and the Star's line at 0 on a ${R.C.HEAT_BAR_MIN} to ${R.C.HEAT_BAR_MAX} toll bar`, !diff.length, diff.join(' | ') || JSON.stringify(d));
    check('M3-U4', 'the old first-time note is retired (m3-onboarding.md 3.3: hint H16 on the coach line): none on the first hub', !note.shown, JSON.stringify(note));
    const svc = [];
    for (const service of ['trainer', 'vendor', 'inn']) {
      const card = page.locator('#screens .svc-card', { has: page.locator('.nm', { hasText: { trainer: 'Trainer', vendor: 'Vendor', inn: 'Inn' }[service] }) });
      const p = R.heatPreview(s, { type: 'SERVICE', service });
      const chip = await card.locator('.hrs').evaluate((el) => ({ text: el.textContent, hs: el.dataset.hs || null }));
      const r = await hoverHeat(page, card);
      svc.push(`${service}: ${previewDiff(r, p, { chip }).join(', ') || 'ok'}`);
    }
    check('M2b-heat', 'hub: each service card\'s toll label, tooltip ("1 toll, ends Calm", what follows) and the ghost on the meter equal R.heatPreview(SERVICE)', svc.every((x) => x.endsWith('ok')), svc.join(' | '));
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
    // QA playtest 2026-11-11 finding 6: the log line is the toast's sentence with one full stop, never ".."
    const sentence = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
    check('M2b-heat', 'the combat log has a line for each change of state, the toast\'s sentence with one full stop (no "..")', rec.logs.length === rec.toasts.length && rec.logs.every((l, i) => l === sentence(rec.toasts[i].text) && !/\.\.$/.test(l)),
      rec.logs.slice(0, 6).join(' | '));
    // QA playtest 2026-11-11 finding 1: one heat toast at a time (a later change replaces it), the stack within its limit
    check('M2b-heat', `heat toasts never stack: at most one on screen and at most 2 toasts in all during the run (seen: ${rec.maxHeat} heat, ${rec.maxAll} in all)`, rec.maxHeat === 1 && rec.maxAll <= 2, '');

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
  const twin = makeTwinOpts(I_EXP_SEED, { mapMode: 'expedition', prep: false });
  const { context, page, errors } = await open(browser, W, H, `seed=${I_EXP_SEED}&speed=instant&expedition=1`);
  try {
    await page.locator('#create .ccard[data-cls="hunter"]').click();
    await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
    let s = await twin.sync(page); let hv = R.heatView(s);
    let d = await meterDom(page); let diff = meterDiff(d, hv, false);
    check('M2b-heat-exp', `expedition hub (mapMode ${s.mapMode}): the Dimming's marker and "Dimming: ${tolls(hv.dimIn)}"; the line sets the state (by ${hv.by})`, s.mapMode === 'expedition' && !diff.length && d.dimShown && hv.by === 'run', diff.join(' | ') || JSON.stringify(d));
    await page.getByRole('button', { name: 'Set out' }).click(); await idle(page); // M3: the Furnace note is retired (H16), no "Got it" here
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
        return { idx: e.idx, name: e.name, ability: x.name, turn: x.turn, heavy: !!x.heavy, spellId: id, slot, deathblow: !!x.deathblow };
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
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
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
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
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
const jStack = (e, id) => { const st = (e.st || []).find((x) => x.id === id); return st ? { id, stacks: st.stacks, value: st.value, deathblows: st.deathblows || 0 } : null; };
/** M2b v13: a Deathblow's words where an ordinary wind-up's stood ("Deathblow R3", "Deathblow answered: ..."). */
const jWord = (x) => (x && x.deathblow ? 'Deathblow' : 'Wind-up');
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
    let s = R.newRun({ classId: 'rogue', seed, content: CONTENT, mapMode: 'rows' });
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
  const wst = (root) => [...root.querySelectorAll('.wstk .wst')].map((b) => ({ id: b.dataset.id, stacks: Number(b.dataset.stacks), value: Number(b.dataset.value), text: b.textContent, part: b.dataset.part || '' }));
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
  // M2b v13: EMPOWERED's Deathblow share is its own badge ("Deathblow +100 % dmg"): per status, the badges' stacks and values
  // add up to the engine's, each badge states its own share, and a Deathblow badge exactly when EMPOWERED has deathblows (the
  // engine counts them on STAGGERED too; an answered one is a plain Staggered badge)
  const same = (page, w) => w.length === new Set(page.map((p) => p.id)).size && w.every((x) => {
    const mine = page.filter((p) => p.id === x.id);
    return mine.length && mine.reduce((a, p) => a + p.stacks, 0) === x.stacks && Math.abs(mine.reduce((a, p) => a + p.value, 0) - x.value) < 1e-6
      && mine.every((p) => p.text.includes(`${x.id === 'EMPOWERED' ? '+' : '−'}${jPct(p.value)} dmg`)) && mine.some((p) => p.part === 'deathblow') === (x.id === 'EMPOWERED' && x.deathblows > 0);
  });
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
    check('M2b-2b.6', `engage round of the ${s.fight.kind} fight: the wind-up badge is on exactly the entries the engine flags (chips, target frame), and over ${a.name}: "${jWord(wx)} R${wRound}: ${wx.deathblow ? 'MAIMS if it lands' : 'answer it or it empowers'}"`,
      !bad.length && line && line.turn === wx.turn && line.text.includes(`${jWord(wx)} R${wRound}`) && line.text.includes(wx.deathblow ? 'MAIMS if it lands' : 'answer it or it empowers'), `${bad.join(' | ')}; line ${JSON.stringify(line)}`);
    const col = d.ruler.find((c) => c.round === wRound);
    check('M2b-2b.6', `the opening ruler marks round ${wRound} "${jWord(wx)}"`, wRound > 5 || (col && col.wu === jWord(wx)), JSON.stringify(d.ruler));
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
    const wEmp = wx.deathblow ? R.C.DEATHBLOW_EMPOWER : R.C.EMPOWER_DMG; // M2b v13: a Deathblow's stakes
    check('M2b-2b.6', `hovering the wind-up: its tooltip gives the round, the stakes (−${jPct(R.C.STAGGER_DMG)} / +${jPct(wEmp)}${wx.deathblow ? ', MAIMED' : ''}) and what answers it${wx.heavy ? ' (heavy: a full dodge, a ward or the pet too)' : ''}; the bar marks the spells that can (slots ${wantHl.join(',') || 'none'})`,
      tip.includes(`${jWord(wx)}, round ${wRound}`) && tip.includes(`−${jPct(R.C.STAGGER_DMG)}`) && tip.includes(`+${jPct(wEmp)}`) && (!wx.deathblow || tip.includes(`MAIMED: healing you receive −${jPct(R.C.MAIM_HEAL)}`)) && tip.includes(J_ANSWERS.control) && !tip.includes('Disrupt') && tip.includes('full dodge') === !!wx.heavy
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
      const logOk = answered.log.some((l) => l.startsWith(`${jWord(wx)} answered: ${a.name}'s ${wx.name}`) && l.includes(`Staggered: −${jPct(R.C.STAGGER_DMG)} damage`));
      check('M2b-2b.6', `answered: the STAGGERED badge on ${a.name} (nameplate and target frame) equals the engine's status, and the log says "${jWord(wx)} answered"`, !bad.length && logOk, `${bad.join(' | ')}; log ${answered.log.slice(-4).join(' / ')}`);
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
      const ldb = jStack(landed.e, 'EMPOWERED').deathblows > 0; // M2b v13: a landed Deathblow, +DEATHBLOW_EMPOWER
    check('M2b-2b.6', `landed: the EMPOWERED badge on ${landed.e.name} equals the engine's status (+${jPct(jStack(landed.e, 'EMPOWERED').value)} dmg${ldb ? ', a Deathblow badge' : ''}) and the log says "${ldb ? 'Deathblow' : 'Wind-up'} landed"`,
        !bad.length && landed.log.some((l) => l.startsWith(`${ldb ? 'Deathblow' : 'Wind-up'} landed: ${landed.e.name}'s`) && l.includes(`Empowered: +${jPct(ldb ? R.C.DEATHBLOW_EMPOWER : R.C.EMPOWER_DMG)} damage`)), `${bad.join(' | ')}; log ${landed.log.slice(-4).join(' / ')}`);
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
        !bad.length && answered.log.some((l) => l.startsWith(`${jWord(dx)} answered: ${boss.name}'s ${dx.name} is cancelled by your Disrupt`)), `${bad.join(' | ')}; ${answered.log.slice(-3).join(' / ')}`);
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
    check('UX-1', `turn prompt on the wind-up round: "${jWord(w)} now: answer with ${w.slot + 1} ${spName}", the bar framed as your turn, in view and covering no bar button`,
      tp.shown && tp.kind === (w.deathblow ? 'deathblow' : 'windup') && tp.text.includes(`${jWord(w)} now: answer with ${w.slot + 1} ${spName}`) && tp.turn && tp.inView && !tp.overBar, JSON.stringify(tp));
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
    check('M2b-2b.6', `key ${w.slot + 1} casts ${spName} on ${w.name}: the wind-up is stopped ("${jWord(w)} answered: ${w.name}'s ${w.ability} is stopped by your ${spName}") and the STAGGERED badge equals the engine's status`,
      !!sent && sent.type === 'CAST' && sent.spellId === w.spellId && !!st && !bad.length && log.some((l) => l.startsWith(`${jWord(w)} answered: ${w.name}'s ${w.ability} is stopped by your ${spName}.`)),
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
  // ---- (3) the first-fight hint, since M3 hint H01 on the coach line (m3-onboarding.md 3.2, 3.3): once per class in this
  // browser's saved game (tbwcr.hints.v2 seen['H01:<class>']); (4) the low-health potion pulse
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=16&speed=instant', null, { hints: true });
    const toFight = async () => { for (let i = 0; i < 200; i++) { const v = await view(page); if (v.round && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); } };
    const newRun = async (cls) => {
      await page.goto(`${URL}?seed=16&speed=instant&classic=1&guide=0`); await page.waitForFunction(() => window.__ui);
      await page.locator(`#create .ccard[data-cls="${cls}"]`).click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await toFight();
    };
    const coachNow = () => page.evaluate(() => window.__ui.coach().shown);
    const stored = async () => JSON.parse((await page.evaluate((k) => localStorage.getItem(k), HINTS_KEY)) || '{}');
    try {
      const hint = page.locator('#coach');
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await toFight();
      const twin = makeTwin(16); twin.s.create.classId = 'rogue';
      const s = await twin.sync(page);
      // a higher-priority hint of the same round (spec 2.5: a wind-up's H03 before the engage round's H01) comes first;
      // H01 waits one step and shows when that one is put away
      let first = await coachNow();
      if (first && first.id !== 'H01' && first.kind === 'hint') { await page.locator('#coach .co-ok').click(); await idle(page); }
      const sh = await coachNow();
      const keys = await page.locator('#coach .co-t .kbd').evaluateAll((els) => els.map((e) => e.textContent));
      const hp = await placement(hint);
      const clear = await page.evaluate(() => {
        const r = document.getElementById('coach').getBoundingClientRect();
        const hit = (q) => [...document.querySelectorAll(q)].filter((x) => x.offsetParent).some((x) => { const b = x.getBoundingClientRect(); return b.width && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom); });
        return { engage: hit('#engage'), target: hit('#target-frame'), np: hit('#nameplates .np'), ruler: hit('#ruler'), bar: hit('#actionbar') };
      });
      await shot(page, 'L-hint');
      check('OWN-L', `Rogue's first engage round: hint H01 on the coach line${first && first.id !== 'H01' ? ` (after ${first.id}, higher priority)` : ''}, one line with the keys Q, W, E (content line, keys from the key map)`,
        R.isEngageRound(s) && fullyShown(hp) && sh && sh.id === 'H01' && keys.join(',') === 'Q,W,E' && /^Round 1 is yours: they act from round 2\. Open with Q, W or E\.$/.test(sh.text), `${placeText(hp)} ${JSON.stringify(sh)} keys ${keys}`);
      check('OWN-L', 'the coach line covers no engage card, target frame, nameplate, opening ruler or action bar', !clear.engage && !clear.target && !clear.np && !clear.ruler && !clear.bar, JSON.stringify(clear));
      await page.locator('#coach .co-ok').click(); await idle(page);
      const st1 = await stored();
      check('OWN-L', '"Got it" hides it and stores it for the Rogue (tbwcr.hints.v2 seen H01:rogue)', (await coachNow() || {}).id !== 'H01' && st1.seen && st1.seen['H01:rogue'] === true, JSON.stringify(st1.seen));
      await newRun('rogue');
      check('OWN-L', 'a new Rogue run (page reloaded): its first engage round shows no H01', (await view(page)).round === 1 && (await coachNow() || {}).id !== 'H01', JSON.stringify(await coachNow()));
      await newRun('mage');
      const shownMage = (await coachNow() || {}).id === 'H01';
      await page.keyboard.press('KeyW'); await idle(page);
      const st2 = await stored();
      check('OWN-L', 'a first Mage run shows H01; opening with W (ENGAGE) puts it away and stores it for the Mage too', shownMage && (await coachNow() || {}).id !== 'H01' && st2.seen['H01:mage'] === true, JSON.stringify(st2.seen));
      await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ off: true, seen: {} })), HINTS_KEY); // (4) below without hints
      await page.goto(`${URL}?seed=16&speed=instant&classic=1&guide=0`); await page.waitForFunction(() => window.__ui);
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
      let s = R.newRun({ classId: 'rogue', seed: 1, content: CONTENT, mapMode: 'rows' });
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
      cards: [...document.querySelectorAll('#prep .pp-card')].map((b) => ({ zone: b.querySelector('.pc-zone').textContent, price: b.querySelector('.pc-price').textContent, do: b.querySelector('.pc-do').textContent, taken: b.classList.contains('taken') })),
      opts: [...document.querySelectorAll('#prep .pp-opt')].map((b) => ({ id: b.dataset.id, price: (b.querySelector('.pc-price') || {}).textContent || null, bought: b.classList.contains('bought'), owned: b.classList.contains('owned') })),
      held: document.querySelectorAll('#prep .pp-card.taken').length,
    }));
    // D128: what to do in one line: "Win 2 sites in <region>", "Hunt it down in <region>", the dungeon cleared
    const doWant = (o) => (o.kind === 'delve' ? 'Clear the dungeon, its boss included' : o.kind === 'bounty' ? `Hunt it down in ${o.regionName}` : `Win ${o.need} ${o.need === 1 ? 'site' : 'sites'} in ${o.regionName}`);
    const domDiff = (d, x) => {
      const out = [];
      if (d.left !== String(x.left)) out.push(`points left ${d.left} (engine ${x.left})`);
      if (!d.reserve.includes(`${x.reserve.points} ${x.reserve.points === 1 ? 'point' : 'points'} = ${x.reserve.echoes} Echoes`)) out.push(`reserve "${d.reserve}" (engine ${x.reserve.points} = ${x.reserve.echoes})`);
      if (d.cards.length !== x.board.length) out.push(`${d.cards.length} cards (engine ${x.board.length})`);
      if (d.opts.length !== x.options.length) out.push(`${d.opts.length} options (engine ${x.options.length})`);
      x.board.forEach((o, i) => { const c = d.cards[i]; if (!c || c.zone !== `Zone ${o.z}` || c.price !== String(o.price) || c.do !== doWant(o) || c.taken !== o.taken) out.push(`card ${i + 1} ${JSON.stringify(c)} (engine zone ${o.z}, ${o.price}, ${o.need}, taken ${o.taken})`); });
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
    for (const sel of ['#prep .pp-card', '#prep .pp-opt']) { const n = await page.locator(sel).count(); for (let i = 0; i < n; i++) { const p = await placement(page.locator(sel).nth(i)); if (!p.inside || p.clippedBy) cut.push(`${sel} ${i} ${placeText(p)}`); } }
    check('M-prep', 'every contract card and option is fully in view (nothing below the fold)', !cut.length, cut.join(' | '));
    // D128 (owner playtest 2026-11-12 20:19): a lean camp: CONTRACT_BOARD_SIZE cards side by side, the camp's options (at
    // most 4) in one row, no reroll button while R.prepView's reroll is closed
    const lean = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const cards = [...document.querySelectorAll('#prep .pp-card')].map(r); const opts = [...document.querySelectorAll('#prep .pp-opt')].map(r);
      const rr = document.getElementById('pp-reroll');
      return { cards: cards.length, row: cards.every((c, i) => Math.abs(c.top - cards[0].top) < 4 && (i === 0 || c.left >= cards[i - 1].right - 1)),
        opts: opts.length, optRow: opts.every((c, i) => Math.abs(c.top - opts[0].top) < 4 && (i === 0 || c.left >= opts[i - 1].right - 1)), below: opts.length ? opts[0].top >= Math.max(...cards.map((c) => c.bottom)) : true,
        reroll: !!rr && rr.getClientRects().length > 0 };
    });
    check('M-prep', `D128 lean camp: ${lean.cards} contract cards side by side (R.prepView ${pv.board.length} = CONTRACT_BOARD_SIZE ${R.C.CONTRACT_BOARD_SIZE}), ${lean.opts} options in one row under them (at most 4), no reroll button (reroll.open ${pv.reroll.open})`,
      lean.cards === pv.board.length && pv.board.length === R.C.CONTRACT_BOARD_SIZE && lean.row && lean.opts === pv.options.length && lean.opts <= 4 && lean.optRow && lean.below && !lean.reroll && !pv.reroll.open, JSON.stringify(lean));
    // mouse and keys: take (click), take (key 2), buy (A), buy a vision perk (C), R (no reroll since D128), drop (click the taken card)
    const steps = [['click card 1', () => page.locator('#prep .pp-card').nth(0).click()], ['key 2', () => page.keyboard.press('Digit2')],
      ['key A', () => page.keyboard.press('KeyA')], ['key C', () => page.keyboard.press('KeyC')], ['key R', () => page.keyboard.press('KeyR')],
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
    check('M-prep', `mouse and keys send TAKE, DROP, BUY, SELL and no REROLL (D128; log ${log.slice(1).join(' ')}); after each the screen = R.prepView (left ${pv.left}, held ${pv.held}, rerolls ${pv.reroll.used})`,
      !bad.length && ['TAKE_CONTRACT', 'DROP_CONTRACT', 'BUY_PREP', 'SELL_PREP'].every((t) => log.includes(t)) && !log.includes('REROLL_BOARD'), bad.join(' | '));
    // tooltips: a contract says where its sites are and what it pays; an option says what it does
    await page.mouse.move(2, 2);
    const k = pv.board.findIndex((o) => o.kind === 'cull'); const o = pv.board[k >= 0 ? k : 0];
    await page.locator('#prep .pp-card').nth(k >= 0 ? k : 0).hover(); await page.waitForTimeout(80);
    const tt1 = await page.evaluate(() => (document.querySelector('.tooltip.on') || {}).innerText || '');
    const want1 = [T.contractSentence(o, CONTENT), o.kind === 'cull' ? 'Sites: Quest or Grind nodes' : 'site', `${Math.round(o.reward.xpFrac * 10) / 10} levels of XP`];
    check('M-prep', `a contract's tooltip: its sentence, its sites and its pay (${want1[0]})`, want1.every((x) => tt1.replace(NBSP, ' ').includes(x)), tt1.replace(/\n/g, ' / '));
    const spy = pv.options.find((x) => x.id === 'prep_tracker');
    await page.locator('#prep .pp-opt[data-id="prep_tracker"]').hover(); await page.waitForTimeout(80);
    const tt2 = await page.evaluate(() => (document.querySelector('.tooltip.on') || {}).innerText || '');
    const want2 = T.prepOptionEffect(spy, { vision: R.C.VISION_RADIUS, guide: R.C.GUIDE_RADIUS_BONUS, tracker: R.C.TRACKER_RADIUS, bountyPlaced: R.C.BOUNTY_PLACED, bellMax: R.C.BELL_MAX_CHARGES, emberMax: R.C.EMBER_MAX_CARRIED }, (id) => R.C.CONSUMABLE[id].name);
    check('M-prep', `an option's tooltip says what it does in one line ("${want2}") and its refund`, tt2.includes(want2) && /full refund/.test(tt2), tt2.replace(/\n/g, ' / '));
    // QA playtest 2026-11-11 finding 5: every number on a card has its word (levels, price, sites, XP, gold, the item choice)
    const lab = await page.evaluate(() => [...document.querySelectorAll('#prep .pp-card')].map((b) => { const pay = b.querySelector('.pc-reward'); return { zone: b.querySelector('.pc-zone').textContent, price: b.querySelector('.pc-price').textContent,
      pl: (b.querySelector('.pc-pl') || {}).textContent, do: b.querySelector('.pc-do').textContent, pay: pay.innerText.replace(/\s+/g, ' '), it: (b.querySelector('.pc-reward .it') || {}).textContent, one: pay.scrollWidth <= pay.clientWidth + 1 && pay.getClientRects().length === 1 }; }));
    const lBad = pv.board.map((o, i) => { const c = lab[i] || {}; const bad = [];
      if (c.zone !== `Zone ${o.z}`) bad.push(`zone "${c.zone}"`);
      if (c.price !== String(o.price) || c.pl !== (o.price === 1 ? 'pt' : 'pts')) bad.push(`price "${c.price} ${c.pl}"`);
      if (o.kind === 'cull' && !(c.do || '').startsWith(`Win ${o.need} ${o.need === 1 ? 'site' : 'sites'} in `)) bad.push(`sites "${c.do}"`);
      if (!/^Pays /.test(c.pay || '') || !(c.pay || '').includes(`${Math.round(o.reward.xpFrac * 10) / 10} levels of XP`) || !/ gold /.test(c.pay || '')) bad.push(`pay "${c.pay}"`);
      if (!(c.it || '').startsWith(`choose 1 of ${o.reward.choices}`)) bad.push(`items "${c.it}"`);
      if (!c.one) bad.push('the pay line is cut or wraps');
      return bad.length ? `card ${i + 1}: ${bad.join(', ')}` : null; }).filter(Boolean);
    check('M-prep', 'every number on a contract card has its word: "Zone 1", "2 pts", "Win 2 sites in ...", "Pays 2.8 levels of XP", "gold", "choose 1 of 3", the pay on one uncut line (QA 2026-11-11 finding 5; D128)', !lBad.length, lBad.slice(0, 3).join(' | '));
    // QA playtest 2026-11-11 finding 4 (an engine fix, contracts.js drawBoard): no two cards are the same contract
    const keys = pv.board.map((o) => [o.z, o.kind, o.region, o.family, o.template].join('|'));
    const shown = await page.evaluate(() => [...document.querySelectorAll('#prep .pp-card')].map((b) => [b.querySelector('.pc-zone').textContent, b.querySelector('.pc-kind').textContent, b.querySelector('.pc-target').textContent, b.querySelector('.pc-do').textContent].join(' / ')));
    check('M-prep', `the board's ${keys.length} cards are ${new Set(shown).size} different offers (no two the same contract)`, new Set(keys).size === keys.length && new Set(shown).size === shown.length, shown.join(' | '));
    // QA playtest 2026-11-11 finding 7: a card's tooltip covers no other card and not Set out; an option's no other option
    const tipHits = (sel, i, avoid) => page.evaluate(([s, k, av]) => {
      const t = document.querySelector('.tooltip.on'); if (!t) return ['no tooltip'];
      const a = t.getBoundingClientRect(); const own = document.querySelectorAll(s)[k];
      return [...document.querySelectorAll(av)].filter((e) => e !== own && !e.contains(own) && e.offsetParent).filter((e) => { const r = e.getBoundingClientRect(); return r.left < a.right - 1 && r.right > a.left + 1 && r.top < a.bottom - 1 && r.bottom > a.top + 1; })
        .map((e) => e.id || `${e.className.split(' ')[0]} ${e.dataset.index || e.dataset.id || ''}`.trim());
    }, [sel, i, avoid]);
    const tBad = [];
    for (const [sel, n] of [['#prep .pp-card', pv.board.length], ['#prep .pp-opt', pv.options.length]]) {
      for (let i = 0; i < n; i++) {
        await page.mouse.move(2, 2); await page.locator(sel).nth(i).hover(); await page.waitForTimeout(50);
        const hit = await tipHits(sel, i, `${sel}, #pp-go, .btn.primary`);
        if (hit.length) tBad.push(`${sel} ${i + 1}: over ${hit.join(', ')}`);
      }
    }
    check('M-prep', 'a card\'s tooltip covers no other card and not Set out; an option\'s no other option (QA 2026-11-11 finding 7)', !tBad.length, tBad.slice(0, 4).join(' | '));
    await page.mouse.move(2, 2);
    await shot(page, 'M-prep');
    // Set out (Enter, after the guard): the purchases take effect, Reserve, zone 1's hub
    await page.waitForTimeout(750);
    await page.keyboard.press('Enter'); await idle(page);
    s = await twin.sync(page);
    const cv = R.contractView(s); const pc = await page.evaluate(() => window.__ui.view().contracts);
    check('M-track', `Enter sets out (phase ${s.phase}): the contracts and Reserve on screen = R.contractView (held ${cv.held}, Reserve ${cv.reserve})`, s.phase === 'ZONE_HUB' && same(pc, JSON.parse(JSON.stringify(cv))), JSON.stringify(pc && { held: pc.held, reserve: pc.reserve }));
    // QA playtest 2026-11-11 finding 7: a hub service's tooltip never covers Set out (or another primary button)
    const got = page.getByRole('button', { name: 'Got it' }); if (await got.count()) await got.first().click();
    const svcBad = [];
    const nSvc = await page.locator('#screens .svc-card').count();
    for (let i = 0; i < nSvc; i++) {
      const bx = await page.locator('#screens .svc-card').nth(i).boundingBox();
      for (const [fx, fy] of [[0.5, 0.5], [0.95, 0.9], [0.05, 0.9], [0.95, 0.1]]) {
        await page.mouse.move(bx.x + bx.width * fx, bx.y + bx.height * fy); await page.waitForTimeout(40);
        const hit = await tipHits('#screens .svc-card', i, '.btn.primary');
        if (hit.length) svcBad.push(`service ${i + 1} at ${fx},${fy}: over ${hit.join(', ')}`);
      }
    }
    await page.mouse.move(2, 2);
    check('M-track', `the hub's ${nSvc} service tooltips never cover Set out, wherever the pointer is on the card (QA 2026-11-11 finding 7)`, nSvc >= 3 && !svcBad.length, svcBad.slice(0, 4).join(' | '));
    // the map: the tracker pins this zone's contracts; site marks exactly where mapView has them; hidden nodes unnamed
    await page.locator('#screens .side .btn.primary').click(); await idle(page);
    s = await twin.sync(page);
    const mv = R.mapView(s); const cv2 = R.contractView(s);
    const here = cv2.contracts.filter((c) => c.z === 1 && c.status !== 'abandoned');
    const tr = await page.evaluate(() => ({ dimmed: document.querySelector('#tracker').classList.contains('dimmed'), rows: [...document.querySelectorAll('#tracker .tk-c')].map((e) => ({ id: e.dataset.contract, t: e.querySelector('.t').textContent, pr: e.querySelector('.pr').textContent })) }));
    const trBad = here.filter((c) => { const r = tr.rows.find((x) => x.id === c.id); return !r || r.t !== T.contractTitle(c, CONTENT) || r.pr !== `${c.progress} / ${c.need} ${c.need === 1 ? 'site' : 'sites'}`; });
    check('M-track', `on the map the tracker shows this zone's ${here.length} ${here.length === 1 ? 'contract' : 'contracts'} with title and progress (= R.contractView), not dimmed`, s.phase === 'MAP' && !tr.dimmed && tr.rows.length === here.length && !trBad.length, JSON.stringify(tr));
    // QA playtest 2026-11-11 finding 3: the tracker says this zone's contracts expire on leaving; the Bell asks first
    const act1 = here.filter((c) => c.status === 'active');
    const expL = await page.evaluate(() => { const e = document.querySelector('#tracker .tk-exp'); return e ? e.textContent : null; });
    check('M-track', `the tracker says this zone's ${act1.length} held ${act1.length === 1 ? 'contract expires' : 'contracts expire'} on leaving ("${expL}")`, act1.length > 0 && expL === (act1.length === 1 ? 'Expires when you leave this zone' : `${act1.length === 2 ? 'Both' : `All ${act1.length}`} expire when you leave this zone`), expL);
    const nLog = () => page.evaluate(() => window.__ui.engineLog().length);
    const n0 = await nLog();
    const wantWarn = `${act1.length === 1 ? '1 contract' : `${act1.length} contracts`} here will expire: ${act1.map((c) => `${T.contractTitle(c, CONTENT)} (${c.progress} / ${c.need} ${c.need === 1 ? 'site' : 'sites'})`).join('; ')}`;
    await page.locator('.expmap [data-leave="RING_BELL"]').hover(); await page.waitForTimeout(80);
    const bellTip = await page.evaluate(() => ((document.querySelector('.tooltip.on') || {}).innerText || '').replace(/\s+/g, ' '));
    await page.locator('.expmap [data-leave="RING_BELL"]').click(); await idle(page);
    const warnTxt = (await page.locator('.expmap .leavewarn').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const n1 = await nLog();
    await shot(page, 'M-leave');
    await page.locator('.expmap .leavewarn').getByRole('button', { name: 'Stay' }).click(); await idle(page);
    const gone1 = !(await page.locator('.expmap .leavewarn').count()); const n2 = await nLog();
    await page.locator('.expmap [data-leave="RING_BELL"]').click(); await idle(page);
    const again = await page.locator('.expmap .leavewarn').count();
    await page.keyboard.press('Escape'); await idle(page);
    const gone2 = !(await page.locator('.expmap .leavewarn').count()); const n3 = await nLog();
    check('M-track', `Ring the Bell holding a contract of this zone: the tooltip warns and a prompt names what expires ("${wantWarn}") before anything is sent; Stay and Esc send nothing`,
      bellTip.includes(wantWarn) && warnTxt.includes(wantWarn) && n1 === n0 && gone1 && n2 === n0 && again === 1 && gone2 && n3 === n0, JSON.stringify({ bellTip, warnTxt, n: [n0, n1, n2, n3], gone1, again, gone2 }));
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
    // the prompt's "anyway" rings the Bell: the zone's held contracts expire (the engine's rule)
    await page.locator('.expmap [data-leave="RING_BELL"]').click(); await idle(page);
    await page.locator('.expmap .leavewarn').getByRole('button', { name: 'Ring the Bell anyway' }).click(); await idle(page);
    s = await twin.sync(page);
    const lastA = await page.evaluate(() => window.__ui.engineLog().slice(-1)[0].type);
    const expd = R.contractView(s).contracts.filter((c) => act1.some((x) => x.id === c.id)).map((c) => c.status);
    check('M-track', `"Ring the Bell anyway" sends RING_BELL (${lastA}); the zone's contracts then expire (${expd.join(', ')})`, lastA === 'RING_BELL' && expd.length === act1.length && expd.every((x) => x === 'expired'), JSON.stringify({ lastA, expd }));
    // the hub contract: a run at zone 2's hub (Dev menu Start at, the start camp left with every point as Reserve)
    await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, mapMode: 'expedition', prep: true })); await idle(page);
    s = await twin.sync(page);
    const off = R.contractView(s).hub;
    const hc = await page.evaluate(() => { const e = document.querySelector('.hubc'); return e ? { s: e.querySelector('.hc-s').textContent, take: e.querySelector('[data-hub="reserve"]').textContent, pay: e.querySelector('.hc-rw').innerText.replace(/\s+/g, ' ') } : null; });
    check('M-hub', `zone 2's hub shows its contract offer (${off ? T.contractTitle(off, CONTENT) : 'none'}) with its price in Reserve and its pay with words ("${hc && hc.pay}")`, !!off && !!hc && hc.s === T.hubOfferSentence(off, CONTENT.zones[1].hubName, CONTENT) && hc.take.includes(`${off.price} Reserve`)
      && /^Pays /.test(hc.pay) && hc.pay.includes(`${Math.round(off.reward.xpFrac * 10) / 10} levels of XP`) && / gold /.test(hc.pay) && hc.pay.includes(`choose 1 of ${off.reward.choices}`), JSON.stringify(hc));
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
    // D144 (engine-2026-11-13d UI need 10; casual s0079: "Contracts 1/4" read "0/4" after one was done): the header says slots
    // (held of CONTRACT_SLOTS, R.contractView) and the contracts done
    const hd = await page.evaluate(() => { const e = document.querySelector('#tracker .tk-ch'); const cv = window.__ui.view().contracts; return { text: e ? e.textContent : null, held: cv.held, slots: cv.slots, reserve: cv.reserve, done: cv.contracts.filter((c) => c.status === 'complete').length }; });
    check('D144-10', `the tracker's contract header after one is done: "Contract slots ${hd.held}/${hd.slots} · ${hd.done} done · Reserve ${hd.reserve}" (R.contractView)`, hd.done >= 1 && hd.text === `Contract slots ${hd.held}/${hd.slots} · ${hd.done} done · Reserve ${hd.reserve}`, JSON.stringify(hd));
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
      quiet: n.classList.contains('quiet'), text: (() => { const c = n.querySelector('.cl'); const cs = getComputedStyle(c); return cs.display !== 'none' && parseFloat(cs.fontSize) > 0; })(),
      clockText: n.querySelector('.xclock') ? n.querySelector('.xclock').textContent : null, foesShown: !!n.querySelector('.xfoes') && n.querySelector('.xfoes').getClientRects().length > 0,
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
    // D144 (engine-2026-11-13d UI need 5): an elite's label is its own level (mapView `level`), not the node's
    const lvl = n.type === 'elite' && n.level ? n.level : n.cl;
    if (n.know === 'full' && !n.hub && n.cl && e.label !== String(lvl)) out.push(`seen node ${n.id} level ${e.label} (view ${lvl})`);
    const foes = n.know === 'full' && !n.hub && !n.done && n.type !== 'dungeon' && n.archetypes && n.archetypes.length ? n.archetypes.length : null;
    if (e.foes !== foes) out.push(`node ${n.id} enemy count ${e.foes} (view ${foes})`);
    const clock = !mv.dim.off && !n.dimmed && Number.isFinite(n.dimsIn) && (hs[n.id] <= front + 2 || (n.id === mv.pos && n.dimsIn <= 2)) ? n.dimsIn : null;
    if (e.clock !== clock) out.push(`node ${n.id} clock ${e.clock} (view ${clock}: dimsIn ${n.dimsIn}, ${hs[n.id]} hops from the Shardfall, front ${front})`);
    if (e.reach !== moves.has(n.id)) out.push(`node ${n.id} reachable ${e.reach}`);
    if (e.here !== (n.id === mv.pos)) out.push(`node ${n.id} here ${e.here}`);
    if (e.dimmed !== !!n.dimmed) out.push(`node ${n.id} dimmed ${e.dimmed}`);
    if ((e.sites || null) !== (n.sites ? n.sites.join(',') : null)) out.push(`node ${n.id} sites ${e.sites} (view ${n.sites})`);
    // D128: text labels only on the player's node, the reachable nodes and contract sites; a clock in full ("dims in N")
    // on the player's node and the reachable ones, its number alone elsewhere; an enemy count only where labels show
    const loud = n.id === mv.pos || moves.has(n.id) || !!(n.sites && n.sites.length);
    if (e.quiet === loud || (!loud && e.text) || (!loud && e.foesShown)) out.push(`node ${n.id} labels: quiet ${e.quiet}, text ${e.text}, foes shown ${e.foesShown} (loud ${loud})`);
    if (clock !== null) {
      const want = n.id === mv.pos && n.dimsIn <= 2 ? `Dims in ${n.dimsIn}!` : n.id === mv.pos || moves.has(n.id) ? `dims in ${n.dimsIn}` : String(n.dimsIn);
      if (e.clockText !== want) out.push(`node ${n.id} clock "${e.clockText}" (want "${want}")`);
    }
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
/** The disc is round and in view, every node inside it and big enough to read (D128: smaller icons), no signpost on a side panel. */
function fogLayout(d, W, H) {
  const out = [];
  const [l, t, r, b] = d.disc || [0, 0, 0, 0];
  if (!d.disc || Math.abs((r - l) - (b - t)) > 2 || l < 0 || t < 0 || r > W || b > H) out.push(`disc ${d.disc}`);
  if ((r - l) < 0.45 * H) out.push(`disc ${r - l} px high, under 45 % of the window`);
  // D128: icons about 70 % of before: at least 24 px (an unknown "?" marker 18 px)
  for (const n of d.nodes) { const [nl, nt, nr, nb] = n.rect; if (nl < l - 4 || nt < t - 4 || nr > r + 4 || nb > b + 4) out.push(`node ${n.id} outside the disc ${n.rect}`); if (n.size < (n.fog === 'unknown' ? 18 : 24)) out.push(`node ${n.id} ${n.size} px`); }
  for (const s of d.roads) for (const p of d.sides) if (s.rect[0] < p[2] && s.rect[2] > p[0] && s.rect[1] < p[3] && s.rect[3] > p[1]) out.push(`signpost ${s.text} ${s.rect} over a side panel ${p}`);
  return out;
}
/** Labels of the fog map (level, toll label, clock) that overlap another label, or the icon of another node (a "?" marker
 * of an unknown node included since QA playtest 2026-11-11), by more than 2 px. */
const fogOverlaps = (page) => page.evaluate(() => {
  const nodes = [...document.querySelectorAll('#screens .expmap .xdisc > .mnode')];
  const labs = nodes.flatMap((n) => [...n.querySelectorAll(':scope > .mhrs, :scope > .xclock, :scope > .cl')].filter((e) => e.getClientRects().length).map((e) => ({ n: n.dataset.node, c: e.className.split(' ')[0], t: e.textContent, r: e.getBoundingClientRect() })));
  const rings = nodes.map((n) => ({ n: n.dataset.node, unknown: n.classList.contains('x-unknown'), r: n.querySelector('.ring').getBoundingClientRect() }));
  const ov = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const out = [];
  labs.forEach((a, i) => {
    for (const b of labs.slice(i + 1)) if (ov(a.r, b.r)) out.push(`${a.c} "${a.t}" of node ${a.n} on ${b.c} "${b.t}" of node ${b.n}`);
    for (const g of rings) if (g.n !== a.n && ov(a.r, g.r)) out.push(`${a.c} "${a.t}" of node ${a.n} on ${g.unknown ? 'the "?" of ' : ''}node ${g.n}`);
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
    check('N-fog', `around the hub at ${W}x${H}: no level, toll label or Dimming clock overlaps another label, a node's icon or a "?" marker (screens.js declutterLabels)`, !ovl.length, ovl.slice(0, 6).join(' | '));
    const lay = fogLayout(d, W, H);
    check('N-fog', `readable at ${W}x${H}: the disc round and in view (${d.disc && d.disc[2] - d.disc[0]} px), every node inside it and at least 24 px (an unknown marker 18 px, D128), no signpost over a side panel`, !lay.length, lay.slice(0, 5).join(' | '));
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
    // QA playtest 2026-11-11 finding 9: after the spread the outer rings' clocks and labels sit on no label, icon or "?"
    const ovl2 = await fogOverlaps(page);
    check('N-fog', `after the Dimming spread at ${W}x${H}: no level, toll label or clock overlaps another label, a node's icon or a "?" marker`, !ovl2.length, ovl2.slice(0, 6).join(' | '));
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
    // QA playtest 2026-11-11 finding 1: five heat changes at once (a zone change) leave one heat toast, the final state
    await page.waitForFunction(() => !document.querySelector('#toasts .toast'), null, { timeout: 12000 }).catch(() => {});
    const flap = await page.evaluate(async () => {
      const ui = window.__ui; ui.toast('Test toast before the burst', 'info');
      for (const [k, t] of [['hot', 'Burning: one.'], ['warm', 'Smouldering: two.'], ['clear', 'Calm: three.'], ['warm', 'Smouldering: four.'], ['clear', 'Calm: you are ahead of the Star.']]) ui.toast(t, `heat-${k}`);
      await new Promise((r) => requestAnimationFrame(r));
      const ts = [...document.querySelectorAll('#toasts .toast')];
      return { n: ts.length, heat: ts.filter((t) => /\bheat-/.test(t.className)).map((t) => t.textContent) };
    });
    check('N-fog', `five heat changes at once leave one heat toast with the final state and at most 2 toasts in all (saw ${flap.n}: ${flap.heat.join(' | ')})`, flap.n <= 2 && flap.heat.length === 1 && flap.heat[0] === 'Calm: you are ahead of the Star.', JSON.stringify(flap));
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

// ------------------------------------------------------------------ part P: the Deathblow (M2b v13)
const P_ELITE = 'z2_bargh'; // zone 2 elite with a heavy Deathblow (Tidefall Slam)
/** The Deathblow display on the page: the line over each enemy, chips, rows, ruler, engage cards and alert, bar, items, MAIMED, the prompt. */
const pDom = (page) => page.evaluate(() => {
  const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  const wst = (root) => [...root.querySelectorAll('.wstk .wst')].map((b) => ({ part: b.dataset.part || '', value: Number(b.dataset.value), text: b.textContent }));
  const tf = document.querySelector('#target-frame'); const mb = document.querySelector('#player-frame .maimb'); const tp = document.querySelector('#turnprompt');
  return {
    np: [...document.querySelectorAll('#nameplates .np')].filter((el) => !el.classList.contains('dead')).map((el) => {
      const wub = el.querySelector('.wub'); const no = wub && wub.querySelector('.db-a.no');
      return { idx: Number(el.dataset.idx), newTag: vis(el.querySelector('.newtag')), wst: wst(el),
        chips: [...el.querySelectorAll('.trk .tk')].map((c) => ({ turn: Number(c.dataset.turn), db: c.classList.contains('db'), ribbon: (c.querySelector('.b-wu') || {}).textContent || '', soft: c.dataset.soft || '', lethal: c.dataset.lethal || '' })),
        wub: vis(wub) ? { text: wub.textContent, turn: Number(wub.dataset.turn), db: wub.dataset.deathblow === '1', est: Number(wub.dataset.est), ready: wub.dataset.ready, state: wub.dataset.state, lethal: wub.dataset.lethal || '', warn: (wub.querySelector('.db-warn') || {}).textContent || '',
          no: vis(no) ? getComputedStyle(no).color : null, answers: [...wub.querySelectorAll('.ans-o')].map((a) => ({ via: a.dataset.via, id: a.dataset.id, text: a.textContent.trim() })) } : null };
    }),
    rows: vis(tf) ? [...tf.querySelectorAll('.ttrack .tr')].map((r) => ({ turn: Number(r.dataset.turn), db: r.classList.contains('db'), text: r.textContent, soft: r.dataset.soft || '', lethal: r.dataset.lethal || '', flag: (r.querySelector('.flag.wu') || {}).textContent || '' })) : [],
    twst: vis(tf) ? wst(tf) : [], tnew: vis(tf) && !!tf.querySelector('.rank-tag.new'),
    ruler: vis(document.querySelector('#ruler')) ? [...document.querySelectorAll('#ruler .rl-c')].map((c) => ({ round: Number(c.dataset.round), wu: (c.querySelector('.rl-wu') || {}).textContent || '' })) : [],
    cards: [...document.querySelectorAll('#engage .eg-opt')].map((c) => ({ opt: c.dataset.opt, db: c.dataset.db || '', tag: !!c.querySelector('.eg-dbtag') })),
    alert: [...document.querySelectorAll('#engage .eg-db')].map((a) => ({ u: Number(a.dataset.u), turn: Number(a.dataset.turn), ready: a.dataset.ready, text: a.textContent })),
    bar: [...document.querySelectorAll('#actionbar .ab[data-slot]')].map((b) => ({ slot: Number(b.dataset.slot), db: b.dataset.db || '', now: b.classList.contains('db-now'), soon: b.classList.contains('db-soon'), tag: (b.querySelector('.atag') || {}).textContent || '' })),
    items: [...document.querySelectorAll('#actionbar .ab[data-islot]')].map((b) => ({ slot: Number(b.dataset.islot), mtag: (b.querySelector('.mtag') || {}).textContent || '' })),
    maim: vis(mb) ? { text: mb.textContent, value: Number(mb.dataset.value) } : null,
    prompt: vis(tp) ? { kind: tp.dataset.kind, text: tp.textContent.replace(/\s+/g, ' ').trim(), lethal: tp.dataset.lethal || '' } : null,
    attack: (() => { const b = document.querySelector('#actionbar .ab.basic'); return b ? { sap: b.classList.contains('breaks-sap'), tag: (b.querySelector('.sapw') || {}).textContent || '' } : null; })(),
    alertText: [...document.querySelectorAll('#engage .eg-db')].map((a) => a.textContent).join(' | '),
  };
});
/** The key the page names for a windupView answer: Q, W, E by R.engageOptions' order; a bar spell's slot + 1. */
const pKey = (s, a) => (a.via === 'engage' ? ['Q', 'W', 'E'][(R.engageOptions(s) || []).findIndex((o) => o.id === a.id)] || '' : String(s.player.bar.indexOf(a.id) + 1));
const pDigits = (t) => (t || '').replace(/\D/g, '');
/** "MAIMS if it lands"; aimed at the pet: "MAIMS you if it hits your pet" (QA 2026-11-12; the engine lands it on a pet hit). */
const pMaims = (w) => (w.target === 'pet' ? 'MAIMS you if it hits your pet' : 'MAIMS if it lands');
const P_WARN = 'Attacking breaks Sap: the Deathblow will land'; // src/ui/tracks.js SAP_BREAK_WARN
/** The Deathblow's telegraph on the page against windupView item w (enemy e): the line, the chip, the row, the ruler. */
function pTelegraph(d, w, opts = {}) {
  const bad = [];
  const np = d.np.find((x) => x.idx === w.u);
  if (!np || !np.wub) return [`no line over enemy ${w.u}`];
  const L = np.wub;
  if (!L.db || L.turn !== w.turn || L.est !== w.est) bad.push(`line ${JSON.stringify(L)} vs turn ${w.turn} est ${w.est}`);
  if (!L.text.includes(`Deathblow ${w.inRounds === 0 ? 'now' : `R${w.round}`}`) || !L.text.includes(`≈ ${w.est}`) || !L.text.includes(w.maims ? pMaims(w) : '')) bad.push(`line text "${L.text}"`);
  const chip = np.chips.find((c) => c.turn === w.turn);
  if (!chip || !chip.db || chip.ribbon !== 'DEATHBLOW' || np.chips.some((c) => c.db && c.turn !== w.turn)) bad.push(`chips ${JSON.stringify(np.chips)}`);
  if (opts.target) { const row = d.rows.find((r) => r.turn === w.turn); if (!row || !row.db || !row.text.includes(pMaims(w)) || d.rows.some((r) => r.db && r.turn !== w.turn)) bad.push(`rows ${JSON.stringify(d.rows)}`); }
  if (w.round <= 5) { const col = d.ruler.find((c) => c.round === w.round); if (!col || col.wu !== 'Deathblow') bad.push(`ruler ${JSON.stringify(d.ruler)}`); }
  return bad;
}
async function partP(browser, W, H) {
  // ---- (1) Hunter: telegraph, answers, autoplay hint, no answer ready, landed (MAIMED, potions, +100 %), the map tooltips
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
      // the map first: elite and dungeon nodes name their Deathblow and its kind (mapView deathblow, bossDeathblow)
      await page.getByRole('button', { name: 'Set out' }).click(); await idle(page); await page.mouse.move(2, 2);
      let s = await twin();
      const mv = R.mapView(s); const nodes = [];
      mv.rows.forEach((row, ri) => row.forEach((n, l) => { if (n.type === 'elite' || n.type === 'dungeon') nodes.push({ r: ri + 1, l, n }); }));
      const badMap = []; let named = 0;
      for (const { r, l, n } of nodes) {
        await page.locator(`#screens button.mnode[data-row="${r}"][data-lane="${l}"]`).hover(); await page.waitForTimeout(160);
        const t = (await page.getByRole('tooltip').innerText().catch(() => '')).replace(NBSP, ' ');
        const db = n.type === 'elite' ? n.deathblow : n.bossDeathblow;
        // M2b v14 (UI need 3): a hidden elite's view gives { type } only: "Deathblow: a heavy blow (...)", no name
        const want = !db ? null : db.name ? `${n.type === 'dungeon' ? "The boss's Deathblow" : 'Deathblow'}: ${db.name} (${deathblowKind(db.type)})`
          : `Deathblow: ${db.type === 'heavy' ? 'a heavy blow' : 'a cast'} (${deathblowAnswers(db.type)})`;
        if (want ? !t.includes(want) : /Deathblow:/.test(t)) badMap.push(`${n.type} r${r} l${l}: want ${want || 'no Deathblow line'}; saw ${t.replace(/\n/g, ' / ').slice(0, 160)}`);
        if (want) named++;
        await page.mouse.move(2, 2);
      }
      check('M2b-v13', `map: every elite and dungeon node's tooltip names its Deathblow and kind exactly as mapView gives it; a hidden elite its type only (M2b v14) (${nodes.length} nodes, ${named} lines)`, nodes.length > 0 && named > 0 && !badMap.length, badMap.join(' | ') || `${nodes.length} nodes`);
      // the fight: Bargh the Drowned King, its engage round
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      s = await twin();
      const w = (R.windupView(s) || []).find((x) => x.deathblow);
      let d = await pDom(page);
      await shot(page, 'P-engage');
      let bad = w ? pTelegraph(d, w, { target: true }) : ['no Deathblow in windupView'];
      check('M2b-v13', `engage round: the Deathblow over ${w && w.enemy} ("Deathblow R${w && w.round} ≈ ${w && w.est} MAIMS if it lands"), its chip, target row and ruler round = R.windupView`, !bad.length, bad.join(' | '));
      // the answers: engage cards and the names on the line = windupView's engage answers (keys; sure)
      const eng = w.answers.filter((a) => a.via === 'engage');
      const wantCards = [...new Set(eng.map((a) => a.id))].map((id) => `${id}:${eng.some((a) => a.id === id && a.sure) ? 'sure' : 'chance'}`).sort().join(' ');
      const sawCards = d.cards.filter((c) => c.db && c.tag).map((c) => `${c.opt}:${c.db}`).sort().join(' ');
      const L = d.np.find((x) => x.idx === w.u).wub;
      const wantNames = eng.filter((a) => a.now).slice(0, 3).map((a) => `${pKey(s, a)} ${a.name}${a.sure ? '' : ' ?'}`);
      const sawNames = L.answers.map((a) => a.text.replace(/\s+/g, ' '));
      const alert = d.alert.find((a) => a.u === w.u && a.turn === w.turn);
      check('M2b-v13', `answers: the engage cards marked "Deathblow" (${wantCards}) and the answers on the line (${wantNames.join(', ')}) = windupView's engage answers; ready ${w.ready}, the panel's alert says so`,
        eng.length > 0 && sawCards === wantCards && wantNames.every((n) => sawNames.includes(n)) && w.ready && L.ready === '1' && !L.no && alert && alert.ready === '1' && alert.text.includes(pMaims(w)) && alert.text.includes(`≈ ${w.est}`),
        `cards ${sawCards} | line ${JSON.stringify(sawNames)} | alert ${JSON.stringify(alert)}`);
      check('M2b-v13', 'engage round: the turn prompt names the Deathblow and its first answer with its key', !!d.prompt && d.prompt.kind === 'deathblow' && d.prompt.text.includes(`Deathblow in R${w.round}: answer with ${pKey(s, eng.find((a) => a.now && a.sure) || eng[0])}`), JSON.stringify(d.prompt));
      // the autoplay hint (rule E2): Z on, the line, Z off before autoplay acts (its delay held long for the reading)
      await page.evaluate(() => { window.__ui.settings.set('autoDelay', 9000); window.__ui.settings.set('speed', 1); });
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === true, null, { timeout: 4000 }); await idle(page); await page.waitForTimeout(150);
      const ae = R.autoplayEngage(await twin());
      d = await pDom(page);
      await shot(page, 'P-autoplay-hint');
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === false, null, { timeout: 4000 }); await idle(page);
      await page.evaluate(() => { window.__ui.settings.set('speed', 0); window.__ui.settings.set('autoDelay', 350); });
      const stillEngage = R.isEngageRound(await twin());
      check('M2b-v13', `autoplay on in the engage round: "Autoplay will answer the Deathblow with ${ae && ae.name}" (R.autoplayEngage); off again before it acts`,
        !!ae && !!d.prompt && d.prompt.kind === 'auto-db' && d.prompt.text.includes(`Autoplay will answer the Deathblow with ${ae.name}`) && stillEngage, `${JSON.stringify(d.prompt)}; autoplayEngage ${JSON.stringify(ae && ae.name)}; still the engage round ${stillEngage}`);
      // round 2: nothing on the bar answers it by round 3 (windupView ready false): "No answer ready" in red
      const potBefore = R.potionInfo(s, 'healing_draught');
      await page.keyboard.press('KeyX'); await idle(page); await page.mouse.move(2, 2);
      s = await twin();
      const w2 = (R.windupView(s) || []).find((x) => x.deathblow);
      d = await pDom(page);
      const L2 = w2 && d.np.find((x) => x.idx === w2.u).wub;
      const red = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c || ''); return !!m && Number(m[1]) >= 200 && Number(m[2]) < 110 && Number(m[3]) < 110; };
      check('M2b-v13', `round 2: windupView ready ${w2 && w2.ready}: the line says "No answer ready" in red, and so does the turn prompt`,
        !!w2 && !w2.ready && !!L2 && L2.text.includes('No answer ready') && red(L2.no) && L2.ready === '' && !!d.prompt && d.prompt.kind === 'deathblow-no' && /No answer ready/i.test(d.prompt.text), `${JSON.stringify(L2)}; prompt ${JSON.stringify(d.prompt)}`);
      // it lands: MAIMED, the cut potion amount, "+100 %" on the enemy, the log
      for (let n = 0; n < 3; n++) { const t = await twin(); if (t.fight.p.st.some((x) => x.id === 'MAIMED')) break; await page.keyboard.press('KeyX'); await idle(page); }
      await page.mouse.move(2, 2); await page.waitForTimeout(150);
      s = await twin();
      const mst = s.fight.p.st.find((x) => x.id === 'MAIMED'); const est = s.fight.enemies[w.u].st.find((x) => x.id === 'EMPOWERED');
      const pot = R.potionInfo(s, 'healing_draught');
      d = await pDom(page);
      await shot(page, 'P-maimed');
      check('M2b-v13', `landed: MAIMED on the player frame, "Healing −${jPct(mst && mst.value)}" = the engine's status`, !!mst && !!d.maim && d.maim.text.includes(`Healing −${jPct(mst.value)}`) && Math.abs(d.maim.value - mst.value) < 1e-9, `${JSON.stringify(d.maim)}; engine ${JSON.stringify(mst)}`);
      const slot = s.player.itemBar.indexOf('healing_draught');
      const it = d.items.find((x) => x.slot === slot);
      const ttip = slot >= 0 ? await tipText(page, page.locator(`#actionbar .ab[data-islot="${slot}"]`)) : '';
      check('M2b-v13', `MAIMED halves the potion: its button shows +${pot && pot.heal} and its tooltip "restores ${pot && pot.heal} health" (R.potionInfo; ${potBefore && potBefore.heal} before, × ${1 - (pot ? pot.maim : 0)})`,
        !!pot && pot.maim > 0 && Math.abs(pot.heal - potBefore.heal * (1 - pot.maim)) <= 0.5 && !!it && pDigits(it.mtag) === String(pot.heal) && ttip.includes(`Maimed: restores ${pot.heal} health`), `${JSON.stringify(it)}; tooltip ${ttip.replace(/\n/g, ' / ')}; engine ${JSON.stringify(pot)}`);
      const npd = d.np.find((x) => x.idx === w.u);
      const dbB = (list) => list.filter((b) => b.part === 'deathblow');
      const okBadge = (list) => dbB(list).length === 1 && Math.abs(dbB(list)[0].value - est.deathblowValue) < 1e-9 && dbB(list)[0].text.includes(`+${jPct(est.deathblowValue)} dmg`);
      check('M2b-v13', `landed: "Deathblow +${jPct(est && est.deathblowValue)} dmg" on the nameplate and the target frame = EMPOWERED's deathblowValue`, !!est && est.deathblows === 1 && !!npd && okBadge(npd.wst) && okBadge(d.twst), `${JSON.stringify(npd && npd.wst)}; target ${JSON.stringify(d.twst)}; engine ${JSON.stringify(est)}`);
      const log = await logLines(page);
      check('M2b-v13', 'landed: the log says "Deathblow landed: ..., you are maimed"', log.some((l) => l.startsWith(`Deathblow landed: ${w.enemy}'s ${w.name}`) && l.includes(`+${jPct(R.C.DEATHBLOW_EMPOWER)} damage`) && l.includes(`you are maimed: healing you receive −${jPct(mst.value)}`)), log.slice(-3).join(' / '));
    } catch (e) {
      await shot(page, 'P-error-hunter');
      check('-', 'part P (Hunter) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Hunter): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2) Rogue: Sap a chance; Throat Jab kept for round 3, then answering now; its key answers it
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2 })); await idle(page);
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      let s = await twin();
      let w = (R.windupView(s) || []).find((x) => x.deathblow);
      let d = await pDom(page);
      const spell = w && w.answers.find((a) => a.via === 'spell' && a.how === 'interrupt');
      const sap = w && w.answers.find((a) => a.via === 'engage' && a.id === 'sap');
      const slot = spell ? s.player.bar.indexOf(spell.id) : -1;
      const b1 = d.bar.find((x) => x.slot === slot);
      // M2b v14 (UI need 2): a lone elite: Sap is sure if you wait (windupView `wait`): its card "wait" with the engine's words
      const sapCard = await page.evaluate(() => { const c = document.querySelector('#engage .eg-opt[data-opt="sap"] .eg-dbc'); return c ? c.textContent : ''; });
      check('M2b-v14', `Rogue, engage round: Sap answers it (sure ${sap && sap.sure}, wait ${sap && sap.wait}): its card "${sap && sap.wait ? 'wait' : 'chance'}"${sap && sap.wait ? ` and "${sapWaitText(sap)}"` : ''}; ${spell && spell.name} (not now) kept for round ${w && w.round}: "R${w && w.round}" on key ${slot + 1}`,
        !!sap && !sap.sure && d.cards.some((c) => c.opt === 'sap' && c.db === (sap.wait ? 'wait' : 'chance')) && (!sap.wait || sapCard === sapWaitText(sap)) && !!spell && !spell.now && !!b1 && b1.soon && !b1.now && b1.tag === `R${w.round}`, `cards ${JSON.stringify(d.cards)}; card text "${sapCard}"; bar ${JSON.stringify(b1)}`);
      for (let n = 0; n < 4; n++) { s = await twin(); w = (R.windupView(s) || []).find((x) => x.deathblow); if (!w || w.inRounds === 0) break; await page.keyboard.press('KeyX'); await idle(page); }
      await page.mouse.move(2, 2);
      d = await pDom(page);
      const now = w && w.answers.find((a) => a.via === 'spell' && a.id === spell.id);
      const b3 = d.bar.find((x) => x.slot === slot);
      const bad = w ? pTelegraph(d, w) : ['no Deathblow'];
      await shot(page, 'P-rogue-now');
      check('M2b-v13', `Rogue, round ${w && w.round}: the Deathblow plays now; ${spell.name} answers it now (windupView now ${now && now.now}): the bar marks it, the line and the prompt name key ${slot + 1}`,
        !bad.length && !!now && now.now && !!b3 && b3.now && b3.tag.startsWith('Answer') && d.np.find((x) => x.idx === w.u).wub.answers.some((a) => a.id === spell.id && a.text.startsWith(`${slot + 1} `)) && !!d.prompt && d.prompt.text.includes(`Deathblow now: answer with ${slot + 1} ${spell.name}`),
        `${bad.join(' | ')}; bar ${JSON.stringify(b3)}; prompt ${JSON.stringify(d.prompt)}`);
      await page.keyboard.press(`Digit${slot + 1}`); await idle(page);
      s = await twin();
      const st = s.fight && s.fight.enemies[w.u].st.find((x) => x.id === 'STAGGERED');
      const log = await logLines(page);
      check('M2b-v13', `key ${slot + 1}: the Deathblow is answered (STAGGERED in the engine), the log says "Deathblow answered: ... stopped by your ${spell.name}", no MAIMED`,
        !!st && !s.fight.p.st.some((x) => x.id === 'MAIMED') && log.some((l) => l.startsWith(`Deathblow answered: ${w.enemy}'s ${w.name} is stopped by your ${spell.name}.`)) && !(await pDom(page)).maim, log.slice(-3).join(' / '));
    } catch (e) {
      await shot(page, 'P-error-rogue');
      check('-', 'part P (Rogue) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Rogue): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2b) M2b v14 (UI needs 1-2): the Rogue's autoplay hint "..., then wait a round"; Sap, then Pass rings in round 2 and
  // the prompt says to wait; X: Sap cancels the Deathblow (STAGGERED), the Rogue still hidden
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2 })); await idle(page);
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      await page.evaluate(() => { window.__ui.settings.set('autoDelay', 9000); window.__ui.settings.set('speed', 1); });
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === true, null, { timeout: 4000 }); await idle(page); await page.waitForTimeout(150);
      let s = await twin();
      const ae = R.autoplayEngage(s);
      let d = await pDom(page);
      await shot(page, 'P-rogue-autoplay-wait');
      await page.keyboard.press('KeyZ');
      await page.waitForFunction(() => window.__ui.view().autoplay === false, null, { timeout: 4000 }); await idle(page);
      await page.evaluate(() => { window.__ui.settings.set('speed', 0); window.__ui.settings.set('autoDelay', 350); });
      check('M2b-v14', `Rogue, autoplay on in the engage round: "Autoplay will answer the Deathblow with Sap, then wait a round" (R.autoplayEngage wait ${ae && ae.wait})`,
        !!ae && ae.option === 'sap' && ae.wait === true && !!d.prompt && d.prompt.kind === 'auto-db' && d.prompt.text.includes('Autoplay will answer the Deathblow with Sap, then wait a round') && R.isEngageRound(await twin()), `${JSON.stringify(d.prompt)}; autoplayEngage ${JSON.stringify(ae)}`);
      // Sap (its key on the engage panel), then round 2: Pass is the answer
      const sapKey = ['Q', 'W', 'E'][(R.engageOptions(s) || []).findIndex((o) => o.id === 'sap')];
      // QA 2026-11-12: the manual prompt in the engage round says Sap is sure if you wait, as the line and the card do (not "(a chance)")
      await page.mouse.move(2, 2); await page.waitForTimeout(100);
      d = await pDom(page);
      const sapW = ((R.windupView(s) || []).find((x) => x.deathblow) || { answers: [] }).answers.find((a) => a.id === 'sap');
      check('M2b-v14', `Rogue, engage round, autoplay off: the turn prompt reads "answer with ${sapKey} Sap, then wait (Pass next round)", no "(a chance)" (windupView Sap wait ${sapW && sapW.wait})`,
        !!sapW && sapW.wait && !!d.prompt && d.prompt.kind === 'deathblow' && d.prompt.text.includes(`answer with ${sapKey} Sap, then wait (Pass next round)`) && !d.prompt.text.includes('a chance'), JSON.stringify(d.prompt));
      await page.keyboard.press(`Key${sapKey}`); await idle(page);
      const t0 = await twin();
      if (R.isEngageRound(t0)) { await page.locator(`#nameplates .np[data-idx="${ae.target}"]`).click().catch(() => {}); await idle(page); }
      await page.mouse.move(2, 2);
      s = await twin();
      const w = (R.windupView(s) || []).find((x) => x.deathblow);
      const pa = w && w.answers.find((a) => a.via === 'pass');
      d = await pDom(page);
      const passBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('.ctrl .btn')].find((x) => /^Pass/.test(x.textContent)); return b ? { ring: b.classList.contains('db-now'), db: b.dataset.db || '' } : null; });
      const L = w && d.np.find((x) => x.idx === w.u);
      await shot(page, 'P-rogue-wait');
      check('M2b-v14', `Rogue, round ${s.fight && s.fight.round} after Sap: windupView's PASS answer (now ${pa && pa.now}, stealth ${pa && pa.stealth}): the Pass button has the answer ring, the line names "X Pass", the prompt says to wait`,
        !!pa && pa.now && w.ready && !!passBtn && passBtn.ring && passBtn.db === 'now' && !!L && !!L.wub && L.wub.answers.some((a) => a.via === 'pass' && a.text.startsWith('X Pass'))
          && !!d.prompt && d.prompt.kind === 'deathblow' && d.prompt.text.includes(`Deathblow in R${w.round}: wait with X Pass: Sap stops it${pa.stealth ? ', and you stay hidden' : ''}`),
        `pass ${JSON.stringify(passBtn)}; line ${JSON.stringify(L && L.wub && L.wub.answers)}; prompt ${JSON.stringify(d.prompt)}; answer ${JSON.stringify(pa)}`);
      // QA 2026-11-12 (finding 2): until Sap cancels it, "If you wait" (not ANSWERED) on its chip, its row and the ruler; attacking warned
      const wChip = L && L.chips.find((c) => c.turn === w.turn); const wRow = d.rows.find((r) => r.turn === w.turn); const wCol = d.ruler.find((c) => c.round === w.round);
      check('QA-2026-11-12', `Rogue, waiting round: the Deathblow's chip, target row and ruler say "If you wait" (the row "Sapped: answered if you wait"), not ANSWERED; the line and the prompt warn "${P_WARN}"; the attack button is marked "Breaks Sap"`,
        !!wChip && wChip.ribbon === 'IF YOU WAIT' && wChip.soft === 'wait' && !!wRow && wRow.soft === 'wait' && wRow.flag === 'If you wait' && wRow.text.includes('answered if you wait') && !/Answered/.test(wRow.flag)
          && (w.round > 5 || (!!wCol && wCol.wu === 'If you wait')) && L.wub.warn.includes(P_WARN) && d.prompt.text.includes(P_WARN) && !!d.attack && d.attack.sap && d.attack.tag === 'Breaks Sap',
        `chip ${JSON.stringify(wChip)}; row ${JSON.stringify(wRow)}; ruler ${JSON.stringify(wCol)}; warn "${L && L.wub && L.wub.warn}"; prompt ${JSON.stringify(d.prompt)}; attack ${JSON.stringify(d.attack)}`);
      await page.keyboard.press('KeyX'); await idle(page);
      s = await twin();
      const e = s.fight && s.fight.enemies[w.u];
      const stg = e && e.st.find((x) => x.id === 'STAGGERED');
      const passB2 = await page.evaluate(() => { const b = [...document.querySelectorAll('.ctrl .btn')].find((x) => /^Pass/.test(x.textContent)); return b ? b.classList.contains('db-now') : null; });
      check('M2b-v14', 'X: Sap cancels the Deathblow at its turn (STAGGERED, no MAIMED), the Rogue is still in STEALTH, and the Pass ring is gone',
        !!stg && stg.deathblows === 1 && !s.fight.p.st.some((x) => x.id === 'MAIMED') && s.fight.p.st.some((x) => x.id === 'STEALTH') && passB2 === false, `${JSON.stringify(stg)}; player ${JSON.stringify(s.fight && s.fight.p.st.map((x) => x.id))}; ring ${passB2}`);
      await page.mouse.move(2, 2);
      const d3 = await pDom(page); const L3 = d3.np.find((x) => x.idx === w.u);
      check('QA-2026-11-12', 'once Sap has cancelled it: no "If you wait" on the chips or rows, no warning on the line or the prompt, the attack button unmarked',
        !!L3 && !L3.chips.some((c) => c.soft) && !d3.rows.some((r) => r.soft) && !(L3.wub && L3.wub.warn) && !(d3.prompt && d3.prompt.text.includes(P_WARN)) && !!d3.attack && !d3.attack.sap,
        `chips ${JSON.stringify(L3 && L3.chips)}; rows ${JSON.stringify(d3.rows)}; line ${JSON.stringify(L3 && L3.wub)}; prompt ${JSON.stringify(d3.prompt)}; attack ${JSON.stringify(d3.attack)}`);
    } catch (e) {
      await shot(page, 'P-error-rogue-wait');
      check('-', 'part P (Rogue wait) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Rogue wait): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (3) a first meeting (gated, rules 7.12): "New" on that enemy's nameplate and the target frame, no other
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      const ser = lFight('hunter', 5, 2, (o) => { o.fight.enemies[1].firstMeet = true; });
      await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
      await page.locator('#nameplates .np[data-idx="1"]').click(); await idle(page); await page.mouse.move(2, 2);
      const d = await pDom(page);
      check('M2b-v13', 'first meeting: "New" on the nameplate of the enemy the engine marks firstMeet, and on the target frame; none on the other', d.np.find((x) => x.idx === 1).newTag && !d.np.find((x) => x.idx === 0).newTag && d.tnew, JSON.stringify(d.np.map((x) => [x.idx, x.newTag])) + ` target ${d.tnew}`);
    } catch (e) {
      check('-', 'part P (first meeting) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (first meeting): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (4) QA 2026-11-12: a Mage's Disrupt on the zone 1 dungeon boss answers its Deathblow: the line says "Disrupt: answered" (not "your trap")
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'mage', zone: 1 })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z1_belk'] })); await idle(page); await page.mouse.move(2, 2);
      await page.keyboard.press('KeyW'); await idle(page); await page.mouse.move(2, 2);
      const d = await pDom(page);
      const L = d.np.map((x) => x.wub).find((w) => w && w.db);
      check('M2b-v13', 'dungeon boss, Disrupt (key W) answers the Deathblow: the line over it reads "Disrupt: answered"', !!L && L.text.includes('Disrupt: answered') && !L.text.includes('your trap'), JSON.stringify(L));
    } catch (e) {
      check('-', 'part P (Disrupt) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (Disrupt): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (5) QA 2026-11-12 (finding 3): LETHAL when the Deathblow's estimate is at least your health; MAIMED: the heal hint's cut amount
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      let s0 = R.debug.build({ content: CONTENT, classId: 'hunter', seed: 5, zone: 2, mapMode: 'rows' }).state;
      s0 = R.debug.encounter(s0, { ids: [P_ELITE] }).state;
      s0 = R.step(s0, { type: 'PASS' }).state; // round 2: nothing on the bar answers it by round 3 (as in (1))
      const w0 = R.windupView(s0).find((x) => x.deathblow);
      const load = async (edit) => {
        const o = JSON.parse(R.serialize(s0));
        for (const x of o.fight.enemies[w0.u].track) if (x.deathblow) { x.aggro = 'player'; x.target = 'player'; }
        edit(o);
        const ser = JSON.stringify(o);
        await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
        await page.locator(`#nameplates .np[data-idx="${w0.u}"]`).click(); await idle(page); await page.mouse.move(2, 2);
        return R.deserialize(ser, CONTENT);
      };
      // full health: no LETHAL anywhere
      let t = await load((o) => { o.player.hp = Math.max(o.player.hp, w0.est + 50); o.player.d.maxHp = Math.max(o.player.d.maxHp, o.player.hp); });
      let d = await pDom(page);
      const wF = R.windupView(t).find((x) => x.deathblow);
      const noL = (dd, w) => { const np = dd.np.find((x) => x.idx === w.u); return !!np && !!np.wub && !np.wub.lethal && !np.chips.some((c) => c.lethal) && !dd.rows.some((r) => r.lethal) && !!dd.prompt && !dd.prompt.lethal && !/LETHAL/.test(dd.prompt.text); };
      check('QA-2026-11-12', `health ${t.player.hp} above the Deathblow's estimate ${wF.est}: no LETHAL on the line, the chips, the rows or the prompt`, wF.est < t.player.hp && noL(d, wF), JSON.stringify({ np: d.np.find((x) => x.idx === wF.u), rows: d.rows, prompt: d.prompt }));
      // health under it, MAIMED: LETHAL on the line, its chip, its row, the prompt; the heal hint names the potion's cut amount
      t = await load((o) => { o.player.hp = Math.max(1, Math.floor(w0.est * 0.6)); o.fight.p.st.push({ id: 'MAIMED', dur: null, value: R.C.MAIM_HEAL, by: w0.u, src: w0.id, name: w0.name }); });
      d = await pDom(page);
      await shot(page, 'P-lethal-maimed');
      const w = R.windupView(t).find((x) => x.deathblow);
      const pot = R.potionInfo(t, 'healing_draught');
      const slot = t.player.itemBar.indexOf('healing_draught');
      const np = d.np.find((x) => x.idx === w.u); const chip = np && np.chips.find((c) => c.turn === w.turn); const row = d.rows.find((r) => r.turn === w.turn);
      check('QA-2026-11-12', `health ${t.player.hp} under the Deathblow's estimate ${w.est}: LETHAL on the line, its chip, its row and the prompt; MAIMED: the prompt's heal hint "+${pot && pot.heal} (maimed)" = R.potionInfo (maim ${pot && pot.maim})`,
        w.est >= t.player.hp && !!np && !!np.wub && np.wub.lethal === '1' && np.wub.text.includes('LETHAL') && !!chip && chip.lethal === '1' && !!row && row.lethal === '1' && row.text.includes('Lethal')
          && !!d.prompt && d.prompt.lethal === '1' && d.prompt.text.includes('LETHAL Deathblow in R') && !!pot && pot.maim > 0 && slot >= 0 && d.prompt.text.includes(`${['8', '9', '0'][slot]} Healing Draught +${pot.heal} (maimed)`),
        JSON.stringify({ wub: np && np.wub, chip, row, prompt: d.prompt, pot, slot }));
    } catch (e) {
      await shot(page, 'P-error-lethal');
      check('-', 'part P (LETHAL) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (LETHAL): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (6) QA 2026-11-12 (finding 8): a Deathblow aimed at the pet says what the engine does (lands, and MAIMS you, if it hits your pet)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      let s0 = R.debug.build({ content: CONTENT, classId: 'hunter', seed: 5, zone: 2, mapMode: 'rows' }).state;
      s0 = R.debug.encounter(s0, { ids: [P_ELITE] }).state; // the engage round
      const o = JSON.parse(R.serialize(s0));
      const u = R.windupView(s0).find((x) => x.deathblow).u;
      for (const x of o.fight.enemies[u].track) if (x.deathblow) { x.aggro = 'pet'; x.target = 'pet'; }
      const ser = JSON.stringify(o);
      await page.evaluate((x) => window.__ui.loadState(x), ser); await idle(page);
      await page.locator(`#nameplates .np[data-idx="${u}"]`).click(); await idle(page); await page.mouse.move(2, 2);
      const t = R.deserialize(ser, CONTENT);
      const w = R.windupView(t).find((x) => x.deathblow);
      const d = await pDom(page);
      await shot(page, 'P-pet-deathblow');
      const np = d.np.find((x) => x.idx === u); const row = d.rows.find((r) => r.turn === w.turn);
      check('QA-2026-11-12', `a Deathblow aimed at the pet (windupView target ${w.target}, maims ${w.maims}, Send the Pet an answer): the line, the row and the alert say "MAIMS you if it hits your pet" and "≈ ${w.est} to your pet"; no LETHAL`,
        w.target === 'pet' && w.maims && w.answers.some((a) => a.id === 'send_pet') && !!np && !!np.wub && np.wub.text.includes('MAIMS you if it hits your pet') && np.wub.text.includes('your pet') && !np.wub.lethal
          && !!row && row.text.includes('MAIMS you if it hits your pet') && d.alertText.includes(`≈ ${w.est} to your pet`) && d.alertText.includes('MAIMS you if it hits your pet'),
        JSON.stringify({ wub: np && np.wub, row, alert: d.alertText }));
    } catch (e) {
      await shot(page, 'P-error-pet');
      check('-', 'part P (pet Deathblow) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (pet Deathblow): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (7) QA 2026-11-12 (finding 4): at speed 1 a landed Deathblow's floats overlap nothing shown at the same time
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=5&speed=instant');
    try {
      await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
      await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
      const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
      for (let n = 0; n < 3; n++) { const w = (R.windupView(await twin()) || []).find((x) => x.deathblow); if (!w || w.inRounds === 0) break; await page.keyboard.press('KeyX'); await idle(page); }
      await page.evaluate(() => window.__ui.settings.set('speed', 1));
      await page.keyboard.press('KeyX'); await idle(page);
      await page.waitForTimeout(400);
      const fl = await page.evaluate(() => window.__ui.floats());
      await page.evaluate(() => window.__ui.settings.set('speed', 0));
      const maim = fl.floats.find((f) => /^Maimed/.test(f.text)); const land = fl.floats.find((f) => /^Deathblow landed/.test(f.text));
      const t0 = maim ? maim.t0 : 0;
      const near = fl.floats.filter((f) => f.t0 >= t0 - 1.2 && f.t0 <= t0 + 2.5);
      const hit = (a, b) => a.t0 < b.t1 && b.t0 < a.t1 && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      const bad = [];
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
        const a = near[i]; const b = near[j];
        const care = a.lane === 'head' || b.lane === 'head' || (a.lane === 'num') !== (b.lane === 'num') || (a.lane === 'num' && b.lane === 'num' && a.id !== b.id);
        if (care && hit(a, b)) bad.push(`"${a.text}" (${a.id}, ${a.lane}) x "${b.text}" (${b.id}, ${b.lane})`);
      }
      check('QA-2026-11-12', `landed Deathblow at speed 1: "Deathblow landed: empowered" and "Maimed: ..." in the headline lane, and no float shown with them overlaps another (${near.length} floats: numbers, pet numbers, Dodge, words)`,
        !!maim && !!land && maim.lane === 'head' && land.lane === 'head' && !bad.length, bad.join(' | ') || JSON.stringify(near.map((f) => [f.text, f.id, f.lane])));
    } catch (e) {
      await shot(page, 'P-error-floats');
      check('-', 'part P (floats) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
    }
    check('-', 'part P (floats): no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part Q: sound (docs/specs/audio.md; D127)
const Q_DIM_SEED = 1; // a dev-built expedition run whose zone 1 brings the Dimming near the player within about 30 steps
const Q_PROTECTED = new Set(['deathblowTelegraph', 'deathblowFirstShow', 'deathblowAnswered', 'deathblowLanded', 'maimed', 'playerDeath']);
async function partQ(browser, W, H) {
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  // count the AudioContexts the page makes (none may exist before the first gesture)
  await context.addInitScript(() => { const A = window.AudioContext; let n = 0; window.__acMade = () => n; if (A) window.AudioContext = class extends A { constructor(...a) { super(...a); n += 1; } }; });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) errors.push(`request ${r.url()}`); });
  const audio = () => page.evaluate(() => ({ ...window.__ui.audio(), made: window.__acMade() }));
  const has = (log, cue, from = 0, o = {}) => log.filter((x, i) => i >= from && x.cue === cue && x.kept && (!o.sound || x.sound));
  const twin = async () => devTwin(await page.evaluate(() => window.__ui.engineLog()));
  try {
    await page.goto(`${URL}?seed=5&speed=instant&classic=1`);
    await page.waitForFunction(() => window.__ui);
    let a = await audio();
    check('SOUND', 'page loaded: no AudioContext, sound locked, nothing logged', a.made === 0 && !a.unlocked && a.state === null && a.log.length === 0, JSON.stringify({ made: a.made, unlocked: a.unlocked, n: a.log.length }));
    // (1) no gesture: a new run on the engine's autoplay choices to its first level-up (steps through window.__ui only)
    await page.evaluate(async () => {
      const ui = window.__ui; await ui.act({ type: 'START_RUN' }); await ui.idle();
      for (let n = 0; n < 400 && !ui.audio().log.some((x) => x.cue === 'levelUp'); n++) { if (ui.view().phase === 'SUMMARY') break; await ui.act({ type: 'AUTO' }); await ui.idle(); }
    });
    a = await audio();
    check('SOUND', 'no gesture: a new run to its first level-up logs levelUp (kept) and hits, with no sound', has(a.log, 'levelUp').length >= 1 && a.log.some((x) => /^hit|^crit|^tick/.test(x.cue)), a.log.slice(-6).map((x) => `${x.cue}${x.kept ? '' : '(dropped)'}`).join(' '));
    // a Hunter against Bargh passes until the Deathblow lands (dev ops and PASS through window.__ui: still no gesture)
    await page.evaluate(() => window.__ui.dev('build', { classId: 'hunter', zone: 2 })); await idle(page);
    await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page);
    const from1 = (await audio()).log.length;
    for (let n = 0; n < 5; n++) { const s = await twin(); if (s.fight && s.fight.p.st.some((x) => x.id === 'MAIMED')) break; await page.evaluate(() => window.__ui.act({ type: 'PASS' })); await idle(page); }
    a = await audio();
    const L1 = a.log.slice(from1); const tel = L1.filter((x) => x.cue === 'deathblowTelegraph'); const land = L1.findIndex((x) => x.cue === 'deathblowLanded' && x.kept);
    check('SOUND', 'no gesture: the Deathblow logs deathblowTelegraph once at its decision, then deathblowLanded and maimed (kept)',
      tel.length === 1 && tel[0].kept && land > L1.indexOf(tel[0]) && has(L1, 'maimed').length === 1, L1.map((x) => `${x.cue}@${x.step}${x.kept ? '' : '(dropped)'}`).join(' '));
    check('SOUND', 'nothing plays before the first gesture: no AudioContext made, every logged cue unsounded', a.made === 0 && !a.unlocked && a.log.length > 0 && a.log.every((x) => !x.sound), `made ${a.made}, unlocked ${a.unlocked}, ${a.log.filter((x) => x.sound).length} of ${a.log.length} sounded`);
    // (2) the first gesture: a click on a button
    const from2 = a.log.length;
    await page.getByRole('button', { name: 'Bags' }).click(); await idle(page);
    await page.locator('#win-bags').getByRole('button', { name: 'Close' }).click(); await idle(page);
    a = await audio();
    check('SOUND', 'first click: one AudioContext, unlocked; uiClick sounds (and the window opens and closes with winOpen, winClose)', a.made === 1 && a.unlocked && has(a.log, 'uiClick', from2, { sound: true }).length >= 2 && has(a.log, 'winOpen', from2).length === 1 && has(a.log, 'winClose', from2).length === 1,
      `made ${a.made} ${a.state}: ${a.log.slice(from2).map((x) => `${x.cue}${x.sound ? '' : '(silent)'}`).join(' ')}`);
    // (3) a Rogue answers the Deathblow with its interrupt (keys: gestures)
    await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2 })); await idle(page);
    await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); await page.mouse.move(2, 2);
    let s = await twin(); let w = null; let spell = null;
    for (let n = 0; n < 5; n++) { s = await twin(); w = (R.windupView(s) || []).find((x) => x.deathblow); if (!w || w.inRounds === 0) break; await page.keyboard.press('KeyX'); await idle(page); }
    spell = w && w.answers.find((x) => x.via === 'spell' && x.how === 'interrupt' && x.now);
    const from3 = (await audio()).log.length;
    if (spell) { await page.keyboard.press(`Digit${s.player.bar.indexOf(spell.id) + 1}`); await idle(page); }
    a = await audio();
    check('SOUND', `Rogue: ${spell ? spell.name : 'an interrupt'} answers the Deathblow: deathblowAnswered sounds`, !!spell && has(a.log, 'deathblowAnswered', from3, { sound: true }).length === 1, a.log.slice(from3).map((x) => `${x.cue}${x.sound ? '' : '(silent)'}`).join(' '));
    // (4) god mode, 4x: attack until a crit and a kill
    await page.evaluate(() => window.__ui.dev('god')); await idle(page);
    await page.evaluate(() => window.__ui.settings.set('speed', 4));
    const from4 = (await audio()).log.length;
    for (let n = 0; n < 80; n++) {
      a = await audio();
      if (has(a.log, 'crit', from4).length && has(a.log, 'kill', from4).length) break;
      const v = await view(page);
      if (v.over || v.round == null) { await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page); continue; }
      await page.keyboard.press('KeyA'); await idle(page);
    }
    a = await audio();
    const L4 = a.log.slice(from4);
    check('SOUND', 'god mode at 4x, attacks: hits (hitLight or hitHeavy), a crit and a kill sound', L4.some((x) => /^hit(Light|Heavy)$/.test(x.cue) && x.sound) && has(L4, 'crit', 0, { sound: true }).length > 0 && has(L4, 'kill', 0, { sound: true }).length > 0,
      `${L4.length} cues: ${[...new Set(L4.filter((x) => x.sound).map((x) => x.cue))].join(' ')}`);
    // (5) a Mage passes against Bargh at Instant until it dies
    await page.evaluate(() => { window.__ui.settings.set('speed', 0); }); 
    await page.evaluate(() => window.__ui.dev('build', { classId: 'mage', zone: 2 })); await idle(page);
    await page.evaluate((id) => window.__ui.dev('fight', { ids: [id] }), P_ELITE); await idle(page);
    const from5 = (await audio()).log.length;
    for (let n = 0; n < 40; n++) { const v = await view(page); if (v.phase === 'SUMMARY' || v.round == null) break; await page.keyboard.press('KeyX'); await idle(page); }
    a = await audio();
    const v5 = await view(page);
    check('SOUND', `Mage passes until it dies (phase ${v5.phase}): playerDeath sounds`, has(a.log, 'playerDeath', from5, { sound: true }).length === 1, a.log.slice(from5).slice(-6).map((x) => `${x.cue}${x.kept ? '' : '(dropped)'}`).join(' '));
    // the Instant rule: no Instant step keeps more than one cue besides the Deathblow cues and the death
    const plays = await page.evaluate(() => window.__ui.plays().length);
    const bySteps = new Map(); for (const x of a.log) if (x.kept && !Q_PROTECTED.has(x.cue) && !['uiClick', 'winOpen', 'winClose', 'error', 'arrive'].includes(x.cue)) bySteps.set(x.step, (bySteps.get(x.step) || []).concat(x.cue));
    const instantSteps = [...a.log.slice(from5).map((x) => x.step)];
    const over = [...bySteps.entries()].filter(([st, list]) => instantSteps.includes(st) && list.length > 1);
    check('SOUND', 'Instant: each step keeps at most one cue besides the Deathblow cues and the death', over.length === 0, over.map(([st, l]) => `step ${st}: ${l.join(' ')}`).join(' | ') || `${plays} steps played`);
    // (6) the Dimming (README cue 10, the reserved glass voice): a Rogue on the expedition map in zone 1 (god mode, the
    // engine's autoplay choices, Instant). After every step the rule is worked out here from the two map views: the front
    // reached new nodes and now the player's node is Dimmed, dims in Q_DIM_NEAR tolls or fewer, or a node next to it was
    // just Dimmed. The cue is logged in exactly those steps (never on a spread far away), kept unless a higher-ranked cue
    // of the same Instant step won, and it sounds (the page is unlocked since (2)).
    await page.evaluate((seed) => window.__ui.dev('build', { classId: 'rogue', zone: 1, mapMode: 'expedition', prep: true, seed }), Q_DIM_SEED); await idle(page);
    await page.evaluate(() => window.__ui.dev('god', { on: true })); await idle(page);
    const dimSteps = await page.evaluate(async (near) => {
      const ui = window.__ui; const out = [];
      const rule = (a, b) => {
        const x = a && a.zone && a.zone.exp; const y = b && b.zone && b.zone.exp;
        if (!x || !y || x.z !== y.z || a.seed !== b.seed || x.nodes.length !== y.nodes.length) return { fresh: 0, want: false };
        const fresh = y.nodes.map((n, i) => (n.dimmed && !x.nodes[i].dimmed ? i : -1)).filter((i) => i >= 0);
        const me = y.nodes[y.pos]; const next = new Set(y.edges.filter((e) => e.includes(y.pos)).map(([p, q]) => (p === y.pos ? q : p)));
        return { fresh: fresh.length, want: fresh.length > 0 && (!!me.dimmed || (Number.isFinite(me.dimsIn) && me.dimsIn <= near) || fresh.some((i) => next.has(i))) };
      };
      for (let n = 0; n < 200; n++) {
        const a = ui.view(); if (a.phase === 'SUMMARY' || (a.zone && a.zone.exp && a.zone.exp.z > 1)) break;
        const from = ui.audio().log.length;
        await ui.act({ type: 'AUTO' }); await ui.idle();
        const b = ui.view(); const r = rule(a, b); const L = ui.audio().log.slice(from);
        const dim = L.filter((x) => x.cue === 'dimmingSpread');
        out.push({ n, ...r, got: dim.length, kept: dim.some((x) => x.kept), sound: dim.some((x) => x.sound), others: L.filter((x) => x.kept && x.cue !== 'dimmingSpread').map((x) => x.cue), me: b.zone && b.zone.exp ? b.zone.exp.nodes[b.zone.exp.pos].dimsIn : null });
        if (out.filter((x) => x.want).length >= 2) break;
      }
      return out;
    }, Q_DIM_NEAR);
    const wants = dimSteps.filter((x) => x.want); const spreads = dimSteps.filter((x) => x.fresh > 0);
    const wrong = dimSteps.filter((x) => x.got !== (x.want ? 1 : 0));
    check('SOUND', `the Dimming near the player logs dimmingSpread in exactly the steps the rule names (${spreads.length} spread steps in ${dimSteps.length}, ${wants.length} near the player)`, wants.length >= 1 && !wrong.length,
      wrong.map((x) => `step ${x.n}: fresh ${x.fresh}, dims in ${x.me}, want ${x.want}, got ${x.got}`).join(' | ') || wants.map((x) => `step ${x.n}: dims in ${x.me}`).join(' | ') || 'the run never brought the Dimming near the player');
    const lost = wants.filter((x) => !(x.kept ? x.sound : x.others.some((c) => (Q_RANK[c] || 0) > Q_RANK.dimmingSpread)));
    check('SOUND', 'dimmingSpread sounds when kept; at Instant only a higher-ranked cue of the same step drops it', wants.length >= 1 && !lost.length, lost.map((x) => `step ${x.n}: kept ${x.kept}, sound ${x.sound}, with ${x.others.join(' ')}`).join(' | ') || wants.map((x) => `step ${x.n}: ${x.kept ? 'kept, sounded' : `dropped for ${x.others.join(' ')}`}`).join(' | '));
  } catch (e) {
    await shot(page, 'Q-error');
    check('-', 'part Q ran to the end', false, e.message.split('\n').slice(0, 3).join(' / '));
  }
  check('-', 'part Q: no console errors, page errors or requests', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ run
const browser = await chromium.launch({ headless: true });
// ------------------------------------------------------------------ part R: the guided first run (M3 3.5)
/**
 * The guided first run and the first-time hints (docs/specs/m3-onboarding.md 2.4-2.7, 3, 4.3, 7.1; engine-api.md 14), real
 * engine at Instant speed, a fresh profile (no stored profile, no hints). (1) Class select offers "Guided first run", on;
 * Enter starts the guided run (create.tutorial). The run is played through the UI on the engine's autoplay choices (AUTO)
 * to zone 2: after every step the coach line shows the engine's beat line (R.tutorialView `line`, content text with the
 * placeholders filled) and every beat line the engine opened appeared on the coach line, in the engine's order; G1-G4, G6, G7
 * and G12-G13 among them (D143: no S4 on this route, so no G8); no coach line covers its anchor, the bar, the engage buttons,
 * the Furnace, the target frame or Set out. Gorrak's node is barred until its script (content elite.gate.afterScript, S3
 * since D143) has ended: its map tooltip shows the gate line with the fights still to come.
 * (2) Rescue: a loaded state with 1 HP in a guided-zone fight; passing until the hero falls gives the rescue banner with the
 * content's line and toll cost, full health, +ONB_RESCUE_TOLLS. (3) Skip: "Skip guide" asks in one line, Skip sends
 * SKIP_GUIDE; no beat line after. (4) Hints: the toggle off starts a normal run (guide 'skipped'); hint H23 shows at the
 * camp, once (not after a reload); Hints Off silences them. (5) The nudge after the first summary (a loaded 1 HP fight in
 * the normal run): the welcome line, Spend Echoes glowing with its line, the Hall's Packed Satchel highlighted with the
 * coach line and "Later". D142 (M3 3.7; playtest-2026-11-13 findings 2-5): (6) a Rogue's first guided fight on the
 * route the engine's autoplay plays (its bar order puts Severing Flourish, a finisher, in slot 1): G3 names the first bar
 * spell the view says can be cast now, with its key chip and the ring on that slot; the turn prompt's "Opening move" line
 * is hidden while the coach line is up and back once none is; a refused key shows its reason at once, by the spell's name,
 * with two notes on screen; G3's key plays the round. (7) a Mage's first engage round (normal run, hints on): H01 says
 * "Open with Q then N, W or E" (N: the bar key of the first Pre-cast spell), the turn prompt hidden, Q then N pre-casts it;
 * then on to the fifth fight won: no hint shows a third time, each shown twice is stored seen with ONB_HINT_SHOWS
 * showings. Every expected key is worked out from the engine's view (viewKeys). No console errors.
 */
async function partR(browser, W, H) {
  const T = CONTENT.tutorial;
  // keys: the view's own key chips (D142 (4): G3's key is the first bar spell castable now; the Mage's Pre-cast is "Q then N")
  const fill = (raw, n = {}, keys = {}) => raw.replace(/\{(\w+)\}/g, (m, k) => ({ key_spell1: '1', key_engage1: 'Q', key_engage2: 'W', key_engage3: 'E', key_pass: 'X', key_item1: '8', key_take_all: 'Space', key_bags: 'B', key_talents: 'N', key_spellbook: 'P', key_autoplay: 'Z', key_flee: 'F', ...keys }[k]
    ?? { deathblowTurn: R.C.SIGNATURE_TURN, bellTolls: R.C.BELL_CHANNEL_TIME, offbalPct: Math.round(R.C.OFFBAL_TAKEN * 100), rescueTolls: R.C.ONB_RESCUE_TOLLS, satchelPotions: R.C.META.satchel.potions, ...n }[k] ?? m));
  const lineText = (id, cls, keys = {}) => { const [b, k] = id.split('.'); const x = T.beats.find((y) => y.id === b); return fill(!k ? x.line || x.byClass[cls] : (x.alt && x.alt[k]) || x.byClass[k], {}, keys); };
  /**
   * The view's keys, worked out here from the engine's view (D142 (4)): key_spell1 = the bar slot of the first spell the
   * view says can be cast now (one cast on an enemy first, R.C.SPELL target); key_engage1 = "Q then N" when the first
   * engage option takes a spell (Pre-cast), N the bar key of the first of its spells on the bar.
   */
  const viewKeys = (page) => page.evaluate((tgt) => {
    const v = window.__ui.view(); const out = {}; const p = v.player; const c = v.combat;
    if (!p || !c || c.over) return out;
    const L = (v.legal && v.legal.spells) || {}; const ok = (id) => !!(id && L[id] && L[id].ok);
    let i = p.bar.findIndex((id) => ok(id) && tgt[id] === 'enemy'); if (i < 0) i = p.bar.findIndex(ok);
    if (i >= 0) out.key_spell1 = String(i + 1);
    const o = c.engage && c.engage.options[0];
    if (o && o.spells && o.spells.length && !o.reason) { const j = p.bar.findIndex((id) => id && o.spells.some((x) => x.spellId === id)); if (j >= 0) out.key_engage1 = `Q then ${j + 1}`; }
    return out;
  }, Object.fromEntries(Object.values(R.C.SPELL).map((s) => [s.id, s.target])));
  const coach = (page) => page.evaluate(() => window.__ui.coach());
  /** The coach line's rect against the protected elements and its anchor (spec 2.5): the names it overlaps. */
  const overlaps = (page) => page.evaluate(() => {
    const c = document.getElementById('coach'); if (!c || c.classList.contains('hidden')) return [];
    const r = c.getBoundingClientRect(); const out = [];
    const sel = { bar: '#actionbar', engage: '#engage .eg-opt, #engage button', furnace: '#heat', target: '#target-frame', setOut: '#pp-go', anchor: '.coach-on' };
    for (const [k, q] of Object.entries(sel)) for (const x of document.querySelectorAll(q)) { const b = x.getBoundingClientRect(); if (b.width && b.height && !x.closest('.hidden') && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom)) out.push(k); }
    return [...new Set(out)];
  });
  // ---- (1) the guided run to zone 2
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      const tg = page.locator('#create .toggle.guide');
      check('M3-R', 'class select: "Guided first run" shown and on for a new profile', (await tg.isVisible()) && (await tg.getAttribute('aria-checked')) === 'true', await tg.getAttribute('aria-checked'));
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let c = await coach(page);
      await shot(page, 'R-prep');
      check('M3-R', 'the start camp: G1\'s line on the coach line, content text', c.shown && c.shown.id === 'G1' && c.shown.text === lineText('G1'), JSON.stringify(c.shown));
      const engineLines = []; const bad = []; const shownSoFar = new Set(); const layout = []; let gate = null; let gateOpen = null; let reachedZ2 = false; let steps = 0;
      let shownSig = null; let shownKeys = {};
      for (; steps < 260; steps++) {
        const st = await page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, z: v.zone ? v.zone.idx : null, t: v.tutorial, cls: v.player ? v.player.classId : 'rogue', fight: !!(v.combat && !v.combat.over && !v.loot), map: v.phase === 'MAP' && !!(v.zone && v.zone.exp) && !v.node }; });
        const t = st.t;
        // a fight's beat line waits while the quest's intro dialog is up (no fight on screen yet); a map line waits for the
        // map on screen (QA playtest 2026-11-13); a resting line (D141) waits for its trigger
        const FIGHT = ['G3', 'G6', 'G7', 'G8', 'G9', 'G11'];
        const MAPL = [...MAP_LINES]; // D143: G2 and G13.closed too (onboarding.js)
        const open = t && !t.skipped && !t.ended ? (t.open || []).filter((o) => o.line && !o.rest && (st.fight || !FIGHT.includes(o.id)) && (st.map || !MAPL.includes(o.line))).map((o) => o.line) : [];
        for (const l of open) if (!engineLines.includes(l)) engineLines.push(l);
        c = await coach(page);
        // the coach line shows one of the engine's open beat lines (tutorialView.line, or the next once the engine rests it, D141), its content text
        for (const x of c.log) if (x.kind === 'beat') shownSoFar.add(x.id);
        const fresh = open.filter((l) => !shownSoFar.has(l));
        // the view's keys when the line came up (its text stays while it is up: after G3's "Press 2" a combo point makes slot 1
        // castable, and the line keeps its key)
        const last = c.log[c.log.length - 1];
        const sig = c.shown && last ? `${c.shown.id}@${last.step}@${last.at}` : null;
        if (sig !== shownSig) { shownSig = sig; shownKeys = c.shown && c.shown.kind === 'beat' ? await viewKeys(page) : {}; }
        // a line already shown may rest (D141, the engine); an open line not yet shown must be on screen now (or one with it)
        if ((fresh.length || (c.shown && c.shown.kind === 'beat')) && !(c.shown && c.shown.kind === 'beat' && open.includes(c.shown.id) && c.shown.text === lineText(c.shown.id, st.cls, shownKeys))) bad.push(`step ${steps}: engine ${open.join('/')}, coach ${c.shown ? `${c.shown.id} "${c.shown.text}"` : 'none'}`);
        if (c.shown) { const o = await overlaps(page); if (o.length) layout.push(`${c.shown.id}: ${o.join(',')}`); }
        if (c.shown && c.shown.id === 'G3' && !(await page.evaluate(() => window.__shotG3))) { await page.evaluate(() => { window.__shotG3 = true; }); await shot(page, 'R-coach-fight'); }
        // Gorrak's gate (D138; D143: after S3): his node barred while its script is still to come; the map tooltip says how many fights are left
        if (t && t.elite && st.phase === 'MAP' && gate === null && t.elite.barred) {
          const el = page.locator(`#screens .mnode[data-node="${t.elite.node}"]`);
          if (await el.count()) {
            await el.hover({ force: true }); await page.waitForTimeout(150);
            const tipText = (await page.locator('.tooltip.on').innerText().catch(() => '')).replace(NBSP, ' ');
            gate = { left: t.elite.left, cls: await el.getAttribute('class'), tip: tipText };
            await page.mouse.move(2, 2);
          }
        }
        if (t && t.elite && gate && !t.elite.barred && gateOpen === null && st.phase === 'MAP') gateOpen = { script: t.script, barred: await page.locator(`#screens .mnode[data-node="${t.elite.node}"].barred`).count() };
        if (st.z !== null && st.z >= 1 && st.phase !== 'PREP' && t && t.ended) { reachedZ2 = true; break; }
        await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page);
      }
      c = await coach(page);
      const shownBeats = c.log.filter((x) => x.kind === 'beat').map((x) => x.id);
      const seq = shownBeats.filter((x, i) => shownBeats[i - 1] !== x);
      const firstShown = [...new Set(seq)];
      const missing = engineLines.filter((l) => !firstShown.includes(l));
      const order = engineLines.filter((l) => firstShown.includes(l)).join('>') === firstShown.filter((l) => engineLines.includes(l)).join('>');
      check('M3-R', `every beat line the engine opened showed on the coach line, in the order it opened (${engineLines.join(' > ')})`, reachedZ2 && !missing.length && order && !bad.length, `steps ${steps}, shown ${seq.join(' > ')}${missing.length ? ` | never shown: ${missing}` : ''}${bad.length ? ` | ${bad.slice(0, 4).join(' | ')}` : ''}`);
      const ids = new Set(engineLines.map((x) => x.split('.')[0]));
      // D143 (engine-2026-11-13d section 2): Gorrak's gate opens after S3, so the autoplay route plays no S4 and G8 (the
      // wind-up beat) does not open before zone 2: G1-G4, G6, G7, G12 and G13
      check('M3-R', 'G1-G4, G6, G7, G12 and G13 among them (spec 7.1.1; G8 not on this route since D143)', ['G1', 'G2', 'G3', 'G4', 'G6', 'G7', 'G12', 'G13'].every((x) => ids.has(x)), [...ids].join(','));
      check('M3-R', 'no coach line overlapped its anchor, the bar, the engage buttons, the Furnace, the target frame or Set out', !layout.length, layout.slice(0, 6).join(' | ') || 'none');
      const gateAt = Number(String(T.elite.gate.afterScript).replace(/\D/g, '')); // D143: 's3'
      check('M3-R', `Gorrak barred until S${gateAt}: the node is marked and its tooltip shows the gate line with the fights still to come`, !!gate && /barred/.test(gate.cls) && gate.tip.includes(fill(T.elite.gate.barredLine, { n: gate.left })), JSON.stringify(gate));
      check('M3-R', `after S${gateAt} the node opens (no bar on the map)`, !!gateOpen && gateOpen.script >= gateAt && gateOpen.barred === 0, JSON.stringify(gateOpen));
      check('M3-R', 'the guide ends on leaving zone 1: the end line as a toast', (await page.locator('#toasts .toast', { hasText: T.guide.endLine }).count()) > 0 || c.log.length > 0, '');
    } catch (e) { await shot(page, 'R-error-1'); check('M3-R', 'part R (guided run) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('M3-R', 'part R (guided run): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (2) rescue, (3) skip
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 120; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      const ser = await page.evaluate(() => window.__ui.state());
      const s0 = R.deserialize(ser, CONTENT); s0.player.hp = 1;
      const before = { time: s0.time, rescues: s0.tutorial.rescues };
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      let banner = ''; let v = null;
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('KeyX'); await page.waitForTimeout(60);
        banner = banner || await page.locator('#banner.on .b1').innerText().catch(() => '');
        await idle(page);
        v = await page.evaluate(() => { const x = window.__ui.view(); return { phase: x.phase, hp: x.player.hp, maxHp: x.player.maxHp, time: x.time, rescues: x.tutorial.rescues, combat: !!x.combat }; });
        if (v.rescues > before.rescues) break;
      }
      const log = await logLines(page);
      const line = fill(T.guide.rescueLine);
      await shot(page, 'R-rescue');
      check('M3-R', `rescue: the banner "${line}", a log line, full health, +${R.C.ONB_RESCUE_TOLLS} tolls or more, back on the map`,
        v && v.rescues === before.rescues + 1 && banner === line && log.includes(line) && v.hp === v.maxHp && v.time >= before.time + R.C.ONB_RESCUE_TOLLS && !v.combat, `${JSON.stringify(v)} banner "${banner}"`);
      // (3) skip from the coach line: one-line confirm, then SKIP_GUIDE
      for (let i = 0; i < 40 && !((await coach(page)).shown || {}).kind; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      const sh = (await coach(page)).shown;
      await page.locator('#coach .co-skip').click(); await idle(page);
      const ask = await page.locator('#coach .co-t').innerText();
      await page.locator('#coach .co-skip').click(); await idle(page);
      const t = await page.evaluate(() => window.__ui.view().tutorial);
      const sent = (await page.evaluate(() => window.__ui.engineLog())).some((a) => a.type === 'SKIP_GUIDE');
      let after = null;
      for (let i = 0; i < 25; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); const x = (await coach(page)).shown; if (x && x.kind === 'beat') { after = x.id; break; } }
      check('M3-R', 'skip: "Skip guide" asks in one line, Skip sends SKIP_GUIDE; no beat line after', !!sh && sh.kind === 'beat' && /Skip the guide/.test(ask) && sent && t.skipped && !after, `${JSON.stringify(sh)} ask "${ask}" sent ${sent} skipped ${t.skipped} after ${after}`);
    } catch (e) { await shot(page, 'R-error-2'); check('M3-R', 'part R (rescue, skip) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('M3-R', 'part R (rescue, skip): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (4) hints once, Hints off; (5) the nudge after the first summary
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=21&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.locator('#create .toggle.guide').click(); await idle(page);
      const off = await page.locator('#create .toggle.guide').getAttribute('aria-checked');
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const prof = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), PROFILE_KEY));
      const t0 = await page.evaluate(() => window.__ui.view().tutorial);
      const sh = (await coach(page)).shown;
      check('M3-R', 'toggle off: a normal run (no tutorial), the profile\'s guide "skipped"; hint H23 shows at the camp (content line)', off === 'false' && !t0 && prof.guide === 'skipped' && sh && sh.id === 'H23' && sh.text === T.hints.find((x) => x.id === 'H23').line, `${off} ${JSON.stringify(t0)} ${prof.guide} ${JSON.stringify(sh)}`);
      await page.locator('#coach .co-ok').click(); await idle(page);
      // Hints off from Settings: no line on the next steps
      await page.keyboard.press('Escape'); await page.locator('#win-settings .hintseg button', { hasText: 'Off' }).click(); await page.keyboard.press('Escape'); await idle(page);
      let any = null;
      for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); const x = (await coach(page)).shown; if (x) { any = x.id; break; } }
      const st = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), HINTS_KEY));
      check('M3-R', 'Hints Off (Settings) silences every hint; H23 stays seen', !any && st.off === true && st.seen.H23 === true, `${any} ${JSON.stringify(st)}`);
      await page.evaluate((k) => { const x = JSON.parse(localStorage.getItem(k)); x.off = false; localStorage.setItem(k, JSON.stringify(x)); }, HINTS_KEY);
      // (5) a death in a fight of the normal run: the first summary with the welcome
      await page.goto(`${URL}?seed=21&speed=instant&fresh=1`); await page.waitForFunction(() => window.__ui);
      check('M3-R', 'a second visit: no "Guided first run" (guide skipped)', !(await page.locator('#create .toggle.guide').isVisible()), '');
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const again = (await coach(page)).shown;
      check('M3-R', 'H23 shows once: not at the camp of the next run', !again || again.id !== 'H23', JSON.stringify(again));
      for (let i = 0; i < 120; i++) { const v = await view(page); if (v.round >= 2 && !v.over && v.step === 'combat') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); s0.player.hp = 1; s0.player.res.boon = 0; s0.player.res.meta = 0;
      s0.player.bag = s0.player.bag.filter((x) => !(x.kind === 'cons' && x.id === 'ember_of_return'));
      await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page);
      for (let i = 0; i < 12 && (await view(page)).phase !== 'SUMMARY'; i++) { await page.keyboard.press('KeyX'); await idle(page); }
      const sum = await page.evaluate(() => ({ phase: window.__ui.view().phase, welcome: [...document.querySelectorAll('.echo.welcome')].map((e) => e.textContent), glow: !!document.querySelector('.sfoot .btn.glow'), line: (document.querySelector('.sfoot .nudgeline') || {}).textContent || '' }));
      check('M3-R', `the first summary: "${T.nudge.welcomeLabel}" +${R.C.ONB_WELCOME_ECHOES}, Spend Echoes glows with "${T.nudge.summaryLine}"`,
        sum.phase === 'SUMMARY' && sum.welcome.length === 1 && sum.welcome[0].includes(T.nudge.welcomeLabel) && sum.welcome[0].includes(`+${R.C.ONB_WELCOME_ECHOES}`) && sum.glow && sum.line === T.nudge.summaryLine, JSON.stringify(sum));
      await page.getByRole('button', { name: 'Spend Echoes' }).click(); await idle(page); await page.waitForTimeout(200);
      const hall = await page.evaluate(() => ({ nudge: !!document.querySelector('#meta .mcard.nudge[data-id="satchel"]'), coach: window.__ui.coach().shown, later: (document.querySelector('#coach .co-ok') || {}).textContent }));
      const ov = await overlaps(page);
      await shot(page, 'R-nudge');
      check('M3-R', 'the Hall: Packed Satchel highlighted, its coach line (content, potions from C) with "Later", the card not covered', hall.nudge && hall.coach && hall.coach.kind === 'nudge' && hall.coach.text === fill(T.nudge.hallLine) && hall.later === T.nudge.later && !ov.length, `${JSON.stringify(hall)} overlaps ${ov}`);
      await page.locator('#coach .co-ok').click(); await idle(page);
      const st2 = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), HINTS_KEY));
      check('M3-R', '"Later" closes it for good (stored), the card stays buyable', !(await page.locator('#meta .mcard.nudge').count()) && st2.nudge.hall === true && (await page.locator('#meta .mcard[data-id="satchel"] button.buy').isEnabled()), JSON.stringify(st2.nudge));
    } catch (e) { await shot(page, 'R-error-3'); check('M3-R', 'part R (hints, nudge) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('M3-R', 'part R (hints, nudge): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (6) D142 (playtest-2026-11-13 findings 2-5): the Rogue's first guided fight (G3's key, the turn prompt, a refused key)
  const tp = (page) => page.evaluate(() => { const t = document.getElementById('turnprompt'); const c = document.getElementById('coach'); return { kind: t.dataset.kind, shown: getComputedStyle(t).display !== 'none' && !t.classList.contains('hidden'), text: t.textContent, coach: !!c && !c.classList.contains('hidden') }; });
  const chips = (page) => page.locator('#coach .co-t .kbd').evaluateAll((els) => els.map((e) => e.textContent));
  /** "Got it" until no coach line is up (a queued hint may follow the one put away); true when none is left. */
  const clearCoach = async (page) => { for (let i = 0; i < 6; i++) { if (!(await coach(page)).shown) return true; await page.locator('#coach .co-ok').click(); await idle(page); } return !(await coach(page)).shown; };
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=7&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      let c = null;
      for (let i = 0; i < 160; i++) { c = await coach(page); const v = await view(page); if (v.step === 'combat' && v.round === 1 && c.shown && c.shown.id === 'G3') break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      await page.mouse.move(2, 2);
      const fv = await page.evaluate(() => { const v = window.__ui.view(); return { round: v.combat && v.combat.round, bar: v.player.bar, legal: Object.fromEntries(Object.entries(v.legal.spells).map(([id, x]) => [id, { ok: x.ok, reason: x.reason || null }])) }; });
      const vk = await viewKeys(page); const key = vk.key_spell1;
      const ring = await page.evaluate(() => { const r = document.querySelector('.coach-on'); return r ? `${r.id || r.className.split(' ')[0]}:${r.dataset.slot ?? ''}` : null; });
      const k1 = await chips(page);
      await shot(page, 'R-d142-rogue-g3');
      check('D142-4b', `the Rogue's first guided fight: G3 names the first bar spell that can be cast now ("Press ${key}"; bar ${fv.bar.slice(0, 2).join(', ')}), its key chip and the ring on that slot`,
        c.shown && c.shown.id === 'G3' && !!key && c.shown.text === lineText('G3', 'rogue', vk) && k1.join(',') === key && ring === `ab:${Number(key) - 1}` && fv.legal[fv.bar[Number(key) - 1]].ok,
        `${JSON.stringify(c.shown)} chips ${k1} ring ${ring} legal ${JSON.stringify(fv.legal)}`);
      const p1 = await tp(page);
      check('D142-2', 'while the coach line is up, the turn prompt\'s "Opening move" line is hidden (no second instruction)', p1.coach && p1.kind === 'engage' && !p1.shown, JSON.stringify(p1));
      // a key that is refused (the finisher: no combo point in round 1) answers at once with the engine's reason, by the spell's
      // name, even with two notes on screen (QA: the refusal waited behind two toasts and the key seemed to do nothing)
      const badSlot = fv.bar.findIndex((id) => id && !fv.legal[id].ok);
      await page.evaluate(() => { window.__ui.toast('Test note one', 'info'); window.__ui.toast('Test note two', 'good'); });
      let refused = null;
      if (badSlot >= 0) {
        await page.keyboard.press(`Digit${badSlot + 1}`); await page.waitForTimeout(150);
        refused = await page.evaluate(() => ({ toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent), round: window.__ui.view().combat.round }));
      }
      const why = badSlot >= 0 ? fv.legal[fv.bar[badSlot]].reason : '';
      check('D142-4b', `a refused key (${badSlot + 1}: ${fv.bar[badSlot]}) shows its reason at once, by the spell's name ("${why}"), in place of a note; the round does not move`,
        badSlot >= 0 && refused.toasts.length <= 2 && refused.toasts.includes(why) && !/_/.test(why) && why.includes(R.C.SPELL[fv.bar[badSlot]].name) && refused.round === 1, JSON.stringify(refused));
      const cleared = await clearCoach(page);
      const p2 = await tp(page);
      check('D142-2', 'with no coach line up, the turn prompt shows "Opening move" again', cleared && p2.kind === 'engage' && p2.shown && /Opening move/.test(p2.text), JSON.stringify(p2));
      await page.keyboard.press(`Digit${key}`); await idle(page);
      const after = await page.evaluate(() => { const v = window.__ui.view(); const log = window.__ui.engineLog(); return { round: v.combat ? v.combat.round : null, over: v.combat ? v.combat.over : null, last: log[log.length - 1] }; });
      check('D142-4b', `the key G3 names (${key}) plays the round: CAST ${fv.bar[Number(key) - 1]}`, after.last && after.last.type === 'CAST' && after.last.spellId === fv.bar[Number(key) - 1] && (after.round > 1 || !!after.over), JSON.stringify(after));
    } catch (e) { await shot(page, 'R-error-6'); check('D142', 'part R (6, Rogue) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('D142', 'part R (6, Rogue): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  // ---- (7) D142: the Mage's first engage round in a normal run (H01 names Q then the spell key), then a hint is seen after
  // two showings: the run played on to its fifth fight won, no hint shows a third time
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, { hints: true });
    try {
      await page.locator('#create .ccard[data-cls="mage"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      for (let i = 0; i < 160; i++) { const v = await view(page); if (v.step === 'combat' && v.round === 1) break; await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); }
      // a higher-priority hint of the same round (a wind-up's H03) comes first; H01 shows when it is put away
      for (let i = 0; i < 3; i++) { const x = (await coach(page)).shown; if (!x || x.id === 'H01' || x.kind !== 'hint') break; await page.locator('#coach .co-ok').click(); await idle(page); }
      await page.mouse.move(2, 2);
      const sh = (await coach(page)).shown;
      const vk = await viewKeys(page); const n = (vk.key_engage1 || '').replace('Q then ', '');
      const k = await chips(page);
      const p1 = await tp(page);
      await shot(page, 'R-d142-mage-h01');
      check('D142-4a', `the Mage's first engage round: H01 names Q, then the Pre-cast spell's key ("Open with Q then ${n}, W or E"), key chips Q, ${n}, W, E`,
        sh && sh.id === 'H01' && !!n && sh.text === fill(T.hints.find((x) => x.id === 'H01').line, {}, vk) && k.join(',') === `Q,${n},W,E`, `${JSON.stringify(sh)} chips ${k} keys ${JSON.stringify(vk)}`);
      check('D142-2', 'the Mage\'s H01 on screen: the turn prompt\'s "Opening move" line is hidden', p1.coach && p1.kind === 'engage' && !p1.shown, JSON.stringify(p1));
      const spell = await page.evaluate((i) => window.__ui.view().player.bar[i], Number(n) - 1);
      await page.keyboard.press('KeyQ'); await idle(page);
      await page.keyboard.press(`Digit${n}`); await idle(page);
      const after = await page.evaluate(() => { const v = window.__ui.view(); const log = window.__ui.engineLog(); return { round: v.combat ? v.combat.round : null, last: log[log.length - 1] }; });
      check('D142-4a', `Q then ${n} pre-casts ${spell} (ENGAGE precast) and the round moves on`, after.last && after.last.type === 'ENGAGE' && after.last.option === 'precast' && after.last.spellId === spell && after.round === 2, JSON.stringify(after));
      // (3) the run on AUTO to its fifth fight won (the hints come and go at Instant speed, most under ONB_HINT_MIN_MS)
      let won = 0;
      for (let i = 0; i < 400 && won < 5; i++) {
        const r0 = await page.evaluate(async () => { const r = await window.__ui.act({ type: 'AUTO' }); return r && r.events ? r.events.map((e) => e.t) : []; });
        if (r0.includes('victory')) won += 1;
        await idle(page);
        if ((await view(page)).phase === 'SUMMARY') break;
      }
      const co = await coach(page);
      const shows = {};
      co.log.forEach((x, i) => { if (x.kind !== 'hint') return; (shows[x.key] = shows[x.key] || []).push(co.log[i + 1] ? co.log[i + 1].at - x.at : null); });
      const twice = Object.entries(shows).filter(([, a]) => a.length >= 2);
      const over = Object.entries(shows).filter(([, a]) => a.length > ONB_HINT_SHOWS);
      const notSeen = twice.filter(([key]) => !(co.store.seen[key] === true && co.store.shows[key] === ONB_HINT_SHOWS));
      check('D142-3', `a hint counts as seen after two showings: after ${won} fights won no hint showed a third time; each one shown twice is stored seen with 2 showings (${twice.map(([key, a]) => `${key} ${a.map((ms) => (ms == null ? '?' : `<${ms} ms`)).join('/')}`).join(', ') || 'none'})`,
        won >= 3 && twice.length >= 1 && !over.length && !notSeen.length, `over ${JSON.stringify(over)} not seen ${JSON.stringify(notSeen)} store ${JSON.stringify(co.store.shows)}`);
    } catch (e) { await shot(page, 'R-error-7'); check('D142', 'part R (7, Mage, hints) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('D142', 'part R (7, Mage, hints): no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

// ------------------------------------------------------------------ part S: D143 and the blind tester panel (UI side)
/**
 * Part S (M3 3.7): the D143 UI to-dos (docs/handoffs/engine-2026-11-13c.md section 2) and the findings of the blind tester
 * panel of 2026-11-13 (docs/feedback/2026-11-13-blind-casual.md, 2026-11-13-blind-tactician.md), items 1-10 of
 * docs/handoffs/ui-2026-11-13d.md. Real engine; every check drives the game's own keys and clicks; window.__ui reads the
 * view and, as setup only, steps the engine's autoplay choices (AUTO), runs Dev menu ops or loads a state (R.serialize).
 *   S1  the guided run (seed 8736, Rogue, Instant): G13.closed on the coach line with its ring on Gorrak's node; every
 *       closed Road node and signpost marked, its tooltip the closed line; H19 not counted by the closed line; a toast when
 *       the Roads open; Gorrak's barred node has its tooltip (item 3); a quest reward's "Equip now" (item 9); the Furnace
 *       header fits when the Dimming sets the state (item 5); no wind-up line prints "null" (item 10; the run goes on into
 *       zone 2 until a normal wind-up has shown). D144-1: the first hub's welcome and Trainer card by R.trainerView;
 *       D144-9: a guided fight's node says so, not the ring's band.
 *   S2  at 1x: the camp's Set out, the hub's toasts under the zone banner (item 6); the hub's Set out: no coach line while
 *       the hero walks out, "Click a lit node" once the map shows (item 2).
 *   S3  zone 2 and 3 (Dev menu): every elite's tooltip (item 3); the Moves list one column in the map (item 5); a bag
 *       item's tooltip goes with the bags (item 4); the bag menu beside the grid (item 6); bag slots stay put (item 9); the
 *       Bell asks first (item 8); the rim names apart on a state where they would meet (item 5). D144-5: every elite at its
 *       own level, with its gap to the player's.
 *   S4  the hub (Dev menu, zone 2): all of it in view; Take keeps the cards under it in place; the Inn asks at full health
 *       and rests at once when hurt (items 5, 8).
 *   S5  fights at 1x (Dev menu): a refused key answers at once, also while a round plays, in words (energy, mana); the flee
 *       ask stays until answered, F and the button alike, a refused flee says why (item 7); a level-up banner clear of the
 *       fight's panels; the enemy's Deathblow headline clear of the coach line; the death screen clear of the panels (item 6).
 *       D144-7: one flight, one log line; D144-11: Rime Burst's answer gives its hit chance over the enemy, its tooltip the
 *       chance on each enemy.
 * The D144-n checks are the UI needs n of docs/handoffs/engine-2026-11-13d.md section 4 (D144-10 is in part M's reward):
 *   S6  a zone 2 map (Dev menu, seed 8748): a Grind's tooltip on the expedition map (one wave), the ring's band only for a
 *       node of unknown level, an unguarded chest's gold and loot in the log only after "Open the chest", the tracker's
 *       wave in a Grind ("Wave 1 of 1", then "1 of 1 wave done"), Gutting Jab's tooltip with its hit chance.
 *   S7  hints on, every hint but H05 seen: an off-balance elite whose shield takes the whole hit gives H05's shield line and
 *       leaves H05 unseen; a later window without a shield gives the plain line.
 */
async function partS(browser, W, H) {
  const T = CONTENT.tutorial;
  const coach = (page) => page.evaluate(() => window.__ui.coach());
  const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.closest('.hidden')) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; }, sel);
  // the boxes of what shows (an ancestor's opacity counts: the death screen fades #nameplates, not each nameplate)
  const boxes = (page, sel) => page.evaluate((s) => {
    const seen = (e) => { if (e.closest('.hidden') || getComputedStyle(e).visibility === 'hidden') return false; let o = 1; for (let a = e; a && a.nodeType === 1; a = a.parentElement) o *= Number(getComputedStyle(a).opacity); return o > 0.05; };
    return [...document.querySelectorAll(s)].filter(seen).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, id: e.id || e.className.split(' ')[0] }; }).filter((r) => r.r > r.l && r.b > r.t);
  }, sel);
  const meet = (a, b, pad = 0.5) => !!a && !!b && a.l < b.r - pad && a.r > b.l + pad && a.t < b.b - pad && a.b > b.t + pad;
  const fmt = (r) => (r ? [r.l, r.t, r.r, r.b].map(Math.round).join(',') : 'none');
  const tipOn = (page) => page.evaluate(() => { const t = document.querySelector('.tooltip'); return t && t.classList.contains('on') ? t.innerText.replace(/ /g, ' ') : null; });
  const engineLen = (page) => page.evaluate(() => window.__ui.engineLog().length);
  const lastActs = (page, n) => page.evaluate((k) => window.__ui.engineLog().slice(-k), n);
  const watchToasts = (page) => page.evaluate(() => { window.__sT = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) window.__sT.push(n.textContent); }).observe(document.querySelector('#toasts'), { childList: true }); });
  const load = async (page, edit) => { const s0 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT); edit(s0); const ok = await page.evaluate((x) => window.__ui.loadState(x), R.serialize(s0)); await idle(page); return ok; };
  const auto = async (page) => { await page.evaluate(() => window.__ui.act({ type: 'AUTO' })); await idle(page); };

  // ---- S1: the guided run (D143; items 3, 5, 9, 10)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1', null, { guide: true, hints: true });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await watchToasts(page);
      let closed = null; let roadsOpened = null; let barredTip = null; let furnace = null; let eqNow = null; const wub = []; let zone2 = false;
      let hub1 = null; let guidedTip = null; let z2Steps = 0;
      const plainWu = () => wub.some((x) => !/Deathblow/.test(x));
      // to zone 2; then on in zone 2 until a wind-up that is not a Deathblow has shown (D143: the guided route no longer
      // plays S4, the zone's wind-up fight, so the first normal wind-up comes after the guide)
      for (let i = 0; i < 440; i++) {
        const st = await page.evaluate(() => {
          const v = window.__ui.view(); const mv = v.zone && v.zone.exp; const t = v.tutorial;
          return { phase: v.phase, z: v.zone ? v.zone.idx : null, onMap: v.phase === 'MAP' && !!mv && !v.node, t: t && { roads: t.roads, elite: t.elite, ended: t.ended },
            closedRoads: mv ? mv.nodes.filter((n) => n.road && n.closed).map((n) => n.id) : [], by: v.heat ? v.heat.by : null, loot: v.loot ? v.loot.kind : null,
            // Gorrak's node seen, barred and next to the player (a move mapView lists as barred: its tooltip threw)
            eliteNext: !!(mv && t && t.elite && t.elite.barred && mv.nodes[t.elite.node].know === 'full' && mv.moves.some((m) => m.nodeId === t.elite.node)),
            // a guided fight's node (mapView `guided`, D144) with its level known
            guided: mv ? (mv.nodes.find((n) => n.guided && n.know === 'full' && n.cl && !n.done) || {}).id ?? null : null,
            wub: [...document.querySelectorAll('#nameplates .wub:not(.hidden)')].map((e) => e.textContent) };
        });
        wub.push(...st.wub);
        if (st.z >= 2) zone2 = true;
        if (zone2) { if (plainWu() || ++z2Steps > 160) break; await auto(page); continue; }
        // the first hub (D144, engine-2026-11-13d UI need 1): the welcome line and the Trainer card by R.trainerView
        if (!hub1 && st.phase === 'ZONE_HUB' && st.z === 1) {
          hub1 = await page.evaluate(() => {
            const v = window.__ui.view(); const card = [...document.querySelectorAll('#screens .svc-card')].find((e) => e.querySelector('.nm').textContent === 'Trainer');
            return { zone: v.zone.name, tv: v.trainer, log: [...document.querySelectorAll('#combatlog .lines .lg-sys')].map((e) => e.textContent), card: card ? card.querySelector('.meta').textContent : null };
          });
        }
        // a guided fight's node (D144, UI need 9): "guided fight", not the ring's band, once its level is known
        if (!guidedTip && st.onMap && st.guided != null) {
          const el = page.locator(`#screens .expmap .mnode[data-node="${st.guided}"]`);
          if (await el.count()) { await el.hover({ force: true }); await page.waitForTimeout(120); guidedTip = { id: st.guided, tip: await tipOn(page) }; await page.mouse.move(2, 2); }
        }
        const c = await coach(page);
        // G13.closed on the map: the ring and arrow at Gorrak's node; the closed Roads marked; H19 not counted
        if (!closed && st.onMap && c.shown && c.shown.id === 'G13.closed') {
          await page.mouse.move(2, 2);
          const ring = await page.evaluate(() => { const r = document.querySelector('.coach-on'); const a = document.querySelector('#coach .co-arrow'); return { node: r && r.matches('.mnode') ? Number(r.dataset.node) : null, arrow: a ? a.className : null }; });
          const marks = await page.evaluate(() => ({ nodes: [...document.querySelectorAll('#screens .expmap .mnode.rclosed')].map((e) => Number(e.dataset.node)).sort((a, b) => a - b), signs: [...document.querySelectorAll('#screens .expmap .xroad.rclosed')].map((e) => ({ road: Number(e.dataset.road), tag: (e.querySelector('.xshut') || {}).textContent || '' })) }));
          let roadTip = null;
          if (st.closedRoads.length) { await page.locator(`#screens .expmap .mnode[data-node="${st.closedRoads[0]}"]`).hover({ force: true }); await page.waitForTimeout(120); roadTip = await tipOn(page); await page.mouse.move(2, 2); }
          await shot(page, 'S1-g13-closed');
          await page.locator('#coach .co-ok').click(); await idle(page);
          const store = (await coach(page)).store;
          closed = { ring, marks, roadTip, want: st.closedRoads.sort((a, b) => a - b), node: st.t.roads.node, h19: { seen: !!store.seen.H19, shows: store.shows.H19 || 0 } };
        }
        // Gorrak's node while barred: a tooltip (it threw before), with the gate line and no "Click to enter"
        if (!barredTip && st.onMap && st.eliteNext) {
          const el = page.locator(`#screens .expmap .mnode[data-node="${st.t.elite.node}"]`);
          if (await el.count()) { const e0 = errors.length; await el.hover({ force: true }); await page.waitForTimeout(150); barredTip = { text: await tipOn(page), errors: errors.length - e0 }; await page.mouse.move(2, 2); }
        }
        // the Roads open: their toast (it may wait behind two others, TOAST_MAX, for a few seconds)
        if (closed && roadsOpened === null && st.t && st.t.roads && !st.t.roads.closed) {
          await page.waitForFunction((t) => window.__sT.some((x) => x.startsWith(t)), T.guide.roadsOpenLine || ROADS_OPEN_LINE, { timeout: 9000, polling: 100 }).catch(() => null);
          roadsOpened = await page.evaluate(() => window.__sT.slice());
        }
        // the Furnace header when the Dimming sets the state (the longest header)
        if (!furnace && st.onMap && st.by === 'dim') furnace = await page.evaluate(() => { const h0 = document.getElementById('heat'); const row = h0.querySelector('.ht-row'); const hr = h0.getBoundingClientRect(); const kids = [...row.children].filter((k) => getComputedStyle(k).display !== 'none').map((k) => k.getBoundingClientRect()); return { sw: row.scrollWidth, cw: row.clientWidth, inside: kids.every((k) => k.left >= hr.left - 0.5 && k.right <= hr.right + 0.5), text: row.textContent, cls: h0.className }; });
        // the first reward window with "Equip now": choose and put on at once
        if (!eqNow && st.loot && st.loot !== 'loot' && await page.locator('#screens .choice-cards .eqnow').count()) {
          const uid = await page.locator('#screens .choice-cards .eqnow').first().getAttribute('data-uid');
          const n0 = await engineLen(page);
          await page.locator('#screens .choice-cards .eqnow').first().click(); await idle(page);
          const acts = (await page.evaluate(() => window.__ui.engineLog())).slice(n0);
          const worn = await page.evaluate((u) => Object.values(window.__ui.view().player.equip).some((x) => x && x.uid === u), uid);
          eqNow = { uid, acts: acts.map((a) => `${a.type}${a.itemId ? `:${a.itemId}` : ''}`), worn };
          continue;
        }
        // the camp's Set out as its button sends it (AUTO sends autoplay's choice inside its own step, which the hub's
        // arrival, its banner and welcome line, do not play for)
        if (st.phase === 'PREP' && await page.evaluate(() => { const a = window.__ui.autoChoice(); return !!(a && a.action && a.action.type === 'SET_OUT'); })) { await page.evaluate(() => window.__ui.act({ type: 'SET_OUT' })); await idle(page); continue; }
        await auto(page);
      }
      check('D143-1', `G13.closed on the map: its ring on Gorrak's node (${closed && closed.node}), the arrow pointing at it`, !!closed && closed.ring.node === closed.node && closed.ring.arrow && !/none/.test(closed.ring.arrow), JSON.stringify(closed && closed.ring));
      check('D143-1', 'every closed Road node (mapView closed) has the closed mark, its signpost a Closed tag, its tooltip the closed line',
        !!closed && closed.want.length > 0 && JSON.stringify(closed.marks.nodes) === JSON.stringify(closed.want) && closed.marks.signs.length === closed.want.length && closed.marks.signs.every((x) => x.tag === 'Closed')
        && !!closed.roadTip && closed.roadTip.includes(T.beats.find((b) => b.id === 'G13').alt.closed), JSON.stringify(closed && { want: closed.want, marks: closed.marks, tip: closed.roadTip }));
      check('D143-1', 'the closed line shown and put away does not count for the Bell\'s hint H19 (no showing, not seen)', !!closed && !closed.h19.seen && closed.h19.shows === 0, JSON.stringify(closed && closed.h19));
      check('D143-1', `a toast when the Roads open ("${T.guide.roadsOpenLine || ROADS_OPEN_LINE}")`, Array.isArray(roadsOpened) && roadsOpened.some((x) => x.startsWith(T.guide.roadsOpenLine || ROADS_OPEN_LINE)), JSON.stringify(roadsOpened));
      check('S-3', 'Gorrak\'s barred node next to the player has a tooltip: Elite, its Deathblow, the gate line, no "Click to enter", no error', !!barredTip && !!barredTip.text && /^Elite/.test(barredTip.text) && /Deathblow/.test(barredTip.text) && barredTip.text.includes('Gorrak is out on the downs') && !/Click to enter/.test(barredTip.text) && barredTip.errors === 0, JSON.stringify(barredTip));
      check('S-5', 'the Furnace header fits its frame when the Dimming sets the state ("· Dimming")', !!furnace && furnace.sw <= furnace.cw + 1 && furnace.inside && /Dimming/.test(furnace.text), JSON.stringify(furnace));
      check('S-9', 'a reward that is an upgrade offers "Equip now": one click sends CHOOSE_REWARD then EQUIP of that item, and it is worn', !!eqNow && eqNow.acts.length === 2 && /^CHOOSE_REWARD/.test(eqNow.acts[0]) && eqNow.acts[1] === `EQUIP:${eqNow.uid}` && eqNow.worn, JSON.stringify(eqNow));
      check('S-10', `no wind-up line over an enemy prints "null" (${wub.length} seen, ${wub.filter((x) => !/Deathblow/.test(x)).length} not a Deathblow, to ${z2Steps} steps into zone 2)`, plainWu() && !wub.some((x) => /null/.test(x)), [...new Set(wub)].slice(0, 6).join(' | '));
      check('S-1', 'the guided run reached zone 2', zone2, '');
      // D144 (engine-2026-11-13d UI need 1): at level 1 the trainer has nothing to teach (R.trainerView useful false), so the
      // welcome is content guide.hubLine, not "Visit the trainer"; the Trainer card says when its next spell comes
      const hubWant = hub1 ? fillLine(hub1.tv && !hub1.tv.useful ? T.guide.hubLine : T.guide.hubTrainerLine, { zone: hub1.zone }).text : null;
      check('D144-1', `the first hub's welcome line follows R.trainerView (useful ${hub1 && hub1.tv ? hub1.tv.useful : '?'}): "${hubWant}"; no "Visit the trainer" with nothing to learn`,
        !!hub1 && !!hub1.tv && hub1.tv.useful === false && hub1.log.includes(hubWant) && !hub1.log.some((x) => /Visit the trainer/.test(x)), JSON.stringify(hub1));
      check('D144-1', `the first hub's Trainer card: "Nothing new to learn yet (next spell at level ${hub1 && hub1.tv ? hub1.tv.next : '?'})"`, !!hub1 && !!hub1.tv && hub1.card === `Nothing new to learn yet (next spell at level ${hub1.tv.next})`, JSON.stringify(hub1 && hub1.card));
      check('D144-9', 'a guided fight\'s node with its level known: its tooltip says "guided fight", not the ring\'s level band', !!guidedTip && !!guidedTip.tip && /guided fight/.test(guidedTip.tip) && !/levels \d/.test(guidedTip.tip), JSON.stringify(guidedTip));
    } catch (e) { await shot(page, 'S1-error'); check('S-1', 'part S1 (guided run) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-1', 'part S1: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S2: at 1x, the camp's Set out (toasts under the zone banner) and the hub's Set out (the coach line waits for the map)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&fresh=1', null, { guide: true, hints: true });
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.locator('#prep .pp-card').first().click(); await idle(page);
      await page.locator('#pp-go').click();
      const under = [];
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(60);
        const r = await page.evaluate(() => { const b = document.getElementById('banner'); if (!b.classList.contains('on')) return null; const q = b.getBoundingClientRect(); return { b: { l: q.left, t: q.top, r: q.right, b: q.bottom }, ts: [...document.querySelectorAll('#toasts .toast')].map((t) => { const x = t.getBoundingClientRect(); return { text: t.textContent, l: x.left, t: x.top, r: x.right, b: x.bottom }; }) }; });
        if (r) under.push(r);
      }
      const hits = under.flatMap((r) => r.ts.filter((t) => meet(t, r.b)).map((t) => t.text));
      check('S-6', `the zone banner and the toasts at the hub: no toast over the banner (${under.length} looks with the banner on, ${under.reduce((a, r) => a + r.ts.length, 0)} toasts)`, under.length > 0 && under.some((r) => r.ts.length) && !hits.length, hits.join(' | ') || JSON.stringify(under[0]));
      await idle(page);
      // the hub's Set out: the walk out plays; no coach line shows until the map does, then G2's
      await page.locator('#screens .side .btn.primary', { hasText: 'Set out' }).click();
      const looks = [];
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(50);
        looks.push(await page.evaluate(() => { const c = document.getElementById('coach'); const vis = !c.classList.contains('hidden') && getComputedStyle(c).visibility !== 'hidden'; return { coach: vis ? c.dataset.id : null, map: !!document.querySelector('#screens .expmap .xdisc') }; }));
        if (looks[looks.length - 1].coach && looks[looks.length - 1].map) break;
      }
      const early = looks.filter((x) => x.coach && !x.map);
      check('S-2', `after the hub's Set out no coach line shows before the map (${looks.filter((x) => !x.map).length} looks while walking out); then "${T.beats.find((b) => b.id === 'G2').line}" with the map`,
        !early.length && looks.some((x) => !x.map) && looks.some((x) => x.coach === 'G2' && x.map), JSON.stringify({ early: early.slice(0, 3), last: looks[looks.length - 1] }));
      await shot(page, 'S2-map-g2');
    } catch (e) { await shot(page, 'S2-error'); check('S-2', 'part S2 (Set out at 1x) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-2', 'part S2: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S3: zone 2 and 3 on the map (Dev menu): elites, Moves, bags, the Bell, rim names
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page);
      // the Moves list: one column, every button inside it, its foot inside the map; cut rows fade (more below)
      const mv = await page.evaluate(() => {
        const l = document.querySelector('#screens .expmoves'); const w = document.querySelector('#screens .mapwin'); const r = l.getBoundingClientRect(); const wr = w.getBoundingClientRect();
        const bs = [...l.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
        return { n: l.querySelectorAll('.em').length, wrap: getComputedStyle(l).flexWrap, inX: bs.every((b) => b.left >= r.left - 0.5 && b.right <= r.right + 0.5), bottom: r.bottom <= wr.bottom + 0.5, over: l.scrollHeight > l.clientHeight + 1, more: l.classList.contains('more-below'), sw: l.scrollWidth, cw: l.clientWidth };
      });
      check('S-5', `the map's Moves list (${mv.n} moves): one column, no button cut at the right, its foot inside the map; with more below than it shows, it fades there`, mv.n >= 3 && mv.wrap === 'nowrap' && mv.inX && mv.sw <= mv.cw + 1 && mv.bottom && (!mv.over || mv.more), JSON.stringify(mv));
      await shot(page, 'S3-moves');
      // every elite of zones 2 and 3 has its tooltip (the map revealed)
      const eliteTips = [];
      for (const z of [2, 3]) {
        if (z === 3) { await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 3, level: 22, mapMode: 'expedition', prep: true })); await idle(page); await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page); }
        await page.evaluate(() => window.__ui.dev('reveal')); await idle(page);
        const els = await page.evaluate(() => { const v = window.__ui.view(); return v.zone.exp.nodes.filter((n) => n.type === 'elite').map((n) => ({ id: n.id, level: n.level, cl: n.cl, pl: v.player.level, label: document.querySelector(`#screens .expmap .mnode[data-node="${n.id}"] .cl`).textContent })); });
        for (const x of els) { await page.locator(`#screens .expmap .mnode[data-node="${x.id}"]`).hover({ force: true }); await page.waitForTimeout(120); eliteTips.push({ z, ...x, tip: await tipOn(page) }); await page.mouse.move(2, 2); }
      }
      check('S-3', `every elite node of zones 2 and 3 shows its tooltip (Elite, its Deathblow): ${eliteTips.length} nodes`, eliteTips.length >= 2 && eliteTips.every((x) => x.tip && /^Elite/.test(x.tip) && /Deathblow/.test(x.tip)), JSON.stringify(eliteTips.filter((x) => !x.tip || !/Deathblow/.test(x.tip))));
      // D144 (engine-2026-11-13d UI need 5; casual: "one level higher" for a level 17 elite at level 10): the elite's own level
      // (mapView `level`, above the node's cl) on the node, in the tooltip, and its gap to the player's level in words
      const gapText = (x) => { const g = x.level - x.pl; return g > 0 ? `${g} level${g === 1 ? '' : 's'} above you` : g < 0 ? `${-g} level${g === -1 ? '' : 's'} below you` : 'your level'; };
      const badElite = eliteTips.filter((x) => !(x.level > x.cl && x.label === String(x.level) && x.tip && x.tip.includes(`Level ${x.level}`) && x.tip.includes(`One powerful enemy at level ${x.level}, ${gapText(x)}.`)));
      check('D144-5', `every elite node says its own level (${eliteTips.map((x) => `${x.level} vs node ${x.cl}`).join(', ')}) on the map and in its tooltip, with the gap to the player's level in words`, eliteTips.length >= 2 && !badElite.length, JSON.stringify(badElite.map((x) => ({ id: x.id, level: x.level, cl: x.cl, pl: x.pl, label: x.label, tip: x.tip && x.tip.slice(0, 160) }))));
      // bags: a bag of gear (set up: two pieces worn now and a second head piece), the item's tooltip goes with the bags
      await load(page, (s0) => {
        const p0 = s0.player; const head = JSON.parse(JSON.stringify(p0.equipped.head)); head.uid = 'iS9001';
        const legs = p0.equipped.legs; p0.equipped.legs = null; const chest = p0.equipped.chest; p0.equipped.chest = null;
        p0.bag.push(legs, head, chest);
      });
      await page.keyboard.press('KeyB'); await idle(page);
      const slotUids = () => page.evaluate(() => [...document.querySelectorAll('#win-bags .baggrid .slot')].map((e) => e.dataset.uid || null));
      const first = page.locator('#win-bags .baggrid .slot[data-uid]').first();
      const name0 = await first.evaluate((e) => e.dataset.uid);
      const itemName = await page.evaluate((u) => window.__ui.view().player.bag.find((x) => x && x.uid === u).name, name0);
      await first.hover(); await page.waitForTimeout(150);
      const t1 = await tipOn(page);
      await page.keyboard.press('KeyB'); await idle(page);
      const t2 = await tipOn(page);
      const node = page.locator('#screens .expmap .mnode.here');
      await node.hover({ force: true }); await page.waitForTimeout(150);
      const t3 = await tipOn(page);
      await page.mouse.move(2, 2);
      check('S-4', `a bag item's tooltip ("${itemName}") goes when B closes the bags, and a map node's tooltip is its own after`, !!t1 && t1.includes(itemName) && !t2 && !!t3 && !t3.includes(itemName), JSON.stringify({ t1: t1 && t1.slice(0, 40), t2, t3: t3 && t3.slice(0, 40) }));
      // the bag menu opens beside the grid (it covered the item and its neighbours)
      await page.keyboard.press('KeyB'); await idle(page);
      const lay0 = await slotUids();
      const legsUid = await page.evaluate(() => { const p = window.__ui.view().player; return p.bag.find((x) => x && x.slot === 'legs').uid; });
      await page.locator(`#win-bags .baggrid .slot[data-uid="${legsUid}"]`).click();
      const menuR = await box(page, '.ctxmenu');
      const slotsR = await boxes(page, '#win-bags .baggrid .slot');
      const covered = slotsR.filter((r) => meet(menuR, r));
      check('S-6', `the bag item menu opens beside the grid: it covers none of the ${slotsR.length} slots`, !!menuR && !covered.length, `menu ${fmt(menuR)} covers ${covered.length}`);
      // equip the legs (no legs worn): every other item keeps its slot
      await page.locator('.ctxmenu').getByRole('button', { name: 'Equip', exact: true }).click(); await idle(page);
      const lay1 = await slotUids();
      const moved = lay0.map((u, i) => (u && u !== legsUid && lay1[i] !== u ? `${u}@${i}` : null)).filter(Boolean);
      check('S-9', 'equipping a bag item leaves its slot empty; every other item keeps its slot', !moved.length && !lay1.includes(legsUid) && lay1[lay0.indexOf(legsUid)] === null, JSON.stringify({ lay0, lay1 }));
      // equip the second head piece over the worn one: the worn one takes its slot
      const wornHead = await page.evaluate(() => window.__ui.view().player.equip.head.uid);
      const at = lay1.indexOf('iS9001');
      await page.locator('#win-bags .baggrid .slot[data-uid="iS9001"]').click();
      await page.locator('.ctxmenu').getByRole('button', { name: 'Equip', exact: true }).click(); await idle(page);
      const lay2 = await slotUids();
      const moved2 = lay1.map((u, i) => (u && u !== 'iS9001' && lay2[i] !== u ? `${u}@${i}` : null)).filter(Boolean);
      check('S-9', 'equipping over a worn piece puts the worn piece in the same slot; the rest stay', at >= 0 && lay2[at] === wornHead && !moved2.length, JSON.stringify({ at, wornHead, lay1, lay2 }));
      await page.keyboard.press('KeyB'); await idle(page);
      // the Bell asks first: nothing sent until "Ring the Bell"
      const n0 = await engineLen(page);
      await page.locator('#screens .expmap [data-leave="RING_BELL"]').click(); await idle(page);
      const ask = (await page.locator('#screens .expmap .leavewarn').innerText().catch(() => '')).replace(/\s+/g, ' ');
      const n1 = await engineLen(page);
      await page.locator('#screens .expmap .leavewarn').getByRole('button', { name: 'Stay' }).click(); await idle(page);
      const gone = !(await page.locator('#screens .expmap .leavewarn').count()); const n2 = await engineLen(page);
      await page.locator('#screens .expmap [data-leave="RING_BELL"]').click(); await idle(page);
      await page.locator('#screens .expmap .leavewarn').getByRole('button', { name: 'Ring the Bell', exact: true }).click(); await idle(page);
      const last = (await lastActs(page, 1))[0];
      check('S-8', 'Ring the Bell asks first ("Ring the Homeward Bell?", its charge named); Stay sends nothing; "Ring the Bell" sends RING_BELL',
        /Ring the Homeward Bell\?/.test(ask) && /only charge|charges left/.test(ask) && n1 === n0 && gone && n2 === n0 && last && last.type === 'RING_BELL', JSON.stringify({ ask, n: [n0, n1, n2], last }));
      // rim names: zone 2 with only the two ring-2 nodes next to the border of two regions seen: the names would meet
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page);
      let pair = null;
      await load(page, (s0) => {
        const z = s0.zone; const ns = z.nodes.filter((n) => n.ring === 2); const regs = R.mapView(s0).regions;
        // the two neighbouring ring-2 nodes of different regions whose names are longest together (they would meet)
        const sorted = [...ns].sort((a, b) => a.angle - b.angle); let best = -1;
        for (let i = 0; i < sorted.length; i++) {
          const a = sorted[i]; const b = sorted[(i + 1) % sorted.length]; if (a.region === b.region) continue;
          const len = (regs[a.region].name || '').length + (regs[b.region].name || '').length;
          if (len > best) { best = len; pair = [a.id, b.id]; }
        }
        for (const n of z.nodes) if (n.ring >= 2) z.seen[n.id] = pair.includes(n.id);
      });
      await page.waitForTimeout(500);
      const rim = await page.evaluate(() => {
        const svg = document.querySelector('#screens .expmap svg.xsvg'); const R0 = 437;
        const labs = [...svg.querySelectorAll('text.xrname')].map((t) => ({ name: t.textContent, mid: Number(t.dataset.mid), at: Number(t.dataset.at || t.dataset.mid), half: (t.getComputedTextLength() / 2 / R0) * (180 / Math.PI) }));
        const sep = (a, b, k) => Math.abs(((((a[k] - b[k]) % 360) + 540) % 360) - 180) - a.half - b.half;
        return { labs, raw: labs.length === 2 ? sep(labs[0], labs[1], 'mid') : null, now: labs.length === 2 ? sep(labs[0], labs[1], 'at') : null };
      });
      await shot(page, 'S3-rim');
      check('S-5', `rim names that would meet are moved apart along the rim (${rim.labs.map((x) => x.name).join(' / ')}: ${rim.raw == null ? '?' : rim.raw.toFixed(1)} deg apart before, ${rim.now == null ? '?' : rim.now.toFixed(1)} after)`,
        rim.labs.length === 2 && rim.raw < 0 && rim.now >= 0, JSON.stringify(rim));
    } catch (e) { await shot(page, 'S3-error'); check('S-3', 'part S3 (zones 2 and 3) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-3', 'part S3: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S4: the zone 2 hub (Dev menu): in view; Take keeps the cards in place; the Inn asks at full health
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.mouse.move(2, 2);
      const cards = page.locator('#screens .side .svc-card');
      const pl = []; for (let i = 0; i < await cards.count(); i++) pl.push(await placement(cards.nth(i)));
      const foot = await box(page, '#screens .side'); const gold = await box(page, '.goldline'); const micro = await box(page, '#micromenu');
      const fits = await page.evaluate(() => { const b = document.querySelector('#screens .side > .body'); return { sh: b.scrollHeight, ch: b.clientHeight }; });
      await shot(page, 'S4-hub');
      check('S-5', `the zone 2 hub with its contract offer: all ${pl.length} service cards in view, no scrolling needed, the panel clear of the gold line and the micro menu`,
        pl.length === 3 && pl.every(fullyShown) && fits.sh <= fits.ch + 1 && !meet(foot, gold) && !meet(foot, micro), `${pl.map(placeText).join(' | ')} | body ${fits.sh}/${fits.ch} | panel ${fmt(foot)} gold ${fmt(gold)}`);
      const trainer0 = await page.locator('#screens .side .svc-card', { hasText: 'Trainer' }).boundingBox();
      await page.locator('.hubc [data-hub="reserve"]').click(); await idle(page);
      const trainer1 = await page.locator('#screens .side .svc-card', { hasText: 'Trainer' }).boundingBox();
      const stub = await page.locator('#screens .side .hubtaken').count();
      const offerGone = !(await page.locator('#screens .side .hubc').count());
      check('S-8', 'Take on the hub\'s contract: the offer leaves a note of its height, the Trainer card stays under the pointer', stub === 1 && offerGone && Math.abs(trainer1.y - trainer0.y) <= 1, JSON.stringify({ before: trainer0 && Math.round(trainer0.y), after: trainer1 && Math.round(trainer1.y), stub, offerGone }));
      // the Inn at full health asks first, in its own place
      const inn = () => page.locator('#screens .side .svc-card', { has: page.locator('.nm', { hasText: /^(Inn|Rest anyway\?)$/ }) });
      const innY0 = (await inn().boundingBox()).y;
      const n0 = await engineLen(page);
      await inn().click(); await idle(page);
      const ask = await page.evaluate(() => { const a = document.querySelector('#screens .side .svc-card.ask'); return a ? a.innerText.replace(/\s+/g, ' ') : null; });
      const innY1 = (await page.locator('#screens .side .svc-card.ask').boundingBox()).y;
      const n1 = await engineLen(page);
      await page.locator('#screens .side .svc-card.ask [data-inn="cancel"]').click(); await idle(page);
      const back = !(await page.locator('#screens .side .svc-card.ask').count()); const n2 = await engineLen(page);
      await inn().click(); await idle(page);
      await page.locator('#screens .side .svc-card.ask [data-inn="rest"]').click(); await idle(page);
      const last = (await lastActs(page, 1))[0];
      check('S-8', 'the Inn at full health and mana asks first in its own place ("Rest anyway?"); Cancel sends nothing; Rest rests',
        !!ask && /Rest anyway\?/.test(ask) && Math.abs(innY1 - innY0) <= 1 && n1 === n0 && back && n2 === n0 && last && last.type === 'SERVICE' && last.service === 'inn', JSON.stringify({ ask, y: [innY0, innY1], n: [n0, n1, n2], last }));
      // hurt: one click rests (zone 3's hub)
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 3, level: 22, mapMode: 'expedition', prep: true })); await idle(page);
      await load(page, (s0) => { s0.player.hp = Math.round(s0.player.d.maxHp * 0.5); });
      await inn().click(); await idle(page);
      const last2 = (await lastActs(page, 1))[0];
      check('S-8', 'the Inn when hurt rests at once (no ask)', last2 && last2.type === 'SERVICE' && last2.service === 'inn' && !(await page.locator('#screens .side .svc-card.ask').count()), JSON.stringify(last2));
    } catch (e) { await shot(page, 'S4-error'); check('S-4', 'part S4 (the hub) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-4', 'part S4: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S5: fights at 1x (Dev menu)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&fresh=1&guide=0', null, { hints: true });
    try {
      await page.locator('#create .ccard[data-cls="rogue"]').click(); await idle(page);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      const clearCoach = async () => { for (let i = 0; i < 4; i++) { if (!(await coach(page)).shown) return; await page.locator('#coach .co-ok').click(); await idle(page); } };
      await clearCoach();
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await page.mouse.move(2, 2);
      // the Deathblow hint (H04) on the coach line (hints come with a step: after Sap, W); then Pass (X): its "Deathblow
      // answered" headline clear of the line
      await page.keyboard.press('KeyW'); await idle(page);
      const h04 = (await coach(page)).shown;
      await page.keyboard.press('KeyX');
      let head = null; let co = null;
      for (let i = 0; i < 60 && !head; i++) {
        await page.waitForTimeout(60);
        const f = (await page.evaluate(() => window.__ui.floats())).floats.filter((x) => /^Deathblow answered/.test(x.text));
        if (f.length) { head = f[0]; co = await box(page, '#coach'); }
      }
      await idle(page);
      check('S-6', `the enemy's "Deathblow answered" headline keeps clear of the coach line (${h04 ? h04.id : 'no line'})`, !!h04 && !!head && !!co && !meet({ l: head.x0, t: head.y0, r: head.x1, b: head.y1 }, co), JSON.stringify({ head: head && [head.x0, head.y0, head.x1, head.y1].map(Math.round), coach: fmt(co) }));
      await clearCoach();
      // a refused key: energy too low, also while a round plays: the reason at once, in words, nothing queued
      await load(page, (s0) => { s0.fight.p.energy = 45; s0.fight.p.cds = {}; });
      const bar = await page.evaluate(() => window.__ui.view().player.bar);
      const gj = bar.indexOf('gutting_jab') + 1;
      await watchToasts(page);
      await page.keyboard.press(`Digit${gj}`); await page.waitForTimeout(150);
      const s1 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const want = `Not enough energy for ${R.C.SPELL.gutting_jab.name}: it costs ${R.spellCost(s1, 'gutting_jab')}, you have ${Math.floor(s1.fight.p.energy)}`;
      const playing0 = !!(await page.evaluate(() => window.__ui.playingEvent()));
      await page.keyboard.press(`Digit${gj}`); await page.waitForTimeout(200);
      const mid = await page.evaluate(() => ({ playing: !!window.__ui.playingEvent(), queued: window.__ui.queued(), toasts: window.__sT.slice() }));
      await idle(page);
      check('S-7', `a spell key with too little energy, pressed while the round plays: "${want}" at once, nothing queued`, playing0 && mid.playing && !mid.queued && mid.toasts.some((t) => t.startsWith(want)), JSON.stringify(mid));
      // the flee ask: F, the box stays (past the old 2.2 s), Esc puts it away; F then the button runs
      const ask = () => page.evaluate(() => { const a = document.getElementById('fleeask'); const b = [...document.querySelectorAll('#actionbar .ctrl .btn')].find((x) => /Flee|Confirm/.test(x.textContent)); return { shown: !!a && !a.classList.contains('hidden'), text: a ? a.innerText.replace(/\s+/g, ' ') : '', btn: b ? b.textContent : null }; });
      const nF = await engineLen(page);
      await page.keyboard.press('KeyF'); await idle(page);
      const a1 = await ask(); await page.waitForTimeout(2600); const a2 = await ask();
      const fa = await box(page, '#fleeask'); const tp = await box(page, '#turnprompt');
      await shot(page, 'S5-flee-ask');
      await page.keyboard.press('Escape'); await idle(page);
      const a3 = await ask(); const nE = await engineLen(page);
      check('S-7', 'F asks "Flee this fight?" over the control row and the button reads Confirm?; the ask stays until answered (2.6 s on); Esc puts it away, nothing sent',
        a1.shown && /Flee this fight\?/.test(a1.text) && /^Confirm\?/.test(a1.btn) && a2.shown && !meet(fa, tp) && !a3.shown && /^Flee/.test(a3.btn) && nE === nF, JSON.stringify({ a1, a2: a2.shown, a3, n: [nF, nE] }));
      const fleeLines = () => page.evaluate(() => [...document.querySelectorAll('#combatlog .lines > div')].map((e) => e.textContent).filter((x) => x === 'You flee from the fight.' || x === 'You fail to escape!'));
      const fl0 = await fleeLines();
      await page.keyboard.press('KeyF'); await idle(page);
      await page.locator('#actionbar .ctrl .btn', { hasText: 'Confirm?' }).click(); await idle(page);
      const fl = (await page.evaluate(() => window.__ui.engineLog())).slice(nE).map((x) => x.type);
      check('S-7', 'F then the Confirm? button flees (FLEE sent)', fl.includes('FLEE'), JSON.stringify(fl));
      // D144 (engine-2026-11-13d UI need 7): one flight, one line (the engine's action and `fled` were both logged)
      const fl1 = (await fleeLines()).slice(fl0.length);
      check('D144-7', `one flee, one line in the log ("${fl1.join('" / "')}")`, fl1.length === 1, JSON.stringify(fl1));
      // a refused flee says why (a fight that cannot be fled)
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await load(page, (s0) => { s0.fight.canFlee = false; });
      await watchToasts(page);
      const nR = await engineLen(page);
      await page.keyboard.press('KeyF'); await page.waitForTimeout(200);
      const why = await page.evaluate(() => ({ toasts: window.__sT.slice(), ask: !document.getElementById('fleeask').classList.contains('hidden') }));
      check('S-7', 'F where fleeing is not allowed: the reason as a toast at once, no ask, nothing sent', why.toasts.some((t) => /flee/i.test(t)) && !why.ask && (await engineLen(page)) === nR, JSON.stringify(why));
      // a mana spell with no mana: the reason in words at once
      await page.evaluate(() => window.__ui.dev('build', { classId: 'mage', zone: 2, level: 12, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await page.keyboard.press('KeyX'); await idle(page);
      // D144 (engine-2026-11-13d UI need 11): an answer that lands only on a hit roll (Rime Burst) shows its chance over the
      // enemy (windupView answers' `chance`), not "?"; Rime Burst's tooltip gives its chance on every enemy (spellInfo hitAll)
      const rb = await page.evaluate(() => { const v = window.__ui.view(); const a = (v.combat.windups || []).flatMap((w) => w.answers).find((x) => x.id === 'rime_burst' && typeof x.chance === 'number'); return { chance: a ? a.chance : null, els: [...document.querySelectorAll('#nameplates .ans-o[data-id="rime_burst"]')].map((e) => ({ text: e.textContent, ch: e.dataset.chance })) }; });
      const rbPc = rb.chance == null ? null : `${Math.round(rb.chance * 100)} %`;
      check('D144-11', `a wind-up's answer that lands on a hit roll shows its chance over the enemy: "Rime Burst ${rbPc}" (windupView answers' chance), not "?"`, !!rbPc && rb.els.length > 0 && rb.els.every((x) => x.ch === rbPc && x.text.includes(`Rime Burst ${rbPc}`) && !/\?/.test(x.text)), JSON.stringify(rb));
      const sM = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const hitAll = R.spellInfo(sM, 'rime_burst', null).hitAll || [];
      const rbSlot = (await page.evaluate(() => window.__ui.view().player.bar)).indexOf('rime_burst');
      let rbTip = null;
      if (rbSlot >= 0) { await page.locator(`#actionbar button.ab[data-slot="${rbSlot}"]`).hover(); await page.waitForTimeout(150); rbTip = await tipOn(page); await page.mouse.move(2, 2); }
      const wantAll = `Hit chance: ${hitAll.map((x) => `${sM.fight.enemies[x.u].name} ${Math.round(x.chance * 100)} %`).join(', ')}`;
      check('D144-11', `an AoE spell's tooltip gives its hit chance on each enemy: "${wantAll}" (R.spellInfo hitAll)`, hitAll.length > 0 && !!rbTip && rbTip.includes(wantAll), JSON.stringify({ slot: rbSlot, tip: rbTip }));
      await load(page, (s0) => { s0.player.mana = 0; });
      const mbar = await page.evaluate(() => window.__ui.view().player.bar);
      const sp = mbar.find((id) => id && R.C.SPELL[id] && R.C.SPELL[id].cost > 0 && R.C.SPELL[id].target === 'enemy');
      await watchToasts(page);
      await page.keyboard.press(`Digit${mbar.indexOf(sp) + 1}`); await page.waitForTimeout(150);
      const s2 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const wantM = `Not enough mana for ${R.C.SPELL[sp].name}: it costs ${R.spellCost(s2, sp)}, you have 0`;
      const mt = await page.evaluate(() => window.__sT.slice());
      check('S-7', `a spell key with no mana: "${wantM}" at once`, mt.some((t) => t.startsWith(wantM)), JSON.stringify(mt));
      // a level-up in the middle of a fight: the banner keeps clear of the fight's panels
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z1_furrow_boar', 'z1_furrow_boar'], level: 10 })); await idle(page);
      await page.keyboard.press('KeyX'); await idle(page);
      await load(page, (s0) => { s0.player.xp = R.xpToNext(s0.player.level) - 5; s0.player.mana = s0.player.d.maxMana; s0.fight.enemies[0].hp = 1; });
      const lv0 = await page.evaluate(() => window.__ui.view().player.level);
      const eb = await page.evaluate(() => window.__ui.view().player.bar.indexOf('ember_bolt') + 1);
      await page.mouse.move(2, 2);
      await page.keyboard.press(`Digit${eb}`);
      let lb = null;
      for (let i = 0; i < 60 && !lb; i++) { await page.waitForTimeout(50); lb = await page.evaluate(() => { const b = document.getElementById('banner'); return b.classList.contains('on') && b.classList.contains('level') ? (() => { const r = b.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; })() : null; }); }
      const panels = lb ? await boxes(page, '#target-frame, #ruler, #nameplates .np, #turnprompt, #actionbar, #player-frame, #tracker') : [];
      await shot(page, 'S5-levelup');
      await idle(page);
      const lv1 = await page.evaluate(() => window.__ui.view().player.level);
      const hitP = panels.filter((p) => meet(lb, p)).map((p) => p.id);
      check('S-6', `a level-up mid-fight (${lv0} -> ${lv1}): the banner covers none of the fight's panels (${panels.length} in view)`, lv1 > lv0 && !!lb && !hitP.length, `banner ${fmt(lb)} covers ${hitP.join(', ') || 'none'}`);
      // the death screen: the fight's panels give way to "You have died"
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'] })); await idle(page);
      await load(page, (s0) => { s0.player.hp = 1; s0.player.res.boon = 0; s0.player.res.meta = 0; s0.player.bag = s0.player.bag.filter((x) => !(x.kind === 'cons' && x.id === 'ember_of_return')); });
      let dead = null;
      for (let k = 0; k < 12 && !dead; k++) {
        await page.keyboard.press('KeyX');
        for (let i = 0; i < 50 && !dead; i++) {
          await page.waitForTimeout(60);
          dead = await page.evaluate(() => { const d = document.querySelector('.deathmsg'); if (d.parentElement.classList.contains('hidden')) return null; return { dying: document.body.classList.contains('dying') }; });
        }
        if (!dead) await idle(page);
      }
      if (dead) { await page.waitForTimeout(450); dead.msg = await box(page, '.deathmsg'); dead.panels = await boxes(page, '#target-frame, #nameplates .np, #ruler, #turnprompt'); }
      await shot(page, 'S5-death');
      await idle(page);
      check('S-6', '"You have died": the fight\'s panels (target frame, nameplates, ruler, turn prompt) give way while it shows', !!dead && dead.dying && !!dead.msg && !dead.panels.some((p) => meet(dead.msg, p)), JSON.stringify(dead));
    } catch (e) { await shot(page, 'S5-error'); check('S-5', 'part S5 (fights at 1x) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-5', 'part S5: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S6: the engine hand-off's UI needs (engine-2026-11-13d section 4) on a zone 2 map (Dev menu, seed 8748: an
  // unguarded chest and a Grind next to the hub, the Grind next to the chest)
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, {});
    try {
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 10, mapMode: 'expedition', prep: true, seed: 8748 })); await idle(page);
      await page.evaluate(() => window.__ui.act({ type: 'LEAVE_HUB' })); await idle(page);
      const mv0 = await page.evaluate(() => window.__ui.view().zone.exp);
      const reach = new Set(mv0.moves.map((m) => m.nodeId));
      const chest = mv0.nodes.find((n) => n.type === 'treasure' && n.know === 'full' && n.guarded === false && reach.has(n.id) && n.nb.some((j) => mv0.nodes[j].type === 'grind'));
      if (!chest) throw new Error('seed 8748: no unguarded chest with a Grind next to it in reach');
      const grind = mv0.nodes[chest.nb.find((j) => mv0.nodes[j].type === 'grind')];
      const hoverTip = async (id) => { await page.locator(`#screens .expmap .mnode[data-node="${id}"]`).hover({ force: true }); await page.waitForTimeout(120); const t = await tipOn(page); await page.mouse.move(2, 2); return t; };
      // need 8: a Grind on the expedition map is one wave (mapView `waves`): no "Wave 1" or "1 to 3 waves"
      const k = grind.archetypes.length; const foes = `${k} ${k === 1 ? 'enemy' : 'enemies'}`;
      const gTip = await hoverTip(grind.id);
      check('D144-8', `a Grind's tooltip on the expedition map (mapView waves ${grind.waves}): "Foes: ${foes}" and "One wave of ${foes}", no "Wave 1" or "1 to N waves"`,
        grind.waves === 1 && !!gTip && gTip.includes(`Foes: ${foes}`) && gTip.includes(`One wave of ${foes}.`) && !/Wave 1|1 to \d+ waves/.test(gTip), JSON.stringify(gTip));
      // need 9: the ring's level band only while a node's own level is unknown
      const far = mv0.nodes.find((n) => !n.hub && n.know === 'none');
      const band = far ? mv0.bands[far.ring] : null;
      const fTip = far ? await hoverTip(far.id) : null;
      check('D144-9', `a node whose level is known gives its level, not the ring's band; an unknown node gives the band (levels ${band ? band.join('–') : '?'})`,
        !!gTip && gTip.includes(`Level ${grind.cl}`) && !/levels \d/.test(gTip) && !!fTip && fTip.includes(`levels ${band[0]}–${band[1]}`), JSON.stringify({ grind: gTip && gTip.split('\n').slice(0, 2), far: fTip && fTip.split('\n').slice(0, 2) }));
      // need 6: the unguarded chest: nothing of it in the log before "Open the chest"; its gold and loot after, once
      const logLines = () => page.evaluate(() => [...document.querySelectorAll('#combatlog .lines > div')].map((e) => e.textContent));
      const fmtN = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // util.js fmtNum (part S's fmt is for boxes)
      const inChest = (x) => /^You receive [\d\s\u202f\u00a0,.]+ copper/.test(x) || /^You receive loot:/.test(x) || /Needle trap/.test(x);
      const n0 = (await logLines()).length;
      await page.evaluate((id) => window.__ui.act({ type: 'MOVE', nodeId: id }), chest.id); await idle(page);
      const held = await page.evaluate(() => { const v = window.__ui.view(); return { phase: v.phase, step: v.node && v.node.step }; });
      const before = (await logLines()).slice(n0);
      await page.getByRole('button', { name: 'Open the chest' }).click(); await idle(page);
      const all = (await logLines()).slice(n0);
      const after = all.slice(before.length);
      const spoils = await page.evaluate(() => { const l = window.__ui.view().loot; return l ? { title: l.title, gold: l.gold, items: l.items.length } : null; });
      check('D144-6', `an unguarded chest: no gold, loot or trap in the log while it waits for "Open the chest" (${before.length} lines); after it, its gold once and one line per item (${spoils ? spoils.items : '?'})`,
        held.phase === 'NODE' && held.step === 'chest' && !before.some(inChest) && !!spoils && spoils.title === 'Treasure chest'
        && after.filter((x) => x === `You receive ${fmtN(spoils.gold)} copper.`).length === 1 && after.filter((x) => /^You receive loot:/.test(x)).length === spoils.items && after.filter((x) => /Needle trap/.test(x)).length <= 1,
        JSON.stringify({ held, before, after, spoils }));
      await auto(page);
      // need 8: the Grind's fight: the tracker says the wave being fought ("Wave 1 of 1", not "Wave 0 of 1"); its spoils, the wave done
      await page.evaluate((id) => window.__ui.act({ type: 'MOVE', nodeId: id }), grind.id); await idle(page);
      const trk = () => page.evaluate(() => document.querySelector('#tracker').innerText.replace(/\s+/g, ' '));
      const tr1 = await trk();
      // need 11: a spell's tooltip gives its hit chance on the target (R.spellInfo hit)
      const bar = await page.evaluate(() => window.__ui.view().player.bar);
      const gj = bar.indexOf('gutting_jab');
      const s1 = R.deserialize(await page.evaluate(() => window.__ui.state()), CONTENT);
      const t0 = await page.evaluate(() => window.__ui.target());
      const ti = t0 != null && s1.fight.enemies[t0] && s1.fight.enemies[t0].alive ? t0 : s1.fight.enemies.find((e) => e.alive).idx;
      const hit = R.spellInfo(s1, 'gutting_jab', ti).hit;
      await page.locator(`#actionbar button.ab[data-slot="${gj}"]`).hover(); await page.waitForTimeout(150);
      const jTip = await tipOn(page); await page.mouse.move(2, 2);
      const wantHit = `Hit chance on ${s1.fight.enemies[ti].name}: ${Math.round(hit * 100)} %`;
      check('D144-11', `a spell's tooltip gives its hit chance on the target: "${wantHit}" (R.spellInfo hit)`, typeof hit === 'number' && !!jTip && jTip.includes(wantHit), JSON.stringify(jTip));
      let tr2 = null;
      for (let i = 0; i < 60 && !tr2; i++) {
        await auto(page);
        const v = await page.evaluate(() => { const x = window.__ui.view(); return { over: x.combat ? x.combat.over : null, loot: !!x.loot, phase: x.phase }; });
        if (v.over === 'victory' && v.loot) tr2 = await trk();
        if (v.phase === 'MAP') break;
      }
      check('D144-8', `the tracker in a Grind: "Wave 1 of 1" while the wave is fought, "1 of 1 wave done" with its spoils (never "Wave 0")`,
        /Grind Wave 1 of 1/.test(tr1) && !!tr2 && /1 of 1 wave done/.test(tr2) && !/Wave 0/.test(tr1 + tr2), JSON.stringify({ tr1, tr2 }));
    } catch (e) { await shot(page, 'S6-error'); check('S-6', 'part S6 (the engine hand-off\'s UI needs) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-6', 'part S6: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---- S7: H05's shield line (D144, engine-2026-11-13d UI need 2): hints on, every hint but H05 seen
  {
    const { context, page, errors } = await open(browser, W, H, 'seed=8736&speed=instant&fresh=1&guide=0', null, { hints: true });
    try {
      const seen = {};
      for (const x of T.hints) if (x.id !== 'H05') { seen[x.id] = true; for (const c of ['rogue', 'mage', 'hunter']) seen[`${x.id}:${c}`] = true; }
      await page.evaluate(([key, json]) => localStorage.setItem(key, json), [HINTS_KEY, JSON.stringify({ off: false, seen, nudge: { summary: 0, hall: false }, shows: {} })]);
      await page.reload(); await page.waitForFunction(() => window.__ui);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 10, mapMode: 'expedition', prep: true })); await idle(page);
      const H05 = T.hints.find((x) => x.id === 'H05');
      // the casual's case: an elite 8 levels up with a Bolster's shield (BOLSTER_PCT of its health) while it is off-balance
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z2_bargh'], level: 18 })); await idle(page);
      await load(page, (s0) => { const e = s0.fight.enemies[0]; e.st.push({ id: 'OFF_BALANCE', dur: 3, value: R.C.OFFBAL_TAKEN }); e.shield = Math.round(R.C.BOLSTER_PCT * e.maxHp); s0.player.hp = s0.player.d.maxHp; });
      await page.keyboard.press('KeyX'); await idle(page);
      const ob = await page.evaluate(() => window.__ui.view().combat.enemies[0].offBalance);
      const c1 = await coach(page);
      await shot(page, 'S7-h05-shield');
      if (c1.shown) { await page.locator('#coach .co-ok').click(); await idle(page); }
      const st1 = (await coach(page)).store;
      check('D144-2', `an off-balance enemy whose shield takes the whole hit (offBalance shield ${ob && ob.shield}, absorbs ${ob && ob.absorbs}): H05's shield line "${H05.alt.shield}"; H05 stays unseen`,
        !!ob && ob.absorbs && !!c1.shown && c1.shown.id === 'H05' && c1.shown.text === fillLine(H05.alt.shield, {}).text && !st1.seen.H05 && !st1.shows.H05, JSON.stringify({ ob, shown: c1.shown, seen: st1.seen.H05, shows: st1.shows.H05 }));
      // a later window with no shield: the plain line ("Spend your big hit now"), and then H05 is seen. A new page: a Dev
      // menu fight is no new fight for the coach (no fightStart event), and H05's try in this one is spent
      await page.reload(); await page.waitForFunction(() => window.__ui);
      await page.getByRole('button', { name: 'Enter the world' }).click(); await idle(page);
      await page.evaluate(() => window.__ui.dev('build', { classId: 'rogue', zone: 2, level: 10, mapMode: 'expedition', prep: true })); await idle(page);
      await page.evaluate(() => window.__ui.dev('fight', { ids: ['z1_furrow_boar'], level: 10 })); await idle(page);
      await load(page, (s0) => { const e = s0.fight.enemies[0]; e.st.push({ id: 'OFF_BALANCE', dur: 3, value: R.C.OFFBAL_TAKEN }); e.shield = 0; });
      await page.keyboard.press('KeyX'); await idle(page);
      const c2 = await coach(page);
      if (c2.shown) { await page.locator('#coach .co-ok').click(); await idle(page); }
      const st2 = (await coach(page)).store;
      check('D144-2', 'a later off-balance window without a shield: H05\'s own line ("Spend your big hit now"); seen once put away', !!c2.shown && c2.shown.id === 'H05' && /^Off-balance: it takes \+\d+% damage\. Spend your big hit now\.$/.test(c2.shown.text) && !!st2.seen.H05, JSON.stringify({ shown: c2.shown, seen: st2.seen.H05 }));
    } catch (e) { await shot(page, 'S7-error'); check('S-7', 'part S7 (H05\'s shield line) ran to the end', false, e.message.split('\n').slice(0, 3).join(' / ')); }
    check('S-7', 'part S7: no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

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
  if (PARTS.includes('P')) await partP(browser, W, H);
  if (PARTS.includes('Q')) await partQ(browser, W, H);
  if (PARTS.includes('R')) await partR(browser, W, H);
  if (PARTS.includes('S')) await partS(browser, W, H);
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed${bad.length ? `; failed: ${bad.map((r) => `${r.size} ${r.bug} ${r.name}`).join('; ')}` : ''}`);
process.exit(bad.length ? 1 : 0);
