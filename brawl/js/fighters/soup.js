// SOUP - slot 5 of the roster.
// Brief: a small slow shelled creature. He hovers a bit to get around (a
// limited hover is his movement gimmick); he does have arms, so he punches;
// ground-pounds with the shell from the air; can tuck in and spin; silly hats.
// Super: boards a little rocket ship and flies it across the screen.
//
// He is the class hermit crab, and he lives in a soup can. Like Globert he
// brings his own pose / points / draw instead of the two-legged rig.

import { customPose } from '../game/rig.js';
import { K, hit, air, stdThrows, shoot, countMine, costumes } from '../game/movekit.js';
import { Entity, Projectile } from '../game/entities.js';
import { OUT, LW, circle, ellipse, blob, rrect, rr, limb, hose, line, polygon, star, eye, eyes, mouth, gloss, darken } from '../core/gfx.js';
import { TAU, clamp, lerp, approach } from '../core/util.js';

const BASE = {
  main: '#e8402a', label: '#fff6e6', band: '#e8402a', metal: '#cfd6e0', seal: '#f7c21c', mark: '#35a84a',
  crab: '#f58a3c', crab2: '#d9651f', hat: '#8f5bd6', hat2: '#f7c21c', top: 0,
};
// top: 0 the can's own lid, 1 a showman's top hat, 2 a horned helmet

const CY = 20;                 // body centre, above the feet
const FUEL = 70;               // frames of jet
const SHR = [12, -33], SHL = [-11, -34];     // where the arms come over the rim

// pose: squash (sx, sy), spin (rot), slide (ox, oy), face, claw targets (cR near, cL far),
// pincer gape (open 0..1), how far he has ducked into the can (tuck 0..1), jet flame, lid (1 = flipped open)
const STANCE = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, face: 0, cR: [21, -15], cL: [-18, -18], open: 0.3, tuck: 0, jet: 0, lid: 1 };

function pose(f) {
  return customPose(f, STANCE, (ff, p) => {
    const t = ff.t || 0, s = ff.state, w = Math.sin(t * 0.7) * 4;
    if (s === 'walk' || s === 'run' || s === 'dash') { const sw = Math.sin((ff.cycle || 0) / 5); p.cR = [21 + sw * 3, -15 - Math.abs(sw) * 2]; p.cL = [-18 - sw * 3, -18]; }
    else if (s === 'crouch') { p.tuck = 0.5; p.lid = 0.45; p.cR = [22, -7]; p.cL = [-20, -8]; }
    else if (s === 'jumpsquat' || s === 'land') { p.cR = [23, -8]; p.cL = [-20, -9]; }
    else if (s === 'air') { const v = clamp((ff.vy || 0) / 8, -1, 1); p.cR = [20, -21 - v * 14]; p.cL = [-18, -23 - v * 14]; p.open = 0.6; }
    else if (s === 'helpless') { p.cR = [20 + w, -43]; p.cL = [-18 - w, -44]; p.open = 1; }
    else if (s === 'hitstun' || s === 'tumble' || s === 'trapped') { p.cR = [24, -34 + w]; p.cL = [-22, -30 - w]; p.open = 1; }
    else if (s === 'shield' || s === 'shieldstun') { p.tuck = 0.55; p.lid = 0.45; p.cR = [15, -22]; p.cL = [7, -27]; p.open = 0; }
    else if (s === 'roll' || s === 'tech' || s === 'airdodge' || s === 'spotdodge') { p.tuck = 1; p.lid = 0; }
    else if (s === 'down') { p.tuck = 0.35; p.lid = 0.6; p.cR = [26, -6]; p.cL = [-24, -6]; p.open = 1; }
    else if (s === 'stun') { p.cR = [19, -9]; p.cL = [-17, -9]; p.open = 0.8; }
    else if (s === 'grabbed') { p.cR = [12, -18]; p.cL = [-9, -19]; }
    else if (s === 'grabhold') { const q = ff.pummelT > 0 ? Math.sin((ff.pummelT / 16) * Math.PI) : 0; p.cR = [37 - q * 5, -20]; p.cL = [26 + q * 8, -27 - q * 4]; p.open = 0.05 + q * 0.3; p.face = 1; }
    else if (s === 'ledge') { p.cR = [13, -52]; p.cL = [5, -52]; p.open = 0; }
    else if (s === 'ledgeclimb') { const u = clamp((ff.sf || 0) / 26, 0, 1); p.cR = [lerp(13, 22, u), lerp(-52, -12, u)]; p.cL = [lerp(5, -18, u), lerp(-52, -14, u)]; }
    else if (s === 'win') { const j = Math.abs(Math.sin(t * 0.14)); p.cR = [21, -40 - j * 6]; p.cL = [-18, -42 - j * 6]; p.open = 0.4 + j * 0.6; }
    else if (s === 'lose') { p.tuck = 0.6; p.lid = 0.4; p.cR = [16, -8]; p.cL = [-14, -8]; }
    else { const b = Math.sin(t * 0.085); p.cR = [21, -15 + b * 1.2]; p.cL = [-18, -18 + b * 1.2]; p.open = 0.3 + Math.max(0, Math.sin(t * 0.045)) * 0.3; }   // idle: an absent-minded pinch
  });
}

