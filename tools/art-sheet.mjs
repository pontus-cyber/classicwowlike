#!/usr/bin/env node
/**
 * tools/art-sheet.mjs - a contact sheet of the game's code-drawn art in one PNG: every hero and pet, every enemy
 * archetype in every zone's tint, ranks, beast kinds, the end boss's three phases and its shard, portraits, set pieces,
 * effects (telegraphs, status marks, charge-ups, projectiles, impacts, particles, floats, ambient motes), every icon
 * glyph and background, and every zone backdrop. Track R step R5 (docs/reviews/ui-architecture-2026-11-12.md, section 3;
 * D119): the review surface for the art work. Drawn straight from the art modules (src/ui/art-*.js, util.js, theme.js)
 * with tokens.css; nothing is built and no game runs.
 *
 *   node tools/art-sheet.mjs [--out /tmp/art-sheet.png] [--theme lantern] [--width 1600] [--src path/to/src]
 *
 * Fixed: Math.random is a seeded generator (the one qa/browser/canvas-shot.mjs uses), every animated drawing gets the
 * same clock (T0 below), backdrops get the seeds scene.js gives them and are built at 1366x768, then shown at a third.
 * The same sources on the same machine give the same PNG; its SHA-256 is printed. A console or page error fails the run
 * (exit 1). --theme puts data-theme on <html>, as ?theme= does in the game. --src draws another checkout's src/ (one
 * with art-props.js and art-fx.js, R5 or later). The committed reference is docs/art/sheet-current.png (current theme).
 * The page imports the modules over a local route (Playwright serves src/ to it), so Chromium needs no file access.
 * Playwright comes from /home/claude/tools-ui, a local install or /opt/npm-tools/node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
if (args.includes('--help') || args.includes('-h')) { console.log('usage: node tools/art-sheet.mjs [--out /tmp/art-sheet.png] [--theme lantern] [--width 1600] [--src src]'); process.exit(0); }
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = path.resolve(arg('--src', path.join(ROOT, 'src')));
const OUT = path.resolve(arg('--out', '/tmp/art-sheet.png'));
const THEME = arg('--theme', null);
const WIDTH = Number(arg('--width', 1600));
const ORIGIN = 'http://art-sheet.local';
if (THEME && !/^[\w-]+$/.test(THEME)) { console.error(`bad --theme ${THEME}`); process.exit(2); }

function loadPlaywright() {
  for (const base of ['/home/claude/tools-ui/package.json', import.meta.url, '/opt/npm-tools/node_modules/package.json', '/opt/npm-tools/package.json']) {
    try { return createRequire(base)('playwright'); } catch { /* next */ }
  }
  throw new Error('playwright not found (looked in /home/claude/tools-ui, next to this file and in /opt/npm-tools)');
}

/**
 * Runs in the page (stringified): draws the sheet and returns { png (data URL), w, h, cells }. Each section is a grid of
 * cells; a cell is { label, draw(c, w, h) } drawn translated to its corner and clipped to it.
 */
