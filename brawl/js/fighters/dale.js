// DALE - slot 14 of the roster.
// Brief: deliberately the blandest man alive. A fishing rod for the long-reach
// moves, honest punches up close, and a cooler of fish that flop along behind
// him until he throws them. Super: he gets in a rowboat and the water rises.

import { biped, at } from '../game/rig.js';
import { K, hit, box, air, stdGrab, stdThrows, shoot, costumes, stdTaunt } from '../game/movekit.js';
import { Entity, Projectile } from '../game/entities.js';
import { groundBelow, pointInSolid } from '../game/physics.js';
import { W, H } from '../core/config.js';
import { OUT, LW, circle, ellipse, blob, blobPath, rrect, limb, line, polygon, eye, mouth, darken, lighten, star } from '../core/gfx.js';
import { TAU, clamp, lerp, approach, ease } from '../core/util.js';

const ROD = 40;
const BASE = {
  main: '#b9a36a', skin: '#f0c39a', hair: '#7a5a3a', stache: '#6a4a2c', hat: '#c9bb8a', band: '#7c8a4a',
  shirt: '#5b8fd0', plaid: '#2f5f9e', sleeve: '#5b8fd0', vest: '#b9a36a', trim: '#f4f0e0', shorts: '#8d936c',
  sock: '#f7f7f2', sandal: '#7a5230', rod: '#e0b63a', cork: '#d9a25e', reel: '#cfd6e0', lure1: '#ff5a3a', lure2: '#34c8b8',
  boat: '#b5793f', style: 'vest',
};

// ---- small shared drawings ---------------------------------------------------
function fishLine(ctx, x1, y1, x2, y2, sag = 0) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag, x2, y2);
  ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.8; ctx.stroke();
  ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = 1.2; ctx.stroke();
}
function bobber(ctx, x, y, r = 3.8) {
  circle(ctx, x, y, r, '#ffffff', null, 0);
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, TAU); ctx.fillStyle = '#e8402a'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
}
function barb(ctx, x, y, s = 1) {
  ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x, y + 2 * s); ctx.arc(x - 3 * s, y + 2 * s, 3 * s, 0, Math.PI * 0.95);
  ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.stroke();
  ctx.strokeStyle = '#dfe5ee'; ctx.lineWidth = 1.5; ctx.stroke();
}

// The three fish, drawn nose-forward (+x) around the origin. 0 minnow, 1 bass, 2 pufferfish.
const SLOT = ['#d6ecff', '#dff2c4', '#fff0a8'];
function drawFish(ctx, k, puff = 0) {
  if (k === 0) {            // minnow: a silver sliver
    polygon(ctx, [-7, 0, -12.5, -4.4, -10.6, 0, -12.5, 4.4], '#9fb0c6', OUT, 1.6);
    ellipse(ctx, 0, 0, 9.4, 3.7, '#e4ebf3', OUT, 1.8);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 8.6, 3, 0, 0, TAU); ctx.clip(); ctx.fillStyle = '#7f93ad'; ctx.fillRect(-10, -4, 20, 2.8); ctx.restore();
    circle(ctx, 5.6, -0.2, 1.2, OUT, null, 0);
  } else if (k === 1) {     // bass: green and chunky
    polygon(ctx, [-9, 0, -16.5, -6.5, -13.6, 0, -16.5, 6.5], '#3f8f3a', OUT, 1.8);
    polygon(ctx, [-6, -5.4, -1, -11, 5.5, -5.8], '#3f8f3a', OUT, 1.6);
    ellipse(ctx, 0, 0, 12.4, 7.2, '#62b54c', OUT, 2);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 11.4, 6.2, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = '#eef3cc'; ctx.fillRect(-13, 2.4, 26, 6); ctx.fillStyle = '#2f6f2c'; ctx.fillRect(-13, -0.6, 19, 1.8);
    ctx.restore();
    line(ctx, 12, 2.2, 7.6, 3, OUT, 1.5);
    circle(ctx, 7, -2, 2.3, '#ffffff', OUT, 1.2); circle(ctx, 7.5, -2, 1, OUT, null, 0);
  } else {                  // pufferfish: a spiky yellow ball that swells
    const r = 7.4 * (1 + puff * 0.9);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3, c = Math.cos(a), s = Math.sin(a);
      polygon(ctx, [c * (r + 3.6), s * (r + 3.6), c * (r - 1) - s * 2, s * (r - 1) + c * 2, c * (r - 1) + s * 2, s * (r - 1) - c * 2], '#f2b81c', OUT, 1.3);
    }
    polygon(ctx, [-r + 1, 0, -r - 4.6, -3, -r - 4.6, 3], '#f2b81c', OUT, 1.4);
    circle(ctx, 0, 0, r, '#ffd84a', OUT, 1.8);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, TAU); ctx.clip(); ctx.fillStyle = '#fff6c8'; ctx.fillRect(-r, r * 0.3, r * 2, r); ctx.restore();
    circle(ctx, r * 0.42, -r * 0.24, 2.4, '#ffffff', OUT, 1.2); circle(ctx, r * 0.5, -r * 0.24, 1, OUT, null, 0);
    circle(ctx, r * 0.84, r * 0.2, 1.3, '#d4334a', OUT, 1);
  }
}

// ---- the puppet ------------------------------------------------------------------
// where the line ends for a pose: [tipX, tipY, bobberX, bobberY]
function lineEnd(J, p) {
  const tx = J.hR[0] + Math.cos(p.prop) * ROD, ty = J.hR[1] + Math.sin(p.prop) * ROD;
  const L = 5 + (p.cast || 0) * 40, a = p.la === undefined ? 1.57 : p.la;
  return [tx, ty, tx + Math.cos(a) * L, ty + Math.sin(a) * L];
}
// the rowboat only exists while the super runs: it grows in, then folds away
const boatSize = (f) => (f.moveId !== 'super' ? 0 : f.mf <= 30 ? clamp(f.mf / 9, 0, 1) : clamp((50 - f.mf) / 12, 0, 1));

