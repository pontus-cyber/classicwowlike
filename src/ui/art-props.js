// Set pieces drawn on the ground line of the scene canvas: campfire, tent, the vendor's cart, the shrine stone, the chest
// (shut or open), the dungeon gate, the signpost, the banner, and the quest mark over a quest giver. Track R step R5
// (docs/reviews/ui-architecture-2026-11-12.md, section 3; D119): moved out of scene.js with the same drawing calls.
//
// An art module (rule U6): it imports only util.js and theme.js, reads no game state, keeps no state and queries no DOM.
//   drawProp(c, kind, x, y, u, t, pal, o)  draw one set piece; returns false when kind is not in PROP_KINDS
//     c      canvas 2D context in CSS px (scene.js has set the device-pixel transform)
//     kind   one of PROP_KINDS
//     x, y   the foot of the piece: its centre on the ground line, CSS px
//     u      CSS px per art unit (canvas height / 768)
//     t      the scene clock in s (flames, glows and the banner move with it)
//     pal    the zone's paint, an art-world.js THEMES entry: near, accent, ui.tint
//     o      { open } for the chest, { color } for the banner (default pal.ui.tint); scene.js passes its prop record
//   drawQuestMark(c, mark, x, y, u, t)     the floating '!' or '?' over a quest giver; y is the ground line
//   PROP_KINDS                             the kinds drawProp draws. An NPC (art-actors.js drawHumanoid) and the
//                                          trees (art-world.js oak, pine) are drawn by scene.js with their own modules,
//                                          since art modules do not import each other
// Fonts: the weight is the --fw-* type token of tokens.css; the family "Georgia, serif" matches no type token and stays
// written here (R5, exact values only).
import { rgba, mix, shade } from './util.js';
import { token } from './theme.js';

export const PROP_KINDS = Object.freeze(['campfire', 'tent', 'cart', 'stone', 'chest', 'gate', 'sign', 'banner']);

export function drawProp(c, kind, x, y, u, t, pal, o = {}) {
  switch (kind) {
    case 'campfire': campfire(c, x, y, u, t); return true;
    case 'tent': tent(c, x, y, u, pal); return true;
    case 'cart': cart(c, x, y, u, pal); return true;
    case 'stone': shrineStone(c, x, y, u, t, pal.accent); return true;
    case 'chest': chest(c, x, y, u, t, o.open); return true;
    case 'gate': gate(c, x, y, u, t, pal); return true;
    case 'sign': signpost(c, x, y, u, pal); return true;
    case 'banner': banner(c, x, y, u, t, o.color || pal.ui.tint); return true;
    default: return false;
  }
}

/** The floating quest mark ('!' a quest to take, '?' one to hand in) over a quest giver standing at (x, ground line y). */
export function drawQuestMark(ctx, mark, x, gy, u, t) {
  const y = gy - 190 * u + Math.sin(t * 3) * 4 * u;
  ctx.save(); ctx.font = `${token('--fw-black')} ${34 * u}px Georgia, serif`; ctx.textAlign = 'center';
  ctx.shadowColor = '#ffcc33'; ctx.shadowBlur = 16 * u; ctx.fillStyle = '#ffd94a'; ctx.fillText(mark, x, y);
  ctx.shadowBlur = 0; ctx.lineWidth = 2 * u; ctx.strokeStyle = '#5a3a0a'; ctx.strokeText(mark, x, y); ctx.restore();
}

