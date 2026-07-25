// The body holding the camera: swept-AABB movement against the cell grid,
// stairs and pool lips it can climb, water it can wade and swim, stamina it can
// run out of, and a noise value that is the single most important number in the
// game — half the bestiary hunts by it.

import { clamp, clamp01, damp } from './util.js';
import { C, WET } from './kit.js';

const GRAV = 22;
const EPS = 0.0015;

export class Player {
  constructor(world, opts = {}) {
    this.world = world;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.3;
    this.standH = 1.78;
    this.crouchH = 1.02;
    this.h = this.standH;
    this.eyeOff = -0.16;          // eye sits just under the top of the head
    this.onGround = false;
    this.crouching = false;
    this.sprinting = false;
    this.stamina = 100;
    this.breath = 100;            // underwater
    this.noise = 0;               // 0..1, decays; entities listen to this
    this.walkCycle = 0;
    this.bob = 0;
    this.sway = 0;
    this.lastStep = 0;
    this.fallFrom = null;
    this.submerged = false;
    this.waist = 0;               // how deep the water is right now
    this.swimming = false;
    this.speedScale = 1;
    this.mods = null;              // run modifiers from the lift shop
    this.hidden = false;
    this.hideSpot = null;
    this.hideT = 0;                // how long we have been in cover
    this.hideJustEntered = false;   // true for a moment after getting in
    this.hideBreath = 100;          // holding still is not free
    this.onFootstep = opts.onFootstep || null;
    this.onSplash = opts.onSplash || null;
    this.onLand = opts.onLand || null;
    this.onFall = opts.onFall || null;
    this.cold = false;
  }

  spawn(x, z, yaw = 0) {
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = this.world.floorAtWorld(x, z) + 0.05;
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = yaw;
    this.pitch = 0;
    this.onGround = true;
    this.fallFrom = null;
  }

  eye() { return { x: this.pos.x, y: this.pos.y + this.h + this.eyeOff + this.bob, z: this.pos.z }; }

