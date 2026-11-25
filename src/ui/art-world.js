// Painted parallax backdrops drawn in code (no images). One theme per zone (rules.md 1.3) plus the
// Sunken Observatory. Layers are rendered once into tileable strips and scrolled at different speeds.
import { prng, mix, shade, rgba, clamp } from './util.js';

export const THEMES = {
  farmland: {
    sky: ['#4f8fcf', '#93c0e6', '#f4ddb0'], sun: { x: 0.8, y: 0.2, r: 0.045, color: '#fff6d8', glow: '#ffd98a' },
    cloud: '#ffffff', cloudShade: '#d9c7b0', clouds: 7,
    far: '#8fb0b5', mid: '#78a052', midDark: '#56783a', near: '#4b6b2f', ground: '#6b8a34', path: '#b39563', pathDark: '#8a6f45',
    accent: '#f2c95c', light: '#ffe6ad', fog: '#f6e7c4', fogA: 0.16, particles: 'pollen', grade: 'rgba(255,190,110,0.07)',
    ui: { tint: '#c89a4a' },
  },
  dusk: { // class select: farmland at sunset
    sky: ['#1c1838', '#7a4a78', '#f0985a'], sun: { x: 0.74, y: 0.5, r: 0.05, color: '#ffe0a0', glow: '#ff9a50' },
    cloud: '#f0a890', cloudShade: '#5a3a5a', clouds: 7, stars: 40,
    far: '#6a5a7a', mid: '#4a4a3a', midDark: '#2e3024', near: '#26281c', ground: '#3a3a22', path: '#7a5a3a', pathDark: '#4a3622',
    accent: '#e8a050', light: '#ffc080', fog: '#c87a6a', fogA: 0.22, particles: 'pollen', grade: 'rgba(255,120,60,0.06)',
    ui: { tint: '#c89a4a' },
  },
  wetlands: {
    sky: ['#76908f', '#a7b8ae', '#d6dbc4'], sun: { x: 0.3, y: 0.24, r: 0.06, color: '#eef0dc', glow: '#d8dfc4' },
    cloud: '#dfe4d6', cloudShade: '#9aa89e', clouds: 10,
    far: '#7e958c', mid: '#556f5e', midDark: '#3f574a', near: '#344c3d', ground: '#4f6844', path: '#6e6247', pathDark: '#52482f',
    water: '#6f8f88', accent: '#9fe0c2', light: '#e6efd6', fog: '#dfe6d6', fogA: 0.32, particles: 'motes', grade: 'rgba(120,170,150,0.08)',
    ui: { tint: '#6fae96' },
  },
  highlands: {
    sky: ['#3f73b5', '#8fb3da', '#e3edf4'], sun: { x: 0.72, y: 0.16, r: 0.04, color: '#ffffff', glow: '#e0efff' },
    cloud: '#ffffff', cloudShade: '#b9c9dc', clouds: 6,
    far: '#a9bbd0', snow: '#f4f8fc', mid: '#6d8478', midDark: '#4f6458', near: '#3d5246', ground: '#5b7351', path: '#8f8a78', pathDark: '#6c6858',
    heather: '#8d6c98', accent: '#cfe3f5', light: '#f2f8ff', fog: '#e8f0f6', fogA: 0.14, particles: 'wind', grade: 'rgba(160,190,230,0.06)',
    ui: { tint: '#8fb0d6' },
  },
  ruins: {
    sky: ['#d98f4d', '#eebd85', '#f9e3b6'], sun: { x: 0.62, y: 0.17, r: 0.05, color: '#fffbea', glow: '#ffe2a0' },
    cloud: '#fbe7c4', cloudShade: '#e2b07c', clouds: 4,
    far: '#d6a77a', mid: '#c48d58', midDark: '#a5703f', near: '#9a6a40', ground: '#c99a62', path: '#ddb985', pathDark: '#b48e5c',
    stone: '#d8c09a', stoneDark: '#a88a64', accent: '#ffd27a', light: '#fff0c8', fog: '#f6ddb0', fogA: 0.22, particles: 'dust', grade: 'rgba(255,170,90,0.08)',
    ui: { tint: '#d9a35c' },
  },
  haunted: {
    sky: ['#100e26', '#2a2350', '#5c4679'], sun: { x: 0.74, y: 0.2, r: 0.055, color: '#eef0ff', glow: '#9fa8e8', moon: true },
    cloud: '#4a3f6e', cloudShade: '#241d40', clouds: 6, stars: 90,
    far: '#2c2750', mid: '#211d3e', midDark: '#18152f', near: '#141127', ground: '#2a2440', path: '#3f3556', pathDark: '#2c253f',
    accent: '#7ff0c8', light: '#b9c2ff', fog: '#6a5d93', fogA: 0.3, particles: 'wisps', grade: 'rgba(90,70,160,0.10)',
    ui: { tint: '#8f7fd6' },
  },
  scorched: {
    sky: ['#140a0a', '#43180f', '#a3401a'], sun: { x: 0.3, y: 0.3, r: 0.07, color: '#ffb36b', glow: '#ff5a1f', ember: true },
    cloud: '#5a2a1c', cloudShade: '#1d0c09', clouds: 9,
    far: '#3a211b', mid: '#2a1612', midDark: '#1c0e0b', near: '#170c0a', ground: '#2f211c', path: '#4a362c', pathDark: '#2e211b',
    lava: '#ff6a1a', accent: '#ffb347', light: '#ff9a4d', fog: '#8a3a1f', fogA: 0.2, particles: 'embers', grade: 'rgba(255,90,30,0.08)',
    ui: { tint: '#e0703a' },
  },
  observatory: {
    sky: ['#03050f', '#0d1533', '#24376a'], sun: { x: 0.68, y: 0.2, r: 0.06, color: '#05060c', glow: '#ffd27a', eclipse: true },
    cloud: '#2a3a6e', cloudShade: '#0b1026', clouds: 3, stars: 160, nebula: true,
    far: '#18203f', mid: '#1c2548', midDark: '#121935', near: '#0f152c', ground: '#222c4c', path: '#2f3a60', pathDark: '#1c2443',
    stone: '#3a4670', accent: '#9fd0ff', light: '#cfe4ff', fog: '#3a4e8a', fogA: 0.22, particles: 'stars', grade: 'rgba(80,110,220,0.08)',
    ui: { tint: '#8fb6ff' },
  },
};

// Layout constants in fractions of the viewport height.
export const GROUND_Y = 0.785; // feet line

// ------------------------------------------------------------------ helpers
function periodic(rnd, n) { // random periodic function on [0,1): sum of n sines with integer frequencies
  const terms = [];
  for (let i = 0; i < n; i++) terms.push({ k: 1 + Math.floor(rnd() * (3 + i * 3)), a: (1 / (i + 1)) * (0.5 + rnd()), p: rnd() * Math.PI * 2 });
  const norm = terms.reduce((a, t) => a + t.a, 0);
  return (x) => terms.reduce((a, t) => a + t.a * Math.sin(t.k * Math.PI * 2 * x + t.p), 0) / norm;
}

function silhouette(ctx, W, baseY, amp, f, bottom, jag = 0, rnd = null) {
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  const step = 6;
  for (let x = 0; x <= W; x += step) {
    let y = baseY - amp * (0.5 + 0.5 * f(x / W));
    if (jag && rnd) y += (rnd() - 0.5) * jag;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, bottom);
  ctx.closePath();
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** Paint short strokes clipped to the current path for a brushed texture. */
function brush(ctx, rnd, x0, y0, w, hgt, colors, count, len = 14, alpha = 0.18, width = 2) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd() * w; const y = y0 + rnd() * hgt;
    ctx.strokeStyle = rgba(colors[Math.floor(rnd() * colors.length)], alpha * (0.5 + rnd()));
    ctx.lineWidth = width * (0.6 + rnd());
    const a = (rnd() - 0.5) * 0.6;
    const l = len * (0.5 + rnd());
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
}

/** Draw at x and at x ± W so that strips tile seamlessly. */
function wrap(W, x, r, fn) { fn(x); if (x - r < 0) fn(x + W); if (x + r > W) fn(x - W); }

// ------------------------------------------------------------------ props
export function oak(ctx, x, y, s, c, rnd) {
  const trunk = shade(c.near, -0.45);
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y); ctx.quadraticCurveTo(x - 3 * s, y - 30 * s, x - 4 * s, y - 52 * s);
  ctx.lineTo(x + 4 * s, y - 52 * s); ctx.quadraticCurveTo(x + 3 * s, y - 30 * s, x + 7 * s, y); ctx.fill();
  const blobs = 7 + Math.floor(rnd() * 4);
  const leaf = c.leaf || c.near;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rnd() * 0.5;
    const rr = (22 + rnd() * 12) * s;
    const bx = x + Math.cos(a) * 22 * s; const by = y - 70 * s + Math.sin(a) * 16 * s;
    const g = ctx.createRadialGradient(bx + rr * 0.35, by - rr * 0.45, rr * 0.1, bx, by, rr);
    g.addColorStop(0, shade(leaf, 0.22)); g.addColorStop(0.6, leaf); g.addColorStop(1, shade(leaf, -0.25));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, rr, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(x + 10 * s, y - 86 * s, 4 * s, x, y - 72 * s, 34 * s);
  g.addColorStop(0, rgba(c.light, 0.35)); g.addColorStop(1, rgba(c.light, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 72 * s, 34 * s, 0, Math.PI * 2); ctx.fill();
}

export function pine(ctx, x, y, s, color, rnd, snow) {
  const tiers = 5;
  ctx.fillStyle = shade(color, -0.4);
  ctx.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s);
  for (let i = 0; i < tiers; i++) {
    const ty = y - 10 * s - i * 17 * s; const w = (30 - i * 5) * s;
    ctx.fillStyle = i % 2 ? color : shade(color, 0.06);
    ctx.beginPath(); ctx.moveTo(x - w, ty); ctx.lineTo(x, ty - 30 * s); ctx.lineTo(x + w, ty);
    ctx.quadraticCurveTo(x, ty - 6 * s, x - w, ty); ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.07);
    ctx.beginPath(); ctx.moveTo(x, ty - 30 * s); ctx.lineTo(x + w, ty); ctx.lineTo(x + w * 0.3, ty - 4 * s); ctx.fill();
    if (snow) { ctx.fillStyle = rgba(snow, 0.85); ctx.beginPath(); ctx.moveTo(x - w * 0.35, ty - 19 * s); ctx.lineTo(x, ty - 30 * s); ctx.lineTo(x + w * 0.4, ty - 18 * s); ctx.quadraticCurveTo(x, ty - 22 * s, x - w * 0.35, ty - 19 * s); ctx.fill(); }
  }
}

export function deadTree(ctx, x, y, s, color, rnd) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  const branch = (bx, by, ang, len, w, depth) => {
    const ex = bx + Math.cos(ang) * len; const ey = by + Math.sin(ang) * len;
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.cos(ang + 0.3) * len * 0.5, by + Math.sin(ang + 0.3) * len * 0.5, ex, ey); ctx.stroke();
    if (depth > 0) {
      const n = 2 + (rnd() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) branch(ex, ey, ang + (rnd() - 0.5) * 1.3, len * (0.55 + rnd() * 0.2), w * 0.62, depth - 1);
    }
  };
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 10 * s, y); ctx.quadraticCurveTo(x - 4 * s, y - 20 * s, x - 3 * s, y - 40 * s); ctx.lineTo(x + 4 * s, y - 40 * s); ctx.quadraticCurveTo(x + 5 * s, y - 18 * s, x + 12 * s, y); ctx.fill();
  branch(x, y - 38 * s, -Math.PI / 2 + (rnd() - 0.5) * 0.4, 34 * s, 7 * s, 4);
}

