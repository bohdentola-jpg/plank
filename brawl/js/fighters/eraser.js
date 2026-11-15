// THE ERASER - slot 11 of the roster.
// Brief: the joke pick - a featureless rectangular block. It moves by lurching
// harshly side to side with a screen shake on every movement. Super: it
// becomes massive and flips over, flattening everyone.
//
// A big pink rubber eraser with a paper sleeve. No face, no limbs, no voice.
// Custom rig: the whole pose is a tilt, a squash and an offset. It cannot
// walk: holding a direction makes it fall over that way and stand back up
// (the `flop` move), which is also a weak attack.

import { customPose } from '../game/rig.js';
import { K, hit, box, air, stdThrows, shoot, countMine, costumes } from '../game/movekit.js';
import { Entity } from '../game/entities.js';
import { OUT, LW, rrect, circle, ellipse, curve, fs, gloss, lighten } from '../core/gfx.js';
import { TAU, clamp, ease } from '../core/util.js';

const BASE = { main: '#f58aa8', body: '#f58aa8', band: '#fff6e0', band2: '#2f7fe0', smudge: 'rgba(70,60,75,0.42)', berry: 0 };
const HW = 15, HH = 29, Q = Math.PI / 2;       // half width, half height, a quarter turn

// pose: rot / sx / sy / ox / oy as usual, plus
//   sit : 1 = rest the lowest corner on the floor however it is tilted
//   tip : 1 = tilt about the leading bottom corner (falls over like a real block)
const STANCE = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, face: 0, sit: 1, tip: 0 };
const AIRS = Object.assign({}, STANCE, { sit: 0, rot: Q });      // in the air it lies flat, top end forward

function pose(f) {
  const mv = f.state === 'move' && f.move;
  return customPose(f, mv && mv.kind === 'air' ? AIRS : STANCE, (ff, p) => {
    const st = ff.state;
    if (!ff.grounded && st !== 'respawn' && st !== 'ledge' && st !== 'ledgeclimb') p.sit = 0;
    if (st === 'idle' || st === 'walk' || st === 'respawn') { p.sx = 1; p.sy = 1; p.rot = 0; }             // perfectly still
    else if (st === 'air') { p.sx = 1; p.sy = 1; p.rot = ease.out(clamp(ff.sf / 16, 0, 1)) * Q; }          // rises stiffly, a quarter turn
    else if (st === 'helpless') p.rot = Q + Math.sin(ff.t * 0.3) * 0.3;
    else if (st === 'down' || st === 'lose') { p.sx = 1; p.sy = 1; p.rot = -Q; }
    else if (st === 'getup') { p.sx = 1; p.sy = 1; p.rot = -Q * (1 - ease.io(clamp(ff.sf / 20, 0, 1))); }
    else if (st === 'grabhold') { p.rot = 1.15; p.tip = 1; }
    else if (st === 'win') { p.sx = 1; p.sy = 1; p.oy *= 0.35; }
  });
}

// where the middle of the slab is, in fighter space
function place(p) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const ext = Math.abs(s) * HW * Math.abs(p.sx) + Math.abs(c) * HH * Math.abs(p.sy);
  let x = p.ox;
  if (p.tip) x += Math.sign(s) * (HW * (1 - Math.abs(c)) + HH * Math.abs(s)) * p.tip;
  return [x, -HH + p.oy + (HH - ext) * p.sit, ext];
}
// a point on the slab (measured from its middle) -> fighter space
function xf(p, x, y) {
  const o = place(p), c = Math.cos(p.rot), s = Math.sin(p.rot);
  x *= p.sx; y *= p.sy;
  return [o[0] + x * c - y * s, o[1] + x * s + y * c];
}
function points(f, p) {
  return {
    body: xf(p, 0, 0), top: xf(p, 0, -HH + 4), bottom: xf(p, 0, HH - 4), front: xf(p, HW, 0), back: xf(p, -HW, 0),
    cornerTF: xf(p, HW - 3, -HH + 3), cornerTB: xf(p, -HW + 3, -HH + 3), grab: [40, 0],
  };
}
// the slab's real outline as a hurtbox, so lying flat is low and wide
function hurt(f) {
  const p = f.pose;
  if (!p || f.state === 'ledge') return null;
  const o = place(p), sc = f.scale, s = Math.abs(Math.sin(p.rot)), c = Math.abs(Math.cos(p.rot));
  const hw = (c * HW * Math.abs(p.sx) + s * HH * Math.abs(p.sy)) * sc + 2, hh = o[2] * sc;
  return [{ x: f.x + f.facing * o[0] * sc - hw, y: f.y + o[1] * sc - hh, w: hw * 2, h: hh * 2 }];
}

