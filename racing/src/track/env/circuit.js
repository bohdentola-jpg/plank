// TEMP smoke test env (replaced by the real circuit env).
import * as THREE from 'three';
import { extrudeAlong, glowMaterial, stripMesh } from '../build.js';
import { groundTexture, concreteTexture } from '../textures.js';
import { makeNoise2D } from '../../core/util.js';

export function natural(def) {
  const n = makeNoise2D(7);
  return (x, z) => n.fbm(x * 0.002, z * 0.002, 4) * 40 + 5;
}

export async function build(world, def, track, progress) {
  const tex = groundTexture('grass');
  tex.repeat.set(1, 1);
  const tm = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.95 });
  // world-space UVs: terrain plane UVs span the whole grid; repeat the texture a lot
  tex.repeat.set(120, 120);
  world.add(world.terrain.mesh(tm, { flat: '#5b7a3a', steep: '#6d6253' }));
  const barrier = extrudeAlong(track, 1, (i) => track.WL[i], [[0, 0], [0.05, 0.1], [0.12, 0.35], [0.15, 0.81], [0.45, 0.81], [0.48, 0.35], [0.55, 0.1], [0.6, 0]], new THREE.MeshStandardMaterial({ map: concreteTexture('#9a9890', 'jb'), roughness: 0.8 }), { uLen: 3 });
  world.add(barrier);
  const barrierR = extrudeAlong(track, -1, (i) => track.WR[i], [[0, 0], [0.05, 0.1], [0.12, 0.35], [0.15, 0.81], [0.45, 0.81], [0.48, 0.35], [0.55, 0.1], [0.6, 0]], new THREE.MeshStandardMaterial({ map: concreteTexture('#9a9890', 'jb'), roughness: 0.8 }), { uLen: 3 });
  world.add(barrierR);
  progress(1, 'ok');
}
export default { natural, build };
