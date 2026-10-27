// Stadium construction kit: geometry batched by material (one draw call per
// material per venue), helpers for beams/boxes/cylinders between points, and
// the common structures every venue reuses — chain-link fences, light poles,
// aluminium bleachers, buildings with lit windows, houses, trees, water tower,
// smokestacks, billboards. Units are yards; y up.
import * as THREE from 'three';
import { GeoBuilder } from '../geo.js';
import { makeRng } from '../../core/util.js';
import {
  concreteTex, seatTex, aluminiumTex, brickTex, claddingTex, chainLinkTex, facadeTex, exteriorTex, tex, cv,
} from './tex.js';

const DS = THREE.DoubleSide;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

let unitBox = null, unitCyl = null, unitCyl6 = null;
function ubox() {
  if (!unitBox) { unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.translate(0, 0, 0.5); }
  return unitBox;
}
function ucyl(seg = 8) {
  if (seg <= 6) {
    if (!unitCyl6) { unitCyl6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); unitCyl6.rotateX(Math.PI / 2); unitCyl6.translate(0, 0, 0.5); }
    return unitCyl6;
  }
  if (!unitCyl) { unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); unitCyl.rotateX(Math.PI / 2); unitCyl.translate(0, 0, 0.5); }
  return unitCyl;
}

/** Box from a to b (a beam), cross-section w × h (h along the "up-ish" axis). */
export function beam(gb, a, b, w, h = w) {
  const d = _p.subVectors(b, a);
  const len = d.length();
  if (len < 1e-5) return;
  const dir = d.clone().normalize();
  // orient +z to dir, keep +y as close to world up as possible
  const ref = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : _up;
  const xAxis = new THREE.Vector3().crossVectors(ref, dir).normalize();
  const yAxis = new THREE.Vector3().crossVectors(dir, xAxis).normalize();
  _m.makeBasis(xAxis.multiplyScalar(w), yAxis.multiplyScalar(h), dir.multiplyScalar(len));
  _m.setPosition(a);
  gb.geometry(ubox(), _m);
}

/** Round pole from a to b (open cylinder). */
export function pole(gb, a, b, r, seg = 8) {
  const d = _p.subVectors(b, a);
  const len = d.length();
  if (len < 1e-5) return;
  const dir = d.clone().normalize();
  const ref = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : _up;
  const xAxis = new THREE.Vector3().crossVectors(ref, dir).normalize();
  const yAxis = new THREE.Vector3().crossVectors(dir, xAxis).normalize();
  _m.makeBasis(xAxis.multiplyScalar(r), yAxis.multiplyScalar(r), dir.multiplyScalar(len));
  _m.setPosition(a);
  gb.geometry(ucyl(seg), _m);
}

/** Axis box centred at (x, z) with its base at y, rotated ry. */
export function box(gb, x, y, z, w, h, d, ry = 0, opts = {}) {
  gb.box(x, y, z, w, h, d, ry, { uw: opts.uw || 4, uh: opts.uh || 4, top: opts.top, bottom: opts.bottom, topUv: opts.topUv, uFit: opts.uFit, v0: opts.v0 });
}

/** Merge any geometry with position / rotation(y) / scale. */
export function place(gb, geo, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromAxisAngle(_up, ry);
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  gb.geometry(geo, _m);
}

/** Vertical quad from (x0,z0) to (x1,z1), y0..y1, facing the left of the a→b direction (CCW). */
export function wall(gb, x0, z0, x1, z1, y0, y1, uvr) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  gb.quad(V3(x0, y0, z0), V3(x1, y0, z1), V3(x1, y1, z1), V3(x0, y1, z0), uvr || [0, 0, len / 4, (y1 - y0) / 4]);
}

/** Horizontal quad (facing up). */
export function flat(gb, x0, z0, x1, z1, y, uvr) {
  gb.quad(V3(x0, y, z1), V3(x1, y, z1), V3(x1, y, z0), V3(x0, y, z0), uvr || [x0 / 4, -z1 / 4, x1 / 4, -z0 / 4]);
}

// ------------------------------------------------------------------ batches

/**
 * Geometry batched by material key. Material factories get the venue ctx.
 * Each key → one mesh. Vertex colours tint (GeoBuilder.setColor).
 */
