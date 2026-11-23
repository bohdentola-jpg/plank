// The land around Port Zarya: a 2 m heightfield baked once from an analytic
// description (shore, town shelf, Kettle Hill, the airstrip plateau, the Zarya
// river, Loon Lake, the ridges inland), with streets and building pads
// levelled in. groundY(x, z) is a bilinear lookup — physics and props use it.
import * as THREE from 'three';
import { TOWN } from './townplan.js';
import { makeNoise2D } from '../core/util.js';
import { WU } from './worldUniforms.js';

export const MAP = { x0: -760, x1: 1260, z0: -980, z1: 460, step: 2 };
const NX = Math.round((MAP.x1 - MAP.x0) / MAP.step) + 1;
const NZ = Math.round((MAP.z1 - MAP.z0) / MAP.step) + 1;

const noise = makeNoise2D(1822);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Where the beach is: land north of this z (for a given x). */
export function shoreZ(x) {
  let z = 92 + 18 * Math.sin(x / 140) + 10 * Math.sin(x / 47 + 1.3);
  // the harbour basin bites into the shore
  z -= 34 * Math.exp(-(((x + 10) / 55) ** 2));
  // the cannery point sticks out
  z += 30 * Math.exp(-(((x - 175) / 45) ** 2));
  // the west coast curves south towards the lighthouse point
  if (x < -260) z += (x + 260) * -0.55;
  return z;
}

function riverX(z) { return -212 + 28 * Math.sin(z / 160) + 12 * Math.sin(z / 53); }

/** Natural height before streets and pads are levelled. */
export function baseHeight(x, z) {
  const sz = shoreZ(x);
  const inland = sz - z; // metres from the shoreline, positive on land
  let h;
  if (inland < 0) {
    h = Math.max(-14, inland * 0.12) - 0.6; // sea floor
  } else {
    // beach → town shelf → rising tundra
    h = 0.8 + Math.min(inland, 40) * 0.12 + Math.max(0, inland - 40) * 0.018 + Math.max(0, inland - 380) * 0.035;
  }
  // hills
  h += 150 * Math.exp(-(((x - 500) / 230) ** 2 + ((z + 720) / 210) ** 2));      // Kettle Hill
  h += 70 * Math.exp(-(((x + 120) / 300) ** 2 + ((z + 860) / 140) ** 2));       // the north ridge
  h += 90 * Math.exp(-(((x - 980) / 240) ** 2 + ((z + 700) / 260) ** 2));       // east ridge
  h += 45 * Math.exp(-(((x + 520) / 160) ** 2 + ((z + 420) / 160) ** 2));       // west knoll
  h += 22 * Math.exp(-(((x + 480) / 70) ** 2 + ((z - 270) / 60) ** 2));         // lighthouse point
  // texture
  const town = Math.exp(-((x / 260) ** 2 + ((z + 20) / 180) ** 2));
  const amp = inland > 0 ? (1 - town * 0.85) * (2.5 + Math.max(0, inland - 200) * 0.01) : 0.3;
  h += noise.fbm(x * 0.006, z * 0.006, 4) * amp * 2 + noise.ridged(x * 0.003 + 7, z * 0.003, 3) * amp * 3 * sm(150, 500, inland);
  // airstrip plateau
  const ap = sm(0, 60, Math.min(x - 260, 1210 - x)) * sm(0, 50, Math.min(z + 120, 40 - z));
  h = h + (6.5 - h) * ap;
  // river valley
  const rd = Math.abs(x - riverX(z));
  if (z < sz + 5) h -= 5.5 * Math.exp(-((rd / 22) ** 2)) * sm(sz + 5, sz - 60, z);
  // Loon Lake (frozen)
  const ld = Math.hypot((x + 300) / 110, (z + 470) / 80);
  if (ld < 1.4) h = h + (14 - h) * sm(1.4, 0.9, ld);
  return h;
}

// ---------------------------------------------------------------- streets
function streetSegments() {
  const segs = [];
  for (const st of TOWN.streets) {
    for (let i = 0; i < st.pts.length - 1; i++) {
      const [ax, az] = st.pts[i], [bx, bz] = st.pts[i + 1];
      segs.push({ ax, az, bx, bz, w: st.width, st });
    }
  }
  return segs;
}

let field = null;