export function willow(ctx, x, y, s, color, rnd) {
  ctx.fillStyle = shade(color, -0.35);
  ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.quadraticCurveTo(x - 2 * s, y - 40 * s, x - 10 * s, y - 70 * s); ctx.lineTo(x + 4 * s, y - 72 * s); ctx.quadraticCurveTo(x + 4 * s, y - 36 * s, x + 9 * s, y); ctx.fill();
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
    const sx = x - 3 * s + Math.cos(a) * 30 * s; const sy = y - 80 * s + Math.sin(a) * 18 * s;
    ctx.strokeStyle = i % 3 ? color : shade(color, 0.15); ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + (rnd() - 0.5) * 20 * s, sy + 30 * s, sx + (rnd() - 0.5) * 10 * s, sy + (40 + rnd() * 30) * s); ctx.stroke();
  }
}

export function rock(ctx, x, y, s, color, light) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 22 * s, y); ctx.lineTo(x - 16 * s, y - 14 * s); ctx.lineTo(x - 2 * s, y - 22 * s); ctx.lineTo(x + 14 * s, y - 15 * s); ctx.lineTo(x + 22 * s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(light, 0.22);
  ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 22 * s); ctx.lineTo(x + 14 * s, y - 15 * s); ctx.lineTo(x + 22 * s, y); ctx.lineTo(x + 6 * s, y - 4 * s); ctx.closePath(); ctx.fill();
}

function fence(ctx, x, y, s, color, len) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 3 * s;
  for (let i = 0; i <= len; i++) ctx.fillRect(x + i * 26 * s - 2 * s, y - 24 * s, 4 * s, 24 * s);
  ctx.beginPath(); ctx.moveTo(x, y - 18 * s); ctx.lineTo(x + len * 26 * s, y - 17 * s); ctx.moveTo(x, y - 9 * s); ctx.lineTo(x + len * 26 * s, y - 10 * s); ctx.stroke();
}

function haystack(ctx, x, y, s, c) {
  const g = ctx.createLinearGradient(x - 20 * s, y - 34 * s, x + 20 * s, y);
  g.addColorStop(0, shade(c.accent, 0.25)); g.addColorStop(1, shade(c.accent, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - 22 * s, y); ctx.quadraticCurveTo(x - 20 * s, y - 34 * s, x, y - 36 * s); ctx.quadraticCurveTo(x + 20 * s, y - 34 * s, x + 22 * s, y); ctx.fill();
  ctx.strokeStyle = rgba(shade(c.accent, -0.4), 0.5); ctx.lineWidth = 1 * s;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 5 * s, y - 30 * s); ctx.lineTo(x + i * 6 * s, y - 2 * s); ctx.stroke(); }
}

function windmill(ctx, x, y, s, color, light) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 12 * s, y); ctx.lineTo(x - 7 * s, y - 60 * s); ctx.lineTo(x + 7 * s, y - 60 * s); ctx.lineTo(x + 12 * s, y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 10 * s, y - 60 * s); ctx.lineTo(x, y - 72 * s); ctx.lineTo(x + 10 * s, y - 60 * s); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3 * s;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    ctx.beginPath(); ctx.moveTo(x, y - 62 * s); ctx.lineTo(x + Math.cos(a) * 40 * s, y - 62 * s + Math.sin(a) * 40 * s); ctx.stroke();
    ctx.fillStyle = rgba(light, 0.12);
    ctx.save(); ctx.translate(x, y - 62 * s); ctx.rotate(a); ctx.fillRect(12 * s, 0, 28 * s, 7 * s); ctx.restore();
  }
}

function column(ctx, x, y, s, c, broken, rnd) {
  const h = (broken ? 40 + rnd() * 50 : 110) * s;
  const g = ctx.createLinearGradient(x - 10 * s, 0, x + 10 * s, 0);
  g.addColorStop(0, shade(c.stone, -0.25)); g.addColorStop(0.55, shade(c.stone, 0.12)); g.addColorStop(1, shade(c.stone, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(x - 9 * s, y - h, 18 * s, h);
  ctx.fillStyle = shade(c.stone, -0.15);
  ctx.fillRect(x - 13 * s, y - 8 * s, 26 * s, 8 * s);
  ctx.strokeStyle = rgba(shade(c.stone, -0.5), 0.35); ctx.lineWidth = 1.2 * s;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 5 * s, y - h); ctx.lineTo(x + i * 5 * s, y - 8 * s); ctx.stroke(); }
  if (!broken) { ctx.fillStyle = shade(c.stone, 0.05); ctx.fillRect(x - 13 * s, y - h - 8 * s, 26 * s, 8 * s); }
  else {
    ctx.fillStyle = shade(c.stone, -0.1);
    ctx.beginPath(); ctx.moveTo(x - 9 * s, y - h); ctx.lineTo(x - 3 * s, y - h - 8 * s); ctx.lineTo(x + 2 * s, y - h - 2 * s); ctx.lineTo(x + 9 * s, y - h - 10 * s); ctx.lineTo(x + 9 * s, y - h); ctx.fill();
  }
}

function arch(ctx, x, y, s, c) {
  ctx.fillStyle = shade(c.stone, -0.2);
  ctx.beginPath();
  ctx.moveTo(x - 50 * s, y); ctx.lineTo(x - 50 * s, y - 90 * s); ctx.quadraticCurveTo(x, y - 150 * s, x + 50 * s, y - 90 * s); ctx.lineTo(x + 50 * s, y);
  ctx.lineTo(x + 32 * s, y); ctx.lineTo(x + 32 * s, y - 84 * s); ctx.quadraticCurveTo(x, y - 122 * s, x - 32 * s, y - 84 * s); ctx.lineTo(x - 32 * s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(c.light, 0.15);
  ctx.fillRect(x + 32 * s, y - 84 * s, 18 * s, 84 * s);
}

function gravestone(ctx, x, y, s, color, light) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - 9 * s, y); ctx.lineTo(x - 9 * s, y - 20 * s); ctx.arc(x, y - 20 * s, 9 * s, Math.PI, 0); ctx.lineTo(x + 9 * s, y); ctx.fill();
  ctx.fillStyle = rgba(light, 0.12); ctx.fillRect(x + 3 * s, y - 24 * s, 6 * s, 24 * s);
}

function lanternPost(ctx, x, y, s, color, glow) {
  ctx.fillStyle = color; ctx.fillRect(x - 2 * s, y - 70 * s, 4 * s, 70 * s);
  ctx.fillRect(x - 2 * s, y - 70 * s, 16 * s, 3 * s);
  const g = ctx.createRadialGradient(x + 13 * s, y - 58 * s, 1, x + 13 * s, y - 58 * s, 30 * s);
  g.addColorStop(0, rgba(glow, 0.9)); g.addColorStop(0.2, rgba(glow, 0.45)); g.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 13 * s, y - 58 * s, 30 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x + 9 * s, y - 66 * s, 8 * s, 12 * s);
  ctx.fillStyle = glow; ctx.fillRect(x + 10.5 * s, y - 64 * s, 5 * s, 8 * s);
}

function reeds(ctx, x, y, s, color, rnd) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const bx = x + (rnd() - 0.5) * 26 * s; const hgt = (30 + rnd() * 40) * s; const lean = (rnd() - 0.4) * 14 * s;
    ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + lean * 0.3, y - hgt * 0.6, bx + lean, y - hgt); ctx.stroke();
    if (rnd() < 0.4) { ctx.fillStyle = shade(color, -0.3); ctx.beginPath(); ctx.ellipse(bx + lean * 0.9, y - hgt * 0.92, 2.5 * s, 7 * s, lean / hgt, 0, Math.PI * 2); ctx.fill(); }
  }
}

