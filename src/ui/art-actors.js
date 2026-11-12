// Characters drawn in code: a small 2D rig for humanoids (heroes, humanoid enemies, NPCs), a
// quadruped rig (pets, beasts), the hawk, the end boss and its shards. Facing right; feet at (0,0);
// about 100 units tall before scaling.
import { shade, rgba, mix, clamp, ease, glowBall } from './util.js';

const SKIN = '#d9a77f';

export const HERO_LOOKS = {
  rogue: { cloth: '#2c2e3a', cloth2: '#3e4252', trim: '#b23a33', skin: SKIN, hood: 'hood', scarf: '#b23a33', boots: '#1d1c22', pants: '#24252f',
    weapon: 'dagger', off: 'dagger', build: 0.98, metal: '#cfd6de', eyes: '#f3e2b0', pauldron: '#454a5c' },
  mage: { cloth: '#2c3d8a', cloth2: '#4560c0', trim: '#e8bf5d', skin: SKIN, hat: true, hair: '#e6e1d6', beard: true, robe: true, boots: '#2a1f3a', pants: '#2a2f60',
    weapon: 'staff', orb: '#8fd6ff', build: 0.95, eyes: '#cfe8ff', wood: '#6a4a2c', pauldron: '#3a4f9e' },
  hunter: { cloth: '#5a6b34', cloth2: '#6f5536', trim: '#d0a85a', skin: SKIN, hood: 'hood', cloak: '#3c5a3c', boots: '#3a2a1c', pants: '#4a3c28',
    weapon: 'bow', quiver: true, build: 1.02, eyes: '#f0e6c0', wood: '#7a5230', pauldron: '#6f5536' },
};

/** Enemy look by archetype, tinted by zone theme. */
export function enemyLook(arch, theme, rank, name = '') {
  const tint = { farmland: '#7a6a4a', wetlands: '#4f6a5a', highlands: '#5a6a7a', ruins: '#9a6a3a', haunted: '#5a4a7a', scorched: '#5a2a1a', observatory: '#3a4a7a' }[theme] || '#6a6a6a';
  const glow = { farmland: '#ffcf6a', wetlands: '#8ff0c0', highlands: '#a8d8ff', ruins: '#ffd27a', haunted: '#7ff0c8', scorched: '#ff8a3a', observatory: '#9fd0ff' }[theme] || '#ffffff';
  const skin = { farmland: '#b88a64', wetlands: '#7f9a72', highlands: '#a58a78', ruins: '#b07a4e', haunted: '#9a96b0', scorched: '#6a3a2a', observatory: '#7a86b0' }[theme] || SKIN;
  const big = rank === 'elite' || rank === 'rare' ? 1.18 : rank === 'dboss' ? 1.42 : 1;
  const base = { skin, glow, eyes: glow, metal: '#b9c0c8', wood: '#5a3e26', boots: shade(tint, -0.5), pants: shade(tint, -0.35) };
  switch (arch) {
    case 'brute': return { ...base, cloth: shade(tint, -0.2), cloth2: shade(tint, 0.1), trim: '#8a5a3a', weapon: 'club', build: 1.3 * big, bare: true, pads: true, crouch: 0.08 };
    case 'skulker': return { ...base, cloth: shade(tint, -0.45), cloth2: shade(tint, -0.25), trim: shade(tint, 0.2), hood: 'hood', weapon: 'dagger', off: 'dagger', build: 0.92 * big, crouch: 0.22 };
    case 'caster': return { ...base, cloth: shade(tint, -0.3), cloth2: mix(tint, glow, 0.25), trim: glow, hood: 'cowl', robe: true, weapon: 'none', handGlow: glow, build: 0.95 * big, float: true };
    case 'guardian': return { ...base, cloth: '#5a5f6a', cloth2: '#8a909a', trim: shade(tint, 0.1), helm: true, weapon: 'sword', off: 'shield', build: 1.12 * big, armored: true };
    case 'mender': return { ...base, cloth: mix(tint, '#e8e0c8', 0.35), cloth2: mix(tint, '#ffffff', 0.5), trim: '#7fd08a', hood: 'cowl', robe: true, weapon: 'staff', orb: '#9bf0a0', build: 0.95 * big };
    default: return { ...base, cloth: tint, cloth2: shade(tint, 0.2), trim: glow, build: big };
  }
}

export function beastLook(theme, name = '', rank = 'normal') {
  const n = name.toLowerCase();
  const big = rank === 'elite' || rank === 'rare' ? 1.25 : rank === 'dboss' ? 1.5 : 1;
  const fur = { farmland: '#7a5f45', wetlands: '#4f5f48', highlands: '#9a9488', ruins: '#b58a58', haunted: '#4a4560', scorched: '#3a2420', observatory: '#3a4470' }[theme] || '#777';
  const eye = { haunted: '#7ff0c8', scorched: '#ffb347', observatory: '#9fd0ff' }[theme] || '#ffdf7a';
  let kind = 'wolf';
  if (/boar|hog|tusk|swine|sow/.test(n)) kind = 'boar';
  else if (/cat|lynx|stalker|panther|prowler|mane/.test(n)) kind = 'cat';
  else if (/rat|swarm|vermin/.test(n)) kind = 'rat';
  else if (/toad|frog|snapper|turtle|crab|lizard|scorpion|basilisk/.test(n)) kind = 'lizard';
  else if (/bear|ursine/.test(n)) kind = 'bear';
  const glowCracks = theme === 'scorched' ? '#ff6a1a' : null;
  return { kind, fur, belly: shade(fur, 0.25), eye, size: big * (kind === 'bear' ? 1.25 : kind === 'rat' ? 0.7 : 1), glowCracks };
}

export const PET_LOOKS = {
  ridgewolf: { kind: 'wolf', fur: '#8d929c', belly: '#c9ccd2', eye: '#ffd76a', size: 0.82 },
  thornback: { kind: 'boar', fur: '#6e4d34', belly: '#9a7656', eye: '#ffb35a', size: 0.86, spikes: true },
  duskcat: { kind: 'cat', fur: '#2e2640', belly: '#4a3e66', eye: '#c79bff', size: 0.84 },
  stormhawk: { kind: 'hawk', fur: '#5a6f8a', belly: '#c8d6e6', eye: '#ffe08a', size: 0.9 },
};

// ------------------------------------------------------------------ rig helpers
function seg(ctx, ax, ay, bx, by, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
}
function limb2(ctx, a, b, c, w1, w2, col, lit) {
  seg(ctx, a[0], a[1], b[0], b[1], w1, col);
  seg(ctx, b[0], b[1], c[0], c[1], w2, col);
  if (lit) { seg(ctx, a[0] + w1 * 0.18, a[1], b[0] + w1 * 0.18, b[1], w1 * 0.32, lit); seg(ctx, b[0] + w2 * 0.18, b[1], c[0] + w2 * 0.18, c[1], w2 * 0.3, lit); }
}
const pt = (o, len, ang) => [o[0] + Math.sin(ang) * len, o[1] + Math.cos(ang) * len];

