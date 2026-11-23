// Streets: ploughed asphalt draped on the terrain — the CC0 asphalt photo for
// grain, darker polished wheel tracks, a worn yellow centre dash, white edge
// lines half under the snow, slush along the edges — and ploughed snowbanks on
// both sides. Dirt trails are narrow packed-snow tracks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOWN } from './townplan.js';
import { groundY, terrainMeshY } from './terrain.js';

/** Lay things on the ground as drawn: above both the true height field and the 4 m mesh. */
const surfaceY = (x, z) => Math.max(groundY(x, z), terrainMeshY(x, z));

function resample(pts, step) {
  // Catmull-Rom through the street points, every `step` metres
  const v = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal', 0.3);
  const len = curve.getLength();
  const n = Math.max(2, Math.ceil(len / step));
  return curve.getSpacedPoints(n);
}

function ribbon(pts, width, y0, uvScale = 1, across = 8) {
  // `across` segments over the width so the strip follows the ground's crown
  const n = pts.length, m = across + 1;
  const pos = new Float32Array(n * m * 3);
  const uv = new Float32Array(n * m * 2);
  const uv1 = new Float32Array(n * m * 2);   // metres (across, along) for tiling detail maps
  const idx = [];
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
    for (let s = 0; s < m; s++) {
      const t = s / across;
      const o = (t - 0.5) * width;
      const x = p.x + nx * o, z = p.z + nz * o;
      const k = i * m + s;
      pos[k * 3] = x; pos[k * 3 + 1] = surfaceY(x, z) + y0; pos[k * 3 + 2] = z;
      uv[k * 2] = t; uv[k * 2 + 1] = dist / uvScale;
      uv1[k * 2] = t * width; uv1[k * 2 + 1] = dist;
    }
    if (i < n - 1) {
      for (let s = 0; s < across; s++) {
        const k = i * m + s;
        // counter-clockwise seen from above, so the strip faces up (the old order faced
        // down and the roads were culled away entirely)
        idx.push(k, k + 1, k + m, k + 1, k + m + 1, k + m);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
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
      const y = surfaceY(x, z) + Math.sin(t * Math.PI) * hh;
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

const TEX_URL = new URL('../../assets/tex/', import.meta.url).href;
const ROAD_TILE = 12;   // metres of road per colour-texture repeat (one centre dash)

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

let roadTex = null;
/** The road surface, painted across the width (u 0..1) and along 12 m (v 0..1). */
function roadTexture() {
  if (roadTex) return roadTex;
  const W = 512, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const paint = (img) => {
    const r = rng(7);
    // asphalt: the photo, tiled at ~3 m (the road is ~9 m across, 12 m along)
    c.fillStyle = '#3c3f43';
    c.fillRect(0, 0, W, H);
    if (img) {
      const tw = W / 3, th = H / 4;
      for (let y = 0; y < H; y += th) for (let x = 0; x < W; x += tw) c.drawImage(img, x, y, tw + 1, th + 1);
      c.fillStyle = 'rgba(28,30,34,0.42)';   // colder, darker than the sunny photo
      c.fillRect(0, 0, W, H);
    }
    // repairs: a few darker tar patches and cracks
    for (let i = 0; i < 3; i++) {
      c.fillStyle = `rgba(18,19,21,${0.25 + r() * 0.2})`;
      c.fillRect(W * (0.15 + r() * 0.6), H * r(), W * (0.1 + r() * 0.15), H * (0.04 + r() * 0.08));
    }
    c.strokeStyle = 'rgba(14,15,17,0.55)';
    c.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      let x = W * r(), y = H * r();
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.3) * 60; c.lineTo(x, y); }
      c.stroke();
    }
    // wheel tracks: polished darker bands in each lane
    for (const u of [0.18, 0.36, 0.64, 0.82]) {
      const x = u * W, w = W * 0.07;
      const g = c.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(10,11,13,0)'); g.addColorStop(0.5, 'rgba(10,11,13,0.28)'); g.addColorStop(1, 'rgba(10,11,13,0)');
      c.fillStyle = g;
      c.fillRect(x - w, 0, w * 2, H);
    }
    // white edge lines, worn
    for (const u of [0.07, 0.93]) {
      for (let y = 0; y < H; y += 6) {
        c.fillStyle = `rgba(226,228,226,${0.55 + r() * 0.3})`;
        c.fillRect(u * W - 4, y, 8, 6);
      }
    }
    // the yellow centre dash: 3 m painted, 9 m gap; worn at its ends
    const dash = H * (3 / ROAD_TILE);
    for (let y = 0; y < dash; y += 4) {
      const wear = Math.min(1, Math.min(y, dash - y) / 40);
      c.fillStyle = `rgba(214,168,46,${(0.55 + r() * 0.3) * wear})`;
      c.fillRect(W / 2 - 6, y + H * 0.35, 12, 4);
    }
    // slush and snow drift along both edges, ragged, and a little in the crown
    for (let y = 0; y < H; y += 3) {
      const t = y / H;
      const wl = W * (0.05 + 0.05 * Math.sin(t * 19 + 1.3) * Math.sin(t * 7) + 0.035 * r());
      const wr = W * (0.05 + 0.05 * Math.sin(t * 23 + 0.4) * Math.sin(t * 5 + 2) + 0.035 * r());
      const gl = c.createLinearGradient(0, 0, wl * 1.5, 0);
      gl.addColorStop(0, 'rgba(232,236,240,0.96)'); gl.addColorStop(0.65, 'rgba(214,220,226,0.75)'); gl.addColorStop(1, 'rgba(200,206,212,0)');
      c.fillStyle = gl; c.fillRect(0, y, wl * 1.5, 3);
      const gr = c.createLinearGradient(W, 0, W - wr * 1.5, 0);
      gr.addColorStop(0, 'rgba(232,236,240,0.96)'); gr.addColorStop(0.65, 'rgba(214,220,226,0.75)'); gr.addColorStop(1, 'rgba(200,206,212,0)');
      c.fillStyle = gr; c.fillRect(W - wr * 1.5, y, wr * 1.5, 3);
    }
    for (let i = 0; i < 900; i++) {
      const u = r() < 0.5 ? 0.42 + r() * 0.16 : r();
      c.fillStyle = `rgba(210,216,222,${r() * 0.18})`;
      c.fillRect(u * W, r() * H, 2 + r() * 10, 1 + r() * 3);
    }
    if (roadTex) roadTex.needsUpdate = true;
  };
  paint(null);
  roadTex = new THREE.CanvasTexture(cv);
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = THREE.ClampToEdgeWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.anisotropy = 8;
  const img = new Image();
  img.onload = () => paint(img);
  img.src = TEX_URL + 'asphalt_col.jpg';
  return roadTex;
}

let detail = null;
/** The asphalt photo's normal and roughness maps, tiled every 3 m on the road's uv1 (metres). */
function roadDetail() {
  if (detail) return detail;
  const L = new THREE.TextureLoader();
  const load = (f) => {
    const t = L.load(TEX_URL + f);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 3, 1 / 3);
    t.channel = 1;
    t.anisotropy = 8;
    return t;
  };
  detail = { normal: load('asphalt_nrm.jpg'), rough: load('asphalt_rgh.jpg') };
  return detail;
}

export function buildRoads() {
  const group = new THREE.Group();
  group.name = 'roads';
  const roads = [], banks = [], trails = [];
  for (const st of TOWN.streets) {
    const pts = resample(st.pts, 1.5);
    if (st.dirt) { trails.push(ribbon(pts, st.width * 0.6, 0.035, 8, 3)); continue; }
    roads.push(ribbon(pts, st.width, 0.04, ROAD_TILE));
    banks.push(bank(pts, 1, st.width, 0.55), bank(pts, -1, st.width, 0.55));
  }
  const D = roadDetail();
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTexture(), normalMap: D.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: D.rough,
    roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
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
