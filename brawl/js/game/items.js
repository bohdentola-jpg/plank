// Things that turn up mid-match: the Gold Star (break it to earn your super)
// and the Show & Tell box (opens into a helper). The helpers themselves are
// registered by helpers.js.

import { Entity } from './entities.js';
import { clamp, TAU, lerp } from '../core/util.js';
import { OUT, star, starPath, fs, rrect, txt, circle, lighten, polygon, rr } from '../core/gfx.js';
import { groundBelow } from './physics.js';

export const HELPERS = [];           // filled in by helpers.js: {id, name, spawn(m, owner, x, y)}
export function registerHelper(h) { HELPERS.push(h); }

// ------------------------------------------------------------ gold star --
export class GoldStar extends Entity {
  constructor(m) {
    super();
    const c = m.stage.cam;
    this.m = m;
    this.x = m.rng.range(c.l * 0.5, c.r * 0.5); this.y = c.t + 40;
    this.vx = m.rng.sign() * 2; this.vy = 2;
    this.hp = 34; this.life = 60 * 26; this.flash = 0; this.camera = false;
    this.wp = this.pickWaypoint();
    this.rot = 0; this.leaving = false;
    m.sfx('star_appear');
    m.announce('GOLD STAR!', { life: 70, size: 40, y: 110, color: '#ffd92e', font: 'chewy' });
  }
  pickWaypoint() {
    const st = this.m.stage, c = st.cam, r = this.m.rng;
    return [r.range(c.l * 0.62, c.r * 0.62), r.range(Math.max(c.t * 0.6, -330), -70)];
  }
  update(m) {
    this.t++;
    if (this.flash > 0) this.flash--;
    if (this.t > this.life) this.leaving = true;
    if (this.leaving) {
      this.vy -= 0.4; this.y += this.vy; this.x += this.vx;
      if (this.y < m.stage.blast.t - 80) { this.dead = true; m.items.star = null; m.items.starT = 60 * m.rng.range(25, 40); }
      return;
    }
    const dx = this.wp[0] - this.x, dy = this.wp[1] - this.y, d = Math.hypot(dx, dy) || 1;
    if (d < 40 || this.t % 200 === 0) this.wp = this.pickWaypoint();
    this.vx += (dx / d) * 0.11; this.vy += (dy / d) * 0.11;
    const sp = Math.hypot(this.vx, this.vy), max = 3.6;
    if (sp > max) { this.vx *= 0.96; this.vy *= 0.96; }
    this.x += this.vx; this.y += this.vy + Math.sin(this.t * 0.12) * 0.5;
    this.rot = Math.sin(this.t * 0.07) * 0.3 + this.vx * 0.04;
    if (this.t % 5 === 0) m.fx.spark(this.x + m.rng.range(-14, 14), this.y + m.rng.range(-14, 14), 1, '#fff3a0');
  }
  hurt() { return this.leaving ? [] : [{ x: this.x - 21, y: this.y - 21, w: 42, h: 42 }]; }
  onHurt(m, by, hb, dmg, dir) {
    this.hp -= Math.max(2, dmg);
    this.flash = 6;
    const a = (hb.ang === undefined || hb.ang === 361 ? 40 : hb.ang) * Math.PI / 180;
    const p = clamp(3 + dmg * 0.5, 3, 11);
    this.vx = Math.cos(a) * p * dir; this.vy = -Math.sin(a) * p;
    m.fx.hit(this.x, this.y, 'punch', 0.5); m.sfx('star_hit');
    if (this.hp <= 0) {
      this.dead = true; m.items.star = null;
      m.fx.burst(this.x, this.y, 60, '#ffd92e'); m.fx.stars(this.x, this.y, 10); m.shake(8);
      if (by && !by.out && by.state !== 'dead') {
        by.superReady = true; by.flash = 14; by.flashColor = '#fff3a0';
        m.sfx('star_get'); m.fx.word(by.x, by.y - by.h - 30, 'GOLD STAR!', { color: '#ffd92e', size: 26, life: 60 });
        by.hook('onStar');
      } else m.items.starT = 60 * 14;
    }
  }
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    const s = 1 + Math.sin(this.t * 0.2) * 0.06;
    ctx.scale(s, s);
    // glow
    ctx.globalAlpha = 0.35; circle(ctx, 0, 0, 30 + Math.sin(this.t * 0.25) * 3, '#fff6b8', null, 0); ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, -24, 0, 24);
    g.addColorStop(0, this.flash ? '#ffffff' : '#fff27a'); g.addColorStop(1, this.flash ? '#ffffff' : '#ffab12');
    starPath(ctx, 0, 0, 24, 11, 5); fs(ctx, g, OUT, 3.2);
    starPath(ctx, 0, 0, 15, 7, 5); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.stroke();
    // foil glint
    ctx.beginPath(); ctx.ellipse(-6, -8, 5, 2.2, -0.7, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    ctx.restore();
  }
}

