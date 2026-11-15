// PIZZA FRIDAY - the cafeteria serving line. You fight on the tray conveyor
// while three toppings off the giant sheet pizza hover out front. Every so
// often the bell dings, the belt runs, and lunch comes through.

import { W, H } from '../core/config.js';
import { TAU, clamp } from '../core/util.js';
import { mkSolid, mkPlat } from '../game/physics.js';
import { Entity } from '../game/entities.js';
import { OUT, LW, rr, fs, txt, checker, circle, ellipse, rrect, polygon, line, gloss, shadeArc, shadow } from '../core/gfx.js';

const HALF = 300, THICK = 62;         // the counter: half width, thickness
const MOUTH = 236;                    // where the pass-through tunnels open onto the belt
const BELT_V = 1.75, WARN = 60, GAP = 52;
const STEEL = '#c7d0db', STEEL_D = '#8f9bab', STEEL_L = '#eef2f6', BELT = '#565e6e', SLAT = '#2c313c';

// ---- what the belt brings ------------------------------------------------------
const HITS = {
  pot: { dmg: 8, ang: 86, bk: 60, kg: 30, fx: 'fire', sfx: 'fire', rehit: 45 },
  ball: { dmg: 10, ang: 30, bk: 52, kg: 52, fx: 'punch', sfx: 'whop', rehit: 50 },
};
const HALFW = { pot: 21, crate: 25, ball: 17 };

function drawPot(ctx, x, t) {
  shadow(ctx, x, 1, 26, 0.2);
  rrect(ctx, x - 28, -27, 11, 8, 3, STEEL_D, OUT, 2); rrect(ctx, x + 17, -27, 11, 8, 3, STEEL_D, OUT, 2);
  rrect(ctx, x - 19, -31, 38, 31, 5, '#b9c3d0', OUT, LW);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - 14, -25, 5, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + 8, -27, 9, 25);
  ellipse(ctx, x, -31, 21, 6, STEEL_L, OUT, LW);
  ellipse(ctx, x, -31, 16.5, 3.8, '#e8613a', OUT, 1.6);
  circle(ctx, x - 7 + ((t >> 3) % 3) * 6, -31.4, 1.9, '#ffb38a', null, 0);
  // steam
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const sx = x + i * 9, ph = t * 0.12 + i * 2;
    ctx.beginPath(); ctx.moveTo(sx, -41); ctx.quadraticCurveTo(sx + Math.sin(ph) * 6, -50, sx + Math.sin(ph + 1) * 3, -59);
    ctx.strokeStyle = 'rgba(70,55,40,0.35)'; ctx.lineWidth = 5.4; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  }
}

function drawCrates(ctx, x) {
  shadow(ctx, x, 1, 30, 0.2);
  for (let i = 0; i < 2; i++) {
    const y = -22 * (i + 1), c = i ? '#f08a3c' : '#3f7fd6', d = i ? '#b85f1e' : '#285aa3';
    rrect(ctx, x - 25, y, 50, 22, 3.5, c, OUT, LW);
    ctx.fillStyle = d;
    if (i) for (let k = 0; k < 4; k++) ctx.fillRect(x - 20 + k * 11, y + 9, 7, 8);
    else { ctx.fillRect(x - 20, y + 9, 7, 8); ctx.fillRect(x + 13, y + 9, 7, 8); }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 21, y + 3, 42, 3);
  }
  rrect(ctx, x - 11, -15, 22, 11, 2, '#ffffff', OUT, 1.6);
  txt(ctx, 'MILK', x, -9, { font: 'boog', size: 9, fill: '#285aa3', stroke: null, lw: 0 });
}

