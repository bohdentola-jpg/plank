// Prism Plaza: the hub. A dense urban square at sunset with the Clash Tower,
// walk-in shops (their interiors are rooms built underneath the plaza), a
// paint fountain, crowds, graffiti, a practice yard — and a secret back alley.
import * as THREE from 'three';
import { Level } from './level.js';
import { PaintSystem, makeNoiseTexture } from './paint.js';
import { levelMaterials } from './materials.js';
import { signTexture } from './textures.js';
import { buildWeaponModel } from '../actors/character.js';
import { WEAPON_IDS, WEAPONS } from '../actors/weapons.js';
import { HATS, CLOTHES, SHOES } from '../actors/gear.js';
import { rng } from '../util.js';

const UNDER = -60; // interiors live in rooms below the plaza

export const PLAZA_SPOTS = {
  spawn: new THREE.Vector3(0, 0, 20),
  tower: new THREE.Vector3(0, 0.7, -29.2),
  weaponDoor: new THREE.Vector3(28.8, 0, -14),
  gearDoor: new THREE.Vector3(28.8, 0, 10),
  manhole: new THREE.Vector3(-41, 0, 19),
  yard: new THREE.Vector3(0, 0, 34),
};

// Room descriptors (centre, size). Entry point is just inside the south wall.
export const ROOMS = {
  weapons: { cx: 0, cz: 0, w: 18, d: 14, h: 5.2, name: 'BLASTWORKS', accent: '#ff7a00', door: PLAZA_SPOTS.weaponDoor, doorYaw: -Math.PI / 2 },
  gear: { cx: 34, cz: 0, w: 20, d: 15, h: 5.2, name: 'SCALE & THREAD', accent: '#00d8c0', door: PLAZA_SPOTS.gearDoor, doorYaw: -Math.PI / 2 },
};
for (const r of Object.values(ROOMS)) {
  r.entry = new THREE.Vector3(r.cx, UNDER, r.cz + r.d / 2 - 1.6);
  r.exit = new THREE.Vector3(r.cx, UNDER, r.cz + r.d / 2 - 0.4);
}
ROOMS.weapons.counter = new THREE.Vector3(0, UNDER, -3.2);
ROOMS.weapons.clerk = new THREE.Vector3(0, UNDER, -5.4);
ROOMS.weapons.pedestal = new THREE.Vector3(-4.5, UNDER, 0.5);
ROOMS.gear.counter = new THREE.Vector3(34 + 3, UNDER, -3.6);
ROOMS.gear.clerk = new THREE.Vector3(34 + 3, UNDER, -5.8);
ROOMS.gear.tryOn = new THREE.Vector3(34, UNDER, 1.2);
ROOMS.gear.salon = new THREE.Vector3(34 - 7, UNDER, -4.2);
ROOMS.gear.stylist = new THREE.Vector3(34 - 7.8, UNDER, -5.9);

