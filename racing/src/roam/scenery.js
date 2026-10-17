// FREE ROAM scenery: the side road off a circuit, the tunnel portals, and
// clearing the region's own scenery out of their way. Runs inside
// buildWorld (after the environment, before the street-light glow is
// baked), so lamps put up here light the new asphalt like any other.
import * as THREE from 'three';
import { glowMaterial } from '../track/build.js';
import { roadTextures, concreteTexture, facadeTextures, toTex } from '../track/textures.js';
import { GeoBuilder } from '../track/env/common.js';
import { TRACK_BY_ID } from '../track/tracks.js';
import { G } from './plan.js';
import { pastEnd } from './roadnet.js';

/** buildWorld's decorate hook. */
export async function decorateRegion(world, track, plan, opts = {}) {
  if (!plan) return;
  const terrainEnv = !!world.terrain;
  carveScenery(world, plan.carve);
  if (terrainEnv) carveTerrain(world, plan);
  const kit = makeKit(world, track);
  if (plan.approach) buildApproach(world, track, plan.approach, kit);
  for (const q of plan.portals) buildBore(world, q, kit);
  for (const f of plan.faces || []) buildFace(world, f, kit, terrainEnv);
  for (const m of kit.glow) world.glowMeshes.push(m);
  if (!opts.noRaces) buildMarker(world, track, plan);
}

/**
 * The race start: a column of light over the region's start line. Pull up
 * in it and you can race this road from here.
 */
function buildMarker(world, track, plan) {
  const p = track.posAt(track.startS, 0);
  const w = track.W[p.i];
  plan.marker = { x: p.x, z: p.z, y: p.y, heading: p.heading, s: track.startS, r: Math.max(5, w * 0.8) };
  const R = plan.marker.r;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0.9)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  const col = new THREE.Color('#ffb21e');
  // (outside faces only: from inside the column, i.e. parked in it with the
  // chase camera, there's nothing in the way)
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 26, 40, 1, true), mat);
  beam.position.set(p.x, p.y + 13, p.z);
  beam.userData.roam = true;
  beam.renderOrder = 4;
  world.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.45, R, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(p.x, p.y + 0.08, p.z);
  ring.userData.roam = true;
  world.add(ring);
  world.disposables.push(tex, mat, ringMat);
  let t = 0;
  world.animators.push((dt, camera) => {
    t += dt;
    // a beacon from down the road, a glow up close
    const d = camera ? Math.hypot(camera.position.x - p.x, camera.position.z - p.z) : 99;
    const near = Math.min(1, Math.max(0, (d - R * 1.1) / (R * 3)));
    mat.opacity = (0.6 + 0.25 * Math.sin(t * 2.6)) * (0.15 + 0.85 * near);
    ringMat.opacity = 0.55 + 0.4 * Math.sin(t * 2.6 + 1);
  });
  void w;
}

// ---------------------------------------------------------------- carving

function inRegion(R, x, z) {
  if (R.kind === 'box') {
    const a = (x - R.x) * R.ux + (z - R.z) * R.uz;
    if (a < R.a0 || a > R.a1) return false;
    return Math.abs((x - R.x) * R.uz - (z - R.z) * R.ux) <= R.hw;
  }
  const T = R.road;
  const p = T.project(x, z, R._h ?? -1, R._p || (R._p = {}));
  R._h = p.i;
  if (p.s < R.s0 || p.s > R.s1 || pastEnd(T, p, x, z)) return false;
  return Math.abs(p.lat) <= T.lerpArr(T.W, p.i, p.t) + R.pad;
}

function regionBox(R) {
  if (R.kind === 'box') {
    const pts = [];
    for (const a of [R.a0, R.a1]) for (const o of [-R.hw, R.hw]) pts.push([R.x + R.ux * a + R.uz * o, R.z + R.uz * a - R.ux * o]);
    return bounds(pts);
  }
  const T = R.road;
  const pts = [];
  for (let i = 0; i < T.N; i++) {
    const w = T.W[i] + R.pad;
    pts.push([T.X[i] + T.LX[i] * w, T.Z[i] + T.LZ[i] * w], [T.X[i] - T.LX[i] * w, T.Z[i] - T.LZ[i] * w]);
  }
  return bounds(pts);
}

