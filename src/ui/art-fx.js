// Effects drawn on the scene canvas: telegraph rings, the off-balance ring, sleep letters, status marks, ground shadows,
// target rings, rank auras, charge-ups, projectiles and their trails, impact cores, crit starbursts, rings, slashes,
// the level-up pillar, particles, floating text, ambient motes, and the colour grade over the frame. Track R step R5
// (docs/reviews/ui-architecture-2026-11-12.md, section 3; D119): moved out of scene.js with the same drawing calls.
//
// An art module (rule U6): it imports only util.js and theme.js, reads no game state, keeps no state and queries no DOM.
// scene.js keeps layout and animation state: the actors, the effect records and their lifetimes, particle motion, the
// floats' slam and rise. Every function here draws one thing from what it is given:
//   c          canvas 2D context in CSS px (scene.js has set the device-pixel transform)
//   an         an actor's body box from scene.js anchor(): { x, cy (body centre), top (head), feet, w (half width) }
//   gy         the ground line under an actor, CSS px
//   kind       the actor's rig: 'humanoid', 'beast', 'hawk', 'boss' or 'shard'; scale: its draw scale; look: its look
//   u          CSS px per art unit (canvas height / 768); t: the scene clock in s; k: an effect's progress 0..1
//   records    an effect record as scene.js keeps it (named per function: geometry and paint only)
//   colours    tokens read through theme.js (BOLT), or the colour the record carries
// A function that throws sparks returns them (a particle record { x, y, vx, vy, life, t0, size, color, g, glow }, an
// array, or null) for scene.js to add; it calls Math.random in the same order as before the move (canvas-shot.mjs and
// tools/art-sheet.mjs seed it).
// Fonts: weights are the --fw-* type tokens. FCT_FONT (floating text) differs from --font-num by "-apple-system", and
// "Georgia, serif" (sleep letters) matches no type token; both stay written here (R5, exact values only).
import { clamp, lerp, ease, rgba, glowBall } from './util.js';
import { BOLT, token } from './theme.js';

export const FCT_FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, "Liberation Sans", sans-serif';

/** The canvas font of a float f ({ small, size }): scene.js measures with it and drawFloat draws with it. */
export const floatFont = (f) => `${f.small ? token('--fw-bold') : token('--fw-heavy')} ${f.size}px ${FCT_FONT}`;

// ------------------------------------------------------------------ actor marks
/** The ground shadow under an actor (none under the boss). */
export function drawShadow(ctx, kind, x, gy, scale, look, u) {
  if (kind === 'boss') return;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  const w = (kind === 'beast' ? 46 : kind === 'shard' ? 22 : 30) * scale * (look && look.size || 1) * (look && look.build || 1);
  ctx.beginPath(); ctx.ellipse(x, gy + 2 * u, w, 7 * u, 0, 0, Math.PI * 2); ctx.fill();
}

