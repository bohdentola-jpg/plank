// THE GREENHOUSE - the glass house behind the school. Nothing here moves:
// three stone planters, a ladder of potting shelves like a platformer level,
// and two sunken pools of plant food that somebody mixed far too strong.

import { W, H } from '../core/config.js';
import { TAU, clamp } from '../core/util.js';
import { mkSolid, mkPlat } from '../game/physics.js';
import { Entity } from '../game/entities.js';
import { OUT, rr, fs, vgrad, cloud, circle, ellipse, rrect, polygon, line, curve, limb } from '../core/gfx.js';

const DEEP = 26, GOO_Y = 7, BASE = 70;          // pool beds sit this far below the planter tops; goo level; slab thickness
const BLOCKS = [[-320, 174], [-58, 116], [146, 174]];             // planters: x, w (tops at y 0)
const POOLS = [[-146, 88], [58, 88]];                             // pools: x, w (beds at y DEEP)
const SHELVES = [[-300, -80, 110], [-150, -160, 120], [40, -100, 110], [190, -190, 120], [-40, -270, 80]];   // x, y, w

const STONE = '#aab2a7', STONE_D = '#7c877f', STONE_L = '#ccd3c8', PIT = '#5f6b63';
const MOSS = '#6fcf4a', MOSS_L = '#b2f07a', MOSS_D = '#3d9636';
const GOO = '#8ee03a', GOO_L = '#d6fb80', GOO_D = '#4aa628';
const WOOD = '#c98b4b', WOOD_L = '#ecb673', WOOD_D = '#8a5629';
const POT = '#dd7a4c', LEAF = '#5cbb4c', LEAF_D = '#2e8538';

// The pools. One hazard covers both; it is parked far off-stage so CPUs do not
// treat it as an incoming attack - only the shapes matter to the hit code.
class Goo extends Entity {
  constructor(stage, dmg) {
    super({ layer: 'back', x: 0, y: 9000 });
    this.stage = stage;
    this.hit = { dmg, ang: 90, set: 70, stun: -14, fx: 'goo', sfx: 'splat', rehit: 35 };
    this.shapes = POOLS.map(([x, w]) => ({ x: x + 3, y: GOO_Y + 2, w: w - 6, h: DEEP - GOO_Y - 2 }));
  }
  hitShapes() { return this.shapes; }
  onHit(t, res, m) {
    m.fx.drops(t.x, GOO_Y, 5, GOO);
    for (let i = 0; i < 3; i++) m.fx.bubble(t.x + (i - 1) * 13, GOO_Y + 6, 3 + i);
    m.sfx('bubble', { vol: 0.5 });
    if (res !== 'hit') return;
    // The pop is straight up, but the goo spits you toward the bank you were
    // heading for (or the nearer one) instead of juggling you where you stand.
    const pool = POOLS.find(([x, w]) => t.x >= x - 24 && t.x <= x + w + 24) || POOLS[0];
    const v = t.vx + t.kx, dir = Math.abs(v) > 1 ? Math.sign(v) : (t.x >= pool[0] + pool[1] / 2 ? 1 : -1);
    const goal = dir > 0 ? pool[0] + pool[1] + 22 : pool[0] - 22;
    this.stage.pops.set(t, clamp((goal - t.x) / 20, -4.2, 4.2));
  }
}

// ---- world art ---------------------------------------------------------------
function gooPath(ctx, x, w, t) {
  ctx.beginPath(); ctx.moveTo(x, DEEP); ctx.lineTo(x, GOO_Y);
  for (let i = 1; i <= 10; i++) { const px = x + (w * i) / 10; ctx.lineTo(px, GOO_Y + Math.sin(px * 0.13 + t * 0.07) * 1.3); }
  ctx.lineTo(x + w, DEEP); ctx.closePath();
}

