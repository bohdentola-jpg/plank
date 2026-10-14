// World builder: turns a track definition into a lit, dressed THREE scene.
//   road + shoulders + skirts, terrain heightfield, barriers, start line,
//   sky + fog + sun/moon per time of day, baked lamp glow on the asphalt,
//   wet-road light streaks, then the environment's own scenery (env/*.js).
import * as THREE from 'three';
import { Track } from './track.js';
import { roadTextures, curbTexture, concreteTexture, groundTexture, glowTexture, streakTexture, toTex } from './textures.js';
import { makeNoise2D, makeRng, clamp, smoothstep, nextFrame } from '../core/util.js';
import { getEnvMap } from '../core/envmap.js';

// ------------------------------------------------------------------ atmosphere

export const ATMOS = {
  night: {
    sky: ['#02040a', '#07102a', '#1d2a4f'], glowHorizon: '#3a2c3a', fog: '#0b1224', fogD: 0.0026,
    sun: { color: '#9fb4ff', i: 0.22, el: 0.9, az: 0.6 }, hemi: ['#2c3c6e', '#0b0b10', 0.55], amb: 0.06,
    env: 'night', stars: true, moon: true, lamps: true, headlights: true,
    post: { exposure: 1.15, bloomStrength: 1.05, bloomThreshold: 0.9, saturation: 1.12, contrast: 1.06, lift: [0.0, 0.006, 0.02], gain: [1.0, 1.0, 1.04] },
  },
  dusk: {
    sky: ['#121a3e', '#3b3a6a', '#d9786a'], glowHorizon: '#ff9a6a', fog: '#4a4058', fogD: 0.0019,
    sun: { color: '#ffb48a', i: 0.9, el: 0.08, az: 2.4 }, hemi: ['#6a6aa0', '#2a2020', 0.8], amb: 0.13,
    env: 'dusk', stars: false, moon: false, lamps: true, headlights: true,
    post: { exposure: 1.05, bloomStrength: 0.85, bloomThreshold: 1.0, saturation: 1.1, contrast: 1.04, lift: [0.01, 0.0, 0.02], gain: [1.04, 0.98, 1.0] },
  },
  sunset: {
    sky: ['#2a3a7a', '#a86a8a', '#ffb070'], glowHorizon: '#ffcf8a', fog: '#c08870', fogD: 0.0012,
    sun: { color: '#ffc58a', i: 2.3, el: 0.12, az: 2.0 }, hemi: ['#a0a8d8', '#5a3a2a', 0.92], amb: 0.15,
    env: 'sunset', stars: false, moon: false, lamps: false, headlights: false,
    post: { exposure: 1.0, bloomStrength: 0.8, bloomThreshold: 1.1, saturation: 1.12, contrast: 1.05, lift: [0.01, 0.0, 0.0], gain: [1.06, 1.0, 0.94] },
  },
  day: {
    sky: ['#2f6ac4', '#6aa0e0', '#cfe2f2'], glowHorizon: '#ffffff', fog: '#b8cce0', fogD: 0.0008,
    sun: { color: '#fff4e0', i: 3.0, el: 0.95, az: 0.9 }, hemi: ['#bcd4ff', '#6a6250', 0.85], amb: 0.15,
    env: 'day', stars: false, moon: false, lamps: false, headlights: false,
    post: { exposure: 0.95, bloomStrength: 0.55, bloomThreshold: 1.3, saturation: 1.08, contrast: 1.04 },
  },
  overcast: {
    sky: ['#7d8794', '#9aa3ae', '#c2c8cf'], glowHorizon: '#d0d4d8', fog: '#9aa3ad', fogD: 0.0016,
    sun: { color: '#e8eef6', i: 1.2, el: 1.1, az: 0.3 }, hemi: ['#c8d0dc', '#4a4a48', 1.0], amb: 0.2,
    env: 'overcast', stars: false, moon: false, lamps: false, headlights: false,
    post: { exposure: 1.0, bloomStrength: 0.5, bloomThreshold: 1.3, saturation: 0.92, contrast: 1.04 },
  },
};