function drawMeatball(ctx, x, rot) {
  shadow(ctx, x, 1, 19, 0.22);
  ctx.save(); ctx.translate(x, -17);
  circle(ctx, 0, 0, 17, '#9a5a34', OUT, LW);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.clip(); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(-17, -4); ctx.quadraticCurveTo(-9, 2, -4, -5); ctx.quadraticCurveTo(2, 4, 8, -4); ctx.quadraticCurveTo(13, 1, 17, -5);
  ctx.lineTo(17, -18); ctx.lineTo(-17, -18); ctx.closePath(); fs(ctx, '#d9482f', OUT, 1.8);          // a cap of sauce
  for (const [lx, ly, r] of [[-7, 7, 3], [6, 9, 2.4], [0, 2, 2], [10, 3, 1.8]]) circle(ctx, lx, ly, r, '#7a4222', null, 0);
  ctx.restore();
  shadeArc(ctx, 0, 0, 17, 0.18); gloss(ctx, -6, -9, 5, 2.6, 0.4);
  ctx.restore();
}

class Lunch extends Entity {
  constructor(stage, what, dir) {
    super({ layer: 'far', what, dir });
    this.stage = stage; this.half = HALFW[what];
    this.x = -dir * (MOUTH + this.half + 6); this.y = 0; this.rot = 0;
  }
  // Moved by the stage, before the fighters, so anyone riding the crates stays in step.
  step() {
    const st = this.stage, v = st.main.conv * (this.what === 'ball' ? 1.6 : 1);
    this.x += v; this.rot += v / 17;
    this.vx = this.what === 'ball' ? v : 0;       // the meatball knocks you along the belt; the pot just pops you off it
    const l = Math.max(this.x - this.half, -MOUTH), r = Math.min(this.x + this.half, MOUTH);
    if (this.what === 'crate') {
      // only the part that is out of the tunnel is solid
      const c = st.crate;
      c.on = r - l > 5; c.x = l; c.w = Math.max(1, r - l); c.vx = v;
    } else this.hit = Math.abs(this.x) < MOUTH - 6 ? HITS[this.what] : null;
    if (this.x * this.dir - this.half > MOUTH) this.leave();
  }
  leave() { this.dead = true; this.hit = null; if (this.what === 'crate') this.stage.crate.on = false; }
  update(m) {
    this.t++;
    if (this.what === 'pot' && this.hit && this.t % 10 === 0) m.fx.smoke(this.x + m.fx.r(-7, 7), -44, '#ffffff', 6);
  }
  hitShapes() {
    if (!this.hit) return null;
    return this.what === 'pot' ? [{ x: this.x - 19, y: -35, w: 38, h: 33 }] : [{ x: this.x, y: -17, r: 16 }];
  }
  onHit(t, res, m) { if (this.what === 'pot') m.fx.drops(this.x, -34, 6, '#f08a4a'); }
  draw(ctx) {
    if (this.what === 'pot') drawPot(ctx, this.x, this.t);
    else if (this.what === 'crate') drawCrates(ctx, this.x);
    else drawMeatball(ctx, this.x, this.rot);
  }
}

