// Everything with wheels. Bodies are a side-profile extrusion, which is how you
// get a cartoon car in about twenty lines, plus arcade physics with enough
// slide in it to make a handbrake worth pressing.
import * as THREE from 'three';
import { toon, flat, INK, blobShadow, signTex } from './toon.js';

export const VEHICLES = {
  wagon: {
    name: 'The Griffin Wagon', kind: 'wagon', color: '#8a6a44', roof: '#6a4f30',
    len: 4.9, wid: 2.1, maxSpeed: 25, accel: 12, brake: 22, grip: 5.2, turn: 1.5, mass: 1.3,
    blurb: 'Wood panelling. Questionable brakes. Smells like the Clam.',
  },
  sedan: {
    name: 'Lois\'s Sedan', kind: 'sedan', color: '#c0392b', roof: '#a02a1c',
    len: 4.5, wid: 2.0, maxSpeed: 29, accel: 15, brake: 26, grip: 6.4, turn: 1.75, mass: 1.0,
    blurb: 'Sensible, quick, and full of receipts.',
  },
  hybrid: {
    name: 'Brian\'s Hybrid', kind: 'hatch', color: '#7fc8b0', roof: '#5fa890',
    len: 4.0, wid: 1.95, maxSpeed: 27, accel: 16, brake: 24, grip: 6.8, turn: 1.95, mass: 0.85,
    blurb: 'He will tell you the mileage. He will tell you again.',
  },
  van: {
    name: 'Chris\'s Van', kind: 'van', color: '#3f6fa8', roof: '#2e5a8e',
    len: 5.2, wid: 2.3, maxSpeed: 23, accel: 11, brake: 20, grip: 4.6, turn: 1.35, mass: 1.6,
    blurb: 'A mattress in the back. Do not ask.',
  },
  trike: {
    name: 'Stewie\'s Big Wheel', kind: 'trike', color: '#c0392b', roof: '#f2c94c',
    len: 1.9, wid: 1.2, maxSpeed: 22, accel: 20, brake: 26, grip: 7.5, turn: 2.9, mass: 0.4,
    blurb: 'Rocket-assisted. Obviously.',
  },
  moped: {
    name: 'Meg\'s Moped', kind: 'moped', color: '#f2a0c0', roof: '#d880a0',
    len: 2.2, wid: 1.0, maxSpeed: 26, accel: 18, brake: 22, grip: 7.0, turn: 2.5, mass: 0.5,
    blurb: 'Tops out at exactly the speed of ridicule.',
  },
  taxi: { name: 'Quahog Cab', kind: 'sedan', color: '#f2b705', roof: '#e0a800', len: 4.6, wid: 2.05, maxSpeed: 27, accel: 13, brake: 22, grip: 5.6, turn: 1.6, mass: 1.1, taxi: true },
  police: { name: 'QPD Cruiser', kind: 'sedan', color: '#1e3f7a', roof: '#f4f4f2', len: 4.8, wid: 2.1, maxSpeed: 33, accel: 18, brake: 27, grip: 6.6, turn: 1.7, mass: 1.2, police: true },
  pickup: { name: 'Pickup', kind: 'pickup', color: '#4a7a4a', roof: '#3a5f3a', len: 5.0, wid: 2.2, maxSpeed: 25, accel: 13, brake: 21, grip: 5.0, turn: 1.45, mass: 1.4 },
  sports: { name: 'Rich Guy Coupe', kind: 'sports', color: '#e04a2c', roof: '#c03a1c', len: 4.4, wid: 2.1, maxSpeed: 38, accel: 22, brake: 30, grip: 7.4, turn: 1.8, mass: 0.9 },
  bus: { name: 'Quahog Transit', kind: 'bus', color: '#3f7a5a', roof: '#f2f2ee', len: 8.4, wid: 2.6, maxSpeed: 19, accel: 7, brake: 16, grip: 3.6, turn: 1.0, mass: 3.0 },
  clamvan: { name: 'Clam Delivery', kind: 'van', color: '#c0392b', roof: '#f0b8c8', len: 5.0, wid: 2.2, maxSpeed: 24, accel: 12, brake: 21, grip: 4.8, turn: 1.4, mass: 1.4 },
  newsvan: { name: 'Channel 5 Van', kind: 'van', color: '#f4f4f2', roof: '#c0392b', len: 5.2, wid: 2.3, maxSpeed: 26, accel: 13, brake: 22, grip: 5.0, turn: 1.4, mass: 1.5, dish: true },
  beater: { name: 'Beater', kind: 'sedan', color: '#8a8a7a', roof: '#6a6a5a', len: 4.4, wid: 2.0, maxSpeed: 22, accel: 10, brake: 18, grip: 4.6, turn: 1.5, mass: 1.2 },
};