function house(ctx, x, y, s, c, rnd) {
  const w = (60 + rnd() * 30) * s; const hh = (44 + rnd() * 16) * s;
  const wall = c.stone || mix(c.path, '#d9c8a8', 0.5);
  ctx.fillStyle = shade(wall, -0.1); ctx.fillRect(x - w / 2, y - hh, w, hh);
  ctx.fillStyle = rgba(c.light, 0.18); ctx.fillRect(x, y - hh, w / 2, hh);
  // timber frame
  ctx.strokeStyle = shade(wall, -0.55); ctx.lineWidth = 2.5 * s;
  ctx.strokeRect(x - w / 2, y - hh, w, hh);
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - hh * 0.5); ctx.lineTo(x + w / 2, y - hh * 0.5); ctx.stroke();
  // roof
  const roof = shade(c.midDark || c.mid, -0.15);
  ctx.fillStyle = roof;
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 8 * s, y - hh); ctx.lineTo(x, y - hh - 36 * s); ctx.lineTo(x + w / 2 + 8 * s, y - hh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(c.light, 0.12);
  ctx.beginPath(); ctx.moveTo(x, y - hh - 36 * s); ctx.lineTo(x + w / 2 + 8 * s, y - hh); ctx.lineTo(x, y - hh); ctx.closePath(); ctx.fill();
  // windows (warm light)
  for (const wx of [-w / 4, w / 4]) {
    const g = ctx.createRadialGradient(x + wx, y - hh * 0.72, 1, x + wx, y - hh * 0.72, 18 * s);
    g.addColorStop(0, 'rgba(255,214,140,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + wx, y - hh * 0.72, 18 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd38a'; ctx.fillRect(x + wx - 5 * s, y - hh * 0.8, 10 * s, 11 * s);
    ctx.fillStyle = shade(wall, -0.55); ctx.fillRect(x + wx - 0.8 * s, y - hh * 0.8, 1.6 * s, 11 * s);
  }
  ctx.fillStyle = shade(wall, -0.6); ctx.fillRect(x - 6 * s, y - 20 * s, 12 * s, 20 * s);
  // chimney
  ctx.fillStyle = shade(wall, -0.3); ctx.fillRect(x + w * 0.2, y - hh - 30 * s, 9 * s, 18 * s);
}

function obsidian(ctx, x, y, s, c, rnd) {
  ctx.fillStyle = c.near;
  const hgt = (60 + rnd() * 70) * s;
  ctx.beginPath(); ctx.moveTo(x - 16 * s, y); ctx.lineTo(x - 6 * s, y - hgt); ctx.lineTo(x + 3 * s, y - hgt * 0.8); ctx.lineTo(x + 14 * s, y); ctx.fill();
  ctx.strokeStyle = rgba(c.lava, 0.7); ctx.lineWidth = 1.5 * s;
  ctx.beginPath(); ctx.moveTo(x - 2 * s, y - hgt * 0.7); ctx.lineTo(x + 2 * s, y - hgt * 0.4); ctx.lineTo(x - 1 * s, y - hgt * 0.15); ctx.stroke();
}

function crystal(ctx, x, y, s, color, rnd) {
  for (let i = 0; i < 3; i++) {
    const cx = x + (i - 1) * 9 * s; const hgt = (26 + rnd() * 30) * s; const lean = (i - 1) * 0.25;
    ctx.save(); ctx.translate(cx, y); ctx.rotate(lean);
    const g = ctx.createLinearGradient(-6 * s, 0, 6 * s, 0);
    g.addColorStop(0, rgba(color, 0.5)); g.addColorStop(0.5, rgba('#ffffff', 0.8)); g.addColorStop(1, rgba(color, 0.4));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-6 * s, 0); ctx.lineTo(-5 * s, -hgt * 0.8); ctx.lineTo(0, -hgt); ctx.lineTo(5 * s, -hgt * 0.8); ctx.lineTo(6 * s, 0); ctx.fill();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(x, y - 20 * s, 1, x, y - 20 * s, 50 * s);
  g.addColorStop(0, rgba(color, 0.35)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 20 * s, 50 * s, 0, Math.PI * 2); ctx.fill();
}

function cairn(ctx, x, y, s, color, light) {
  const stones = [[0, 0, 16], [-2, -13, 13], [1, -24, 10], [0, -33, 7]];
  for (const [dx, dy, r] of stones) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s - r * 0.5 * s, r * s, r * 0.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(light, 0.18); ctx.beginPath(); ctx.ellipse(x + (dx + r * 0.3) * s, y + (dy - r * 0.2) * s - r * 0.5 * s, r * 0.5 * s, r * 0.3 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ------------------------------------------------------------------ layers
/**
 * Build the parallax layers of a theme for a viewport. Returns { layers, sky, theme }.
 * Each layer: { canvas, y, factor } drawn tiled at x = -(scroll * factor) mod width.
 */
export function buildBackdrop(themeId, W, H, opts = {}) {
  if (opts.lantern && LANTERN_THEMES[themeId]) return buildLanternBackdrop(themeId, W, H, opts);
  const c = THEMES[themeId] || THEMES.farmland;
  const seed = opts.seed || 1234;
  const SW = Math.max(1600, Math.ceil(W * 1.25 / 64) * 64);
  const u = H / 768;
  const layers = [];
  const mk = (y0, y1) => { const cv = document.createElement('canvas'); cv.width = SW; cv.height = Math.max(1, Math.ceil(y1 - y0)); return cv; };
  const gy = H * GROUND_Y;

  // sky (static, full screen) with sun/moon, stars, nebula
  const sky = document.createElement('canvas'); sky.width = Math.ceil(W); sky.height = Math.ceil(H);
  {
    const ctx = sky.getContext('2d');
    ctx.fillStyle = vgrad(ctx, 0, H * 0.72, c.sky); ctx.fillRect(0, 0, W, H);
    const rnd = prng(seed + 1);
    if (c.nebula) {
      for (let i = 0; i < 5; i++) {
        const x = rnd() * W; const y = rnd() * H * 0.5; const r = (120 + rnd() * 260) * u;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(['#4b3a8f', '#2a5a9a', '#7a3a8a'][i % 3], 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
    if (c.stars) for (let i = 0; i < c.stars; i++) {
      const x = rnd() * W; const y = rnd() * H * 0.6; const r = rnd() * 1.4 * u + 0.3;
      ctx.fillStyle = rgba('#ffffff', 0.3 + rnd() * 0.6); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const sx = c.sun.x * W; const sy = c.sun.y * H; const sr = c.sun.r * H;
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 9);
    glow.addColorStop(0, rgba(c.sun.glow, 0.55)); glow.addColorStop(0.25, rgba(c.sun.glow, 0.18)); glow.addColorStop(1, rgba(c.sun.glow, 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    if (c.sun.eclipse) {
      ctx.save();
      ctx.shadowColor = c.sun.glow; ctx.shadowBlur = 40 * u;
      ctx.strokeStyle = rgba(c.sun.glow, 0.95); ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = c.sun.color; ctx.beginPath(); ctx.arc(sx, sy, sr * 0.97, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = c.sun.color; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      if (c.sun.moon) {
        ctx.fillStyle = rgba('#b8bce0', 0.35);
        for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.4, 0.12]]) { ctx.beginPath(); ctx.arc(sx + dx * sr, sy + dy * sr, r * sr, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    // horizon haze
    const hz = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.75);
    hz.addColorStop(0, rgba(c.sky[2], 0)); hz.addColorStop(1, rgba(c.sky[2], 0.65));
    ctx.fillStyle = hz; ctx.fillRect(0, H * 0.4, W, H * 0.35);
  }

  // clouds (slow drift layer)
  {
    const y0 = 0; const y1 = H * 0.55; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 2);
    for (let i = 0; i < c.clouds; i++) {
      const x = rnd() * SW; const y = (0.1 + rnd() * 0.3) * H; const s = (0.38 + rnd() * 0.6) * u;
      wrap(SW, x, 200 * s, (xx) => cloud(ctx, xx, y, s, c, rnd));
    }
    layers.push({ canvas: cv, y: y0, factor: 0.04, drift: 6 * u });
  }

  // far range
  {
    const y0 = H * 0.25; const y1 = H * 0.66; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 3);
    const f = periodic(rnd, 5);
    const base = (H * 0.6) - y0; const amp = (themeId === 'highlands' || themeId === 'scorched' ? 0.27 : themeId === 'wetlands' ? 0.07 : 0.15) * H;
    const col = mix(c.far, c.sky[2], 0.25);
    if (themeId === 'highlands' || themeId === 'scorched') {
      // jagged peaks
      ctx.beginPath(); ctx.moveTo(0, y1 - y0);
      let x = 0; const pts = [];
      while (x <= SW) { pts.push([x, base - amp * (0.35 + 0.65 * Math.abs(f(x / SW))) - rnd() * amp * 0.25]); x += (40 + rnd() * 70) * u; }
      pts.push([SW, pts[0][1]]);
      for (const [px, py] of pts) ctx.lineTo(px, py);
      ctx.lineTo(SW, y1 - y0); ctx.closePath();
      ctx.fillStyle = vgrad(ctx, base - amp, y1 - y0, [shade(col, 0.08), col, mix(col, c.sky[2], 0.4)]); ctx.fill();
      // lit faces and snow/lava caps
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i]; const [bx, by] = pts[i + 1];
        if (ay < by) continue;
        const peakX = bx; const peakY = by;
        ctx.fillStyle = rgba(c.light, themeId === 'scorched' ? 0.05 : 0.16);
        ctx.beginPath(); ctx.moveTo(peakX, peakY); ctx.lineTo(peakX + (bx - ax) * 0.6, base + 20 * u); ctx.lineTo(peakX - (bx - ax) * 0.1, base + 20 * u); ctx.fill();
      }
      for (const [px, py] of pts) {
        if (py > base - amp * 0.55) continue;
        if (c.lava && rnd() > 0.22) continue;
        if (c.snow) { ctx.fillStyle = rgba(c.snow, 0.9); ctx.beginPath(); ctx.moveTo(px - 18 * u, py + 22 * u); ctx.lineTo(px, py); ctx.lineTo(px + 22 * u, py + 26 * u); ctx.lineTo(px + 6 * u, py + 18 * u); ctx.lineTo(px - 4 * u, py + 26 * u); ctx.fill(); }
        if (c.lava) {
          const sm = ctx.createLinearGradient(px, py - 140 * u, px, py);
          sm.addColorStop(0, rgba('#2a1410', 0)); sm.addColorStop(1, rgba('#3a1d15', 0.55));
          ctx.fillStyle = sm; ctx.beginPath(); ctx.moveTo(px - 8 * u, py); ctx.quadraticCurveTo(px - 30 * u, py - 80 * u, px - 10 * u, py - 140 * u); ctx.lineTo(px + 40 * u, py - 140 * u); ctx.quadraticCurveTo(px + 20 * u, py - 60 * u, px + 8 * u, py); ctx.fill();
          const g = ctx.createRadialGradient(px, py, 1, px, py, 24 * u);
          g.addColorStop(0, rgba(c.lava, 0.85)); g.addColorStop(1, rgba(c.lava, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 24 * u, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = rgba(c.lava, 0.55); ctx.lineWidth = 2 * u;
          ctx.beginPath(); ctx.moveTo(px, py + 2 * u); ctx.quadraticCurveTo(px + 6 * u, py + 30 * u, px + 2 * u, py + 60 * u); ctx.stroke();
        }
      }
    } else if (themeId === 'observatory') {
      silhouette(ctx, SW, base, amp * 0.5, f, y1 - y0);
      ctx.fillStyle = vgrad(ctx, base - amp, y1 - y0, [col, mix(col, c.sky[2], 0.3)]); ctx.fill();
      // ruined domes
      for (let i = 0; i < 3; i++) {
        const x = (i + 0.3 + rnd() * 0.4) * SW / 3; const r = (60 + rnd() * 50) * u; const by = base - amp * 0.3;
        wrap(SW, x, r, (xx) => dome(ctx, xx, by, r, col, c));
      }
    } else {
      silhouette(ctx, SW, base, amp, f, y1 - y0);
      ctx.fillStyle = vgrad(ctx, base - amp, y1 - y0, [shade(col, 0.05), mix(col, c.sky[2], 0.35)]); ctx.fill();
      if (themeId === 'haunted' || themeId === 'wetlands') {
        // distant tree line
        for (let x = 0; x < SW; x += 9 * u) {
          const y = base - amp * (0.5 + 0.5 * f(x / SW)) + 2;
          const hh = (8 + rnd() * 16) * u;
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 5 * u, y + 2); ctx.lineTo(x, y - hh); ctx.lineTo(x + 5 * u, y + 2); ctx.fill();
        }
      }
      if (themeId === 'ruins') {
        for (let i = 0; i < 3; i++) { const x = rnd() * SW; const y = base - amp * (0.5 + 0.5 * f(x / SW)); wrap(SW, x, 60 * u, (xx) => mesa(ctx, xx, y, u * (0.8 + rnd() * 0.6), col)); }
      }
    }
    layers.push({ canvas: cv, y: y0, factor: 0.08 });
  }

  // mid range
  {
    const y0 = H * 0.36; const y1 = H * 0.76; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 4);
    const f = periodic(rnd, 4);
    const base = H * 0.665 - y0; const amp = (themeId === 'wetlands' ? 0.04 : themeId === 'ruins' ? 0.09 : 0.11) * H;
    const col = mix(c.mid, c.sky[2], themeId === 'haunted' ? 0.12 : 0.22);
    silhouette(ctx, SW, base, amp, f, y1 - y0);
    ctx.save(); ctx.clip();
    ctx.fillStyle = vgrad(ctx, base - amp, y1 - y0, [shade(col, 0.1), col, shade(col, -0.12)]); ctx.fillRect(0, 0, SW, y1 - y0);
    if (themeId === 'farmland' || themeId === 'dusk') {
      // patchwork fields
      for (let i = 0; i < 22; i++) {
        const x = rnd() * SW; const y = base - amp * 0.4 + rnd() * amp * 0.9; const w = (60 + rnd() * 120) * u; const hh = (6 + rnd() * 12) * u;
        ctx.fillStyle = rgba([c.accent, shade(c.mid, 0.15), shade(c.mid, -0.1), '#c8b35c'][i % 4], 0.35);
        ctx.beginPath(); ctx.ellipse(x, y, w, hh, (rnd() - 0.5) * 0.15, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (c.heather) for (let i = 0; i < 26; i++) { ctx.fillStyle = rgba(c.heather, 0.35); ctx.beginPath(); ctx.ellipse(rnd() * SW, base - amp * 0.3 + rnd() * amp, (30 + rnd() * 60) * u, (5 + rnd() * 6) * u, 0, 0, Math.PI * 2); ctx.fill(); }
    brush(ctx, rnd, 0, base - amp, SW, amp + 80 * u, [shade(col, 0.2), shade(col, -0.2)], 500, 16 * u, 0.12, 2 * u);
    ctx.restore();
    // rim light on the ridge
    ctx.save(); ctx.strokeStyle = rgba(c.light, themeId === 'haunted' || themeId === 'observatory' ? 0.12 : 0.25); ctx.lineWidth = 2 * u;
    ctx.beginPath(); for (let x = 0; x <= SW; x += 6) { const y = base - amp * (0.5 + 0.5 * f(x / SW)); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); ctx.restore();
    // mid props
    const treeCol = mix(c.midDark, c.sky[2], 0.15);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * SW; const y = base - amp * (0.5 + 0.5 * f(x / SW)) + 6 * u + rnd() * 10 * u; const s = (0.32 + rnd() * 0.28) * u;
      wrap(SW, x, 60 * s, (xx) => {
        if (themeId === 'farmland' || themeId === 'dusk') { if (i % 9 === 0) windmill(ctx, xx, y, s * 1.4, shade(treeCol, -0.1), c.light); else oak(ctx, xx, y, s, { near: treeCol, leaf: treeCol, light: c.light }, rnd); }
        else if (themeId === 'wetlands') { if (i % 3) willow(ctx, xx, y, s, treeCol, rnd); else deadTree(ctx, xx, y, s, shade(treeCol, -0.2), rnd); }
        else if (themeId === 'highlands') { if (i % 5 === 0) cairn(ctx, xx, y, s * 1.4, shade(treeCol, 0.05), c.light); else pine(ctx, xx, y, s * 1.1, treeCol, rnd, null); }
        else if (themeId === 'ruins') { if (i % 4 === 0) arch(ctx, xx, y, s * 1.1, { stone: mix(c.stone, c.sky[2], 0.35), light: c.light }); else if (i % 2) column(ctx, xx, y, s * 1.2, { stone: mix(c.stone, c.sky[2], 0.3) }, rnd() < 0.6, rnd); }
        else if (themeId === 'haunted') deadTree(ctx, xx, y, s * 1.3, treeCol, rnd);
        else if (themeId === 'scorched') obsidian(ctx, xx, y, s * 1.2, { near: treeCol, lava: c.lava }, rnd);
        else if (themeId === 'observatory') { if (i % 3 === 0) column(ctx, xx, y, s * 1.3, { stone: mix(c.stone, c.sky[2], 0.2) }, rnd() < 0.5, rnd); else crystal(ctx, xx, y, s, c.accent, rnd); }
      });
    }
    if (c.water) { // reflective pools
      for (let i = 0; i < 6; i++) {
        const x = rnd() * SW; const w = (80 + rnd() * 160) * u; const y = base + 12 * u + rnd() * 30 * u;
        wrap(SW, x, w, (xx) => { ctx.fillStyle = rgba(mix(c.water, c.sky[1], 0.4), 0.8); ctx.beginPath(); ctx.ellipse(xx, y, w, 6 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx - w * 0.5, y - 1); ctx.lineTo(xx + w * 0.3, y - 1); ctx.stroke(); });
      }
    }
    if (c.lava) { // lava rivers
      for (let i = 0; i < 4; i++) {
        const x = rnd() * SW; const w = (90 + rnd() * 140) * u; const y = base + 20 * u + rnd() * 30 * u;
        wrap(SW, x, w, (xx) => {
          const g = ctx.createRadialGradient(xx, y, 1, xx, y, w);
          g.addColorStop(0, rgba(c.lava, 0.9)); g.addColorStop(0.3, rgba(c.lava, 0.45)); g.addColorStop(1, rgba(c.lava, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(xx, y, w, 10 * u, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgba('#ffd27a', 0.8); ctx.beginPath(); ctx.ellipse(xx, y, w * 0.5, 2.5 * u, 0, 0, Math.PI * 2); ctx.fill();
        });
      }
    }
    // atmospheric fog band
    const fg = ctx.createLinearGradient(0, base - amp * 0.2, 0, y1 - y0);
    fg.addColorStop(0, rgba(c.fog, 0)); fg.addColorStop(1, rgba(c.fog, c.fogA));
    ctx.fillStyle = fg; ctx.fillRect(0, 0, SW, y1 - y0);
    layers.push({ canvas: cv, y: y0, factor: 0.22 });
  }

  // near layer: trees and props behind the road
  {
    const y0 = H * 0.18; const y1 = H * 0.8; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 5);
    const by = H * 0.735 - y0;
    // a low bank behind the road
    const f = periodic(rnd, 3);
    silhouette(ctx, SW, by + 4 * u, 18 * u, f, y1 - y0);
    ctx.fillStyle = vgrad(ctx, by - 20 * u, y1 - y0, [shade(c.near, 0.12), c.near]); ctx.fill();
    const props = Math.round(SW / (190 * u));
    const near = { near: c.near, leaf: shade(c.near, 0.08), light: c.light, accent: c.accent, stone: c.stone || '#9a9080' };
    for (let i = 0; i < props; i++) {
      const x = (i + 0.2 + rnd() * 0.6) * (SW / props); const s = (0.85 + rnd() * 0.5) * u; const y = by + 8 * u * rnd();
      const kind = rnd();
      wrap(SW, x, 140 * s, (xx) => {
        if (opts.hub && i % 3 === 0) { house(ctx, xx, y + 4 * u, s * 1.1, { ...c, stone: c.stone }, prng(seed + i)); return; }
        switch (themeId) {
          case 'dusk':
          case 'farmland': if (kind < 0.45) oak(ctx, xx, y, s * 1.2, near, rnd); else if (kind < 0.7) haystack(ctx, xx, y, s, c); else fence(ctx, xx - 40 * s, y, s, shade(c.path, -0.45), 3); break;
          case 'wetlands': if (kind < 0.5) willow(ctx, xx, y, s * 1.3, shade(c.near, 0.1), rnd); else if (kind < 0.8) reeds(ctx, xx, y, s * 1.4, shade(c.near, 0.25), rnd); else deadTree(ctx, xx, y, s, shade(c.near, -0.1), rnd); break;
          case 'highlands': if (kind < 0.55) pine(ctx, xx, y, s * 1.4, shade(c.near, -0.05), rnd, rnd() < 0.3 ? c.snow : null); else if (kind < 0.8) rock(ctx, xx, y, s * 1.6, mix(c.near, '#8a948f', 0.5), c.light); else cairn(ctx, xx, y, s * 1.3, '#8a8f88', c.light); break;
          case 'ruins': if (kind < 0.45) column(ctx, xx, y, s * 1.3, near, rnd() < 0.7, rnd); else if (kind < 0.65) arch(ctx, xx, y, s * 1.2, { stone: c.stone, light: c.light }); else rock(ctx, xx, y, s * 1.5, shade(c.stone, -0.2), c.light); break;
          case 'haunted': if (kind < 0.5) deadTree(ctx, xx, y, s * 1.8, shade(c.near, 0.12), rnd); else if (kind < 0.8) gravestone(ctx, xx, y, s * 1.3, shade(c.near, 0.3), c.light); else lanternPost(ctx, xx, y, s * 1.1, shade(c.near, 0.2), c.accent); break;
          case 'scorched': if (kind < 0.55) obsidian(ctx, xx, y, s * 1.5, c, rnd); else if (kind < 0.8) deadTree(ctx, xx, y, s * 1.3, '#1a0f0c', rnd); else rock(ctx, xx, y, s * 1.6, '#2a1a15', c.lava); break;
          case 'observatory': if (kind < 0.4) column(ctx, xx, y, s * 1.5, { stone: c.stone }, rnd() < 0.6, rnd); else crystal(ctx, xx, y, s * 1.2, c.accent, rnd); break;
          default: break;
        }
      });
    }
    layers.push({ canvas: cv, y: y0, factor: 0.55 });
  }

  // ground: road and grass (moves with the character)
  {
    const y0 = H * 0.7; const y1 = H; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 6);
    const hgt = y1 - y0;
    ctx.fillStyle = vgrad(ctx, 0, hgt, [shade(c.ground, 0.05), c.ground, shade(c.ground, -0.35)]); ctx.fillRect(0, 0, SW, hgt);
    brush(ctx, rnd, 0, 0, SW, hgt, [shade(c.ground, 0.25), shade(c.ground, -0.25)], 1600, 10 * u, 0.2, 1.6 * u);
    // road band with soft edges
    const ry = gy - y0 - 14 * u; const rh = 40 * u;
    const road = ctx.createLinearGradient(0, ry - rh * 0.5, 0, ry + rh * 1.5);
    road.addColorStop(0, rgba(c.path, 0)); road.addColorStop(0.25, c.path); road.addColorStop(0.75, c.pathDark); road.addColorStop(1, rgba(c.pathDark, 0));
    ctx.fillStyle = road; ctx.fillRect(0, ry - rh * 0.5, SW, rh * 2);
    brush(ctx, rnd, 0, ry, SW, rh, [shade(c.path, 0.2), shade(c.pathDark, -0.2)], 900, 18 * u, 0.22, 1.4 * u);
    for (let i = 0; i < 60; i++) { const x = rnd() * SW; const y = ry + rnd() * rh; ctx.fillStyle = rgba(shade(c.pathDark, -0.3), 0.5); ctx.beginPath(); ctx.ellipse(x, y, (2 + rnd() * 4) * u, (1 + rnd() * 2) * u, 0, 0, Math.PI * 2); ctx.fill(); }
    if (c.lava) for (let i = 0; i < 20; i++) { const x = rnd() * SW; const y = ry + rh + rnd() * (hgt - ry - rh); ctx.strokeStyle = rgba(c.lava, 0.6); ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12 * u, y + 4 * u); ctx.lineTo(x + 20 * u, y + 2 * u); ctx.stroke(); }
    if (c.water) for (let i = 0; i < 14; i++) { const x = rnd() * SW; const y = ry + rh * (0.2 + rnd() * 0.7); const w = (14 + rnd() * 30) * u; ctx.fillStyle = rgba(mix(c.water, c.sky[1], 0.5), 0.7); ctx.beginPath(); ctx.ellipse(x, y, w, 3 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    // grass tufts and flowers along the edges
    for (let i = 0; i < SW / (7 * u); i++) {
      const x = rnd() * SW; const top = rnd() < 0.5;
      const y = top ? ry - rh * 0.3 + rnd() * 10 * u : ry + rh * 1.05 + rnd() * (hgt - ry - rh) * 0.9;
      ctx.strokeStyle = rgba(rnd() < 0.5 ? shade(c.ground, 0.3) : shade(c.ground, -0.2), 0.8);
      ctx.lineWidth = 1.2 * u;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * 2 * u, y); ctx.lineTo(x + k * 2 * u + (rnd() - 0.5) * 6 * u, y - (5 + rnd() * 8) * u); ctx.stroke(); }
      if ((themeId === 'farmland' || themeId === 'highlands') && rnd() < 0.08) { ctx.fillStyle = themeId === 'highlands' ? c.heather : ['#fff6d0', '#ffd34d', '#f08ab0'][Math.floor(rnd() * 3)]; ctx.beginPath(); ctx.arc(x, y - 8 * u, 1.8 * u, 0, Math.PI * 2); ctx.fill(); }
    }
    layers.push({ canvas: cv, y: y0, factor: 1 });
  }

  // foreground: dark blurred shapes passing fast
  {
    const y0 = H * 0.82; const y1 = H; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 7);
    const hgt = y1 - y0;
    for (let i = 0; i < 7; i++) {
      const x = rnd() * SW; const s = (0.9 + rnd() * 0.8) * u;
      wrap(SW, x, 120 * s, (xx) => {
        ctx.fillStyle = rgba(shade(c.near, -0.5), 0.9);
        if (themeId === 'ruins' || themeId === 'observatory' || themeId === 'scorched' || themeId === 'highlands') { ctx.beginPath(); ctx.ellipse(xx, hgt + 10 * s, 70 * s, 40 * s, 0, Math.PI, 0); ctx.fill(); }
        else { ctx.strokeStyle = rgba(shade(c.near, -0.45), 0.95); ctx.lineCap = 'round'; for (let k = 0; k < 14; k++) { ctx.lineWidth = (3 + rnd() * 3) * s; ctx.beginPath(); const bx = xx + (k - 7) * 6 * s; ctx.moveTo(bx, hgt + 4); ctx.quadraticCurveTo(bx + (rnd() - 0.5) * 30 * s, hgt - 40 * s, bx + (rnd() - 0.3) * 40 * s, hgt - (50 + rnd() * 60) * s); ctx.stroke(); } }
      });
    }
    layers.push({ canvas: cv, y: y0, factor: 1.6, foreground: true });
  }

  return { theme: c, themeId, sky, layers, W, H, SW };
}

function cloud(ctx, x, y, s, c, rnd) {
  // painted on its own canvas so the underside can be shaded and flattened
  const w = Math.ceil(420 * s); const hh = Math.ceil(170 * s);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  const g2 = cv.getContext('2d');
  const n = 6 + Math.floor(rnd() * 6);
  const base = hh * 0.72; const span = w * (0.55 + rnd() * 0.25);
  g2.fillStyle = c.cloud;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const cx = w / 2 + (f - 0.5) * span + (rnd() - 0.5) * 20 * s;
    const r = (18 + Math.sin(f * Math.PI) * (26 + rnd() * 34)) * s;
    const cy = base - Math.sin(f * Math.PI) * 22 * s - r * 0.35 + rnd() * 6 * s;
    g2.beginPath(); g2.arc(cx, cy, r, 0, Math.PI * 2); g2.fill();
  }
  g2.beginPath(); g2.ellipse(w / 2, base, span * 0.55, 14 * s, 0, 0, Math.PI * 2); g2.fill();
  g2.globalCompositeOperation = 'destination-out';
  g2.fillRect(0, base + 8 * s, w, hh);
  g2.globalCompositeOperation = 'source-atop';
  const sh = g2.createLinearGradient(0, base - 70 * s, 0, base + 8 * s);
  sh.addColorStop(0, rgba(c.cloud, 0)); sh.addColorStop(1, rgba(c.cloudShade, 0.85));
  g2.fillStyle = sh; g2.fillRect(0, 0, w, hh);
  const hi = g2.createRadialGradient(w * 0.62, base - 80 * s, 4, w * 0.62, base - 80 * s, 120 * s);
  hi.addColorStop(0, rgba('#ffffff', 0.35)); hi.addColorStop(1, rgba('#ffffff', 0));
  g2.fillStyle = hi; g2.fillRect(0, 0, w, hh);
  ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(cv, x - w / 2, y - base); ctx.restore();
}

function mesa(ctx, x, y, s, col) {
  ctx.fillStyle = shade(col, -0.04);
  ctx.beginPath(); ctx.moveTo(x - 80 * s, y + 4); ctx.lineTo(x - 55 * s, y - 50 * s); ctx.lineTo(x + 45 * s, y - 54 * s); ctx.lineTo(x + 70 * s, y + 4); ctx.fill();
}

function dome(ctx, x, y, r, col, c) {
  ctx.fillStyle = shade(col, 0.05);
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.lineTo(x + r, y + 6); ctx.lineTo(x - r, y + 6); ctx.fill();
  ctx.strokeStyle = rgba(c.accent, 0.25); ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.arc(x, y, r * (i / 5), Math.PI, 0); ctx.stroke(); }
  ctx.fillStyle = rgba(c.sky[1], 0.9);
  ctx.beginPath(); ctx.moveTo(x + r * 0.1, y - r); ctx.lineTo(x + r * 0.45, y - r * 0.55); ctx.lineTo(x + r * 0.2, y - r * 0.4); ctx.lineTo(x + r * 0.35, y - r * 0.1); ctx.lineTo(x - r * 0.05, y - r * 0.6); ctx.closePath(); ctx.fill();
}

/** Paint a backdrop into ctx at a given scroll position (CSS pixels). */
export function drawBackdrop(ctx, bd, scroll, time, alpha = 1, skipForeground = false) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(bd.sky, 0, 0, bd.W, bd.H);
  for (const L of bd.layers) {
    if (L.foreground && skipForeground) continue;
    const off = ((scroll * L.factor + (L.drift ? time * L.drift : 0)) % bd.SW + bd.SW) % bd.SW;
    const x = -off;
    ctx.drawImage(L.canvas, x, L.y);
    if (x + bd.SW < bd.W) ctx.drawImage(L.canvas, x + bd.SW, L.y);
  }
  ctx.restore();
}

export function drawForeground(ctx, bd, scroll, alpha = 1) {
  const L = bd.layers.find((l) => l.foreground);
  if (!L) return;
  ctx.save(); ctx.globalAlpha = alpha;
  const off = ((scroll * L.factor) % bd.SW + bd.SW) % bd.SW;
  ctx.drawImage(L.canvas, -off, L.y);
  if (-off + bd.SW < bd.W) ctx.drawImage(L.canvas, -off + bd.SW, L.y);
  ctx.restore();
}

export const themeForZone = (zone) => (zone ? zone.theme || ['farmland', 'wetlands', 'highlands', 'ruins', 'haunted', 'scorched', 'observatory'][clamp((zone.idx || 1) - 1, 0, 6)] : 'farmland');

// ================================================================== Lantern Gouache (proof slice, draft)
// docs/art/README.md direction A; docs/art/proof-slice-2026-11-25.md; D120, D121. Built only when scene.js asks with
// opts.lantern (data-art="lantern" on <html>); without it nothing below runs and buildBackdrop is as before.
// Opaque gouache at a low sun: hand-cut shapes (jittered outlines, no ink lines), a limited earthy palette, one warm key
// light low on the horizon (key.x: where it stands, in viewport widths) against cool distance, a mist band between depth
// layers, visible brush strokes. The proof slice paints zone 1 (farmland, Amberfold Downs), zone 2 (wetlands, Greywater
// Fens) and the camp at dusk; every other theme keeps the current backdrop. Same layer structure as buildBackdrop, so the
// scene scrolls and fades it as before; built once per theme and size (no cost per frame).
// Palette: dusk slate #27313b, fen green #5d7a5a, moss #8a9a5b, ochre #d9a441, lantern #f2c56b, paper #f1e3c0, umber #3d2c20,
// ink #2b2118, water #4f8a8b. Madder red is danger's alone (D120) and is not used here.
export const LANTERN_THEMES = {
  farmland: {
    sky: ['#5d7489', '#9fb0a7', '#efd9a8'], sun: { x: 0.86, y: 0.55, r: 0.07, color: '#fbe8b8', glow: '#f2c56b' },
    cloud: '#e9dcc0', cloudLit: '#f8ecd0', cloudShade: '#a7a69a', clouds: 5,
    far: '#8497a0', mid: '#8a9a5b', midDark: '#5d7a5a', near: '#4a6446', ground: '#7f8c4c', groundDark: '#5c6a38', path: '#bf9a62', pathDark: '#8c6a3e',
    leaf: '#6f8a4e', trunk: '#3d2c20', accent: '#d9a441', light: '#f2c56b', fog: '#f1e3c0', fogA: 0.3, mist: '#efe0bc', ink: '#2b2118',
    particles: 'pollen', grade: 'rgba(242,197,107,0.06)', ui: { tint: '#d9a441' },
    key: { x: 0.86, lit: '#f6d48a', shade: '#3a2638' },
  },
  wetlands: {
    sky: ['#4c5f68', '#8a9e98', '#d8d3b6'], sun: { x: 0.12, y: 0.56, r: 0.075, color: '#f3e7c2', glow: '#e2cf96' },
    cloud: '#c9cbbb', cloudLit: '#e8e4cc', cloudShade: '#7f8c88', clouds: 6,
    far: '#6f8580', mid: '#5d7a5a', midDark: '#435e4c', near: '#33493d', ground: '#536a49', groundDark: '#3b4d35', path: '#76684c', pathDark: '#4f4532',
    leaf: '#5f7d58', trunk: '#2f2a22', water: '#4f8a8b', accent: '#a9c49a', light: '#efd9a0', fog: '#d9dcc8', fogA: 0.42, mist: '#dfe1cf', ink: '#2b2118',
    particles: 'motes', grade: 'rgba(120,150,140,0.06)', ui: { tint: '#7fae96' },
    key: { x: 0.12, lit: '#efdca6', shade: '#2e2a3c' },
  },
  dusk: { // the start camp and class select: farmland after sunset, the fire is the key light
    sky: ['#232c38', '#4f4458', '#c7814c'], sun: { x: 0.8, y: 0.66, r: 0.05, color: '#f6c47a', glow: '#d98e4f', set: true },
    cloud: '#5a4c5c', cloudLit: '#c98a64', cloudShade: '#2e2a38', clouds: 5, stars: 46,
    far: '#4e4a5c', mid: '#46503c', midDark: '#323a2c', near: '#262c22', ground: '#3d3a26', groundDark: '#2a281b', path: '#6e5236', pathDark: '#4a3622',
    leaf: '#3c4a32', trunk: '#1f1812', accent: '#d9a441', light: '#f2c56b', fog: '#8a6a6a', fogA: 0.26, mist: '#6e5a66', ink: '#1c1612',
    particles: 'pollen', grade: 'rgba(217,142,79,0.05)', ui: { tint: '#d9a441' },
    key: { x: 0.635, lit: '#f6c47a', shade: '#241a2c', fire: true },
  },
};

/** A hand-cut closed outline round (x, y): an ellipse whose radius wobbles a little (no ink line, gouache edge). */
function cutBlob(ctx, x, y, rx, ry, rnd, jit = 0.12, n = 11, rot = 0) {
  const r0 = []; for (let i = 0; i < n; i++) r0.push(1 + (rnd() - 0.5) * 2 * jit);
  ctx.moveTo(x + Math.cos(rot) * rx * r0[0], y + Math.sin(rot) * ry * r0[0]);
  for (let i = 1; i <= n; i++) {
    const a0 = rot + ((i - 0.5) / n) * Math.PI * 2; const a1 = rot + (i / n) * Math.PI * 2; const k = r0[i % n]; const km = (r0[i - 1] + k) / 2 * 1.04;
    ctx.quadraticCurveTo(x + Math.cos(a0) * rx * km, y + Math.sin(a0) * ry * km, x + Math.cos(a1) * rx * k, y + Math.sin(a1) * ry * k);
  }
  ctx.closePath();
}

/** Short opaque brush strokes along a ridge line (pts), on its lit side: the dry-brush edge of a painted hill. */
function dryRidge(ctx, pts, color, rnd, w, alpha, every = 3) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i += every) {
    const [x, y] = pts[i]; const [x2, y2] = pts[Math.min(pts.length - 1, i + every)];
    ctx.strokeStyle = rgba(color, alpha * (0.55 + rnd() * 0.6)); ctx.lineWidth = w * (0.5 + rnd());
    const dy = 1.5 + rnd() * w * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y + dy); ctx.lineTo(x2 + (rnd() - 0.5) * 4, y2 + dy + (rnd() - 0.5) * 2); ctx.stroke();
  }
  ctx.restore();
}

