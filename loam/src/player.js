// The body in the world: axis-swept AABB physics against the voxel grid,
// walking/sprinting/sneaking/swimming/flying, plus the survival ledger —
// health, hunger, breath, fall distance. Pure simulation; main.js wires input.
import { B } from './blocks.js';
import { SOLID, FLUID, WORLD_H } from './world.js';

const GRAV = 28, JUMP = 8.6, EPS = 0.001;

export class Player {
  constructor(world, mode = 'survival') {
    this.world = world;
    this.mode = mode;
    this.pos = { x: 0.5, y: 70, z: 0.5 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.w = 0.3;          // half-width
    this.h = 1.8; this.eye = 1.62;
    this.onGround = false;
    this.flying = mode === 'creative';
    this.inWater = false; this.inLava = false; this.headInWater = false;
    this.hp = 20; this.hunger = 20; this.air = 10;
    this.dead = false;
    this.spawn = null;
    this.fallFrom = null;
    this._exhaust = 0; this._regenT = 0; this._starveT = 0; this._drownT = 0;
    this._lavaT = 0; this._cactusT = 0; this._hurtT = 0;
    this.onHurt = null; this.onDie = null; this.onStat = null;
    this.walkCycle = 0;    // drives view bob + footstep timing
  }

  look() {
    const cp = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cp,
    };
  }

  eyePos() { return { x: this.pos.x, y: this.pos.y + this.eye, z: this.pos.z }; }

  box(pos = this.pos) {
    return {
      x0: pos.x - this.w, x1: pos.x + this.w,
      y0: pos.y, y1: pos.y + this.h,
      z0: pos.z - this.w, z1: pos.z + this.w,
    };
  }

  _overlaps(test) {
    const b = this.box();
    for (let y = Math.floor(b.y0); y <= Math.floor(b.y1); y++) {
      for (let z = Math.floor(b.z0); z <= Math.floor(b.z1); z++) {
        for (let x = Math.floor(b.x0); x <= Math.floor(b.x1); x++) {
          if (test(this.world.block(x, y, z), x, y, z)) return true;
        }
      }
    }
    return false;
  }

