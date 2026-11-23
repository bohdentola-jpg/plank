// Shared materials for the building kit and props.
//
//   getMaterial(name, { color, snow, vertexColors, side }) → cached MeshStandardMaterial
//
// Textured materials load assets/tex/<tex>_col/_nrm/_rgh.jpg (CC0, see
// assets/tex/CREDITS.md) with repeat = tiles per METRE (geometry UVs are metres),
// and fall back to small procedural canvases if a file is missing. `color`
// multiplies the texture (paint any colour); the kit also tints per vertex.
// `snow: true` blends up-facing surfaces (world normal.y) to snow × WU.snowCover.
//
// Special names:
//   glass_warm / glass_cold / glass_dark — window glass; emissive = night light ×
//     a procedural "room behind the glass" atlas × the vertex colour (so each
//     window can be warm, dim, TV-blue or dark from ONE shared material).
//     Registered in nightMaterials (userData.dayEmissive / nightEmissive).
//   neon / neon_flicker — MeshBasicMaterial, vertex colours may exceed 1 (HDR,
//     so bloom catches them); flicker uses WU.time and world position.
//   getSignMaterial(key, spec) — cached canvas signs ('paint' | 'lightbox' | 'neon').
import * as THREE from 'three';
import { WU, nightMaterials } from './worldUniforms.js';

const TEX_URL = new URL('../../assets/tex/', import.meta.url).href;
const loader = new THREE.TextureLoader();
const texCache = new Map();
const matCache = new Map();

// metres per texture tile, plus per-map tweaks
export const TEX = {
  siding_lap: { size: 1.2 },
  siding_lap_old: { size: 1.4, noRough: 0.88 },
  siding_panel: { size: 1.8 },
  siding_peel: { size: 1.6 },
  wood_weathered: { size: 1.5 },
  wood_raw: { size: 1.0 },
  logs: { size: 1.25 },
  plywood: { size: 1.2 },
  osb: { size: 1.2 },
  wood_dark: { size: 1.0 },
  wood_panel: { size: 2.1 },
  floor_wood: { size: 2.0 },
  metal_corr: { size: 2.7 },
  metal_corr_rust: { size: 2.0 },
  metal_corr_paint: { size: 1.5 },
  metal_rust: { size: 2.2 },
  metal_paint_rust: { size: 1.6 },
  diamond_plate: { size: 0.6 },
  roof_shingle: { size: 1.8 },
  concrete: { size: 3.0 },
  brick: { size: 2.0 },
  asphalt: { size: 3.0 },
  gravel: { size: 2.0 },
  snow: { size: 2.5 },
  snow_dirty: { size: 2.0 },
  rock: { size: 2.5 },
  plaster: { size: 2.0 },
  tile: { size: 1.9 },
  carpet: { size: 1.7 },
  linoleum: { size: 2.0 },
};

// mean colour of each texture (sRGB) — used when a small textured part is folded
// into the untextured 'solid' material to stay inside the draw-call budget
export const TEX_MEAN = {
  asphalt: '#494844', brick: '#95846d', carpet: '#b2b2b2', concrete: '#535351', diamond_plate: '#777f80',
  floor_wood: '#7c502a', gravel: '#85827a', linoleum: '#af8351', logs: '#493a32', metal_corr: '#504f49',
  metal_corr_paint: '#b7b7b7', metal_corr_rust: '#4b2315', metal_paint_rust: '#8f7852', metal_rust: '#5f371e',
  osb: '#b4916c', plaster: '#cccccc', plywood: '#74593b', rock: '#373029', roof_shingle: '#818181',
  siding_lap: '#c7c7c7', siding_lap_old: '#655a4f', siding_panel: '#cccccc', siding_peel: '#b3b3b3',
  snow: '#dbdbdd', snow_dirty: '#676563', tile: '#aa9884', wood_dark: '#5b2a17', wood_panel: '#4c2112',
  wood_raw: '#9b876e', wood_weathered: '#464440',
};

/**
 * Untextured materials are all ONE shared 'solid' material in the kit: the
 * builder writes roughness/metalness into the (otherwise unused) UVs and the
 * base colour into the vertex colour. name → [roughness, metalness, base colour?]
 */