function slabPath(ctx) {
  const L = -320, R = 320;
  ctx.beginPath(); ctx.moveTo(L, BASE - 9); ctx.lineTo(L, 6); ctx.quadraticCurveTo(L, 0, L + 6, 0);
  for (const [x, w] of POOLS) { ctx.lineTo(x, 0); ctx.lineTo(x, DEEP); ctx.lineTo(x + w, DEEP); ctx.lineTo(x + w, 0); }
  ctx.lineTo(R - 6, 0); ctx.quadraticCurveTo(R, 0, R, 6); ctx.lineTo(R, BASE - 9);
  ctx.quadraticCurveTo(R, BASE, R - 10, BASE); ctx.lineTo(L + 10, BASE); ctx.quadraticCurveTo(L, BASE, L, BASE - 9); ctx.closePath();
}

function drawSlab(ctx, t) {
  const L = -320, R = 320;
  // roots under the floating bed
  for (const [x, len, s] of [[-250, 34, 6], [-120, 22, -5], [20, 40, 5], [150, 26, -6], [262, 32, 5]]) {
    curve(ctx, [x, BASE - 2, x + s, BASE + len * 0.5, x - s * 0.6, BASE + len], '#8a6a4a', 3.2);
  }
  // pit walls behind the goo
  for (const [x, w] of POOLS) { ctx.fillStyle = PIT; ctx.fillRect(x - 1, 1, w + 2, DEEP); }
  for (const [x, w] of POOLS) { gooPath(ctx, x, w, t); ctx.fillStyle = GOO; ctx.fill(); }
  // the stone bed: one outline that dips down into both pools
  slabPath(ctx);
  ctx.fillStyle = STONE; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = STONE_D; ctx.fillRect(L, 52, R - L, 20);
  ctx.fillStyle = STONE_L; ctx.fillRect(L, 12, R - L, 5);
  // masonry joints
  ctx.strokeStyle = '#8b958c'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(L, 38); ctx.lineTo(R, 38);
  for (const x of [-272, -190, -34, 34, 190, 272]) { ctx.moveTo(x, 17); ctx.lineTo(x, 38); }
  for (const x of [-294, -232, -168, -102, -36, 30, 96, 162, 228, 290]) { ctx.moveTo(x, 38); ctx.lineTo(x, 52); }
  ctx.stroke();
  // worn carvings on the planter fronts: a spiral, a leaf, a sun
  ctx.strokeStyle = STONE_D; ctx.lineWidth = 2.6; ctx.beginPath();
  ctx.moveTo(-224.6, 30.1); ctx.arc(-232, 27, 8, 0.4, TAU * 0.9); ctx.moveTo(-228, 27); ctx.arc(-232, 27, 4, 0, Math.PI * 1.2);
  ctx.moveTo(0, 35); ctx.quadraticCurveTo(-11, 26, 0, 18); ctx.quadraticCurveTo(11, 26, 0, 35); ctx.moveTo(0, 35); ctx.lineTo(0, 22);
  ctx.moveTo(238, 27); ctx.arc(232, 27, 6, 0, TAU);
  for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; ctx.moveTo(232 + Math.cos(a) * 9, 27 + Math.sin(a) * 9); ctx.lineTo(232 + Math.cos(a) * 12, 27 + Math.sin(a) * 12); }
  ctx.stroke();
  ctx.restore();
  slabPath(ctx); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  // mossy tops: the bright edge you stand on
  for (const [x, w] of BLOCKS) {
    for (const d of [18, w * 0.5 + 9, w - 24]) ellipse(ctx, x + d, 6, 7, 6.5, MOSS, OUT, 2.4);
    rrect(ctx, x - 3, -4, w + 6, 11, 5.5, MOSS, OUT, 2.6);
    rr(ctx, x + 1, -2.4, w - 2, 3.4, 1.7); ctx.fillStyle = MOSS_L; ctx.fill();
    for (const d of [30, w - 38]) polygon(ctx, [x + d - 5, -3, x + d - 3, -10, x + d, -4, x + d + 2, -11, x + d + 5, -3], MOSS_D, null, 0);
  }
}

