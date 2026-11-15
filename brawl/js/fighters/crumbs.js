// CRUMBS - slot 7 of the roster.
// Brief: a small bird in training. No fists: he rams with his head, charges at
// a run and dive-bombs from the air, and gets about on several mid-air flaps.
// Super: he evolves into a towering dino-pigeon and stomps people flat.

import { biped, at } from '../game/rig.js';
import { K, hit, box, air, stdGrab, stdThrows, shoot, countMine, costumes } from '../game/movekit.js';
import { Entity } from '../game/entities.js';
import { groundBelow } from '../game/physics.js';
import { OUT, LW, circle, ellipse, blob, limb, fs, eyes, darken, polygon, line } from '../core/gfx.js';
import { TAU, clamp, lerp, ease, approach, sign } from '../core/util.js';

const BASE = {
  main: '#7f9ab8', body: '#8ea7c2', belly: '#c6d4e2', wing: '#6c87a6', bar: '#3b4a61', tail: '#5d7692', tip: '#2f3c52',
  neck: '#35b37c', neck2: '#8a5cc4', beak: '#5b5560', cere: '#f6f2ea', eye: '#ffab3d', foot: '#f28a2e', band: '#e8402a',
  crown: '#ffcf33', hat: 0, cape: '', mean: 0,
};

const BIG = 2.6, BIG_T = 540;      // the super: how big, and for how long
const isBig = (f) => !!(f.v && f.v.big > 0);
const rotv = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

// several fat lines drawn as one outlined shape (legs and toes, ribbon ends)
function limbs(ctx, list, w, fill, lw) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (const p of list) { ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); }
    ctx.strokeStyle = pass ? fill : OUT; ctx.lineWidth = pass ? w : w + lw * 2; ctx.stroke();
  }
}

const BODY = [5, -21, 13.5, -13, 13, -2, 4, 5, -9, 4, -16, -6, -10, -18];   // a fat egg, in hip space

