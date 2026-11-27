// Story props: checkpoints, jump pads, Lost Swatches, Hue Cores, hub hatches.
// Each owns a THREE.Group under `parent` and exposes update(dt, t) / dispose().
import * as THREE from 'three';
import { part, rod, std, glowMat, canvasTexture, HFONT, BFONT, OUTLINE_S, OUTLINE_M, disposeTree } from './kit.js';

const UP = new THREE.Vector3(0, 1, 0);
export const JUMP_G = 24;

// Parabolic launch from a -> b peaking `apex` metres above the higher end.
export function launchArc(a, b, apex) {
  const top = Math.max(a.y, b.y) + apex;
  const vy = Math.sqrt(2 * JUMP_G * (top - a.y));
  const T = vy / JUMP_G + Math.sqrt(2 * (top - b.y) / JUMP_G);
  return { from: a.clone(), to: b.clone(), vy, T, vx: (b.x - a.x) / T, vz: (b.z - a.z) / T };
}
export function arcPoint(arc, t, out = new THREE.Vector3()) {
  return out.set(arc.from.x + arc.vx * t, arc.from.y + arc.vy * t - 0.5 * JUMP_G * t * t, arc.from.z + arc.vz * t);
}

// ---------------------------------------------------------------- checkpoint
export class Checkpoint {
  constructor(parent, pos, yaw) {
    this.pos = pos.clone();
    this.yaw = yaw;
    const g = this.root = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = yaw + Math.PI / 2;
    parent.add(g);
    const metal = std(0x3b3842, 0.4, 0.7);
    part(g, new THREE.CylinderGeometry(0.62, 0.7, 0.1, 24), metal, { pos: [0, 0.05, 0], shadow: false });
    this.ringMat = glowMat(0x8a8794, 1.2);
    part(g, new THREE.TorusGeometry(0.66, 0.05, 8, 32), this.ringMat, { pos: [0, 0.11, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    const post = new THREE.Group();
    post.position.set(0, 0, -1.05);
    g.add(post);
    part(post, new THREE.CylinderGeometry(0.05, 0.06, 2.5, 10), metal, { pos: [0, 1.25, 0], outline: OUTLINE_S });
    part(post, new THREE.SphereGeometry(0.1, 12, 10), std(0xffd21a, 0.3, 0.5), { pos: [0, 2.53, 0] });
    const geo = new THREE.PlaneGeometry(1.0, 0.62, 10, 4);
    geo.translate(0.5, 0, 0);
    this.flagGeo = geo;
    this.flagBase = Float32Array.from(geo.attributes.position.array);
    this.flagMat = new THREE.MeshStandardMaterial({ color: 0x8a8794, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x000000 });
    this.flag = part(post, geo, this.flagMat, { pos: [0.05, 2.12, 0] });
    this.active = false;
    this.t = Math.random() * 10;
    this.pulse = 0;
  }
  activate(color) {
    this.active = true;
    this.flagMat.color.set(color);
    this.flagMat.emissive.set(color).multiplyScalar(0.25);
    this.ringMat.color.set(color).multiplyScalar(2.4);
    this.pulse = 1;
  }
  update(dt) {
    this.t += dt;
    const a = this.flagGeo.attributes.position, b = this.flagBase;
    const amp = this.active ? 0.09 : 0.03;
    for (let i = 0; i < a.count; i++) {
      const x = b[i * 3];
      a.array[i * 3 + 2] = Math.sin(this.t * 6 - x * 5) * amp * x;
      a.array[i * 3 + 1] = b[i * 3 + 1] - (this.active ? 0 : x * 0.18);
    }
    a.needsUpdate = true;
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 1.2);
      this.flag.scale.setScalar(1 + this.pulse * 0.4);
    }
  }
  dispose() { disposeTree(this.root); }
}

// ---------------------------------------------------------------- jump pad
export class JumpPad {
  constructor(parent, def) {
    this.def = def;
    this.pos = def.pos.clone();
    this.arc = launchArc(def.pos, def.to, def.apex);
    const g = this.root = new THREE.Group();
    g.position.copy(def.pos);
    parent.add(g);
    const dir = new THREE.Vector3(def.to.x - def.pos.x, 0, def.to.z - def.pos.z).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    part(g, new THREE.CylinderGeometry(1.15, 1.3, 0.22, 28), std(0x2b2833, 0.45, 0.6), { pos: [0, 0.03, 0], outline: OUTLINE_S, shadow: false });
    this.topMat = glowMat(0xffb020, 1.4);
    part(g, new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28), this.topMat, { pos: [0, 0.16, 0], shadow: false });
    this.ringMat = glowMat(0xffe08a, 2.6, { transparent: true, opacity: 0.9, depthWrite: false });
    this.ring = part(g, new THREE.TorusGeometry(0.7, 0.05, 8, 32), this.ringMat, { pos: [0, 0.22, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    // chevrons pointing along the launch direction
    const chev = new THREE.Group();
    chev.rotation.y = yaw;
    g.add(chev);
    const cm = std(0x1b1530, 0.6);
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) part(chev, new THREE.BoxGeometry(0.08, 0.04, 0.4), cm, { pos: [s * 0.13, 0.2, -0.35 + i * 0.32], rot: [0, s * 0.75, 0], shadow: false });
    }
    // dotted preview of the arc
    const n = 18;
    this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat(0xffd04a, 1.8), n);
    this.dots.frustumCulled = false;
    this.dots.castShadow = false;
    parent.add(this.dots);
    this.nDots = n;
    this.t = 0;
    this.cool = 0;
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3();
  }
  update(dt, playerPos) {
    this.t += dt;
    const k = (this.t * 1.6) % 1;
    const near = !playerPos || Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z) < 11;
    this.dots.visible = near;
    this.ring.scale.setScalar(0.6 + k * 0.9);
    this.ringMat.opacity = 1 - k;
    for (let i = 0; i < this.nDots; i++) {
      const u = ((i + (this.t * 1.2) % 1) / this.nDots);
      arcPoint(this.arc, u * this.arc.T, this._p);
      const s = 0.55 + 0.45 * Math.sin(u * Math.PI);
      this._m.makeScale(s, s, s).setPosition(this._p);
      this.dots.setMatrixAt(i, this._m);
    }
    this.dots.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    disposeTree(this.root);
    this.dots.geometry.dispose(); this.dots.material.dispose();
    this.dots.parent?.remove(this.dots);
  }
}

