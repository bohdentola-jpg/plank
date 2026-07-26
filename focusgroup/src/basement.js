// FOCUS GROUP — sub-level one.
//
// Saturday. The lift has a button below the ground floor that you have never
// pressed, and it is lit. Down here there is a service corridor with far more
// cable in it than a block of eleven flats has any use for, and at the end of
// it, round a corner you cannot see past, a door with a brass plaque.
//
//        z8.2                      +----[D]----+     D = VIEWER SERVICES
//                                  |  leg B    |
//        z1.2  +-------------------+           |
//     [lift]---|       leg A                   |
//       z-1.2  +-------------------------------+
//            x0                              x9.6

import * as THREE from 'three';
import { World } from './world.js';
import { material, simple, liveCanvas } from './textures.js';
import * as P from './props.js';

const H = 2.30;       // corridor
const CARH = 2.15;    // the car is lower, and you notice

export const BASEMENT_SPAWN = { x: -0.85, y: 0, z: 0, yaw: -Math.PI / 2 };

export function buildBasement(dress = {}) {
  const w = new World('basement');
  w.bounds = { x0: -1.9, x1: 9.9, z0: -1.5, z1: 8.5 };

  w.room('lift', -1.6, -0.8, 0.0, 0.8, 'concrete');
  w.room('basement', 0.0, -1.2, 9.6, 1.2, 'concrete');
  w.room('basement', 8.4, 1.2, 9.6, 8.2, 'concrete');

  // ---------------------------------------------------------------- floor
  w.slab(-1.6, 0.0, -0.8, 0.8, 0.001, 'concrete', { tile: 0.9 });
  w.slab(0.0, 9.6, -1.2, 1.2, 0, 'concrete');
  w.slab(8.4, 9.6, 1.2, 8.2, 0, 'concrete');
  w.slab(-1.6, 0.0, -0.8, 0.8, CARH, simple(0x83898e, { rough: 0.4, metal: 0.5 }), { up: false });
  w.slab(0.0, 9.6, -1.2, 1.2, H, 'concrete', { up: false });
  w.slab(8.4, 9.6, 1.2, 8.2, H, 'concrete', { up: false });

  // ---------------------------------------------------------------- shell
  const CON = 'concrete';
  w.wall(0.0, -1.2, 9.6, -1.2, CON, { h: H });
  w.wall(0.0, 1.2, 8.4, 1.2, CON, { h: H });
  w.wall(9.6, -1.2, 9.6, 8.2, CON, { h: H });
  w.wall(8.4, 1.2, 8.4, 8.2, CON, { h: H });
  w.wall(0.0, 8.2, 9.6, 8.2, CON, { h: H });
  // the door surround the lift opens into
  w.wall(0.0, -1.2, 0.0, -0.85, CON, { h: H });
  w.wall(0.0, 0.85, 0.0, 1.2, CON, { h: H });
  w.box(1.9, H - 2.1, 0.14, CON, 0.0, 2.2, 0.0, { solid: false });

  // ---------------------------------------------------------------- the car
  const panel = simple(0x9aa0a4, { rough: 0.34, metal: 0.62 });
  w.box(0.10, CARH, 1.60, panel, -1.65, CARH / 2, 0, { tag: 'wall' });
  w.box(1.60, CARH, 0.10, panel, -0.80, CARH / 2, -0.85, { tag: 'wall' });
  w.box(1.60, CARH, 0.10, panel, -0.80, CARH / 2, 0.85, { tag: 'wall' });
  // brushed vertical grain on the back wall, and a handrail to hold on to
  for (let i = 0; i < 8; i++) {
    w.box(0.012, CARH - 0.3, 0.012, simple(0x7e848a, { rough: 0.4, metal: 0.6 }),
      -1.58, CARH / 2, -0.7 + i * 0.2, { solid: false });
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 1.5, 10),
    simple(0xb8bcc0, { rough: 0.25, metal: 0.85 }));
  rail.rotation.x = Math.PI / 2;
  rail.position.set(-1.52, 0.92, 0);
  w.add(rail);

  // the floor buttons. The bottom one has no number on it and it is lit.
  const btnPlate = w.box(0.13, 0.72, 0.03, simple(0x54585c, { rough: 0.4, metal: 0.5 }),
    -0.98, 1.18, -0.79, { solid: false });
  btnPlate.rotation.y = 0;
  const lit = simple(0xffd070, { rough: 0.3, emissive: 0xffb020, emissiveIntensity: 2.2 });
  const cold = simple(0xd8d4c8, { rough: 0.5 });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.012, 12), i === 5 ? lit : cold);
    b.rotation.x = Math.PI / 2;
    b.position.set(-0.98, 1.46 - i * 0.11, -0.765);
    w.add(b);
  }

  const carLight = new THREE.PointLight(0xffe6c0, 13, 5.0, 2);
  carLight.position.set(-0.8, CARH - 0.14, 0);
  w.light(carLight, 'practical');
  w.box(0.5, 0.03, 0.34, simple(0xf0e8d0, { rough: 0.85, emissive: 0xf0e0b8, emissiveIntensity: 0.8 }),
    -0.8, CARH - 0.05, 0, { solid: false });

  // the doors, which main.js shuts behind you at the appropriate moment
  const doorMat = simple(0x8e9498, { rough: 0.32, metal: 0.6 });
  const leftDoor = w.box(0.06, CARH - 0.1, 0.78, doorMat, 0.0, (CARH - 0.1) / 2, -0.42, { solid: false });
  const rightDoor = w.box(0.06, CARH - 0.1, 0.78, doorMat, 0.0, (CARH - 0.1) / 2, 0.42, { solid: false });
  leftDoor.position.z = -1.24;   // parked open
  rightDoor.position.z = 1.24;

  // ---------------------------------------------------------------- services
  // Pipe and cable, and then more cable, and then some cable that is newer
  // than the block and goes up through the slab toward the flats.
  P.pipeRun(w, 0.2, 9.4, H - 0.22, -0.95, { n: 3, r: 0.05 });
  P.pipeRun(w, 0.2, 5.0, 1.62, -1.05, { n: 2, r: 0.035 });
  P.cableTray(w, 0.2, 9.4, H - 0.55, 0.92, { cables: 11 });
  P.cableTray(w, 0.2, 9.4, H - 0.92, 0.92, { cables: 9 });
  P.cableTray(w, 0.2, 6.4, H - 0.55, -0.55, { cables: 7 });

  // drops into the ceiling, one under each flat
  for (let i = 0; i < 9; i++) {
    const x = 0.9 + i * 0.95;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.42, 6),
      simple(0x2c2c30, { rough: 0.85 }));
    c.position.set(x, H - 0.2, 0.72);
    w.add(c);
    const jb = w.box(0.16, 0.20, 0.09, simple(0x4a4a44, { rough: 0.7, metal: 0.3 }),
      x, H - 0.62, 0.74, { solid: false });
    jb.castShadow = false;
  }

  // leg B gets its own bundle, and it is the fattest one down here
  const legB = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 6.6, 6),
      simple([0x2a2a2e, 0x6a2a1e, 0x2a4a2a, 0x54542a][i % 4], { rough: 0.85 }));
    c.rotation.x = Math.PI / 2;
    c.position.set(8.56 + (i % 5) * 0.035, H - 0.35 - Math.floor(i / 5) * 0.05, 4.8);
    legB.add(c);
  }
  w.add(legB);

  // a corner of unopened parcels, addressed to flats that are not yours
  P.parcel(w, 1.05, -0.86, { rotY: 0.1 });
  P.parcel(w, 1.55, -0.90, { rotY: -0.24 });
  const stack = P.parcel(w, 1.28, -0.88, { rotY: 0.5 });
  stack.position.y = 0.31;

  // ---------------------------------------------------------------- the panel
  //
  // Somebody has labelled every terminal, in stencil, and the labels are the
  // most frightening thing in the building because they are just filing.
  const pan = liveCanvas(512, 384);
  {
    const { ctx, cv } = pan;
    ctx.fillStyle = '#c3bda6';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#8d8874';
    ctx.fillRect(0, 0, cv.width, 34);
    ctx.fillStyle = '#1e1a12';
    ctx.font = 'bold 19px "Courier New", monospace';
    ctx.fillText('PANEL 74-C   BLOCK  DISTRIBUTION', 12, 24);
    ctx.font = '15px "Courier New", monospace';
    const rows = [
      ['FLAT 01', 'CAM 01-08', 'LIVE'],
      ['FLAT 02', 'CAM 01-08', 'LIVE'],
      ['FLAT 03', '—', 'VACANT'],
      ['FLAT 04', 'CAM 01-12', 'LIVE'],
      ['FLAT 05', 'CAM 01-08', 'LIVE'],
      ['FLAT 06', '—', 'CONCLUDED'],
      ['FLAT 07', 'CAM 01-08', 'LIVE'],
      ['FLAT 08', '—', 'CONCLUDED'],
      ['FLAT 09', 'CAM 01-08', 'LIVE'],
      ['FLAT 10', '—', 'VACANT'],
      ['FLAT 11', 'CAM 01-12', 'PANEL'],
      ['ROOF', 'CAM 20-22', 'LIVE'],
    ];
    rows.forEach(([a, b, c], i) => {
      const y = 62 + i * 26;
      const mine = a === 'FLAT 11';
      ctx.fillStyle = mine ? '#8a2018' : '#242018';
      ctx.fillText(a, 16, y);
      ctx.fillText(b, 150, y);
      ctx.fillText(c, 320, y);
      ctx.strokeStyle = 'rgba(60,54,40,0.4)';
      ctx.beginPath();
      ctx.moveTo(12, y + 7);
      ctx.lineTo(cv.width - 12, y + 7);
      ctx.stroke();
      // a terminal screw beside each row
      ctx.fillStyle = '#8a8272';
      ctx.beginPath();
      ctx.arc(cv.width - 30, y - 5, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#4a4436';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('VALCO HOME PRODUCTS — VIEWER SERVICES — DO NOT ISOLATE', 16, 372);
    pan.touch();
  }
  const panelBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.50),
    new THREE.MeshStandardMaterial({ map: pan.tex, roughness: 0.72 })
  );
  panelBoard.position.set(5.4, 1.44, -1.12);
  w.add(panelBoard);
  w.box(0.76, 0.60, 0.10, simple(0x40443e, { rough: 0.6, metal: 0.35 }), 5.4, 1.44, -1.16, { solid: false });

  // ---------------------------------------------------------------- the door
  const services = P.servicesDoor(w, 9.0, 8.16, Math.PI);

  // ---------------------------------------------------------------- light
  w.light(new THREE.AmbientLight(0x33363c, 0.55), 'ambient');
  w.light(new THREE.HemisphereLight(0x3d4048, 0x1c1a12, 0.42), 'ambient');

  const fittings = [];
  const mkFitting = (x, z, o = {}) => {
    const body = w.box(0.62, 0.10, 0.14, simple(0xd0ccbc, { rough: 0.6 }), x, H - 0.10, z, { solid: false });
    body.castShadow = false;
    const tubeMat = simple(0xfff4dc, { rough: 0.5, emissive: 0xfff0cc, emissiveIntensity: o.dead ? 0 : 1.1 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.56, 8), tubeMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(x, H - 0.16, z);
    w.add(tube);
    const l = new THREE.PointLight(0xffeccc, o.dead ? 0 : 17, 6.5, 2);
    l.position.set(x, H - 0.22, z);
    w.light(l, 'practical');
    const rec = { light: l, mat: tubeMat, base: o.dead ? 0 : 17, bad: !!o.bad, dead: !!o.dead, phase: Math.random() * 6 };
    fittings.push(rec);
    return rec;
  };

  mkFitting(1.1, 0);
  mkFitting(3.5, 0, { bad: true });      // this one buzzes
  mkFitting(5.9, 0);
  mkFitting(8.3, 0, { dead: true });     // and this one is simply out
  mkFitting(9.0, 2.6, { dead: true });   // so is the first of leg B
  mkFitting(9.0, 5.2, { bad: true });
  mkFitting(9.0, 7.5);

  // the one over the door is the only healthy thing down here
  const doorLight = new THREE.SpotLight(0xffe0b0, 26, 9, 0.8, 0.6, 1.5);
  doorLight.position.set(9.0, H - 0.3, 6.9);
  doorLight.target.position.set(9.0, 1.0, 8.1);
  doorLight.castShadow = true;
  doorLight.shadow.mapSize.set(1024, 1024);
  doorLight.shadow.camera.near = 0.4;
  doorLight.shadow.camera.far = 12;
  w.add(doorLight.target);
  w.light(doorLight, 'practical');

  let t = 0;
  w.onTick((dt) => {
    t += dt;
    for (const f of fittings) {
      if (f.dead) continue;
      if (!f.bad) continue;
      // a failing tube strikes, holds, gives up, strikes again
      const n = Math.sin(t * 21 + f.phase) * Math.sin(t * 3.1 + f.phase * 2);
      const on = n > -0.35 ? 1 : (Math.random() < 0.4 ? 0.25 : 0);
      f.light.intensity = f.base * on;
      f.mat.emissiveIntensity = 1.1 * on;
    }
  });

  // ---------------------------------------------------------------- things
  w.addInteract({
    id: 'panel', key: 'E', r: 2.0, cone: 0.6,
    pos: { x: 5.4, y: 1.44, z: -1.00 },
    label: 'READ THE PANEL',
  });
  w.addInteract({
    id: 'bell', key: 'E', r: 1.9, cone: 0.5,
    pos: { x: 9.62, y: 1.16, z: 8.12 },
    label: 'RING FOR ATTENTION',
  });
  w.addInteract({
    id: 'door', key: 'E', r: 2.2, cone: 0.4, enabled: false,
    pos: { x: 9.0, y: 1.10, z: 8.05 },
    label: 'GO IN',
  });

  // ---------------------------------------------------------------- cameras
  w.camSpot('corridor', { x: 9.30, y: H - 0.18, z: -0.95 }, { x: 3.0, y: 1.0, z: 0.2 },
    { num: 21, fov: 92, room: 'basement' });
  w.camSpot('liftcar', { x: -1.50, y: CARH - 0.16, z: -0.72 }, { x: -0.6, y: 1.0, z: 0.2 },
    { num: 22, fov: 88, room: 'lift' });
  w.camSpot('legb', { x: 8.56, y: H - 0.2, z: 1.5 }, { x: 9.0, y: 1.0, z: 6.5 },
    { num: 23, fov: 90, room: 'basement' });

  w.props = {
    services,
    doors: { left: leftDoor, right: rightDoor },
    fittings,
    doorLight,
    /** Shut the lift behind you. It is not dramatic; it is just a lift. */
    closeLift(k) {
      leftDoor.position.z = -1.24 + k * 0.82;
      rightDoor.position.z = 1.24 - k * 0.82;
    },
  };
  return w;
}
