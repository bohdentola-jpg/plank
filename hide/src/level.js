// The store: sales floor, checkouts, freezers, stockroom, staff room and your
// hiding spot. Builds render meshes plus everything gameplay needs: colliders,
// hiding spots, item spots, patrol points and lights.
import * as THREE from 'three';
import { World, tileRect } from './geo.js';
import { ATLAS, signTexture } from './textures.js';
import { rng, clamp } from './util.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const col3 = (hex) => new THREE.Color(hex);

export function buildLevel(scene, T, cfg) {
  const L = cfg.layout;
  const R = rng(1234);
  const W = L.width, SD = L.salesDepth, S0 = SD + 0.3, D = S0 + L.stockDepth;
  const H1 = 4.2, H2 = 5.6;
  const w = new World(9);
  const shadows = cfg.shadows;
  const lvl = {
    W, SD, S0, D, H1, H2,
    colliders: [], hides: [], pois: [], batterySpots: [], comfortSpots: {},
    doors: [], fixtures: [], pointLights: [], flicker: [], meshes: [], anim: [],
    rainGlass: null, hum: [],
  };
  const C = (x0, z0, x1, z1, tall = true, extra = {}) =>
    lvl.colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), tall, ...extra });
  const poi = (x, z, area, weight = 1) => lvl.pois.push({ x, z, area, weight });

  // ---------------------------------------------------------------- materials
  const env = T.env;
  w.mat('tile', std({ map: T.floor.map, roughnessMap: T.floor.roughnessMap, normalMap: T.floor.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), envMap: env, envMapIntensity: 0.55 }));
  w.mat('concrete', std({ map: T.concrete.map, roughnessMap: T.concrete.roughnessMap, normalMap: T.concrete.normalMap, envMap: env, envMapIntensity: 0.25 }));
  w.mat('block', std({ map: T.block.map, normalMap: T.block.normalMap, roughness: 0.92 }));
  w.mat('dry', std({ map: T.drywall.map, normalMap: T.drywall.normalMap, color: col3(0xb9c4b4), roughness: 0.9 }));
  w.mat('dryWhite', std({ map: T.drywall.map, normalMap: T.drywall.normalMap, color: col3(0xd8d4c8), roughness: 0.9 }));
  w.mat('ceiling', std({ map: T.ceiling.map, roughness: 0.95 }));
  w.mat('roof', std({ color: col3(0x2a2c2e), roughness: 0.7, metalness: 0.5 }));
  w.mat('shelf', std({ color: col3(0xc9cbc6), roughness: 0.5, metalness: 0.35, envMap: env, envMapIntensity: 0.4 }));
  w.mat('shelfDark', std({ color: col3(0x55585a), roughness: 0.6, metalness: 0.3 }));
  w.mat('peg', std({ map: T.peg.map, normalMap: T.peg.normalMap, roughness: 0.7 }));
  w.mat('price', std({ map: T.price, roughness: 0.4 }));
  w.mat('prod', std({ map: T.labels, roughness: 0.42, envMap: env, envMapIntensity: 0.35 }));
  w.mat('box', std({ map: T.cardboard.map, roughness: 0.88 }));
  w.mat('wood', std({ map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.85 }));
  w.mat('rackBlue', std({ color: col3(0x1f4f8c), roughness: 0.45, metalness: 0.5 }));
  w.mat('rackOrange', std({ color: col3(0xd2561e), roughness: 0.45, metalness: 0.45 }));
  w.mat('darkMetal', std({ color: col3(0x26282b), roughness: 0.55, metalness: 0.6, envMap: env, envMapIntensity: 0.3 }));
  w.mat('chrome', std({ color: col3(0xd8dadc), roughness: 0.18, metalness: 1, envMap: env, envMapIntensity: 1 }));
  w.mat('laminate', std({ color: col3(0x6f6a62), roughness: 0.5 }));
  w.mat('rubber', std({ color: col3(0x0e0e0f), roughness: 0.75 }));
  w.mat('enamel', std({ color: col3(0xe6e7e3), roughness: 0.3, envMap: env, envMapIntensity: 0.4 }));
  w.mat('plastic', std({ color: col3(0x2b2d31), roughness: 0.45 }));
  w.mat('fruit', std({ color: col3(0xffffff), roughness: 0.45 }));
  w.mat('yellow', std({ color: col3(0xd9b21c), roughness: 0.6 }));
  w.mat('fabric', std({ map: T.tartan.map, normalMap: T.tartan.normalMap, roughness: 0.95 }));
  w.mat('felt', std({ color: col3(0x4a4f57), roughness: 1 }));
  w.mat('diffuserOff', std({ color: col3(0x9a9c99), roughness: 0.4, emissive: col3(0x000000) }));
  w.mat('lightOn', new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: col3(0xeaf3ff), emissiveIntensity: 1.3, roughness: 0.5 }));
  w.mat('lightWarm', new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: col3(0xffc489), emissiveIntensity: 3, roughness: 0.5 }));
  w.mat('lightFlicker', w.materials.lightOn.clone());
  w.mat('lightWarmFlicker', w.materials.lightWarm.clone());
  w.mat('coolGlow', new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: col3(0xdcefff), emissiveIntensity: 1.6, roughness: 0.6 }));
  w.mat('coolBack', new THREE.MeshStandardMaterial({ color: 0xb8c8d8, emissive: col3(0x9fc3e8), emissiveIntensity: 0.32, roughness: 0.7 }));
  w.mat('coolOff', std({ color: col3(0x2a2f33), roughness: 0.6 }));
  w.mat('redGlow', new THREE.MeshStandardMaterial({ color: 0x220000, emissive: col3(0xff2a1a), emissiveIntensity: 2.2 }));
  const vendT = signTexture(['DRINKS', { text: 'ICE COLD', size: 0.12 }], { w: 256, h: 512, bg: '#0e2f5c', fg: '#e8f6ff' });
  w.mat('vendGlow', new THREE.MeshStandardMaterial({ color: 0xffffff, map: vendT, emissive: col3(0xffffff), emissiveMap: vendT, emissiveIntensity: 1.3 }));
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4c0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, envMap: env, envMapIntensity: 1.4, depthWrite: false });
  w.mat('glass', glass);
  const freezerGlass = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.12, transparent: true, opacity: 0.22, envMap: env, envMapIntensity: 1.2, depthWrite: false });
  w.mat('fglass', freezerGlass);
  // wire basket mesh for carts
  const wire = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = '#ddd';
    g.lineWidth = 3;
    for (let i = 4; i < 128; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  w.mat('wire', std({ map: wire, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.35, color: col3(0xc0c4c8) }));

  const signMat = (name, lines, o) => {
    const t = signTexture(lines, o);
    return w.mat(name, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: o.emissive ? col3(0xffffff) : col3(0), emissiveMap: o.emissive ? t : null, emissiveIntensity: o.emissive ? o.glow || 1.6 : 0 }));
  };

  const RECT = (i) => tileRect(i);
  const KRAFT = RECT(ATLAS.KRAFT);

  // --------------------------------------------------------------- floors etc
  w.plane('tile', 0, 0, W, SD, 0, { tile: 2.4 });
  w.plane('concrete', 0, SD, W, D, 0, { tile: 4 });
  w.plane('concrete', -2, -6, W + 2, -0.3, -0.02, { tile: 4 });
  w.plane('ceiling', 0, 0, W, SD, H1, { tile: 4.8, down: true });
  w.plane('roof', 0, S0, W, D, H2, { tile: 4, down: true });

  // outer walls (thick slabs so they shadow properly)
  const wallH = H2;
  w.slab('dry', -0.3, 0, 0, 0, wallH, SD, { tile: 2 });
  w.slab('dry', W, 0, 0, W + 0.3, wallH, SD, { tile: 2 });
  w.slab('block', -0.3, 0, SD, 0, wallH, D + 0.3, { tile: 1.6 });
  w.slab('block', W, 0, SD, W + 0.3, wallH, D + 0.3, { tile: 1.6 });
  w.slab('block', 0, 0, D, W, wallH, D + 0.3, { tile: 1.6 });
  C(-1, -1, 0, D + 1); C(W, -1, W + 1, D + 1); C(-1, D, W + 1, D + 1);

  // front wall with windows + entrance
  const entX0 = W - 6.2, entX1 = W - 3.2;
  w.slab('dryWhite', 0, 3.3, -0.3, W, H1 + 0.2, 0, { tile: 2 });
  for (let x = 0; x <= W + 0.01; x += 4) {
    const x0 = Math.max(0, x - 0.2), x1 = Math.min(W, x + 0.2);
    w.slab('darkMetal', x0, 0, -0.3, x1, 3.3, 0);
  }
  for (let x = 0; x < W - 0.01; x += 4) {
    const inEnt = x + 2 > entX0 && x + 2 < entX1 + 1;
    if (!inEnt) w.slab('darkMetal', x + 0.2, 0, -0.26, x + 3.8, 0.55, -0.04);
    w.slab('darkMetal', x + 0.2, 3.2, -0.25, x + 3.8, 3.3, -0.05);
    w.slab('glass', x + 0.2, inEnt ? 0 : 0.55, -0.16, x + 3.8, 3.2, -0.14, { noShadow: true });
  }
  C(-1, -1.2, W + 1, 0);
  // rain sheet on the glass
  lvl.rainGlass = { x0: 0, x1: W, y0: 0.55, y1: 3.2, z: -0.1 };
  // outside backdrop (night parking lot)
  const outsideMat = new THREE.MeshBasicMaterial({ map: T.outside, color: 0xffffff, fog: false });
  T.outside.repeat.set(W / 30, 1);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, 12), outsideMat);
  outside.position.set(W / 2, 3, -7);
  scene.add(outside);
  // entrance mats + carts corral
  w.slab('rubber', entX0, 0, 0.1, entX1, 0.012, 2.0, { noShadow: true });

  // divider wall between sales floor and stockroom, with door openings
  const doorW = 2.0, doorH = 2.35;
  const doorXs = L.stockDoors;
  let cursor = 0;
  for (const dx of doorXs) {
    w.slab('dry', cursor, 0, SD, dx - doorW / 2, wallH, S0, { tile: 2 });
    C(cursor, SD, dx - doorW / 2, S0);
    w.slab('dry', dx - doorW / 2, doorH, SD, dx + doorW / 2, wallH, S0, { tile: 2 });
    w.slab('darkMetal', dx - doorW / 2 - 0.06, 0, SD - 0.02, dx - doorW / 2, doorH, S0 + 0.02);
    w.slab('darkMetal', dx + doorW / 2, 0, SD - 0.02, dx + doorW / 2 + 0.06, doorH, S0 + 0.02);
    cursor = dx + doorW / 2;
    lvl.doors.push({ x: dx, z: SD + 0.15, w: doorW, h: doorH, angle: [0, 0], vel: [0, 0], panels: [] });
  }
  w.slab('dry', cursor, 0, SD, W, wallH, S0, { tile: 2 });
  C(cursor, SD, W, S0);

  // stockroom double doors (dynamic meshes)
  const doorMat = std({ color: col3(0x8a8f93), roughness: 0.5, metalness: 0.4 });
  const kickMat = std({ color: col3(0x9ea3a6), roughness: 0.25, metalness: 0.9, envMap: env });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, transparent: true, opacity: 0.5 });
  const staffSign = signTexture(['STAFF ONLY'], { w: 256, h: 64, bg: '#b8251f', fg: '#fff' });
  const staffMat = std({ map: staffSign, roughness: 0.5 });
  for (const d of lvl.doors) {
    for (let s = 0; s < 2; s++) {
      const hinge = new THREE.Group();
      const sx = s === 0 ? -1 : 1;
      hinge.position.set(d.x + sx * (d.w / 2 - 0.02), 0, d.z);
      const pw = d.w / 2 - 0.04;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, 2.15, 0.05), doorMat);
      panel.position.set(-sx * pw / 2, 1.1, 0);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.35, 0.06), kickMat);
      kick.position.set(-sx * pw / 2, 0.2, 0);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.06), winMat);
      win.position.set(-sx * pw / 2, 1.55, 0);
      hinge.add(panel, kick, win);
      panel.castShadow = shadows;
      panel.receiveShadow = shadows;
      scene.add(hinge);
      d.panels.push(hinge);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), staffMat);
    sign.position.set(d.x, doorH + 0.25, SD - 0.01);
    sign.rotation.y = Math.PI;
    scene.add(sign);
    // exit sign over the stockroom side
    const exitT = signTexture(['EXIT'], { w: 256, h: 96, bg: '#1a0000', fg: '#ff3b2a', emissive: true });
    const exitM = new THREE.MeshStandardMaterial({ map: exitT, emissive: 0xffffff, emissiveMap: exitT, emissiveIntensity: 2.2 });
    const ex = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), exitM);
    ex.position.set(d.x, doorH + 0.2, S0 + 0.05);
    scene.add(ex);
  }

  // ------------------------------------------------------------ ceiling lights
  const fixturesOn = [];
  const addFixture = (x, z, on, flicker = false) => {
    w.slab('darkMetal', x - 0.32, H1 - 0.04, z - 0.62, x + 0.32, H1 - 0.01, z + 0.62, { noShadow: true });
    w.slab(on ? (flicker ? 'lightFlicker' : 'lightOn') : 'diffuserOff', x - 0.28, H1 - 0.05, z - 0.58, x + 0.28, H1 - 0.035, z + 0.58, { noShadow: true, noChunk: on });
    if (on) fixturesOn.push({ x, z, flicker });
  };

  // ------------------------------------------------------------------ helpers
  const productBox = (x, y, z, wd, h, dp, tile, ry) => {
    const front = RECT(tile);
    const side = [front[0], front[1], front[0] + (front[2] - front[0]) * 0.12, front[3]];
    const top = [front[0], front[3] - (front[3] - front[1]) * 0.1, front[2], front[3]];
    // faces: px nx py ny pz nz  — product faces +x in local space
    w.box('prod', x, y + h / 2, z, dp, h, wd, { ry, faceRects: [front, front, top, top, side, side] });
  };
  const productCyl = (x, y, z, r, h, tile, capTile = ATLAS.METAL) => {
    w.cyl('prod', x, y + h / 2, z, r, h, { seg: 10, uvRect: RECT(tile), noShadow: true });
    w.cyl('prod', x, y + h + 0.006, z, r * 0.92, 0.012, { seg: 10, uvRect: RECT(capTile), noShadow: true });
  };
  const cardboardBox = (x, y, z, wd, h, dp, ry = 0, variant = R.int(0, 3)) => {
    const q = variant;
    const u0 = (q % 2) * 0.5, v0 = q < 2 ? 0.5 : 0;
    const r = [u0 + 0.01, v0 + 0.01, u0 + 0.49, v0 + 0.49];
    w.box('box', x, y + h / 2, z, wd, h, dp, { ry, uvRect: r });
  };
  const pallet = (x, z, ry = 0) => {
    w.box('wood', x, 0.07, z, 1.2, 0.14, 1.0, { ry });
  };
  const stack = (x, z, h, ry = 0, wrap = false) => {
    pallet(x, z, ry);
    let y = 0.14;
    const bw = 0.58, bd = 0.48;
    while (y < h) {
      const bh = R.range(0.28, 0.42);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        if (y + bh > h && R() < 0.5) continue;
        const ox = (i - 0.5) * 0.6, oz = (j - 0.5) * 0.5;
        const c = Math.cos(ry), s = Math.sin(ry);
        cardboardBox(x + ox * c + oz * s, y, z - ox * s + oz * c, bw, bh, bd, ry + R.range(-0.04, 0.04));
      }
      y += bh;
    }
    if (wrap) w.box('glass', x, (h + 0.14) / 2, z, 1.22, h - 0.1, 1.02, { ry, noShadow: true });
  };
  const sphereGeo = new THREE.SphereGeometry(1, 7, 5);
  const cart = (x, z, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const part = (mat, lx, ly, lz, sx, sy, sz) => w.box(mat, x + lx * c + lz * s, ly, z - lx * s + lz * c, sx, sy, sz, { ry });
    part('wire', 0, 0.75, 0, 0.55, 0.42, 0.85);
    part('chrome', 0, 0.54, 0, 0.56, 0.02, 0.86);
    part('chrome', 0, 0.96, 0.44, 0.56, 0.02, 0.02);
    part('chrome', 0, 1.0, 0.52, 0.5, 0.035, 0.035);
    part('wire', 0, 0.22, 0.05, 0.5, 0.02, 0.7);
    for (const lx of [-0.24, 0.24]) {
      part('chrome', lx, 0.3, 0.38, 0.025, 0.6, 0.025);
      part('chrome', lx, 0.3, -0.38, 0.025, 0.6, 0.025);
      for (const lz of [-0.36, 0.36]) part('rubber', lx, 0.05, lz, 0.03, 0.09, 0.09);
    }
  };

  // ------------------------------------------------------------ sales floor
  const gx = (i) => L.gondolaX0 + i * L.gondolaSpacing;
  const z0 = L.aisleZ0, z1 = L.aisleZ1;
  const aisleCats = [
    ['CEREAL', 'COFFEE · TEA'], ['CANNED GOODS', 'SOUP · BEANS'], ['PASTA · RICE', 'SAUCES'], ['SNACKS', 'CHIPS · COOKIES'],
    ['BEVERAGES', 'SODA · WATER'], ['HOUSEHOLD', 'CLEANING · PAPER'], ['BAKING', 'FLOUR · SUGAR'], ['HOME', 'BEDDING · TOYS'],
  ];
  const shelfYs = [0.12, 0.5, 0.88, 1.26, 1.64];
  const kinds = ['cereal', 'can', 'box', 'bottle', 'jar', 'bag', 'jug', 'towel'];

  function fillShelf(xFront, y, zA, zB, facing, kind, tile, depthAvail) {
    // products stand on a shelf at height y, front edge at xFront, facing ±x
    let z = zA + 0.02;
    const dir = facing; // +1 faces +x
    const ry = dir > 0 ? 0 : Math.PI;
    while (z < zB - 0.05) {
      let wd, h, dp;
      switch (kind) {
        case 'cereal': wd = 0.19; h = 0.29; dp = 0.07; break;
        case 'box': wd = 0.15; h = 0.2; dp = 0.06; break;
        case 'bag': wd = 0.22; h = 0.3; dp = 0.09; break;
        case 'jug': wd = 0.15; h = 0.27; dp = 0.11; break;
        case 'can': wd = 0.078; h = 0.115; dp = 0.078; break;
        case 'jar': wd = 0.085; h = 0.14; dp = 0.085; break;
        case 'bottle': wd = 0.1; h = 0.31; dp = 0.1; break;
        case 'towel': wd = 0.13; h = 0.27; dp = 0.13; break;
      }
      const gap = 0.012;
      if (z + wd > zB - 0.02) break;
      if (R() < 0.94 * (0.55 + 0.45 * cfg.productDensity)) {
        const zc = z + wd / 2;
        const rows = Math.max(1, Math.floor(depthAvail / (dp + 0.01)));
        const round = kind === 'can' || kind === 'jar' || kind === 'bottle' || kind === 'towel';
        const nRows = Math.min(rows, cfg.productDensity >= 1 && !round ? 2 : 1);
        for (let r = 0; r < nRows; r++) {
          const xc = xFront - dir * (0.03 + dp / 2 + r * (dp + 0.01));
          const jitter = R.range(-0.008, 0.008);
          if (kind === 'can' || kind === 'jar') {
            if (kind === 'jar') productCyl(xc, y, zc, wd / 2, h, tile, R.pick([ATLAS.METAL, ATLAS.RED, ATLAS.GREEN]));
            else {
              w.cyl('prod', xc, y + h / 2, zc, wd / 2, h, { seg: 8, uvRect: RECT(tile), noShadow: true });
              if (R() < 0.7) w.cyl('prod', xc, y + h * 1.5 + 0.004, zc, wd / 2, h, { seg: 8, uvRect: RECT(tile), noShadow: true });
            }
          } else if (kind === 'bottle') {
            w.cyl('prod', xc, y + 0.11, zc, 0.05, 0.22, { seg: 10, uvRect: RECT(tile), noShadow: true });
            w.cyl('prod', xc, y + 0.25, zc, 0.03, 0.08, { seg: 8, uvRect: RECT(ATLAS.AMBER), noShadow: true });
            w.cyl('prod', xc, y + 0.3, zc, 0.016, 0.03, { seg: 8, uvRect: RECT(ATLAS.RED), noShadow: true });
          } else if (kind === 'towel') {
            w.cyl('prod', xc, y + h / 2, zc, 0.065, h, { seg: 10, uvRect: RECT(ATLAS.WHITE), noShadow: true });
            w.cyl('prod', xc, y + h / 2, zc, 0.067, h * 0.35, { seg: 10, uvRect: RECT(tile), noShadow: true });
          } else {
            productBox(xc, y, zc + jitter, wd, h * R.range(0.97, 1.0), dp, tile, ry + R.range(-0.03, 0.03));
          }
        }
      }
      z += wd + gap;
    }
  }

  const gondola = (i) => {
    const cx = gx(i);
    // base, spine, top
    w.slab('shelfDark', cx - 0.5, 0, z0, cx + 0.5, 0.12, z1);
    w.slab('peg', cx - 0.03, 0.12, z0, cx + 0.03, 2.05, z1, { tile: 0.6 });
    w.slab('shelf', cx - 0.06, 2.0, z0, cx + 0.06, 2.06, z1);
    // uprights
    for (let z = z0; z <= z1 + 0.01; z += 1.25) w.slab('shelf', cx - 0.06, 0, z - 0.03, cx + 0.06, 2.06, z + 0.03);
    for (const s of [-1, 1]) {
      for (let k = 1; k < shelfYs.length; k++) {
        const y = shelfYs[k];
        w.slab('shelf', cx + s * 0.04, y - 0.02, z0, cx + s * 0.48, y, z1);
        w.wallQuad('price', z0, z1, y - 0.05, y - 0.005, cx + s * 0.485, 'z', s, { tile: 1.6, noShadow: true });
      }
      // products, per 1.25 m bay
      for (let z = z0; z < z1 - 0.1; z += 1.25) {
        for (let k = 0; k < shelfYs.length; k++) {
          const kind = k === 0 ? R.pick(['jug', 'towel', 'bag', 'cereal']) : R.pick(kinds);
          const tile = R.int(0, 55);
          fillShelf(cx + s * 0.47, shelfYs[k], z, Math.min(z + 1.25, z1), s, kind, tile, 0.4);
        }
      }
      // overstock on top
      for (let z = z0 + 0.4; z < z1 - 0.5; z += R.range(1.2, 2.6)) {
        if (R() < 0.6) cardboardBox(cx + s * 0.22, 2.06, z, 0.4, R.range(0.25, 0.45), 0.5, R.range(-0.1, 0.1));
      }
    }
    // end caps facing ±z
    for (const [ez, f] of [[z0 - 0.3, -1], [z1 + 0.3, 1]]) {
      w.slab('shelfDark', cx - 0.55, 0, ez - 0.3, cx + 0.55, 0.12, ez + 0.3);
      w.slab('shelf', cx - 0.55, 0.12, ez - f * 0.3 - 0.03, cx + 0.55, 1.75, ez - f * 0.3 + 0.03);
      for (const y of [0.5, 0.95, 1.4]) {
        w.slab('shelf', cx - 0.55, y - 0.02, ez - 0.28, cx + 0.55, y, ez + 0.28);
        const tile = R.int(0, 55);
        // rotate product placement: products face ±z
        for (let x = cx - 0.5; x < cx + 0.45; x += 0.2) {
          if (R() < 0.15) continue;
          productBox(x + 0.09, y, ez + f * 0.12, 0.18, 0.27, 0.07, tile, f > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
      }
      for (let x = cx - 0.5; x < cx + 0.45; x += 0.24) {
        if (R() < 0.2) continue;
        cardboardBox(x + 0.11, 0.12, ez + f * 0.05, 0.22, 0.3, 0.4);
      }
    }
    C(cx - 0.6, z0 - 0.62, cx + 0.6, z1 + 0.62);
  };
  for (let i = 0; i < L.gondolas; i++) gondola(i);

  // aisle signs hanging over each walkway between gondolas
  for (let k = 0; k <= L.gondolas; k++) {
    const ax = k === 0 ? gx(0) - L.gondolaSpacing / 2 : gx(k - 1) + L.gondolaSpacing / 2;
    if (ax < 1.5 || ax > W - 4.5) continue;
    const cat = aisleCats[k % aisleCats.length];
    const name = 'aisle' + k;
    signMat(name, [`${k + 1}`, { text: cat[0], size: 0.17 }, { text: cat[1], size: 0.13 }], { w: 512, h: 256, bg: '#13365f', fg: '#f4f1e6' });
    const zc = (z0 + z1) / 2;
    w.box(name, ax, 3.2, zc, 1.3, 0.62, 0.04, { noChunk: true, noShadow: true });
    w.box('darkMetal', ax - 0.5, 3.75, zc, 0.01, 0.5, 0.01, { noShadow: true });
    w.box('darkMetal', ax + 0.5, 3.75, zc, 0.01, 0.5, 0.01, { noShadow: true });
  }

  // drop-ceiling troffers over the aisles; a few still lit
  const onList = cfg.fixtureLights;
  const fixtureSlots = [];
  for (let k = 0; k <= L.gondolas; k++) {
    const ax = k === 0 ? gx(0) - L.gondolaSpacing / 2 : gx(k - 1) + L.gondolaSpacing / 2;
    if (ax > W - 1) continue;
    for (let z = 2.4; z < SD - 1; z += 2.4) fixtureSlots.push([ax, z]);
  }
  if (W - 2 > gx(L.gondolas - 1) + 3) for (let z = 2.4; z < SD - 1; z += 2.4) fixtureSlots.push([W - 3, z]);
  // choose lit fixtures deterministically spread across the floor
  const litWanted = [
    [gx(1) + L.gondolaSpacing / 2, (z0 + z1) / 2 + 1.2],
    [L.checkoutX0 + L.checkoutSpacing * 1.5, 7.2],
    [gx(Math.max(0, L.gondolas - 2)) + L.gondolaSpacing / 2, z0 + 1.2],
    [gx(0) - L.gondolaSpacing / 2, z1 - 1],
    [W - 3, (z0 + z1) / 2],
    [gx(Math.floor(L.gondolas / 2)) - L.gondolaSpacing / 2, z1 + 2.4],
  ].slice(0, onList);
  const litSet = new Set();
  litWanted.forEach(([x, z], idx) => {
    let best = 0, bd = 1e9;
    fixtureSlots.forEach(([fx, fz], j) => {
      const d = Math.hypot(fx - x, fz - z);
      if (d < bd && !litSet.has(j)) { bd = d; best = j; }
    });
    litSet.add(best);
    fixtureSlots[best].flicker = idx === 1;
  });
  fixtureSlots.forEach(([x, z], j) => addFixture(x, z, litSet.has(j), fixtureSlots[j].flicker));

  // checkouts
  const cz0 = L.checkoutZ0 ?? 4.0, clen = L.checkoutLen ?? 3.4;
  const hideLanes = cfg.name === 'mobile' ? [0, 2] : [1, 3];
  for (let i = 0; i < L.checkouts; i++) {
    const x = L.checkoutX0 + i * L.checkoutSpacing;
    const hx0 = cz0 + 0.3, hx1 = cz0 + 1.15; // knee-space z range
    // counter: front block, knee space (open to +x), long belt section
    w.slab('laminate', x - 0.4, 0, cz0, x + 0.4, 0.9, hx0);
    w.slab('laminate', x - 0.4, 0, hx0, x - 0.32, 0.75, hx1);
    w.slab('laminate', x - 0.4, 0.75, hx0, x + 0.4, 0.9, hx1);
    w.slab('laminate', x - 0.4, 0, hx1, x + 0.4, 0.9, cz0 + clen);
    w.slab('rubber', x - 0.3, 0.9, hx1 + 0.1, x + 0.3, 0.93, cz0 + clen - 0.1);
    w.slab('chrome', x - 0.38, 0.9, hx1 + 0.05, x - 0.33, 0.95, cz0 + clen - 0.05);
    w.slab('chrome', x + 0.33, 0.9, hx1 + 0.05, x + 0.38, 0.95, cz0 + clen - 0.05);
    // register + screen
    w.slab('plastic', x + 0.05, 0.9, cz0 + 0.45, x + 0.35, 1.02, cz0 + 0.85);
    w.box('plastic', x + 0.2, 1.22, cz0 + 0.65, 0.06, 0.3, 0.38, { ry: 0 });
    // lane light pole
    w.cyl('chrome', x - 0.35, 1.25, cz0 + clen - 0.1, 0.025, 2.5, { seg: 8 });
    const ln = 'lane' + i;
    signMat(ln, [`${i + 1}`], { w: 128, h: 128, bg: '#0b0b0b', fg: i === 2 ? '#ffd27a' : '#3a3a3a', emissive: i === 2, glow: 1.4 });
    w.box(ln, x - 0.35, 2.6, cz0 + clen - 0.1, 0.24, 0.24, 0.24, { noChunk: true, noShadow: true });
    // impulse rack on the customer side
    w.slab('shelfDark', x - 1.0, 0, cz0 + 1.6, x - 0.65, 1.25, cz0 + 2.6);
    for (const y of [0.35, 0.65, 0.95]) {
      for (let z = cz0 + 1.65; z < cz0 + 2.55; z += 0.09) if (R() < 0.85) productBox(x - 0.72, y, z + 0.04, 0.08, 0.12, 0.04, R.int(0, 55), Math.PI);
    }
    C(x - 0.42, cz0, x + 0.42, cz0 + clen, false);
    C(x - 1.02, cz0 + 1.58, x - 0.63, cz0 + 2.62, false);
    if (hideLanes.includes(i)) {
      lvl.hides.push({
        id: 'counter' + i, kind: 'counter', label: 'crawl under the counter',
        enter: { x: x + 0.95, z: (hx0 + hx1) / 2 }, cam: new THREE.Vector3(x - 0.12, 0.5, (hx0 + hx1) / 2),
        yaw: -Math.PI / 2, yawRange: 1.0, pitch: [-0.5, 0.35],
        check: { x: x + 1.0, z: (hx0 + hx1) / 2 }, exit: { x: x + 0.95, z: (hx0 + hx1) / 2 },
        comfort: 0.15,
      });
    }
    poi(x + 0.95, cz0 + 1.5, 'front');
  }

  // shopping carts: a nested row by the entrance, one abandoned in an aisle
  for (let i = 0; i < 5; i++) cart(entX0 - 1.2, 1.2 + i * 0.32, Math.PI);
  C(entX0 - 1.55, 0.6, entX0 - 0.85, 3.2, false);
  cart(gx(2) + L.gondolaSpacing / 2 - 0.3, z0 + 4.5, 0.6);
  C(gx(2) + L.gondolaSpacing / 2 - 0.75, z0 + 4.0, gx(2) + L.gondolaSpacing / 2 + 0.15, z0 + 5.0, false);
  // knocked-over products on the floor
  for (let n = 0; n < 14; n++) {
    const k = R.int(0, L.gondolas - 2);
    const x = gx(k) + L.gondolaSpacing / 2 + R.range(-0.7, 0.7), z = R.range(z0 + 0.5, z1 - 0.5);
    if (R() < 0.5) productBox(x, 0, z, 0.19, 0.07, 0.29, R.int(0, 55), R() * 6);
    else w.cyl('prod', x, 0.04, z, 0.038, 0.11, { seg: 10, rz: Math.PI / 2, ry: R() * 6, uvRect: RECT(R.int(0, 55)) });
  }

  // produce tables on the left
  const prodX = (gx(0) - 0.6) / 2;
  const fruitCols = [0xa61b1b, 0x6aa832, 0xe8861a, 0xe9d23b, 0x7a1f3d, 0x3b7a1f, 0xc23a22];
  for (let t = 0; t < L.produceTables; t++) {
    const tz = z0 + 1.6 + t * ((z1 - z0 - 3.2) / Math.max(1, L.produceTables - 1));
    w.slab('wood', prodX - 0.75, 0, tz - 1.25, prodX + 0.75, 0.75, tz + 1.25);
    w.slab('wood', prodX - 0.8, 0.75, tz - 1.3, prodX + 0.8, 0.82, tz + 1.3);
    for (let b = 0; b < 3; b++) {
      const bz0 = tz - 1.2 + b * 0.82;
      const color = col3(R.pick(fruitCols));
      const rr = R.range(0.035, 0.05);
      const step = rr * 2.05;
      for (let fx = prodX - 0.7; fx < prodX + 0.7; fx += step) for (let fz = bz0; fz < bz0 + 0.74; fz += step) {
        if (R() > 0.55 + cfg.productDensity * 0.45) continue;
        const c = color.clone().offsetHSL(R.range(-0.02, 0.02), 0, R.range(-0.08, 0.06));
        const mound = 0.86 + 0.08 * Math.sin(((fx - prodX) / 1.4 + 0.5) * Math.PI);
        w.geo('fruit', sphereGeo, fx + R.range(-0.008, 0.008), mound + rr * 0.8, fz, rr, rr * 0.95, rr, { color: c, noShadow: true });
      }
      w.slab('wood', prodX - 0.8, 0.82, bz0 + 0.76, prodX + 0.8, 0.9, bz0 + 0.8);
    }
    C(prodX - 0.82, tz - 1.32, prodX + 0.82, tz + 1.32, false);
    poi(prodX + 1.4, tz, 'produce');
  }
  signMat('sProduce', ['FRESH PRODUCE'], { w: 1024, h: 160, bg: '#25502c', fg: '#f3efdc' });
  w.wallQuad('sProduce', z0 + 1, z1 - 1, 3.0, 3.6, 0.01, 'z', 1, { noShadow: true, noChunk: true, uv01: true });

  // dairy cases along the back wall of the sales floor
  const dairyZ0 = SD - 1.0;
  let segStart = 0.8;
  const segs = [];
  for (const dx of doorXs) {
    const sEnd = dx - doorW / 2 - 0.5;
    if (sEnd - segStart > 1.5) segs.push([segStart, sEnd]);
    segStart = dx + doorW / 2 + 0.5;
  }
  if (W - 0.3 - segStart > 1.5) segs.push([segStart, W - 0.3]);
  let coolerLights = cfg.coolerLights;
  segs.forEach(([a, b], si) => {
    const dead = si === 1 && segs.length > 2;
    w.slab('darkMetal', a, 0, dairyZ0, b, 0.4, SD);
    w.slab(dead ? 'coolOff' : 'coolBack', a, 0.4, SD - 0.12, b, 2.0, SD - 0.02, { noShadow: true });
    w.slab('darkMetal', a, 2.0, dairyZ0 - 0.05, b, 2.3, SD);
    w.slab(dead ? 'coolOff' : 'coolGlow', a + 0.05, 1.96, dairyZ0, b - 0.05, 2.0, dairyZ0 + 0.3, { noShadow: true });
    w.slab('darkMetal', a - 0.05, 0, dairyZ0, a, 2.3, SD);
    w.slab('darkMetal', b, 0, dairyZ0, b + 0.05, 2.3, SD);
    for (const y of [0.4, 0.8, 1.2, 1.6]) {
      w.slab('shelf', a, y - 0.02, dairyZ0 + 0.1, b, y, SD - 0.12);
      w.wallQuad('price', a, b, y - 0.05, y - 0.005, dairyZ0 + 0.09, 'x', -1, { tile: 1.6, noShadow: true });
      let x = a + 0.05;
      const tileA = R.int(0, 55);
      while (x < b - 0.15) {
        if (R() < 0.85) {
          if (y < 1.0) {
            // milk jugs
            w.cyl('prod', x + 0.065, y + 0.12, dairyZ0 + 0.25, 0.065, 0.24, { seg: 10, uvRect: RECT(ATLAS.WHITE), noShadow: true });
            w.cyl('prod', x + 0.065, y + 0.255, dairyZ0 + 0.25, 0.022, 0.03, { seg: 8, uvRect: RECT(R.pick([ATLAS.RED, ATLAS.GREEN, 18])), noShadow: true });
          } else {
            productBox(x + 0.06, y, dairyZ0 + 0.25, 0.11, 0.1, 0.09, tileA, Math.PI / 2);
          }
        }
        x += 0.14;
      }
    }
    C(a - 0.05, dairyZ0 - 0.05, b + 0.05, SD);
    if (!dead && coolerLights-- > 0) lvl.pointLights.push({ x: (a + b) / 2, y: 1.7, z: dairyZ0 - 0.5, color: 0xcfe6ff, intensity: 8, distance: 8, kind: 'cooler' });
    poi((a + b) / 2, dairyZ0 - 1.2, 'dairy');
  });
  signMat('sDairy', ['DAIRY'], { w: 512, h: 128, bg: '#1d3a5c', fg: '#eef4ff' });
  w.wallQuad('sDairy', W / 2 - 3, W / 2 + 3, 2.9, 3.6, SD - 0.01, 'x', -1, { noShadow: true, noChunk: true, uv01: true });

  // upright freezers along the right wall
  const fz0 = z0 - 1, fz1 = z1 + 1;
  const fx0 = W - 0.95;
  w.slab('darkMetal', fx0, 0, fz0, W, 0.25, fz1);
  w.slab('darkMetal', fx0, 2.15, fz0, W, 2.5, fz1);
  w.slab('coolBack', W - 0.12, 0.25, fz0, W - 0.02, 2.15, fz1, { noShadow: true });
  for (let z = fz0; z < fz1 - 0.5; z += 0.8) {
    w.slab('darkMetal', fx0 - 0.02, 0.25, z, fx0 + 0.06, 2.15, z + 0.05);
    w.slab('coolGlow', fx0 + 0.07, 0.3, z + 0.012, fx0 + 0.08, 2.1, z + 0.038, { noShadow: true });
    w.slab('fglass', fx0 - 0.01, 0.27, z + 0.05, fx0 + 0.0, 2.13, z + 0.8, { noShadow: true });
    w.slab('chrome', fx0 - 0.06, 0.9, z + 0.7, fx0 - 0.03, 1.6, z + 0.73);
    for (const y of [0.3, 0.75, 1.2, 1.65]) {
      w.slab('shelf', fx0 + 0.1, y - 0.02, z + 0.05, W - 0.12, y, z + 0.8, { noShadow: true });
      const tile = R.int(0, 55);
      for (let zz = z + 0.08; zz < z + 0.75; zz += 0.17) if (R() < 0.85) productBox(fx0 + 0.25, y, zz + 0.07, 0.15, 0.22, 0.05, tile, Math.PI);
    }
  }
  C(fx0 - 0.08, fz0, W, fz1);
  if (cfg.freezerLight) lvl.pointLights.push({ x: W - 1.7, y: 1.6, z: (fz0 + fz1) / 2, color: 0xbfdfff, intensity: 11, distance: 10, kind: 'freezer' });
  signMat('sFrozen', ['FROZEN FOODS'], { w: 1024, h: 160, bg: '#1b4f7a', fg: '#eaf6ff' });
  w.wallQuad('sFrozen', fz0 + 1, fz1 - 1, 2.8, 3.4, W - 0.01, 'z', -1, { noShadow: true, noChunk: true, uv01: true });
  poi(W - 2, (fz0 + fz1) / 2, 'freezer');
  poi(W - 2, fz0 + 1, 'freezer', 0.6);
  poi(W - 2, fz1 - 1, 'freezer', 0.6);

  // chest freezers (desktop): open-top island cases
  if (L.chestFreezers) {
    const cxm = (gx(L.gondolas - 1) + 0.6 + fx0) / 2;
    for (const [a, b] of [[z0 + 1, z0 + 5.6], [z0 + 6.4, z1 - 1]]) {
      w.slab('enamel', cxm - 0.55, 0, a, cxm + 0.55, 0.85, b);
      w.slab('coolGlow', cxm - 0.45, 0.84, a + 0.08, cxm + 0.45, 0.85, b - 0.08, { noShadow: true });
      for (let z = a + 0.15; z < b - 0.2; z += 0.2) for (const dx of [-0.25, 0.05]) if (R() < 0.8) productBox(cxm + dx + 0.1, 0.62, z + 0.08, 0.15, 0.22, 0.05, R.int(0, 55), R.range(-0.4, 0.4));
      w.slab('fglass', cxm - 0.5, 0.95, a + 0.03, cxm + 0.5, 0.96, b - 0.03, { noShadow: true });
      w.slab('chrome', cxm - 0.55, 0.85, a, cxm + 0.55, 0.97, a + 0.04);
      w.slab('chrome', cxm - 0.55, 0.85, b - 0.04, cxm + 0.55, 0.97, b);
      C(cxm - 0.56, a, cxm + 0.56, b, false);
    }
  }

  // misc low pallet displays on the sales floor
  const displays = cfg.name === 'mobile'
    ? [[W - 4.2, z0 + 1.5], [W - 4.0, z1 - 1.2], [entX0 - 4, 2.2]]
    : [[entX0 - 4.2, 2.2], [3.0, 3.2], [gx(L.gondolas - 1) + 2.6, z1 + 2.2]];
  displays.forEach(([x, z], i) => {
    const h = i === 0 ? 1.0 : R.range(0.9, 1.25);
    stack(x, z, h, i === 0 ? 0 : R.range(-0.1, 0.1));
    C(x - 0.65, z - 0.55, x + 0.65, z + 0.55, false);
    if (i === 0) lvl.comfortSpots.lights = { x, y: h + 0.06, z, top: true };
  });

  // customer service desk (desktop)
  if (cfg.name !== 'mobile') {
    w.slab('laminate', 24.5, 0, 2.6, 28.5, 1.05, 3.3);
    w.slab('darkMetal', 24.5, 1.05, 2.55, 28.5, 1.09, 3.35);
    signMat('sService', ['CUSTOMER SERVICE'], { w: 1024, h: 128, bg: '#13365f', fg: '#fff' });
    w.box('sService', 26.5, 3.0, 2.95, 3.0, 0.38, 0.04, { noChunk: true, noShadow: true });
    C(24.5, 2.6, 28.5, 3.3, false);
  }
  // front exit sign
  const exitT = signTexture(['EXIT'], { w: 256, h: 96, bg: '#1a0000', fg: '#ff3b2a', emissive: true });
  const exitM = new THREE.MeshStandardMaterial({ map: exitT, emissive: 0xffffff, emissiveMap: exitT, emissiveIntensity: 2.2 });
  const exitF = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.06), exitM);
  exitF.position.set((entX0 + entX1) / 2, 3.55, 0.06);
  scene.add(exitF);

  // patrol points on the sales floor
  for (let k = 0; k <= L.gondolas; k++) {
    const ax = k === 0 ? gx(0) - L.gondolaSpacing / 2 : gx(k - 1) + L.gondolaSpacing / 2;
    if (ax > W - 1.5) continue;
    poi(ax, z0 - 1.5, 'front', 0.8);
    poi(ax, (z0 + z1) / 2, 'aisle', 1.2);
    poi(ax, z1 + 1.4, 'back', 1);
  }
  poi(entX0 - 2, 4, 'front', 0.7);
  poi(W / 2, 8.6, 'front', 1);

  // ------------------------------------------------------------- stockroom
  const rack = (xa, xb, zc, fullness = 0.75) => {
    const dz = 0.55;
    const bays = Math.max(1, Math.round((xb - xa) / 2.7));
    const bw = (xb - xa) / bays;
    for (let b = 0; b <= bays; b++) {
      const x = xa + b * bw;
      for (const s of [-1, 1]) w.slab('rackBlue', x - 0.05, 0, zc + s * dz - 0.04, x + 0.05, 4.4, zc + s * dz + 0.04);
      for (let y = 0.6; y < 4.3; y += 0.9) w.slab('rackBlue', x - 0.02, y, zc - dz, x + 0.02, y + 0.03, zc + dz, { noShadow: true });
    }
    for (const y of [1.55, 3.0]) {
      for (const s of [-1, 1]) w.slab('rackOrange', xa, y - 0.12, zc + s * dz - 0.03, xb, y, zc + s * dz + 0.03);
      w.slab('darkMetal', xa, y - 0.02, zc - dz, xb, y, zc + dz, { noShadow: true });
    }
    for (let b = 0; b < bays; b++) {
      const bx = xa + (b + 0.5) * bw;
      for (const [y, maxH] of [[0, 1.3], [1.55, 1.25], [3.0, 1.2]]) {
        if (R() > fullness) continue;
        for (const off of [-0.65, 0.65]) {
          if (bw < 2 && off > 0) continue;
          if (R() < 0.15) continue;
          const px = bx + off * (bw / 2.7);
          w.box('wood', px, y + 0.07, zc, 1.0, 0.14, 1.0);
          let yy = y + 0.14;
          const target = y + R.range(0.5, maxH);
          while (yy < target) {
            const bh = R.range(0.25, 0.4);
            for (const ox of [-0.25, 0.25]) for (const oz of [-0.24, 0.24]) if (R() < 0.92) cardboardBox(px + ox, yy, zc + oz, 0.48, bh, 0.46, R.range(-0.05, 0.05));
            yy += bh;
          }
        }
      }
    }
    C(xa - 0.06, zc - dz - 0.05, xb + 0.06, zc + dz + 0.05);
  };

  const hang = (x, z, on, flicker = false, power = 1) => {
    w.cyl('darkMetal', x, H2 - 0.6, z, 0.006, 1.2, { seg: 4, noShadow: true });
    w.cyl('darkMetal', x, H2 - 1.25, z, 0.22, 0.12, { seg: 14, noShadow: true });
    w.geo(on ? (flicker ? 'lightWarmFlicker' : 'lightWarm') : 'diffuserOff', sphereGeo, x, H2 - 1.33, z, 0.07, 0.07, 0.07, { noShadow: true, noChunk: on });
    if (on) fixturesOn.push({ x, z, y: H2 - 1.45, warm: true, flicker, power });
  };

  // structure overhead
  for (let z = S0 + 2; z < D; z += 4) {
    w.slab('darkMetal', 0, H2 - 0.45, z - 0.08, W, H2 - 0.05, z + 0.08, { noShadow: true });
  }
  for (let x = 4; x < W; x += 6) w.slab('darkMetal', x - 0.05, H2 - 0.3, S0, x + 0.05, H2 - 0.05, D, { noShadow: true });

  const holeW = 1.45; // hiding spot footprint along z
  let holeZ0;
  if (cfg.name === 'mobile') {
    rack(2.4, 9.2, S0 + 2.9);
    rack(13, W - 2.5, S0 + 2.9);
    stack(W - 3.2, D - 1.6, 1.4, 0.1, true);
    stack(W - 5.0, D - 1.2, 1.1, -0.05);
    stack(8.5, D - 1.3, 1.5, 0.05, true);
    stack(12.5, S0 + 6.4, 1.2, 0.3);
    C(W - 3.85, D - 2.15, W - 2.55, D - 1.05, false);
    C(W - 5.65, D - 1.75, W - 4.35, D - 0.65, false);
    C(7.85, D - 1.85, 9.15, D - 0.75);
    C(11.85, S0 + 5.85, 13.15, S0 + 6.95, false);
    hang((doorXs[0] + doorXs[1]) / 2, S0 + 1.4, true);
    hang(5.0, D - 1.2, true, false, 0.6);
    hang(W - 6, S0 + 5.5, false);
    poi(doorXs[0], S0 + 1.2, 'stock'); poi(doorXs[1], S0 + 1.2, 'stock');
    poi(W / 2, S0 + 1.3, 'stock');
    poi(W / 2, S0 + 5.4, 'stock', 1.2); poi(4.5, S0 + 5.6, 'stock'); poi(W - 4, S0 + 5.4, 'stock');
    poi(10.5, D - 1.2, 'stock', 0.7);
  } else {
    rack(3.5, 15.2, S0 + 3.0);
    rack(20.8, 32.5, S0 + 3.0);
    rack(4.5, 21.0, S0 + 6.9, 0.85);
    // staff room walls (back right)
    const sx0 = W - 7.5, sz0 = D - 4.0;
    w.slab('dryWhite', sx0, 0, sz0, W, 3.0, sz0 + 0.12, { tile: 2 });
    w.slab('dryWhite', sx0, 0, sz0, sx0 + 0.12, 3.0, sz0 + 0.9, { tile: 2 });
    w.slab('dryWhite', sx0, 0, sz0 + 2.1, sx0 + 0.12, 3.0, D, { tile: 2 });
    w.slab('dryWhite', sx0, 2.2, sz0 + 0.9, sx0 + 0.12, 3.0, sz0 + 2.1, { tile: 2 });
    w.slab('dryWhite', sx0, 3.0, sz0, W, 3.08, D, { tile: 2 });
    C(sx0, sz0, W, sz0 + 0.12); C(sx0, sz0, sx0 + 0.12, sz0 + 0.9); C(sx0, sz0 + 2.1, sx0 + 0.12, D);
    // lockers along the back wall
    const lockX0 = sx0 + 1.2;
    const lockerMat = 'locker';
    w.mat(lockerMat, std({ color: col3(0x5d7183), roughness: 0.45, metalness: 0.55, envMap: env, envMapIntensity: 0.3 }));
    for (let i = 0; i < 6; i++) {
      const lx = lockX0 + i * 0.5;
      const hideable = i === 1 || i === 4;
      // carcass
      w.slab(lockerMat, lx, 0, D - 0.52, lx + 0.02, 1.9, D);
      w.slab(lockerMat, lx + 0.48, 0, D - 0.52, lx + 0.5, 1.9, D);
      w.slab(lockerMat, lx, 1.88, D - 0.52, lx + 0.5, 1.9, D);
      w.slab(lockerMat, lx, 0, D - 0.52, lx + 0.5, 0.1, D);
      // door: frame + slats so you can see out from inside
      const dz = D - 0.53;
      w.slab(lockerMat, lx + 0.02, 0.1, dz - 0.01, lx + 0.06, 1.88, dz + 0.01);
      w.slab(lockerMat, lx + 0.44, 0.1, dz - 0.01, lx + 0.48, 1.88, dz + 0.01);
      w.slab(lockerMat, lx + 0.06, 0.1, dz - 0.01, lx + 0.44, 1.3, dz + 0.01);
      for (let y = 1.3; y < 1.84; y += 0.06) w.slab(lockerMat, lx + 0.06, y, dz - 0.012, lx + 0.44, y + 0.03, dz + 0.012, { rx: 0 });
      w.slab(lockerMat, lx + 0.06, 1.84, dz - 0.01, lx + 0.44, 1.88, dz + 0.01);
      w.slab('chrome', lx + 0.38, 1.0, dz - 0.03, lx + 0.41, 1.12, dz - 0.01);
      if (hideable) {
        lvl.hides.push({
          id: 'locker' + i, kind: 'locker', label: 'hide in the locker',
          enter: { x: lx + 0.25, z: D - 1.15 }, cam: new THREE.Vector3(lx + 0.25, 1.57, D - 0.38),
          yaw: 0, yawRange: 0.45, pitch: [-0.35, 0.25],
          check: { x: lx + 0.25, z: D - 1.25 }, exit: { x: lx + 0.25, z: D - 1.15 }, comfort: 0.1,
        });
      }
    }
    C(lockX0, D - 0.55, lockX0 + 3.0, D);
    // break table + vending machine + fridge
    w.slab('laminate', W - 3.2, 0.72, sz0 + 1.3, W - 1.8, 0.76, sz0 + 2.5);
    w.cyl('chrome', W - 2.5, 0.36, sz0 + 1.9, 0.04, 0.72, { seg: 8 });
    w.slab('plastic', W - 3.6, 0.42, sz0 + 1.6, W - 3.2, 0.46, sz0 + 2.0);
    w.slab('plastic', W - 1.8, 0.42, sz0 + 2.1, W - 1.4, 0.46, sz0 + 2.5, { ry: 0.3 });
    C(W - 3.25, sz0 + 1.25, W - 1.75, sz0 + 2.55, false);
    w.slab('darkMetal', W - 0.85, 0, sz0 + 0.3, W - 0.05, 1.85, sz0 + 1.2);
    w.slab('vendGlow', W - 0.86, 0.4, sz0 + 0.35, W - 0.85, 1.75, sz0 + 1.0, { noShadow: true, noChunk: true });
    C(W - 0.88, sz0 + 0.25, W, sz0 + 1.25);
    w.slab('enamel', W - 0.75, 0, D - 1.6, W - 0.05, 1.7, D - 0.9);
    C(W - 0.78, D - 1.62, W, D - 0.88);
    lvl.pointLights.push({ x: W - 1.4, y: 1.2, z: sz0 + 0.75, color: 0x9fd0ff, intensity: 4.5, distance: 6, kind: 'vend' });
    signMat('sBreak', [{ text: 'EMPLOYEES MUST', size: 0.2 }, { text: 'WASH HANDS', size: 0.26 }], { w: 256, h: 128, bg: '#f1efe8', fg: '#222' });
    w.wallQuad('sBreak', sx0 + 0.6, sx0 + 1.1, 1.4, 1.65, sz0 + 0.13, 'x', 1, { noShadow: true, noChunk: true, uv01: true });
    lvl.comfortSpots.thermos = { x: W - 2.6, y: 0.76, z: sz0 + 1.8 };
    lvl.batterySpots.push({ x: W - 2.2, y: 0.76, z: sz0 + 2.2 });
    poi(sx0 + 2.5, sz0 + 2.0, 'staff', 0.8);
    // baler + dock door + clutter
    w.slab('darkMetal', W - 0.15, 0, S0 + 1.0, W - 0.02, 3.6, S0 + 5.0);
    for (let y = 0.1; y < 3.5; y += 0.14) w.slab('shelf', W - 0.2, y, S0 + 1.0, W - 0.14, y + 0.07, S0 + 5.0, { noShadow: true });
    w.slab('yellow', W - 0.4, 0, S0 + 0.8, W - 0.02, 0.6, S0 + 1.0);
    w.slab('yellow', W - 0.4, 0, S0 + 5.0, W - 0.02, 0.6, S0 + 5.2);
    w.mat('baler', std({ color: col3(0x2f5238), roughness: 0.55, metalness: 0.4 }));
    w.slab('baler', W - 2.6, 0, S0 + 6.8, W - 0.4, 2.8, S0 + 8.3);
    w.slab('darkMetal', W - 2.4, 1.0, S0 + 6.75, W - 0.6, 2.2, S0 + 6.8);
    C(W - 2.65, S0 + 6.75, W - 0.35, S0 + 8.35);
    stack(17.5, D - 1.3, 1.6, 0.04, true);
    stack(19.0, D - 1.25, 1.2, -0.03);
    stack(25.5, S0 + 5.2, 1.0, 0.2);
    stack(9.5, D - 1.2, 1.3, 0.06);
    stack(12.5, D - 1.4, 0.4, 0.0);
    C(16.85, D - 1.85, 19.65, D - 0.7);
    C(24.85, S0 + 4.65, 26.15, S0 + 5.75, false);
    C(8.85, D - 1.75, 10.15, D - 0.65, false);
    C(11.85, D - 1.95, 13.15, D - 0.85, false);
    // pallet jack
    w.slab('rackOrange', 18.2, 0.05, S0 + 1.6, 18.8, 0.18, S0 + 2.9);
    w.cyl('darkMetal', 18.5, 0.6, S0 + 1.45, 0.02, 1.1, { seg: 6, rx: -0.3 });
    hang(18, S0 + 1.5, true);
    hang(12, S0 + 5.0, true, true);
    hang(28, S0 + 5.0, false);
    hang(5.4, D - 1.2, true, false, 0.6);
    hang(22, D - 2.5, false);
    // floor safety lines
    w.slab('yellow', 1.0, 0.003, S0 + 4.25, W - 3.2, 0.006, S0 + 4.33, { noShadow: true });
    w.slab('yellow', 1.0, 0.003, S0 + 5.95, W - 3.2, 0.006, S0 + 6.03, { noShadow: true });
    for (const dx of doorXs) { poi(dx, S0 + 1.2, 'stock'); }
    poi(18, S0 + 1.2, 'stock');
    poi(18, S0 + 5.1, 'stock', 1.3); poi(6, S0 + 5.1, 'stock'); poi(30, S0 + 5.1, 'stock');
    poi(8, D - 2.4, 'stock', 0.8); poi(22, D - 2.2, 'stock', 0.8); poi(25, D - 1.4, 'stock', 0.7);
  }

  // ------------------------------------------------------------- the hole
  // A fort of boxes in the back-left corner: blanket, lantern, a gap to look out.
  holeZ0 = D - holeW;
  const hx1 = 2.15;
  const gapZ0 = holeZ0 + 0.35, gapZ1 = D - 0.3;
  // front wall of boxes (faces the room, -z side)
  for (let x = 0.05; x < hx1; x += 0.52) {
    let y = 0;
    for (let k = 0; k < 3; k++) {
      const bh = [0.4, 0.36, 0.34][k];
      cardboardBox(x + 0.25, y, holeZ0 + 0.22, 0.5, bh, 0.42, R.range(-0.05, 0.05));
      y += bh;
    }
  }
  // opening side: corner stack + stack beside the gap, plywood roof
  for (const zc of [holeZ0 + 0.22, D - 0.15]) {
    let y = 0;
    for (let k = 0; k < 3; k++) { const bh = 0.38; cardboardBox(hx1 + 0.22, y, zc, 0.44, bh, k === 0 ? 0.42 : 0.4, R.range(-0.06, 0.06)); y += bh; }
  }
  w.slab('wood', 0.02, 1.1, holeZ0 + 0.0, hx1 + 0.48, 1.14, D, { tile: 1.2 });
  cardboardBox(0.6, 1.14, D - 0.5, 0.6, 0.45, 0.5, 0.1);
  cardboardBox(1.4, 1.14, D - 0.45, 0.55, 0.38, 0.5, -0.08);
  cardboardBox(hx1 + 0.1, 1.14, holeZ0 + 0.5, 0.5, 0.42, 0.5, 0.2);
  // a moving blanket draped over the top edge of the gap
  w.slab('felt', hx1 + 0.43, 0.96, gapZ0 - 0.05, hx1 + 0.46, 1.12, gapZ1 + 0.05, { noShadow: true });
  // inside: blanket floor, a folded spare, snacks
  w.slab('fabric', 0.08, 0.0, holeZ0 + 0.45, hx1 - 0.05, 0.06, D - 0.04, { tile: 0.9 });
  w.slab('fabric', 0.06, 0.06, D - 0.55, 0.42, 0.16, D - 0.06, { tile: 0.9, ry: 0.0 });
  productBox(0.45, 0.06, holeZ0 + 0.62, 0.22, 0.05, 0.3, 21, 0.4);
  w.cyl('prod', 0.3, 0.17, D - 0.22, 0.035, 0.22, { seg: 10, uvRect: RECT(ATLAS.WHITE) });
  productBox(0.25, 0.16, D - 0.32, 0.15, 0.2, 0.06, 13, 0.3);
  C(0, holeZ0, hx1 + 0.48, D);
  lvl.hole = {
    x0: 0, x1: hx1 + 0.48, z0: holeZ0, z1: D,
    lantern: new THREE.Vector3(1.6, 0.06, D - 0.3),
    slots: {
      pillow: new THREE.Vector3(0.62, 0.06, holeZ0 + 0.72),
      teddy: new THREE.Vector3(1.4, 0.06, holeZ0 + 0.62),
      lights: new THREE.Vector3(hx1 - 0.02, 1.02, (holeZ0 + D) / 2 + 0.05),
      thermos: new THREE.Vector3(1.92, 0.06, holeZ0 + 0.58),
      comic: new THREE.Vector3(1.1, 0.062, (holeZ0 + D) / 2 + 0.22),
    },
  };
  const gapMid = (gapZ0 + gapZ1) / 2;
  lvl.hides.push({
    id: 'hole', kind: 'hole', label: 'crawl into your spot',
    enter: { x: hx1 + 1.05, z: gapMid }, cam: new THREE.Vector3(0.72, 0.56, gapMid),
    yaw: -Math.PI / 2, yawRange: 1.15, pitch: [-0.55, 0.4],
    check: { x: hx1 + 1.0, z: gapMid }, exit: { x: hx1 + 1.05, z: gapMid },
    peek: new THREE.Vector3(1.55, 0.6, gapMid),
    comfort: 1,
  });
  poi(hx1 + 2.5, gapMid - 0.4, 'hole', 0.5);

  // ----------------------------------------------- lights for lit fixtures
  fixturesOn.forEach((f) => {
    lvl.pointLights.push({
      x: f.x, y: f.y ?? H1 - 0.08, z: f.z,
      color: f.warm ? 0xffb874 : 0xe4eeff,
      intensity: (f.warm ? 30 : 52) * (f.power ?? 1), distance: f.warm ? 13 : 15,
      kind: f.warm ? 'lamp' : 'fixture', flicker: f.flicker,
    });
  });

  // ---------------------------------------------------------- item spots
  // batteries: shelf fronts at hand height, checkout belts, stockroom stacks
  for (let i = 0; i < L.gondolas; i++) {
    for (const s of [-1, 1]) {
      const zz = R.range(z0 + 1, z1 - 1);
      lvl.batterySpots.push({ x: gx(i) + s * 0.5, y: R.pick([0.88, 1.26]), z: zz, face: s });
    }
  }
  for (let i = 0; i < L.checkouts; i++) lvl.batterySpots.push({ x: L.checkoutX0 + i * L.checkoutSpacing, y: 0.93, z: cz0 + clen - 0.6 });
  lvl.batterySpots.push({ x: prodX, y: 0.9, z: z0 + 0.3 });
  lvl.batterySpots.push({ x: W - 1.2, y: 0.25, z: (fz0 + fz1) / 2 + 0.5 });
  // comfort item spots
  lvl.comfortSpots.pillow = { x: gx(L.gondolas - 1) - 0.36, y: 0.12, z: z1 - 2.5 };
  lvl.comfortSpots.teddy = { x: gx(1), y: 1.4, z: z0 - 0.3 + 0.1, endcap: true };
  lvl.comfortSpots.comic ??= { x: L.checkoutX0 - 0.82, y: 1.25, z: cz0 + 2.1 };
  if (!lvl.comfortSpots.thermos) lvl.comfortSpots.thermos = { x: L.checkoutX0 + L.checkoutSpacing, y: 0.93, z: cz0 + clen - 1.2 };

  // build everything
  lvl.meshes = w.build(scene, shadows);
  lvl.materials = w.materials;
  lvl.surfaceAt = (x, z) => (z > SD ? 'concrete' : 'tile');
  lvl.inStock = (x, z) => z > SD;
  return lvl;
}
