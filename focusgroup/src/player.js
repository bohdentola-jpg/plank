// FOCUS GROUP — you.
//
// Not much of a controller, because you are not much of an action hero: you
// walk around a flat you already live in. There is no jump, no crouch, no
// stamina and nothing to fight. The only mechanical thing that ever changes is
// whose eyes you are using, and that is handled elsewhere.
//
// One thing here matters more than it looks: `bodyRelative`. When the game
// cuts to a hidden camera you keep walking the way your body is pointing, not
// the way the picture is pointing, which is how tank controls work and how
// being filmed feels.

import { clamp, clamp01, damp } from './util.js';

export class Player {
  constructor(opts = {}) {
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;

    this.radius = 0.28;
    this.standH = 1.68;         // eye height, which is also how tall the flat feels
    this.h = this.standH;

    this.walkCycle = 0;
    this.lastStep = 0;
    this.bob = 0;
    this.sway = 0;
    this.speed = 0;             // metres a second, smoothed, for the animator

    this.onFootstep = opts.onFootstep || null;
    this.frozen = false;        // during a cutscene you are furniture
    this.lookLocked = false;

    this.sens = 1;
    this.invertY = false;
  }

  spawn(x, z, yaw = 0) {
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = 0;
    this.vel.x = this.vel.z = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.walkCycle = 0;
    this.speed = 0;
  }

  eye() {
    return { x: this.pos.x, y: this.pos.y + this.h + this.bob, z: this.pos.z };
  }

  /** Unit vector the head is pointing along. */
  look() {
    const cp = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cp,
    };
  }

  turn(dx, dy) {
    if (this.lookLocked) return;
    this.yaw -= dx * 0.0022 * this.sens;
    this.pitch = clamp(this.pitch - (this.invertY ? -dy : dy) * 0.0022 * this.sens, -1.30, 1.30);
  }

  /**
   * @param {number} dt
   * @param {object} input { fwd, back, left, right, run } as 0/1
   * @param {World} world
   * @param {object} o { bodyRelative } — true while a hidden camera has the shot
   */
  update(dt, input, world, o = {}) {
    if (this.frozen) {
      this.speed = damp(this.speed, 0, 10, dt);
      this.bob = damp(this.bob, 0, 8, dt);
      return;
    }

    let fx = 0, fz = 0;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    if (input.fwd) { fx -= sin; fz -= cos; }
    if (input.back) { fx += sin; fz += cos; }
    if (input.left) { fx -= cos; fz += sin; }
    if (input.right) { fx += cos; fz -= sin; }

    const mag = Math.hypot(fx, fz);
    if (mag > 0.001) { fx /= mag; fz /= mag; }

    // You walk. Valco likes it when you hurry, which is reason enough not to.
    const want = (input.run ? 3.55 : 2.20) * (o.speedScale ?? 1);
    const target = mag > 0 ? want : 0;
    const accel = 1 - Math.exp(-11 * dt);
    this.vel.x += (fx * target - this.vel.x) * accel;
    this.vel.z += (fz * target - this.vel.z) * accel;

    world.move(this.pos, this.vel.x * dt, this.vel.z * dt, this.radius, this.h + 0.08);

    const planar = Math.hypot(this.vel.x, this.vel.z);
    this.speed = planar;

    // ---- footsteps, on whatever is under you
    this.walkCycle += planar * dt * (input.run ? 2.15 : 1.85);
    const every = input.run ? 1.35 : 1.85;
    if (this.walkCycle - this.lastStep > every && planar > 0.5) {
      this.lastStep = this.walkCycle;
      const room = world.floorMatAt(this.pos.x, this.pos.z);
      const mat = { carpet: 'carpet', lino: 'lino', tile: 'tile', concrete: 'concrete', stage: 'stage' }[room] || 'carpet';
      this.onFootstep?.(mat, input.run ? 0.9 : 0.55);
    }

    const amt = input.run ? 0.042 : 0.024;
    this.bob = Math.sin(this.walkCycle * Math.PI) * amt * clamp01(planar / 2.4);
    this.sway = Math.sin(this.walkCycle * Math.PI * 0.5) * 0.010 * clamp01(planar / 2.4);
  }

  /** Turn to face a point, over time. Used when the script needs you looking. */
  faceToward(x, z, dt, rate = 3.2) {
    let d = Math.atan2(-(x - this.pos.x), -(z - this.pos.z)) - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-rate * dt));
  }
}
