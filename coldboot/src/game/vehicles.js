// Things with engines. F (△) gets you in and out.
//   Hank's old pickup — sits in his yard until you buy it (flag hasTruck);
//     then it's yours, and it hauls the snow plough for the city route.
//   The snowmobile at your cabin — yours from day one.
//   Northstar's black SUVs — parked by day, patrolling the streets at night
//     with a camera on the roof: they count as watchers for ATTENTION.
//   A few parked trucks (and the mayor's suspiciously new one) for company.
// Arcade driving: bicycle-model steering, a bit of slide on snow, terrain
// following, the town's colliders, no running people over (you just stop).
import * as THREE from 'three';
import { input } from '../core/input.js';
import { C, W, H, text, vText, panel } from '../core/ui.js';
import { GeoBuilder, groupFromGeometries, weather } from '../world/geom.js';
import { makeProp } from '../world/props.js';
import { groundY } from '../world/terrain.js';
import { TOWN } from '../world/townplan.js';
import { settings } from '../core/settings.js';
import { makeRng, damp, clamp } from '../core/util.js';
import { WU } from '../world/worldUniforms.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ------------------------------------------------------------------ models
function wheelMesh(r, w, mat, rimMat) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20).rotateZ(Math.PI / 2), mat);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 12).rotateZ(Math.PI / 2), rimMat);
  tire.castShadow = true;
  g.add(tire, rim);
  return g;
}