// ------------------------------------------------------------------ set pieces
function campfire(ctx, x, y, u, t) {
  for (const [dx, r] of [[-26, 0.25], [26, -0.25]]) { ctx.save(); ctx.translate(x + dx * u, y - 4 * u); ctx.rotate(r); ctx.fillStyle = '#4a3020'; ctx.fillRect(-22 * u, -5 * u, 44 * u, 10 * u); ctx.restore(); }
  const g = ctx.createRadialGradient(x, y - 30 * u, 4, x, y - 30 * u, 180 * u);
  g.addColorStop(0, `rgba(255,170,80,${0.35 + 0.05 * Math.sin(t * 9)})`); g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 30 * u, 180 * u, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i++) {
    const fl = 1 + Math.sin(t * (8 + i) + i) * 0.15;
    ctx.fillStyle = ['#ff6a1a', '#ffa83a', '#ffe08a'][i];
    ctx.beginPath(); ctx.moveTo(x - (16 - i * 5) * u, y - 6 * u);
    ctx.quadraticCurveTo(x - (10 - i * 3) * u, y - (30 - i * 4) * u * fl, x + Math.sin(t * 6 + i) * 3 * u, y - (52 - i * 12) * u * fl);
    ctx.quadraticCurveTo(x + (10 - i * 3) * u, y - (30 - i * 4) * u * fl, x + (16 - i * 5) * u, y - 6 * u); ctx.fill();
  }
}
function tent(ctx, x, y, u, th) {
  // Weathered canvas, toned toward the zone's own near colour so it sits in any light.
  const cloth = mix('#b09a72', th.near || '#3a3020', 0.38);
  const dark = shade(cloth, -0.34); const lit = shade(cloth, -0.06);
  ctx.strokeStyle = shade(cloth, -0.55); ctx.lineWidth = 1.2 * u;
  ctx.beginPath(); ctx.moveTo(x - 4 * u, y - 92 * u); ctx.lineTo(x - 96 * u, y + 2 * u); ctx.moveTo(x + 4 * u, y - 92 * u); ctx.lineTo(x + 96 * u, y + 2 * u); ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.moveTo(x - 70 * u, y); ctx.lineTo(x, y - 90 * u); ctx.lineTo(x + 70 * u, y); ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath(); ctx.moveTo(x, y - 90 * u); ctx.lineTo(x + 70 * u, y); ctx.lineTo(x + 10 * u, y); ctx.fill();
  ctx.strokeStyle = shade(cloth, -0.45); ctx.lineWidth = 1.4 * u;
  for (const f of [0.35, 0.7]) { ctx.beginPath(); ctx.moveTo(x - 70 * u * f, y - 90 * u * (1 - f)); ctx.lineTo(x + 70 * u * f, y - 90 * u * (1 - f)); ctx.stroke(); }
  ctx.fillStyle = '#140e0a'; ctx.beginPath(); ctx.moveTo(x - 14 * u, y); ctx.lineTo(x, y - 50 * u); ctx.lineTo(x + 12 * u, y); ctx.fill();
  ctx.fillStyle = shade(cloth, -0.2); ctx.beginPath(); ctx.moveTo(x, y - 50 * u); ctx.lineTo(x + 12 * u, y); ctx.lineTo(x + 22 * u, y); ctx.fill();
  ctx.fillStyle = '#3a2614'; ctx.fillRect(x - 1.6 * u, y - 100 * u, 3.2 * u, 12 * u);
}
function cart(ctx, x, y, u, th) {
  ctx.fillStyle = '#6a4528'; ctx.fillRect(x - 70 * u, y - 52 * u, 140 * u, 30 * u);
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(x - 70 * u, y - 56 * u, 140 * u, 6 * u);
  for (const wx of [-42, 42]) { ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.arc(x + wx * u, y - 16 * u, 16 * u, 0, Math.PI * 2); ctx.stroke(); }
  const stripes = ['#c8402e', '#f0e0c0'];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = stripes[i % 2]; ctx.beginPath(); ctx.moveTo(x - 80 * u + i * 20 * u, y - 112 * u); ctx.lineTo(x - 60 * u + i * 20 * u, y - 112 * u); ctx.lineTo(x - 60 * u + i * 20 * u, y - 98 * u); ctx.quadraticCurveTo(x - 70 * u + i * 20 * u, y - 92 * u, x - 80 * u + i * 20 * u, y - 98 * u); ctx.fill(); }
  ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 76 * u, y - 112 * u, 4 * u, 60 * u); ctx.fillRect(x + 72 * u, y - 112 * u, 4 * u, 60 * u);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#c84a3a', '#3a6ad8', '#4ab060', '#e0b040', '#9a5ad0'][i]; ctx.beginPath(); ctx.arc(x - 48 * u + i * 24 * u, y - 62 * u, 6 * u, 0, Math.PI * 2); ctx.fill(); }
}
function shrineStone(ctx, x, y, u, t, col) {
  const g = ctx.createRadialGradient(x, y - 70 * u, 4, x, y - 70 * u, 120 * u);
  g.addColorStop(0, rgba(col, 0.35 + 0.1 * Math.sin(t * 2))); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 70 * u, 120 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a5a62';
  ctx.beginPath(); ctx.moveTo(x - 24 * u, y); ctx.lineTo(x - 20 * u, y - 110 * u); ctx.lineTo(x, y - 128 * u); ctx.lineTo(x + 20 * u, y - 112 * u); ctx.lineTo(x + 26 * u, y); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(x, y - 128 * u); ctx.lineTo(x + 20 * u, y - 112 * u); ctx.lineTo(x + 26 * u, y); ctx.lineTo(x + 6 * u, y); ctx.fill();
  ctx.strokeStyle = rgba(col, 0.75 + 0.25 * Math.sin(t * 3)); ctx.lineWidth = 2.5 * u; ctx.shadowColor = col; ctx.shadowBlur = 12 * u;
  ctx.beginPath(); ctx.moveTo(x - 6 * u, y - 96 * u); ctx.lineTo(x + 6 * u, y - 80 * u); ctx.lineTo(x - 6 * u, y - 64 * u); ctx.lineTo(x + 6 * u, y - 48 * u); ctx.stroke(); ctx.shadowBlur = 0;
}
function chest(ctx, x, y, u, t, open) {
  if (open) { const g = ctx.createRadialGradient(x, y - 40 * u, 4, x, y - 40 * u, 110 * u); g.addColorStop(0, 'rgba(255,220,120,0.55)'); g.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 40 * u, 110 * u, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#6a3e1e'; ctx.fillRect(x - 40 * u, y - 40 * u, 80 * u, 40 * u);
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(x - 40 * u, y - 40 * u, 80 * u, 5 * u); ctx.fillRect(x - 6 * u, y - 30 * u, 12 * u, 14 * u);
  ctx.fillStyle = '#7a4a24';
  if (open) { ctx.beginPath(); ctx.moveTo(x - 40 * u, y - 40 * u); ctx.lineTo(x - 44 * u, y - 84 * u); ctx.lineTo(x + 36 * u, y - 84 * u); ctx.lineTo(x + 40 * u, y - 40 * u); ctx.fill(); ctx.fillStyle = '#ffd86a'; ctx.beginPath(); ctx.ellipse(x, y - 40 * u, 34 * u, 6 * u, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(x - 40 * u, y - 40 * u); ctx.quadraticCurveTo(x, y - 70 * u, x + 40 * u, y - 40 * u); ctx.fill(); ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(x - 40 * u, y - 40 * u); ctx.quadraticCurveTo(x, y - 70 * u, x + 40 * u, y - 40 * u); ctx.stroke(); }
}
function gate(ctx, x, y, u, t, th) {
  ctx.fillStyle = shade(th.near, -0.2);
  ctx.beginPath(); ctx.moveTo(x - 130 * u, y); ctx.lineTo(x - 110 * u, y - 170 * u); ctx.lineTo(x - 30 * u, y - 210 * u); ctx.lineTo(x + 60 * u, y - 200 * u); ctx.lineTo(x + 140 * u, y - 150 * u); ctx.lineTo(x + 150 * u, y); ctx.fill();
  ctx.fillStyle = '#0c0a0a'; ctx.beginPath(); ctx.moveTo(x - 50 * u, y); ctx.lineTo(x - 50 * u, y - 90 * u); ctx.quadraticCurveTo(x, y - 150 * u, x + 50 * u, y - 90 * u); ctx.lineTo(x + 50 * u, y); ctx.fill();
  ctx.strokeStyle = shade(th.near, 0.25); ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(x - 50 * u, y); ctx.lineTo(x - 50 * u, y - 90 * u); ctx.quadraticCurveTo(x, y - 150 * u, x + 50 * u, y - 90 * u); ctx.lineTo(x + 50 * u, y); ctx.stroke();
  for (const tx of [-70, 70]) { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + tx * u - 3 * u, y - 100 * u, 6 * u, 26 * u); campfireMini(ctx, x + tx * u, y - 100 * u, u, t); }
}
function campfireMini(ctx, x, y, u, t) {
  const g = ctx.createRadialGradient(x, y, 1, x, y, 50 * u); g.addColorStop(0, 'rgba(255,170,80,0.5)'); g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 50 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.moveTo(x - 5 * u, y); ctx.quadraticCurveTo(x, y - (16 + Math.sin(t * 10) * 3) * u, x + 5 * u, y); ctx.fill();
}
function signpost(ctx, x, y, u, th) {
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 3 * u, y - 90 * u, 6 * u, 90 * u);
  ctx.fillStyle = '#8a6038'; ctx.beginPath(); ctx.moveTo(x - 4 * u, y - 84 * u); ctx.lineTo(x + 46 * u, y - 84 * u); ctx.lineTo(x + 56 * u, y - 74 * u); ctx.lineTo(x + 46 * u, y - 64 * u); ctx.lineTo(x - 4 * u, y - 64 * u); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 4 * u, y - 58 * u); ctx.lineTo(x - 46 * u, y - 58 * u); ctx.lineTo(x - 56 * u, y - 48 * u); ctx.lineTo(x - 46 * u, y - 38 * u); ctx.lineTo(x + 4 * u, y - 38 * u); ctx.fill();
}
function banner(ctx, x, y, u, t, col) {
  ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 2.5 * u, y - 150 * u, 5 * u, 150 * u);
  const wave = Math.sin(t * 2) * 6 * u;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 2 * u, y - 146 * u); ctx.quadraticCurveTo(x + 30 * u, y - 140 * u + wave, x + 52 * u, y - 146 * u); ctx.lineTo(x + 52 * u, y - 96 * u); ctx.lineTo(x + 27 * u, y - 108 * u + wave); ctx.lineTo(x + 2 * u, y - 96 * u); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 6 * u, y - 140 * u, 42 * u, 4 * u);
}