export class Batches {
  constructor(ctx) {
    this.ctx = ctx;
    this.map = new Map();
    this.custom = new Map();
  }
  /** Get the builder for a material key (and remember the factory). */
  get(key, factory) {
    let b = this.map.get(key);
    if (!b) {
      b = { gb: new GeoBuilder(), factory: factory || MATS[key] || MATS.paint, opts: {} };
      this.map.set(key, b);
    }
    return b.gb;
  }
  opts(key, o) { this.get(key); Object.assign(this.map.get(key).opts, o); }
  flush(parent) {
    const out = {};
    for (const [key, b] of this.map) {
      if (!b.gb.count) continue;
      const g = b.gb.build(true);
      const mat = b.factory(this.ctx, key);
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = key;
      mesh.castShadow = !!b.opts.cast;
      mesh.receiveShadow = b.opts.receive !== false;
      if (b.opts.order !== undefined) mesh.renderOrder = b.opts.order;
      parent.add(mesh);
      out[key] = mesh;
    }
    this.map.clear();
    return out;
  }
}

/**
 * The floodlight pool: at night the key light (and most of the light off the
 * environment) only reaches the stadium; out past ctx.uPool.xy (an ellipse in
 * yards) houses, trees and parking lots fall away to moonlight.
 */
export const POOL_GLSL = /* glsl */`
  uniform vec4 uPool;
  varying vec3 vPoolW;
  float poolAt(vec3 w) {
    float pd = length(w.xz / max(uPool.xy, vec2(1.0)));
    return mix(1.0, 1.0 - smoothstep(1.0, 1.3, pd), uPool.z);
  }`;

export function poolPatch(sh, ctx, direct = 1) {
  sh.uniforms.uPool = ctx.uPool;
  const dk = direct.toFixed(2);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPoolW;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vPoolW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vPoolW = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + POOL_GLSL)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        float pool = poolAt(vPoolW);
        // roofs and canopy tops: the floodlights don't light them (night only)
        float dkk = mix(1.0, ${dk}, uPool.z);
        reflectedLight.directDiffuse *= pool * dkk;
        reflectedLight.directSpecular *= pool * dkk;
        float ind = mix(1.0, mix(uPool.w, 1.0, pool), uPool.z);
        reflectedLight.indirectDiffuse *= ind;
        reflectedLight.indirectSpecular *= ind;
      }`);
}

/**
 * Pool + albedo-proportional "spill" light (floodlit stands at night) on a
 * standard material. opts.direct scales the key light at night (roofs).
 */
export function spill(mat, ctx, k = 1, opts = {}) {
  const prev = mat.onBeforeCompile;
  const direct = opts.direct ?? 1;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    if (ctx.uPool) poolPatch(sh, ctx, direct);
    sh.uniforms.uSpill = ctx.uSpill;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSpill;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uSpill * ${k.toFixed(2)}${ctx.uPool ? ' * poolAt(vPoolW)' : ''};`);
  };
  const key = mat.customProgramCacheKey?.call(mat) || '';
  mat.customProgramCacheKey = () => key + 'spill' + k.toFixed(2) + (ctx.uPool ? 'p' : '') + direct.toFixed(2);
  return mat;
}

const std = (o) => new THREE.MeshStandardMaterial(o);