/** An old (or new) pickup. Front is +Z. o: {color, trim, rust, plough, clean} */
export function buildPickup(o = {}) {
  const b = new GeoBuilder();
  const rust = o.clean ? 0 : (o.rust ?? 0.35);
  const body = weather(o.color || '#5a6e58', rust * 0.5);
  const trim = o.trim || '#d8d0bc';
  // frame + running boards
  b.box('metal', 0, 0.42, 0, 1.5, 0.2, 4.9, { color: '#1a1a1a' });
  for (const s of [-1, 1]) b.box('metal', s * 0.98, 0.5, 0.45, 0.12, 0.05, 1.5, { color: '#2a2a2a' });
  // hood + fenders
  b.box('paint_gloss', 0, 0.78, 1.95, 1.86, 0.38, 1.3, { color: body });
  for (const s of [-1, 1]) b.box('paint_gloss', s * 0.9, 0.66, 1.95, 0.2, 0.46, 1.25, { color: body });
  // grille + bumpers
  b.box('chrome', 0, 0.62, 2.62, 1.6, 0.5, 0.06, { color: o.clean ? '#e8eaec' : '#a8aaa8' });
  b.box('chrome', 0, 0.45, 2.66, 1.96, 0.18, 0.14, { color: o.clean ? '#eef0f2' : '#9a9c9a' });
  b.box('chrome', 0, 0.45, -2.5, 1.96, 0.18, 0.14, { color: '#8a8c8a' });
  // cab
  b.box('paint_gloss', 0, 0.62, 0.45, 1.9, 0.62, 1.5, { color: body });
  b.box('paint_gloss', 0, 1.62, 0.38, 1.82, 0.08, 1.3, { color: trim });               // roof
  for (const s of [-1, 1]) {
    b.box('paint_gloss', s * 0.93, 1.24, -0.27, 0.06, 0.4, 0.08, { color: body });       // B pillar
    b.poly('glass_dark', [[s * 0.95, 1.24, -0.22], [s * 0.95, 1.24, 1.1], [s * 0.92, 1.62, 0.95], [s * 0.92, 1.62, -0.22]], { color: [0.05, 0.07, 0.09], want: [s, 0, 0] });
    b.box('paint_gloss', s * 0.96, 0.9, 0.45, 0.02, 0.06, 1.4, { color: trim });          // stripe
  }
  b.poly('glass_dark', [[-0.88, 1.24, 1.18], [0.88, 1.24, 1.18], [0.84, 1.62, 1.02], [-0.84, 1.62, 1.02]], { color: [0.06, 0.08, 0.1], want: [0, 0.4, 1] });   // windshield
  b.poly('glass_dark', [[0.85, 1.26, -0.32], [-0.85, 1.26, -0.32], [-0.85, 1.6, -0.3], [0.85, 1.6, -0.3]], { color: [0.05, 0.07, 0.09], want: [0, 0, -1] });
  b.box('paint_gloss', 0, 1.24, -0.31, 1.9, 0.38, 0.06, { color: body });
  // bed
  b.box('metal', 0, 0.74, -1.45, 1.86, 0.06, 2.1, { color: '#2a2a28' });
  for (const s of [-1, 1]) b.box('paint_gloss', s * 0.9, 0.74, -1.45, 0.08, 0.5, 2.1, { color: body });
  b.box('paint_gloss', 0, 0.74, -2.48, 1.86, 0.5, 0.08, { color: body });                // tailgate
  for (const s of [-1, 1]) b.box('paint_gloss', s * 0.9, 0.55, -1.65, 0.2, 0.25, 1.1, { color: body });
  // lights
  for (const s of [-1, 1]) {
    b.box('neon', s * 0.68, 0.78, 2.62, 0.26, 0.16, 0.04, { color: [1.6, 1.5, 1.2] });
    b.box('neon', s * 0.86, 0.85, -2.52, 0.12, 0.22, 0.04, { color: [1.6, 0.08, 0.05] });
  }
  // mirrors
  for (const s of [-1, 1]) b.box('metal', s * 1.06, 1.22, 1.05, 0.16, 0.16, 0.05, { color: '#1a1a1a' });
  if (o.plough) {
    b.push().translate(0, 0.25, 3.15).rotateY(0.18);
    b.box('paint_gloss', 0, 0, 0, 2.8, 0.85, 0.12, { color: '#e8b81a' });
    b.box('metal', 0, 0, -0.1, 2.8, 0.1, 0.12, { color: '#3a3a3a' });
    b.pop();
    b.box('metal', 0, 0.45, 2.8, 0.3, 0.2, 0.6, { color: '#2a2a2a' });
  }
  const g = new THREE.Group();
  const bodyG = groupFromGeometries(b.geometries(), { materials: b.materials, snow: true });
  bodyG.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.add(bodyG);
  const tireM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const rimM = new THREE.MeshStandardMaterial({ color: o.clean ? 0xd8dadc : 0x8a8a86, roughness: 0.4, metalness: 0.7 });
  const wheels = [];
  for (const [x, z, front] of [[-0.86, 1.65, 1], [0.86, 1.65, 1], [-0.86, -1.65, 0], [0.86, -1.65, 0]]) {
    const w = wheelMesh(0.4, 0.3, tireM, rimM);
    w.position.set(x, 0.4, z);
    w.userData.front = !!front;
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels, seat: V(-0.42, 0.62, 0.35), door: V(-1.6, 0, 0.4), height: 1.9, length: 5.3, width: 2.0, lights: [V(-0.68, 0.86, 2.7), V(0.68, 0.86, 2.7)] };
}

