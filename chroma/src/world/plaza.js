// Prism Plaza: the hub world. Builds level solids (paintable!) plus decor.
import * as THREE from 'three';
import { Level } from './level.js';
import { PaintSystem, makeNoiseTexture } from './paint.js';
import { levelMaterials } from './materials.js';
import { signTexture } from './textures.js';
import { rng } from '../util.js';

export const PLAZA_SPOTS = {
  spawn: new THREE.Vector3(0, 0, 22),
  tower: new THREE.Vector3(0, 0, -31.5),
  shop: new THREE.Vector3(25.6, 0, -4),
  locker: new THREE.Vector3(-25.6, 0, -4),
  yard: new THREE.Vector3(0, 0, 34),
};

export function buildPlaza(scene, renderer, env) {
  const paint = new PaintSystem({ size: 2048, tpm: 7 });
  paint.uniforms.uNoise.value = makeNoiseTexture(256);
  const level = new Level(paint);
  level.killY = -5;
  const B = (min, max, o = {}) => level.box(min, max, o);
  // ground
  B([-48, -2, -48], [48, 0, 48], { mat: 'tiles' });
  // fountain rim (collision only; visuals below)
  B([-4.6, 0, -4.6], [4.6, 0.75, 4.6], { render: false, paintable: false });
  B([-1.3, 0.75, -1.3], [1.3, 3.2, 1.3], { render: false, paintable: false });
  // ---- Clash Tower (north)
  B([-10, 0, -48], [10, 9, -34], { mat: 'facade', color: 0xf3e9ff });
  B([-7.5, 9, -46], [7.5, 18, -36], { mat: 'facade', color: 0xe6dcff });
  B([-5, 18, -44], [5, 28, -38], { mat: 'facade', color: 0xd9ccff });
  B([-12, 0, -34], [-10, 6, -33], { mat: 'concreteDark' });
  B([10, 0, -34], [12, 6, -33], { mat: 'concreteDark' });
  // steps up to the entrance
  B([-6, 0, -34], [6, 0.3, -31.5], { mat: 'concrete' });
  // ---- weapon shop (east)
  B([30, 0, -14], [46, 8, 6], { mat: 'facade2', color: 0xffe2c4 });
  B([30, 8, -12], [44, 10.5, 4], { mat: 'concreteDark' });
  B([27, 0, -11], [28.3, 1.1, 3], { mat: 'wood' }); // counter
  // ---- style lab (west)
  B([-46, 0, -14], [-30, 8, 6], { mat: 'facade2', color: 0xc9f2ea });
  B([-44, 8, -12], [-30, 12, 4], { mat: 'facade', color: 0xb4e8de });
  B([-28.3, 0, -11], [-27, 1.1, 3], { mat: 'wood' });
  // ---- corner buildings
  const corners = [
    [[16, 0, -48], [34, 16, -32], 0xffd6d6, 'facade'],
    [[-34, 0, -48], [-16, 20, -32], 0xd6e4ff, 'facade2'],
    [[30, 0, 14], [48, 13, 32], 0xfff1c4, 'facade'],
    [[-48, 0, 14], [-30, 15, 32], 0xffd9ec, 'facade2'],
    [[36, 0, -32], [48, 22, -14], 0xd9f7d0, 'facade2'],
    [[-48, 0, -32], [-36, 18, -14], 0xffe6cc, 'facade'],
  ];
  for (const [mn, mx, c, m] of corners) B(mn, mx, { mat: m, color: c });
  // ---- planters with trees (collision boxes)
  const trees = [[-14, -16], [14, -16], [-16, 10], [16, 10], [-22, 22], [22, 22], [-8, 16], [8, 16]];
  for (const [x, z] of trees) B([x - 1.4, 0, z - 1.4], [x + 1.4, 0.7, z + 1.4], { mat: 'concreteDark' });
  // benches
  for (const [x, z, r] of [[-9, -6, 0], [9, -6, 0], [-9, 6, 0], [9, 6, 0], [-20, -2, 1], [20, -2, 1]]) {
    if (r) B([x - 0.4, 0, z - 1.3], [x + 0.4, 0.5, z + 1.3], { mat: 'wood' });
    else B([x - 1.3, 0, z - 0.4], [x + 1.3, 0.5, z + 0.4], { mat: 'wood' });
  }
  // ---- practice yard (south): raised platforms + target walls
  B([-14, 0, 38], [14, 0.6, 48], { mat: 'grate' });
  B([-14, 0.6, 46], [14, 3.5, 48], { mat: 'concrete' });
  B([-4, 0.6, 41], [-1, 2.2, 42], { mat: 'container', color: 0x4a6fa5 });
  B([3, 0.6, 40], [6, 1.6, 43], { mat: 'wood' });
  level.ramp([-14, 0, 36], [-10, 0.6, 38], '+z', { mat: 'grate' });
  level.ramp([10, 0, 36], [14, 0.6, 38], '+z', { mat: 'grate' });
  B([-10, 0, 37.4], [10, 0.6, 38], { mat: 'grate' });
  // low edge walls by the yard
  B([-30, 0, 46], [-14, 1.1, 48], { mat: 'concreteDark' });
  B([14, 0, 46], [30, 1.1, 48], { mat: 'concreteDark' });
  // world boundary (invisible)
  B([-49, 0, -49], [-48, 30, 49], { render: false, paintable: false });
  B([48, 0, -49], [49, 30, 49], { render: false, paintable: false });
  B([-49, 0, 48], [49, 30, 49], { render: false, paintable: false });
  B([-49, 0, -49], [49, 30, -48], { render: false, paintable: false });

  level.build();
  paint.finalize();
  paint.bakeAO((p) => level.sdf(p));
  const mats = levelMaterials(paint);
  level.buildMeshes(mats, scene);
  const decor = buildPlazaDecor(scene, trees);
  return { level, paint, mats, decor, bounds: { minX: -46, maxX: 46, minZ: -46, maxZ: 46 } };
}