  look() {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  // ---------------------------------------------------------------- collision
  // Solid at (x,z) for a body whose feet are at footY.
  _blocked(x, z, footY) {
    const w = this.world;
    const [cx, cz] = w.toCell(x, z);
    const code = w.code(cx, cz);
    if (code === C.HALF) return footY < w.cellFloor(cx, cz) + 1.15 - 0.05;
    if (!w.isOpenCell(cx, cz)) return true;
    // a step you cannot climb is a wall
    const step = w.cellFloor(cx, cz) - footY;
    if (step > 0.72 && !WET.has(w.codeAtWorld(this.pos.x, this.pos.z))) return true;
    // low ceilings while standing
    if (w.cellCeil(cx, cz) - w.cellFloor(cx, cz) < this.h * 0.72) return true;
    for (const c of w.colliders) {
      if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
      const base = w.floorAtWorld(x, z);
      if (footY + 0.5 > base + c.y0 && footY < base + c.y1) return true;
    }
    return false;
  }

  _sweep(dx, dz) {
    const r = this.radius;
    const probe = (x, z) => (
      this._blocked(x + r, z, this.pos.y) || this._blocked(x - r, z, this.pos.y)
      || this._blocked(x, z + r, this.pos.y) || this._blocked(x, z - r, this.pos.y)
      || this._blocked(x + r * 0.7, z + r * 0.7, this.pos.y) || this._blocked(x - r * 0.7, z - r * 0.7, this.pos.y)
      || this._blocked(x + r * 0.7, z - r * 0.7, this.pos.y) || this._blocked(x - r * 0.7, z + r * 0.7, this.pos.y)
    );
    // axis by axis, so sliding along a wall works instead of stopping dead
    if (!probe(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    else {
      for (const f of [0.5, 0.25]) if (!probe(this.pos.x + dx * f, this.pos.z)) { this.pos.x += dx * f; break; }
    }
    if (!probe(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
    else {
      for (const f of [0.5, 0.25]) if (!probe(this.pos.x, this.pos.z + dz * f)) { this.pos.z += dz * f; break; }
    }
  }

  // ---------------------------------------------------------------- update
  update(dt, input, rules = {}) {
    const w = this.world;

    // ---- medium
    const depth = w.waterDepthAt(this.pos.x, this.pos.z);
    const floorY = w.floorAtWorld(this.pos.x, this.pos.z);
    const surf = w.waterY ?? 0;
    this.waist = depth > 0 ? clamp(surf - this.pos.y, 0, 3) : 0;
    const deep = w.isDeepAt(this.pos.x, this.pos.z) && this.waist > 1.1;
    this.swimming = deep;
    this.submerged = this.waist > this.h * 0.92;

    // ---- crouch (also forced by a low ceiling)
    const [cx, cz] = w.toCell(this.pos.x, this.pos.z);
    const headroom = w.cellCeil(cx, cz) - w.cellFloor(cx, cz);
    const wantCrouch = input.crouch || headroom < this.standH * 1.02;
    this.crouching = wantCrouch;
    this.h = damp(this.h, wantCrouch ? this.crouchH : this.standH, 12, dt);

    // ---- wish direction
    let fx = 0, fz = 0;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    if (input.fwd) { fx -= sin; fz -= cos; }
    if (input.back) { fx += sin; fz += cos; }
    if (input.left) { fx -= cos; fz += sin; }
    if (input.right) { fx += cos; fz -= sin; }
    const mag = Math.hypot(fx, fz);
    if (mag > 0) { fx /= mag; fz /= mag; }

    // ---- speed and stamina
    const wantSprint = input.sprint && mag > 0 && !wantCrouch && this.stamina > 1 && !this.swimming;
    this.sprinting = wantSprint;
    const mod = this.mods || {};
    let speed = (wantCrouch ? 1.25 : wantSprint ? 5.1 : 2.85) * (mod.speed ?? 1);
    if (this.swimming) speed = 2.1 * (rules.swimSpeed ?? 1);
    else if (this.waist > 0.35) speed *= 1 - clamp01(this.waist / 1.6) * 0.45;
    if (rules.cold) speed *= 0.88;
    speed *= this.speedScale;
    const drain = ((wantSprint ? 16 : 0) + (rules.cold ? 3.5 : 0) + (this.swimming ? 7 : 0))
      / (mod.stamina ?? 1);
    this.stamina = clamp(this.stamina - drain * dt + (wantSprint || this.swimming ? 0 : 10 * dt), 0, 100);

    // ---- integrate
    if (this.swimming) {
      const accel = 5 * dt;
      this.vel.x += (fx * speed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (fz * speed - this.vel.z) * Math.min(1, accel);
      // tread water: sink slowly, rise while holding jump/up
      const want = input.jump ? 1.4 : input.crouch ? -1.6 : (surf - 0.55 - this.pos.y) * 1.6;
      this.vel.y = damp(this.vel.y, want, 4, dt);
      const lung = mod.breath ?? 1;
      this.breath = this.submerged
        ? clamp(this.breath - (12 / lung) * dt, 0, 100)
        : clamp(this.breath + 22 * dt, 0, 100);
      this.onGround = false;
      this.fallFrom = null;
    } else {
      const accel = (this.onGround ? 13 : 3) * dt;
      this.vel.x += (fx * speed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (fz * speed - this.vel.z) * Math.min(1, accel);
      this.vel.y -= GRAV * dt;
      if (input.jump && this.onGround && !wantCrouch && this.stamina > 8) {
        this.vel.y = 4.4;
        this.onGround = false;
        this.stamina -= 8;
        this.noise = Math.max(this.noise, 0.5);
      }
      this.breath = clamp(this.breath + 30 * dt, 0, 100);
    }

    this._sweep(this.vel.x * dt, this.vel.z * dt);
    this.pos.y += this.vel.y * dt;

    // ---- ground / step-up
    const ground = w.floorAtWorld(this.pos.x, this.pos.z);
    if (!this.swimming) {
      if (this.pos.y <= ground + EPS) {
        if (!this.onGround) {
          const drop = this.fallFrom !== null ? this.fallFrom - ground : 0;
          // water catches you: the poolrooms and the flooded floors are meant to be
          // jumped into, and a route down into deep water is a route
          const intoWater = WET.has(w.codeAtWorld(this.pos.x, this.pos.z));
          if (drop > 3.2 && !intoWater && rules.fallDamage !== false) this.onFall?.(drop);
          else if (drop > 0.8) this.onLand?.(drop);
          this.noise = Math.max(this.noise, clamp01(drop / 4) * 0.7);
        }
        this.pos.y = ground;
        this.vel.y = 0;
        this.onGround = true;
        this.fallFrom = null;
      } else {
        this.onGround = false;
        this.fallFrom = Math.max(this.fallFrom ?? this.pos.y, this.pos.y);
      }
    }

    // ---- footsteps, bob, noise
    const planar = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround || this.swimming) {
      this.walkCycle += planar * dt * (wantSprint ? 2.3 : 1.9);
      const stepEvery = wantCrouch ? 2.6 : wantSprint ? 1.35 : 1.9;
      if (this.walkCycle - this.lastStep > stepEvery && planar > 0.6) {
        this.lastStep = this.walkCycle;
        const wet = this.waist > 0.12 || rules.wetFeet;
        const mat = wet ? 'water' : this.world.data.matF[this.world.idx(cx, cz)] || 'carpet';
        this.onFootstep?.(mat, wantSprint ? 1 : wantCrouch ? 0.25 : 0.6);
        if (wet) this.onSplash?.(planar / 5);
      }
    }
    const bobAmt = wantCrouch ? 0.012 : wantSprint ? 0.055 : 0.03;
    this.bob = Math.sin(this.walkCycle * Math.PI) * bobAmt * clamp01(planar / 3);
    this.sway = Math.sin(this.walkCycle * Math.PI * 0.5) * 0.012 * clamp01(planar / 3);

    // noise: sprinting in water is the loudest thing you can do down here
    const made = (planar / 5.2) * (wantSprint ? 1 : wantCrouch ? 0.18 : 0.5)
      * (this.waist > 0.2 ? 1.5 : 1) * (mod.noise ?? 1);
    this.noise = Math.max(damp(this.noise, 0, 1.6, dt), Math.min(1, made));

    return { depth, floorY, ground };
  }

  // ---------------------------------------------------------------- hiding
  // In cover you cannot move and you cannot see much, and nothing can see you
  // either — unless it watched you climb in.
  enterHide(spot) {
    if (this.hidden) return;
    this.hidden = true;
    this.hideSpot = spot;
    this.hideT = 0;
    this.hideJustEntered = true;
    this.hideBreath = 100;
    this.vel.x = this.vel.z = 0;
    this.noise = Math.min(this.noise, 0.2);
  }

  leaveHide() {
    if (!this.hidden) return;
    this.hidden = false;
    this.hideSpot = null;
    this.hideJustEntered = false;
  }

  updateHide(dt, mods = {}) {
    if (!this.hidden) return;
    this.hideT += dt;
    // the window in which the monster can have seen you get in
    if (this.hideT > 1.6 / (mods.hideSpeed ?? 1)) this.hideJustEntered = false;
    // holding still is fine; holding your breath while it stands there is not
    const near = this.hideThreat ?? 0;
    this.hideBreath = clamp(
      this.hideBreath - near * (9 / (mods.breath ?? 1)) * dt + (near < 0.2 ? 14 * dt : 0),
      0, 100,
    );
    this.noise = Math.max(0, this.noise - dt * 2);
  }

  turn(dx, dy, sens = 1) {
    this.yaw -= dx * 0.0024 * sens;
    this.pitch = clamp(this.pitch - dy * 0.0024 * sens, -1.35, 1.35);
  }
}