/** Gouache strokes clipped to the current clip: longer, more opaque and fewer than brush(). */
function strokes(ctx, rnd, x0, y0, w, hgt, colors, count, len, alpha, width, tilt = 0.25) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd() * w; const y = y0 + rnd() * hgt; const a = (rnd() - 0.5) * tilt; const l = len * (0.5 + rnd());
    ctx.strokeStyle = rgba(colors[Math.floor(rnd() * colors.length)], alpha * (0.5 + rnd() * 0.8)); ctx.lineWidth = width * (0.6 + rnd() * 0.8);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * width, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
}

/** A soft paper-coloured mist band from y0 (clear) down to y1 (alpha a). */
function mistBand(ctx, SW, y0, y1, color, a) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.7, rgba(color, a * 0.8)); g.addColorStop(1, rgba(color, a));
  ctx.fillStyle = g; ctx.fillRect(0, y0, SW, y1 - y0);
}

/** A painted tree: canopy of hand-cut blobs in the shade value, a smaller lit mass toward the key light, a few dabs. */
function oakL(ctx, x, y, s, c, rnd, side) {
  ctx.fillStyle = c.trunk;
  ctx.beginPath(); ctx.moveTo(x - 5 * s, y); ctx.quadraticCurveTo(x - 2 * s, y - 28 * s, x - 3 * s, y - 50 * s); ctx.lineTo(x + 4 * s, y - 50 * s); ctx.quadraticCurveTo(x + 2 * s, y - 26 * s, x + 6 * s, y); ctx.fill();
  const blobs = []; const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd() * 0.6; blobs.push([x + Math.cos(a) * 20 * s, y - 72 * s + Math.sin(a) * 13 * s, (20 + rnd() * 10) * s]); }
  blobs.push([x, y - 78 * s, 26 * s]);
  ctx.beginPath(); for (const [bx, by, r] of blobs) cutBlob(ctx, bx, by, r, r * 0.86, rnd, 0.1, 9);
  ctx.fillStyle = shade(c.leaf, -0.22); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.beginPath(); for (const [bx, by, r] of blobs) cutBlob(ctx, bx + side * r * 0.32, by - r * 0.28, r * 0.78, r * 0.66, rnd, 0.14, 9);
  ctx.fillStyle = c.leaf; ctx.fill();
  for (let i = 0; i < 4; i++) { const [bx, by, r] = blobs[Math.floor(rnd() * blobs.length)]; ctx.beginPath(); cutBlob(ctx, bx + side * r * (0.35 + rnd() * 0.3), by - r * (0.35 + rnd() * 0.3), r * 0.34, r * 0.14, rnd, 0.25, 7, -side * 0.35); ctx.fillStyle = rgba(mix(c.leaf, c.light, 0.35), 0.6); ctx.fill(); }
  ctx.restore();
}