/** Northstar's black SUV: dark glass, a light bar, a camera dome. */
export function buildSUV() {
  const b = new GeoBuilder();
  const black = '#0c0d0f';
  b.box('paint_gloss', 0, 0.42, 0, 1.98, 0.75, 5.0, { color: black });
  b.box('paint_gloss', 0, 1.17, -0.55, 1.9, 0.7, 3.4, { color: black });
  for (const s of [-1, 1]) b.poly('glass_dark', [[s * 0.96, 1.2, -2.15], [s * 0.96, 1.2, 1.0], [s * 0.94, 1.8, 0.75], [s * 0.94, 1.8, -2.15]], { color: [0.02, 0.025, 0.03], want: [s, 0, 0] });
  b.poly('glass_dark', [[-0.92, 1.2, 1.15], [0.92, 1.2, 1.15], [0.88, 1.8, 0.78], [-0.88, 1.8, 0.78]], { color: [0.02, 0.025, 0.03], want: [0, 0.5, 1] });
  b.poly('glass_dark', [[0.9, 1.2, -2.27], [-0.9, 1.2, -2.27], [-0.88, 1.8, -2.25], [0.88, 1.8, -2.25]], { color: [0.02, 0.025, 0.03], want: [0, 0, -1] });
  b.box('metal', 0, 0.3, 2.5, 1.9, 0.5, 0.08, { color: '#16181a' });
  for (const s of [-1, 1]) {
    b.box('neon', s * 0.7, 0.86, 2.5, 0.36, 0.08, 0.04, { color: [1.8, 1.9, 2.1] });
    b.box('neon', s * 0.82, 0.96, -2.52, 0.26, 0.1, 0.04, { color: [1.8, 0.05, 0.04] });
    // the Northstar star on the doors
    b.poly('neon', [[s * 1.0, 0.85, -0.2], [s * 1.0, 0.85, 0.2], [s * 1.0, 0.65, 0.2], [s * 1.0, 0.65, -0.2]].map((p) => p), { color: [0.25, 1.1, 1.4], want: [s, 0, 0] });
  }
  b.box('metal', 0, 1.87, -0.2, 1.2, 0.08, 0.22, { color: '#202224' });                  // light bar
  b.sphere('glass_dark', 0, 1.95, -1.4, 0.14, { color: [0.05, 0.05, 0.06] });            // camera dome
  const g = new THREE.Group();
  const bodyG = groupFromGeometries(b.geometries(), { materials: b.materials, snow: true });
  bodyG.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.add(bodyG);
  const strobe = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.2, 0.25) }));
  strobe.position.set(0, 1.97, -0.2);
  g.add(strobe);
  const tireM = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0x202224, roughness: 0.35, metalness: 0.8 });
  const wheels = [];
  for (const [x, z, front] of [[-0.88, 1.6, 1], [0.88, 1.6, 1], [-0.88, -1.6, 0], [0.88, -1.6, 0]]) {
    const w = wheelMesh(0.42, 0.3, tireM, rimM);
    w.position.set(x, 0.42, z);
    w.userData.front = !!front;
    g.add(w);
    wheels.push(w);
  }
  return { group: g, wheels, strobe, seat: V(-0.42, 0.7, 0.2), door: V(-1.6, 0, 0.3), height: 2.0, length: 5.0, width: 2.0, lights: [V(-0.7, 0.9, 2.6), V(0.7, 0.9, 2.6)] };
}

function buildSled() {
  const g = new THREE.Group();
  const m = makeProp('snowmobile', { color: '#a3221c', seed: 3 });
  m.traverse((x) => { if (x.isMesh) { x.castShadow = true; } });
  g.add(m);
  return { group: g, wheels: [], seat: V(0, 0.42, -0.55), door: V(-1.0, 0, -0.4), height: 1.2, length: 2.9, width: 1.2, lights: [V(0, 0.68, 1.05)] };
}

const SPECS = {
  truck: { maxSpeed: 21, reverse: 6, accel: 5.5, brake: 11, steer: 0.6, wheelbase: 3.3, radius: 1.25, grip: 5, eye: 2.0 },
  sled: { maxSpeed: 23, reverse: 3, accel: 7.5, brake: 9, steer: 0.55, wheelbase: 1.7, radius: 0.75, grip: 3, eye: 1.6 },
  suv: { maxSpeed: 16, reverse: 5, accel: 4.5, brake: 10, steer: 0.55, wheelbase: 3.2, radius: 1.25, grip: 6, eye: 2.0 },
};

// patrol routes (ping-pong along streets)
const ROUTES = {
  a: [[230, 70], [120, 60], [0, 62], [0, 20], [-60, 22], [-200, 25]],
  b: [[0, -150], [0, -60], [-60, -62], [-190, -60]],
};

// the plough route: Front St, Main St, 2nd Ave both ways, 3rd Ave both ways, the square
const PLOW = [
  [92, 58], [40, 61], [0, 62], [-60, 63], [-120, 64], [-60, 63], [0, 50], [0, 22], [-60, 22], [-130, 23], [-200, 25],
  [-130, 23], [-60, 22], [20, 20], [90, 22], [180, 28], [90, 22], [0, 10], [0, -30], [0, -60], [-60, -62], [-130, -61],
  [-190, -60], [-120, -61], [-40, -61], [40, -59], [110, -58], [40, -59], [0, -40], [-40, -10], [40, -10], [0, -10],
];