function skyMesh(at) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      cTop: { value: new THREE.Color(at.sky[0]) },
      cMid: { value: new THREE.Color(at.sky[1]) },
      cHor: { value: new THREE.Color(at.sky[2]) },
      cGlow: { value: new THREE.Color(at.glowHorizon) },
      sunDir: { value: new THREE.Vector3() },
      stars: { value: at.stars ? 1 : 0 },
      moon: { value: at.moon ? 1 : 0 },
      time: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 cTop, cMid, cHor, cGlow, sunDir; uniform float stars, moon, time; varying vec3 vDir;
      float h21(vec2 p){ p = fract(p*vec2(233.34, 851.73)); p += dot(p, p+23.45); return fract(p.x*p.y); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=h21(i), b=h21(i+vec2(1,0)), c=h21(i+vec2(0,1)), d=h21(i+vec2(1,1));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(cHor, mix(cMid, cTop, smoothstep(0.15, 0.7, h)), smoothstep(0.0, 0.25, h)) : mix(cHor, cHor*0.35, smoothstep(0.0, 0.2, -h));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += cGlow * pow(sd, 6.0) * 0.45 + cGlow * pow(max(0.0, 1.0 - abs(h)*3.0), 3.0) * 0.12;
        // sun / moon disc
        float disc = smoothstep(0.9993, 0.99965, sd);
        col += mix(cGlow * 6.0, vec3(0.9, 0.95, 1.1) * 2.2, moon) * disc;
        col += cGlow * pow(sd, 120.0) * (1.0 - moon) * 1.5;
        // clouds: two layers of value noise on a flattened dome
        vec2 cp = d.xz / max(0.08, h + 0.12) * 1.4 + vec2(time * 0.004, 0.0);
        float cl = vnoise(cp) * 0.6 + vnoise(cp * 2.3) * 0.3 + vnoise(cp * 5.1) * 0.1;
        cl = smoothstep(0.55, 0.85, cl) * smoothstep(0.0, 0.12, h);
        vec3 cloudCol = mix(cHor * 1.1, cGlow, pow(sd, 3.0) * 0.6) * (moon > 0.5 ? 0.35 : 1.0);
        col = mix(col, cloudCol, cl * 0.55);
        // stars
        if (stars > 0.5 && h > 0.05) {
          vec2 sp = d.xz / (h + 0.3) * 260.0;
          float st = h21(floor(sp));
          float tw = 0.6 + 0.4 * sin(time * 2.0 + st * 40.0);
          col += vec3(step(0.9965, st) * tw * smoothstep(0.05, 0.35, h)) * (1.0 - cl);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  m.scale.setScalar(2500);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

// ------------------------------------------------------------------ terrain

export class Terrain {
  constructor(track, natural, opts = {}) {
    const b = track.bounds;
    const margin = opts.margin ?? 520;
    this.cell = opts.cell ?? 10;
    this.x0 = b.minX - margin;
    this.z0 = b.minZ - margin;
    this.nx = Math.ceil((b.maxX - b.minX + margin * 2) / this.cell) + 1;
    this.nz = Math.ceil((b.maxZ - b.minZ + margin * 2) / this.cell) + 1;
    this.H = new Float32Array(this.nx * this.nz);
    this.roadMask = new Float32Array(this.nx * this.nz); // 0 near road → 1 natural
    const flat = opts.flat ?? 8;
    const blend = opts.blend ?? 34;
    for (let j = 0; j < this.nz; j++) {
      for (let i = 0; i < this.nx; i++) {
        const x = this.x0 + i * this.cell, z = this.z0 + j * this.cell;
        const nat = natural(x, z);
        const k = track.nearestIndex(x, z, 3);
        let h = nat;
        let m = 1;
        if (k >= 0) {
          const lat = (x - track.X[k]) * track.LX[k] + (z - track.Z[k]) * track.LZ[k];
          const lon = (x - track.X[k]) * track.TX[k] + (z - track.Z[k]) * track.TZ[k];
          const d = Math.abs(lon) > track.step * 3 ? Math.hypot(lat, lon) : Math.abs(lat);
          const w = track.W[k] + track.shoulder;
          const edgeLat = clamp(lat, -track.W[k], track.W[k]);
          const roadY = track.Y[k] + edgeLat * Math.tan(track.B[k]) - 0.35;
          m = smoothstep(w + flat * 0.5, w + flat + blend, d);
          h = roadY + (nat - roadY) * m;
        }
        this.H[j * this.nx + i] = h;
        this.roadMask[j * this.nx + i] = m;
      }
    }
  }

  heightAt(x, z) {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    const i = clamp(Math.floor(fx), 0, this.nx - 2), j = clamp(Math.floor(fz), 0, this.nz - 2);
    const tx = clamp(fx - i, 0, 1), tz = clamp(fz - j, 0, 1);
    const H = this.H, n = this.nx;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }

  normalAt(x, z) {
    const e = this.cell * 0.5;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const v = new THREE.Vector3(-hx, 2 * e, -hz).normalize();
    return [v.x, v.y, v.z];
  }

  /** Mesh with slope-based vertex colors (flat = top color, steep = cliff color). */
  mesh(material, colors) {
    const g = new THREE.PlaneGeometry((this.nx - 1) * this.cell, (this.nz - 1) * this.cell, this.nx - 1, this.nz - 1);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const cFlat = new THREE.Color(colors.flat), cSteep = new THREE.Color(colors.steep), cHigh = colors.high ? new THREE.Color(colors.high) : null;
    const tmp = new THREE.Color();
    // PlaneGeometry rows run along -z after rotation; map back to our grid
    const w = (this.nx - 1) * this.cell, d = (this.nz - 1) * this.cell;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k) + w / 2 + this.x0;
      const z = p.getZ(k) + d / 2 + this.z0;
      p.setX(k, x);
      p.setZ(k, z);
      const h = this.heightAt(x, z);
      p.setY(k, h);
      const n = this.normalAt(x, z);
      const steep = smoothstep(0.92, 0.7, n[1]);
      tmp.copy(cFlat).lerp(cSteep, steep);
      if (cHigh && colors.highAt !== undefined) tmp.lerp(cHigh, smoothstep(colors.highAt, colors.highAt + 40, h) * (1 - steep * 0.7));
      const jitter = 0.92 + ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.16;
      col[k * 3] = tmp.r * jitter; col[k * 3 + 1] = tmp.g * jitter; col[k * 3 + 2] = tmp.b * jitter;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    return m;
  }
}

// ------------------------------------------------------------------ strips

/**
 * Build a strip mesh following the track. cols: [{ lat(i) → m, dy(i) → m, u }]
 * v runs along s / vLen. Adds a 'glow' attribute (filled later by bakeGlow).
 */
export function stripMesh(track, cols, material, vLen = 12, opts = {}) {
  const N = track.N;
  const rows = track.closed ? N + 1 : N;
  const nc = cols.length;
  const pos = new Float32Array(rows * nc * 3);
  const uv = new Float32Array(rows * nc * 2);
  const i0 = opts.from ?? 0;
  for (let r = 0; r < rows; r++) {
    const i = track.idx(r + i0);
    const s = (r + i0) * track.step;
    for (let c = 0; c < nc; c++) {
      const col = cols[c];
      const lat = typeof col.lat === 'function' ? col.lat(i) : col.lat;
      const dy = typeof col.dy === 'function' ? col.dy(i) : (col.dy || 0);
      const k = (r * nc + c);
      pos[k * 3] = track.X[i] + track.LX[i] * lat;
      pos[k * 3 + 1] = track.roadY(i, 0, col.flat ? clamp(lat, -track.W[i], track.W[i]) : lat) + dy;
      pos[k * 3 + 2] = track.Z[i] + track.LZ[i] * lat;
      uv[k * 2] = typeof col.u === 'function' ? col.u(i) : col.u;
      uv[k * 2 + 1] = s / vLen;
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < nc - 1; c++) {
      const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
      // winding so normals face +y for cols ordered right→left (lat ascending)
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(rows * nc * 3), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  if (opts.flipCheck) {
    const n = g.attributes.normal;
    if (n.getY(nc >> 1) < 0) {
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
  }
  return m;
}

/** Inject the baked 'glow' vertex attribute as extra emissive light (× albedo). */
export function glowMaterial(mat, strength = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * diffuseColor.rgb * ${strength.toFixed(2)};`);
  };
  mat.customProgramCacheKey = () => 'mf-glow' + strength.toFixed(2);
  return mat;
}

/** Extrude a cross-section profile [[dl, dy], …] along a lateral line on one side. */
export function extrudeAlong(track, side, latFn, profile, material, opts = {}) {
  const N = track.N;
  const rows = track.closed ? N + 1 : N;
  const np = profile.length;
  const pos = new Float32Array(rows * np * 3);
  const uv = new Float32Array(rows * np * 2);
  const every = opts.every || 1;
  let r2 = 0;
  const rowIdx = [];
  for (let r = 0; r < rows; r += every) rowIdx.push(r);
  if (rowIdx[rowIdx.length - 1] !== rows - 1) rowIdx.push(rows - 1);
  const R = rowIdx.length;
  const P = new Float32Array(R * np * 3), U = new Float32Array(R * np * 2);
  let plen = 0;
  const pl = [0];
  for (let k = 1; k < np; k++) { plen += Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]); pl.push(plen); }
  for (const r of rowIdx) {
    const i = track.idx(r);
    const lat0 = latFn(i);
    const baseY = opts.ground ? opts.ground(i, side * lat0) : track.roadY(i, 0, side * Math.min(lat0, track.W[i] + track.shoulder));
    for (let k = 0; k < np; k++) {
      const [dl, dy] = profile[k];
      const lat = side * (lat0 + dl);
      const q = (r2 * np + k);
      P[q * 3] = track.X[i] + track.LX[i] * lat;
      P[q * 3 + 1] = baseY + dy;
      P[q * 3 + 2] = track.Z[i] + track.LZ[i] * lat;
      U[q * 2] = r * track.step / (opts.uLen || 4);
      U[q * 2 + 1] = pl[k] / (opts.vLen || Math.max(0.01, plen));
    }
    r2++;
  }
  void pos; void uv;
  const idx = [];
  for (let r = 0; r < R - 1; r++) {
    for (let k = 0; k < np - 1; k++) {
      const a = r * np + k, b = a + 1, c = a + np, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = !!opts.shadow;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ world

export class World {
  constructor(def, renderer) {
    this.def = def;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.lamps = [];          // {x,y,z,color:THREE.Color,radius,i}
    this.streakSources = [];  // {x,y,z,color,size}
    this.glowMeshes = [];
    this.animators = [];
    this.disposables = [];
    this.at = { ...ATMOS[def.time || 'night'], ...(def.atmos || {}) };
    this.rng = makeRng(def.id || 'world');
  }

  add(obj) { this.group.add(obj); return obj; }

  addLamp(x, y, z, color = '#ffb35a', radius = 16, intensity = 1) {
    this.lamps.push({ x, y, z, color: new THREE.Color(color), radius, intensity });
    if (this.def.weather === 'wet' || this.def.weather === 'rain') this.streakSources.push({ x, y, z, color: new THREE.Color(color), size: 1 });
  }

  addStreak(x, y, z, color, size = 1) {
    if (this.def.weather === 'wet' || this.def.weather === 'rain') this.streakSources.push({ x, y, z, color: new THREE.Color(color), size });
  }

  /** Sum lamp light into every registered glow mesh's vertices. */
  bakeGlow() {
    if (!this.lamps.length) return;
    const cell = 30;
    const grid = new Map();
    for (const L of this.lamps) {
      const k = Math.floor(L.x / cell) * 100000 + Math.floor(L.z / cell);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(L);
    }
    for (const m of this.glowMeshes) {
      const p = m.geometry.attributes.position;
      const gl = m.geometry.attributes.glow;
      if (!gl) continue;
      for (let v = 0; v < p.count; v++) {
        const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
        let r = 0, g = 0, b = 0;
        const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const list = grid.get((cx + dx) * 100000 + (cz + dz));
            if (!list) continue;
            for (const L of list) {
              const d2 = (L.x - x) ** 2 + (L.z - z) ** 2;
              if (d2 > L.radius * L.radius) continue;
              const hy = Math.max(1, L.y - y);
              const d = Math.sqrt(d2 + hy * hy * 0.3);
              const f = Math.max(0, 1 - d / L.radius);
              const k = f * f * L.intensity;
              r += L.color.r * k; g += L.color.g * k; b += L.color.b * k;
            }
          }
        }
        gl.setXYZ(v, Math.min(r, 3), Math.min(g, 3), Math.min(b, 3));
      }
      gl.needsUpdate = true;
    }
  }

  /** Camera-facing light streaks on the wet road under every light source. */
  buildStreaks() {
    const src = this.streakSources;
    if (!src.length) return;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const n = src.length;
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index;
    ig.attributes.position = geo.attributes.position;
    ig.attributes.uv = geo.attributes.uv;
    const ipos = new Float32Array(n * 3), icol = new Float32Array(n * 3), isz = new Float32Array(n);
    src.forEach((s, k) => {
      const p = this.track.project(s.x, s.z, -1);
      const lat = clamp(p.lat, -this.track.W[p.i] - 3, this.track.W[p.i] + 3);
      const gy = this.track.roadY(p.i, p.t, clamp(lat, -this.track.W[p.i], this.track.W[p.i]));
      ipos[k * 3] = s.x; ipos[k * 3 + 1] = gy + 0.04; ipos[k * 3 + 2] = s.z;
      icol[k * 3] = s.color.r; icol[k * 3 + 1] = s.color.g; icol[k * 3 + 2] = s.color.b;
      isz[k] = s.size * Math.min(1.5, Math.max(0.4, (s.y - gy) / 6));
    });
    ig.setAttribute('ipos', new THREE.InstancedBufferAttribute(ipos, 3));
    ig.setAttribute('icol', new THREE.InstancedBufferAttribute(icol, 3));
    ig.setAttribute('isz', new THREE.InstancedBufferAttribute(isz, 1));
    ig.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { map: { value: streakTexture() }, camPos: { value: new THREE.Vector3() }, strength: { value: 1.15 } },
      vertexShader: `
        attribute vec3 ipos; attribute vec3 icol; attribute float isz;
        uniform vec3 camPos; varying vec2 vUv; varying vec3 vCol; varying float vFade;
        void main(){
          vec3 toCam = camPos - ipos; toCam.y = 0.0;
          float dist = length(toCam);
          vec3 dir = toCam / max(dist, 0.001);
          vec3 side = vec3(dir.z, 0.0, -dir.x);
          float len = min(dist * 0.7, 30.0) * isz;
          vec3 p = ipos + side * (position.x * 1.1 * isz) + dir * (position.y * len);
          vUv = uv; vCol = icol; vFade = (1.0 - smoothstep(60.0, 220.0, dist)) * smoothstep(3.0, 16.0, dist);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform float strength; varying vec2 vUv; varying vec3 vCol; varying float vFade;
        void main(){ vec4 t = texture2D(map, vec2(vUv.x, vUv.y)); float k = t.a * t.a * (3.0 - 2.0 * t.a); gl_FragColor = vec4(vCol * k * strength * vFade, 1.0); }`,
    });
    const mesh = new THREE.Mesh(ig, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    this.add(mesh);
    this.streakMat = mat;
  }

  update(dt, camera) {
    if (this.sky) {
      this.sky.position.copy(camera.position);
      this.sky.material.uniforms.time.value += dt;
    }
    if (this.streakMat) this.streakMat.uniforms.camPos.value.copy(camera.position);
    if (this.sun && this.sunFollow) {
      // keep the shadow camera around the player
      this.sun.position.copy(this.sunFollow).addScaledVector(this.sunDir, 120);
      this.sun.target.position.copy(this.sunFollow);
      this.sun.target.updateMatrixWorld();
    }
    for (const a of this.animators) a(dt, camera);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) m.dispose();
      }
    });
    for (const d of this.disposables) d.dispose?.();
  }
}

/**
 * Build the whole world for a track definition. Yields to the browser
 * between heavy stages so the loading static keeps animating.
 */
export async function buildWorld(def, renderer, onProgress = () => {}) {
  const world = new World(def, renderer);
  const at = world.at;
  const track = new Track(def);
  world.track = track;
  onProgress(0.1, 'SURVEYING ROUTE');
  await nextFrame();

  // ---- sky, fog, lights
  const scene = world.scene;
  scene.fog = new THREE.FogExp2(new THREE.Color(at.fog), def.fogD ?? at.fogD);
  scene.background = new THREE.Color(at.sky[2]);
  const sky = skyMesh(at);
  world.sky = sky;
  scene.add(sky);
  const sunDir = new THREE.Vector3(Math.cos(at.sun.az) * Math.cos(at.sun.el), Math.sin(at.sun.el), Math.sin(at.sun.az) * Math.cos(at.sun.el)).normalize();
  sky.material.uniforms.sunDir.value.copy(sunDir);
  world.sunDir = sunDir;
  const hemi = new THREE.HemisphereLight(at.hemi[0], at.hemi[1], at.hemi[2]);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(at.sun.color, at.sun.i);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.castShadow = !at.lamps || def.time === 'dusk';
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);
  world.sun = sun;
  world.hemi = hemi;
  scene.environment = getEnvMap(renderer, at.env);

  // ---- terrain (unless the environment brings its own ground)
  const envMod = await import(`./env/${def.env}.js`);
  const envApi = envMod.default || envMod;
  const natural = envApi.natural ? envApi.natural(def, track) : () => -1;
  if (envApi.terrain !== false) {
    const terrain = new Terrain(track, natural, envApi.terrainOpts ? envApi.terrainOpts(def) : {});
    track.terrain = terrain;
    world.terrain = terrain;
  }
  onProgress(0.3, 'GRADING TERRAIN');
  await nextFrame();

  // ---- road
  const roadStyle = { lanes: def.lanes, center: def.center, edge: def.edge, wet: def.weather === 'wet' || def.weather === 'rain', worn: def.worn ?? 0.35, base: def.asphalt };
  const maxW = Math.max(...track.W) * 2;
  const rt = roadTextures(Math.round(maxW), roadStyle);
  const roadMat = glowMaterial(new THREE.MeshStandardMaterial({
    map: rt.map, roughnessMap: rt.rough, roughness: 1, metalness: 0,
    envMapIntensity: roadStyle.wet ? 1.5 : def.time === 'night' ? 0.35 : 0.6,
  }), 3.2);
  const cols = [];
  for (const f of [-1, -0.5, 0, 0.5, 1]) {
    cols.push({ lat: (i) => f * track.W[i], u: (f + 1) / 2 * (track.W[0] * 2 / maxW) + (1 - track.W[0] * 2 / maxW) / 2 });
  }
  const road = stripMesh(track, cols, roadMat, rt.repeat);
  road.name = 'road';
  world.add(road);
  world.glowMeshes.push(road);
  world.roadMat = roadMat;

  // ---- start / finish line
  {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 32;
    const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#eee'; x.fillRect(i * 16, j * 16, 16, 16); }
    const tex = toTex(c, { repeat: false });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    const lineS = def.type === 'sprint' || def.type === 'drag' ? [track.startS, track.finishS] : [track.startS];
    for (const s of lineS) {
      const p = track.posAt(s);
      const w = track.W[p.i] * 2;
      const g = new THREE.PlaneGeometry(w, 1.6);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set(p.x, p.y + 0.02, p.z);
      m.rotation.y = p.heading;
      world.add(m);
    }
  }

  // ---- environment scenery
  onProgress(0.45, 'BUILDING SCENERY');
  await nextFrame();
  await envApi.build(world, def, track, (f, label) => onProgress(0.45 + f * 0.45, label));

  onProgress(0.92, 'WIRING THE STREETLIGHTS');
  await nextFrame();
  world.bakeGlow();
  world.buildStreaks();
  onProgress(1, 'READY');
  return world;
}

// exported helpers for env modules
export { concreteTexture, groundTexture, curbTexture, glowTexture, makeNoise2D, makeRng };