// whole-body squash / spin / slide applied to a local point (matches draw)
function xf(p, x, y) {
  x *= p.sx; y *= p.sy;
  if (p.rot) { const c = Math.cos(p.rot), s = Math.sin(p.rot), dy = y + CY, nx = x * c - dy * s; y = x * s + dy * c - CY; x = nx; }
  return [x + p.ox, y + p.oy];
}
// where a claw is and which way its pincer points: [x, y, angle]
function clawAt(sh, c, out) {
  const dx = c[0] - sh[0], dy = c[1] - sh[1], a = Math.atan2(dy, Math.abs(dx) + 6) * 0.8;
  return [lerp(sh[0], c[0], out), lerp(sh[1], c[1], out), dx >= -2 ? a : Math.PI - a];
}
function points(f, p) {
  const out = 1 - clamp(p.tuck, 0, 1), r = clawAt(SHR, p.cR, out), l = clawAt(SHL, p.cL, out);
  return {
    body: xf(p, 0, -CY), top: xf(p, 2, -42), bottom: xf(p, 0, -4), front: xf(p, 15, -CY), back: xf(p, -15, -CY), mouth: xf(p, 16, -40),
    cR: xf(p, r[0], r[1]), cRt: xf(p, r[0] + Math.cos(r[2]) * 12 * out, r[1] + Math.sin(r[2]) * 12 * out),
    cL: xf(p, l[0], l[1]), cLt: xf(p, l[0] + Math.cos(l[2]) * 12 * out, l[1] + Math.sin(l[2]) * 12 * out),
    grab: [42, 0],
  };
}

// ---- drawing ---------------------------------------------------------------
function drawClaw(ctx, pal, sh, c, open, out, near) {
  const k = clawAt(sh, c, out), g = 0.12 + clamp(open, 0, 1) * 0.6;
  hose(ctx, sh[0], sh[1], (sh[0] + k[0]) / 2 + (near ? 4 : -4), (sh[1] + k[1]) / 2 + 4 * out, k[0], k[1], 5, pal.crab, OUT, LW);
  ctx.save(); ctx.translate(k[0], k[1]); ctx.rotate(k[2]);
  if (Math.cos(k[2]) < 0) ctx.scale(1, -1);       // keep the big finger on top when it points backwards
  ctx.scale(0.35 + out * 0.65, 0.35 + out * 0.65);
  ctx.save(); ctx.rotate(g); blob(ctx, [-1, 1, 7, 1.6, 13.4, 3.6, 8, 7, 0, 6.4], pal.crab2, OUT, 2, 0.4); ctx.restore();
  ctx.rotate(-g * 0.5);
  blob(ctx, [-6.4, 0.6, -4.8, -6.6, 2, -8.8, 10, -7, 15, -2, 9, -0.4, 3, 1.6, 1.4, 6.2, -3.8, 6.2], pal.crab, OUT, LW, 0.45);
  gloss(ctx, 0.5, -5.2, 3.4, 1.5, 0.4, -0.2);
  ctx.restore();
}

function drawTopper(ctx, pal, lid) {
  if (!pal.top) {          // the lid, hinged at the back of the rim
    ctx.save(); ctx.translate(-15, -35.4); ctx.rotate(-lid * 2.05);
    limb(ctx, [0, 0, 29, 0], 3.2, pal.metal, OUT, 2);
    circle(ctx, 30, -3.4, 2.6, null, OUT, 4.4); circle(ctx, 30, -3.4, 2.6, null, pal.metal, 1.8);       // ring pull
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(lerp(0, -8, lid), lerp(-36, -38, lid)); ctx.rotate(-0.42 * lid);
  if (pal.top === 1) {     // top hat
    rrect(ctx, -8.5, -17, 17, 17, 2.5, pal.hat, OUT, LW);
    ctx.fillStyle = pal.hat2; ctx.fillRect(-7.4, -6.4, 14.8, 3.6);
    ellipse(ctx, 0, -0.6, 14, 3.2, pal.hat, OUT, LW);
  } else {                 // horned helmet
    for (const s of [-1, 1]) blob(ctx, [s * 8, -6, s * 13, -9, s * 16.5, -18, s * 12.5, -13.5, s * 9, -11], pal.hat2, OUT, 2, 0.4);
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-12, -14.5, 0, -14.5); ctx.quadraticCurveTo(12, -14.5, 12, 0); ctx.closePath();
    ctx.fillStyle = pal.hat; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.stroke();
    limb(ctx, [-12, -0.5, 12, -0.5], 3, darken(pal.hat, 0.22), OUT, 2);
    circle(ctx, 0, -7.4, 1.6, darken(pal.hat, 0.3), null, 0);
  }
  ctx.restore();
}

function drawCan(ctx, pal) {
  rrect(ctx, -16, -34, 32, 30, 4, pal.label, null, 0);
  ctx.save(); rr(ctx, -16, -34, 32, 30, 4); ctx.clip();
  ctx.fillStyle = pal.band; ctx.fillRect(-16, -28.5, 32, 10.5);
  ctx.fillStyle = pal.metal; ctx.fillRect(-16, -34, 32, 5.5); ctx.fillRect(-16, -9.5, 32, 5.5);       // ribbed ends
  ctx.strokeStyle = darken(pal.metal, 0.3); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-16, -31.2); ctx.lineTo(16, -31.2); ctx.moveTo(-16, -6.8); ctx.lineTo(16, -6.8); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(9.5, -34, 7, 30);
  ctx.restore();
  rr(ctx, -16, -34, 32, 30, 4); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.stroke();
  line(ctx, -16, -28.5, 16, -28.5, OUT, 1.5); line(ctx, -16, -9.5, 16, -9.5, OUT, 1.5);
  circle(ctx, 0, -18.5, 5.6, pal.seal, OUT, 1.8);                                                  // the seal on the label
  circle(ctx, 0, -18.2, 2.5, pal.mark, null, 0);
  gloss(ctx, -10.6, -19, 1.7, 8, 0.45, 0);
}