/** A fen willow: a low dome of fen green with long hanging strands, lit on the key side. */
function willowL(ctx, x, y, s, c, rnd, side) {
  ctx.fillStyle = c.trunk;
  ctx.beginPath(); ctx.moveTo(x - 6 * s, y); ctx.quadraticCurveTo(x - 1 * s, y - 34 * s, x - 7 * s, y - 62 * s); ctx.lineTo(x + 5 * s, y - 62 * s); ctx.quadraticCurveTo(x + 3 * s, y - 30 * s, x + 8 * s, y); ctx.fill();
  const w = (38 + rnd() * 14) * s; const top = y - (92 + rnd() * 16) * s; const hem = y - (14 + rnd() * 10) * s;
  ctx.beginPath(); cutBlob(ctx, x, top + 22 * s, w, 26 * s, rnd, 0.08, 10);
  ctx.fillStyle = shade(c.leaf, -0.18); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const sx = x - w + (i + 0.5) * (2 * w / 22); const len = (hem - top) * (0.55 + rnd() * 0.45) * (1 - Math.abs(sx - x) / (w * 1.6));
    const lit = (sx - x) * side > w * 0.15;
    ctx.strokeStyle = lit ? mix(c.leaf, c.light, 0.18) : i % 2 ? shade(c.leaf, -0.2) : shade(c.leaf, -0.32);
    ctx.lineWidth = (4 + rnd() * 3) * s;
    ctx.beginPath(); ctx.moveTo(sx, top + 26 * s); ctx.quadraticCurveTo(sx + (rnd() - 0.5) * 4 * s, top + 26 * s + len * 0.6, sx + (rnd() - 0.5) * 6 * s, top + 26 * s + len); ctx.stroke();
  }
  ctx.beginPath(); cutBlob(ctx, x + side * w * 0.3, top + 14 * s, w * 0.55, 13 * s, rnd, 0.12, 9);
  ctx.fillStyle = rgba(mix(c.leaf, c.light, 0.35), 0.8); ctx.fill();
}

