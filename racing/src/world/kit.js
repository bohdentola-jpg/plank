// PORT HALCYON — the shared art kit: one material per kind of surface for
// the whole world (so streaming a cell never compiles a shader), the shared
// uniforms that carry the time of day (lamp glow on the ground and lit
// windows follow `night`), and the few textures the core needs that the
// track builders didn't have (cobbles, planks, a ground detail map).
import * as THREE from 'three';
import { roadTextures, concreteTexture, groundTexture, glowTexture, toTex } from '../track/textures.js';
import { makeRng } from '../core/util.js';

/** Uniforms shared by every world material (updated once a frame). */
export const U = {
  night: { value: 1 },      // 0 broad day … 1 night: baked lamp glow, lit windows
  time: { value: 0 },
};

const mats = new Map();
const once = (key, fn) => {
  if (!mats.has(key)) mats.set(key, fn());
  return mats.get(key);
};

/** Materials whose emissive follows the night (lit windows, signs): [mat, base intensity]. */
export const NIGHT_EMISSIVE = [];
export function nightEmissive(mat, base = 1) {
  NIGHT_EMISSIVE.push([mat, base]);
  mat.emissiveIntensity = base * U.night.value;
  return mat;
}
/** Per frame: follow the night. */
export function updateKit(night, time) {
  U.night.value = night;
  U.time.value = time;
  for (const [m, b] of NIGHT_EMISSIVE) m.emissiveIntensity = b * night;
}

/**
 * Standard material that adds the baked lamp light (a 'glow' vertex
 * attribute, summed from nearby lamps when the cell is built) as emissive
 * light × albedo, scaled by the night.
 */