export const SOLID = {
  paint: [0.6, 0], paint_gloss: [0.28, 0], sheet_metal: [0.38, 0.35], metal: [0.42, 0.8], galv: [0.5, 0.7, '#b4babe'],
  chrome: [0.12, 1], gold: [0.2, 1, '#ffcf73'], gold_dull: [0.55, 0.75, '#8a7444'], plastic: [0.45, 0], rubber: [0.92, 0, '#202020'],
  fabric: [0.95, 0], leather: [0.5, 0], stone: [0.85, 0], ice: [0.08, 0.1, '#dcefff'], solid: [0.6, 0],
};

// material table: tex (optional), base colour, roughness, metalness, normal scale, bright (colour multiplier)
const DEF = {
  siding_lap: { tex: 'siding_lap', rough: 1.0 },
  siding_lap_old: { tex: 'siding_lap_old', rough: 0.9 },
  siding_panel: { tex: 'siding_panel', rough: 1.0 },
  siding_peel: { tex: 'siding_peel', rough: 1.0 },
  wood_weathered: { tex: 'wood_weathered', rough: 1.0, bright: 1.45 },
  wood_raw: { tex: 'wood_raw', rough: 1.0 },
  logs: { tex: 'logs', rough: 1.0, bright: 1.5 },
  plywood: { tex: 'plywood', rough: 1.0 },
  osb: { tex: 'osb', rough: 1.0 },
  wood_dark: { tex: 'wood_dark', rough: 0.9 },
  wood_panel: { tex: 'wood_panel', rough: 0.9 },
  floor_wood: { tex: 'floor_wood', rough: 0.9 },
  metal_corr: { tex: 'metal_corr', rough: 1.0, metal: 0.55, bright: 1.75 },
  metal_corr_rust: { tex: 'metal_corr_rust', rough: 1.0, metal: 0.25, bright: 1.35 },
  metal_corr_paint: { tex: 'metal_corr_paint', rough: 0.9, metal: 0.3 },
  metal_rust: { tex: 'metal_rust', rough: 1.0, metal: 0.3 },
  metal_paint_rust: { tex: 'metal_paint_rust', rough: 1.0, metal: 0.2 },
  diamond_plate: { tex: 'diamond_plate', rough: 0.9, metal: 0.85 },
  roof_shingle: { tex: 'roof_shingle', rough: 1.0 },
  concrete: { tex: 'concrete', rough: 1.0, bright: 1.5 },
  brick: { tex: 'brick', rough: 1.0 },
  asphalt: { tex: 'asphalt', rough: 1.0 },
  gravel: { tex: 'gravel', rough: 1.0 },
  snow: { tex: 'snow', rough: 0.85, color: 0xf4f8ff },
  snow_dirty: { tex: 'snow_dirty', rough: 0.9 },
  rock: { tex: 'rock', rough: 1.0, bright: 1.6 },
  plaster: { tex: 'plaster', rough: 1.0 },
  tile: { tex: 'tile', rough: 0.6 },
  carpet: { tex: 'carpet', rough: 1.0 },
  linoleum: { tex: 'linoleum', rough: 0.55 },
  // untextured
  paint: { rough: 0.6 },
  paint_gloss: { rough: 0.28 },
  sheet_metal: { rough: 0.38, metal: 0.35 },
  metal: { rough: 0.42, metal: 0.8 },
  galv: { rough: 0.5, metal: 0.7, color: 0xb4babe },
  chrome: { rough: 0.12, metal: 1.0 },
  gold: { rough: 0.2, metal: 1.0, color: 0xffcf73 },
  gold_dull: { rough: 0.55, metal: 0.75, color: 0x8a7444 },
  plastic: { rough: 0.45 },
  rubber: { rough: 0.92, color: 0x202020 },
  fabric: { rough: 0.95 },
  leather: { rough: 0.5 },
  stone: { rough: 0.85 },
  ice: { rough: 0.08, color: 0xdcefff, opacity: 0.75 },
  water: { rough: 0.06, color: 0x0b1419, metal: 0.0 },
};

export function materialNames() {
  return [...Object.keys(DEF), 'glass_warm', 'glass_cold', 'glass_dark', 'neon', 'neon_flicker', 'glow', 'chainlink'];
}

// ------------------------------------------------------------------ textures

