// Clash Tower interior: a glass skyscraper atrium. Six levels are stacked
// around an open well with a glass elevator riding up the middle; each floor
// runs a different kind of match. Outside the glass is the city at dusk.
import * as THREE from 'three';
import { Level } from './level.js';
import { PaintSystem, makeNoiseTexture } from './paint.js';
import { levelMaterials } from './materials.js';
import { signTexture } from './textures.js';
import { rng } from '../util.js';

export const FLOOR_H = 8;
export const HALF = 15;        // building half-width
export const WELL = 6;         // atrium half-width
export const CAR = 1.8;        // elevator car half-width
export const SHAFT_TOP = FLOOR_H * 5 + 5;

// kind: what the floor's terminal opens
export const TOWER_FLOORS = [
  { id: 'lobby', label: 'L', name: 'LOBBY', sub: 'CPU Turf Rush · exit to the plaza', accent: '#ff2e88', kind: 'cpu', mode: 'turf', term: 'CPU BATTLE' },
  { id: 'open', label: '2', name: 'OPEN BATTLE', sub: 'Online match — always looking for players', accent: '#19d3ff', kind: 'online', term: 'JOIN THE QUEUE' },
  { id: 'private', label: '3', name: 'PRIVATE ROOMS', sub: 'Make a room, share the code', accent: '#b04dff', kind: 'private', term: 'ROOM DESK' },
  { id: 'zones', label: '4', name: 'ZONE CLASH', sub: 'Hold the zones — vs CPUs', accent: '#ff8a1a', kind: 'cpu', mode: 'zones', term: 'ZONE CLASH' },
  { id: 'hoops', label: '5', name: 'HUE HOOPS', sub: 'Glowball basketball — vs CPUs', accent: '#3cf03c', kind: 'cpu', mode: 'hoops', term: 'HUE HOOPS' },
  { id: 'deck', label: 'R', name: 'SKY DECK', sub: 'Arcade · best view in the city', accent: '#ffd21a', kind: 'arcade', term: 'ARCADE' },
];

export const floorY = (i) => i * FLOOR_H;

function std(c, r = 0.6, m = 0.1, extra = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra }); }
function glow(c, i = 2.2) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false }); }

function windowTexture(seed, lit = 0.45, warm = true) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const x = c.getContext('2d');
  const R = rng(seed);
  x.fillStyle = '#05060c'; x.fillRect(0, 0, 256, 512);
  for (let r = 0; r < 64; r++) for (let k = 0; k < 16; k++) {
    if (R() > lit) continue;
    const t = R();
    x.fillStyle = warm ? (t < 0.6 ? '#ffd9a0' : t < 0.85 ? '#fff4e0' : '#9fd8ff') : (t < 0.5 ? '#bfe6ff' : '#ffffff');
    x.globalAlpha = 0.45 + R() * 0.55;
    x.fillRect(k * 16 + 3, r * 8 + 2, 10, 5);
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function screenTexture(draw, w = 512, h = 288) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const ctx = c.getContext('2d');
  const redraw = (...a) => { draw(ctx, w, h, ...a); t.needsUpdate = true; };
  redraw();
  return { tex: t, redraw, ctx };
}