export function glowMat(params, strength = 3.2) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 glow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * diffuseColor.rgb * ${strength.toFixed(2)} * uNight;`);
  };
  m.customProgramCacheKey = () => 'world-glow' + strength.toFixed(2) + (params.vertexColors ? 'vc' : '') + (params.map ? 'm' : '');
  return m;
}

// ------------------------------------------------------------------ textures

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Cobblestones (Old Town): rounded setts in courses, dark joints. */
export function cobbleTexture() {
  return once('tex:cobble', () => {
    const S = 512, c = cnv(S, S), x = c.getContext('2d');
    const rng = makeRng('cobble');
    x.fillStyle = '#2a2724';
    x.fillRect(0, 0, S, S);
    const rowH = 22;
    for (let y = 0, row = 0; y < S; y += rowH, row++) {
      let px = row % 2 ? -12 : 0;
      while (px < S) {
        const w = 18 + rng() * 14;
        const t = 70 + rng() * 45;
        x.fillStyle = `rgb(${t + 8},${t + 2},${t - 6})`;
        const r = 5;
        x.beginPath();
        x.roundRect ? x.roundRect(px + 1.5, y + 1.5, w - 3, rowH - 3, r) : x.rect(px + 1.5, y + 1.5, w - 3, rowH - 3);
        x.fill();
        // a highlight on the crown of each stone
        x.fillStyle = 'rgba(255,255,255,0.07)';
        x.fillRect(px + 4, y + 4, w - 10, 4);
        px += w;
      }
    }
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = `rgba(0,0,0,${rng() * 0.18})`;
      x.fillRect(rng() * S, rng() * S, 1.5, 1.5);
    }
    return toTex(c);
  });
}

/** Weathered boardwalk planks. */
export function plankTexture() {
  return once('tex:planks', () => {
    const W = 256, H = 512, c = cnv(W, H), x = c.getContext('2d');
    const rng = makeRng('planks');
    const pw = 16;
    for (let px = 0; px < W; px += pw) {
      const t = 120 + rng() * 40;
      x.fillStyle = `rgb(${t},${t * 0.78},${t * 0.58})`;
      x.fillRect(px, 0, pw - 1.5, H);
      for (let k = 0; k < 30; k++) {
        x.fillStyle = `rgba(60,40,25,${rng() * 0.25})`;
        x.fillRect(px + rng() * pw, rng() * H, 1, 10 + rng() * 60);
      }
      // butt joints
      let y = rng() * 200;
      while (y < H) { x.fillStyle = 'rgba(20,14,8,0.8)'; x.fillRect(px, y, pw - 1.5, 2); y += 120 + rng() * 200; }
    }
    x.fillStyle = 'rgba(15,10,6,1)';
    for (let px = pw - 1.5; px < W; px += pw) x.fillRect(px, 0, 1.5, H);
    return toTex(c);
  });
}

/** Grey detail for the terrain (the colour comes from the vertices). */
export function detailTexture() {
  return once('tex:detail', () => {
    const S = 256, c = cnv(S, S), x = c.getContext('2d');
    const rng = makeRng('detail');
    x.fillStyle = '#b8b8b8';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      const v = 120 + rng() * 135;
      x.fillStyle = `rgba(${v},${v},${v},${0.25 + rng() * 0.4})`;
      const r = 1 + rng() * 2.5;
      x.fillRect(rng() * S, rng() * S, r, r * (0.6 + rng()));
    }
    for (let i = 0; i < 40; i++) {
      const px = rng() * S, py = rng() * S, r = 10 + rng() * 40;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},0.08)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    return toTex(c);
  });
}

// ------------------------------------------------------------------ materials

/** The ground everywhere (vertex coloured, lamp glow, world-space detail). */
export const terrainMat = () => once('mat:terrain', () => glowMat({ vertexColors: true, map: detailTexture(), roughness: 0.95, metalness: 0, envMapIntensity: 0.35 }, 2.4));

/** Carriageway material for a road type. */
export function roadMat(rt, wet = false) {
  const p = rt.paint;
  const key = `mat:road:${rt.id}:${wet}`;
  return once(key, () => {
    let map, rough = null, rep = 12;
    if (p.base === 'cobble') { map = cobbleTexture(); rep = 6; }
    else if (p.base === 'wood') { map = plankTexture(); rep = 8; }
    else if (p.base === 'dirt' || p.base === 'gravel') { map = groundTexture(p.base); rep = 6; }
    else {
      const t = roadTextures(Math.max(4, Math.round(rt.hw * 2)), { lanes: p.lanes || 2, center: p.center, edge: p.edge, base: p.base, worn: 0.35, wet });
      map = t.map; rough = t.rough; rep = t.repeat;
    }
    const m = glowMat({
      map, roughnessMap: rough, roughness: rough ? 1 : 0.9, metalness: 0,
      envMapIntensity: wet ? 1.5 : 0.45,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    }, 3.2);
    m.userData.vLen = rep;
    m.userData.uFull = !(p.base === 'cobble' || p.base === 'wood' || p.base === 'dirt' || p.base === 'gravel');
    return m;
  });
}

/** Junction paving (plain asphalt, no lane paint). */
export const junctionMat = (wet = false) => once(`mat:junction:${wet}`, () => {
  const t = roadTextures(16, { lanes: 0, center: 'none', edge: 'none', worn: 0.35, wet });
  const m = glowMat({ map: t.map, roughnessMap: t.rough, roughness: 1, envMapIntensity: wet ? 1.5 : 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }, 3.2);
  return m;
});
export const cobbleJunctionMat = () => once('mat:junction:cobble', () => glowMat({ map: cobbleTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }, 3.2));
export const sidewalkMat = () => once('mat:walk', () => glowMat({ map: concreteTexture('#7a7974', 'walk'), roughness: 0.85, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, 2.8));
export const curbMat = () => once('mat:curb', () => glowMat({ color: 0x8e8d88, roughness: 0.8 }, 2.4));
export const medianMat = () => once('mat:median', () => glowMat({ map: groundTexture('grass'), roughness: 0.95 }, 2.2));
export const shoulderMat = (kind) => once(`mat:shoulder:${kind}`, () => glowMat({ map: groundTexture(kind === 'gravel' ? 'gravel' : kind === 'sand' ? 'sand' : kind === 'dirt' ? 'dirt' : 'asphaltlot'), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, 2.4));
export const concreteMat = () => once('mat:concrete', () => new THREE.MeshStandardMaterial({ map: concreteTexture('#8d8c88', 'bridge'), roughness: 0.85, envMapIntensity: 0.4 }));
export const darkConcreteMat = () => once('mat:concrete2', () => new THREE.MeshStandardMaterial({ map: concreteTexture('#6c6b67', 'pier'), roughness: 0.9, envMapIntensity: 0.3 }));
export const steelMat = () => once('mat:steel', () => new THREE.MeshStandardMaterial({ color: 0xa8adb2, roughness: 0.35, metalness: 0.85, envMapIntensity: 0.9 }));
export const poleMat = () => once('mat:pole', () => new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.6 }));
export const stoneMat = () => once('mat:stone', () => new THREE.MeshStandardMaterial({ map: concreteTexture('#8a7f70', 'stone'), roughness: 0.9 }));
export const woodMat = () => once('mat:wood', () => new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.85 }));

/** Lamp heads: bright unlit (bloom does the rest). */
export const lampMat = (hex = '#ffd8a0') => once(`mat:lamp:${hex}`, () => {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(4) });
  return m;
});

/** Soft halo sprites round lamps at night (additive, fades by day). */
export const haloMat = () => once('mat:halo', () => {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: glowTexture() }, uNight: U.night },
    vertexShader: `
      attribute vec3 icol; attribute float isz; varying vec2 vUv; varying vec3 vCol;
      void main(){
        vUv = uv; vCol = icol;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * isz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uNight; varying vec2 vUv; varying vec3 vCol;
      void main(){ float a = texture2D(map, vUv).a; gl_FragColor = vec4(vCol * a * uNight * 0.55, 1.0); }`,
  });
  return m;
});

/** Every shared material (for compiling them all up front). */
export function allMaterials() {
  return [...mats.values()].filter((m) => m && m.isMaterial);
}
