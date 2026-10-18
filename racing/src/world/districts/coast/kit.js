// PORT HALCYON — the coast's shared kit (Harbor Docks, the Shipyard, Pier 9,
// Halcyon Point, Bayshore): the few materials every coast pack draws with
// (most of them vertex coloured, so a crane, a container and a beach hut
// share one material and one draw call per cell), glowing things that
// follow the night, and geometry helpers on top of builder.js (tubes,
// frames in a turned local space, catenaries, trusses).
import * as THREE from 'three';
import { U } from '../../kit.js';
import { litMat, box, cylinder, Builder } from '../builder.js';
import { Batch } from '../../build/geo.js';
import { CELL } from '../../terrain.js';
import { concreteTexture, groundTexture } from '../../../track/textures.js';
import { plankTexture } from '../../kit.js';

// ------------------------------------------------------------------ materials

const SHARED = new Map();

/**
 * A material shared by every coast pack: made once for the whole world and
 * registered through each pack's B.mat (so the scene compiles it up front).
 */
export function cmat(B, key, make) {
  let m = SHARED.get(key);
  if (!m) { m = make(); SHARED.set(key, m); }
  return B.mat('coast:' + key, () => m);
}

/**
 * Unlit vertex-coloured glow (bulbs, neon tubes, lamp glass, lit cabins):
 * full strength at night, `dayK` of it by day (dull coloured glass).
 * Vertex colours over 1 bloom.
 */
export function nightGlowMat(dayK = 0.16, key = 'n') {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <opaque_fragment>', `outgoingLight *= mix(${dayK.toFixed(3)}, 1.0, uNight);\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `coast-glow-${key}-${dayK.toFixed(3)}`;
  m.userData.castShadow = false;
  return m;
}

/** Obstruction lights: red, slow blink, on by day too (dimmer). */
function blinkMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.uniforms.uTime = U.time;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uTime;')
      .replace('#include <opaque_fragment>', `outgoingLight *= mix(0.55, 1.0, uNight) * (0.18 + 0.82 * smoothstep(0.35, 0.5, fract(uTime * 0.55)) * (1.0 - smoothstep(0.85, 0.98, fract(uTime * 0.55))));\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'coast-blink';
  m.userData.castShadow = false;
  return m;
}

/**
 * Painted steel high up (cranes, towers, cables): no baked street light (a
 * lamp under a boom would burn it white) but a faint glow of its own paint
 * at night, as if washed by its own floods, so it reads against the sky.
 */
function steelMat(k = 0.1) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35, envMapIntensity: 0.8 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * ${k.toFixed(3)} * uNight;`);
  };
  m.customProgramCacheKey = () => `coast-steel-${k.toFixed(3)}`;
  m.userData.castShadow = true;
  return m;
}

/**
 * Welding arcs: additive blue-white flashes that stutter on and off, each
 * spark on its own beat (its seed in uv.x), in bursts. Night only.
 */
function flickerMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeed = uv.x;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uTime;\nvarying float vSeed;\nfloat fh(float n) { return fract(sin(n) * 43758.5453); }')
      .replace('#include <opaque_fragment>', `float tick = floor(uTime * 15.0 + vSeed * 7.0);
        float burst = step(0.35, fh(floor(uTime * 0.4 + vSeed * 3.1) * 7.3 + vSeed * 41.0));
        float on = step(0.45, fh(tick * 1.7 + vSeed * 113.0)) * burst;
        outgoingLight *= on * (0.6 + 0.4 * fh(tick + 3.0)) * uNight;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'coast-flicker';
  m.userData.castShadow = false;
  return m;
}

/**
 * Marquee bulbs that chase: each bulb's phase in uv.x (its place along the
 * run, in bulbs), bright when the wave passes. Dull glass by day.
 */
function chaseMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vPh;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPh = uv.x;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uTime;\nvarying float vPh;')
      .replace('#include <opaque_fragment>', `float wave = fract(uTime * 1.6 - vPh / 3.0);
        float lit = 0.3 + 0.7 * step(0.34, wave) * (1.0 - step(0.67, wave)) + 0.15 * step(0.67, wave);
        outgoingLight *= mix(0.14, lit, uNight);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'coast-chase';
  m.userData.castShadow = false;
  return m;
}

