// First-person controller. Movement is the CS trinity: friction, sharp
// acceleration, and counter-strafing (opposing input brakes roughly twice as
// hard, so tapping the opposite key zeroes your speed — and your spread —
// almost instantly). Fire input is handled sub-tick: mouse events fire
// immediately with their own timestamps instead of waiting for the next frame.
import * as THREE from './three.js';
import { G } from './state.js';
import { Combatant } from './entity.js';
import { clamp, lerp, moveToward } from './util.js';

const GRAV = 16, JUMP = 4.9;
const ACCEL = 65, AIR_ACCEL = 9, FRICTION = 7.5;

export class Player extends Combatant {
  constructor(name, team) {
    super(name, team);
    this.isPlayer = true;
    this.keys = {};
    this.mouseDown = false;
    this.mouse2Down = false;
    this.stepAcc = 0;
    this.bobPhase = 0;
    this.viewPunch = new THREE.Vector2(); // x = pitch up, y = yaw
    this.spectating = null;
    this.landBump = 0;
    this._airTime = 0;
  }

  bindInput(el) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      this.keys[e.code] = true;
      if (!e.repeat) G.combat && G.combat.onKeyPress(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    el.addEventListener('mousedown', (e) => {
      if (!G.started || G.paused || document.pointerLockElement !== el) return;
      if (e.button === 0) { this.mouseDown = true; G.combat.onTriggerDown(e.timeStamp / 1000); }
      if (e.button === 2) { this.mouse2Down = true; G.combat.onAltFire(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouseDown = false; G.combat && G.combat.onTriggerUp(e.timeStamp / 1000); }
      if (e.button === 2) this.mouse2Down = false;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== el || G.paused) return;
      if (!this.alive) return;
      const zoomScale = this.scoped ? 1 / (this.currentDef()?.zoom || 1) : 1;
      const s = 0.0022 * G.settings.sens * zoomScale;
      this.yaw += e.movementX * s;
      this.pitch = clamp(this.pitch - e.movementY * s, -1.45, 1.45);
    });
    window.addEventListener('wheel', (e) => {
      if (!G.started || G.paused || !this.alive) return;
      G.combat.cycleSlot(Math.sign(e.deltaY));
    });
  }

  wishDir() {
    let f = 0, s = 0;
    if (this.keys.KeyW) f += 1;
    if (this.keys.KeyS) f -= 1;
    if (this.keys.KeyD) s += 1;
    if (this.keys.KeyA) s -= 1;
    if (!f && !s) return null;
    const len = Math.hypot(f, s);
    f /= len; s /= len;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward is (-sin(yaw), -cos(yaw)) in world space
    return { x: -sin * f + cos * s, z: -cos * f + sin * s };
  }

  update(dt) {
    if (!this.alive) { this.updateSpectate(); return; }
    const frozen = G.game && G.game.movementFrozen();
    this.walking = !!this.keys.ShiftLeft || !!this.keys.ShiftRight;
    const wantCrouch = !!this.keys.ControlLeft || !!this.keys.ControlRight;
    this.crouched = wantCrouch;
    this.height = lerp(this.height, wantCrouch ? 1.3 : 1.85, Math.min(1, dt * 12));
    this.eyeHeight = lerp(this.eyeHeight, wantCrouch ? 1.06 : 1.62, Math.min(1, dt * 12));

    const wish = frozen ? null : this.wishDir();
    const max = this.maxSpeed();

    if (this.grounded) {
      // friction
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const drop = sp * FRICTION * dt;
        const ns = Math.max(0, sp - drop) / sp;
        this.vel.x *= ns; this.vel.z *= ns;
      }
      if (wish) {
        // counter-strafe: braking against current velocity is stronger
        const dot = this.vel.x * wish.x + this.vel.z * wish.z;
        const accel = (dot < -0.1 ? ACCEL * 2.0 : ACCEL) * dt;
        const cur = this.vel.x * wish.x + this.vel.z * wish.z;
        const add = Math.min(accel, Math.max(0, max - cur));
        this.vel.x += wish.x * add;
        this.vel.z += wish.z * add;
        const sp2 = Math.hypot(this.vel.x, this.vel.z);
        if (sp2 > max) { this.vel.x *= max / sp2; this.vel.z *= max / sp2; }
      }
      if (this.keys.Space && !frozen && !this.crouched) {
        this.vel.y = JUMP;
        this.grounded = false;
        G.audio.registerEvent(this.pos, 16, 'jump');
        this.fireInacc += 0.5;
      }
    } else if (wish) {
      const cur = this.vel.x * wish.x + this.vel.z * wish.z;
      const add = Math.min(AIR_ACCEL * dt, Math.max(0, max * 0.3 - cur));
      this.vel.x += wish.x * add;
      this.vel.z += wish.z * add;
    }