// the goo in front of anyone wading in it, so their shins are under the surface
function drawGooFront(ctx, t) {
  for (const [x, w] of POOLS) {
    gooPath(ctx, x, w, t);
    ctx.fillStyle = 'rgba(142,224,58,0.8)'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = GOO_D; ctx.fillRect(x, DEEP - 5, w, 6);
    ctx.fillStyle = GOO_L;
    for (let i = 0; i < 3; i++) { rr(ctx, x + 9 + i * 31 + Math.sin(t * 0.04 + i * 2) * 3, GOO_Y + 3.6, 15, 2.6, 1.3); ctx.fill(); }
    // slow bubbles that rise and pop
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.011 + i * 0.37) % 1, bx = x + 16 + ((i * 37) % (w - 30));
      ctx.beginPath(); ctx.arc(bx, DEEP - 3 - u * (DEEP - GOO_Y - 7), 1.6 + u * 2.6, 0, TAU);
      ctx.strokeStyle = GOO_L; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.restore();
    // surface line
    ctx.beginPath(); ctx.moveTo(x, GOO_Y);
    for (let i = 1; i <= 10; i++) { const px = x + (w * i) / 10; ctx.lineTo(px, GOO_Y + Math.sin(px * 0.13 + t * 0.07) * 1.3); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineCap = 'butt'; ctx.stroke();
  }
}

function vine(ctx, x, y, len, s) {
  curve(ctx, [x, y, x + s, y + len * 0.5, x - s * 0.5, y + len], LEAF_D, 2.6);
  for (let i = 1; i <= 3; i++) {
    const u = i / 3, px = x + Math.sin(u * 3) * s * 0.7, py = y + len * u;
    ellipse(ctx, px + (i % 2 ? 5 : -5), py - 3, 5.2, 2.8, LEAF, LEAF_D, 1.6, i % 2 ? 0.5 : -0.5);
  }
}

function sprout(ctx, x, y) {
  line(ctx, x, y - 14, x, y - 25, LEAF_D, 2.6);
  ellipse(ctx, x - 5.5, y - 26, 6.5, 3.2, LEAF, OUT, 1.7, -0.5); ellipse(ctx, x + 5.5, y - 28, 6.5, 3.2, LEAF, OUT, 1.7, 0.5);
  polygon(ctx, [x - 7.5, y - 11, x + 7.5, y - 11, x + 5.5, y, x - 5.5, y], POT, OUT, 2);
  rrect(ctx, x - 9, y - 15, 18, 5, 2, POT, OUT, 2);
}

function drawShelf(ctx, x, y, w) {
  for (const [bx, d] of [[x + 15, 1], [x + w - 15, -1]]) {
    limb(ctx, [bx, y + 7, bx, y + 27], 4, WOOD_D, OUT, 2);
    limb(ctx, [bx, y + 27, bx + d * 15, y + 9], 3.4, WOOD_D, OUT, 2);
  }
  rrect(ctx, x - 5, y, w + 10, 11, 3.5, WOOD, OUT, 2.6);
  rr(ctx, x - 2.5, y + 1.6, w + 5, 3.2, 1.6); ctx.fillStyle = WOOD_L; ctx.fill();
  line(ctx, x + w * 0.28, y + 7.6, x + w * 0.52, y + 7.6, WOOD_D, 1.6);
  line(ctx, x + w * 0.64, y + 7.6, x + w * 0.76, y + 7.6, WOOD_D, 1.6);
}

function drawShelves(ctx) {
  vine(ctx, -296, -70, 44, 7); vine(ctx, -34, -150, 56, -8); vine(ctx, 148, -90, 38, 6); vine(ctx, 196, -180, 50, -7);
  for (const [x, y, w] of SHELVES) drawShelf(ctx, x, y, w);
  sprout(ctx, 296, -190); sprout(ctx, -288, -80);
}

