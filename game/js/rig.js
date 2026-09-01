// rig.js — the avatar.
//
// A blocky sandbox-MMO figure, the way the snaptic shorts draw their players:
// slab torso, stiff straight limbs that swing like pendulums, square head with
// two dark eyes and nothing else. Every part is a box, shaded per-part so the
// silhouette reads even at a few pixels tall. The lead avatar is silver; other
// players get their own quiet tint (green first — of course).

import * as THREE from '../vendor/three.module.js';
import { clamp, lerp, shade, hash2, COLORS } from './util.js';
import { boxGeo, flatMat, makeShadow, cardboardBox } from './render.js';

export const PLAYER_H = 3.4;
export const PLAYER_R = 0.55;

// silver first, then the green friend, then quiet company
export const AVATAR_TINTS = [0xb4b8bc, 0x8fae85, 0x8fa3b8, 0xbaa98c, 0xa893a5, 0xb0a878];

export function tintForName(name) {
  const s = String(name || 'guest');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

// proportions (world units)
const LEG_H = 1.42, LEG_W = 0.44, LEG_D = 0.5;
const TORSO_H = 1.16, TORSO_W = 1.04, TORSO_D = 0.56;
const ARM_H = 1.26, ARM_W = 0.32, ARM_D = 0.4;
const HIP_Y = LEG_H;                       // legs pivot here
const SHOULDER_Y = HIP_Y + TORSO_H - 0.14; // arms pivot here
const HEAD_Y = HIP_Y + TORSO_H;            // head base

export class StickmanRig {
  constructor(opts = {}) {
    this.tint = opts.color != null ? opts.color : AVATAR_TINTS[0];
    this.root = new THREE.Group();
    this.build();

    this.t = 0;
    this.blend = { walk: 0, air: 0, aim: 0, pong: 0, carry: 0, arcade: 0 };
    this.swing = 0;
    this.recoil = 0;
    this.aimPitch = 0;
    this.spawnPop = 0.25;      // little grow-in when the figure appears
  }

  build() {
    const tint = this.tint;
    const headMat = flatMat(shade(tint, 16));
    const torsoMat = flatMat(tint);
    const torsoLite = flatMat(shade(tint, 8));
    const armMat = flatMat(shade(tint, -10));
    const legMat = flatMat(shade(tint, -18));
    const capMat = flatMat(shade(tint, -38));
    const eyeMat = flatMat(0x34373a);

    this.body = new THREE.Group();         // everything above the feet
    this.root.add(this.body);

    // ---- legs: stiff blocks with darker feet
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (TORSO_W / 2 - LEG_W / 2 - 0.02), HIP_Y, 0);
      const leg = new THREE.Mesh(boxGeo(LEG_W, LEG_H, LEG_D), legMat);
      leg.position.y = -LEG_H / 2;
      pivot.add(leg);
      const foot = new THREE.Mesh(boxGeo(LEG_W + 0.05, 0.22, LEG_D + 0.18), capMat);
      foot.position.set(0, -LEG_H + 0.11, 0.08);
      pivot.add(foot);
      this.body.add(pivot);
      return pivot;
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);

    // ---- torso: slab with a lighter chest panel and a belt line
    this.torso = new THREE.Group();
    this.torso.position.y = HIP_Y;
    this.body.add(this.torso);
    const chest = new THREE.Mesh(boxGeo(TORSO_W, TORSO_H, TORSO_D), torsoMat);
    chest.position.y = TORSO_H / 2;
    this.torso.add(chest);
    const panel = new THREE.Mesh(boxGeo(TORSO_W * 0.72, TORSO_H * 0.6, 0.05), torsoLite);
    panel.position.set(0, TORSO_H * 0.58, TORSO_D / 2);
    this.torso.add(panel);
    const belt = new THREE.Mesh(boxGeo(TORSO_W + 0.04, 0.16, TORSO_D + 0.04), capMat);
    belt.position.y = 0.08;
    this.torso.add(belt);

    // ---- arms: pivots at the shoulders, hands as darker caps
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (TORSO_W / 2 + ARM_W / 2 + 0.03), SHOULDER_Y - HIP_Y, 0);
      const pad = new THREE.Mesh(boxGeo(ARM_W + 0.12, 0.3, ARM_D + 0.08), torsoMat);
      pad.position.y = 0.02;
      pivot.add(pad);
      const arm = new THREE.Mesh(boxGeo(ARM_W, ARM_H, ARM_D), armMat);
      arm.position.y = -ARM_H / 2 + 0.08;
      pivot.add(arm);
      const hand = new THREE.Mesh(boxGeo(ARM_W + 0.04, 0.26, ARM_D + 0.04), capMat);
      hand.position.y = -ARM_H + 0.18;
      pivot.add(hand);
      this.torso.add(pivot);
      return pivot;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    // ---- head: square, bevelled, two dark eyes, nothing else
    this.neck = new THREE.Group();
    this.neck.position.y = HEAD_Y;
    this.body.add(this.neck);
    const neckPeg = new THREE.Mesh(boxGeo(0.3, 0.14, 0.3), capMat);
    neckPeg.position.y = 0.05;
    this.neck.add(neckPeg);
    const head = new THREE.Mesh(boxGeo(0.72, 0.6, 0.66), headMat);
    head.position.y = 0.42;
    this.neck.add(head);
    const crown = new THREE.Mesh(boxGeo(0.58, 0.12, 0.52), headMat);
    crown.position.y = 0.77;
    this.neck.add(crown);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(boxGeo(0.11, 0.15, 0.04), eyeMat);
      eye.position.set(side * 0.15, 0.46, 0.34);
      this.neck.add(eye);
    }

    // ---- held things
    this.hand = new THREE.Group();
    this.hand.position.set(0, -ARM_H + 0.18, 0);
    this.armR.add(this.hand);
    this.blaster = makeBlaster();
    this.blaster.visible = false;
    this.hand.add(this.blaster);
    this.paddle = makePaddle();
    this.paddle.visible = false;
    this.hand.add(this.paddle);

    this.carryPoint = new THREE.Group();   // a box held overhead
    this.carryPoint.position.y = PLAYER_H + 0.25;
    this.root.add(this.carryPoint);
    this.carried = cardboardBox(1.3);
    this.carried.visible = false;
    this.carryPoint.add(this.carried);

    this.shadow = makeShadow(1.05);
    this.root.add(this.shadow);
  }

  setColor(tint) {
    if (tint === this.tint) return;
    this.tint = tint;
    // rebuild in place — cheap, happens only when a name/tint changes
    const keep = [this.shadow];
    for (const child of [...this.root.children]) {
      if (!keep.includes(child)) this.root.remove(child);
    }
    this.build();
  }

  // st: {speed, onGround, holding, pong, arcade, frozen, aimPitch, groundY}
  update(dt, st) {
    this.t += dt;
    const speed = st.speed || 0;
    const walking = st.onGround && speed > 0.6;
    const target = {
      walk: walking ? clamp(speed / 7, 0.3, 1.35) : 0,
      air: st.onGround ? 0 : 1,
      aim: st.holding === 'blaster' ? 1 : 0,
      carry: st.holding === 'box' ? 1 : 0,
      pong: st.pong ? 1 : 0,
      arcade: st.arcade ? 1 : 0,
    };
    for (const k of Object.keys(this.blend)) {
      this.blend[k] = lerp(this.blend[k], target[k], clamp(dt * 10, 0, 1));
    }
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 3.4);
    if (this.spawnPop > 0) this.spawnPop = Math.max(0, this.spawnPop - dt);
    this.aimPitch = lerp(this.aimPitch, st.aimPitch || 0, clamp(dt * 12, 0, 1));

    const B = this.blend;
    const cyc = this.t * (7 + speed * 0.85);
    const sw = Math.sin(cyc);
    const idle = Math.sin(this.t * 1.7);

    // ---- legs: stiff pendulums, tucked split in the air
    this.legL.rotation.x = sw * 0.62 * B.walk + B.air * 0.45;
    this.legR.rotation.x = -sw * 0.62 * B.walk - B.air * 0.28;
    this.legL.rotation.z = 0;
    this.legR.rotation.z = 0;

    // ---- arms: swing opposite the legs; poses override
    let lx = -sw * 0.5 * B.walk, rx = sw * 0.5 * B.walk;
    let lz = 0.1, rz = -0.1;

    if (B.carry > 0.03) {
      lx = lerp(lx, -2.5, B.carry); rx = lerp(rx, -2.5, B.carry);
      lz = lerp(lz, 0.28, B.carry); rz = lerp(rz, -0.28, B.carry);
    }
    if (B.aim > 0.03) {
      rx = lerp(rx, -Math.PI / 2 - this.aimPitch + this.recoil * 0.45, B.aim);
      rz = lerp(rz, 0, B.aim);
      lx = lerp(lx, -0.55, B.aim * 0.8);
      lz = lerp(lz, 0.42, B.aim * 0.8);
    }
    if (B.pong > 0.03) {
      const s = this.swing > 0 ? Math.sin((1 - this.swing / 0.24) * Math.PI) : 0;
      rx = lerp(rx, -0.9 - s * 1.3, B.pong);
      rz = lerp(rz, -0.35 + s * 0.3, B.pong);
      lx = lerp(lx, -0.35, B.pong);
      lz = lerp(lz, 0.3, B.pong);
    }
    if (B.arcade > 0.03) {
      lx = lerp(lx, -1.05, B.arcade); rx = lerp(rx, -1.05, B.arcade);
      lz = lerp(lz, 0.16, B.arcade); rz = lerp(rz, -0.16, B.arcade);
    }
    if (B.air > 0.03 && B.aim < 0.5 && B.carry < 0.5) {
      // arms straight up, the classic sandbox jump
      lx = lerp(lx, -2.95, B.air); rx = lerp(rx, -2.95, B.air);
      lz = lerp(lz, 0.35, B.air); rz = lerp(rz, -0.35, B.air);
    }
    this.armL.rotation.set(lx, 0, lz + idle * 0.015);
    this.armR.rotation.set(rx, 0, rz - idle * 0.015);

    // ---- body: bob, lean, breathe
    const bob = Math.abs(sw) * 0.1 * B.walk;
    this.body.position.y = bob - B.air * 0.06;
    this.body.rotation.x = B.walk * 0.06 + B.air * 0.1 + B.arcade * 0.12 - B.aim * 0.02;
    this.torso.rotation.y = sw * 0.06 * B.walk;
    this.neck.rotation.x = idle * 0.02 - B.walk * 0.05 + B.aim * this.aimPitch * 0.5;
    this.neck.rotation.y = -sw * 0.05 * B.walk;

    // spawn pop-in
    const pop = this.spawnPop > 0 ? 1 - this.spawnPop * 1.4 : 1;
    this.root.scale.setScalar(clamp(pop, 0.55, 1));

    // ---- held things
    this.blaster.visible = st.holding === 'blaster';
    this.paddle.visible = !!st.pong;
    this.carried.visible = st.holding === 'box';
    if (this.carried.visible) {
      this.carryPoint.position.y = PLAYER_H + 0.25 + bob;
      this.carried.rotation.y = Math.sin(this.t * 0.7) * 0.06;
    }

    // ---- ground shadow
    if (st.groundY != null) {
      const lift = clamp(this.root.position.y - st.groundY, 0, 9);
      this.shadow.position.y = st.groundY - this.root.position.y + 0.04;
      this.shadow.scale.setScalar(clamp(1 - lift * 0.06, 0.35, 1));
      this.shadow.material.opacity = clamp(0.85 - lift * 0.07, 0.15, 0.85);
      this.shadow.visible = true;
    } else {
      this.shadow.visible = false;
    }
  }

  swingPaddle() { this.swing = 0.24; }
  kick() { this.recoil = 1; }

  dispose() {
    this.root.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
  }
}

