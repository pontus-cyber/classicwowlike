// Icons drawn in code and cached as data URLs (no image files, no requests).
import { rgba, shade } from './util.js';

const BG = {
  steel: ['#9aa3ad', '#3a3f48'], blood: ['#c0473f', '#4a1414'], shadow: ['#6a5a8a', '#1c1628'], gold: ['#e8c45a', '#6a4a12'],
  fire: ['#f08a3a', '#6a1e0a'], frost: ['#7cc4f0', '#173a5c'], arcane: ['#b07af0', '#2a1650'], nature: ['#8fc46a', '#22401a'],
  heal: ['#7fe0a0', '#145a32'], poison: ['#9fd65a', '#2a4a12'], earth: ['#c4a06a', '#4a3216'], dark: ['#5a5a6a', '#141418'],
  parchment: ['#e8d6a8', '#8a6a3a'], junk: ['#8a8a8a', '#2a2a2a'], common: ['#c8c8c8', '#3a3a3a'], uncommon: ['#5fd06a', '#14401a'],
  rare: ['#4f9cff', '#102a5a'], epic: ['#b86cff', '#2e1250'],
};

const cache = new Map();
const S = 64;

// ------------------------------------------------------------------ glyphs (drawn in a 64x64 box)
const G = {
  dagger(c) { c.beginPath(); c.moveTo(32, 8); c.lineTo(38, 36); c.lineTo(26, 36); c.closePath(); c.fill(); c.fillRect(20, 36, 24, 5); c.fillRect(29, 41, 6, 14); c.beginPath(); c.arc(32, 57, 4, 0, 7); c.fill(); },
  daggers(c) { c.save(); c.translate(32, 32); for (const a of [-0.6, 0.6]) { c.save(); c.rotate(a); c.translate(-32, -32); G.dagger(c); c.restore(); } c.restore(); },
  slash(c) { c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.lineWidth = 6 - i * 1.5; c.beginPath(); c.arc(10 + i * 6, 54 - i * 4, 42, -1.2, -0.25); c.stroke(); } },
  step(c) { c.beginPath(); c.ellipse(24, 40, 8, 14, -0.3, 0, 7); c.fill(); c.beginPath(); c.ellipse(42, 24, 7, 12, -0.3, 0, 7); c.fill(); c.globalAlpha = 0.5; c.beginPath(); c.ellipse(16, 22, 5, 9, -0.3, 0, 7); c.fill(); c.globalAlpha = 1; },
  silence(c) { c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(32, 32, 20, 0, 7); c.stroke(); c.beginPath(); c.moveTo(18, 46); c.lineTo(46, 18); c.stroke(); },
  drop(c) { c.beginPath(); c.moveTo(32, 8); c.bezierCurveTo(44, 26, 50, 34, 50, 42); c.arc(32, 42, 18, 0, Math.PI); c.bezierCurveTo(14, 34, 20, 26, 32, 8); c.fill(); },
  stars(c) { for (const [x, y, r] of [[22, 24, 9], [42, 20, 7], [36, 42, 10]]) star(c, x, y, r, 5); },
  smoke(c) { for (const [x, y, r] of [[22, 40, 12], [36, 34, 14], [44, 44, 10], [28, 26, 10]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } },
  whirl(c) { c.lineWidth = 5; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(32, 32, 18, i * 2.1, i * 2.1 + 1.4); c.stroke(); const a = i * 2.1 + 1.4; c.beginPath(); c.moveTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18); c.lineTo(32 + Math.cos(a + 0.3) * 26, 32 + Math.sin(a + 0.3) * 26); c.stroke(); } },
  eye(c) { c.beginPath(); c.moveTo(8, 32); c.quadraticCurveTo(32, 8, 56, 32); c.quadraticCurveTo(32, 56, 8, 32); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(32, 32, 9, 0, 7); c.fill(); c.restore(); c.beginPath(); c.arc(32, 32, 4, 0, 7); c.fill(); },
  bolt(c) { c.beginPath(); c.moveTo(36, 6); c.lineTo(16, 36); c.lineTo(30, 36); c.lineTo(26, 58); c.lineTo(48, 26); c.lineTo(34, 26); c.closePath(); c.fill(); },
  mask(c) { c.beginPath(); c.moveTo(8, 26); c.quadraticCurveTo(32, 16, 56, 26); c.quadraticCurveTo(54, 44, 40, 44); c.quadraticCurveTo(32, 36, 24, 44); c.quadraticCurveTo(10, 44, 8, 26); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.ellipse(22, 31, 6, 4, 0.2, 0, 7); c.ellipse(42, 31, 6, 4, -0.2, 0, 7); c.fill(); c.restore(); },
  skull(c) { c.beginPath(); c.arc(32, 28, 18, Math.PI * 0.85, Math.PI * 2.15); c.lineTo(44, 50); c.lineTo(20, 50); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(25, 30, 5, 0, 7); c.arc(39, 30, 5, 0, 7); c.fill(); c.fillRect(27, 44, 3, 6); c.fillRect(34, 44, 3, 6); c.restore(); },
  flame(c) { c.beginPath(); c.moveTo(32, 6); c.bezierCurveTo(46, 22, 52, 34, 46, 46); c.bezierCurveTo(42, 56, 22, 58, 18, 46); c.bezierCurveTo(14, 36, 20, 30, 24, 22); c.bezierCurveTo(26, 30, 30, 32, 32, 28); c.bezierCurveTo(34, 20, 30, 14, 32, 6); c.fill(); },
  flames(c) { c.save(); c.translate(-8, 6); c.scale(0.75, 0.75); G.flame(c); c.restore(); c.save(); c.translate(18, 2); c.scale(0.8, 0.8); G.flame(c); c.restore(); },
  icicle(c) { c.beginPath(); c.moveTo(10, 54); c.lineTo(50, 10); c.lineTo(54, 14); c.lineTo(16, 58); c.closePath(); c.fill(); c.beginPath(); c.moveTo(44, 8); c.lineTo(58, 6); c.lineTo(56, 20); c.closePath(); c.fill(); },
  shield(c) { c.beginPath(); c.moveTo(32, 6); c.lineTo(52, 14); c.quadraticCurveTo(52, 44, 32, 58); c.quadraticCurveTo(12, 44, 12, 14); c.closePath(); c.fill(); },
  snowflake(c) { c.lineWidth = 4; c.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const x = Math.cos(a), y = Math.sin(a); c.beginPath(); c.moveTo(32, 32); c.lineTo(32 + x * 24, 32 + y * 24); c.moveTo(32 + x * 14, 32 + y * 14); c.lineTo(32 + Math.cos(a + 0.6) * 20, 32 + Math.sin(a + 0.6) * 20); c.moveTo(32 + x * 14, 32 + y * 14); c.lineTo(32 + Math.cos(a - 0.6) * 20, 32 + Math.sin(a - 0.6) * 20); c.stroke(); } },
  snap(c) { c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(32, 32, 20, 0.5, 2.6); c.stroke(); c.beginPath(); c.arc(32, 32, 20, 3.6, 5.8); c.stroke(); c.beginPath(); c.moveTo(24, 20); c.lineTo(32, 32); c.lineTo(28, 36); c.lineTo(40, 46); c.stroke(); },
  rune(c) { c.lineWidth = 4; c.beginPath(); c.arc(32, 32, 22, 0, 7); c.stroke(); c.beginPath(); c.moveTo(32, 12); c.lineTo(20, 44); c.lineTo(48, 24); c.lineTo(16, 24); c.lineTo(44, 44); c.closePath(); c.stroke(); },
  meteor(c) { c.beginPath(); c.arc(40, 40, 12, 0, 7); c.fill(); c.lineWidth = 5; c.lineCap = 'round'; for (const [x, y] of [[10, 12], [18, 8], [8, 22]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20, y + 20); c.stroke(); } },
  swirl(c) { c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = 3 + a * 2; const x = 32 + Math.cos(a) * r; const y = 32 + Math.sin(a) * r; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); },
  tomb(c) { c.beginPath(); c.moveTo(18, 10); c.lineTo(46, 10); c.lineTo(52, 54); c.lineTo(12, 54); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 2; c.beginPath(); c.moveTo(24, 16); c.lineTo(20, 48); c.moveTo(34, 18); c.lineTo(40, 40); c.stroke(); c.restore(); },
  comet(c) { c.beginPath(); c.arc(42, 42, 11, 0, 7); c.fill(); c.beginPath(); c.moveTo(34, 34); c.lineTo(6, 14); c.lineTo(14, 8); c.lineTo(44, 32); c.fill(); c.beginPath(); c.moveTo(36, 38); c.lineTo(10, 30); c.lineTo(34, 46); c.fill(); },
  stars3(c) { star(c, 20, 22, 8, 4); star(c, 42, 30, 10, 4); star(c, 26, 46, 7, 4); },
  arrow(c) { c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, 54); c.lineTo(50, 14); c.stroke(); c.beginPath(); c.moveTo(54, 10); c.lineTo(38, 14); c.lineTo(50, 26); c.closePath(); c.fill(); c.beginPath(); c.moveTo(10, 54); c.lineTo(10, 42); c.lineTo(16, 48); c.closePath(); c.moveTo(10, 54); c.lineTo(22, 54); c.lineTo(16, 48); c.fill(); },
  barb(c) { G.arrow(c); c.lineWidth = 3; for (const k of [0.4, 0.6]) { const x = 10 + 40 * k, y = 54 - 40 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 8, y - 2); c.moveTo(x, y); c.lineTo(x + 2, y + 8); c.stroke(); } },
  target(c) { c.lineWidth = 4; for (const r of [22, 13]) { c.beginPath(); c.arc(32, 32, r, 0, 7); c.stroke(); } c.beginPath(); c.arc(32, 32, 5, 0, 7); c.fill(); },
  heart(c) { c.beginPath(); c.moveTo(32, 54); c.bezierCurveTo(4, 34, 12, 8, 32, 20); c.bezierCurveTo(52, 8, 60, 34, 32, 54); c.fill(); },
  trap(c) { c.lineWidth = 4; c.beginPath(); c.arc(32, 40, 20, Math.PI, 0); c.stroke(); for (let i = 0; i < 7; i++) { const x = 14 + i * 6; c.beginPath(); c.moveTo(x, 40); c.lineTo(x + 3, 30 - (i % 2) * 4); c.lineTo(x + 6, 40); c.fill(); } c.fillRect(10, 40, 44, 5); },
  cross(c) { c.fillRect(26, 10, 12, 44); c.fillRect(10, 26, 44, 12); },
  rain(c) { c.lineWidth = 3; c.lineCap = 'round'; for (const x of [14, 26, 38, 50]) { c.beginPath(); c.moveTo(x, 8 + (x % 3) * 4); c.lineTo(x - 6, 40 + (x % 3) * 4); c.stroke(); c.beginPath(); c.moveTo(x - 8, 44 + (x % 3) * 4); c.lineTo(x - 2, 38 + (x % 3) * 4); c.lineTo(x - 10, 36 + (x % 3) * 4); c.fill(); } },
  leaf(c) { c.beginPath(); c.moveTo(12, 52); c.quadraticCurveTo(10, 14, 52, 12); c.quadraticCurveTo(50, 50, 12, 52); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(14, 50); c.lineTo(46, 18); c.stroke(); c.restore(); },
  paw(c) { c.beginPath(); c.ellipse(32, 42, 12, 10, 0, 0, 7); c.fill(); for (const [x, y] of [[16, 26], [26, 16], [38, 16], [48, 26]]) { c.beginPath(); c.ellipse(x, y, 5, 7, 0, 0, 7); c.fill(); } },
  pierce(c) { G.heart(c); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 5; c.beginPath(); c.moveTo(8, 56); c.lineTo(56, 8); c.stroke(); c.restore(); c.lineWidth = 3; c.beginPath(); c.moveTo(8, 56); c.lineTo(56, 8); c.stroke(); },
  hourglass(c) { c.beginPath(); c.moveTo(16, 8); c.lineTo(48, 8); c.lineTo(34, 32); c.lineTo(48, 56); c.lineTo(16, 56); c.lineTo(30, 32); c.closePath(); c.fill(); },
  mirror(c) { c.lineWidth = 4; c.beginPath(); c.ellipse(32, 28, 15, 19, 0, 0, 7); c.stroke(); c.fillRect(29, 46, 6, 12); c.globalAlpha = 0.5; c.beginPath(); c.ellipse(32, 28, 9, 13, 0, 0, 7); c.fill(); c.globalAlpha = 1; },
  ricochet(c) { c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(6, 50); c.lineTo(30, 20); c.lineTo(42, 46); c.lineTo(58, 16); c.stroke(); },
  horn(c) { c.beginPath(); c.moveTo(10, 40); c.quadraticCurveTo(20, 50, 54, 18); c.lineTo(56, 30); c.quadraticCurveTo(26, 58, 8, 48); c.closePath(); c.fill(); },
  venom(c) { G.drop(c); c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(26, 40, 4, 0, 7); c.arc(38, 46, 3, 0, 7); c.fill(); c.restore(); },
  sun(c) { c.beginPath(); c.arc(32, 32, 12, 0, 7); c.fill(); c.lineWidth = 4; c.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17); c.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26); c.stroke(); } },
  spark(c) { star(c, 32, 32, 20, 4, 0.35); },
  // items
  helm(c) { c.beginPath(); c.moveTo(12, 44); c.quadraticCurveTo(12, 10, 32, 10); c.quadraticCurveTo(52, 10, 52, 44); c.lineTo(42, 50); c.lineTo(42, 34); c.lineTo(22, 34); c.lineTo(22, 50); c.closePath(); c.fill(); },
  amulet(c) { c.lineWidth = 3; c.beginPath(); c.moveTo(14, 8); c.quadraticCurveTo(32, 40, 50, 8); c.stroke(); c.beginPath(); c.moveTo(32, 30); c.lineTo(42, 42); c.lineTo(32, 56); c.lineTo(22, 42); c.closePath(); c.fill(); },
  chest(c) { c.beginPath(); c.moveTo(16, 10); c.lineTo(26, 14); c.quadraticCurveTo(32, 18, 38, 14); c.lineTo(48, 10); c.lineTo(56, 22); c.lineTo(48, 28); c.lineTo(48, 56); c.lineTo(16, 56); c.lineTo(16, 28); c.lineTo(8, 22); c.closePath(); c.fill(); },
  glove(c) { c.beginPath(); c.moveTo(18, 56); c.lineTo(18, 30); c.lineTo(14, 22); c.quadraticCurveTo(16, 16, 22, 22); c.lineTo(22, 12); c.quadraticCurveTo(26, 8, 28, 12); c.lineTo(30, 10); c.quadraticCurveTo(34, 6, 36, 10); c.lineTo(38, 12); c.quadraticCurveTo(42, 10, 44, 14); c.lineTo(46, 34); c.lineTo(42, 56); c.closePath(); c.fill(); },
  legs(c) { c.beginPath(); c.moveTo(16, 8); c.lineTo(48, 8); c.lineTo(50, 56); c.lineTo(36, 56); c.lineTo(32, 24); c.lineTo(28, 56); c.lineTo(14, 56); c.closePath(); c.fill(); },
  boot(c) { c.beginPath(); c.moveTo(18, 8); c.lineTo(36, 8); c.lineTo(36, 38); c.lineTo(54, 44); c.lineTo(54, 56); c.lineTo(14, 56); c.lineTo(18, 38); c.closePath(); c.fill(); },
  ring(c) { c.lineWidth = 7; c.beginPath(); c.arc(32, 38, 15, 0, 7); c.stroke(); c.beginPath(); c.moveTo(32, 8); c.lineTo(40, 18); c.lineTo(32, 26); c.lineTo(24, 18); c.closePath(); c.fill(); },
  gem(c) { c.beginPath(); c.moveTo(20, 10); c.lineTo(44, 10); c.lineTo(54, 24); c.lineTo(32, 56); c.lineTo(10, 24); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 24); c.lineTo(54, 24); c.moveTo(24, 24); c.lineTo(32, 54); c.lineTo(40, 24); c.stroke(); c.restore(); },
  staff(c) { c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, 58); c.lineTo(44, 18); c.stroke(); c.beginPath(); c.arc(48, 14, 8, 0, 7); c.fill(); },
  bow(c) { c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, 8); c.quadraticCurveTo(54, 32, 14, 56); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.moveTo(14, 8); c.lineTo(14, 56); c.stroke(); },
  tome(c) { c.beginPath(); c.moveTo(12, 14); c.lineTo(32, 18); c.lineTo(52, 14); c.lineTo(52, 50); c.lineTo(32, 54); c.lineTo(12, 50); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 18); c.lineTo(32, 54); c.stroke(); c.restore(); },
  quiver(c) { c.save(); c.translate(32, 32); c.rotate(0.4); c.fillRect(-8, -14, 16, 36); c.fillRect(-6, -26, 3, 14); c.fillRect(-1, -28, 3, 14); c.fillRect(4, -24, 3, 12); c.restore(); },
  potion(c) { c.fillRect(27, 8, 10, 10); c.beginPath(); c.moveTo(27, 18); c.lineTo(37, 18); c.lineTo(37, 24); c.quadraticCurveTo(52, 30, 50, 44); c.quadraticCurveTo(48, 58, 32, 58); c.quadraticCurveTo(16, 58, 14, 44); c.quadraticCurveTo(12, 30, 27, 24); c.closePath(); c.fill(); },
  bread(c) { c.beginPath(); c.ellipse(32, 36, 24, 15, -0.2, 0, 7); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 2.5; for (const x of [22, 32, 42]) { c.beginPath(); c.moveTo(x - 4, 28); c.lineTo(x + 4, 40); c.stroke(); } c.restore(); },
  flask(c) { c.fillRect(28, 8, 8, 12); c.beginPath(); c.moveTo(28, 20); c.lineTo(36, 20); c.lineTo(52, 54); c.lineTo(12, 54); c.closePath(); c.fill(); },
  ember(c) { G.flame(c); },
  junk(c) { c.beginPath(); c.ellipse(32, 38, 18, 16, 0, 0, 7); c.fill(); c.fillRect(24, 14, 16, 10); },
  coin(c) { c.beginPath(); c.arc(32, 32, 20, 0, 7); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 13, 0, 7); c.stroke(); c.restore(); },
  // map nodes
  quest(c) { c.fillRect(28, 8, 8, 32); c.beginPath(); c.arc(32, 50, 5, 0, 7); c.fill(); },
  grind(c) { c.save(); c.translate(32, 32); for (const a of [-0.78, 0.78]) { c.save(); c.rotate(a); c.fillRect(-3, -26, 6, 36); c.fillRect(-9, 8, 18, 4); c.fillRect(-2, 12, 4, 10); c.restore(); } c.restore(); },
  elite(c) { G.skull(c); c.beginPath(); c.moveTo(14, 22); c.lineTo(6, 4); c.lineTo(22, 14); c.fill(); c.beginPath(); c.moveTo(50, 22); c.lineTo(58, 4); c.lineTo(42, 14); c.fill(); },
  dungeon(c) { c.beginPath(); c.moveTo(10, 58); c.lineTo(10, 28); c.quadraticCurveTo(32, 2, 54, 28); c.lineTo(54, 58); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(20, 58); c.lineTo(20, 32); c.quadraticCurveTo(32, 14, 44, 32); c.lineTo(44, 58); c.closePath(); c.fill(); c.restore(); c.fillRect(20, 34, 24, 3); for (const x of [24, 31, 38]) c.fillRect(x, 36, 3, 22); },
  rest(c) { for (const [x, y, r] of [[22, 52, 0.5], [42, 52, -0.5]]) { c.save(); c.translate(32, y); c.rotate(r); c.fillRect(-20, -3, 40, 6); c.restore(); } c.save(); c.translate(0, -8); c.scale(1, 0.9); G.flame(c); c.restore(); },
  vendor(c) { c.beginPath(); c.moveTo(22, 18); c.lineTo(42, 18); c.quadraticCurveTo(56, 34, 50, 50); c.quadraticCurveTo(32, 60, 14, 50); c.quadraticCurveTo(8, 34, 22, 18); c.fill(); c.fillRect(24, 10, 16, 6); c.save(); c.globalCompositeOperation = 'destination-out'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('$', 32, 46); c.restore(); },
  trainer(c) { G.tome(c); },
  treasure(c) { c.beginPath(); c.moveTo(8, 30); c.quadraticCurveTo(32, 10, 56, 30); c.lineTo(56, 54); c.lineTo(8, 54); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.fillRect(8, 30, 48, 3); c.fillRect(28, 32, 8, 10); c.restore(); },
  shrine(c) { c.beginPath(); c.moveTo(22, 58); c.lineTo(24, 18); c.lineTo(32, 8); c.lineTo(40, 18); c.lineTo(42, 58); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(32, 28, 5, 0, 7); c.fill(); c.restore(); },
  hub(c) { c.beginPath(); c.moveTo(8, 30); c.lineTo(32, 10); c.lineTo(56, 30); c.closePath(); c.fill(); c.fillRect(14, 30, 36, 26); c.save(); c.globalCompositeOperation = 'destination-out'; c.fillRect(28, 40, 8, 16); c.restore(); },
  boss(c) { c.beginPath(); c.arc(32, 32, 16, 0, 7); c.fill(); c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 24, 0, 7); c.stroke(); },
  camp(c) { G.rest(c); },
  chain(c) { c.lineWidth = 5; for (const [x, y] of [[20, 20], [32, 32], [44, 44]]) { c.beginPath(); c.ellipse(x, y, 10, 6, 0.78, 0, 7); c.stroke(); } },
  plus(c) { G.cross(c); },
};