export const TRAFFIC_KINDS = ['taxi', 'pickup', 'sports', 'beater', 'sedan', 'hybrid', 'van', 'clamvan', 'bus'];

const TRAFFIC_COLORS = ['#c0392b', '#2e86c1', '#f2b705', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#7f8c8d', '#f4f4f2', '#34495e', '#d35400'];

// ------------------------------------------------------------------ profile
// Cars are two pieces: a lower body extruded from a side profile, and a
// greenhouse sitting on the beltline. Keeping the glass as its own box is what
// makes a cartoon car read — a single solid lump swallows the windows.
const CABIN = {
  //        beltline   cabin length   z offset   cabin height  windscreen rake
  sedan:  { belt: 0.80, len: 0.46, cz: -0.06, h: 0.60, rake: 0.30 },
  wagon:  { belt: 0.80, len: 0.62, cz: -0.13, h: 0.66, rake: 0.28 },
  hatch:  { belt: 0.78, len: 0.56, cz: -0.08, h: 0.64, rake: 0.30 },
  van:    { belt: 0.86, len: 0.74, cz: -0.04, h: 0.80, rake: 0.16 },
  bus:    { belt: 0.86, len: 0.92, cz: 0.00, h: 0.98, rake: 0.06 },
  pickup: { belt: 0.82, len: 0.38, cz: 0.06, h: 0.60, rake: 0.26 },
  sports: { belt: 0.66, len: 0.42, cz: -0.04, h: 0.44, rake: 0.40 },
};

/** The lower body in side view: rounded nose and tail, flat along the top. */
function profile(kind, L, H) {
  const hl = L / 2;
  const belt = (CABIN[kind] || CABIN.sedan).belt * H;
  switch (kind) {
    case 'van':
      return [[-hl, 0.05], [-hl, belt], [hl * 0.55, belt], [hl, belt * 0.86], [hl, 0.05]];
    case 'bus':
      return [[-hl, 0.05], [-hl, belt], [hl, belt], [hl, 0.05]];
    case 'pickup':
      return [[-hl, 0.05], [-hl, belt * 0.95], [-hl * 0.1, belt], [hl * 0.62, belt], [hl, belt * 0.9], [hl, 0.05]];
    case 'sports':
      return [[-hl, 0.05], [-hl, belt * 0.9], [-hl * 0.4, belt], [hl * 0.5, belt], [hl, belt * 0.82], [hl, 0.05]];
    case 'hatch':
      return [[-hl, 0.05], [-hl, belt], [hl * 0.5, belt], [hl, belt * 0.88], [hl, 0.05]];
    case 'wagon':
      return [[-hl, 0.05], [-hl, belt], [hl * 0.55, belt], [hl, belt * 0.9], [hl, 0.05]];
    default: // sedan
      return [[-hl, 0.05], [-hl, belt * 0.94], [-hl * 0.5, belt], [hl * 0.5, belt], [hl, belt * 0.9], [hl, 0.05]];
  }
}

/** The greenhouse: raked glass box, painted roof, painted pillars. */
function cabin(kind, L, W, H, paint, glass) {
  const c = CABIN[kind] || CABIN.sedan;
  const g = new THREE.Group();
  const cl = L * c.len, ch = H * c.h, cw = W - 0.30;
  const belt = c.belt * H + 0.44;

  const s = new THREE.Shape();
  const hl = cl / 2;
  // side view of the cabin: raked screen at the front, softer slope at the back
  s.moveTo(-hl, 0);
  s.lineTo(hl, 0);
  s.lineTo(hl - ch * c.rake, ch);
  s.lineTo(-hl + ch * c.rake * 0.7, ch);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: cw, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 2,
  });
  geo.translate(0, 0, -cw / 2);
  geo.rotateY(-Math.PI / 2);
  const glassBox = new THREE.Mesh(geo, glass);
  glassBox.position.set(0, belt, L * c.cz);
  g.add(glassBox);

  // roof panel
  const roofL = cl - ch * c.rake * 1.7;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.06, 0.12, Math.max(0.3, roofL)), paint);
  roof.position.set(0, belt + ch, L * c.cz - ch * c.rake * 0.15);
  g.add(roof);
  // pillars at the four corners so the glass is not one floating pane
  for (const sx of [-1, 1]) {
    for (const [sz, lean] of [[1, -c.rake], [-1, c.rake * 0.7]]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, ch, 0.13), paint);
      pillar.position.set(sx * (cw / 2), belt + ch / 2, L * c.cz + sz * (cl / 2 - ch * (sz > 0 ? c.rake : c.rake * 0.7) / 2));
      pillar.rotation.x = lean;
      g.add(pillar);
    }
    // sill along the bottom of the side glass
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, cl * 0.96), paint);
    sill.position.set(sx * (cw / 2 + 0.02), belt + 0.03, L * c.cz);
    g.add(sill);
  }
  return { group: g, belt, ch };
}