// ---------------------------------------------------------------- props
export function makeBlaster() {
  const g = new THREE.Group();
  const dark = flatMat(COLORS.darkgray);
  const body = new THREE.Mesh(boxGeo(0.24, 0.3, 0.9), dark);
  body.position.z = 0.32;
  g.add(body);
  const barrel = new THREE.Mesh(boxGeo(0.15, 0.15, 0.62), flatMat(COLORS.silver));
  barrel.position.set(0, 0.04, 0.98);
  g.add(barrel);
  const ring = new THREE.Mesh(boxGeo(0.22, 0.22, 0.1), flatMat(COLORS.lightgray));
  ring.position.set(0, 0.04, 0.78);
  g.add(ring);
  const tip = new THREE.Mesh(boxGeo(0.19, 0.19, 0.12), flatMat(0xe8b46a));
  tip.position.set(0, 0.04, 1.32);
  g.add(tip);
  const grip = new THREE.Mesh(boxGeo(0.18, 0.42, 0.22), dark);
  grip.position.set(0, -0.3, 0.12);
  grip.rotation.x = 0.2;
  g.add(grip);
  const fin = new THREE.Mesh(boxGeo(0.06, 0.16, 0.5), flatMat(COLORS.silver));
  fin.position.set(0, 0.24, 0.42);
  g.add(fin);
  g.rotation.x = Math.PI / 2;
  g.position.y = -0.05;
  return g;
}

