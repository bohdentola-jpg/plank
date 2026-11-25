// First-person body: movement + collision, crouch, sprint stamina, the
// flashlight rig, breath holding, and crawling in and out of hiding spots.
import * as THREE from 'three';
import { clamp, lerp, damp, wrapAngle, smoothstep } from './util.js';

const RADIUS = 0.28;
const EYE = 1.62, EYE_CROUCH = 0.98;

export class Player {
  constructor({ scene, camera, cfg, lvl, T, audio, game }) {
    this.cfg = cfg;
    this.lvl = lvl;
    this.camera = camera;
    this.audio = audio;
    this.game = game;
    this.pos = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.dir = new THREE.Vector3();

    // flashlight held in the right hand, lagging behind the view a little
    const fl = (this.flash = new THREE.SpotLight(0xfff1dc, 0, 28, 0.72, 0.35, 2));
    fl.map = T.cookie;
    fl.castShadow = cfg.shadows;
    if (cfg.shadows) {
      fl.shadow.mapSize.set(cfg.shadowSize / 2, cfg.shadowSize / 2);
      fl.shadow.bias = -0.0004;
      fl.shadow.normalBias = 0.025;
      fl.shadow.camera.near = 0.15;
      fl.shadow.camera.far = 26;
      fl.shadow.radius = 2;
    }
    scene.add(fl, fl.target);
    this.flashQ = new THREE.Quaternion();
    this.flashPower = 0;
    this.flashFlicker = 1;
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._v = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.yaw = -Math.PI / 2;
    this.pitch = -0.05;
    this.crouch = false;
    this.eyeH = EYE;
    this.stamina = 1;
    this.exertion = 0;
    this.sprinting = false;
    this.moving = 0;
    this.flashlight = true;
    this.hidden = null;
    this.entering = null;
    this.trans = null;
    this.peek = 0;
    this.peeking = false;
    this.stepDist = 0;
    this.bobT = 0;
    this.breath = { amount: 1, held: false, heldT: 0, phase: 0, cooldown: 0, level: 0.3 };
    this.breathNoise = 1;
    this.shake = 0;
    this.lockLook = null; // world point to force-look at (death)
    this.vel.set(0, 0);
    this.carry = { batteries: 0, items: [] };
  }

