// The thing in the store. A gaunt, too-tall figure built from sculpted lathe
// segments on a joint hierarchy, animated procedurally (no keyframes).
import * as THREE from 'three';
import { clamp, lerp, damp, makeNoise, rng } from './util.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const NZ = makeNoise(404);

// Organic radial displacement for lathe geometry (seam-safe).
function roughen(g, amount, seed, freq = 3) {
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-4) continue;
    const a = Math.atan2(v.z, v.x);
    const n = NZ(Math.cos(a) * freq + seed * 3.1 + v.y * 9, Math.sin(a) * freq + v.y * 13 + seed) - 0.5;
    const k = 1 + n * amount;
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

// A limb hanging from its joint along -Y.
function limb(len, r0, r1, { knob0 = 0, knob1 = 0, belly = 0, bellyAt = 0.3, seg = 10, rough = 0.12, seed = 1 } = {}) {
  const pts = [];
  const n = 16;
  pts.push(V2(0.0005, -len - r1 * 0.6));
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    let r = lerp(r0, r1, t);
    r += knob0 * Math.exp(-Math.pow(t / 0.09, 2));
    r += knob1 * Math.exp(-Math.pow((1 - t) / 0.08, 2));
    r += belly * Math.exp(-Math.pow((t - bellyAt) / 0.22, 2));
    pts.push(V2(Math.max(0.004, r), -t * len));
  }
  pts.push(V2(0.0005, r0 * 0.6));
  return roughen(new THREE.LatheGeometry(pts, seg), rough, seed);
}

function torsoGeo() {
  // waist -> ribcage -> shoulders, then flattened front-to-back
  const prof = [[0.0005, -0.02], [0.1, 0.0], [0.115, 0.08], [0.105, 0.16], [0.13, 0.24], [0.17, 0.33], [0.185, 0.42], [0.18, 0.5], [0.15, 0.56], [0.08, 0.6], [0.0005, 0.61]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => V2(r, y)), 18);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    x *= 1.35;
    z *= 0.72;
    // ribs: ridges on the front and sides of the chest
    if (y > 0.18 && y < 0.5) {
      const front = Math.max(0, z / 0.14 + 0.35);
      const rib = Math.max(0, Math.sin(y * 62)) * 0.016 * clamp(front, 0, 1);
      const s = 1 + rib / Math.max(0.05, Math.hypot(x, z));
      x *= s; z *= s;
    }
    // sunken belly
    if (y < 0.18 && z > 0) z *= 0.75;
    // spine groove
    if (z < 0 && Math.abs(x) < 0.03) z *= 0.9;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return roughen(g, 0.06, 7, 4);
}

function headGeo() {
  const g = new THREE.SphereGeometry(1, 26, 20);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const sockets = [new THREE.Vector3(0.048, 0.035, 0.155), new THREE.Vector3(-0.048, 0.035, 0.155)];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let x = v.x * 0.105, y = v.y * 0.13, z = v.z * 0.17;
    if (z < 0) { z *= 1.35; y += -z * 0.18; } // long back of the skull
    if (y < -0.04 && z > 0) { x *= 0.72; z *= 1.08; } // narrow muzzle
    if (z > 0.1) z = 0.1 + (z - 0.1) * 0.6; // flat face
    // cheekbones
    if (y > -0.03 && y < 0.02 && z > 0.05) x *= 1.08;
    // deep eye sockets
    for (const s of sockets) {
      const d = Math.hypot(x - s.x, y - s.y, (z - s.z) * 0.8);
      if (d < 0.05) z -= (0.05 - d) * 0.9;
    }
    // brow ridge
    if (y > 0.055 && y < 0.085 && z > 0.08) z += 0.008;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return roughen(g, 0.035, 3, 5);
}