// ---- the counter ----------------------------------------------------------------
function chevron(ctx, x, y, dir, color, s = 6, lw = 4.5) {
  ctx.beginPath(); ctx.moveTo(x - dir * s * 0.7, y - s); ctx.lineTo(x + dir * s * 0.7, y); ctx.lineTo(x - dir * s * 0.7, y + s);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

function drawCounter(ctx, t, slide, mode, dir) {
  const x = -HALF, w = HALF * 2;
  rr(ctx, x + 8, 10, w - 16, THICK + 3, 12); ctx.fillStyle = 'rgba(60,40,20,0.18)'; ctx.fill();
  rrect(ctx, x, 0, w, THICK, 9, STEEL, OUT, 3);
  ctx.save(); rr(ctx, x, 0, w, THICK, 9); ctx.clip();
  ctx.fillStyle = STEEL_D; ctx.fillRect(x, THICK - 14, w, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, 18, w, 5);
  // the belt, seen edge-on: slats that slide when it runs
  ctx.fillStyle = BELT; ctx.fillRect(x, 0, w, 14);
  ctx.strokeStyle = SLAT; ctx.lineWidth = 3; ctx.lineCap = 'butt'; ctx.beginPath();
  const off = ((slide % 22) + 22) % 22;
  for (let sx = x - 22 + off; sx < x + w + 22; sx += 22) { ctx.moveTo(sx + 3, 3); ctx.lineTo(sx - 3, 14); }
  ctx.stroke();
  ctx.fillStyle = '#b4bfce'; ctx.fillRect(x, 0, w, 3.4);              // the bright lip you stand on
  ctx.restore();
  line(ctx, x + 2, 14, x + w - 2, 14, OUT, 2.2);
  for (const ex of [x + 10, x + w - 10]) { circle(ctx, ex, 8.4, 5.6, '#3a404c', OUT, 1.8); circle(ctx, ex, 8.4, 1.8, STEEL_L, null, 0); }
  // front panels: seams, vents, rivets
  for (const s of [-1, 1]) {
    line(ctx, s * 128, 17, s * 128, THICK - 15, STEEL_D, 2.2);
    for (let i = 0; i < 3; i++) line(ctx, s * 190, 28 + i * 6.5, s * 244, 28 + i * 6.5, STEEL_D, 2.6);
    circle(ctx, s * 284, 31, 2.6, STEEL_L, OUT, 1.4); circle(ctx, s * 142, 31, 2.6, STEEL_L, OUT, 1.4);
  }
  // direction lights
  rrect(ctx, -84, 23, 168, 23, 7, '#27374d', OUT, 2.2);
  for (let i = -2; i <= 2; i++) {
    const on = mode === 'warn' ? t % 14 < 8 : mode === 'run' && (((Math.floor(t / 5) - i * dir) % 5) + 5) % 5 < 2;
    chevron(ctx, i * 30, 34.5, dir, on ? '#ffd84a' : '#40557a', 5.5, 4.2);
  }
  rr(ctx, x, 0, w, THICK, 9); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
}

// The pass-through tunnels at each end. The dark mouth is drawn behind whatever
// is on the belt and the housing in front of it, so lunch slides out from inside.
function drawMouth(ctx, side) {
  ctx.save(); ctx.scale(side, 1);
  polygon(ctx, [MOUTH - 11, 0, MOUTH + 3, 0, MOUTH + 3, -45, MOUTH - 11, -37], '#2b303a', OUT, 2.2);
  ctx.fillStyle = '#596273';
  for (let i = 0; i < 3; i++) ctx.fillRect(MOUTH - 9 + i * 3.6, -38 - i * 2.2, 2.2, 14 + i * 2.2);
  ctx.restore();
}
function drawTunnel(ctx, side, lamp) {
  ctx.save(); ctx.scale(side, 1);
  const a = MOUTH, b = HALF + 5, mid = (a + b) / 2;
  const dome = () => { ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(a, -34); ctx.bezierCurveTo(a, -66, b, -66, b, -34); ctx.lineTo(b, 0); ctx.closePath(); };
  dome(); ctx.fillStyle = '#aab6c5'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = STEEL_D; ctx.fillRect(a, -11, b - a, 11);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(a + 9, -50, 6, 34);
  ctx.restore();
  dome(); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = STEEL_D; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(mid + 6, -56); ctx.lineTo(mid + 6, -13); ctx.moveTo(mid + 20, -47); ctx.lineTo(mid + 20, -13); ctx.stroke();
  rrect(ctx, mid - 6, -64, 12, 7, 2, STEEL_D, OUT, 1.8);
  circle(ctx, mid, -68, 6.5, lamp ? '#ffd84a' : '#7c8796', OUT, 2);
  if (lamp) gloss(ctx, mid - 2, -70, 2.6, 1.6, 0.8);
  ctx.restore();
}

// ---- the toppings ---------------------------------------------------------------
function drawPepperoni(ctx, cx, y) {
  const rx = 62, ry = 12;
  ellipse(ctx, cx, y + 11, rx, ry, '#99301f', OUT, LW);
  ctx.fillStyle = '#99301f'; ctx.fillRect(cx - rx, y + 1, rx * 2, 10);
  line(ctx, cx - rx, y + 1, cx - rx, y + 11, OUT, LW); line(ctx, cx + rx, y + 1, cx + rx, y + 11, OUT, LW);
  ellipse(ctx, cx, y + 1, rx, ry, '#de4b31', OUT, LW);
  ctx.beginPath(); ctx.ellipse(cx, y + 1, rx - 7, ry - 3, 0, 0, TAU); ctx.strokeStyle = '#bb3a24'; ctx.lineWidth = 2; ctx.stroke();
  for (const [dx, dy] of [[-30, 3], [-6, -3], [22, 5], [38, -2], [-44, -1]]) ellipse(ctx, cx + dx, y + 1 + dy, 4, 1.7, '#f08a6c', null, 0);
  gloss(ctx, cx - 24, y - 5, 17, 2.6, 0.35, -0.05);
}

function drawPepper(ctx, cx, y) {
  const cy = y - 9, rx = 62, ry = 13, hx = 40, hy = 6;
  // underside and outer wall
  ellipse(ctx, cx, cy + 9, rx, ry, '#3f8f2c', OUT, LW);
  ctx.fillStyle = '#3f8f2c'; ctx.fillRect(cx - rx, cy, rx * 2, 9);
  line(ctx, cx - rx, cy, cx - rx, cy + 9, OUT, LW); line(ctx, cx + rx, cy, cx + rx, cy + 9, OUT, LW);
  // the ring you stand on, with a see-through hole
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.ellipse(cx, cy, hx, hy, 0, 0, TAU);
  ctx.fillStyle = '#7ccb45'; ctx.fill('evenodd');
  // far inner wall, seen through the hole
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, hx, hy, 0, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.rect(cx - hx, cy - hy, hx * 2, hy * 2); ctx.ellipse(cx, cy + 4.5, hx, hy, 0, 0, TAU);
  ctx.fillStyle = '#c4ec8c'; ctx.fill('evenodd'); ctx.restore();
  ctx.strokeStyle = OUT; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, hx, hy, 0, 0, TAU); ctx.lineWidth = 2; ctx.stroke();
  gloss(ctx, cx - 22, cy + 9.6, 20, 1.8, 0.45, 0.03);
}

