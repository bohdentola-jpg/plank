// LUNCH LADY - slot 1 of the roster.
// Brief: a cook who whops people with a big flat paddle, throws shakers as
// her ranged attack, and whose super puts everyone on a conveyor belt and
// buries them in whipped cream and sprinkles.

import { biped, at } from '../game/rig.js';
import { K, hit, box, air, stdGrab, stdThrows, shoot, countMine, costumes, stdTaunt } from '../game/movekit.js';
import { Entity } from '../game/entities.js';
import { groundBelow } from '../game/physics.js';
import { OUT, LW, circle, ellipse, blob, rrect, limb, fs, eye, mouth, darken, lighten, line, rr, txt, star } from '../core/gfx.js';
import { TAU, clamp } from '../core/util.js';

const BASE = {
  main: '#f58aa8', skin: '#f3c39c', hair: '#a79bc4', net: '#6d6387', dress: '#f58aa8', trim: '#ffffff',
  apron: '#fff6e6', glove: '#ffd84a', shoe: '#f7f7f2', stock: '#e2a27a', metal: '#cfd6e0', handle: '#9b5b2c',
  glass: '#c9efff', lip: '#d4334a', frame: '#3a2d4a',
};

const rig = biped({
  hipY: 15, hipW: 7, shY: 30, shW: 12, headY: 45,
  arm: [10, 10], leg: [8, 8], armW: 7, legW: 8, handR: 5.6, footL: 13, footH: 7, propLen: 37,
  armKey: 'skin', sleeveKey: 'dress', legKey: 'stock', handKey: 'glove', footKey: 'shoe',
  stance: { hR: at(15, 20), hL: at(-11, 18), prop: -1.2 },
  airStance: { hR: at(16, 32), hL: at(-12, 30), fR: at(6, 5), fL: at(-7, 1), prop: -0.9 },

  torso(ctx, { J, pal }) {
    // a bell-shaped uniform dress with a white apron over the front
    const sh = J.sh, hip = J.hip, mx = (sh[0] + hip[0]) / 2, my = (sh[1] + hip[1]) / 2;
    blob(ctx, [sh[0] - 12, sh[1] - 1, sh[0] + 11, sh[1] - 2, mx + 16, my + 1, hip[0] + 19, hip[1] + 5, hip[0] - 18, hip[1] + 5, mx - 16, my + 1], pal.dress, OUT, LW, 0.4);
    blob(ctx, [sh[0] - 1, sh[1] + 3, sh[0] + 10, sh[1] + 2, mx + 15, my + 2, hip[0] + 17, hip[1] + 3.5, hip[0] - 4, hip[1] + 3.5, mx - 5, my + 1], pal.apron, OUT, 1.8, 0.34);
    rrect(ctx, mx + 2, my + 1, 8, 6, 1.5, pal.apron, darken(pal.apron, 0.3), 1.3);          // pocket
    circle(ctx, sh[0] + 3, sh[1] - 1, 3.4, pal.trim, OUT, 1.6);                              // collar
  },

  head(ctx, { pal, p, f }) {
    const ex = p.face;
    ctx.scale(1.22, 1.22);
    circle(ctx, -9.5, -12.5, 6.8, pal.hair);                    // bun
    ellipse(ctx, -2.6, -2.4, 12.6, 12.8, pal.hair);             // back of the hair
    // hairnet: criss-cross kept inside the hair
    ctx.save();
    ctx.beginPath(); ctx.arc(-9.5, -12.5, 6.2, 0, TAU); ctx.ellipse(-2.6, -2.4, 12, 12.2, 0, 0, TAU); ctx.clip();
    ctx.strokeStyle = pal.net; ctx.lineWidth = 0.9; ctx.beginPath();
    for (let i = -6; i < 8; i++) { ctx.moveTo(-20 + i * 4.5, -20); ctx.lineTo(-8 + i * 4.5, 4); ctx.moveTo(-8 + i * 4.5, -20); ctx.lineTo(-20 + i * 4.5, 4); }
    ctx.stroke(); ctx.restore();
    ellipse(ctx, 2.4, 1.4, 11.2, 11.8, pal.skin);               // face
    // fringe swept over the forehead
    ctx.beginPath(); ctx.moveTo(-10.6, -1); ctx.quadraticCurveTo(-10, -15.6, 3, -15); ctx.quadraticCurveTo(11.4, -14, 13.4, -6);
    ctx.quadraticCurveTo(5, -10.4, -2, -6); ctx.quadraticCurveTo(-7, -3.6, -10.6, -1); ctx.closePath(); fs(ctx, pal.hair, OUT, 2);
    ellipse(ctx, -5.6, 3, 2.3, 3.2, pal.skin, OUT, 1.5);         // ear
    circle(ctx, -5.6, 7.4, 1.7, pal.glove, OUT, 1.1);            // earring
    // cat-eye glasses
    const gy = -0.8;
    for (const gx of [3.4, 10.6]) {
      ctx.beginPath(); ctx.moveTo(gx - 3.9, gy + 2.8); ctx.quadraticCurveTo(gx - 4.8, gy - 3.6, gx + 0.4, gy - 3.8);
      ctx.quadraticCurveTo(gx + 5.2, gy - 5.2, gx + 3.8, gy + 1.8); ctx.quadraticCurveTo(gx, gy + 4.6, gx - 3.9, gy + 2.8); ctx.closePath();
      fs(ctx, pal.glass, pal.frame, 1.5);
    }
    if (ex === 2 || ex === 3 || ex === 5) { eye(ctx, 3.4, gy + 0.2, 2.4, ex, 0, 0, 1, { lw: 1.2 }); eye(ctx, 10.6, gy + 0.2, 2.4, ex, 0, 0, -1, { lw: 1.2 }); }
    else if (ex === 4) { eye(ctx, 3.4, gy, 2.6, 4, 0, 0, 1, { lw: 0.01, white: pal.glass, t: f.t }); eye(ctx, 10.6, gy, 2.6, 4, 0, 0, -1, { lw: 0.01, white: pal.glass, t: f.t }); }
    else {
      const pr = ex === 6 ? 0.9 : 1.7;
      circle(ctx, 4.2, gy + 0.2, pr, OUT, null, 0); circle(ctx, 11.2, gy + 0.2, pr, OUT, null, 0);
      // stern brows that drop when she means business
      const d = ex === 1 ? 2 : 0;
      line(ctx, 0.2, gy - 5.6, 6, gy - 6 + d, OUT, 1.6); line(ctx, 8.4, gy - 6 + d, 14, gy - 5.6, OUT, 1.6);
    }
    ctx.beginPath(); ctx.moveTo(8.4, 2.6); ctx.quadraticCurveTo(12.4, 4.4, 8.6, 5.8); ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.stroke();   // nose
    if (ex === 2 || ex === 6) mouth(ctx, 7.6, 9.2, 6, 2, { inside: '#7a1f25', lw: 1.3 });
    else if (ex === 3) mouth(ctx, 7.4, 8.2, 8, 3, { inside: pal.lip, lw: 1.3 });
    else { ctx.beginPath(); ctx.moveTo(4, 9); ctx.quadraticCurveTo(7.6, ex === 1 ? 7.4 : 10.2, 11, 8.6); ctx.strokeStyle = pal.lip; ctx.lineWidth = 2.2; ctx.stroke(); }
    circle(ctx, 1.6, 7, 0.8, '#7a4a2e', null, 0);                // beauty spot
  },

  prop(ctx, { pal }) {   // the spatula; origin is the hand, +x runs up the tool
    limb(ctx, [-5, 0, 13, 0], 4.4, pal.handle, OUT, 2);
    limb(ctx, [13, 0, 21, 0], 2.2, pal.metal, OUT, 1.8);
    rrect(ctx, 20, -8.5, 19, 17, 3.5, pal.metal, OUT, LW);
    ctx.strokeStyle = darken(pal.metal, 0.35); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); for (const y of [-4, 0, 4]) { ctx.moveTo(25, y); ctx.lineTo(34.5, y); } ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(22, -6.5, 15, 2);
  },

  front(ctx, { f, pal, p }) {
    if (f.moveId === 'sspecial' && f.mf >= 5 && f.mf < 36) {   // the lunch tray she surfs on
      rrect(ctx, -22, -5, 46, 6, 3, '#e0703a', OUT, LW);
      line(ctx, -16, -3, 16, -3, '#f7a070', 1.6);
    }
    if (f.moveId === 'uspecial' && f.mf >= 6 && f.mf < 26) {   // whipped-cream can
      const J = rig.joints(p);
      ctx.save(); ctx.translate(J.hL[0], J.hL[1]);
      rrect(ctx, -4, -3, 8, 15, 2, '#e8402a', OUT, 2); rrect(ctx, -2.5, 11, 5, 4, 1, '#ffffff', OUT, 1.6);
      ctx.restore();
    }
  },
});

