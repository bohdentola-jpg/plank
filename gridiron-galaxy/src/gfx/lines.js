// Flat ribbon lines drawn on the turf: pre-snap routes, line of scrimmage, first-down marker.
import * as THREE from '../../vendor/three.module.js';

export function ribbon(points, width = 0.25, color = '#ffffff', y = 0.06, opts = {}) {
  const g = new THREE.Group(); if (points.length < 2) return g;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opts.opacity === undefined ? 0.9 : opts.opacity, depthWrite: false, side: THREE.DoubleSide });
  const verts = [], idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]; const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    let dx = next[0] - prev[0], dz = next[1] - prev[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz * width / 2, nz = dx * width / 2;
    verts.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
    if (i > 0) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx);
  g.add(new THREE.Mesh(geo, mat));
  if (opts.arrow) {
    const a = points[points.length - 1], b = points[points.length - 2]; let dx = a[0] - b[0], dz = a[1] - b[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const s = width * 3.2; const tip = [a[0] + dx * s * 1.2, a[1] + dz * s * 1.2];
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([tip[0], y, tip[1], a[0] - dz * s, y, a[1] + dx * s, a[0] + dz * s, y, a[1] - dx * s], 3));
    g.add(new THREE.Mesh(tri, mat));
  }
  if (opts.dot) { const d = new THREE.Mesh(new THREE.CircleGeometry(width * 1.6, 16), mat); d.rotation.x = -Math.PI / 2; d.position.set(points[0][0], y, points[0][1]); g.add(d); }
  return g;
}
export function dashed(points, width, color, y = 0.06, dash = 0.9, gap = 0.6) {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.floor(len / (dash + gap)));
    for (let k = 0; k < n; k++) { const t0 = (k * (dash + gap)) / len, t1 = Math.min(1, (k * (dash + gap) + dash) / len); g.add(ribbon([[a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]], width, color, y)); }
  }
  const last = points[points.length - 1], prev = points[points.length - 2]; g.add(ribbon([prev, last], 0.01, color, y, { arrow: true, opacity: 0 }).children[1] ? ribbon([prev, last], width, color, y, { arrow: true }).children[1] : new THREE.Group());
  return g;
}
export function fieldLine(z, color, width = 0.35, y = 0.05, halfW = 15.5) {
  return ribbon([[-halfW, z], [halfW, z]], width, color, y, { opacity: 0.75 });
}