// ---- the glass house behind it all (screen space) ------------------------------
const EAVE = 112, SILL = 420, RIDGE = -34;
const FRAME = '#f6fbf7', FRAME_D = '#9fc8b2';

function bgPlant(ctx, kind, x, y) {
  const pot = '#e3a184', potD = '#c07f62', g1 = '#8fd07c', g2 = '#63b266';
  if (kind === 0) {                // fern
    for (let i = -2; i <= 2; i++) ellipse(ctx, x + i * 9, y - 30 - (2 - Math.abs(i)) * 7, 5, 16, i % 2 ? g1 : g2, null, 0, i * 0.38);
  } else if (kind === 1) {         // sunflower
    line(ctx, x, y - 14, x, y - 62, g2, 4);
    ellipse(ctx, x + 9, y - 36, 9, 4, g1, null, 0, -0.5);
    circle(ctx, x, y - 66, 13, '#f7d75a', null, 0); circle(ctx, x, y - 66, 6, '#b98a56', null, 0);
  } else if (kind === 2) {         // cactus
    rrect(ctx, x - 7, y - 50, 14, 38, 7, g2, null, 0);
    rrect(ctx, x + 5, y - 38, 12, 6, 3, g2, null, 0); rrect(ctx, x + 12, y - 46, 6, 14, 3, g2, null, 0);
  } else {                         // tomato vine on a stake
    line(ctx, x, y - 14, x, y - 70, '#c9a877', 3);
    for (let i = 0; i < 4; i++) ellipse(ctx, x + (i % 2 ? 9 : -9), y - 24 - i * 11, 9, 5, i % 2 ? g1 : g2, null, 0, i % 2 ? -0.4 : 0.4);
    circle(ctx, x - 7, y - 34, 4.5, '#f08a6a', null, 0); circle(ctx, x + 8, y - 50, 4.5, '#f08a6a', null, 0);
  }
  polygon(ctx, [x - 11, y - 16, x + 11, y - 16, x + 8, y, x - 8, y], pot, potD, 2);
}