function fallbackCanvas(name, kind) {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  if (kind === 'nrm') { g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, s, s); return cv; }
  if (kind === 'rgh') { g.fillStyle = 'rgb(200,200,200)'; g.fillRect(0, 0, s, s); return cv; }
  const base = /snow/.test(name) ? 235 : /siding|plaster|carpet/.test(name) ? 200 : /rust/.test(name) ? 120 : 140;
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 400; i++) {
    const v = base + (Math.random() - 0.5) * 40;
    g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  if (/siding|wood|plank|floor|logs/.test(name)) for (let y = 0; y < s; y += 8) g.fillRect(0, y, s, 1);
  if (/corr/.test(name)) for (let x = 0; x < s; x += 4) g.fillRect(x, 0, 1, s);
  return cv;
}

function loadTex(name, kind) {
  const key = name + '_' + kind;
  if (texCache.has(key)) return texCache.get(key);
  const info = TEX[name] || { size: 1 };
  const t = loader.load(`${TEX_URL}${name}_${kind}.jpg`, undefined, undefined, () => {
    t.image = fallbackCanvas(name, kind);
    t.needsUpdate = true;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.repeat.set(1 / info.size, 1 / info.size);
  t.colorSpace = kind === 'col' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texCache.set(key, t);
  return t;
}

// ------------------------------------------------------------------ snow

const SNOW_VERT_PARS = /* glsl */`
varying vec3 vSnowWP;
varying vec3 vSnowN;
`;
const SNOW_VERT = /* glsl */`
{
  vec4 swp = vec4(transformed, 1.0);
  vec3 sn = objectNormal;
  #ifdef USE_INSTANCING
    swp = instanceMatrix * swp;
    sn = mat3(instanceMatrix) * sn;
  #endif
  vSnowWP = (modelMatrix * swp).xyz;
  vSnowN = normalize(mat3(modelMatrix) * sn);
}
`;
const SNOW_FRAG_PARS = /* glsl */`
uniform float snowCover;
varying vec3 vSnowWP;
varying vec3 vSnowN;
float snHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float snNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(snHash(i), snHash(i + vec2(1.0, 0.0)), f.x), mix(snHash(i + vec2(0.0, 1.0)), snHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const SNOW_FRAG_COLOR = /* glsl */`
float snowK = 0.0;
{
  float ny = normalize(vSnowN).y;
  float nz = snNoise(vSnowWP.xz * 1.1 + vSnowWP.y * 0.3) * 0.6 + snNoise(vSnowWP.xz * 4.7 - vSnowWP.y) * 0.4;
  snowK = smoothstep(0.32, 0.6, ny + (nz - 0.5) * 0.42) * snowCover;
  float sparkle = step(0.985, snHash(floor(vSnowWP.xz * 60.0))) * 0.25;
  vec3 snowCol = vec3(0.80, 0.84, 0.90) * (0.9 + 0.12 * nz) + sparkle;
  diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, snowK);
}
`;

function addSnow(shader) {
  shader.uniforms.snowCover = WU.snowCover;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + SNOW_VERT_PARS)
    .replace('#include <project_vertex>', '#include <project_vertex>\n' + SNOW_VERT);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + SNOW_FRAG_PARS)
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + SNOW_FRAG_COLOR)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, snowK);')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, snowK);')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, snowK));');
}

// ------------------------------------------------------------------ window atlas

let windowAtlas = null;
/** 4×2 atlas of greyscale "rooms behind the glass"; cell k → see windowCellUV. */
export function getWindowAtlas() {
  if (windowAtlas) return windowAtlas;
  const C = 128;
  const cv = document.createElement('canvas');
  cv.width = C * 4;
  cv.height = C * 2;
  const g = cv.getContext('2d');
  const rnd = mulberry(7);
  const cell = (k, fn) => {
    const x = (k % 4) * C, y = Math.floor(k / 4) * C;
    g.save();
    g.beginPath();
    g.rect(x, y, C, C);
    g.clip();
    g.translate(x, y);
    fn(g);
    g.restore();
  };
  const grad = (g2, stops, x0 = 0, y0 = 0, x1 = 0, y1 = C) => {
    const gr = g2.createLinearGradient(x0, y0, x1, y1);
    for (const [t, c] of stops) gr.addColorStop(t, c);
    return gr;
  };
  // 0: curtains drawn to the sides, warm room
  cell(0, (c) => {
    c.fillStyle = grad(c, [[0, '#cfc6b8'], [0.55, '#fff4e2'], [1, '#8a7f72']]);
    c.fillRect(0, 0, C, C);
    for (const side of [0, 1]) {
      for (let i = 0; i < 6; i++) {
        const x = side ? C - 34 + i * 6 : i * 6;
        c.fillStyle = i % 2 ? 'rgba(70,40,30,0.75)' : 'rgba(110,60,45,0.7)';
        c.fillRect(x, 0, 6, C);
      }
    }
    c.fillStyle = 'rgba(40,30,25,0.6)';
    c.fillRect(34, C * 0.72, 60, C * 0.28);
  });
  // 1: venetian blinds, light leaking through
  cell(1, (c) => {
    c.fillStyle = '#efe3cf';
    c.fillRect(0, 0, C, C);
    for (let y = 0; y < C; y += 9) {
      c.fillStyle = 'rgba(60,50,40,0.55)';
      c.fillRect(0, y, C, 5);
    }
    c.fillStyle = 'rgba(30,25,20,0.5)';
    c.fillRect(C * 0.65, 0, 4, C);
  });
  // 2: room with a lamp hotspot and a dark sofa
  cell(2, (c) => {
    c.fillStyle = grad(c, [[0, '#7d7466'], [0.5, '#bdb2a0'], [1, '#4d463e']]);
    c.fillRect(0, 0, C, C);
    const r = c.createRadialGradient(C * 0.25, C * 0.55, 2, C * 0.25, C * 0.55, C * 0.55);
    r.addColorStop(0, 'rgba(255,250,235,1)');
    r.addColorStop(1, 'rgba(255,240,210,0)');
    c.fillStyle = r;
    c.fillRect(0, 0, C, C);
    c.fillStyle = 'rgba(25,20,18,0.85)';
    c.fillRect(C * 0.45, C * 0.7, C * 0.5, C * 0.3);
    c.fillRect(C * 0.2, C * 0.62, 6, C * 0.38);
    c.fillStyle = 'rgba(40,30,25,0.6)';
    c.fillRect(C * 0.1, C * 0.1, C * 0.3, C * 0.22);
  });
  // 3: kitchen — upper cabinets, bright counter
  cell(3, (c) => {
    c.fillStyle = '#f5ecdc';
    c.fillRect(0, 0, C, C);
    c.fillStyle = 'rgba(70,55,40,0.85)';
    c.fillRect(0, 0, C, C * 0.32);
    for (let x = 4; x < C; x += 32) { c.fillStyle = 'rgba(30,20,15,0.6)'; c.fillRect(x, 4, 2, C * 0.28); }
    c.fillStyle = 'rgba(60,45,35,0.8)';
    c.fillRect(0, C * 0.68, C, C * 0.32);
    c.fillStyle = 'rgba(200,200,190,0.6)';
    c.fillRect(C * 0.55, C * 0.56, 18, 14);
  });
  // 4: shop shelves (stores, public buildings)
  cell(4, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, C, C);
    for (let y = C * 0.3; y < C; y += 22) {
      c.fillStyle = 'rgba(40,40,40,0.75)';
      c.fillRect(0, y, C, 4);
      for (let x = 0; x < C; x += 6 + rnd() * 6) {
        const h = 6 + rnd() * 10;
        c.fillStyle = `rgba(${(rnd() * 120) | 0},${(rnd() * 120) | 0},${(rnd() * 120) | 0},0.55)`;
        c.fillRect(x, y - h, 4 + rnd() * 3, h);
      }
    }
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(0, 0, C, 6);
  });
  // 5: shade half drawn
  cell(5, (c) => {
    c.fillStyle = grad(c, [[0, '#fff1d8'], [1, '#a59782']]);
    c.fillRect(0, 0, C, C);
    c.fillStyle = 'rgba(150,120,80,0.92)';
    c.fillRect(0, 0, C, C * 0.42);
    c.fillStyle = 'rgba(60,40,20,0.9)';
    c.fillRect(C * 0.47, C * 0.42, 8, 6);
  });
  // 6: dark room lit by a TV
  cell(6, (c) => {
    c.fillStyle = '#26282c';
    c.fillRect(0, 0, C, C);
    const r = c.createRadialGradient(C * 0.7, C * 0.6, 2, C * 0.7, C * 0.6, C * 0.6);
    r.addColorStop(0, 'rgba(230,240,255,1)');
    r.addColorStop(1, 'rgba(120,140,170,0)');
    c.fillStyle = r;
    c.fillRect(0, 0, C, C);
    c.fillStyle = 'rgba(10,10,12,0.9)';
    c.fillRect(C * 0.1, C * 0.72, C * 0.5, C * 0.28);
  });
  // 7: office — ceiling panel light, plain wall
  cell(7, (c) => {
    c.fillStyle = grad(c, [[0, '#ffffff'], [0.3, '#e8e8e2'], [1, '#9a9a94']]);
    c.fillRect(0, 0, C, C);
    c.fillStyle = 'rgba(70,70,70,0.6)';
    c.fillRect(C * 0.15, C * 0.35, C * 0.25, C * 0.2);
    c.fillStyle = 'rgba(40,40,40,0.7)';
    c.fillRect(0, C * 0.75, C, C * 0.25);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  windowAtlas = t;
  return t;
}

/** UV rectangle [u0, v0, u1, v1] of atlas cell k (0..7). */
export function windowCellUV(k) {
  const col = k % 4, row = Math.floor(k / 4) % 2;
  const inset = 0.004;
  return [col / 4 + inset, 1 - (row + 1) / 2 + inset, (col + 1) / 4 - inset, 1 - row / 2 - inset];
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGlass(kind) {
  const cold = kind === 'glass_cold';
  const dark = kind === 'glass_dark';
  const m = new THREE.MeshStandardMaterial({
    color: cold ? 0x0e1418 : 0x0c1013,
    roughness: 0.1,
    metalness: 0.1,
    emissive: dark ? 0x000000 : cold ? new THREE.Color(0.75, 0.95, 1.0) : new THREE.Color(1.0, 0.66, 0.36),
    emissiveMap: getWindowAtlas(),
    emissiveIntensity: 1,
    vertexColors: true,
    envMapIntensity: 0.9,
  });
  m.name = kind;
  m.userData.dayEmissive = cold ? 0.9 : 0.06;
  m.userData.nightEmissive = cold ? 3.2 : 2.1;
  if (!dark) nightMaterials.add(m);
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', `
        // glass: the vertex colour drives the light behind it, not the glass
        vec2 paneUv = fract(vEmissiveMapUv * vec2(4.0, 2.0));
        float edge = max(abs(paneUv.x - 0.5), abs(paneUv.y - 0.5));
        float frost = smoothstep(0.36, 0.5, edge + (fract(sin(dot(floor(paneUv * 40.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.08);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.62, 0.7), frost * 0.55);
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= vColor.rgb * (1.0 - frost * 0.4);`);
  };
  m.customProgramCacheKey = () => 'glass';
  m.userData.kind = kind;
  return m;
}

function makeNeon(flicker) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  m.name = flicker ? 'neon_flicker' : 'neon';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.time = WU.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vNeonWP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 nwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          nwp = instanceMatrix * nwp;
        #endif
        vNeonWP = (modelMatrix * nwp).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float time;
        varying vec3 vNeonWP;
        float nHash(float n) { return fract(sin(n) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 cellp = floor(vNeonWP * 0.6);
          float seed = nHash(dot(cellp, vec3(12.9898, 78.233, 37.719)));
          float buzz = 0.94 + 0.06 * sin(time * 100.0 + seed * 40.0);
          ${flicker
            ? 'float t = floor(time * 13.0 + seed * 7.0); float drop = step(0.82, nHash(t + seed * 91.0)) * (0.55 + 0.45 * nHash(t * 1.7)); float slow = step(0.6, sin(time * 0.7 + seed * 6.0)) * step(0.5, nHash(floor(time * 4.0) + seed)); diffuseColor.rgb *= buzz * (1.0 - max(drop, slow * 0.85));'
            : 'diffuseColor.rgb *= buzz;'}
        }`);
  };
  m.customProgramCacheKey = () => (flicker ? 'neonF' : 'neon');
  return m;
}

let chainTex = null;
function chainlinkTexture() {
  if (chainTex) return chainTex;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, S / 2); g.lineTo(S / 2, 0); g.lineTo(S, S / 2); g.lineTo(S / 2, S); g.closePath();
  g.stroke();
  chainTex = new THREE.CanvasTexture(cv);
  chainTex.wrapS = chainTex.wrapT = THREE.RepeatWrapping;
  chainTex.anisotropy = 4;
  chainTex.colorSpace = THREE.SRGBColorSpace;
  return chainTex;
}