    this.vel.y -= GRAV * dt;
    const wasAir = !this.grounded;
    const fallSpeed = -this.vel.y;
    const res = G.world.moveEntity(this.pos, this.vel, dt, this.radius, this.height, true);
    this.grounded = res.grounded || G.world.checkGrounded(this.pos, this.radius, this.height);
    if (this.grounded && wasAir) {
      if (fallSpeed > 5) {
        G.audio.land(null, true);
        G.audio.registerEvent(this.pos, 18, 'land');
        this.fireInacc += 1.2;
        this.landBump = Math.min(0.08, fallSpeed * 0.012);
      }
      this._airTime = 0;
    }

    // footsteps
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && speed > 1.5) {
      this.stepAcc += speed * dt;
      const stride = this.walking ? 2.6 : 2.15;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        G.audio.footstep(null, this.walking, true);
        if (!this.walking) G.audio.registerEvent(this.pos, 14, 'footstep');
      }
      this.bobPhase += dt * speed * 1.6;
    }
    this.landBump = Math.max(0, this.landBump - dt * 0.35);

    // recoil recovery
    const def = this.currentDef();
    const recovery = def && def.recovery ? def.recovery : 0.4;
    if (G.time - this.lastShotTime > 0.11) {
      const k = Math.exp(-dt * (3.2 / recovery));
      this.viewPunch.multiplyScalar(k);
      if (this.recoilIndex > 0) this.recoilIndex = Math.max(0, this.recoilIndex - dt * (10 / recovery));
    }
    this.fireInacc = moveToward(this.fireInacc, 0, dt * 5);

    // auto fire held trigger
    if (this.mouseDown && def && def.auto) G.combat.tryFire(this, G.time);
  }

  updateSpectate() {
    const mates = [G.player, ...G.bots].filter((c) => c !== this && c.team === this.team && c.alive);
    if (!mates.length) { this.spectating = null; return; }
    if (!this.spectating || !this.spectating.alive) this.spectating = mates[0];
  }

  spectateNext() {
    const mates = [G.player, ...G.bots].filter((c) => c !== this && c.team === this.team && c.alive);
    if (!mates.length) return;
    const i = mates.indexOf(this.spectating);
    this.spectating = mates[(i + 1) % mates.length];
  }

  applyCamera() {
    const cam = G.camera;
    let ent = this;
    if (!this.alive && this.spectating) ent = this.spectating;
    const bob = this.alive ? Math.sin(this.bobPhase) * 0.012 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 4) : 0;
    cam.position.set(ent.pos.x, ent.pos.y + ent.eyeHeight + bob - this.landBump, ent.pos.z);
    const yaw = ent === this ? this.yaw : ent.yaw;
    const pitch = ent === this ? this.pitch : ent.pitch;
    cam.rotation.order = 'YXZ';
    cam.rotation.y = -yaw + (ent === this ? -this.viewPunch.y : 0);
    cam.rotation.x = pitch + (ent === this ? this.viewPunch.x : 0);
    cam.rotation.z = Math.sin(this.bobPhase * 0.5) * 0.002;
  }
}