export function makePaddle() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(boxGeo(0.13, 0.4, 0.13), flatMat(COLORS.cardboard));
  g.add(handle);
  const face = new THREE.Mesh(boxGeo(0.66, 0.72, 0.09), flatMat(0xb55c5c));
  face.position.y = -0.5;
  g.add(face);
  const edge = new THREE.Mesh(boxGeo(0.7, 0.76, 0.05), flatMat(0x8f4747));
  edge.position.y = -0.5;
  g.add(edge);
  g.rotation.x = Math.PI;
  g.position.y = -0.08;
  return g;
}

export function makeBolt() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(boxGeo(0.16, 0.16, 0.9), flatMat(0xf0e6c8));
  g.add(core);
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const glow = new THREE.Mesh(boxGeo(0.09, 0.09, 1.1), glowM);
  g.add(glow);
  const tail = new THREE.Mesh(boxGeo(0.1, 0.1, 0.4), flatMat(COLORS.silver));
  tail.position.z = -0.62;
  g.add(tail);
  return g;
}

// The death effect: a puff of tumbling cardboard boxes.
export class BoxBurst {
  constructor(scene, x, y, z, count = 12) {
    this.scene = scene;
    this.parts = [];
    this.group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const s = 0.35 + Math.random() * 0.6;
      const m = cardboardBox(s);
      m.position.set(x + (Math.random() - 0.5) * 0.8, y + Math.random() * 1.8, z + (Math.random() - 0.5) * 0.8);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.group.add(m);
      this.parts.push({
        m,
        vx: (Math.random() - 0.5) * 10,
        vy: 3.5 + Math.random() * 7.5,
        vz: (Math.random() - 0.5) * 10,
        rx: (Math.random() - 0.5) * 10,
        ry: (Math.random() - 0.5) * 10,
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
        if (Math.abs(p.vy) < 1.2) {
          p.rest = true;
          p.m.rotation.x = Math.round(p.m.rotation.x / (Math.PI / 2)) * Math.PI / 2;
          p.m.rotation.z = 0;
        }
      }
    }
    if (this.life < 0.8) this.group.scale.setScalar(clamp(this.life / 0.8, 0, 1));
    return this.life > 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
  }
}

export { hash2 };
