// PORT HALCYON — the ground of one world cell as a mesh: the terrain grid
// (graded to the roads), coloured by the district palette, lit by the
// normals of its apron grid (so cells meet without a seam), split into
// triangles exactly as physics reads it, with a skirt round the edge to hide
// any crack against a coarser neighbour.
import * as THREE from 'three';
import { groundColor } from '../ground.js';
import { terrainMat } from '../kit.js';

const _c = [0, 0, 0];

export function terrainMesh(g) {
  const { n, m, res, x0, z0, H, R } = g;
  const nv = n * n;
  const skirt = 4 * (n - 1) * 2;               // two verts per edge step
  const pos = new Float32Array((nv + skirt) * 3);
  const nor = new Float32Array((nv + skirt) * 3);
  const col = new Float32Array((nv + skirt) * 3);
  const uv = new Float32Array((nv + skirt) * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const a = (j + 1) * m + (i + 1);
      const x = x0 + i * res, z = z0 + j * res, h = H[a];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      // normal from the apron grid (central differences)
      const hx = H[a + 1] - H[a - 1], hz = H[a + m] - H[a - m];
      const l = Math.hypot(hx, 2 * res, hz);
      const nx = -hx / l, ny = 2 * res / l, nz = -hz / l;
      nor[k * 3] = nx; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nz;
      groundColor(x, z, h, ny, R[a], _c);
      col[k * 3] = _c[0]; col[k * 3 + 1] = _c[1]; col[k * 3 + 2] = _c[2];
      uv[k * 2] = x / 7; uv[k * 2 + 1] = z / 7;
    }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      // split along b–c, as Terrain.heightAt reads it
      idx.push(a, c, b, b, c, d);
    }
  }
  // skirts: the edge verts dropped a few metres, faced outward
  let s = nv;
  const edge = (list, outward) => {
    for (let q = 0; q < list.length - 1; q++) {
      const A = list[q], B = list[q + 1];
      const a2 = s++, b2 = s++;
      for (const [dst, src] of [[a2, A], [b2, B]]) {
        pos[dst * 3] = pos[src * 3]; pos[dst * 3 + 1] = pos[src * 3 + 1] - 4; pos[dst * 3 + 2] = pos[src * 3 + 2];
        nor[dst * 3] = nor[src * 3]; nor[dst * 3 + 1] = nor[src * 3 + 1]; nor[dst * 3 + 2] = nor[src * 3 + 2];
        col[dst * 3] = col[src * 3] * 0.8; col[dst * 3 + 1] = col[src * 3 + 1] * 0.8; col[dst * 3 + 2] = col[src * 3 + 2] * 0.8;
        uv[dst * 2] = uv[src * 2]; uv[dst * 2 + 1] = uv[src * 2 + 1] + 0.5;
      }
      if (outward) idx.push(A, a2, B, B, a2, b2);
      else idx.push(A, B, a2, B, b2, a2);
    }
  };
  const row = (j) => Array.from({ length: n }, (_, i) => j * n + i);
  const colm = (i) => Array.from({ length: n }, (_, j) => j * n + i);
  // (each skirt faces out of the cell: north edge −z, south +z, west −x, east +x)
  edge(row(0), false);
  edge(row(n - 1), true);
  edge(colm(0), true);
  edge(colm(n - 1), false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
  geo.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, terrainMat());
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.userData.terrain = true;
  return mesh;
}
