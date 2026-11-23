// Building kit entry point.
//
//   buildBuilding(type, { seed, state (0 run-down … 1 restored), name, interior, variant, ...style })
//   → { group, footprint: {w, d}, doors: [{id, x, z, rot, w, leadsTo}], colliders: [{x, z, w, d, rot, h}],
//       points: {name: {x, y, z, rot}}, interior: THREE.Group|null, lights: [{x,y,z,color,intensity,distance}],
//       cameras: [{x,y,z,yaw,pitch,fov,range}], floors: [{x, z, w, d, rot, y}], ramps: [{x, z, w, d, rot, y0, y1}] }
//
// rot is a yaw (radians about +Y; local +Z → (sin rot, 0, cos rot)). Colliders are
// boxes from the ground up to h. floors are walkable tops at height y (porches,
// interior floors, platforms, decks); ramps are steps/stairs rising along their
// local +Z from y0 to y1.
//
// Everything is in the building's local frame: origin at the footprint centre on
// the ground, front door facing +Z, metres. Exterior meshes are merged per
// material (one draw call each); the interior (when asked for) is a separate group.
import { build as house } from './house.js';
import { build as church } from './church.js';
import { build as generalStore } from './generalStore.js';
import { build as cornerStore } from './cornerStore.js';
import { build as cabin } from './cabin.js';
import { build as postOffice } from './postOffice.js';
import { build as clinic } from './clinic.js';
import { build as police } from './police.js';
import { build as communityHall } from './communityHall.js';
import { build as cityHall } from './cityHall.js';
import { build as school } from './school.js';
import { build as radioStation } from './radioStation.js';
import { build as diner } from './diner.js';
import { build as bar } from './bar.js';
import { build as terminal } from './terminal.js';
import { build as hangar } from './hangar.js';
import { build as hardware } from './hardware.js';
import { build as fuelTanks } from './fuelTanks.js';
import { build as cannery } from './cannery.js';
import { build as harbor } from './harbor.js';
import { build as dome } from './dome.js';
import { build as lighthouse } from './lighthouse.js';
import { build as cemetery } from './cemetery.js';

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GEN = {
  house, church, generalStore, cornerStore, cabin, postOffice, clinic, police, communityHall, cityHall, school, radioStation,
  diner, bar, terminal, hangar, hardware, fuelTanks, cannery, harbor, dome, lighthouse, cemetery,
};

/** Register a generator (used by the per-type modules below). */
export function registerBuilding(type, fn) { GEN[type] = fn; }

export const BUILDING_KINDS = Object.keys(GEN);

export function buildBuilding(type, opts = {}) {
  const gen = GEN[type];
  if (!gen) throw new Error(`buildBuilding: unknown type "${type}"`);
  return gen(opts);
}

/**
 * Optional static batching for the whole town: merge the exterior meshes of many
 * placed buildings per material and per spatial chunk (so frustum culling still
 * works), e.g. 80 buildings × ~10 draw calls → a few dozen draw calls.
 *   items: [{ group: result.group, matrix?: THREE.Matrix4 (defaults to group.matrixWorld) }]
 *   o.chunk: chunk size in metres (default 120)
 * Animated parts (door leaves, the lighthouse beam) are left out and should stay
 * in the original groups (see group.userData / mesh.userData.door).
 * Returns a THREE.Group; each mesh keeps the shared material.
 */
export function batchExteriors(items, o = {}) {
  const chunk = o.chunk ?? 120;
  const bins = new Map(); // chunkKey|material.uuid → {mat, geos: [], cast, receive}
  const tmp = new THREE.Vector3();
  for (const it of items) {
    const root = it.group;
    root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isMesh || m.userData.door || m.name === 'beam' || !m.geometry.index) return;
      const M = it.matrix ? new THREE.Matrix4().multiplyMatrices(it.matrix, m.matrixWorld) : m.matrixWorld;
      m.geometry.computeBoundingSphere();
      tmp.copy(m.geometry.boundingSphere.center).applyMatrix4(M);
      const key = Math.floor(tmp.x / chunk) + ',' + Math.floor(tmp.z / chunk) + '|' + m.material.uuid;
      let bin = bins.get(key);
      if (!bin) bins.set(key, (bin = { mat: m.material, geos: [], cast: m.castShadow, receive: m.receiveShadow }));
      const g = m.geometry.clone();
      g.applyMatrix4(M);
      bin.geos.push(g);
    });
  }
  const out = new THREE.Group();
  out.name = 'buildingsBatched';
  for (const bin of bins.values()) {
    const g = mergeGeometries(bin.geos, false);
    for (const x of bin.geos) x.dispose();
    if (!g) continue;
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, bin.mat);
    mesh.castShadow = bin.cast;
    mesh.receiveShadow = bin.receive;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  return out;
}
