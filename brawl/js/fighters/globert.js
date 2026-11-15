// GLOBERT - slot 6 of the roster.
// Brief: a fighter who is ALWAYS a ball. No arms, so he charges into people;
// maybe something with his tongue; several mid-air jumps to make up for it.
// Super: a rain of balls from the sky pummels everyone.
//
// He is the classroom globe that came off its stand. This file is also the
// example of a fighter that does NOT use the two-legged rig: it supplies its
// own pose / points / draw.

import { customPose } from '../game/rig.js';
import { K, hit, air, stdThrows, costumes, shoot } from '../game/movekit.js';
import { Entity, Projectile } from '../game/entities.js';
import { OUT, LW, circle, ellipse, blob, limb, eyes, mouth, darken, lighten, gloss, shadeArc, rrect, fs } from '../core/gfx.js';
import { TAU, clamp, approach } from '../core/util.js';

const R = 22;
const BASE = { main: '#3d8fe0', ocean: '#3d8fe0', land: '#58b84a', cap: '#e0b03a', tongue: '#ff7f9a', line: '#bfe0ff' };

// pose: squash (sx, sy), spin (rot), slide (ox, oy), face, tongue length 0..1 and its angle
const STANCE = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, face: 0, tongue: 0, tAng: 0 };

function pose(f) {
  return customPose(f, STANCE, (ff, p) => {
    if (ff.state === 'grabhold') p.tongue = 0.72;
    if (ff.state === 'ledge') { p.tongue = 0.5; p.tAng = -1.75; }
  });
}

function points(f, p) {
  const cy = -R * p.sy + p.oy, cx = p.ox;
  return {
    body: [cx, cy], front: [cx + R * 0.7 * p.sx, cy], back: [cx - R * 0.7 * p.sx, cy],
    top: [cx, cy - R * 0.8 * p.sy], bottom: [cx, p.oy - 4],
    tongue: [cx + Math.cos(p.tAng) * (R + p.tongue * 34), cy + 5 + Math.sin(p.tAng) * (R + p.tongue * 34)],
    grab: [R + 24, 0],
  };
}

// made-up continents: [longitude, latitude px, half-width, half-height]
const LANDS = [[0.2, -8, 12, 9], [1.7, 6, 9, 12], [3.3, -3, 14, 8], [4.7, 9, 8, 6], [2.5, -15, 7, 4], [5.6, -12, 6, 5]];