// ---- things she leaves lying around -------------------------------------
function drawShaker(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  rrect(ctx, -5, -7, 10, 14, 3, '#f4fbff', OUT, 2);
  rrect(ctx, -5.5, -10, 11, 5, 2, '#b9c2cf', OUT, 2);
  ctx.fillStyle = '#e8402a'; ctx.fillRect(-4, -1, 8, 4);
  ctx.restore();
}

class Slop extends Entity {
  constructor(m, f) {
    super({ owner: f, team: f.team, layer: 'back', tag: 'slop' });
    this.x = f.x + f.facing * 26; this.y = f.y - 34; this.vx = f.facing * 2.6; this.vy = -3.2;
    this.landed = false; this.ground = null; this.life = 400; this.facing = f.facing;
    this.hit = { dmg: 4, ang: 80, bk: 0, kg: 0, set: 62, fx: 'goo', sfx: 'splat', rehit: 50 };
  }
  update(m) {
    this.t++;
    if (!this.landed) {
      this.vy += 0.34; const py = this.y; this.x += this.vx; this.y += this.vy;
      const g = groundBelow(m.stage, this.x, py, Math.max(2, this.vy + 2));
      if (g && this.y >= g.y) { this.y = g.y; this.landed = true; this.ground = g; this.t = 0; m.sfx('splat'); m.fx.drops(this.x, this.y - 2, 6, '#b7a23a'); }
      if (this.y > m.stage.blast.b) this.dead = true;
      return;
    }
    const g = this.ground;
    if (!g.on || this.x < g.x || this.x > g.x + g.w) { this.dead = true; return; }
    this.x += (g.vx || 0); this.y = g.y;
    if (this.t > this.life) this.dead = true;
  }
  hitShapes() { return this.landed ? [{ x: this.x - 24, y: this.y - 9, w: 48, h: 10 }] : [{ x: this.x, y: this.y, r: 8 }]; }
  draw(ctx) {
    const c = '#b7a23a', d = '#8a7a22';
    if (!this.landed) { circle(ctx, this.x, this.y, 7, c, OUT, 2.2); return; }
    const fade = this.t > this.life - 60 && this.t % 8 < 4;
    if (fade) return;
    const w = Math.min(1, this.t / 8);
    blob(ctx, [this.x - 26 * w, this.y, this.x - 12 * w, this.y - 6, this.x + 4 * w, this.y - 4, this.x + 18 * w, this.y - 7, this.x + 27 * w, this.y, this.x, this.y + 2.5], c, OUT, 2.2, 0.5);
    circle(ctx, this.x - 8, this.y - 3.5, 1.8, d, null, 0); circle(ctx, this.x + 10, this.y - 4, 1.4, d, null, 0);
  }
}