function star(c, x, y, r, n, inner = 0.45) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}

// ------------------------------------------------------------------ builder
function render(glyph, bg, opts = {}) {
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  const [c1, c2] = BG[bg] || BG.steel;
  if (!opts.bare) {
    const g = c.createRadialGradient(22, 16, 4, 32, 32, 46);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    // painterly sheen
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(S, 0); c.lineTo(0, S * 0.6); c.fill();
  }
  const fn = G[glyph] || G.spark;
  const fg = opts.fg || '#fbf1d6';
  // shadow pass
  c.save(); c.translate(2, 3); c.fillStyle = 'rgba(0,0,0,0.55)'; c.strokeStyle = 'rgba(0,0,0,0.55)'; fn(c); c.restore();
  c.save(); c.translate(32, 32); c.scale(0.86, 0.86); c.translate(-32, -32);
  const fg2 = c.createLinearGradient(0, 8, 0, 56);
  fg2.addColorStop(0, '#ffffff'); fg2.addColorStop(1, fg);
  c.fillStyle = opts.tint ? opts.tint : fg2; c.strokeStyle = opts.tint ? opts.tint : fg2;
  fn(c);
  c.restore();
  if (!opts.bare) {
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, S - 3, S - 3);
    c.strokeStyle = rgba(c1, 0.6); c.lineWidth = 1; c.strokeRect(3.5, 3.5, S - 7, S - 7);
  }
  return cv.toDataURL();
}