/** The ring under the targeted (sel) or hovered enemy. */
export function drawTargetRing(ctx, kind, x, gy, scale, u, sel) {
  const w = (kind === 'boss' ? 150 : kind === 'beast' ? 56 : 40) * scale;
  ctx.save();
  ctx.strokeStyle = sel ? 'rgba(255,90,70,0.95)' : 'rgba(255,230,160,0.6)'; ctx.lineWidth = (sel ? 3 : 2) * u;
  ctx.shadowColor = sel ? '#ff3a2a' : '#ffd27a'; ctx.shadowBlur = 10 * u;
  ctx.beginPath(); ctx.ellipse(x, gy + 2 * u, w, 11 * u, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** The pulsing glow behind an elite, rare or dungeon-boss enemy (nothing for another rank). */
export function drawRankAura(ctx, rank, x, gy, scale, t) {
  if (!(rank === 'elite' || rank === 'rare' || rank === 'dboss')) return;
  const col = rank === 'rare' ? '#d8e4ff' : rank === 'dboss' ? '#ff7a4a' : '#ffd27a';
  const g = ctx.createRadialGradient(x, gy - 50 * scale, 10, x, gy - 50 * scale, 90 * scale);
  g.addColorStop(0, rgba(col, 0.18 + 0.06 * Math.sin(t * 3))); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, gy - 50 * scale, 90 * scale, 0, Math.PI * 2); ctx.fill();
}

/** WARD: a bubble around the body. */
export function drawWard(ctx, an, u) {
  ctx.save(); ctx.strokeStyle = 'rgba(160,200,255,0.75)'; ctx.lineWidth = 2 * u; ctx.fillStyle = 'rgba(140,180,255,0.10)'; ctx.beginPath(); ctx.ellipse(an.x, an.cy - 8 * u, an.w * 1.1, (an.feet - an.top) * 0.62, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
}
/** STUN: three stars circling the head. */
export function drawStun(ctx, an, u, t) {
  for (let i = 0; i < 3; i++) { const ang = t * 4 + i * 2.1; ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.arc(an.x + Math.cos(ang) * 16 * u, an.top - 4 * u + Math.sin(ang) * 4 * u, 3 * u, 0, Math.PI * 2); ctx.fill(); }
}
/** BURN: now and then an ember rising from the body (a particle record, or null). */
export function burnSpark(an, u, t) {
  return Math.random() < 0.4 ? { x: an.x + (Math.random() - 0.5) * an.w, y: an.cy, vx: 0, vy: -60 * u, life: 0.5, t0: t, size: 2.5 * u, color: '#ff9a4a', g: 0, glow: true } : null;
}
/** FROZEN: an ice-blue sheet over the body. */
export function drawFrozen(ctx, an) {
  ctx.fillStyle = 'rgba(170,220,255,0.28)'; ctx.fillRect(an.x - an.w * 0.7, an.top, an.w * 1.4, an.feet - an.top);
}
/** HEXED: a turning arc at the feet. */
export function drawHex(ctx, an, u, t) {
  ctx.save(); ctx.strokeStyle = 'rgba(200,150,255,0.8)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.ellipse(an.x, an.feet, an.w, 10 * u, 0, t * 2, t * 2 + 4.5); ctx.stroke(); ctx.restore();
}

/** Sapped (combat v2): drifting Z letters over the head. */
export function drawSleep(ctx, an, u, t) {
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#d8ccff'; ctx.strokeStyle = 'rgba(20,10,40,0.85)'; ctx.lineWidth = 3 * u;
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.55 + i / 3) % 1);
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.95;
    ctx.font = `${token('--fw-black')} ${(11 + 7 * k) * u}px Georgia, serif`;
    const x = an.x + (10 + 16 * k) * u; const y = an.top + 6 * u - 34 * k * u;
    ctx.strokeText('Z', x, y); ctx.fillText('Z', x, y);
  }
  ctx.restore();
}

/**
 * Off-balance (combat v2, rules 7.13): the enemy's guard is broken. A pulsing amber ring of broken segments at its feet,
 * a warm glow on its body and rising sparks (returned: a particle record or null), until the window closes.
 */