function drawMushroom(ctx, cx, y) {
  ellipse(ctx, cx, y + 21, 50, 7.5, '#b3916b', OUT, LW);                 // gills
  ctx.strokeStyle = '#8f7150'; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let i = -4; i <= 4; i++) { ctx.moveTo(cx + i * 10, y + 20); ctx.lineTo(cx + i * 11.4, y + 27); }
  ctx.stroke();
  rrect(ctx, cx - 16, y + 22, 32, 21, 8, '#f6eedd', OUT, LW);            // stem stub
  ctx.beginPath(); ctx.moveTo(cx - 62, y + 19);
  ctx.bezierCurveTo(cx - 65, y + 3, cx - 54, y, cx - 40, y); ctx.lineTo(cx + 40, y);
  ctx.bezierCurveTo(cx + 54, y, cx + 65, y + 3, cx + 62, y + 19);
  ctx.quadraticCurveTo(cx, y + 25, cx - 62, y + 19); ctx.closePath();
  fs(ctx, '#ecdcc0', OUT, LW);
  rr(ctx, cx - 40, y + 2.2, 80, 3.2, 1.6); ctx.fillStyle = '#fbf3e2'; ctx.fill();
  ellipse(ctx, cx + 30, y + 12, 9, 3.4, '#d9c5a2', null, 0); ellipse(ctx, cx - 22, y + 14, 6, 2.4, '#d9c5a2', null, 0);
}

const TOPS = [drawPepperoni, drawPepper, drawMushroom];

// ---- the cafeteria wall (screen space) --------------------------------------------
const SOFT = '#c9b68c';          // outline colour for everything back here, so it stays quiet
const TOPPINGS = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
  const x = -152 + c * 101, y = -80 + r * 80, k = r * 4 + c;
  TOPPINGS.push([x - 24 + ((k * 13) % 17), y - 14 + ((k * 7) % 11), 0], [x + 20 - ((k * 5) % 13), y + 14 - ((k * 11) % 9), 1 + (k % 2)]);
}