async function drawSheet(cfg) {
  const A = await import('/src/ui/art-actors.js');
  const Wd = await import('/src/ui/art-world.js');
  const I = await import('/src/ui/art-icons.js');
  const P = await import('/src/ui/art-props.js');
  const F = await import('/src/ui/art-fx.js');
  const T = await import('/src/ui/theme.js');
  const U = await import('/src/ui/util.js');
  const T0 = 1.3; // the scene clock (s) every animated drawing gets
  const PAD = 8; const TITLE = 22; const LABEL = 16;
  const SHEET_BG = '#1d1b19'; const CELL_BG = '#2c2925'; const INK = '#e6dccb'; const DIM = '#9a9080'; const GROUND = 'rgba(255,255,255,0.10)';
  const LABEL_FONT = '11px sans-serif'; const TITLE_FONT = 'bold 13px sans-serif';
  const ZONES = ['farmland', 'wetlands', 'highlands', 'ruins', 'haunted', 'scorched', 'observatory'];
  const ARCH = ['brute', 'skulker', 'caster', 'guardian', 'mender', 'other'];
  // telegraph colours as app.js gives them to the scene (HEAVY_COL, WINDUP_COL, TELE_COL.arcane); not tokens yet
  const TELE = { heavy: '#ff9a1f', windup: '#ff5a2a', cast: '#c79bff' };
  const sections = [];
  const section = (title, cw, ch, cells) => sections.push({ title, cw, ch, cells });
  const cell = (label, draw) => ({ label, draw });
  const ground = (c, w, gy) => { c.fillStyle = GROUND; c.fillRect(0, gy, w, 1); };
  // an actor's body box, as scene.js anchor() computes it (CSS px)
  const box = (kind, x, gy, s, look) => {
    let top = gy - 112 * s; let cy = gy - 60 * s; let w = 50 * s;
    if (kind === 'beast') { top = gy - 64 * s * (look.size || 1); cy = gy - 30 * s; w = 60 * s * (look.size || 1); }
    if (kind === 'humanoid' && look && look.build) top = gy - 112 * s * Math.sqrt(look.build);
    return { x, cy, top, feet: gy, w };
  };
  const figure = (c, kind, look, x, gy, s, flip) => {
    F.drawShadow(c, kind, x, gy, s, look, 1);
    if (kind === 'humanoid') A.drawHumanoid(c, x, gy, s, look, { t: T0, flip });
    else A.drawBeast(c, x, gy, s, look, { t: T0, flip });
  };
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('icon image failed')); im.src = src; });

  // ---------------------------------------------------------------- actors
  section('Heroes and pets (drawHumanoid, drawBeast; facing right)', 140, 190, [
    ...Object.entries(A.HERO_LOOKS).map(([id, look]) => cell(id, (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); figure(c, 'humanoid', look, w / 2, gy, 1.3, false); })),
    ...Object.entries(A.PET_LOOKS).map(([id, look]) => cell(`${id} (${look.kind})`, (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); figure(c, look.kind === 'hawk' ? 'hawk' : 'beast', look, w / 2, gy, 1.25, false); })),
    cell('shard (drawShard)', (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); F.drawShadow(c, 'shard', w / 2, gy, 1.1, null, 1); A.drawShard(c, w / 2, gy, 1.1, { t: T0 }); }),
  ]);
  section('Enemy archetypes by zone (enemyLook, normal rank; facing left as in a fight)', 112, 172,
    ZONES.flatMap((z) => ARCH.map((arch) => cell(`${arch} ${z}`, (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); figure(c, 'humanoid', A.enemyLook(arch, z, 'normal', ''), w / 2, gy, 1.05, true); }))));
  section('Ranks (enemyLook brute, farmland; drawRankAura)', 150, 230, ['normal', 'elite', 'rare', 'dboss'].map((rank) => cell(rank, (c, w, h) => {
    const gy = h - LABEL - 8; ground(c, w, gy); F.drawRankAura(c, rank, w / 2, gy, 0.9, T0); figure(c, 'humanoid', A.enemyLook('brute', 'farmland', rank, ''), w / 2, gy, 0.9, true);
  })));
  const BEASTS = [['wolf', ''], ['boar', 'boar'], ['cat', 'lynx'], ['rat', 'rat'], ['lizard', 'toad'], ['bear', 'bear']];
  section('Beasts (beastLook): every kind in farmland, the wolf in every zone', 150, 150, [
    ...BEASTS.map(([k, name]) => cell(`${k} farmland`, (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); figure(c, 'beast', A.beastLook('farmland', name, 'normal'), w / 2, gy, 1.1, true); })),
    ...ZONES.slice(1).map((z) => cell(`wolf ${z}`, (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); figure(c, 'beast', A.beastLook(z, '', 'normal'), w / 2, gy, 1.1, true); })),
  ]);
  section('The end boss by phase (drawBoss)', 230, 250, [1, 2, 3].map((ph) => cell(`phase ${ph}`, (c, w, h) => { const gy = h - LABEL - 4; A.drawBoss(c, w / 2, gy, 0.55, { t: T0, bossPhase: ph }); })));
  const portraits = [...Object.entries(A.HERO_LOOKS).map(([id, look]) => [id, look, 'humanoid']), ...Object.entries(A.PET_LOOKS).map(([id, look]) => [id, look, 'beast']),
    ['brute', A.enemyLook('brute', 'farmland', 'normal', ''), 'humanoid'], ['caster', A.enemyLook('caster', 'haunted', 'normal', ''), 'humanoid'], ['boss', null, 'boss'], ['shard', null, 'shard']];
  section('Portraits (drawPortrait, 72 px)', 88, 104, portraits.map(([id, look, kind]) => cell(id, (c, w) => {
    const pc = document.createElement('canvas'); pc.width = 72; pc.height = 72; A.drawPortrait(pc.getContext('2d'), 72, look, kind); c.drawImage(pc, (w - 72) / 2, 8);
  })));

  // ---------------------------------------------------------------- set pieces
  const pal = Wd.THEMES.farmland; const pu = 0.6;
  section('Set pieces (art-props.js drawProp; trees from art-world.js), farmland paint, u 0.6', 190, 172, [
    ...P.PROP_KINDS.map((kind) => cell(kind, (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); P.drawProp(c, kind, w / 2, gy, pu, T0, pal, {}); })),
    cell('chest open', (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); P.drawProp(c, 'chest', w / 2, gy, pu, T0, pal, { open: true }); }),
    cell("quest marks ! ?", (c, w, h) => { const gy = (h - LABEL) / 2 + 190 * pu + 12; P.drawQuestMark(c, '!', w / 2 - 30, gy, pu, T0); P.drawQuestMark(c, '?', w / 2 + 30, gy, pu, T0); }),
    cell('oak', (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); Wd.oak(c, w / 2, gy, pu * 1.3, { near: U.shade(pal.near, 0.1), leaf: U.shade(pal.near, 0.12), light: pal.light }, U.prng(7)); }),
    cell('pine', (c, w, h) => { const gy = h - LABEL - 8; ground(c, w, gy); Wd.pine(c, w / 2, gy, pu * 1.6, pal.near, U.prng(8)); }),
  ]);

  // ---------------------------------------------------------------- effects
  const foe = A.enemyLook('brute', 'farmland', 'normal', ''); const FS = 0.9;
  const onFoe = (label, fx) => cell(label, (c, w, h) => {
    const gy = h - LABEL - 12; ground(c, w, gy); const x = w / 2;
    const an = box('humanoid', x, gy, FS, foe);
    fx(c, an, gy, 'before'); figure(c, 'humanoid', foe, x, gy, FS, true); fx(c, an, gy, 'after');
  });
  const before = (f) => (c, an, gy, when) => { if (when === 'before') f(c, an, gy); };
  const after = (f) => (c, an, gy, when) => { if (when === 'after') f(c, an, gy); };
  section('Effects on an actor (art-fx.js)', 140, 190, [
    onFoe('telegraph heavy', before((c, an, gy) => F.drawTelegraph(c, an, gy, 'humanoid', FS, { kind: 'heavy', color: TELE.heavy }, 1, T0))),
    onFoe('telegraph cast', before((c, an, gy) => F.drawTelegraph(c, an, gy, 'humanoid', FS, { kind: 'cast', color: TELE.cast }, 1, T0))),
    onFoe('telegraph wind-up', before((c, an, gy) => F.drawTelegraph(c, an, gy, 'humanoid', FS, { kind: 'windup', color: TELE.windup }, 1, T0))),
    onFoe('off-balance', after((c, an, gy) => F.drawOffBalance(c, an, gy, 'humanoid', FS, 1, T0))),
    onFoe('target ring', before((c, an, gy) => F.drawTargetRing(c, 'humanoid', an.x, gy, FS, 1, true))),
    onFoe('hover ring', before((c, an, gy) => F.drawTargetRing(c, 'humanoid', an.x, gy, FS, 1, false))),
    onFoe('sapped (sleep)', after((c, an) => F.drawSleep(c, an, 1, T0))),
    onFoe('ward', after((c, an) => F.drawWard(c, an, 1))),
    onFoe('stun', after((c, an) => F.drawStun(c, an, 1, T0))),
    onFoe('frozen', after((c, an) => F.drawFrozen(c, an))),
    onFoe('hexed', after((c, an) => F.drawHex(c, an, 1, T0))),
    onFoe('charge light (arcane)', after((c, an) => F.drawCharge(c, an, -1, 0.7, 0.3, T.CAST.arcane, 1, T0))),
    onFoe('charge heavy (fire)', after((c, an) => F.drawCharge(c, an, -1, 0.7, 0.8, T.CAST.fire, 1, T0))),
  ]);
  const BOLTS = [['fire', 0.4], ['frost', 0.4], ['arcane', 0.4], ['shadow', 0.4], ['nature', 0.4], ['phys', 0.4], ['comet', 0.8], ['arrow', 0.2], ['arrow', 0.8]];
  const flight = (kind, w, h) => { const from = { x: 14, y: h * 0.62 }; const to = { x: w - 14, y: h * 0.42 }; const arc = kind === 'arrow' ? 26 * 0.6 : kind === 'comet' ? 150 * 0.3 : 0;
    const ease1 = (q) => (kind === 'arrow' ? q : U.ease.in(q));
    return (q) => { const e = ease1(U.clamp(q, 0, 1)); return [U.lerp(from.x, to.x, e), U.lerp(from.y, to.y, e) - Math.sin(e * Math.PI) * arc]; }; };
  const fxCell = (label, f) => cell(label, (c, w, h) => { const hh = h - LABEL; f(c, w, hh); });
  const sparkFloat = (text, o = {}) => ({ text, size: o.size || 22, small: !!o.small, crit: !!o.crit, color: o.color || T.token('--ink-bright'), outline: 'rgba(0,0,0,0.85)' });
  const motes = (kind) => (c, w, h) => { const r = U.prng(42); c.save(); for (let i = 0; i < 14; i++) F.drawMote(c, { x: r() * w, y: r() * h, s: 0.5 + r(), p: r() * 10, kind }, true, 1.6, T0); c.restore(); };
  section('Effects in the air (art-fx.js): projectiles at 60 % of the flight, impacts, particles, floats, motes', 140, 110, [
    ...BOLTS.map(([kind, wt]) => fxCell(`bolt ${kind}${kind === 'arrow' ? ` w ${wt}` : ''}`, (c, w, h) => { F.drawBolt(c, kind, wt, 0.6, flight(kind, w, h), 1, T0); })),
    fxCell('impact core (phys)', (c, w, h) => F.drawCore(c, { x: w / 2, y: h / 2, r: 40, color: T.IMPACT.phys }, 0.2)),
    fxCell('crit starburst (fire)', (c, w, h) => F.drawRays(c, { x: w / 2, y: h / 2, r: 46, rot: 0.3, color: T.IMPACT.fire }, 0.3, 1)),
    fxCell('ring (frost)', (c, w, h) => F.drawRing(c, { x: w / 2, y: h / 2, r0: 6, r1: 50, width: 3, color: T.IMPACT.frost }, 0.4)),
    fxCell('ground ring (heal)', (c, w, h) => F.drawRing(c, { x: w / 2, y: h * 0.7, r0: 10, r1: 70, width: 3, color: T.IMPACT.heal, flat: true }, 0.4)),
    fxCell('slash (crit)', (c, w, h) => F.drawSlash(c, { x: w / 2, y: h / 2, dir: 1, size: 1.2, crit: true }, 0.3, 1)),
    fxCell('level-up pillar', (c, w, h) => F.drawPillar(c, { x: w / 2, feet: h - 6 }, 0.3, 0.6)),
    fxCell('particles: dot, streak, plus', (c, w, h) => { c.save(); [{ x: w * 0.25, y: h / 2, vx: 0, vy: 0, size: 4, color: '#ffd27a', glow: true }, { x: w * 0.55, y: h / 2, vx: 300, vy: -200, size: 2.4, color: '#ffffff', glow: true, streak: true }, { x: w * 0.8, y: h / 2, vx: 0, vy: 0, size: 3, color: '#9dffb8', glow: true, plus: true }].forEach((q) => F.drawParticle(c, q, 0.9)); c.restore(); }),
    fxCell('float: number', (c, w, h) => F.drawFloat(c, sparkFloat('128'), w / 2, h / 2, 1, 1, 1)),
    fxCell('float: crit', (c, w, h) => F.drawFloat(c, sparkFloat('342!', { crit: true, size: 28, color: T.token('--accent-hi') }), w / 2, h / 2, 1.1, 1, 1)),
    fxCell('float: word', (c, w, h) => F.drawFloat(c, sparkFloat('Interrupted!', { small: true, size: 20 }), w / 2, h / 2, 1, 1, 1)),
    ...['pollen', 'motes', 'wind', 'dust', 'wisps', 'embers', 'stars'].map((k) => fxCell(`motes: ${k}`, motes(k))),
  ]);

  // ---------------------------------------------------------------- icons
  const special = [['deathblow', I.deathblowIcon()], ['wind-up', I.windupIcon()], ['slot head', I.slotIcon('head')]];
  const glyphIcons = I.GLYPHS.map((g) => [g, I.icon(g, 'steel')]);
  const bgIcons = Object.keys(T.ICON_BG).map((bg) => [`bg ${bg}`, I.icon('spark', bg)]);
  const all = [...glyphIcons, ...bgIcons, ...special];
  const imgs = await Promise.all(all.map(([, src]) => loadImg(src)));
  section(`Icons (art-icons.js): every glyph on steel (${glyphIcons.length}), every background with a spark (${bgIcons.length}), special`, 74, 70,
    all.map(([label], i) => cell(label, (c, w) => c.drawImage(imgs[i], (w - 48) / 2, 4, 48, 48))));

  // ---------------------------------------------------------------- backdrops
  const BW = 1366; const BH = 768; const BS = 3;
  const backs = [...Object.keys(Wd.THEMES).map((th) => [th, false]), ['farmland', true]];
  section('Backdrops (buildBackdrop at 1366x768 with the seeds scene.js uses, drawn at a third; grade and vignette)', Math.round(BW / BS), Math.round(BH / BS) + LABEL,
    backs.map(([th, hub]) => cell(`${th}${hub ? ' (hub)' : ''}`, (c) => {
      const oc = document.createElement('canvas'); oc.width = BW; oc.height = BH; const o = oc.getContext('2d');
      const bd = Wd.buildBackdrop(th, BW, BH, { hub, seed: hub ? 991 : 1234 + th.length * 7 });
      Wd.drawBackdrop(o, bd, 0, T0, 1, true); Wd.drawForeground(o, bd, 0, 1);
      F.drawGrade(o, BW, BH, (Wd.THEMES[th] || Wd.THEMES.farmland).grade, 0, 0, null);
      c.drawImage(oc, 0, 0, BW / BS, BH / BS);
    })));

  // ---------------------------------------------------------------- layout and paint
  const W = cfg.width; let y = PAD; const placed = [];
  for (const s of sections) {
    const perRow = Math.max(1, Math.floor((W - PAD) / (s.cw + PAD)));
    s.y = y; y += TITLE;
    s.cells.forEach((cl, i) => { placed.push({ s, cl, x: PAD + (i % perRow) * (s.cw + PAD), y: y + Math.floor(i / perRow) * (s.ch + PAD) }); });
    y += Math.ceil(s.cells.length / perRow) * (s.ch + PAD) + PAD;
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = y; const c = cv.getContext('2d');
  c.fillStyle = SHEET_BG; c.fillRect(0, 0, W, y);
  c.textBaseline = 'middle';
  for (const s of sections) { c.font = TITLE_FONT; c.fillStyle = INK; c.textAlign = 'left'; c.fillText(s.title, PAD, s.y + TITLE / 2); }
  for (const p of placed) {
    const { cw, ch } = p.s;
    c.save(); c.translate(p.x, p.y); c.beginPath(); c.rect(0, 0, cw, ch); c.clip();
    c.fillStyle = CELL_BG; c.fillRect(0, 0, cw, ch);
    c.save(); p.cl.draw(c, cw, ch); c.restore();
    c.font = LABEL_FONT; c.fillStyle = DIM; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    c.fillText(p.cl.label, cw / 2, ch - LABEL / 2, cw - 4);
    c.restore();
  }
  return { png: cv.toDataURL('image/png'), w: W, h: y, cells: placed.length, sections: sections.length };
}

