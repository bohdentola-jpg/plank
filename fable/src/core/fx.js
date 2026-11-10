// Cartoon effects: instanced billboard particles (puffs, stars, sparks,
// confetti, leaves…), comic impact bursts and camera shake. One Fx per scene.
import * as THREE from 'three';
import { canvasTex } from '../art/kit.js';
import { TAU, rand } from './util.js';

const KINDS = ['puff', 'star', 'spark', 'conf', 'leaf', 'ring', 'burst', 'drop', 'note', 'snow'];
const textures = {};

function tex(kind) {
  if (textures[kind]) return textures[kind];
  const t = canvasTex(64, 64, (c) => {
    c.fillStyle = '#fff';
    c.strokeStyle = '#fff';
    c.translate(32, 32);
    const star = (pts, r0, r1) => {
      c.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = (i / (pts * 2)) * TAU - Math.PI / 2;
        const r = i % 2 === 0 ? r0 : r1;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    };
    switch (kind) {
      case 'puff': c.beginPath(); c.arc(0, 0, 27, 0, TAU); c.fill(); break;
      case 'star': star(5, 29, 13); break;
      case 'spark': star(4, 30, 7); break;
      case 'burst': star(11, 31, 19); break;
      case 'conf': c.fillRect(-12, -22, 24, 44); break;
      case 'leaf':
        c.beginPath(); c.moveTo(0, -28); c.quadraticCurveTo(24, -6, 0, 28); c.quadraticCurveTo(-24, -6, 0, -28); c.fill();
        break;
      case 'ring': c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.stroke(); break;
      case 'drop': c.beginPath(); c.arc(0, 6, 14, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-11, 0); c.lineTo(0, -26); c.lineTo(11, 0); c.fill(); break;
      case 'note':
        c.beginPath(); c.ellipse(-6, 16, 11, 8, -0.4, 0, TAU); c.fill(); c.fillRect(2, -24, 5, 40); c.fillRect(2, -24, 18, 9);
        break;
      case 'snow': c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fill(); break;
      default: c.fillRect(-20, -20, 40, 40);
    }
  });
  t.userData.shared = true;
  textures[kind] = t;
  return t;
}