function jawGeo() {
  const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let x = v.x * 0.07, y = v.y * 0.055, z = v.z * 0.13 + 0.06;
    if (z > 0.1) x *= 0.8;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function teethGeo(radius, count, down, spread = Math.PI * 0.75) {
  const parts = [];
  const R = rng(down ? 3 : 4);
  for (let i = 0; i < count; i++) {
    const a = -spread / 2 + (spread * i) / (count - 1);
    const len = R.range(0.025, 0.055) * (Math.abs(a) < 0.5 ? 1.25 : 0.75);
    const c = new THREE.ConeGeometry(0.005, len, 4);
    c.rotateX(down ? Math.PI : 0);
    c.translate(Math.sin(a) * radius * 0.6, (down ? -1 : 1) * len / 2, Math.cos(a) * radius);
    parts.push(c);
  }
  // merge
  const g = new THREE.BufferGeometry();
  const pos = [], nor = [];
  for (const c of parts) {
    const n = c.toNonIndexed();
    pos.push(...n.attributes.position.array);
    nor.push(...n.attributes.normal.array);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export class MonsterModel {
  constructor(T, cfg) {
    const physical = cfg.post === 'full';
    const skinMat = physical
      ? new THREE.MeshPhysicalMaterial({ map: T.skin.map, normalMap: T.skin.normalMap, normalScale: new THREE.Vector2(1.6, 1.6), roughnessMap: T.skin.roughnessMap, color: 0x8c857b, roughness: 0.7, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.25, sheenColor: new THREE.Color(0x5a3030) })
      : new THREE.MeshStandardMaterial({ map: T.skin.map, normalMap: T.skin.normalMap, normalScale: new THREE.Vector2(1.6, 1.6), roughnessMap: T.skin.roughnessMap, color: 0x8c857b, roughness: 0.6 });
    const darkMat = skinMat.clone();
    darkMat.color = new THREE.Color(0x6f6862);
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xcdbf9f, roughness: 0.35 });
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.3, metalness: 0.1 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 0.4 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(0xfff2c0), emissiveIntensity: 0.6, roughness: 0.1 });
    this.mats = [skinMat, darkMat];

    const G = () => new THREE.Group();
    const M = (geo, mat) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cfg.shadows;
      m.receiveShadow = cfg.shadows;
      return m;
    };
    const root = (this.root = G());
    const hips = (this.hips = G());
    hips.position.y = 1.28;
    root.add(hips);
    const pelvis = M(new THREE.SphereGeometry(1, 14, 10), skinMat);
    pelvis.scale.set(0.15, 0.1, 0.1);
    hips.add(pelvis);

    // spine
    this.spine = G();
    this.spine.position.y = 0.04;
    hips.add(this.spine);
    const torso = M(torsoGeo(), skinMat);
    torso.position.y = -0.02;
    this.spine.add(torso);
    // vertebrae knobs down the back
    for (let i = 0; i < 9; i++) {
      const k = M(new THREE.SphereGeometry(0.018 - i * 0.0008, 6, 5), skinMat);
      k.position.set(0, 0.05 + i * 0.058, -0.088 - Math.sin((i / 8) * Math.PI) * 0.03);
      this.spine.add(k);
    }
    this.chest = G();
    this.chest.position.y = 0.5;
    this.spine.add(this.chest);
    // neck + head
    this.neck = G();
    this.neck.position.set(0, 0.08, 0.02);
    this.chest.add(this.neck);
    const neckM = M(limb(0.24, 0.045, 0.06, { rough: 0.15, seed: 9 }), skinMat);
    neckM.rotation.x = Math.PI; // grows upward
    this.neck.add(neckM);
    this.head = G();
    this.head.position.set(0, 0.24, 0.02);
    this.neck.add(this.head);
    const skull = M(headGeo(), skinMat);
    skull.position.set(0, 0.07, 0.03);
    this.head.scale.setScalar(1.18);
    this.head.add(skull);
    this.jaw = G();
    this.jaw.position.set(0, 0.02, -0.01);
    this.head.add(this.jaw);
    const jawM = M(jawGeo(), skinMat);
    this.jaw.add(jawM);
    const mouth = M(new THREE.SphereGeometry(1, 10, 8), mouthMat);
    mouth.scale.set(0.05, 0.03, 0.08);
    mouth.position.set(0, 0.0, 0.1);
    this.head.add(mouth);
    const upper = M(teethGeo(0.12, 18, true), boneMat);
    upper.position.set(0, 0.02, 0.035);
    this.head.add(upper);
    const lower = M(teethGeo(0.105, 16, false), boneMat);
    lower.position.set(0, -0.012, 0.035);
    this.jaw.add(lower);
    // empty black sockets around small glinting eyes
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const sx of [-1, 1]) {
      const so = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), socketMat);
      so.position.set(sx * 0.048, 0.104, 0.148);
      so.scale.set(1, 0.85, 0.55);
      this.head.add(so);
    }
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), this.eyeMat);
      e.position.set(s * 0.048, 0.102, 0.158);
      this.head.add(e);
      this.eyes.push(e);
    }

    // arms
    this.arms = [];
    for (const s of [1, -1]) {
      const shoulder = G();
      shoulder.position.set(s * 0.2, 0.02, -0.01);
      this.chest.add(shoulder);
      const knob = M(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
      knob.scale.set(1, 0.8, 1);
      shoulder.add(knob);
      const upperArm = M(limb(0.58, 0.05, 0.035, { knob0: 0.012, knob1: 0.015, belly: 0.012, seed: 11 + s }), skinMat);
      shoulder.add(upperArm);
      const elbow = G();
      elbow.position.y = -0.58;
      shoulder.add(elbow);
      const fore = M(limb(0.6, 0.04, 0.026, { knob0: 0.012, knob1: 0.01, belly: 0.008, bellyAt: 0.2, seed: 13 + s }), skinMat);
      elbow.add(fore);
      const wrist = G();
      wrist.position.y = -0.6;
      elbow.add(wrist);
      const palm = M(new THREE.SphereGeometry(1, 10, 8), darkMat);
      palm.scale.set(0.045, 0.07, 0.022);
      palm.position.y = -0.05;
      wrist.add(palm);
      const fingers = [];
      for (let f = 0; f < 4; f++) {
        const fx = (f - 1.5) * 0.022;
        let parent = G();
        parent.position.set(fx, -0.105, 0.005);
        parent.rotation.z = (f - 1.5) * 0.08 * s;
        wrist.add(parent);
        const segs = [];
        const lens = [0.13, 0.11, 0.085];
        for (let k = 0; k < 3; k++) {
          const seg = k === 0 ? parent : G();
          if (k > 0) {
            seg.position.y = -lens[k - 1];
            segs[k - 1].add(seg);
          }
          seg.add(M(limb(lens[k], 0.011 - k * 0.002, 0.008 - k * 0.0015, { knob1: 0.003, seg: 6, rough: 0.1, seed: f * 3 + k }), darkMat));
          segs.push(seg);
        }
        const claw = M(new THREE.ConeGeometry(0.006, 0.05, 5), clawMat);
        claw.rotation.x = Math.PI + 0.3;
        claw.position.set(0, -lens[2] - 0.02, 0.006);
        segs[2].add(claw);
        fingers.push(segs);
      }
      // thumb
      const thumb = G();
      thumb.position.set(s * 0.035, -0.06, 0.02);
      thumb.rotation.z = s * 0.7;
      thumb.add(M(limb(0.09, 0.01, 0.007, { seg: 6, seed: 40 }), darkMat));
      wrist.add(thumb);
      this.arms.push({ s, shoulder, elbow, wrist, fingers });
    }

    // legs (digitigrade-ish: long shin, raised heel)
    this.legs = [];
    for (const s of [1, -1]) {
      const hip = G();
      hip.position.set(s * 0.1, -0.04, 0);
      hips.add(hip);
      hip.add(M(limb(0.62, 0.075, 0.045, { knob1: 0.02, belly: 0.025, bellyAt: 0.25, seed: 21 + s }), skinMat));
      const knee = G();
      knee.position.y = -0.62;
      hip.add(knee);
      knee.add(M(limb(0.6, 0.048, 0.03, { knob0: 0.02, knob1: 0.012, belly: 0.012, bellyAt: 0.2, seed: 23 + s }), skinMat));
      const ankle = G();
      ankle.position.y = -0.6;
      knee.add(ankle);
      const foot = M(limb(0.24, 0.032, 0.02, { seed: 25 + s, knob0: 0.01 }), darkMat);
      foot.rotation.x = -Math.PI / 2 + 0.25; // points forward
      ankle.add(foot);
      for (let t = 0; t < 3; t++) {
        const claw = M(new THREE.ConeGeometry(0.008, 0.06, 5), clawMat);
        claw.rotation.x = Math.PI / 2 + 0.4;
        claw.position.set((t - 1) * 0.025, -0.07, 0.24);
        ankle.add(claw);
      }
      this.legs.push({ s, hip, knee, ankle });
    }

    // animation state
    this.phase = 0;
    this.t = 0;
    this.w = { walk: 0, run: 0, sniff: 0, peer: 0, reach: 0, scream: 0, idle: 1, crouch: 0 };
    this.target = { ...this.w };
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.lookTarget = null; // world Vector3
    this.twitch = { yaw: 0, pitch: 0, roll: 0, next: 0.5 };
    this.jaw.rotation.x = 0.1;
    this.R = rng(77);
    this._v = new THREE.Vector3();
    this.footDown = [false, false];
    this.onStep = null;
  }

  set(k, v) { this.target[k] = v; }

  update(dt, speed) {
    this.t += dt;
    const W = this.w, Tg = this.target;
    for (const k in W) W[k] = damp(W[k], Tg[k], k === 'scream' || k === 'reach' ? 9 : 4, dt);
    // gait
    const run = clamp((speed - 2.2) / 2.0, 0, 1);
    const moving = clamp(speed / 0.6, 0, 1);
    W.run = damp(W.run, run * moving, 5, dt);
    W.walk = damp(W.walk, (1 - run) * moving, 5, dt);
    const stride = lerp(0.95, 2.1, W.run);
    this.phase += (speed / stride) * Math.PI * dt;
    const ph = this.phase;
    const sinP = Math.sin(ph), cosP = Math.cos(ph);
    const gait = Math.max(W.walk, W.run);

    // footstep events at the bottom of each swing
    const fdown = [sinP > 0.9, sinP < -0.9];
    for (let i = 0; i < 2; i++) {
      if (fdown[i] && !this.footDown[i] && gait > 0.2 && this.onStep) this.onStep(i, W.run);
      this.footDown[i] = fdown[i];
    }

    // twitchy head targets
    this.twitch.next -= dt;
    if (this.twitch.next <= 0) {
      const R = this.R;
      this.twitch.yaw = R.range(-0.5, 0.5) * (1 - W.run * 0.7);
      this.twitch.pitch = R.range(-0.25, 0.3);
      this.twitch.roll = R.range(-0.5, 0.5) * (R() < 0.3 ? 1 : 0.2);
      this.twitch.next = R.range(0.25, 2.2) * (W.sniff > 0.5 ? 0.4 : 1);
    }

    const crouch = Math.max(W.peer, W.crouch * 0.6);
    // hips
    const bob = Math.abs(sinP) * (0.03 + W.run * 0.05) * gait;
    this.hips.position.y = 1.28 - crouch * 0.62 - W.run * 0.1 + bob - W.reach * 0.08;
    this.hips.rotation.y = sinP * 0.12 * gait;
    this.hips.rotation.z = cosP * 0.05 * gait;
    // spine: permanent hunch, deeper when running/peering
    const breathe = Math.sin(this.t * (1.6 + W.sniff * 5)) * (0.015 + W.sniff * 0.02);
    this.spine.rotation.x = 0.46 + W.run * 0.4 + W.peer * 0.95 + W.sniff * 0.12 + W.reach * 0.25 - W.scream * 0.35 + breathe;
    this.spine.rotation.y = -sinP * 0.1 * gait;
    this.chest.rotation.x = 0.12 + W.peer * 0.35 - W.scream * 0.2 + breathe * 0.6;
    this.chest.rotation.z = Math.sin(this.t * 0.7) * 0.03;
    this.chest.scale.set(1 + breathe, 1, 1 + breathe * 1.5);

    // head look
    let ly = this.twitch.yaw, lp = this.twitch.pitch;
    if (this.lookTarget) {
      this.head.updateWorldMatrix(true, false);
      const hp = this._v.setFromMatrixPosition(this.head.matrixWorld);
      const dx = this.lookTarget.x - hp.x, dy = this.lookTarget.y - hp.y, dz = this.lookTarget.z - hp.z;
      const ry = this.root.rotation.y;
      // yaw relative to body facing
      const worldYaw = Math.atan2(dx, dz);
      let rel = worldYaw - ry;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      ly = clamp(rel, -1.3, 1.3) + this.twitch.yaw * 0.15;
      lp = -Math.atan2(dy, Math.hypot(dx, dz));
    }
    const snap = W.sniff > 0.5 ? 26 : 9;
    this.lookYaw = damp(this.lookYaw, ly, snap, dt);
    this.lookPitch = damp(this.lookPitch, lp, snap * 0.8, dt);
    // counter the body pitch so the head stays level-ish, then apply look
    const bodyPitch = this.spine.rotation.x + this.chest.rotation.x;
    this.neck.rotation.x = -bodyPitch * 0.35 + 0.35; // vulture neck: thrust forward
    this.head.rotation.x = -bodyPitch * 0.45 + this.lookPitch * 0.8 + Math.sin(this.t * 14) * 0.05 * W.sniff - W.scream * 0.5 * (1 - W.reach);
    this.neck.rotation.y = this.lookYaw * 0.4;
    this.head.rotation.y = this.lookYaw * 0.6;
    this.head.rotation.z = damp(this.head.rotation.z, this.twitch.roll * 0.6 * (1 - W.run), 6, dt);
    // jaw
    const jawOpen = 0.2 + W.scream * 0.75 + W.reach * 0.5 + W.sniff * Math.max(0, Math.sin(this.t * 9)) * 0.08 + W.run * 0.25;
    this.jaw.rotation.x = damp(this.jaw.rotation.x, jawOpen, 14, dt);

    // legs
    for (const L of this.legs) {
      const p = L.s > 0 ? ph : ph + Math.PI;
      const sw = Math.sin(p);
      const lift = Math.max(0, Math.cos(p));
      const amp = lerp(0.42, 0.85, W.run) * gait;
      L.hip.rotation.x = -sw * amp - 0.25 - crouch * 0.95 - W.run * 0.25;
      L.knee.rotation.x = 0.5 + lift * lerp(0.6, 1.3, W.run) * gait + crouch * 1.5 + W.run * 0.2;
      L.ankle.rotation.x = -0.45 - lift * 0.3 * gait - crouch * 0.4;
      L.hip.rotation.z = L.s * (0.06 + crouch * 0.18);
    }

    // arms: long, loose, swinging; reach forward when grabbing
    for (const A of this.arms) {
      const p = A.s > 0 ? ph + Math.PI : ph;
      const sw = Math.sin(p - 0.4);
      const swing = sw * lerp(0.25, 0.9, W.run) * gait;
      const reach = W.reach;
      // reaching: arms come up and wide, elbows bent, closing in around your head
      A.shoulder.rotation.x = lerp(-0.25 - swing - W.peer * 0.45 - W.run * 0.5 + W.scream * -0.4, -1.25, reach);
      A.shoulder.rotation.z = A.s * (0.12 + W.scream * 0.9 * (1 - reach) + W.peer * 0.25 + reach * 0.75) + Math.sin(this.t * 1.3 + A.s) * 0.02;
      A.shoulder.rotation.y = 0;
      A.elbow.rotation.x = lerp(-0.25 - Math.max(0, sw) * 0.4 * gait - W.run * 0.6, -0.95, reach) - W.peer * 0.3;
      A.wrist.rotation.x = -0.15 + Math.sin(this.t * 2 + A.s) * 0.05;
      // fingers: loose curl, twitch, splay when reaching
      A.fingers.forEach((segs, i) => {
        const tw = Math.sin(this.t * (5 + i) + i * 1.7) > 0.96 ? 0.4 : 0;
        const curl = lerp(0.35 + W.run * 0.25, -0.1, reach + W.scream * 0.6) + tw;
        segs[0].rotation.x = -curl * 0.8;
        segs[1].rotation.x = -curl;
        segs[2].rotation.x = -curl * 0.9;
      });
    }
  }

  setEyes(v) {
    this.eyeMat.emissiveIntensity = v;
  }
}
