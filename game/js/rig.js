// rig.js — the stickman, in 3D.
//
// A gray figure built from boxes: round-ish head, thin limbs, no face. Poses
// are hand-keyed per state and crossfaded, the way the snaptic shorts read —
// stiff, light, a little floaty.

import * as THREE from '../vendor/three.module.js';
import { COLORS, clamp, lerp, DEG, shade } from './util.js';
import { boxGeo, flatMat, makeShadow, cardboardBox } from './render.js';

export const PLAYER_H = 3.4;          // total height, world units
export const PLAYER_R = 0.55;         // collision radius
const LIMB = 0.3;

export class StickmanRig {
  constructor(opts = {}) {
    const tint = opts.color != null ? opts.color : COLORS.gray;
    this.color = tint;
    const mat = flatMat(tint);
    const dark = flatMat(shade(tint, -26));

    this.root = new THREE.Group();

    // hips → torso → head, so the whole upper body can lean as one
    this.hips = new THREE.Group();
    this.hips.position.y = 1.55;
    this.root.add(this.hips);

    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const spine = new THREE.Mesh(boxGeo(LIMB * 1.3, 1.0, LIMB * 1.05), mat);
    spine.position.y = 0.5;
    this.torso.add(spine);

    this.neck = new THREE.Group();
    this.neck.position.y = 1.0;
    this.torso.add(this.neck);
    const head = new THREE.Mesh(boxGeo(0.58, 0.56, 0.56), mat);
    head.position.y = 0.34;
    this.neck.add(head);
    // the little bevel that keeps the head from reading as a plain cube
    const crown = new THREE.Mesh(boxGeo(0.42, 0.12, 0.42), mat);
    crown.position.y = 0.68;
    this.neck.add(crown);

    // shoulders sit at the top of the spine
    this.armL = this.makeLimb(mat, dark, 1.05, 'arm');
    this.armR = this.makeLimb(mat, dark, 1.05, 'arm');
    this.armL.group.position.set(-0.36, 0.9, 0);
    this.armR.group.position.set(0.36, 0.9, 0);
    this.torso.add(this.armL.group, this.armR.group);
    // a shoulder block, so the silhouette reads as a body with arms on it
    const shoulders = new THREE.Mesh(boxGeo(0.86, 0.22, LIMB * 1.05), mat);
    shoulders.position.y = 0.95;
    this.torso.add(shoulders);

    this.legL = this.makeLimb(mat, dark, 1.45, 'leg');
    this.legR = this.makeLimb(mat, dark, 1.45, 'leg');
    this.legL.group.position.set(-0.17, 0, 0);
    this.legR.group.position.set(0.17, 0, 0);
    this.hips.add(this.legL.group, this.legR.group);

    // things the figure can hold
    this.hand = new THREE.Group();
    this.hand.position.set(0, -1.0, 0);
    this.armR.group.add(this.hand);
    this.blaster = makeBlaster();
    this.blaster.visible = false;
    this.hand.add(this.blaster);
    this.paddle = makePaddle();
    this.paddle.visible = false;
    this.hand.add(this.paddle);

    this.carry = new THREE.Group();          // a box held overhead
    this.carry.position.y = 3.5;
    this.root.add(this.carry);
    this.carried = cardboardBox(1.3);
    this.carried.visible = false;
    this.carry.add(this.carried);

    this.shadow = makeShadow(1.0);
    this.root.add(this.shadow);

    this.t = 0;
    this.state = 'idle';
    this.blend = { walk: 0, air: 0, aim: 0, pong: 0, sit: 0 };
    this.swing = 0;
    this.recoil = 0;
    this.aimPitch = 0;
  }

  makeLimb(mat, dark, len, kind) {
    const group = new THREE.Group();     // pivots at the joint
    const upper = new THREE.Mesh(boxGeo(LIMB, len * 0.55, LIMB), mat);
    upper.position.y = -len * 0.275;
    group.add(upper);
    const lowerPivot = new THREE.Group();
    lowerPivot.position.y = -len * 0.55;
    group.add(lowerPivot);
    const lower = new THREE.Mesh(boxGeo(LIMB * 0.92, len * 0.45, LIMB * 0.92), mat);
    lower.position.y = -len * 0.225;
    lowerPivot.add(lower);
    if (kind === 'leg') {
      const foot = new THREE.Mesh(boxGeo(LIMB * 1.1, LIMB * 0.7, LIMB * 1.9), dark);
      foot.position.set(0, -len * 0.45 - LIMB * 0.3, LIMB * 0.4);
      lowerPivot.add(foot);
    }
    return { group, lowerPivot, len };
  }