/** Material factories by batch key. */
export const MATS = {
  paint: (ctx) => spill(std({ vertexColors: true, roughness: 0.75, metalness: 0.05 }), ctx),
  concrete: (ctx) => spill(std({ vertexColors: true, map: concreteTex(), roughness: ctx.wet ? 0.5 : 0.92, envMapIntensity: 0.5 }), ctx),
  concrete2: (ctx) => spill(std({ vertexColors: true, map: concreteTex('#8a877f', 'c2'), roughness: ctx.wet ? 0.5 : 0.9, envMapIntensity: 0.5, side: DS }), ctx),
  metal: (ctx) => spill(std({ vertexColors: true, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.9 }), ctx, 0.7),
  metalDS: (ctx) => spill(std({ vertexColors: true, roughness: 0.5, metalness: 0.55, side: DS, envMapIntensity: 0.9 }), ctx, 0.7),
  alu: (ctx) => spill(std({ vertexColors: true, map: aluminiumTex(), roughness: 0.38, metalness: 0.75, envMapIntensity: 1.1, side: DS }), ctx, 0.8),
  seats: (ctx) => spill(std({ vertexColors: true, map: seatTex(), alphaTest: 0.5, roughness: 0.5, side: DS }), ctx, 1.1),
  brick: (ctx) => spill(std({ vertexColors: true, map: brickTex(), roughness: 0.9 }), ctx),
  clad: (ctx) => spill(std({ vertexColors: true, map: claddingTex(), roughness: 0.55, metalness: 0.4, side: DS }), ctx, 0.8),
  dark: () => std({ vertexColors: true, roughness: 0.9, color: 0x222222 }),
  glass: (ctx) => std({ vertexColors: true, roughness: 0.12, metalness: 0.8, envMapIntensity: 1.5, color: 0x9ab0c8 }),
  fence: (ctx) => spill(std({ map: chainLinkTex(), alphaTest: 0.35, transparent: false, side: DS, roughness: 0.5, metalness: 0.6, color: 0xc8ccd0 }), ctx, 0.9),
  wood: (ctx) => spill(std({ vertexColors: true, roughness: 0.85 }), ctx),
  ground: (ctx) => spill(std({ vertexColors: true, roughness: 0.95 }), ctx, 0.5),
  // unlit, HDR colours via vertex colour (lit windows, signs, bulbs)
  glow: () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  glowDS: () => new THREE.MeshBasicMaterial({ vertexColors: true, side: DS, toneMapped: false }),
  foliage: (ctx) => spill(std({ vertexColors: true, roughness: 0.95, side: DS }), ctx, 0.4),
};

/** Stadium exterior facade (columns, concourse openings lit at night), tinted per venue. */
export function exteriorMat(ctx, key, base, accent, opts = {}) {
  const t = exteriorTex(key, base, accent, opts);
  return spill(std({
    map: t.map, emissive: 0xffffff, emissiveMap: t.emi, emissiveIntensity: ctx.night ? 1.6 : ctx.dusk ? 0.8 : 0.0,
    roughness: 0.85, vertexColors: true,
  }), ctx, 0.4);
}

/** Lit-window material for a facade texture (map + emissive map scaled by `lit`). */
export function facadeMat(style, seed, ctx, opts = {}) {
  const t = facadeTex(style, seed, opts);
  const m = std({
    map: t.map, emissive: 0xffffff, emissiveMap: t.emi, emissiveIntensity: ctx.night ? (opts.glow ?? 1.4) : ctx.dusk ? 0.7 : 0.05,
    roughness: style === 'glass' ? 0.25 : 0.85, metalness: style === 'glass' ? 0.5 : 0.05, vertexColors: true,
  });
  return spill(m, ctx, 0.5);
}

// ------------------------------------------------------------------ fences

/**
 * Chain-link fence along a polyline of [x, z] points.
 * Posts every ~3.3 yd, top rail; optional banners [ {i, tex} ] are separate.
 */
export function chainFence(B, pts, h = 2.2, opts = {}) {
  const mesh = B.get('fence');
  const metal = B.get('metal');
  metal.setColor(...(opts.postColor || [0.62, 0.64, 0.66]));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-3) continue;   // a closing point on top of the first: no panel (it would have no normal)
    const y0 = opts.y0 || 0;
    // UV: 1 repeat per 0.5 yd (diamond mesh ~2.2" … exaggerated so it reads)
    mesh.quad(V3(x0, y0, z0), V3(x1, y0, z1), V3(x1, y0 + h, z1), V3(x0, y0 + h, z0), [0, 0, len / 0.55, h / 0.55]);
    const n = Math.max(1, Math.round(len / 3.3));
    for (let k = 0; k <= n; k++) {
      if (k === n && i < pts.length - 2) continue;
      const t = k / n;
      const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      pole(metal, V3(px, y0, pz), V3(px, y0 + h + 0.05, pz), 0.035, 6);
    }
    pole(metal, V3(x0, y0 + h, z0), V3(x1, y0 + h, z1), 0.025, 6);
  }
}

// ------------------------------------------------------------------ bleachers

/**
 * Aluminium bleachers: rows of plank seats + foot planks over an open steel
 * frame. (x, z) = centre of the front edge, ry = facing (0 = facing +z), len
 * along the row. Returns seat positions for the crowd.
 */