// The super: a tray-return conveyor that carries everyone she caught past a
// whipped-cream nozzle and a sprinkle shaker, then flings them off the end.
class LunchLine extends Entity {
  constructor(m, f, victims) {
    super({ owner: f, layer: 'back' });
    this.dir = f.facing; this.y = f.y; this.x0 = f.x + f.facing * 34; this.len = 250; this.victims = victims;
    this.x = this.x0 + this.dir * this.len / 2;
    this.camera = true;
    victims.forEach((v, i) => { v.interrupt(); v.setState('trapped'); v.v.trapMax = 400; v._beltOff = i * 26; });
  }
  update(m) {
    this.t++;
    const T = 150, f = this.owner;
    for (const v of this.victims) {
      if (v.out || v.state === 'dead') continue;
      if (v.state !== 'trapped') { v.setState('trapped'); }
      v.sf = 1; v.intangible = true;
      const u = clamp((this.t * 1.35 - v._beltOff * 0.4) / T, 0, 1);
      v.x = this.x0 + this.dir * (8 + u * (this.len - 30)); v.y = this.y - 13;
      v.vx = v.vy = v.kx = v.ky = 0; v.grounded = false; v.facing = -this.dir;
      if (this.t % 9 === 0 && this.t > 16 && this.t < T) {
        v.pct = Math.min(999, v.pct + 2.5); v.stats.taken += 2.5; f.stats.dealt += 2.5; v.flash = 4; v.flashColor = '#ffffff';
        v.lastHitBy = f.slot; v.lastHitFrame = m.frame;
        m.fx.puff(v.x, v.y - v.h * 0.7, 3, '#ffffff'); m.sfx('squirt', { vol: 0.5 });
        if (this.t > 70) m.fx.confetti(v.x, v.y - v.h, 3);
      }
    }
    if (this.t === T) {
      for (const v of this.victims) {
        if (v.out || v.state === 'dead') continue;
        v.intangible = false;
        m.blast(f, v, { dmg: 13, ang: 47, bk: 78, kg: 128, dir: this.dir, x: v.x - this.dir * 10, force: true, sfx: 'hitL' });
      }
      m.shake(12); m.sfx('bell', { vol: 0.7 });
    }
    if (this.t > T + 26) this.dead = true;
  }
  draw(ctx, m) {
    const a = this.dir > 0 ? this.x0 : this.x0 - this.len, y = this.y - 13, w = this.len, t = this.t;
    const grow = clamp(t / 10, 0, 1) * clamp((176 - t) / 10, 0, 1);
    ctx.save(); ctx.translate(a + w / 2, y); ctx.scale(1, grow); ctx.translate(-(a + w / 2), -y);
    // legs
    for (const lx of [a + 18, a + w - 18]) limb(ctx, [lx, y + 10, lx, this.y], 5, '#8d96a6', OUT, 2.4);
    rrect(ctx, a, y, w, 13, 6, '#565e6e', OUT, LW);
    // moving belt slats
    ctx.save(); rr(ctx, a + 3, y + 2, w - 6, 7, 3); ctx.clip();
    ctx.strokeStyle = '#2c313c'; ctx.lineWidth = 3;
    const off = (t * 2.4 * this.dir) % 14;
    ctx.beginPath(); for (let x = a - 14 + off; x < a + w + 14; x += 14) { ctx.moveTo(x, y + 2); ctx.lineTo(x - 4, y + 9); } ctx.stroke();
    ctx.restore();
    // cream nozzle + sprinkle shaker overhead
    const n1 = a + w * (this.dir > 0 ? 0.34 : 0.66), n2 = a + w * (this.dir > 0 ? 0.68 : 0.32), top = y - 96;
    limb(ctx, [a + 6, top, a + w - 6, top], 6, '#8d96a6', OUT, 2.4);
    rrect(ctx, n1 - 9, top + 3, 18, 22, 4, '#e8402a', OUT, LW); rrect(ctx, n1 - 4, top + 25, 8, 7, 2, '#ffffff', OUT, 2);
    rrect(ctx, n2 - 9, top + 3, 18, 22, 4, '#35a84a', OUT, LW); rrect(ctx, n2 - 6, top + 25, 12, 5, 2, '#f4fbff', OUT, 2);
    if (t > 16 && t < 150) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(n1, top + 34); ctx.lineTo(n1 + Math.sin(t * 0.8) * 3, y - 34); ctx.stroke();
      const cols = ['#e8402a', '#2f7fe0', '#f2b81c', '#ff7bc0'];
      for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[(i + t) % 4]; ctx.fillRect(n2 - 8 + ((i * 37 + t * 5) % 16), top + 32 + ((i * 23 + t * 6) % 44), 4, 2.5); }
    }
    ctx.restore();
  }
}