  setColor(tint) {
    if (tint === this.color) return;
    this.color = tint;
    const mat = flatMat(tint);
    const dark = flatMat(shade(tint, -26));
    this.root.traverse(o => {
      if (!o.isMesh) return;
      if (o.parent === this.hand || o.parent === this.carried) return;
      o.material = o.geometry.parameters && o.geometry.parameters.depth > o.geometry.parameters.width * 1.5 ? dark : mat;
    });
  }

  // st: {vel, onGround, holding:'box'|'blaster'|null, pong, dead, frozen, aimPitch, swinging}
  update(dt, st) {
    this.t += dt;
    const speed = st.speed || 0;
    const walking = st.onGround && speed > 0.6;
    const target = {
      walk: walking ? clamp(speed / 7, 0.25, 1) : 0,
      air: st.onGround ? 0 : 1,
      aim: st.holding === 'blaster' ? 1 : 0,
      pong: st.pong ? 1 : 0,
      sit: 0,
    };
    for (const k of Object.keys(this.blend)) {
      this.blend[k] = lerp(this.blend[k], target[k], clamp(dt * 11, 0, 1));
    }
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 3.2);
    this.aimPitch = lerp(this.aimPitch, st.aimPitch || 0, clamp(dt * 12, 0, 1));

    const B = this.blend;
    // cycle speed scales with how fast you're actually moving
    const cyc = this.t * (6.5 + speed * 0.9);
    const sw = Math.sin(cyc) * B.walk;
    const swb = Math.sin(cyc + Math.PI) * B.walk;
    const bounce = Math.abs(Math.sin(cyc)) * 0.09 * B.walk;

    // legs
    this.legL.group.rotation.x = sw * 0.85 - B.air * 0.5;
    this.legR.group.rotation.x = swb * 0.85 + B.air * 0.25;
    this.legL.lowerPivot.rotation.x = Math.max(0, -sw) * 0.9 + B.air * 0.75;
    this.legR.lowerPivot.rotation.x = Math.max(0, -swb) * 0.9 + B.air * 0.2;

    // arms: walking swing, or aiming, or holding a box, or paddle
    const armSwing = -sw * 0.7;
    let lx = armSwing, rx = -armSwing, lz = 0.17, rz = -0.17, ly = 0, ry = 0;
    let lLow = -0.25 * B.walk, rLow = -0.25 * B.walk;

    if (st.holding === 'box') {
      lx = lerp(lx, -2.55, 0.95); rx = lerp(rx, -2.55, 0.95);
      lz = 0.3; rz = -0.3;
      lLow = rLow = -0.15;
    }
    if (B.aim > 0.02) {
      rx = lerp(rx, -1.45 - this.aimPitch + this.recoil * 0.5, B.aim);
      rz = lerp(rz, -0.12, B.aim);
      rLow = lerp(rLow, -0.12, B.aim);
      lx = lerp(lx, -0.95 - this.aimPitch * 0.6, B.aim * 0.8);
      lz = lerp(lz, 0.55, B.aim * 0.8);
      lLow = lerp(lLow, -1.0, B.aim * 0.8);
    }
    if (B.pong > 0.02) {
      const s = this.swing > 0 ? Math.sin((1 - this.swing / 0.24) * Math.PI) : 0;
      rx = lerp(rx, -1.1 - s * 1.5, B.pong);
      rz = lerp(rz, -0.5 + s * 0.4, B.pong);
      lx = lerp(lx, -0.3, B.pong);
      lz = lerp(lz, 0.4, B.pong);
      rLow = lerp(rLow, -0.5, B.pong);
    }
    if (B.air > 0.02) {
      lx = lerp(lx, -1.9, B.air); rx = lerp(rx, -1.9, B.air * (1 - B.aim));
      lz = lerp(lz, 0.5, B.air); rz = lerp(rz, -0.5, B.air * (1 - B.aim));
    }

    this.armL.group.rotation.set(lx, ly, lz);
    this.armR.group.rotation.set(rx, ry, rz);
    this.armL.lowerPivot.rotation.x = lLow;
    this.armR.lowerPivot.rotation.x = rLow;

    // torso lean and idle breathing
    const idle = Math.sin(this.t * 1.6) * 0.02 * (1 - B.walk);
    this.torso.rotation.x = -0.05 - B.walk * 0.1 - B.air * 0.12 + idle + B.aim * 0.06;
    this.torso.rotation.z = Math.sin(cyc) * 0.05 * B.walk;
    this.hips.position.y = 1.55 + bounce - B.air * 0.05;
    this.hips.rotation.y = -Math.sin(cyc) * 0.09 * B.walk;
    this.neck.rotation.x = 0.04 + B.aim * (this.aimPitch * 0.5) - B.walk * 0.05;