export function bleachers(B, x, z, ry, len, rows, opts = {}) {
  const alu = B.get('alu');
  const metal = B.get('metal');
  const depth = opts.depth || 0.9, rise = opts.rise || 0.42, base = opts.base ?? 0.5;
  // local: u along the row (+u = right when facing forward), w = back (away from the field), y up
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const rx = Math.cos(ry), rz = -Math.sin(ry);
  const L = (u, y, w) => V3(x + rx * u - fx * w, y, z + rz * u - fz * w);
  const rng = opts.rng || makeRng('bleach' + x + ':' + z);
  const seats = [];
  const half = len / 2;
  alu.setColor(1, 1, 1);
  for (let r = 0; r < rows; r++) {
    const yb = base + r * rise, w0 = r * depth;
    // foot plank (front, lower) + seat plank (back, higher)
    const fy = yb - rise * 0.55;
    alu.quad(L(-half, fy, w0 + 0.05), L(half, fy, w0 + 0.05), L(half, fy, w0 + 0.4), L(-half, fy, w0 + 0.4), [0, 0, len / 3, 1]);
    alu.quad(L(-half, yb, w0 + 0.45), L(half, yb, w0 + 0.45), L(half, yb, w0 + 0.8), L(-half, yb, w0 + 0.8), [0, 0, len / 3, 1]);
    // seat plank front lip
    alu.quad(L(-half, yb - 0.08, w0 + 0.45), L(half, yb - 0.08, w0 + 0.45), L(half, yb, w0 + 0.45), L(-half, yb, w0 + 0.45), [0, 0, len / 3, 0.2]);
    // riser kick plate (dark gap reads as the open understructure)
    for (let u = -half + 0.3; u < half - 0.2; u += 0.55) {
      seats.push({ p: L(u + (rng() - 0.5) * 0.06, yb - 0.5, w0 + 0.55), ry, row: r });
    }
  }
  // frame: stringers every ~3 yd, diagonal braces, top guard rail
  metal.setColor(...(opts.frameColor || [0.5, 0.52, 0.55]));
  const topY = base + (rows - 1) * rise, backW = (rows - 1) * depth + 0.9;
  for (let u = -half; u <= half + 0.01; u += Math.max(2.5, len / Math.ceil(len / 3))) {
    beam(metal, L(u, 0, 0.1), L(u, base - 0.4, 0.1), 0.08);
    beam(metal, L(u, 0, backW), L(u, topY, backW), 0.08);
    beam(metal, L(u, base - 0.4, 0.1), L(u, topY, backW), 0.07, 0.12);
    beam(metal, L(u, 0, 0.1), L(u, topY * 0.6, backW * 0.6), 0.05);
  }
  // rails: back guard rail + side rails
  beam(metal, L(-half, topY + 1.1, backW), L(half, topY + 1.1, backW), 0.05);
  beam(metal, L(-half, topY + 0.55, backW), L(half, topY + 0.55, backW), 0.04);
  for (let u = -half; u <= half + 0.01; u += 2) beam(metal, L(u, topY, backW), L(u, topY + 1.1, backW), 0.04);
  for (const u of [-half, half]) {
    beam(metal, L(u, base + 0.9, 0), L(u, topY + 1.1, backW), 0.04);
  }
  // back skirt (aluminium sheet) so it reads as a solid block from behind
  if (opts.skirt !== false) {
    alu.quad(L(half, 0, backW + 0.02), L(-half, 0, backW + 0.02), L(-half, topY + 0.1, backW + 0.02), L(half, topY + 0.1, backW + 0.02), [0, 0, len / 3, topY / 2]);
  }
  return { seats, top: topY, back: backW, L };
}

// ------------------------------------------------------------------ poles + lights

/**
 * Floodlight pole with a lamp rack facing `aim`. kind: 'wood' | 'steel' | 'lattice'.
 * Returns the bank spec for lights.js (centre, normal, size).
 */
