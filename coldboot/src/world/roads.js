// Streets: packed-snow ribbons draped on the terrain, tyre ruts worn grey into
// them, ploughed snowbanks along both edges. Dirt trails are narrow tracks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOWN } from './townplan.js';
import { groundY } from './terrain.js';

function resample(pts, step) {
  // Catmull-Rom through the street points, every `step` metres
  const v = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal', 0.3);
  const len = curve.getLength();
  const n = Math.max(2, Math.ceil(len / step));
  return curve.getSpacedPoints(n);
}

function ribbon(pts, width, y0, uvScale = 1) {
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const idx = [];
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
    for (let s = 0; s < 2; s++) {
      const o = (s ? 1 : -1) * width / 2;
      const x = p.x + nx * o, z = p.z + nz * o;
      const k = i * 2 + s;
      pos[k * 3] = x; pos[k * 3 + 1] = groundY(x, z) + y0; pos[k * 3 + 2] = z;
      uv[k * 2] = s; uv[k * 2 + 1] = dist / uvScale;
    }
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A low rounded berm along one edge. */
function bank(pts, side, width, h) {
  const n = pts.length;
  const segs = 5;
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * side, nz = dx / l * side;
    const hh = h * (0.7 + 0.3 * Math.sin(i * 1.7) * Math.sin(i * 0.43));
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const o = width / 2 + t * 1.6;
      const x = p.x + nx * o, z = p.z + nz * o;
      const y = groundY(x, z) + Math.sin(t * Math.PI) * hh;
      pos.push(x, y, z);
    }
    if (i < n - 1) for (let s = 0; s < segs; s++) {
      const k = i * (segs + 1) + s;
      if (side > 0) idx.push(k, k + segs + 1, k + 1, k + 1, k + segs + 1, k + segs + 2);
      else idx.push(k, k + 1, k + segs + 1, k + 1, k + segs + 2, k + segs + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let roadTex = null;
function roadTexture() {
  if (roadTex) return roadTex;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#d8dde2'; c.fillRect(0, 0, 128, 512);
  // grey slush ruts where the wheels go
  for (const x of [30, 98]) {
    const g = c.createLinearGradient(x - 14, 0, x + 14, 0);
    g.addColorStop(0, 'rgba(90,96,104,0)'); g.addColorStop(0.5, 'rgba(90,96,104,0.75)'); g.addColorStop(1, 'rgba(90,96,104,0)');
    c.fillStyle = g; c.fillRect(x - 14, 0, 28, 512);
  }
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '60,64,70' : '255,255,255'},${Math.random() * 0.25})`;
    c.fillRect(Math.random() * 128, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 6);
  }
  roadTex = new THREE.CanvasTexture(cv);
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.anisotropy = 8;
  return roadTex;
}

export function buildRoads() {
  const group = new THREE.Group();
  group.name = 'roads';
  const roads = [], banks = [], trails = [];
  for (const st of TOWN.streets) {
    const pts = resample(st.pts, 3);
    if (st.dirt) { trails.push(ribbon(pts, st.width * 0.6, 0.05, 8)); continue; }
    roads.push(ribbon(pts, st.width, 0.06, st.width * 1.8));
    banks.push(bank(pts, 1, st.width, 0.55), bank(pts, -1, st.width, 0.55));
  }
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const r = new THREE.Mesh(mergeGeometries(roads), roadMat);
  r.receiveShadow = true;
  group.add(r);
  if (trails.length) {
    const tm = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const t = new THREE.Mesh(mergeGeometries(trails), tm);
    t.receiveShadow = true;
    group.add(t);
  }
  const bm = new THREE.Mesh(mergeGeometries(banks), new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.85 }));
  bm.receiveShadow = true; bm.castShadow = true;
  group.add(bm);
  return group;
}

/** Points along every street (for lamp posts, power poles, NPC paths). */
export function streetPoints(step = 30) {
  const out = [];
  for (const st of TOWN.streets) {
    const pts = resample(st.pts, step);
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dir = Math.atan2(b.x - a.x, b.z - a.z);
      out.push({ x: p.x, z: p.z, dir, street: st });
    });
  }
  return out;
}
