// Rybka on foot: camera-relative movement (walk / run / crouch), turning into
// the direction of travel, steps onto porches, sliding along walls; plus the
// third-person camera that orbits with the mouse / right stick and pulls in
// when something is behind you.
import * as THREE from 'three';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export class Player {
  constructor(ch, anim, world) {
    this.ch = ch;
    this.anim = anim;
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;          // facing (rad), 0 = +Z
    this.vy = 0;
    this.onGround = true;
    this.crouch = false;
    this.locked = false;   // cutscenes / menus
    this.speed = 0;
    this.radius = 0.3;
    this.indoors = false;
    this.moveIntent = 0;
  }

  place(x, z, yaw = 0, yHint) {
    this.pos.set(x, this.world.groundNear(x, z, yHint), z);
    this.yaw = yaw;
    this._sync(0);
  }

  update(dt, camYaw) {
    if (this.vehicle) { this.onSeat?.(this); return; }   // driving: the vehicle carries you
    let mx = 0, my = 0;
    if (!this.locked) { mx = input.move.x; my = input.move.y; }
    if (input.pressed('crouch') && !this.locked) this.crouch = !this.crouch;
    const mag = Math.min(1, Math.hypot(mx, my));
    this.moveIntent = mag;
    // Speeds (m/s): a brisk jog by default, a sprint on Shift / R2, a walk when
    // crouched or when the stick is only nudged. Indoors everything is gentler.
    const run = input.sprint && !this.crouch;
    const SPEED = this.indoors ? { walk: 1.4, jog: 2.2, run: 3.2, crouch: 1.0 } : { walk: 1.6, jog: 3.4, run: 5.8, crouch: 1.2 };
    let target = 0;
    if (mag >= 0.05) {
      if (this.crouch) target = SPEED.crouch * (input.keyboardMove ? 1 : Math.max(0.5, mag));
      else if (run) target = SPEED.run;
      else if (input.keyboardMove) target = SPEED.jog;
      else target = mag < 0.55 ? SPEED.walk * Math.max(0.45, mag / 0.55) : SPEED.walk + (SPEED.jog - SPEED.walk) * ((mag - 0.55) / 0.45);
    }
    // desired direction, camera-relative; turn fast but smoothly
    if (mag > 0.05) {
      const a = Math.atan2(-mx, my) + camYaw + Math.PI; // camYaw = orbit yaw; its forward is yaw + π
      const want = wrap(a);
      const diff = wrap(want - this.yaw);
      // a hard reversal from standing turns on the spot quickly
      const rate = this.speed < 0.8 ? 16 : run ? 8 : 11;
      this.yaw = wrap(this.yaw + diff * Math.min(1, rate * dt));
      this.anim.turn = clamp(diff, -1, 1);
      // turning sharply while moving sheds a little speed (feet plant)
      if (Math.abs(diff) > 1.6 && this.speed > 2) target = Math.min(target, this.speed * 0.6);
    } else this.anim.turn = 0;
    this.speed = damp(this.speed, target, target > this.speed ? 7 : 10, dt);
    const dx = Math.sin(this.yaw) * this.speed * dt, dz = Math.cos(this.yaw) * this.speed * dt;
    const r = this.world.move(this.pos, dx, dz, this.radius, this.pos.y);
    // step up/down onto whatever is underfoot
    const gy = this.world.groundAt(r.x, r.z, this.pos.y);
    if (gy - this.pos.y > 0.6) {
      // too tall to step: treat as wall
    } else {
      this.pos.x = r.x; this.pos.z = r.z;
    }
    if (gy >= this.pos.y - 0.05) { this.pos.y = damp(this.pos.y, gy, 18, dt); this.vy = 0; this.onGround = true; }
    else { this.vy -= 9.8 * dt; this.pos.y = Math.max(gy, this.pos.y + this.vy * dt); this.onGround = this.pos.y <= gy + 0.01; }
    this.anim.targetSpeed = this.speed;
    this.anim.setPosture(this.crouch ? 'crouch' : 'stand');
    this._sync(dt);
  }

  _sync() {
    this.ch.group.position.copy(this.pos);
    this.ch.group.rotation.y = this.yaw;
  }
}