function kioskFace(fl) {
  return screenTexture((x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b1530'); g.addColorStop(1, '#2d2160');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = fl.accent; x.globalAlpha = 0.25;
    for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(w * (0.1 + i * 0.14), h * (0.85 - (i % 3) * 0.08), 30 + i * 6, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
    x.strokeStyle = fl.accent; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '64px Bungee, "Arial Black", sans-serif'; x.fillStyle = '#fff';
    x.fillText(fl.term, w / 2, h * 0.4, w - 40);
    x.font = '26px "Lilita One", "Arial Black", sans-serif'; x.fillStyle = fl.accent;
    x.fillText('PRESS  E', w / 2, h * 0.72);
  });
}

export function buildTower(scene, renderer, env, opts = {}) {
  const paint = new PaintSystem({ size: 1024, tpm: 4 });
  paint.uniforms.uNoise.value = makeNoiseTexture(256);
  const level = new Level(paint);
  level.killY = -40;
  const B = (min, max, o = {}) => level.box(min, max, o);
  const F = TOWER_FLOORS;
  const floorColors = [0xf4f0fa, 0xe8f2f8, 0xefe8f8, 0xf8eee4, 0xe8f4e8, 0xe9e3d8];
  // ---- slabs (each slab's underside is the ceiling of the floor below)
  for (let i = 0; i < F.length; i++) {
    const y = floorY(i), c = floorColors[i];
    const mat = i === 5 ? 'floor' : 'concrete';
    const o = { mat, color: c, bottom: i > 0, paintable: true };
    if (i === 0) { B([-HALF, -0.6, -HALF], [HALF, 0, HALF], o); continue; }
    B([-HALF, y - 0.5, -HALF], [HALF, y, -WELL], o);
    B([-HALF, y - 0.5, WELL], [HALF, y, HALF], o);
    B([-HALF, y - 0.5, -WELL], [-WELL, y, WELL], o);
    B([WELL, y - 0.5, -WELL], [HALF, y, WELL], o);
    // bridge out to the elevator
    B([-1.7, y - 0.35, CAR + 0.1], [1.7, y, WELL], { mat: 'grate', color: 0xdfe6f2, bottom: true, paintable: false });
  }
  // roof of the elevator machine room (the shaft pokes above the deck)
  B([-2.6, SHAFT_TOP, -2.6], [2.6, SHAFT_TOP + 0.4, 2.6], { mat: 'concreteDark', color: 0x2b2f45, bottom: true, paintable: false });
  // ---- outer walls (glass rendered as decor) — collision only
  const top = floorY(5);
  for (const [a, b] of [[[-HALF - 0.4, -1, -HALF - 0.4], [HALF + 0.4, top, -HALF]], [[-HALF - 0.4, -1, HALF], [HALF + 0.4, top, HALF + 0.4]],
    [[-HALF - 0.4, -1, -HALF], [-HALF, top, HALF]], [[HALF, -1, -HALF], [HALF + 0.4, top, HALF]]]) B(a, b, { render: false, paintable: false });
  // deck parapet
  for (const [a, b] of [[[-HALF, top, -HALF], [HALF, top + 1.15, -HALF + 0.3]], [[-HALF, top, HALF - 0.3], [HALF, top + 1.15, HALF]],
    [[-HALF, top, -HALF], [-HALF + 0.3, top + 1.15, HALF]], [[HALF - 0.3, top, -HALF], [HALF, top + 1.15, HALF]]]) B(a, b, { render: false, paintable: false });
  // ---- elevator shaft (three walls; the south side has doors)
  B([-CAR - 0.25, -0.6, -CAR - 0.25], [-CAR, SHAFT_TOP, CAR + 0.1], { render: false, paintable: false });
  B([CAR, -0.6, -CAR - 0.25], [CAR + 0.25, SHAFT_TOP, CAR + 0.1], { render: false, paintable: false });
  B([-CAR, -0.6, -CAR - 0.25], [CAR, SHAFT_TOP, -CAR], { render: false, paintable: false });
  for (let i = 1; i < F.length; i++) B([-CAR, floorY(i) - 0.3, -CAR], [CAR, floorY(i), CAR + 0.1], { render: false, paintable: false });
  // ---- atrium railings (glass, rendered as decor)
  for (let i = 1; i < F.length; i++) {
    const y = floorY(i), h = 1.1;
    B([-WELL - 0.12, y, -WELL - 0.12], [WELL + 0.12, y + h, -WELL], { render: false, paintable: false });
    B([-WELL - 0.12, y, -WELL], [-WELL, y + h, WELL + 0.12], { render: false, paintable: false });
    B([WELL, y, -WELL], [WELL + 0.12, y + h, WELL + 0.12], { render: false, paintable: false });
    B([-WELL, y, WELL], [-1.7, y + h, WELL + 0.12], { render: false, paintable: false });
    B([1.7, y, WELL], [WELL, y + h, WELL + 0.12], { render: false, paintable: false });
    // bridge rails
    B([-1.82, y, CAR + 0.1], [-1.7, y + h, WELL], { render: false, paintable: false });
    B([1.7, y, CAR + 0.1], [1.82, y + h, WELL], { render: false, paintable: false });
  }
  // ---- furniture colliders (visuals are in the decor)
  const solid = (x0, y0, z0, x1, y1, z1) => B([x0, y0, z0], [x1, y1, z1], { render: false, paintable: false });
  const kiosks = [];
  for (let i = 0; i < F.length; i++) {
    const y = floorY(i);
    const k = i === 0 ? { x: -9, z: 6.5, yaw: Math.PI * 0.75 } : { x: 0, z: 10.6, yaw: Math.PI };
    k.y = y;
    k.spot = new THREE.Vector3(k.x + Math.sin(k.yaw) * 1.7, y, k.z + Math.cos(k.yaw) * 1.7);
    kiosks.push(k);
    solid(k.x - 0.7, y, k.z - 0.7, k.x + 0.7, y + 1.4, k.z + 0.7);
  }
  // lobby: reception desk + sofas
  solid(-5, 0, -12.6, 5, 1.1, -11.2);
  solid(8, 0, 6, 12.5, 0.55, 7.4); solid(8, 0, 10, 12.5, 0.55, 11.4);
  // floor 2 sofas, floor 3 lounge, floor 5 hoop post
  for (const zz of [-11, 11]) solid(8.5, floorY(1), zz - 0.7, 12.5, floorY(1) + 0.55, zz + 0.7);
  solid(-12.5, floorY(2), -3, -11, floorY(2) + 0.55, 3);
  solid(13.4, floorY(4), -0.4, 14.2, floorY(4) + 4, 0.4);
  // deck: arcade cabinet, telescopes, benches
  for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) solid(x - 0.4, top, z - 0.4, x + 0.4, top + 1.4, z + 0.4);

  level.build();
  paint.finalize();
  paint.bakeAO((p) => level.sdf(p));
  const mats = levelMaterials(paint);
  level.buildMeshes(mats, scene);
  const decor = buildTowerDecor(scene, kiosks, opts);
  return { level, paint, mats, decor, kiosks, bounds: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF } };
}