function bounds(pts) {
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const [x, z] of pts) { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); }
  return b;
}

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _box = new THREE.Box3();

/**
 * Clear the region's scenery out of the side road and the portal blocks:
 * small objects (a building, a stack of containers, a tree, a lamp) go
 * whole; long ones (a barrier, a sidewalk, a fence) lose just the stretch
 * inside. The road itself, the terrain and the ground planes stay.
 */
export function carveScenery(world, regions) {
  if (!regions?.length) return;
  const boxes = regions.map(regionBox);
  const U = { x0: Math.min(...boxes.map((b) => b.x0)), z0: Math.min(...boxes.map((b) => b.z0)), x1: Math.max(...boxes.map((b) => b.x1)), z1: Math.max(...boxes.map((b) => b.z1)) };
  const inside = (x, z) => x >= U.x0 && x <= U.x1 && z >= U.z0 && z <= U.z1 && regions.some((R) => inRegion(R, x, z));
  // geometry shared between meshes can't be edited for one of them
  const users = new Map();
  world.group.traverse((o) => { if (o.geometry) users.set(o.geometry, (users.get(o.geometry) || 0) + 1); });
  const drop = [];
  world.group.updateMatrixWorld(true);
  world.group.traverse((o) => {
    if (isTerrain(o) || o.userData.roam || o.name === 'road' || o.name === 'frame') return;
    if (o.isSprite) {
      o.getWorldPosition(_v);
      if (inside(_v.x, _v.z)) drop.push(o);
      return;
    }
    if (!o.geometry || !o.geometry.attributes?.position) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _box.copy(o.geometry.boundingBox);
    if (o.isInstancedMesh) {
      carveInstances(o, inside);
      return;
    }
    _box.applyMatrix4(o.matrixWorld);
    if (_box.max.x < U.x0 || _box.min.x > U.x1 || _box.max.z < U.z0 || _box.min.z > U.z1) return;
    if (o.isPoints) { carvePoints(o, inside); return; }
    if (!o.isMesh) return;
    const small = _box.max.x - _box.min.x < 60 && _box.max.z - _box.min.z < 60;
    if (small || users.get(o.geometry) > 1) {
      if (anyTriangleInside(o, inside)) drop.push(o);
      return;
    }
    carveMesh(o, inside);
  });
  for (const o of drop) o.parent?.remove(o);
  world.lamps = world.lamps.filter((L) => !inside(L.x, L.z));
  world.streakSources = world.streakSources.filter((L) => !inside(L.x, L.z));
}

const isTerrain = (o) => o.userData.terrain || o.name === 'terrain';

function worldPositions(o) {
  const pos = o.geometry.attributes.position;
  const P = new Float32Array(pos.count * 3);
  const M = o.matrixWorld;
  for (let k = 0; k < pos.count; k++) {
    _v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(M);
    P[k * 3] = _v.x; P[k * 3 + 1] = _v.y; P[k * 3 + 2] = _v.z;
  }
  return P;
}

function triList(g) {
  if (g.index) return g.index.array;
  const n = g.attributes.position.count;
  const a = new Uint32Array(n);
  for (let k = 0; k < n; k++) a[k] = k;
  return a;
}

function anyTriangleInside(o, inside) {
  const P = worldPositions(o);
  const I = triList(o.geometry);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    if (inside((P[a] + P[b] + P[c]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3)) return true;
  }
  return false;
}

