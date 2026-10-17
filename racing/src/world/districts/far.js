// PORT HALCYON — the skyline from far away: every district's far shapes
// (each building's block, a crane's tower, a water tower, a lighthouse) in
// one mesh over the whole map, plain coloured, with a storey-by-storey grid
// of windows that light up at night (some windows, not all, and they fade to
// an average glow where they'd be smaller than a pixel). Each world cell's
// shapes hide (in the vertex shader, from the same cell mask as the far
// ground) once its detailed version is built.
import * as THREE from 'three';
import { U } from '../kit.js';

const SEG = 8;

/**
 * list: far shapes ({ shape, x, z, y, w, d, h, ry, r, color, lit, cell }).
 * cellId(x, z) → the cell's index in the mask. maskU: { uMask, uMaskN }.
 */
export function buildFarSkyline(list, cellId, maskU) {
  let nv = 0, ni = 0;
  for (const f of list) {
    if (f.shape === 'cyl') { nv += SEG * 4 + SEG + 1; ni += SEG * 6 + SEG * 3; }
    else if (f.shape === 'cone') { nv += SEG * 3; ni += SEG * 3; }
    else { nv += 20; ni += 30; }
  }
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), aux = new Float32Array(nv * 4), cid = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  let v = 0, q = 0;
  const C = new THREE.Color();
  let seed = 0;
  for (const f of list) {
    C.set(f.color || '#777777');
    const id = cellId(f.x, f.z);
    const lit = f.lit || 0;
    seed = (seed + 0.618034) % 1;
    const put = (x, y, z, u, h, isWall) => {
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
      col[v * 3] = C.r; col[v * 3 + 1] = C.g; col[v * 3 + 2] = C.b;
      aux[v * 4] = u; aux[v * 4 + 1] = h; aux[v * 4 + 2] = isWall ? lit : 0; aux[v * 4 + 3] = seed;
      cid[v] = id;
      return v++;
    };
    const quad = (a, b, c, d) => { idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = a; idx[q++] = c; idx[q++] = d; };
    if (f.shape === 'cyl' || f.shape === 'cone') {
      const r = f.r ?? f.w / 2, r2 = f.shape === 'cone' ? 0 : (f.r2 ?? r);
      const y0 = f.y, y1 = f.y + f.h;
      for (let i = 0; i < SEG; i++) {
        const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2;
        const u0 = i * (2 * Math.PI * r / SEG), u1 = u0 + 2 * Math.PI * r / SEG;
        if (f.shape === 'cone') {
          const A = put(f.x + Math.cos(a1) * r, y0, f.z + Math.sin(a1) * r, u1, 0, false);
          const B = put(f.x + Math.cos(a0) * r, y0, f.z + Math.sin(a0) * r, u0, 0, false);
          const T = put(f.x, y1, f.z, u0, f.h, false);
          idx[q++] = A; idx[q++] = B; idx[q++] = T;
        } else {
          const A = put(f.x + Math.cos(a1) * r, y0, f.z + Math.sin(a1) * r, u1, 0, true);
          const B = put(f.x + Math.cos(a0) * r, y0, f.z + Math.sin(a0) * r, u0, 0, true);
          const Cc = put(f.x + Math.cos(a0) * r2, y1, f.z + Math.sin(a0) * r2, u0, f.h, true);
          const D = put(f.x + Math.cos(a1) * r2, y1, f.z + Math.sin(a1) * r2, u1, f.h, true);
          quad(A, B, Cc, D);
        }
      }
      if (f.shape === 'cyl') {
        const c0 = put(f.x, y1, f.z, 0, 0, false);
        const ring = [];
        for (let i = 0; i < SEG; i++) { const a = (i / SEG) * Math.PI * 2; ring.push(put(f.x + Math.cos(a) * r2, y1, f.z + Math.sin(a) * r2, 0, 0, false)); }
        for (let i = 0; i < SEG; i++) { idx[q++] = c0; idx[q++] = ring[(i + 1) % SEG]; idx[q++] = ring[i]; }
      }
      continue;
    }
    // a box: four walls and a roof
    const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0);
    const P = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
    const hw = f.w / 2, hd = f.d / 2, y0 = f.y, y1 = f.y + f.h;
    const corners = [P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd)];
    const lens = [f.w, f.d, f.w, f.d];
    for (let k = 0; k < 4; k++) {
      const A = corners[k], B = corners[(k + 1) % 4];
      const a = put(A[0], y0, A[1], 0, 0, true), b = put(B[0], y0, B[1], lens[k], 0, true);
      const cc = put(B[0], y1, B[1], lens[k], f.h, true), d = put(A[0], y1, A[1], 0, f.h, true);
      quad(a, b, cc, d);
    }
    const t = corners.map((p) => put(p[0], y1, p[1], 0, 0, false));
    quad(t[0], t[1], t[2], t[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, v * 3), 3));
  g.setAttribute('aux', new THREE.BufferAttribute(aux.subarray(0, v * 4), 4));
  g.setAttribute('cellId', new THREE.BufferAttribute(cid.subarray(0, v), 1));
  g.setIndex(new THREE.BufferAttribute(idx.subarray(0, q), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.4 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = maskU.uMask;
    sh.uniforms.uMaskN = maskU.uMaskN;
    sh.uniforms.uNight = U.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cellId;\nattribute vec4 aux;\nvarying vec4 vAux;\nuniform sampler2D uMask;\nuniform vec2 uMaskN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAux = aux;
        vec2 mc = vec2(mod(cellId, uMaskN.x), floor(cellId / uMaskN.x));
        if (texture2D(uMask, (mc + 0.5) / uMaskN).r > 0.5) transformed.y -= 4000.0;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vAux; uniform float uNight;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (vAux.z > 0.0) {
          vec2 g = vec2(vAux.x / 3.2, vAux.y / 3.6);
          vec2 cellv = floor(g), fv = fract(g);
          float win = step(0.22, fv.x) * step(fv.x, 0.78) * step(0.3, fv.y) * step(fv.y, 0.78);
          float on = step(fh(cellv + vAux.w * 97.0), vAux.z);
          // where a window is under a pixel, fade to the average
          float small = clamp((max(fwidth(g.x), fwidth(g.y)) - 0.35) * 2.0, 0.0, 1.0);
          float lit = mix(win * on, vAux.z * 0.22, small);
          float dark = mix(win, 0.25, small);
          diffuseColor.rgb *= 1.0 - dark * 0.45 * (1.0 - uNight);
          totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * lit * uNight * 1.4;
        }`);
  };
  mat.customProgramCacheKey = () => 'world-far-skyline';
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
