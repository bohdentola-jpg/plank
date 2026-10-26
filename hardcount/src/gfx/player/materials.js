// Materials. The body uses one MeshStandardMaterial per player (its uniform
// atlas) with a shared roughness map and a shared dirt mask: setDirt() just
// moves a uniform, the stains grow through the game without repainting.
// Helmets get one MeshPhysicalMaterial per team (clearcoat finishes), visors
// one per tint, the ball its own.
import * as THREE from 'three';
import { roughnessTexture, dirtTexture } from './atlas.js';

export function makeBodyMaterial(map) {
  const m = new THREE.MeshStandardMaterial({
    map, roughness: 1, roughnessMap: roughnessTexture(), metalness: 0, envMapIntensity: 0.6,
  });
  const uDirt = { value: 0 };
  m.userData.dirt = uDirt;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDirt = uDirt;
    sh.uniforms.dirtMap = { value: dirtTexture() };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDirt;\nuniform sampler2D dirtMap;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 hcDm = texture2D(dirtMap, vMapUv).rgb;
  float hcGrass = smoothstep(hcDm.b - 0.12, hcDm.b + 0.06, uDirt * hcDm.r * 1.25);
  float hcMud = smoothstep(hcDm.b - 0.12, hcDm.b + 0.06, (uDirt * 1.25 - 0.2) * hcDm.g * 1.3);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.15, 0.035) * (0.55 + 0.7 * hcDm.b), hcGrass * 0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.075, 0.04) * (0.6 + 0.6 * hcDm.b), hcMud * 0.85);
  float hcDirtRough = max(hcGrass, hcMud);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.97, hcDirtRough);');
  };
  m.customProgramCacheKey = () => 'hc-body-v1';
  return m;
}

// ---------------------------------------------------------------- helmets

const FINISH = {
  gloss: { rough: 0.32, clear: 1.0, clearRough: 0.05, metal: 0.0, irid: 0 },
  matte: { rough: 0.72, clear: 0.0, clearRough: 0.6, metal: 0.0, irid: 0 },
  pearl: { rough: 0.3, clear: 1.0, clearRough: 0.06, metal: 0.35, irid: 0.35 },
  chrome: { rough: 0.16, clear: 1.0, clearRough: 0.04, metal: 1.0, irid: 0 },
};
export const finishOf = (name) => FINISH[name] || FINISH.gloss;

const helmetMats = new Map();

/** One physical material per team (+ finish). map/orm come from helmet.js. */
export function teamHelmetMaterial(key, map, orm, finishName, lod = 'high') {
  const k = `${key}|${finishName}|${lod}`;
  if (helmetMats.has(k)) return helmetMats.get(k);
  const f = finishOf(finishName);
  let m;
  if (lod === 'low') {
    m = new THREE.MeshStandardMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, envMapIntensity: 1.0 });
  } else {
    m = new THREE.MeshPhysicalMaterial({
      map, roughnessMap: orm, metalnessMap: orm, clearcoatMap: orm,
      roughness: 1, metalness: 1, clearcoat: f.clear > 0 ? 1 : 0, clearcoatRoughness: f.clearRough,
      envMapIntensity: 1.25,
    });
    if (f.irid) { m.iridescence = f.irid; m.iridescenceIOR = 1.45; m.iridescenceThicknessRange = [250, 520]; }
  }
  m.userData.shared = true;
  helmetMats.set(k, m);
  return m;
}

const visorMats = new Map();
export function visorMaterial(tint) {
  if (visorMats.has(tint)) return visorMats.get(tint);
  const P = {
    clear: { color: '#dfe8f0', opacity: 0.16, metalness: 0.0, roughness: 0.04, irid: 0 },
    smoke: { color: '#15181c', opacity: 0.8, metalness: 0.3, roughness: 0.06, irid: 0 },
    gold: { color: '#ffb640', opacity: 0.88, metalness: 0.9, roughness: 0.1, irid: 0.8 },
    mirror: { color: '#9ec6ff', opacity: 0.92, metalness: 1.0, roughness: 0.05, irid: 0.6 },
  }[tint] || { color: '#dfe8f0', opacity: 0.16, metalness: 0, roughness: 0.05, irid: 0 };
  const m = new THREE.MeshPhysicalMaterial({
    color: P.color, transparent: true, opacity: P.opacity, metalness: P.metalness, roughness: P.roughness,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide,
  });
  if (P.irid) { m.iridescence = P.irid; m.iridescenceIOR = 1.6; }
  m.userData.shared = true;
  visorMats.set(tint, m);
  return m;
}