function carveMesh(o, inside) {
  const g = o.geometry;
  const P = worldPositions(o);
  const I = triList(g);
  const nT = I.length / 3;
  const hit = new Uint8Array(nT);
  let any = false;
  for (let t = 0; t < nT; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    if (inside((P[a] + P[b] + P[c]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3)) { hit[t] = 1; any = true; }
  }
  if (!any) return;
  // pieces: triangles joined through shared corners (welded by position,
  // since a box's faces each have their own vertices)
  const nV = P.length / 3;
  const rep = new Int32Array(nV);
  const key = new Map();
  for (let k = 0; k < nV; k++) {
    const kk = `${Math.round(P[k * 3] * 50)},${Math.round(P[k * 3 + 1] * 50)},${Math.round(P[k * 3 + 2] * 50)}`;
    let r = key.get(kk);
    if (r === undefined) { r = k; key.set(kk, k); }
    rep[k] = r;
  }
  const parent = new Int32Array(nV);
  for (let k = 0; k < nV; k++) parent[k] = k;
  const find = (k) => { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
  for (let t = 0; t < nT; t++) {
    const a = find(rep[I[t * 3]]), b = find(rep[I[t * 3 + 1]]), c = find(rep[I[t * 3 + 2]]);
    if (a !== b) parent[b] = a;
    const a2 = find(a);
    if (a2 !== c) parent[c] = a2;
  }
  // footprint of every piece that has a triangle inside
  const hitRoots = new Map();
  for (let t = 0; t < nT; t++) if (hit[t]) hitRoots.set(find(rep[I[t * 3]]), null);
  for (let t = 0; t < nT; t++) {
    const r = find(rep[I[t * 3]]);
    if (!hitRoots.has(r)) continue;
    let b = hitRoots.get(r);
    if (!b) { b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity }; hitRoots.set(r, b); }
    for (let j = 0; j < 3; j++) {
      const v = I[t * 3 + j] * 3;
      const x = P[v], z = P[v + 2];
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (z < b.z0) b.z0 = z; if (z > b.z1) b.z1 = z;
    }
  }
  const keep = new Uint8Array(nT).fill(1);
  for (let t = 0; t < nT; t++) {
    const r = find(rep[I[t * 3]]);
    const b = hitRoots.get(r);
    if (!b) continue;
    if (b.x1 - b.x0 < 60 && b.z1 - b.z0 < 60) { keep[t] = 0; continue; }
    if (!hit[t]) continue;
    // a long piece: just the stretch inside — but never a huge ground triangle
    let big = false;
    for (let j = 0; j < 3 && !big; j++) {
      const p0 = I[t * 3 + j] * 3, p1 = I[t * 3 + (j + 1) % 3] * 3;
      if (Math.hypot(P[p0] - P[p1], P[p0 + 2] - P[p1 + 2]) > 30) big = true;
    }
    if (!big) keep[t] = 0;
  }
  rebuildTriangles(g, I, keep);
}

function rebuildTriangles(g, I, keep) {
  const nT = I.length / 3;
  let n = 0;
  for (let t = 0; t < nT; t++) n += keep[t];
  if (n === nT) return;
  if (g.index) {
    const out = new (I.length > 65535 || g.attributes.position.count > 65535 ? Uint32Array : Uint16Array)(n * 3);
    let k = 0;
    for (let t = 0; t < nT; t++) if (keep[t]) { out[k++] = I[t * 3]; out[k++] = I[t * 3 + 1]; out[k++] = I[t * 3 + 2]; }
    g.setIndex(new THREE.BufferAttribute(out, 1));
  } else {
    for (const name of Object.keys(g.attributes)) {
      const A = g.attributes[name];
      const sz = A.itemSize;
      const out = new A.array.constructor(n * 3 * sz);
      let k = 0;
      for (let t = 0; t < nT; t++) {
        if (!keep[t]) continue;
        for (let j = 0; j < 3 * sz; j++) out[k++] = A.array[t * 3 * sz + j];
      }
      g.setAttribute(name, new THREE.BufferAttribute(out, sz, A.normalized));
    }
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
}

function carveInstances(o, inside) {
  const M = o.matrixWorld;
  let n = o.count;
  for (let k = 0; k < n; k++) {
    o.getMatrixAt(k, _m);
    _v.setFromMatrixPosition(_m).applyMatrix4(M);
    if (!inside(_v.x, _v.z)) continue;
    n--;
    if (k !== n) {
      o.getMatrixAt(n, _m);
      o.setMatrixAt(k, _m);
      if (o.instanceColor) {
        const c = new THREE.Color();
        o.getColorAt(n, c);
        o.setColorAt(k, c);
      }
      k--;
    }
  }
  if (n !== o.count) {
    o.count = n;
    o.instanceMatrix.needsUpdate = true;
    if (o.instanceColor) o.instanceColor.needsUpdate = true;
    o.computeBoundingSphere?.();
  }
}

function carvePoints(o, inside) {
  const g = o.geometry;
  const P = worldPositions(o);
  const n = P.length / 3;
  const keep = [];
  for (let k = 0; k < n; k++) if (!inside(P[k * 3], P[k * 3 + 2])) keep.push(k);
  if (keep.length === n) return;
  for (const name of Object.keys(g.attributes)) {
    const A = g.attributes[name];
    const sz = A.itemSize;
    const out = new A.array.constructor(keep.length * sz);
    keep.forEach((k, j) => { for (let c = 0; c < sz; c++) out[j * sz + c] = A.array[k * sz + c]; });
    g.setAttribute(name, new THREE.BufferAttribute(out, sz, A.normalized));
  }
  g.setDrawRange(0, keep.length);
  g.computeBoundingSphere();
}

/** Open the hillside over the tunnels (the bores run inside the portal block). */
function carveTerrain(world, plan) {
  const regions = [];
  for (const f of plan.faces || []) {
    const reach = Math.max(...f.bores.map((b) => Math.abs(b.off) + b.hw)) + 1.5;
    regions.push({ kind: 'box', x: f.x, z: f.z, ux: f.ax, uz: f.az, a0: -12, a1: G.depth - 3, hw: reach });
  }
  world.group.traverse((o) => {
    if (!isTerrain(o) || !o.isMesh) return;
    const g = o.geometry;
    const P = worldPositions(o);
    const I = triList(g);
    const nT = I.length / 3;
    const keep = new Uint8Array(nT).fill(1);
    for (let t = 0; t < nT; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const x = (P[a] + P[b] + P[c]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      if (regions.some((R) => inRegion(R, x, z))) keep[t] = 0;
    }
    rebuildTriangles(g, I, keep);
  });
}

// ---------------------------------------------------------------- kit

const ENV_STONE = { city: '#6d6a66', docks: '#5f6266', highway: '#8a8883', circuit: '#7e7d77', mountain: '#6c6a63', desert: '#9a7a5c' };

function makeKit(world, track) {
  const def = track.def;
  const wet = def.weather === 'wet' || def.weather === 'rain';
  const night = !!world.at.lamps;
  const asphaltOpts = { wet, worn: def.worn ?? 0.35, base: def.asphalt };
  const plain = roadTextures(20, { ...asphaltOpts, lanes: 2, center: 'none', edge: 'none' });
  const bore = roadTextures(9, { ...asphaltOpts, lanes: 2, center: 'dashed-white', edge: 'white' });
  const env = (def.weather === 'wet' || def.weather === 'rain') ? 1.5 : def.time === 'night' ? 0.35 : 0.6;
  const roadMat = (t) => glowMaterial(new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.rough, roughness: 1, metalness: 0, envMapIntensity: env }), 3.2);
  const stone = ENV_STONE[def.env] || '#7a7a76';
  const conc = concreteTexture(stone, 'roam');
  const kit = {
    night, wet, glow: [],
    plain, bore,
    plainMat: roadMat(plain),
    boreMat: roadMat(bore),
    concrete: glowMaterial(new THREE.MeshStandardMaterial({ map: conc, color: 0xffffff, roughness: 0.9 })),
    block: glowMaterial(new THREE.MeshStandardMaterial({ map: conc, color: 0xe6e4df, roughness: 0.95 })),
    tile: glowMaterial(new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.55, envMapIntensity: 0.4 })),
    dark: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    light: new THREE.MeshBasicMaterial({ color: night ? 0xffd9a0 : 0xfff2dc }),
    chevron: new THREE.MeshStandardMaterial({ map: chevronTexture(), roughness: 0.6 }),
    walk: glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#7a7974', 'walk'), roughness: wet ? 0.45 : 0.85, envMapIntensity: 0.6 })),
  };
  if (def.env === 'city') {
    const tx = facadeTextures(night ? 'concrete' : 'brick', 'roam' + def.id);
    kit.facade = new THREE.MeshStandardMaterial({ map: tx.map, emissive: 0xffffff, emissiveMap: tx.emi, emissiveIntensity: night ? 0.9 : 0, roughness: 0.85, envMapIntensity: 0.3 });
    world.disposables.push(kit.facade);
  }
  for (const m of [kit.plainMat, kit.boreMat, kit.concrete, kit.block, kit.tile, kit.dark, kit.light, kit.chevron, kit.walk]) world.disposables.push(m);
  return kit;
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c9c6bd';
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(60,58,52,0.55)';
  x.lineWidth = 2;
  for (let k = 0; k <= 128; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 128); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(128, k); x.stroke(); }
  x.fillStyle = 'rgba(30,28,24,0.35)';
  x.fillRect(0, 100, 128, 28);  // road grime low down
  return toTex(c);
}

function chevronTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#f2c200';
  x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#141414';
  for (let k = -64; k < 192; k += 32) {
    x.beginPath(); x.moveTo(k, 64); x.lineTo(k + 16, 64); x.lineTo(k + 48, 0); x.lineTo(k + 32, 0); x.closePath(); x.fill();
  }
  return toTex(c);
}

function signTexture(lines, arrow) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#0d5a2f';
  x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#e8efe8';
  x.lineWidth = 6;
  x.strokeRect(8, 8, 496, 144);
  x.fillStyle = '#f4f7f2';
  x.textBaseline = 'middle';
  x.font = 'bold 54px Arial, Helvetica, sans-serif';
  x.fillText(lines[0], 36, 62, 360);
  x.font = 'bold 30px Arial, Helvetica, sans-serif';
  x.fillStyle = '#cfe6d4';
  if (lines[1]) x.fillText(lines[1], 38, 118, 360);
  // arrow
  x.fillStyle = '#f4f7f2';
  x.save();
  x.translate(450, 80);
  if (arrow === 'left') x.rotate(-Math.PI / 2);
  if (arrow === 'right') x.rotate(Math.PI / 2);
  x.beginPath();
  x.moveTo(0, -46); x.lineTo(30, -10); x.lineTo(11, -10); x.lineTo(11, 46); x.lineTo(-11, 46); x.lineTo(-11, -10); x.lineTo(-30, -10);
  x.closePath();
  x.fill();
  x.restore();
  return toTex(c, { repeat: false });
}