class Vehicle {
  constructor(kind, model, x, z, yaw, o = {}) {
    this.kind = kind;
    this.spec = SPECS[kind === 'mayor' || kind === 'parked' ? 'truck' : kind];
    this.model = model;
    this.group = model.group;
    this.pos = V(x, groundY(x, z), z);
    this.yaw = yaw;
    this.heading = yaw;
    this.speed = 0;
    this.steer = 0;
    this.roll = 0; this.pitch = 0;
    this.drivable = !!o.drivable;
    this.owner = o.owner || null;
    this.label = o.label || 'Drive';
    this.spin = 0;
    this.place();
  }

  place() {
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  /** world position of a local point */
  local(p) { return p.clone().applyEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ')).add(this.pos); }
}

export class Vehicles {
  constructor(G, scene) {
    this.G = G;
    this.scene = scene;
    this.list = [];
    this.driving = null;
    this.route = null;
    this.t = 0;
    this.lights = [new THREE.SpotLight(0xfff2dc, 0, 45, 0.5, 0.55, 1.4), new THREE.SpotLight(0xfff2dc, 0, 45, 0.5, 0.55, 1.4)];
    for (const l of this.lights) { scene.add(l, l.target); }
    this.patrolLights = [];
    G.player.onSeat = (P) => this.seat(P);
    this._spawnAll();
  }

  add(kind, model, x, z, yaw, o) {
    const v = new Vehicle(kind, model, x, z, yaw, o);
    this.scene.add(v.group);
    this.list.push(v);
    return v;
  }

  get(id) { return this.list.find((v) => v.id === id); }

  _spawnAll() {
    const G = this.G, s = G.state;
    s.vehicles = s.vehicles || {};
    const B = G.town.buildings;
    const front = (id, side, back = 2, yawOff = 0) => {
      const b = B[id];
      if (!b) return { x: 0, z: 0, yaw: 0 };
      const d = (b.b.footprint?.d || 10) / 2 + back;
      const w = (b.b.footprint?.w || 10) / 2;
      const fx = Math.sin(b.rot), fz = Math.cos(b.rot), rx = Math.cos(b.rot), rz = -Math.sin(b.rot);
      return { x: b.x + fx * d + rx * w * side, z: b.z + fz * d + rz * w * side, yaw: b.rot + yawOff };
    };
    // Hank's truck (yours once bought)
    const tp = s.vehicles.truck || front('hardware', 0.9, 6, Math.PI / 2);
    this.truck = this.add('truck', buildPickup({ color: '#5a6e58' }), tp.x, tp.z, tp.yaw, { drivable: true, owner: 'hank', label: 'Drive the truck' });
    this.truck.id = 'truck';
    // the snowmobile at the cabin
    const cp = s.vehicles.sled || G.town.points['cabin.snowmobile'] || (() => { const f = front('cabin', 1.2, 3, Math.PI / 2); return f; })();
    this.sled = this.add('sled', buildSled(), cp.x, cp.z, cp.yaw ?? cp.rot ?? 0, { drivable: true, owner: 'player', label: 'Ride the snowmobile' });
    this.sled.id = 'sled';
    // the mayor's new truck at City Hall; a few old ones around town
    const mp = front('cityhall', -0.6, 4, Math.PI / 2);
    this.add('mayor', buildPickup({ color: '#b8bcc0', clean: true }), mp.x, mp.z, mp.yaw).id = 'mayor';
    const rng = makeRng('parked');
    const lots = TOWN.houseLots.filter((_, i) => i % 7 === 3);
    lots.forEach(([x, z, rot], i) => {
      const a = rot + Math.PI * 0.5;
      const px = x + Math.sin(rot) * 7 + Math.cos(rot) * 5, pz = z + Math.cos(rot) * 7 - Math.sin(rot) * 5;
      if (groundY(px, pz) < 0.3) return;
      this.add('parked', buildPickup({ color: ['#7a2a22', '#2a4a6a', '#6a5a3a', '#4a4a4a', '#8a7a5a'][i % 5], rust: 0.4 + rng() * 0.5 }), px, pz, a).id = 'parked' + i;
    });
    // Northstar SUVs: parked by day at the store and up the Dome road
    const np = front('northstar', 0.8, 5, Math.PI / 2);
    for (const [id, route, p] of [['suvA', 'a', np], ['suvB', 'b', { x: 6, z: -140, yaw: Math.PI }]]) {
      const m = buildSUV();
      const v = this.add('suv', m, p.x, p.z, p.yaw);
      v.id = id;
      v.route = ROUTES[route];
      v.home = { ...p };
      v.leg = 1; v.dir = 1;
      v.watcher = { kind: 'patrol', x: v.pos.x, y: 1.8, z: v.pos.z, yaw: v.yaw, fov: 0.9, range: 0, owner: 'northstar' };
      G.attention?.watchers.push(v.watcher);
      const l = new THREE.SpotLight(0xe8f0ff, 0, 40, 0.42, 0.5, 1.4);
      this.scene.add(l, l.target);
      v.light = l;
    }
    // parked vehicles are solid
    for (const v of this.list) this._collider(v);
  }

  _collider(v) {
    if (v.box) v.box.disabled = true;
    if (v === this.driving || v.kind === 'suv') return;
    const box = { x: v.pos.x, z: v.pos.z, w: v.model.width * 0.95, d: v.model.length * 0.92, rot: v.yaw, y: v.pos.y, h: v.model.height, owner: 'vehicle' };
    this.G.world.addBox(box);
    v.box = box;
  }

  owns(v) {
    if (v.id === 'sled') return true;
    if (v.id === 'truck') return !!this.G.state.flags.hasTruck || !!this.G.state.inv?.truck_key;
    return false;
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    const G = this.G, P = G.player;
    this.t += dt;
    const night = WU.night.value;
    // get in / out
    if (this.driving) {
      if (!G.cinematic && !G.overlay && input.pressed('vehicle') && Math.abs(this.driving.speed) < 3) this.exit();
    } else if (!P.locked && !G.cinematic && !G.overlay) {
      let best = null, bd = 2.6;
      for (const v of this.list) {
        if (!v.drivable) continue;
        const door = v.local(v.model.door);
        const d = Math.hypot(P.pos.x - door.x, P.pos.z - door.z);
        if (d < bd) { bd = d; best = v; }
      }
      this.near = best;
      if (best) {
        if (!G.hud.prompt) G.hud.prompt = { action: 'vehicle', text: this.owns(best) ? best.label : best.id === 'truck' ? "Hank's truck — not yours (yet)" : 'Locked' };
        if (input.pressed('vehicle') && this.owns(best)) this.enter(best);
      }
    }
    if (this.driving) this._drive(dt, this.driving);
    // headlights on the one you drive
    const dv = this.driving;
    this.lights.forEach((l, i) => {
      if (!dv || !dv.model.lights[i]) { l.intensity = 0; return; }
      l.position.copy(dv.local(dv.model.lights[i]));
      l.target.position.copy(dv.local(dv.model.lights[i].clone().add(V(0, -1.2, 12))));
      l.intensity = 30 * (0.25 + 0.75 * night);
    });
    // the patrols
    for (const v of this.list) if (v.kind === 'suv') this._patrol(dt, v, night);
    // wheels
    for (const v of this.list) {
      if (!v.model.wheels.length || (Math.abs(v.speed) < 0.05 && !v.steer)) continue;
      v.spin += v.speed * dt / 0.4;
      for (const w of v.model.wheels) {
        w.rotation.set(v.spin, w.userData.front ? v.steer : 0, 0, 'YXZ');
      }
    }
    // the plough route
    if (this.route) this._route(dt);
  }

  enter(v) {
    const G = this.G, P = G.player;
    this.driving = v;
    if (v.box) v.box.disabled = true;
    P.vehicle = v;
    P.locked = true;
    P.anim.setPosture('drive');
    v.speed = 0;
    G.sfx?.engineStart?.();
    G.hud.toast(v.id === 'sled' ? 'SNOWMOBILE' : 'THE TRUCK', 'W/S drive · A/D steer · Space brake · F get out', '#7fe6ff');
  }

  exit() {
    const G = this.G, P = G.player, v = this.driving;
    if (!v) return;
    this.driving = null;
    v.speed = 0;
    P.vehicle = null;
    P.locked = false;
    P.anim.setPosture('stand');
    const door = v.local(v.model.door);
    const r = G.world.move(v.pos, door.x - v.pos.x, door.z - v.pos.z, 0.3, v.pos.y);
    P.place(r.x, r.z, v.yaw);
    G.sfx?.engine?.(0, 0, v.kind);
    G.sfx?.engineStop?.();
    this._collider(v);
    if (v.id === 'truck' || v.id === 'sled') G.state.vehicles[v.id] = { x: v.pos.x, z: v.pos.z, yaw: v.yaw };
  }

  /** Put the driver in the seat (called by Player.update). */
  seat(P) {
    const v = P.vehicle;
    const p = v.local(v.model.seat);
    P.pos.set(p.x, p.y, p.z);
    P.yaw = v.yaw;
    P.speed = Math.abs(v.speed);
    P.ch.group.position.copy(p);
    P.ch.group.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
  }

  _drive(dt, v) {
    const G = this.G, S = v.spec;
    const thr = input.throttle, brk = input.brake;
    // longitudinal
    if (thr > 0.01) {
      if (v.speed < -0.3) v.speed += S.brake * thr * dt;
      else v.speed += S.accel * thr * (1 - Math.max(0, v.speed) / S.maxSpeed) * dt;
    }
    if (brk > 0.01) {
      if (v.speed > 0.3) v.speed -= S.brake * brk * dt;
      else v.speed = Math.max(-S.reverse, v.speed - S.accel * 0.6 * brk * dt);
    }
    if (thr <= 0.01 && brk <= 0.01) v.speed *= Math.exp(-dt * (Math.abs(v.speed) < 1 ? 2.5 : 0.25));
    if (input.handbrake) v.speed *= Math.exp(-dt * 2.2);
    // steering (less lock at speed)
    const lock = S.steer * (1 - Math.min(0.65, Math.abs(v.speed) / S.maxSpeed * 0.7));
    v.steer = damp(v.steer, -input.steer * lock, 9, dt);
    v.yaw += (v.speed / S.wheelbase) * Math.tan(v.steer) * dt;
    // the snow lets the back step out a little
    const grip = input.handbrake ? S.grip * 0.25 : S.grip;
    v.heading += wrap(v.yaw - v.heading) * Math.min(1, dt * grip);
    // nobody gets run over: stop short of people
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    for (const npc of G.npcs?.list?.values?.() || []) {
      if (!npc.ch || npc.hidden || !npc.ch.group.visible) continue;
      const dx = npc.pos.x - v.pos.x, dz = npc.pos.z - v.pos.z;
      const ahead = (dx * fx + dz * fz) * Math.sign(v.speed || 1);
      const side = Math.abs(-dx * fz + dz * fx);
      if (ahead > 0 && ahead < v.model.length * 0.5 + 2.5 && side < v.model.width * 0.5 + 0.6) { v.speed *= Math.exp(-dt * 12); }
    }
    const dx = fx * v.speed * dt, dz = fz * v.speed * dt;
    const r = G.world.move(v.pos, dx, dz, S.radius, v.pos.y, 1.6);
    if (r.hit && Math.abs(v.speed) > 1) {
      if (Math.abs(v.speed) > 7) { G.sfx?.impact?.(Math.min(1, Math.abs(v.speed) / 20), 'car'); input.rumble?.(0.8, 0.6, 200); }
      v.speed *= 0.45;
    }
    let gy = G.world.groundAt(r.x, r.z, v.pos.y + 0.6, 0.6);
    // stay out of the sea and off cliffs
    if (groundY(r.x, r.z) < -0.35 || gy - v.pos.y > 0.9) { v.speed = 0; gy = v.pos.y; }
    else { v.pos.x = r.x; v.pos.z = r.z; }
    v.pos.y = damp(v.pos.y, gy, 14, dt);
    // pitch / roll from the ground under the wheels
    const L = v.model.length * 0.38, Wd = v.model.width * 0.4;
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    const hf = G.world.groundAt(v.pos.x + s * L, v.pos.z + c * L, v.pos.y + 0.8), hb = G.world.groundAt(v.pos.x - s * L, v.pos.z - c * L, v.pos.y + 0.8);
    const hl = G.world.groundAt(v.pos.x + c * Wd, v.pos.z - s * Wd, v.pos.y + 0.8), hr = G.world.groundAt(v.pos.x - c * Wd, v.pos.z + s * Wd, v.pos.y + 0.8);
    v.pitch = damp(v.pitch, -Math.atan2(hf - hb, 2 * L) * 0.9, 10, dt);
    v.roll = damp(v.roll, Math.atan2(hl - hr, 2 * Wd) * 0.9 + clamp(v.steer * v.speed * 0.006, -0.06, 0.06), 10, dt);
    v.place();
    // sound
    const rpm = Math.min(1, 0.15 + Math.abs(v.speed) / v.spec.maxSpeed * 0.85);
    G.sfx?.engine?.(rpm, input.throttle, v.kind === 'sled' ? 'snowmobile' : 'truck');
    // plough spray
    if (this.route && v.id === 'truck' && Math.abs(v.speed) > 3) this.route.spray += dt;
  }

  _patrol(dt, v, night) {
    const G = this.G;
    const on = night > 0.5 || this.G.state.flags.alarm;
    const P = G.player.pos;
    if (!on) {
      // home, parked
      if (v.patrolling) { v.pos.set(v.home.x, groundY(v.home.x, v.home.z), v.home.z); v.yaw = v.home.yaw; v.pitch = v.roll = 0; v.place(); v.patrolling = false; v.speed = 0; }
      v.watcher.range = 0;
      v.light.intensity = 0;
      v.model.strobe.material.color.setRGB(0.2, 0.2, 0.25);
      return;
    }
    if (!v.patrolling) {
      v.patrolling = true;
      const [x, z] = v.route[0];
      v.pos.set(x, groundY(x, z), z);
      v.leg = 1; v.dir = 1;
    }
    const [tx, tz] = v.route[v.leg];
    const dx = tx - v.pos.x, dz = tz - v.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 4) {
      v.leg += v.dir;
      if (v.leg >= v.route.length || v.leg < 0) { v.dir = -v.dir; v.leg += 2 * v.dir; }
    }
    const want = Math.atan2(dx, dz);
    v.yaw += wrap(want - v.yaw) * Math.min(1, dt * 1.6);
    // slow for corners, stop for you
    let sp = 8 * (1 - Math.min(0.7, Math.abs(wrap(want - v.yaw)) * 1.2));
    const ax = P.x - v.pos.x, az = P.z - v.pos.z;
    const ahead = ax * Math.sin(v.yaw) + az * Math.cos(v.yaw);
    if (ahead > 0 && ahead < 9 && Math.abs(-ax * Math.cos(v.yaw) + az * Math.sin(v.yaw)) < 2) sp = 0;
    v.speed = damp(v.speed, sp, 2, dt);
    v.pos.x += Math.sin(v.yaw) * v.speed * dt;
    v.pos.z += Math.cos(v.yaw) * v.speed * dt;
    v.pos.y = damp(v.pos.y, groundY(v.pos.x, v.pos.z), 10, dt);
    v.place();
    v.steer = clamp(wrap(want - v.yaw), -0.5, 0.5);
    // it sees
    v.watcher.x = v.pos.x; v.watcher.z = v.pos.z; v.watcher.yaw = v.yaw; v.watcher.range = 26;
    const near = Math.hypot(P.x - v.pos.x, P.z - v.pos.z) < 140;
    v.light.intensity = near ? 26 : 0;
    if (near) {
      v.light.position.copy(v.local(V(0, 1.0, 2.6)));
      v.light.target.position.copy(v.local(V(0, -0.5, 14)));
    }
    const k = Math.sin(this.t * 9) > 0.7 ? 1 : 0.15;
    v.model.strobe.material.color.setRGB(k * 2.4, k * 2.6, k * 3);
  }

  // ---------------------------------------------------------------- the plough route
  /** Job: drive the plough over the town's streets. Resolves to dollars earned. */
  plowRoute() {
    const G = this.G;
    return new Promise((resolve) => {
      const v = this.truck;
      // the blade goes on; the truck waits by Hank's pumps with the engine running
      const swap = buildPickup({ color: '#5a6e58', plough: true });
      this.scene.remove(v.group);
      v.model = swap; v.group = swap.group;
      this.scene.add(v.group);
      const h = G.town.buildings.hardware;
      const start = PLOW[0];
      v.pos.set(start[0], groundY(start[0], start[1]), start[1]);
      v.yaw = v.heading = -Math.PI / 2;
      v.place();
      if (this.driving !== v) {
        if (this.driving) this.exit();
        this.enter(v);
      }
      void h;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.4) }));
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
      this.route = { i: 1, t: 0, limit: 300, ring, spray: 0, resolve, done: false };
      G.hud.toast('THE PLOUGH ROUTE', `${PLOW.length - 1} stretches · 5 minutes · stay in the truck`, '#ffd166');
    });
  }

  _route(dt) {
    const G = this.G, R = this.route, v = this.truck;
    R.t += dt;
    const [x, z] = PLOW[R.i];
    R.ring.position.set(x, groundY(x, z) + 0.4, z);
    R.ring.rotation.z += dt;
    G.hud.objective = { text: `Plough the streets  ${R.i - 1} / ${PLOW.length - 1}`, sub: `${Math.max(0, Math.ceil(R.limit - R.t))} s left`, target: { x, z } };
    if (this.driving === v && Math.hypot(v.pos.x - x, v.pos.z - z) < 7) {
      R.i++;
      G.sfx?.ui?.('move');
      if (R.i >= PLOW.length) return this._routeEnd(true);
    }
    if (R.t > R.limit || this.driving !== v) this._routeEnd(false);
  }

  _routeEnd(all) {
    const G = this.G, R = this.route, v = this.truck;
    this.route = null;
    this.scene.remove(R.ring);
    G.hud.objective = null;
    const n = R.i - 1;
    const bonus = all ? Math.round(Math.max(0, R.limit - R.t) / 10) : 0;
    const pay = Math.round(20 + n * 2.5 + bonus);
    // blade off
    const plain = buildPickup({ color: '#5a6e58' });
    const driving = this.driving === v;
    this.scene.remove(v.group);
    v.model = plain; v.group = plain.group;
    this.scene.add(v.group);
    v.place();
    if (!driving) this._collider(v);
    G.hud.toast(all ? 'ROUTE CLEARED' : 'ROUTE ABANDONED', `${n} of ${PLOW.length - 1} stretches`, all ? '#9fe8b0' : '#ffb21e');
    R.resolve(pay);
  }

  // ---------------------------------------------------------------- HUD
  draw(ctx) {
    const v = this.driving;
    if (!v || this.G.cinematic) return;
    const metric = settings.get('units') === 'metric';
    const sp = Math.abs(v.speed) * (metric ? 3.6 : 2.237);
    panel(ctx, W - 230, H - 118, 190, 72, { accentLen: 80 });
    vText(ctx, String(Math.round(sp)), W - 120, H - 66, 34, { align: 'right', color: '#fff', weight: 0.17 });
    text(ctx, metric ? 'KM/H' : 'MPH', W - 110, H - 68, { size: 13, weight: 800, color: C.dim, spacing: 2 });
    text(ctx, v.speed < -0.3 ? 'R' : 'D', W - 210, H - 66, { size: 22, weight: 800, color: v.speed < -0.3 ? '#ffb21e' : C.green });
  }
}