// ------------------------------------------------------------------ getMaterial

/**
 * Cached shared material. opts: { color, snow, vertexColors, side }.
 * Same name + opts → same instance.
 */
export function getMaterial(name, opts = {}) {
  const key = name + '|' + (opts.color != null ? new THREE.Color(opts.color).getHexString() : '') + '|' + (opts.snow ? 's' : '') + (opts.vertexColors ? 'v' : '') + (opts.side ?? '');
  let m = matCache.get(key);
  if (m) return m;
  if (name === 'glass_warm' || name === 'glass_cold' || name === 'glass_dark' || name === 'glass') {
    m = makeGlass(name === 'glass' ? 'glass_warm' : name);
  } else if (name === 'neon' || name === 'neon_flicker' || name === 'glow') {
    m = makeNeon(name === 'neon_flicker');
  } else if (name === 'solid') {
    m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, vertexColors: true, envMapIntensity: 1.0 });
    m.name = 'solid';
    const snow = !!opts.snow;
    m.onBeforeCompile = (sh) => {
      if (snow) addSnow(sh);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vSolidRM;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSolidRM = uv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vSolidRM;')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSolidRM.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSolidRM.y;');
    };
    m.customProgramCacheKey = () => (snow ? 'solidS' : 'solid');
  } else if (name === 'chainlink') {
    m = new THREE.MeshStandardMaterial({
      map: chainlinkTexture(), color: 0xc8ccce, metalness: 0.6, roughness: 0.45, alphaTest: 0.5,
      alphaToCoverage: true, side: THREE.DoubleSide, vertexColors: !!opts.vertexColors,
    });
    m.name = name;
  } else {
    const d = DEF[name] || DEF.paint;
    const params = {
      color: d.color ?? 0xffffff,
      roughness: d.rough ?? 0.8,
      metalness: d.metal ?? 0,
      vertexColors: !!opts.vertexColors,
    };
    if (d.tex) {
      const info = TEX[d.tex] || {};
      params.map = loadTex(d.tex, 'col');
      params.normalMap = loadTex(d.tex, 'nrm');
      if (!info.noRough) params.roughnessMap = loadTex(d.tex, 'rgh');
      else params.roughness = info.noRough;
      params.normalScale = new THREE.Vector2(d.ns ?? 1, d.ns ?? 1);
    }
    if (d.opacity != null) {
      params.transparent = true;
      params.opacity = d.opacity;
    }
    m = new THREE.MeshStandardMaterial(params);
    m.name = name;
    if (d.bright) m.color.multiplyScalar(d.bright);
    if (opts.color != null) m.color.multiply(new THREE.Color(opts.color));
    if (opts.snow) {
      m.onBeforeCompile = addSnow;
      m.customProgramCacheKey = () => 'snow';
    }
  }
  if (opts.side != null) m.side = opts.side;
  matCache.set(key, m);
  return m;
}

