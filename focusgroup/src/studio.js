// FOCUS GROUP — the soundstage.
//
// Sunday. You do not wake up in your bed. You wake standing on a mark, in
// three walls of your own living room, built true, with the right wallpaper
// and the sofa in the right relation to the television. Everything is where
// you left it except the east wall, and where that was there is a lighting
// grid, two cameras, a wall of monitors and six rows of seats with people in
// them.
//
// The set reuses the flat's own coordinates on purpose. It should take a
// second to work out what is wrong, and then no time at all.

import * as THREE from 'three';
import { World, scalePlaneUVs, skirting } from './world.js';
import { material, simple } from './textures.js';
import * as P from './props.js';
import { FLAT } from './apartment.js';

const SETH = 3.20;    // the walls stop here. There is nothing above them.

// facing west, into the set, with all of it behind you
export const STUDIO_SPAWN = { x: -0.85, y: 0, z: -2.80, yaw: Math.PI * 0.5 };

export const MARKS = [
  { id: 'wake', x: -0.85, z: -2.80, label: 'where you woke up' },
  { id: 'window', x: -2.00, z: 0.55, label: 'the window' },
  { id: 'centre', x: -2.35, z: -0.30, label: 'the mark' },
];

function backOfFlat(w, x0, z0, x1, z1) {
  // bracing, a stencilled flat number and a sandbag. A wall is a wall from
  // one side and a job from the other.
  const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const ply = simple(0x8a6a42, { rough: 0.95 });
  const timber = simple(0x9a7a4a, { rough: 0.95 });
  const nx = horiz ? 0 : 1, nz = horiz ? 1 : 0;
  const sx = Math.min(x0, x1), sz = Math.min(z0, z1);
  const off = 0.075;

  const back = new THREE.Mesh(new THREE.PlaneGeometry(len, SETH), ply);
  back.position.set(
    horiz ? sx + len / 2 : x0 - nx * off,
    SETH / 2,
    horiz ? z0 - nz * off : sz + len / 2
  );
  back.rotation.y = horiz ? Math.PI : -Math.PI / 2;
  w.add(back);

  for (let d = 0.5; d < len; d += 1.2) {
    const px = horiz ? sx + d : x0 - nx * 0.22;
    const pz = horiz ? z0 - nz * 0.22 : sz + d;
    // a raking brace, foot on the deck, head on the flat
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.3, 0.06), timber);
    brace.position.set(px, 1.55, pz);
    brace.rotation[horiz ? 'x' : 'z'] = horiz ? -0.28 : 0.28;
    w.add(brace);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.22), simple(0x4a4436, { rough: 1 }));
    bag.position.set(horiz ? px : px - nx * 0.35, 0.065, horiz ? pz - nz * 0.35 : pz);
    w.add(bag);
  }
}

