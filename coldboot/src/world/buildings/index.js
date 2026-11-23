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

const GEN = {
  house, church, generalStore,
};

/** Register a generator (used by the per-type modules below). */
export function registerBuilding(type, fn) { GEN[type] = fn; }

export const BUILDING_KINDS = Object.keys(GEN);

export function buildBuilding(type, opts = {}) {
  const gen = GEN[type];
  if (!gen) throw new Error(`buildBuilding: unknown type "${type}"`);
  return gen(opts);
}