/** A reed-thatched hut on stilts over the fen (Greywater Fens), with one warm window. */
function stiltHut(ctx, x, y, s, c, rnd) {
  ctx.strokeStyle = c.trunk; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  for (const dx of [-16, -5, 6, 17]) { ctx.beginPath(); ctx.moveTo(x + dx * s, y + 4 * s); ctx.lineTo(x + dx * s * 0.9, y - 26 * s); ctx.stroke(); }
  ctx.fillStyle = shade(c.path, -0.25); ctx.fillRect(x - 24 * s, y - 30 * s, 48 * s, 5 * s);
  ctx.fillStyle = mix(c.path, '#8a7550', 0.4); ctx.fillRect(x - 18 * s, y - 52 * s, 36 * s, 22 * s);
  ctx.fillStyle = '#f2c56b'; ctx.fillRect(x + 2 * s, y - 46 * s, 7 * s, 8 * s);
  ctx.fillStyle = mix(c.accent, '#b8a46a', 0.5);
  ctx.beginPath(); ctx.moveTo(x - 27 * s, y - 50 * s); ctx.quadraticCurveTo(x - 6 * s, y - 80 * s, x + 2 * s, y - 84 * s); ctx.quadraticCurveTo(x + 10 * s, y - 78 * s, x + 28 * s, y - 50 * s); ctx.closePath(); ctx.fill();
  strokes(ctx, rnd, x - 22 * s, y - 78 * s, 44 * s, 26 * s, [shade(c.accent, -0.35)], 10, 10 * s, 0.35, 1.4 * s, 1.4);
  ctx.fillStyle = rgba(c.water || '#4f8a8b', 0.6); ctx.fillRect(x - 30 * s, y + 3 * s, 60 * s, 2.5 * s);
}

/** A hub cottage: limewashed wall in two values, a thatch or reed roof lit on the key side, two warm windows. */
function cottageL(ctx, x, y, s, c, rnd, side) {
  const w = (62 + rnd() * 26) * s; const hh = (40 + rnd() * 14) * s;
  const wall = mix(c.fog, c.path, 0.35);
  ctx.fillStyle = shade(wall, -0.12); ctx.fillRect(x - w / 2, y - hh, w, hh);
  ctx.fillStyle = shade(wall, 0.06); ctx.fillRect(side > 0 ? x : x - w / 2, y - hh, w / 2, hh);
  ctx.fillStyle = c.trunk; ctx.fillRect(x - w / 2, y - hh, w, 3 * s); ctx.fillRect(x - w / 2, y - 3 * s, w, 3 * s);
  for (const fx of [-0.5, 0, 0.5]) ctx.fillRect(x + fx * w - 1.5 * s - (fx > 0 ? 1.5 * s : 0), y - hh, 3 * s, hh);
  ctx.fillStyle = shade(c.accent, -0.3);
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 9 * s, y - hh + 2 * s); ctx.quadraticCurveTo(x - w * 0.2, y - hh - 30 * s, x, y - hh - 38 * s); ctx.quadraticCurveTo(x + w * 0.2, y - hh - 30 * s, x + w / 2 + 9 * s, y - hh + 2 * s); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip(); ctx.beginPath(); cutBlob(ctx, x + side * w * 0.28, y - hh - 16 * s, w * 0.42, 22 * s, rnd, 0.1, 9); ctx.fillStyle = mix(c.accent, c.light, 0.25); ctx.fill();
  strokes(ctx, rnd, x - w / 2 - 9 * s, y - hh - 38 * s, w + 18 * s, 40 * s, [shade(c.accent, -0.45)], 18, 12 * s, 0.35, 1.3 * s, 2.2); ctx.restore();
  for (const wx of [-w / 4, w / 4]) { ctx.fillStyle = '#f2c56b'; ctx.fillRect(x + wx - 5 * s, y - hh * 0.72, 10 * s, 10 * s); ctx.fillStyle = c.trunk; ctx.fillRect(x + wx - 0.8 * s, y - hh * 0.72, 1.6 * s, 10 * s); }
  ctx.fillStyle = c.trunk; ctx.fillRect(x - 6 * s, y - 19 * s, 12 * s, 19 * s);
}