/** Compute joint positions for a humanoid. Angles: 0 = straight down, positive = forward. */
function pose(look, a) {
  const t = a.t || 0; const walk = a.walk || 0; const ph = a.phase || 0;
  const b = look.build || 1;
  const P = { lean: (look.crouch || 0) + walk * 0.1, bob: 0, dx: 0 };
  P.bob = walk ? -Math.abs(Math.sin(ph)) * 3 + 1.5 : Math.sin(t * 2.1) * 0.7;
  if (look.float) P.bob += -6 + Math.sin(t * 1.6) * 2;
  let nh = 0.14, fh = -0.12, nk = 0.1, fk = 0.06;
  if (walk) {
    nh = 0.55 * Math.sin(ph); fh = 0.55 * Math.sin(ph + Math.PI);
    nk = 0.15 + 0.9 * Math.max(0, Math.cos(ph)); fk = 0.15 + 0.9 * Math.max(0, Math.cos(ph + Math.PI));
  }
  let ns = 0.12 + (walk ? -0.55 * Math.sin(ph) : Math.sin(t * 1.7) * 0.04), ne = 0.35;
  let fs = 0.05 + (walk ? -0.55 * Math.sin(ph + Math.PI) : Math.sin(t * 1.7 + 1) * 0.04), fe = 0.45;
  // weapon holds
  if (look.weapon === 'staff') { ns = walk ? 0.35 + 0.15 * Math.sin(ph) : 0.4; ne = 1.0; }
  if (look.weapon === 'bow') { fs = 0.3 + (walk ? 0.1 * Math.sin(ph) : 0); fe = 0.35; }
  if (look.weapon === 'dagger') { ne = 0.9; fe = 0.8; }
  if (look.off === 'shield') { fs = 0.7; fe = 0.9; }
  if (look.weapon === 'club' || look.weapon === 'sword') { ns = 0.35; ne = 0.9; }
  if (look.handGlow) { ns = 0.6 + Math.sin(t * 2) * 0.05; ne = 0.9; fs = 0.4; fe = 1.0; }
  // actions
  const act = a.act; const p = act ? clamp(act.p, 0, 1) : 0;
  if (act) {
    if (act.kind === 'melee') {
      const wind = p < 0.35 ? ease.out(p / 0.35) : p < 0.55 ? 1 - ease.out((p - 0.35) / 0.2) * 1.6 : -0.6 * (1 - (p - 0.55) / 0.45);
      P.lean += -0.18 * Math.max(0, wind) + 0.25 * Math.max(0, -wind);
      ns = -1.2 * Math.max(0, wind) + 1.9 * Math.max(0, -wind) / 0.6 * 0.8 + 0.2; ne = 0.6 - 0.4 * Math.max(0, -wind);
      fs = 0.9 * Math.max(0, -wind) + 0.1; fe = 0.6;
      nh = 0.5 * Math.max(0, -wind); fh = -0.4 * Math.max(0, -wind); nk = 0.3; fk = 0.1;
    } else if (act.kind === 'smash') {
      // a heavy blow: the weapon goes up overhead with both hands, then comes down forward (contact at p 0.5)
      const wind = p < 0.35 ? ease.out(p / 0.35) : p < 0.55 ? 1 - ease.out((p - 0.35) / 0.2) * 1.6 : -0.6 * (1 - (p - 0.55) / 0.45);
      const up = Math.max(0, wind); const down = Math.max(0, -wind) / 0.6; const rest = (1 - up) * (1 - down);
      P.lean += -0.2 * up + 0.32 * down;
      ns = -2.5 * up + 1.1 * down + 0.35 * rest; ne = 0.9 * rest - 0.5 * up + 0.15 * down;
      fs = -2.2 * up + 0.9 * down + 0.1 * rest; fe = 0.45 * rest - 0.3 * up + 0.2 * down;
      nh = 0.45 * down - 0.1 * up; fh = -0.35 * down - 0.12 * up; nk = 0.15 + 0.3 * down; fk = 0.1;
    } else if (act.kind === 'cast') {
      const raise = p < 0.6 ? ease.out(p / 0.6) : 1 - ease.out((p - 0.6) / 0.4) * 0.6;
      ns = 0.4 + 1.1 * raise; ne = 0.9 - 0.7 * raise; fs = 0.2 + 1.2 * raise; fe = 0.6 - 0.4 * raise; P.lean += -0.05 * raise;
    } else if (act.kind === 'shoot') {
      const draw = p < 0.6 ? ease.out(p / 0.6) : 1 - ease.out((p - 0.6) / 0.4);
      fs = 1.45; fe = 0.05; ns = 1.25 + 0.05 * draw; ne = 1.55 * draw + 0.2; P.lean += -0.04;
    } else if (act.kind === 'hit') {
      const k = Math.sin(p * Math.PI);
      P.lean -= 0.3 * k; P.dx = -8 * k; ns -= 0.4 * k; fs -= 0.3 * k;
    } else if (act.kind === 'cheer') {
      const k = Math.sin(clamp(p, 0, 1) * Math.PI);
      ns = 2.6 * k + 0.12 * (1 - k); ne = 0.2; fs = 2.4 * k + 0.05 * (1 - k); fe = 0.2;
    } else if (act.kind === 'item') {
      const k = Math.sin(p * Math.PI); ns = 0.3 + 1.6 * k; ne = 1.6 * k + 0.3; P.lean += -0.05 * k;
    }
  }
  const hip = [P.dx, -46 * b ** 0.15 + P.bob];
  const torsoLen = 34 * Math.sqrt(b);
  const neck = [hip[0] + Math.sin(P.lean) * torsoLen, hip[1] - Math.cos(P.lean) * torsoLen];
  const head = [neck[0] + Math.sin(P.lean) * 10 + 1.5, neck[1] - Math.cos(P.lean) * 10];
  const sh = [neck[0] - Math.sin(P.lean) * 3, neck[1] + 3];
  const thigh = 23, shin = 23, upper = 16 * Math.sqrt(b), fore = 15 * Math.sqrt(b);
  const legN = { hip: [hip[0] + 2, hip[1]] }; legN.knee = pt(legN.hip, thigh, nh); legN.foot = pt(legN.knee, shin, nh - nk);
  const legF = { hip: [hip[0] - 2, hip[1]] }; legF.knee = pt(legF.hip, thigh, fh); legF.foot = pt(legF.knee, shin, fh - fk);
  const armN = { sh: [sh[0] + 3 * b, sh[1]] }; armN.el = pt(armN.sh, upper, ns); armN.hand = pt(armN.el, fore, ns + ne);
  const armF = { sh: [sh[0] - 3 * b, sh[1] + 1] }; armF.el = pt(armF.sh, upper, fs); armF.hand = pt(armF.el, fore, fs + fe);
  // keep the lowest foot on the ground
  const low = Math.max(legN.foot[1], legF.foot[1]);
  const lift = look.float ? 0 : low;
  for (const o of [hip, neck, head, sh, legN.hip, legN.knee, legN.foot, legF.hip, legF.knee, legF.foot, armN.sh, armN.el, armN.hand, armF.sh, armF.el, armF.hand]) o[1] -= lift;
  return { ...P, hip, neck, head, sh, legN, legF, armN, armF, ns, ne, fs, fe, b, ph, walk };
}