function drawBackdrop(ctx, t, cx, cy) {
  const fx = -cx * 0.05, fy = -(cy + 90) * 0.05;       // far: sky and the school
  const nx = -cx * 0.16, ny = -(cy + 90) * 0.16;       // near: the glass wall and its bench
  vgrad(ctx, 0, 0, W, H, ['#7fcdf6', '#bfe8fb', '#eaf8ec']);
  circle(ctx, 655 + fx, 84 + fy, 36, '#fff7c9', null, 0);
  for (let i = 0; i < 4; i++) {
    const x = ((i * 290 + t * (0.05 + i * 0.012)) % (W + 320)) - 160;
    cloud(ctx, x + fx, 150 + i * 46 + fy, 1.25 - i * 0.14, '#ffffff');
  }
  ctx.save(); ctx.translate(fx, fy);
  // the school the greenhouse is hiding behind
  ctx.fillStyle = '#e8c7b2'; ctx.fillRect(-60, 238, 420, 220);
  ctx.fillStyle = '#d6ad97'; ctx.fillRect(-60, 229, 430, 11);
  ctx.fillStyle = '#d3ecf7';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) ctx.fillRect(-40 + c * 68, 260 + r * 62, 42, 34);
  // trees and a hedge
  ctx.fillStyle = '#c3a98a'; ctx.fillRect(527, 320, 10, 100); ctx.fillRect(687, 300, 10, 120);
  circle(ctx, 532, 300, 46, '#a9d990', null, 0); circle(ctx, 692, 280, 54, '#b6e09c', null, 0);
  ctx.fillStyle = '#bfe3a4'; ctx.beginPath(); ctx.moveTo(-80, 470);
  for (let x = -80; x <= W + 80; x += 44) ctx.arc(x, 404 + ((x / 44) & 1) * 7, 28, Math.PI, 0);
  ctx.lineTo(W + 80, 470); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.save(); ctx.translate(nx, ny);
  // glass: a faint sheen, a bluer roof, a few glints
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(-120, EAVE, W + 240, SILL - EAVE);
  ctx.fillStyle = 'rgba(110,190,240,0.2)'; ctx.fillRect(-120, -140, W + 240, EAVE + 140);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (const [gx, gy] of [[58, 160], [292, 230], [516, 146], [716, 250]]) {
    ctx.beginPath(); ctx.moveTo(gx, gy + 62); ctx.lineTo(gx + 36, gy); ctx.lineTo(gx + 52, gy); ctx.lineTo(gx + 16, gy + 62); ctx.closePath(); ctx.fill();
  }
  // low wall under the glass
  ctx.fillStyle = '#d2c3a6'; ctx.fillRect(-120, SILL, W + 240, 330);
  ctx.fillStyle = '#bfae8e';
  for (let i = 0; i < 5; i++) ctx.fillRect(-120, SILL + 34 + i * 36, W + 240, 3);
  // white frame: uprights, roof bars, rails
  ctx.beginPath();
  for (let x = -106; x <= W + 110; x += 115) {
    ctx.moveTo(x, SILL); ctx.lineTo(x, EAVE); ctx.lineTo(W / 2 + (x - W / 2) * 0.84, RIDGE - 110);
  }
  for (const y of [EAVE, 268, (EAVE + RIDGE) / 2, RIDGE]) { ctx.moveTo(-120, y); ctx.lineTo(W + 120, y); }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  ctx.strokeStyle = FRAME_D; ctx.lineWidth = 9.5; ctx.stroke();
  ctx.strokeStyle = FRAME; ctx.lineWidth = 6; ctx.stroke();
  // a vine along the eave
  ctx.strokeStyle = '#6fb86a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, EAVE + 6);
  for (let x = 0; x <= 330; x += 30) ctx.quadraticCurveTo(x - 15, EAVE + 14, x, EAVE + 6 + ((x / 30) & 1) * 4);
  ctx.stroke();
  for (let x = 6; x <= 320; x += 26) ellipse(ctx, x, EAVE + 14 + ((x / 26) & 1) * 5, 7, 3.6, x % 52 ? '#8fd07c' : '#63b266', null, 0, (x % 3) - 1);
  // potting bench along the sill
  ctx.fillStyle = '#a97c4c'; ctx.fillRect(-120, SILL - 4, W + 240, 12);
  ctx.fillStyle = '#c99a63'; ctx.fillRect(-120, SILL - 8, W + 240, 6);
  [[36, 0], [96, 3], [168, 1], [330, 2], [396, 0], [470, 3], [548, 1], [760, 2]].forEach(([x, k]) => bgPlant(ctx, k, x, SILL - 8));
  // the jug that started it
  rrect(ctx, 232, SILL - 52, 34, 44, 6, '#e9e38a', '#bdb45c', 2);
  rrect(ctx, 242, SILL - 60, 14, 10, 3, '#bdb45c', null, 0);
  ellipse(ctx, 249, SILL - 31, 9, 5.5, '#8fd07c', '#63b266', 2, -0.6);
  rrect(ctx, 262, SILL - 16, 6, 22, 3, GOO, null, 0);
  // watering can
  line(ctx, 664, SILL - 30, 706, SILL - 54, '#5d95cf', 6); rrect(ctx, 700, SILL - 62, 14, 12, 3, '#86b8e8', '#5d95cf', 2);
  ctx.beginPath(); ctx.arc(628, SILL - 36, 17, Math.PI * 0.5, Math.PI * 1.5); ctx.strokeStyle = '#5d95cf'; ctx.lineWidth = 5; ctx.stroke();
  rrect(ctx, 626, SILL - 56, 44, 48, 7, '#86b8e8', '#5d95cf', 2.4);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(633, SILL - 50, 6, 34);
  ctx.restore();

  // hanging baskets, a little nearer still
  ctx.save(); ctx.translate(-cx * 0.24, -(cy + 90) * 0.24);
  for (const [x, y] of [[126, 168], [596, 140], [748, 226]]) {
    ctx.strokeStyle = '#b79a72'; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.moveTo(x - 20, y); ctx.lineTo(x, y - 46); ctx.lineTo(x + 20, y); ctx.moveTo(x, y - 46); ctx.lineTo(x, -160); ctx.stroke();
    circle(ctx, x - 9, y - 7, 13, '#8fd07c', null, 0); circle(ctx, x + 10, y - 9, 14, '#7cc47a', null, 0); circle(ctx, x, y - 16, 12, '#a3dc8c', null, 0);
    for (const [dx, dy, c] of [[-12, -12, '#ff9fc0'], [4, -22, '#ffe27a'], [15, -10, '#ff9fc0']]) circle(ctx, x + dx, y + dy, 4, c, null, 0);
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI); ctx.closePath(); fs(ctx, '#e3936a', '#b96a44', 2.4);
    ctx.strokeStyle = '#63b266'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(x - 19, y + 2); ctx.quadraticCurveTo(x - 30, y + 20, x - 22, y + 40); ctx.moveTo(x + 19, y + 2); ctx.quadraticCurveTo(x + 28, y + 16, x + 23, y + 30); ctx.stroke();
  }
  ctx.restore();
}