export function drawOffBalance(ctx, an, gy, kind, scale, u, t) {
  const w = (kind === 'boss' ? 150 : kind === 'beast' ? 62 : 46) * scale / (kind === 'boss' ? 1 : 1.25);
  const pulse = 0.5 + 0.5 * Math.sin(t * 7);
  ctx.save();
  const g = ctx.createRadialGradient(an.x, an.cy, 4 * u, an.x, an.cy, (an.feet - an.top) * 0.85);
  g.addColorStop(0, `rgba(255,190,70,${0.16 + 0.12 * pulse})`); g.addColorStop(1, 'rgba(255,170,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(an.x, an.cy, (an.feet - an.top) * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = token('--tele-window'); ctx.shadowBlur = 14 * u; ctx.lineCap = 'round';
  const segs = 8; const rot = t * 0.9;
  for (let i = 0; i < segs; i++) {
    const a0 = rot + (i / segs) * Math.PI * 2; const a1 = a0 + (Math.PI * 2 / segs) * 0.62;
    ctx.strokeStyle = `rgba(255,${200 + 30 * pulse},90,${0.7 + 0.3 * pulse})`; ctx.lineWidth = (3 + 1.5 * pulse) * u;
    ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * (1.25 + 0.1 * pulse), 15 * u, 0, a0, a1); ctx.stroke();
  }
  ctx.restore();
  return Math.random() < 0.45 ? { x: an.x + (Math.random() - 0.5) * w * 2, y: gy, vx: (Math.random() - 0.5) * 20 * u, vy: -(80 + Math.random() * 70) * u, life: 0.7, t0: t, size: 2.4 * u, color: '#ffc85a', g: 0, glow: true } : null;
}

/**
 * The telegraph under and around an enemy: a pulsing red ring for a heavy blow, a turning rune circle for a cast, a
 * hotter ember ring for a wind-up. tele: { kind: 'heavy' | 'cast' | 'windup', color }. Returns a spark or null.
 */
