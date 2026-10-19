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
  const g = yield* ctx.terrain.gridSteps(cx, cz, 4);
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

const REHEARSED = new Set();     // pack ids

/**
 * Build one cell of each district's pack once and throw it away, a step at
 * a time (a generator, like buildCell): the pack's code is compiled, and its
 * first-use costs paid, while the world loads rather than in the first cell
 * of that district met at speed (cold, a cell's longest step can be several
 * times its usual). Once a page per pack. only: the district ids to cover
 * (all of them if not given). A pack's cell is the one holding most of its
 * planned items; every pack with items in that cell is warmed by it too.
 */
export function* rehearse(ctx, only = null) {
  const D = ctx.districts;
  if (!D?.items) return;
  const todo = new Set();
  for (const d of D.list) if (!only || only.has(d.id)) todo.add(D.packFor(d).id);
  for (const id of REHEARSED) todo.delete(id);
  while (todo.size) {
    const id = todo.values().next().value;
    todo.delete(id);
    REHEARSED.add(id);
    let best = null, n = 0;
    for (const [k, items] of D.items) {
      let c = 0;
      for (const it of items) if (it.pack === id) c++;
      if (c > n) { n = c; best = k; }
    }
    if (!best) continue;
    for (const it of D.items.get(best)) if (todo.delete(it.pack)) REHEARSED.add(it.pack);
    const [cx, cz] = best.split(',').map(Number);
    const job = buildCell(ctx, cx, cz);
    let r;
    do { r = job.next(); yield; } while (!r.done);
    r.value.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
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