export function lightPole(B, x, z, h, aim, opts = {}) {
  const kind = opts.kind || 'steel';
  const cols = opts.cols || 4, rows = opts.rows || 3, lamp = opts.lamp || 0.75;
  const dx = aim[0] - x, dz = aim[2] - z;
  const yaw = Math.atan2(dx, dz);
  if (kind === 'wood') {
    const wood = B.get('wood');
    wood.setColor(0.36, 0.27, 0.19);
    pole(wood, V3(x, 0, z), V3(x, h + 0.6, z), 0.28, 8);
  } else if (kind === 'lattice') {
    const m = B.get('metal');
    m.setColor(0.55, 0.57, 0.6);
    const b0 = 1.6, b1 = 0.7;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const at = (t, k) => {
      const w = b0 + (b1 - b0) * t;
      return V3(x + corners[k][0] * w / 2, h * t, z + corners[k][1] * w / 2);
    };
    for (let k = 0; k < 4; k++) beam(m, at(0, k), at(1, k), 0.12);
    const n = Math.round(h / 2.5);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      for (let k = 0; k < 4; k++) {
        beam(m, at(t0, k), at(t1, (k + 1) % 4), 0.05);
        beam(m, at(t1, k), at(t1, (k + 1) % 4), 0.05);
      }
    }
  } else {
    const m = B.get('metal');
    m.setColor(...(opts.color || [0.58, 0.6, 0.63]));
    pole(m, V3(x, 0, z), V3(x, h, z), 0.38, 10);
    pole(m, V3(x, h * 0.55, z), V3(x, h + 0.2, z), 0.3, 10);
  }
  // the rack: a frame behind the lamps
  const m = B.get('metal');
  m.setColor(0.32, 0.33, 0.35);
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const W = cols * lamp, H = rows * lamp;
  const cy = h + H / 2 + 0.3;
  const tilt = opts.tilt ?? 0.42;   // lamps tipped down toward the field
  const cx = x + fx * 0.6, cz = z + fz * 0.6;
  const back = 0.2;
  beam(m, V3(x, h - 0.2, z), V3(cx, cy, cz), 0.18);
  box(m, cx - fx * back, cy - H / 2 - 0.15, cz - fz * back, W + 0.4, H + 0.3, 0.25, yaw, { top: true });
  // catwalk
  if (opts.catwalk !== false && kind !== 'wood') box(m, cx, cy - H / 2 - 0.45, cz, W + 0.6, 0.06, 0.8, yaw, {});
  return {
    center: V3(cx + fx * 0.05, cy, cz + fz * 0.05), yaw, tilt, cols, rows, lamp, w: W, h: H,
    aim: V3(...aim),
  };
}

// ------------------------------------------------------------------ buildings

/** A box building with a facade texture batch (key per style). */
export function building(B, ctx, x, z, w, d, h, ry = 0, style = 'brick', seed = 'a', opts = {}) {
  const key = `fac:${style}:${seed}`;
  const gb = B.get(key, () => facadeMat(style, seed, ctx, opts));
  gb.setColor(...(opts.tint || [1, 1, 1]));
  // facade uv: 1 repeat = 12 yd wide × 20 yd tall
  const y0 = opts.y0 || 0;
  gb.box(x, y0, z, w, h, d, ry, { uw: opts.uw || 12, uh: opts.uh || 20, top: false, v0: y0 / (opts.uh || 20) });
  // roof
  const r = B.get('concrete');
  r.setColor(...(opts.roof || [0.35, 0.35, 0.36]));
  r.box(x, y0 + h, z, w + 0.3, 0.3, d + 0.3, ry, { uw: 4, uh: 4 });
  return { top: y0 + h + 0.3 };
}

