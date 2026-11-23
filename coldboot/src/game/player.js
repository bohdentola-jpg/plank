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

  place(x, z, yaw = 0) {
    this.pos.set(x, this.world.groundAt(x, z), z);
    this.yaw = yaw;
    this._sync(0);
  }

  update(dt, camYaw) {
    let mx = 0, my = 0;
    if (!this.locked) { mx = input.move.x; my = input.move.y; }
    if (input.pressed('crouch') && !this.locked) this.crouch = !this.crouch;
    const mag = Math.min(1, Math.hypot(mx, my));
    this.moveIntent = mag;
    const run = input.sprint && !this.crouch;
    const target = mag < 0.05 ? 0 : (this.crouch ? 1.1 : run ? 4.2 : (input.keyboardMove ? 1.55 : 1.0 + 0.8 * mag)) * (input.keyboardMove ? 1 : Math.max(0.4, mag));
    // desired direction, camera-relative
    if (mag > 0.05) {
      const a = Math.atan2(-mx, my) + camYaw + Math.PI; // camYaw = orbit yaw; its forward is yaw + π
      const want = wrap(a);
      const turnRate = run ? 7 : 10;
      this.yaw += clamp(wrap(want - this.yaw), -turnRate * dt, turnRate * dt);
      this.anim.turn = clamp(wrap(want - this.yaw), -1, 1);
    } else this.anim.turn = 0;
    this.speed = damp(this.speed, target, target > this.speed ? 6 : 9, dt);
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
    this.pitch = -0.18;
    this.dist = 3.6;
    this.curDist = 3.6;
    this.target = new THREE.Vector3();
    this.shoulder = 0.45;
    this.occluders = [];
    this._ray = new THREE.Raycaster();
    this._t = 0;
    this.fovBase = 58;
  }

  update(dt, player, opts = {}) {
    const sens = settings.get('lookSens') ?? 1;
    const inv = settings.get('invertY') ? -1 : 1;
    this.yaw -= (input.mouseLook.dx * 0.0028 + input.look.x * dt * 2.6) * sens;
    this.pitch -= (input.mouseLook.dy * 0.0028 + input.look.y * dt * 1.9) * sens * inv;
    this.pitch = clamp(this.pitch, -1.05, 0.55);
    // drift behind the player while running with no look input
    if (player.speed > 2.5 && Math.abs(input.look.x) < 0.05 && Math.abs(input.mouseLook.dx) < 0.5) {
      const behind = player.yaw + Math.PI;
      this.yaw += wrap(behind - this.yaw) * Math.min(1, dt * 0.8);
    }
    const want = opts.indoors ? 2.2 : player.crouch ? 2.8 : 3.6 + Math.min(1.2, player.speed * 0.15);
    this.dist = damp(this.dist, want, 4, dt);
    const h = player.crouch ? 1.15 : 1.55;
    this.target.set(player.pos.x, player.pos.y + h, player.pos.z);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = this.target.clone().addScaledVector(right, this.shoulder * 0.5);
    // pull in if something solid is between the pivot and the camera
    let d = this.dist;
    if (this.occluders.length) {
      this._ray.set(pivot, dir);
      this._ray.far = this.dist + 0.3;
      const hits = this._ray.intersectObjects(this.occluders, true);
      if (hits.length) d = Math.max(0.6, hits[0].distance - 0.3);
    }
    this.curDist = d < this.curDist ? d : damp(this.curDist, d, 3, dt);
    const cam = this.camera;
    cam.position.copy(pivot).addScaledVector(dir, this.curDist);
    const ground = this.world.groundAt(cam.position.x, cam.position.z) + 0.3;
    if (cam.position.y < ground) cam.position.y = ground;
    cam.lookAt(pivot);
    cam.fov = damp(cam.fov, this.fovBase + Math.min(8, player.speed * 1.2), 3, dt);
    cam.updateProjectionMatrix();
  }

  /** World yaw the camera is looking along (for camera-relative input). */
  get lookYaw() { return this.yaw + Math.PI; }
}