/** Third-person orbit camera with wall avoidance. */
export class OrbitCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = Math.PI;       // camera's own yaw (looks down −Z at 0)
    this.pitch = -0.16;
    this.dist = 3.4;
    this.curDist = 3.4;
    this.target = new THREE.Vector3();
    this.pivotS = null;       // smoothed pivot (soaks up steps and bumps)
    this.shoulder = 0.5;
    this.occluders = [];
    this._ray = new THREE.Raycaster();
    this._t = 0;
    this.sinceLook = 99;      // seconds since the player last steered the camera
    this.fovBase = 56;
  }

  update(dt, player, opts = {}) {
    const sens = settings.get('lookSens') ?? 1;
    const inv = settings.get('invertY') ? -1 : 1;
    const lx = input.mouseLook.dx * 0.0026 + input.look.x * dt * 2.8;
    const ly = input.mouseLook.dy * 0.0026 + input.look.y * dt * 2.0;
    this.yaw -= lx * sens;
    this.pitch -= ly * sens * inv;
    this.pitch = clamp(this.pitch, -1.0, 0.5);
    if (Math.abs(input.look.x) > 0.05 || Math.abs(input.look.y) > 0.05 || Math.abs(input.mouseLook.dx) > 0.5 || Math.abs(input.mouseLook.dy) > 0.5) this.sinceLook = 0;
    else this.sinceLook += dt;
    // swing in behind the player while moving, once they've let go of the camera
    const veh = opts.vehicle;
    const moving = player.speed > (veh ? 1.2 : 1.8);
    if (moving && this.sinceLook > (veh ? 0.6 : 1.4)) {
      const behind = player.yaw + Math.PI;
      const ease = Math.min(1, (this.sinceLook - (veh ? 0.6 : 1.4)) * 0.8);
      const rate = (veh ? 2.4 : 1.1) * ease * Math.min(1, player.speed / 4);
      this.yaw += wrap(behind - this.yaw) * Math.min(1, dt * rate);
      // and level out the pitch a little
      this.pitch = damp(this.pitch, veh ? -0.2 : -0.14, 0.8 * ease, dt);
    }
    const want = veh ? veh.model.length * 1.25 + 2 + Math.min(3, player.speed * 0.12)
      : opts.indoors ? 2.3 : player.crouch ? 2.8 : 3.4 + Math.min(1.0, player.speed * 0.14);
    this.dist = damp(this.dist, want, 3, dt);
    const h = veh ? veh.spec.eye - (player.pos.y - veh.pos.y) : player.crouch ? 1.15 : 1.58;
    this.target.set(player.pos.x, player.pos.y + h, player.pos.z);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const shoulder = opts.indoors ? this.shoulder * 0.35 : this.shoulder * 0.5;
    const pivotRaw = this.target.clone().addScaledVector(right, shoulder);
    // smooth the pivot: horizontal follows tightly, vertical eases (steps, porches)
    if (!this.pivotS || this.pivotS.distanceToSquared(pivotRaw) > 25) this.pivotS = pivotRaw.clone();
    else {
      this.pivotS.x = damp(this.pivotS.x, pivotRaw.x, 18, dt);
      this.pivotS.z = damp(this.pivotS.z, pivotRaw.z, 18, dt);
      this.pivotS.y = damp(this.pivotS.y, pivotRaw.y, 7, dt);
    }
    const pivot = this.pivotS;
    // pull in if something solid is between the pivot and the camera
    let d = this.dist;
    if (this.occluders.length) {
      this._ray.set(pivot, dir);
      this._ray.far = this.dist + 0.3;
      const hits = this._ray.intersectObjects(this.occluders, true);
      if (hits.length) d = Math.max(0.6, hits[0].distance - 0.3);
    }
    this.curDist = d < this.curDist ? d : damp(this.curDist, d, 2.5, dt);
    const cam = this.camera;
    cam.position.copy(pivot).addScaledVector(dir, this.curDist);
    const ground = this.world.groundNear(cam.position.x, cam.position.z, player.pos.y) + 0.3;
    if (cam.position.y < ground) cam.position.y = ground;
    cam.lookAt(pivot);
    cam.fov = damp(cam.fov, this.fovBase + Math.min(7, Math.max(0, player.speed - 3) * 2.2), 2.5, dt);
    cam.updateProjectionMatrix();
  }

  /** Put the camera behind the player (after cutscenes and conversations). */
  snapBehind(player, pitch = -0.14) {
    this.yaw = player.yaw + Math.PI;
    this.pitch = pitch;
    this.pivotS = null;
    this.sinceLook = 0;
  }

  /** World yaw the camera is looking along (for camera-relative input). */
  get lookYaw() { return this.yaw + Math.PI; }
}
