#!/usr/bin/env node
/**
 * qa/browser/demo/fuzz.mjs - random-action check that a demo build never reaches zone 3, the Camp or Oruvath (spec 5.1 A2, in the page).
 *
 *   node qa/browser/demo/fuzz.mjs [--file demo.html] [--runs 3] [--classes rogue,mage,hunter] [--max-actions 1500] [--seed-base 100] [--expect demo|full]
 *
 * Per class, --runs runs in one page. Each step is, with probability 0.5, the engine's autoplay action (so the run goes on), else
 * a random action drawn from every action type the screens can send (MOVE / PASS_THROUGH / TAKE_ROAD / RING_BELL / FIGHT_BOSS / TRAVEL_ON
 * / CHOOSE_NODE / LEAVE_HUB / CAMP_GRIND / NEXT_FIGHT, with node ids and lanes taken from the zone view, and the item and service
 * actions); the page refuses illegal ones, which is the point. After every step the view is checked for zone index above 2, a Camp
 * (zone.camp), or Oruvath among the enemies; so is the finished run's summary (reachedCamp, reachedBoss).
 * --expect demo (default for a file named demo*.html): pass = never reached. --expect full (the normal build): the expectation is
 * inverted - pass = the harness DID see zone 3 or beyond at least once (it proves the detector works; the full game must reach it).
 * The engine-level A2 (DEMO_FUZZ_RUNS = 200 per class, applyDemo()) is a Node test; this is the same property through the page.
 */
import { FILE_URL, EXPECT, arg, report, buildLine, chromium, idle, startRun, endRun, setSpeed, watch, clean, CLASSES } from './lib.mjs';

const RUNS = Number(arg('--runs', '3')), MAXA = Number(arg('--max-actions', '1500')), BASE = Number(arg('--seed-base', '100'));
const CLS = arg('--classes', CLASSES.join(',')).split(',');
console.log(buildLine());
const browser = await chromium.launch({ headless: true });
const out = { classes: [] }; let seen = 0, refused = 0, sent = 0; const hits = [];
for (const cls of CLS) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const page = await ctx.newPage(); const res = watch(page);
  await page.goto(FILE_URL); await page.waitForFunction(() => window.__ui); await idle(page); await setSpeed(page, 'Instant');
  const c = { cls, runs: [] };
  for (let r = 0; r < RUNS; r++) {
    await startRun(page, cls, { seed: BASE + r });
    // the whole loop runs in the page: one evaluate, no round trips
    const o = await page.evaluate(async ({ maxA, seed }) => {
      let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      const found = []; let refused = 0, sent = 0, steps = 0; const types = {};
      const look = () => {
        const v = window.__ui.view(); const z = v.zone;
        const f = [];
        if (z && (z.camp || z.idx > 2)) f.push(`zone ${z.camp ? 'camp' : z.idx}`);
        let fs = null; try { fs = JSON.parse(window.__ui.state()).fight; } catch { /* no state */ }
        if ((v.combat && v.combat.enemies.some((e) => /oruvath/i.test(e.name || ''))) || (fs && /oruvath/i.test(JSON.stringify(fs.enemies || [])))) f.push('Oruvath in the fight');
        if (v.summary && (v.summary.reachedCamp || v.summary.reachedBoss)) f.push(`summary reachedCamp=${!!v.summary.reachedCamp} reachedBoss=${!!v.summary.reachedBoss}`);
        return f;
      };
      const nodeIds = (v) => { const z = v.zone; const ids = []; try { for (const row of z.rows || []) for (const n of row || []) if (n && n.id != null) ids.push(n.id); if (z.nodes) for (const n of z.nodes) ids.push(n.id); } catch { /* shape differs */ } return ids; };
      for (; steps < maxA; steps++) {
        const v = window.__ui.view();
        if (v.summary) break;
        let a;
        if (rnd() < 0.5) a = window.__ui.autoChoice();
        else {
          const kind = pick(['MOVE', 'PASS_THROUGH', 'TAKE_ROAD', 'RING_BELL', 'FIGHT_BOSS', 'TRAVEL_ON', 'CHOOSE_NODE', 'LEAVE_HUB', 'CAMP_GRIND', 'NEXT_FIGHT', 'FLEE', 'PASS', 'ATTACK']);
          const ids = nodeIds(v); const base = { type: kind };
          if (kind === 'MOVE' || kind === 'PASS_THROUGH') base.nodeId = ids.length ? pick(ids) : 0;
          if (kind === 'CHOOSE_NODE') base.lane = Math.floor(rnd() * 3);
          a = { type: 'ENGINE', action: base };
        }
        const t = a && a.action ? a.action.type : a && a.type; types[t] = (types[t] || 0) + 1;
        const r = await window.__ui.act(a); sent++; if (!r || !r.ok) refused++;
        await window.__ui.idle();
        const f = look(); if (f.length) { found.push({ step: steps, what: f }); if (found.length > 3) break; }
      }
      const f = look(); if (f.length) found.push({ step: steps, what: f });
      return { steps, found, refused, sent, ended: !!window.__ui.view().summary, types };
    }, { maxA: MAXA, seed: BASE * 7 + r });
    seen += o.found.length ? 1 : 0; refused += o.refused; sent += o.sent;
    if (o.found.length) hits.push({ cls, run: r + 1, ...o.found[0] });
    c.runs.push(o);
    console.log(`${cls} run ${r + 1} (seed ${BASE + r}): ${o.steps} steps, ${o.sent - o.refused} accepted, ${o.refused} refused, ended ${o.ended}, ${o.found.length ? 'REACHED ' + JSON.stringify(o.found[0]) : 'stayed inside zones 1-2'}`);
    if (o.ended) await endRun(page); else break; // a run that did not end is a stuck run: report and stop this class
  }
  c.console = { errors: res.errors.length, warnings: res.warnings.length, pageErrors: res.pageErrors.length };
  out.classes.push(c); await ctx.close();
}
await browser.close();
const reached = hits.length > 0;
const pass = EXPECT === 'demo' ? !reached : reached;
console.log(`\nfuzz (${EXPECT} build): ${sent} actions sent, ${refused} refused, ${hits.length} run(s) reached zone 3 / the Camp / Oruvath. ` + (EXPECT === 'demo' ? `Expectation: never. ${pass ? 'PASS' : 'FAIL'}` : `Expectation inverted for the full build: the detector must see it. ${pass ? 'PASS (detector works)' : 'FAIL (the harness never saw zone 3: the detector is blind)'}`));
out.hits = hits; out.expect = EXPECT; out.pass = pass;
report('fuzz', out);
process.exit(pass ? 0 : 1);