const rig = biped({
  hipY: 15, hipW: 7, shY: 30, shW: 12, headY: 45,
  arm: [11, 11], leg: [8, 8], armW: 7, legW: 8, handR: 5.5, footL: 13, footH: 7, propLen: ROD,
  armKey: 'skin', sleeveKey: 'sleeve', handKey: 'skin',
  stance: { hR: at(16, 22), hL: at(-10, 18), prop: -1.3, cast: 0, la: 1.57 },
  airStance: { hR: at(16, 32), hL: at(-12, 30), fR: at(6, 5), fL: at(-7, 1), prop: -1.0 },

  extraPoints(f, p, J, out, xf) { const e = lineEnd(J, p); out.bob = xf(p, e[2], e[3]); },

  // cargo shorts to the knee, a strip of shin, white socks, sandals
  drawLeg(ctx, { pal, S }, hp, k, ft) {
    const ay = ft[1] - S.footH * 0.5, mx = k[0] + (ft[0] - k[0]) * 0.42, my = k[1] + (ay - k[1]) * 0.42;
    limb(ctx, [k[0], k[1], mx, my], 6.2, pal.skin, OUT, LW);
    limb(ctx, [mx, my, ft[0], ay], 6.8, pal.sock, OUT, LW);
    limb(ctx, [hp[0], hp[1], k[0], k[1]], 9.6, pal.shorts, OUT, LW);
    ctx.save(); ctx.translate(ft[0], ay); ctx.rotate(clamp(-ft[1] / 10, 0, 1) * 0.5);
    rrect(ctx, -4.6, 1, S.footL + 1.4, 3.4, 1.6, pal.sandal, OUT, 1.8);
    ellipse(ctx, S.footL * 0.2, -0.4, S.footL * 0.46, S.footH * 0.42, pal.sock, OUT, LW);
    line(ctx, 1.6, -3.4, 4.4, 1.6, pal.sandal, 2.6);
    ctx.restore();
  },

  torso(ctx, { J, pal }) {
    const sh = J.sh, hip = J.hip, mx = (sh[0] + hip[0]) / 2, my = (sh[1] + hip[1]) / 2;
    const body = [sh[0] - 10.5, sh[1] - 1, sh[0] + 9.5, sh[1] - 1.5, mx + 12.5, my + 1.5, hip[0] + 10.5, hip[1] + 2, hip[0] - 10, hip[1] + 2, mx - 11.5, my];
    rrect(ctx, hip[0] - 10.5, hip[1] - 3, 21.5, 8.5, 3.5, pal.shorts, OUT, LW);     // seat of the shorts
    if (pal.style === 'slicker') {                                                    // a raincoat hides the lot
      const coat = body.slice(); coat[7] += 4.5; coat[9] += 4.5;
      blob(ctx, coat, pal.vest, OUT, LW, 0.4);
      line(ctx, sh[0] + 6.5, sh[1] + 1, hip[0] + 8, hip[1] + 5, darken(pal.vest, 0.4), 1.6);
      for (const u of [0.28, 0.64]) circle(ctx, lerp(sh[0] + 4.4, hip[0] + 5.6, u), lerp(sh[1] + 2, hip[1] + 4, u), 1.6, pal.trim, OUT, 1.1);
      return;
    }
    blob(ctx, body, pal.shirt, OUT, LW, 0.4);
    ctx.save(); blobPath(ctx, body, 0.4, true); ctx.clip();
    if (pal.style === 'aloha') {
      for (const [fx, fy] of [[-7.5, -3.6], [2.5, -5.4], [-2.2, 3.4], [8, 1.4], [-9.5, 6]]) { star(ctx, mx + fx, my + fy, 3.5, 1.6, 5, pal.plaid, null, 0); circle(ctx, mx + fx, my + fy, 1, pal.trim, null, 0); }
    } else {
      ctx.fillStyle = pal.plaid;
      for (const x of [-8.5, -1, 6.5]) ctx.fillRect(mx + x - 1.5, sh[1] - 6, 3, 30);
      for (const y of [-4.5, 3]) ctx.fillRect(mx - 18, my + y - 1.3, 36, 2.6);
    }
    ctx.restore();
    blobPath(ctx, body, 0.4, true); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.stroke();
    if (pal.style === 'aloha') { polygon(ctx, [sh[0] + 1, sh[1] - 2.4, sh[0] + 8.4, sh[1] - 2, sh[0] + 6, sh[1] + 3.4], pal.trim, OUT, 1.5); return; }
    // the fishing vest: back panel, front panel, plaid showing in between
    blob(ctx, [sh[0] - 11, sh[1] - 1.6, sh[0] + 2.5, sh[1] - 2, mx + 4, my + 1, hip[0] + 3.5, hip[1] + 0.5, hip[0] - 10.4, hip[1] + 0.5, mx - 12, my], pal.vest, OUT, 2, 0.35);
    blob(ctx, [sh[0] + 7.2, sh[1] - 1.8, sh[0] + 10, sh[1] - 0.6, mx + 13, my + 1.6, hip[0] + 11, hip[1] + 0.5, hip[0] + 8, hip[1] + 0.5, mx + 8.4, my + 1], pal.vest, OUT, 2, 0.35);
    rrect(ctx, mx - 8.4, my + 0.4, 7.6, 5.6, 1.4, lighten(pal.vest, 0.18), darken(pal.vest, 0.42), 1.3);
    line(ctx, mx - 8.2, my + 2.3, mx - 1, my + 2.3, darken(pal.vest, 0.42), 1.2);
    rrect(ctx, mx - 7.4, sh[1] + 2.2, 5.2, 3.6, 1, pal.trim, darken(pal.vest, 0.42), 1.2);
    circle(ctx, mx - 4.8, sh[1] + 4, 1.1, pal.lure1, null, 0);
  },

  head(ctx, { pal, p, f }) {
    const ex = p.face, ey = 0.3;
    ctx.scale(1.14, 1.14);
    ellipse(ctx, -6.2, 3.2, 5.8, 7.6, pal.hair, OUT, 2);
    ellipse(ctx, 1.6, 1.8, 11.2, 11.4, pal.skin);
    ellipse(ctx, -5.4, 3.6, 2.4, 3.2, pal.skin, OUT, 1.5);
    if (ex === 0) {          // half-lidded: a man watching a bobber
      for (const gx of [4.2, 10.8]) {
        eye(ctx, gx, ey, 2.8, 0, 0.3, 0.3, 1, { lw: 1.3 });
        ctx.fillStyle = pal.skin; ctx.fillRect(gx - 3.5, ey - 3.8, 7, 2.8);
        line(ctx, gx - 3, ey - 1, gx + 3, ey - 1, OUT, 1.5);
      }
    } else { eye(ctx, 4.2, ey, 2.8, ex, 0.3, 0, 1, { lw: 1.3, t: f.t }); eye(ctx, 10.8, ey, 2.8, ex, 0.3, 0, -1, { lw: 1.3, t: f.t }); }
    if (ex === 2 || ex === 6) mouth(ctx, 8.8, 11, 5.4, 2, { lw: 1.2 });
    else if (ex === 3) mouth(ctx, 8.8, 9.6, 6.4, 3, { lw: 1.2 });
    else if (ex === 1) mouth(ctx, 8.8, 10.4, 6, 1, { lw: 1.1 });
    ellipse(ctx, 9.8, 4, 2.9, 2.4, pal.skin, OUT, 1.4);                                      // dad nose
    blob(ctx, [2.4, 8, 5.4, 5.6, 8.8, 6.6, 12.2, 5.4, 15, 7.8, 12.4, 9.8, 8.8, 8.8, 5, 10], pal.stache, OUT, 1.4, 0.5);
    // the hat: a bucket (or a billed cap) with two lures stuck in it
    const crown = [-10.4, -7.6, -9.2, -16.6, -1, -19.4, 8.6, -18.4, 12.4, -9, 1, -6.6];
    blob(ctx, crown, pal.hat, OUT, LW, 0.42);
    ctx.save(); blobPath(ctx, crown, 0.42, true); ctx.clip(); ctx.fillStyle = pal.band; ctx.fillRect(-12, -12.6, 26, 3.8); ctx.restore();
    if (pal.cap) blob(ctx, [8.6, -11.2, 15.5, -10.6, 23.5, -6.4, 15, -5.6, 7.6, -7], pal.hat, OUT, LW, 0.4);
    else blob(ctx, [-17, -4.6, -11, -9.4, 1, -10.8, 13, -10, 21.5, -4.4, 12, -5.4, 0, -6.4, -10, -5.4], pal.hat, OUT, LW, 0.4);
    for (const [lx, ly, lr, lc] of [[-4.2, -15, -0.5, pal.lure1], [4.4, -15.4, 0.55, pal.lure2]]) {
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(lr);
      ellipse(ctx, 0, 0, 3, 1.7, lc, OUT, 1.1); line(ctx, 3, 0, 5, 0.8, OUT, 1.1);
      ctx.restore();
    }
    if (pal.lamp) circle(ctx, 10.6, -11, 2.8, pal.lamp, OUT, 1.3);                           // headlamp for the night shift
  },

  prop(ctx, { pal }) {   // the rod: origin is the hand, +x runs up to the tip
    limb(ctx, [7, 0, ROD, 0], 1.9, pal.rod, OUT, 1.5);
    for (const x of [17, 28, 38]) circle(ctx, x, 1.7, 1.2, pal.reel, OUT, 1);
    limb(ctx, [-6, 0, 8, 0], 4, pal.cork, OUT, 1.8);
    circle(ctx, 4.5, 4.6, 3.2, pal.reel, OUT, 1.5); circle(ctx, 4.5, 4.6, 1, OUT, null, 0);
  },

  back(ctx, { f, pal }) {
    const s = boatSize(f); if (s <= 0) return;
    ctx.save(); ctx.translate(0, 4); ctx.scale(s, s);
    blob(ctx, [-36, -13, 30, -13, 45, -17, 36, 2, -30, 4], darken(pal.boat, 0.34), OUT, LW, 0.25);       // inside of the hull
    ctx.restore();
  },

  front(ctx, { f, pal, p, J }) {
    const v = f.v || {}, s = boatSize(f);
    if (s > 0) {
      ctx.save(); ctx.translate(0, 4); ctx.scale(s, s);
      blob(ctx, [-37, -9, 0, -7.6, 32, -10, 46, -15, 38, 3, 25, 7, -28, 7, -35, 2], pal.boat, OUT, LW, 0.3);
      line(ctx, -32, -1.4, 38, -3.4, darken(pal.boat, 0.3), 1.8);
      limb(ctx, [-37, -9.6, 0, -8.2, 32, -10.6, 45, -15.4], 2.6, lighten(pal.boat, 0.3), OUT, 1.6);
      ctx.restore();
    }
    if (f.moveId === 'dspecial') {            // the cooler, lid up
      const u = clamp(Math.min(f.mf / 6, (36 - f.mf) / 6), 0, 1);
      ctx.save(); ctx.translate(26, 0); ctx.scale(u, u);
      rrect(ctx, -10, -24, 20, 5, 2, '#f4fbff', OUT, 2);
      rrect(ctx, -10, -14, 20, 14, 2.5, '#3a8fd8', OUT, LW);
      ctx.fillStyle = '#f4fbff'; ctx.fillRect(-9, -8, 18, 3);
      ctx.restore();
    }
    const held = f.moveId === 'sspecial' && f.mf < 11 ? v.held : f.moveId === 'dspecial' && f.mf >= 14 && f.mf < 30 ? v.pluck : -1;
    if (held >= 0) { ctx.save(); ctx.translate(J.hL[0], J.hL[1] - 4); ctx.rotate(-1.2 + Math.sin(f.t * 0.9) * 0.25); drawFish(ctx, held); ctx.restore(); }
    // line and bobber, unless the hook is off doing something
    if ((v.hook && !v.hook.dead) || (f.moveId === 'uspecial' && v.sky && !v.sky.dead)) return;
    const e = lineEnd(J, p);
    fishLine(ctx, e[0], e[1], e[2], e[3], (p.cast || 0) * 4);
    bobber(ctx, e[2], e[3]);
  },
});