const rig = biped({
  hipY: 10, hipW: 6, shY: 24, shW: 10, headY: 37,
  arm: [8.5, 8.5], leg: [5.5, 5.5], footH: 3, kneeBend: 1,
  stance: { hR: at(-7, 12), hL: at(-10, 13), hx: 3 },
  airStance: { hR: at(-8, 35), hL: at(-13, 34), fR: at(4, 3), fL: at(-4, 1), hx: 3, lean: 0.1 },

  // wings instead of arms: a leaf from the shoulder to the tip, bowed through the elbow
  drawArm(ctx, { pal }, sh, e, h, front) {
    const dx = h[0] - sh[0], dy = h[1] - sh[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, w = 5.4;
    ctx.beginPath();
    ctx.moveTo(sh[0] + nx * w * 0.7, sh[1] + ny * w * 0.7);
    ctx.quadraticCurveTo(e[0] + nx * w * 1.5, e[1] + ny * w * 1.5, h[0], h[1]);
    ctx.quadraticCurveTo(e[0] - nx * w * 1.5, e[1] - ny * w * 1.5, sh[0] - nx * w * 0.7, sh[1] - ny * w * 0.7);
    ctx.closePath(); fs(ctx, front ? pal.wing : darken(pal.wing, 0.2), OUT, LW);
    for (const [u, hw] of [[0.5, 3.4], [0.72, 2.3]]) {      // the two dark wing bars
      const a = 1 - u, bx = a * a * sh[0] + 2 * a * u * e[0] + u * u * h[0], by = a * a * sh[1] + 2 * a * u * e[1] + u * u * h[1];
      line(ctx, bx - nx * hw, by - ny * hw, bx + nx * hw, by + ny * hw, pal.bar, 1.8);
    }
  },

  // twiggy legs, three toes forward and one back, and a fluffy thigh on the near side
  drawLeg(ctx, { pal, f }, hp, k, ft, front) {
    const c = front ? pal.foot : darken(pal.foot, 0.2), big = isBig(f), ay = ft[1] - 1.5;
    const a = clamp(-ft[1] / 10, 0, 1) * 0.7, ca = Math.cos(a), sa = Math.sin(a);
    const toe = (x, y) => [ft[0], ay, ft[0] + x * ca - y * sa, ay + x * sa + y * ca];
    limbs(ctx, [[hp[0], hp[1], k[0], k[1], ft[0], ay], toe(5.6, -1.8), toe(-3.2, 0.2), toe(7.8, 0.3), toe(5.8, 1.7)], big ? 3.6 : 2.7, c, 1.7);
    if (big) for (const [x, y] of [[7, -2.2], [9.6, 0.4], [7.2, 2.1]]) { const p = toe(x, y); circle(ctx, p[2], p[3], 1.2, pal.cere, OUT, 0.9); }
    if (front) ellipse(ctx, hp[0] + 0.4, hp[1] + 1.2, 4.7, 4.5, pal.body, OUT, 2);
  },

  back(ctx, { J, pal, p, f }) {
    const hip = J.hip, sh = J.sh, big = isBig(f), t = f.t || 0;
    ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(p.lean + Math.sin(t * 0.13) * 0.05);
    if (big) {      // the dino tail, and plates down the spine
      polygon(ctx, [-9, -15, -25, -12, -37, -3, -38.5, 1.5, -24, 2.5, -9, 1], pal.tail, OUT, LW);
      for (const [x, y] of [[-6, -21], [-12, -17], [-17, -11], [-24, -11.5], [-31, -7]]) polygon(ctx, [x - 3, y + 2.5, x - 2.5, y - 5.5, x + 3, y + 0.5], pal.band, OUT, 1.6);
    } else {        // a wedge of tail feathers with a dark band on the end
      polygon(ctx, [-9, -13, -27, -10.5, -29.5, -5, -26.5, 0.5, -9, -1], pal.tail, OUT, LW);
      polygon(ctx, [-22.6, -11.1, -27, -10.5, -29.5, -5, -26.5, 0.5, -21.6, 0.1], pal.tip, OUT, 1.6);
    }
    ctx.restore();
    if (pal.cape) {   // the champion's cape streams out behind when he runs
      const sw = Math.sin(t * 0.11) * 1.5 - clamp((f.vx || 0) * (f.facing || 1), -3, 6) * 0.9;
      blob(ctx, [sh[0] - 1, sh[1], sh[0] - 15, sh[1] + 5, hip[0] - 27 + sw, hip[1] - 2, hip[0] - 22 + sw * 0.6, hip[1] + 6, hip[0] - 9, hip[1] - 1, sh[0] - 4, sh[1] + 8], pal.cape, OUT, LW, 0.35);
      limb(ctx, [hip[0] - 27 + sw, hip[1] - 1.5, hip[0] - 22 + sw * 0.6, hip[1] + 6], 3, '#ffffff', OUT, 1.4);
    }
  },

  torso(ctx, { J, pal, p }) {
    const hip = J.hip, sh = J.sh, hd = J.head;
    const nk = [sh[0] + 1.5, sh[1] + 3, hd[0] - 0.5, hd[1] + 2];
    limb(ctx, nk, 12.5, pal.body, OUT, LW);                      // the neck stretches when he pecks
    ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(p.lean);
    blob(ctx, BODY, pal.body, OUT, LW, 0.5);
    ellipse(ctx, 4.5, -3.6, 7.6, 6.6, pal.belly, null, 0, -0.3);
    ctx.restore();
    limb(ctx, nk, 12.5, pal.body, null, 0);                      // fill again so neck and body read as one shape
    // the shimmer on his neck: green over a little purple
    limb(ctx, [nk[0], nk[1], lerp(nk[0], nk[2], 0.4), lerp(nk[1], nk[3], 0.4)], 11, pal.neck, null, 0);
    limb(ctx, [nk[0] - 2.5, nk[1] + 3, nk[0] + 3.5, nk[1] + 3.6], 4.2, pal.neck2, null, 0);
    if (pal.cape) { limb(ctx, [nk[0] - 6, nk[1] - 0.5, nk[0] + 5.5, nk[1] + 1.5], 3.4, pal.cape, OUT, 1.5); circle(ctx, nk[0] + 5.6, nk[1] + 1.6, 2.2, pal.crown, OUT, 1.4); }
  },

  head(ctx, { pal, p, f }) {
    const big = isBig(f), t = f.t || 0;
    let ex = p.face;
    if ((big || pal.mean) && ex === 0) ex = 1;
    const open = ex === 2 || ex === 3 || ex === 6 || (big && ex === 1);
    if (!pal.hat) {      // the loose ends of the sweatband, behind the head
      const sw = Math.sin(t * 0.21) * 1.5;
      limbs(ctx, [[-9.5, -5.6, -17, -2.8 + sw], [-9.5, -6, -16.5, -9.2 - sw * 0.6]], 3, pal.band, 1.5);
    }
    if (big) for (const a of [3.5, 4.0, 4.5]) {      // a spiky crest
      const c = Math.cos(a), s = Math.sin(a);
      polygon(ctx, [c * 9 - s * 3, s * 9 + c * 3, c * 16.5, s * 16.5, c * 9 + s * 3, s * 9 - c * 3], pal.band, OUT, 1.6);
    }
    circle(ctx, 0, 0, 10.5, pal.body, OUT, LW);
    if (!pal.hat) {
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 10.4, 0, TAU); ctx.clip();
      ctx.beginPath(); ctx.moveTo(-12, -7.6); ctx.quadraticCurveTo(0, -9.4, 12, -6.8); ctx.lineTo(12, -2.8); ctx.quadraticCurveTo(0, -5.6, -12, -3.8); ctx.closePath();
      fs(ctx, pal.band, OUT, 1.5);
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.stroke();
      circle(ctx, -9.4, -5.6, 2.2, pal.band, OUT, 1.5);         // the knot
    } else {
      polygon(ctx, [-7.6, -8, -9.2, -16, -4.6, -12.2, -1, -18.2, 2.6, -12.6, 7, -16.8, 6.4, -9], pal.crown, OUT, 1.8);
      circle(ctx, -0.8, -11.2, 1.4, pal.band, OUT, 1);
    }
    // beak: short, with the white bump every pigeon has on top of it
    if (open) {
      polygon(ctx, [7.4, 7, 15.4, 11.6, 6.8, 10.8], pal.beak, OUT, 1.7);
      polygon(ctx, [8.2, 5.6, 15, 7.4, 8.2, 9.2], '#7a1f25', null, 0);
      polygon(ctx, [7.8, 2.4, 18.2, 5.4, 8, 7], pal.beak, OUT, 1.7);
      if (big) for (const x of [10.6, 13, 15.2]) polygon(ctx, [x - 1.1, 6.9 - (x - 8) * 0.16, x + 1.1, 6.6 - (x - 8) * 0.16, x + 0.2, 9 - (x - 8) * 0.16], '#ffffff', OUT, 0.8);
    } else {
      polygon(ctx, [7.8, 3.2, 18.2, 7.2, 7, 9.4], pal.beak, OUT, 1.7);
      line(ctx, 9.4, 6.8, 16, 7.1, OUT, 1.1);
    }
    eyes(ctx, 3.2, 0.2, 3, 3.2, ex, 0.35, 0, { tall: true, lw: 1.6, white: pal.eye, pr: 0.5, t });
    ellipse(ctx, 10.8, open ? 3.2 : 4, 2.4, 1.6, pal.cere, OUT, 1.2, 0.3);
  },

  extraPoints(f, p, J, out, xf) {
    const b = rotv(15, 6, J.ht), tl = rotv(-24, -5, p.lean);
    out.beak = xf(p, J.head[0] + b[0], J.head[1] + b[1]);
    out.tail = xf(p, J.hip[0] + tl[0], J.hip[1] + tl[1]);
  },

  poseFix(f, p) {
    const st = f.state, v = f.v || {};
    if (st === 'walk' || st === 'run' || st === 'dash') p.hx += Math.sin((f.cycle / (st === 'walk' ? 10 : 15)) * 2) * 2.4;   // the pigeon head-bob
    else if (st === 'idle' && f.t % 150 < 7) p.ht -= 0.22;                                                              // and the twitchy head tilt
    else if (st === 'air' && v.flap > 0) { const k = Math.sin(v.flap * 0.9) * 13; p.hR = [-6, -24 - k]; p.hL = [-11, -23 - k]; }
    else if (st === 'land' && v.plant) { const u = clamp(f.sf / Math.max(1, f.lag), 0, 1); p.rot = lerp(v.plant, TAU, ease.out(u)); }   // beak-first landings flip back onto his feet
  },
});