function draw(ctx, f, p) {
  if (f.v && f.v.hidden) return;        // he is in the rocket
  const pal = f.drawPal || f.pal, ex = p.face, t = f.t || 0, tk = clamp(p.tuck, 0, 1), out = 1 - tk;
  ctx.save();
  ctx.translate(p.ox, p.oy);
  if (p.rot) { ctx.translate(0, -CY); ctx.rotate(p.rot); ctx.translate(0, CY); }
  ctx.scale(p.sx, p.sy);
  if (p.jet > 0.04) {      // the can-jet: a flame out of the bottom
    const L = (8 + 13 * p.jet) * (0.75 + 0.25 * Math.sin(t * 2.3));
    polygon(ctx, [-7.5, -5, 7.5, -5, 4, L * 0.5, 0, L, -4, L * 0.5], '#ff8a1e', OUT, 1.8);
    polygon(ctx, [-3.6, -5, 3.6, -5, 0, L * 0.6], '#ffe45c', null, 0);
  }
  if (out > 0.06) {
    drawClaw(ctx, pal, SHL, p.cL, p.open, out, false);
    // four little legs: they scuttle on the ground and dangle in the air
    for (let i = 0; i < 4; i++) {
      const bx = -11 + i * 7.4, ph = (f.cycle || 0) / 3 + i * 2.2;
      const step = f.grounded === false ? (i - 1.5) * 1.2 : Math.sin(ph) * 2.6 * (f.state === 'walk' || f.state === 'run' || f.state === 'dash' ? 1 : 0);
      limb(ctx, [bx, -6, bx + step + (i - 1.5) * 0.9, -6 + 5.4 * out], 3.2, pal.crab2, OUT, 1.8);
    }
  }
  ellipse(ctx, 0, -34, 15, 4, '#3a2d33', OUT, LW);                 // the dark inside of the can
  if (p.lid >= 0.5) drawTopper(ctx, pal, p.lid);
  if (out > 0.12) {          // head: a dome and two eye-stalks rising out of the opening
    const hy = tk * 17, lean = clamp(-(f.vx || 0) * 0.5, -3, 3);
    ellipse(ctx, 3.4, -33 + hy, 10.4, 9, pal.crab, OUT, LW);
    if (ex === 2 || ex === 6) mouth(ctx, 8, -37.2 + hy, 4.6, 2, { lw: 1.3 });
    else if (ex === 3) mouth(ctx, 8, -38.4 + hy, 5.6, 3, { lw: 1.3 });
    else if (ex === 1) line(ctx, 5.6, -36.6 + hy, 10.6, -37.6 + hy, OUT, 1.5);
    else mouth(ctx, 8, -37.2 + hy, 5, 0, { lw: 1.4 });
    const ey = -48.6 + hy, eo = { tall: true, lw: 1.6, t, pr: 0.5 }, shut = ex === 2 || ex === 3 || ex === 5;
    for (const e of [[-2.4, 4.9, 1], [9.4, 5.3, -1]]) {
      limb(ctx, [e[0] + 1.2, -39.6 + hy, e[0] + lean * 0.5, ey + 3], 3, pal.crab, OUT, 1.8);
      if (shut) ellipse(ctx, e[0] + lean, ey, e[1], e[1] * 1.2, '#ffffff', OUT, 1.6);
      eye(ctx, e[0] + lean, ey, e[1], ex, 0.4, ex === 1 ? 0.25 : 0, e[2], eo);
    }
  }
  drawCan(ctx, pal);
  if (p.lid < 0.5) drawTopper(ctx, pal, p.lid);
  if (out > 0.06) drawClaw(ctx, pal, SHR, p.cR, p.open, out, true);
  ctx.restore();
}

// ---- bubbles, quake --------------------------------------------------------
function drawBubble(ctx, p) {
  const r = p.r * Math.min(1, 0.45 + p.t / 8), x = p.x + Math.sin(p.t * 0.4 + p.r) * 1.5;
  ctx.beginPath(); ctx.arc(x, p.y, r, 0, TAU);
  ctx.fillStyle = 'rgba(190,236,255,0.42)'; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke();
  gloss(ctx, x - r * 0.36, p.y - r * 0.38, r * 0.3, r * 0.17, 0.9);
}
function blow(f, m, i) {
  const y = f.inp.y, aim = y < -0.5 ? -1.5 : y > 0.5 ? 1 : -0.25;
  shoot(f, m, { tag: 'bubble', x: 19, y: 40, vx: 4.7 + (i % 2) * 0.8, vy: aim + ((i % 3) - 1) * 0.55, g: -0.02, r: 9, life: 30 + (i % 3) * 3, drawFn: drawBubble,
    hit: { dmg: 2, ang: 24, bk: 30, kg: 12, fx: 'water', sfx: 'pop' },
    tick: (p) => { p.vx *= 0.955; },
    onDie: (p, m2) => { m2.fx.drops(p.x, p.y, 3, '#c9efff'); m2.sfx('pop', { vol: 0.25, rate: 1.4 }); } });
  m.sfx('bubble', { vol: 0.45, rate: 1 + i * 0.06 });
}
function quake(f, m) {
  for (const d of [-1, 1]) {
    m.spawn(new Projectile(m, { owner: f, x: f.x + d * 20, y: f.y - 8, vx: d * 5.6, vy: 0, r: 12, life: 12, stage: 'pass', pierce: true, reflectable: false,
      hit: { dmg: 6, ang: 76, bk: 34, kg: 56, fx: 'punch' },
      drawFn: (ctx, p) => { ctx.globalAlpha = 1 - p.t / 13; ellipse(ctx, p.x, p.y + 5, 13, 6, '#efe6d2', 'rgba(60,45,34,0.6)', 1.6); ctx.globalAlpha = 1; } }));
  }
  m.fx.dust(f.x, f.y, 8); m.shake(6); m.sfx('thud');
}
// the shell plunge bounces off whoever it lands on
const bounce = (o) => { if (o && o.moveId === 'dair' && o.mf < 46) { o.vy = -8.6; o.mf = 46; } };