const DISTRICT = { city: 'THE CITY', docks: 'THE DOCKS', highway: 'EXPRESSWAY', circuit: 'RACEWAY', mountain: 'MOUNTAIN PASS', desert: 'THE DESERT' };

// ---------------------------------------------------------------- strips along a stub

/** A strip following road T from s0 to s1; cols: [{ lat(w) , dy, u }] ordered by lat ascending. */
function strip(T, s0, s1, cols, mat, vLen = 12, step = 2) {
  const rows = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
  const nc = cols.length;
  const pos = new Float32Array(rows * nc * 3), uv = new Float32Array(rows * nc * 2);
  for (let r = 0; r < rows; r++) {
    const s = s0 + (s1 - s0) * (r / (rows - 1));
    const c0 = T.posAt(s, 0);
    const w = T.lerpArr(T.W, c0.i, c0.t);
    for (let c = 0; c < nc; c++) {
      const col = cols[c];
      const lat = col.lat(w);
      const p = T.posAt(s, lat);
      const k = r * nc + c;
      const yLat = col.flat ? Math.max(-w, Math.min(w, lat)) : lat;
      pos[k * 3] = p.x; pos[k * 3 + 1] = T.roadY(c0.i, c0.t, yLat) + (col.dy || 0); pos[k * 3 + 2] = p.z;
      uv[k * 2] = typeof col.u === 'function' ? col.u(w) : col.u;
      uv[k * 2 + 1] = s / vLen;
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < nc - 1; c++) {
      const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(rows * nc * 3), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the top faces up
  const n = g.attributes.normal;
  let up = 0;
  for (let k = 0; k < n.count; k++) up += n.getY(k);
  if (up < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.userData.roam = true;
  return m;
}

/** A jersey barrier along one side of a stub (side +1 left, −1 right). */
function jersey(T, s0, s1, side, kit, pad = 0.15) {
  const prof = [[0, 0], [0.06, 0.1], [0.2, 0.36], [0.27, 0.84], [0.45, 0.84], [0.52, 0.36], [0.66, 0.1], [0.72, 0]];
  const cols = prof.map(([dl, dy]) => ({ lat: (w) => side * (w + pad + dl), dy, u: dy, flat: true }));
  if (side < 0) cols.reverse();
  const m = strip(T, s0, s1, cols, kit.concrete, 4);
  // a barrier is two-sided: let the strip's facing not matter
  m.material = kit.concrete;
  return m;
}

// ---------------------------------------------------------------- the side road

function buildApproach(world, track, A, kit) {
  const S0 = A.road;
  const from = A.from - 0.2, to = A.to;
  // asphalt (wide at the mouth), a little past the main road's edge
  const road = strip(S0, from, to, [-1, -0.5, 0, 0.5, 1].map((f) => ({ lat: (w) => f * (w + 0.6), u: (f + 1) / 2 })), kit.plainMat, kit.plain.repeat);
  world.add(road);
  kit.glow.push(road);
  if (A.walk) {
    // a city street: curbs and sidewalks down both sides to the portal
    for (const side of [1, -1]) {
      const cols = [
        { lat: (w) => side * w, dy: 0, u: 0, flat: true },
        { lat: (w) => side * w, dy: 0.15, u: 0.05, flat: true },
        { lat: (w) => side * (w + A.walk), dy: 0.15, u: A.walk / 4, flat: true },
        { lat: (w) => side * (w + A.walk), dy: -0.3, u: A.walk / 4 + 0.1, flat: true },
      ];
      const m = strip(A.look, A.from + 0.6, A.face - 0.9, side > 0 ? cols : cols.reverse(), kit.walk, 4);
      world.add(m);
      kit.glow.push(m);
    }
  } else {
    // barriers down both sides, from the main road to the portal
    for (const side of [1, -1]) {
      const b = jersey(S0, A.from + 1.5, to, side, kit, 0.6);
      world.add(b);
      kit.glow.push(b);
    }
  }
  // stop line + "TUNNEL" lettering where it leaves the main road
  const p = S0.posAt(A.from + 4);
  const sign = sideSign(world, track, A, kit);
  if (sign) world.add(sign);
  void p;
  // elevated (an expressway on stilts, a quay over water): a deck on piers
  const groundY = envGround(track);
  if (groundY !== null && A.y0 - groundY > 2.2) {
    const gb = new GeoBuilder();
    for (let s = A.from + 6; s < A.face; s += 18) {
      const q = S0.posAt(s);
      gb.box(q.x, groundY - 0.5, q.z, 2.2, A.y0 - groundY - 0.4, 2.2, Math.atan2(A.ux, A.uz));
    }
    const deckL = A.face - A.from;
    const mid = S0.posAt(A.from + deckL / 2);
    gb.box(mid.x, A.y0 - 1.5, mid.z, A.laneHW * 2 + 2.6, 1.15, deckL, Math.atan2(A.ux, A.uz), { top: false, bottom: true });
    const m = new THREE.Mesh(gb.build(), kit.block);
    m.userData.roam = true;
    m.castShadow = true;
    world.add(m);
  }
}

/** Ground level for the environments that bring their own (null: terrain). */
function envGround(track) {
  const env = track.def.env;
  if (env === 'city') return -0.3;
  if (env === 'docks') return -3.4;
  if (env === 'highway') return (track.def.hw?.ground ?? 0) - 0.3;
  return null;
}

/** A gantry-style sign at the mouth of the side road: where the tunnels go. */
function sideSign(world, track, A, kit) {
  const names = ['next', 'prev'].map((e) => TRACK_BY_ID[world.roam.links[e]]?.name).filter(Boolean);
  if (!names.length) return null;
  const S0 = A.road;
  const s = A.from + 10;
  const c = S0.posAt(s, 0);
  const w = S0.lerpArr(S0.W, c.i, c.t);
  const g = new THREE.Group();
  g.userData.roam = true;
  const tex = signTexture([`TUNNELS`, names.join('  ·  ')], 'up');
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.25), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: kit.night ? 0.55 : 0.05 }));
  world.disposables.push(tex, panel.material);
  const heading = Math.atan2(A.ux, A.uz);
  // facing traffic turning in: back toward the main road
  panel.position.set(c.x, c.y + 6.1, c.z);
  panel.rotation.y = heading + Math.PI;
  g.add(panel);
  const gb = new GeoBuilder();
  for (const sd of [-1, 1]) {
    const q = S0.posAt(s, sd * (w + 1.6));
    gb.box(q.x, c.y, q.z, 0.35, 7.4, 0.35, heading);
  }
  const beamL = (w + 1.6) * 2;
  gb.box(c.x - A.ux * 0.15, c.y + 6.9, c.z - A.uz * 0.15, beamL, 0.3, 0.3, heading + Math.PI / 2);
  const posts = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.5, metalness: 0.6 }));
  world.disposables.push(posts.material);
  g.add(posts);
  return g;
}