function bodyMesh(kind, L, W, H, mat) {
  const pts = profile(kind, L, H);
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [px, py] = pts[i - 1];
    s.quadraticCurveTo((px + x) / 2 + (x - px) * 0.12, (py + y) / 2 + (y - py) * 0.12, x, y);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: W - 0.24, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12,
    bevelSegments: 2, curveSegments: 3,
  });
  geo.translate(0, 0, -(W - 0.24) / 2);
  geo.rotateY(-Math.PI / 2);   // nose now points +Z
  return new THREE.Mesh(geo, mat);
}

function wheel(r, w, mat, hub) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), mat);
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.04, 10), hub);
  cap.rotation.z = Math.PI / 2;
  g.add(cap);
  return g;
}

/** Build one car. Returns { group, wheels, def, lights, colorMat }. */
export function buildVehicle(def, opts = {}) {
  const color = opts.color || def.color;
  const L = def.len, W = def.wid, H = 0.95;
  const group = new THREE.Group();
  const paint = toon(color);
  const dark = toon('#22242a');
  const glass = flat('#3f6f96');

  if (def.kind === 'trike') {
    // Stewie's Big Wheel: one fat front wheel, two little ones, a rocket
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 1.1), paint);
    seat.position.set(0, 0.52, -0.15);
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.16), paint);
    back.position.set(0, 0.8, -0.62);
    group.add(back);
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), dark);
    fork.rotation.x = 0.45;
    fork.position.set(0, 0.66, 0.62);
    group.add(fork);
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), dark);
    bars.rotation.z = Math.PI / 2;
    bars.position.set(0, 1.0, 0.78);
    group.add(bars);
    const rocket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 10), toon('#c8c8d0'));
    rocket.rotation.x = Math.PI / 2;
    rocket.position.set(0, 0.62, -0.9);
    group.add(rocket);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), flat('#ff8a2c'));
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 0.62, -1.42);
    group.add(flame);
    const front = wheel(0.44, 0.34, dark, toon(def.roof));
    front.position.set(0, 0.44, 0.85);
    group.add(front);
    const wheels = [front];
    for (const s of [-1, 1]) {
      const w2 = wheel(0.26, 0.2, dark, toon(def.roof));
      w2.position.set(s * 0.45, 0.26, -0.6);
      group.add(w2);
      wheels.push(w2);
    }
    group.add(blobShadow(1.0, 0.3));
    return { group, wheels, steerWheels: [front], def, seat: new THREE.Vector3(0, 0.62, -0.1), flame };
  }

  if (def.kind === 'moped') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.5), paint);
    body.position.set(0, 0.62, -0.05);
    group.add(body);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.6), toon('#2a2a30'));
    seat.position.set(0, 0.88, -0.3);
    group.add(seat);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), paint);
    shield.position.set(0, 1.0, 0.62);
    shield.rotation.x = -0.25;
    group.add(shield);
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), dark);
    bars.rotation.z = Math.PI / 2;
    bars.position.set(0, 1.16, 0.6);
    group.add(bars);
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), flat('#fff3c4'));
    head.position.set(0, 0.92, 0.78);
    group.add(head);
    const wheels = [];
    for (const [z, r] of [[0.72, 0.32], [-0.7, 0.32]]) {
      const w2 = wheel(r, 0.16, dark, toon('#c8c8d0'));
      w2.position.set(0, r, z);
      group.add(w2);
      wheels.push(w2);
    }
    group.add(blobShadow(1.0, 0.3));
    return { group, wheels, steerWheels: [wheels[0]], def, seat: new THREE.Vector3(0, 0.95, -0.25) };
  }

  const body = bodyMesh(def.kind, L, W, H, paint);
  body.position.y = 0.44;
  group.add(body);

  const roofPaint = toon(def.roof || color);
  const cab = cabin(def.kind, L, W, H, roofPaint, glass);
  group.add(cab.group);
  const gy = cab.belt + cab.ch * 0.55;
  for (const s of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.09), roofPaint);
    mirror.position.set(s * (W / 2 + 0.03), cab.belt + 0.1, L * 0.16);
    group.add(mirror);
  }

  // bumpers, lights, plate
  for (const [z, mat, w, h] of [
    [L / 2 + 0.02, toon('#c8ccd2'), W - 0.2, 0.22],
    [-L / 2 - 0.02, toon('#c8ccd2'), W - 0.2, 0.22],
  ]) {
    const bump = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), mat);
    bump.position.set(0, 0.44, z);
    group.add(bump);
  }
  const lights = { head: [], tail: [] };
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.1), flat('#fff6d0'));
    hl.position.set(s * (W / 2 - 0.36), 0.44 + H * 0.42, L / 2 + 0.02);
    group.add(hl);
    lights.head.push(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), flat('#c0392b'));
    tl.position.set(s * (W / 2 - 0.34), 0.44 + H * 0.46, -L / 2 - 0.02);
    group.add(tl);
    lights.tail.push(tl);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.24), flat('#ffffff', { map: signTex('QUAHOG', { bg: '#f4f4f2', fg: '#1e3f7a', w: 256, h: 88 }), mapKey: 'plate' }));
  plate.position.set(0, 0.56, -L / 2 - 0.11);
  plate.rotation.y = Math.PI;
  group.add(plate);

  const roofY = cab.belt + cab.ch + 0.16;
  if (def.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.3), flat('#f2b705'));
    sign.position.set(0, roofY, 0);
    group.add(sign);
  }
  if (def.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.3), toon('#22242a'));
    bar.position.set(0, roofY, 0.1);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), flat('#ff3020'));
    red.position.set(-0.32, roofY + 0.02, 0.1);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), flat('#3060ff'));
    blue.position.set(0.32, roofY + 0.02, 0.1);
    group.add(blue);
    lights.siren = [red, blue];
    const star = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), flat('#ffffff', { map: signTex('QPD', { bg: '#f4f4f2', fg: '#1e3f7a', w: 256, h: 140 }), mapKey: 'qpd' }));
    star.position.set(-(W / 2 + 0.02), 0.44 + H * 0.5, 0);
    star.rotation.y = -Math.PI / 2;
    group.add(star);
    const star2 = star.clone();
    star2.position.x = W / 2 + 0.02;
    star2.rotation.y = Math.PI / 2;
    group.add(star2);
  }
  if (def.dish) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8), toon('#9aa0a8'));
    mast.position.set(0, roofY + 0.8, -L * 0.3);
    group.add(mast);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), toon('#f2f2ee'));
    dish.rotation.x = -0.9;
    dish.position.set(0, roofY + 1.7, -L * 0.3);
    group.add(dish);
  }
  if (def.kind === 'pickup') {
    const bedY = cab.belt + 0.24;
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, L * 0.42), paint);
      side.position.set(s * (W / 2 - 0.1), bedY, -L * 0.26);
      group.add(side);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.5, 0.1), paint);
    tail.position.set(0, bedY, -L * 0.47);
    group.add(tail);
  }

  // wheels
  const wr = def.kind === 'bus' ? 0.46 : 0.4;
  const wheels = [];
  const steerWheels = [];
  const wx = W / 2 - 0.14, wz = L * 0.33;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w2 = wheel(wr, 0.28, dark, toon('#d8dade'));
    w2.position.set(sx * wx, wr, sz * wz);
    group.add(w2);
    wheels.push(w2);
    if (sz > 0) steerWheels.push(w2);
  }
  group.add(blobShadow(Math.max(L, W) * 0.62, 0.32));

  return {
    group, wheels, steerWheels, def, lights,
    seat: new THREE.Vector3(-0.35, 0.62, 0.1),
  };
}

