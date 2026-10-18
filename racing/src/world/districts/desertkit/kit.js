// PORT HALCYON — the desert kit: what the four desert packs (Route 99 and
// the High Desert, Red Rock Canyon, Ghost Town, Dry Lake) share. One set of
// materials for all of them (made once through the first pack's B.mat, then
// handed to the others), vertex-coloured so a cell draws its whole desert in
// a dozen draw calls; geometry helpers on top of builder.js (tilted boxes,
// upright panels mapped to an atlas piece, tubes, jittered rock blobs,
// irregular drums); and the neon and animated-light shaders (neon glows by
// night and reads as coloured glass by day; animated lights chase, blink,
// flicker or run a sequence from their uv, on the world clock).
import * as THREE from 'three';
import { U } from '../../kit.js';
import { litMat } from '../builder.js';
import { F_BRIDGE, F_ELEV } from '../../net.js';
import { signsAtlas, roadSignsAtlas, adsAtlas, strataTexture, foliageTexture, tinTexture, driftTexture, stuccoTexture, woodTexture, ghostAtlas, dragAtlas } from './tex.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** A cheap integer hash → [0, 1). */
export function hash1(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ colour

const LIN = new Map();
const _c = new THREE.Color();
/** A hex colour in the working (linear) space as [r, g, b]. */
export function lin(hex) {
  let v = LIN.get(hex);
  if (!v) { _c.set(hex); v = [_c.r, _c.g, _c.b]; LIN.set(hex, v); }
  return v;
}
/** Set the vertex colour (hex × k) for what is added to acc next. */
export function paint(acc, hex, k = 1) {
  const c = lin(hex);
  acc.col = k === 1 ? c : [c[0] * k, c[1] * k, c[2] * k];
  return acc;
}
/** Mix two hex colours (t 0 → a) as a vertex colour. */
export function paintMix(acc, a, b, t, k = 1) {
  const p = lin(a), q = lin(b);
  acc.col = [(p[0] + (q[0] - p[0]) * t) * k, (p[1] + (q[1] - p[1]) * t) * k, (p[2] + (q[2] - p[2]) * t) * k];
  return acc;
}

// ------------------------------------------------------------------ build pacing

/** A step clock for build generators: true (and reset) once ms have passed. */
export function clock(ms = 3) {
  let t0 = performance.now();
  return () => {
    const t = performance.now();
    if (t - t0 < ms) return false;
    t0 = t;
    return true;
  };
}

// ------------------------------------------------------------------ materials

const SHARED = new Map();
/** A material shared by every desert pack (made once, through the first pack to ask). */
export function smat(B, key, make) {
  let m = SHARED.get(key);
  if (!m) { m = B.mat('dk:' + key, make); SHARED.set(key, m); }
  return m;
}

/** Neon tubes, bulbs, pool water: unlit vertex colour, dayK by day, nightK (blooming) by night. */
function neonMat(dayK, nightK) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n\tdiffuseColor.rgb *= mix(${dayK.toFixed(2)}, ${nightK.toFixed(2)}, uNight);`);
  };
  m.customProgramCacheKey = () => `dk-neon-${dayK}-${nightK}`;
  m.userData.castShadow = false;
  return m;
}

/**
 * Animated lights (one material for all): uv.x is the phase, uv.y the mode —
 *   y ≥ 0        blink/chase at y Hz (on half the cycle, shifted by x cycles)
 *   y < 0        flicker: a random on/off tick at −y Hz (mostly on)
 *   y > 50       sequence: on while fract(t·(y − 100)) is in [fract(x), floor(x)/100]
 */
function animLightMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vAnim;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvAnim = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uTime;\nvarying vec2 vAnim;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sp = vAnim.y, on;
        if (sp > 50.0) { float f = fract(uTime * (sp - 100.0)); on = step(fract(vAnim.x), f) * step(f, floor(vAnim.x) / 100.0); }
        else if (sp >= 0.0) { on = step(fract(uTime * sp - vAnim.x), 0.5); }
        else { on = step(0.2, fract(sin(floor(uTime * -sp) * 12.9898 + vAnim.x * 78.233) * 43758.5453)); }
        diffuseColor.rgb *= mix(0.07, 1.0, on) * mix(0.9, 3.8, uNight);`);
  };
  m.customProgramCacheKey = () => 'dk-animlights';
  m.userData.castShadow = false;
  return m;
}