// ---- the fish he throws ------------------------------------------------------
const FLY = [
  { vx: 11.5, vy: -0.8, g: 0.06, r: 8, life: 70, spin: 0, hit: { dmg: 5, ang: 361, bk: 14, kg: 38, sfx: 'slap', fx: 'water' } },
  { vx: 6.4, vy: -6.6, g: 0.36, r: 11, life: 140, spin: 0.22, hit: { dmg: 10, ang: 48, bk: 38, kg: 80, sfx: 'whop', fx: 'water' } },
  { vx: 3.9, vy: -5.4, g: 0.19, r: 9, life: 60, spin: 0.08 },
];
const pluck = (m) => { const r = m.rng.next(); return r < 0.4 ? 0 : r < 0.72 ? 1 : 2; };

function drawFlying(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.facing * 1.2, 1.2);
  ctx.rotate(p.fk === 0 ? Math.atan2(p.vy, Math.abs(p.vx) || 1) : p.rot);
  drawFish(ctx, p.fk, p.puff || 0);
  ctx.restore();
}
// the pufferfish has no hitbox of its own: it swells, and goes off when it touches anything
function pufferTick(p, m) {
  p.puff = clamp(p.t / 50, 0, 1);
  const shape = [{ x: p.x, y: p.y, r: 9 + p.puff * 7 }];
  for (const t of m.foes(p.owner)) if (m.canBeHit(t) && t.invuln <= 0 && m.overlap(shape, t.hurtboxes())) { p.die(m); return; }
}
function burst(p, m) {
  m.spawn(new Projectile(m, { owner: p.owner, x: p.x, y: p.y, r: 42, life: 4, stage: 'pass', pierce: true, reflectable: false, mul: p.mul,
    hit: { dmg: 8, ang: 62, bk: 36, kg: 66, radial: true, sfx: 'pop', fx: 'water' } }));
  m.fx.burst(p.x, p.y, 48, '#ffe45c'); m.fx.spark(p.x, p.y, 8, '#ffffff'); m.fx.drops(p.x, p.y, 8); m.sfx('pop'); m.shake(3);
}
// o: optional world-space launch {wx, wy, vx, vy, g, mul} (used from the boat); otherwise the stock arc
function throwFish(f, m, k, o = {}) {
  const b = FLY[k];
  const p = new Projectile(m, {
    owner: f, tag: 'fish', fk: k, mul: o.mul || 1, r: b.r, life: b.life, spin: b.spin, g: o.g === undefined ? b.g : o.g,
    x: o.wx === undefined ? f.x + f.facing * 22 * f.scale : o.wx, y: o.wy === undefined ? f.y - 40 * f.scale : o.wy,
    vx: o.vx === undefined ? f.facing * b.vx : o.vx, vy: o.vy === undefined ? b.vy : o.vy,
    hit: b.hit, drawFn: drawFlying,
    onDie: k === 2 ? burst : (q, m2) => { m2.fx.drops(q.x, q.y, 5); m2.sfx('splat', { vol: 0.4 }); },
  });
  if (k === 2) { p.hit = null; p.tick = pufferTick; }
  return m.spawn(p);
}
function nearest(f, m) {
  let best = null, bd = 1e9;
  for (const o of m.foes(f)) { const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
function tossFromBoat(f, m, foe) {
  const k = f.v.fish.shift(); f.v.fol.shift();
  const g = k === 0 ? 0.06 : k === 1 ? 0.3 : 0.16, sp = k === 0 ? 11 : k === 1 ? 8 : 5.5;
  if (foe) f.face(foe.x - f.x);
  const x0 = f.x + f.facing * 14, y0 = f.y - 42;
  let vx = f.facing * 5, vy = 4;
  if (foe) {
    const dx = foe.x - x0, dy = foe.y - foe.h * 0.5 - y0, T = clamp(Math.hypot(dx, dy) / sp, 12, 52);
    vx = dx / T; vy = dy / T - 0.5 * g * T;
  }
  throwFish(f, m, k, { wx: x0, wy: y0, vx, vy, g, mul: 0.6 });
  f.v.toss = 12; f.v.boatCD = 36; m.sfx('throw');
}

// ---- neutral special: the hook on the end of the line ------------------------
class Hook extends Entity {
  constructor(m, f) {
    super({ owner: f, team: f.team, tag: 'hook' });
    this.dir = f.facing; this.facing = f.facing; this.mode = 'out'; this.victim = null;
    this.x = f.x + f.facing * 42 * f.scale; this.y = f.y - 34 * f.scale; this.vx = f.facing * 12.5; this.vy = -1.2;
    this.hit = { dmg: 0, ang: 80, set: 1, unblockable: true, sfx: 'tink', fx: 'slash', hl: 0.5 };
  }
  hitShapes() { return this.hit ? [{ x: this.x, y: this.y, r: 10 }] : null; }
  onHit(t, res, m) {
    if (this.mode !== 'out') return;
    this.hit = null; this.mode = 'back';
    if (res !== 'hit' || t.def.noGrab || t.def.noKnockback || t.out || t.state === 'dead') return;
    t.interrupt(); t.launch = null; t.freeze = 0; t.setState('trapped'); t.v.trapMax = 140;
    this.victim = t; this.mode = 'reel'; m.sfx('lever');
  }
  letGo() {
    if (this.victim && this.victim.state === 'trapped') this.victim.setState('air');
    this.victim = null; this.dead = true;
  }
  update(m) {
    this.t++;
    const f = this.owner, s = f.scale;
    if (f.out || f.state !== 'move' || f.moveId !== 'nspecial' || f.v.hook !== this || this.t > 170) { this.letGo(); return; }
    if (this.mode === 'out') {
      this.vy += 0.11; this.x += this.vx; this.y += this.vy;
      if (pointInSolid(m.stage, this.x, this.y)) { this.mode = 'back'; this.hit = null; m.sfx('tink', { vol: 0.5 }); m.fx.spark(this.x, this.y, 3, '#ffffff'); }
      else if (this.t >= 21) { this.mode = 'back'; this.hit = null; }
      return;
    }
    if (this.mode === 'back') {            // nothing on it: wind it home
      const dx = f.x + f.facing * 26 * s - this.x, dy = f.y - 32 * s - this.y, d = Math.hypot(dx, dy);
      if (d < 22) { this.dead = true; return; }
      this.x += (dx / d) * 20; this.y += (dy / d) * 20;
      return;
    }
    const v = this.victim;
    if (!v || v.out || v.state !== 'trapped') { this.victim = null; this.mode = 'back'; return; }
    const tx = f.x + f.facing * 34 * s, ty = f.y, dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
    if (d <= 15) { v.x = tx; v.y = ty; this.mode = 'hold'; }
    else { v.x += (dx / d) * 15; v.y += (dy / d) * 15; if (this.t % 4 === 0) m.sfx('click', { vol: 0.35 }); }
    v.intangible = true; v.vx = v.vy = v.kx = v.ky = 0; v.grounded = false; v.ground = null; v.facing = -f.facing;
    this.x = v.x; this.y = v.y - v.h * v.scale * 0.55;
  }
  draw(ctx) {
    const f = this.owner, P = f.pts;
    if (!P || !P.prop) return;
    fishLine(ctx, f.x + f.facing * P.prop[0] * f.scale, f.y + P.prop[1] * f.scale, this.x, this.y, this.mode === 'out' ? 7 : 1);
    if (this.victim) return;
    bobber(ctx, this.x - this.dir * 8, this.y - 1, 4.2);
    barb(ctx, this.x + this.dir * 2, this.y + 1);
  }
}
function drawSky(ctx, p) {
  const f = p.owner, P = f && f.pts;
  if (P && P.prop && f.moveId === 'uspecial') fishLine(ctx, f.x + f.facing * P.prop[0] * f.scale, f.y + P.prop[1] * f.scale, p.x, p.y + 4, 0);
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, -1); barb(ctx, 0, 0, 1.3); ctx.restore();
}

// ---- the super: the water ----------------------------------------------------
const RISE = 90, HOLD = 192, DRAIN = 30;
class Flood extends Entity {
  constructor(m, f) {
    super({ owner: f, tag: 'flood' });
    const g = f.grounded ? f.ground : groundBelow(m.stage, f.x, f.y - 4, 2000);
    const base = g ? g.y : f.y;
    this.top = Math.max(base - 236, m.stage.cam.t + 110);          // where the surface settles
    this.bot = Math.max(m.cam.view().b, base + 40) + 50;           // starts just under the screen
    this.level = this.bot; this.phase = 0; this.pt = 0; this.quiet = false; this.from = this.bot;
    this.wet = new Set();
    this.school = [];
    for (let i = 0; i < 8; i++) this.school.push({ x: i * 137, d: 46 + ((i * 83) % 330), v: (i % 2 ? -1 : 1) * (0.7 + (i % 4) * 0.45), s: 0.7 + (i % 3) * 0.35 });
    this.overlay = { dead: false, draw: (ctx, mm) => this.drawWater(ctx, mm) };
    m.overlays.push(this.overlay);
  }
  finish(m) {
    const f = this.owner;
    if (!this.quiet) for (const v of this.wet) this.launch(m, v);    // anyone the tide never dropped past
    this.wet.clear(); this.dead = true; this.overlay.dead = true;
    if (f.v.flood === this) f.v.flood = null;
  }
  launch(m, v) {
    if (v.out || v.state === 'dead' || v.state === 'respawn' || v.invuln > 0) return;
    m.blast(this.owner, v, { dmg: 12, ang: 85, bk: 40, kg: 110, dir: v.x >= this.owner.x ? 1 : -1, force: true, sfx: 'splash', fx: 'water' });
    m.fx.drops(v.x, v.y - v.h * 0.5, 10);
  }
  update(m) {
    this.t++;
    const f = this.owner;
    const ok = !f.out && f.state === 'move' && f.moveId === 'super' && f.v.flood === this && m.state !== 'over';
    if (this.phase < 2 && !ok) { this.phase = 2; this.pt = 0; this.quiet = true; this.from = this.level; }
    if (this.phase === 0) {
      this.level = lerp(this.bot, this.top, ease.io(++this.pt / RISE));
      if (this.pt % 14 === 0) m.sfx('bubble', { vol: 0.4 });
      if (this.pt >= RISE) { this.phase = 1; this.pt = 0; }
    } else if (this.phase === 1) {
      if (++this.pt >= HOLD) { this.phase = 2; this.pt = 0; this.from = this.level; m.sfx('slurp'); m.shake(5); }
    } else {
      this.level = lerp(this.from, this.bot, ease.in(++this.pt / DRAIN));
      if (this.pt >= DRAIN) { this.finish(m); return; }
    }
    for (const v of m.foes(f)) {
      const under = v.y - v.h * v.scale * 0.5 > this.level + 4, was = this.wet.has(v);
      if (under) {
        if (!was) { this.wet.add(v); m.fx.drops(v.x, this.level, 6); m.sfx('splash', { vol: 0.5 }); }
        v.vx *= 0.5; v.vy *= 0.5; v.kx *= 0.9; v.ky *= 0.9; v.fastFalling = false;       // wading through it
        if ((m.frame + v.slot * 5) % 11 === 0) m.fx.bubble(v.x + Math.sin(m.frame * 1.7 + v.slot) * 10, v.y - v.h * v.scale * 0.8, 3 + (m.frame % 3));
        if (this.phase === 1 && this.pt % 12 === 0 && v.invuln <= 0 && !v.superActive && !v.intangible) {
          if (v.shielding) { v.shieldHP -= 1.5; if (v.shieldHP <= 0) v.shieldBreak(); }     // a shield is an air bubble: it holds for a while
          else {
            v.pct = Math.min(999, v.pct + 2); v.stats.taken += 2; f.stats.dealt += 2; v.flash = 4; v.flashColor = '#7fc8ff';
            v.lastHitBy = f.slot; v.lastHitFrame = m.frame;
            if (v.def.stamina && v.pct >= v.def.stamina) m.ko(v, 'crash');
          }
        }
      } else if (was) {
        this.wet.delete(v);
        if (this.phase === 2 && !this.quiet) this.launch(m, v);                             // the tide goes out from under them
      }
    }
    for (const v of this.wet) if (v.out || v.state === 'dead' || v.state === 'respawn') this.wet.delete(v);
  }
  drawWater(ctx, m) {
    const sy = m.cam.toScreen(m.cam.x, this.level)[1], t = this.t;
    if (sy > H + 14) return;
    const wave = (x) => sy + Math.sin(x * 0.022 + t * 0.08) * 5 + Math.sin(x * 0.05 - t * 0.06) * 2.5;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 16) ctx.lineTo(x, wave(x));
    ctx.lineTo(W + 10, H + 10); ctx.closePath();
    ctx.fillStyle = 'rgba(40,128,214,0.4)'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(18,64,150,0.15)'; ctx.fillRect(0, sy + 150, W, H); ctx.fillRect(0, sy + 310, W, H);   // the deep end, in flat bands
    ctx.fillStyle = 'rgba(14,50,112,0.4)';
    for (const s of this.school) {
      const span = W + 240, x = ((((s.x + t * s.v) % span) + span) % span) - 120, y = sy + s.d + Math.sin(t * 0.05 + s.x) * 6;
      ctx.save(); ctx.translate(x, y); ctx.scale(s.v > 0 ? s.s : -s.s, s.s);
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-26, -8); ctx.lineTo(-26, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 16) { if (x === -10) ctx.moveTo(x, wave(x)); else ctx.lineTo(x, wave(x)); }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}

// ---- the moveset -----------------------------------------------------------------
const AFLOAT = { by: 6, lean: -0.06, hR: at(20, 27), prop: -0.42, cast: 0.6, la: 1.57, hL: at(-8, 16), face: 3 };
const BOAT_IN = K([0, {}], [6, { by: 4, hR: at(14, 34), hL: at(-12, 30), oy: -5 }], [14, AFLOAT]);
const BOAT_OUT = K([30, AFLOAT], [50, {}]);

const moves = {
  jab: {
    frames: 18, sfx: { 2: 'swishS' },
    pose: K([0, {}], [3, { hL: at(27, 29), lean: 0.2, ox: 3 }, 'out'], [7, { hL: at(25, 29), lean: 0.18, ox: 3 }], [18, {}]),
    hits: [hit([3, 5], 'hL', 9, 3, 78, 10, 25)],
    cancel: [{ to: 'jab2', f: [6, 14], on: 'attack' }],
  },
  jab2: {   // the rod hand follows through
    frames: 24, sfx: { 4: 'swishM' },
    pose: K([0, { hL: at(22, 29), lean: 0.15, ox: 3 }], [3, { hL: at(2, 26), hR: at(4, 28), prop: -1.9 }], [6, { hR: at(31, 29), prop: -1.75, hL: at(-6, 24), lean: 0.28, ox: 5 }, 'in'],
      [11, { hR: at(29, 29), prop: -1.75, hL: at(-6, 24), lean: 0.24, ox: 5 }], [24, {}]),
    hits: [hit([6, 8], 'hR', 11, 5, 45, 30, 72)],
  },
  ftilt: {  // a hook with a step in it
    frames: 30, sfx: { 6: 'swishM' }, vel: [[6, 3.2, null]],
    pose: K([0, {}], [5, { hL: at(-14, 34), lean: -0.14, hR: at(14, 26) }], [8, { hL: at(28, 33), lean: 0.3, ox: 5, fR: at(13, 0) }, 'in'],
      [13, { hL: at(23, 26), lean: 0.24, ox: 4, fR: at(13, 0) }], [30, {}]),
    hits: [hit([7, 10], 'hL', 11.5, 8, 361, 22, 92)],
  },
  utilt: {  // uppercut
    frames: 28, sfx: { 4: 'swishM' },
    pose: K([0, {}], [4, { by: 7, hL: at(12, 10), lean: 0.14 }], [7, { hL: at(11, 58), lean: -0.1, sy: 1.07, oy: -3 }, 'out'], [11, { hL: at(5, 58), lean: -0.14, oy: -2 }], [28, {}]),
    hits: [hit([5, 9], 'hL', 12, 7, 88, 30, 102)],
  },
  dtilt: {  // a low kick, sandal first
    frames: 24, sfx: { 4: 'swishS' },
    pose: K([0, { by: 5, lean: -0.05 }], [3, { by: 7, lean: -0.16, fR: at(4, 6) }], [6, { by: 7, lean: -0.22, fR: at(26, 4), hL: at(-14, 24), ox: 4 }, 'out'],
      [10, { by: 7, lean: -0.2, fR: at(24, 4), ox: 4 }], [24, { by: 3 }]),
    hits: [hit([5, 8], 'fR', 9.5, 6, 72, 24, 70)],
  },
  dash: {   // shoulder first
    frames: 38, fric: 0.3, sfx: { 4: 'swishM' }, vel: [[0, 6.3, null]],
    pose: K([0, { lean: 0.3 }], [5, { lean: 0.52, hL: at(12, 22), hR: at(8, 32), prop: -2.3, fR: at(12, 0), fL: at(-12, 0), ox: 3 }],
      [18, { lean: 0.48, hL: at(12, 22), hR: at(8, 32), prop: -2.3, fR: at(13, 0), fL: at(-10, 0), ox: 3 }], [38, {}]),
    hits: [hit([5, 10], [17, 32], 14, 10, 58, 56, 60), hit([11, 17], [16, 32], 12, 7, 62, 40, 50)],
  },
  fsmash: { // an overhead cast, used as a whip: the rod hits hard, the bobber on the end less so
    frames: 54, charge: { at: 9, max: 60 }, sfx: { 15: 'swishL' },
    pose: K([0, {}], [8, { hR: at(-6, 46), prop: -2.5, lean: -0.22, by: 2, fR: at(11, 0) }], [9, { hR: at(-6, 46), prop: -2.5, lean: -0.22, by: 2, fR: at(11, 0) }],
      [18, { hR: at(24, 22), prop: 0.3, lean: 0.36, by: 5, fR: at(13, 0), cast: 0.35, la: 0.25 }, 'in3'],
      [26, { hR: at(23, 20), prop: 0.4, lean: 0.32, by: 5, fR: at(13, 0), cast: 0.35, la: 1.1 }], [54, {}]),
    hits: [hit([17, 20], 'prop', 11, 17, 42, 32, 100, { to: 'hR', sfx: 'slap' }), hit([18, 20], 'bob', 8, 11, 42, 28, 88, { sfx: 'bonk' })],
    events: { 18: (f, m) => { m.fx.dust(f.x + f.facing * 66, f.y, 3); } },
  },
  usmash: { // rod flick straight up
    frames: 46, charge: { at: 6, max: 60 }, sfx: { 9: 'swishL' },
    pose: K([0, {}], [5, { hR: at(18, 10), prop: 0.7, by: 7, lean: 0.14 }], [6, { hR: at(18, 10), prop: 0.7, by: 7, lean: 0.14 }],
      [11, { hR: at(12, 52), prop: -1.52, lean: -0.04, sy: 1.05 }, 'in'], [16, { hR: at(-6, 48), prop: -2.3, lean: -0.12 }], [46, {}]),
    hits: [hit([9, 14], 'prop', 11, 14, 88, 34, 102, { to: 'hR', sfx: 'slap' })],
  },
  dsmash: { // sweeps the rod along the floor, front then back
    frames: 48, charge: { at: 6, max: 60 }, sfx: { 7: 'swishM', 13: 'swishM' },
    pose: K([0, {}], [5, { by: 8, hR: at(-4, 14), prop: -2.8, lean: -0.08 }], [6, { by: 8, hR: at(-4, 14), prop: -2.8, lean: -0.08 }],
      [9, { by: 10, hR: at(22, 9), prop: 0.2, lean: 0.24 }, 'in'], [15, { by: 10, hR: at(-20, 8), prop: 2.94, lean: -0.2 }, 'io'], [20, { by: 9, hR: at(-19, 8), prop: 3.0, lean: -0.18 }], [48, {}]),
    hits: [hit([8, 10], 'prop', 10, 13, 30, 36, 86, { to: 'hR', sfx: 'slap' }), hit([14, 17], 'prop', 10, 12, 30, 36, 86, { to: 'hR', rev: true, group: 1, sfx: 'slap' })],
  },
  nair: air({
    frames: 40, sfx: { 3: 'swishM' },
    pose: K([0, {}], [4, { fR: at(21, 14), fL: at(-12, 8), hL: at(-14, 34), hR: at(12, 38), prop: -1.7, lean: -0.2 }], [24, { fR: at(21, 14), fL: at(-12, 8), hL: at(-14, 34), hR: at(12, 38), prop: -1.7, lean: -0.2 }], [40, {}]),
    hits: [hit([4, 12], 'fR', 12, 9, 361, 20, 86), hit([13, 24], 'fR', 11, 5, 361, 14, 70, { group: 1 })],
  }, 10, [4, 30]),
  fair: air({   // rod swat
    frames: 40, sfx: { 7: 'swishM' },
    pose: K([0, {}], [6, { hR: at(0, 50), prop: -2.1, lean: -0.12 }], [10, { hR: at(24, 24), prop: 0.4, lean: 0.24 }, 'in'], [15, { hR: at(20, 16), prop: 0.8, lean: 0.2 }], [40, {}]),
    hits: [hit([9, 13], 'prop', 10, 11, 361, 24, 92, { to: 'hR', sfx: 'slap' })],
  }, 13, [6, 28]),
  bair: air({
    frames: 36, sfx: { 5: 'swishM' },
    pose: K([0, {}], [5, { hR: at(10, 30), prop: -0.6, lean: 0.1 }], [8, { hR: at(-20, 30), prop: 3.1, lean: -0.2 }, 'in'], [13, { hR: at(-19, 28), prop: 3.0, lean: -0.18 }], [36, {}]),
    hits: [hit([7, 11], 'prop', 10, 10, 361, 26, 94, { to: 'hR', rev: true, sfx: 'slap' })],
  }, 11, [5, 26]),
  uair: air({
    frames: 34, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { hR: at(20, 34), prop: -0.7 }], [7, { hR: at(6, 52), prop: -1.57 }, 'out'], [12, { hR: at(-8, 46), prop: -2.4 }], [34, {}]),
    hits: [hit([5, 10], 'prop', 10, 8, 84, 26, 94, { to: 'hR', sfx: 'slap' })],
  }, 10, [4, 24]),
  dair: air({   // both sandals, straight down
    frames: 48, sfx: { 11: 'swishM' },
    pose: K([0, {}], [9, { fR: at(7, 14), fL: at(-5, 12), hR: at(12, 44), prop: -1.5, hL: at(-12, 40) }],
      [13, { fR: at(4, -1), fL: at(-4, -1), sy: 1.06, hR: at(14, 42), prop: -1.4, hL: at(-14, 40) }, 'in'], [26, { fR: at(4, -1), fL: at(-4, -1), hR: at(14, 42), prop: -1.4, hL: at(-14, 40) }], [48, {}]),
    hits: [hit([12, 16], [0, 4], 13, 12, 270, 18, 82, { sfx: 'thud' }), hit([17, 26], [0, 4], 12, 8, 60, 20, 60, { group: 1 })],
  }, 20, [8, 34]),

  // --- specials ---
  nspecial: {   // cast: 0-11 wind up, waits at 24 while the line is out, 25-44 nothing biting, 50+ fish on
    kind: 'special', frames: 78, drift: 0.5, sfx: { 9: 'swishM' },
    can: (f) => !f.v.hook,
    exit: (f) => { if (f.v.hook) { f.v.hook.letGo(); f.v.hook = null; } },
    pose: K([0, {}], [7, { hR: at(-2, 46), prop: -2.4, lean: -0.16 }], [11, { hR: at(23, 30), prop: -0.1, lean: 0.24 }, 'in'], [24, { hR: at(22, 28), prop: 0.05, lean: 0.2 }], [44, {}],
      [50, { hR: at(22, 28), prop: 0.05, lean: 0.2 }], [55, { hR: at(10, 34), prop: -1.3, hL: at(-12, 30), lean: -0.1 }], [59, { hL: at(28, 30), hR: at(8, 32), prop: -1.5, lean: 0.3, ox: 4 }, 'in'],
      [65, { hL: at(26, 30), hR: at(8, 32), prop: -1.5, lean: 0.26, ox: 4 }], [78, {}]),
    events: { 11: (f, m) => { f.v.hook = m.spawn(new Hook(m, f)); m.sfx('throw'); } },
    tick: (f, m, fr) => {
      const h = f.v.hook, live = h && !h.dead;
      if (fr === 24) { if (live && h.mode !== 'hold') f.mf = 23; else if (live) f.mf = 49; }
      else if (fr === 44 && !live) f.mf = 77;
      else if (fr === 59 && live && h.victim) {        // reeled in: bop them away
        const v = h.victim; h.victim = null; h.dead = true; f.v.hook = null;
        m.blast(f, v, { dmg: 7, ang: 40, bk: 58, kg: 70, dir: f.facing, x: f.x, force: true, sfx: 'hitM' });
        if (v.state === 'trapped') v.setState('air');
      }
    },
  },
  sspecial: {   // throws the next fish in line (remap sends this to `shrug` when the bucket is empty)
    kind: 'special', frames: 36, drift: 0.7,
    can: (f) => !!(f.v.fish && f.v.fish.length),
    start: (f) => { f.v.held = f.v.fish.shift(); f.v.fol.shift(); },
    pose: K([0, {}], [7, { hL: at(-14, 44), lean: -0.16 }], [12, { hL: at(20, 36), lean: 0.22 }, 'in'], [18, { hL: at(20, 26), lean: 0.16 }], [36, {}]),
    events: { 11: (f, m) => { const k = f.v.held; f.v.held = -1; if (k >= 0) { throwFish(f, m, k); m.sfx('throw'); } } },
  },
  shrug: {      // nothing to throw
    kind: 'special', frames: 28, sfx: { 4: 'swishS' },
    pose: K([0, {}], [5, { hL: at(18, 38), hR: at(22, 38), prop: -1.57, lean: -0.08, hy: -1.5, face: 5 }, 'back'], [15, { hL: at(18, 38), hR: at(22, 38), prop: -1.57, lean: -0.08, hy: -1.5, face: 5 }], [28, {}]),
    hits: [box([5, 8], [22, 32], 26, 30, 2, 361, 34, 10, { sfx: 'slap' })],
  },
  uspecial: {   // casts straight up, then winds himself up the line
    kind: 'special', frames: 50, helpless: true, drift: 0.55, ledgeOK: 14, airOK: true, slideOff: true, sfx: { 5: 'throw' },
    vel: [[10, null, -10]],
    pose: K([0, {}], [4, { hR: at(18, 18), prop: 0.4, by: 5, lean: 0.1 }], [8, { hR: at(8, 54), prop: -1.5, sy: 1.05 }, 'in'],
      [30, { hR: at(8, 54), prop: -1.57, hL: at(-8, 20), fR: at(5, 4), fL: at(-6, 2) }], [50, { hR: at(12, 40), prop: -1.3 }]),
    events: {
      6: (f, m) => {
        f.v.sky = shoot(f, m, { tag: 'skyhook', x: 12, y: 88, vy: -35, r: 10, life: 27, stage: 'pass', pierce: true, reflectable: false,
          hit: { dmg: 4, ang: 80, bk: 36, kg: 30, sfx: 'tink', fx: 'slash' }, drawFn: drawSky,
          tick: (p, m2) => { if (p.t === 7) { p.vy = 0; m2.fx.spark(p.x, p.y, 4, '#ffffff'); m2.sfx('tink', { vol: 0.5 }); } if (p.owner.moveId !== 'uspecial') p.dead = true; } });
      },
    },
    tick: (f, m, fr) => { if (fr > 10 && fr < 30) { f.vy = -10; if (fr % 4 === 0) m.sfx('click', { vol: 0.3 }); } else if (fr === 30) f.vy = -3.5; },
  },
  dspecial: {   // pulls a fish out of the cooler
    kind: 'special', frames: 36, drift: 0.5,
    can: (f) => !!f.v.fish && f.v.fish.length < 3,
    pose: K([0, {}], [8, { by: 8, lean: 0.3, hL: at(24, 10), hR: at(12, 24), prop: -1.9 }], [13, { by: 8, lean: 0.3, hL: at(24, 8), hR: at(12, 24), prop: -1.9 }],
      [18, { hL: at(14, 46), lean: -0.06, face: 3 }, 'out'], [29, { hL: at(14, 46), lean: -0.06, face: 3 }], [36, {}]),
    events: { 14: (f, m) => { const k = pluck(m); f.v.fish.push(k); f.v.pluck = k; m.sfx('splash', { vol: 0.5 }); m.fx.drops(f.x + f.facing * 26, f.y - 16, 4); } },
  },

  // --- grab + throws ---
  grab: stdGrab(K([0, {}], [6, { hL: at(29, 27), hR: at(14, 30), prop: -1.9, lean: 0.3 }, 'out'], [12, { hL: at(28, 26), hR: at(14, 29), prop: -1.9, lean: 0.26 }], [30, {}]), 31, { h: 30 }),
  ...stdThrows({
    f: { dmg: 8, bk: 60, kg: 66, f: 13, frames: 32, pose: K([0, { hL: at(24, 27) }], [8, { hL: at(-8, 30), lean: -0.12 }], [13, { hL: at(29, 30), lean: 0.3, ox: 4 }, 'in'], [32, {}]) },
    b: { dmg: 9, bk: 62, kg: 82, f: 15, frames: 36, pose: K([0, { hL: at(24, 27) }], [8, { hL: at(10, 46), hR: at(6, 46), prop: -1.8, lean: -0.1 }], [15, { hL: at(-20, 32), hR: at(-14, 36), prop: -2.6, lean: -0.34 }, 'in'], [36, {}]) },
    u: { dmg: 8, bk: 66, kg: 70, f: 12, frames: 32, pose: K([0, { hL: at(24, 27) }], [7, { by: 8, hL: at(18, 14) }], [12, { hL: at(10, 58), sy: 1.05, lean: -0.08 }, 'in'], [32, {}]) },
    d: { dmg: 7, bk: 52, kg: 40, f: 15, frames: 34, sfx: 'slap', pose: K([0, { hL: at(24, 27) }], [8, { hL: at(20, 10), hR: at(0, 48), prop: -2.2, by: 6 }], [15, { hL: at(20, 9), hR: at(24, 12), prop: 0.6, by: 10, lean: 0.3 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 9: 'swishM' },
    pose: K([0, { by: 12, lean: 0.2 }], [10, { by: 9, hR: at(22, 8), prop: 0.3 }], [16, { by: 9, hR: at(-20, 9), prop: 2.9, lean: -0.15 }, 'io'], [34, {}]),
    hits: [hit([9, 12], 'prop', 10, 6, 50, 40, 50, { to: 'hR' }), hit([15, 18], 'prop', 10, 6, 50, 40, 50, { to: 'hR', rev: true, group: 1 })],
  },
  taunt: stdTaunt({ hR: at(21, 33), prop: -1.57, hL: at(-17, 33), lean: -0.06, face: 3 }, 64),     // "it was this big"

  // --- the super: GONE FISHIN' ---
  // Frames 0-13 he steps into the boat, then the move waits on frame 30 for as long as the water lasts.
  super: {
    kind: 'super', frames: 50, grav: 0, keepV: true, airOK: true, slideOff: true, drift: 0, noPush: true, base: 'ground', sfx: { 2: 'wood' },
    start: (f) => { f.v.toss = 0; f.v.boatCD = 40; },
    pose: (f, fr) => {
      if (fr < 14) return BOAT_IN;
      if (fr > 30) return BOAT_OUT;
      const u = clamp(((f.v && f.v.toss) || 0) / 12, 0, 1);
      return Object.assign({}, AFLOAT, { rot: Math.sin(f.t * 0.07) * 0.05, lean: -0.06 + u * 0.2, hL: u > 0 ? [lerp(22, -8, u), -lerp(30, 44, u)] : AFLOAT.hL });
    },
    events: {
      12: (f, m) => {
        while (f.v.fish.length < 3) f.v.fish.push(pluck(m));         // the boat comes with a full cooler
        f.v.flood = m.spawn(new Flood(m, f)); m.sfx('splash');
      },
    },
    tick: (f, m, fr) => {
      const v = f.v, fl = v.flood, live = fl && !fl.dead;
      if (v.toss > 0) v.toss--;
      if (v.boatCD > 0) v.boatCD--;
      if (live && fr === 30) f.mf = 29;
      if (live && fl.level <= f.y + 3) {       // afloat: ride the surface, row with the stick, throw fish
        f.grounded = false; f.ground = null;
        f.vy = clamp((fl.level + 3 + Math.sin(m.frame * 0.09) * 2.5 - f.y) * 0.3, -9, 5);
        f.vx = approach(f.vx, f.inp.x * 2.6, 0.22);
        if (Math.abs(f.inp.x) > 0.3) f.face(f.inp.x);
        const c = m.stage.cam; f.x = clamp(f.x, c.l + 60, c.r - 60);
        if (fl.phase < 2 && v.boatCD <= 0 && v.fish.length) {
          const foe = nearest(f, m);
          if (f.isCPU ? foe && m.rng.chance(0.06) : f.pressed('special') || f.pressed('attack')) { f.eat('special'); f.eat('attack'); tossFromBoat(f, m, foe); }
        }
      } else {                                  // high and dry: sit tight (or drop, if there is nothing under the boat)
        if (!f.grounded) f.vy = Math.min(f.vy + f.st.gravity, f.st.fall);
        f.vx = approach(f.vx, 0, 0.3);
      }
    },
  },
};

export default {
  id: 'dale', name: 'DALE', from: 'Just One More Cast', superName: "Gone Fishin'",
  blurb: "Somebody's dad, chaperoning. Average weight, average speed, average everything: he checked. The fish are the interesting part.",
  stats: { weight: 100, walk: 2.3, dash: 5.4, run: 4.8, w: 30, h: 60 },
  portrait: { x: 3, y: -45, s: 1.1 },
  costumes: costumes(BASE, [
    ['Weekend', {}],
    ['Opening Day', { main: '#ff8a1e', hat: '#ff8a1e', band: '#d9641a', cap: true, shirt: '#d8423a', plaid: '#8f1d1a', sleeve: '#d8423a', vest: '#4f6a3a', shorts: '#6a5a44', rod: '#f4f0e0', lure1: '#ffe45c', boat: '#8a5a34' }],
    ['Night Crawler', { main: '#3d4c5e', style: 'slicker', hat: '#3d4c5e', band: '#26303c', lamp: '#ffe45c', vest: '#3d4c5e', sleeve: '#3d4c5e', trim: '#ffd84a', shorts: '#2c3540', sock: '#8d96a6', sandal: '#22262e', rod: '#9be04a', stache: '#4a4a52', hair: '#4a4a52', boat: '#5f6b7d' }],
    ['Dress Casual', { main: '#22b8a8', style: 'aloha', hat: '#f0dc9a', band: '#e8402a', shirt: '#22b8a8', plaid: '#ff8fb8', sleeve: '#22b8a8', trim: '#fff6c8', shorts: '#f4ead0', sandal: '#b5793f', rod: '#ff7bc0', stache: '#c9c2b4', hair: '#c9c2b4', skin: '#e0a880', boat: '#e8d28a' }],
  ]),
  pose: rig.pose, points: rig.points, draw: rig.draw,
  moves,
  remap: (f, id) => (id === 'sspecial' && !(f.v.fish && f.v.fish.length) ? 'shrug' : id),
  hooks: {
    init(f) { Object.assign(f.v, { fish: [], fol: [], trail: [], hook: null, sky: null, flood: null, held: -1, pluck: -1, toss: 0, boatCD: 0 }); },
    postUpdate(f) {
      const v = f.v;
      if (f.superActive && !(f.state === 'move' && f.moveId === 'super')) f.superActive = false;   // knocked out of the boat by something scripted
      if (f.state === 'dead') return;
      // the fish follow where he has been, queueing up behind him when he stops
      const tr = v.trail; tr.push(f.x, f.y); if (tr.length > 100) tr.splice(0, 2);
      v.fol.length = Math.min(v.fol.length, v.fish.length);
      for (let i = 0; i < v.fish.length; i++) {
        const o = v.fol[i] || (v.fol[i] = { x: f.x - f.facing * 14, y: f.y });
        const k = Math.max(0, tr.length - 2 - (i + 1) * 12);
        o.x += (tr[k] - f.facing * (19 + i * 16) - o.x) * 0.2; o.y += (tr[k + 1] - o.y) * 0.28;
      }
    },
    onKO(f) { f.v.fish.length = 0; f.v.fol.length = 0; f.v.trail.length = 0; f.v.held = -1; },
    onRespawn(f) { f.v.trail.length = 0; },
    drawBack(ctx, f) {
      const fish = f.v.fish, fol = f.v.fol;
      for (let i = fish.length - 1; i >= 0; i--) {
        const o = fol[i]; if (!o) continue;
        const ph = f.t * 0.24 + i * 2.1;
        ctx.save(); ctx.translate(o.x, o.y - 7 - Math.abs(Math.sin(ph)) * 8); ctx.scale(f.facing, 1); ctx.rotate(Math.sin(ph * 2) * 0.45 - 0.2);
        drawFish(ctx, fish[i]);
        ctx.restore();
      }
    },
    drawHud(ctx, f, x, y) {      // the bucket: three slots, next fish on the left
      const fish = f.v.fish || [];
      for (let i = 0; i < 3; i++) {
        const sx = x + 24 + i * 24, sy = y - 21, k = fish[i];
        rrect(ctx, sx, sy, 22, 16, 4, k === undefined ? 'rgba(20,14,10,0.42)' : SLOT[k], i === 0 && k !== undefined ? '#ffffff' : OUT, 2);
        if (i === 0 && k !== undefined) rrect(ctx, sx - 1.5, sy - 1.5, 25, 19, 5, null, OUT, 1.6);
        if (k === undefined) continue;
        const s = k === 1 ? 0.62 : 0.78;
        ctx.save(); ctx.translate(sx + 11 + (k === 2 ? -0.5 : 1.2), sy + 8); ctx.scale(s, s); drawFish(ctx, k); ctx.restore();
      }
    },
  },
  ai: {
    nspecial: { range: [110, 250], dy: 30, w: 0.8 },
    sspecial: { range: [90, 400], dy: 70, w: 1.3 },
    dspecial: { range: [240, 2000], dy: 500, w: 1.4 },
    super: { range: 9999, dy: 9999, anyFacing: true },
    recovery: { up: 200 },
  },
};
