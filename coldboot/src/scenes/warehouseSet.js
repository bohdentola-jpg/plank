// The fish warehouse at Bely Mys, Chukotka: a long table under one lamp.
// Built as a film set — everything the camera sees across the table, lit for
// mood: warm pendant lamp, cold window light, red neon, heater glow, laptop.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../core/util.js';

const rng = makeRng('belymys');

function canvasTex(w, h, draw, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function noiseFill(g, w, h, base, n, amp, size = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rng() * amp);
    g.fillStyle = `rgba(${rng() > 0.5 ? 255 : 0},${rng() > 0.5 ? 255 : 0},${rng() > 0.5 ? 255 : 0},${v / 255})`;
    g.fillRect(rng() * w, rng() * h, size, size);
  }
}

// ------------------------------------------------------------------ materials
function materials() {
  const corr = canvasTex(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 16; i++) grd.addColorStop(i / 16, i % 2 ? '#3e4a52' : '#56646c');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { // rust streaks
      const x = rng() * w, y = rng() * h * 0.6;
      const lg = g.createLinearGradient(x, y, x, y + 40 + rng() * 120);
      lg.addColorStop(0, 'rgba(120,60,25,0.55)'); lg.addColorStop(1, 'rgba(120,60,25,0)');
      g.fillStyle = lg; g.fillRect(x, y, 2 + rng() * 6, 160);
    }
  });
  const corrN = canvasTex(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 16; i++) grd.addColorStop(i / 16, i % 2 ? 'rgb(60,128,255)' : 'rgb(196,128,255)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { data: true });
  const concrete = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#4a4b4c', 30000, 26, 2);
    for (let i = 0; i < 40; i++) { // stains + puddles
      const x = rng() * w, y = rng() * h, r = 20 + rng() * 80;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(20,22,24,${0.25 + rng() * 0.3})`); rg.addColorStop(1, 'rgba(20,22,24,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(20,20,20,0.5)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(rng() * w, rng() * h); for (let k = 0; k < 6; k++) g.lineTo(rng() * w, rng() * h); g.stroke(); }
  });
  const wetRough = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rng() * w, y = rng() * h, r = 15 + rng() * 60;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(30,30,30,0.95)'); rg.addColorStop(1, 'rgba(30,30,30,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { data: true });
  const wood = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#5a3a22'; g.fillRect(0, 0, w, h);
    for (let p = 0; p < 4; p++) { // planks
      const y0 = p * h / 4;
      g.fillStyle = ['#5e3d24', '#553620', '#61412a', '#4e321e'][p]; g.fillRect(0, y0, w, h / 4);
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(30,18,10,${0.15 + rng() * 0.25})`; g.lineWidth = 1 + rng();
        const yy = y0 + rng() * h / 4;
        g.beginPath(); g.moveTo(0, yy);
        for (let x = 0; x < w; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + i) * 3);
        g.stroke();
      }
      g.fillStyle = 'rgba(10,6,4,0.8)'; g.fillRect(0, y0, w, 2);
    }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,240,220,${rng() * 0.05})`; g.fillRect(rng() * w, rng() * h, 40 + rng() * 120, 2); }
  });
  return {
    corr: new THREE.MeshStandardMaterial({ map: corr, normalMap: corrN, roughness: 0.55, metalness: 0.55, color: 0x9aa4aa }),
    floor: new THREE.MeshStandardMaterial({ map: concrete, roughnessMap: wetRough, roughness: 1, metalness: 0.05, envMapIntensity: 1.2 }),
    wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.62, metalness: 0 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.6, metalness: 0.7 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.7, metalness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.28, metalness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.35, metalness: 0, clearcoat: 1 }),
    tea: new THREE.MeshStandardMaterial({ color: 0x4a1e08, roughness: 0.1, transparent: true, opacity: 0.9 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.9 }),
    crateBlue: new THREE.MeshStandardMaterial({ color: 0x1d4f7a, roughness: 0.55 }),
    crateGreen: new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.55 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.4 }),
    enamel: new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 9.5, 5) }),
    neonRed: new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 0.6, 0.5) }),
    heater: new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 1.6, 0.3) }),
    net: new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    cork: new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.95 }),
    windowSky: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.25, 0.22) }),
    rope: new THREE.MeshStandardMaterial({ color: 0x9a2a1a, roughness: 0.6 }),
  };
}

function box(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

// world-scale UVs for big surfaces
function uvScale(g, sx, sy) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return g;
}

/** Paper photo / document with a canvas face. */
function photo(draw, w = 0.15, h = 0.1) {
  const tex = canvasTex(256, Math.round(256 * h / w), (g, cw, ch) => draw(g, cw, ch));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  return m;
}

function samovar(M) {
  const pts = [[0, 0], [0.09, 0], [0.1, 0.02], [0.06, 0.05], [0.07, 0.08], [0.15, 0.14], [0.17, 0.24], [0.15, 0.36], [0.1, 0.4], [0.06, 0.42], [0.05, 0.5], [0.07, 0.52], [0, 0.53]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), M.brass);
  const g = new THREE.Group();
  g.add(body);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.12, 10), M.brass);
  tap.rotation.z = Math.PI / 2; tap.position.set(0.2, 0.12, 0);
  g.add(tap);
  for (const s of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 16, Math.PI), M.darkSteel);
    handle.position.set(0, 0.32, s * 0.17); handle.rotation.y = Math.PI / 2;
    g.add(handle);
  }
  const teapot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 12), new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.25 }));
  teapot.scale.y = 0.8; teapot.position.y = 0.58;
  g.add(teapot);
  return g;
}

function teaGlass(M) {
  const g = new THREE.Group();
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.07, 16, 1, true), M.brass);
  holder.position.y = 0.035;
  g.add(holder);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.031, 0.1, 16), M.glass);
  glass.position.y = 0.055;
  g.add(glass);
  const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.029, 0.075, 16), M.tea);
  tea.position.y = 0.045;
  g.add(tea);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 12, Math.PI), M.brass);
  handle.position.set(0.045, 0.04, 0); handle.rotation.z = -Math.PI / 2;
  g.add(handle);
  const spoon = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 6), M.brass);
  spoon.position.set(0.01, 0.1, 0); spoon.rotation.z = 0.25;
  g.add(spoon);
  return g;
}

function laptop(M) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), M.plastic);
  base.position.y = 0.01;
  g.add(base);
  const lid = new THREE.Group();
  lid.position.set(0, 0.02, -0.12);
  lid.rotation.x = -0.32;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.23, 0.012), M.plastic);
  shell.position.y = 0.115;
  lid.add(shell);
  const scrTex = canvasTex(512, 340, (gg, w, h) => {
    gg.fillStyle = '#020807'; gg.fillRect(0, 0, w, h);
    gg.font = '15px monospace';
    const code = ['$ ./trace --grid aurora', 'AURORA v3.2  node 4471/9210  OK', 'scan payload … 0x7F3A_…', '  segment WORMWOOD (ПОЛЫНЬ)', '  trigger: T-14d 06:00:00', '  abort: ROOT KEY (missing)', '', 'origin: 65.6N 168.1W', '  PORT ZARYA, AK', '  host: kettle-hill.ns-dyn', '', '> _'];
    code.forEach((l, i) => { gg.fillStyle = /WORMWOOD|missing|PORT/.test(l) ? '#ff5a4a' : '#4dff9a'; gg.fillText(l, 14, 28 + i * 25); });
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.2), new THREE.MeshBasicMaterial({ map: scrTex, color: new THREE.Color(1.6, 1.6, 1.6) }));
  screen.position.set(0, 0.115, 0.007);
  lid.add(screen);
  g.add(lid);
  g.userData.screen = screen;
  return g;
}

function matryoshka() {
  const tex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#b8231c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2d7b0'; g.beginPath(); g.ellipse(w / 2, h * 0.27, w * 0.2, h * 0.1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1a10'; g.fillRect(w * 0.43, h * 0.25, 3, 3); g.fillRect(w * 0.55, h * 0.25, 3, 3);
    g.fillStyle = '#c83a3a'; g.fillRect(w * 0.47, h * 0.31, 6, 3);
    g.fillStyle = '#f0c040'; g.beginPath(); g.ellipse(w / 2, h * 0.66, w * 0.28, h * 0.17, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 5; i++) { g.fillStyle = ['#e04040', '#2a6a2a', '#ffffff'][i % 3]; g.beginPath(); g.arc(w * (0.3 + i * 0.1), h * 0.66, 6, 0, Math.PI * 2); g.fill(); }
  });
  const pts = [[0, 0], [0.028, 0], [0.034, 0.03], [0.032, 0.06], [0.02, 0.075], [0.024, 0.09], [0.018, 0.105], [0, 0.112]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 0.8 }));
  m.rotation.y = -Math.PI / 2;
  return m;
}

function chair(M, seed) {
  const r = makeRng(seed);
  const parts = [];
  const h = 0.46;
  parts.push(box(0.44, 0.04, 0.42, 0, h, 0));
  for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) parts.push(box(0.035, h, 0.035, x, h / 2, z));
  parts.push(box(0.035, 0.46, 0.035, -0.19, h + 0.23, -0.19), box(0.035, 0.46, 0.035, 0.19, h + 0.23, -0.19));
  parts.push(box(0.42, 0.12, 0.025, 0, h + 0.38, -0.19), box(0.42, 0.05, 0.025, 0, h + 0.18, -0.19));
  const g = mergeGeometries(parts);
  const mesh = new THREE.Mesh(g, M.wood);
  mesh.rotation.y = (r() - 0.5) * 0.15;
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/**
 * Build the set. Returns { group, seats: {id: {x, z, rot}}, lamp, props: {...}, update(dt) }.
 * Table along X at the origin; top at y = 0.76.
 */
export function buildWarehouse() {
  const M = materials();
  const group = new THREE.Group();
  const L = 26, D = 16, Hh = 7.5;

  // floor (wet concrete) + walls + roof
  const floor = new THREE.Mesh(uvScale(new THREE.PlaneGeometry(L, D), L / 6, D / 6), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  const wallGeo = [];
  const w1 = uvScale(new THREE.PlaneGeometry(L, Hh), L / 2.2, Hh / 2.2); w1.translate(0, Hh / 2, -D / 2); wallGeo.push(w1);
  const w2 = uvScale(new THREE.PlaneGeometry(L, Hh), L / 2.2, Hh / 2.2); w2.rotateY(Math.PI); w2.translate(0, Hh / 2, D / 2); wallGeo.push(w2);
  const w3 = uvScale(new THREE.PlaneGeometry(D, Hh), D / 2.2, Hh / 2.2); w3.rotateY(Math.PI / 2); w3.translate(-L / 2, Hh / 2, 0); wallGeo.push(w3);
  const w4 = uvScale(new THREE.PlaneGeometry(D, Hh), D / 2.2, Hh / 2.2); w4.rotateY(-Math.PI / 2); w4.translate(L / 2, Hh / 2, 0); wallGeo.push(w4);
  const roof = uvScale(new THREE.PlaneGeometry(L, D), L / 2.2, D / 2.2); roof.rotateX(Math.PI / 2); roof.translate(0, Hh, 0); wallGeo.push(roof);
  const walls = new THREE.Mesh(mergeGeometries(wallGeo), M.corr);
  walls.receiveShadow = true;
  group.add(walls);

  // steel frame: columns + trusses
  const steel = [];
  for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 4) {
    steel.push(box(0.25, Hh, 0.25, x, Hh / 2, -D / 2 + 0.2), box(0.25, Hh, 0.25, x, Hh / 2, D / 2 - 0.2));
    steel.push(box(0.18, 0.35, D, x, Hh - 0.4, 0));
    for (let z = -D / 2 + 1; z < D / 2 - 1; z += 1.6) steel.push(box(0.06, 0.06, 1.2, x, Hh - 0.85 - Math.abs(z) * 0.03, z, 0));
  }
  for (const z of [-5, -1.7, 1.7, 5]) steel.push(box(L, 0.12, 0.12, 0, Hh - 0.6, z));
  const frame = new THREE.Mesh(mergeGeometries(steel), M.steel);
  frame.castShadow = true;
  group.add(frame);

  // high windows on the north wall: night sky with aurora, snow streaks
  const winTex = canvasTex(512, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0a2a2a'); gr.addColorStop(0.6, '#0c3a2c'); gr.addColorStop(1, '#061214');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) {
      const x = rng() * w;
      const ag = g.createLinearGradient(x, 0, x, h);
      ag.addColorStop(0, 'rgba(80,255,160,0)'); ag.addColorStop(0.5, 'rgba(80,255,160,0.25)'); ag.addColorStop(1, 'rgba(80,255,160,0)');
      g.fillStyle = ag; g.fillRect(x, 0, 20 + rng() * 40, h);
    }
    for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(rng() * w, rng() * h, 1.5, 1.5); }
  });
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(1.4, 1.4, 1.4) });
  for (let x = -10; x <= 10; x += 5) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), winMat);
    win.position.set(x, 5.6, -D / 2 + 0.02);
    group.add(win);
    const mull = new THREE.Mesh(mergeGeometries([box(3.5, 0.08, 0.08, 0, 0.5, 0), box(3.5, 0.08, 0.08, 0, -0.5, 0), box(0.06, 1.0, 0.06, 0, 0, 0), box(0.06, 1.0, 0.06, -1.1, 0, 0), box(0.06, 1.0, 0.06, 1.1, 0, 0)]), M.darkSteel);
    mull.position.copy(win.position).add(new THREE.Vector3(0, 0, 0.04));
    group.add(mull);
  }

  // the roll-up door (east wall) with a strip of light under it
  const door = new THREE.Mesh(uvScale(new THREE.PlaneGeometry(5, 4.5), 4, 2), M.corr);
  door.rotation.y = -Math.PI / 2; door.position.set(L / 2 - 0.05, 2.25, 3);
  group.add(door);

  // neon sign hung on the west wall: РЫБА (fish)
  const neonG = new THREE.Group();
  const letters = canvasTex(512, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'bold 120px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.strokeStyle = '#fff'; g.strokeText('РЫБА', w / 2, h / 2);
  });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: letters, color: new THREE.Color(9, 0.7, 0.55), transparent: true, depthWrite: false }));
  neonG.add(neon);
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), M.darkSteel);
  backing.position.z = -0.02;
  neonG.add(backing);
  neonG.position.set(-L / 2 + 0.06, 3.6, -1.5);
  neonG.rotation.y = Math.PI / 2;
  group.add(neonG);
  const neonLight = new THREE.PointLight(0xff2a1a, 14, 11, 1.6);
  neonLight.position.set(-L / 2 + 0.8, 3.4, -1.5);
  group.add(neonLight);

  // ---------------------------------------------------------------- the table
  const tableParts = [box(3.6, 0.06, 1.2, 0, 0.73, 0)];
  for (const [x, z] of [[-1.65, -0.5], [1.65, -0.5], [-1.65, 0.5], [1.65, 0.5]]) tableParts.push(box(0.08, 0.7, 0.08, x, 0.35, z));
  tableParts.push(box(3.3, 0.08, 0.04, 0, 0.66, -0.52), box(3.3, 0.08, 0.04, 0, 0.66, 0.52));
  const table = new THREE.Mesh(mergeGeometries(tableParts), M.wood);
  table.castShadow = true; table.receiveShadow = true;
  group.add(table);
  const top = 0.76;

  // seats (characters face the table centre)
  const seats = {
    dmitri: { x: -2.15, z: 0, rot: Math.PI / 2 },
    player: { x: 2.15, z: 0, rot: -Math.PI / 2 },
    nadia: { x: -0.95, z: -0.88, rot: 0 },
    lyosha: { x: 0.1, z: -0.88, rot: 0 },
    valya: { x: 1.1, z: -0.88, rot: 0 },
    grisha: { x: -0.85, z: 0.88, rot: Math.PI },
    ivan: { x: 0.45, z: 0.88, rot: Math.PI },
  };
  let ci = 0;
  for (const s of Object.values(seats)) {
    const c = chair(M, 'ch' + ci++);
    const back = new THREE.Vector3(0, 0, -0.14).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    c.position.set(s.x + back.x, 0, s.z + back.z);
    c.rotation.y += s.rot;
    group.add(c);
  }
  const empty = chair(M, 'empty');
  empty.position.set(1.5, 0, 1.02); empty.rotation.y = Math.PI + 0.4;
  group.add(empty);

  // table props
  const props = {};
  const sam = samovar(M);
  sam.position.set(0.55, top, -0.25);
  group.add(sam);
  props.samovar = sam;
  const glassSpots = { dmitri: [-1.75, 0.18], player: [1.72, -0.15], nadia: [-0.85, -0.38], lyosha: [-0.2, -0.42], valya: [1.0, -0.4], grisha: [-0.75, 0.38], ivan: [0.35, 0.4] };
  props.glasses = {};
  for (const [k, [x, z]] of Object.entries(glassSpots)) {
    const tg = teaGlass(M);
    tg.position.set(x, top, z);
    group.add(tg);
    props.glasses[k] = tg;
  }
  const lap = laptop(M);
  lap.position.set(0.1, top, -0.32);
  lap.rotation.y = Math.PI;
  lap.rotation.y = 0;
  group.add(lap);
  props.laptop = lap;
  const lapLight = new THREE.PointLight(0x5affc0, 1.4, 1.6, 2);
  lapLight.position.set(0.1, top + 0.18, -0.25);
  group.add(lapLight);
  // the map of the strait + photos on the table
  const map = photo((g, w, h) => {
    g.fillStyle = '#c9d6dc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8ccae';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.38, 0); g.lineTo(w * 0.32, h * 0.4); g.lineTo(w * 0.42, h * 0.6); g.lineTo(w * 0.3, h); g.lineTo(0, h); g.fill();
    g.beginPath(); g.moveTo(w, 0); g.lineTo(w * 0.62, 0); g.lineTo(w * 0.58, h * 0.35); g.lineTo(w * 0.66, h * 0.5); g.lineTo(w * 0.6, h); g.lineTo(w, h); g.fill();
    g.strokeStyle = '#c0201a'; g.lineWidth = 3; g.setLineDash([8, 6]);
    g.beginPath(); g.moveTo(w * 0.25, h * 0.45); g.lineTo(w * 0.72, h * 0.5); g.stroke();
    g.setLineDash([]); g.fillStyle = '#c0201a';
    g.beginPath(); g.arc(w * 0.25, h * 0.45, 6, 0, 7); g.fill(); g.beginPath(); g.arc(w * 0.72, h * 0.5, 6, 0, 7); g.fill();
    g.fillStyle = '#223'; g.font = 'bold 14px Arial';
    g.fillText('БЕЛЫЙ МЫС', w * 0.06, h * 0.42); g.fillText('PORT ZARYA', w * 0.73, h * 0.47);
    g.font = 'italic 12px serif'; g.fillText('Берингов пролив / Bering Strait', w * 0.32, h * 0.85);
  }, 0.62, 0.42);
  map.rotation.x = -Math.PI / 2; map.rotation.z = 0.06;
  map.position.set(-0.3, top + 0.002, 0.12);
  map.receiveShadow = true;
  group.add(map);
  props.map = map;
  const portrait = photo((g, w, h) => {
    g.fillStyle = '#e8e4dc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a4048'; g.fillRect(10, 10, w - 20, h - 40);
    g.fillStyle = '#c8b8a8'; g.beginPath(); g.ellipse(w / 2, h * 0.38, w * 0.18, h * 0.22, 0, 0, 7); g.fill();
    g.fillStyle = '#dcdcdc'; g.fillRect(w * 0.32, h * 0.12, w * 0.36, h * 0.07);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 15px Arial'; g.fillText('C. HALLORAN', 14, h - 12);
  }, 0.1, 0.13);
  portrait.rotation.x = -Math.PI / 2; portrait.rotation.z = -0.2;
  portrait.position.set(0.15, top + 0.004, 0.18);
  group.add(portrait);
  // the earpiece case, passport and the matryoshka (slid to the player later)
  const earCase = new THREE.Group();
  const cs = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.06), M.plastic);
  cs.position.y = 0.0125;
  earCase.add(cs);
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.3 }));
  bud.position.set(0, 0.03, 0);
  earCase.add(bud);
  earCase.position.set(-0.75, top, -0.15);
  group.add(earCase);
  props.earpiece = earCase;
  const pass = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.125), new THREE.MeshStandardMaterial({ color: 0x1c2a4a, roughness: 0.6 }));
  pass.position.set(0.45, top + 0.004, 0.32);
  group.add(pass);
  props.passport = pass;
  const doll = matryoshka();
  doll.position.set(1.25, top, -0.2);
  group.add(doll);
  props.doll = doll;
  // bread + salted fish on a board, yarn and needles
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.22), M.wood);
  board.position.set(-1.3, top + 0.01, 0.15);
  group.add(board);
  const bread = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshStandardMaterial({ color: 0x6a3c1c, roughness: 0.8 }));
  bread.scale.set(1.3, 0.6, 0.9); bread.position.set(-1.36, top + 0.05, 0.13);
  group.add(bread);
  const yarn = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: 0x9a3030, roughness: 1 }));
  yarn.position.set(1.32, top + 0.045, -0.42);
  group.add(yarn);

  // ---------------------------------------------------------------- the lamp
  const lampG = new THREE.Group();
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.2, 32, 1, true), M.enamel);
  shade.position.y = 0;
  lampG.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), M.bulb);
  bulb.position.y = -0.06;
  lampG.add(bulb);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Hh - 2.1, 6), M.plastic);
  cord.position.y = (Hh - 2.1) / 2 + 0.1;
  lampG.add(cord);
  lampG.position.set(0, 1.95, 0);
  group.add(lampG);
  const lamp = new THREE.SpotLight(0xffc98a, 16, 9, 1.05, 0.6, 1.6);
  lamp.position.set(0, 1.88, 0);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0003;
  lamp.shadow.normalBias = 0.02;
  lamp.shadow.camera.near = 0.2;
  group.add(lamp, lamp.target);
  const lampFill = new THREE.PointLight(0xffb070, 2.2, 6, 2);
  lampFill.position.set(0, 1.7, 0);
  group.add(lampFill);
  // the visible cone of light (dust in the beam)
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform float time; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9,78.2,37.7)))*43758.5); }
      void main(){ float t = clamp(-vP.y / 1.8, 0.0, 1.0); float edge = pow(abs(dot(vN, vV)), 1.6);
        float dust = 0.7 + 0.3 * sin(vP.x*9.0 + time*0.3) * sin(vP.z*7.0 - time*0.2);
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * edge * (1.0 - t) * 0.11 * dust, 1.0); }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.5, 1.85, 40, 1, true), beamMat);
  beam.position.set(0, 1.0, 0);
  group.add(beam);

  // window moonlight + aurora tint, heater, ambient
  const moon = new THREE.DirectionalLight(0x6a9ac8, 0.55);
  moon.position.set(-3, 9, -10);
  group.add(moon);
  const hemi = new THREE.HemisphereLight(0x1c2a36, 0x0c0a08, 0.35);
  group.add(hemi);
  const heaterG = new THREE.Group();
  const hbox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), M.steel);
  hbox.position.y = 0.3;
  heaterG.add(hbox);
  const coils = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.35), M.heater);
  coils.position.set(0, 0.32, 0.13);
  heaterG.add(coils);
  heaterG.position.set(3.4, 0, -1.6);
  heaterG.rotation.y = -0.9;
  group.add(heaterG);
  const heatLight = new THREE.PointLight(0xff6a20, 4, 4.5, 2);
  heatLight.position.set(3.2, 0.45, -1.4);
  group.add(heatLight);

  // ---------------------------------------------------------------- the room
  // fish crates stacked along the walls
  const crateG = [[], []];
  for (let i = 0; i < 40; i++) {
    const x = -11 + (i % 10) * 1.0 + rng() * 0.2, z = (i < 20 ? -6.6 : 6.4) + rng() * 0.2;
    const stack = 1 + Math.floor(rng() * 4);
    for (let s = 0; s < stack; s++) crateG[i % 2].push(box(0.8, 0.32, 0.55, x, 0.16 + s * 0.33, z, (rng() - 0.5) * 0.1));
  }
  group.add(new THREE.Mesh(mergeGeometries(crateG[0]), M.crateBlue), new THREE.Mesh(mergeGeometries(crateG[1]), M.crateGreen));
  // pallets
  const pal = [];
  for (let i = 0; i < 6; i++) pal.push(box(1.2, 0.14, 1.0, 6 + (i % 3) * 1.4, 0.07 + Math.floor(i / 3) * 0.15, 5.2));
  group.add(new THREE.Mesh(mergeGeometries(pal), M.wood));
  // a hanging net
  const net = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5, 20, 12), M.net);
  const np = net.geometry.attributes.position;
  for (let i = 0; i < np.count; i++) np.setZ(i, Math.sin(np.getX(i) * 2) * 0.15 + Math.cos(np.getY(i) * 3) * 0.1);
  net.geometry.computeVertexNormals();
  net.position.set(-6, 4.5, -7.8);
  group.add(net);
  // the spy wall: corkboard, photos and red string, behind Dmitri
  const cork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 2.4), M.cork);
  cork.position.set(-4.2, 1.6, 0);
  group.add(cork);
  const pins = [];
  for (let i = 0; i < 9; i++) {
    const p = photo((g, w, h) => {
      g.fillStyle = '#f0ece4'; g.fillRect(0, 0, w, h);
      g.fillStyle = ['#4a5a6a', '#6a5a4a', '#3a4a3a', '#5a4a5a'][i % 4]; g.fillRect(8, 8, w - 16, h - 30);
      g.fillStyle = '#ddd'; for (let k = 0; k < 6; k++) g.fillRect(12 + rng() * (w - 40), 12 + rng() * (h - 50), 10 + rng() * 30, 10 + rng() * 25);
    }, 0.2, 0.15);
    const y = 1.1 + (i % 3) * 0.42, z = -0.9 + Math.floor(i / 3) * 0.85;
    p.position.set(-4.17, y, z); p.rotation.y = Math.PI / 2; p.rotation.z = (rng() - 0.5) * 0.2;
    group.add(p);
    pins.push(new THREE.Vector3(-4.15, y + 0.05, z));
  }
  const strings = [];
  for (let i = 0; i < pins.length - 1; i += 1) {
    const a = pins[i], b = pins[(i * 4 + 3) % pins.length];
    const len = a.distanceTo(b);
    const c = new THREE.CylinderGeometry(0.003, 0.003, len, 4);
    c.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    c.applyQuaternion(q); c.translate(a.x, a.y, a.z);
    strings.push(c);
  }
  group.add(new THREE.Mesh(mergeGeometries(strings), M.rope));
  // an old CRT on a shelf showing snow
  const tvTex = canvasTex(128, 96, (g, w, h) => { for (let i = 0; i < 3000; i++) { const v = Math.floor(rng() * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rng() * w, rng() * h, 2, 2); } });
  const tv = new THREE.Group();
  const tvb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), M.plastic);
  tv.add(tvb);
  const tvs = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: tvTex, color: new THREE.Color(1.3, 1.4, 1.5) }));
  tvs.position.z = 0.23;
  tv.add(tvs);
  tv.position.set(4.6, 1.45, -3.2); tv.rotation.y = -0.6;
  group.add(tv);
  const shelf = new THREE.Mesh(box(1.4, 0.05, 0.5, 4.6, 1.22, -3.2, -0.6), M.wood);
  group.add(shelf);

  // shadows: big set pieces receive, people cast
  group.traverse((o) => { if (o.isMesh && o !== beam && o !== floor && o !== walls) { o.castShadow = o.castShadow || false; o.receiveShadow = true; } });

  return {
    group, seats, top, props, lamp, beam,
    update(dt, t) {
      beamMat.uniforms.time.value = t;
      // the neon flickers now and then
      const fl = Math.sin(t * 31) > 0.97 || (t % 7.3 < 0.08) ? 0.25 : 1;
      neon.material.color.setRGB(9 * fl, 0.7 * fl, 0.55 * fl);
      neonLight.intensity = 14 * fl;
      heatLight.intensity = 4 + Math.sin(t * 2.1) * 0.3;
      if (t % 0.08 < 0.02) tvTex.offset.set(rng(), rng());
      lampG.rotation.z = Math.sin(t * 0.4) * 0.01;
    },
  };
}