// ---- the super: BLAST OFF --------------------------------------------------
// A bottle rocket with a porthole. It crosses the screen three times, wrapping
// at the edges of the view; the player steers it up and down.
const SHIP_HIT = { dmg: 16, ang: 38, bk: 76, kg: 108, sfx: 'whop', fx: 'fire', rehit: 45 };
function dropIn(f, m) {        // he hops out above the stage, the way a respawn arrives
  const st = m.stage, rp = st.respawnAt ? st.respawnAt(m, f) : st.respawn;
  f.v.ride = null; f.v.hidden = false; f.superActive = false; f.intangible = false;
  f.x = rp[0] + (f.slot - 1.5) * 26; f.y = rp[1] - 260; f.v.respY = rp[1];
  f.vx = f.vy = f.kx = f.ky = 0; f.grounded = false; f.ground = null;
  f.jumps = f.st.airJumps; f.facing = f.x > (st.focusX || 0) ? -1 : 1;
  f.launched = false; f.tumble = false; f.launch = null; f.freeze = 0; f.respawnT = 0;
  f.setState('respawn');
  f.v.dropped = true; f.v.fuel = FUEL;
}
class Rocket extends Entity {
  constructor(m, f) {
    super({ owner: f, team: f.team, tag: 'soupship' });
    const v = m.cam.view(), b = m.stage.blast;
    this.dir = f.facing; this.facing = f.facing; this.x = f.x; this.y = f.y - 24; this.vy = 0;
    this.l = Math.max(v.l - 70, b.l + 60); this.r = Math.min(v.r + 70, b.r - 60);
    this.sp = (this.r - this.l) / 80; this.left = (this.r - this.l) * 3; this.away = 0;
    f.v.ride = this;
  }
  update(m) {
    this.t++;
    const f = this.owner, t = this.t;
    if (this.away) {         // empty now: it carries on up and out of the picture
      this.x += this.dir * this.sp; this.y -= 4 + this.away * 0.3;
      if (++this.away > 44) this.dead = true;
      return;
    }
    if (f.out || f.state !== 'trapped' || f.v.ride !== this) {       // something pulled him out of it
      if (f.v.ride === this) { f.v.ride = null; f.v.hidden = false; f.superActive = false; }
      this.away = 1; this.hit = null;
      return;
    }
    f.sf = 1; f.intangible = true; f.superActive = true; f.vx = f.vy = f.kx = f.ky = 0;
    if (t === 1) m.sfx('rocket');
    if (t >= 18) {
      const v = m.cam.view(), b = m.stage.blast;
      this.hit = SHIP_HIT; this.vx = this.dir * this.sp;
      this.vy = approach(this.vy, clamp(f.inp.y, -1, 1) * 5.4, 0.6);
      this.y = clamp(this.y + this.vy, Math.max(v.t + 34, b.t + 70), Math.min(v.b - 100 / m.cam.zoom, b.b - 70));
      this.x += this.vx; this.left -= this.sp;
      if (this.dir > 0 ? this.x > this.r : this.x < this.l) { this.x = this.dir > 0 ? this.l : this.r; this.hitLog.clear(); m.sfx('rocket', { vol: 0.5 }); }
      if (t % 2 === 0) m.fx.smoke(this.x - this.dir * 46, this.y + (t % 4 ? 3 : -3), '#ffffff', 9);
      if (this.left <= 0) { this.away = 1; this.hit = null; dropIn(f, m); return; }
    }
    f.x = this.x; f.y = this.y + 24; f.facing = this.dir;
  }
  hitShapes() { return this.hit ? [{ x: this.x - 40, y: this.y - 17, w: 84, h: 34 }] : null; }
  draw(ctx) {
    const pal = this.owner.pal, t = this.t, k = clamp(t / 8, 0.05, 1), sh = !this.away && t < 18 ? (t % 2 ? 1.5 : -1.5) : 0;
    const L = (t < 18 ? 13 : 30) * (0.7 + 0.3 * Math.sin(t * 1.9));
    ctx.save(); ctx.translate(this.x + sh, this.y); ctx.scale(this.dir * k, k);
    if (this.away) ctx.rotate(-Math.min(0.5, this.away * 0.04));
    polygon(ctx, [-37, -7, -37 - L, 0, -37, 7], '#ff8a1e', OUT, 2);                       // exhaust
    polygon(ctx, [-37, -3.6, -37 - L * 0.6, 0, -37, 3.6], '#ffe45c', null, 0);
    polygon(ctx, [-30, -10, -45, -25, -20, -13], pal.band, OUT, LW);                      // cardboard fins
    polygon(ctx, [-30, 10, -45, 25, -20, 13], pal.band, OUT, LW);
    rrect(ctx, -41, -6, 10, 12, 2, pal.metal, OUT, 2);                                    // the bottle's neck
    rrect(ctx, -34, -14.5, 64, 29, 13, pal.label, OUT, LW);                               // the bottle
    ctx.fillStyle = pal.band; ctx.fillRect(-17, -13.3, 5.5, 26.6);
    gloss(ctx, -4, -9.6, 16, 2, 0.5, 0);
    blob(ctx, [23, -14.6, 38, -9, 50, 0, 38, 9, 23, 14.6, 25, 0], pal.band, OUT, LW, 0.3);   // nose cone
    circle(ctx, 6, 0, 10, pal.metal, OUT, LW); circle(ctx, 6, 0, 7.4, '#c9efff', OUT, 1.6);   // porthole
    if (!this.away) eyes(ctx, 6.6, -0.4, 2.9, 3.2, 1, 0.5, 0, { lw: 1.2, pr: 0.5 });
    ctx.restore();
  }
}