/** Gable-roof house with a lit window or two. */
export function house(B, ctx, rng, x, z, ry, w = 8, d = 10, h = 3, opts = {}) {
  const walls = B.get('paint');
  const roofs = B.get('paint');
  const glow = B.get('glow');
  const sidings = [[0.85, 0.82, 0.74], [0.62, 0.68, 0.72], [0.78, 0.7, 0.55], [0.55, 0.6, 0.5], [0.9, 0.88, 0.84], [0.6, 0.38, 0.3]];
  const sc = sidings[(rng() * sidings.length) | 0];
  walls.setColor(...sc);
  walls.box(x, 0, z, w, h, d, ry, { uw: 4, uh: 4, top: false });
  // gable roof
  const c = Math.cos(ry), s = Math.sin(ry);
  const L = (u, y, v) => V3(x + u * c + v * s, y, z - u * s + v * c);
  const rh = opts.roofH || 2.2;
  const rc = [[0.25, 0.22, 0.2], [0.3, 0.3, 0.32], [0.38, 0.25, 0.2], [0.2, 0.22, 0.25]][(rng() * 4) | 0];
  roofs.setColor(...rc);
  const hw = w / 2 + 0.4, hd = d / 2 + 0.4;
  roofs.quad(L(-hw, h, hd), L(hw, h, hd), L(hw, h + rh, 0), L(-hw, h + rh, 0));
  roofs.quad(L(hw, h, -hd), L(-hw, h, -hd), L(-hw, h + rh, 0), L(hw, h + rh, 0));
  walls.setColor(...sc);
  walls.quad(L(w / 2, h, d / 2), L(w / 2, h, -d / 2), L(w / 2, h + rh - 0.3, 0), L(w / 2, h + rh - 0.3, 0));
  walls.quad(L(-w / 2, h, -d / 2), L(-w / 2, h, d / 2), L(-w / 2, h + rh - 0.3, 0), L(-w / 2, h + rh - 0.3, 0));
  // windows (front = +v side) — warm when lit
  const nWin = Math.max(2, Math.round(w / 2.6));
  for (let k = 0; k < nWin; k++) {
    const u = -w / 2 + (k + 0.5) * (w / nWin);
    const lit = ctx.night || ctx.dusk ? rng() < 0.45 : false;
    const col = lit ? [2.4, 1.6, 0.7] : [0.05, 0.06, 0.08];
    glow.setColor(...col);
    glow.quad(L(u - 0.45, 0.9, d / 2 + 0.02), L(u + 0.45, 0.9, d / 2 + 0.02), L(u + 0.45, 2.0, d / 2 + 0.02), L(u - 0.45, 2.0, d / 2 + 0.02));
  }
  if ((ctx.night || ctx.dusk) && rng() < 0.6) {
    ctx.lightsList?.push({ pos: L(w * 0.2, 2.4, d / 2 + 0.6), color: [1, 0.7, 0.35], size: 1.4, k: 0.7 });
  }
}

/** Instanced trees: a list of {x, z, h, kind: 'pine'|'oak', tint}. Returns meshes. */
export function trees(list, ctx, opts = {}) {
  const group = new THREE.Group();
  if (!list.length) return group;
  const pines = list.filter((t) => t.kind === 'pine');
  const oaks = list.filter((t) => t.kind !== 'pine');
  const mk = (geo, items, colFn) => {
    const mat = spill(std({ vertexColors: false, roughness: 0.95, flatShading: true }), ctx, 0.35);
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    im.name = 'trees';
    const c = new THREE.Color();
    items.forEach((t, i) => {
      _q.setFromAxisAngle(_up, (t.rot ?? i * 1.7));
      _m.compose(_p.set(t.x, t.y || 0, t.z), _q, _s.set(t.h * (t.w ?? 0.45), t.h, t.h * (t.w ?? 0.45)));
      im.setMatrixAt(i, _m);
      im.setColorAt(i, c.set(colFn(t)));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
  };
  if (pines.length) {
    const g = new GeoBuilder();
    const cone = new THREE.ConeGeometry(0.5, 0.5, 7, 1, false);
    for (let k = 0; k < 3; k++) {
      const s = 1 - k * 0.24;
      _m.compose(_p.set(0, 0.32 + k * 0.2, 0), _q.identity(), _s.set(s, s * 0.9, s));
      g.geometry(cone, _m);
    }
    const trunk = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5);
    _m.compose(_p.set(0, 0.1, 0), _q.identity(), _s.set(1, 1, 1));
    g.geometry(trunk, _m);
    cone.dispose(); trunk.dispose();
    mk(g.build(), pines, (t) => t.tint || (opts.snow ? '#9aaab0' : '#2a4430'));
  }
  if (oaks.length) {
    const g = new GeoBuilder();
    const ico = new THREE.IcosahedronGeometry(0.42, 0);
    for (const [px, py, pz, s] of [[0, 0.62, 0, 1], [0.18, 0.5, 0.08, 0.7], [-0.16, 0.52, -0.1, 0.72], [0.02, 0.8, -0.05, 0.6]]) {
      _m.compose(_p.set(px, py, pz), _q.identity(), _s.set(s, s * 0.85, s));
      g.geometry(ico, _m);
    }
    const trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.45, 5);
    _m.compose(_p.set(0, 0.22, 0), _q.identity(), _s.set(1, 1, 1));
    g.geometry(trunk, _m);
    ico.dispose(); trunk.dispose();
    mk(g.build(), oaks, (t) => t.tint || '#35502a');
  }
  return group;
}

