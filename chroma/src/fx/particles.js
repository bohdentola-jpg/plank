// Pooled GPU-instanced effects: glossy ink droplets, expanding ripple rings,
// shockwaves and a flash light for explosions.
import * as THREE from 'three';
import { rand } from '../util.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();

export class Particles {
  constructor(scene, max = 1400) {
    this.scene = scene;
    this.max = max;
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.drops = new THREE.InstancedMesh(geo, mat, max);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops.setColorAt(0, new THREE.Color());
    this.drops.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.drops.frustumCulled = false;
    this.drops.count = 0;
    scene.add(this.drops);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, size: 0.1, color: new THREE.Color(), grav: 1, stretch: 1, floorY: -99, drag: 0 });
    this.cursor = 0;

    // rings (ripples / shockwaves) with per-instance alpha
    const rmax = 160;
    const rgeo = new THREE.RingGeometry(0.72, 1, 40, 1);
    rgeo.rotateX(-Math.PI / 2);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(rmax), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    rgeo.setAttribute('aAlpha', alpha);
    this.ringAlpha = alpha;
    const rmat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
    rmat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vAlpha;');
    };
    this.rings = new THREE.InstancedMesh(rgeo, rmat, rmax);
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rings.setColorAt(0, new THREE.Color());
    this.rings.frustumCulled = false;
    this.rings.count = 0;
    this.rings.renderOrder = 2;
    scene.add(this.rings);
    this.r = [];
    for (let i = 0; i < rmax; i++) this.r.push({ alive: false, pos: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), life: 0, max: 1, r0: 0.2, r1: 1, color: new THREE.Color(), a: 1 });
    this.rcursor = 0;

    this.flash = new THREE.PointLight(0xffffff, 0, 14, 2);
    this.flash.castShadow = false;
    scene.add(this.flash);
    this.flashT = 0;
  }

  spawn(pos, vel, color, size, life, opts = {}) {
    const p = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.alive = true;
    p.pos.copy(pos); p.vel.copy(vel);
    p.color.set(color);
    p.size = size; p.life = 0; p.max = life;
    p.grav = opts.grav ?? 1; p.stretch = opts.stretch ?? 1; p.floorY = opts.floorY ?? -99; p.drag = opts.drag ?? 0.6;
    return p;
  }

  // Burst of droplets spraying around normal n
  splash(pos, n, color, count = 10, speed = 4, size = 0.07, spread = 0.9) {
    for (let i = 0; i < count; i++) {
      _dir.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(spread).add(n).normalize();
      const sp = speed * rand(0.4, 1.1);
      this.spawn(pos, _dir.clone().multiplyScalar(sp), color, size * rand(0.5, 1.3), rand(0.35, 0.7), { stretch: 1.6 });
    }
  }

  ring(pos, color, r0, r1, life, opts = {}) {
    const r = this.r[this.rcursor];
    this.rcursor = (this.rcursor + 1) % this.r.length;
    r.alive = true;
    r.pos.copy(pos);
    r.normal.copy(opts.normal || _up);
    r.color.set(color);
    r.r0 = r0; r.r1 = r1; r.life = 0; r.max = life; r.a = opts.alpha ?? 0.8;
  }

  explosion(pos, color, radius = 3) {
    this.splash(pos, _up, color, 46, radius * 3.2, 0.12, 1.4);
    this.ring(pos.clone().setY(pos.y + 0.08), color, 0.2, radius * 1.15, 0.45, { alpha: 0.9 });
    this.ring(pos.clone().setY(pos.y + 0.1), 0xffffff, 0.1, radius * 0.8, 0.3, { alpha: 0.6 });
    this.flashAt(pos, color, 9, 0.35);
  }

  flashAt(pos, color, intensity, dur) {
    this.flash.position.copy(pos).setY(pos.y + 1);
    this.flash.color.set(color);
    this.flashI = intensity; this.flashT = dur; this.flashMax = dur;
  }

  update(dt) {
    let n = 0;
    const mesh = this.drops;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; continue; }
      p.vel.y -= 16 * p.grav * dt;
      p.vel.multiplyScalar(1 - p.drag * dt);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.floorY) { p.alive = false; continue; }
      const k = 1 - p.life / p.max;
      const sz = p.size * Math.min(1, k * 2.2);
      const sp = p.vel.length();
      if (p.stretch > 1 && sp > 0.5) {
        _dir.copy(p.vel).divideScalar(sp);
        _q.setFromUnitVectors(_up, _dir);
        _s.set(sz, sz * (1 + Math.min(sp * 0.08, 1.5) * (p.stretch - 1)), sz);
      } else { _q.identity(); _s.set(sz, sz, sz); }
      _m.compose(p.pos, _q, _s);
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, p.color);
      n++;
    }
    mesh.count = n;
    if (n) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }

    let rn = 0;
    for (const r of this.r) {
      if (!r.alive) continue;
      r.life += dt;
      if (r.life >= r.max) { r.alive = false; continue; }
      const t = r.life / r.max;
      const e = 1 - Math.pow(1 - t, 2.5);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      _q.setFromUnitVectors(_up, r.normal);
      _s.set(rad, rad, rad);
      _m.compose(r.pos, _q, _s);
      this.rings.setMatrixAt(rn, _m);
      this.rings.setColorAt(rn, r.color);
      this.ringAlpha.array[rn] = r.a * (1 - t);
      rn++;
    }
    this.rings.count = rn;
    if (rn) { this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true; this.ringAlpha.needsUpdate = true; }

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity = Math.max(0, this.flashT / this.flashMax) * this.flashI * 10;
    } else this.flash.intensity = 0;
  }

  clear() {
    for (const p of this.p) p.alive = false;
    for (const r of this.r) r.alive = false;
  }

  dispose() {
    this.scene.remove(this.drops, this.rings, this.flash);
    this.drops.geometry.dispose(); this.drops.material.dispose();
    this.rings.geometry.dispose(); this.rings.material.dispose();
  }
}
