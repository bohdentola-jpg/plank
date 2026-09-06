// Madden-style broadcast camera: behind the user's team, follows the ball, widens when it's in the air.
import * as THREE from '../../vendor/three.module.js';
import { clamp, lerp } from '../util.js';

export class GameCamera {
  constructor(app) {
    this.cam = new THREE.PerspectiveCamera(46, app.vw / app.vh, 0.1, 1500);
    this.pos = new THREE.Vector3(0, 12, -20); this.look = new THREE.Vector3(0, 1, 20);
    this.tPos = new THREE.Vector3(); this.tLook = new THREE.Vector3(); this.shake = 0; this.orbit = 0; this.snap = true;
  }
  resize(w, h) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  update(dt, sim, opts = {}) {
    const b = sim.ball; const camDir = sim.dirOf(sim.userSide);
    const carrier = b.carrier; const fx = carrier ? carrier.x : b.x, fz = carrier ? carrier.z : b.z;
    let px, py, pz, lx, ly, lz, k = 5;
    if (sim.phase === 'playcall' || sim.phase === 'presnap' || sim.phase === 'pat') {
      const los = sim.los; px = fx * 0.35; py = sim.phase === 'playcall' ? 13 : 9.5; pz = los - camDir * (sim.phase === 'playcall' ? 22 : 16); lx = fx * 0.3; ly = 1.2; lz = los + camDir * (sim.phase === 'playcall' ? 6 : 9); k = 4;
    } else if (sim.phase === 'kickmeter') {
      px = fx + 4 * camDir; py = 4.5; pz = fz - camDir * 9; lx = fx; ly = 2.5; lz = fz + camDir * 30; k = 4;
    } else if (b.state === 'air' && b.landing) {
      const mx = (b.x + b.landing.x) / 2, mz = (b.z + b.landing.z) / 2; const span = Math.abs(b.landing.z - b.z);
      px = mx * 0.5; py = 11 + Math.min(14, span * 0.32) + b.y * 0.25; pz = mz - camDir * (14 + span * 0.45); lx = mx * 0.6; ly = 2 + b.y * 0.3; lz = mz + camDir * 4; k = 5;
    } else if (sim.phase === 'dead' && sim.result && sim.result.td) {
      this.orbit += dt * 0.9; const r = 9; px = fx + Math.sin(this.orbit) * r; py = 4; pz = fz + Math.cos(this.orbit) * r; lx = fx; ly = 1.5; lz = fz; k = 3;
    } else if (sim.phase === 'dead') {
      px = fx * 0.6 + camDir * 0; py = 7; pz = fz - camDir * 11; lx = fx; ly = 1.2; lz = fz; k = 2.5;
    } else {
      const sp = carrier ? Math.hypot(carrier.vx, carrier.vz) : 0; const ahead = clamp(sp * 0.9, 0, 6);
      px = fx * 0.55; py = 9.5 + ahead * 0.25; pz = fz - camDir * (14 + ahead * 0.5); lx = fx * 0.75; ly = 1.4; lz = fz + camDir * (8 + ahead); k = 6;
    }
    if (this.override) { px = this.override.pos.x; py = this.override.pos.y; pz = this.override.pos.z; lx = this.override.look.x; ly = this.override.look.y; lz = this.override.look.z; k = this.override.k || 3; }
    this.tPos.set(px, py, pz); this.tLook.set(lx, ly, lz);
    if (this.snap) { this.pos.copy(this.tPos); this.look.copy(this.tLook); this.snap = false; }
    const a = 1 - Math.exp(-k * dt); this.pos.lerp(this.tPos, a); this.look.lerp(this.tLook, a);
    if (this.shake > 0) { this.shake -= dt; this.pos.x += (Math.random() - 0.5) * 0.35; this.pos.y += (Math.random() - 0.5) * 0.25; }
    this.cam.position.copy(this.pos); this.cam.lookAt(this.look);
  }
  cut() { this.snap = true; }
  project(x, y, z, w, h) { const v = new THREE.Vector3(x, y, z).project(this.cam); return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 && v.z > -1 }; }
}