// ---------------------------------------------------------------- tunnels

function buildBore(world, q, kit) {
  const T = q.road;
  const s0 = q.s0, s1 = q.s0 + G.depth - 2;
  // the road on into the dark (a little past the face for side-road bores:
  // the divider's run-up), walkways, tiled walls, lights, the far end
  const start = q.end ? q.s0 : 0;
  const road = strip(T, start, s1, [-1, -0.5, 0, 0.5, 1].map((f) => ({ lat: (w) => f * (w + 0.35), u: (f + 1) / 2 })), kit.boreMat, kit.bore.repeat);
  world.add(road);
  kit.glow.push(road);
  for (const side of [1, -1]) {
    const wall = strip(T, s0, s1, [{ lat: (w) => side * (w + 0.35), dy: 0, u: 0 }, { lat: (w) => side * (w + 0.35), dy: G.roof, u: G.roof / 2.5 }], kit.tile, 2.5);
    wall.material = kit.tile;
    wall.material.side = THREE.DoubleSide;
    world.add(wall);
    kit.glow.push(wall);
  }
  const ceil = strip(T, s0, s1, [{ lat: (w) => -(w + 0.36), dy: G.roof, u: 0 }, { lat: (w) => w + 0.36, dy: G.roof, u: 1 }], kit.dark, 8);
  ceil.material = kit.dark;
  ceil.material.side = THREE.DoubleSide;
  world.add(ceil);
  // light fittings down the middle of the roof, and their light on the road
  const gb = new GeoBuilder();
  for (let s = s0 + 3; s < s1 - 2; s += 7) {
    const p = T.posAt(s, 0);
    gb.box(p.x, p.y + G.roof - 0.12, p.z, 0.5, 0.1, 2.6, Math.atan2(q.ax, q.az));
    if ((s - s0) % 14 < 7) world.addLamp(p.x, p.y + G.roof - 0.4, p.z, kit.night ? '#ffcf8a' : '#fff0d0', 9, 0.9);
  }
  const lights = new THREE.Mesh(gb.build(), kit.light);
  lights.userData.roam = true;
  world.add(lights);
  // the far end: black
  const e = T.posAt(s1, 0);
  const w = T.lerpArr(T.W, e.i, e.t) + 0.4;
  const cap = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, G.roof + 0.2), kit.dark);
  cap.position.set(e.x, e.y + G.roof / 2, e.z);
  cap.rotation.y = Math.atan2(q.ax, q.az) + Math.PI;
  cap.userData.roam = true;
  world.add(cap);
}