/** Water tower: tank on legs with the town name painted on. Returns the name texture mesh. */
export function waterTower(B, ctx, x, z, h, name, colors = ['#c8ccd0', '#1a3a7a']) {
  const m = B.get('metal');
  m.setColor(0.6, 0.62, 0.64);
  const legR = 3.2;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    beam(m, V3(x + Math.cos(a) * legR * 1.3, 0, z + Math.sin(a) * legR * 1.3), V3(x + Math.cos(a) * legR * 0.8, h, z + Math.sin(a) * legR * 0.8), 0.25);
  }
  for (let y = 4; y < h; y += 5) {
    for (let k = 0; k < 4; k++) {
      const a0 = k * Math.PI / 2 + Math.PI / 4, a1 = a0 + Math.PI / 2;
      const r = legR * (1.3 - 0.5 * y / h);
      beam(m, V3(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r), V3(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r), 0.1);
    }
  }
  pole(m, V3(x, 0, z), V3(x, h, z), 0.5, 8);
  // tank: a squat capsule with a painted band
  const [c, ctx2] = cv(1024, 256);
  ctx2.fillStyle = colors[0];
  ctx2.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 40; i++) {
    ctx2.fillStyle = `rgba(80,60,40,${0.05 + Math.random() * 0.08})`;
    ctx2.fillRect(Math.random() * 1024, 120 + Math.random() * 100, 2 + Math.random() * 6, 30 + Math.random() * 80);
  }
  ctx2.font = `900 92px ${'"Arial Black", "Inter", Arial, sans-serif'}`;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  ctx2.fillStyle = colors[1];
  for (const u of [256, 768]) ctx2.fillText(name.toUpperCase(), u, 118, 480);
  const tm = tex(c, { aniso: 4 });
  tm.wrapS = THREE.RepeatWrapping;
  const tankGeo = new THREE.SphereGeometry(4.6, 24, 12);
  tankGeo.scale(1, 0.62, 1);
  const tank = new THREE.Mesh(tankGeo, spill(std({ map: tm, roughness: 0.5, metalness: 0.4 }), ctx, 0.8));
  tank.position.set(x, h + 2.4, z);
  const capGeo = new THREE.ConeGeometry(2.2, 1.6, 16);
  const cap = new THREE.Mesh(capGeo, spill(std({ color: new THREE.Color(colors[0]), roughness: 0.5, metalness: 0.4 }), ctx, 0.8));
  cap.position.set(0, 3.4, 0);
  tank.add(cap);
  // red aviation light on top
  ctx.lightsList?.push({ pos: V3(x, h + 6, z), color: [1, 0.1, 0.05], size: 1.6, k: 1.2, blink: 1 });
  return tank;
}

/** Brick smokestack with a striped top. */
export function smokestack(B, x, z, h, r = 2.2) {
  const brick = B.get('brick');
  brick.setColor(0.95, 0.9, 0.86);
  const g = new THREE.CylinderGeometry(r * 0.72, r, h, 14, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 6.28 / 4, uv.getY(i) * h / 4);
  place(brick, g, x, h / 2, z);
  g.dispose();
  const paint = B.get('paint');
  for (let k = 0; k < 3; k++) {
    paint.setColor(...(k % 2 ? [0.9, 0.9, 0.88] : [0.75, 0.12, 0.1]));
    const rr = r * 0.72 + 0.02;
    const band = new THREE.CylinderGeometry(rr, rr * 1.01, 1.4, 14, 1, true);
    place(paint, band, x, h - 0.7 - k * 1.4, z);
    band.dispose();
  }
  return { top: V3(x, h, z), r: r * 0.72 };
}

/** Billboard on two posts, facing ry. Returns the face quad's batch key. */
export function billboard(B, x, z, ry, w, h, y0, key, texFactory) {
  const m = B.get('metal');
  m.setColor(0.35, 0.36, 0.38);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const u of [-w * 0.3, w * 0.3]) pole(m, V3(x + u * c, 0, z - u * s), V3(x + u * c, y0 + h, z - u * s), 0.15, 6);
  box(m, x - Math.sin(ry) * 0.15, y0 - 0.1, z - Math.cos(ry) * 0.15, w + 0.3, h + 0.2, 0.2, ry);
  const face = B.get(key, texFactory);
  face.setColor(1, 1, 1);
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const L = (u, y) => V3(x + u * c + fx * 0.02, y, z - u * s + fz * 0.02);
  face.quad(L(-w / 2, y0), L(w / 2, y0), L(w / 2, y0 + h), L(-w / 2, y0 + h), [0, 0, 1, 1]);
}

export { makeRng };
