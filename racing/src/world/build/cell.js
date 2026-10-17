// PORT HALCYON — building one world cell, in slices (a generator: the
// streamer runs it a few milliseconds a frame): the ground, the roads with
// their kerbs and lamps, whatever the districts put there, then the lamp
// light baked onto everything that takes it (the cell's own lamps and its
// neighbours'), and the halos round the lamp heads.
import * as THREE from 'three';
import { CELL } from '../terrain.js';
import { Batch } from './geo.js';
import { terrainMesh } from './terrain.js';
import { buildRoads, lampsInBox } from './roads.js';
import { haloMat } from '../kit.js';

const _lamps = [];

/** ctx: { net, terrain, districts (optional), wet } */
export function* buildCell(ctx, cx, cz) {
  const group = new THREE.Group();
  group.name = `cell ${cx},${cz}`;
  const x0 = cx * CELL, z0 = cz * CELL;
  const glowing = [];
  // the ground
  const g = ctx.terrain.grid(cx, cz, 4);
  yield;
  const ground = terrainMesh(g);
  group.add(ground);
  glowing.push(ground);
  yield;
  // the roads
  const batch = new Batch();
  const rr = buildRoads(ctx.net, cx, cz, batch, { wet: ctx.wet });
  yield;
  // the districts' buildings, landmarks, props and trees (props close up only)
  const out = { batch, nearBatch: new Batch(), group, colliders: [], lamps: [], anims: [] };
  if (ctx.districts) yield* ctx.districts.buildCell(cx, cz, out);
  glowing.push(...batch.flush(group));
  yield;
  const near = new THREE.Group();
  near.name = 'near';
  glowing.push(...out.nearBatch.flush(near));
  group.add(near);
  yield;
  // light: every lamp within reach of the cell (neighbours' too)
  const lamps = lampsInBox(ctx.net, x0 - 45, z0 - 45, x0 + CELL + 45, z0 + CELL + 45, _lamps).slice();
  if (ctx.districts) lamps.push(...ctx.districts.lampsInBox(x0 - 45, z0 - 45, x0 + CELL + 45, z0 + CELL + 45));
  for (const m of glowing) { bake([m], lamps); yield; }
  // halos round the lamp heads standing in this cell
  const own = [...rr.lamps, ...out.lamps];
  if (own.length) group.add(halos(own));
  return { group, near, piers: rr.piers, anims: out.anims, lamps: own };
}

/** Sum lamp light into the 'glow' attribute of every mesh that takes it. */
export function bake(meshes, lamps) {
  if (!lamps.length) return;
  const cell = 24;
  const grid = new Map();
  for (const L of lamps) {
    const k = Math.floor(L.hx / cell) * 100003 + Math.floor(L.hz / cell);
    let a = grid.get(k);
    if (!a) { a = []; grid.set(k, a); }
    a.push(L);
  }
  for (const m of meshes) {
    const p = m.geometry.attributes.position, gl = m.geometry.attributes.glow;
    if (!gl) continue;
    const P = p.array, G = gl.array;
    for (let v = 0; v < p.count; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      let r = 0, gg = 0, b = 0;
      const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const list = grid.get((cx + dx) * 100003 + cz + dz);
          if (!list) continue;
          for (const L of list) {
            const d2 = (L.hx - x) ** 2 + (L.hz - z) ** 2;
            const R = L.radius;
            if (d2 > R * R) continue;
            const hy = Math.max(1, L.hy - y);
            const d = Math.sqrt(d2 + hy * hy * 0.3);
            const f = Math.max(0, 1 - d / R);
            const k = f * f * (L.intensity ?? 1);
            r += L.color.r * k; gg += L.color.g * k; b += L.color.b * k;
          }
        }
      }
      G[v * 3] = Math.min(r, 3); G[v * 3 + 1] = Math.min(gg, 3); G[v * 3 + 2] = Math.min(b, 3);
    }
    gl.needsUpdate = true;
  }
}

/** Instanced glow sprites round lamp heads (visible at night). */
function halos(lamps) {
  // (each cell its own little quad: disposing a cell must not free another's buffers)
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  const n = lamps.length;
  const col = new Float32Array(n * 3), sz = new Float32Array(n);
  const mesh = new THREE.InstancedMesh(geo, haloMat(), n);
  const M = new THREE.Matrix4();
  lamps.forEach((L, k) => {
    M.makeTranslation(L.hx, L.hy - 0.35, L.hz);
    mesh.setMatrixAt(k, M);
    col[k * 3] = L.color.r; col[k * 3 + 1] = L.color.g; col[k * 3 + 2] = L.color.b;
    sz[k] = L.halo ?? Math.min(7, 2.2 + L.radius * 0.18);
  });
  geo.setAttribute('icol', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('isz', new THREE.InstancedBufferAttribute(sz, 1));
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return mesh;
}