const PAGE = `<!DOCTYPE html><html${THEME ? ` data-theme="${THEME}"` : ''}><head><meta charset="utf-8"><link rel="stylesheet" href="/src/ui/tokens.css"></head>
<body><script type="module">
(${drawSheet.toString()})(${JSON.stringify({ width: WIDTH })}).then((r) => { window.__sheet = r; }, (e) => { window.__sheet = { error: String(e && e.stack || e) }; });
</script></body></html>`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const errors = [];
let result;
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    let s = 0x2f6b9d1; // mulberry32, as qa/browser/canvas-shot.mjs
    Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/sheet.html') return route.fulfill({ body: PAGE, contentType: 'text/html' });
    if (url.pathname.startsWith('/src/')) {
      const f = path.join(SRC, decodeURIComponent(url.pathname.slice('/src/'.length)));
      if (f.startsWith(SRC + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        return route.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.css') ? 'text/css' : 'text/javascript' });
      }
    }
    errors.push(`not served: ${url.pathname}`);
    return route.fulfill({ status: 404, body: '' });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`${ORIGIN}/sheet.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sheet !== undefined, null, { timeout: 120000 });
  result = await page.evaluate(() => window.__sheet);
  await context.close();
} finally {
  await browser.close();
}
if (result.error) errors.push(`sheet: ${result.error}`);
if (result.png) {
  const buf = Buffer.from(result.png.split(',')[1], 'base64');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log(`wrote ${OUT}: ${result.w}x${result.h}, ${result.sections} sections, ${result.cells} cells, theme ${THEME || 'current'}, sha256 ${crypto.createHash('sha256').update(buf).digest('hex')}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