/** Bake the heightfield (call once; ~0.5 s). */
export function bakeTerrain(extraPads = []) {
  const H = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) {
    const z = MAP.z0 + j * MAP.step;
    for (let i = 0; i < NX; i++) H[j * NX + i] = baseHeight(MAP.x0 + i * MAP.step, z);
  }
  // street centreline heights, smoothed along each street
  const segs = streetSegments();
  for (const s of segs) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    s.len = len;
    s.ha = Math.max(1.2, baseHeight(s.ax, s.az));
    s.hb = Math.max(1.2, baseHeight(s.bx, s.bz));
  }
  // level a band around each street toward its centreline (roads never dip below 1.2 m)
  const levelBand = (s) => {
    const half = s.w / 2 + 1.5, falloff = 9;
    const minX = Math.min(s.ax, s.bx) - half - falloff, maxX = Math.max(s.ax, s.bx) + half + falloff;
    const minZ = Math.min(s.az, s.bz) - half - falloff, maxZ = Math.max(s.az, s.bz) + half + falloff;
    const i0 = Math.max(0, Math.floor((minX - MAP.x0) / MAP.step)), i1 = Math.min(NX - 1, Math.ceil((maxX - MAP.x0) / MAP.step));
    const j0 = Math.max(0, Math.floor((minZ - MAP.z0) / MAP.step)), j1 = Math.min(NZ - 1, Math.ceil((maxZ - MAP.z0) / MAP.step));
    const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz;
    for (let j = j0; j <= j1; j++) {
      const z = MAP.z0 + j * MAP.step;
      for (let i = i0; i <= i1; i++) {
        const x = MAP.x0 + i * MAP.step;
        const t = Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
        const d = Math.hypot(s.ax + dx * t - x, s.az + dz * t - z);
        if (d > half + falloff) continue;
        const target = s.ha + (s.hb - s.ha) * t;
        const k = 1 - sm(half, half + falloff, d);
        const idx = j * NX + i;
        H[idx] = H[idx] + (target - H[idx]) * k;
      }
    }
  };
  for (const s of segs) levelBand(s);
  // building pads
  const pads = [...TOWN.buildings.map((b) => ({ x: b.x, z: b.z, r: b.type === 'dome' ? 40 : b.type === 'cannery' ? 38 : b.type === 'harbor' ? 0 : 16 })),
    ...TOWN.houseLots.map(([x, z]) => ({ x, z, r: 9 })), ...extraPads];
  for (const p of pads) {
    if (!p.r) continue;
    const target = Math.max(1.3, sampleRaw(H, p.x, p.z));
    const R = p.r + 8;
    const i0 = Math.max(0, Math.floor((p.x - R - MAP.x0) / MAP.step)), i1 = Math.min(NX - 1, Math.ceil((p.x + R - MAP.x0) / MAP.step));
    const j0 = Math.max(0, Math.floor((p.z - R - MAP.z0) / MAP.step)), j1 = Math.min(NZ - 1, Math.ceil((p.z + R - MAP.z0) / MAP.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(MAP.x0 + i * MAP.step - p.x, MAP.z0 + j * MAP.step - p.z);
      const k = 1 - sm(p.r, R, d);
      if (k > 0) H[j * NX + i] += (target - H[j * NX + i]) * k;
    }
  }
  field = { H, segs };
  return field;
}