    this.blaster.visible = st.holding === 'blaster';
    this.paddle.visible = !!st.pong;
    this.carried.visible = st.holding === 'box';
    if (st.holding === 'box') {
      this.carry.position.y = 3.45 + bounce;
      this.carried.rotation.y = Math.sin(this.t * 0.6) * 0.05;
    }

    // shadow hugs the ground under the figure
    if (st.groundY != null) {
      const lift = clamp(this.root.position.y - st.groundY, 0, 8);
      this.shadow.position.y = st.groundY - this.root.position.y + 0.03;
      const s = clamp(1 - lift * 0.07, 0.35, 1);
      this.shadow.scale.setScalar(s);
      this.shadow.material.opacity = clamp(0.85 - lift * 0.07, 0.15, 0.85);
      this.shadow.visible = true;
    } else {
      this.shadow.visible = false;
    }
  }

  swingPaddle() { this.swing = 0.24; }
  kick() { this.recoil = 1; }

  dispose() {
    this.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.dispose && !o.geometry.__shared) o.geometry.dispose(); });
  }
}

// ---------------------------------------------------------------- props
export function makeBlaster() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(boxGeo(0.22, 0.26, 0.95), flatMat(COLORS.darkgray));
  body.position.z = 0.3;
  g.add(body);
  const barrel = new THREE.Mesh(boxGeo(0.14, 0.14, 0.6), flatMat(COLORS.silver));
  barrel.position.z = 0.95;
  g.add(barrel);
  const grip = new THREE.Mesh(boxGeo(0.16, 0.4, 0.2), flatMat(COLORS.darkgray));
  grip.position.set(0, -0.24, 0.05);
  g.add(grip);
  const tip = new THREE.Mesh(boxGeo(0.2, 0.2, 0.1), flatMat(COLORS.lightgray));
  tip.position.z = 1.28;
  g.add(tip);
  g.rotation.x = Math.PI / 2;      // point along the arm
  g.position.y = -0.1;
  return g;
}

export function makePaddle() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(boxGeo(0.12, 0.34, 0.12), flatMat(COLORS.cardboard));
  g.add(handle);
  const face = new THREE.Mesh(boxGeo(0.62, 0.68, 0.1), flatMat(COLORS.red));
  face.position.y = -0.45;
  g.add(face);
  g.rotation.x = Math.PI;
  g.position.y = -0.1;
  return g;
}

export function makeBolt() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(boxGeo(0.14, 0.14, 0.85), flatMat(COLORS.lightgray));
  g.add(core);
  const tail = new THREE.Mesh(boxGeo(0.1, 0.1, 0.5), flatMat(COLORS.silver));
  tail.position.z = -0.55;
  g.add(tail);
  return g;
}

// The death effect: a puff of tumbling cardboard boxes.
export class BoxBurst {
  constructor(scene, x, y, z, count = 11) {
    this.scene = scene;
    this.parts = [];
    this.group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const s = 0.35 + Math.random() * 0.55;
      const m = cardboardBox(s);
      m.position.set(x + (Math.random() - 0.5) * 0.8, y + Math.random() * 1.8, z + (Math.random() - 0.5) * 0.8);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.group.add(m);
      this.parts.push({
        m,
        vx: (Math.random() - 0.5) * 9,
        vy: 3 + Math.random() * 7,
        vz: (Math.random() - 0.5) * 9,
        rx: (Math.random() - 0.5) * 9,
        ry: (Math.random() - 0.5) * 9,
        rest: false,
      });
    }
    this.life = 3.2;
    scene.add(this.group);
  }

  update(dt, world) {
    this.life -= dt;
    for (const p of this.parts) {
      if (p.rest) continue;
      p.vy -= 26 * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.m.rotation.x += p.rx * dt;
      p.m.rotation.y += p.ry * dt;
      const gy = world ? world.heightAt(p.m.position.x, p.m.position.z) : 0;
      const half = p.m.userData.size * 0.5;
      if (p.m.position.y - half <= gy) {
        p.m.position.y = gy + half;
        p.vy = -p.vy * 0.32;
        p.vx *= 0.6; p.vz *= 0.6;
        p.rx *= 0.4; p.ry *= 0.4;
        if (Math.abs(p.vy) < 1.2) { p.rest = true; p.m.rotation.x = Math.round(p.m.rotation.x / (Math.PI / 2)) * Math.PI / 2; }
      }
    }
    if (this.life < 0.8) {
      const k = clamp(this.life / 0.8, 0, 1);
      this.group.scale.setScalar(k);
    }
    return this.life > 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
  }
}