// ----------------------------------------------------- show & tell box --
export class ShowTellBox extends Entity {
  constructor(m) {
    super();
    const st = m.stage, c = st.cam, r = m.rng;
    this.m = m; this.layer = 'back';
    this.x = r.range(c.l * 0.5, c.r * 0.5); this.y = c.t - 30; this.vy = 0;
    this.grounded = false; this.life = 60 * 20; this.w = 30; this.h = 26;
    this.ground = null;
  }
  update(m) {
    this.t++;
    if (!this.grounded) {
      this.vy = Math.min(7, this.vy + 0.3); const py = this.y; this.y += this.vy;
      const g = groundBelow(m.stage, this.x, py, this.vy + 2);
      if (g && this.y >= g.y) { this.y = g.y; this.grounded = true; this.ground = g; m.fx.dust(this.x, this.y, 3); m.sfx('box_land'); }
      if (this.y > m.stage.blast.b) this.dead = true;
    } else {
      const g = this.ground;
      if (!g.on || this.x < g.x || this.x > g.x + g.w) { this.grounded = false; this.ground = null; }
      else { this.x += (g.vx || 0) + (g.conv || 0); this.y = g.y; }
      for (const f of m.fighters) {
        if (f.out || f.state === 'dead' || f.state === 'respawn' || !f.grounded) continue;
        if (Math.abs(f.x - this.x) < f.w / 2 + 18 && Math.abs(f.y - this.y) < 24) { this.open(m, f); return; }
      }
    }
    if (this.t > this.life) { this.dead = true; m.fx.puff(this.x, this.y - 12, 5); }
  }
  open(m, f) {
    this.dead = true;
    m.fx.burst(this.x, this.y - 14, 44, '#ffffff'); m.fx.confetti(this.x, this.y - 14, 14); m.sfx('box_open');
    if (!HELPERS.length) return;
    const pool = HELPERS.filter((h) => !h.stage || h.stage === m.stage.def.id);
    const h = m.rng.pick(pool.length ? pool : HELPERS);
    m.fx.word(this.x, this.y - 60, h.name, { color: '#ffffff', size: 24, life: 70, font: 'chewy' });
    h.spawn(m, f, this.x, this.y);
  }
  draw(ctx, m) {
    const blink = this.t > this.life - 120 && this.t % 10 < 5;
    if (blink) return;
    ctx.save(); ctx.translate(this.x, this.y);
    const bob = this.grounded ? 0 : Math.sin(this.t * 0.3) * 0.1;
    ctx.rotate(bob);
    // a shoebox with a question mark: everybody's show-and-tell
    rrect(ctx, -17, -24, 34, 24, 3, '#d9a25e', OUT, 2.6);
    rrect(ctx, -19, -29, 38, 8, 2, '#f0c078', OUT, 2.6);
    ctx.fillStyle = '#b97b3c'; ctx.fillRect(-15, -6, 30, 4);
    txt(ctx, '?', 0, -11, { font: 'titan', size: 18, fill: '#ffffff', lw: 4 });
    ctx.restore();
  }
}

// --------------------------------------------------------------- director --
export class ItemDirector {
  constructor(m) {
    this.m = m; this.star = null;
    this.starT = 60 * m.rng.range(20, 30);
    this.boxT = 60 * m.rng.range(13, 20);
  }
  starLost() { this.starT = Math.min(this.starT, 60 * 10); }
  update() {
    const m = this.m;
    if (!m.rules.items) return;
    if (!this.star && !m.fighters.some((f) => f.superReady || f.superActive)) {
      if (--this.starT <= 0) { this.star = m.spawn(new GoldStar(m)); this.starT = 60 * m.rng.range(34, 52); }
    }
    if (--this.boxT <= 0) {
      this.boxT = 60 * m.rng.range(18, 30);
      if (HELPERS.length && m.entities.filter((e) => e instanceof ShowTellBox).length < 1) m.spawn(new ShowTellBox(m));
    }
  }
}