// ---- the moveset -----------------------------------------------------------
const S = rig.stance;
const moves = {
  jab: {
    frames: 17, sfx: { 3: 'swishS' },
    pose: K([0, {}], [3, { hR: at(4, 22), prop: -0.3, lean: -0.05 }], [5, { hR: at(21, 22), prop: 0, lean: 0.12 }, 'out'], [9, { hR: at(19, 22), prop: 0.05, lean: 0.1 }], [17, {}]),
    hits: [hit([4, 6], 'prop', 11, 3, 75, 10, 25, { to: 'hR', sfx: 'tink' })],
    cancel: [{ to: 'jab2', f: [7, 15], on: 'attack' }],
  },
  jab2: {
    frames: 23, sfx: { 4: 'swishM' },
    pose: K([0, { hR: at(19, 22), prop: 0.05, lean: 0.1 }], [4, { hR: at(10, 40), prop: -1.9, lean: -0.08 }], [7, { hR: at(21, 13), prop: 0.5, lean: 0.22 }, 'in'], [12, { hR: at(20, 11), prop: 0.6, lean: 0.2 }], [23, {}]),
    hits: [hit([6, 9], 'prop', 12, 5, 48, 30, 72, { to: 'hR', sfx: 'clang' })],
  },
  ftilt: {
    frames: 31, sfx: { 6: 'swishM' },
    pose: K([0, {}], [5, { hR: at(-6, 35), prop: -2.5, lean: -0.12 }], [9, { hR: at(24, 24), prop: 0.05, lean: 0.24 }, 'in'], [14, { hR: at(19, 17), prop: 0.5, lean: 0.2 }], [31, {}]),
    hits: [hit([8, 11], 'prop', 13, 9, 361, 22, 92, { to: 'hR', sfx: 'clang' })],
  },
  utilt: {
    frames: 29, sfx: { 4: 'swishM' },
    pose: K([0, {}], [3, { hR: at(18, 20), prop: 0.2, lean: 0.1 }], [7, { hR: at(7, 49), prop: -1.5, lean: -0.02 }, 'out'], [11, { hR: at(-9, 43), prop: -2.6, lean: -0.14 }], [29, {}]),
    hits: [hit([5, 10], 'prop', 13, 7, 88, 30, 104, { to: 'hR', sfx: 'clang' })],
  },
  dtilt: {
    frames: 25, sfx: { 4: 'scrape' },
    pose: K([0, { by: 9, lean: 0.2 }], [4, { by: 10, lean: 0.24, hR: at(8, 8), prop: 0.2 }], [7, { by: 10, lean: 0.3, hR: at(24, 6), prop: 0.12 }, 'out'], [12, { by: 10, lean: 0.28, hR: at(22, 6), prop: 0.12 }], [25, { by: 6 }]),
    hits: [hit([6, 9], 'prop', 11, 6, 72, 24, 70, { to: 'hR', sfx: 'tink' })],
  },
  dash: {
    frames: 38, fric: 0.3, sfx: { 4: 'swishM' }, vel: [[0, 6.4, null]],
    pose: K([0, { lean: 0.3 }], [5, { lean: 0.46, hR: at(23, 19), prop: -0.05, fR: at(12, 0), fL: at(-12, 0) }], [18, { lean: 0.42, hR: at(23, 19), prop: 0, fR: at(13, 0), fL: at(-10, 0) }], [38, {}]),
    hits: [hit([5, 10], 'prop', 13, 10, 58, 58, 62, { to: 'hR', sfx: 'clang' }), hit([11, 17], 'prop', 12, 7, 62, 40, 50, { to: 'hR' })],
  },
  fsmash: {
    frames: 50, charge: { at: 8, max: 60 }, sfx: { 12: 'swishL' },
    pose: K([0, {}], [7, { hR: at(-5, 46), prop: -2.35, lean: -0.22, by: 2, fR: at(11, 0) }], [8, { hR: at(-5, 46), prop: -2.35, lean: -0.22, by: 2, fR: at(11, 0) }],
      [14, { hR: at(23, 14), prop: 0.58, lean: 0.38, by: 5, fR: at(13, 0), sy: 0.96 }, 'in3'], [22, { hR: at(22, 13), prop: 0.6, lean: 0.34, by: 5, fR: at(13, 0) }], [50, {}]),
    hits: [hit([13, 17], 'prop', 16, 17, 42, 32, 100, { to: 'hR', sfx: 'whop' })],
    events: { 14: (f, m) => { m.fx.dust(f.x + f.facing * 44, f.y, 3); } },
  },
  usmash: {
    frames: 46, charge: { at: 6, max: 60 }, sfx: { 9: 'swishL' },
    pose: K([0, {}], [5, { hR: at(16, 9), prop: 0.9, by: 7, lean: 0.14 }], [6, { hR: at(16, 9), prop: 0.9, by: 7, lean: 0.14 }],
      [11, { hR: at(11, 50), prop: -1.5, lean: -0.04, sy: 1.05 }, 'in'], [16, { hR: at(-6, 46), prop: -2.3, lean: -0.12 }], [46, {}]),
    hits: [hit([9, 14], 'prop', 14, 14, 88, 34, 104, { to: 'hR', sfx: 'whop' })],
  },
  dsmash: {
    frames: 48, charge: { at: 6, max: 60 }, sfx: { 7: 'swishM', 13: 'swishM' },
    pose: K([0, {}], [5, { by: 8, hR: at(-4, 14), prop: -2.8, lean: -0.08 }], [6, { by: 8, hR: at(-4, 14), prop: -2.8, lean: -0.08 }],
      [9, { by: 10, hR: at(23, 8), prop: 0.42, lean: 0.24 }, 'in'], [15, { by: 10, hR: at(-22, 7), prop: 2.72, lean: -0.2 }, 'io'], [20, { by: 9, hR: at(-21, 7), prop: 2.8, lean: -0.18 }], [48, {}]),
    hits: [hit([8, 10], 'prop', 13, 13, 30, 36, 86, { to: 'hR', sfx: 'clang' }), hit([14, 17], 'prop', 13, 12, 30, 36, 86, { to: 'hR', rev: true, group: 1, sfx: 'clang' })],
  },
  nair: air({
    frames: 42, sfx: { 4: 'swishM', 16: 'swishS' },
    pose: K([0, {}], [4, { hR: at(22, 27), prop: 0, rot: 0 }], [26, { hR: at(22, 27), prop: 0, rot: TAU }, 'lin'], [42, {}]),
    hits: [hit([5, 13], 'prop', 13, 9, 361, 20, 88, { to: 'hR', sfx: 'clang' }), hit([14, 25], 'prop', 12, 5, 361, 14, 70, { to: 'hR', group: 1 })],
  }, 10, [4, 30]),
  fair: air({
    frames: 40, sfx: { 7: 'swishM' },
    pose: K([0, {}], [6, { hR: at(0, 49), prop: -2.0, lean: -0.12 }], [10, { hR: at(24, 22), prop: 0.42, lean: 0.24 }, 'in'], [15, { hR: at(20, 14), prop: 0.8, lean: 0.2 }], [40, {}]),
    hits: [hit([9, 13], 'prop', 14, 11, 361, 24, 92, { to: 'hR', sfx: 'clang' })],
  }, 13, [6, 28]),
  bair: air({
    frames: 36, sfx: { 5: 'swishM' },
    pose: K([0, {}], [5, { hR: at(10, 29), prop: -0.6, lean: 0.1 }], [8, { hR: at(-20, 29), prop: 3.1, lean: -0.2 }, 'in'], [13, { hR: at(-19, 27), prop: 3.0, lean: -0.18 }], [36, {}]),
    hits: [hit([7, 11], 'prop', 13, 11, 361, 26, 96, { to: 'hR', rev: true, sfx: 'clang' })],
  }, 11, [5, 26]),
  uair: air({
    frames: 34, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { hR: at(18, 33), prop: -0.7 }], [7, { hR: at(5, 52), prop: -1.57 }, 'out'], [12, { hR: at(-8, 46), prop: -2.4 }], [34, {}]),
    hits: [hit([5, 10], 'prop', 13, 9, 84, 26, 96, { to: 'hR', sfx: 'tink' })],
  }, 10, [4, 24]),
  dair: air({
    frames: 46, sfx: { 10: 'swishM' },
    pose: K([0, {}], [8, { hR: at(8, 37), prop: -1.2, fR: at(6, 12), fL: at(-6, 10) }], [13, { hR: at(6, 11), prop: 1.57, fR: at(8, 14), fL: at(-8, 12), sy: 1.04 }, 'in'], [26, { hR: at(6, 11), prop: 1.57, fR: at(8, 14), fL: at(-8, 12) }], [46, {}]),
    hits: [hit([12, 16], 'prop', 12, 12, 270, 18, 82, { sfx: 'clang' }), hit([17, 26], 'prop', 11, 8, 60, 20, 60, { group: 1 })],
  }, 20, [8, 34]),

  // --- specials ---
  nspecial: {
    kind: 'special', frames: 37, drift: 0.7,
    can: (f, m) => countMine(f, m, 'shaker') < 2,
    pose: K([0, {}], [7, { hL: at(-14, 43), lean: -0.16 }], [12, { hL: at(17, 35), lean: 0.2 }, 'in'], [18, { hL: at(18, 25), lean: 0.14 }], [37, {}]),
    events: {
      11: (f, m) => {
        const y = f.inp.y;
        const v = y < -0.5 ? [4.4, -8.4] : y > 0.5 ? [8.2, -2.2] : [6.4, -5.6];
        shoot(f, m, { tag: 'shaker', x: 18, y: 46, vx: v[0], vy: v[1], g: 0.3, r: 9, life: 150, spin: 0.34 * f.facing, drawFn: drawShaker,
          hit: { dmg: 7, ang: 62, bk: 28, kg: 46, sfx: 'glass' },
          onDie: (p, m2) => { m2.fx.puff(p.x, p.y, 6, '#ffffff'); m2.fx.spark(p.x, p.y, 4, '#ffffff'); m2.sfx('glass', { vol: 0.5 }); } });
        m.sfx('throw');
      },
    },
  },
  sspecial: {
    kind: 'special', frames: 44, fric: 0.1, grav: 0.45, drift: 0.15, slideOff: true, airOK: true,
    armor: [[6, 22, 70]], sfx: { 5: 'slide' },
    vel: [[5, 8.2, null]],
    tick: (f, m, fr) => { if (fr === 5 && !f.grounded) f.vy = Math.min(f.vy, -1.5); if (fr > 5 && fr < 30 && fr % 4 === 0 && f.grounded) m.fx.dust(f.x - f.facing * 18, f.y, 1); },
    pose: K([0, {}], [5, { by: 6, lean: 0.34, fR: at(13, 0), fL: at(-11, 0), hR: at(20, 22), prop: -0.2, hL: at(-16, 22) }], [30, { by: 6, lean: 0.3, fR: at(13, 0), fL: at(-11, 0), hR: at(20, 22), prop: -0.2, hL: at(-16, 22) }], [44, {}]),
    hits: [box([6, 28], [16, 16], 44, 30, 9, 52, 52, 72, { sfx: 'clang' })],
  },
  uspecial: {
    kind: 'special', frames: 56, helpless: true, drift: 0.75, ledgeOK: 16, airOK: true, slideOff: true,
    vel: [[7, 1.6, -12.8]], sfx: { 7: 'spray' },
    tick: (f, m, fr) => { if (fr >= 7 && fr < 26 && fr % 2 === 0) m.fx.puff(f.x - f.facing * 6, f.y + 6, 1, '#ffffff'); },
    pose: K([0, {}], [6, { by: 7, hL: at(-4, 13), hR: at(16, 22), lean: 0.1 }], [9, { hL: at(-6, 6), hR: at(14, 43), prop: -1.4, sy: 1.08, fR: at(5, 4), fL: at(-6, 2) }, 'out'], [26, { hL: at(-6, 6), hR: at(14, 43), prop: -1.4, fR: at(6, 6), fL: at(-6, 3) }], [56, { hR: at(14, 37), hL: at(-13, 37) }]),
    hits: [box([8, 22], [-2, -8], 34, 34, 6, 82, 44, 40, { fx: 'water', sfx: 'splat' })],
  },
  dspecial: {
    kind: 'special', frames: 40, drift: 0.6,
    can: (f, m) => countMine(f, m, 'slop') < 1,
    pose: K([0, {}], [8, { hR: at(2, 31), prop: -2.6, lean: -0.1 }], [14, { hR: at(22, 18), prop: 0.5, lean: 0.24 }, 'in'], [22, { hR: at(20, 14), prop: 0.7, lean: 0.2 }], [40, {}]),
    events: { 13: (f, m) => { m.spawn(new Slop(m, f)); m.sfx('throw', { rate: 0.8 }); } },
  },

  // --- grab + throws ---
  grab: stdGrab(K([0, {}], [6, { hL: at(25, 25), hR: at(16, 25), lean: 0.3, prop: -1.5 }, 'out'], [12, { hL: at(24, 24), hR: at(15, 24), lean: 0.26, prop: -1.5 }], [30, {}]), 31, { h: 32 }),
  ...stdThrows({
    f: { dmg: 8, bk: 60, kg: 66, f: 13, frames: 32, sfx: 'clang', pose: K([0, { hL: at(22, 25) }], [8, { hL: at(20, 25), hR: at(-6, 43), prop: -2.4, lean: -0.1 }], [13, { hL: at(18, 22), hR: at(24, 22), prop: 0.2, lean: 0.26 }, 'in'], [32, {}]) },
    b: { dmg: 9, bk: 62, kg: 82, f: 15, frames: 36, pose: K([0, { hL: at(22, 25) }], [8, { hL: at(8, 45), hR: at(4, 47), lean: -0.1, prop: -1.6 }], [15, { hL: at(-18, 31), hR: at(-14, 35), lean: -0.34, prop: -2.6 }, 'in'], [36, {}]) },
    u: { dmg: 8, bk: 66, kg: 70, f: 12, frames: 32, sfx: 'clang', pose: K([0, { hL: at(22, 25) }], [7, { by: 8, hR: at(18, 11), prop: 0.3, hL: at(18, 16) }], [12, { hR: at(12, 49), prop: -1.5, hL: at(6, 41), sy: 1.05 }, 'in'], [32, {}]) },
    d: { dmg: 7, bk: 52, kg: 40, f: 15, frames: 34, sfx: 'whop', pose: K([0, { hL: at(22, 25) }], [8, { hL: at(18, 9), hR: at(0, 45), prop: -2.1, by: 6 }], [15, { hL: at(18, 8), hR: at(22, 9), prop: 0.6, by: 10, lean: 0.3 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 9: 'swishM' },
    pose: K([0, { by: 12, lean: 0.2 }], [10, { by: 9, hR: at(23, 7), prop: 0.3 }], [16, { by: 9, hR: at(-21, 9), prop: 2.8, lean: -0.15 }, 'io'], [34, {}]),
    hits: [hit([9, 12], 'prop', 12, 6, 50, 40, 50, { to: 'hR' }), hit([15, 18], 'prop', 12, 6, 50, 40, 50, { to: 'hR', rev: true, group: 1 })],
  },
  taunt: stdTaunt({ hR: at(14, 25), prop: -0.6, hL: at(12, 22), lean: -0.06, face: 1 }, 64, 'tink'),

  // --- the super: LUNCH LINE ---
  super: {
    kind: 'super', frames: 190, sfx: { 6: 'swishL' },
    pose: K([0, {}], [8, { hR: at(-6, 47), prop: -2.3, lean: -0.2 }], [13, { hR: at(24, 12), prop: 0.5, lean: 0.34 }, 'in3'], [24, { hR: at(22, 12), prop: 0.5, lean: 0.3 }],
      [34, { hR: at(10, 41), prop: -1.4, hL: at(-12, 22), lean: -0.05, face: 3 }], [176, { hR: at(10, 41), prop: -1.4, hL: at(-12, 22), lean: -0.05, face: 3 }], [190, {}]),
    start: (f) => { f.v.caught = []; },
    hits: [box([12, 18], [70, 34], 170, 96, 6, 90, 0, 0, { set: 1, unblockable: true, sfx: 'whop',
      onHit: (o, t) => { if (o && !o.v.caught.includes(t) && !t.def.noGrab) o.v.caught.push(t); } })],
    events: {
      20: (f, m) => {
        const got = f.v.caught.filter((v) => !v.out && v.state !== 'dead');
        if (!got.length) { f.mf = 168; m.sfx('fail'); m.fx.word(f.x, f.y - 90, 'MISSED!', { color: '#ffffff', size: 22 }); return; }
        m.spawn(new LunchLine(m, f, got)); m.sfx('conveyor');
      },
    },
    tick: (f) => { f.invuln = Math.max(f.invuln, 2); },
  },
};

export default {
  id: 'lunchlady', name: 'LUNCH LADY', from: 'Lunch Rush', superName: 'Lunch Line',
  blurb: 'Serves two things: sloppy joes and beatdowns. The spatula has range, the shakers fly in an arc.',
  stats: { weight: 108, walk: 2.1, dash: 5.0, run: 4.4, jump: 10.2, hop: 6.4, djump: 9.6, gravity: 0.38, fall: 7.8, airSpeed: 3.2, w: 34, h: 60 },
  portrait: { x: 3, y: -44, s: 1.18 },
  costumes: costumes(BASE, [
    ['Hot Lunch', {}],
    ['Night Shift', { main: '#3f8f8a', dress: '#3f8f8a', hair: '#d9d3c4', net: '#8f8a7c', glove: '#ff8a6b', lip: '#a3275e' }],
    ['Picture Day', { main: '#f2b81c', dress: '#f2b81c', hair: '#c9562e', net: '#7d2f14', glove: '#7bd1ff', apron: '#fffbe8' }],
    ['Head Cook', { main: '#3a3f55', dress: '#3a3f55', hair: '#2e2a33', net: '#77738a', glove: '#ffffff', apron: '#f1f1f1', lip: '#e8402a', stock: '#c98d68' }],
  ]),
  pose: rig.pose, points: rig.points, draw: rig.draw,
  moves,
};
