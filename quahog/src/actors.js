// Everything in town that moves on its own: the crowd on the pavement, the
// traffic on the grid, the named faces standing where the clock says they
// should be, and the QPD when you have earned them.
import * as THREE from 'three';
import { HALF, whereIs } from './city.js';
import { roadGraph, nearestRoad, edgesNear } from './roads.js';
import {
  CHARACTERS, SUPPORTING, buildCharacter, buildSimplePed, poseRig, talk, randomPedSpec,
} from './cast.js';
import { buildVehicle, Vehicle, VEHICLES, randomTrafficDef } from './vehicles.js';
import { toon, flat } from './toon.js';

const WALK_OFF = 3.8;                  // pavement, measured out from the kerb
const LANE = 0.26;                     // traffic keeps right by this much of the width

/** Position and heading a fraction along an edge, offset sideways. */
function onEdge(e, t, off) {
  const x = e.a.x + (e.b.x - e.a.x) * t;
  const z = e.a.z + (e.b.z - e.a.z) * t;
  const dir = Math.atan2(e.b.x - e.a.x, e.b.z - e.a.z);
  return { x: x + Math.cos(dir) * off, z: z - Math.sin(dir) * off, dir };
}

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ------------------------------------------------------------------ crowd
export class Crowd {
  constructor(scene, city, max = 30) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
    this.max = max;
    this.t = 0;
    this.graph = roadGraph();
    for (let i = 0; i < max; i++) this.peds.push(this.make());
  }

  make() {
    const rig = buildSimplePed(randomPedSpec());
    rig.group.visible = false;
    this.scene.add(rig.group);
    return {
      rig, state: 'walk', edge: null, t: 0, dir: 1, side: 1,
      x: 0, z: 0, yaw: 0, speed: rnd(1.5, 2.6), timer: 0, vx: 0, vz: 0, active: false,
      chatter: 0,
    };
  }

  /** Drop a pedestrian on a pavement in a ring around the player. */
  respawn(p, px, pz) {
    // a third of them loiter outside a landmark instead, in knots, so the
    // town has clusters of people and not just a conveyor of walkers
    if (Math.random() < 0.34) {
      const near = this.city.landmarks.filter((l) => {
        const d = Math.hypot(l.x - px, l.z - pz);
        return d > 16 && d < 90;
      });
      if (near.length) {
        const l = near[(Math.random() * near.length) | 0];
        const a = Math.random() * Math.PI * 2;
        const r = 7 + Math.random() * 9;
        const x = l.x + Math.cos(a) * r, z = l.z + Math.sin(a) * r;
        if (!this.city.colliders.resolve(x, z, 1.2).hit) {
          p.x = x; p.z = z;
          p.state = 'idle';
          p.timer = 8 + Math.random() * 20;
          p.yaw = Math.random() * Math.PI * 2;
          p.active = true;
          p.edge = null;
          p.rig.group.visible = true;
          p.rig.group.position.set(p.x, 0, p.z);
          return true;
        }
      }
    }
    const options = edgesNear(px, pz, 20, 100);
    if (!options.length) return false;
    for (let tries = 0; tries < 12; tries++) {
      const e = options[(Math.random() * options.length) | 0];
      const t = Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      const pos = onEdge(e, t, side * (e.w / 2 + WALK_OFF));
      const d = Math.hypot(pos.x - px, pos.z - pz);
      if (d < 18) continue;
      if (this.city.colliders.resolve(pos.x, pos.z, 0.8).hit) continue;
      p.edge = e; p.t = t; p.side = side;
      p.dir = Math.random() < 0.5 ? -1 : 1;
      p.x = pos.x; p.z = pos.z;
      p.state = Math.random() < 0.16 ? 'idle' : 'walk';
      p.timer = rnd(2, 7);
      p.speed = rnd(1.4, 2.7);
      p.active = true;
      p.rig.group.visible = true;
      p.rig.group.position.set(p.x, 0, p.z);
      return true;
    }
    return false;
  }

  knock(p, dirX, dirZ, force = 1) {
    if (p.state === 'down') return false;
    p.state = 'down';
    p.timer = 3.2 + Math.random() * 1.6;
    p.vx = dirX * 7 * force;
    p.vz = dirZ * 7 * force;
    p.vy = 5 * force;
    p.spin = rnd(-9, 9);
    return true;
  }

  /** At a junction, pick the next street. Prefer not to turn straight back. */
  hop(p, node) {
    const links = node.links.filter((l) => l.edge !== p.edge);
    const pick2 = links.length ? links[(Math.random() * links.length) | 0] : node.links[0];
    if (!pick2) { p.active = false; p.rig.group.visible = false; return; }
    p.edge = pick2.edge;
    if (p.edge.a === node) { p.t = 0.01; p.dir = 1; }
    else { p.t = 0.99; p.dir = -1; }
    if (Math.random() < 0.5) p.side *= -1;
  }

  update(dt, player, threats) {
    this.t += dt;
    const px = player.x, pz = player.z;
    for (const p of this.peds) {
      if (!p.active) { if (Math.random() < 0.5) this.respawn(p, px, pz); continue; }
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d > 150) { p.active = false; p.rig.group.visible = false; continue; }

      if (p.state === 'down') {
        p.timer -= dt;
        p.x += p.vx * dt; p.z += p.vz * dt;
        p.vx *= 0.92; p.vz *= 0.92;
        p.vy = (p.vy || 0) - 20 * dt;
        const y = Math.max(0, (p.rig.group.position.y || 0) + p.vy * dt);
        p.rig.group.position.set(p.x, y, p.z);
        p.rig.group.rotation.z = (p.rig.group.rotation.z || 0) + (p.spin || 0) * dt * (y > 0.1 ? 1 : 0);
        poseRig(p.rig, 'fall', this.t, { dt });
        if (p.timer <= 0) { p.state = 'flee'; p.timer = 3; p.rig.group.rotation.z = 0; }
        continue;
      }

      // anything fast and close sends them running
      let scare = null;
      for (const t of threats) {
        const dx = p.x - t.x, dz = p.z - t.z;
        const dd = Math.hypot(dx, dz);
        if (dd < 11 && t.speed > 6) { scare = { dx: dx / (dd || 1), dz: dz / (dd || 1) }; break; }
      }
      if (scare && p.state !== 'flee') {
        p.state = 'flee';
        p.timer = 1.6;
        p.fleeX = scare.dx; p.fleeZ = scare.dz;
      }

      if (p.state === 'flee') {
        p.timer -= dt;
        const sp = 4.6;
        p.x += (p.fleeX || 1) * sp * dt;
        p.z += (p.fleeZ || 0) * sp * dt;
        p.yaw = Math.atan2(p.fleeX || 1, p.fleeZ || 0);
        if (p.timer <= 0) { p.state = 'walk'; this.snapToWalk(p); }
      } else if (p.state === 'idle') {
        p.timer -= dt;
        p.chatter -= dt;
        if (p.chatter <= 0) { talk(p.rig, rnd(0.6, 1.8)); p.chatter = rnd(2, 6); }
        if (p.timer <= 0) {
          if (!p.edge) this.snapToWalk(p);
          p.state = 'walk';
          p.timer = rnd(6, 16);
        }
      } else if (p.edge) {
        const len = p.edge.len || 1;
        p.t += (p.dir * p.speed * dt) / len;
        if (p.t > 1) this.hop(p, p.edge.b);
        else if (p.t < 0) this.hop(p, p.edge.a);
        if (!p.active) continue;
        const pos = onEdge(p.edge, Math.max(0, Math.min(1, p.t)), p.side * (p.edge.w / 2 + WALK_OFF));
        p.x = pos.x; p.z = pos.z;
        p.yaw = pos.dir + (p.dir > 0 ? 0 : Math.PI);
        if (Math.random() < 0.0015) { p.state = 'idle'; p.timer = rnd(3, 9); }
      } else {
        this.snapToWalk(p);
      }
      p.rig.group.position.set(p.x, 0, p.z);
      p.rig.group.rotation.y = p.yaw;
      const clip = p.state === 'flee' ? 'run' : p.state === 'idle' ? 'idle' : 'walk';
      poseRig(p.rig, clip, this.t + p.rig.group.id * 0.13, { dt });
    }
  }

  /** Find the nearest bit of pavement and get back on it. */
  snapToWalk(p) {
    const near = nearestRoad(p.x, p.z);
    if (!near) { p.active = false; p.rig.group.visible = false; return; }
    const { edges } = this.graph;
    let best = null, bd = 1e9;
    for (const e of edges) {
      const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
      const d = Math.hypot(mx - p.x, mz - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    p.edge = best;
    p.t = 0.5;
    p.dir = Math.random() < 0.5 ? -1 : 1;
    p.side = Math.random() < 0.5 ? -1 : 1;
  }

  /** Nearest active ped to a point, for punches and missions. */
  nearest(x, z, maxD = 3) {
    let best = null, bd = maxD;
    for (const p of this.peds) {
      if (!p.active || p.state === 'down') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}

// ------------------------------------------------------------- named cast
const NPC_IDS = Object.keys(SUPPORTING).filter((k) => k !== 'chicken' && k !== 'death');

/** Puts the recognisable faces where the schedule says they are. */
export class NpcDirector {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.t = 0;
    this.npcs = {};
    const ids = [...NPC_IDS, 'death'];
    ids.forEach((id, i) => {
      this.npcs[id] = {
        id, rig: null, spec: SUPPORTING[id], x: 0, z: 0, yaw: 0, spot: null,
        offset: [Math.cos(i * 2.4) * 5, Math.sin(i * 2.4) * 5], active: false, talkT: rnd(1, 8),
      };
    });
  }

  /** Family members are placed too, but only when you are not playing them. */
  addFamily(exclude) {
    for (const id of Object.keys(CHARACTERS)) {
      if (id === exclude) continue;
      if (!this.npcs[id]) {
        this.npcs[id] = {
          id, rig: null, spec: CHARACTERS[id], x: 0, z: 0, yaw: 0, spot: null,
          offset: [rnd(-4, 4), rnd(-4, 4)], active: false, talkT: rnd(1, 6), family: true,
        };
      }
    }
    if (exclude && this.npcs[exclude]) {
      this.retire(this.npcs[exclude]);
      delete this.npcs[exclude];
    }
  }

  retire(n) {
    if (n.rig) { this.scene.remove(n.rig.group); n.rig = null; }
    n.active = false;
  }

  positionOf(n, hour) {
    const spotId = whereIs(n.id, hour);
    const spot = this.city.spots[spotId] || this.city.spots.griffin;
    if (!spot) return null;
    return { x: spot.x + n.offset[0], z: spot.z + (spot.face === Math.PI ? -10 : 12) + n.offset[1], spotId };
  }

  update(dt, hour, px, pz) {
    this.t += dt;
    for (const id of Object.keys(this.npcs)) {
      const n = this.npcs[id];
      const at = this.positionOf(n, hour);
      if (!at) continue;
      const far = Math.hypot(at.x - px, at.z - pz);
      if (far > 95) {
        if (n.active) this.retire(n);
        n.x = at.x; n.z = at.z; n.spot = at.spotId;
        continue;
      }
      if (!n.rig) {
        n.rig = buildCharacter(n.spec);
        this.scene.add(n.rig.group);
        n.active = true;
        n.x = at.x; n.z = at.z;
      }
      if (n.spot !== at.spotId) { n.x = at.x; n.z = at.z; n.spot = at.spotId; }
      n.rig.group.position.set(n.x, 0, n.z);
      // face the player when they get close, otherwise face the street
      const dx = px - n.x, dz = pz - n.z;
      const d = Math.hypot(dx, dz);
      const want = d < 14 ? Math.atan2(dx, dz) : n.yaw;
      n.yaw += Math.atan2(Math.sin(want - n.yaw), Math.cos(want - n.yaw)) * Math.min(1, 4 * dt);
      n.rig.group.rotation.y = n.yaw;
      n.talkT -= dt;
      if (n.talkT <= 0) { talk(n.rig, rnd(0.8, 2.2)); n.talkT = rnd(4, 14); }
      poseRig(n.rig, 'idle', this.t + n.offset[0], { dt });
    }
  }

  nearest(x, z, maxD = 4.5) {
    let best = null, bd = maxD;
    for (const id of Object.keys(this.npcs)) {
      const n = this.npcs[id];
      if (!n.active) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
}

// ------------------------------------------------------------------ traffic
export class Traffic {
  constructor(scene, city, count = 14) {
    this.scene = scene;
    this.city = city;
    this.graph = roadGraph();
    this.cars = [];
    for (let i = 0; i < count; i++) this.cars.push(this.make());
  }

  make() {
    const { def, color } = randomTrafficDef();
    const model = buildVehicle(def, { color });
    model.group.visible = false;
    this.scene.add(model.group);
    const v = new Vehicle(model, 0, 0, 0);
    v.driver = 'ai';
    return { v, edge: null, t: 0, dir: 1, active: false, speed: rnd(9, 15) };
  }

  respawn(c, px, pz) {
    const options = edgesNear(px, pz, 34, 130);
    if (!options.length) return false;
    for (let tries = 0; tries < 12; tries++) {
      const e = options[(Math.random() * options.length) | 0];
      if (e.len < 12) continue;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const t = Math.random();
      const pos = onEdge(e, t, dir * e.w * LANE);
      if (Math.hypot(pos.x - px, pos.z - pz) < 26) continue;
      c.edge = e; c.dir = dir; c.t = t; c.active = true;
      c.v.pos.set(pos.x, 0, pos.z);
      c.v.speed = c.speed;
      c.v.yaw = pos.dir + (dir > 0 ? 0 : Math.PI);
      c.v.group.visible = true;
      c.v.sync(0.016);
      return true;
    }
    return false;
  }

  hop(c, node) {
    const links = node.links.filter((l) => l.edge !== c.edge && l.edge.len > 8);
    const next = links.length ? links[(Math.random() * links.length) | 0] : node.links[0];
    if (!next) { c.active = false; c.v.group.visible = false; return; }
    c.edge = next.edge;
    if (c.edge.a === node) { c.t = 0.02; c.dir = 1; }
    else { c.t = 0.98; c.dir = -1; }
  }

  update(dt, px, pz, obstacles) {
    for (const c of this.cars) {
      if (!c.active) { if (Math.random() < 0.6) this.respawn(c, px, pz); continue; }
      const v = c.v;
      if (Math.hypot(v.pos.x - px, v.pos.z - pz) > 210) { c.active = false; v.group.visible = false; continue; }

      // slow for whatever is directly ahead
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      let block = 0;
      for (const o of obstacles) {
        const dx = o.x - v.pos.x, dz = o.z - v.pos.z;
        const ahead = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0.5 && ahead < 12 && side < 2.8) block = Math.max(block, 1 - ahead / 12);
      }
      const want = c.speed * (1 - block);
      v.speed += (want - v.speed) * Math.min(1, 2.4 * dt);

      const len = c.edge.len || 1;
      c.t += (c.dir * v.speed * dt) / len;
      if (c.t > 1) this.hop(c, c.edge.b);
      else if (c.t < 0) this.hop(c, c.edge.a);
      if (!c.active) continue;
      const pos = onEdge(c.edge, Math.max(0, Math.min(1, c.t)), c.dir * c.edge.w * LANE);
      v.pos.x = pos.x;
      v.pos.z = pos.z;
      const wantYaw = pos.dir + (c.dir > 0 ? 0 : Math.PI);
      v.yaw += Math.atan2(Math.sin(wantYaw - v.yaw), Math.cos(wantYaw - v.yaw)) * Math.min(1, 7 * dt);
      v.sync(dt);
    }
  }

  get active() { return this.cars.filter((c) => c.active); }
}

// -------------------------------------------------------------------- cops
export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.units = [];
    this.spawnT = 0;
  }

  spawn(px, pz) {
    const model = buildVehicle(VEHICLES.police);
    this.scene.add(model.group);
    const a = Math.random() * Math.PI * 2;
    const near = this.city.snapToRoad(px + Math.cos(a) * 70, pz + Math.sin(a) * 70);
    const v = new Vehicle(model, near.x, near.z, Math.atan2(px - near.x, pz - near.z));
    v.driver = 'cop';
    const unit = { v, siren: 0 };
    this.units.push(unit);
    return unit;
  }

  clear() {
    for (const u of this.units) this.scene.remove(u.v.group);
    this.units.length = 0;
  }

  update(dt, wanted, target, colliders) {
    const wantUnits = Math.min(5, wanted);
    this.spawnT -= dt;
    if (this.units.length < wantUnits && this.spawnT <= 0) {
      this.spawn(target.x, target.z);
      this.spawnT = 3.5;
    }
    while (this.units.length > wantUnits) {
      const u = this.units.pop();
      this.scene.remove(u.v.group);
    }
    let busted = false;
    for (const u of this.units) {
      const v = u.v;
      const dx = target.x - v.pos.x, dz = target.z - v.pos.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = Math.atan2(Math.sin(want - v.yaw), Math.cos(want - v.yaw));
      const steer = THREE.MathUtils.clamp(diff * 1.6, -1, 1);
      const throttle = dist > 9 ? 1 : dist > 5 ? 0.3 : -0.6;
      v.drive({ steer, throttle, handbrake: Math.abs(diff) > 1.9 && Math.abs(v.speed) > 12 }, dt, colliders, { boost: 1 + wanted * 0.04 });
      u.siren += dt;
      if (v.model.lights?.siren) {
        const on = Math.sin(u.siren * 9) > 0;
        v.model.lights.siren[0].visible = on;
        v.model.lights.siren[1].visible = !on;
      }
      if (dist < 4.5 && Math.abs(target.speed || 0) < 4) busted = true;
    }
    return busted;
  }
}

// ------------------------------------------------------------ giant chicken
/** Ernie. He shows up, and then there is a fight that lasts four minutes. */
export function buildChicken() {
  const rig = buildCharacter(SUPPORTING.chicken);
  return rig;
}