export function icon(glyph, bg, opts = {}) {
  const key = `${glyph}|${bg}|${opts.fg || ''}|${opts.bare ? 1 : 0}|${opts.tint || ''}`;
  if (!cache.has(key)) {
    try { cache.set(key, render(glyph, bg, opts)); } catch { cache.set(key, ''); }
  }
  return cache.get(key);
}

const SPELL_ICON = {
  gutting_jab: ['dagger', 'steel'], severing_flourish: ['slash', 'blood'], shadowstep_strike: ['step', 'shadow'], throat_jab: ['silence', 'steel'],
  open_vein: ['drop', 'blood'], temple_blow: ['stars', 'steel'], smoke_veil: ['smoke', 'shadow'], whirling_edges: ['whirl', 'steel'],
  expose_weakness: ['eye', 'blood'], adrenal_surge: ['bolt', 'gold'], vanishing_step: ['mask', 'shadow'], final_reckoning: ['skull', 'blood'],
  ember_bolt: ['flame', 'fire'], frost_lance: ['icicle', 'frost'], arcane_ward: ['shield', 'arcane'], rime_burst: ['snowflake', 'frost'],
  living_flame: ['flames', 'fire'], spellsnap: ['snap', 'arcane'], hexbind: ['rune', 'arcane'], cinder_storm: ['meteor', 'fire'],
  mana_siphon: ['swirl', 'arcane'], glacial_tomb: ['tomb', 'frost'], pyre_comet: ['comet', 'fire'], starlance_barrage: ['stars3', 'arcane'],
  keen_shot: ['arrow', 'nature'], barbed_arrow: ['barb', 'blood'], mark_prey: ['target', 'blood'], mend_companion: ['heart', 'heal'],
  muzzle_shot: ['silence', 'nature'], snare_trap: ['trap', 'steel'], field_dressing: ['cross', 'heal'], volley_rain: ['rain', 'nature'],
  feign_stillness: ['leaf', 'nature'], savage_order: ['paw', 'blood'], rapid_volley: ['bolt', 'gold'], heartseeker_shot: ['pierce', 'blood'],
  ghostblade_rush: ['daggers', 'shadow'], bloodprice_gambit: ['drop', 'gold'], chrono_sigil: ['hourglass', 'arcane'], mirrorshade: ['mirror', 'arcane'],
  ricochet_bolt: ['ricochet', 'nature'], beastcall_horn: ['horn', 'gold'], thousand_cuts: ['whirl', 'blood'], rupture_venom: ['venom', 'poison'],
  conflagrant_core: ['sun', 'fire'], glacier_spike: ['icicle', 'frost'], hourglass_reversal: ['hourglass', 'gold'], wild_communion: ['paw', 'nature'],
  starfall_arrow: ['comet', 'nature'], deadfall_trap: ['trap', 'blood'],
};