function std(c, r = 0.6, m = 0.1, extra = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra }); }

function buildPlazaDecor(scene, trees) {
  const g = new THREE.Group();
  scene.add(g);
  const R = rng(7);
  const updaters = [];

  // ---- fountain
  const stone = std(0xe8e0d4, 0.7, 0);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.0, 0.75, 40, 1, true), stone);
  basin.position.y = 0.375; basin.castShadow = basin.receiveShadow = true; g.add(basin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.85, 0.22, 10, 48), stone);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.76; rim.castShadow = true; g.add(rim);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.7, 40, 1, true), stone);
  inner.position.y = 0.35; inner.material.side = THREE.BackSide; g.add(inner);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x46c8e8, roughness: 0.05, transmission: 0, clearcoat: 1, emissive: 0x0a3a50 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = 0.55; g.add(water);
  const tiers = [[1.3, 1.5, 1.2, 0.75], [2.6, 2.8, 0.25, 1.95], [0.5, 0.65, 1.0, 2.6], [1.5, 1.6, 0.2, 3.2]];
  for (const [r1, r2, h, y] of tiers) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 32), stone);
    m.position.y = y; m.castShadow = true; g.add(m);
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xff2e88, roughness: 0.1, clearcoat: 1, emissive: 0xff2e88, emissiveIntensity: 0.6 }));
  orb.position.y = 3.85; g.add(orb);
  const fountainColors = [0xff2e88, 0x3cf03c, 0xff7a00, 0x1e6bff, 0xa335ff, 0xffd21a, 0x00d8c0];
  updaters.push((t, dt, fx) => {
    const ci = Math.floor(t / 4) % fountainColors.length;
    const c = new THREE.Color(fountainColors[ci]).lerp(new THREE.Color(fountainColors[(ci + 1) % fountainColors.length]), (t / 4) % 1);
    orb.material.color.copy(c); orb.material.emissive.copy(c);
    orb.position.y = 3.85 + Math.sin(t * 2) * 0.08;
    if (fx && Math.random() < dt * 40) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2.2 + Math.random();
      fx.spawn(new THREE.Vector3(Math.cos(a) * 0.4, 4.2, Math.sin(a) * 0.4), new THREE.Vector3(Math.cos(a) * sp, 4.5 + Math.random() * 2, Math.sin(a) * sp), c, 0.08 + Math.random() * 0.05, 1.3, { floorY: 0.55, drag: 0.2, stretch: 1.4 });
    }
  });

  // ---- trees
  const trunkMat = std(0x7a5236, 0.9, 0);
  const leafMats = [0x6cc551, 0x4fb04a, 0x86d45f].map((c) => std(c, 0.8, 0));
  for (const [x, z] of trees) {
    const soil = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 2.5), std(0x5a4030, 1, 0));
    soil.position.set(x, 0.68, z); g.add(soil);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 3.2, 10), trunkMat);
    trunk.position.set(x, 2.2, z); trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const s = 1.2 + R() * 0.8;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leafMats[i % 3]);
      leaf.position.set(x + (R() - 0.5) * 1.6, 4 + R() * 1.4, z + (R() - 0.5) * 1.6);
      leaf.castShadow = true;
      g.add(leaf);
    }
  }

  // ---- lamp posts + string lights
  const lampMat = std(0x2b2f45, 0.4, 0.6);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2a8, emissiveIntensity: 4 });
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 12, z = Math.sin(a) * 12;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 5, 10), lampMat);
    post.position.set(x, 2.5, z); post.castShadow = true; g.add(post);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), bulbMat);
    head.position.set(x, 5.2, z); g.add(head);
    lamps.push(new THREE.Vector3(x, 5.0, z));
  }
  const bulbG = new THREE.SphereGeometry(0.09, 8, 6);
  const bulbColors = [0xffe2a8, 0xff9ec7, 0x9ee8ff, 0xc6ff9e];
  const bulbMats = bulbColors.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 5 }));
  const wireMat = new THREE.LineBasicMaterial({ color: 0x2b2f45 });
  const strand = (a, b) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 1.1;
      pts.push(p);
      if (i % 2 === 1) {
        const bulb = new THREE.Mesh(bulbG, bulbMats[(i >> 1) % bulbMats.length]);
        bulb.position.copy(p).setY(p.y - 0.12);
        g.add(bulb);
      }
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  };
  for (let i = 0; i < lamps.length; i++) strand(lamps[i], lamps[(i + 1) % lamps.length]);
  // strands to the tower
  strand(lamps[5], new THREE.Vector3(-9, 8, -34));
  strand(lamps[6], new THREE.Vector3(9, 8, -34));

  // ---- Clash Tower dressing
  const neon = (txt, w, h, size, accent, pos, rotY = 0, bg = '#1b1e2b') => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(txt, { w: 1024, h: Math.round(1024 * h / w), size, accent, bg }), toneMapped: false }));
    m.position.copy(pos); m.rotation.y = rotY; g.add(m);
    return m;
  };
  neon('CLASH TOWER', 12, 2.2, 150, '#ff2e88', new THREE.Vector3(0, 7.2, -33.95));
  // glowing entrance
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.6), new THREE.MeshStandardMaterial({ color: 0x111326, emissive: 0x6a5cff, emissiveIntensity: 1.6, roughness: 0.2 }));
  door.position.set(0, 2.6, -33.97); g.add(door);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 4, Math.PI), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2e88, emissiveIntensity: 3 }));
  frame.position.set(0, 2.6, -33.9); frame.scale.set(1, 1.15, 1); g.add(frame);
  // big screen on the tower
  const scr = document.createElement('canvas');
  scr.width = 512; scr.height = 288;
  const sctx = scr.getContext('2d');
  const scrTex = new THREE.CanvasTexture(scr);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.75), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  screen.position.set(0, 13.8, -35.95); g.add(screen);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(12.8, 7.5, 0.4), std(0x1b1e2b, 0.4, 0.5));
  bezel.position.set(0, 13.8, -36.2); g.add(bezel);
  let scrT = 0;
  const drawScreen = (t) => {
    const c = sctx;
    const hue = (t * 20) % 360;
    const gr = c.createLinearGradient(0, 0, 512, 288);
    gr.addColorStop(0, `hsl(${hue},90%,55%)`); gr.addColorStop(1, `hsl(${(hue + 140) % 360},90%,50%)`);
    c.fillStyle = gr; c.fillRect(0, 0, 512, 288);
    c.save(); c.globalAlpha = 0.18; c.fillStyle = '#fff';
    for (let i = -10; i < 20; i++) { c.beginPath(); c.moveTo(i * 40 + (t * 40) % 40, 0); c.lineTo(i * 40 + 20 + (t * 40) % 40, 0); c.lineTo(i * 40 - 80 + (t * 40) % 40, 288); c.lineTo(i * 40 - 100 + (t * 40) % 40, 288); c.fill(); }
    c.restore();
    c.fillStyle = '#1b1e2b'; c.fillRect(0, 196, 512, 92);
    c.font = '44px "Lilita One", "Arial Black", sans-serif'; c.textAlign = 'center';
    c.fillStyle = '#fff'; c.strokeStyle = '#1b1e2b'; c.lineWidth = 8;
    const lines = ['NOW PLAYING: TURF RUSH', 'TANGERINE TERMINAL', 'SKYLINE COURTS', 'PAINT THE TOWN!'];
    const L = lines[Math.floor(t / 3) % lines.length];
    c.strokeText(L, 256, 110); c.fillText(L, 256, 110);
    c.font = '30px "Lilita One", "Arial Black", sans-serif';
    c.fillStyle = '#ffd21a';
    c.fillText('★ 4 v 4 · 3:00 · MOST TURF WINS ★', 256, 252);
    scrTex.needsUpdate = true;
  };
  drawScreen(0);
  updaters.push((t, dt) => { scrT += dt; if (scrT > 0.12) { scrT = 0; drawScreen(t); } });

  // ---- weapon shop dressing
  neon('BLASTWORKS', 10, 2, 150, '#ff7a00', new THREE.Vector3(29.95, 6.4, -4), -Math.PI / 2);
  awning(g, new THREE.Vector3(29.4, 4.6, -4), 14, -Math.PI / 2, ['#ff7a00', '#fff4e0']);
  // weapon rack display (spinning blasters)
  // ---- style lab dressing
  neon('STYLE LAB', 10, 2, 150, '#00d8c0', new THREE.Vector3(-29.95, 6.4, -4), Math.PI / 2);
  awning(g, new THREE.Vector3(-29.4, 4.6, -4), 14, Math.PI / 2, ['#00d8c0', '#f0fffb']);
  // mannequin pedestals
  // ---- corner shop signs
  neon('DRIP CAFÉ', 8, 1.6, 140, '#ffd21a', new THREE.Vector3(29.95, 4.5, 23), -Math.PI / 2);
  neon('GLOOP RECORDS', 9, 1.6, 120, '#a335ff', new THREE.Vector3(-29.95, 4.5, 23), Math.PI / 2);
  neon('PRACTICE YARD', 9, 1.6, 110, '#3cf03c', new THREE.Vector3(0, 2.2, 45.95), Math.PI);
  awning(g, new THREE.Vector3(29.4, 3.2, 23), 10, -Math.PI / 2, ['#ffd21a', '#fffbe8']);
  awning(g, new THREE.Vector3(-29.4, 3.2, 23), 10, Math.PI / 2, ['#a335ff', '#f6ecff']);
  // café tables
  for (const [x, z] of [[25, 19], [25, 27], [22, 23]]) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 20), std(0xffffff, 0.4, 0.1));
    top.position.set(x, 0.9, z); top.castShadow = true; g.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), lampMat);
    leg.position.set(x, 0.45, z); g.add(leg);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 12, 1, true), std(0xffd21a, 0.7, 0, { side: THREE.DoubleSide }));
    um.position.set(x, 2.5, z); um.castShadow = true; g.add(um);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), lampMat);
    pole.position.set(x, 1.7, z); g.add(pole);
  }

  // ---- rooftop billboards + bunting
  const bill = (txt, pos, rotY, accent) => {
    const m = neon(txt, 10, 3.2, 120, accent, pos, rotY, '#ffffff');
    const back = new THREE.Mesh(new THREE.BoxGeometry(10.4, 3.6, 0.3), std(0x2b2f45));
    back.position.copy(pos).add(new THREE.Vector3(-Math.sin(rotY) * 0.2, 0, -Math.cos(rotY) * 0.2)); back.rotation.y = rotY; g.add(back);
    return m;
  };
  bill('SPLASH BACK!', new THREE.Vector3(25, 18, -40), 0, '#ff2e88');
  bill('STAY FRESH', new THREE.Vector3(-25, 22, -40), 0, '#1e6bff');
  bill('INK IS LIFE', new THREE.Vector3(39, 15, 23), -Math.PI / 2, '#3cf03c');

  const flagCols = [0xff2e88, 0xffd21a, 0x1e6bff, 0x3cf03c, 0xff7a00, 0xa335ff];
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.25, 0, 0, 0.25, 0, 0, 0, -0.5, 0], 3));
  flagGeo.computeVertexNormals();
  const flags = [];
  const bunting = (a, b) => {
    const n = Math.floor(a.distanceTo(b) / 0.9);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 1.4;
      const f = new THREE.Mesh(flagGeo, std(flagCols[i % flagCols.length], 0.8, 0, { side: THREE.DoubleSide }));
      f.position.copy(p);
      f.lookAt(p.x + (b.z - a.z), p.y, p.z - (b.x - a.x));
      f.userData.ph = i * 0.6;
      g.add(f);
      flags.push(f);
    }
  };
  bunting(new THREE.Vector3(-16, 9, -32), new THREE.Vector3(16, 9, -32));
  bunting(new THREE.Vector3(-30, 7, 14), new THREE.Vector3(-30, 7, -14).add(new THREE.Vector3(0, 0, 0)));
  bunting(new THREE.Vector3(30, 7, 14), new THREE.Vector3(30, 7, -14));
  bunting(new THREE.Vector3(-30, 8, 32), new THREE.Vector3(30, 8, 32));
  updaters.push((t) => { for (const f of flags) f.rotation.x = Math.sin(t * 3 + f.userData.ph) * 0.35; });

  // ---- distant skyline
  const sky = new THREE.Group();
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const bMats = [0xbfc9d9, 0xe6c9c0, 0xc0b7d9, 0xd9cfc0].map((c) => std(c, 0.8, 0.05));
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const d = 110 + R() * 70;
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

  return {
    group: g,
    update(t, dt, fx) { for (const u of updaters) u(t, dt, fx); },
  };
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
  const geo = new THREE.PlaneGeometry(width, 2.2, 1, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }));
  m.position.copy(pos);
  m.rotation.set(0, rotY, 0, 'YXZ');
  m.rotateX(-0.9);
  m.translateY(-0.6);
  m.castShadow = true;
  g.add(m);
}
