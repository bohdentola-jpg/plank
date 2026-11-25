// Third-person camera rig + mapping of player input onto a Fighter's intent.
import * as THREE from 'three';
import { clamp, damp } from '../util.js';

const _f = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0; this.pitch = -0.12;
    this.dist = 4.4;
    this.pivot = new THREE.Vector3();
    this.curDist = 4.4;
    this.shakeT = 0; this.shakeA = 0;
    this.fov = 66;
    this.ready = false;
  }

  snap(f, yaw) {
    this.yaw = yaw; this.pitch = -0.12;
    this.pivot.copy(f.pos).setY(f.pos.y + 1.55);
    this.ready = true;
  }

  shake(a = 0.3, t = 0.3) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }

  forward(out) {
    const cp = Math.cos(this.pitch);
    return out.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  update(dt, f, level, look) {
    if (look) { this.yaw -= look.dx; this.pitch = clamp(this.pitch - look.dy, -1.2, 1.0); }
    const goo = f.form === 'goo';
    const ty = f.pos.y + (goo ? (f.submerged ? 0.9 : 1.05) : 1.55);
    if (!this.ready) this.snap(f, this.yaw);
    this.pivot.x += (f.pos.x - this.pivot.x) * damp(30, dt);
    this.pivot.z += (f.pos.z - this.pivot.z) * damp(30, dt);
    this.pivot.y += (ty - this.pivot.y) * damp(14, dt);
    const fwd = this.forward(_f);
    let dist = this.dist + (this.pitch < 0 ? -this.pitch * 1.2 : 0);
    _d.copy(fwd).negate();
    _d.y += 0.12;
    _d.normalize();
    const hit = level.raycast(this.pivot, _d, dist + 0.3);
    const want = hit ? Math.max(0.6, hit.t - 0.3) : dist;
    this.curDist += (want - this.curDist) * damp(want < this.curDist ? 40 : 6, dt);
    this.cam.position.copy(this.pivot).addScaledVector(_d, this.curDist);
    // keep the camera above the floor
    const fl = level.groundAt(this.cam.position.x, this.cam.position.z, this.cam.position.y, 0.1, 0.3);
    if (Number.isFinite(fl.y) && this.cam.position.y < fl.y + 0.3) this.cam.position.y = fl.y + 0.3;
    this.cam.rotation.order = 'YXZ';
    this.cam.rotation.set(this.pitch, this.yaw + Math.PI, 0);
    // frame the character a little below the reticle (more so when looking up)
    _p.set(0, 1, 0).applyQuaternion(this.cam.quaternion);
    const lift = 0.42 + Math.max(0, this.pitch) * 0.5;
    const up = level.raycast(this.cam.position, _p, lift + 0.2);
    this.cam.position.addScaledVector(_p, up ? Math.max(0, up.t - 0.2) : lift);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT) * 3;
      this.cam.rotation.x += (Math.random() - 0.5) * a * 0.05;
      this.cam.rotation.y += (Math.random() - 0.5) * a * 0.05;
    } else this.shakeA = 0;
    const fovT = 66 + (f.submerged ? Math.min(8, Math.hypot(f.vel.x, f.vel.z) * 0.7) : 0) - (f.charging ? f.charge * 8 : 0);
    this.fov += (fovT - this.fov) * damp(6, dt);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
}

export class PlayerControl {
  constructor(input, rig) {
    this.input = input;
    this.rig = rig;
    this.aimHit = null;
  }

  update(dt, f, world, enabled = true) {
    const inp = this.input;
    const look = enabled ? inp.look(dt) : { dx: 0, dy: 0 };
    this.rig.update(dt, f, world.level, look);
    const I = f.intent;
    if (!enabled || !f.alive) {
      I.mx = I.mz = 0; I.fire = I.jump = I.sub = I.special = I.goo = false;
      I.aimYaw = this.rig.yaw; I.aimPitch = this.rig.pitch;
      return;
    }
    const mv = inp.move();
    const sy = Math.sin(this.rig.yaw), cy = Math.cos(this.rig.yaw);
    I.mx = sy * mv.y - cy * mv.x;
    I.mz = cy * mv.y + sy * mv.x;
    I.aimYaw = this.rig.yaw;
    I.aimPitch = this.rig.pitch;
    I.fire = inp.action('fire');
    I.goo = inp.action('goo');
    I.jump = inp.action('jump');
    I.sub = inp.action('sub');
    I.special = inp.action('special');
    I.aimHold = false;
    // aim point: centre-screen ray
    const cam = this.rig.cam;
    const dir = this.rig.forward(_f).clone();
    const origin = cam.position;
    let best = 70;
    const hit = world.level.raycast(origin, dir, best);
    if (hit) best = hit.t;
    let target = null;
    for (const o of world.fighters) {
      if (o === f || !o.alive) continue;
      _p.set(o.pos.x, o.pos.y + o.hitHeight() * 0.55, o.pos.z).sub(origin);
      const t = _p.dot(dir);
      if (t < 0 || t > best) continue;
      const perp2 = _p.lengthSq() - t * t;
      if (perp2 < 0.45 * 0.45) { best = t; target = o; }
    }
    this.aimTarget = target;
    const minD = this.rig.curDist + 1.0;
    I.aimPoint = best > minD ? (I.aimPoint || new THREE.Vector3()).copy(origin).addScaledVector(dir, best) : null;
  }
}