export function buildPlaza(scene, renderer, env) {
  const paint = new PaintSystem({ size: 2048, tpm: 7 });
  paint.uniforms.uNoise.value = makeNoiseTexture(256);
  const level = new Level(paint);
  level.killY = -200;
  const B = (min, max, o = {}) => level.box(min, max, o);
  // ground
  B([-48, -2, -48], [48, 0, 50], { mat: 'tiles' });
  // fountain (collision; visuals in decor)
  B([-4.6, 0, -0.6], [4.6, 0.75, 8.6], { render: false, paintable: false });
  B([-1.3, 0.75, 2.7], [1.3, 3.2, 5.3], { render: false, paintable: false });
  // ---- Clash Tower
  B([-11, 0, -48], [11, 10, -30], { mat: 'facade', color: 0xf0e4ff });
  B([-8, 10, -45], [8, 22, -32], { mat: 'facade', color: 0xe2d4ff });
  B([-5.5, 22, -43], [5.5, 34, -34.5], { mat: 'facade2', color: 0xd4c4ff });
  B([-1.6, 34, -40.4], [1.6, 41, -37.2], { mat: 'concreteDark' });
  B([-9.5, 0, -30], [9.5, 0.35, -26.5], { mat: 'concrete' });
  B([-8.5, 0.35, -30], [8.5, 0.7, -28], { mat: 'concrete' });
  B([-13, 0, -30.5], [-11, 7, -29.5], { mat: 'concreteDark' });
  B([11, 0, -30.5], [13, 7, -29.5], { mat: 'concreteDark' });
  // north corner blocks with walkable balconies (paint + climb to reach them)
  B([-46, 0, -48], [-14, 17, -30], { mat: 'brick', color: 0xffd9cc });
  B([14, 0, -48], [46, 15, -30], { mat: 'facade2', color: 0xffe4c2 });
  B([-40, 5.6, -30], [-17, 5.9, -28.6], { mat: 'grate' });
  B([17, 5.6, -30], [40, 5.9, -28.6], { mat: 'grate' });
  // ---- east: Blastworks + Scale & Thread storefronts
  B([30, 0, -26], [48, 11, -3], { mat: 'brick', color: 0xffc8a8 });
  B([30, 0, 2], [48, 10, 22], { mat: 'facade2', color: 0xc9f2ea });
  B([30, 0, -3], [48, 7, 2], { mat: 'concreteDark' });
  // ---- west: records shop / café, DJ corner building
  B([-48, 0, -26], [-30, 12, -4], { mat: 'facade', color: 0xd6e4ff });
  B([-48, 0, -4], [-30, 9, 16], { mat: 'brick', color: 0xe8c8ff });
  // the secret alley runs between this block and the next (z 16..22)
  B([-48, 0, 22], [-28, 14, 50], { mat: 'facade2', color: 0xfff1c4 });
  B([28, 0, 22], [48, 13, 50], { mat: 'facade', color: 0xffd6ea });
  // alley clutter (hides the entrance a bit)
  B([-31.5, 0, 16.6], [-30.2, 1.6, 18.4], { mat: 'container', color: 0x4f7a5a });
  B([-36, 0, 20.4], [-34.4, 1.1, 21.9], { mat: 'wood' });
  B([-36, 1.1, 20.6], [-34.9, 2.0, 21.7], { mat: 'wood' });
  // ---- planters, benches, seating ring
  const trees = [[-16, -16], [16, -16], [-18, 12], [18, 12], [-22, 26], [22, 26]];
  for (const [x, z] of trees) B([x - 1.4, 0, z - 1.4], [x + 1.4, 0.7, z + 1.4], { mat: 'concreteDark' });
  for (const [x, z, r] of [[-9, -5, 0], [9, -5, 0], [-11, 13, 0], [11, 13, 0], [-24, -2, 1], [24, -2, 1]]) {
    if (r) B([x - 0.4, 0, z - 1.3], [x + 0.4, 0.5, z + 1.3], { mat: 'wood' });
    else B([x - 1.3, 0, z - 0.4], [x + 1.3, 0.5, z + 0.4], { mat: 'wood' });
  }
  // DJ stage (west)
  B([-28, 0, 2], [-22, 0.6, 10], { mat: 'grate' });
  level.ramp([-22, 0, 4], [-20.5, 0.6, 8], '-x', { mat: 'grate' });
  // ---- practice yard (south)
  B([-16, 0, 36], [16, 0.6, 46], { mat: 'grate' });
  B([-16, 0.6, 44], [16, 3.6, 46], { mat: 'concrete' });
  B([-4, 0.6, 39.5], [-1, 2.2, 40.5], { mat: 'container', color: 0x4a6fa5 });
  B([3, 0.6, 38.5], [6, 1.6, 41.5], { mat: 'wood' });
  level.ramp([-16, 0, 34], [-12, 0.6, 36], '+z', { mat: 'grate' });
  level.ramp([12, 0, 34], [16, 0.6, 36], '+z', { mat: 'grate' });
  B([-12, 0, 35.4], [12, 0.6, 36], { mat: 'grate' });
  B([-28, 0, 46], [-16, 1.1, 48], { mat: 'concreteDark' });
  B([16, 0, 46], [28, 1.1, 48], { mat: 'concreteDark' });
  // world boundary
  B([-49, 0, -49], [-48, 30, 51], { render: false, paintable: false });
  B([48, 0, -49], [49, 30, 51], { render: false, paintable: false });
  B([-49, 0, 50], [49, 30, 51], { render: false, paintable: false });
  B([-49, 0, -49], [49, 30, -48], { render: false, paintable: false });

  // ---- shop interiors (underground rooms)
  for (const r of Object.values(ROOMS)) buildRoom(level, r);
  const W = ROOMS.weapons, G = ROOMS.gear;
  B([W.cx - 4, UNDER, W.cz - 3.8], [W.cx + 4, UNDER + 1.1, W.cz - 2.9], { mat: 'wood', color: 0xffe0c0 });
  B([W.cx - 8.6, UNDER, W.cz - 6.6], [W.cx + 8.6, UNDER + 0.5, W.cz - 5.9], { mat: 'wood' }); // clerk riser
  for (const sx of [-1, 1]) B([W.cx + sx * 8.6 - 0.4, UNDER, W.cz - 5], [W.cx + sx * 8.6 + 0.4, UNDER + 1.0, W.cz + 4.5], { mat: 'wood', color: 0xd8b48a }); // low shelves
  B([G.cx + 0.5, UNDER, G.cz - 4.2], [G.cx + 6.5, UNDER + 1.1, G.cz - 3.3], { mat: 'wood', color: 0xe8fff8 });
  B([G.cx - 9.6, UNDER, G.cz - 6.9], [G.cx - 6, UNDER + 0.3, G.cz - 2.5], { mat: 'tiles' }); // salon corner
  for (const sx of [-1, 1]) B([G.cx + sx * 9.6 - 0.4, UNDER, G.cz - 1.5], [G.cx + sx * 9.6 + 0.4, UNDER + 1.0, G.cz + 5.5], { mat: 'wood', color: 0xf4e4d4 });

  level.build();
  paint.finalize();
  paint.bakeAO((p) => level.sdf(p));
  const mats = levelMaterials(paint);
  level.buildMeshes(mats, scene);
  const decor = buildPlazaDecor(scene, trees);
  const interiors = buildInteriorDecor(scene);
  return { level, paint, mats, decor, interiors, bounds: { minX: -46, maxX: 46, minZ: -46, maxZ: 48 } };
}