function draw(ctx, f, p) {
  const pal = f.drawPal || f.pal, ex = p.face;
  const roll = (f.v && f.v.roll !== undefined ? f.v.roll : f.t * 1.2) / R;
  ctx.save();
  ctx.translate(p.ox, p.oy); ctx.scale(p.sx, p.sy); ctx.translate(0, -R);
  if (p.rot) ctx.rotate(p.rot);
  if (p.tongue > 0.03) {
    const a = p.tAng, len = R * 0.4 + p.tongue * 34 + R * 0.6;
    limb(ctx, [Math.cos(a) * R * 0.5, 5 + Math.sin(a) * R * 0.5, Math.cos(a) * len, 5 + Math.sin(a) * len], 7, pal.tongue, OUT, 2);
    circle(ctx, Math.cos(a) * len, 5 + Math.sin(a) * len, 5, pal.tongue, OUT, 2);
  }
  circle(ctx, 0, 0, R, pal.ocean, OUT, LW);
  // the map spins around a vertical axis: land slides sideways and thins at the rim
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, TAU); ctx.clip();
  for (const L of LANDS) {
    let th = (L[0] + roll) % TAU; if (th < 0) th += TAU; if (th > Math.PI) th -= TAU;
    if (Math.abs(th) > 1.5) continue;
    const c = Math.cos(th), x = Math.sin(th) * (R - 2);
    ctx.save(); ctx.translate(x, L[1]); ctx.scale(Math.max(0.12, c), 1);
    blob(ctx, [-L[2], -1, -L[2] * 0.3, -L[3], L[2] * 0.6, -L[3] * 0.7, L[2], 1, L[2] * 0.4, L[3], -L[2] * 0.5, L[3] * 0.8], pal.land, darken(pal.land, 0.35), 1.5, 0.5);
    ctx.restore();
  }
  ctx.strokeStyle = pal.line; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.36, 0, 0, TAU); ctx.moveTo(-R, -11); ctx.quadraticCurveTo(0, -5, R, -11); ctx.moveTo(-R, 11); ctx.quadraticCurveTo(0, 17, R, 11); ctx.stroke();
  ctx.globalAlpha = 1; ctx.restore();
  shadeArc(ctx, 0, 0, R - 1, 0.16);
  gloss(ctx, -8, -11, 7, 3.6, 0.5);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.stroke();
  // the brass pins where the stand used to hold him
  ctx.save(); ctx.rotate(0.4);
  rrect(ctx, -3.5, -R - 5, 7, 6, 2, pal.cap, OUT, 1.8); rrect(ctx, -3, R - 1, 6, 5, 2, pal.cap, OUT, 1.8);
  ctx.restore();
  // face
  const look = clamp((f.vx || 0) * 0.12, -0.3, 0.6);
  eyes(ctx, 7, -5, 5.6, 6.4, ex, 0.35 + look, ex === 1 ? 0.15 : 0, { tall: true, lw: 1.8, t: f.t });
  if (ex === 2 || ex === 6) mouth(ctx, 8, 8, 9, 2, { lw: 1.8 });
  else if (ex === 3) mouth(ctx, 8, 6, 12, 3, { lw: 1.8, inside: '#7a1f25' });
  else if (ex === 1) mouth(ctx, 8, 8, 10, 1, { lw: 1.6 });
  else if (ex === 4) mouth(ctx, 8, 8, 10, 4, { lw: 1.8 });
  else if (p.tongue > 0.03) mouth(ctx, 9, 7, 8, 2, { lw: 1.8 });
  else mouth(ctx, 8, 9, 9, ex === 5 ? 5 : 0, { lw: 1.8 });
  ctx.restore();
}

// ---- super: DODGEBALL! -----------------------------------------------------
function drawBall(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  circle(ctx, 0, 0, 14, '#e8402a', OUT, 2.4);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#b72c1a'; ctx.lineWidth = 1;
  ctx.beginPath(); for (let i = -20; i <= 20; i += 5) { ctx.moveTo(i, -16); ctx.lineTo(i + 10, 16); ctx.moveTo(i, 16); ctx.lineTo(i + 10, -16); } ctx.stroke();
  ctx.restore();
  gloss(ctx, -5, -6, 4.5, 2.4, 0.55);
  ctx.restore();
}
class Dodgeballs extends Entity {
  constructor(m, f) { super({ owner: f }); this.life = 300; }
  update(m) {
    this.t++;
    if (this.t % 5 === 0 && this.t < this.life - 30) {
      const v = m.cam.view(), f = this.owner;
      const x = m.rng.range(v.l - 40, v.r + 40), vx = m.rng.range(-2.4, 2.4);
      m.spawn(new Projectile(m, { owner: f, x, y: v.t - 30, vx, vy: m.rng.range(9.5, 12.5), g: 0.05, r: 15, life: 130, stage: 'bounce', bounces: 1, rest: 0.55,
        spin: 0.3 * Math.sign(vx || 1), pierce: true, drawFn: drawBall, reflectable: false,
        hit: { dmg: 9, ang: 72, bk: 46, kg: 78, radial: true, sfx: 'rubber', fx: 'punch' },
        onBounce: (p, m2) => { m2.sfx('rubber', { vol: 0.35 }); p.stage = 'pass'; } }));
    }
    if (this.t > this.life) this.dead = true;
  }
}

function shock(f, m) {
  for (const d of [-1, 1]) {
    m.spawn(new Projectile(m, { owner: f, x: f.x + d * 18, y: f.y - 8, vx: d * 6.4, vy: 0, r: 13, life: 15, stage: 'pass', pierce: true, reflectable: false,
      hit: { dmg: 7, ang: 72, bk: 34, kg: 60, fx: 'punch' },
      drawFn: (ctx, p) => { ctx.globalAlpha = 1 - p.t / 16; ellipse(ctx, p.x, p.y + 4, 14, 7, '#efe6d2', 'rgba(60,45,34,0.6)', 1.6); ctx.globalAlpha = 1; } }));
  }
}