export function spellIcon(id, spell) {
  const m = SPELL_ICON[id];
  if (m) return icon(m[0], m[1]);
  const tags = (spell && spell.tags) || [];
  if (tags.includes('aoe')) return icon('whirl', 'steel');
  if (tags.includes('defensive')) return icon('shield', 'steel');
  if (tags.includes('interrupt')) return icon('silence', 'steel');
  return icon('spark', 'arcane');
}
export function basicIcon(classId) { return classId === 'mage' ? icon('spark', 'arcane') : classId === 'hunter' ? icon('arrow', 'steel') : icon('daggers', 'steel'); }

export function talentIcon(t) {
  const n = (t.name + ' ' + t.text).toLowerCase();
  const tree = t.tree;
  const bg = { bladework: 'steel', shadowcraft: 'shadow', venomcraft: 'poison', pyromancy: 'fire', rimecraft: 'frost', arcanism: 'arcane', beastbond: 'nature', marksmanship: 'earth', wildcraft: 'heal' }[tree] || 'steel';
  if (t.spell && SPELL_ICON[t.spell]) return icon(SPELL_ICON[t.spell][0], bg);
  const pickG = [[/poison|venom|toxi|plague|septic/, 'venom'], [/bleed|vein|wound|rupture|fester|hemorrh/, 'drop'], [/stealth|shade|shadow|night|veil|sidestep/, 'mask'],
    [/dodge|slipp|evasi|riposte|survival/, 'smoke'], [/crit|keen|edge|honed|calculus|lethal|mortal/, 'slash'], [/combo|finish|momentum/, 'daggers'],
    [/fire|flame|pyre|kindl|ember|heat|combust|wildfire|flash/, 'flame'], [/frost|rime|chill|cold|winter|tomb|hoarfrost|permafrost|shatter|brittle/, 'snowflake'],
    [/ward|shield|lattice|guard/, 'shield'], [/mana|reserve|flow|lucid|rebound|mind/, 'swirl'], [/barrage|momentum|acuity|power/, 'stars3'],
    [/pet|beast|bond|pack|ferocity|frenzy|hide|savage|wounds/, 'paw'], [/shot|aim|arrow|volley|mark|efficien/, 'arrow'], [/trap|snare/, 'trap'],
    [/heal|medic|dressing|hardy|spirit/, 'cross'], [/barb/, 'barb'], [/cornered/, 'heart']];
  for (const [re, g] of pickG) if (re.test(n)) return icon(g, bg);
  return icon('spark', bg);
}