function drawPizza(ctx) {      // the sheet pizza, seen from above, centred on 0,0
  const w = 440, h = 272;
  rrect(ctx, -w / 2 - 11, -h / 2 - 11, w + 22, h + 22, 17, '#d6dadd', '#b3b9bd', 3);
  rrect(ctx, -w / 2, -h / 2, w, h, 12, '#e8c188', '#cda066', 3);
  rrect(ctx, -w / 2 + 13, -h / 2 + 13, w - 26, h - 26, 8, '#e9977a', null, 0);
  rrect(ctx, -w / 2 + 19, -h / 2 + 19, w - 38, h - 38, 7, '#f9df9a', null, 0);
  ctx.strokeStyle = '#edcc7c'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 1; i < 4; i++) { const x = -w / 2 + (w * i) / 4; ctx.moveTo(x, -h / 2 + 8); ctx.lineTo(x, h / 2 - 8); }
  for (let i = 1; i < 3; i++) { const y = -h / 2 + (h * i) / 3; ctx.moveTo(-w / 2 + 8, y); ctx.lineTo(w / 2 - 8, y); }
  ctx.stroke();
  for (const [x, y, k] of TOPPINGS) {
    if (k === 0) { circle(ctx, x, y, 17, '#e58066', '#cf6950', 2.5); circle(ctx, x - 5, y - 5, 3, '#f0a48e', null, 0); }
    else if (k === 1) { ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.strokeStyle = '#a5d585'; ctx.lineWidth = 5.5; ctx.stroke(); }
    else { ctx.fillStyle = '#f1e6cf'; ctx.fillRect(x - 3.5, y - 1, 7, 10); ctx.beginPath(); ctx.arc(x, y, 11, Math.PI, 0); ctx.closePath(); fs(ctx, '#f1e6cf', '#d3c09c', 2); }
  }
}

function heatLamp(ctx, x, y) {
  line(ctx, x, -80, x, y, '#b9aa88', 3);
  ctx.fillStyle = 'rgba(255,190,80,0.12)';
  ctx.beginPath(); ctx.moveTo(x - 22, y + 30); ctx.lineTo(x + 22, y + 30); ctx.lineTo(x + 92, y + 330); ctx.lineTo(x - 92, y + 330); ctx.closePath(); ctx.fill();
  polygon(ctx, [x - 10, y, x + 10, y, x + 27, y + 30, x - 27, y + 30], '#ea8660', '#bb6040', 2.5);
  ellipse(ctx, x, y + 30, 23, 5, '#ffe09a', '#bb6040', 2);
}