export function randomTrafficDef(rand = Math.random) {
  const kind = TRAFFIC_KINDS[(rand() * TRAFFIC_KINDS.length) | 0];
  const base = VEHICLES[kind];
  return { def: base, color: base.taxi || base.police ? base.color : TRAFFIC_COLORS[(rand() * TRAFFIC_COLORS.length) | 0] };
}

// ------------------------------------------------------------------ physics
const _f = new THREE.Vector3();

/** One car in the world: pose, velocity, damage, and who is driving it. */
export class Vehicle {
  constructor(model, x, z, yaw = 0) {
    this.model = model;
    this.def = model.def;
    this.group = model.group;
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.yaw = yaw;
    this.speed = 0;
    this.steer = 0;
    this.roll = 0;
    this.pitch = 0;
    this.wheelSpin = 0;
    this.health = 100;
    this.driver = null;      // 'player' | 'ai' | 'cop' | null
    this.parked = true;
    this.airborne = 0;
    this.vy = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = yaw;
    this.radius = Math.max(this.def.len, this.def.wid) * 0.42;
  }

  forward(out = _f) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  /** controls: { throttle -1..1, steer -1..1, handbrake } */
  drive(controls, dt, colliders, opts = {}) {
    const d = this.def;
    const boost = opts.boost || 1;
    const throttle = controls.throttle || 0;
    const hb = !!controls.handbrake;

    if (throttle > 0) this.speed += d.accel * boost * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.4) this.speed -= d.brake * dt;
      else this.speed += d.accel * 0.55 * throttle * dt;
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 5 * dt);
    }
    if (hb) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), d.brake * 0.8 * dt);
    const max = d.maxSpeed * boost;
    this.speed = Math.max(-max * 0.38, Math.min(max, this.speed));

    // steering bites more as you get going, then washes out at the top end
    const v = Math.abs(this.speed);
    const bite = Math.min(1, v / 5) * (1 - Math.min(0.42, v / (max * 2.6)));
    const target = (controls.steer || 0) * d.turn * bite * (hb ? 1.45 : 1);
    this.steer += (target - this.steer) * Math.min(1, 9 * dt);
    this.yaw += this.steer * dt * Math.sign(this.speed || 1);

    // grip: the car slides toward where it is pointed instead of snapping
    const fwd = this.forward();
    const want = fwd.clone().multiplyScalar(this.speed);
    const grip = (hb ? d.grip * 0.28 : d.grip) * dt;
    this.vel.lerp(want, Math.min(1, grip));

    // integrate + collide
    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.z * dt;
    let bump = null;
    if (colliders) {
      const r = this.radius;
      const res = colliders.resolve(nx, nz, r);
      if (res.hit) {
        bump = res.hit;
        const impact = Math.abs(this.speed);
        nx = res.x; nz = res.z;
        if (!res.hit.smash) {
          // only a real shunt bounces you off; brushing a kerb should not
          // pin the car in place with a permanent tiny rebound
          if (impact > 1.4) {
            this.speed *= -0.18;
            this.vel.multiplyScalar(0.25);
            this.health -= Math.max(0, impact - 6) * 0.6;
          } else {
            this.speed *= 0.55;
            this.vel.multiplyScalar(0.5);
            bump = null;
          }
        } else {
          this.speed *= 0.86;
        }
      }
    }
    this.pos.x = nx;
    this.pos.z = nz;

    // air time off ramps
    if (this.airborne > 0 || this.vy !== 0) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.airborne = 0; }
    }

    // body language: lean into the corner, dip under braking
    const lean = -this.steer * Math.min(1, v / 8) * 0.16;
    this.roll += (lean - this.roll) * Math.min(1, 8 * dt);
    const dip = THREE.MathUtils.clamp((throttle < 0 ? 0.05 : -0.03) * Math.min(1, v / 6), -0.06, 0.06);
    this.pitch += (dip - this.pitch) * Math.min(1, 6 * dt);

    this.sync(dt);
    return bump;
  }

  sync(dt) {
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.set(this.pitch, this.yaw, this.roll);
    this.wheelSpin += this.speed * dt * 2.6;
    for (const w of this.model.wheels) w.rotation.x = this.wheelSpin;
    for (const w of this.model.steerWheels) w.rotation.y = this.steer * 0.45;
    if (this.model.flame) {
      this.model.flame.visible = this.speed > 6;
      this.model.flame.scale.setScalar(0.7 + Math.min(1.6, this.speed / 12));
    }
  }

  get mph() { return Math.round(Math.abs(this.speed) * 2.24); }
}