const SLOT_GLYPH = { head: 'helm', neck: 'amulet', chest: 'chest', hands: 'glove', legs: 'legs', feet: 'boot', ring: 'ring', trinket: 'gem', weapon: 'dagger', offhand: 'shield' };
const CONS = { healing_draught: ['potion', 'blood'], greater_healing_draught: ['potion', 'epic'], mana_draught: ['potion', 'rare'], trail_rations: ['bread', 'earth'],
  purifying_tonic: ['potion', 'heal'], spark_flask: ['flask', 'arcane'], elixir_ferocity: ['potion', 'fire'], ember_of_return: ['ember', 'gold'] };

export function itemIcon(item) {
  if (!item) return '';
  if (item.kind === 'consumable') { const m = CONS[item.id] || ['potion', 'steel']; return icon(m[0], m[1]); }
  if (item.kind === 'junk') return icon('junk', 'junk');
  let g = SLOT_GLYPH[item.slot] || 'gem';
  if (item.slot === 'weapon') g = item.gearKind === 'staff' ? 'staff' : item.gearKind === 'bow' ? 'bow' : 'dagger';
  if (item.slot === 'offhand') g = item.gearKind === 'tome' ? 'tome' : item.gearKind === 'quiver' ? 'quiver' : item.gearKind === 'dagger' ? 'dagger' : 'shield';
  return icon(g, item.rarity === 'common' ? 'common' : item.rarity || 'steel');
}
export function consumableIcon(id) { const m = CONS[id] || ['potion', 'steel']; return icon(m[0], m[1]); }
export function slotIcon(slot) { return icon(SLOT_GLYPH[slot] || 'gem', 'dark', { fg: '#6a6458' }); }

