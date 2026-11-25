import * as THREE from 'three';
import { getTex } from './textures.js';
import { makePaintable } from './paint.js';

export function levelMaterials(paint) {
  const make = (tex, texOpts, mopts, uvScale, popts = {}) => {
    const t = getTex(tex, texOpts);
    const mat = new THREE.MeshStandardMaterial({
      map: t.map, normalMap: t.normalMap || null, vertexColors: true,
      roughness: mopts.roughness ?? 0.8, metalness: mopts.metalness ?? 0,
      emissiveMap: t.emissiveMap || null, emissive: t.emissiveMap ? new THREE.Color(mopts.emissive ?? 0x000000) : new THREE.Color(0),
      envMapIntensity: mopts.env ?? 0.6,
    });
    if (t.normalMap) mat.normalScale.set(mopts.normal ?? 0.8, mopts.normal ?? 0.8);
    makePaintable(mat, paint, popts);
    return { material: mat, uvScale };
  };
  return {
    floor: make('pavers', {}, { roughness: 0.82, normal: 0.7 }, 4),
    concrete: make('concrete', { seams: 2 }, { roughness: 0.78, normal: 0.6 }, 4),
    concreteDark: make('concrete', { seams: 1, base: [150, 156, 168], seed: 9 }, { roughness: 0.75, normal: 0.6 }, 3),
    grate: make('grate', {}, { roughness: 0.45, metalness: 0.55, normal: 0.8, env: 0.8 }, 2, { bevel: 0.25 }),
    container: make('corrugated', {}, { roughness: 0.5, metalness: 0.35, normal: 1 }, 2.6, { bevel: 0.3 }),
    wood: make('wood', {}, { roughness: 0.78 }, 1.2, { bevel: 0.2 }),
    hazard: make('hazard', {}, { roughness: 0.55, metalness: 0.2 }, 1),
    tiles: make('plazaTiles', {}, { roughness: 0.7, normal: 0.6 }, 6),
    facade: make('facade', { seed: 1 }, { roughness: 0.7, emissive: 0xffffff, normal: 0.6 }, 6, { bevel: 0.1, ao: 0.9 }),
    facade2: make('facade', { seed: 4 }, { roughness: 0.7, emissive: 0xffffff, normal: 0.6 }, 5, { bevel: 0.1, ao: 0.9 }),
    grass: make('grass', {}, { roughness: 0.95 }, 3, { bevel: 0 }),
    plain: make('plain', {}, { roughness: 0.55 }, 2),
  };
}
