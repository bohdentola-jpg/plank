// Traffic visuals. A handful of civilian variants (plain sedans and hatches
// from the roster in sensible paint, plus a box truck) are built once and
// merged per material, then shared by every traffic car. Cars past the
// detail range collapse to their head/tail lights (one instanced mesh).
import * as THREE from 'three';
import { buildCarModel } from '../car/model.js';
import { CAR_BY_ID } from '../car/cars.js';
import { makeRng } from '../core/util.js';

const CIV_CARS = ['lancet', 'kaze', 'golfo', 'civica', 'm3', 'nx350', 'stallion'];
const CIV_PAINT = ['#2a2d33', '#6e737b', '#a9aeb5', '#1d2a44', '#5a1a1a', '#c9c2a6', '#20302a', '#e8e8e8', '#3b2414', '#6a8fb3'];

/** Merge a model's meshes by material into a few big ones (static: no wheel spin). */
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const add = (material, g, m, start, count) => {
    if (!buckets.has(material.uuid)) buckets.set(material.uuid, { material, parts: [] });
    buckets.get(material.uuid).parts.push({ g, m, start, count });
  };
  group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry;
    if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const total = g.index ? g.index.count : g.attributes.position.count;
    if (Array.isArray(o.material)) {
      if (g.groups.length) for (const gr of g.groups) add(o.material[gr.materialIndex], g, m, gr.start, Math.min(gr.count, total - gr.start));
      else add(o.material[0], g, m, 0, total);
    } else add(o.material, g, m, 0, total);
  });
  const out = [];
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  for (const { material, parts } of buckets.values()) {
    let nv = 0, ni = 0;
    for (const { g, count } of parts) { nv += g.attributes.position.count; ni += count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const { g, m, start, count } of parts) {
      nm.getNormalMatrix(m);
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let k = 0; k < P.count; k++) {
        v.fromBufferAttribute(P, k).applyMatrix4(m);
        pos[(ov + k) * 3] = v.x; pos[(ov + k) * 3 + 1] = v.y; pos[(ov + k) * 3 + 2] = v.z;
        v.fromBufferAttribute(N, k).applyMatrix3(nm).normalize();
        nor[(ov + k) * 3] = v.x; nor[(ov + k) * 3 + 1] = v.y; nor[(ov + k) * 3 + 2] = v.z;
        uv[(ov + k) * 2] = U.getX(k);
        uv[(ov + k) * 2 + 1] = U.getY(k);
      }
      for (let k = 0; k < count; k++) idx[oi + k] = (g.index ? g.index.getX(start + k) : start + k) + ov;
      ov += P.count;
      oi += count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    out.push({ geometry: geo, material });
  }
  return out;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Box truck: cab, cargo box with a company livery, six wheels, lights. */
function boxTruck(rng) {
  const g = new THREE.Group();
  const names = [['HALCYON', 'FREIGHT'], ['ACE', 'MOVERS'], ['NORTHSIDE', 'PRODUCE'], ['BLUE LINE', 'LOGISTICS']];
  const [n1, n2] = names[Math.floor(rng() * names.length)];
  const livery = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#e9e9e4'; x.fillRect(0, 0, w, h);
    x.fillStyle = ['#1d3f8f', '#b3261e', '#2b7a3a', '#f26a1b'][Math.floor(rng() * 4)];
    x.fillRect(0, h * 0.72, w, h * 0.12);
    x.fillStyle = '#16181c';
    x.font = 'italic 900 64px Arial Black, Arial';
    x.fillText(n1, 28, 110);
    x.font = 'bold 40px Arial';
    x.fillText(n2, 32, 160);
    x.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 16; i++) x.fillRect(i * 32, 0, 2, h);
  });
  const boxMat = new THREE.MeshStandardMaterial({ map: livery, roughness: 0.6 });
  const plain = new THREE.MeshStandardMaterial({ color: 0xe0e0da, roughness: 0.6 });
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.55, 5.3), [boxMat, boxMat, plain, plain, plain, plain]);
  cargo.position.set(0, 1.25 + 0.75, -1.05);
  g.add(cargo);
  const cabCol = ['#e9e9e4', '#1d3f8f', '#b3261e', '#2a2d33'][Math.floor(rng() * 4)];
  const cabMat = new THREE.MeshStandardMaterial({ color: cabCol, roughness: 0.4, metalness: 0.2 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.75, 1.95), cabMat);
  cab.position.set(0, 1.0 + 0.6, 2.45);
  g.add(cab);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.8), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.1, metalness: 0.8 }));
  glass.position.set(0, 2.0, 3.43);
  glass.rotation.x = -0.15;
  g.add(glass);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 7.4), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 }));
  chassis.position.set(0, 0.55, 0);
  g.add(chassis);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const tire = new THREE.CylinderGeometry(0.48, 0.48, 0.32, 14);
  tire.rotateZ(Math.PI / 2);
  for (const z of [2.4, -2.0, -3.0]) for (const x of [-1.05, 1.05]) {
    const w = new THREE.Mesh(tire, tireMat);
    w.position.set(x, 0.48, z);
    g.add(w);
  }
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85) });
  const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.05, 0.03) });
  for (const x of [-0.85, 0.85]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.05), head);
    h.position.set(x, 0.95, 3.43);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.05), tail);
    t.position.set(x * 1.2, 0.8, -3.72);
    g.add(t);
  }
  return {
    group: g,
    setLights(hd, tl, br) {
      head.color.setRGB(1, 0.95, 0.85).multiplyScalar(0.3 + hd * 4);
      tail.color.setRGB(1, 0.05, 0.03).multiplyScalar(0.3 + tl * 1.4 + br * 3);
    },
    dispose() { livery.dispose(); },
  };
}