// ------------------------------------------------------------------ signs

const signCache = new Map();

/**
 * Cached canvas sign material.
 * spec: { kind: 'paint'|'lightbox'|'neon', w, h (metres), ppm (px per metre, 128),
 *   draw(ctx, W, H) or lines: [{ text, size (0..1 of H), font, color, y, weight, stroke }],
 *   bg, border, fade (0..1 weathering), glow (neon HDR multiplier), flicker }
 */
export function getSignMaterial(key, spec) {
  if (signCache.has(key)) return signCache.get(key);
  const ppm = spec.ppm || 128;
  const W = Math.max(16, Math.round(spec.w * ppm)), H = Math.max(16, Math.round(spec.h * ppm));
  const cv = document.createElement('canvas');
  cv.width = Math.min(2048, W);
  cv.height = Math.min(1024, H);
  const g = cv.getContext('2d');
  const cw = cv.width, ch = cv.height;
  if (spec.bg) { g.fillStyle = spec.bg; g.fillRect(0, 0, cw, ch); } else g.clearRect(0, 0, cw, ch);
  if (spec.draw) spec.draw(g, cw, ch);
  else drawSignLines(g, cw, ch, spec);
  if (spec.border) {
    g.strokeStyle = spec.border;
    g.lineWidth = Math.max(2, ch * 0.05);
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
  }
  if (spec.fade) weatherCanvas(g, cw, ch, spec.fade, spec.seed || 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  let m;
  if (spec.kind === 'neon') {
    const k = spec.glow ?? 4;
    m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    if (spec.flicker) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.time = WU.time;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float time;\nfloat sHash(float n){return fract(sin(n)*43758.5453);}')
          .replace('#include <color_fragment>', `#include <color_fragment>
            { float t = floor(time * 11.0); float drop = step(${(1 - spec.flicker * 0.35).toFixed(3)}, sHash(t)) * (0.6 + 0.4 * sHash(t * 3.1));
              float zone = step(0.5, fract(vMapUv.x * 1.7 + 0.13)); diffuseColor.rgb *= 1.0 - drop * mix(1.0, 0.25, zone); }`);
      };
      m.customProgramCacheKey = () => 'signflicker' + spec.flicker;
    }
  } else if (spec.kind === 'lightbox') {
    m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(spec.emissive ?? 0xffffff), roughness: 0.35 });
    m.userData.dayEmissive = spec.dayEmissive ?? 0.5;
    m.userData.nightEmissive = spec.nightEmissive ?? 2.0;
    nightMaterials.add(m);
  } else {
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: !!spec.transparent, alphaTest: spec.transparent ? 0.4 : 0 });
  }
  m.name = 'sign:' + key;
  signCache.set(key, m);
  return m;
}