/** Every shared material by name (each made on first use). */
export const MAT = {
  paint: (B) => smat(B, 'paint', () => litMat({ vertexColors: true, roughness: 0.78, metalness: 0.02 })),
  metal: (B) => smat(B, 'metal', () => litMat({ vertexColors: true, roughness: 0.3, metalness: 0.82, envMapIntensity: 1.3 })),
  rock: (B) => smat(B, 'rock', () => litMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
  strata: (B) => smat(B, 'strata', () => litMat({ map: strataTexture(), vertexColors: true, roughness: 0.93 })),
  plant: (B) => smat(B, 'plant', () => litMat({ vertexColors: true, roughness: 0.9, flatShading: true })),
  foliage: (B) => smat(B, 'foliage', () => litMat({ map: foliageTexture(), vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 }, { shadow: false })),
  signs: (B) => smat(B, 'signs', () => { const t = signsAtlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.55 }, { night: 1.9 }); }),
  roadsigns: (B) => smat(B, 'roadsigns', () => litMat({ map: roadSignsAtlas(), roughness: 0.5, metalness: 0.1, emissive: 0xffffff, emissiveMap: roadSignsAtlas() }, { night: 0.1 })),
  ads: (B) => smat(B, 'ads', () => { const t = adsAtlas(); return litMat({ map: t, emissive: 0xffffff, emissiveMap: t, roughness: 0.75 }, { night: 0.38 }); }),
  tin: (B) => smat(B, 'tin', () => litMat({ map: tinTexture(), vertexColors: true, roughness: 0.55, metalness: 0.35 })),
  stucco: (B) => smat(B, 'stucco', () => litMat({ map: stuccoTexture(), vertexColors: true, roughness: 0.88 })),
  wood: (B) => smat(B, 'wood', () => litMat({ map: woodTexture(), vertexColors: true, roughness: 0.92 })),
  ghost: (B) => smat(B, 'ghost', () => { const t = ghostAtlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.85 }, { night: 1.3 }); }),
  drag: (B) => smat(B, 'drag', () => { const t = dragAtlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.6 }); }),
  drift: (B) => smat(B, 'drift', () => litMat({ map: driftTexture(), vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }, { shadow: false })),
  neon: (B) => smat(B, 'neon', () => neonMat(0.85, 3.4)),
  glass: (B) => smat(B, 'glass', () => neonMat(0.55, 1.6)),
  lights: (B) => smat(B, 'lights', () => animLightMat()),
  wire: (B) => smat(B, 'wire', () => new THREE.LineBasicMaterial({ color: 0x15130f })),
  tumble: (B) => smat(B, 'tumble', () => new THREE.LineBasicMaterial({ color: 0x9a7a50 })),
  lot: (B) => smat(B, 'lot', () => litMat({ vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }, { shadow: false })),
  hole: (B) => smat(B, 'hole', () => { const m = new THREE.MeshBasicMaterial({ color: 0x030303 }); m.userData.castShadow = false; return m; }),
};

// ------------------------------------------------------------------ geometry

/** Rotation (yaw ry about +y as builder.js turns things, then pitch rx about local x, roll rz about local z). */
export function rot3(ry, rx = 0, rz = 0) {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  // M = Ry · Rx · Rz (columns: where local x, y, z go)
  const Rz = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];
  const Rx = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
  const Ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const mul = (A, Bm) => {
    const o = new Array(9);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = A[r] * Bm[c * 3] + A[3 + r] * Bm[c * 3 + 1] + A[6 + r] * Bm[c * 3 + 2];
    return o;
  };
  return mul(Ry, mul(Rx, Rz));
}

/** A box (base centre x, y, z; w × h × d) turned by yaw/pitch/roll, all six faces unless o.bottom === false. */
export function obox(acc, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0, o = {}) {
  const M = rot3(ry, rx, rz);
  const P = (lx, ly, lz) => [x + M[0] * lx + M[3] * ly + M[6] * lz, y + M[1] * lx + M[4] * ly + M[7] * lz, z + M[2] * lx + M[5] * ly + M[8] * lz];
  const hw = w / 2, hd = d / 2, U = o.u || 1;
  acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), [0, 0, w / U, h / U]);
  acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), [0, 0, w / U, h / U]);
  acc.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), [0, 0, d / U, h / U]);
  acc.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), [0, 0, d / U, h / U]);
  acc.quadP(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), [0, 0, w / U, d / U]);
  if (o.bottom !== false) acc.quadP(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), [0, 0, w / U, d / U]);
}

/** A box between two points (a beam/strut), square section s. */
export function strut(acc, ax, ay, az, bx, by, bz, s = 0.2, s2 = s) { acc.beam(ax, ay, az, bx, by, bz, s, s2); }

/**
 * An upright panel (a sign face) centred on (x, z), base at y, w wide and h
 * tall, facing local +z of ry (toward (sin ry, cos ry)); uv: [u0, v0, u1, v1].
 */