// ---------------------------------------------------------------- lost swatch
export class Swatch {
  constructor(parent, pos, colors, collectedBefore) {
    this.pos = pos.clone();
    const g = this.root = new THREE.Group();
    g.position.copy(pos);
    parent.add(g);
    this.card = new THREE.Group();
    g.add(this.card);
    const echo = collectedBefore;
    const op = echo ? { transparent: true, opacity: 0.35, depthWrite: false } : {};
    part(this.card, new THREE.BoxGeometry(0.62, 1.0, 0.05), std(0xfffaf0, 0.5, 0, op), { outline: echo ? false : OUTLINE_S });
    colors.forEach((c, i) => {
      part(this.card, new THREE.BoxGeometry(0.5, 0.22, 0.07), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.35, ...op }), { pos: [0, 0.27 - i * 0.26, 0], shadow: false });
    });
    part(this.card, new THREE.TorusGeometry(0.07, 0.02, 6, 14), std(0xc0bcc8, 0.3, 0.8, op), { pos: [0, 0.43, 0.03], shadow: false });
    this.halo = part(g, new THREE.TorusGeometry(0.75, 0.03, 6, 40), glowMat(colors[1], echo ? 0.8 : 2.4, { transparent: true, opacity: echo ? 0.3 : 0.8, depthWrite: false }), { rot: [Math.PI / 2, 0, 0], shadow: false });
    this.t = Math.random() * 6;
    this.taken = false;
    this.echo = echo;
    this.colors = colors;
  }
  update(dt, fx) {
    if (this.taken) return;
    this.t += dt;
    this.card.rotation.y += dt * 1.8;
    this.card.position.y = Math.sin(this.t * 2.2) * 0.14;
    this.halo.rotation.z += dt;
    this.halo.position.y = -0.55 + Math.sin(this.t * 2.2) * 0.05;
    if (fx && !this.echo && Math.random() < dt * 6) {
      const a = Math.random() * Math.PI * 2;
      fx.spawn(new THREE.Vector3(this.pos.x + Math.cos(a) * 0.5, this.pos.y - 0.3, this.pos.z + Math.sin(a) * 0.5), new THREE.Vector3(0, 1.2, 0), this.colors[Math.floor(Math.random() * 3)], 0.04, 0.8, { grav: -0.05, drag: 1.5 });
    }
  }
  take() { this.taken = true; this.root.visible = false; }
  dispose() { disposeTree(this.root); }
}