function drawRoom(ctx, t, cx, cy) {
  const px = -cx * 0.1, py = -(cy + 90) * 0.1;
  ctx.fillStyle = '#fbf1d6'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(px, py);
  ctx.fillStyle = checker(ctx, '#fbf1d6', '#f6e8c6', 44); ctx.fillRect(-88, -88, W + 176, 496);
  // menu board
  rrect(ctx, 14, 26, 164, 96, 6, '#cfa66e', '#ad8450', 3);
  rrect(ctx, 23, 35, 146, 78, 3, '#6a8a7d', null, 0);
  txt(ctx, 'TODAY:', 96, 56, { font: 'hand', size: 20, fill: '#eef5ea', stroke: null, lw: 0 });
  txt(ctx, 'PIZZA', 96, 88, { font: 'chewy', size: 34, fill: '#ffe9a0', stroke: null, lw: 0 });
  // clock, a few minutes to the bell
  circle(ctx, 716, 82, 31, '#fffaf0', SOFT, 4);
  for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; line(ctx, 716 + Math.cos(a) * 24, 82 + Math.sin(a) * 24, 716 + Math.cos(a) * 27, 82 + Math.sin(a) * 27, SOFT, 2.4); }
  line(ctx, 716, 82, 716 - 5, 82 - 14, '#9a875f', 4); line(ctx, 716, 82, 716 - 9, 82 - 21, '#9a875f', 3);
  const sa = (t * TAU) / 3600 - Math.PI / 2; line(ctx, 716, 82, 716 + Math.cos(sa) * 22, 82 + Math.sin(sa) * 22, '#e58066', 2);
  // the pizza of the day, leaning on its shelf
  ctx.save(); ctx.translate(424, 226); ctx.rotate(-0.03); ctx.globalAlpha = 0.6; drawPizza(ctx); ctx.restore();
  rrect(ctx, 164, 372, 520, 11, 3, '#dbe0e5', '#b3bcc6', 2.5);
  // tile band, baseboard, lino
  ctx.fillStyle = checker(ctx, '#bfe3d8', '#cfeee4', 22); ctx.fillRect(-88, 402, W + 176, 70);
  ctx.fillStyle = '#9fd0c3'; ctx.fillRect(-88, 398, W + 176, 6);
  ctx.fillStyle = checker(ctx, '#e9dec3', '#dccfae', 46); ctx.fillRect(-88, 472, W + 176, 260);
  ctx.fillStyle = '#bda985'; ctx.fillRect(-88, 468, W + 176, 7);
  // steam table with its sneeze guard
  rrect(ctx, -70, 412, 300, 84, 6, '#dbe0e5', '#b3bcc6', 3);
  [['#f2b98a'], ['#b4d99b'], ['#f6dc98']].forEach(([c], i) => rrect(ctx, -34 + i * 84, 404, 70, 13, 3, c, '#b3bcc6', 2));
  line(ctx, -52, 404, -40, 346, '#b3bcc6', 4); line(ctx, 228, 404, 216, 346, '#b3bcc6', 4);
  ctx.beginPath(); ctx.moveTo(-56, 398); ctx.lineTo(232, 398); ctx.lineTo(220, 342); ctx.lineTo(-44, 342); ctx.closePath();
  fs(ctx, 'rgba(190,232,246,0.5)', '#a9cfe0', 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(-10, 394); ctx.lineTo(24, 346); ctx.lineTo(44, 346); ctx.lineTo(10, 394); ctx.closePath(); ctx.fill();
  // a cart of trays
  line(ctx, 612, 446, 612, 492, '#b3bcc6', 4); line(ctx, 748, 446, 748, 492, '#b3bcc6', 4);
  rrect(ctx, 600, 440, 160, 9, 3, '#dbe0e5', '#b3bcc6', 2.5);
  for (let i = 0; i < 7; i++) rrect(ctx, 610 + (i % 2) * 4, 433 - i * 6, 136, 6, 2.5, i % 2 ? '#8fd0c6' : '#f5b36e', i % 2 ? '#6fb3a8' : '#d99548', 1.8);
  ctx.restore();
  // heat lamps hang a little nearer
  ctx.save(); ctx.translate(-cx * 0.2, -(cy + 90) * 0.2);
  for (const x of [262, 424, 586]) heatLamp(ctx, x, 34);
  ctx.restore();
}