export function panel(acc, x, y, z, ry, w, h, uv = [0, 0, 1, 1], tilt = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const hw = w / 2;
  const tz = Math.sin(tilt) * h, th = Math.cos(tilt) * h;
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  acc.quadP(P(-hw, 0, 0), P(hw, 0, 0), P(hw, th, -tz), P(-hw, th, -tz), uv);
}

/** A flat horizontal quad (w along local x, d along local z) at height y facing up (or down). */
export function flat(acc, x, y, z, w, d, ry = 0, uv = [0, 0, 1, 1], down = false) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  const hw = w / 2, hd = d / 2;
  if (!down) acc.quadP(P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd), uv);
  else acc.quadP(P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd), uv);
}

/** A swept tube through pts ([x, y, z]) with radii per point, seg sides; capped at the far end. */
export function tube(acc, pts, radii, seg = 6, cap = true) {
  const n = pts.length;
  const rings = [];
  let px = 1, py = 0, pz = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // a side vector square to the tangent (carried along to avoid twists)
    let sx = py * tz - pz * ty, sy = pz * tx - px * tz, sz = px * ty - py * tx;
    let sl = Math.hypot(sx, sy, sz);
    if (sl < 1e-3) { const ux = Math.abs(ty) > 0.9 ? 1 : 0, uy = Math.abs(ty) > 0.9 ? 0 : 1; sx = uy * tz; sy = -ux * tz; sz = ux * ty - uy * tx; sl = Math.hypot(sx, sy, sz) || 1; }
    sx /= sl; sy /= sl; sz /= sl;
    const ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
    px = ux; py = uy; pz = uz;
    const r = radii[Math.min(i, radii.length - 1)];
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const an = (k / seg) * TAU, ca = Math.cos(an) * r, sa = Math.sin(an) * r;
      ring.push([pts[i][0] + sx * ca + ux * sa, pts[i][1] + sy * ca + uy * sa, pts[i][2] + sz * ca + uz * sa]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const k2 = (k + 1) % seg;
      acc.quadP(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], [0, 0, 1, 1]);
    }
  }
  if (cap && radii[radii.length - 1] > 0.001) {
    const last = rings[n - 1], c = pts[n - 1];
    const ci = acc.v(c[0], c[1], c[2], 0.5, 0.5);
    const ids = last.map((p) => acc.v(p[0], p[1], p[2], 0.5, 0.5));
    for (let k = 0; k < seg; k++) acc.tri(ci, ids[k], ids[(k + 1) % seg]);
  }
}

// a unit icosahedron (12 verts, 20 faces)
const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((q) => q / l); });
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return { v, f };
})();

/**
 * A jittered rock blob: an icosahedron scaled (sx, sy, sz), its corners
 * pushed in and out by `jit` (seeded), turned ry, base flattened below
 * `floor` (fraction of sy under the centre that stays: rocks sit in the sand).
 */
export function blob(acc, x, y, z, sx, sy, sz, ry, seed, jit = 0.3, flatBase = 0.55) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = ICO.v.map((p, i) => {
    const k = 1 + (hash1(seed, i, 7) - 0.5) * 2 * jit;
    let lx = p[0] * sx * k, ly = p[1] * sy * k, lz = p[2] * sz * k;
    if (ly < -sy * flatBase) ly = -sy * flatBase;
    return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  });
  for (const [a, b, d] of ICO.f) {
    const A = P[a], Bp = P[b], D = P[d];
    const i0 = acc.v(A[0], A[1], A[2], 0, 0), i1 = acc.v(Bp[0], Bp[1], Bp[2], 1, 0), i2 = acc.v(D[0], D[1], D[2], 0.5, 1);
    acc.tri(i0, i1, i2);
  }
}

/**
 * An irregular drum (a hoodoo course, a pillar of rock): n sides, radius r0
 * at the base to r1 at the top, from y0 to y1, corners jittered (seeded);
 * capped on top. uv: u round in metres / U, v up in metres / V.
 */