export const NODE_COLORS = { quest: 'gold', grind: 'steel', elite: 'blood', dungeon: 'shadow', rest: 'fire', vendor: 'earth', trainer: 'arcane', treasure: 'gold', shrine: 'heal', hub: 'parchment', camp: 'fire', boss: 'shadow' };
export function nodeIcon(type) { return icon(type === 'camp_grind' ? 'grind' : type, NODE_COLORS[type] || 'steel'); }

const STATUS_ICON = {
  STUN: ['stars', 'gold'], FROZEN: ['snowflake', 'frost'], HEXED: ['rune', 'arcane'], SILENCED: ['silence', 'arcane'], BLEED: ['drop', 'blood'],
  BURN: ['flame', 'fire'], POISON: ['venom', 'poison'], CHILLED: ['snowflake', 'frost'], CURSED: ['skull', 'shadow'], EXPOSED: ['eye', 'blood'],
  MARKED: ['target', 'blood'], BRAND: ['eye', 'shadow'], WARD: ['shield', 'arcane'], EVASION: ['smoke', 'shadow'], STEALTH: ['mask', 'shadow'],
  IMMUNE: ['tomb', 'frost'], HOT: ['cross', 'heal'], TAUNT: ['horn', 'gold'], RAPID: ['bolt', 'gold'], SHIELDED: ['shield', 'steel'],
  ENRAGED: ['flame', 'blood'], LINKED: ['chain', 'shadow'],
};
export function statusIcon(id) { const m = STATUS_ICON[id] || ['spark', 'steel']; return icon(m[0], m[1]); }
export const schoolBg = (school) => ({ fire: 'fire', frost: 'frost', arcane: 'arcane', shadow: 'shadow', nature: 'nature', phys: 'steel' }[school] || 'steel');
export const abilityIcon = (intent) => {
  if (!intent) return icon('spark', 'dark');
  if (intent.selfHeal || intent.mend) return icon('cross', 'heal');
  if (intent.brace || intent.shieldAlly || intent.shield) return icon('shield', 'steel');
  if (intent.curse) return icon('skull', 'shadow');
  if (intent.cast) return icon('rune', 'arcane');
  if (intent.heavy) return icon('bolt', 'blood');
  if (intent.id === 'unaware' || intent.id === 'none') return icon('eye', 'dark');
  return icon(intent.school === 'phys' ? 'slash' : 'spark', schoolBg(intent.school));
};
export { shade };