// ---------------------------------------------------------------- hue core
export class HueCore {
  constructor(parent, pos, color, o = {}) {
    this.pos = pos.clone();
    this.color = new THREE.Color(color);
    const g = this.root = new THREE.Group();
    g.position.copy(pos);
    parent.add(g);
    const base = std(0x34313b, 0.45, 0.65);
    if (o.pedestal !== false) {
      part(g, new THREE.CylinderGeometry(1.3, 1.6, 0.5, 8), base, { pos: [0, 0.25, 0], outline: OUTLINE_M });
      part(g, new THREE.CylinderGeometry(0.9, 1.1, 0.3, 8), std(0x4a4652, 0.4, 0.6), { pos: [0, 0.65, 0] });
    }
    this.float = new THREE.Group();
    this.float.position.y = 2.3;
    g.add(this.float);
    this.mat = new THREE.MeshPhysicalMaterial({ color: this.color, roughness: 0.08, metalness: 0.1, clearcoat: 1, emissive: this.color, emissiveIntensity: 1.3, flatShading: true });
    const cg = new THREE.OctahedronGeometry(1, 0);
    cg.scale(0.75, 1.35, 0.75);
    this.crystal = part(this.float, cg, this.mat, { outline: OUTLINE_M });
    this.inner = part(this.float, new THREE.OctahedronGeometry(0.45, 0), glowMat(this.color, 3.5), { shadow: false });
    this.rings = [];
    for (let i = 0; i < 2; i++) {
      const r = part(this.float, new THREE.TorusGeometry(1.35 + i * 0.25, 0.035, 6, 48), glowMat(this.color, 2.6), { shadow: false });
      r.rotation.set(Math.PI / 2 + (i ? 0.5 : -0.4), i ? 0.3 : -0.2, 0);
      this.rings.push(r);
    }
    this.light = new THREE.PointLight(this.color, 26, 14, 1.6);
    this.light.position.y = 2.3;
    this.light.castShadow = false;
    g.add(this.light);
    this.locked = !!o.locked;
    if (this.locked) {
      this.domeMat = new THREE.MeshPhysicalMaterial({ color: 0x8b8794, roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.62, clearcoat: 1, depthWrite: false });
      this.dome = part(g, new THREE.SphereGeometry(1.95, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.6), this.domeMat, { pos: [0, 0.75, 0], shadow: false });
      this.dome.scale.y = 1.6;
      this.cage = [];
      const cm = std(0x55525d, 0.5, 0.7);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.cage.push(rod(g, [Math.cos(a) * 1.85, 0.7, Math.sin(a) * 1.85], [Math.cos(a) * 1.1, 4.3, Math.sin(a) * 1.1], 0.06, cm));
      }
    }
    this.t = 0;
    this.taken = false;
    this.rainbow = !!o.rainbow;
    this.setDim(this.locked);
  }
  setDim(on) {
    const k = on ? 0.25 : 1;
    this.mat.emissiveIntensity = 1.3 * k;
    this.light.intensity = 26 * k;
    this.inner.visible = !on;
  }
  unlock(fx) {
    if (!this.locked) return;
    this.locked = false;
    this.dome.visible = false;
    for (const c of this.cage) c.visible = false;
    this.setDim(false);
    if (fx) {
      const p = this.pos.clone().setY(this.pos.y + 2);
      fx.splash(p, UP, 0x8b8794, 40, 7, 0.12, 1.4);
      fx.ring(this.pos.clone().setY(this.pos.y + 0.8), this.color, 0.4, 4, 0.6, { alpha: 0.9 });
    }
  }
  update(dt, fx) {
    if (this.taken) return;
    this.t += dt;
    this.float.position.y = 2.3 + Math.sin(this.t * 1.6) * 0.18;
    this.crystal.rotation.y += dt * 0.9;
    this.inner.rotation.y -= dt * 2.2;
    this.rings[0].rotation.z += dt * 0.8;
    this.rings[1].rotation.z -= dt * 1.1;
    if (this.rainbow) {
      this.color.setHSL((this.t * 0.12) % 1, 0.85, 0.6);
      this.mat.color.copy(this.color); this.mat.emissive.copy(this.color);
      this.light.color.copy(this.color);
      this.inner.material.color.copy(this.color).multiplyScalar(3.5);
      for (const r of this.rings) r.material.color.copy(this.color).multiplyScalar(2.6);
    }
    if (fx && !this.locked && Math.random() < dt * 10) {
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.4;
      fx.spawn(new THREE.Vector3(this.pos.x + Math.cos(a) * r, this.pos.y + 0.8, this.pos.z + Math.sin(a) * r), new THREE.Vector3(0, 1.6 + Math.random(), 0), this.color, 0.05, 1.1, { grav: -0.05, drag: 1.2 });
    }
  }
  take() { this.taken = true; this.float.visible = false; this.light.visible = false; }
  dispose() { this.light.dispose?.(); disposeTree(this.root); }
}