export default {
  id: 'greenhouse', name: 'THE GREENHOUSE', home: 'sunnydrizzle',
  blurb: 'Quiet, sunny, and nobody labelled the green stuff.',
  music: 'recess',
  build(m) {
    const hazards = m.rules.hazards !== false;
    const solids = [
      mkSolid(BLOCKS[0][0], 0, BLOCKS[0][1], BASE, { id: 'planterL', ledge: 'l' }),
      mkSolid(BLOCKS[1][0], 0, BLOCKS[1][1], BASE, { id: 'planterM', ledge: '' }),
      mkSolid(BLOCKS[2][0], 0, BLOCKS[2][1], BASE, { id: 'planterR', ledge: 'r' }),
      mkSolid(POOLS[0][0], DEEP, POOLS[0][1], BASE - DEEP, { id: 'poolL', ledge: '' }),
      mkSolid(POOLS[1][0], DEEP, POOLS[1][1], BASE - DEEP, { id: 'poolR', ledge: '' }),
    ];
    return {
      solids,
      plats: SHELVES.map(([x, y, w], i) => mkPlat(x, y, w, { id: 'shelf' + i })),
      blast: { l: -790, r: 790, t: -640, b: 340 },
      cam: { l: -650, r: 650, t: -520, b: 270 },
      spawns: [[-233, 0], [233, 0], [0, 0], [95, -100]],
      respawn: [100, -230],
      focusX: 0, focusY: -80, t: 0,
      pops: new Map(),          // fighter -> sideways speed while the goo is spitting them out
      init(m) { m.spawn(new Goo(this, hazards ? 5 : 1)); },      // the goo is the layout: it stays, but only stings, with hazards off
      update(m) {
        this.t++;
        if (this.t % 170 === 60) m.sfx('bubble', { vol: 0.25 });
        for (const [f, vx] of this.pops) {
          if (f.state !== 'hitstun') this.pops.delete(f);
          else if (!f.grounded) f.vx = vx;
        }
      },
      drawBg(ctx, m) { drawBackdrop(ctx, this.t, m.cam.x, m.cam.y); },
      drawMid(ctx) { drawShelves(ctx); drawSlab(ctx, this.t); },
      drawFront(ctx) { drawGooFront(ctx, this.t); },
    };
  },
  thumb(ctx, w, h, t = 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.save(); ctx.scale(w / W, h / H); drawBackdrop(ctx, t, 0, -90); ctx.restore();
    ctx.translate(w / 2, h * 0.8); ctx.scale(w / 760, w / 760);
    drawShelves(ctx); drawSlab(ctx, t); drawGooFront(ctx, t);
    ctx.restore();
  },
};