export class TrafficRender {
  constructor(scene, traffic, { night = true, seed = 't' } = {}) {
    this.scene = scene;
    this.traffic = traffic;
    this.night = night;
    const rng = makeRng('trafficvis' + seed);
    // variants
    this.variants = { car: [], truck: [] };
    this.handles = [];
    for (let k = 0; k < 5; k++) {
      const spec = CAR_BY_ID[CIV_CARS[Math.floor(rng() * CIV_CARS.length)]];
      const look = {
        paint: CIV_PAINT[Math.floor(rng() * CIV_PAINT.length)], finish: rng() < 0.5 ? 'gloss' : 'metallic',
        rims: 'stock', rimColor: 'silver', spoiler: 'none', kit: 'stock', vinyl: 'none', tint: 1, hood: 'stock', ride: 0,
        plate: String(Math.floor(rng() * 899 + 100)) + ' ' + 'ABCDEFGHJKLMNPRSTUVXYZ'[Math.floor(rng() * 22)] + 'XR',
      };
      const h = buildCarModel(spec, look, { hiRes: false, interior: false, shadow: true });
      h.setLights(night ? 1 : 0, night ? 1 : 0.15, 0);
      this.handles.push(h);
      this.variants.car.push(mergeByMaterial(h.group));
    }
    const truck = boxTruck(rng);
    truck.setLights(night ? 1 : 0, night ? 1 : 0.15, 0);
    this.handles.push(truck);
    this.variants.truck.push(mergeByMaterial(truck.group));
    // one group per traffic car, sharing variant geometry/materials
    this.groups = traffic.cars.map((c, k) => {
      const list = this.variants[c.kind];
      const parts = list[k % list.length];
      const g = new THREE.Group();
      for (const p of parts) {
        const m = new THREE.Mesh(p.geometry, p.material);
        m.castShadow = false;
        g.add(m);
      }
      scene.add(g);
      return g;
    });
    // far LOD: head/tail light points
    const n = traffic.cars.length * 4;
    const geo = new THREE.PlaneGeometry(1, 1);
    const tex = canvasTex(32, 32, (x) => {
      const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.3, 'rgba(255,255,255,0.5)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    });
    this.glowTex = tex;
    this.points = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), n);
    this.points.frustumCulled = false;
    this.points.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.points.visible = night;
    scene.add(this.points);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.near = night ? 130 : 220;
  }

  update(camera) {
    const cam = camera.position;
    const cars = this.traffic.cars;
    let pi = 0;
    const M = this._m, Q = this._q, P = this._p, S = this._s;
    for (let k = 0; k < cars.length; k++) {
      const c = cars[k];
      const g = this.groups[k];
      const d = Math.hypot(c.x - cam.x, c.z - cam.z);
      g.visible = d < this.near;
      if (g.visible) {
        g.position.set(c.x, c.y, c.z);
        g.rotation.set(0, c.heading, 0);
      }
      if (this.night && d >= this.near * 0.8 && d < 900) {
        const [fx, fz] = c.fwd;
        const [lx, lz] = c.left;
        const half = c.dims.L / 2;
        const sz = 0.9 + d * 0.004;
        for (let h = 0; h < 4; h++) {
          const front = h < 2;
          const side = h % 2 ? 0.7 : -0.7;
          P.set(c.x + fx * (front ? half : -half) + lx * side, c.y + (front ? 0.7 : 0.85), c.z + fz * (front ? half : -half) + lz * side);
          Q.copy(camera.quaternion);
          S.set(sz, sz, sz);
          M.compose(P, Q, S);
          this.points.setMatrixAt(pi, M);
          // we see headlights of oncoming cars, tail lights of ours
          const toCam = (cam.x - P.x) * fx + (cam.z - P.z) * fz;
          const visible = front ? toCam > 0 : toCam < 0;
          if (visible) this.points.instanceColor.setXYZ(pi, front ? 1.6 : 1.2, front ? 1.5 : 0.08, front ? 1.3 : 0.05);
          else this.points.instanceColor.setXYZ(pi, 0, 0, 0);
          pi++;
        }
      }
    }
    for (let k = pi; k < this.points.count; k++) {
      M.makeScale(0, 0, 0);
      this.points.setMatrixAt(k, M);
    }
    this.points.instanceMatrix.needsUpdate = true;
    this.points.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const g of this.groups) this.scene.remove(g);
    for (const list of Object.values(this.variants)) for (const parts of list) for (const p of parts) p.geometry.dispose();
    for (const h of this.handles) h.dispose?.();
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.glowTex.dispose();
  }
}
