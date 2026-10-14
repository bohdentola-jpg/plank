// Race cameras: two chase distances, bumper, hood; look-back; speed FOV and
// shake; start-of-race orbit; finish orbit.
import * as THREE from 'three';
import { damp, clamp, lerp } from '../core/util.js';

export const CAM_MODES = [
  { name: 'CHASE FAR', dist: 6.6, height: 2.25, look: 1.2, fov: 62 },
  { name: 'CHASE', dist: 5.2, height: 1.75, look: 1.05, fov: 64 },
  { name: 'BUMPER', dist: -1.0, height: 0.75, look: 0.75, fov: 70, mounted: true },
  { name: 'HOOD', dist: -0.2, height: 1.15, look: 1.1, fov: 68, mounted: true },
];

export class ChaseCamera {
  constructor(aspect = 4 / 3) {
    this.cam = new THREE.PerspectiveCamera(64, aspect, 0.3, 3200);
    this.mode = 1;
    this.yaw = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = 0;
    this.kick = 0;
    this.time = 0;
    this.orbit = null; // {t, dur, center, radius} for intros/finish
    this.first = true;
  }

  setMode(m) { this.mode = ((m % CAM_MODES.length) + CAM_MODES.length) % CAM_MODES.length; this.first = true; }

  addShake(a) { this.shake = Math.min(1.5, this.shake + a); }

  /** car: {x,y,z,heading,speed,vF, nitroOn, airborne}, n: ground normal */
  update(dt, car, opts = {}) {
    this.time += dt;
    const M = CAM_MODES[this.mode];
    const cam = this.cam;
    const speed = Math.abs(car.vF ?? car.speed ?? 0);

    if (this.orbit) {
      const o = this.orbit;
      o.t += dt;
      const a = o.a0 + o.t * o.rate;
      const r = o.radius;
      cam.position.set(o.center.x + Math.sin(a) * r, o.center.y + o.h + Math.sin(o.t * 0.6) * 0.3, o.center.z + Math.cos(a) * r);
      cam.lookAt(o.center.x, o.center.y + 0.6, o.center.z);
      cam.fov = 50;
      cam.updateProjectionMatrix();
      if (o.t >= o.dur && o.dur > 0) this.orbit = null;
      this.first = true;
      return;
    }

    // yaw follows the car with lag (more lag in the far chase)
    let target = car.heading;
    if (opts.lookBack) target += Math.PI;
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const yawRate = M.mounted ? 30 : (opts.lookBack ? 30 : 5.5);
    if (this.first) this.yaw = target;
    else this.yaw += d * (1 - Math.exp(-yawRate * dt));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);

    const speedK = clamp(speed / 70, 0, 1);
    let dist = M.dist * (1 + speedK * 0.12);
    let height = M.height;
    if (opts.lookBack && !M.mounted) { dist = M.dist * 0.9; }
    const desired = new THREE.Vector3(car.x - fx * dist, car.y + height, car.z - fz * dist);
    const lookAt = new THREE.Vector3(car.x + fx * (M.mounted ? 20 : 4), car.y + M.look, car.z + fz * (M.mounted ? 20 : 4));
    if (M.mounted) {
      // rigidly attached, but keep the horizon from wobbling too much
      this.pos.copy(desired);
      this.look.copy(lookAt);
    } else if (this.first) {
      this.pos.copy(desired);
      this.look.copy(lookAt);
    } else {
      const k = 1 - Math.exp(-dt * 12);
      this.pos.lerp(desired, k);
      // vertical follows a bit softer (bumps, landings)
      this.pos.y = damp(this.pos.y, desired.y, 6, dt);
      this.look.lerp(lookAt, 1 - Math.exp(-dt * 18));
    }
    this.first = false;

    cam.position.copy(this.pos);
    // shake: speed rumble + impacts
    this.shake = damp(this.shake, 0, 3.5, dt);
    const sh = this.shake * 0.12 + (opts.rumble || 0) * 0.025 + speedK * speedK * 0.006 + (car.nitroOn ? 0.01 : 0);
    if (sh > 0.0005) {
      cam.position.x += (Math.sin(this.time * 61) + Math.sin(this.time * 37.3)) * sh;
      cam.position.y += (Math.sin(this.time * 53.7) + Math.cos(this.time * 29.1)) * sh * 0.7;
    }
    cam.lookAt(this.look);
    // FOV: speed + nitro kick
    this.kick = damp(this.kick, car.nitroOn ? 1 : 0, 3, dt);
    const fov = M.fov + speedK * 12 + this.kick * 9;
    cam.fov = damp(cam.fov, fov, 5, dt);
    cam.updateProjectionMatrix();
  }

  startOrbit(center, radius = 9, dur = 0, h = 2.2, rate = 0.35, a0 = 0) {
    this.orbit = { t: 0, dur, center: center.clone ? center.clone() : new THREE.Vector3(center.x, center.y, center.z), radius, h, rate, a0 };
  }
}

export { lerp };