function sampleRaw(H, x, z) {
  const fx = (x - MAP.x0) / MAP.step, fz = (z - MAP.z0) / MAP.step;
  const i = Math.min(NX - 2, Math.max(0, Math.floor(fx))), j = Math.min(NZ - 2, Math.max(0, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
  const a = H[j * NX + i], b = H[j * NX + i + 1], c = H[(j + 1) * NX + i], d = H[(j + 1) * NX + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

/** Ground height at a point (metres). Sea surface counts as 0 for things that float. */
export function groundY(x, z) {
  if (!field) bakeTerrain();
  return sampleRaw(field.H, x, z);
}

export function groundNormal(x, z, out = new THREE.Vector3()) {
  const e = 1.0;
  const hx = groundY(x + e, z) - groundY(x - e, z);
  const hz = groundY(x, z + e) - groundY(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

// ---------------------------------------------------------------- mesh
const SNOW_PARS = /* glsl */`
varying vec3 vWPos;
varying vec3 vWNrm;
uniform float uTime;
uniform float uNight;
float th(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float tn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y); }
`;

export function buildTerrainMesh() {
  if (!field) bakeTerrain();
  const step = 4;
  const nx = Math.floor((MAP.x1 - MAP.x0) / step) + 1;
  const nz = Math.floor((MAP.z1 - MAP.z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = MAP.x0 + i * step, z = MAP.z0 + j * step;
      const y = groundY(x, z);
      const k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      // colour: snow, rock on steep ground, tundra scrub poking through, wet dark beach
      const n = groundNormal(x, z);
      const steep = 1 - n.y;
      const scrub = Math.max(0, noise.fbm(x * 0.02, z * 0.02, 3)) * sm(30, 200, shoreZ(x) - z);
      let r = 0.92, g = 0.94, b = 0.98;
      const rock = sm(0.18, 0.42, steep);
      r = r * (1 - rock) + 0.32 * rock; g = g * (1 - rock) + 0.31 * rock; b = b * (1 - rock) + 0.3 * rock;
      const sc = scrub * 0.35 * (1 - rock);
      r -= sc * 0.45; g -= sc * 0.4; b -= sc * 0.5;
      const beach = sm(6, 0, shoreZ(x) - z) * (y < 2 ? 1 : 0);
      r = r * (1 - beach * 0.6) + 0.18 * beach * 0.6; g = g * (1 - beach * 0.6) + 0.17 * beach * 0.6; b = b * (1 - beach * 0.6) + 0.16 * beach * 0.6;
      col[k] = r; col[k + 1] = g; col[k + 2] = b;
    }
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      // skip cells well under the sea (the water covers them)
      if (pos[a * 3 + 1] < -3 && pos[b * 3 + 1] < -3 && pos[c * 3 + 1] < -3 && pos[d * 3 + 1] < -3) continue;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WU.time;
    sh.uniforms.uNight = WU.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SNOW_PARS)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float drift = tn(vWPos.xz * 0.15) * 0.6 + tn(vWPos.xz * 0.6) * 0.4;
        diffuseColor.rgb *= 0.9 + 0.12 * drift;
        // blue in the hollows
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.92, 1.05), smoothstep(0.55, 0.3, drift));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float e = 0.35;
          float h0 = tn(vWPos.xz * 1.3) * 0.6 + tn(vWPos.xz * 5.0) * 0.25;
          vec3 dpdx = dFdx(vWPos), dpdy = dFdy(vWPos);
          float dhx = dFdx(h0) * 0.06, dhy = dFdy(h0) * 0.06;
          vec3 r1 = cross(dpdy, vWNrm), r2 = cross(vWNrm, dpdx);
          float det = dot(dpdx, r1);
          vec3 gw = sign(det) * (dhx * r1 + dhy * r2);
          vec3 nw = normalize(abs(det) * vWNrm - gw);
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
          (void)e;
        }`.replace('(void)e;', ''))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // snow sparkle: tiny glints that catch the light (and the bloom)
        {
          vec2 cell = floor(vWPos.xz * 9.0);
          float s = th(cell);
          vec3 vdir = normalize(cameraPosition - vWPos);
          float glint = step(0.993, s) * pow(max(0.0, dot(vdir, normalize(vec3(sin(s * 40.0), 1.0, cos(s * 31.0))))), 18.0);
          float lum = 0.25 + 0.75 * uNight;
          totalEmissiveRadiance += vec3(0.9, 0.95, 1.0) * glint * 1.6 * lum * smoothstep(60.0, 5.0, length(cameraPosition - vWPos));
        }`);
  };
  mat.customProgramCacheKey = () => 'cb-snow-v1';
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Far mountains on the horizon (a ring), for depth. */
export function buildFarHills() {
  const g = new THREE.CylinderGeometry(2600, 2600, 1, 256, 8, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x);
    // mountains inland (north/east), open sea to the south-west
    const land = Math.max(0, Math.cos(a + 1.9)) ** 0.6;
    const hgt = land * (140 + 260 * Math.abs(noise.ridged(a * 3.0, 1.2, 4)) + 90 * noise.fbm(a * 9, 4.4, 3));
    p.setY(i, (y + 0.5) * hgt - 30);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb8c4d0, roughness: 0.95, side: THREE.BackSide, fog: true }));
  m.position.set(250, 0, -250);
  m.name = 'farHills';
  return m;
}
