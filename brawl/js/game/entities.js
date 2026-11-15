// Things in the world that aren't fighters: projectiles and generic actors.

import { pointInSolid } from './physics.js';

let _eid = 1;

// Anything spawned into a match extends (or imitates) this.
export class Entity {
  constructor(o = {}) {
    this.id = 'e' + _eid++;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.t = 0; this.dead = false; this.layer = 'front';
    this.owner = null;       // the fighter responsible (for KO credit), or null for hazards
    this.hit = null;         // hit spec while it can hurt things
    this.hitLog = new Map();
    Object.assign(this, o);
  }
  update(m) { this.t++; }
  draw(ctx, m) {}
  hitShapes() { return null; }
}

// A flying hitbox with a picture.
//   new Projectile(m, { owner, x, y, vx, vy, g, r, life, hit:{dmg,ang,bk,kg,...},
//                       stage:'die'|'bounce'|'pass'|'stop', bounces, pierce, drawFn, tick, onDie })
export class Projectile extends Entity {
  constructor(m, o) {
    super();
    this.g = 0; this.r = 8; this.life = 90; this.stage = 'die'; this.bounces = 0; this.rest = 0.65;
    this.pierce = false; this.spin = 0; this.rot = 0; this.reflectable = true; this.stopped = false;
    this.kind = 'proj';
    Object.assign(this, o);
    this.hit = Object.assign({ dmg: 5, ang: 361, bk: 12, kg: 40, fx: 'punch' }, o.hit);
    this.team = this.owner ? this.owner.team : -1;
    this.facing = this.vx >= 0 ? 1 : -1;
  }
  update(m) {
    this.t++;
    if (this.t > this.life) { this.die(m); return; }
    if (this.tick) { this.tick(this, m); if (this.dead) return; }
    if (this.stopped) return;
    const px = this.x, py = this.y;
    this.vy += this.g;
    this.x += this.vx; this.y += this.vy; this.rot += this.spin;
    if (Math.abs(this.vx) > 0.3) this.facing = this.vx > 0 ? 1 : -1;
    const st = m.stage, b = st.blast;
    if (this.x < b.l - 60 || this.x > b.r + 60 || this.y > b.b + 60 || this.y < b.t - 300) { this.dead = true; return; }
    if (this.stage === 'pass') return;
    let hitSurf = pointInSolid(st, this.x, this.y), soft = false;
    if (!hitSurf && this.vy > 0 && this.g > 0) {
      for (const p of st.plats) {
        if (p.on && this.x >= p.x && this.x <= p.x + p.w && py <= p.y && this.y >= p.y) { hitSurf = p; soft = true; break; }
      }
    }
    if (!hitSurf) return;
    if (this.onLand && this.onLand(this, m, hitSurf) === true) return;
    if (this.stage === 'bounce' && this.bounces > 0) {
      this.bounces--;
      // work out which face we came through from where we were last frame
      const s = hitSurf;
      if (soft || py <= s.y) { this.y = s.y - 0.5; this.vy = -Math.abs(this.vy) * this.rest; }
      else if (py >= s.y + s.h) { this.y = s.y + s.h + 0.5; this.vy = Math.abs(this.vy) * this.rest; }
      else { this.x = px; this.vx = -this.vx * this.rest; }
      if (this.onBounce) this.onBounce(this, m);
    } else if (this.stage === 'stop') {
      this.stopped = true; this.vx = this.vy = 0; this.spin = 0;
      if (soft || py <= hitSurf.y) this.y = hitSurf.y;
    } else this.die(m);
  }
  hitShapes() { return this.hit ? [{ x: this.x, y: this.y, r: this.r }] : null; }
  onHit(target, res, m) {
    if (this.onHitFn) this.onHitFn(this, target, res, m);
    if (!this.pierce || res === 'shield') this.die(m);
  }
  die(m) {
    if (this.dead) return;
    this.dead = true;
    if (this.onDie) this.onDie(this, m);
  }
  draw(ctx, m) { if (this.drawFn) this.drawFn(ctx, this, m); }
}
