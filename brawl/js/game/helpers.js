// Helpers: the characters that pop out of a Show & Tell box and fight for
// whoever opened it. Each one registers itself with the item system.

import { registerHelper } from './items.js';
import { Entity } from './entities.js';
import { groundBelow } from './physics.js';
import { clamp, TAU } from '../core/util.js';
import { OUT, circle, ellipse, rrect, limb, line, eyes, mouth, polygon, txt, darken, lighten, blob } from '../core/gfx.js';

// Shared legwork: gravity, standing on (possibly moving) floors, patrolling,
// expiring with a puff. Subclasses add behaviour and a drawing.
class Helper extends Entity {
  constructor(m, owner, x, y, life) {
    super({ owner, team: owner.team, layer: 'front' });
    this.x = x; this.y = y - 30; this.vy = -3; this.vx = 0; this.grounded = false; this.ground = null;
    this.life = life; this.facing = owner.facing || 1; this.dir = this.facing;
    m.fx.puff(x, y - 20, 6, '#ffffff'); m.sfx('pop');
  }
  // returns true while the helper should keep going
  tickBody(m) {
    this.t++;
    if (this.t > this.life) { this.leave(m); return false; }
    if (this.grounded) {
      const g = this.ground;
      if (!g || !g.on || this.x < g.x || this.x > g.x + g.w) { this.grounded = false; this.ground = null; }
      else { this.x += (g.vx || 0) + (g.conv || 0); this.y = g.y; }
    }
    if (!this.grounded) {
      this.vy = Math.min(9, this.vy + 0.42); const py = this.y;
      this.x += this.vx; this.y += this.vy;
      const g = this.vy >= 0 ? groundBelow(m.stage, this.x, py, this.vy + 2) : null;
      if (g && this.y >= g.y) { this.y = g.y; this.vy = 0; this.grounded = true; this.ground = g; this.onLand(m); }
      const b = m.stage.blast;
      if (this.y > b.b || this.x < b.l || this.x > b.r) { this.leave(m, true); return false; }
    }
    return true;
  }
  onLand() {}
  // walk along the current floor, turning round at its ends
  patrol(speed) {
    const g = this.ground; if (!g) return;
    const nx = this.x + this.dir * speed;
    if (nx < g.x + 14 || nx > g.x + g.w - 14) { this.dir = -this.dir; this.facing = this.dir; }
    else this.x = nx;
  }
  nearestFoe(m, maxD = 1e9) {
    let best = null, bd = maxD;
    for (const f of m.foes(this.owner)) { const d = Math.hypot(f.x - this.x, f.cy - (this.y - 20)); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  leave(m, silent) {
    if (this.dead) return;
    this.dead = true; this.cleanup(m);
    if (!silent) { m.fx.puff(this.x, this.y - 20, 6, '#ffffff'); m.sfx('pop', { vol: 0.6 }); }
  }
  cleanup() {}
  blink() { return this.t > this.life - 90 && this.t % 8 < 4; }
}

// ---------------------------------------------------------------- MEATLOAF --
class Meatloaf extends Helper {
  constructor(m, owner, x, y) {
    super(m, owner, x, y, 540);
    this.hit = { dmg: 8, ang: 82, bk: 44, kg: 52, rehit: 45, sfx: 'crunch', fx: 'punch' };
    this.hop = 20; this.biteT = 0; this.sq = 0;
  }
  onLand(m) { this.biteT = 8; this.sq = 8; this.vx = 0; m.fx.dust(this.x, this.y, 2); m.sfx('thud', { vol: 0.4 }); }
  update(m) {
    if (!this.tickBody(m)) return;
    if (this.sq > 0) this.sq--; if (this.biteT > 0) this.biteT--;
    if (this.grounded && --this.hop <= 0) {
      const t = this.nearestFoe(m);
      this.dir = t ? (t.x > this.x ? 1 : -1) : this.dir; this.facing = this.dir;
      const d = t ? Math.abs(t.x - this.x) : 80;
      this.vx = this.dir * clamp(d / 22, 1.6, 4.4); this.vy = -8.6; this.grounded = false; this.ground = null; this.hop = 46;
      m.sfx('boing', { vol: 0.35, rate: 1.3 });
    }
  }
  hitShapes() { return (!this.grounded && this.vy > 0) || this.biteT > 0 ? [{ x: this.x + this.facing * 8, y: this.y - 16, r: 20 }] : null; }
  draw(ctx) {
    if (this.blink()) return;
    const s = this.sq / 8, air = !this.grounded;
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.facing * (1 + s * 0.18 - (air ? 0.06 : 0)), 1 - s * 0.2 + (air ? 0.1 : 0));
    rrect(ctx, -22, -30, 44, 30, 9, '#9a5a32', OUT, 2.4);                      // the loaf
    blob(ctx, [-23, -24, -14, -33, 0, -31, 14, -34, 23, -25, 18, -18, 8, -22, -2, -16, -12, -22, -20, -17], '#6b3a1d', OUT, 2, 0.5);   // gravy
    limb(ctx, [8, -30, 12, -46], 2.6, '#cfd6e0', OUT, 1.6); limb(ctx, [9, -46, 9, -52], 1.6, '#cfd6e0', OUT, 1.2); limb(ctx, [15, -46, 15, -52], 1.6, '#cfd6e0', OUT, 1.2);   // fork
    eyes(ctx, 4, -17, 4.4, 6, 1, 0.4, 0, { lw: 1.6 });
    const open = air || this.biteT > 0;
    if (open) { rrect(ctx, -6, -11, 22, 9, 3, '#5a1f1f', OUT, 1.8); polygon(ctx, [-2, -11, 2, -5, 6, -11], '#ffffff', OUT, 1.2); polygon(ctx, [8, -11, 12, -5, 16, -11], '#ffffff', OUT, 1.2); }
    else mouth(ctx, 5, -6, 14, 1, { lw: 1.6 });
    ctx.restore();
  }
}

// ------------------------------------------------------------- NIGHT GUARD --
class Guard extends Helper {
  constructor(m, owner, x, y) { super(m, owner, x, y, 600); this.atk = 0; this.cool = 20; this.step = 0; }
  update(m) {
    if (!this.tickBody(m)) return;
    if (this.cool > 0) this.cool--;
    if (this.atk > 0) {
      this.atk++;
      const a = this.atk;
      if (a === 8 || a === 20 || a === 34) {
        const last = a === 34;
        this.hitLog.clear();
        this.hit = last ? { dmg: 7, ang: 45, bk: 52, kg: 92, sfx: 'clang' } : { dmg: 3, ang: 80, bk: 14, kg: 10, sfx: 'tink' };
        m.sfx('swishM', { vol: 0.5 });
      }
      if (a === 12 || a === 24 || a === 39) this.hit = null;
      if (a > 52) { this.atk = 0; this.cool = 40; }
      return;
    }
    if (!this.grounded) return;
    const t = this.nearestFoe(m, 400);
    if (t && this.cool <= 0 && Math.abs(t.x - this.x) < 50 && Math.abs(t.y - this.y) < 46) { this.facing = this.dir = t.x > this.x ? 1 : -1; this.atk = 1; return; }
    this.patrol(1.7); this.step += 0.22;
  }
  hitShapes() { return this.hit ? [{ x: this.x + this.facing * 30, y: this.y - 30, r: 20 }] : null; }
  draw(ctx) {
    if (this.blink()) return;
    const a = this.atk, sw = a ? Math.sin((a % 13) / 13 * Math.PI) : 0, bob = this.atk ? 0 : Math.abs(Math.sin(this.step)) * 2;
    ctx.save(); ctx.translate(this.x, this.y - bob); ctx.scale(this.facing, 1);
    const l1 = Math.sin(this.step) * 6;
    limb(ctx, [-5, -16, -5 + l1, -2], 7, '#2b3350', OUT, 2.2); limb(ctx, [5, -16, 5 - l1, -2], 7, '#2b3350', OUT, 2.2);
    ellipse(ctx, -5 + l1 + 3, -1, 6, 3.4, '#1d1611', OUT, 1.8); ellipse(ctx, 5 - l1 + 3, -1, 6, 3.4, '#1d1611', OUT, 1.8);
    rrect(ctx, -15, -40, 30, 28, 10, '#3f4d7a', OUT, 2.4);                              // belly in uniform
    circle(ctx, 7, -30, 2.2, '#ffd84a', OUT, 1);                                           // badge
    circle(ctx, -9, -16, 3.5, '#d9dfe8', OUT, 1.2);                                        // keys
    // head
    circle(ctx, 2, -50, 12, '#f1c9a5', OUT, 2.4);
    rrect(ctx, -11, -64, 26, 10, 4, '#2b3350', OUT, 2.2); rrect(ctx, 3, -57, 16, 4, 2, '#1d1611', OUT, 1.6);
    eyes(ctx, 6, -50, 3, 4.5, a ? 1 : 5, 0.3, 0, { lw: 1.4 });
    limb(ctx, [0, -44, 8, -43, 12, -45], 3.2, '#6b4a2a', OUT, 1.4);                        // moustache
    // flashlight arm
    const ang = a ? -1.2 + sw * 1.7 : 0.25;
    ctx.save(); ctx.translate(12, -32); ctx.rotate(ang);
    limb(ctx, [0, 0, 12, 0], 6, '#3f4d7a', OUT, 2); rrect(ctx, 10, -4, 20, 8, 2, '#ffd84a', OUT, 2); rrect(ctx, 28, -6, 6, 12, 2, '#cfd6e0', OUT, 1.8);
    ctx.globalAlpha = 0.35; polygon(ctx, [34, -5, 70, -18, 70, 18, 34, 5], '#fff6b8', null, 0); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- ANT FARM --
class Ants extends Helper {
  constructor(m, owner, x, y) {
    super(m, owner, x, y, 480);
    this.hp = 12; this.victim = null; this.carryT = 0; this.mash = 0; this.speed = 2.3; this.flash = 0;
    const t = this.nearestFoe(m); this.dir = this.facing = t ? (t.x > x ? 1 : -1) : this.facing;
  }
  hurt() { return this.dead ? [] : [{ x: this.x - 30, y: this.y - 16, w: 60, h: 16 }]; }
  onHurt(m, by, hb, dmg) {
    if (by && by.team === this.team) return;
    this.hp -= Math.max(2, dmg); this.flash = 5; m.sfx('hitS');
    if (this.hp <= 0) this.leave(m);
  }
  release(m, toss) {
    const v = this.victim; if (!v) return;
    this.victim = null;
    if (v.out || v.state === 'dead') return;
    v.intangible = false;
    if (v.state === 'trapped') v.setState('air');
    if (toss) m.blast(this.owner, v, { dmg: 6, ang: 25, bk: 62, kg: 60, dir: this.dir, x: v.x - this.dir * 10, force: true, sfx: 'hitM' });
    else { v.vy = -5; }
  }
  cleanup(m) { this.release(m, false); }
  update(m) {
    if (!this.tickBody(m)) return;
    if (this.flash > 0) this.flash--;
    const v = this.victim;
    if (v) {
      if (v.out || v.state === 'dead') { this.victim = null; this.leave(m); return; }
      if (v.state !== 'trapped') v.setState('trapped');
      v.sf = 1; v.intangible = true; v.x = this.x; v.y = this.y - 14; v.vx = v.vy = v.kx = v.ky = 0; v.grounded = false;
      const p = v.inp.p; if (p.attack || p.special || p.jump || p.shield || v.inp.tapX || v.inp.tapY) this.mash++;
      this.carryT++;
      const g = this.ground, edge = g ? (this.dir > 0 ? g.x + g.w : g.x) : this.x;
      const atEdge = !this.grounded || (this.dir > 0 ? this.x >= edge - 6 : this.x <= edge + 6);
      if (this.mash >= 8) { this.release(m, false); this.leave(m); return; }
      if (this.carryT > 156 || atEdge) { this.release(m, true); this.leave(m); return; }
      if (this.grounded) this.x += this.dir * 1.7;
      return;
    }
    if (!this.grounded) return;
    const g = this.ground, nx = this.x + this.dir * this.speed;
    if (nx < g.x + 20 || nx > g.x + g.w - 20) { this.dir = -this.dir; this.facing = this.dir; } else this.x = nx;
    for (const f of m.foes(this.owner)) {
      if (f.invuln > 0 || f.def.noGrab || f.state === 'trapped' || f.state === 'grabbed' || f.state === 'ledge' || f.superActive) continue;
      if (Math.abs(f.x - this.x) < 30 && Math.abs(f.y - this.y) < 22) {
        f.interrupt(); f.setState('trapped'); f.v.trapMax = 260; this.victim = f; this.carryT = 0; this.mash = 0;
        // carry them toward whichever side of the screen is closer
        const b = m.stage.blast; this.dir = this.facing = (f.x - b.l < b.r - f.x) ? -1 : 1;
        m.sfx('grab'); m.fx.word(f.x, f.y - f.h - 20, 'MASH!', { color: '#ffffff', size: 20 });
        break;
      }
    }
  }
  draw(ctx) {
    if (this.blink()) return;
    for (let i = 0; i < 7; i++) {
      const x = this.x + (i - 3) * 9 * -this.dir + 0, y = this.y - 5 - (this.victim ? 0 : Math.abs(Math.sin(this.t * 0.4 + i)) * 1.5);
      const c = this.flash ? '#ffffff' : '#2b2118';
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.beginPath();
      for (const k of [-1, 0, 1]) { const sw = Math.sin(this.t * 0.6 + i + k) * 2; ctx.moveTo(x + k * 2.5, y); ctx.lineTo(x + k * 3 + sw, y + 5); }
      ctx.stroke();
      ellipse(ctx, x - this.dir * 3, y, 3.2, 2.6, c, OUT, 1.2); circle(ctx, x + this.dir * 1.5, y - 0.5, 2.2, c, OUT, 1.2); circle(ctx, x + this.dir * 5, y - 1.5, 2.6, c, OUT, 1.2);
      line(ctx, x + this.dir * 6, y - 3.5, x + this.dir * 9, y - 7, OUT, 1.1);
    }
  }
}

// ---------------------------------------------------------- ALPHABET BLOCK --
function drawBlocked(ctx, f, m) {
  // a fighter who has been turned into a toy block: their colour, a letter, little feet
  const t = m ? m.frame : 0, walk = f.grounded && Math.abs(f.vx) > 0.5 ? Math.sin(t * 0.5) * 4 : 0;
  ellipse(ctx, -8 + walk, -2, 6, 3.4, OUT, OUT, 1); ellipse(ctx, 8 - walk, -2, 6, 3.4, OUT, OUT, 1);
  ctx.save(); ctx.translate(0, -24); ctx.rotate(f.grounded ? Math.sin(t * 0.2) * 0.05 : (f.vx || 0) * 0.04);
  rrect(ctx, -20, -20, 40, 40, 5, '#e8c27a', OUT, 2.6);
  rrect(ctx, -15, -15, 30, 30, 3, f.color || '#e8402a', OUT, 2);
  txt(ctx, 'ABCD'[f.slot % 4], 0, 1, { font: 'titan', size: 24, fill: '#ffffff', lw: 4 });
  ctx.restore();
}
class Block extends Helper {
  constructor(m, owner, x, y) {
    super(m, owner, x, y, 480);
    this.vx = this.facing * 3.2; this.vy = -8; this.rot = 0;
  }
  update(m) {
    this.t++;
    if (this.t > this.life) { this.leave(m); return; }
    this.vy = Math.min(9, this.vy + 0.34); const py = this.y;
    this.x += this.vx; this.y += this.vy; this.rot += this.vx * 0.06;
    const g = this.vy > 0 ? groundBelow(m.stage, this.x, py, this.vy + 2) : null;
    if (g && this.y >= g.y) { this.y = g.y; this.vy = -Math.max(7.5, Math.abs(this.vy) * 0.9); m.sfx('wood', { vol: 0.4 }); m.fx.dust(this.x, this.y, 1); }
    const v = m.cam.view(), b = m.stage.blast;
    if (this.x < Math.max(v.l, b.l) + 24 && this.vx < 0) this.vx = -this.vx;
    if (this.x > Math.min(v.r, b.r) - 24 && this.vx > 0) this.vx = -this.vx;
    if (this.y > b.b - 60) this.vy = -11;                      // never lost down a pit: it pops back up
    for (const f of m.foes(this.owner)) {
      if (f.silence > 0 || f.invuln > 0 || f.superActive || f.state === 'trapped') continue;
      if (Math.abs(f.x - this.x) < f.w / 2 + 20 && Math.abs(f.cy - (this.y - 20)) < f.h / 2 + 20) {
        f.silence = 300; f.overrideDraw = drawBlocked;
        f.pct = Math.min(999, f.pct + 3); f.stats.taken += 3; this.owner.stats.dealt += 3; f.lastHitBy = this.owner.slot; f.lastHitFrame = m.frame;
        m.fx.burst(f.x, f.cy, 40, '#e8c27a'); m.fx.stars(f.x, f.cy, 4); m.sfx('wood'); m.sfx('pop');
        m.fx.word(f.x, f.y - f.h - 24, 'BLOCKED!', { color: '#ffe23a', size: 22 });
      }
    }
  }
  draw(ctx) {
    if (this.blink()) return;
    ctx.save(); ctx.translate(this.x, this.y - 20); ctx.rotate(this.rot);
    rrect(ctx, -20, -20, 40, 40, 5, '#e8c27a', OUT, 2.6);
    rrect(ctx, -15, -15, 30, 30, 3, '#2f7fe0', OUT, 2);
    txt(ctx, 'Z', 0, 1, { font: 'titan', size: 24, fill: '#ffffff', lw: 4 });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- TACK-BOT --
class TackBot extends Helper {
  constructor(m, owner, x, y) {
    super(m, owner, x, y, 540);
    this.hit = { dmg: 7, ang: 38, bk: 46, kg: 60, rehit: 40, sfx: 'tink', fx: 'slash', radial: true };
  }
  update(m) {
    if (!this.tickBody(m)) return;
    if (this.grounded) { this.patrol(2.5); if (this.t % 16 === 0) m.sfx('click', { vol: 0.25 }); }
  }
  hitShapes() { return [{ x: this.x - 22, y: this.y - 34, w: 44, h: 30 }]; }
  draw(ctx) {
    if (this.blink()) return;
    const t = this.t;
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.facing, 1);
    // treads
    rrect(ctx, -22, -12, 44, 12, 6, '#3a3f55', OUT, 2.2);
    for (let i = 0; i < 4; i++) circle(ctx, -15 + i * 10, -6, 3.2, '#8d96a6', OUT, 1.2);
    ctx.strokeStyle = '#1d1611'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const x = -20 + ((i * 8 + t * 2.5) % 40); ctx.moveTo(x, -12); ctx.lineTo(x, -10); }
    ctx.stroke();
    // tin body + wind-up key
    rrect(ctx, -15, -36, 30, 25, 5, '#e8402a', OUT, 2.4);
    rrect(ctx, -11, -32, 22, 10, 3, '#fff7e0', OUT, 1.6);
    eyes(ctx, 0, -27, 3, 5, 1, 0.3, 0, { lw: 1.2 });
    ctx.save(); ctx.translate(-17, -24); ctx.scale(Math.cos(t * 0.3), 1); ellipse(ctx, -5, 0, 5, 7, '#ffd84a', OUT, 1.8); ctx.restore();
    line(ctx, 0, -36, 0, -44, OUT, 1.8); circle(ctx, 0, -46, 2.6, '#ffd84a', OUT, 1.4);
    // thumbtacks bristling out
    for (const [x, y, a] of [[15, -30, 0], [15, -20, 0.2], [-15, -30, Math.PI], [-15, -20, Math.PI - 0.2], [-6, -36, -1.8], [7, -36, -1.3]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); line(ctx, 0, 0, 9, 0, '#cfd6e0', 2); line(ctx, 0, -3, 0, 3, '#35a84a', 3); ctx.restore();
    }
    ctx.restore();
  }
}

registerHelper({ id: 'meatloaf', name: 'MEATLOAF', spawn: (m, o, x, y) => m.spawn(new Meatloaf(m, o, x, y)) });
registerHelper({ id: 'guard', name: 'NIGHT GUARD', spawn: (m, o, x, y) => m.spawn(new Guard(m, o, x, y)) });
registerHelper({ id: 'ants', name: 'ANT FARM', spawn: (m, o, x, y) => m.spawn(new Ants(m, o, x, y)) });
registerHelper({ id: 'block', name: 'ALPHABET BLOCK', spawn: (m, o, x, y) => m.spawn(new Block(m, o, x, y)) });
registerHelper({ id: 'tackbot', name: 'TACK-BOT', spawn: (m, o, x, y) => m.spawn(new TackBot(m, o, x, y)) });
