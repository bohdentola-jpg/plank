// Shared world state that materials read (time of day, weather), so every
// window, sign and lamp responds without walking the scene graph.
import * as THREE from 'three';

export const WU = {
  night: { value: 1 },     // 0 = noon … 1 = deep night (drives window/sign glow)
  time: { value: 0 },      // seconds, for flicker/animated shaders
  snowCover: { value: 1 }, // 0..1 fresh snow on up-facing surfaces
  wind: { value: new THREE.Vector2(1, 0.3) },
};

// Materials whose emissive brightness should follow night (windows, signs):
// register with nightMaterials.add(mat); the world scales mat.emissiveIntensity
// between mat.userData.dayEmissive (default 0.15) and mat.userData.nightEmissive.
export const nightMaterials = new Set();

export function updateNightMaterials() {
  const k = WU.night.value;
  for (const m of nightMaterials) {
    const d = m.userData.dayEmissive ?? 0.15;
    const n = m.userData.nightEmissive ?? 1.0;
    m.emissiveIntensity = d + (n - d) * k;
  }
}