/** The portal: a concrete face with the bore openings and destination signs, and the block it's set into. */
function buildFace(world, f, kit, terrainEnv) {
  const heading = Math.atan2(f.ax, f.az);           // into the tunnel
  const vx = f.az, vz = -f.ax;                        // across (the driver's left, going in)
  const at = (a, o) => [f.x + f.ax * a + vx * o, f.z + f.az * a + vz * o];
  const top = f.y + G.roof + 3.2;
  const groundY = terrainEnv ? f.y - 3 : Math.min(f.y - 1, (envGroundFrom(world) ?? f.y - 1));
  const bores = f.bores.slice().sort((a, b) => a.off - b.off);
  const gb = new GeoBuilder();
  // across the face: solid wherever there's no bore opening
  const edges = [-f.hw];
  for (const b of bores) edges.push(b.off - b.hw - 0.37, b.off + b.hw + 0.37);
  edges.push(f.hw);
  const box = (a0, a1, o0, o1, y0, y1, g = gb) => {
    const [cx, cz] = at((a0 + a1) / 2, (o0 + o1) / 2);
    g.box(cx, y0, cz, Math.abs(o1 - o0), y1 - y0, Math.abs(a1 - a0), heading);
  };
  for (let k = 0; k < edges.length; k += 2) {
    if (edges[k + 1] - edges[k] > 0.05) box(-0.9, G.depth, edges[k], edges[k + 1], groundY, top);
  }
  // over the bores: the lintel and the roof slab
  box(-0.9, G.depth, -f.hw, f.hw, f.y + G.roof, top);
  // a back wall
  box(G.depth - 0.5, G.depth, -f.hw, f.hw, groundY, top);
  if (kit.facade) {
    // in town the tunnel runs in under a building
    const hb = new GeoBuilder();
    const [bx, bz] = at(G.depth / 2, 0);
    const h = 18 + (Math.abs(Math.sin(f.x * 0.13 + f.z * 0.07)) * 30);
    hb.box(bx, top - 0.05, bz, f.hw * 2 + 0.6, h, G.depth + 0.4, heading, { uw: 14, uh: 40 });
    const bm = new THREE.Mesh(hb.build(), kit.facade);
    bm.userData.roam = true;
    bm.castShadow = true;
    world.add(bm);
  }
  const block = new THREE.Mesh(withGlow(gb.build()), kit.block);
  block.castShadow = true;
  block.receiveShadow = true;
  block.userData.roam = true;
  world.add(block);
  kit.glow.push(block);
  // portal frame: a lighter band round each opening, a coping along the top
  const fb = new GeoBuilder();
  for (const b of bores) {
    const o0 = b.off - b.hw - 0.35, o1 = b.off + b.hw + 0.35;
    box(-1.3, -0.85, o0 - 0.7, o0, f.y - 0.2, f.y + G.roof + 0.7, fb);
    box(-1.3, -0.85, o1, o1 + 0.7, f.y - 0.2, f.y + G.roof + 0.7, fb);
    box(-1.3, -0.85, o0 - 0.7, o1 + 0.7, f.y + G.roof, f.y + G.roof + 0.7, fb);
  }
  box(-1.4, -0.6, -f.hw - 0.3, f.hw + 0.3, top - 0.4, top + 0.25, fb);
  const frame = new THREE.Mesh(withGlow(fb.build()), kit.concrete);
  frame.userData.roam = true;
  world.add(frame);
  kit.glow.push(frame);
  // destination signs over the openings
  for (const b of bores) {
    const name = TRACK_BY_ID[b.to]?.name || b.to.toUpperCase();
    const env = TRACK_BY_ID[b.to]?.env;
    const tex = signTexture([name, DISTRICT[env] || ''], 'up');
    const w = Math.min(b.hw * 2 + 0.4, 9);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: kit.night ? 0.55 : 0.05 });
    world.disposables.push(tex, mat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 512), mat);
    const [sx, sz] = at(-1.42, b.off);
    sign.position.set(sx, f.y + G.roof + 1.05 + w * 80 / 512, sz);
    sign.rotation.y = heading + Math.PI;
    sign.userData.roam = true;
    world.add(sign);
    // lamps at the mouth (they light the road in and the face)
    const [lx, lz] = at(-3, b.off);
    world.addLamp(lx, f.y + G.roof + 0.4, lz, kit.night ? '#ffc078' : '#fff2dc', 14, 1.1);
  }
  // the divider's nose: a crash cushion, then a barrier into the face
  if (bores.length > 1) {
    const mid = (bores[0].off + bores[0].hw + bores[1].off - bores[1].hw) / 2;
    const cb = new GeoBuilder();
    const [nx, nz] = at(-G.nose + 1.4, mid);
    cb.box(nx, f.y, nz, 1.4, 1.0, 2.6, heading);
    const cushion = new THREE.Mesh(cb.build(), kit.chevron);
    cushion.userData.roam = true;
    world.add(cushion);
    const db = new GeoBuilder();
    const [dx, dz] = at((-G.nose + 2.7 - 0.9) / 2, mid);
    db.box(dx, f.y, dz, 0.6, 0.95, G.nose - 2.7 - 0.9, heading);
    const div = new THREE.Mesh(withGlow(db.build()), kit.concrete);
    div.userData.roam = true;
    world.add(div);
    kit.glow.push(div);
  }
}

function envGroundFrom(world) { return envGround(world.track); }

function withGlow(g) {
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  return g;
}