export function drawTelegraph(ctx, an, gy, kind, scale, tele, u, t) {
  const col = tele.color || '#ff4a2a';
  const w = (kind === 'boss' ? 150 : kind === 'beast' ? 60 : 44) * scale / (kind === 'boss' ? 1 : 1.4);
  const pulse = 0.5 + 0.5 * Math.sin(t * 6.5);
  let spark = null;
  ctx.save();
  const g = ctx.createRadialGradient(an.x, an.cy, 4 * u, an.x, an.cy, (an.feet - an.top) * 0.75);
  g.addColorStop(0, rgba(col, 0.16 + 0.12 * pulse)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(an.x, an.cy, (an.feet - an.top) * 0.75, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = col; ctx.shadowBlur = 12 * u;
  if (tele.kind === 'windup') {
    // combat v2.1: a wind-up (rules 7.12) burns hotter: a thick ember ring, a turning rune ring outside it, rising embers
    const fast = 0.5 + 0.5 * Math.sin(t * 9);
    ctx.strokeStyle = rgba(col, 0.65 + 0.35 * fast); ctx.lineWidth = (3.5 + 2 * fast) * u;
    ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * (1.1 + 0.14 * fast), 13 * u, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba('#ffd36a', 0.55 + 0.3 * pulse); ctx.lineWidth = 2 * u; ctx.setLineDash([9 * u, 6 * u]); ctx.lineDashOffset = -t * 60 * u;
    ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * 1.6, 19 * u, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (Math.random() < 0.6) spark = { x: an.x + (Math.random() - 0.5) * w * 2, y: gy, vx: (Math.random() - 0.5) * 16 * u, vy: -(90 + Math.random() * 90) * u, life: 0.7, t0: t, size: 2.4 * u, color: Math.random() < 0.4 ? '#ffd36a' : col, g: 0, glow: true };
  } else if (tele.kind === 'heavy') {
    ctx.strokeStyle = rgba(col, 0.55 + 0.4 * pulse); ctx.lineWidth = (2.5 + 1.5 * pulse) * u;
    ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * (1.05 + 0.12 * pulse), 12 * u, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = rgba(col, 0.35 * pulse);
    ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * 1.45, 17 * u, 0, 0, Math.PI * 2); ctx.stroke();
    if (Math.random() < 0.35) spark = { x: an.x + (Math.random() - 0.5) * w * 1.6, y: gy, vx: 0, vy: -(70 + Math.random() * 60) * u, life: 0.6, t0: t, size: 2 * u, color: col, g: 0, glow: true };
  } else {
    ctx.strokeStyle = rgba(col, 0.6 + 0.3 * pulse); ctx.lineWidth = 2 * u; ctx.setLineDash([7 * u, 5 * u]); ctx.lineDashOffset = -t * 40 * u;
    ctx.beginPath(); ctx.ellipse(an.x, gy + 2 * u, w * 1.15, 13 * u, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (Math.random() < 0.5) { const ang = Math.random() * Math.PI * 2; const r = (34 + Math.random() * 20) * u; spark = { x: an.x + Math.cos(ang) * r, y: an.cy - 10 * u + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 1.8, vy: -Math.sin(ang) * r * 1.8, life: 0.5, t0: t, size: 2 * u, color: col, g: 0, glow: true }; }
  }
  ctx.restore();
  return spark;
}

// ------------------------------------------------------------------ combat effects
/**
 * A charge-up at progress k: an orb at the caster's hands (toward: +1 facing right, -1 left) grows and pulls sparks in
 * (returned: a particle record or null); a heavy one (w > 0.55) draws a rune circle on the ground.
 */
export function drawCharge(ctx, an, toward, k, w, color, u, t) {
  const hx = an.x + toward * 26 * u; const hy = an.cy - 24 * u;
  const r = (2 + (5 + 9 * w) * ease.in(k)) * u;
  glowBall(ctx, hx, hy, r, color);
  let spark = null;
  if (Math.random() < 0.6 + w * 0.4) { const ang = Math.random() * Math.PI * 2; const d = (30 + 40 * w) * u; spark = { x: hx + Math.cos(ang) * d, y: hy + Math.sin(ang) * d, vx: -Math.cos(ang) * d * 2.6, vy: -Math.sin(ang) * d * 2.6, life: 0.36, t0: t, size: (1.5 + w) * u, color, g: 0, glow: true }; }
  if (w > 0.55) {
    ctx.save(); ctx.strokeStyle = rgba(color, 0.25 + 0.55 * ease.out(k)); ctx.lineWidth = 2 * u; ctx.shadowColor = color; ctx.shadowBlur = 10 * u;
    ctx.setLineDash([9 * u, 5 * u]); ctx.lineDashOffset = -t * 60 * u;
    ctx.beginPath(); ctx.ellipse(an.x, an.feet + 2 * u, (40 + 30 * ease.out(k)) * u, (10 + 6 * ease.out(k)) * u, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  return spark;
}

/**
 * A projectile in flight at progress k with its trail. at(q): the point [x, y] of the flight path at progress q (scene.js
 * owns the path); kind: 'arrow', 'comet' or a school; w 0..1: the shot's weight (a heavier shot is larger, its trail
 * brighter and longer). Colours: the BOLT family of theme.js. Returns the sparks it throws (an array, maybe empty).
 */
export function drawBolt(ctx, kind, w, k, at, u, t) {
  const sparks = [];
  const [x, y] = at(k);
  const col = kind === 'arrow' ? (w > 0.5 ? BOLT.arrow : BOLT.arrowLight) : BOLT[kind] || BOLT.phys; // theme.js BOLT
  // trail: a tapering streak along the flight path behind the shot (sampled from the path, so smooth at any frame rate)
  const len = (kind === 'arrow' ? 0.16 : 0.2) + 0.16 * w; const N = 10;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  let prevPt = at(k - len);
  for (let i = 1; i <= N; i++) {
    const f = i / N; const pt = at(k - len * (1 - f));
    ctx.strokeStyle = rgba(col, (kind === 'arrow' ? 0.45 : 0.6) * f * (0.6 + 0.6 * w));
    ctx.lineWidth = (kind === 'arrow' ? 1.4 + 2.6 * w : 3 + 7 * w + (kind === 'comet' ? 5 : 0)) * u * (0.25 + 0.75 * f);
    ctx.beginPath(); ctx.moveTo(prevPt[0], prevPt[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
    prevPt = pt;
  }
  ctx.restore();
  if (kind === 'arrow') {
    const ahead = at(k + 0.02); const ang = Math.atan2(ahead[1] - y, ahead[0] - x || 0.001);
    const sz = 1 + 0.35 * w;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sz, sz);
    if (w > 0.5) { ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 12 * u; }
    ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-26 * u, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = w > 0.5 ? '#ffe9a8' : '#d8dde3'; ctx.beginPath(); ctx.moveTo(0, -3 * u); ctx.lineTo(9 * u, 0); ctx.lineTo(0, 3 * u); ctx.fill();
    ctx.fillStyle = '#c84a3a'; ctx.fillRect(-28 * u, -3 * u, 6 * u, 6 * u); ctx.restore();
    if (w > 0.5 && Math.random() < 0.6) sparks.push({ x, y, vx: (Math.random() - 0.5) * 20 * u, vy: (Math.random() - 0.5) * 20 * u, life: 0.3, t0: t, size: 1.8 * u, color: '#ffd27a', g: 0, glow: true });
  } else {
    glowBall(ctx, x, y, ((kind === 'comet' ? 9 : 5) + 5 * w) * u, col);
    for (let i = 0; i < 2 + Math.round(w * 3); i++) sparks.push({ x, y, vx: (Math.random() - 0.5) * 30 * u, vy: (Math.random() - 0.5) * 30 * u, life: 0.35, t0: t, size: (2 + 1.5 * w) * u, color: col, g: 0, glow: true });
  }
  return sparks;
}

/** An impact core: a white-hot flash at the contact point. c: { x, y, r (largest radius), color }. */
export function drawCore(ctx, c, k) {
  const r = c.r * (0.45 + 0.75 * ease.out(Math.min(1, k * 2.2)));
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  g.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`); g.addColorStop(0.35, rgba(c.color, 0.75 * (1 - k))); g.addColorStop(1, rgba(c.color, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/** A crit starburst. b: { x, y, r (ray length), rot (turn), color }. */
export function drawRays(ctx, b, k, u) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(b.x, b.y); ctx.rotate(b.rot);
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    const len = b.r * (0.4 + 0.6 * ease.out(k)) * (i % 2 ? 0.6 : 1);
    ctx.fillStyle = rgba(i % 2 ? b.color : '#ffffff', 0.85 * (1 - k));
    ctx.beginPath(); ctx.moveTo(0, -2.5 * u); ctx.lineTo(len, 0); ctx.lineTo(0, 2.5 * u); ctx.fill();
  }
  ctx.restore();
}

/** A widening ring. r: { x, y, r0, r1 (radius from, to), width, color, flat (an ellipse on the ground) }. */
export function drawRing(ctx, r, k) {
  ctx.save(); ctx.strokeStyle = rgba(r.color, 1 - k); ctx.lineWidth = r.width * (1 - k * 0.5);
  ctx.beginPath(); if (r.flat) ctx.ellipse(r.x, r.y, lerp(r.r0, r.r1, ease.out(k)), lerp(r.r0, r.r1, ease.out(k)) * 0.22, 0, 0, Math.PI * 2); else ctx.arc(r.x, r.y, lerp(r.r0, r.r1, ease.out(k)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

/** A weapon slash. b: { x, y, dir (-1 mirrored), size, crit }. */
export function drawSlash(ctx, b, k, u) {
  const sz = b.size || 1;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-0.6); if (b.dir < 0) ctx.scale(-1, 1);
  ctx.strokeStyle = rgba('#ffffff', 1 - k); ctx.lineWidth = (b.crit ? 6 : 4) * u * sz * (1 - k); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 34 * u * sz, -1.1 + k * 0.6, 0.6 + k * 0.6); ctx.stroke(); ctx.restore();
}

/** The level-up pillar of light. p: { x, feet }. */
export function drawPillar(ctx, p, k, u) {
  const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
  const w = 70 * u * (0.6 + 0.4 * Math.sin(k * Math.PI));
  const g = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
  g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.5, `rgba(255,236,170,${0.55 * a})`); g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g; ctx.fillRect(p.x - w, 0, w * 2, p.feet);
  for (let i = 0; i < 3; i++) { const rk = (k * 2 + i / 3) % 1; ctx.strokeStyle = `rgba(255,224,140,${(1 - rk) * a})`; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.ellipse(p.x, p.feet - rk * 160 * u, 60 * u * (1 - rk * 0.4), 14 * u * (1 - rk * 0.4), 0, 0, Math.PI * 2); ctx.stroke(); }
}

/** One particle at opacity a. q: { x, y, vx, vy, size, color, glow (added light), plus (a plus sign), streak (a line along its motion) }. */
export function drawParticle(ctx, q, a) {
  if (q.glow) { ctx.globalCompositeOperation = 'lighter'; }
  ctx.fillStyle = rgba(q.color, a);
  if (q.plus) { ctx.fillRect(q.x - q.size * 1.5, q.y - q.size * 0.4, q.size * 3, q.size * 0.8); ctx.fillRect(q.x - q.size * 0.4, q.y - q.size * 1.5, q.size * 0.8, q.size * 3); }
  else if (q.streak) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = q.size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * A floating text f ({ text, size, small, crit, color, outline }) centred at (x, y), scaled by sc, at opacity a: an
 * outlined number or word in FCT_FONT; a crit glows in its own colour. scene.js computes the slam, rise and fade.
 */
export function drawFloat(ctx, f, x, y, sc, a, u) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.font = floatFont(f); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, f.size * (f.crit ? 0.2 : 0.16)); ctx.strokeStyle = f.outline; ctx.lineJoin = 'round';
  if (f.crit) { ctx.shadowColor = f.color; ctx.shadowBlur = 16 * u; }
  ctx.strokeText(f.text, 0, 0); ctx.shadowBlur = 0; ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
  ctx.restore();
}

// ------------------------------------------------------------------ ambience and grade
/**
 * One ambient mote of a zone (p: { x, y, s (size), p (phase), kind: pollen, motes, wind, dust, wisps, embers, stars });
 * front: the layer over the actors (brighter). Leaves the context in 'lighter' mode; scene.js saves and restores.
 */
export function drawMote(ctx, p, front, u, t) {
  const k = p.kind;
  const tw = 0.5 + 0.5 * Math.sin(t * 2 + p.p * 7);
  ctx.globalCompositeOperation = 'lighter';
  if (k === 'wind') { ctx.strokeStyle = `rgba(255,255,255,${0.12 * p.s})`; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 60 * u * p.s, p.y + 2 * u); ctx.stroke(); return; }
  const col = { pollen: '#fff4d0', motes: '#d8f0d0', dust: '#ffe0b0', wisps: '#8ff0d0', embers: '#ffab4a', stars: '#cfe4ff' }[k] || '#ffffff';
  const r = (k === 'wisps' ? 4 : k === 'embers' ? 1.8 : 1.5) * u * p.s;
  const a = (k === 'wisps' ? 0.35 + 0.45 * tw : k === 'stars' ? 0.3 + 0.6 * tw : 0.35 + 0.3 * tw) * (front ? 1 : 0.7);
  if (k === 'wisps' || k === 'embers') { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
}

/**
 * The grade over a W x H frame: the zone's colour grade (an rgba() string), the vignette (--shade-55), the defeat
 * desaturation (desat 0..1), the dim behind a banner (dim 0..1) and a screen flash (flash: { color, alpha } now, or null).
 */
export function drawGrade(ctx, W, H, grade, desat, dim, flash) {
  ctx.fillStyle = grade; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, token('--shade-55'));
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (desat > 0) { ctx.fillStyle = `rgba(20,16,24,${0.55 * desat})`; ctx.fillRect(0, 0, W, H); }
  if (dim > 0.01) { ctx.fillStyle = `rgba(8,6,4,${dim})`; ctx.fillRect(0, 0, W, H); }
  if (flash) { ctx.fillStyle = rgba(flash.color, flash.alpha); ctx.fillRect(0, 0, W, H); }
}