/** A chaser bulb (for the chase material): k its index along the run. */
export function chaseBulb(acc, x, y, z, s, c, k) {
  acc.col = c;
  const h = s / 2;
  acc.quadP([x - h, y - h, z + h], [x + h, y - h, z + h], [x + h, y + h, z + h], [x - h, y + h, z + h], [k, 0, k, 1]);
  acc.quadP([x + h, y - h, z - h], [x - h, y - h, z - h], [x - h, y + h, z - h], [x + h, y + h, z - h], [k, 0, k, 1]);
  acc.quadP([x + h, y - h, z + h], [x + h, y - h, z - h], [x + h, y + h, z - h], [x + h, y + h, z + h], [k, 0, k, 1]);
  acc.quadP([x - h, y - h, z - h], [x - h, y - h, z + h], [x - h, y + h, z + h], [x - h, y + h, z - h], [k, 0, k, 1]);
  acc.quadP([x - h, y + h, z + h], [x + h, y + h, z + h], [x + h, y + h, z - h], [x - h, y + h, z - h], [k, 0, k, 1]);
}

/** Soft additive light (beams, light cones, the glow on the water): night only. */
function beamMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <opaque_fragment>', 'outgoingLight *= uNight;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'coast-beam';
  m.userData.castShadow = false;
  return m;
}

/**
 * Soft light that breathes (bioluminescent surf, a lantern's glow on the
 * water): additive, night only, each patch on its own slow beat (its seed
 * in uv.x).
 */
function pulseMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeed = uv.x;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uTime;\nvarying float vSeed;')
      .replace('#include <opaque_fragment>', `float p = 0.5 + 0.5 * sin(uTime * (0.7 + vSeed * 0.9) + vSeed * 37.0);
        outgoingLight *= uNight * (0.25 + 0.75 * p * p);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'coast-pulse';
  m.userData.castShadow = false;
  return m;
}

/** The coast's shared materials (any pack: same objects). */
export function mats(B) {
  return {
    // painted steel and anything coloured that takes the street light
    paint: cmat(B, 'paint', () => litMat({ vertexColors: true, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.7 })),
    // steel high up (no street light, a faint glow of its own at night)
    steel: cmat(B, 'steel', () => steelMat(0.09)),
    // wood, plaster, canvas, rubber: no shine
    matte: cmat(B, 'matte', () => litMat({ vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.3 })),
    // concrete (quays, docks, plinths), tinted per vertex
    conc: cmat(B, 'conc', () => litMat({ map: concreteTexture('#a4a29c', 'coast'), vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 })),
    // planks (decks, boardwalk huts, piers), tinted per vertex
    wood: cmat(B, 'wood', () => litMat({ map: plankTexture(), vertexColors: true, roughness: 0.85, envMapIntensity: 0.3 })),
    // leaves and grass (flat shaded low poly)
    leaf: cmat(B, 'leaf', () => litMat({ vertexColors: true, roughness: 0.85, flatShading: true, envMapIntensity: 0.25 })),
    rock: cmat(B, 'rock', () => litMat({ map: groundTexture('rock'), vertexColors: true, roughness: 0.95, flatShading: true, envMapIntensity: 0.25 })),
    // markings on the ground (paint lines, rails in the paving)
    decal: cmat(B, 'decal', () => litMat({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, envMapIntensity: 0.3 }, { shadow: false })),
    glow: cmat(B, 'glow', () => nightGlowMat(0.16)),
    blink: cmat(B, 'blink', blinkMat),
    beam: cmat(B, 'beam', beamMat),
    flicker: cmat(B, 'flicker', flickerMat),
    chase: cmat(B, 'chase', chaseMat),
    pulse: cmat(B, 'pulse', pulseMat),
  };
}

/** A welding spark: a little star of additive quads at world (x, y, z), its own beat (seed 0..1). */
export function spark(acc, x, y, z, s, seed, c = [3.2, 3.6, 4.5]) {
  acc.col = c;
  const u = seed;
  for (const a of [0, Math.PI / 3, -Math.PI / 3]) {
    const ca = Math.cos(a) * s, sa = Math.sin(a) * s;
    acc.quadP([x - ca, y - s * 0.2, z - sa], [x + ca, y - s * 0.2, z + sa], [x + ca, y + s * 0.2, z + sa], [x - ca, y + s * 0.2, z - sa], [u, 0, u, 1]);
    acc.quadP([x - ca, y, z - sa - s * 0.2], [x + ca, y, z + sa - s * 0.2], [x + ca, y, z + sa + s * 0.2], [x - ca, y, z - sa + s * 0.2], [u, 0, u, 1]);
  }
  // the glow round it, dimmer and blue
  acc.col = [c[0] * 0.25, c[1] * 0.3, c[2] * 0.4];
  acc.quadP([x - s * 2.5, y - s * 2.5, z], [x + s * 2.5, y - s * 2.5, z], [x + s * 2.5, y + s * 2.5, z], [x - s * 2.5, y + s * 2.5, z], [u, 0, u, 1]);
  acc.quadP([x, y - s * 2.5, z - s * 2.5], [x, y - s * 2.5, z + s * 2.5], [x, y + s * 2.5, z + s * 2.5], [x, y + s * 2.5, z - s * 2.5], [u, 0, u, 1]);
}

// ------------------------------------------------------------------ colours

const _c = new THREE.Color();
/** Linear [r, g, b] of a hex colour (× k: over 1 blooms on glow materials). */
export function C(hex, k = 1) {
  _c.set(hex);
  return [_c.r * k, _c.g * k, _c.b * k];
}
/** Mix two [r,g,b]. */
export const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Scale an [r,g,b]. */
export const mulC = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** Set the colour the next vertices take (vertex-coloured materials). */
export function col(acc, c) { acc.col = c; return acc; }

// ------------------------------------------------------------------ frames

/** A turned local frame at (x, y, z): (lx, ly, lz) → world [x, y, z] (box convention). */
export function frame(x, y, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
}

/**
 * A tipped local frame: rolled about its x, pitched about its z (its +x end
 * up for pitch > 0), turned ry. For hulls on a slipway, a wreck on its side.
 */
export function frame3(x, y, z, ry, pitch = 0, roll = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  return (lx, ly, lz) => {
    const y1 = ly * cr - lz * sr, z1 = ly * sr + lz * cr;
    const x2 = lx * cp - y1 * sp, y2 = lx * sp + y1 * cp;
    return [x + x2 * c + z1 * s, y + y2, z - x2 * s + z1 * c];
  };
}

/**
 * A box through any local frame F (a tipped one too): base centre at local
 * (lx, ly, lz), w × h × d along the frame's axes. faces: f b l r t (top) u (under).
 */
export function fbox(acc, F, lx, ly, lz, w, h, d, U = 2, faces = 'fblrt') {
  const P = (a, b, c) => F(lx + a, ly + b, lz + c);
  const hw = w / 2, hd = d / 2;
  if (faces.includes('f')) acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), [0, 0, w / U, h / U]);
  if (faces.includes('b')) acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), [0, 0, w / U, h / U]);
  if (faces.includes('r')) acc.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), [0, 0, d / U, h / U]);
  if (faces.includes('l')) acc.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), [0, 0, d / U, h / U]);
  if (faces.includes('t')) acc.quadP(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), [0, 0, w / U, d / U]);
  if (faces.includes('u')) acc.quadP(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), [0, 0, w / U, d / U]);
}

/** A box in a local frame: base centre at local (lx, ly, lz), turned with the frame (+ dry). */
export function lbox(acc, F, ry, lx, ly, lz, w, h, d, o = {}, dry = 0) {
  const p = F(lx, ly, lz);
  box(acc, p[0], p[1], p[2], w, h, d, ry + dry, o);
}

/** A square beam between two local points. */
export function lbeam(acc, F, a, b, w, h = w) {
  const A = F(a[0], a[1], a[2]), Bp = F(b[0], b[1], b[2]);
  acc.beam(A[0], A[1], A[2], Bp[0], Bp[1], Bp[2], w, h);
}

/** A round tube between two world points (no caps). */
export function tube(acc, ax, ay, az, bx, by, bz, r, seg = 6, r2 = r) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const L = Math.hypot(dx, dy, dz) || 1;
  const t = [dx / L, dy / L, dz / L];
  // s ⟂ t, u = s × t (so the rings wind like builder's cylinder)
  const ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let s = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]];
  const sl = Math.hypot(s[0], s[1], s[2]) || 1;
  s = [s[0] / sl, s[1] / sl, s[2] / sl];
  const u = [s[1] * t[2] - s[2] * t[1], s[2] * t[0] - s[0] * t[2], s[0] * t[1] - s[1] * t[0]];
  const ring = (a, rr) => [Math.cos(a) * rr * s[0] + Math.sin(a) * rr * u[0], Math.cos(a) * rr * s[1] + Math.sin(a) * rr * u[1], Math.cos(a) * rr * s[2] + Math.sin(a) * rr * u[2]];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p0 = ring(a0, r), p1 = ring(a1, r), q0 = ring(a0, r2), q1 = ring(a1, r2);
    acc.quadP([ax + p1[0], ay + p1[1], az + p1[2]], [ax + p0[0], ay + p0[1], az + p0[2]], [bx + q0[0], by + q0[1], bz + q0[2]], [bx + q1[0], by + q1[1], bz + q1[2]], [(i + 1) / seg, 0, i / seg, L / 4]);
  }
}

/** A tube along a polyline of world points [[x,y,z], ...]. */
export function tubeLine(acc, pts, r, seg = 5) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    tube(acc, a[0], a[1], a[2], b[0], b[1], b[2], r, seg);
  }
}

/** A thin square line (cables seen from afar, rails): beams along a polyline. */
export function beamLine(acc, pts, w, h = w) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    acc.beam(a[0], a[1], a[2], b[0], b[1], b[2], w, h);
  }
}

/** Points of a hanging cable (parabola) from A to B sagging `sag` below the chord at mid. */
export function catenary(A, Bp, sag, n = 8) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    out.push([A[0] + (Bp[0] - A[0]) * t, A[1] + (Bp[1] - A[1]) * t - sag * 4 * t * (1 - t), A[2] + (Bp[2] - A[2]) * t]);
  }
  return out;
}

/** A flat Warren truss panel between two parallel chords (world points), `n` bays. */
export function truss(acc, a0, a1, b0, b1, n, chord, brace) {
  // chords a0→a1 (bottom) and b0→b1 (top)
  acc.beam(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], chord, chord);
  acc.beam(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], chord, chord);
  const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const A = k % 2 ? L(a0, a1, t0) : L(b0, b1, t0), Bq = k % 2 ? L(b0, b1, t1) : L(a0, a1, t1);
    acc.beam(A[0], A[1], A[2], Bq[0], Bq[1], Bq[2], brace, brace);
  }
}

/** A vertical quad facing local +z (a sign, a window), centred at world (x, y, z), turned ry. uv = [u0, v0, u1, v1]. */
export function panel(acc, x, y, z, w, h, ry, uv = [0, 0, 1, 1], back = false) {
  const F = frame(x, y, z, ry);
  acc.quadP(F(-w / 2, -h / 2, 0), F(w / 2, -h / 2, 0), F(w / 2, h / 2, 0), F(-w / 2, h / 2, 0), uv);
  if (back) acc.quadP(F(w / 2, -h / 2, 0), F(-w / 2, -h / 2, 0), F(-w / 2, h / 2, 0), F(w / 2, h / 2, 0), uv);
}

/**
 * A sign wrapped round a cylinder (a tank's band): centred at angle a (math
 * angle in x/z), `w` along the surface, `h` tall, centre height y, in n
 * facets, facing out.
 */
export function arcPanel(acc, cx, y, cz, r, a, w, h, uv, n = 6) {
  const da = w / r;
  for (let k = 0; k < n; k++) {
    // left to right as seen from outside: decreasing angle
    const a0 = a + da / 2 - da * k / n, a1 = a + da / 2 - da * (k + 1) / n;
    const u0 = uv[0] + (uv[2] - uv[0]) * k / n, u1 = uv[0] + (uv[2] - uv[0]) * (k + 1) / n;
    const P0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], P1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
    acc.quadP([P0[0], y - h / 2, P0[1]], [P1[0], y - h / 2, P1[1]], [P1[0], y + h / 2, P1[1]], [P0[0], y + h / 2, P0[1]], [u0, uv[1], u1, uv[3]]);
  }
}

/** A flat quad on the ground-ish (corners world [x, y, z] in order round, facing up). */
export function flat(acc, pts, uv = [0, 0, 1, 1]) {
  acc.quadP(pts[0], pts[1], pts[2], pts[3], uv);
}

/**
 * A ground-following strip (paint line, rail, kerb top) along world [x, z]
 * points, `w` wide, `lift` up; v runs along it, one repeat per vLen metres
 * (default its width).
 */
export function groundStrip(acc, B, pts, w, lift = 0.05, step = 4, vLen = 0) {
  // resample so it follows the ground
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = i ? 1 : 0; k <= n; k++) P.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  const base = acc.count;
  let u = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[Math.min(P.length - 1, i + 1)], r = P[Math.max(0, i - 1)];
    let dx = q[0] - r[0], dz = q[1] - r[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    if (i) u += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]);
    const lx = dz * w / 2, lz = -dx * w / 2;
    const vl = vLen || Math.max(w, 1);
    acc.v(p[0] - lx, B.groundY(p[0] - lx, p[1] - lz) + lift, p[1] - lz, 0, u / vl);
    acc.v(p[0] + lx, B.groundY(p[0] + lx, p[1] + lz) + lift, p[1] + lz, 1, u / vl);
  }
  for (let i = 0; i < P.length - 1; i++) {
    const a = base + i * 2;
    acc.tri(a, a + 2, a + 1);
    acc.tri(a + 1, a + 2, a + 3);
  }
}

/** A disc (flat, facing up) of radius r at (x, y, z). */
export function disc(acc, x, y, z, r, seg = 10, r0 = 0) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    if (r0 > 0) {
      acc.quadP([x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0]);
    } else {
      const c = acc.v(x, y, z, 0.5, 0.5);
      const p = acc.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, 0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5);
      const q = acc.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, 0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5);
      acc.tri(c, p, q);
    }
  }
}

/** A cone with its tip up (or `down`), base radius r at y. */
export function coneC(acc, x, y, z, r, h, seg = 8) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const A = acc.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, (i + 1) / seg, 0);
    const Bv = acc.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, i / seg, 0);
    const T = acc.v(x, y + h, z, (i + 0.5) / seg, 1);
    if (h >= 0) acc.tri(A, Bv, T); else acc.tri(Bv, A, T);
  }
}

// ------------------------------------------------------------------ lights

/**
 * A small bright bulb (a cube of glow), world position. Size s.
 */
export function bulb(acc, x, y, z, s, c) {
  acc.col = c;
  acc.box(x, y - s / 2, z, s, s, s, 0);
}

/** String lights along a sagging wire between two world points: n bulbs. */
export function stringLights(wire, glow, A, Bp, sag, n, colors, wireC = [0.05, 0.05, 0.05]) {
  const pts = catenary(A, Bp, sag, Math.max(4, Math.ceil(n / 2)));
  col(wire, wireC);
  beamLine(wire, pts, 0.03);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = A[0] + (Bp[0] - A[0]) * t, z = A[2] + (Bp[2] - A[2]) * t;
    const y = A[1] + (Bp[1] - A[1]) * t - sag * 4 * t * (1 - t);
    bulb(glow, x, y - 0.12, z, 0.16, colors[k % colors.length]);
  }
}

// ------------------------------------------------------------------ trees

/**
 * A palm: a curved, tapering trunk leaning toward (dx, dz), a crown of
 * drooping fronds (both faces), a few coconuts. h metres tall.
 */
export function palm(trunk, leaf, x, y, z, h, lean, dx, dz, rng, frondC = [0.18, 0.42, 0.16]) {
  const n = 6;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const off = lean * h * t * t;
    pts.push([x + dx * off, y - 0.3 + h * t, z + dz * off]);
  }
  trunk.col = [0.42, 0.33, 0.24];
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[k + 1];
    const r0 = 0.32 - 0.14 * k / n, r1 = 0.32 - 0.14 * (k + 1) / n;
    tube(trunk, a[0], a[1], a[2], b[0], b[1], b[2], r0, 6, r1);
    // the ring scars
    trunk.col = k % 2 ? [0.42, 0.33, 0.24] : [0.36, 0.28, 0.2];
  }
  const top = pts[n];
  // coconuts
  trunk.col = [0.3, 0.2, 0.1];
  for (let k = 0; k < 3; k++) { const a = rng() * 6.28; trunk.box(top[0] + Math.cos(a) * 0.35, top[1] - 0.7, top[2] + Math.sin(a) * 0.35, 0.34, 0.34, 0.34); }
  const nf = 8 + Math.floor(rng() * 3);
  for (let f = 0; f < nf; f++) {
    const a = (f / nf) * Math.PI * 2 + rng() * 0.4;
    const L = h * (0.32 + rng() * 0.08);
    const ca = Math.cos(a), sa = Math.sin(a);
    // a frond: a strip that arches out and droops, two segments
    const segs = [[0, 0], [0.45, 0.35], [0.85, 0.1], [1, -0.35]];
    let prev = null;
    const c = [frondC[0] * (0.85 + rng() * 0.3), frondC[1] * (0.85 + rng() * 0.3), frondC[2]];
    leaf.col = c;
    for (const [u, vy] of segs) {
      const px = top[0] + ca * L * u, py = top[1] + vy * L * 0.5, pz = top[2] + sa * L * u;
      const w = 0.9 * Math.sin(Math.min(1, u * 1.4 + 0.15) * Math.PI) * (L / 5);
      const side = [-sa * w, 0, ca * w];
      const cur = [[px - side[0], py, pz - side[2]], [px + side[0], py, pz + side[2]]];
      if (prev) {
        leaf.quadP(prev[0], prev[1], cur[1], cur[0]);
        leaf.quadP(prev[1], prev[0], cur[0], cur[1]);
      }
      prev = cur;
    }
  }
}

/**
 * A wind-bent tree (Monterey cypress / stone pine): a leaning trunk and
 * flat layered canopy pads swept downwind (dx, dz).
 */
export function windTree(trunk, leaf, x, y, z, h, dx, dz, rng, leafC = [0.15, 0.24, 0.13]) {
  const lean = 0.35 + rng() * 0.25;
  const tx = x + dx * h * lean, tz = z + dz * h * lean, ty = y + h * 0.78;
  trunk.col = [0.3, 0.24, 0.2];
  const mx = x + dx * h * lean * 0.35, mz = z + dz * h * lean * 0.35;
  tube(trunk, x, y - 0.3, z, mx, y + h * 0.45, mz, 0.38 * h / 9, 6, 0.28 * h / 9);
  tube(trunk, mx, y + h * 0.45, mz, tx, ty, tz, 0.28 * h / 9, 6, 0.16 * h / 9);
  // a branch reaching upwind, low
  tube(trunk, mx, y + h * 0.42, mz, mx - dx * h * 0.25, y + h * 0.62, mz - dz * h * 0.25, 0.14 * h / 9, 5, 0.08 * h / 9);
  const pads = [[tx, ty, tz, 1], [tx + dx * h * 0.22, ty - h * 0.08, tz + dz * h * 0.22, 0.75], [mx - dx * h * 0.22, y + h * 0.62, mz - dz * h * 0.22, 0.55], [tx - dx * h * 0.12, ty + h * 0.08, tz - dz * h * 0.12, 0.7]];
  for (const [px, py, pz, s] of pads) {
    const r = h * 0.32 * s * (0.85 + rng() * 0.3);
    leaf.col = [leafC[0] * (0.85 + rng() * 0.3), leafC[1] * (0.85 + rng() * 0.3), leafC[2] * (0.9 + rng() * 0.2)];
    // a flattened, swept blob: a low cone over a shallow dish
    const ex = r * 1.25, sq = 0.38;
    const seg = 7;
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // stretch along the wind
      const along = ca * dx + sa * dz;
      const rr = r * (1 + 0.35 * along) * (0.85 + rng() * 0.3);
      ring.push([px + ca * rr * (ex / r) * 0.85, py + (rng() - 0.5) * r * 0.15, pz + sa * rr * (ex / r) * 0.85]);
    }
    const topV = [px + dx * r * 0.25, py + r * sq, pz + dz * r * 0.25], botV = [px, py - r * sq * 0.5, pz];
    for (let k = 0; k < seg; k++) {
      const a = ring[k], b = ring[(k + 1) % seg];
      const ia = leaf.v(...a), ib = leaf.v(...b), it = leaf.v(...topV), ibt = leaf.v(...botV);
      leaf.tri(ib, ia, it);
      leaf.tri(ia, ib, ibt);
    }
  }
}

// ------------------------------------------------------------------ far helpers

/** Far skyline box (a building's or a structure's block seen from afar). */
export function farBox(P, x, z, y, w, d, h, ry, color, lit = 0) {
  P.far({ shape: 'box', x, z, y, w, d, h, ry, color, lit });
}

/** A thin far box between two points in plan at one height band (a boom, a girder). */
export function farBeam(P, ax, az, bx, bz, y, h, w, color) {
  const L = Math.hypot(bx - ax, bz - az);
  P.far({ shape: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, y, w: L, d: w, h, ry: Math.atan2(-(bz - az), bx - ax), color, lit: 0 });
}

// ------------------------------------------------------------------ the ground next door

/** The world box an item's geometry may reach (its points, its ends, its footprint). */
function itemBox(it) {
  let x0 = it.x, z0 = it.z, x1 = it.x, z1 = it.z;
  const add = (x, z) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; };
  if (Array.isArray(it.pts)) for (const p of it.pts) add(p[0], p[1]);
  for (const k of ['a', 'b']) if (Array.isArray(it[k])) add(it[k][0], it[k].length > 2 ? it[k][2] : it[k][1]);
  const r = Math.max(it.w || 0, it.d || 0, it.len || 0, it.L || 0) * 0.6 + 8;
  return [x0 - r, z0 - r, x1 + r, z1 + r];
}

/**
 * Make the ground (the 4 m terrain grids) of the cells next door that this
 * cell's items reach into, a step each: a builder asking the height there
 * would otherwise make that whole grid in the middle of its own step.
 */
export function* prepareGround(B, items) {
  const need = new Set();
  for (const it of items) {
    const [x0, z0, x1, z1] = itemBox(it);
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        if (cx === B.cx && cz === B.cz) continue;
        if (Math.abs(cx - B.cx) > 1 || Math.abs(cz - B.cz) > 1) continue;
        need.add(`${cx},${cz}`);
      }
    }
  }
  for (const k of need) {
    const [cx, cz] = k.split(',').map(Number);
    if (B.terrain.cache.has(`4:${cx}:${cz}`)) continue;
    B.terrain.grid(cx, cz, 4);
    yield;
  }
}

// ------------------------------------------------------------------ warming up

/**
 * Run a pack's builders once on a planned item of each type (and on its
 * scatter's, from one cell) into a throwaway batch, from warm(): the first
 * build of a kind of thing otherwise runs cold, several times slower, and
 * that first cell hitches. Nothing built here is kept.
 */
export function* warmBuilders(B, pack, BUILD, M, uv) {
  const D = B.D;
  const seen = new Set();
  const run = (it) => {
    const fn = BUILD[it.type];
    if (!fn || seen.has(it.type)) return false;
    seen.add(it.type);
    const out = { batch: new Batch(), nearBatch: new Batch(), group: new THREE.Group(), colliders: [], lamps: [], anims: [] };
    const WB = new Builder(D, Math.floor(it.x / CELL), Math.floor(it.z / CELL), pack, out);
    try {
      const r = fn(WB, M, it, uv);
      if (r && r[Symbol.iterator]) for (const _ of r) void _;
    } catch (e) { /* a warm-up must never stop the load */ }
    return true;
  };
  // (from the cells with the most kinds of thing first: fewer cells' ground to make)
  const cells = [];
  for (const items of D.items.values()) {
    const mine = items.filter((it) => it.pack === pack.id);
    if (mine.length) cells.push({ mine, kinds: new Set(mine.map((it) => it.type)).size });
  }
  cells.sort((a, b) => b.kinds - a.kinds);
  for (const c of cells) {
    for (const it of c.mine) if (run(it)) yield;
    if (seen.size >= Object.keys(BUILD).length) break;
  }
  if (cells.length && pack.scatter) {
    const it0 = cells[0].mine[0];
    const sc = D.scatterCell(Math.floor(it0.x / CELL), Math.floor(it0.z / CELL));
    for (const it of sc.items) if (it.pack === pack.id && run(it)) yield;
  }
}

// ------------------------------------------------------------------ misc

/** A deterministic random for an item (the same every time it's built). */
export function seedOf(it, salt = '') {
  return `${it.district}:${it.type}:${it.n}:${salt}`;
}

/** Turn a direction (dx, dz) into the ry that points a box's local +z along it. */
export const ryOf = (dx, dz) => Math.atan2(dx, dz);

export { box, cylinder };