function buildTowerDecor(scene, kiosks, opts) {
  const g = new THREE.Group();
  scene.add(g);
  const F = TOWER_FLOORS;
  const updaters = [];
  const textures = [];
  const add = (m, castShadow = false) => { m.castShadow = castShadow; m.receiveShadow = true; g.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, cs = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(m, cs); };
  const plane = (w, h, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  const neon = (txt, w, h, size, accent, x, y, z, ry = 0, bg = '#1b1e2b') => {
    const t = signTexture(txt, { w: 1024, h: Math.round(1024 * h / w), size, accent, bg });
    textures.push(t);
    return plane(w, h, new THREE.MeshBasicMaterial({ map: t, toneMapped: false, transparent: !bg }), x, y, z, ry);
  };
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd6ff, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  const railGlass = new THREE.MeshStandardMaterial({ color: 0xcfeaff, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const metal = std(0x2b2f45, 0.35, 0.8);
  const steel = std(0xd8dde8, 0.25, 0.9);
  const white = std(0xf6f3ff, 0.5, 0.05);
  const dark = std(0x1b1e2b, 0.5, 0.3);
  const top = floorY(5);

  // ---- city outside (instanced skyline + streets)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(0x1d2030, 0.95, 0));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.7; ground.receiveShadow = false; g.add(ground);
  const R = rng(77);
  const tops = [];
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  for (let set = 0; set < 3; set++) {
    const tex = windowTexture(11 + set * 7, 0.35 + set * 0.12, set !== 2);
    textures.push(tex);
    const mat = new THREE.MeshStandardMaterial({ color: [0x30384f, 0x3a3150, 0x253b4a][set], roughness: 0.4, metalness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.1 });
    const n = 70;
    const im = new THREE.InstancedMesh(bGeo, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = 46 + R() * 210;
      // the tower is the tallest thing around: low blocks near, taller ones far away
      const w = 10 + R() * 18, d = 10 + R() * 18, h = 8 + R() * (r < 90 ? 20 : r < 160 ? 34 : 56) + (R() < 0.08 ? 30 : 0);
      p.set(Math.cos(a) * r, -0.7, Math.sin(a) * r);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 0.4);
      s.set(w, h, d);
      im.setMatrixAt(i, m4.compose(p, q, s));
      if (h > 34) tops.push([p.x, h - 0.7 + 0.8, p.z]);
    }
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }
  // rooftop beacons on the skyline
  const beaconGeo = new THREE.SphereGeometry(0.6, 8, 6);
  const beacons = new THREE.InstancedMesh(beaconGeo, glow(0xff3050, 3), Math.max(1, tops.length));
  {
    const m4 = new THREE.Matrix4();
    tops.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); beacons.setMatrixAt(i, m4); });
    beacons.count = tops.length;
  }
  g.add(beacons);
  updaters.push((t) => { beacons.visible = Math.sin(t * 2.4) > -0.2; });

  // ---- curtain walls
  for (let i = 0; i < 5; i++) {
    const y = floorY(i) + FLOOR_H / 2;
    for (const [x, z, ry] of [[0, -HALF, 0], [0, HALF, Math.PI], [-HALF, 0, Math.PI / 2], [HALF, 0, -Math.PI / 2]]) {
      const pl = plane(HALF * 2, FLOOR_H, glass, x, y, z, ry);
      pl.renderOrder = 2;
    }
  }
  // mullions + slab edge bands
  const mullG = new THREE.BoxGeometry(0.16, 1, 0.22);
  const mullN = 4 * 11;
  const mull = new THREE.InstancedMesh(mullG, metal, mullN);
  {
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let j = 0; j <= 10; j++) {
      const u = -HALF + j * 3;
      for (const [x, z] of [[u, -HALF], [u, HALF], [-HALF, u], [HALF, u]]) { m4.makeScale(1, top, 1).setPosition(x, top / 2, z); mull.setMatrixAt(k++, m4); }
    }
  }
  mull.castShadow = true; g.add(mull);
  for (let i = 0; i <= 5; i++) {
    const y = floorY(i) - 0.25;
    for (const [w, d, x, z] of [[HALF * 2 + 0.6, 0.5, 0, -HALF], [HALF * 2 + 0.6, 0.5, 0, HALF], [0.5, HALF * 2, -HALF, 0], [0.5, HALF * 2, HALF, 0]]) box(w, 0.55, d, metal, x, y, z, false);
    // a light line along the outside of every slab
    for (const [w, d, x, z] of [[HALF * 2 + 0.7, 0.06, 0, -HALF - 0.28], [HALF * 2 + 0.7, 0.06, 0, HALF + 0.28], [0.06, HALF * 2 + 0.6, -HALF - 0.28, 0], [0.06, HALF * 2 + 0.6, HALF + 0.28, 0]]) box(w, 0.08, d, glow(F[i].accent, 1.6), x, y - 0.1, z, false);
  }

  // ---- atrium: railings, LED edges, hanging banners
  for (let i = 1; i < F.length; i++) {
    const y = floorY(i), fl = F[i], h = 1.1;
    const segs = [[WELL * 2 + 0.24, 0, -WELL - 0.06, 0], [WELL * 2 + 0.24, 0, WELL + 0.06, 0, true], [WELL * 2, -WELL - 0.06, 0, Math.PI / 2], [WELL * 2, WELL + 0.06, 0, Math.PI / 2]];
    for (const [len, x, z, ry, south] of segs) {
      if (south) {
        for (const sx of [-1, 1]) {
          const l = WELL - 1.7, cx = sx * (1.7 + l / 2);
          plane(l, h, railGlass, cx, y + h / 2, z, ry);
          box(l, 0.07, 0.1, steel, cx, y + h, z, false);
        }
      } else {
        const m = plane(len, h, railGlass, x, y + h / 2, z, ry);
        m.renderOrder = 1;
        const rail = box(ry ? 0.1 : len, 0.07, ry ? len : 0.1, steel, x, y + h, z, false);
        void rail;
      }
    }
    // LED edge of the well, in the floor's color
    const led = glow(fl.accent, 2.4);
    box(WELL * 2, 0.06, 0.06, led, 0, y - 0.04, -WELL - 0.02, false);
    box(WELL * 2, 0.06, 0.06, led, 0, y - 0.04, WELL + 0.02, false);
    box(0.06, 0.06, WELL * 2, led, -WELL - 0.02, y - 0.04, 0, false);
    box(0.06, 0.06, WELL * 2, led, WELL + 0.02, y - 0.04, 0, false);
    // bridge rails
    for (const sx of [-1.76, 1.76]) {
      plane(WELL - CAR - 0.1, h, railGlass, sx, y + h / 2, (WELL + CAR + 0.1) / 2, Math.PI / 2);
      box(0.08, 0.07, WELL - CAR - 0.1, steel, sx, y + h, (WELL + CAR + 0.1) / 2, false);
      box(0.05, 0.05, WELL - CAR - 0.1, led, sx, y + 0.03, (WELL + CAR + 0.1) / 2, false);
    }
  }
  // hanging banners down the well (one per floor, facing the elevator)
  for (let i = 0; i < 5; i++) {
    const fl = F[i];
    const t = signTexture(fl.name, { w: 256, h: 1024, size: 60, accent: fl.accent, bg: '#1b1530' });
    textures.push(t);
    const mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    // vertical text: rotate the plane so the sign reads top-down
    const m = plane(1.1, 4.2, mat, (i % 2 ? 1 : -1) * 4.6, floorY(i + 1) - 2.6, -4.6, Math.PI / 4 * (i % 2 ? -1 : 1));
    void m;
  }

  // ---- ceilings (smooth panels under each slab, with the well cut out) + light strips
  const ceilMat = std(0xf4f2fb, 0.9, 0);
  for (let i = 0; i < 5; i++) {
    const y = floorY(i + 1) - 0.505;
    for (const [w, d, x, z] of [[HALF * 2, HALF - WELL, 0, -(HALF + WELL) / 2], [HALF * 2, HALF - WELL, 0, (HALF + WELL) / 2], [HALF - WELL, WELL * 2, -(HALF + WELL) / 2, 0], [HALF - WELL, WELL * 2, (HALF + WELL) / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
      m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; g.add(m);
    }
  }
  const lightMat = glow(0xfff4e6, 1.4);
  for (let i = 0; i < 5; i++) {
    const y = floorY(i + 1) - 0.52;
    for (const [w, d, x, z] of [[18, 0.5, 0, -10.5], [18, 0.5, 0, 10.5], [0.5, 18, -10.5, 0], [0.5, 18, 10.5, 0]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lightMat);
      m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m);
    }
  }

  // ---- floor signage: big floor number + name on the north wall of each floor
  for (let i = 0; i < 5; i++) {
    const y = floorY(i), fl = F[i];
    neon(`${fl.label}  ${fl.name}`, 11, 1.6, 120, fl.accent, 0, y + 5.4, -HALF + 0.35);
    // floor label on the elevator shaft frame, facing the bridge
    neon(fl.label, 1.2, 1.2, 160, fl.accent, 0, y + 3.7, CAR + 0.14, 0);
  }

  // ---- terminals
  const kioskScreens = [];
  kiosks.forEach((k, i) => {
    const fl = F[i];
    const kg = new THREE.Group();
    kg.position.set(k.x, k.y, k.z); kg.rotation.y = k.yaw;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.75, 1.0, 24), white);
    base.position.y = 0.5; base.castShadow = true; kg.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.04, 8, 32), glow(fl.accent, 2.2));
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.0; kg.add(ring);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), metal);
    neck.position.set(0, 1.25, -0.1); kg.add(neck);
    const face = kioskFace(fl);
    textures.push(face.tex);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.84), new THREE.MeshBasicMaterial({ map: face.tex, toneMapped: false }));
    scr.position.set(0, 1.75, 0.02); scr.rotation.x = -0.25; kg.add(scr);
    const bez = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.96, 0.08), dark);
    bez.position.set(0, 1.75, -0.03); bez.rotation.x = -0.25; kg.add(bez);
    // glowing floor disc where you stand to use it
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(fl.accent).multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0.8 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(0, 0.03, 1.7); kg.add(disc);
    g.add(kg);
    kioskScreens.push({ disc, scr });
    if (i === 5) kg.visible = false; // the deck uses the arcade cabinet instead
  });
  updaters.push((t) => { for (const { disc } of kioskScreens) { disc.material.opacity = 0.55 + Math.sin(t * 3) * 0.25; disc.scale.setScalar(1 + Math.sin(t * 3) * 0.05); } });

  // ---- elevator: rails, cables, car
  for (const [x, z] of [[-CAR - 0.12, -CAR - 0.12], [CAR + 0.12, -CAR - 0.12], [-CAR - 0.12, CAR + 0.12], [CAR + 0.12, CAR + 0.12]]) {
    box(0.2, SHAFT_TOP + 0.6, 0.2, steel, x, SHAFT_TOP / 2 - 0.3, z);
    box(0.05, SHAFT_TOP, 0.05, glow(0xffffff, 1.2), x + Math.sign(x) * 0.11, SHAFT_TOP / 2, z + Math.sign(z) * 0.11, false);
  }
  // shaft glass (west / east / north sides)
  for (const [w, x, z, ry] of [[CAR * 2 + 0.4, 0, -CAR - 0.12, 0], [CAR * 2 + 0.2, -CAR - 0.12, 0, Math.PI / 2], [CAR * 2 + 0.2, CAR + 0.12, 0, Math.PI / 2]]) {
    const m = plane(w, SHAFT_TOP + 0.6, railGlass, x, SHAFT_TOP / 2 - 0.3, z, ry);
    m.renderOrder = 1;
  }
  // machine room on the deck
  box(5.2, 0.4, 5.2, metal, 0, SHAFT_TOP + 0.2, 0);
  neon('CLASH TOWER', 4.4, 0.7, 110, '#ff2e88', 0, SHAFT_TOP - 0.45, 2.62);
  const car = new THREE.Group();
  {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(CAR * 2, 0.16, CAR * 2), std(0x3a3f58, 0.4, 0.7));
    floor.position.y = -0.08; floor.receiveShadow = true; car.add(floor);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(CAR * 2 + 0.06, 0.05, CAR * 2 + 0.06), glow(0xff2e88, 2));
    edge.position.y = -0.17; car.add(edge);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(CAR * 2, 0.14, CAR * 2), metal);
    ceil.position.y = 3.3; car.add(ceil);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(CAR * 1.4, CAR * 1.4), glow(0xfff4e6, 1.6));
    lamp.rotation.x = Math.PI / 2; lamp.position.y = 3.22; car.add(lamp);
    for (const [x, z] of [[-CAR, -CAR], [CAR, -CAR], [-CAR, CAR], [CAR, CAR]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.3, 0.1), steel);
      post.position.set(x, 1.65, z); car.add(post);
    }
    for (const [x, z, ry] of [[0, -CAR, 0], [-CAR, 0, Math.PI / 2], [CAR, 0, Math.PI / 2]]) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(CAR * 2, 3.2), railGlass);
      gl.position.set(x, 1.6, z); gl.rotation.y = ry; gl.renderOrder = 1; car.add(gl);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(ry ? 0.06 : CAR * 1.8, 0.05, ry ? CAR * 1.8 : 0.06), steel);
      hand.position.set(x * 0.94, 1.0, z * 0.94); car.add(hand);
    }
    // cables up to the machine room
    for (const x of [-0.4, 0.4]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), dark);
      cable.position.set(x, 3.4, -0.4); cable.name = 'cable'; car.add(cable);
    }
  }
  // sliding doors
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.3, depthWrite: false });
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(CAR, 3.1, 0.05), doorMat);
  const doorR = doorL.clone();
  for (const d of [doorL, doorR]) { d.position.set(0, 1.55, CAR + 0.02); car.add(d); }
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(CAR * 2 + 0.1, 0.12, 0.12), glow(0xffffff, 1.4));
  doorFrame.position.set(0, 3.16, CAR + 0.04); car.add(doorFrame);
  // floor indicator inside the car
  const ind = screenTexture((x, w, h, label = 'L', name = 'LOBBY', accent = '#ff2e88', dir = 0) => {
    x.fillStyle = '#0b0d16'; x.fillRect(0, 0, w, h);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = accent; x.font = '120px Bungee, "Arial Black", sans-serif';
    x.fillText(label, w * 0.28, h * 0.52);
    x.fillStyle = '#fff'; x.font = '34px "Lilita One", "Arial Black", sans-serif';
    x.fillText(name, w * 0.68, h * 0.42, w * 0.6);
    x.fillStyle = accent; x.font = '40px sans-serif';
    x.fillText(dir > 0 ? '▲' : dir < 0 ? '▼' : '●', w * 0.68, h * 0.72);
  }, 512, 192);
  textures.push(ind.tex);
  const indScr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshBasicMaterial({ map: ind.tex, toneMapped: false }));
  indScr.position.set(0, 2.55, -CAR + 0.05); car.add(indScr);
  g.add(car);

  // ---- per-floor dressing
  const props = new THREE.Group(); g.add(props);
  const P = (m, x, y, z, ry = 0, cs = true) => { m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cs; m.receiveShadow = true; props.add(m); return m; };
  const sofa = (x, y, z, ry, color) => {
    const s = new THREE.Group();
    const mat = std(color, 0.85, 0);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.3), mat); seat.position.y = 0.25; s.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.3), mat); back.position.set(0, 0.8, -0.5); s.add(back);
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 1.3), mat); arm.position.set(sx * 1.85, 0.5, 0); s.add(arm); }
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return P(s, x, y, z, ry);
  };
  const planter = (x, y, z, h = 2.2) => {
    const pg = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.8, 16), white); pot.position.y = 0.4; pg.add(pot);
    const leafM = std(0x2f9e5a, 0.8, 0);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.45 + (i % 2) * 0.15, 10, 8), leafM);
      l.position.set(Math.cos(i * 1.3) * 0.3, 0.9 + i * (h - 0.9) / 5, Math.sin(i * 1.3) * 0.3); l.scale.y = 1.3; pg.add(l);
    }
    pg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return P(pg, x, y, z);
  };
  // L — LOBBY
  {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 1.4), white); P(desk, 0, 0.55, -11.9);
    P(new THREE.Mesh(new THREE.BoxGeometry(10.1, 0.08, 1.5), glow('#ff2e88', 2)), 0, 1.1, -11.9, 0, false);
    neon('WELCOME TO THE CLASH TOWER', 9, 0.9, 70, '#ff2e88', 0, 2.6, -HALF + 0.35);
    sofa(10.25, 0, 6.7, Math.PI, 0xff6fa8); sofa(10.25, 0, 10.7, 0, 0x7a5cff);
    for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13], [-4, 13.4], [4, 13.4]]) planter(x, 0, z);
    // exit doors (south wall)
    const door = plane(4.4, 3.6, new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe6b0, emissiveIntensity: 1.4 }), 0, 1.8, HALF - 0.05, Math.PI);
    void door;
    P(new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.2, 0.2), glow('#3cf03c', 2.2)), 0, 3.7, HALF - 0.1, 0, false);
    neon('EXIT TO PLAZA', 4, 0.6, 90, '#3cf03c', 0, 4.25, HALF - 0.08, Math.PI);
  }
  // rotation board in the lobby (updated by the mode)
  const board = screenTexture((x, w, h, names = [], stamp = '') => {
    const g2 = x.createLinearGradient(0, 0, w, h);
    g2.addColorStop(0, '#1b1530'); g2.addColorStop(1, '#3b1f5c');
    x.fillStyle = g2; x.fillRect(0, 0, w, h);
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillStyle = '#ffd21a'; x.font = '40px Bungee, "Arial Black", sans-serif';
    x.fillText('NOW PLAYING', 30, 50);
    x.fillStyle = '#fff'; x.font = '44px "Lilita One", "Arial Black", sans-serif';
    names.forEach((n, i) => { x.fillStyle = i ? '#19d3ff' : '#ff6fa8'; x.fillRect(30, 104 + i * 70, 10, 44); x.fillStyle = '#fff'; x.fillText(n, 56, 128 + i * 70, w - 80); });
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '24px "Lilita One", sans-serif'; x.fillText(stamp, 30, h - 30);
  }, 768, 320);
  textures.push(board.tex);
  const boardScr = plane(5.6, 2.33, new THREE.MeshBasicMaterial({ map: board.tex, toneMapped: false }), -HALF + 0.35, 3.2, -2, Math.PI / 2);
  void boardScr;

  // 2 — OPEN BATTLE: a world board with players blipping in
  const y2 = floorY(1);
  const world = screenTexture((x, w, h, t = 0, n = 0) => {
    x.fillStyle = '#071423'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(25,211,255,.18)'; x.lineWidth = 1;
    for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let i = 0; i < h; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
    const R2 = rng(5);
    for (let i = 0; i < 46; i++) {
      const px = R2() * w, py = 60 + R2() * (h - 90), ph = R2() * 6;
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.7 + ph));
      x.fillStyle = `rgba(${i % 3 ? '25,211,255' : '255,46,136'},${a})`;
      x.beginPath(); x.arc(px, py, 4 + a * 4, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#19d3ff'; x.font = '38px Bungee, "Arial Black", sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('OPEN BATTLE · LIVE', 24, 34);
    x.fillStyle = '#fff'; x.font = '26px "Lilita One", sans-serif'; x.textAlign = 'right';
    x.fillText(n ? `${n} in your lobby` : 'Queue up at the terminal', w - 24, 34);
  }, 1024, 384);
  textures.push(world.tex);
  plane(9, 3.4, new THREE.MeshBasicMaterial({ map: world.tex, toneMapped: false }), 0, y2 + 2.6, -HALF + 0.36);
  for (const zz of [-11, 11]) sofa(10.5, y2, zz, zz < 0 ? 0 : Math.PI, 0x19a8d8);
  for (const [x, z] of [[-13, -13], [-13, 13], [13, 0]]) planter(x, y2, z);

  // 3 — PRIVATE ROOMS: a corridor of room doors with status lights
  const y3 = floorY(2);
  const roomDoor = (x, z, ry, name, busy) => {
    const dg = new THREE.Group();
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, 0.12), std(0x2a2350, 0.4, 0.3)); d.position.y = 1.5; dg.add(d);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 0.06), glow(busy ? '#ff2e88' : '#3cf03c', 1.6)); fr.position.set(0, 1.6, -0.05); dg.add(fr);
    const t = signTexture(name, { w: 256, h: 96, size: 54, accent: '#b04dff' });
    textures.push(t);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); sg.position.set(0, 2.45, 0.07); dg.add(sg);
    return P(dg, x, y3, z, ry, false);
  };
  'ABCD'.split('').forEach((c, i) => roomDoor(HALF - 0.12, -9 + i * 5, -Math.PI / 2, `ROOM ${c}`, i % 2 === 0));
  'EFGH'.split('').forEach((c, i) => roomDoor(-HALF + 0.12, -9 + i * 5, Math.PI / 2, `ROOM ${c}`, i === 2));
  sofa(-11.75, y3, 0, Math.PI / 2, 0x7a3cc8);
  neon('MAKE A ROOM · SHARE THE CODE · PLAY WITH FRIENDS', 10, 0.8, 52, '#b04dff', 0, y3 + 2.4, -HALF + 0.36);

  // 4 — ZONE CLASH: a demo zone on the floor
  const y4 = floorY(3);
  const zone = new THREE.Group();
  {
    const zt = screenTexture((x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,138,26,0.35)'; x.fillRect(0, 0, w * 0.62, h);
      x.fillStyle = 'rgba(25,211,255,0.28)'; x.fillRect(w * 0.62, 0, w * 0.38, h);
      x.strokeStyle = '#fff'; x.lineWidth = 14; x.setLineDash([40, 22]); x.strokeRect(8, 8, w - 16, h - 16);
    }, 512, 256);
    textures.push(zt.tex);
    const zm = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: zt.tex, transparent: true, toneMapped: false, depthWrite: false }));
    zm.rotation.x = -Math.PI / 2; zm.position.set(-10, y4 + 0.02, -1); zone.add(zm);
    props.add(zone);
  }
  neon('HOLD THE ZONE', 6, 0.9, 80, '#ff8a1a', -HALF + 0.36, y4 + 2.6, -1, Math.PI / 2);
  for (const [x, z] of [[13, -13], [13, 13]]) planter(x, y4, z);

  // 5 — HUE HOOPS: a hoop on the east wall + court lines + a ball
  const y5 = floorY(4);
  {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.6), metal); P(post, 13.8, y5 + 2, 0);
    const bb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 2.8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.7 })); P(bb, 13.4, y5 + 4.1, 0);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.7, 1.0), glow('#3cf03c', 2)); P(sq, 13.33, y5 + 3.8, 0, 0, false);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 28), std(0xff7a00, 0.4, 0.6)); rim.rotation.x = Math.PI / 2; P(rim, 12.75, y5 + 3.4, 0);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.3, 0.6, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true })); P(net, 12.75, y5 + 3.1, 0, 0, false);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ color: 0x3cf03c, emissive: 0x1a7a1a, emissiveIntensity: 0.8, roughness: 0.4 }));
    P(ball, 9, y5 + 0.34, 3);
    updaters.push((t) => { ball.position.y = y5 + 0.34 + Math.abs(Math.sin(t * 2.2)) * 1.2; });
    const lines = screenTexture((x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 8;
      x.beginPath(); x.arc(w, h / 2, h * 0.42, Math.PI / 2, Math.PI * 1.5); x.stroke();
      x.strokeRect(w * 0.62, h * 0.3, w * 0.38, h * 0.4);
    }, 512, 512);
    textures.push(lines.tex);
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: lines.tex, transparent: true, depthWrite: false }));
    lm.rotation.x = -Math.PI / 2; lm.position.set(10, y5 + 0.02, 0); props.add(lm);
  }
  neon('SHOOT · DUNK · INK THE PAD', 7, 0.8, 64, '#3cf03c', 0, y5 + 2.6, -HALF + 0.36);
  for (const [x, z] of [[-13, -13], [-13, 13]]) planter(x, y5, z);

  // R — SKY DECK: open roof, telescopes, arcade cabinet, the spire
  {
    const cab = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.9), std(0x7a3cc8, 0.4, 0.2)); body.position.y = 1.05; cab.add(body);
    const face = screenTexture((x, w, h) => {
      x.fillStyle = '#2b1f5c'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffd21a'; x.font = '44px Bungee, "Arial Black", sans-serif'; x.textAlign = 'center';
      x.fillText('TONGUE', w / 2, 70); x.fillText('SNACK', w / 2, 120);
      x.fillStyle = '#ff6fa8'; x.beginPath(); x.ellipse(w / 2 - 40, 190, 50, 28, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#ff6fa8'; x.lineWidth = 8; x.beginPath(); x.moveTo(w / 2 + 4, 186); x.lineTo(w / 2 + 90, 150); x.stroke();
      x.fillStyle = '#2b2f45'; x.beginPath(); x.arc(w / 2 + 98, 146, 12, 0, Math.PI * 2); x.fill();
    }, 256, 256);
    textures.push(face.tex);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: face.tex, toneMapped: false }));
    sc.position.set(0, 1.55, 0.46); sc.rotation.x = -0.2; cab.add(sc);
    const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 0.95), glow('#ffd21a', 1.8)); marquee.position.y = 2.2; cab.add(marquee);
    const k = kiosks[5];
    cab.position.set(k.x, top, k.z); cab.rotation.y = k.yaw;
    cab.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    props.add(cab);
    for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
      const tg = new THREE.Group();
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.2, 8), steel); leg.position.y = 0.6; tg.add(leg);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 12), std(0xffd21a, 0.3, 0.7)); tube.rotation.z = Math.PI / 2.6; tube.position.set(0, 1.35, 0); tg.add(tube);
      tg.rotation.y = Math.atan2(x, z);
      P(tg, x, top, z);
    }
    for (const [x, z, ry] of [[-8, 13.6, 0], [8, 13.6, 0], [-13.6, 0, Math.PI / 2], [13.6, 0, Math.PI / 2]]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.45, 0.9), std(0xb08050, 0.7, 0));
      P(bench, x, top + 0.225, z, ry);
    }
    // parapet glass + LED
    for (const [w, x, z, ry] of [[HALF * 2, 0, -HALF + 0.15, 0], [HALF * 2, 0, HALF - 0.15, 0], [HALF * 2, -HALF + 0.15, 0, Math.PI / 2], [HALF * 2, HALF - 0.15, 0, Math.PI / 2]]) {
      plane(w, 1.15, railGlass, x, top + 0.575, z, ry);
      box(ry ? 0.12 : w, 0.08, ry ? w : 0.12, steel, x, top + 1.15, z, false);
      box(ry ? 0.06 : w, 0.05, ry ? w : 0.06, glow('#ffd21a', 2), x, top + 0.04, z, false);
    }
    // spire + beacon
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.5, 22, 10), steel);
    P(spire, 0, SHAFT_TOP + 11.4, 0);
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.12, 0.05, 6, 24), glow('#ff2e88', 2.4));
      r.rotation.x = Math.PI / 2; P(r, 0, SHAFT_TOP + 3 + i * 3.5, 0, 0, false);
    }
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), glow('#ff3050', 4));
    P(beacon, 0, SHAFT_TOP + 22.6, 0, 0, false);
    updaters.push((t) => { beacon.visible = Math.sin(t * 3) > 0; });
    neon('SKY DECK', 5, 0.9, 110, '#ffd21a', 0, SHAFT_TOP - 1.4, -2.62, Math.PI);
  }

  const setIndicator = (i, dir) => { const f = F[i]; ind.redraw(f.label, f.name, f.accent, dir); };
  setIndicator(0, 0);
  return {
    group: g, car, doorL, doorR, setIndicator,
    setBoard: (names, stamp) => board.redraw(names, stamp),
    setWorldCount: (n) => { world.n = n; },
    update(t, dt) {
      for (const u of updaters) u(t, dt);
      world.t = (world.t || 0) + dt;
      if ((world.acc = (world.acc || 0) + dt) > 0.25) { world.acc = 0; world.redraw(world.t, world.n || 0); }
    },
    dispose() { for (const t of textures) t.dispose(); },
  };
}