  update(dt, input) {
    if (this.dead) return;
    const w = this.world;

    // medium checks
    const head = w.block(Math.floor(this.pos.x), Math.floor(this.pos.y + this.eye), Math.floor(this.pos.z));
    this.headInWater = head === B.water;
    this.inWater = this._overlaps((id) => id === B.water);
    this.inLava = this._overlaps((id) => id === B.lava);
    const liquid = this.inWater || this.inLava;
    if (liquid) this.flying = this.mode === 'creative' && this.flying;

    // wish direction in the horizontal plane
    let fx = 0, fz = 0;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    if (input.fwd) { fx -= sin; fz -= cos; }
    if (input.back) { fx += sin; fz += cos; }
    if (input.left) { fx -= cos; fz += sin; }
    if (input.right) { fx += cos; fz -= sin; }
    const mag = Math.hypot(fx, fz) || 1;
    fx /= mag; fz /= mag;

    const sprinting = input.sprint && input.fwd && (this.mode === 'creative' || this.hunger > 6) && !input.sneak;
    let speed = sprinting ? 5.6 : input.sneak && !this.flying ? 1.4 : 4.3;
    if (this.flying) speed = sprinting ? 22 : 11;
    else if (this.inLava) speed *= 0.45;
    else if (this.inWater) speed *= 0.65;
    this.sprinting = sprinting;

    if (this.flying) {
      const accel = 10 * dt;
      this.vel.x += (fx * speed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (fz * speed - this.vel.z) * Math.min(1, accel);
      const vy = input.jump ? speed * 0.8 : input.sneak ? -speed * 0.8 : 0;
      this.vel.y += (vy - this.vel.y) * Math.min(1, 12 * dt);
    } else if (liquid) {
      const accel = 6 * dt;
      this.vel.x += (fx * speed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (fz * speed - this.vel.z) * Math.min(1, accel);
      this.vel.y -= (this.inLava ? 6 : 5) * dt;
      this.vel.y *= 1 - (this.inLava ? 2.6 : 1.9) * dt;
      if (input.jump) this.vel.y += (this.inLava ? 9 : 11) * dt;
      this.vel.y = Math.max(this.vel.y, this.inLava ? -1.6 : -2.6);
      this.fallFrom = null;
    } else {
      const accel = (this.onGround ? 11 : 2.2) * dt;
      this.vel.x += (fx * speed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (fz * speed - this.vel.z) * Math.min(1, accel);
      this.vel.y -= GRAV * dt;
      this.vel.y = Math.max(this.vel.y, -42);
      if (input.jump && this.onGround) {
        this.vel.y = JUMP;
        this.onGround = false;
        if (this.mode === 'survival') this._exhaust += sprinting ? 0.25 : 0.1;
      }
    }

    // falling ledger
    if (!this.flying && !liquid) {
      if (this.vel.y < 0 && this.fallFrom === null) this.fallFrom = this.pos.y;
      if (this.vel.y >= 0 && !this.onGround && this.fallFrom !== null && this.vel.y > 0.1) this.fallFrom = Math.max(this.fallFrom, this.pos.y);
    } else this.fallFrom = null;

    this._move(dt, input.sneak && !this.flying);

    // movement bookkeeping
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hSpeed > 0.5) this.walkCycle += hSpeed * dt;
    if (this.mode === 'survival' && sprinting && hSpeed > 1) this._exhaust += dt * 0.12;

    if (this.mode === 'survival') this._survivalTick(dt);
    this._hurtT = Math.max(0, this._hurtT - dt);
  }

  _move(dt, sneaking) {
    const d = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    const wasGround = this.onGround;
    this.onGround = false;

    for (const axis of ['y', 'x', 'z']) {
      if (d[axis] === 0) continue; // no motion → nothing to resolve (and never eject an embedded body)
      const before = this.pos[axis];
      this.pos[axis] += d[axis];
      const b = this.box();
      const x0 = Math.floor(b.x0), x1 = Math.floor(b.x1);
      const y0 = Math.floor(b.y0), y1 = Math.floor(b.y1);
      const z0 = Math.floor(b.z0), z1 = Math.floor(b.z1);
      let hit = false;
      for (let y = y0; y <= y1 && !hit; y++) {
        for (let z = z0; z <= z1 && !hit; z++) {
          for (let x = x0; x <= x1 && !hit; x++) {
            if (!SOLID[this.world.block(x, y, z)]) continue;
            hit = true;
            if (axis === 'y') {
              if (d.y < 0) {
                this.pos.y = y + 1 + EPS;
                this.onGround = true;
                this._land();
              } else this.pos.y = y - this.h - EPS;
              this.vel.y = 0;
            } else if (axis === 'x') {
              this.pos.x = d.x > 0 ? x - this.w - EPS : x + 1 + this.w + EPS;
              this.vel.x = 0;
            } else {
              this.pos.z = d.z > 0 ? z - this.w - EPS : z + 1 + this.w + EPS;
              this.vel.z = 0;
            }
          }
        }
      }
      // sneaking won't let you shuffle off an edge
      if (sneaking && wasGround && (axis === 'x' || axis === 'z') && !this._groundBelow()) {
        this.pos[axis] = before;
        this.vel[axis] = 0;
      }
    }
    if (this.pos.y < -8) this.damage(100, 'void'); // fell out of the world somehow
  }

  _groundBelow() {
    const b = this.box();
    const y = Math.floor(b.y0 - 0.06);
    for (let z = Math.floor(b.z0); z <= Math.floor(b.z1); z++) {
      for (let x = Math.floor(b.x0); x <= Math.floor(b.x1); x++) {
        if (SOLID[this.world.block(x, y, z)]) return true;
      }
    }
    return false;
  }

  _land() {
    if (this.fallFrom !== null && this.mode === 'survival') {
      const dist = this.fallFrom - this.pos.y;
      if (dist > 3.5) this.damage(Math.floor(dist - 3), 'fall');
    }
    this.fallFrom = null;
  }

  _survivalTick(dt) {
    // exhaustion → hunger
    while (this._exhaust >= 4) { this._exhaust -= 4; this._setHunger(this.hunger - 1); }
    // slow ambient appetite
    this._exhaust += dt * 0.012;

    if (this.hunger >= 18 && this.hp < 20) {
      this._regenT += dt;
      if (this._regenT > 3) { this._regenT = 0; this._setHp(this.hp + 1); this._exhaust += 1.2; }
    } else this._regenT = 0;

    if (this.hunger <= 0) {
      this._starveT += dt;
      if (this._starveT > 4) { this._starveT = 0; if (this.hp > 2) this.damage(1, 'starve'); }
    } else this._starveT = 0;

    if (this.headInWater) {
      this.air -= dt;
      if (this.air <= 0) {
        this._drownT += dt;
        if (this._drownT > 1) { this._drownT = 0; this.damage(2, 'drown'); }
      }
    } else { this.air = Math.min(10, this.air + dt * 4); this._drownT = 0; }

    if (this.inLava) {
      this._lavaT += dt;
      if (this._lavaT > 0.5) { this._lavaT = 0; this.damage(4, 'lava'); }
    } else this._lavaT = 0;

    // brushing a cactus stings
    this._cactusT += dt;
    if (this._cactusT > 0.8) {
      this._cactusT = 0;
      const b = this.box();
      const grown = { ...b, x0: b.x0 - 0.08, x1: b.x1 + 0.08, z0: b.z0 - 0.08, z1: b.z1 + 0.08 };
      outer: for (let y = Math.floor(grown.y0); y <= Math.floor(grown.y1); y++) {
        for (let z = Math.floor(grown.z0); z <= Math.floor(grown.z1); z++) {
          for (let x = Math.floor(grown.x0); x <= Math.floor(grown.x1); x++) {
            if (this.world.block(x, y, z) === B.cactus) { this.damage(1, 'cactus'); break outer; }
          }
        }
      }
    }
  }

  _setHp(v) { this.hp = Math.max(0, Math.min(20, v)); this.onStat?.(); }
  _setHunger(v) { this.hunger = Math.max(0, Math.min(20, v)); this.onStat?.(); }

  damage(n, cause = 'hit', knock = null) {
    if (this.mode === 'creative' || this.dead || n <= 0) return;
    if (this._hurtT > 0 && cause === 'hit') return;
    this._hurtT = 0.5;
    this._setHp(this.hp - n);
    if (knock) {
      this.vel.x += knock.x; this.vel.z += knock.z; this.vel.y = Math.max(this.vel.y, 4.5);
    }
    this.onHurt?.(n, cause);
    if (this.hp <= 0) { this.dead = true; this.onDie?.(cause); }
  }

  eat(food) {
    if (this.hunger >= 20) return false;
    this._setHunger(this.hunger + food);
    return true;
  }

  noteMining(dt) { if (this.mode === 'survival') this._exhaust += dt * 0.08; }
  noteAttack() { if (this.mode === 'survival') this._exhaust += 0.3; }

  respawn() {
    const s = this.spawn || { x: 0.5, y: 70, z: 0.5 };
    this.pos = { ...s };
    this.vel = { x: 0, y: 0, z: 0 };
    this.hp = 20; this.hunger = 20; this.air = 10;
    this.dead = false; this.fallFrom = null;
    this._exhaust = 0;
    this.onStat?.();
  }
}

// Amanatides & Woo voxel walk. Targets anything mineable (solid or cross).
export function raycast(world, origin, dir, maxDist = 4.5) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const dx = Math.abs(dir.x) < 1e-9 ? 1e9 : 1 / Math.abs(dir.x);
  const dy = Math.abs(dir.y) < 1e-9 ? 1e9 : 1 / Math.abs(dir.y);
  const dz = Math.abs(dir.z) < 1e-9 ? 1e9 : 1 / Math.abs(dir.z);
  let tx = (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * dx;
  let ty = (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * dy;
  let tz = (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * dz;
  let face = [0, 0, 0], t = 0;
  for (let i = 0; i < 256; i++) {
    const id = world.block(x, y, z);
    if (id !== B.air && !FLUID[id] && t <= maxDist) {
      return { x, y, z, id, face: [...face], dist: t };
    }
    if (tx < ty && tx < tz) { x += stepX; t = tx; tx += dx; face = [-stepX, 0, 0]; }
    else if (ty < tz) { y += stepY; t = ty; ty += dy; face = [0, -stepY, 0]; }
    else { z += stepZ; t = tz; tz += dz; face = [0, 0, -stepZ]; }
    if (t > maxDist) return null;
  }
  return null;
}
