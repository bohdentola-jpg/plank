// Wet sheen: on a rain-soaked field every floodlight bank throws a long
// reflection streak across the turf toward the camera. One quad per bank,
// placed each frame where the mirrored bank would be seen on the ground and
// stretched toward the viewer; additive, faded by the view angle.
import * as THREE from 'three';
import { beamTex } from './tex.js';

export function wetStreaks(banks, field, opts = {}) {
  const n = banks.length;
  const pos = new Float32Array(n * 12);
  const col = new Float32Array(n * 12);
  const uv = new Float32Array(n * 8);
  const idx = [];
  for (let i = 0; i < n; i++) {
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3); aP.setUsage(THREE.DynamicDrawUsage);
  const aC = new THREE.BufferAttribute(col, 3); aC.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', aP);
  g.setAttribute('color', aC);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    map: beamTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.name = 'wetStreaks';
  const gain = opts.gain ?? 0.55;
  const xMax = field.halfW + 3, zMax = field.end + 3;
  return {
    mesh,
    update(camera) {
      if (!camera) return;
      const C = camera.position;
      for (let i = 0; i < n; i++) {
        const bk = banks[i];
        const L = bk.center;
        const o = i * 12;
        // where the mirrored bank shows on the ground
        const t = C.y / Math.max(0.01, C.y + L.y);
        const px = C.x + (L.x - C.x) * t, pz = C.z + (L.z - C.z) * t;
        const dx = C.x - px, dz = C.z - pz;
        const dist = Math.hypot(dx, dz);
        if (Math.abs(px) > xMax || Math.abs(pz) > zMax || dist < 2) { pos.fill(0, o, o + 12); col.fill(0, o, o + 12); continue; }
        const ux = dx / dist, uz = dz / dist;          // toward the camera
        const sx = -uz, sz = ux;                        // across
        const len = Math.min(dist * 0.85, 26 + dist * 0.25);
        const w = Math.min(5.5, 0.8 + bk.w * 0.45);
        const back = len * 0.12;
        const y = 0.03;
        const ax = px - ux * back, az = pz - uz * back, bx = px + ux * len, bz = pz + uz * len;
        pos.set([ax - sx * w, y, az - sz * w, ax + sx * w, y, az + sz * w, bx + sx * w * 1.6, y, bz + sz * w * 1.6, bx - sx * w * 1.6, y, bz - sz * w * 1.6], o);
        // grazing views catch more of it
        const graze = 1 - Math.min(1, C.y / Math.hypot(C.y, dist));
        const k = gain * (0.35 + 0.65 * graze) * (bk.glare ?? 1);
        const tint = bk.warm ? [1.0, 0.78, 0.5] : [0.85, 0.92, 1.0];
        for (let v = 0; v < 4; v++) col.set([tint[0] * k, tint[1] * k, tint[2] * k], o + v * 3);
      }
      aP.needsUpdate = true;
      aC.needsUpdate = true;
    },
  };
}