function drawSignLines(g, W, H, spec) {
  for (const L of spec.lines || []) {
    const size = (L.size || 0.5) * H;
    g.font = `${L.weight || 'bold'} ${size}px ${L.font || 'Georgia, "Times New Roman", serif'}`;
    g.textAlign = L.align || 'center';
    g.textBaseline = 'middle';
    const x = L.x != null ? L.x * W : W / 2;
    const y = (L.y ?? 0.5) * H;
    let text = L.text;
    if (L.spacing) {
      // letter spacing by drawing per char
      const chars = [...text];
      const widths = chars.map((c) => g.measureText(c).width + L.spacing * size);
      const total = widths.reduce((a, b) => a + b, 0) - L.spacing * size;
      let cx = L.align === 'left' ? x : x - total / 2;
      g.textAlign = 'left';
      for (let i = 0; i < chars.length; i++) {
        drawText(g, chars[i], cx, y, L, size);
        cx += widths[i];
      }
      continue;
    }
    const maxW = (L.maxW || 0.94) * W;
    const tw = g.measureText(text).width;
    if (tw > maxW) {
      g.save();
      g.translate(x, y);
      g.scale(maxW / tw, 1);
      drawText(g, text, 0, 0, L, size);
      g.restore();
    } else drawText(g, text, x, y, L, size);
  }
}

