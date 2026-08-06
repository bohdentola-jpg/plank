// The wanderer: a hand-built low-poly figure (hood, cloak, pack, bedroll),
// third-person orbit camera with terrain-aware boom, and the movement model —
// walk/sprint/jump on the analytic heightfield, swim when the seabed drops
// away, stamina in between. The same world.heightAt() the meshes sample is
// the ground truth here, so feet and terrain never disagree.

import * as THREE from 'three';
import { clamp, lerp } from './noise.js';
import { SEA_LEVEL, BIOMES } from './world.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
function part(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const WALK = 3.3, RUN = 5.7, SPRINT = 8.4, SWIM = 2.7, ACCEL = 26;

export class Player {
  constructor(scene, world, sfx) {
    this.world = world;
    this.sfx = sfx;
    this.root = new THREE.Group();
    scene.add(this.root);
    this._buildRig();

    this.pos = new THREE.Vector3(0, 10, 0);
    this.vel = new THREE.Vector3();
    this.heading = 0;         // way the body faces
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 7;
    this._camDistTarget = 7;
    this.onGround = false;
    this.swimming = false;
    this.stamina = 1;
    this.staggerT = 0;
    this.riding = null;       // set by main when on the horse
    this.distanceTraveled = 0;
    this.phase = 0;
    this._stepPulse = 0;
    this.onStep = null;       // (surface) → sfx hook
    this.onSplash = null;
    this.onLand = null;
  }

  _buildRig() {
    const g = this.root;
    const SKIN = 0xc98f68, TUNIC = 0x5a6c50, CLOAK = 0x74513a, LEG = 0x4a4038;
    this.legL = new THREE.Group(); this.legL.position.set(0, 0.92, 0.11);
    this.legR = new THREE.Group(); this.legR.position.set(0, 0.92, -0.11);
    for (const [legGroup] of [[this.legL], [this.legR]]) {
      legGroup.add(part(new THREE.CylinderGeometry(0.09, 0.075, 0.85, 7), LEG, 0, -0.44, 0));
      legGroup.add(part(new THREE.BoxGeometry(0.24, 0.12, 0.15), 0x3a3028, 0.05, -0.86, 0));
    }
    g.add(this.legL, this.legR);

    this.torso = new THREE.Group(); this.torso.position.y = 0.95;
    this.torso.add(part(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 8), TUNIC, 0, 0.31, 0));
    this.torso.add(part(new THREE.BoxGeometry(0.34, 0.07, 0.3), 0x3a3028, 0, 0.06, 0)); // belt
    // cloak down the back
    this.cloak = part(new THREE.ConeGeometry(0.3, 0.95, 7, 1, true), CLOAK, -0.14, 0.28, 0);
    this.cloak.geometry.translate(0, -0.42, 0);
    this.cloak.rotation.z = 0.16;
    this.cloak.material.side = THREE.DoubleSide;
    this.torso.add(this.cloak);
    // pack + bedroll
    this.torso.add(part(new THREE.BoxGeometry(0.16, 0.34, 0.3), 0x6a5638, -0.24, 0.42, 0));
    const roll = part(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 7), 0x8a7a5a, -0.24, 0.64, 0);
    roll.rotation.x = Math.PI / 2;
    this.torso.add(roll);

    this.armL = new THREE.Group(); this.armL.position.set(0, 0.58, 0.24);
    this.armR = new THREE.Group(); this.armR.position.set(0, 0.58, -0.24);
    for (const arm of [this.armL, this.armR]) {
      arm.add(part(new THREE.CylinderGeometry(0.06, 0.055, 0.6, 6), TUNIC, 0, -0.28, 0));
      arm.add(part(new THREE.SphereGeometry(0.055, 6, 5), SKIN, 0, -0.58, 0));
      this.torso.add(arm);
    }

    this.headG = new THREE.Group(); this.headG.position.y = 0.72;
    this.headG.add(part(new THREE.SphereGeometry(0.15, 9, 8), SKIN, 0, 0.1, 0));
    const hood = part(new THREE.ConeGeometry(0.19, 0.34, 8), CLOAK, -0.02, 0.22, 0);
    hood.rotation.z = -0.25;
    this.headG.add(hood);
    this.torso.add(this.headG);
    g.add(this.torso);
  }

  groundAt(x, z) { return this.world.heightAt(x, z); }

  surface() {
    const b = this.world.biomeAt(this.pos.x, this.pos.z);
    return (BIOMES[b] && BIOMES[b].step) || 'grass';
  }

  teleport(x, z) {
    const h = Math.max(this.groundAt(x, z), SEA_LEVEL);
    this.pos.set(x, h + 0.5, z);
    this.vel.set(0, 0, 0);
  }

  update(dt, inp, frozen) {
    // camera orbit always runs (menus freeze the body, not the view)
    this.camYaw -= inp.lookDX * 0.0026;
    this.camPitch = clamp(this.camPitch + inp.lookDY * 0.0022, -0.5, 1.15);
    this._camDistTarget = clamp(this._camDistTarget + inp.wheel * 0.9, 3, 14);
    this.camDist += (this._camDistTarget - this.camDist) * Math.min(1, dt * 8);

    if (this.riding) {
      // parented to the saddle by main.js — hold the riding pose
      this.root.visible = true;
      this.root.position.set(0, 0.1, 0);
      this.torso.rotation.x = 0.14;
      this.torso.position.y = 0.95;
      this.legL.rotation.set(0.95, 0, -0.42);
      this.legR.rotation.set(0.95, 0, 0.42);
      this.armL.rotation.x = -0.65;
      this.armR.rotation.x = -0.65;
      this.cloak.rotation.x = -0.25;
      return;
    }
    if (frozen) return;
    this.root.visible = true;

    const ground = this.groundAt(this.pos.x, this.pos.z);
    const inWater = ground < SEA_LEVEL - 1.3 && this.pos.y < SEA_LEVEL + 0.15;
    const wasSwimming = this.swimming;
    this.swimming = inWater;
    if (this.swimming && !wasSwimming && this.onSplash) this.onSplash();

    // stamina
    const wantSprint = inp.sprint && (Math.abs(inp.moveX) + Math.abs(inp.moveZ)) > 0.05;
    const canSprint = this.stamina > 0.03;
    if (this.swimming) this.stamina = Math.max(0, this.stamina - dt * 0.02);
    else if (wantSprint && canSprint) this.stamina = Math.max(0, this.stamina - dt * 0.11);
    else this.stamina = Math.min(1, this.stamina + dt * 0.13);

    // desired velocity in camera space
    let speedCap = this.swimming ? SWIM : wantSprint && canSprint ? SPRINT : (Math.abs(inp.moveX) + Math.abs(inp.moveZ)) > 0.6 ? RUN : WALK;
    if (this.staggerT > 0) { speedCap *= 0.35; this.staggerT -= dt; }
    if (this.stamina <= 0.01 && this.swimming) speedCap = 1.4;
    const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
    const dx = (inp.moveX * cos - inp.moveZ * sin);
    const dz = (-inp.moveX * sin - inp.moveZ * cos);
    const mag = Math.hypot(dx, dz);
    const tx = mag > 0.01 ? (dx / Math.max(1, mag)) * speedCap * Math.min(1, mag) : 0;
    const tz = mag > 0.01 ? (dz / Math.max(1, mag)) * speedCap * Math.min(1, mag) : 0;

    // steep ground slows the climb
    const slope = this.world.slopeAt(this.pos.x, this.pos.z);
    const slopeMul = this.swimming ? 1 : lerp(1, 0.35, clamp((slope - 0.7) / 0.8, 0, 1));
    this.vel.x += (tx * slopeMul - this.vel.x) * Math.min(1, dt * (this.onGround || this.swimming ? ACCEL : 6) / speedCap * 3);
    this.vel.z += (tz * slopeMul - this.vel.z) * Math.min(1, dt * (this.onGround || this.swimming ? ACCEL : 6) / speedCap * 3);

    if (this.swimming) {
      const bob = Math.sin(performance.now() * 0.002) * 0.08;
      this.pos.y += ((SEA_LEVEL - 0.38 + bob) - this.pos.y) * Math.min(1, dt * 5);
      this.vel.y = 0;
      this.onGround = false;
    } else {
      if (inp.jump && this.onGround && this.stamina > 0.02) {
        this.vel.y = 7.6;
        this.onGround = false;
        this.stamina = Math.max(0, this.stamina - 0.05);
        if (this.onStep) this.onStep('jump');
      }
      this.vel.y -= 21 * dt;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    const newGround = this.groundAt(this.pos.x, this.pos.z);
    if (!this.swimming) {
      if (this.pos.y <= newGround) {
        if (this.vel.y < -13 && this.onLand) { this.onLand(this.vel.y); this.staggerT = 0.8; }
        else if (this.vel.y < -3 && this.onStep) this.onStep(this.surface());
        this.pos.y = newGround;
        this.vel.y = 0;
        this.onGround = true;
      } else if (this.pos.y - newGround < 0.25 && this.vel.y <= 0.01) {
        // glue to ground going downhill
        this.pos.y = newGround;
        this.vel.y = 0;
        this.onGround = true;
      } else {
        this.onGround = false;
      }
    }

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.distanceTraveled += hSpeed * dt;

    // face where we go
    if (hSpeed > 0.3) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 10);
    }

    // ---- pose the rig ----
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    const runF = clamp(hSpeed / RUN, 0, 1.4);
    this.phase += dt * (3 + hSpeed * 2.1);
    const sw = Math.sin(this.phase) * 0.72 * runF;
    if (this.swimming) {
      this.torso.rotation.x = 1.15;
      this.legL.rotation.x = Math.sin(this.phase * 1.6) * 0.35;
      this.legR.rotation.x = -Math.sin(this.phase * 1.6) * 0.35;
      this.armL.rotation.x = Math.sin(this.phase * 1.6) * 0.9 + 0.6;
      this.armR.rotation.x = -Math.sin(this.phase * 1.6) * 0.9 + 0.6;
    } else if (!this.onGround) {
      this.torso.rotation.x = 0.12;
      this.legL.rotation.x = 0.5; this.legR.rotation.x = -0.3;
      this.armL.rotation.x = -0.5; this.armR.rotation.x = -0.5;
    } else {
      this.torso.rotation.x = runF * 0.14;
      this.legL.rotation.x = sw;
      this.legR.rotation.x = -sw;
      this.armL.rotation.x = -sw * 0.8;
      this.armR.rotation.x = sw * 0.8;
      const breathe = Math.sin(this.phase * 0.4) * 0.012;
      this.torso.position.y = 0.95 + Math.abs(Math.sin(this.phase)) * 0.05 * runF + breathe;
      this.cloak.rotation.x = -runF * 0.35 + Math.sin(this.phase * 0.9) * 0.05;
      // footstep pulses at each leg extreme
      if (runF > 0.15) {
        const p = Math.sin(this.phase);
        if (this._stepPulse <= 0 && Math.abs(p) > 0.92) {
          if (this.onStep) this.onStep(this.surface());
          this._stepPulse = 0.25;
        }
      }
    }
    this._stepPulse -= dt;
  }

  // Third-person camera with a terrain-aware boom.
  applyCamera(camera, dt) {
    const anchor = this.riding ? this.riding.seatWorld() : this.pos;
    const ty = anchor.y + (this.swimming ? 1.0 : 1.6);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const bx = anchor.x - Math.sin(this.camYaw) * cp * this.camDist;
    const bz = anchor.z - Math.cos(this.camYaw) * cp * this.camDist;
    let by = ty + sp * this.camDist;
    // keep the boom out of the hillside (sample a few points along it)
    for (let f = 0.35; f <= 1; f += 0.22) {
      const sx = anchor.x + (bx - anchor.x) * f;
      const sz = anchor.z + (bz - anchor.z) * f;
      const g = this.world.heightAt(sx, sz) + 0.5;
      const yAt = ty + (by - ty) * f;
      if (yAt < g) by += (g - yAt) / f;
    }
    camera.position.set(bx, by, bz);
    camera.lookAt(anchor.x, ty, anchor.z);
  }
}