function buildRoom(level, r) {
  const { cx, cz, w, d, h } = r;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y = UNDER;
  level.box([x0 - 0.6, y - 1, z0 - 0.6], [x1 + 0.6, y, z1 + 0.6], { mat: 'woodFloor' });
  level.box([x0 - 0.6, y, z0 - 0.6], [x0, y + h, z1 + 0.6], { mat: 'wallpaper', color: 0xfff3e0 });
  level.box([x1, y, z0 - 0.6], [x1 + 0.6, y + h, z1 + 0.6], { mat: 'wallpaper', color: 0xfff3e0 });
  level.box([x0, y, z0 - 0.6], [x1, y + h, z0], { mat: 'brick', color: 0xffe8dc });
  level.box([x0, y, z1], [x1, y + h, z1 + 0.6], { mat: 'wallpaper', color: 0xffe9d0 });
  level.box([x0 - 0.6, y + h, z0 - 0.6], [x1 + 0.6, y + h + 0.5, z1 + 0.6], { mat: 'wallpaper', color: 0xf8f0e8, bottom: true, paintable: false, skip: ['top'] });
}

function std(c, r = 0.6, m = 0.1, extra = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra }); }

// Spray-paint style mural texture
function muralTexture(seed, w = 1024, h = 512, words = []) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const R = rng(seed);
  const pal = ['#ff2e88', '#ffd21a', '#3cf03c', '#1e6bff', '#ff7a00', '#a335ff', '#00d8c0', '#ffffff'];
  x.clearRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) {
    x.fillStyle = pal[Math.floor(R() * pal.length)];
    x.globalAlpha = 0.85;
    const cx = R() * w, cy = R() * h, rad = 30 + R() * 110;
    x.beginPath();
    for (let k = 0; k <= 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const rr = rad * (0.7 + R() * 0.5);
      x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.fill();
    for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(cx + (R() - 0.5) * rad * 3, cy + (R() - 0.5) * rad * 2, 4 + R() * 12, 0, Math.PI * 2); x.fill(); }
    // drips
    for (let k = 0; k < 3; k++) { const dx = cx + (R() - 0.5) * rad; x.fillRect(dx, cy, 6, rad * (0.6 + R())); }
  }
  x.globalAlpha = 1;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  words.forEach((word, i) => {
    x.font = `${130 - i * 30}px "Lilita One", "Arial Black", sans-serif`;
    x.lineWidth = 16; x.strokeStyle = '#1b1530';
    const tx = w / 2 + (R() - 0.5) * w * 0.2, ty = h * (0.42 + i * 0.3);
    x.save(); x.translate(tx, ty); x.rotate((R() - 0.5) * 0.15);
    x.strokeText(word, 0, 0);
    x.fillStyle = pal[Math.floor(R() * 6)]; x.fillText(word, 0, 0);
    x.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function posterTexture(title, sub, accent, seed) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 384;
  const x = c.getContext('2d');
  const R = rng(seed);
  x.fillStyle = accent; x.fillRect(0, 0, 256, 384);
  x.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(R() * 256, R() * 384, 10 + R() * 50, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#1b1530';
  x.font = '56px "Lilita One", "Arial Black", sans-serif'; x.textAlign = 'center';
  x.fillText(title, 128, 300);
  x.font = '26px "Lilita One", "Arial Black", sans-serif';
  x.fillText(sub, 128, 340);
  x.beginPath(); x.arc(128, 150, 80, 0, Math.PI * 2); x.fillStyle = '#fffaf0'; x.fill();
  x.font = '90px sans-serif'; x.fillStyle = '#1b1530'; x.fillText(['✦', '★', '☂', '⚔', '◒'][Math.floor(R() * 5)], 128, 182);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPlazaDecor(scene, trees) {
  const g = new THREE.Group();
  scene.add(g);
  const R = rng(7);
  const updaters = [];
  const plane = (w, h, mat, pos, rotY = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.copy(pos); m.rotation.y = rotY; g.add(m); return m; };
  const neon = (txt, w, h, size, accent, pos, rotY = 0, bg = '#1b1e2b') => plane(w, h, new THREE.MeshBasicMaterial({ map: signTexture(txt, { w: 1024, h: Math.round(1024 * h / w), size, accent, bg }), toneMapped: false, transparent: !bg }), pos, rotY);

  // ---- fountain (centre at z = 4)
  const FZ = 4;
  const stone = std(0xe8e0d4, 0.7, 0);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.0, 0.75, 40, 1, true), stone);
  basin.position.set(0, 0.375, FZ); basin.castShadow = basin.receiveShadow = true; g.add(basin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.85, 0.22, 10, 48), stone);
  rim.rotation.x = Math.PI / 2; rim.position.set(0, 0.76, FZ); rim.castShadow = true; g.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), new THREE.MeshPhysicalMaterial({ color: 0x46c8e8, roughness: 0.05, clearcoat: 1, emissive: 0x0a3a50 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.55, FZ); g.add(water);
  for (const [r1, r2, h, y] of [[1.3, 1.5, 1.2, 0.75], [2.6, 2.8, 0.25, 1.95], [0.5, 0.65, 1.0, 2.6], [1.5, 1.6, 0.2, 3.2]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 32), stone);
    m.position.set(0, y, FZ); m.castShadow = true; g.add(m);
  }
  // giant paint-drop statue on top
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xff2e88, roughness: 0.1, clearcoat: 1, emissive: 0xff2e88, emissiveIntensity: 0.6 }));
  orb.position.set(0, 3.95, FZ); orb.scale.set(1, 1.25, 1); g.add(orb);
  const fountainColors = [0xff2e88, 0x3cf03c, 0xff7a00, 0x1e6bff, 0xa335ff, 0xffd21a, 0x00d8c0];
  updaters.push((t, dt, fx) => {
    const ci = Math.floor(t / 4) % fountainColors.length;
    const c = new THREE.Color(fountainColors[ci]).lerp(new THREE.Color(fountainColors[(ci + 1) % fountainColors.length]), (t / 4) % 1);
    orb.material.color.copy(c); orb.material.emissive.copy(c);
    orb.position.y = 3.95 + Math.sin(t * 2) * 0.08;
    if (fx && Math.random() < dt * 40) {
      const a = Math.random() * Math.PI * 2, sp = 2.2 + Math.random();
      fx.spawn(new THREE.Vector3(Math.cos(a) * 0.4, 4.5, FZ + Math.sin(a) * 0.4), new THREE.Vector3(Math.cos(a) * sp, 4.5 + Math.random() * 2, Math.sin(a) * sp), c, 0.08 + Math.random() * 0.05, 1.3, { floorY: 0.55, drag: 0.2, stretch: 1.4 });
    }
  });

  // ---- trees
  const trunkMat = std(0x7a5236, 0.9, 0);
  const leafMats = [0x6cc551, 0x4fb04a, 0x86d45f, 0xff9ec7].map((c) => std(c, 0.8, 0));
  for (const [x, z] of trees) {
    const soil = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 2.5), std(0x5a4030, 1, 0));
    soil.position.set(x, 0.68, z); g.add(soil);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 3.2, 10), trunkMat);
    trunk.position.set(x, 2.2, z); trunk.castShadow = true; g.add(trunk);
    const pink = R() < 0.35;
    for (let i = 0; i < 4; i++) {
      const s = 1.2 + R() * 0.8;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leafMats[pink ? 3 : i % 3]);
      leaf.position.set(x + (R() - 0.5) * 1.6, 4 + R() * 1.4, z + (R() - 0.5) * 1.6);
      leaf.castShadow = true; g.add(leaf);
    }
  }

  // ---- lamp posts + string lights around the square
  const lampMat = std(0x2b2f45, 0.4, 0.6);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2a8, emissiveIntensity: 4 });
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 13, z = FZ + Math.sin(a) * 13;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 5, 10), lampMat);
    post.position.set(x, 2.5, z); post.castShadow = true; g.add(post);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), bulbMat);
    head.position.set(x, 5.2, z); g.add(head);
    lamps.push(new THREE.Vector3(x, 5.0, z));
  }
  const bulbG = new THREE.SphereGeometry(0.09, 8, 6);
  const bulbMats = [0xffe2a8, 0xff9ec7, 0x9ee8ff, 0xc6ff9e].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 5 }));
  const wireMat = new THREE.LineBasicMaterial({ color: 0x2b2f45 });
  const strand = (a, b, sag = 1.1) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
      if (i % 2 === 1) { const bulb = new THREE.Mesh(bulbG, bulbMats[(i >> 1) % bulbMats.length]); bulb.position.copy(p).setY(p.y - 0.12); g.add(bulb); }
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  };
  for (let i = 0; i < lamps.length; i++) strand(lamps[i], lamps[(i + 1) % lamps.length]);
  strand(lamps[5], new THREE.Vector3(-10, 8, -30));
  strand(lamps[6], new THREE.Vector3(10, 8, -30));
  strand(new THREE.Vector3(-30, 7, -20), new THREE.Vector3(30, 7, -20), 1.6);
  strand(new THREE.Vector3(-30, 7.5, -10), new THREE.Vector3(30, 7.5, -8), 1.8);

  // ---- Clash Tower dressing
  neon('CLASH TOWER', 13, 2.4, 150, '#ff2e88', new THREE.Vector3(0, 7.4, -29.95));
  const door = plane(4.4, 4.6, new THREE.MeshStandardMaterial({ color: 0x111326, emissive: 0x6a5cff, emissiveIntensity: 1.8, roughness: 0.2 }), new THREE.Vector3(0, 3.0, -29.97));
  void door;
  const frame = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.18, 8, 4, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2e88, emissiveIntensity: 3 }));
  frame.position.set(0, 3.0, -29.9); frame.scale.set(1, 1.15, 1); g.add(frame);
  // the news screen (texture assigned by the plaza mode)
  const screen = plane(14, 7.875, new THREE.MeshBasicMaterial({ color: 0x222233, toneMapped: false }), new THREE.Vector3(0, 16.5, -31.95));
  screen.name = 'newsScreen';
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(14.8, 8.6, 0.4), std(0x1b1e2b, 0.4, 0.5));
  bezel.position.set(0, 16.5, -32.2); g.add(bezel);
  const ticker = document.createElement('canvas');
  ticker.width = 1024; ticker.height = 64;
  const tctx = ticker.getContext('2d');
  const tickTex = new THREE.CanvasTexture(ticker);
  tickTex.colorSpace = THREE.SRGBColorSpace;
  const tick = plane(14, 0.9, new THREE.MeshBasicMaterial({ map: tickTex, toneMapped: false }), new THREE.Vector3(0, 12.1, -31.94));
  void tick;
  let tickText = 'PRISM NEWS · TURF RUSH IS LIVE · NEW GEAR AT SCALE & THREAD · BLASTWORKS RESTOCKED · ';
  let tickX = 0;
  updaters.push((t, dt) => {
    tickX = (tickX + dt * 120) % 2000;
    tctx.fillStyle = '#ffd21a'; tctx.fillRect(0, 0, 1024, 64);
    tctx.fillStyle = '#1b1530'; tctx.font = '40px "Lilita One", "Arial Black", sans-serif'; tctx.textBaseline = 'middle';
    const wTxt = tctx.measureText(tickText).width;
    for (let x = -tickX % wTxt; x < 1024; x += wTxt) tctx.fillText(tickText, x, 34);
    tickTex.needsUpdate = true;
  });

  // ---- storefronts
  const front = (name, accent, z, glow) => {
    neon(name, 11, 2.1, 140, accent, new THREE.Vector3(29.94, 7.6, z), -Math.PI / 2);
    // doorway
    plane(3.2, 4.2, new THREE.MeshStandardMaterial({ color: 0x2b1e14, emissive: glow, emissiveIntensity: 1.4, roughness: 0.3 }), new THREE.Vector3(29.96, 2.1, z), -Math.PI / 2);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 3.8), std(0x2b2f45, 0.4, 0.5));
    fr.position.set(29.9, 2.3, z); g.add(fr);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.2, 3.2), new THREE.MeshStandardMaterial({ color: 0x2b1e14, emissive: glow, emissiveIntensity: 1.4 }));
    inner.position.set(29.88, 2.1, z); g.add(inner);
    // display windows either side
    for (const s of [-1, 1]) {
      plane(4.2, 3, new THREE.MeshStandardMaterial({ color: 0x8fb8d8, emissive: glow, emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.3 }), new THREE.Vector3(29.95, 2.4, z + s * 4.6), -Math.PI / 2);
    }
    awning(g, new THREE.Vector3(29.4, 5.0, z), 14, -Math.PI / 2, [accent, '#fff4e0']);
  };
  front('BLASTWORKS', '#ff7a00', -14, 0xff9a4a);
  front('SCALE & THREAD', '#00d8c0', 10, 0x4affe0);
  // weapon silhouettes in the Blastworks windows
  for (const [i, id] of ['roller', 'longshot', 'whirlpool', 'bumbershoot'].entries()) {
    const w = buildWeaponModel(id, new THREE.Color(['#ff2e88', '#3cf03c', '#ffd21a', '#1e6bff'][i]), WEAPONS[id].type);
    w.position.set(29.6, 2.3, -14 + (i < 2 ? -1 : 1) * (3.6 + (i % 2) * 1.6));
    w.rotation.set(0, -Math.PI / 2 + 0.4, 0.3);
    w.scale.setScalar(1.6);
    g.add(w);
    updaters.push((t) => { w.rotation.y = -Math.PI / 2 + Math.sin(t * 0.8 + i) * 0.5; });
  }

  // ---- west side: records / café / DJ
  neon('GLOOP RECORDS', 10, 1.8, 120, '#a335ff', new THREE.Vector3(-29.94, 6.4, -18), Math.PI / 2);
  neon('DRIP CAFÉ', 8, 1.6, 140, '#ffd21a', new THREE.Vector3(-29.94, 6.4, -9), Math.PI / 2);
  awning(g, new THREE.Vector3(-29.4, 3.4, -9), 9, Math.PI / 2, ['#ffd21a', '#fffbe8']);
  awning(g, new THREE.Vector3(-29.4, 3.4, -18), 9, Math.PI / 2, ['#a335ff', '#f6ecff']);
  for (const [x, z] of [[-25, -12], [-25, -6], [-22.5, -9]]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 20), std(0xffffff, 0.4, 0.1));
    top.position.set(x, 0.9, z); top.castShadow = true; g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), lampMat); leg.position.set(x, 0.45, z); g.add(leg);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 12, 1, true), std(0xffd21a, 0.7, 0, { side: THREE.DoubleSide }));
    um.position.set(x, 2.5, z); um.castShadow = true; g.add(um);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), lampMat); pole.position.set(x, 1.7, z); g.add(pole);
  }
  // DJ booth + speakers on the west stage
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.0), std(0x1b1e2b, 0.4, 0.4));
  deck.position.set(-26.5, 1.1, 6); g.add(deck);
  const speakers = [];
  for (const z of [3, 9]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.2), std(0x23263a, 0.6, 0.2));
    sp.position.set(-27, 1.7, z); sp.castShadow = true; g.add(sp);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), std(0x111111, 0.5, 0.3, { emissive: 0xff2e88, emissiveIntensity: 0.4 }));
    cone.position.set(-26.39, 1.9, z); cone.rotation.y = Math.PI / 2; g.add(cone);
    speakers.push(cone);
  }
  updaters.push((t) => { const b = Math.abs(Math.sin(t * Math.PI * 2 * 1.6)); for (const c of speakers) { c.scale.setScalar(1 + b * 0.12); c.material.emissiveIntensity = 0.3 + b; } });

  // ---- murals + posters
  const murals = [
    [new THREE.Vector3(-29.93, 5, 6), Math.PI / 2, 14, 7, ['STAY', 'FRESH']],
    [new THREE.Vector3(-20, 9, -29.94), 0, 10, 5, ['INK']],
    [new THREE.Vector3(26, 7, -29.94), 0, 9, 4.5, ['SPLASH!']],
    [new THREE.Vector3(27.94, 6, 34), -Math.PI / 2, 14, 7, ['COLOR', 'IS LIFE']],
    [new THREE.Vector3(-27.94, 6, 34), Math.PI / 2, 14, 7, ['HUE', 'CREW']],
    [new THREE.Vector3(-38, 4, 21.94), Math.PI, 12, 6, ['???']],
  ];
  murals.forEach(([p, r, w, h, words], i) => {
    plane(w, h, new THREE.MeshStandardMaterial({ map: muralTexture(31 + i * 7, 1024, 512, words), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), p, r);
  });
  const posters = [['TURF', 'RUSH', '#ff7a00'], ['ARC', 'BOW', '#3fd3b0'], ['DRIP', 'CO.', '#ff2e88'], ['NEON', 'NIGHT', '#a335ff'], ['GLOOP', 'FEST', '#ffd21a'], ['HUE', 'STREET', '#1e6bff']];
  posters.forEach(([a, b, c], i) => {
    const x = -16 - i * 2.2;
    plane(1.6, 2.4, new THREE.MeshStandardMaterial({ map: posterTexture(a, b, c, i * 13 + 5), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }), new THREE.Vector3(x, 2.4, -29.94));
  });
  posters.forEach(([a, b, c], i) => {
    const z = -24 + i * 2.2;
    if (Math.abs(z + 14) < 3) return;
    plane(1.6, 2.4, new THREE.MeshStandardMaterial({ map: posterTexture(b, a, c, i * 17 + 3), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }), new THREE.Vector3(29.94, 2.4, z), -Math.PI / 2);
  });

  // ---- the secret alley: flickering lamp, manhole with faint gray mist
  const alleyLamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfd6ff, emissiveIntensity: 3 }));
  alleyLamp.position.set(-38, 5.2, 16.4); g.add(alleyLamp);
  const alleyArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), lampMat); alleyArm.position.set(-38, 5.3, 16.2); g.add(alleyArm);
  const manhole = new THREE.Group();
  manhole.position.copy(PLAZA_SPOTS.manhole).setY(0.02);
  g.add(manhole);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 28), std(0x3a3d4a, 0.5, 0.7));
  manhole.add(lid);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 28).rotateX(Math.PI / 2), std(0x2b2d36, 0.5, 0.7));
  manhole.add(ring);
  for (let i = -2; i <= 2; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.1 - Math.abs(i) * 0.18, 0.02, 0.07), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x9aa0b4, emissiveIntensity: 0.6 }));
    slot.position.set(0, 0.035, i * 0.22); manhole.add(slot);
  }
  const mistMat = new THREE.MeshBasicMaterial({ color: 0xc9cdd8, transparent: true, opacity: 0.0, depthWrite: false });
  const mists = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mistMat.clone());
    m.userData.ph = i / 5;
    manhole.add(m);
    mists.push(m);
  }
  updaters.push((t) => {
    alleyLamp.material.emissiveIntensity = Math.sin(t * 23) > 0.6 || Math.sin(t * 3.1) > 0.2 ? 3 : 0.3;
    for (const m of mists) {
      const k = (t * 0.25 + m.userData.ph) % 1;
      m.position.set(Math.sin(k * 9 + m.userData.ph * 6) * 0.3, k * 2.2, Math.cos(k * 7) * 0.3);
      m.scale.setScalar(0.4 + k * 1.2);
      m.material.opacity = Math.sin(k * Math.PI) * 0.22;
    }
  });

  // ---- rooftop billboards + bunting
  const bill = (txt, pos, rotY, accent) => {
    neon(txt, 10, 3.2, 120, accent, pos, rotY, '#ffffff');
    const back = new THREE.Mesh(new THREE.BoxGeometry(10.4, 3.6, 0.3), std(0x2b2f45));
    back.position.copy(pos).add(new THREE.Vector3(-Math.sin(rotY) * 0.2, 0, -Math.cos(rotY) * 0.2)); back.rotation.y = rotY; g.add(back);
  };
  bill('SPLASH BACK!', new THREE.Vector3(30, 17, -36), 0, '#ff2e88');
  bill('STAY FRESH', new THREE.Vector3(-30, 19, -36), 0, '#1e6bff');
  bill('CHROMA CLASH', new THREE.Vector3(39, 15.6, 30), -Math.PI / 2, '#3cf03c');
  const flagCols = [0xff2e88, 0xffd21a, 0x1e6bff, 0x3cf03c, 0xff7a00, 0xa335ff];
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.25, 0, 0, 0.25, 0, 0, 0, -0.5, 0], 3));
  flagGeo.computeVertexNormals();
  const flagMats = flagCols.map((c) => std(c, 0.8, 0, { side: THREE.DoubleSide }));
  const flags = [];
  const bunting = (a, b) => {
    const n = Math.floor(a.distanceTo(b) / 0.9);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 1.4;
      const f = new THREE.Mesh(flagGeo, flagMats[i % flagMats.length]);
      f.position.copy(p);
      f.lookAt(p.x + (b.z - a.z), p.y, p.z - (b.x - a.x));
      f.userData.ph = i * 0.6;
      g.add(f); flags.push(f);
    }
  };
  bunting(new THREE.Vector3(-16, 9, -30), new THREE.Vector3(16, 9, -30));
  bunting(new THREE.Vector3(-30, 8, 26), new THREE.Vector3(28, 8, 26));
  bunting(new THREE.Vector3(-30, 8.5, 0), new THREE.Vector3(30, 8.5, 0));
  updaters.push((t) => { for (const f of flags) f.rotation.x = Math.sin(t * 3 + f.userData.ph) * 0.35; });

  // ---- vending machines + trash bins (decor)
  for (const [x, z, c] of [[27.5, -2, 0xff2e88], [27.5, 0.5, 0x1e6bff], [-27.5, -26, 0x3cf03c]]) {
    const vm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.0), std(c, 0.4, 0.2));
    vm.position.set(x, 1.1, z); vm.castShadow = true; g.add(vm);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1.2 }));
    glass.position.set(x + (x > 0 ? -0.56 : 0.56), 1.4, z); glass.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(glass);
  }

  // ---- distant skyline
  const sky = new THREE.Group();
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const bMats = [0xbfc9d9, 0xe6c9c0, 0xc0b7d9, 0xd9cfc0].map((c) => std(c, 0.8, 0.05));
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, d = 110 + R() * 70;
    const b = new THREE.Mesh(bGeo, bMats[i % 4]);
    b.scale.set(14 + R() * 18, 25 + Math.pow(R(), 2) * 80, 14 + R() * 18);
    b.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
    b.rotation.y = R() * 3;
    sky.add(b);
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 32), std(0x9aa6b8, 1, 0));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -2.05;
  sky.add(ground);
  g.add(sky);

  return { group: g, screen, setTicker: (s) => { tickText = s; }, update(t, dt, fx) { for (const u of updaters) u(t, dt, fx); } };
}