/** The camp's bell frame: a timber A-frame, a crossbeam, a bronze bell lit on its fire side, a pull rope. */
function bellFrame(ctx, x, y, s, c) {
  ctx.strokeStyle = c.trunk; ctx.lineCap = 'round'; ctx.lineWidth = 6 * s;
  for (const dx of [-38, 38]) { ctx.beginPath(); ctx.moveTo(x + dx * s, y); ctx.lineTo(x + dx * 0.55 * s, y - 112 * s); ctx.stroke(); }
  ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(x - 32 * s, y - 108 * s); ctx.lineTo(x + 32 * s, y - 108 * s); ctx.stroke();
  ctx.strokeStyle = rgba(c.light, 0.45); ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(x - 30 * s, y - 111 * s); ctx.lineTo(x + 30 * s, y - 111 * s); ctx.stroke();
  ctx.fillStyle = '#6e4a24';
  ctx.beginPath(); ctx.moveTo(x - 6 * s, y - 104 * s); ctx.quadraticCurveTo(x - 20 * s, y - 92 * s, x - 22 * s, y - 64 * s); ctx.lineTo(x + 22 * s, y - 64 * s); ctx.quadraticCurveTo(x + 20 * s, y - 92 * s, x + 6 * s, y - 104 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(242,197,107,0.55)'; ctx.beginPath(); ctx.moveTo(x + 4 * s, y - 102 * s); ctx.quadraticCurveTo(x + 17 * s, y - 90 * s, x + 19 * s, y - 66 * s); ctx.lineTo(x + 10 * s, y - 66 * s); ctx.quadraticCurveTo(x + 10 * s, y - 88 * s, x + 2 * s, y - 100 * s); ctx.fill();
  ctx.fillStyle = '#4a3018'; ctx.fillRect(x - 24 * s, y - 66 * s, 48 * s, 4 * s);
  ctx.strokeStyle = '#a8945c'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(x, y - 62 * s); ctx.quadraticCurveTo(x + 4 * s, y - 40 * s, x + 2 * s, y - 22 * s); ctx.stroke();
}
/** A post with a hanging lantern: a warm pane and a small halo (the camp's second light). */
function lampPost(ctx, x, y, s, c) {
  ctx.fillStyle = c.trunk; ctx.fillRect(x - 2.5 * s, y - 86 * s, 5 * s, 86 * s); ctx.fillRect(x - 2.5 * s, y - 86 * s, 18 * s, 3.5 * s);
  const g = ctx.createRadialGradient(x + 14 * s, y - 70 * s, 1, x + 14 * s, y - 70 * s, 42 * s); g.addColorStop(0, 'rgba(242,197,107,0.55)'); g.addColorStop(1, 'rgba(242,197,107,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 14 * s, y - 70 * s, 42 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.trunk; ctx.fillRect(x + 9 * s, y - 79 * s, 10 * s, 15 * s); ctx.fillStyle = '#f2c56b'; ctx.fillRect(x + 10.5 * s, y - 77 * s, 7 * s, 11 * s);
}
/** Supply crates and a sack, umber with a lit edge. */
function crates(ctx, x, y, s, c) {
  for (const [dx, dy, w, h] of [[-30, 0, 34, 28], [6, 0, 30, 24], [-16, -28, 28, 24]]) {
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x + dx * s, y + (dy - h) * s, w * s, h * s);
    ctx.fillStyle = '#3d2c20'; ctx.fillRect(x + dx * s, y + (dy - h / 2 - 1.5) * s, w * s, 3 * s);
    ctx.fillStyle = 'rgba(242,197,107,0.35)'; ctx.fillRect(x + dx * s, y + (dy - h) * s, 3 * s, h * s);
  }
  ctx.fillStyle = '#a8946a'; ctx.beginPath(); ctx.ellipse(x + 46 * s, y - 13 * s, 12 * s, 14 * s, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(242,197,107,0.3)'; ctx.beginPath(); ctx.ellipse(x + 40 * s, y - 16 * s, 5 * s, 9 * s, 0.1, 0, Math.PI * 2); ctx.fill();
}
/** A rack of three spears. */
function spearRack(ctx, x, y, s, c) {
  ctx.fillStyle = c.trunk; ctx.fillRect(x - 22 * s, y - 40 * s, 44 * s, 4 * s); ctx.fillRect(x - 22 * s, y - 40 * s, 4 * s, 40 * s); ctx.fillRect(x + 18 * s, y - 40 * s, 4 * s, 40 * s);
  for (const dx of [-12, 0, 12]) { ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 2.6 * s; ctx.beginPath(); ctx.moveTo(x + dx * s, y); ctx.lineTo(x + (dx + 4) * s, y - 92 * s); ctx.stroke(); ctx.fillStyle = '#a9a596'; ctx.beginPath(); ctx.moveTo(x + (dx + 2.5) * s, y - 90 * s); ctx.lineTo(x + (dx + 5) * s, y - 106 * s); ctx.lineTo(x + (dx + 7) * s, y - 90 * s); ctx.fill(); }
}

/** A haystack of two values and a stroke or two of straw. */
function hayL(ctx, x, y, s, c, rnd, side) {
  ctx.beginPath(); ctx.moveTo(x - 22 * s, y); ctx.quadraticCurveTo(x - 21 * s, y - 32 * s, x, y - 35 * s); ctx.quadraticCurveTo(x + 21 * s, y - 32 * s, x + 22 * s, y); ctx.closePath();
  ctx.fillStyle = shade(c.accent, -0.22); ctx.fill();
  ctx.save(); ctx.clip(); ctx.beginPath(); cutBlob(ctx, x + side * 9 * s, y - 22 * s, 18 * s, 22 * s, rnd, 0.1, 9); ctx.fillStyle = mix(c.accent, c.light, 0.3); ctx.fill();
  strokes(ctx, rnd, x - 20 * s, y - 34 * s, 40 * s, 34 * s, [shade(c.accent, -0.4), shade(c.accent, 0.3)], 16, 10 * s, 0.4, 1.2 * s, 2.6); ctx.restore();
}

/** A field fence in umber: posts and two rails with a lit top edge. */
function fenceL(ctx, x, y, s, c, len) {
  ctx.fillStyle = c.trunk; ctx.strokeStyle = c.trunk; ctx.lineWidth = 3.4 * s; ctx.lineCap = 'round';
  for (let i = 0; i <= len; i++) ctx.fillRect(x + i * 26 * s - 2 * s, y - 24 * s, 4.5 * s, 24 * s);
  ctx.beginPath(); ctx.moveTo(x, y - 18 * s); ctx.lineTo(x + len * 26 * s, y - 16 * s); ctx.moveTo(x, y - 9 * s); ctx.lineTo(x + len * 26 * s, y - 10 * s); ctx.stroke();
  ctx.strokeStyle = rgba(c.light, 0.35); ctx.lineWidth = 1.1 * s;
  ctx.beginPath(); ctx.moveTo(x, y - 19.5 * s); ctx.lineTo(x + len * 26 * s, y - 17.5 * s); ctx.stroke();
}

/** Reeds in two values with a few seed heads. */
function reedsL(ctx, x, y, s, c, rnd) {
  ctx.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const bx = x + (rnd() - 0.5) * 30 * s; const hgt = (30 + rnd() * 44) * s; const lean = (rnd() - 0.4) * 12 * s;
    ctx.strokeStyle = i % 3 ? shade(c.near, 0.18) : mix(c.near, c.light, 0.3); ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + lean * 0.3, y - hgt * 0.6, bx + lean, y - hgt); ctx.stroke();
    if (rnd() < 0.35) { ctx.fillStyle = c.trunk; ctx.beginPath(); ctx.ellipse(bx + lean * 0.92, y - hgt * 0.9, 2.6 * s, 7.5 * s, lean / hgt, 0, Math.PI * 2); ctx.fill(); }
  }
}

/** A flat-bottomed gouache cloud: body, a lit crown toward the key light, a flat shade underside; dry-brush rim. */
function cloudL(ctx, x, y, s, c, rnd, side) {
  const n = 5 + Math.floor(rnd() * 4); const span = (150 + rnd() * 120) * s; const parts = [];
  for (let i = 0; i < n; i++) { const f = i / (n - 1); parts.push([x + (f - 0.5) * span, y - Math.sin(f * Math.PI) * (16 + rnd() * 18) * s, (16 + Math.sin(f * Math.PI) * (20 + rnd() * 18)) * s]); }
  ctx.save();
  ctx.beginPath(); ctx.rect(x - span * 2, y - 240 * s, span * 4, 248 * s); ctx.clip(); // the flat underside
  ctx.beginPath(); for (const [bx, by, r] of parts) cutBlob(ctx, bx, by, r, r * 0.8, rnd, 0.1, 9);
  cutBlob(ctx, x, y + 2 * s, span * 0.58, 12 * s, rnd, 0.08, 11);
  ctx.fillStyle = c.cloud; ctx.fill();
  ctx.clip();
  ctx.beginPath(); for (const [bx, by, r] of parts) cutBlob(ctx, bx + side * r * 0.25, by - r * 0.35, r * 0.75, r * 0.5, rnd, 0.14, 9); ctx.fillStyle = c.cloudLit; ctx.fill();
  const g = ctx.createLinearGradient(0, y - 22 * s, 0, y + 8 * s); g.addColorStop(0, rgba(c.cloudShade, 0)); g.addColorStop(0.55, rgba(c.cloudShade, 0.55)); g.addColorStop(1, rgba(c.cloudShade, 0.85));
  ctx.fillStyle = g; ctx.fillRect(x - span, y - 22 * s, span * 2, 30 * s);
  ctx.restore();
}

