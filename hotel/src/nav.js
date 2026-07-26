// Where everything physically is, and how you walk from one thing to another.
// The simulation and the 3D scene both read this file, so a bed is in the same
// place for the pathfinder as it is for the renderer. Pure math — no THREE here.
import { SLOTS_PER_FLOOR, STAIR_SPEED, ELEVATOR_SPEED } from './data.js';

export const ROOM_W = 4.4;
export const FLOOR_H = 3.4;
export const WIDTH = SLOTS_PER_FLOOR * ROOM_W;      // 26.4
export const HALF_W = WIDTH / 2;

export const ROOM_BACK = -4.8;      // rear wall of a guest room
export const ROOM_FRONT = 0.3;      // where the room ends and the walkway starts
export const LANE_Z = 1.5;          // centre line of the balcony walkway / lobby aisle
export const RAIL_Z = 2.7;          // outer edge of the walkway
export const LOBBY_BACK = -5.2;

export const STAIR_X = HALF_W + 1.9;
export const ELEV_X = -HALF_W - 1.9;
export const DOOR_X = 6.2;          // the front doors, on the ground floor
export const DESK_X = -6.4;
export const DESK_Z = -2.4;
export const LAUNDRY_X = 10.4;
export const LAUNDRY_Z = -3.6;
export const POOL_X = 22.5;

export function floorY(f) { return f * FLOOR_H; }
export function floorOf(y) { return Math.max(0, Math.round(y / FLOOR_H)); }
export function slotX(slot) { return -HALF_W + slot * ROOM_W + ROOM_W / 2; }

// The lobby aisle sits a little deeper than the balcony walkways above it.
export function laneZ(floor) { return floor === 0 ? 0.6 : LANE_Z; }

export function hasElevator(state) { return !!state.amenities.elevator; }
export function vertX(state) { return hasElevator(state) ? ELEV_X : STAIR_X; }
export function vertSpeed(state) { return hasElevator(state) ? ELEVATOR_SPEED : STAIR_SPEED; }

// ------------------------------------------------------------------ anchors
export function roomDoor(room) {
  return { x: slotX(room.slot), y: floorY(room.floor), z: ROOM_FRONT + 0.9, floor: room.floor };
}
export function roomInside(room) {
  return { x: slotX(room.slot) + 0.9, y: floorY(room.floor), z: -2.1, floor: room.floor };
}
export function roomBed(room) {
  return { x: slotX(room.slot) - 1.0, y: floorY(room.floor) + 0.62, z: -2.9, floor: room.floor };
}
export function roomChair(room) {
  return { x: slotX(room.slot) + 1.4, y: floorY(room.floor), z: -1.2, floor: room.floor };
}
export function deskStaff() { return { x: DESK_X, y: 0, z: DESK_Z - 1.1, floor: 0 }; }
export function deskFront() { return { x: DESK_X, y: 0, z: DESK_Z + 1.5, floor: 0 }; }
export function queueSpot(i) { return { x: DESK_X + 1.5 + i * 1.25, y: 0, z: DESK_Z + 1.6 + (i % 2) * 0.35, floor: 0 }; }
export function laundrySpot() { return { x: LAUNDRY_X, y: 0, z: LAUNDRY_Z + 1.2, floor: 0 }; }
export function entrance() { return { x: DOOR_X, y: 0, z: 2.2, floor: 0 }; }
export function street(i = 0) { return { x: DOOR_X + 3.2 + (i % 5) * 2.1, y: 0, z: 15 + (i % 3) * 1.4, floor: 0 }; }
export function lobbySeat(i) {
  const row = i % 4;
  return { x: 1.2 + row * 1.6, y: 0, z: -3.2 - Math.floor(i / 4) * 1.6, floor: 0 };
}
export function poolSpot(i) {
  return { x: POOL_X - 2.4 + (i % 3) * 2.2, y: 0, z: -1.4 + Math.floor(i / 3) * 2.4, floor: 0 };
}

// ------------------------------------------------------------------ paths
// A path is a list of waypoints; segments flagged `vert` are taken at stair or
// elevator speed instead of a walking pace.
export function pathTo(state, from, to) {
  const f0 = floorOf(from.y);
  const f1 = to.floor ?? floorOf(to.y);
  const pts = [];
  const lane0 = laneZ(f0);
  const lane1 = laneZ(f1);

  if (Math.abs(from.z - lane0) > 0.12) pts.push({ x: from.x, y: from.y, z: lane0 });

  if (f0 !== f1) {
    const vx = vertX(state);
    pts.push({ x: vx, y: from.y, z: lane0 });
    pts.push({ x: vx, y: floorY(f1), z: lane1, vert: true });
    pts.push({ x: to.x, y: floorY(f1), z: lane1 });
  } else {
    pts.push({ x: to.x, y: from.y, z: lane0 });
  }

  pts.push({ x: to.x, y: floorY(f1), z: to.z });
  if (to.y > floorY(f1) + 0.05) pts.push({ x: to.x, y: to.y, z: to.z });
  return pts;
}

export function dist3(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// How long, in seconds, a walk would take — used to pick the nearest worker.
export function travelSecs(state, from, to, speed) {
  const pts = pathTo(state, from, to);
  let t = 0;
  let cur = from;
  for (const p of pts) {
    const d = dist3(cur, p);
    t += d / (p.vert ? vertSpeed(state) : speed);
    cur = p;
  }
  return t;
}

// Advance an actor with { x, y, z, path } along its path. Returns true on arrival.
export function advance(state, actor, speed, dt) {
  let budget = dt;
  let guard = 0;
  while (actor.path && actor.path.length && budget > 0 && guard++ < 64) {
    const p = actor.path[0];
    const spd = p.vert ? vertSpeed(state) : speed;
    const dx = p.x - actor.x, dy = p.y - actor.y, dz = p.z - actor.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-4) { actor.path.shift(); continue; }
    const step = spd * budget;
    if (step >= d) {
      actor.x = p.x; actor.y = p.y; actor.z = p.z;
      budget -= d / spd;
      actor.path.shift();
    } else {
      const k = step / d;
      actor.x += dx * k; actor.y += dy * k; actor.z += dz * k;
      actor.heading = Math.atan2(dx, dz);
      budget = 0;
    }
  }
  return !actor.path || actor.path.length === 0;
}

export function goTo(state, actor, target) {
  actor.path = pathTo(state, actor, target);
  actor.target = { x: target.x, y: target.y, z: target.z };
}