// ------------------------------------------------------------------ humanoid
/**
 * Draw a humanoid. anim: { t, walk, phase, act: {kind, p}, flash (0..1), dead (0..1), alpha, flip, glowAura }
 */
export function drawHumanoid(ctx, x, y, s, look, anim) {
  const P = pose(look, anim);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(anim.flip ? -s : s, s);
  if (anim.dead) { ctx.rotate(-ease.out(clamp(anim.dead, 0, 1)) * 1.45); }
  const b = P.b;
  const C = look;
  const dark = (c, k = 0.3) => shade(c, -k);
  const lit = (c, k = 0.18) => rgba(shade(c, 0.45), k);

  // back: cloak / quiver / scarf tail
  if (C.cloak) {
    const sway = Math.sin((anim.t || 0) * 2 + P.ph) * 3 + (P.walk ? 8 : 0);
    ctx.fillStyle = dark(C.cloak, 0.1);
    ctx.beginPath();
    ctx.moveTo(P.sh[0] - 2, P.sh[1] - 3);
    ctx.quadraticCurveTo(P.hip[0] - 18 - sway, P.hip[1] - 6, P.hip[0] - 14 - sway * 1.4, P.hip[1] + 22);
    ctx.lineTo(P.hip[0] - 2 - sway * 0.6, P.hip[1] + 18);
    ctx.quadraticCurveTo(P.hip[0] + 2, P.hip[1] - 4, P.sh[0] + 4, P.sh[1] - 2);
    ctx.closePath(); ctx.fill();
  }
  if (C.quiver) {
    ctx.save(); ctx.translate(P.sh[0] - 7, P.sh[1] + 2); ctx.rotate(-0.5 + P.lean);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(-4, -4, 8, 26);
    ctx.fillStyle = '#e8dcc0'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 2.4, -4); ctx.lineTo(i * 2.4 - 1.6, -11); ctx.lineTo(i * 2.4 + 1.6, -11); ctx.fill(); }
    ctx.restore();
  }
  if (C.scarf) {
    const sway = Math.sin((anim.t || 0) * 3 + P.ph) * 3;
    ctx.strokeStyle = dark(C.scarf, 0.15); ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(P.neck[0] - 1, P.neck[1] + 2);
    ctx.quadraticCurveTo(P.neck[0] - 12, P.neck[1] + 4 + sway, P.neck[0] - 22 - (P.walk ? 6 : 0), P.neck[1] + 10 + sway * 2); ctx.stroke();
  }

  // far arm + far leg (shaded)
  const farTint = (c) => shade(c, -0.28);
  if (!C.robe) limb2(ctx, P.legF.hip, P.legF.knee, P.legF.foot, 10.5 * b, 8.5 * b, farTint(C.pants || C.cloth), null);
  else limb2(ctx, P.legF.hip, P.legF.knee, P.legF.foot, 8 * b, 7 * b, farTint(C.pants || C.cloth), null);
  boot(ctx, P.legF.foot, farTint(C.boots || '#222'), b);
  limb2(ctx, P.armF.sh, P.armF.el, P.armF.hand, 8.5 * b, 7 * b, farTint(C.armored ? C.cloth2 : C.cloth), null);
  hand(ctx, P.armF.hand, farTint(C.bare ? C.skin : (C.gloves || C.skin)), b);
  if (C.off === 'shield') shield(ctx, P.armF.hand, C, b);
  if (C.off === 'dagger') dagger(ctx, P.armF.hand, P.fs + P.fe, C, b * 0.9, true);
  if (C.weapon === 'bow') bow(ctx, P.armF.hand, P.armN.hand, C, anim);

  // torso
  const hx = P.hip[0]; const hy = P.hip[1]; const nx = P.neck[0]; const ny = P.neck[1];
  const sw = 14 * b; const ww = 10.5 * b; const hw = 12 * b;
  ctx.beginPath();
  ctx.moveTo(nx - sw, ny + 3); ctx.quadraticCurveTo(nx, ny - 2, nx + sw, ny + 3);
  ctx.quadraticCurveTo((nx + hx) / 2 + ww + 1, (ny + hy) / 2, hx + hw, hy + 2);
  ctx.lineTo(hx - hw, hy + 2);
  ctx.quadraticCurveTo((nx + hx) / 2 - ww - 1, (ny + hy) / 2, nx - sw, ny + 3);
  ctx.closePath();
  const tg = ctx.createLinearGradient(hx - hw, 0, hx + hw, 0);
  tg.addColorStop(0, dark(C.cloth, 0.2)); tg.addColorStop(0.6, C.cloth); tg.addColorStop(1, shade(C.cloth, 0.12));
  ctx.fillStyle = C.bare ? skinGrad(ctx, hx, hw, C.skin) : tg; ctx.fill();
  if (C.bare) { // brute: harness strap + belly shade
    ctx.strokeStyle = C.trim; ctx.lineWidth = 3 * b; ctx.beginPath(); ctx.moveTo(nx - sw * 0.8, ny + 4); ctx.lineTo(hx + hw * 0.8, hy - 2); ctx.stroke();
  }
  if (C.armored) { // plate lines
    ctx.strokeStyle = rgba('#000000', 0.25); ctx.lineWidth = 1.2;
    for (let i = 1; i < 4; i++) { const yy = ny + (hy - ny) * (i / 4); ctx.beginPath(); ctx.moveTo(hx - hw + 1, yy); ctx.quadraticCurveTo(hx + 2, yy + 3, hx + hw - 1, yy); ctx.stroke(); }
    ctx.fillStyle = lit('#ffffff', 0.25); ctx.fillRect(hx + 2, ny + 6, 3, hy - ny - 10);
  }
  // trim line down the front & belt
  ctx.strokeStyle = C.trim; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(nx + 2, ny + 2); ctx.lineTo(hx + 2, hy); ctx.stroke();
  ctx.fillStyle = dark(C.cloth2 || C.cloth, 0.35); ctx.fillRect(hx - hw, hy - 6, hw * 2, 4.5);
  ctx.fillStyle = C.trim; ctx.fillRect(hx + 1, hy - 6.5, 4, 5.5);
  if (C.pads) { // shoulder pads
    for (const sx of [-1, 1]) { ctx.fillStyle = sx > 0 ? C.cloth2 : dark(C.cloth2); ctx.beginPath(); ctx.ellipse(nx + sx * sw * 0.8, ny + 4, 7 * b, 5 * b, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  // robe skirt (mage, caster, mender)
  if (C.robe) {
    const sway = P.walk ? Math.sin(P.ph) * 4 : Math.sin((anim.t || 0) * 1.5) * 1.2;
    const footY = Math.max(P.legN.foot[1], P.legF.foot[1]);
    ctx.beginPath();
    ctx.moveTo(hx - hw, hy - 2);
    ctx.lineTo(hx + hw, hy - 2);
    ctx.quadraticCurveTo(hx + hw + 6, (hy + footY) / 2, hx + hw + 9 + sway, footY - 4);
    ctx.quadraticCurveTo(hx, footY + 1, hx - hw - 8 + sway * 0.5, footY - 3);
    ctx.quadraticCurveTo(hx - hw - 5, (hy + footY) / 2, hx - hw, hy - 2);
    const rg = ctx.createLinearGradient(hx - hw - 8, 0, hx + hw + 9, 0);
    rg.addColorStop(0, dark(C.cloth, 0.3)); rg.addColorStop(0.55, C.cloth); rg.addColorStop(1, shade(C.cloth2, 0.05));
    ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = C.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx + hw + 9 + sway, footY - 4); ctx.quadraticCurveTo(hx, footY + 1, hx - hw - 8 + sway * 0.5, footY - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 2, hy); ctx.lineTo(hx + 4 + sway * 0.4, footY - 2); ctx.stroke();
  } else {
    limb2(ctx, P.legN.hip, P.legN.knee, P.legN.foot, 10.5 * b, 8.5 * b, C.pants || C.cloth, lit(C.pants || C.cloth, 0.25));
  }
  boot(ctx, P.legN.foot, C.boots || '#222', b);

  // head
  head(ctx, P, C, anim, b);

  // near arm and weapon
  if (C.weapon === 'staff') staff(ctx, P.armN.hand, C, anim, b);
  limb2(ctx, P.armN.sh, P.armN.el, P.armN.hand, 8.5 * b, 7 * b, C.armored ? C.cloth2 : C.bare ? C.skin : C.cloth, lit(C.cloth, 0.22));
  if (C.pauldron) { ctx.fillStyle = C.pauldron; ctx.beginPath(); ctx.ellipse(P.armN.sh[0] + 1, P.armN.sh[1] + 1, 7.5 * b, 5.5 * b, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = rgba('#ffffff', 0.18); ctx.beginPath(); ctx.ellipse(P.armN.sh[0] + 3, P.armN.sh[1] - 1, 4 * b, 2.2 * b, 0.3, 0, Math.PI * 2); ctx.fill(); }
  hand(ctx, P.armN.hand, C.bare ? C.skin : (C.gloves || C.skin), b);
  if (C.weapon === 'dagger') dagger(ctx, P.armN.hand, P.ns + P.ne, C, b, false);
  if (C.weapon === 'club') club(ctx, P.armN.hand, P.ns + P.ne, C, b);
  if (C.weapon === 'sword') sword(ctx, P.armN.hand, P.ns + P.ne, C, b);
  if (C.handGlow) for (const hnd of [P.armN.hand, P.armF.hand]) glowBall(ctx, hnd[0] + 2, hnd[1], 7 + Math.sin((anim.t || 0) * 5) * 1.5, C.handGlow);

  // hit flash
  if (anim.flash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgba('#ffffff', anim.flash * 0.75);
    ctx.fillRect(-60, -140, 140, 160);
  }
  ctx.restore();
}

function skinGrad(ctx, hx, hw, skin) {
  const g = ctx.createLinearGradient(hx - hw, 0, hx + hw, 0);
  g.addColorStop(0, shade(skin, -0.3)); g.addColorStop(0.6, skin); g.addColorStop(1, shade(skin, 0.1));
  return g;
}
function boot(ctx, f, col, b) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(f[0] - 5.5 * b, f[1] - 8); ctx.lineTo(f[0] + 5 * b, f[1] - 8); ctx.quadraticCurveTo(f[0] + 13 * b, f[1] - 4, f[0] + 12 * b, f[1] + 1); ctx.lineTo(f[0] - 6 * b, f[1] + 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.12); ctx.fillRect(f[0] - 5 * b, f[1] - 8, 10 * b, 2);
}
function hand(ctx, h, col, b) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(h[0], h[1], 4 * b, 0, Math.PI * 2); ctx.fill(); }