function drawText(g, text, x, y, L, size) {
  if (L.glowColor) {
    g.shadowColor = L.glowColor;
    g.shadowBlur = size * (L.glowBlur || 0.35);
  }
  if (L.stroke) {
    g.strokeStyle = L.stroke;
    g.lineWidth = size * (L.strokeW || 0.08);
    g.lineJoin = 'round';
    g.strokeText(text, x, y);
  }
  g.fillStyle = L.color || '#fff';
  g.fillText(text, x, y);
  if (L.glowColor) {
    g.shadowBlur = 0;
    g.fillText(text, x, y);
  }
}

/** Sun-bleach, peel and stain a painted sign. */
function weatherCanvas(g, W, H, k, seed) {
  const r = mulberry(seed * 977 + 13);
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(190,180,160,${0.35 * k})`;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260 * k; i++) {
    g.fillStyle = r() < 0.6 ? `rgba(120,105,85,${0.5 * k})` : `rgba(220,210,190,${0.5 * k})`;
    const s = 2 + r() * W * 0.02;
    g.fillRect(r() * W, r() * H, s * (1 + r() * 3), s);
  }
  // rust/water streaks
  for (let i = 0; i < 18 * k; i++) {
    const x = r() * W;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgba(90,60,40,${0.35 * k})`);
    gr.addColorStop(1, 'rgba(90,60,40,0)');
    g.fillStyle = gr;
    g.fillRect(x, 0, 2 + r() * 5, H * (0.3 + r() * 0.7));
  }
  g.restore();
}