export function buildStudio(dress = {}) {
  const w = new World('studio');
  w.bounds = { x0: -9.0, x1: 19.0, z0: -11.0, z1: 11.0 };

  w.room('set', FLAT.living.x0, FLAT.living.z0, FLAT.living.x1, FLAT.living.z1, 'carpet');
  w.room('set', FLAT.kitchen.x0, FLAT.kitchen.z0, FLAT.kitchen.x1, FLAT.kitchen.z1, 'lino');
  w.room('house', 8.0, -8.0, 19.0, 8.0, 'stage');
  w.room('stage', -9.0, -11.0, 19.0, 11.0, 'stage');

  // ---------------------------------------------------------------- the deck
  w.slab(-9.0, 19.0, -11.0, 11.0, -0.002, 'stageFloor');
  // the set's own floor, laid on top of it, and it stops where the set stops
  w.slab(FLAT.living.x0, FLAT.living.x1, FLAT.living.z0, FLAT.living.z1, 0.004, 'carpet');
  w.slab(FLAT.kitchen.x0, FLAT.kitchen.x1, FLAT.kitchen.z0, FLAT.kitchen.z1, 0.004, 'lino');

  // taped cable runs across the deck, going nowhere you can follow
  const tape = simple(0x1c1c1e, { rough: 0.9 });
  for (const [x0, z0, x1, z1] of [[4.2, -6.0, 4.2, 4.0], [4.2, 1.2, 12.0, 1.2], [5.6, -6.0, 5.6, 0.4]]) {
    const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const geo = new THREE.PlaneGeometry(horiz ? len : 0.30, horiz ? 0.30 : len);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, tape);
    m.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2);
    w.add(m);
  }

  // ---------------------------------------------------------------- the set
  const PAPER = 'wallpaper';
  // west wall
  w.wall(FLAT.living.x0, FLAT.living.z1, FLAT.living.x0, FLAT.bedroom.z1, PAPER, { h: SETH });
  // north wall, all the way across, with the hall openings bricked up because
  // there is no hall — the set is only the bit that gets photographed
  w.wall(FLAT.living.x0, FLAT.living.z0, FLAT.kitchen.x1, FLAT.living.z0, PAPER, { h: SETH });
  // south wall, with the window in it
  w.wall(FLAT.living.x0, FLAT.living.z1, FLAT.kitchen.x1, FLAT.living.z1, PAPER, {
    h: SETH,
    holes: [{ at: 0.8, w: 2.4, y0: 0.95, y1: 2.20 }],
  });
  // and the stub between the two rooms
  w.wall(0.2, FLAT.living.z0, 0.2, -1.3, PAPER, { h: SETH });
  [[-4.0, 1.35, 0.2, 1.35], [-4.0, -3.55, 3.4, -3.55], [-3.95, -3.6, -3.95, 1.4]]
    .forEach((r) => skirting(w, r[0], r[1], r[2], r[3]));

  // the backs of the two walls you can walk around to
  backOfFlat(w, FLAT.living.x0, FLAT.living.z0, FLAT.kitchen.x1, FLAT.living.z0);
  backOfFlat(w, FLAT.living.x0, FLAT.living.z0, FLAT.living.x0, FLAT.living.z1);

  // the flat number, stencilled on the back of the north wall by somebody
  // whose job is to know which flat is which
  {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,0)';
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#2a2018';
    c.font = 'bold 84px "Courier New", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('FLAT 11', 256, 64);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1 }));
    m.position.set(-0.6, 2.35, FLAT.living.z0 - 0.08);
    m.rotation.y = Math.PI;
    w.add(m);
  }

  // ---- the window. There is a view in it and it is your view, in paint.
  const win = P.window7(w, -2.00, 1.33, { w: 2.40, h: 1.25, y: 0.95 });
  win.glass.visible = false;
  {
    const geo = new THREE.PlaneGeometry(4.2, 3.0);
    const m = material('paintedView');
    scalePlaneUVs(geo, 4.2, 3.0, m.userData.tile);
    const backing = new THREE.Mesh(geo, m);
    backing.position.set(-2.0, 1.5, 2.45);
    backing.rotation.y = Math.PI;
    w.add(backing);
    // and the frame it is stretched on, visible from the side
    w.box(4.3, 0.08, 0.08, simple(0x9a7a4a, { rough: 0.95 }), -2.0, 3.02, 2.50, { solid: false });
    w.box(0.08, 3.1, 0.08, simple(0x9a7a4a, { rough: 0.95 }), -4.1, 1.5, 2.50, { solid: false });
    w.box(0.08, 3.1, 0.08, simple(0x9a7a4a, { rough: 0.95 }), 0.1, 1.5, 2.50, { solid: false });
  }

  // ---- dressed exactly as you left it
  const tv = P.television(w, -3.58, -1.20, Math.PI / 2);
  P.sofa(w, -1.30, -1.20, -Math.PI / 2);
  P.coffeeTable(w, -2.44, -1.20);
  P.sideboard(w, -2.00, -3.32, 0);
  const lamp = P.standardLamp(w, -3.58, 0.85);
  P.radiator(w, -2.00, 1.26, 0);
  P.counterRun(w, 1.30, 3.20, 1.05, { face: -1 });
  P.sink(w, 2.00, 1.05);
  P.dinetteTable(w, 1.70, -1.70);
  P.chair(w, 1.70, -2.42, 0);
  const coffee = P.coffeeMaker(w, 2.86, 1.02, Math.PI);
  P.mug(w, 2.55, 0.825, 1.02, { lens: false });
  P.figurine(w, -0.60, 0.425, -1.10, { lens: false });

  // ---- the marks, taped down where the script wants you
  const marks = MARKS.map((m) => P.floorMark(w, m.x, m.z, m.id === 'window' ? 0.4 : 0));

  // ---------------------------------------------------------------- the house
  const aud = P.audience(w, 11.6, -2.6, { rows: 6, per: 15, rotY: -Math.PI / 2 });
  const sign = P.applauseSign(w, 11.2, 3.35, -2.6, { rotY: -Math.PI / 2 });

  // blackness behind and above everything
  const drape = material('blackDrape');
  [[19.0, -11.0, 19.0, 11.0, -Math.PI / 2], [-9.0, -11.0, 19.0, -11.0, 0],
    [-9.0, 11.0, 19.0, 11.0, Math.PI], [-9.0, -11.0, -9.0, 11.0, Math.PI / 2]]
    .forEach(([x0, z0, x1, z1]) => {
      const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      const geo = new THREE.PlaneGeometry(len, 8);
      scalePlaneUVs(geo, len, 8, drape.userData.tile);
      const m = new THREE.Mesh(geo, drape);
      m.position.set((x0 + x1) / 2, 4, (z0 + z1) / 2);
      m.rotation.y = horiz ? (z0 < 0 ? 0 : Math.PI) : (x0 < 0 ? Math.PI / 2 : -Math.PI / 2);
      w.add(m);
      w.solid(Math.min(x0, x1) - 0.2, Math.max(x0, x1) + 0.2,
        Math.min(z0, z1) - 0.2, Math.max(z0, z1) + 0.2, 0, 8, 'wall');
    });
  w.slab(-9.0, 19.0, -11.0, 11.0, 8.0, drape, { up: false });

  // ---------------------------------------------------------------- the rig
  const truss = simple(0x33333a, { rough: 0.6, metal: 0.45 });
  for (const z of [-4.2, -1.0, 2.2]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 15, 8), truss);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(2.0, 4.35, z);
    w.add(bar);
    for (let i = 0; i < 5; i++) {
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 3.5, 6), truss);
      drop.position.set(-4.5 + i * 3.4, 6.1, z);
      w.add(drop);
    }
  }
  const bars = [
    P.lightBar(w, -0.8, 4.15, -4.2, { w: 6.0, n: 5, tilt: 0.62 }),
    P.lightBar(w, -0.8, 4.15, -1.0, { w: 6.0, n: 5, tilt: 0.48 }),
    P.lightBar(w, 1.2, 4.15, 2.2, { w: 5.0, n: 4, tilt: 0.55 }),
  ];
  bars.forEach((b) => b.setLevel(0));

  // the lamps have to actually put light in the room, not just glow
  const keys = [];
  for (const [x, z, col, ang] of [
    [-0.8, -4.2, 0xfff0d2, 0.85], [-0.8, -1.0, 0xfff4dc, 0.9], [1.2, 2.2, 0xffe8c8, 0.8],
  ]) {
    const sp = new THREE.SpotLight(col, 0, 26, ang, 0.55, 1.2);
    sp.position.set(x, 4.0, z);
    sp.target.position.set(x - 1.6, 1.0, z - 0.4);
    w.add(sp.target);
    w.light(sp, 'rig');
    keys.push(sp);
  }
  const bounce = new THREE.PointLight(0xdce8ff, 0, 18, 1.5);
  bounce.position.set(4.0, 3.0, -1.0);
  w.light(bounce, 'rig');
  keys.push(bounce);
  w.setLightScale('rig', 0);

  // ---------------------------------------------------------------- cameras
  const camWide = P.studioCamera(w, 6.20, -0.40, { rotY: -Math.PI / 2 });
  const camClose = P.studioCamera(w, 5.10, 2.30, { rotY: -Math.PI / 2 - 0.45 });
  camWide.setLive(false);
  camClose.setLive(false);

  // ---------------------------------------------------------------- monitors
  const monitors = P.monitorWall(w, 6.60, 1.55, -6.40, { cols: 8, rows: 5, w: 4.6, h: 2.1, rotY: -0.72 });
  monitors.light.intensity = 34;

  // ---- the thirteenth camera. It is on a stand behind the seats and it is
  // turned around, and what it is pointed at is the audience.
  const last = P.studioCamera(w, 16.8, -2.6, { rotY: Math.PI / 2 });
  last.group.scale.setScalar(0.82);
  const lastLensAnchor = new THREE.Object3D();
  lastLensAnchor.position.set(16.2, 1.28, -2.6);
  w.add(lastLensAnchor);

  // ---------------------------------------------------------------- VAL
  const val = P.valMascot(w, 4.30, -7.40, { rotY: 1.9 });

  // ---------------------------------------------------------------- working light
  // One lamp on a stand, which is all a stage gets when nothing is being shot.
  const workGroup = new THREE.Group();
  workGroup.position.set(3.4, 0, -4.6);
  const tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.9, 8), simple(0x2a2a2e, { rough: 0.6 }));
  tripod.position.y = 0.95;
  workGroup.add(tripod);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10),
    simple(0xfff0d0, { rough: 0.4, emissive: 0xffe8b8, emissiveIntensity: 1.6 }));
  head.position.y = 1.95;
  workGroup.add(head);
  w.add(workGroup);
  const workLight = new THREE.PointLight(0xffe0b0, 55, 20, 1.7);
  workLight.position.set(3.4, 1.95, -4.6);
  workLight.castShadow = true;
  workLight.shadow.mapSize.set(1024, 1024);
  workLight.shadow.camera.near = 0.4;
  workLight.shadow.camera.far = 24;
  w.light(workLight, 'practical');

  w.light(new THREE.AmbientLight(0x363b4a, 1.35), 'ambient');
  w.light(new THREE.HemisphereLight(0x3c4250, 0x1a1810, 0.72), 'ambient');
  // house lights: enough to know how many people are out there and no more
  for (const [hx, hz] of [[10.5, -4.0], [10.5, 1.4], [15.0, -1.4]]) {
    const h = new THREE.PointLight(0x8fa2c8, 52, 18, 1.6);
    h.position.set(hx, 4.6, hz);
    w.light(h, 'practical');
  }

  // ---------------------------------------------------------------- things
  w.addInteract({
    id: 'monitors', key: 'E', r: 3.0, cone: 0.5,
    pos: { x: 5.9, y: 1.55, z: -5.70 },
    label: 'LOOK AT THE MONITORS',
  });
  w.addInteract({
    id: 'window', key: 'E', r: 2.0, cone: 0.4,
    pos: { x: -2.00, y: 1.45, z: 1.20 },
    label: 'CROSS TO THE WINDOW',
  });
  w.addInteract({
    id: 'val', key: 'E', r: 2.6, cone: 0.4, enabled: false,
    pos: { x: 0.0, y: 1.5, z: 0.0 },
    label: 'VAL',
  });
  w.addInteract({
    id: 'mark', key: 'E', r: 1.4, cone: -1, enabled: false,
    pos: { x: -2.35, y: 1.45, z: -0.30 },
    label: 'HIT THE MARK',
  });
  w.addInteract({
    id: 'line', key: 'E', r: 1.6, cone: -1, enabled: false,
    pos: { x: -2.35, y: 1.45, z: -0.30 },
    label: 'SAY THE LINE',
  });
  w.addInteract({
    id: 'lens:last', lens: 'last', key: 'Q', r: 3.2, cone: 0.92, enabled: false,
    pos: { x: 16.2, y: 1.28, z: -2.6 },
    label: 'a camera on the far side of the seats, and it is turned around',
  });

  // ---------------------------------------------------------------- angles
  //
  // On Sunday every frame of the game is one of these, because there is no
  // longer anywhere to stand that is not in shot.
  w.camSpot('studio-wide', { x: 6.05, y: 1.60, z: -0.40 }, { x: -2.35, y: 1.15, z: -0.30 },
    { num: 1, fov: 62, room: 'set', track: true });
  w.camSpot('studio-close', { x: 4.95, y: 1.58, z: 2.20 }, { x: -2.35, y: 1.32, z: -0.30 },
    { num: 2, fov: 38, room: 'set', track: true });
  w.camSpot('studio-high', { x: -2.30, y: 4.05, z: -0.40 }, { x: -2.35, y: 0.2, z: -0.30 },
    { num: 3, fov: 74, room: 'set' });
  w.camSpot('studio-house', { x: 13.4, y: 2.85, z: -2.60 }, { x: -2.2, y: 1.1, z: -0.6 },
    { num: 4, fov: 46, room: 'set' });
  w.camSpot('studio-mon', { x: 6.30, y: 2.05, z: -5.90 }, { x: -2.0, y: 1.2, z: -0.8 },
    { num: 5, fov: 70, room: 'set' });
  w.camSpot('last', { x: 16.2, y: 1.30, z: -2.60 }, { x: 9.0, y: 1.4, z: -2.60 },
    { num: 0, fov: 68, room: 'house' });

  w.props = {
    bars, keys, bounce,
    cams: { wide: camWide, close: camClose, last },
    monitors, sign, val, tv, lamp, coffee, win, marks, aud,
    workLight, workHead: head,
    lastLensAnchor,
    /** Bring the grid up. One call, because a gallery op only makes one move. */
    rigUp(k) {
      bars.forEach((b) => b.setLevel(k));
      keys[0].intensity = k * 150;
      keys[1].intensity = k * 170;
      keys[2].intensity = k * 120;
      bounce.intensity = k * 26;
    },
    /** And take it down again, one bank at a time, the way a shop closes. */
    killBank(i) {
      const b = bars[Math.floor(i / 5)];
      if (b) b.killBank(i % 5);
      if (keys[Math.floor(i / 5)]) keys[Math.floor(i / 5)].intensity *= 0.35;
    },
    setWorkLight(v) {
      workLight.intensity = v ? 55 : 0;
      head.material.emissiveIntensity = v ? 1.6 : 0;
    },
  };
  return w;
}