// ---- things he leaves behind -------------------------------------------------
function drawCrumb(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  polygon(ctx, p.seed === 1 ? [-4, -2, 0, -4.5, 4.5, -1, 2.5, 3.5, -3, 3] : [-3.5, -3, 3, -3.5, 4.5, 1.5, 0, 4, -4.5, 1], '#e9c78a', OUT, 1.8);
  circle(ctx, -1, -0.5, 0.9, '#b98a4e', null, 0);
  ctx.restore();
}

// The shockwave from a giant footfall: runs out along the floor both ways, so jump it.
class Quake extends Entity {
  constructor(m, f, x, y, size) {
    super({ owner: f, team: f.team, layer: 'back', tag: 'quake' });
    this.x = x; this.y = y; this.size = size; this.reach = 0;
    this.ground = groundBelow(m.stage, x, y - 4, 40);
    this.hit = { dmg: 8, ang: 78, bk: 52, kg: 62, sfx: 'thud', fx: 'punch' };
  }
  span() {
    let l = this.x - this.reach, r = this.x + this.reach; const g = this.ground;
    if (g) { l = Math.max(l, g.x); r = Math.min(r, g.x + g.w); }
    return [l, Math.max(l + 1, r)];
  }
  update() {
    this.t++;
    this.reach = ease.out(clamp(this.t / 12, 0, 1)) * 150 * this.size;
    if (this.t > 12) this.hit = null;
    if (this.t > 20) this.dead = true;
  }
  hitShapes() { const s = this.span(); return [{ x: s[0], y: this.y - 24, w: s[1] - s[0], h: 28 }]; }
  draw(ctx) {
    const s = this.span(), a = clamp(1.4 - this.t / 14, 0, 1), y = this.y;
    ctx.save(); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(s[0] + 8, y + 1);
    for (let x = s[0] + 8, i = 0; x < s[1] - 8; x += 13, i++) ctx.lineTo(x, y + (i % 2 ? 3 : -1));
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    for (const d of [-1, 1]) {
      const x = d < 0 ? s[0] : s[1], h = 10 + 8 * a;
      blob(ctx, [x - d * 20, y, x - d * 9, y - h, x + d * 2, y - h * 0.7, x + d * 10, y], '#efe6d2', 'rgba(60,45,34,0.7)', 2, 0.5);
    }
    ctx.restore();
  }
}
function quake(f, m, x, size) {
  m.spawn(new Quake(m, f, x, f.y, size));
  m.shake(5 + size * 6); m.sfx('thud'); m.sfx('rumble', { vol: 0.5 });
  m.fx.dust(x, f.y, 8); m.fx.debris(x, f.y - 2, 6, '#9aa3b2');
}
function shrink(f, m) {
  f.v.big = 0; f.scale = 1; f.permArmor = 0;
  if (m) { m.fx.puff(f.x, f.cy, 8, '#ffffff'); m.sfx('slide_down'); }
}

// ---- the moveset -----------------------------------------------------------
const WU = { hR: at(-5, 38), hL: at(-11, 37) };                                   // wings up
const WB = { hR: at(-15, 24), hL: at(-16, 22) };                                  // wings swept back
const TUCK = { hR: at(-13, 30), hL: at(-15, 27), fR: at(2, 4), fL: at(-3, 3), hx: 4, hy: 2 };
const DIVE = { lean: 0.95, hx: 7, hy: 5, ht: 0.25, hR: at(-15, 28), hL: at(-16, 25), fR: at(-9, 7), fL: at(-12, 4) };
const WIND = { hx: -7, hy: 4, ht: -0.4, lean: -0.36, by: 3, fR: at(11, 0), fL: at(-9, 0), ...WU };
const RAM = { hx: 14, hy: 9, ht: 0.5, lean: 0.62, ox: 8, by: 3, fR: at(12, 0), fL: at(-12, 0), sx: 1.05, sy: 0.96, ...WB };
const DUCK = { by: 7, lean: 0.1, hy: 7, hx: 5, ht: -0.3, hR: at(-8, 20), hL: at(-11, 20) };
const HOLD = { hR: at(16, 22), hL: at(14, 24), hx: 10, lean: 0.12 };
const RAMKEYS = K([80, { lean: 0.6, hx: 11, hy: 8, ht: 0.4, ...WB }], [83, { lean: 0.8, hx: 15, hy: 9, ht: 0.55, ox: 7, sx: 1.06, sy: 0.95, fR: at(12, 0), fL: at(-12, 0), ...WB }, 'in3'],
  [92, { lean: 0.7, hx: 14, hy: 9, ht: 0.5, ox: 5, fR: at(12, 0), fL: at(-12, 0), ...WB }], [112, {}]);
// legs pedalling under a body tipped forward: the dash attack and the training montage share it
const sprint = (ph, k, tuck) => {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    lean: 0.16 + 0.5 * k, hx: 3 + 9 * k, hy: 9 * k, ht: 0.45 * k, by: 1 + Math.abs(c) * 1.5,
    fR: at(s * 10, Math.max(0, c) * 6), fL: at(-s * 10, Math.max(0, -c) * 6),
    hR: tuck ? WB.hR : at(2 - s * 9, 19), hL: tuck ? WB.hL : at(-6 + s * 9, 19), face: 1,
  };
};