const spin = (turns, to) => K([0, { rot: 0 }], [to, { rot: TAU * turns }, 'lin'], [999, { rot: TAU * turns }]);

const moves = {
  jab: {
    frames: 18, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { ox: -5, sx: 0.9, sy: 1.08 }], [6, { ox: 13, sx: 1.14, sy: 0.9 }, 'out'], [10, { ox: 8 }], [18, {}]),
    hits: [hit([4, 8], 'front', 18, 5, 70, 16, 30, { sfx: 'rubber' })],
    cancel: [{ to: 'jab', f: [11, 17], on: 'attack' }],
  },
  ftilt: {
    frames: 30, sfx: { 6: 'swishM' }, vel: [[7, 4.6, null]],
    pose: K([0, {}], [5, { ox: -7, sx: 0.86, sy: 1.12, rot: -0.2 }], [9, { ox: 11, sx: 1.2, sy: 0.86, rot: 0.3 }, 'in'], [15, { ox: 6, rot: 0.15 }], [30, {}]),
    hits: [hit([7, 13], 'front', 20, 10, 361, 24, 92, { sfx: 'rubber' })],
  },
  utilt: {
    frames: 28, sfx: { 5: 'boing' },
    pose: K([0, {}], [4, { sy: 0.7, sx: 1.24 }], [8, { sy: 1.32, sx: 0.84, oy: -16 }, 'out'], [13, { sy: 1.1, oy: -6 }], [28, {}]),
    hits: [hit([6, 11], 'top', 19, 8, 88, 30, 100, { sfx: 'rubber' })],
  },
  dtilt: {
    frames: 24, sfx: { 4: 'swishS' },
    pose: K([0, { sy: 0.8, sx: 1.15 }], [5, { sy: 0.7, sx: 1.32, rot: 0.5 }], [9, { sy: 0.7, sx: 1.32, rot: -0.5 }], [24, {}]),
    hits: [hit([5, 7], [25, 7], 14, 6, 75, 24, 70), hit([8, 10], [-25, 7], 14, 6, 75, 24, 70, { group: 1, rev: true })],
  },
  dash: {
    frames: 40, vel: [[0, 7.4, null]], fric: 0.24, sfx: { 2: 'swishM' },
    pose: K([0, { rot: 0 }], [24, { rot: TAU * 3, sx: 1.08, sy: 0.94 }, 'out'], [40, { rot: TAU * 3 }]),
    hits: [hit([4, 12], 'body', 24, 11, 55, 58, 62, { sfx: 'rubber' }), hit([13, 22], 'body', 22, 8, 60, 40, 50, { group: 1 })],
  },
  fsmash: {
    frames: 52, charge: { at: 9, max: 60 }, vel: [[13, 10.8, null]], fric: 0.34, sfx: { 12: 'swishL' },
    pose: K([0, {}], [8, { ox: -8, sx: 0.78, sy: 1.22, rot: -0.3 }], [9, { ox: -8, sx: 0.78, sy: 1.22, rot: -0.3 }], [14, { ox: 6, sx: 1.32, sy: 0.8 }, 'in3'], [24, { sx: 1.1, sy: 0.94 }], [52, {}]),
    hits: [hit([13, 20], 'front', 23, 18, 40, 34, 101, { sfx: 'whop' })],
  },
  usmash: {
    frames: 48, charge: { at: 7, max: 60 }, sfx: { 10: 'boing' },
    pose: K([0, {}], [6, { sy: 0.55, sx: 1.42 }], [7, { sy: 0.55, sx: 1.42 }], [12, { sy: 1.5, sx: 0.74, oy: -26 }, 'in3'], [18, { sy: 1.15, oy: -8 }], [48, {}]),
    hits: [hit([10, 16], 'top', 21, 15, 90, 34, 104, { sfx: 'whop' })],
  },
  dsmash: {
    frames: 50, charge: { at: 6, max: 60 }, sfx: { 8: 'swishM', 14: 'swishM' },
    pose: K([0, {}], [5, { sy: 0.8, sx: 1.16 }], [6, { sy: 0.8, sx: 1.16 }], [22, { rot: TAU * 2, sy: 0.84, sx: 1.24 }, 'out'], [50, { rot: TAU * 2 }]),
    hits: [hit([9, 13], [27, 11], 16, 13, 30, 36, 86, { sfx: 'rubber' }), hit([14, 18], [-27, 11], 16, 12, 30, 36, 86, { rev: true, group: 1, sfx: 'rubber' })],
  },
  nair: air({
    frames: 40, sfx: { 3: 'swishM' }, pose: spin(2, 26),
    hits: [hit([4, 12], 'body', 26, 10, 361, 20, 86, { sfx: 'rubber' }), hit([13, 24], 'body', 24, 6, 361, 14, 70, { group: 1 })],
  }, 9, [3, 28]),
  fair: air({
    frames: 38, sfx: { 7: 'swishM' },
    pose: K([0, {}], [6, { ox: -6, sx: 0.84, sy: 1.14 }], [10, { ox: 13, sx: 1.26, sy: 0.84 }, 'in'], [16, { ox: 6 }], [38, {}]),
    hits: [hit([8, 14], 'front', 21, 12, 361, 24, 93, { sfx: 'rubber' })],
  }, 12, [6, 26]),
  bair: air({
    frames: 34, sfx: { 5: 'swishM' },
    pose: K([0, {}], [5, { ox: 6 }], [8, { ox: -14, sx: 1.22, sy: 0.86 }, 'in'], [13, { ox: -8 }], [34, {}]),
    hits: [hit([7, 11], 'back', 18, 10, 361, 26, 95, { rev: true, sfx: 'rubber' })],
  }, 10, [5, 24]),
  uair: air({
    frames: 32, sfx: { 4: 'swishS' },
    pose: K([0, {}], [4, { sy: 0.8, sx: 1.15 }], [8, { sy: 1.3, sx: 0.85, oy: -12 }, 'out'], [32, {}]),
    hits: [hit([6, 11], 'top', 17, 9, 85, 26, 96, { sfx: 'rubber' })],
  }, 9, [4, 22]),
  dair: air({
    frames: 52, drift: 0.25, fallCap: 13.5, vel: [[4, 0, -3], [14, 0, 13.5]], sfx: { 13: 'swishL' },
    pose: K([0, {}], [12, { sy: 0.8, sx: 1.2, rot: TAU }, 'out'], [15, { sy: 1.26, sx: 0.84, rot: TAU }], [52, { sy: 1.26, sx: 0.84, rot: TAU }]),
    hits: [hit([14, 20], 'bottom', 18, 13, 270, 20, 84, { sfx: 'whop' }), hit([21, 50], 'bottom', 18, 10, 65, 30, 70, { group: 1, sfx: 'rubber' })],
    onLand: (f, m) => { m.fx.dust(f.x, f.y, 6); m.shake(4); m.sfx('thud'); },
  }, 20, [10, 52]),

  // --- specials ---
  nspecial: {   // hold to rev up on the spot, let go to shoot off
    kind: 'special', frames: 112, keepV: true, slideOff: true, airOK: true, drift: 0.1,
    start: (f) => { f.v.spin = 0; f.v.go = 0; },
    exit: (f) => { f.dmgMul = 1; },
    tick: (f, m, fr) => {
      if (!f.v.go) {
        f.vx = approach(f.vx, 0, 0.5);
        if (fr >= 8) {
          const held = f.inp.h.special || (f.isCPU && f.v.spin < (f.v.aiSpin || 26));
          if (held && f.v.spin < 70) {
            f.v.spin++; f.mf = 7;
            if (f.v.spin % 7 === 0) { m.sfx('rev', { vol: 0.4, rate: 0.8 + f.v.spin / 70 }); if (f.grounded) m.fx.dust(f.x - f.facing * 14, f.y, 1); }
          } else { f.v.go = 1; f.vx = f.facing * (6.2 + f.v.spin * 0.105); f.dmgMul = 1 + f.v.spin / 120; f.mf = 20; m.sfx('dash'); }
        }
      } else {
        f.vx = approach(f.vx, 0, 0.085);
        if (f.pressed('jump') && fr > 26) { f.eat('jump'); f.vy = -f.st.jump * 0.92; f.grounded = false; f.ground = null; f.setState('air'); m.sfx('jump'); return; }
        if (Math.abs(f.vx) < 2.6 && f.mf < 100) f.mf = 100;
        if (fr % 4 === 0 && f.grounded) m.fx.dust(f.x - f.facing * 14, f.y, 1);
      }
    },
    pose: (f) => ({ rot: f.v.go ? f.t * 0.85 : f.t * (0.28 + (f.v.spin || 0) * 0.012), sy: 0.92, sx: 1.08, face: 1 }),
    hits: [hit([21, 99], 'body', 22, 9, 50, 40, 72, { rehit: 22, sfx: 'rubber' })],
  },
  sspecial: {
    kind: 'special', frames: 46, vel: [[6, 7.4, -6.6]], grav: 0.9, drift: 0.2, airOK: true, slideOff: true, armor: [[6, 22, 65]], sfx: { 5: 'boing' },
    pose: K([0, {}], [5, { sy: 0.74, sx: 1.22 }], [8, { rot: 0, sy: 1.1 }], [30, { rot: TAU * 2 }, 'lin'], [46, { rot: TAU * 2 }]),
    hits: [hit([7, 30], 'body', 23, 11, 48, 46, 78, { sfx: 'rubber' })],
  },
  uspecial: {
    kind: 'special', frames: 48, vel: [[8, null, -14.2]], drift: 0.85, ledgeOK: 16, airOK: true, slideOff: true, sfx: { 7: 'boing' },
    can: (f) => !f.v.usedUp, start: (f) => { f.v.usedUp = true; },
    pose: K([0, {}], [7, { sy: 0.5, sx: 1.46 }], [10, { sy: 1.46, sx: 0.74 }, 'out'], [22, { sy: 1.1, sx: 0.95 }], [48, {}]),
    hits: [hit([8, 20], 'top', 18, 8, 88, 40, 60, { sfx: 'rubber' })],
  },
  dspecial: {
    kind: 'special', frames: 80, airOK: true, drift: 0, fallCap: 15.5, sfx: { 18: 'swishL' },
    vel: [[0, 0, null], [8, 0, -7.5], [20, 0, 15.5]],
    pose: K([0, {}], [8, { sy: 0.7, sx: 1.26 }], [18, { sy: 1.1, rot: TAU }, 'out'], [22, { sy: 1.32, sx: 0.8, rot: TAU }], [80, { sy: 1.32, sx: 0.8, rot: TAU }]),
    hits: [hit([20, 78], 'bottom', 20, 12, 275, 24, 80, { sfx: 'whop' })],
    onLand: (f, m) => { if (f.mf < 20) return; shock(f, m); m.fx.dust(f.x, f.y, 8); m.shake(7); m.sfx('thud'); f.setState('land', 20); return false; },
  },

  // --- the tongue: his grab ---
  grab: {
    kind: 'grab', frames: 36, sfx: { 6: 'slurp' },
    pose: K([0, {}], [5, { tongue: 0.1, sx: 0.94 }], [9, { tongue: 1, sx: 1.06 }, 'out'], [14, { tongue: 1 }], [24, { tongue: 0 }], [36, {}]),
    hits: [{ f: [8, 13], at: 'tongue', r: 12, dmg: 0, grab: true }, { f: [8, 13], x: 30, y: -17, r: 12, dmg: 0, grab: true }],
  },
  ...stdThrows({
    f: { dmg: 8, bk: 60, kg: 66, f: 12, frames: 30, sfx: 'spit', pose: K([0, { tongue: 0.7 }], [8, { tongue: 0.2, sx: 0.84, sy: 1.14, ox: -5 }], [12, { tongue: 0.9, sx: 1.2, sy: 0.86, ox: 6 }, 'in'], [30, {}]) },
    b: { dmg: 9, bk: 62, kg: 84, f: 16, frames: 36, pose: K([0, { tongue: 0.7 }], [16, { tongue: 0.7, rot: -TAU }, 'in'], [36, { rot: -TAU }]) },
    u: { dmg: 8, bk: 66, kg: 70, f: 12, frames: 32, pose: K([0, { tongue: 0.7 }], [7, { tongue: 0.4, tAng: -0.6, sy: 0.7, sx: 1.25 }], [12, { tongue: 0.9, tAng: -1.5, sy: 1.3, sx: 0.84 }, 'in'], [32, {}]) },
    d: { dmg: 7, bk: 50, kg: 42, f: 15, frames: 34, sfx: 'thud', pose: K([0, { tongue: 0.7 }], [9, { tongue: 0.3, tAng: 0.6, oy: -18, ox: 14 }], [15, { tongue: 0.1, tAng: 0.9, oy: 0, ox: 20, sy: 0.7, sx: 1.3 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 9: 'swishM' }, pose: K([0, { sy: 0.7, sx: 1.2 }], [22, { rot: TAU * 2 }, 'out'], [34, { rot: TAU * 2 }]),
    hits: [hit([9, 12], [25, 9], 14, 6, 50, 40, 50), hit([13, 17], [-25, 9], 14, 6, 50, 40, 50, { rev: true, group: 1 })],
  },
  taunt: {
    kind: 'taunt', frames: 70, iasa: 60,
    tick: (f) => { f.v.roll += 9; },
    pose: K([0, {}], [8, { sy: 1.08, sx: 0.94, face: 3 }], [60, { sy: 1.08, sx: 0.94, face: 3 }], [70, {}]),
  },

  super: {
    kind: 'super', frames: 64,
    pose: K([0, {}], [10, { sy: 0.66, sx: 1.34 }], [18, { sy: 1.3, sx: 0.8, oy: -22, face: 3 }, 'out'], [44, { oy: -6, face: 3 }], [64, {}]),
    events: {
      15: (f, m) => {
        m.sfx('whistle'); m.shake(6);
        m.announce('DODGEBALL!', { life: 80, size: 84, pop: true, color: '#ff5a3a', font: 'bangers' });
        m.spawn(new Dodgeballs(m, f));
      },
    },
  },
};

export default {
  id: 'globert', name: 'GLOBERT', from: 'Roll Call', superName: 'Dodgeball!',
  blurb: 'The classroom globe, off his stand and out of patience. Fast, slippery, and five jumps deep.',
  stats: { weight: 97, walk: 2.6, dash: 6.2, run: 6.0, traction: 0.3, jump: 10.2, hop: 6.4, djump: 8.8, djumpDecay: 0.9, airJumps: 4, gravity: 0.37, fall: 7.6, airSpeed: 3.7, w: 38, h: 44, landLag: 3 },
  portrait: { x: 3, y: -22, s: 0.86 },
  costumes: costumes(BASE, [
    ['Classroom', {}],
    ['Antique', { main: '#d9b77c', ocean: '#e3c58c', land: '#8a5a2b', cap: '#6b4a2a', line: '#fff3d0' }],
    ['Moon Unit', { main: '#c9cdd6', ocean: '#c9cdd6', land: '#8d93a3', cap: '#5f6b7d', line: '#ffffff' }],
    ['Lava Lamp', { main: '#e8402a', ocean: '#e8402a', land: '#ffc23a', cap: '#3a3f55', line: '#ffd0a0' }],
  ]),
  pose, points, draw, moves,
  hooks: {
    init(f) { f.v.roll = 0; f.v.usedUp = false; },
    postUpdate(f) {
      f.v.roll += (f.vx + f.kx) * f.facing * 0.9;
      if (f.grounded || f.state === 'ledge') f.v.usedUp = false;
    },
  },
  ai: {
    nspecial: { range: [130, 360], w: 0.5 },
    super: { range: 9999, dy: 9999, anyFacing: true },
    recovery: { up: 240 },
  },
};