  // ------------------------------------------------------------ collision
  collide() {
    const p = this.pos;
    for (let it = 0; it < 2; it++) {
      for (const c of this.lvl.colliders) {
        if (p.x < c.x0 - RADIUS - 0.1 || p.x > c.x1 + RADIUS + 0.1 || p.z < c.z0 - RADIUS - 0.1 || p.z > c.z1 + RADIUS + 0.1) continue;
        const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1);
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < RADIUS * RADIUS) {
          if (d2 < 1e-8) {
            // inside: push out along the shortest axis
            const l = p.x - c.x0, r = c.x1 - p.x, b = p.z - c.z0, f = c.z1 - p.z;
            const m = Math.min(l, r, b, f);
            if (m === l) p.x = c.x0 - RADIUS; else if (m === r) p.x = c.x1 + RADIUS; else if (m === b) p.z = c.z0 - RADIUS; else p.z = c.z1 + RADIUS;
          } else {
            const d = Math.sqrt(d2);
            p.x = cx + (dx / d) * RADIUS;
            p.z = cz + (dz / d) * RADIUS;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ hiding
  enter(spot) {
    this.entering = spot;
    this.trans = {
      mode: 'in', t: 0, dur: spot.kind === 'locker' ? 0.9 : 1.25,
      fromPos: new THREE.Vector3(this.pos.x, this.eyeH, this.pos.z),
      fromYaw: this.yaw, fromPitch: this.pitch,
    };
    this.audio.rustle(1);
    this.crouch = false;
  }
  exit() {
    const s = this.hidden;
    if (!s) return;
    this.trans = {
      mode: 'out', t: 0, dur: s.kind === 'locker' ? 0.7 : 1.0, spot: s,
      fromPos: this.eye.clone(), fromYaw: this.yaw, fromPitch: this.pitch,
    };
    this.entering = null;
    this.audio.rustle(0.9);
  }

  beamOn(target) {
    // is the flashlight pointed at a world point (with line of sight)?
    if (!this.flashlight || this.hidden) return false;
    const to = this._v.copy(target).sub(this.flash.position);
    const d = to.length();
    if (d > 22) return false;
    to.divideScalar(d);
    const fwd = new THREE.Vector3().subVectors(this.flash.target.position, this.flash.position).normalize();
    return to.dot(fwd) > 0.93 && this.game.nav.los(this.pos.x, this.pos.z, target.x, target.z);
  }

  // where sounds we make come from (inside the spot when hidden)
  noisePos() {
    return this.hidden ? this.hidden.cam : this.pos;
  }

  // ------------------------------------------------------------ update
  update(dt, inp, frozen) {
    const cfg = this.cfg;
    const b = this.breath;

    // look
    if (!frozen && !this.trans) {
      this.yaw -= inp.dx;
      this.pitch = clamp(this.pitch - inp.dy, -1.45, 1.45);
    }
    const spot = this.hidden;
    if (spot && !this.trans) {
      const rel = clamp(wrapAngle(this.yaw - spot.yaw), -spot.yawRange, spot.yawRange);
      this.yaw = spot.yaw + rel;
      this.pitch = clamp(this.pitch, spot.pitch[0], spot.pitch[1]);
    }

    // breath holding
    b.cooldown = Math.max(0, b.cooldown - dt);
    const wantHold = inp.breath && !frozen && b.cooldown <= 0;
    if (wantHold && b.amount > 0) {
      if (!b.held) { b.held = true; b.heldT = 0; }
      b.heldT += dt;
      b.amount -= (dt / cfg.breathSeconds) * (1 + this.game.fear * 0.5 + this.exertion * 0.6);
      if (b.amount <= 0) {
        b.amount = 0;
        b.held = false;
        b.cooldown = 1.8;
        this.exertion = Math.min(1, this.exertion + 0.5);
        this.audio.gasp();
        const np = this.noisePos();
        this.game.noise(np.x, np.z, this.hidden ? 8 : 10, 'gasp');
      }
    } else {
      if (b.held) {
        b.held = false;
        if (b.heldT > 2.5) {
          this.audio.exhale(clamp(b.heldT / 6, 0.4, 1.2));
          const np = this.noisePos();
          this.game.noise(np.x, np.z, 1.8, 'exhale');
        }
      }
      b.amount = Math.min(1, b.amount + dt * 0.2);
    }
    const fear = this.game.fear;
    const rate = 0.22 + fear * 0.45 + this.exertion * 0.6;
    b.phase = (b.phase + dt * rate) % 1;
    b.level = clamp(0.18 + fear * 0.5 + this.exertion * 0.7, 0, 1.2);
    let noise = 0.6 + fear * 3.2 + this.exertion * 3;
    if (this.hidden) noise *= this.hidden.kind === 'hole' ? 0.75 : 0.9;
    this.breathNoise = b.held ? 0 : noise;

    if (this.trans) return this.updateTransition(dt);
    if (this.hidden) return this.updateHidden(dt, inp, frozen);

    // crouch / sprint / move
    if (inp.crouch && !frozen) this.crouch = !this.crouch;
    const wantSprint = inp.sprint && inp.y > 0.2 && !frozen && this.stamina > 0.05;
    if (wantSprint && this.crouch) this.crouch = false;
    this.sprinting = wantSprint && this.stamina > 0;
    const speed = frozen ? 0 : this.sprinting ? 5.1 : this.crouch ? 1.25 : 2.35;
    const sx = inp.x * speed, sz = inp.y * speed;
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // forward = (-sin(yaw), -cos(yaw)), right = (cos(yaw), -sin(yaw))
    const wx = -sy * sz + cy * sx, wz = -cy * sz - sy * sx;
    this.vel.x = damp(this.vel.x, wx, this.sprinting ? 7 : 10, dt);
    this.vel.y = damp(this.vel.y, wz, this.sprinting ? 7 : 10, dt);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    this.collide();
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.moving = moved / Math.max(dt, 1e-4);

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt / 6.5);
      this.exertion = Math.min(1, this.exertion + dt * 0.16);
    } else {
      this.stamina = Math.min(1, this.stamina + dt * (this.moving < 0.2 ? 0.2 : 0.11));
      this.exertion = Math.max(0, this.exertion - dt * 0.07);
    }

    // footsteps
    this.stepDist += moved;
    const stepLen = this.sprinting ? 0.95 : this.crouch ? 0.55 : 0.74;
    if (this.stepDist > stepLen) {
      this.stepDist = 0;
      const surf = this.lvl.surfaceAt(this.pos.x, this.pos.z);
      const vol = this.sprinting ? 1 : this.crouch ? 0.25 : 0.55;
      this.audio.footstep(surf, vol);
      const r = this.sprinting ? 13 : this.crouch ? 1.4 : surf === 'tile' ? 4.6 : 5.6;
      this.game.noise(this.pos.x, this.pos.z, r, 'step');
    }
    // panting is audible when exhausted
    if (!b.held && this.breathNoise > 3.2 && Math.random() < dt * 2) this.game.noise(this.pos.x, this.pos.z, this.breathNoise, 'breath');

    // camera
    this.eyeH = damp(this.eyeH, this.crouch ? EYE_CROUCH : EYE, 9, dt);
    const spd = Math.hypot(this.vel.x, this.vel.y);
    this.bobT += dt * spd * (this.sprinting ? 2.1 : 2.6);
    const bobA = Math.min(spd / 5, 1) * (this.sprinting ? 0.06 : 0.035);
    const bobY = Math.abs(Math.sin(this.bobT)) * bobA;
    const bobX = Math.cos(this.bobT) * bobA * 0.6;
    this.eye.set(this.pos.x + cy * bobX, this.eyeH + bobY - bobA * 0.5, this.pos.z - sy * bobX);
    this.applyCamera(dt, Math.sin(this.bobT) * bobA * 0.25);
  }

  updateHidden(dt, inp, frozen) {
    const s = this.hidden;
    // peek out of the hole by pushing forward
    if (s.peek) {
      const want = !frozen && inp.y > 0.4 ? 1 : 0;
      this.peek = damp(this.peek, want, 3, dt);
      this.peeking = this.peek > 0.5;
    } else {
      this.peek = 0;
      this.peeking = false;
    }
    const base = s.cam;
    const tgt = s.peek ? this._v.copy(base).lerp(s.peek, this.peek) : this._v.copy(base);
    // slow, calm breathing sway — quicker when afraid
    const t = this.game.time;
    const f = this.game.fear;
    const amp = this.breath.held ? 0.0015 : 0.006 + f * 0.01;
    this.eye.set(tgt.x, tgt.y + Math.sin(t * (1.3 + f * 3)) * amp, tgt.z + Math.sin(t * 0.7) * amp * 0.5);
    this.pos.set(s.enter.x, 0, s.enter.z);
    this.exertion = Math.max(0, this.exertion - dt * 0.09);
    this.stamina = Math.min(1, this.stamina + dt * 0.25);
    this.moving = 0;
    this.sprinting = false;
    this.applyCamera(dt, 0);
  }

  updateTransition(dt) {
    const tr = this.trans;
    tr.t += dt / tr.dur;
    const k = smoothstep(0, 1, Math.min(tr.t, 1));
    if (tr.mode === 'in') {
      const s = this.entering;
      // go low first, then slide into place
      const low = new THREE.Vector3(s.enter.x, s.kind === 'locker' ? 1.5 : 0.6, s.enter.z);
      if (k < 0.45) this.eye.lerpVectors(tr.fromPos, low, k / 0.45);
      else this.eye.lerpVectors(low, s.cam, (k - 0.45) / 0.55);
      if (tr.t < 0.05) this.eye.copy(tr.fromPos);
      this.yaw = tr.fromYaw + wrapAngle(s.yaw - tr.fromYaw) * k;
      this.pitch = lerp(tr.fromPitch, -0.05, k);
      if (tr.t >= 1) {
        this.hidden = s;
        this.entering = null;
        this.trans = null;
        this.pos.set(s.enter.x, 0, s.enter.z);
        this.game.onHidden(s);
      }
    } else {
      const s = tr.spot;
      const out = new THREE.Vector3(s.exit.x, EYE, s.exit.z);
      const low = new THREE.Vector3(s.exit.x, s.kind === 'locker' ? 1.5 : 0.65, s.exit.z);
      if (k < 0.6) this.eye.lerpVectors(tr.fromPos, low, k / 0.6);
      else this.eye.lerpVectors(low, out, (k - 0.6) / 0.4);
      this.pitch = lerp(tr.fromPitch, 0, k);
      if (tr.t >= 1) {
        this.hidden = null;
        this.trans = null;
        this.pos.set(s.exit.x, 0, s.exit.z);
        this.eyeH = EYE;
        this.crouch = false;
        this.collide();
        this.game.onUnhidden(s);
      }
    }
    this.applyCamera(dt, 0);
  }

  applyCamera(dt, roll) {
    const cam = this.camera;
    const sh = this.shake;
    cam.position.copy(this.eye);
    if (sh > 0) {
      cam.position.x += (Math.random() - 0.5) * sh * 0.05;
      cam.position.y += (Math.random() - 0.5) * sh * 0.05;
    }
    if (this.lockLook) {
      const m = new THREE.Matrix4().lookAt(cam.position, this.lockLook, new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      cam.quaternion.slerp(q, 1 - Math.exp(-14 * dt));
    } else {
      // fear tremor
      const f = this.game.fear;
      const tr = f > 0.5 ? (f - 0.5) * 0.004 : 0;
      this._e.set(this.pitch + (Math.random() - 0.5) * tr, this.yaw + (Math.random() - 0.5) * tr, roll);
      cam.quaternion.setFromEuler(this._e);
    }
    // flashlight rig
    const fl = this.flash;
    this._q.copy(cam.quaternion);
    if (this.lockLook) this.flashQ.copy(this._q);
    else this.flashQ.slerp(this._q, 1 - Math.exp(-(this.hidden ? 20 : 11) * dt));
    const off = this._v.set(0.2, -0.24, -0.15).applyQuaternion(cam.quaternion);
    fl.position.copy(cam.position).add(off);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.flashQ);
    if (this.lockLook) fl.target.position.copy(this.lockLook);
    else fl.target.position.copy(fl.position).addScaledVector(fwd, 6);
    fl.target.updateMatrixWorld();
    // during the grab the beam snaps onto its face, whatever you were doing
    const on = this.lockLook ? 1.4 : this.flashlight && !this.hidden ? 1 : 0;
    this.flashPower = damp(this.flashPower, on, 25, dt);
    fl.intensity = this.flashPower * 32 * this.flashFlicker;
    fl.visible = true;
    this.dir.copy(fwd);
  }
}