function slabPath(ctx) {      // four corners, each worn differently
  ctx.beginPath();
  ctx.moveTo(-15, -21.5); ctx.quadraticCurveTo(-15, -29, -8, -29);
  ctx.lineTo(9.5, -29); ctx.lineTo(15, -24);
  ctx.lineTo(15, 25); ctx.quadraticCurveTo(15, 29, 11, 29);
  ctx.lineTo(-11.5, 29); ctx.quadraticCurveTo(-15, 29, -15, 25.5);
  ctx.closePath();
}
function draw(ctx, f, p) {
  const pal = f.drawPal || f.pal, o = place(p);
  ctx.save();
  ctx.translate(o[0], o[1]); ctx.rotate(p.rot); ctx.scale(p.sx, p.sy);
  slabPath(ctx); fs(ctx, pal.body, OUT, LW);
  ctx.save(); slabPath(ctx); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(9.5, -30, 6, 60);
  ctx.strokeStyle = pal.smudge; ctx.lineWidth = 2.3; ctx.lineCap = 'round';            // pencil smudges on the working end
  ctx.beginPath(); ctx.moveTo(-13, -26); ctx.lineTo(-4, -28); ctx.moveTo(-11, -22); ctx.lineTo(3, -26.5); ctx.moveTo(-3, -21.5); ctx.lineTo(9, -25.5);
  ctx.moveTo(5, 26.5); ctx.lineTo(12, 23.5); ctx.stroke();
  ctx.restore();
  gloss(ctx, -10, 20.5, 1.7, 5, 0.45, 0);
  slabPath(ctx); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.stroke();
  // the paper sleeve, with what is left of a logo
  rrect(ctx, -16.6, -13, 33.2, 26, 1.6, pal.band, OUT, 2);
  ctx.fillStyle = pal.band2; ctx.fillRect(-15.5, -10.8, 31, 2.4); ctx.fillRect(-15.5, 8.4, 31, 2.4);
  if (pal.berry) {            // strawberry scented
    ellipse(ctx, 0, 0.6, 3.8, 4.4, '#e8402a', OUT, 1.3);
    ellipse(ctx, 0, -3.6, 3, 1.3, '#35a84a', OUT, 1.1);
    ctx.fillStyle = '#fff6e0'; for (const d of [[-1.4, -0.4], [1.4, 0.2], [-0.2, 2.6]]) ctx.fillRect(d[0] - 0.5, d[1] - 0.5, 1, 1);
  } else {
    ctx.globalAlpha = 0.6;
    curve(ctx, [-10.5, 1.6, -7, -3.4, -3.4, 2.4, 0, -3.4, 3.6, 2.4, 7, -3, 10.5, 0.6], pal.band2, 1.5, 0.5);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(10.6, -12, 5, 24);
  ctx.restore();
}

// ---- things it leaves behind ---------------------------------------------------
function drawCrumb(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  rrect(ctx, -4.5, -3, 9, 6, 2, p.owner ? p.owner.pal.body : '#f58aa8', OUT, 1.8);
  ctx.restore();
}
// the pink streak the skid leaves on the floor
class Smear extends Entity {
  constructor(m, f) {
    super({ owner: f, layer: 'back', tag: 'smear' });
    this.g = f.ground; this.x0 = this.x1 = this.x = f.x; this.y = f.y; this.col = lighten(f.pal.body, 0.2); this.life = 80; this.growing = true;
  }
  update() {
    this.t++;
    const f = this.owner, g = this.g;
    if (this.growing) {
      if (f.state === 'move' && f.moveId === 'sspecial' && f.grounded && f.ground === g && f.mf < 34) this.x1 = f.x; else this.growing = false;
    }
    if (!g || !g.on || this.t > this.life) { this.dead = true; return; }
    this.x0 += g.vx || 0; this.x1 += g.vx || 0; this.y = g.y;
  }
  draw(ctx) {
    const a = Math.min(this.x0, this.x1), w = Math.abs(this.x1 - this.x0);
    if (w < 6) return;
    ctx.globalAlpha = clamp((this.life - this.t) / 30, 0, 1) * 0.85;
    rrect(ctx, a, this.y - 3.2, w, 4.4, 2.2, this.col, null, 0);
    ctx.globalAlpha = 1;
  }
}
// Rub Out: a soft platform switched off for three seconds. The entity owns the
// timer, so the platform comes back even if The Eraser is long gone.
class RubOut extends Entity {
  constructor(m, f, g) {
    super({ owner: f, layer: 'back', tag: 'rubout' });
    this.g = g; this.life = 180; this.col = f.pal.body;
    g.on = false;
    this.x = g.x + g.w / 2; this.y = g.y;
  }
  update(m) {
    this.t++;
    const g = this.g;
    this.x = g.x + g.w / 2; this.y = g.y;
    if (this.t >= this.life) { g.on = true; this.dead = true; m.sfx('pop', { vol: 0.6 }); m.fx.puff(this.x, this.y, 4, '#ffffff'); }
  }
  draw(ctx) {
    const g = this.g, t = this.t, back = t > this.life - 36 && t % 8 < 4;
    ctx.save();
    ctx.globalAlpha = back ? 0.35 : 0.78;
    rrect(ctx, g.x - 4, g.y - 4, g.w + 8, 18, 5, '#fbf7ea', null, 0);                 // rubbed back to bare paper
    ctx.globalAlpha = 1;
    ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(29,22,17,0.5)'; ctx.lineWidth = 1.8;
    ctx.strokeRect(g.x, g.y, g.w, 10); ctx.setLineDash([]);
    for (let i = 0; i < 5; i++) rrect(ctx, g.x + ((i * 0.23 + 0.08) % 1) * g.w - 3, g.y + 11 + (i % 2) * 3, 6, 3.4, 1.5, this.col, OUT, 1.3);   // crumbs
    ctx.restore();
  }
}

// ---- helpers -------------------------------------------------------------------
// every time the slab hits the floor: a shake, a thud and some dust
function slamFx(f, m, amt, ahead) {
  m.shake(amt); m.sfx('thud', { vol: clamp(0.35 + amt * 0.07, 0.3, 1) });
  if (!f.grounded) return;
  m.fx.dust(f.x + f.facing * ahead * f.scale, f.y, amt > 5 ? 5 : 2);
  if (amt > 5) m.fx.dust(f.x, f.y, 3);
}
const slam = (amt, ahead = 40) => (f, m) => slamFx(f, m, amt, ahead);
const flopAng = (fr) => (fr <= 2 ? -0.1 * (fr / 2) : fr <= 11 ? -0.1 + ease.in((fr - 2) / 9) * (Q + 0.1) : fr <= 13 ? Q : fr <= 22 ? Q * (1 - ease.io((fr - 13) / 9)) : 0);
const tipX = (a) => (a <= 0 ? 0 : HW * (1 - Math.cos(a)) + HH * Math.sin(a));     // how far a block's middle travels as it tips over its corner
// a flat spin on the floor, faked by flipping the drawing end for end
const yaw = (fr, from, len, turns) => { const c = Math.cos(clamp((fr - from) / len, 0, 1) * turns * TAU); return (c < 0 ? -1 : 1) * Math.max(0.22, Math.abs(c)); };
const rub = (amp, len) => (f, fr) => { const k = clamp(fr / 4, 0, 1) * clamp((len - fr) / 6, 0, 1); return { ox: Math.sin(fr * 1.05) * amp * k, rot: Math.cos(fr * 1.05) * 0.12 * k, sy: 1 - 0.09 * k }; };
const PIN = { rot: 1.15, tip: 1 };

// ---- the moveset ---------------------------------------------------------------
const moves = {
  // How it gets about: tips over its front corner, slams flat, stands up where it landed.
  flop: {
    frames: 24, keepV: true, slideOff: true, iasa: 19,
    pose: (f, fr) => ({ rot: flopAng(fr), sy: fr > 10 && fr < 15 ? 0.93 : 1, oy: fr > 13 && fr < 22 ? -Math.sin(((fr - 13) / 9) * Math.PI) * 5 : 0 }),
    tick: (f, m, fr) => {
      f.vx = fr >= 2 && fr < 11 ? f.facing * (tipX(flopAng(fr + 1)) - tipX(flopAng(fr))) : 0;
      if (fr === 11) { slamFx(f, m, 2, 30); m.fx.debris(f.x + f.facing * 24, f.y - 4, 1, f.pal.body); }
      // still holding a direction at the end: straight into the next one (CPUs stop to think instead)
      if (fr === 23 && !f.isCPU && f.grounded && Math.abs(f.inp.x) > 0.25 && !f.pressed('attack') && !f.pressed('special') && !f.pressed('jump') && !f.pressed('strong') && !f.pressed('grab')) {
        f.face(f.inp.x); f.startMove('flop', true);
      }
    },
    hits: [hit([6, 11], 'top', 13, 3, 60, 14, 30, { to: 'body', sfx: 'rubber' })],
    cancel: [{ to: 'dash', f: [1, 8], on: 'attack' }],
  },
  jab: {   // corner bonk
    frames: 18, sfx: { 3: 'swishS' },
    pose: K([0, {}], [3, { rot: -0.1 }], [5, { rot: 0.5, ox: 4 }, 'in'], [9, { rot: 0.42, ox: 3 }], [18, {}]),
    hits: [hit([4, 6], 'cornerTF', 11, 4, 75, 14, 28, { to: 'front', sfx: 'rubber' })],
    cancel: [{ to: 'jab', f: [10, 16], on: 'attack' }],
  },
  ftilt: {   // tips over flat, then rights itself
    frames: 36, sfx: { 6: 'swishM' },
    pose: K([0, { tip: 1 }], [4, { rot: -0.14, tip: 1 }], [10, { rot: Q, tip: 1 }, 'in3'], [17, { rot: Q, tip: 1, sy: 0.93 }], [31, { rot: 0, tip: 1 }, 'io'], [36, { tip: 1 }]),
    hits: [hit([8, 11], 'top', 12, 11, 361, 24, 90, { to: 'bottom', sfx: 'whop' })],
    events: { 10: slam(3, 44) },
  },
  utilt: {   // pops straight up
    frames: 27, sfx: { 4: 'boing' },
    pose: K([0, {}], [3, { sy: 0.8, sx: 1.12 }], [6, { sy: 1.22, sx: 0.9, oy: -15 }, 'out'], [11, { oy: -5, sy: 1.05 }], [27, {}]),
    hits: [hit([5, 9], 'top', 15, 7, 88, 30, 100, { sfx: 'rubber' })],
  },
  dtilt: {   // rubs side to side on the floor
    frames: 30, sfx: { 4: 'chalk', 11: 'chalk' }, pose: rub(9, 24),
    hits: [box([4, 15], [0, 7], 62, 16, 2, 80, 0, 0, { set: 20, rehit: 5, hl: 0.5, sfx: 'rubber' }), box([17, 19], [0, 7], 64, 16, 3, 70, 30, 72, { group: 1, sfx: 'rubber' })],
  },
  dash: {   // press Attack as it starts to flop: a flying belly-flop
    frames: 40, fric: 0.6, vel: [[0, 5.4, null]], sfx: { 2: 'swishM' },
    pose: K([0, { rot: 0.3, oy: -4 }], [5, { rot: 1.0, oy: -13 }, 'out'], [9, { rot: Q }, 'in'], [20, { rot: Q, sy: 0.93 }], [34, { rot: 0 }, 'io'], [40, {}]),
    hits: [hit([7, 11], 'top', 13, 10, 55, 56, 62, { to: 'bottom', sfx: 'whop' })],
    events: { 9: slam(4, 26) },
  },
  fsmash: {   // rears back, then SLAMS flat. The slowest smash in the game.
    frames: 62, charge: { at: 14, max: 60 }, sfx: { 18: 'swishL' },
    pose: K([0, { tip: 1 }], [13, { rot: -0.5, tip: 1 }], [14, { rot: -0.5, tip: 1 }], [22, { rot: Q, tip: 1 }, 'in3'], [36, { rot: Q, tip: 1, sy: 0.9 }], [56, { rot: 0, tip: 1 }, 'io'], [62, { tip: 1 }]),
    hits: [hit([20, 23], 'top', 13, 18, 40, 34, 102, { to: 'bottom', sfx: 'whop' })],
    events: { 22: slam(9, 46) },
  },
  usmash: {   // jumps and spins like a thrown brick
    frames: 50, charge: { at: 8, max: 60 }, sfx: { 10: 'swishL' },
    pose: K([0, {}], [7, { sy: 0.72, sx: 1.14 }], [8, { sy: 0.72, sx: 1.14 }], [18, { oy: -46, rot: TAU, sit: 0 }, 'out'], [28, { rot: TAU * 2 }, 'in'], [31, { rot: TAU * 2, sy: 0.85, sx: 1.08 }], [50, { rot: TAU * 2 }]),
    hits: [hit([10, 22], 'body', 25, 14, 88, 34, 104, { sfx: 'whop' })],
    events: { 28: slam(4, 0) },
  },
  dsmash: {   // lies down and spins like a propeller
    frames: 54, charge: { at: 6, max: 60 }, sfx: { 8: 'swishM', 16: 'swishM' },
    pose: (f, fr) => (fr <= 6 ? { rot: ease.in(fr / 6) * Q } : fr < 30 ? { rot: Q, sy: yaw(fr, 7, 20, 2) } : { rot: Q * (1 - ease.io(clamp((fr - 30) / 18, 0, 1))) }),
    hits: [hit([9, 13], [32, 13], 15, 13, 30, 36, 86, { sfx: 'whop' }), hit([14, 18], [-32, 13], 15, 12, 30, 36, 86, { rev: true, group: 1, sfx: 'whop' })],
    events: { 6: slam(3, 0) },
  },
  nair: air({   // tumbles end over end
    frames: 42, sfx: { 3: 'swishM' },
    pose: K([0, { rot: Q }], [26, { rot: Q + TAU }, 'lin'], [999, { rot: Q + TAU }]),
    hits: [hit([4, 12], 'body', 27, 9, 361, 20, 85, { sfx: 'rubber' }), hit([13, 25], 'body', 25, 5, 361, 14, 70, { group: 1 })],
  }, 11, [4, 30]),
  fair: air({   // swings its top face down in front
    frames: 40, sfx: { 8: 'swishM' },
    pose: K([0, {}], [7, { rot: Q - 1.0 }], [11, { rot: Q + 0.6, ox: 5 }, 'in'], [17, { rot: Q + 0.5, ox: 4 }], [40, {}]),
    hits: [hit([9, 13], 'top', 13, 11, 361, 24, 92, { to: 'body', sfx: 'whop' })],
  }, 13, [6, 28]),
  bair: air({   // and its bottom face behind
    frames: 38, sfx: { 6: 'swishM' },
    pose: K([0, {}], [6, { rot: Q + 0.9 }], [9, { rot: Q - 0.7, ox: -5 }, 'in'], [15, { rot: Q - 0.6, ox: -4 }], [38, {}]),
    hits: [hit([8, 12], 'bottom', 13, 11, 361, 26, 95, { to: 'body', rev: true, sfx: 'whop' })],
  }, 12, [5, 26]),
  uair: air({   // corner jab upward
    frames: 34, sfx: { 4: 'swishS' },
    pose: K([0, {}], [4, { rot: Q + 0.2 }], [8, { rot: 0.48, oy: -6 }, 'in'], [13, { rot: 0.56, oy: -4 }], [34, {}]),
    hits: [hit([6, 11], 'cornerTB', 13, 9, 84, 26, 96, { sfx: 'rubber' })],
  }, 10, [4, 24]),
  dair: air({   // drops flat
    frames: 52, drift: 0.25, fallCap: 14, vel: [[4, 0, -3], [14, 0, 14]], sfx: { 13: 'swishL' },
    pose: K([0, {}], [12, { sx: 1.1, sy: 0.94 }], [15, { sx: 0.92, sy: 1.04 }], [52, {}]),
    hits: [box([14, 20], 'body', 56, 26, 13, 270, 20, 84, { sfx: 'whop' }), box([21, 50], 'body', 56, 26, 10, 65, 30, 70, { group: 1 })],
    onLand: (f, m) => { slamFx(f, m, 7, 26); m.fx.dust(f.x - f.facing * 26, f.y, 4); },
  }, 22, [10, 52]),

  // --- specials ---
  nspecial: {   // flicks crumbs: three, in a short fan
    kind: 'special', frames: 36, drift: 0.7, sfx: { 9: 'throw' },
    can: (f, m) => countMine(f, m, 'crumb') < 3,
    pose: K([0, {}], [7, { rot: -0.34 }], [11, { rot: 0.4, ox: 3 }, 'in'], [17, { rot: 0.3 }], [36, {}]),
    events: {
      10: (f, m) => {
        for (const v of [[7.6, -1.4], [6.6, -3.9], [5.4, -6.2]]) {
          shoot(f, m, { tag: 'crumb', x: 20, y: 48, vx: v[0], vy: v[1], g: 0.34, r: 6, life: 26, spin: 0.3 * f.facing, drawFn: drawCrumb,
            hit: { dmg: 2, ang: 60, bk: 8, kg: 20, hl: 0.5, sfx: 'rubber' } });
        }
      },
    },
  },
  sspecial: {   // Skid: falls on its face and slides, shrugging off hits
    kind: 'special', frames: 50, airOK: true, fric: 0.22, grav: 0.5, drift: 0, armor: [[6, 30, 80]], vel: [[8, 8.6, null]], sfx: { 7: 'slide' },
    can: (f) => f.grounded || !f.v.skidUsed,
    start: (f) => { if (!f.grounded) f.v.skidUsed = true; },
    events: { 8: (f, m) => { slamFx(f, m, 3, 26); if (f.grounded) m.spawn(new Smear(m, f)); } },
    tick: (f, m, fr) => { if (fr > 30) f.vx *= 0.8; else if (fr > 8 && fr % 5 === 0 && f.grounded) m.fx.debris(f.x - f.facing * 26, f.y - 3, 1, f.pal.body); },
    pose: K([0, {}], [4, { rot: -0.12 }], [8, { rot: Q }, 'in'], [32, { rot: Q, sy: 0.95 }], [44, { rot: 0 }, 'io'], [50, {}]),
    hits: [hit([8, 28], 'top', 13, 9, 50, 50, 70, { to: 'body', sfx: 'whop' })],
  },
  uspecial: {   // Pencil Flick: springs up spinning
    kind: 'special', frames: 52, helpless: true, drift: 0.7, ledgeOK: 18, airOK: true, slideOff: true, vel: [[8, 1.2, -14.2]], sfx: { 3: 'pencil', 8: 'boing' },
    pose: K([0, {}], [7, { sy: 0.62, sx: 1.2 }], [8, { sy: 0.62, sx: 1.2 }], [40, { rot: TAU * 3, sit: 0 }, 'out'], [52, { rot: TAU * 3, sit: 0 }]),
    hits: [hit([8, 24], 'body', 24, 7, 85, 40, 50, { sfx: 'rubber' })],
  },
  dspecial: {   // Rub Out: a long rub; a soft platform under it is erased for three seconds
    kind: 'special', frames: 44, sfx: { 4: 'chalk', 11: 'chalk', 18: 'chalk' }, pose: rub(10, 30),
    can: (f) => f.grounded,
    tick: (f, m, fr) => { if (fr > 4 && fr < 26 && fr % 5 === 0) m.fx.debris(f.x + (fr % 2 ? 14 : -14), f.y - 3, 1, f.pal.body); },
    hits: [box([5, 22], [0, 7], 64, 16, 2, 80, 0, 0, { set: 22, rehit: 5, hl: 0.5, sfx: 'rubber' }), box([24, 26], [0, 7], 68, 18, 4, 62, 40, 62, { group: 1, sfx: 'rubber' })],
    events: { 26: (f, m) => { const g = f.ground; if (f.grounded && g && g.soft && g.on) { m.spawn(new RubOut(m, f, g)); m.sfx('rip'); m.shake(4); } } },
  },

  // --- the grab: it falls on you and stays there ---
  grab: {
    kind: 'grab', frames: 42, sfx: { 6: 'swishM' },
    pose: K([0, { tip: 1 }], [4, { rot: -0.12, tip: 1 }], [10, PIN, 'in'], [18, PIN], [34, { rot: 0, tip: 1 }, 'io'], [42, { tip: 1 }]),
    hits: [{ f: [9, 12], x: 34, y: -22, r: 15, dmg: 0, grab: true }],
  },
  ...stdThrows({   // every throw is a flick out from underneath
    f: { dmg: 8, bk: 60, kg: 66, f: 12, frames: 32, sfx: 'rubber', pose: K([0, PIN], [8, { rot: 0.7, tip: 1 }], [12, { rot: 1.45, tip: 1 }, 'in'], [32, { tip: 1 }]) },
    b: { dmg: 9, bk: 62, kg: 82, f: 14, frames: 36, sfx: 'rubber', pose: K([0, PIN], [9, { rot: 1.4, tip: 1 }], [14, { rot: -0.5, tip: 1 }, 'in'], [36, { tip: 1 }]) },
    u: { dmg: 8, bk: 66, kg: 70, f: 12, frames: 32, sfx: 'boing', pose: K([0, PIN], [7, { rot: 1.5, tip: 1, sy: 0.9 }], [12, { rot: 0.5, tip: 1, oy: -6 }, 'in'], [32, { tip: 1 }]) },
    d: { dmg: 7, bk: 52, kg: 42, f: 15, frames: 34, sfx: 'thud', pose: K([0, PIN], [9, { rot: 0.8, tip: 1 }], [15, { rot: Q, tip: 1 }, 'in'], [34, { tip: 1 }]) },
  }),
  getup: {
    frames: 36, invuln: [[0, 12]], sfx: { 7: 'swishM' },
    pose: (f, fr) => (fr < 20 ? { rot: -Q, sy: yaw(fr, 4, 14, 1) } : { rot: -Q * (1 - ease.io(clamp((fr - 20) / 14, 0, 1))) }),
    hits: [hit([8, 11], [32, 13], 14, 6, 50, 40, 50), hit([13, 16], [-32, 13], 14, 6, 50, 40, 50, { rev: true, group: 1 })],
  },
  taunt: {   // it considers you, briefly
    kind: 'taunt', frames: 76, iasa: 66, sfx: { 40: 'tick' },
    pose: K([0, {}], [18, { rot: 0.14 }, 'io'], [44, { rot: 0.14 }], [62, {}, 'io'], [76, {}]),
    events: { 40: (f, m) => { m.fx.debris(f.x + f.facing * 12, f.y - 52, 1, f.pal.body); } },
  },

  // --- the super: BIG MISTAKE ---
  super: {
    kind: 'super', frames: 136, sfx: { 2: 'rumble', 68: 'slide_down' },
    exit: (f) => { f.scale = 1; },
    tick: (f, m, fr) => {
      f.scale = 1 + 2.2 * (fr < 60 ? ease.io(fr / 60) : fr < 104 ? 1 : 1 - ease.io(clamp((fr - 104) / 28, 0, 1)));
      if (fr < 60 && fr % 6 === 0) m.shake(1.5 + fr / 20);
      if (fr >= 66 && fr < 78) f.vx = f.facing * 4.6;
      if (fr === 78) {
        m.shake(14); m.sfx('explosion'); m.sfx('thud');
        for (let i = 0; i < 6; i++) m.fx.dust(f.x + f.facing * (40 + i * 38), f.y, 4);
      }
    },
    pose: K([0, { tip: 1 }], [60, { tip: 1 }], [66, { rot: -0.16, tip: 1 }], [78, { rot: Q, tip: 1 }, 'in3'], [104, { rot: Q, tip: 1, sy: 0.94 }], [130, { rot: 0, tip: 1 }, 'io'], [136, { tip: 1 }]),
    hits: [hit([75, 80], 'top', 15, 25, 42, 52, 90, { to: 'bottom', unblockable: true, sfx: 'whop' })],
  },
};

export default {
  id: 'eraser', name: 'THE ERASER', from: 'Rub Out', superName: 'Big Mistake',
  blurb: 'It is an eraser. It does not walk: it falls over in the direction it wants to go. It has no comment.',
  stats: { weight: 122, walk: 1.6, traction: 0.5, jump: 9.8, hop: 6.2, djump: 9, gravity: 0.42, fall: 8.4, fastFall: 12, airSpeed: 2.9, airAccel: 0.2, jumpSquat: 5, landLag: 5, rollSpeed: 3.4, w: 30, h: 58 },
  portrait: { x: 1, y: -40, s: 1.05 },
  noRun: true,
  costumes: costumes(BASE, [
    ['Pink Classic', {}],
    ['White Vinyl', { main: '#eef1f5', body: '#f4f6f8', band: '#3a6fd8', band2: '#ffffff', smudge: 'rgba(60,60,72,0.5)' }],
    ['Black Art Gum', { main: '#4a4a57', body: '#4a4a57', band: '#e8402a', band2: '#ffd23a', smudge: 'rgba(255,255,255,0.24)' }],
    ['Novelty', { main: '#9be04a', body: '#9be04a', band: '#ff9ab8', band2: '#e8402a', smudge: 'rgba(50,80,30,0.38)', berry: 1 }],
  ]),
  pose, points, draw, hurt, moves,
  hooks: {
    init(f) { f.v.skidUsed = false; },
    // It has no walk. Where the engine would start walking, it flops instead.
    preUpdate(f) {
      if ((f.state !== 'idle' && f.state !== 'walk') || !f.grounded || Math.abs(f.inp.x) <= 0.25) return undefined;
      if (f.tryGround()) return undefined;                          // a button always comes first
      if (f.state === 'idle' && f.platformDrop()) return undefined;
      f.face(f.inp.x);
      f.startMove('flop', true);
      return undefined;
    },
    postUpdate(f) { if (f.grounded || f.state === 'ledge') f.v.skidUsed = false; },
    onLand(f, m) { m.shake(2); m.sfx('thud', { vol: 0.4 }); },
  },
  ai: {
    nspecial: { range: [60, 150], dy: 50, w: 0.4 },
    sspecial: { range: [70, 190], dy: 40, w: 0.8 },
    super: { range: 250, dy: 90, grounded: true },
    recovery: { up: 225 },
  },
};