export default {
  id: 'pizza', name: 'PIZZA FRIDAY', home: 'lunchlady',
  blurb: 'The belt brings lunch. Lunch is not on your side.',
  music: 'cafeteria',
  build(m) {
    const hazards = m.rules.hazards !== false;
    const main = mkSolid(-HALF, 0, HALF * 2, THICK, { id: 'counter' });
    const crate = mkSolid(0, -44, 50, 44, { id: 'crates', ledge: '', on: false });
    const tops = [
      mkPlat(-215, -95, 120, { id: 'pepperoni', y0: -95, ph: 0 }),
      mkPlat(95, -95, 120, { id: 'pepper', y0: -95, ph: 2.1 }),
      mkPlat(-60, -190, 120, { id: 'mushroom', y0: -190, ph: 4.2 }),
    ];
    return {
      solids: [main, crate], plats: tops, main, crate, tops,
      blast: { l: -790, r: 790, t: -620, b: 340 },
      cam: { l: -650, r: 650, t: -500, b: 270 },
      spawns: [[-180, 0], [180, 0], [-65, 0], [65, 0]],
      respawn: [0, -280],
      focusX: 0, focusY: -70, t: 0, slide: 0,
      // mode: idle -> warn (bell, arrows) -> run (belt moving, lunch coming through) -> idle
      belt: { mode: 'idle', t: 0, dir: 1, at: hazards ? 600 + m.rng.int(0, 120) : Infinity, rang: 0, next: 0, stop: 0, queue: [], things: [] },
      update(m) {
        const t = ++this.t, B = this.belt, main = this.main;
        for (const p of this.tops) { const y = p.y0 + Math.sin(t * 0.03 + p.ph) * 4; p.vy = y - p.y; p.y = y; }
        if (B.mode === 'idle') {
          if (m.frame >= B.at && m.state === 'fight') {
            // order up: ring the bell, flash the arrows, decide what is coming through
            B.mode = 'warn'; B.t = 0; B.dir = m.rng.sign(); B.rang = m.frame;
            const pair = m.rng.chance(0.5) ? ['pot', 'crate'] : ['crate', 'pot'];
            // the meatball outruns the belt, so when it is on the menu it goes first
            B.queue = m.rng.chance(0.6) ? ['ball', pair[0], pair[1]] : m.rng.chance(0.5) ? ['ball', pair[0]] : pair;
            m.sfx('bell');
          }
        } else if (B.mode === 'warn') {
          if (++B.t >= WARN) { B.mode = 'run'; B.t = 0; B.next = 4; B.stop = 0; m.sfx('conveyor'); }
        } else {
          B.t++;
          if (!B.stop && B.t % 110 === 0) m.sfx('conveyor', { vol: 0.7 });
          if (B.queue.length && B.t >= B.next) {
            const o = new Lunch(this, B.queue.shift(), B.dir);
            B.things.push(o); m.spawn(o); B.next = B.t + GAP; m.sfx('click', { vol: 0.7 });
          }
          if ((!B.queue.length && !B.things.length) || B.t > 640) B.stop++;       // everything is through: wind down
          main.conv = B.dir * BELT_V * (B.stop ? clamp(1 - B.stop / 24, 0, 1) : clamp(B.t / 24, 0, 1));
          if (B.stop >= 24) {
            B.mode = 'idle'; main.conv = 0; B.at = B.rang + 900 + m.rng.int(-50, 50);
            for (const o of B.things) o.leave();
            B.things.length = 0; B.queue.length = 0;
          }
        }
        this.slide += main.conv;
        for (let i = B.things.length - 1; i >= 0; i--) { const o = B.things[i]; o.step(); if (o.dead) B.things.splice(i, 1); }
      },
      // which tunnel's lamp is lit: the one lunch is about to come out of
      lamp(side) {
        const B = this.belt;
        if (B.mode === 'idle' || side !== -B.dir) return false;
        return B.mode === 'warn' ? this.t % 14 < 8 : B.queue.length > 0 && this.t % 20 < 12;
      },
      drawBg(ctx, m) { drawRoom(ctx, this.t, m.cam.x, m.cam.y); },
      drawBack(ctx) { drawMouth(ctx, -1); drawMouth(ctx, 1); },
      drawMid(ctx) {
        const B = this.belt;
        drawCounter(ctx, this.t, this.slide, B.mode, B.dir);
        drawTunnel(ctx, -1, this.lamp(-1)); drawTunnel(ctx, 1, this.lamp(1));
        this.tops.forEach((p, i) => TOPS[i](ctx, p.x + p.w / 2, p.y));
      },
      drawScreen(ctx) {
        const B = this.belt;
        if (B.mode !== 'warn' || B.t % 16 >= 11) return;
        rrect(ctx, W / 2 - 78, 36, 156, 46, 13, '#ffd84a', OUT, 3.5);
        for (let i = -1; i <= 1; i++) chevron(ctx, W / 2 + i * 38, 59, B.dir, OUT, 11, 7);
      },
    };
  },
  thumb(ctx, w, h, t = 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.save(); ctx.scale(w / W, h / H); drawRoom(ctx, t, 0, -90); ctx.restore();
    ctx.translate(w / 2, h * 0.72); ctx.scale(w / 760, w / 760);
    drawMouth(ctx, -1); drawMouth(ctx, 1);
    drawCounter(ctx, t, 0, 'idle', 1);
    drawTunnel(ctx, -1, false); drawTunnel(ctx, 1, false);
    drawPepperoni(ctx, -155, -95); drawPepper(ctx, 155, -95); drawMushroom(ctx, 0, -190);
    ctx.restore();
  },
};