const moves = {
  jab: {
    frames: 16, sfx: { 2: 'swishS' },
    pose: K([0, {}], [2, { hx: 0, ht: -0.15, lean: -0.06 }], [4, { hx: 17, hy: 6, ht: 0.3, lean: 0.14 }, 'out'], [8, { hx: 14, hy: 5, ht: 0.2, lean: 0.1 }], [16, {}]),
    hits: [hit([3, 5], 'beak', 8, 3, 75, 10, 25, { to: 'head' })],
    cancel: [{ to: 'jab2', f: [6, 14], on: 'attack' }],
  },
  jab2: {
    frames: 17, sfx: { 2: 'swishS' },
    pose: K([0, { hx: 12, hy: 5, lean: 0.1 }], [2, { hx: 2, hy: 3, ht: -0.1 }], [4, { hx: 18, hy: 9, ht: 0.45, lean: 0.2 }, 'out'], [8, { hx: 15, hy: 8, ht: 0.35, lean: 0.16 }], [17, {}]),
    hits: [hit([3, 5], 'beak', 8, 3, 75, 10, 25, { to: 'head' })],
    cancel: [{ to: 'jab3', f: [6, 14], on: 'attack' }],
  },
  jab3: {
    frames: 26, sfx: { 4: 'swishM' },
    pose: K([0, { hx: 12, hy: 5, lean: 0.1 }], [4, { hx: -3, hy: 2, ht: -0.3, lean: -0.2 }], [7, { hx: 13, hy: 7, ht: 0.5, lean: 0.4, ox: 4, ...WB }, 'in'], [12, { hx: 11, hy: 6, ht: 0.4, lean: 0.34, ox: 3, ...WB }], [26, {}]),
    hits: [hit([6, 9], 'head', 12, 5, 48, 30, 72, { sfx: 'bonk' })],
  },
  ftilt: {
    frames: 28, sfx: { 5: 'swishM' }, vel: [[6, 3.4, null]],
    pose: K([0, {}], [5, { hx: -4, hy: 2, ht: -0.35, lean: -0.22 }], [8, { hx: 14, hy: 8, ht: 0.55, lean: 0.46, ox: 4, ...WB }, 'in'], [13, { hx: 12, hy: 7, ht: 0.45, lean: 0.4, ox: 3, ...WB }], [28, {}]),
    hits: [hit([7, 10], 'head', 12, 8, 361, 22, 92, { sfx: 'bonk' })],
  },
  utilt: {
    frames: 26, sfx: { 4: 'swishS' },
    pose: K([0, {}], [4, { by: 5, hy: 5, hx: 4, ht: -0.5 }], [7, { hy: -13, hx: 5, ht: -1.25, sy: 1.05, hR: at(-10, 8), hL: at(-12, 9) }, 'out'], [11, { hy: -10, hx: 4, ht: -1.1 }], [26, {}]),
    hits: [hit([5, 9], 'beak', 9, 7, 88, 30, 100, { to: 'head' })],
  },
  dtilt: {
    frames: 24, sfx: { 4: 'swishS' },
    pose: K([0, { by: 4, lean: 0.2 }], [3, { by: 5, lean: 0.25, hx: 6, hy: 4, ht: -0.1 }], [6, { by: 6, lean: 0.42, hx: 20, hy: 13, ht: 0.5 }, 'out'], [10, { by: 6, lean: 0.4, hx: 18, hy: 12, ht: 0.45 }], [24, { by: 3 }]),
    hits: [hit([5, 8], 'beak', 9, 6, 72, 24, 70, { to: 'head' })],
  },
  dash: {    // head down, legs going: his best ground move
    frames: 38, fric: 0.22, sfx: { 3: 'swishM' }, vel: [[0, 7.4, null]],
    pose: (f, fr) => sprint(fr * 1.1, clamp(fr / 4, 0, 1) * clamp((38 - fr) / 12, 0, 1), true),
    hits: [hit([4, 11], 'head', 13, 11, 55, 60, 65, { sfx: 'bonk' }), hit([12, 18], 'head', 12, 7, 62, 40, 50, { group: 1 })],
  },
  fsmash: {  // rears right back, then rams
    frames: 52, charge: { at: 9, max: 60 }, sfx: { 13: 'swishL' }, vel: [[14, 7.5, null]],
    pose: K([0, {}], [8, WIND], [9, WIND], [15, RAM, 'in3'], [24, { ...RAM, lean: 0.52, ox: 6 }], [52, {}]),
    hits: [hit([14, 19], 'head', 14, 17, 40, 32, 100, { sfx: 'bonk' })],
    events: { 15: (f, m) => { m.fx.dust(f.x - f.facing * 10, f.y, 3); } },
  },
  usmash: {
    frames: 46, charge: { at: 6, max: 60 }, sfx: { 9: 'swishL' },
    pose: K([0, {}], [5, DUCK], [6, DUCK], [11, { hy: -15, hx: 5, ht: -1.3, oy: -9, sy: 1.08, sx: 0.95, hR: at(-9, 6), hL: at(-12, 7), fR: at(5, 0), fL: at(-5, 0) }, 'in'],
      [16, { hy: -11, hx: 4, ht: -1.1, oy: -4, hR: at(-9, 8), hL: at(-12, 9) }], [46, {}]),
    hits: [hit([10, 14], 'beak', 11, 14, 88, 34, 103, { to: 'head', sfx: 'bonk' })],
  },
  dsmash: {  // a low wing sweep, front then back
    frames: 48, charge: { at: 6, max: 60 }, sfx: { 7: 'swishM', 13: 'swishM' },
    pose: K([0, {}], [5, { by: 6, lean: -0.1, hR: at(-12, 22), hL: at(-13, 20) }], [6, { by: 6, lean: -0.1, hR: at(-12, 22), hL: at(-13, 20) }],
      [9, { by: 7, lean: 0.28, ox: 5, hR: at(22, 9), hL: at(-12, 18) }, 'in'], [15, { by: 7, lean: -0.24, ox: -5, hR: at(2, 14), hL: at(-22, 9) }], [20, { by: 6, lean: -0.2, ox: -4, hR: at(0, 13), hL: at(-21, 9) }], [48, {}]),
    hits: [hit([8, 10], 'hR', 12, 13, 30, 36, 86, { to: 'eR', sfx: 'slap' }), hit([14, 17], 'hL', 12, 12, 30, 36, 86, { rev: true, group: 1, sfx: 'slap' })],
  },
  nair: air({
    frames: 40, sfx: { 3: 'swishM', 14: 'swishS' },
    pose: K([0, { rot: 0 }], [4, { hR: at(20, 25), hL: at(-20, 25), rot: 0 }], [26, { hR: at(20, 25), hL: at(-20, 25), rot: TAU }, 'lin'], [40, { rot: TAU }]),
    hits: [hit([4, 12], 'hR', 11, 9, 361, 18, 85, { to: 'hL', sfx: 'slap' }), hit([13, 24], 'hR', 10, 5, 361, 14, 70, { to: 'hL', group: 1 })],
  }, 10, [3, 28]),
  fair: air({    // a shallow dive, beak first
    frames: 38, sfx: { 7: 'swishM' },
    tick: (f, m, fr) => { if (fr === 8) { f.vx = f.facing * Math.max(5.4, f.vx * f.facing); f.vy = Math.max(f.vy, 1.6); } },
    pose: K([0, {}], [6, { lean: -0.25, hx: 0, ht: -0.3, ...WU }], [9, DIVE, 'in'], [16, DIVE], [38, {}]),
    hits: [hit([8, 13], 'head', 13, 11, 361, 24, 92, { sfx: 'bonk' })],
  }, 12, [6, 28]),
  bair: air({    // a mule kick: tail up, both feet out the back
    frames: 34, sfx: { 5: 'swishM' },
    pose: K([0, {}], [5, { lean: 0.2, fR: at(5, 8), fL: at(2, 9) }], [8, { lean: 0.75, hx: 6, fR: at(-15, 13), fL: at(-17, 9), ox: -3, hR: at(8, 28), hL: at(4, 30) }, 'in'],
      [13, { lean: 0.7, hx: 6, fR: at(-14, 12), fL: at(-16, 9), ox: -2, hR: at(8, 28), hL: at(4, 30) }], [34, {}]),
    hits: [hit([7, 11], 'tail', 11, 10, 361, 26, 95, { rev: true, to: 'fL', sfx: 'slap' })],
  }, 11, [5, 26]),
  uair: air({
    frames: 32, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { hy: 4, ht: -0.5 }], [6, { hy: -14, hx: 4, ht: -1.3, sy: 1.05, hR: at(-9, 9), hL: at(-12, 10) }, 'out'], [10, { hy: -11, hx: 4, ht: -1.15, hR: at(-9, 11), hL: at(-12, 12) }], [32, {}]),
    hits: [hit([5, 9], 'beak', 10, 9, 84, 26, 96, { to: 'head' })],
  }, 10, [4, 22]),
  dair: air({    // tips over and drops like a dart; spikes on the way in
    frames: 46, drift: 0.3, fallCap: 12.5, vel: [[3, null, -2.6], [12, 3, 12]], sfx: { 11: 'swishL' },
    pose: K([0, { rot: 0 }], [4, { rot: -0.25, ...WU }], [12, { rot: 2.85, ...TUCK }, 'in'], [36, { rot: 2.85, ...TUCK }], [46, { rot: TAU }]),
    hits: [hit([13, 17], 'head', 13, 12, 270, 18, 82, { sfx: 'bonk' }), hit([18, 36], 'head', 12, 9, 60, 24, 60, { group: 1 })],
    onLand: (f, m) => { if (f.mf > 11 && f.mf < 40) { f.v.plant = 2.85; m.fx.dust(f.x, f.y, 6); m.shake(3); m.sfx('thud', { vol: 0.7 }); } },
  }, 20, [10, 46]),

  // --- specials ---
  nspecial: {    // a wingful of breadcrumbs: three little stings
    kind: 'special', frames: 36, drift: 0.7, sfx: { 9: 'throw' },
    can: (f, m) => countMine(f, m, 'crumb') < 3,
    pose: K([0, {}], [6, { hR: at(-12, 34), lean: -0.15, ht: -0.2 }], [10, { hR: at(18, 30), lean: 0.2 }, 'in'], [16, { hR: at(17, 22), lean: 0.14 }], [36, {}]),
    events: {
      10: (f, m) => {
        for (let i = 0; i < 3; i++) {
          shoot(f, m, { tag: 'crumb', x: 16, y: 30, vx: 3.6 + i * 1.1, vy: -4.6 + i * 0.8, g: 0.34, r: 5, life: 48, spin: 0.3 * f.facing, seed: i, drawFn: drawCrumb,
            hit: { dmg: 2, ang: 361, bk: 0, kg: 0, set: 30, hl: 0.6 },
            onDie: (p, m2) => { m2.fx.puff(p.x, p.y, 2, '#f1dcae'); } });
        }
      },
    },
  },
  sspecial: {    // TRAINING MONTAGE: hold to run on the spot, let go to charge, and it ends in a head-ram
    kind: 'special', frames: 112, keepV: true, airOK: true, drift: 0.1, armor: [[20, 90, 75]],
    can: (f) => f.grounded || !f.v.ssUsed,
    start: (f) => { f.v.rev = 0; f.v.go = 0; f.v.hitAt = 0; if (!f.grounded) f.v.ssUsed = true; },
    exit: (f) => { f.v.go = 0; f.v.rev = 0; },
    tick: (f, m, fr) => {
      const v = f.v;
      if (!v.go) {
        f.vx = approach(f.vx, 0, 0.5);
        if (!f.grounded) f.vy = Math.min(f.vy, 2.2);
        if (fr < 8) return;
        if (f.inp.h.special && v.rev < 60) {
          v.rev++; f.mf = 7;
          if (v.rev % 8 === 1) m.sfx('dash', { vol: 0.35, rate: 0.9 + v.rev / 60 });
          if (f.grounded && v.rev % 4 === 0) m.fx.dust(f.x - f.facing * 12, f.y, 1);
        } else {
          v.go = 1; f.vx = f.facing * (6.4 + v.rev * 0.09); f.mf = 20; m.sfx('dash');
          if (!f.grounded) f.vy = Math.min(f.vy, -1.5);
        }
      } else if (v.go === 1) {
        f.vx = approach(f.vx, 0, 0.07);
        if (!f.grounded) f.vy = Math.min(f.vy, 1.4);
        else if (fr % 4 === 0) m.fx.dust(f.x - f.facing * 14, f.y, 1);
        if (f.moveHit && !v.hitAt) v.hitAt = fr;
        // the finisher: a beat after contact, on a second press, or when he runs out of puff (or floor)
        if ((v.hitAt && fr - v.hitAt >= 4) || (fr > 26 && f.pressed('special')) || Math.abs(f.vx) < 3.2 || fr >= 77) { f.eat('special'); v.go = 2; f.mf = 80; }
      } else if (fr === 82) { f.vx = f.facing * Math.max(Math.abs(f.vx), 7.5); m.sfx('swishL'); }
      else if (fr > 84) f.vx = approach(f.vx, 0, 0.5);
    },
    pose: (f, fr) => {
      if (fr >= 80) return RAMKEYS;
      const rev = (f.v && f.v.rev) || 0, go = fr >= 20;
      return sprint((f.t || 0) * (go ? 1.15 : 0.7 + rev * 0.012), go ? 1 : clamp(fr / 7, 0, 1) * (0.4 + rev / 110), go);
    },
    hits: [hit([21, 79], 'head', 13, 4, 30, 0, 0, { set: 44, sfx: 'bonk' }), hit([84, 89], 'head', 15, 9, 42, 40, 92, { group: 1, sfx: 'bonk' })],
  },
  uspecial: {    // frantic flapping: not graceful, but it gets him there
    kind: 'special', frames: 52, helpless: true, drift: 1.1, ledgeOK: 14, airOK: true, slideOff: true,
    vel: [[6, null, -6]], sfx: { 5: 'flap', 13: 'flap', 21: 'flap', 29: 'flap' },
    tick: (f, m, fr) => { if (fr > 6 && fr < 30) { f.vy = -6; if (fr % 4 === 0) m.fx.puff(f.x - f.facing * 6, f.y - 6, 1, '#ffffff'); } },
    pose: (f, fr) => {
      const k = clamp(fr / 6, 0, 1) * clamp((52 - fr) / 14, 0, 1), s = Math.sin(fr * 1.6), c = Math.cos(fr * 0.8);
      return { hR: at(-5 + s * 2, 24 + s * 13 * k), hL: at(-10 - s * 2, 23 + Math.sin(fr * 1.6 - 0.7) * 13 * k), hy: -3 * k, ht: -0.3 * k, lean: 0.06 + s * 0.05 * k,
        fR: at(4 + c * 3, 2), fL: at(-4 - c * 3, 3), face: 6 };
    },
    hits: [box([7, 29], [2, 26], 44, 46, 1.5, 85, 0, 0, { set: 34, rehit: 6, hl: 0.4 }), box([30, 34], [2, 30], 46, 48, 4, 70, 40, 60, { group: 1 })],
  },
  dspecial: {    // on the ground: kicks grit in your face. No damage to speak of, but you are over there now
    kind: 'special', frames: 30, sfx: { 8: 'slide' },
    pose: K([0, {}], [5, { lean: -0.18, fR: at(-9, 5), by: 1, ...WB }], [9, { lean: -0.3, fR: at(13, 8), by: 1, hx: 0 }, 'in'], [14, { lean: -0.24, fR: at(12, 6), hx: 1 }], [30, {}]),
    events: { 9: (f, m) => { for (let i = 0; i < 4; i++) m.fx.dust(f.x + f.facing * (22 + i * 13) * f.scale, f.y, 2); m.fx.debris(f.x + f.facing * 26 * f.scale, f.y - 4, 5, '#cdbf9c'); } },
    hits: [box([9, 14], [44, 13], 64, 28, 3, 361, 0, 0, { set: 58, stun: -13, hl: 0.5, sfx: 'paper' })],
  },
  dspecial_air: {    // in the air: hangs for a moment, then dive-bombs at 45 degrees
    kind: 'special', frames: 66, drift: 0, fallCap: 14, sfx: { 9: 'swishL' },
    start: (f) => { f.v.rebound = 0; },
    tick: (f, m, fr) => {
      if (fr < 10) { f.vx *= 0.8; f.vy = approach(f.vy, -1.2, 1.2); }
      else if (f.v.rebound === 1) { f.v.rebound = 2; f.vy = -8; f.vx = -f.facing * 1.5; f.mf = Math.max(f.mf, 52); }   // bounces off whoever he hit
      else if (fr < 52 && !f.v.rebound) { f.vx = f.facing * 8.4; f.vy = 9.6; }
      else f.vx *= 0.92;
    },
    pose: K([0, { rot: 0 }], [9, { rot: -0.4, hy: -2, ...WU }, 'out'], [12, { rot: 2.36, ...TUCK }, 'in'], [52, { rot: 2.36, ...TUCK }], [66, { rot: TAU }]),
    hits: [hit([10, 51], 'head', 14, 12, 45, 40, 80, { sfx: 'bonk', onHit: (o) => { if (o) o.v.rebound = 1; } })],
    onLand: (f, m) => {
      if (f.mf < 10 || f.mf >= 52) return;
      f.v.plant = 2.36; m.fx.dust(f.x, f.y, 7); m.shake(4); m.sfx('thud');
      f.setState('land', 18); return false;
    },
  },

  // --- grab (with the beak) + throws ---
  grab: stdGrab(K([0, {}], [6, { hx: 17, hy: 8, ht: 0.25, lean: 0.3, hR: at(14, 22), hL: at(10, 24) }, 'out'], [12, { hx: 15, hy: 7, ht: 0.2, lean: 0.26, hR: at(13, 21), hL: at(9, 23) }], [30, {}]), 30, { h: 24, r: 12 }),
  ...stdThrows({
    f: { dmg: 8, bk: 58, kg: 66, f: 12, frames: 30, sfx: 'bonk', pose: K([0, HOLD], [7, { ...HOLD, hx: -4, ht: -0.4, lean: -0.25 }], [12, { ...HOLD, hx: 16, hy: 8, ht: 0.5, lean: 0.45 }, 'in'], [30, {}]) },
    b: { dmg: 9, bk: 60, kg: 80, f: 15, frames: 36, pose: K([0, HOLD], [8, { lean: -0.3, hx: 0, hR: at(6, 36), hL: at(2, 38) }], [15, { lean: -0.6, hx: -6, ht: -0.5, hR: at(-14, 30), hL: at(-16, 28) }, 'in'], [36, {}]) },
    u: { dmg: 7, bk: 64, kg: 70, f: 11, frames: 32, pose: K([0, HOLD], [6, { ...HOLD, by: 6, hy: 6, hx: 12, ht: 0.3 }], [11, { hy: -13, hx: 6, ht: -1.2, sy: 1.06, hR: at(-9, 9), hL: at(-12, 10) }, 'in'], [32, {}]) },
    d: { dmg: 7, bk: 50, kg: 42, f: 14, frames: 34, sfx: 'thud', pose: K([0, HOLD], [8, { oy: -12, fR: at(10, 2), fL: at(4, 4), ...WU }], [14, { by: 6, lean: 0.3, hx: 14, hy: 12, ht: 0.6, fR: at(12, 0) }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 9: 'swishM' },
    pose: K([0, { by: 8, lean: 0.2 }], [10, { by: 7, lean: 0.25, ox: 4, hR: at(22, 9), hL: at(-10, 16) }], [16, { by: 7, lean: -0.2, ox: -4, hR: at(2, 14), hL: at(-22, 9) }], [34, {}]),
    hits: [hit([9, 12], 'hR', 12, 6, 50, 40, 50, { to: 'eR' }), hit([15, 18], 'hL', 12, 6, 50, 40, 50, { rev: true, group: 1 })],
  },
  taunt: {       // finds a crumb. Two, actually
    kind: 'taunt', frames: 72, iasa: 62, sfx: { 6: 'coo', 20: 'tick', 34: 'tick' },
    pose: K([0, {}], [8, { ht: -0.25, hy: -2, face: 3 }], [16, { by: 5, lean: 0.4, hx: 18, hy: 12, ht: 0.5 }], [20, { by: 6, lean: 0.46, hx: 20, hy: 15, ht: 0.6 }, 'in'], [26, { by: 5, lean: 0.36, hx: 15, hy: 8, ht: 0.3 }],
      [34, { by: 6, lean: 0.46, hx: 20, hy: 15, ht: 0.6 }, 'in'], [42, { by: 3, lean: 0.2, hx: 10, hy: 4 }], [56, { ht: -0.2, face: 3, hR: at(-10, 30), hL: at(-13, 28) }], [72, {}]),
  },

  // --- giant only: down-tilt and down-smash turn into foot stomps (see remap) ---
  stomp: {
    frames: 42, sfx: { 6: 'swishL' },
    pose: K([0, {}], [8, { lean: -0.22, fR: at(13, 13), hx: 0, ...WU }], [11, { lean: -0.22, fR: at(13, 13), hx: 0, ...WU }], [14, { lean: 0.16, by: 3, fR: at(11, 0), sy: 0.95, sx: 1.04, hR: at(-12, 18), hL: at(-14, 16) }, 'in3'],
      [22, { lean: 0.12, by: 2, fR: at(11, 0) }], [42, {}]),
    hits: [hit([13, 16], 'fR', 13, 9, 75, 44, 80, { sfx: 'whop' })],
    events: { 14: (f, m) => quake(f, m, f.x + f.facing * 11 * f.scale, 0.75) },
  },
  megastomp: {
    frames: 58, charge: { at: 8, max: 60 }, sfx: { 10: 'swishL' },
    pose: K([0, {}], [7, DUCK], [8, DUCK], [15, { oy: -17, fR: at(6, 3), fL: at(-6, 3), sy: 1.06, ...WU }, 'out'],
      [20, { by: 6, sy: 0.88, sx: 1.1, fR: at(9, 0), fL: at(-9, 0), hR: at(-14, 14), hL: at(-15, 13) }, 'in3'], [30, { by: 4 }], [58, {}]),
    hits: [box([19, 22], [0, 7], 46, 18, 13, 78, 46, 92, { sfx: 'whop' })],
    events: { 20: (f, m) => quake(f, m, f.x, 1) },
  },

  // --- the super: FINAL EVOLUTION ---
  super: {
    kind: 'super', frames: 62, sfx: { 2: 'coo' },
    pose: K([0, {}], [10, { by: 7, lean: 0.25, hx: 8, hy: 8, hR: at(-6, 14), hL: at(-9, 14) }], [16, { lean: -0.2, hy: -4, ht: -0.5, sy: 1.06, ...WU }, 'out'], [50, { lean: -0.16, hy: -3, ht: -0.4, ...WU }], [62, {}]),
    exit: (f) => { f.superActive = false; },
    events: {
      12: (f, m) => {
        f.v.big = f.v.bigMax = BIG_T + 50;
        m.sfx('roar'); m.sfx('powerup', { vol: 0.6 }); m.shake(9);
        m.fx.burst(f.x, f.cy, 64, '#ffffff'); m.fx.ring(f.x, f.cy, 50, f.color);
      },
    },
    tick: (f, m, fr) => { if (fr > 12 && fr < 50 && fr % 7 === 0) { m.shake(3); m.fx.dust(f.x + (fr % 2 ? 20 : -20), f.y, 2); } },
  },
};

export default {
  id: 'crumbs', name: 'CRUMBS', from: 'Pigeon Academy', superName: 'Final Evolution',
  blurb: 'Bottom of his class at Pigeon Academy, top of the pecking order here. Leads with his head, and has five flaps in him.',
  stats: { weight: 86, walk: 2.5, dash: 6.0, run: 5.5, traction: 0.46, jump: 9.8, hop: 6.2, djump: 8.2, djumpDecay: 0.85, airJumps: 4, gravity: 0.34, fall: 6.8, fastFall: 10.4, airSpeed: 3.8, airAccel: 0.3, w: 30, h: 50 },
  portrait: { x: 4, y: -36, s: 1.5 },
  costumes: costumes(BASE, [
    ['Park Regular', {}],
    ['Champion', { main: '#f2b81c', body: '#dcbd90', belly: '#f6e7c8', wing: '#a9623a', bar: '#6b3518', tail: '#8a4e2c', tip: '#55301a', neck2: '#c95fa8', beak: '#6a5750', foot: '#e8562a', hat: 1, cape: '#7a3fc0' }],
    ['Bad Egg', { main: '#5a546b', body: '#5a546b', belly: '#77708a', wing: '#423d50', bar: '#201c2a', tail: '#3a3546', tip: '#1b1822', neck: '#8a3fd0', neck2: '#c8f03c', beak: '#d9cdb0', cere: '#b9ad92', eye: '#ff3b30', foot: '#b8483a', band: '#c8f03c', mean: 1 }],
    ['Dove', { main: '#f6f4ee', body: '#f6f4ee', belly: '#ffffff', wing: '#e2dfd6', bar: '#b9b5a8', tail: '#e9e6dd', tip: '#c9c5b8', neck: '#f5cfe0', neck2: '#cfe3f7', beak: '#f2a0a8', cere: '#ffffff', eye: '#ffffff', foot: '#f58aa8', band: '#55b9e6' }],
  ]),
  pose: rig.pose, points: rig.points, draw: rig.draw,
  moves,
  remap: (f, id) => (isBig(f) ? (id === 'dtilt' ? 'stomp' : id === 'dsmash' ? 'megastomp' : id) : id),
  hooks: {
    init(f) { Object.assign(f.v, { big: 0, bigMax: 0, mul: 1, ssUsed: false, vyPrev: 0, stride: 0, flap: 0, plant: 0, rev: 0, go: 0 }); },
    postUpdate(f, m) {
      const v = f.v;
      if (f.grounded || f.state === 'ledge') v.ssUsed = false;
      if (v.flap > 0) v.flap--;
      if (v.plant && f.state !== 'land') v.plant = 0;
      if (v.big > 0) {
        v.big--;
        f.scale = 1 + (BIG - 1) * ease.back(clamp((v.bigMax - v.big) / 36, 0, 1)) * ease.io(clamp(v.big / 30, 0, 1));
        f.permArmor = 9999;
        // far too big to pick up or box in
        if (f.state === 'grabbed' || (f.state === 'trapped' && f.sf > 3)) { f.interrupt(); f.setState(f.grounded ? 'idle' : 'air'); }
        if (f.grounded && (f.state === 'walk' || f.state === 'run' || f.state === 'dash')) {
          const st = Math.floor(f.cycle / 47);
          if (st !== v.stride) { v.stride = st; m.shake(2.5); m.sfx('thud', { vol: 0.35 }); m.fx.dust(f.x, f.y, 2); }
        }
        if (v.big <= 0) shrink(f, m);
      }
      // damage bonuses (giant, charged montage) are folded into dmgMul in one place so they always come back off
      const want = (v.big > 0 ? 1.5 : 1) * (f.moveId === 'sspecial' && v.go ? 1 + v.rev / 100 : 1);
      if (want !== v.mul) { f.dmgMul = (f.dmgMul / v.mul) * want; v.mul = want; }
      v.vyPrev = f.vy + f.ky;
    },
    onLand(f, m) { if (isBig(f) && f.v.vyPrev > 4) quake(f, m, f.x, 0.8); },
    onJump(f) { f.v.flap = 10; },
    onAirJump(f, m) { f.v.flap = 14; m.sfx('flap', { vol: 0.5 }); },
    onKO(f) { f.v.big = 0; f.v.mul = 1; },
    onRespawn(f) { f.v.big = 0; f.v.mul = 1; f.scale = 1; },
    // the stock CPU handles him fine; this only adds the two things it can't see: giant stomps and the dive-bomb
    ai(f, m, cpu) {
      const st = f.state;
      if (cpu.q.length || cpu.cool > 0 || (st !== 'idle' && st !== 'walk' && st !== 'run' && st !== 'air')) return false;
      let t = null, bd = 1e9;
      for (const o of m.foes(f)) { const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; t = o; } }
      if (!t || t.invuln > 10) return false;
      const dx = t.x - f.x, adx = Math.abs(dx), dir = sign(dx) || 1, dy = t.y - f.y, r = cpu.rng;
      if (isBig(f) && f.grounded) {
        if (t.grounded && adx < 150 && Math.abs(dy) < 60 && r.chance(0.25)) {
          if (f.facing !== dir) cpu.queue({ x: dir, n: 2 });
          cpu.queue({ y: 1, press: [adx < 90 ? 'strong' : 'attack'] });
          cpu.cool = 34;
        }
      } else if (!f.grounded && f.facing === dir && dy > 60 && dy < 280 && Math.abs(dy - adx * 1.14 - 10) < 36 && groundBelow(m.stage, t.x, t.y - 10, 160) && r.chance(0.12 + cpu.level * 0.02)) {
        cpu.queue({ y: 1, press: ['special'] });
        cpu.cool = 40;
      }
      return false;
    },
  },
  ai: {
    nspecial: { range: [70, 170], dy: 50, w: 0.5 },
    sspecial: { range: [150, 380], dy: 36, w: 0.6, hold: 26 },
    super: { range: 240, dy: 160, anyFacing: true },
    recovery: { up: 200, side: 200 },
  },
};