export function drum(acc, x, y0, z, r0, r1, h, seg, seed, jit = 0.18, o = {}) {
  const ry = hash1(seed, 99) * TAU;
  const U = o.u || 8, V = o.v || 8;
  const v0 = o.v0 ?? y0;
  const rb = [], rt = [];
  for (let k = 0; k < seg; k++) {
    const a = ry + (k / seg) * TAU;
    const j = 1 + (hash1(seed, k) - 0.5) * 2 * jit, j2 = 1 + (hash1(seed, k, 3) - 0.5) * 2 * jit;
    rb.push([x + Math.cos(a) * r0 * j, y0, z + Math.sin(a) * r0 * j]);
    rt.push([x + Math.cos(a) * r1 * j2 + (o.lean?.[0] || 0), y0 + h, z + Math.sin(a) * r1 * j2 + (o.lean?.[1] || 0)]);
  }
  let u = 0;
  for (let k = 0; k < seg; k++) {
    const k2 = (k + 1) % seg;
    const len = Math.hypot(rb[k2][0] - rb[k][0], rb[k2][2] - rb[k][2]);
    acc.quadP(rb[k2], rb[k], rt[k], rt[k2], [(u + len) / U, (y0 - v0) / V, u / U, (y0 + h - v0) / V]);
    u += len;
  }
  if (o.top !== false) {
    const cx = rt.reduce((a, p) => a + p[0], 0) / seg, cz = rt.reduce((a, p) => a + p[2], 0) / seg;
    const ci = acc.v(cx, y0 + h, cz, 0.5, 0.95);
    const ids = rt.map((p) => acc.v(p[0], p[1], p[2], 0.5 + (p[0] - cx) / U, 0.95 + (p[2] - cz) / U));
    for (let k = 0; k < seg; k++) acc.tri(ci, ids[(k + 1) % seg], ids[k]);
  }
}

/** A flat disc (a pool, a tank lid) facing up at height y. */
export function disc(acc, x, y, z, r, seg = 12, up = true) {
  const ci = acc.v(x, y, z, 0.5, 0.5);
  const ids = [];
  for (let k = 0; k < seg; k++) { const a = (k / seg) * TAU; ids.push(acc.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5)); }
  for (let k = 0; k < seg; k++) { if (up) acc.tri(ci, ids[(k + 1) % seg], ids[k]); else acc.tri(ci, ids[k], ids[(k + 1) % seg]); }
}

/** A lying cylinder (a wheel, a tank on its side, a pipe) along local x of ry, centre (x, y, z). */
export function hcyl(acc, x, y, z, r, len, ry = 0, seg = 8, caps = true) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const ring = (lx) => {
    const out = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * TAU;
      const ly = Math.cos(a) * r, lz = Math.sin(a) * r;
      out.push([x + lx * c + lz * s, y + ly, z - lx * s + lz * c]);
    }
    return out;
  };
  const A = ring(-len / 2), Bv = ring(len / 2);
  for (let k = 0; k < seg; k++) {
    const k2 = (k + 1) % seg;
    acc.quadP(A[k], A[k2], Bv[k2], Bv[k], [0, 0, 1, 1]);
  }
  if (caps) {
    for (const [R, sgn] of [[A, -1], [Bv, 1]]) {
      const cx = x + sgn * len / 2 * c, cz = z - sgn * len / 2 * s;
      const ci = acc.v(cx, y, cz, 0.5, 0.5);
      const ids = R.map((p) => acc.v(p[0], p[1], p[2], 0.5, 0.5));
      for (let k = 0; k < seg; k++) { if (sgn > 0) acc.tri(ci, ids[k], ids[(k + 1) % seg]); else acc.tri(ci, ids[(k + 1) % seg], ids[k]); }
    }
  }
}

// ------------------------------------------------------------------ lines (wires, tumbleweeds)

/** A LineSegments mesh from a flat position array (for B.group). */
export function lineMesh(pos, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const m = new THREE.LineSegments(g, mat);
  m.matrixAutoUpdate = false;
  m.updateMatrix();
  return m;
}

/** Push a sagging wire from a to b ([x, y, z]) into pos as n segments. */
export function sagWire(pos, a, b, sag, n = 8) {
  for (let j = 0; j < n; j++) {
    for (const t of [j / n, (j + 1) / n]) {
      pos.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
    }
  }
}

// ------------------------------------------------------------------ roads

/** Where a road is at arc length s and lateral offset lat: { x, z, y, i, tx, tz, lx, lz, ry (facing along) }. */
export function roadAt(r, s, lat = 0) {
  const p = r.posAt(s, lat);
  const i = p.i;
  return { x: p.x, z: p.z, y: p.y, i, tx: r.TX[i], tz: r.TZ[i], lx: r.LX[i], lz: r.LZ[i], ry: Math.atan2(r.TX[i], r.TZ[i]), off: !!(r.flags[i] & (F_BRIDGE | F_ELEV)) };
}

/** The road's half-width to the edge of everything it paves (carriageway, shoulder, walk). */
export const reachOf = (r) => r.rt.hw + r.rt.shoulder + r.rt.walk + 0.4;

/** ry that turns local +z toward direction (dx, dz). */
export const face = (dx, dz) => Math.atan2(dx, dz);