/** Lantern backdrop: the same layers and the same return shape as buildBackdrop (sky static; strips that tile). */
export function buildLanternBackdrop(themeId, W, H, opts = {}) {
  const c = LANTERN_THEMES[themeId];
  const seed = opts.seed || 1234;
  const SW = Math.max(1600, Math.ceil(W * 1.25 / 64) * 64);
  const u = H / 768;
  const side = c.key.x >= 0.5 ? 1 : -1; // the key light's side: lit edges face it
  const layers = [];
  const mk = (y0, y1) => { const cv = document.createElement('canvas'); cv.width = SW; cv.height = Math.max(1, Math.ceil(y1 - y0)); return cv; };
  const gy = H * GROUND_Y;

  // sky: slate to cream, the low sun as flat painted discs, long painted streaks; stars at dusk
  const sky = document.createElement('canvas'); sky.width = Math.ceil(W); sky.height = Math.ceil(H);
  {
    const ctx = sky.getContext('2d'); const rnd = prng(seed + 11);
    ctx.fillStyle = vgrad(ctx, 0, H * 0.7, c.sky); ctx.fillRect(0, 0, W, H);
    strokes(ctx, rnd, -60, 0, W + 120, H * 0.62, [shade(c.sky[0], 0.06), c.sky[1]], 90, 220 * u, 0.06, 16 * u, 0.04);
    if (c.stars) for (let i = 0; i < c.stars; i++) { const x = rnd() * W; const y = rnd() * H * 0.42; ctx.fillStyle = rgba('#f1e3c0', 0.25 + rnd() * 0.5); ctx.beginPath(); ctx.arc(x, y, (0.6 + rnd() * 0.9) * u, 0, Math.PI * 2); ctx.fill(); }
    const sx = c.sun.x * W; const sy = c.sun.y * H; const sr = c.sun.r * H;
    for (const [k, a] of [[7, 0.1], [4.2, 0.14], [2.4, 0.2], [1.5, 0.28]]) { ctx.beginPath(); cutBlob(ctx, sx, sy, sr * k, sr * k * 0.92, rnd, 0.04, 14); ctx.fillStyle = rgba(c.sun.glow, a); ctx.fill(); }
    if (!c.sun.set) { ctx.beginPath(); cutBlob(ctx, sx, sy, sr, sr, rnd, 0.03, 14); ctx.fillStyle = c.sun.color; ctx.fill(); }
    // long cloud streaks lit from below by the low sun
    for (let i = 0; i < 7; i++) {
      const y = H * (0.12 + rnd() * 0.34); const x = rnd() * W; const w = (160 + rnd() * 260) * u;
      ctx.beginPath(); cutBlob(ctx, x, y, w, (4 + rnd() * 5) * u, rnd, 0.25, 9); ctx.fillStyle = rgba(mix(c.cloud, c.sky[1], 0.35), 0.55); ctx.fill();
      ctx.beginPath(); cutBlob(ctx, x + side * w * 0.12, y + 2.5 * u, w * 0.7, 2.2 * u, rnd, 0.25, 9); ctx.fillStyle = rgba(c.cloudLit, c.stars ? 0.3 : 0.5); ctx.fill();
    }
    const hz = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.72); hz.addColorStop(0, rgba(c.sky[2], 0)); hz.addColorStop(1, rgba(c.sky[2], 0.7));
    ctx.fillStyle = hz; ctx.fillRect(0, H * 0.42, W, H * 0.3);
  }

  // clouds (slow drift)
  {
    const y1 = H * 0.5; const cv = mk(0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 12);
    for (let i = 0; i < c.clouds; i++) { const x = rnd() * SW; const y = (0.1 + rnd() * 0.24) * H; const s = (0.5 + rnd() * 0.55) * u; wrap(SW, x, 200 * s, (xx) => cloudL(ctx, xx, y, s, c, prng(seed + 40 + i), side)); }
    layers.push({ canvas: cv, y: 0, factor: 0.04, drift: 5 * u });
  }

  // far range: cool and low-contrast, a lit ridge, a mist band at its foot
  {
    const y0 = H * 0.3; const y1 = H * 0.68; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 13);
    const f = periodic(rnd, 5); const base = H * 0.6 - y0; const amp = (themeId === 'wetlands' ? 0.06 : 0.14) * H;
    const col = mix(c.far, c.sky[2], 0.22);
    const pts = []; for (let x = 0; x <= SW; x += 8) pts.push([x, base - amp * (0.5 + 0.5 * f(x / SW)) + (rnd() - 0.5) * 1.5 * u]);
    ctx.beginPath(); ctx.moveTo(0, y1 - y0); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(SW, y1 - y0); ctx.closePath();
    ctx.fillStyle = vgrad(ctx, base - amp, y1 - y0, [col, mix(col, c.sky[2], 0.35)]); ctx.fill();
    ctx.save(); ctx.clip(); strokes(ctx, rnd, 0, base - amp, SW, amp + 60 * u, [shade(col, 0.1), shade(col, -0.08)], 260, 40 * u, 0.16, 6 * u, 0.2); ctx.restore();
    dryRidge(ctx, pts, mix(c.light, c.sky[2], 0.4), rnd, 2.2 * u, 0.35, 2);
    if (themeId === 'wetlands') for (let x = 0; x < SW; x += 7 * u) { const y = base - amp * (0.5 + 0.5 * f(x / SW)) + 2; const hh = (6 + rnd() * 12) * u; ctx.beginPath(); cutBlob(ctx, x, y - hh * 0.4, 4 * u, hh * 0.6, rnd, 0.2, 7); ctx.fillStyle = shade(col, -0.04); ctx.fill(); }
    mistBand(ctx, SW, base - amp * 0.2, y1 - y0, c.mist, 0.42);
    layers.push({ canvas: cv, y: y0, factor: 0.08 });
  }

  // mid range: moss and fen green hills, painted fields or pools, trees in two values, a mist band
  {
    const y0 = H * 0.36; const y1 = H * 0.77; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 14);
    const f = periodic(rnd, 4); const base = H * 0.67 - y0; const amp = (themeId === 'wetlands' ? 0.035 : 0.1) * H;
    const col = mix(c.mid, c.sky[2], 0.16);
    const pts = []; for (let x = 0; x <= SW; x += 8) pts.push([x, base - amp * (0.5 + 0.5 * f(x / SW))]);
    ctx.beginPath(); ctx.moveTo(0, y1 - y0); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(SW, y1 - y0); ctx.closePath();
    ctx.save(); ctx.clip();
    ctx.fillStyle = vgrad(ctx, base - amp, y1 - y0, [shade(col, 0.06), col, shade(col, -0.1)]); ctx.fillRect(0, 0, SW, y1 - y0);
    if (themeId !== 'wetlands') for (let i = 0; i < 26; i++) {
      const x = rnd() * SW; const y = base - amp * 0.3 + rnd() * amp * 1.1; const w = (50 + rnd() * 110) * u;
      ctx.beginPath(); cutBlob(ctx, x, y, w, (5 + rnd() * 9) * u, rnd, 0.12, 10, (rnd() - 0.5) * 0.08);
      ctx.fillStyle = rgba([c.accent, mix(c.mid, c.light, 0.3), shade(c.mid, -0.12), '#b9a55a'][i % 4], 0.55); ctx.fill();
    }
    strokes(ctx, rnd, 0, base - amp, SW, amp + 80 * u, [shade(col, 0.14), shade(col, -0.16), c.midDark], 520, 22 * u, 0.16, 3 * u, 0.25);
    ctx.restore();
    dryRidge(ctx, pts, c.light, rnd, 2.4 * u, 0.4, 2);
    const tc = { ...c, leaf: mix(c.midDark, c.sky[2], 0.12), trunk: mix(c.trunk, c.sky[2], 0.2) };
    for (let i = 0; i < 22; i++) {
      const x = rnd() * SW; const y = base - amp * (0.5 + 0.5 * f(x / SW)) + 6 * u + rnd() * 10 * u; const s = (0.32 + rnd() * 0.26) * u;
      const r2 = prng(seed + 100 + i);
      wrap(SW, x, 70 * s, (xx) => { if (themeId === 'wetlands') { if (i % 4 === 3) stiltHut(ctx, xx, y, s * 1.5, tc, r2); else willowL(ctx, xx, y, s, tc, r2, side); } else oakL(ctx, xx, y, s, tc, r2, side); });
    }
    if (c.water) for (let i = 0; i < 7; i++) {
      const x = rnd() * SW; const w = (80 + rnd() * 170) * u; const y = base + 14 * u + rnd() * 30 * u;
      wrap(SW, x, w, (xx) => { ctx.beginPath(); cutBlob(ctx, xx, y, w, 6 * u, rnd, 0.1, 10); ctx.fillStyle = mix(c.water, c.sky[1], 0.35); ctx.fill(); ctx.strokeStyle = rgba('#f1e3c0', 0.55); ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(xx - w * 0.45, y - 1.5 * u); ctx.lineTo(xx + w * 0.2, y - 1.5 * u); ctx.stroke(); });
    }
    mistBand(ctx, SW, base - amp * 0.1, y1 - y0, c.mist, c.fogA);
    layers.push({ canvas: cv, y: y0, factor: 0.22 });
  }

  // near layer: a bank behind the road with the zone's props
  {
    const y0 = H * 0.16; const y1 = H * 0.8; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 15);
    const by = H * 0.735 - y0; const f = periodic(rnd, 3);
    const pts = []; for (let x = 0; x <= SW; x += 8) pts.push([x, by + 4 * u - 16 * u * (0.5 + 0.5 * f(x / SW))]);
    ctx.beginPath(); ctx.moveTo(0, y1 - y0); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(SW, y1 - y0); ctx.closePath();
    ctx.fillStyle = vgrad(ctx, by - 20 * u, y1 - y0, [shade(c.near, 0.1), c.near]); ctx.fill();
    dryRidge(ctx, pts, mix(c.near, c.light, 0.35), rnd, 2.6 * u, 0.5, 2);
    const props = Math.round(SW / (200 * u));
    const nc = { ...c, leaf: shade(c.leaf, -0.04) };
    for (let i = 0; i < props; i++) {
      const x = (i + 0.2 + rnd() * 0.6) * (SW / props); const s = (0.85 + rnd() * 0.45) * u; const y = by + 8 * u * rnd(); const kind = rnd();
      const r2 = prng(seed + 200 + i);
      wrap(SW, x, 150 * s, (xx) => {
        if (opts.hub && i % 3 === 0) { cottageL(ctx, xx, y + 4 * u, s * 1.1, c, prng(seed + i), side); return; }
        if (themeId === 'dusk' && kind < 0.35) { oakL(ctx, xx, y, s * 1.2, nc, r2, side); return; }
        if (themeId === 'dusk') return; // the muster yard's pieces stand where the camp's actors leave room (below)
        if (themeId === 'wetlands') { if (kind < 0.45) willowL(ctx, xx, y, s * 1.25, nc, r2, side); else if (kind < 0.62) stiltHut(ctx, xx, y, s * 1.2, nc, r2); else reedsL(ctx, xx, y, s * 1.4, nc, r2); }
        else if (kind < 0.5) oakL(ctx, xx, y, s * 1.2, nc, r2, side); else if (kind < 0.75) hayL(ctx, xx, y, s, nc, r2, side); else fenceL(ctx, xx - 40 * s, y, s, nc, 3);
      });
    }
    if (themeId === 'dusk') { // the muster yard round the start camp: the bell frame, supply crates, a spear rack, lamp posts
      const yy = by + 6 * u; const s = 0.95 * u;
      bellFrame(ctx, W * 0.13, yy, s * 1.1, c);
      lampPost(ctx, W * 0.27, yy, s, c); lampPost(ctx, W * 0.93, yy, s, c);
      crates(ctx, W * 0.86, yy, s, c); spearRack(ctx, W * 0.205, yy, s, c);
    }
    layers.push({ canvas: cv, y: y0, factor: 0.55 });
  }

  // ground: flat painted earth, a worn road with ragged edges, puddles in the fen, grass strokes in two values
  {
    const y0 = H * 0.7; const y1 = H; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 16); const hgt = y1 - y0;
    const top = 0.04 * H; const fe = periodic(rnd, 3);
    ctx.beginPath(); ctx.moveTo(0, hgt); for (let x = 0; x <= SW; x += 8) ctx.lineTo(x, top + fe(x / SW) * 5 * u + (rnd() - 0.5) * 2 * u); ctx.lineTo(SW, hgt); ctx.closePath();
    ctx.fillStyle = vgrad(ctx, top - 6 * u, hgt, [mix(c.near, c.ground, 0.55), c.ground, c.groundDark]); ctx.fill(); ctx.save(); ctx.clip();
    strokes(ctx, rnd, 0, 0, SW, hgt, [shade(c.ground, 0.18), c.groundDark, mix(c.ground, c.light, 0.2)], 900, 26 * u, 0.2, 3 * u, 0.12);
    ctx.restore();
    const ry = gy - y0 - 14 * u; const rh = 40 * u;
    ctx.beginPath(); ctx.moveTo(0, ry);
    for (let x = 0; x <= SW; x += 14 * u) ctx.lineTo(x, ry + (rnd() - 0.5) * 5 * u);
    for (let x = SW; x >= 0; x -= 14 * u) ctx.lineTo(x, ry + rh + (rnd() - 0.5) * 6 * u);
    ctx.closePath(); ctx.fillStyle = vgrad(ctx, ry, ry + rh, [c.path, mix(c.path, c.pathDark, 0.6)]); ctx.fill();
    strokes(ctx, rnd, 0, ry, SW, rh, [shade(c.path, 0.18), c.pathDark, mix(c.path, c.light, 0.3)], 700, 30 * u, 0.24, 2.4 * u, 0.06);
    for (let i = 0; i < 70; i++) { const x = rnd() * SW; const y = ry + rnd() * rh; ctx.beginPath(); cutBlob(ctx, x, y, (2 + rnd() * 4) * u, (1.2 + rnd() * 1.8) * u, rnd, 0.2, 7); ctx.fillStyle = rgba(c.pathDark, 0.7); ctx.fill(); ctx.beginPath(); cutBlob(ctx, x + side * 1.2 * u, y - 0.8 * u, (1 + rnd() * 2) * u, 0.8 * u, rnd, 0.2, 7); ctx.fillStyle = rgba(c.light, 0.45); ctx.fill(); }
    if (c.water) for (let i = 0; i < 16; i++) { const x = rnd() * SW; const y = ry + rh * (0.15 + rnd() * 0.8); const w = (16 + rnd() * 34) * u; ctx.beginPath(); cutBlob(ctx, x, y, w, 3.2 * u, rnd, 0.15, 9); ctx.fillStyle = mix(c.water, c.sky[1], 0.3); ctx.fill(); ctx.fillStyle = rgba('#f1e3c0', 0.5); ctx.fillRect(x - w * 0.4, y - 1 * u, w * 0.45, 1.1 * u); }
    for (let i = 0; i < SW / (8 * u); i++) {
      const x = rnd() * SW; const top = rnd() < 0.5; const y = top ? ry - rh * 0.25 + rnd() * 8 * u : ry + rh * 1.05 + rnd() * (hgt - ry - rh) * 0.9;
      const lit = rnd() < 0.4; ctx.strokeStyle = lit ? mix(c.ground, c.light, 0.35) : shade(c.groundDark, -0.1); ctx.lineWidth = 1.8 * u; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * 2.4 * u, y); ctx.lineTo(x + k * 2.4 * u + (rnd() - 0.5) * 6 * u, y - (5 + rnd() * 8) * u); ctx.stroke(); }
      if (themeId === 'farmland' && rnd() < 0.07) { ctx.fillStyle = ['#f1e3c0', '#d9a441', '#c9b6d8'][Math.floor(rnd() * 3)]; ctx.beginPath(); ctx.arc(x, y - 8 * u, 2 * u, 0, Math.PI * 2); ctx.fill(); }
    }
    layers.push({ canvas: cv, y: y0, factor: 1 });
  }

  // foreground: ink-green grass and reed silhouettes passing fast
  {
    const y0 = H * 0.82; const y1 = H; const cv = mk(y0, y1); const ctx = cv.getContext('2d'); const rnd = prng(seed + 17); const hgt = y1 - y0;
    const fg = mix(c.ink, c.near, 0.35);
    for (let i = 0; i < 7; i++) {
      const x = rnd() * SW; const s = (0.9 + rnd() * 0.8) * u;
      wrap(SW, x, 120 * s, (xx) => {
        ctx.lineCap = 'round';
        for (let k = 0; k < 13; k++) { ctx.strokeStyle = k % 4 ? rgba(fg, 0.95) : rgba(mix(fg, c.light, 0.18), 0.95); ctx.lineWidth = (3.5 + rnd() * 3) * s; ctx.beginPath(); const bx = xx + (k - 6) * 6 * s; ctx.moveTo(bx, hgt + 4); ctx.quadraticCurveTo(bx + (rnd() - 0.5) * 26 * s, hgt - 40 * s, bx + (rnd() - 0.3) * 36 * s, hgt - (46 + rnd() * 58) * s); ctx.stroke(); }
      });
    }
    layers.push({ canvas: cv, y: y0, factor: 1.6, foreground: true });
  }

  return { theme: c, themeId, sky, layers, W, H, SW, lantern: true };
}