// ---- the moveset -----------------------------------------------------------
const IN = { tuck: 1, lid: 0 };
const moves = {
  jab: {
    frames: 20, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { cR: [12, -19], open: 0.7, sx: 0.97 }], [5, { cR: [38, -19], open: 0, sx: 1.04, ox: 2 }, 'out'], [10, { cR: [34, -19], open: 0.1, ox: 1 }], [20, {}]),
    hits: [hit([5, 7], 'cRt', 9, 4, 75, 12, 25, { to: 'cR', sfx: 'snip' })],
    cancel: [{ to: 'jab2', f: [8, 17], on: 'attack' }],
  },
  jab2: {    // the other claw comes over the top
    frames: 26, sfx: { 5: 'swishM' },
    pose: K([0, { cR: [34, -19], open: 0.1 }], [4, { cR: [24, -15], cL: [0, -44], open: 0.9 }], [7, { cR: [18, -13], cL: [40, -22], open: 0, ox: 3, rot: 0.08 }, 'in'], [13, { cR: [18, -13], cL: [36, -20], ox: 2 }], [26, {}]),
    hits: [hit([6, 9], 'cLt', 10, 6, 48, 32, 74, { to: 'cL', sfx: 'whop' })],
  },
  ftilt: {
    frames: 32, sfx: { 7: 'swishM' },
    pose: K([0, {}], [6, { cR: [4, -25], open: 1, ox: -3, rot: -0.1 }], [9, { cR: [44, -21], open: 0, ox: 4, rot: 0.1, sx: 1.05 }, 'in'], [15, { cR: [40, -20], ox: 3, rot: 0.06 }], [32, {}]),
    hits: [hit([8, 11], 'cRt', 11, 10, 361, 24, 96, { to: 'cR', sfx: 'whop' })],
  },
  utilt: {
    frames: 30, sfx: { 5: 'swishM' },
    pose: K([0, {}], [4, { cR: [23, -8], open: 0.7, sy: 0.92, sx: 1.06 }], [8, { cR: [10, -57], open: 0, sy: 1.08, sx: 0.95 }, 'out'], [13, { cR: [-5, -52], sy: 1.04 }], [30, {}]),
    hits: [hit([6, 11], 'cRt', 11, 8, 88, 30, 100, { to: 'cR', sfx: 'snip' })],
  },
  dtilt: {
    frames: 26, sfx: { 6: 'swishS' },
    pose: K([0, { sy: 0.86, sx: 1.1 }], [5, { sy: 0.84, sx: 1.12, cR: [18, -6], open: 1 }], [8, { sy: 0.84, sx: 1.12, cR: [41, -6], open: 0, ox: 2 }, 'out'], [13, { sy: 0.86, sx: 1.1, cR: [37, -6] }], [26, {}]),
    hits: [hit([7, 10], 'cRt', 10, 7, 70, 24, 72, { to: 'cR', sfx: 'snip' })],
  },
  dash: {    // tips over and tumbles
    frames: 40, vel: [[0, 6.4, null]], fric: 0.26, sfx: { 2: 'swishM' },
    pose: K([0, { rot: 0 }], [4, { tuck: 0.8, lid: 0.2, rot: 0.6 }], [22, { tuck: 0.8, lid: 0.2, rot: TAU * 2, sx: 1.05 }, 'lin'], [28, { rot: TAU * 2 }], [40, { rot: TAU * 2 }]),
    hits: [hit([5, 12], 'body', 20, 10, 55, 56, 62, { sfx: 'clang' }), hit([13, 22], 'body', 19, 7, 60, 40, 50, { group: 1 })],
  },
  fsmash: {  // both claws
    frames: 54, charge: { at: 10, max: 60 }, sfx: { 15: 'swishL' }, vel: [[15, 3, null]],
    pose: K([0, {}], [9, { cR: [-8, -27], cL: [-25, -29], open: 1, ox: -5, rot: -0.16, sx: 0.94 }], [10, { cR: [-8, -27], cL: [-25, -29], open: 1, ox: -5, rot: -0.16, sx: 0.94 }],
      [17, { cR: [46, -22], cL: [40, -13], open: 0, ox: 6, rot: 0.14, sx: 1.08, sy: 0.95 }, 'in3'], [26, { cR: [42, -21], cL: [36, -13], ox: 5, rot: 0.1 }], [54, {}]),
    hits: [hit([16, 20], 'cRt', 13, 19, 42, 34, 102, { to: 'cR', sfx: 'whop' }), hit([16, 20], 'cLt', 11, 19, 42, 34, 102, { to: 'cL', sfx: 'whop' })],
    events: { 17: (f, m) => { m.fx.dust(f.x + f.facing * 30, f.y, 3); } },
  },
  usmash: {  // claps them together overhead
    frames: 48, charge: { at: 7, max: 60 }, sfx: { 11: 'swishL' },
    pose: K([0, {}], [6, { cR: [24, -10], cL: [-22, -10], open: 1, sy: 0.84, sx: 1.12 }], [7, { cR: [24, -10], cL: [-22, -10], open: 1, sy: 0.84, sx: 1.12 }],
      [12, { cR: [7, -59], cL: [-3, -59], open: 0, sy: 1.12, sx: 0.92 }, 'in3'], [20, { cR: [8, -55], cL: [-4, -55], sy: 1.04 }], [48, {}]),
    hits: [hit([11, 15], [2, 58], 17, 16, 90, 34, 104, { sfx: 'whop' }), hit([10, 12], 'cRt', 11, 16, 90, 34, 104, { to: 'cR', sfx: 'whop' })],
  },
  dsmash: {  // both sides at once
    frames: 50, charge: { at: 7, max: 60 }, sfx: { 10: 'swishM' },
    pose: K([0, {}], [6, { cR: [16, -47], cL: [-14, -47], open: 1, sy: 1.08, sx: 0.94 }], [7, { cR: [16, -47], cL: [-14, -47], open: 1, sy: 1.08, sx: 0.94 }],
      [11, { cR: [37, -5], cL: [-35, -5], open: 0, sy: 0.82, sx: 1.14 }, 'in3'], [20, { cR: [35, -5], cL: [-33, -5], sy: 0.88, sx: 1.08 }], [50, {}]),
    hits: [hit([10, 14], 'cRt', 13, 14, 30, 36, 86, { to: 'cR', sfx: 'whop' }), hit([10, 14], 'cLt', 13, 14, 30, 36, 86, { to: 'cL', rev: true, sfx: 'whop' })],
    events: { 11: (f, m) => { m.fx.dust(f.x + 38, f.y, 2); m.fx.dust(f.x - 38, f.y, 2); m.shake(3); } },
  },
  nair: air({   // pulls everything in and spins
    frames: 42, sfx: { 3: 'swishM' },
    pose: K([0, {}], [3, { tuck: 1, lid: 0, rot: 0 }], [26, { tuck: 1, lid: 0, rot: TAU * 2 }, 'lin'], [32, { rot: TAU * 2 }], [42, { rot: TAU * 2 }]),
    hits: [hit([5, 13], 'body', 22, 9, 361, 20, 86, { sfx: 'clang' }), hit([14, 25], 'body', 20, 5, 361, 14, 70, { group: 1 })],
  }, 11, [4, 30]),
  fair: air({
    frames: 40, sfx: { 9: 'swishM' },
    pose: K([0, {}], [8, { cR: [4, -55], open: 0.9, rot: -0.2 }], [11, { cR: [40, -18], open: 0, rot: 0.3 }, 'in'], [17, { cR: [34, -8], rot: 0.25 }], [40, {}]),
    hits: [hit([10, 14], 'cRt', 12, 12, 361, 26, 94, { to: 'cR', sfx: 'whop' })],
  }, 13, [7, 30]),
  bair: air({
    frames: 36, sfx: { 7: 'swishM' },
    pose: K([0, {}], [5, { cL: [-6, -24], open: 0.9, rot: 0.1 }], [8, { cL: [-43, -22], open: 0, rot: -0.14, ox: -3 }, 'in'], [14, { cL: [-39, -21], rot: -0.1 }], [36, {}]),
    hits: [hit([8, 12], 'cLt', 12, 11, 361, 26, 94, { to: 'cL', rev: true, sfx: 'whop' })],
  }, 12, [5, 27]),
  uair: air({
    frames: 34, sfx: { 6: 'swishS' },
    pose: K([0, {}], [4, { cR: [21, -24], cL: [-19, -24], open: 1 }], [8, { cR: [8, -59], cL: [-4, -59], open: 0, sy: 1.08 }, 'out'], [14, { cR: [9, -53], cL: [-5, -53] }], [34, {}]),
    hits: [hit([7, 11], [2, 58], 15, 9, 84, 26, 96, { sfx: 'snip' })],
  }, 10, [5, 25]),
  dair: air({   // shell ground-pound
    frames: 56, drift: 0.2, fallCap: 14, vel: [[4, 0, -3.5], [13, 0, 14]], sfx: { 12: 'swishL' },
    pose: K([0, {}], [5, { tuck: 0.4, sy: 0.9, sx: 1.08 }], [12, { tuck: 1, lid: 0, sy: 0.9, sx: 1.1 }], [14, { tuck: 1, lid: 0, sy: 1.14, sx: 0.9 }], [45, { tuck: 1, lid: 0, sy: 1.14, sx: 0.9 }], [56, {}]),
    hits: [hit([13, 18], 'bottom', 17, 13, 270, 20, 84, { sfx: 'clang', onHit: bounce }), hit([19, 44], 'bottom', 17, 10, 70, 30, 70, { group: 1, sfx: 'clang', onHit: bounce })],
    onLand: (f, m) => { if (f.mf >= 13 && f.mf < 46) quake(f, m); },
  }, 22, [10, 56]),

  // --- specials ---
  nspecial: {   // a stream of bubbles: they shove more than they hurt
    kind: 'special', frames: 46, drift: 0.6,
    can: (f, m) => countMine(f, m, 'bubble') < 5,
    pose: K([0, {}], [8, { sx: 0.92, sy: 1.08, ox: -2, cR: [16, -12], cL: [-20, -14] }], [10, { sx: 1.06, sy: 0.95, ox: 3, cR: [24, -30], cL: [-14, -30], open: 0.8 }, 'out'], [31, { sx: 1.04, sy: 0.97, ox: 3, cR: [24, -30], cL: [-14, -30], open: 0.8 }], [46, {}]),
    events: { 10: (f, m) => blow(f, m, 0), 15: (f, m) => blow(f, m, 1), 20: (f, m) => blow(f, m, 2), 25: (f, m) => blow(f, m, 3), 30: (f, m) => blow(f, m, 4) },
  },
  sspecial: {   // tucks in and rolls: slow to start, armoured once it is going
    kind: 'special', frames: 58, keepV: true, airOK: true, drift: 0.1, armor: [[12, 46, 90]], sfx: { 2: 'rev', 14: 'dash' },
    tick: (f, m, fr) => {
      if (fr < 14) f.vx = approach(f.vx, 0, 0.6);
      else if (fr <= 44) { f.vx = f.facing * 7.6; if (fr % 4 === 0 && f.grounded) m.fx.dust(f.x - f.facing * 14, f.y, 1); }
      else f.vx = approach(f.vx, 0, 0.55);
    },
    pose: K([0, {}], [8, { tuck: 1, lid: 0, sy: 0.9, sx: 1.08 }], [14, { tuck: 1, lid: 0, rot: -0.3 }], [46, { tuck: 1, lid: 0, rot: TAU * 4 }, 'lin'], [52, { tuck: 1, lid: 0, rot: TAU * 4 }], [58, { rot: TAU * 4 }]),
    hits: [hit([14, 42], 'body', 21, 2.5, 35, 0, 0, { set: 34, rehit: 8, sfx: 'tink' }), hit([43, 47], 'body', 23, 6, 48, 48, 74, { group: 1, sfx: 'clang' })],
  },
  uspecial: {   // can-jet: thrust for as long as Special is held and there is fuel
    kind: 'special', frames: 13, airOK: true, slideOff: true, drift: 1,
    can: (f) => f.v.fuel > 6,
    tick: (f, m, fr) => {
      if (fr < 3 || fr > 4 || !f.inp.h.special || f.v.fuel <= 0) return;
      f.v.fuel--;
      if (f.grounded) { f.grounded = false; f.ground = null; f.vy = -2.2; }
      f.v.cough = f.v.fuel < 18 && f.v.fuel % 6 < 2;        // nearly dry: it sputters
      if (!f.v.cough) f.vy = Math.max(f.vy - 0.95, -4.8);
      if (f.v.fuel % 3 === 0) m.fx.smoke(f.x + (f.v.fuel % 2 ? 4 : -4), f.y + 6, f.v.cough ? '#8d8f98' : '#f4f0e6', 6);
      if (f.v.fuel % 11 === 0) m.sfx('spray', { vol: 0.35, rate: 0.8 + (f.v.fuel / FUEL) * 0.5 });
      f.mf = 3;
    },
    pose: (f) => ({ jet: f.mf >= 3 && f.mf <= 5 ? (f.v.cough ? 0.2 : 1) : 0, cR: [22, -11], cL: [-20, -12], open: 0.5, sy: 1.04, sx: 0.97, face: f.v.fuel < 18 ? 6 : 3 }),
  },
  jetdud: {     // what uspecial turns into on an empty tank
    kind: 'special', frames: 18, airOK: true, slideOff: true, drift: 0.8,
    pose: K([0, {}], [4, { sy: 0.94, sx: 1.05, jet: 0.15, face: 6 }], [10, { sy: 1.02, face: 6 }], [18, {}]),
    events: { 3: (f, m) => { m.sfx('click'); m.fx.smoke(f.x, f.y + 2, '#8d8f98', 7); } },
  },
  dspecial: {   // hide: nothing gets through the tin while Special is held, then he pops out swinging
    kind: 'special', frames: 34, drift: 0, airOK: true, sfx: { 3: 'click', 9: 'pop' },
    start: (f) => { f.v.hideT = 0; },
    exit: (f) => { f.permArmor = 0; f.v.hiding = false; },
    tick: (f, m, fr) => {
      f.v.hiding = fr >= 4 && fr <= 7;
      f.permArmor = f.v.hiding ? 9999 : 0;
      if (fr === 7 && f.v.hideT < 90 && (f.inp.h.special || (f.isCPU && f.v.hideT < 12))) { f.v.hideT++; f.mf = 6; }
    },
    pose: K([0, {}], [5, { tuck: 1, lid: 0, sy: 0.95 }], [8, { tuck: 1, lid: 0, sy: 0.95 }], [11, { sy: 1.14, sx: 0.92, cR: [31, -31], cL: [-29, -31], open: 1, face: 3 }, 'out'], [17, { cR: [29, -28], cL: [-27, -28], open: 1, face: 3 }], [34, {}]),
    hits: [hit([10, 13], 'body', 27, 7, 80, 40, 70, { sfx: 'whop' })],
  },

  // --- grab + throws ---
  grab: {
    kind: 'grab', frames: 34, sfx: { 7: 'snip' },
    pose: K([0, {}], [5, { cR: [16, -21], open: 1 }], [9, { cR: [40, -20], open: 1, ox: 2 }, 'out'], [12, { cR: [40, -20], open: 0, ox: 2 }], [22, { cR: [30, -18], open: 0.2 }], [34, {}]),
    hits: [{ f: [8, 11], at: 'cRt', r: 12, dmg: 0, grab: true }, { f: [8, 11], x: 26, y: -20, r: 12, dmg: 0, grab: true }],
  },
  ...stdThrows({
    f: { dmg: 9, bk: 60, kg: 68, f: 13, frames: 32, sfx: 'whop', pose: K([0, { cR: [37, -20], open: 0 }], [8, { cR: [20, -30], open: 0, rot: -0.14 }], [13, { cR: [44, -22], open: 1, rot: 0.14, ox: 3 }, 'in'], [32, {}]) },
    b: { dmg: 10, bk: 62, kg: 84, f: 15, frames: 36, pose: K([0, { cR: [37, -20], open: 0 }], [8, { cR: [10, -53], open: 0 }], [15, { cR: [-30, -28], open: 1, rot: -0.2 }, 'in'], [36, {}]) },
    u: { dmg: 9, bk: 66, kg: 70, f: 12, frames: 32, sfx: 'whop', pose: K([0, { cR: [37, -20], open: 0 }], [7, { cR: [30, -8], open: 0, sy: 0.88, sx: 1.08 }], [12, { cR: [12, -58], open: 1, sy: 1.1, sx: 0.94 }, 'in'], [32, {}]) },
    d: { dmg: 8, bk: 52, kg: 42, f: 15, frames: 34, sfx: 'thud', pose: K([0, { cR: [37, -20], open: 0 }], [9, { cR: [34, -10], oy: -16, open: 0 }], [15, { cR: [32, -4], oy: 0, sy: 0.8, sx: 1.16, open: 1 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 9: 'swishM' },
    pose: K([0, { sy: 0.7, sx: 1.2 }], [8, { sy: 0.8, sx: 1.12, cR: [14, -10], cL: [-12, -10], open: 1 }], [11, { cR: [38, -8], cL: [-36, -8], open: 0, sy: 0.9 }, 'out'], [18, { cR: [34, -8], cL: [-32, -8] }], [34, {}]),
    hits: [hit([10, 13], 'cRt', 12, 6, 50, 40, 50, { to: 'cR' }), hit([10, 13], 'cLt', 12, 6, 50, 40, 50, { to: 'cL', rev: true })],
  },
  taunt: {      // just a can. Nothing to see here.
    kind: 'taunt', frames: 74, iasa: 64, sfx: { 9: 'click', 46: 'pop' },
    pose: K([0, {}], [10, IN], [44, IN], [50, { oy: -7, sy: 1.08, cR: [22, -40], cL: [-19, -41], open: 1, face: 3 }, 'back'], [62, { cR: [22, -38], cL: [-19, -39], open: 0.4, face: 3 }], [74, {}]),
  },

  // --- the super: BLAST OFF ---
  super: {
    kind: 'super', frames: 44, sfx: { 4: 'cute' },
    pose: K([0, {}], [8, { cR: [21, -45], cL: [-17, -44], open: 1, oy: -5, face: 3 }, 'back'], [17, { cR: [21, -45], cL: [-17, -44], open: 1, face: 3 }], [23, { tuck: 1, lid: 0, sy: 0.9, sx: 1.08 }], [44, IN]),
    events: {
      25: (f, m) => {
        m.fx.puff(f.x, f.y - 20, 8, '#ffffff'); m.fx.burst(f.x, f.y - 20, 42, '#ffffff');
        m.spawn(new Rocket(m, f));
        f.v.hidden = true; f.setState('trapped'); f.v.trapMax = 900; f.superActive = true; f.grounded = false; f.ground = null;
      },
    },
    tick: (f) => { f.invuln = Math.max(f.invuln, 2); },
  },
};

export default {
  id: 'soup', name: 'SOUP', from: 'Shell Out', superName: 'Blast Off',
  blurb: 'The class hermit crab. Slow, heavy, lives in a soup can, and has a jet in the bottom of it for some reason.',
  stats: { weight: 118, walk: 1.5, dash: 3.6, run: 3.4, traction: 0.5, jump: 8.8, hop: 5.6, djump: 8.2, gravity: 0.4, fall: 8.2, fastFall: 12, airSpeed: 2.9, airAccel: 0.22, w: 40, h: 48 },
  portrait: { x: 3, y: -37, s: 1.2 },
  pummel: { dmg: 2, sfx: 'snip' },
  costumes: costumes(BASE, [
    ['Tomato Soup', {}],
    ['Sardine Tin', { main: '#2f7fe0', label: '#e9eef5', band: '#2f7fe0', metal: '#b4bfd0', seal: '#ffffff', mark: '#2f7fe0', crab: '#f2617a', crab2: '#cf3f5c' }],
    ['Party Hat', { main: '#8f5bd6', label: '#f3e9ff', band: '#8f5bd6', metal: '#f2c94a', seal: '#ffd92e', mark: '#e8402a', crab: '#4fc3a1', crab2: '#2f9a7b', top: 1 }],
    ['Viking', { main: '#6b8a3a', label: '#ece2c2', band: '#6b8a3a', metal: '#a9a59c', seal: '#e8402a', mark: '#fff3d0', crab: '#4a8fe0', crab2: '#2f6cbd', hat: '#b9c2cf', hat2: '#fff3d0', top: 2 }],
  ]),
  pose, points, draw, moves,
  remap: (f, id) => (id === 'uspecial' && !(f.v.fuel > 6) ? 'jetdud' : id),
  hooks: {
    init(f) { f.v.fuel = FUEL; f.v.hiding = false; f.v.hidden = false; f.v.ride = null; f.v.hideT = 0; f.v.cough = false; },
    postUpdate(f) {
      if ((f.grounded || f.state === 'ledge') && f.moveId !== 'uspecial') f.v.fuel = Math.min(FUEL, f.v.fuel + 1.2);
      if (f.v.dropped && f.state !== 'respawn') { f.v.dropped = false; f.invuln = Math.min(f.invuln, 45); }    // no full respawn grace after the ride
    },
    // tucked into the can: a quarter of the damage, and nothing else
    onHurt(f, m, src, hb, dmg) {
      if (!f.v.hiding || hb.grab || hb.unblockable) return;
      const d = dmg * 0.25;
      f.pct = Math.min(999, f.pct + d); f.stats.taken += d; f.flash = 5; f.flashColor = '#ffffff';
      if (src.owner && src.owner !== f) { src.owner.stats.dealt += d; f.lastHitBy = src.owner.slot; f.lastHitFrame = m.frame; }
      if (src.fighter) { src.fighter.freeze = Math.max(src.fighter.freeze, 4); src.fighter.moveHit = true; }
      m.sfx('tink', { vol: 0.7 }); m.fx.spark(f.x, f.y - 24, 4, '#ffffff');
      return false;
    },
    onKO(f) { f.v.hidden = false; f.v.ride = null; f.v.hiding = false; },
    onRespawn(f) { f.v.fuel = FUEL; },
    // fuel gauge, just above the damage plate
    drawHud(ctx, f, x, y) {
      const k = clamp(f.v.fuel / FUEL, 0, 1), bx = x + 22, by = y - 16, bw = 58, bh = 10;
      rrect(ctx, bx, by, bw, bh, 5, '#2b2118', OUT, 2.2);
      if (k > 0.02) { rr(ctx, bx + 2, by + 2, (bw - 4) * k, bh - 4, 3); ctx.fillStyle = k < 0.26 ? '#e8402a' : '#ff9d1c'; ctx.fill(); }
      polygon(ctx, [x + 8, y - 5.5, x + 16, y - 5.5, x + 15.2, y - 10, x + 12, y - 17.5, x + 8.8, y - 10], '#ff8a1e', OUT, 1.8);     // little flame
      polygon(ctx, [x + 10.4, y - 6.6, x + 13.6, y - 6.6, x + 12, y - 12], '#ffe45c', null, 0);
    },
    ai(f, m, cpu) {
      const r = f.v.ride;
      if (r) {             // flying the rocket: line it up with whoever is next in its path
        let best = null, bd = 1e9;
        for (const o of m.foes(f)) { let d = (o.x - r.x) * r.dir; if (d < -30) d += r.r - r.l; if (d < bd) { bd = d; best = o; } }
        cpu.stick(0, best ? clamp((best.cy - r.y) / 24, -1, 1) : 0);
        return true;
      }
    },
  },
  ai: {
    nspecial: { range: [30, 105], dy: 40, w: 0.6 },
    sspecial: { range: [80, 200], dy: 36, w: 0.7 },
    super: { range: 9999, dy: 9999, anyFacing: true },
    recovery: { up: 230, holdUp: 70, side: 180 },
  },
};