const MAX = 110;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const Z = new THREE.Vector3(0, 0, 1);

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.pools = {};
    this.root = new THREE.Group();
    this.root.name = 'fx';
    scene.add(this.root);
    this.shakeT = 0; this.shakeDur = 0.001; this.shakeMag = 0;
    this._off = new THREE.Vector3();
  }

  _pool(kind) {
    let p = this.pools[kind];
    if (p) return p;
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex(kind), transparent: true, alphaTest: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _c.set(0xffffff));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    this.root.add(mesh);
    p = { mesh, list: [] };
    this.pools[kind] = p;
    return p;
  }

  /**
   * Emit one particle.
   * o: { vx, vy, vz, g (gravity), drag, life, s0, s1 (size start/end), color, rot, vrot, flip (tumble) }
   */
  emit(kind, x, y, z, o = {}) {
    const p = this._pool(kind);
    if (p.list.length >= MAX) p.list.shift();
    p.list.push({
      x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g ?? 0, drag: o.drag ?? 0,
      life: o.life ?? 0.6, max: o.life ?? 0.6, s0: o.s0 ?? 0.4, s1: o.s1 ?? 0,
      color: o.color ?? 0xffffff, rot: o.rot ?? rand(TAU), vrot: o.vrot ?? 0, flip: o.flip || 0, floor: o.floor,
    });
  }

  /** Emit n particles in a radial spray. */
  burst(kind, pos, n, o = {}) {
    const sp = o.speed ?? 4, up = o.up ?? 2.5, spread = o.spread ?? 1;
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), v = sp * (0.45 + Math.random() * 0.55);
      this.emit(kind, pos.x + rand(-0.15, 0.15) * spread, (pos.y ?? 0.5) + rand(-0.1, 0.2), pos.z + rand(-0.15, 0.15) * spread, {
        vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: up * (0.4 + Math.random() * 0.8),
        g: o.g ?? -9, drag: o.drag ?? 1.2, life: (o.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        s0: (o.s0 ?? 0.35) * (0.7 + Math.random() * 0.6), s1: o.s1 ?? 0,
        color: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color, vrot: o.vrot ?? rand(-6, 6), flip: o.flip || 0, floor: o.floor,
      });
    }
  }

  /** Dust puff at the feet. */
  dust(x, z, color = 0xe8d9b8, n = 3) {
    for (let i = 0; i < n; i++) {
      this.emit('puff', x + rand(-0.2, 0.2), 0.15, z + rand(-0.2, 0.2), { vx: rand(-0.8, 0.8), vy: rand(0.4, 1.1), vz: rand(-0.8, 0.8), life: rand(0.3, 0.5), s0: rand(0.25, 0.4), s1: 0.02, color, drag: 2 });
    }
  }

  /** Comic-book hit: spiky flash, ring, flying stars. */
  impact(pos, color = 0xffd45a, scale = 1) {
    const y = pos.y ?? 1;
    this.emit('burst', pos.x, y, pos.z, { life: 0.2, s0: 1.2 * scale, s1: 3.0 * scale, color, vrot: 2 });
    this.emit('burst', pos.x, y, pos.z + 0.01, { life: 0.16, s0: 0.6 * scale, s1: 1.9 * scale, color: 0xffffff, vrot: -3 });
    this.emit('ring', pos.x, y, pos.z, { life: 0.28, s0: 0.6 * scale, s1: 3.6 * scale, color: 0xffffff });
    this.burst('star', { x: pos.x, y, z: pos.z }, Math.round(6 * scale), { speed: 6, up: 4, life: 0.55, s0: 0.42, color: [0xffd45a, 0xffffff, 0xff8a3c] });
    this.dust(pos.x, pos.z, 0xf0e2c4, 4);
  }

  sparkle(pos, color = 0xfff2a8, n = 8) {
    this.burst('spark', pos, n, { speed: 2.6, up: 2.6, g: -2, life: 0.7, s0: 0.38, color });
  }

  confetti(pos, n = 40) {
    this.burst('conf', pos, n, { speed: 6, up: 9, g: -7, drag: 1.6, life: 2.2, s0: 0.3, s1: 0.25, flip: 9, color: [0xf08a24, 0xffd45a, 0xd4502f, 0x6aa84f, 0x58b8c9, 0xfff4dc], floor: 0.03 });
  }

  shake(mag = 0.3, dur = 0.25) {
    if (mag >= this.shakeMag * (this.shakeT / this.shakeDur || 0)) { this.shakeMag = mag; this.shakeDur = dur; this.shakeT = dur; }
  }

  /** Add the current shake offset to a camera (call after positioning it). */
  applyShake(camera) {
    if (this.shakeT <= 0) return;
    const k = (this.shakeT / this.shakeDur) * this.shakeMag;
    camera.position.x += (Math.random() - 0.5) * 2 * k;
    camera.position.y += (Math.random() - 0.5) * 2 * k * 0.7;
  }

  update(dt, camera) {
    if (this.shakeT > 0) this.shakeT -= dt;
    camera.getWorldQuaternion(_q);
    for (const kind in this.pools) {
      const p = this.pools[kind];
      const list = p.list;
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        a.life -= dt;
        if (a.life <= 0) continue;
        a.vy += a.g * dt;
        if (a.drag) { const k = Math.max(0, 1 - a.drag * dt); a.vx *= k; a.vz *= k; if (a.g === 0) a.vy *= k; }
        a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
        if (a.floor !== undefined && a.y < a.floor) { a.y = a.floor; a.vx *= 0.6; a.vz *= 0.6; a.vy = 0; a.vrot *= 0.5; a.flip = 0; }
        a.rot += a.vrot * dt;
        list[n] = a;
        const t = 1 - a.life / a.max;
        let size = a.s0 + (a.s1 - a.s0) * t;
        if (a.s1 >= a.s0 * 0.9 && a.life < 0.12) size *= a.life / 0.12; // growers pop out at the end
        _roll.setFromAxisAngle(Z, a.rot);
        _s.set(a.flip ? size * Math.cos(a.max * 3 + a.life * a.flip) : size, size, size);
        _m.compose(_p.set(a.x, a.y, a.z), _roll.premultiply(_q), _s);
        p.mesh.setMatrixAt(n, _m);
        p.mesh.setColorAt(n, _c.set(a.color));
        n++;
      }
      list.length = n;
      p.mesh.count = n;
      if (n) {
        p.mesh.instanceMatrix.needsUpdate = true;
        p.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const kind in this.pools) {
      const p = this.pools[kind];
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.scene.remove(this.root);
    this.pools = {};
  }
}

export { KINDS };