function head(ctx, P, C, anim, b) {
  const [x, y] = P.head; const r = 10.6 * Math.sqrt(b);
  if (C.helm) {
    const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
    g.addColorStop(0, shade(C.metal, -0.35)); g.addColorStop(0.6, C.metal); g.addColorStop(1, shade(C.metal, 0.2));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#15161a'; ctx.fillRect(x + 1, y - 2, r, 3.5);
    ctx.fillStyle = C.eyes; ctx.fillRect(x + r * 0.55, y - 1.5, 3, 2);
    ctx.fillStyle = C.trim; ctx.beginPath(); ctx.moveTo(x - 3, y - r * 1.05); ctx.quadraticCurveTo(x - 14, y - r * 1.9, x - 18, y - r * 1.2); ctx.lineTo(x - 2, y - r * 0.7); ctx.fill();
    return;
  }
  // face
  const g = ctx.createRadialGradient(x + 3, y - 3, 1, x, y, r);
  g.addColorStop(0, shade(C.skin, 0.15)); g.addColorStop(1, shade(C.skin, -0.2));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (C.bare) { // brute: heavy brow, tusks
    ctx.fillStyle = shade(C.skin, -0.35); ctx.fillRect(x - 2, y - 4, r + 2, 3);
    ctx.fillStyle = C.eyes; ctx.fillRect(x + r * 0.45, y - 2, 2.5, 2);
    ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.moveTo(x + r * 0.6, y + 4); ctx.lineTo(x + r * 0.75, y - 1); ctx.lineTo(x + r * 0.95, y + 4); ctx.fill();
    return;
  }
  if (C.hat) {
    // face, hair and a wide-brimmed hat
    ctx.fillStyle = C.hair || '#d8d4cc';
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.5); ctx.quadraticCurveTo(x - r * 1.5, y + r * 0.9, x - r * 0.9, y + r * 1.8); ctx.lineTo(x - r * 0.1, y + r * 0.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1d14'; ctx.fillRect(x + r * 0.3, y - r * 0.15, 2.4, 2.4); ctx.fillRect(x + r * 0.72, y - r * 0.15, 2.2, 2.2);
    ctx.fillStyle = shade(C.skin, -0.25); ctx.beginPath(); ctx.moveTo(x + r * 0.95, y - r * 0.05); ctx.lineTo(x + r * 1.18, y + r * 0.3); ctx.lineTo(x + r * 0.9, y + r * 0.35); ctx.fill();
    if (C.beard) { ctx.fillStyle = C.hair; ctx.beginPath(); ctx.moveTo(x - r * 0.2, y + r * 0.45); ctx.quadraticCurveTo(x + r * 0.5, y + r * 1.9, x + r * 0.95, y + r * 0.5); ctx.closePath(); ctx.fill(); }
    const tilt = Math.sin((anim.t || 0) * 1.3) * 0.03;
    ctx.save(); ctx.translate(x, y - r * 0.55); ctx.rotate(tilt - 0.08);
    const hg = ctx.createLinearGradient(-r * 2, 0, r * 2, 0);
    hg.addColorStop(0, shade(C.cloth, -0.3)); hg.addColorStop(0.6, C.cloth); hg.addColorStop(1, shade(C.cloth2, 0.1));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 2.05, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.1); ctx.quadraticCurveTo(-r * 0.6, -r * 1.6, -r * 0.1, -r * 2.5);
    ctx.quadraticCurveTo(-r * 0.6, -r * 2.9, -r * 1.7, -r * 2.6); ctx.quadraticCurveTo(-r * 0.2, -r * 2.2, r * 0.25, -r * 2.05);
    ctx.quadraticCurveTo(r * 0.8, -r * 1.2, r * 1.05, -r * 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.trim; ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.18); ctx.quadraticCurveTo(0, -r * 0.55, r * 1.0, -r * 0.18); ctx.lineTo(r * 0.98, -r * 0.48); ctx.quadraticCurveTo(0, -r * 0.85, -r * 0.95, -r * 0.48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.12); ctx.beginPath(); ctx.ellipse(r * 0.6, -r * 0.08, r * 1.0, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (C.hood === 'hood' || C.hood === 'cowl') {
    const hc = C.hood === 'cowl' ? C.cloth2 || C.cloth : C.cloak || C.cloth;
    ctx.fillStyle = shade(hc, -0.05);
    ctx.beginPath();
    ctx.moveTo(x - r * 1.25, y + r * 0.9);
    ctx.quadraticCurveTo(x - r * 1.5, y - r * 0.9, x - r * 0.3, y - r * 1.35);
    ctx.quadraticCurveTo(x + r * 1.1, y - r * 1.4, x + r * 1.15, y - r * 0.2);
    ctx.lineTo(x + r * 0.95, y + r * 0.9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(shade(hc, 0.4), 0.25);
    ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 1.3); ctx.quadraticCurveTo(x + r * 1.0, y - r * 1.2, x + r * 1.1, y - r * 0.2); ctx.lineTo(x + r * 0.6, y - r * 0.6); ctx.fill();
    // face opening in shadow
    ctx.fillStyle = 'rgba(10,8,12,0.78)';
    ctx.beginPath(); ctx.ellipse(x + r * 0.45, y + r * 0.05, r * 0.55, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.eyes;
    const blink = Math.sin((anim.t || 0) * 0.9) > 0.985 ? 0.3 : 1;
    ctx.fillRect(x + r * 0.42, y - r * 0.12, 2.4, 1.6 * blink); ctx.fillRect(x + r * 0.78, y - r * 0.12, 2.0, 1.5 * blink);
    if (C.scarf) { ctx.fillStyle = C.scarf; ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.62, r * 0.85, r * 0.4, 0.1, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(x - 1, y - 2, r * 0.95, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = '#1a1210'; ctx.fillRect(x + r * 0.45, y - 1, 2, 2);
  }
}

function dagger(ctx, h, ang, C, b, far) {
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(-ang + Math.PI);
  ctx.fillStyle = far ? shade(C.metal || '#ccc', -0.3) : (C.metal || '#d8dde3');
  ctx.beginPath(); ctx.moveTo(-2 * b, -2); ctx.lineTo(0, -20 * b); ctx.lineTo(2 * b, -2); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', far ? 0.15 : 0.5); ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -19 * b); ctx.lineTo(1.6 * b, -2); ctx.fill();
  ctx.fillStyle = C.trim || '#8a6a3a'; ctx.fillRect(-4 * b, -2, 8 * b, 2.5); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-1.3, 0, 2.6, 6);
  ctx.restore();
}
function sword(ctx, h, ang, C, b) {
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(-ang + Math.PI);
  ctx.fillStyle = C.metal; ctx.fillRect(-2.2 * b, -40 * b, 4.4 * b, 38 * b);
  ctx.fillStyle = rgba('#ffffff', 0.45); ctx.fillRect(0, -40 * b, 1.6 * b, 38 * b);
  ctx.fillStyle = C.trim; ctx.fillRect(-7 * b, -3, 14 * b, 3); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-1.5, 0, 3, 7);
  ctx.restore();
}
function club(ctx, h, ang, C, b) {
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(-ang + Math.PI);
  ctx.fillStyle = C.wood; ctx.beginPath(); ctx.moveTo(-2.5, 2); ctx.lineTo(-6 * b, -34 * b); ctx.quadraticCurveTo(0, -42 * b, 6 * b, -34 * b); ctx.lineTo(2.5, 2); ctx.fill();
  ctx.fillStyle = '#c8c0b0'; for (const [dx, dy] of [[-5, -26], [4, -30], [-1, -36]]) { ctx.beginPath(); ctx.moveTo(dx * b, dy * b); ctx.lineTo(dx * b + (dx > 0 ? 5 : -5), dy * b - 2); ctx.lineTo(dx * b, dy * b - 4); ctx.fill(); }
  ctx.restore();
}
function shield(ctx, h, C, b) {
  ctx.save(); ctx.translate(h[0] + 3, h[1] - 4);
  const g = ctx.createLinearGradient(-12 * b, 0, 12 * b, 0);
  g.addColorStop(0, shade(C.trim, -0.3)); g.addColorStop(0.6, C.trim); g.addColorStop(1, shade(C.trim, 0.25));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-11 * b, -16 * b); ctx.lineTo(11 * b, -16 * b); ctx.lineTo(10 * b, 4 * b); ctx.quadraticCurveTo(0, 18 * b, -10 * b, 4 * b); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.metal; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.fillStyle = C.metal; ctx.beginPath(); ctx.arc(0, -3 * b, 3 * b, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function staff(ctx, h, C, anim, b) {
  const top = [h[0] + 6, h[1] - 52 * b]; const bot = [h[0] - 4, h[1] + 30 * b];
  seg(ctx, bot[0], bot[1], top[0], top[1], 3.4 * b, C.wood || '#6a4a2c');
  seg(ctx, bot[0] + 0.8, bot[1], top[0] + 0.8, top[1], 1.1 * b, rgba('#ffffff', 0.2));
  ctx.strokeStyle = C.trim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(top[0], top[1] - 3, 6 * b, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
  const pulse = 1 + Math.sin((anim.t || 0) * 3) * 0.12 + (anim.act && anim.act.kind === 'cast' ? Math.sin(clamp(anim.act.p, 0, 1) * Math.PI) * 0.9 : 0);
  glowBall(ctx, top[0], top[1] - 5, 5 * b * pulse, C.orb || '#8fd6ff');
}
function bow(ctx, hf, hn, C, anim) {
  const drawn = anim.act && anim.act.kind === 'shoot' ? clamp(anim.act.p, 0, 1) : 0;
  const pull = drawn < 0.6 ? ease.out(drawn / 0.6) : 0;
  ctx.save(); ctx.translate(hf[0], hf[1]);
  ctx.strokeStyle = C.wood || '#7a5230'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -30); ctx.quadraticCurveTo(10, 0, -4, 30); ctx.stroke();
  ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-3, -28); ctx.quadraticCurveTo(10, 0, -3, 28); ctx.stroke();
  const sx = -4 - pull * 18;
  ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(sx, 0); ctx.lineTo(-4, 30); ctx.stroke();
  if (pull > 0.05) { ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(16, 0); ctx.stroke(); ctx.fillStyle = '#cfd6de'; ctx.beginPath(); ctx.moveTo(16, -2); ctx.lineTo(21, 0); ctx.lineTo(16, 2); ctx.fill(); }
  ctx.restore();
}
// glowBall (hand glow, staff orb) is in util.js since R5: art-fx.js draws charge-ups and bolts with it too

// ------------------------------------------------------------------ quadrupeds
/** anim: { t, walk, phase, act, flash, dead, flip } */
export function drawBeast(ctx, x, y, s, look, anim) {
  if (look.kind === 'hawk') return drawHawk(ctx, x, y, s, look, anim);
  const k = look.kind; const z = look.size || 1;
  ctx.save(); ctx.translate(x, y); ctx.scale((anim.flip ? -1 : 1) * s * z, s * z);
  if (anim.dead) { ctx.rotate(ease.out(clamp(anim.dead, 0, 1)) * 0.2); ctx.scale(1, 1 - ease.out(clamp(anim.dead, 0, 1)) * 0.45); }
  const t = anim.t || 0; const walk = anim.walk || 0; const ph = anim.phase || t * 2;
  const L = k === 'boar' ? 16 : k === 'rat' ? 10 : k === 'lizard' ? 10 : k === 'bear' ? 20 : 22; // leg length
  const bodyLen = k === 'boar' ? 52 : k === 'bear' ? 56 : k === 'rat' ? 40 : k === 'lizard' ? 58 : k === 'cat' ? 56 : 54;
  const bodyH = k === 'boar' ? 26 : k === 'bear' ? 30 : k === 'cat' ? 17 : k === 'lizard' ? 13 : 19;
  let lunge = 0; let rear = 0;
  if (anim.act) {
    const p = clamp(anim.act.p, 0, 1);
    if (anim.act.kind === 'melee' || anim.act.kind === 'cast' || anim.act.kind === 'shoot') { lunge = Math.sin(p * Math.PI) * 14; rear = Math.sin(p * Math.PI) * 0.12; }
    if (anim.act.kind === 'hit') { lunge = -Math.sin(p * Math.PI) * 8; }
  }
  const bob = walk ? Math.abs(Math.sin(ph)) * -2 : Math.sin(t * 2.4) * 0.6;
  const by = -L - bodyH * 0.55 + bob;
  ctx.translate(lunge, 0); ctx.rotate(-rear);
  const legs = [[-bodyLen * 0.32, 0], [bodyLen * 0.3, Math.PI]];
  const dark = shade(look.fur, -0.3);
  // far legs
  for (const [lx, off] of legs) leg(ctx, lx - 3, by + bodyH * 0.3, L, walk ? Math.sin(ph + off + Math.PI) * 0.5 : 0.05, dark, k);
  // tail
  ctx.strokeStyle = look.fur; ctx.lineCap = 'round';
  if (k === 'wolf' || k === 'cat') { ctx.lineWidth = k === 'wolf' ? 7 : 4.5; ctx.beginPath(); ctx.moveTo(-bodyLen * 0.48, by - 2); ctx.quadraticCurveTo(-bodyLen * 0.75, by - 6 + Math.sin(t * 3) * 4, -bodyLen * (k === 'cat' ? 0.95 : 0.78), by + (k === 'cat' ? -18 : 6) + Math.sin(t * 3) * 3); ctx.stroke(); }
  if (k === 'lizard') { ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-bodyLen * 0.45, by + 2); ctx.quadraticCurveTo(-bodyLen * 0.8, by + 10, -bodyLen * 1.05, by + 14 + Math.sin(t * 3) * 3); ctx.stroke(); }
  if (k === 'rat') { ctx.lineWidth = 2; ctx.strokeStyle = shade(look.fur, 0.3); ctx.beginPath(); ctx.moveTo(-bodyLen * 0.45, by + 2); ctx.quadraticCurveTo(-bodyLen * 0.8, by + 14, -bodyLen * 1.1, by + 4); ctx.stroke(); }
  // body
  const g = ctx.createLinearGradient(0, by - bodyH, 0, by + bodyH);
  g.addColorStop(0, shade(look.fur, 0.15)); g.addColorStop(0.6, look.fur); g.addColorStop(1, look.belly || shade(look.fur, 0.2));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, by, bodyLen * 0.5, bodyH * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  if (k === 'boar' || k === 'bear') { ctx.beginPath(); ctx.ellipse(bodyLen * 0.22, by - bodyH * 0.15, bodyLen * 0.3, bodyH * 0.62, -0.1, 0, Math.PI * 2); ctx.fill(); }
  if (look.spikes || k === 'boar') { ctx.fillStyle = shade(look.fur, -0.45); for (let i = 0; i < 7; i++) { const sx = -bodyLen * 0.3 + i * 8; ctx.beginPath(); ctx.moveTo(sx - 3, by - bodyH * 0.45); ctx.lineTo(sx + 1, by - bodyH * (0.85 + (i % 2) * 0.15)); ctx.lineTo(sx + 4, by - bodyH * 0.45); ctx.fill(); } }
  if (look.glowCracks) { ctx.strokeStyle = rgba(look.glowCracks, 0.8); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-10, by - 4); ctx.lineTo(-2, by + 2); ctx.lineTo(8, by - 3); ctx.moveTo(-18, by + 5); ctx.lineTo(-10, by + 8); ctx.stroke(); }
  ctx.fillStyle = rgba('#ffffff', 0.08); ctx.beginPath(); ctx.ellipse(4, by - bodyH * 0.3, bodyLen * 0.35, bodyH * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  // near legs
  for (const [lx, off] of legs) leg(ctx, lx + 3, by + bodyH * 0.3, L, walk ? Math.sin(ph + off) * 0.5 : -0.04, look.fur, k);
  // head
  const hx = bodyLen * 0.5; const hy = by - bodyH * (k === 'cat' ? 0.45 : k === 'lizard' ? 0.1 : 0.5);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(anim.act && anim.act.kind !== 'hit' ? 0.15 : 0);
  ctx.fillStyle = look.fur;
  if (k === 'wolf') {
    ctx.beginPath(); ctx.ellipse(2, 0, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(22, 1); ctx.lineTo(20, 6); ctx.lineTo(4, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-2, -17); ctx.lineTo(4, -7); ctx.fill();
    ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(21.5, 2, 2, 0, Math.PI * 2); ctx.fill();
  } else if (k === 'cat') {
    ctx.beginPath(); ctx.ellipse(3, 0, 10, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(17, 1); ctx.lineTo(9, 6); ctx.fill();
    for (const ex of [-4, 4]) { ctx.beginPath(); ctx.moveTo(ex - 3, -6); ctx.lineTo(ex, -15); ctx.lineTo(ex + 3, -6); ctx.fill(); }
  } else if (k === 'boar' || k === 'bear') {
    ctx.beginPath(); ctx.ellipse(4, 2, 13, 11, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(look.fur, -0.2); ctx.beginPath(); ctx.ellipse(16, 6, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (k === 'boar') { ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.moveTo(12, 8); ctx.quadraticCurveTo(20, 6, 18, -2); ctx.lineTo(15, 6); ctx.fill(); }
    ctx.fillStyle = look.fur; ctx.beginPath(); ctx.arc(-4, -8, 4, 0, Math.PI * 2); ctx.fill();
  } else if (k === 'rat') {
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(16, 2); ctx.lineTo(-6, 7); ctx.fill();
    ctx.fillStyle = '#d8a0a0'; ctx.beginPath(); ctx.arc(-2, -7, 4, 0, Math.PI * 2); ctx.fill();
  } else if (k === 'lizard') {
    ctx.beginPath(); ctx.ellipse(6, 0, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(look.fur, -0.3); ctx.fillRect(4, 3, 14, 1.5);
  }
  // eye
  const ex = k === 'boar' || k === 'bear' ? 6 : k === 'lizard' ? 8 : 6; const ey = k === 'boar' ? -2 : -2;
  ctx.fillStyle = look.eye; ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill();
  const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 8); eg.addColorStop(0, rgba(look.eye, 0.5)); eg.addColorStop(1, rgba(look.eye, 0));
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (anim.flash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = rgba('#ffffff', anim.flash * 0.75); ctx.fillRect(-80, -90, 160, 100); }
  ctx.restore();
}
function leg(ctx, x, y, L, ang, col, k) {
  const w = k === 'boar' || k === 'bear' ? 8 : k === 'rat' ? 3.5 : 6;
  const knee = [x + Math.sin(ang) * L * 0.55, y + Math.cos(ang) * L * 0.55];
  const foot = [knee[0] + Math.sin(ang * 0.4) * L * 0.5, knee[1] + L * 0.5];
  seg(ctx, x, y, knee[0], knee[1], w, col); seg(ctx, knee[0], knee[1], foot[0], foot[1], w * 0.8, col);
  ctx.fillStyle = shade(col, -0.35); ctx.beginPath(); ctx.ellipse(foot[0] + 2, foot[1] - 1, w * 0.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
}

/** The hawk flies 70 units above its feet (x, y), bobbing; anim.portrait: its body at (x, y) itself, still (drawPortrait). */
export function drawHawk(ctx, x, y, s, look, anim) {
  const t = anim.t || 0; const flap = Math.sin(t * (anim.walk ? 11 : 7)) ;
  ctx.save(); ctx.translate(x, anim.portrait ? y : y - 70 * s + Math.sin(t * 2) * 4 * s); ctx.scale((anim.flip ? -1 : 1) * s * (look.size || 1), s * (look.size || 1));
  if (anim.act && anim.act.kind !== 'hit') { const p = clamp(anim.act.p, 0, 1); ctx.translate(Math.sin(p * Math.PI) * 30, Math.sin(p * Math.PI) * 30); }
  const wing = (dir) => { ctx.fillStyle = dir > 0 ? look.fur : shade(look.fur, -0.3); ctx.beginPath(); ctx.moveTo(-4, -2); ctx.quadraticCurveTo(-14, -26 * flap * dir - 6, -34, -18 * flap * dir - 2); ctx.quadraticCurveTo(-18, 2, -4, 4); ctx.fill(); };
  wing(-1);
  ctx.fillStyle = look.fur; ctx.beginPath(); ctx.ellipse(0, 0, 15, 7, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.belly; ctx.beginPath(); ctx.ellipse(2, 3, 10, 3.5, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.fur; ctx.beginPath(); ctx.arc(14, -4, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c060'; ctx.beginPath(); ctx.moveTo(19, -5); ctx.lineTo(25, -2); ctx.lineTo(19, -1); ctx.fill();
  ctx.fillStyle = look.eye; ctx.beginPath(); ctx.arc(16, -5.5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(look.fur, -0.2); ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-26, -6); ctx.lineTo(-26, 4); ctx.fill();
  wing(1);
  ctx.restore();
}

// ------------------------------------------------------------------ boss and shards
export function drawBoss(ctx, x, y, s, anim) {
  const t = anim.t || 0; const phase = anim.bossPhase || 1;
  const R = 120 * s;
  const cy = y - 210 * s + Math.sin(t * 0.8) * 8 * s;
  ctx.save();
  // corona
  const corona = phase === 3 ? '#ff7a5a' : '#ffd27a';
  for (let i = 0; i < 3; i++) {
    const r = R * (1.25 + i * 0.32 + Math.sin(t * 1.3 + i) * 0.03);
    const g = ctx.createRadialGradient(x, cy, R * 0.9, x, cy, r * 1.25);
    g.addColorStop(0, rgba(corona, 0.45 - i * 0.12)); g.addColorStop(1, rgba(corona, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, r * 1.25, 0, Math.PI * 2); ctx.fill();
  }
  // rays
  ctx.save(); ctx.translate(x, cy); ctx.rotate(t * 0.05);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2; const len = R * (1.5 + 0.35 * Math.sin(t * 2 + i * 1.7));
    ctx.strokeStyle = rgba(corona, 0.12); ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke();
  }
  ctx.restore();
  // orbiting rings (observatory brass): back halves behind the star
  const ring = (i, front) => {
    ctx.save(); ctx.translate(x, cy); ctx.rotate(-0.35 + i * 0.7 + Math.sin(t * 0.2 + i) * 0.05); ctx.scale(1, 0.26);
    const rr = R * (1.5 + i * 0.28);
    ctx.strokeStyle = rgba('#c9a45a', front ? 0.85 : 0.45); ctx.lineWidth = (front ? 6 : 5) * s / 0.26 * 0.26;
    ctx.beginPath(); ctx.arc(0, 0, rr, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba('#fff0c0', front ? 0.45 : 0.2); ctx.lineWidth = 1.5 * s; ctx.stroke();
    // a rune marker riding the ring
    const a = (t * (i ? -0.4 : 0.3) + i * 2) % (Math.PI * 2);
    const onFront = Math.sin(a) > 0;
    if (onFront === front) { ctx.fillStyle = rgba('#ffe6a0', 0.9); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 7 * s / 0.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  ring(0, false); ring(1, false);
  // the dark star
  const core = ctx.createRadialGradient(x - R * 0.25, cy - R * 0.3, R * 0.05, x, cy, R);
  core.addColorStop(0, '#2a2140'); core.addColorStop(0.7, '#0a0812'); core.addColorStop(1, '#020104');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(corona, 0.9); ctx.lineWidth = 2.5 * s; ctx.shadowColor = corona; ctx.shadowBlur = 25 * s;
  ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  // cracks of light
  ctx.strokeStyle = rgba('#9fd0ff', 0.55 + 0.25 * Math.sin(t * 3)); ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(x - R * 0.6, cy - R * 0.2); ctx.lineTo(x - R * 0.2, cy - R * 0.05); ctx.lineTo(x - R * 0.05, cy + R * 0.35); ctx.moveTo(x + R * 0.2, cy - R * 0.6); ctx.lineTo(x + R * 0.35, cy - R * 0.15); ctx.lineTo(x + R * 0.7, cy - R * 0.05); ctx.stroke();
  // the eye
  const look = Math.sin(t * 0.7) * R * 0.08;
  const eg = ctx.createRadialGradient(x - R * 0.25 + look, cy, 0, x - R * 0.25 + look, cy, R * 0.32);
  eg.addColorStop(0, rgba('#ffffff', 0.95)); eg.addColorStop(0.2, rgba(phase === 3 ? '#ff8a6a' : '#9fd0ff', 0.9)); eg.addColorStop(1, rgba('#9fd0ff', 0));
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x - R * 0.25 + look, cy, R * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.ellipse(x - R * 0.25 + look, cy, R * 0.035, R * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ring(0, true); ring(1, true);
  // tendrils toward the ground
  ctx.strokeStyle = rgba('#120c20', 0.85); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const sx = x - R * 0.6 + i * R * 0.3; ctx.lineWidth = (10 - i % 3 * 2) * s;
    ctx.beginPath(); ctx.moveTo(sx, cy + R * 0.85); ctx.quadraticCurveTo(sx + Math.sin(t * 1.5 + i) * 30 * s, cy + R * 1.5, sx + Math.sin(t + i) * 20 * s, y + 4 * s); ctx.stroke();
  }
  if (anim.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ffffff', anim.flash * 0.35); ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  return { cx: x, cy, R };
}

export function drawShard(ctx, x, y, s, anim) {
  const t = anim.t || 0; const fy = y - 70 * s + Math.sin(t * 2 + x) * 6 * s;
  ctx.save(); ctx.translate(x, fy); ctx.rotate(Math.sin(t + x) * 0.15); ctx.scale(s, s);
  if (anim.dead) { ctx.globalAlpha *= 1 - clamp(anim.dead, 0, 1); ctx.scale(1 + anim.dead, 1 + anim.dead); }
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 60);
  g.addColorStop(0, 'rgba(160,140,255,0.45)'); g.addColorStop(1, 'rgba(160,140,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();
  const lg = ctx.createLinearGradient(-14, 0, 14, 0);
  lg.addColorStop(0, '#1a1430'); lg.addColorStop(0.5, '#4a3a8a'); lg.addColorStop(1, '#120e22');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(14, -6); ctx.lineTo(6, 34); ctx.lineTo(-8, 30); ctx.lineTo(-14, -4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(200,190,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(2, 30); ctx.stroke();
  if (anim.flash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = rgba('#ffffff', anim.flash * 0.8); ctx.fillRect(-20, -50, 40, 90); }
  ctx.restore();
}

// ------------------------------------------------------------------ portraits
/** Draw a head-and-shoulders portrait of a look into a square canvas context. */
export function drawPortrait(ctx, size, look, kind = 'humanoid', extra = {}) {
  ctx.save();
  const bg = ctx.createRadialGradient(size * 0.5, size * 0.35, size * 0.1, size * 0.5, size * 0.5, size * 0.75);
  bg.addColorStop(0, extra.bg1 || '#3a3328'); bg.addColorStop(1, extra.bg2 || '#0d0b09');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  // the hawk flies above its feet: in a portrait its body sits in the frame, head and raised wing in view (BACKLOG 2026-11-12)
  if (kind === 'beast' && look && look.kind === 'hawk') drawHawk(ctx, size * 0.4, size * 0.6, size / 52, look, { t: 1, portrait: true });
  else if (kind === 'beast') drawBeast(ctx, size * 0.28, size * 1.02, size / 52, look, { t: 1 });
  else if (kind === 'boss') { ctx.save(); drawBoss(ctx, size * 0.55, size * 1.25, size / 300, { t: 1, bossPhase: 1 }); ctx.restore(); }
  else if (kind === 'shard') drawShard(ctx, size * 0.5, size * 1.15, size / 90, { t: 1 });
  else drawHumanoid(ctx, size * 0.44, size * 2.05, size / 50, look, { t: 1.3 });
  ctx.restore();
}