function awning(g, pos, width, rotY, cols) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) { ctx.fillStyle = cols[i % 2]; ctx.fillRect(i * 32, 0, 32, 64); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(width / 4, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, 2.2, 1, 1), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  m.position.copy(pos);
  m.rotation.set(0, rotY, 0, 'YXZ');
  m.rotateX(-0.9);
  m.translateY(-0.6);
  m.castShadow = true;
  g.add(m);
}

// ---------------------------------------------------------------------------
// Shop interiors: furniture, displays, lights.
function buildInteriorDecor(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const W = ROOMS.weapons, G = ROOMS.gear, y = UNDER;
  const lights = [];
  const light = (x, z, c = 0xffe2b8, i = 18) => {
    const l = new THREE.PointLight(c, i, 16, 1.6);
    l.position.set(x, y + 4.2, z);
    g.add(l); lights.push(l);
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: 2.5 }));
    fixture.position.set(x, y + 5.05, z); g.add(fixture);
  };
  light(W.cx - 4, W.cz - 1, 0xffd2a0, 22); light(W.cx + 4, W.cz - 1, 0xffd2a0, 22);
  light(G.cx - 4, G.cz - 1, 0xd8fff4, 22); light(G.cx + 5, G.cz - 1, 0xffe2f0, 22);
  const neon = (txt, w, h, size, accent, pos, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(txt, { w: 1024, h: Math.round(1024 * h / w), size, accent }), toneMapped: false }));
    m.position.copy(pos); m.rotation.y = rotY; g.add(m); return m;
  };
  neon('BLASTWORKS', 7, 1.4, 150, '#ff7a00', new THREE.Vector3(W.cx, y + 3.6, W.cz - W.d / 2 + 0.02));
  neon('SCALE & THREAD', 7.5, 1.4, 120, '#00d8c0', new THREE.Vector3(G.cx + 3, y + 3.6, G.cz - G.d / 2 + 0.02));
  neon('SALON', 3, 0.9, 140, '#ff2e88', new THREE.Vector3(G.cx - 8, y + 3.2, G.cz - G.d / 2 + 0.02));
  const exitSign = (r) => neon('EXIT ▼', 2.2, 0.6, 120, '#3cf03c', new THREE.Vector3(r.cx, y + 3.3, r.cz + r.d / 2 - 0.02), Math.PI);
  exitSign(W); exitSign(G);
  // exit doors (glowing frames on the south walls)
  for (const r of [W, G]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe6b0, emissiveIntensity: 1.2 }));
    d.position.set(r.cx, y + 1.6, r.cz + r.d / 2 - 0.02); d.rotation.y = Math.PI; g.add(d);
  }
  // ---- Blastworks: weapons on the walls + a display pedestal
  const ink = ['#ff2e88', '#3cf03c', '#ffd21a', '#1e6bff', '#ff7a00', '#a335ff'];
  WEAPON_IDS.forEach((id, i) => {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const m = buildWeaponModel(id, new THREE.Color(ink[i % ink.length]), WEAPONS[id].type);
    m.position.set(W.cx + side * (W.w / 2 - 0.35), y + 1.9 + (k % 2) * 1.2, W.cz - 4.2 + k * 1.55);
    m.rotation.set(0, -side * Math.PI / 2, 0);
    m.rotation.y = side > 0 ? Math.PI : 0;
    m.rotation.set(0, side > 0 ? -Math.PI : 0, 0);
    m.lookAt(m.position.x + side, m.position.y, m.position.z);
    m.rotateY(Math.PI / 2);
    m.scale.setScalar(1.3);
    g.add(m);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.32), new THREE.MeshBasicMaterial({ map: signTexture(WEAPONS[id].name.toUpperCase(), { w: 512, h: 136, size: 56, accent: ink[i % ink.length] }), toneMapped: false }));
    plaque.position.set(m.position.x - side * 0.02, m.position.y - 0.45, m.position.z);
    plaque.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(plaque);
  });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.9, 24), new THREE.MeshStandardMaterial({ color: 0x2b2f45, roughness: 0.3, metalness: 0.5 }));
  ped.position.copy(W.pedestal).setY(y + 0.45); ped.castShadow = true; g.add(ped);
  const pedRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 8, 32).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff7a00, emissiveIntensity: 2 }));
  pedRing.position.copy(W.pedestal).setY(y + 0.9); g.add(pedRing);
  const display = new THREE.Group();
  display.position.copy(W.pedestal).setY(y + 1.6);
  g.add(display);
  // register + paint cans on the counter
  const reg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x2b2f45, roughness: 0.4, metalness: 0.4 }));
  reg.position.set(W.cx + 2.6, y + 1.3, W.cz - 3.35); g.add(reg);
  for (let i = 0; i < 5; i++) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 14), new THREE.MeshStandardMaterial({ color: ink[i], roughness: 0.35, metalness: 0.3 }));
    can.position.set(W.cx - 3 + i * 0.4, y + 1.26, W.cz - 3.3); g.add(can);
  }
  // ---- Scale & Thread: clothes rails, hat heads, shoe shelves, salon mirror
  CLOTHES.forEach((c, i) => {
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.55, 12), new THREE.MeshStandardMaterial({ color: c.c1, roughness: 0.8 }));
    shirt.scale.z = 0.4;
    shirt.position.set(G.cx + G.w / 2 - 0.6, y + 1.9, G.cz - 1 + i * 0.52);
    shirt.rotation.y = Math.PI / 2;
    g.add(shirt);
  });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.6, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.8, roughness: 0.3 }));
  rail.position.set(G.cx + G.w / 2 - 0.6, y + 2.25, G.cz + 1.9); g.add(rail);
  HATS.slice(1).forEach((h, i) => {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.7 }));
    head.position.set(G.cx - G.w / 2 + 0.55, y + 1.25 + (i % 2) * 0.7, G.cz - 1 + Math.floor(i / 2) * 1.1);
    g.add(head);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: h.c1, roughness: 0.6 }));
    hat.position.copy(head.position).setY(head.position.y + 0.04);
    g.add(hat);
  });
  SHOES.forEach((s, i) => {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: s.c1, roughness: 0.5 }));
    shoe.scale.set(0.8, 0.6, 1.5);
    shoe.position.set(G.cx + 1 + (i % 5) * 0.55, y + 0.25 + Math.floor(i / 5) * 0.4, G.cz + G.d / 2 - 0.8);
    g.add(shoe);
  });
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.02, metalness: 1 }));
  mirror.position.set(G.cx - 8, y + 1.7, G.cz - G.d / 2 + 0.03); g.add(mirror);
  const chair = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0xff2e88, roughness: 0.4 }));
  chair.position.set(G.cx - 8, y + 0.6, G.cz - 5.2); g.add(chair);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshStandardMaterial({ color: 0x00d8c0, roughness: 0.9 }));
  rug.rotation.x = -Math.PI / 2; rug.position.copy(G.tryOn).setY(y + 0.02); g.add(rug);
  const rug2 = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: 0.9 }));
  rug2.rotation.x = -Math.PI / 2; rug2.position.set(W.cx, y + 0.02, W.cz + 1.5); g.add(rug2);
  // potted plants
  for (const [x, z] of [[W.cx - 8, W.cz + 6], [W.cx + 8, W.cz + 6], [G.cx + 9, G.cz + 6.6], [G.cx - 9, G.cz + 6.6]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 14), new THREE.MeshStandardMaterial({ color: 0xc8643c, roughness: 0.8 }));
    pot.position.set(x, y + 0.3, z); g.add(pot);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: 0x4fb04a, roughness: 0.8 }));
    leaf.position.set(x, y + 1.1, z); g.add(leaf);
  }
  return {
    group: g, display, lights,
    update(t) { display.rotation.y = t * 0.8; pedRing.material.emissiveIntensity = 1.5 + Math.sin(t * 3) * 0.5; },
  };
}