// ---------------------------------------------------------------- hub hatch
function hatchSignTexture(num, name, status, color, swatch) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1b1530';
    ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 34); ctx.fill();
    ctx.strokeStyle = status === 'locked' ? '#55525d' : color;
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.roundRect(14, 14, w - 28, h - 28, 26); ctx.stroke();
    // number badge
    ctx.fillStyle = status === 'locked' ? '#55525d' : color;
    ctx.beginPath(); ctx.arc(92, 104, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1530';
    ctx.font = `86px ${HFONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 92, 110);
    ctx.textAlign = 'left';
    ctx.fillStyle = status === 'locked' ? '#8a8794' : '#ffffff';
    ctx.font = `50px ${HFONT}`;
    const words = name.toUpperCase();
    ctx.fillText(words, 168, 92, w - 190);
    ctx.font = `800 30px ${BFONT}`;
    ctx.fillStyle = status === 'cleared' ? '#7dff7a' : status === 'open' ? '#ffd21a' : '#8a8794';
    ctx.fillText(status === 'cleared' ? 'CLEARED ✓' : status === 'open' ? 'OPEN · PRESS E' : 'SEALED', 168, 148);
    if (status !== 'locked') {
      ctx.fillStyle = swatch ? '#ffd21a' : 'rgba(255,255,255,.25)';
      ctx.font = `800 26px ${BFONT}`;
      ctx.fillText(swatch ? '◆ Swatch found' : '◇ Swatch missing', 168, 196);
    }
  });
}

export class Hatch {
  constructor(parent, def, info, status, swatch) {
    this.id = def.id;
    this.pos = def.pos.clone();
    this.status = status;
    const color = new THREE.Color(info.color);
    const g = this.root = new THREE.Group();
    g.position.copy(def.pos);
    g.rotation.y = def.yaw;
    parent.add(g);
    const iron = std(0x3a3742, 0.45, 0.7);
    part(g, new THREE.CylinderGeometry(1.95, 2.05, 0.1, 32), iron, { pos: [0, 0.03, 0], shadow: false, receive: true });
    const lidMat = status === 'locked' ? std(0x5d5a66, 0.6, 0.5) : new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.5), roughness: 0.35, metalness: 0.5, emissive: color, emissiveIntensity: status === 'open' ? 0.9 : 0.35 });
    this.lidMat = lidMat;
    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.1, 0);
    g.add(this.lid);
    part(this.lid, new THREE.CylinderGeometry(1.55, 1.55, 0.08, 32), lidMat, { shadow: false });
    part(this.lid, new THREE.TorusGeometry(0.55, 0.08, 8, 24), iron, { pos: [0, 0.07, 0], rot: [Math.PI / 2, 0, 0], shadow: false });
    for (let i = 0; i < 4; i++) part(this.lid, new THREE.BoxGeometry(0.1, 0.06, 1.0), iron, { pos: [Math.sin(i * Math.PI / 2) * 0.55, 0.07, Math.cos(i * Math.PI / 2) * 0.55], rot: [0, i * Math.PI / 2, 0], shadow: false });
    if (status === 'locked') {
      const chain = std(0x2e2b35, 0.5, 0.8);
      for (const r of [0.7, -0.7]) part(g, new THREE.BoxGeometry(3.4, 0.1, 0.16), chain, { pos: [0, 0.2, 0], rot: [0, r, 0], shadow: false });
      part(g, new THREE.BoxGeometry(0.46, 0.5, 0.2), std(0x8a6a30, 0.4, 0.8), { pos: [0, 0.4, 0], outline: OUTLINE_S });
    }
    // arch + sign at the back of the hatch
    for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(0.22, 3.3, 0.22), iron, { pos: [s * 1.9, 1.65, -1.6], outline: OUTLINE_S });
    part(g, new THREE.BoxGeometry(4.1, 0.24, 0.26), iron, { pos: [0, 3.3, -1.6] });
    this.signTex = hatchSignTexture(info.num, info.name, status, info.color, swatch);
    const signMat = new THREE.MeshStandardMaterial({ map: this.signTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: this.signTex, emissiveIntensity: 0.55 });
    part(g, new THREE.PlaneGeometry(3.4, 1.7), signMat, { pos: [0, 2.25, -1.48], shadow: false });
    part(g, new THREE.BoxGeometry(3.5, 1.8, 0.08), iron, { pos: [0, 2.25, -1.54], shadow: false });
    this.beam = null;
    if (status !== 'locked') {
      this.beamMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.4), transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      this.beam = part(g, new THREE.CylinderGeometry(1.45, 1.55, 7, 32, 1, true), this.beamMat, { pos: [0, 3.6, 0], shadow: false });
    }
    if (status === 'cleared') {
      const cm = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.1, clearcoat: 1, flatShading: true });
      const cg = new THREE.OctahedronGeometry(0.42, 0); cg.scale(0.75, 1.35, 0.75);
      this.mini = part(g, cg, cm, { pos: [0, 1.6, 0], outline: OUTLINE_S });
    }
    this.color = color;
    this.t = Math.random() * 5;
  }
  update(dt, fx, playerPos) {
    this.t += dt;
    const near = playerPos ? Math.min(1, Math.max(0, (Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z) - 1.6) / 3)) : 1;
    if (this.mini) { this.mini.rotation.y += dt * 1.4; this.mini.position.y = 1.6 + Math.sin(this.t * 2) * 0.12; }
    if (this.beam) this.beamMat.opacity = (0.12 + Math.sin(this.t * 2.4) * 0.05) * near * (this.status === 'cleared' ? 0.45 : 1);
    if (this.status === 'open') {
      this.lidMat.emissiveIntensity = 0.7 + Math.sin(this.t * 3) * 0.3;
      if (fx && Math.random() < dt * 8) {
        const a = Math.random() * Math.PI * 2;
        fx.spawn(new THREE.Vector3(this.pos.x + Math.cos(a) * 1.4, this.pos.y + 0.2, this.pos.z + Math.sin(a) * 1.4), new THREE.Vector3(0, 2.2, 0), this.color, 0.05, 1.2, { grav: -0.05, drag: 1.2 });
      }
    }
  }
  dispose() { disposeTree(this.root); }
}

// ---------------------------------------------------------------- hub lift
export class Lift {
  constructor(parent, pos, yaw) {
    this.pos = pos.clone();
    const g = this.root = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = yaw;
    parent.add(g);
    const iron = std(0x4a4652, 0.5, 0.7), yellow = std(0xffc83d, 0.5, 0.3);
    part(g, new THREE.BoxGeometry(3.6, 0.12, 3.6), std(0x2e2b35, 0.6, 0.6), { pos: [0, 0.06, 0], receive: true, shadow: false });
    for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) part(g, new THREE.BoxGeometry(0.18, 14, 0.18), iron, { pos: [x, 7, z] });
    for (const y of [0.9, 3.2, 6, 9]) {
      part(g, new THREE.BoxGeometry(3.6, 0.1, 0.1), y < 1 ? yellow : iron, { pos: [0, y, 1.7], shadow: false });
      part(g, new THREE.BoxGeometry(3.6, 0.1, 0.1), iron, { pos: [0, y, -1.7], shadow: false });
      part(g, new THREE.BoxGeometry(0.1, 0.1, 3.6), iron, { pos: [1.7, y, 0], shadow: false });
    }
    // the cage itself, waiting at the bottom
    this.cab = new THREE.Group();
    g.add(this.cab);
    part(this.cab, new THREE.BoxGeometry(3.2, 0.1, 3.2), std(0x5a4a3a, 0.8, 0.1), { pos: [0, 0.16, 0], shadow: false, receive: true });
    for (let i = 0; i < 7; i++) part(this.cab, new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), iron, { pos: [-1.5 + i * 0.5, 1.4, -1.55], shadow: false });
    this.lamp = part(this.cab, new THREE.SphereGeometry(0.14, 12, 8), glowMat(0x7dff7a, 3), { pos: [1.3, 2.45, 1.3], shadow: false });
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.lamp.visible = Math.sin(this.t * 4) > -0.3;
  }
  dispose() { disposeTree(this.root); }
}

// small core display shelf near Captain Veil
export class CoreShelf {
  constructor(parent, pos, yaw, infos, cleared) {
    const g = this.root = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = yaw;
    parent.add(g);
    const wood = std(0x6b4a32, 0.8, 0.05), iron = std(0x3a3742, 0.45, 0.7);
    part(g, new THREE.BoxGeometry(7.4, 0.9, 1.1), wood, { pos: [0, 0.45, 0], outline: OUTLINE_S });
    this.cores = [];
    infos.forEach((info, i) => {
      const x = -2.9 + i * 1.45;
      part(g, new THREE.CylinderGeometry(0.42, 0.5, 0.22, 12), iron, { pos: [x, 1.0, 0], shadow: false });
      if (cleared.includes(info.id)) {
        const c = new THREE.Color(info.color);
        const cg = new THREE.OctahedronGeometry(0.36, 0); cg.scale(0.75, 1.35, 0.75);
        const m = part(g, cg, new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 1.5, roughness: 0.1, clearcoat: 1, flatShading: true }), { pos: [x, 1.55, 0], outline: OUTLINE_S });
        this.cores.push(m);
      } else {
        part(g, new THREE.OctahedronGeometry(0.2, 0), std(0x2b2833, 0.9), { pos: [x, 1.25, 0], shadow: false });
      }
    });
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.cores.forEach((m, i) => { m.rotation.y += dt * 1.2; m.position.y = 1.55 + Math.sin(this.t * 2 + i) * 0.06; });
  }
  dispose() { disposeTree(this.root); }
}

