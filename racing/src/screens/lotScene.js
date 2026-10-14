// The Quick Race lot: level P2 of a half-empty parking structure where the
// Friday meet happens. One long row of bays along +x, cars backed in facing
// the aisle (+z), cinder-block back wall, beams + flickering fluorescent
// tubes, painted bay numbers, oil stains, wet patches, hazard-striped pillars
// and light-box class signs hanging over each section.
//
// Bay k sits at x = k * BAY. The screen owns the camera and the car models.
import * as THREE from 'three';
import { getEnvMap } from '../core/envmap.js';
import { toTex, concreteTexture } from '../track/textures.js';
import { makeRng } from '../core/util.js';

export const BAY = 4.4;
const WALL_Z = -3.9;
const CEIL = 3.05;
const AISLE_FAR = 11.5;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function grain(x, w, h, rng, n, a = 0.18) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${rng() * a})` : `rgba(0,0,0,${rng() * a})`;
    x.fillRect(rng() * w, rng() * h, 1 + rng() * 1.5, 1 + rng() * 1.5);
  }
}

function blot(x, cx, cy, r, color, a) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(${color},${a})`);
  g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g;
  x.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/**
 * Floor module: two bays wide (x) by the full depth wall → far wall (z).
 * Returns color + roughness canvases (puddles are glossy).
 */
function floorModule(seed) {
  const PX = 64; // px per meter
  const w = Math.round(BAY * 2 * PX), h = Math.round((AISLE_FAR - WALL_Z) * PX);
  const c = canvas(w, h), r = canvas(w, h);
  const x = c.getContext('2d'), y = r.getContext('2d');
  const rng = makeRng('lotfloor' + seed);
  const Z = (z) => (z - WALL_Z) * PX; // world z → canvas y
  x.fillStyle = '#5d5c58';
  x.fillRect(0, 0, w, h);
  y.fillStyle = '#c4c4c4'; // rough concrete
  y.fillRect(0, 0, w, h);
  grain(x, w, h, rng, w * h * 0.35, 0.16);
  for (let i = 0; i < 40; i++) blot(x, rng() * w, rng() * h, 20 + rng() * 90, rng() < 0.7 ? '0,0,0' : '255,255,255', rng() < 0.7 ? 0.1 : 0.04);
  // slab joints
  x.strokeStyle = 'rgba(20,20,20,0.5)';
  x.lineWidth = 2;
  for (const zz of [WALL_Z + 6, WALL_Z + 12]) { x.beginPath(); x.moveTo(0, Z(zz)); x.lineTo(w, Z(zz)); x.stroke(); }
  x.beginPath(); x.moveTo(w / 2 + 1, 0); x.lineTo(w / 2 + 1, h); x.stroke();
  // light pools under each fixture (two per module)
  for (const bx of [BAY * 0.5, BAY * 1.5]) {
    blot(x, bx * PX, Z(0.2), 150, '255,250,235', 0.13);
    blot(x, bx * PX, Z(6.6), 120, '255,250,235', 0.08);
  }
  // bays: oil stain + tire scrub in the middle of each, white lines between
  for (const bx of [BAY * 0.5, BAY * 1.5]) {
    for (let k = 0; k < 3; k++) blot(x, (bx + (rng() - 0.5) * 0.6) * PX, Z(-0.4 + (rng() - 0.5) * 1.4), 18 + rng() * 26, '10,8,5', 0.5);
    blot(y, bx * PX, Z(-0.4), 46, '40,40,40', 0.55); // oily sheen
  }
  x.fillStyle = 'rgba(236,234,224,0.82)';
  for (const lx of [0, BAY, BAY * 2]) {
    x.fillRect(lx * PX - 5, Z(WALL_Z + 0.1), 10, Z(2.7) - Z(WALL_Z + 0.1));
  }
  // aisle: yellow direction arrows + tire marks
  x.save();
  x.fillStyle = 'rgba(232,186,40,0.72)';
  x.translate(BAY * PX, Z(6.4));
  x.beginPath();
  x.moveTo(-70, -12); x.lineTo(20, -12); x.lineTo(20, -34); x.lineTo(70, 0); x.lineTo(20, 34); x.lineTo(20, 12); x.lineTo(-70, 12);
  x.closePath();
  x.fill();
  x.restore();
  for (let k = 0; k < 7; k++) {
    const zz = Z(3.5 + rng() * 6), x0 = rng() * w;
    x.strokeStyle = `rgba(12,10,8,${0.12 + rng() * 0.2})`;
    x.lineWidth = 9 + rng() * 6;
    x.beginPath();
    x.moveTo(x0, zz);
    x.bezierCurveTo(x0 + 120, zz + (rng() - 0.5) * 120, x0 + 240, zz + (rng() - 0.5) * 120, x0 + 360, zz + (rng() - 0.5) * 60);
    x.stroke();
  }
  // wet patches: darker color, glossy roughness
  for (let k = 0; k < 4; k++) {
    const px = rng() * w, pz = Z(2.6 + rng() * 7.5), rx = 60 + rng() * 120, rz = 30 + rng() * 60;
    x.save(); y.save();
    x.translate(px, pz); y.translate(px, pz);
    x.scale(1, rz / rx); y.scale(1, rz / rx);
    blot(x, 0, 0, rx, '0,0,0', 0.28);
    const g = y.createRadialGradient(0, 0, rx * 0.3, 0, 0, rx);
    g.addColorStop(0, 'rgba(18,18,18,1)');
    g.addColorStop(1, 'rgba(18,18,18,0)');
    y.fillStyle = g;
    y.fillRect(-rx, -rx, rx * 2, rx * 2);
    x.restore(); y.restore();
  }
  // drain grate
  x.fillStyle = '#2a2a28';
  x.fillRect(BAY * PX - 30, Z(9.4) - 30, 60, 60);
  x.strokeStyle = '#151514';
  x.lineWidth = 3;
  for (let k = -24; k <= 24; k += 8) { x.beginPath(); x.moveTo(BAY * PX - 26, Z(9.4) + k); x.lineTo(BAY * PX + 26, Z(9.4) + k); x.stroke(); }
  return { c, r };
}

/** Cinder-block wall module (two bays wide, floor → ceiling). */
function wallModule(seed, label) {
  const PX = 64;
  const w = Math.round(BAY * 2 * PX), h = Math.round(CEIL * PX);
  const c = canvas(w, h);
  const x = c.getContext('2d');
  const rng = makeRng('lotwall' + seed);
  x.fillStyle = '#8b8a84';
  x.fillRect(0, 0, w, h);
  // blocks 40×20 cm
  const bw = 0.4 * PX, bh = 0.2 * PX;
  for (let row = 0; row * bh < h; row++) {
    for (let col = -1; col * bw < w; col++) {
      const bx = col * bw + (row % 2 ? bw / 2 : 0);
      const t = 128 + Math.floor((rng() - 0.5) * 16);
      x.fillStyle = `rgb(${t},${t - 1},${t - 6})`;
      x.fillRect(bx + 1, h - (row + 1) * bh + 1, bw - 2, bh - 2);
    }
  }
  grain(x, w, h, rng, w * h * 0.2, 0.15);
  // painted lower band + stripe
  x.fillStyle = 'rgba(28,62,82,0.9)';
  x.fillRect(0, h - 1.05 * PX, w, 1.05 * PX);
  x.fillStyle = 'rgba(232,186,40,0.85)';
  x.fillRect(0, h - 1.18 * PX, w, 0.08 * PX);
  // water stains streaking down from the top
  for (let k = 0; k < 6; k++) {
    const sx = rng() * w, len = (0.6 + rng() * 1.6) * PX;
    const g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(30,26,18,0.4)');
    g.addColorStop(1, 'rgba(30,26,18,0)');
    x.fillStyle = g;
    x.fillRect(sx, 0, 6 + rng() * 20, len);
  }
  // big stenciled level marker
  x.save();
  x.font = '900 120px Arial Black, Arial, sans-serif';
  x.fillStyle = 'rgba(240,238,228,0.75)';
  x.textAlign = 'center';
  x.fillText(label, w * 0.5, h - 1.35 * PX);
  x.restore();
  // a tag or two
  const tags = ['NITRO', 'KZ', 'R.I.P. JOJO', '88.1', 'SLAB', 'DUB', 'MIDNITE'];
  for (let k = 0; k < 2; k++) {
    x.save();
    x.translate(rng() * w, h - (0.4 + rng() * 0.5) * PX);
    x.rotate((rng() - 0.5) * 0.25);
    x.font = `italic 900 ${30 + rng() * 26}px Arial Black, Arial, sans-serif`;
    const col = ['#ff3d6e', '#46e8ff', '#e8f048', '#ffffff', '#9a5bff'][Math.floor(rng() * 5)];
    x.strokeStyle = 'rgba(0,0,0,0.6)';
    x.lineWidth = 5;
    const tg = tags[Math.floor(rng() * tags.length)];
    x.strokeText(tg, 0, 0);
    x.fillStyle = col;
    x.globalAlpha = 0.8;
    x.fillText(tg, 0, 0);
    x.restore();
  }
  return c;
}

/** Long strip of stenciled bay numbers for the floor at the aisle edge. */
function bayNumbers(cars) {
  const PX = 64;
  const w = Math.min(8192, Math.round(BAY * cars.length * PX)), h = 64;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  x.font = '900 46px Arial Black, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const per = {};
  cars.forEach((car, k) => {
    per[car.cls] = (per[car.cls] || 0) + 1;
    x.fillStyle = 'rgba(236,234,224,0.8)';
    x.fillText(`${car.cls}-${String(per[car.cls]).padStart(2, '0')}`, (k + 0.5) * BAY * PX * (w / (BAY * cars.length * PX)), h / 2 + 2);
  });
  return c;
}

/** Light-box sign hanging from the ceiling ("CLASS B · 20-35K"). */
function signTexture(title, sub, color) {
  const c = canvas(512, 160);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, '#fbfbf6');
  g.addColorStop(1, '#d9d9d2');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 160);
  x.fillStyle = color;
  x.fillRect(0, 0, 120, 160);
  x.fillStyle = '#fff';
  x.font = '900 110px Arial Black, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(title, 60, 86);
  x.fillStyle = '#121418';
  x.textAlign = 'left';
  x.font = '900 52px Arial Black, Arial, sans-serif';
  x.fillText('CLASS ' + title, 146, 64);
  x.font = 'bold 30px Arial, sans-serif';
  x.fillStyle = '#3a3e46';
  x.fillText(sub, 148, 116);
  x.strokeStyle = 'rgba(0,0,0,0.5)';
  x.lineWidth = 8;
  x.strokeRect(0, 0, 512, 160);
  return c;
}

const CLASS_COLORS = { D: '#2f8f4e', C: '#2f6bb3', B: '#c27a12', A: '#b3261e', S: '#6a2cb3' };
const CLASS_SUB = { D: 'ENTRY · TUNERS', C: 'STREET', B: 'SPORT', A: 'GT', S: 'EXOTIC' };

export function buildLotScene(gl, cars) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.FogExp2(0x0a0b0e, 0.042);
  scene.environment = getEnvMap(gl, 'garage');
  const n = cars.length;
  const x0 = -BAY * 3, x1 = BAY * (n + 3);
  const span = x1 - x0;

  // ---------------------------------------------------------------- floor
  const fm = floorModule('a');
  const fmap = toTex(fm.c);
  const frough = toTex(fm.r, { srgb: false });
  const reps = span / (BAY * 2);
  for (const t of [fmap, frough]) t.repeat.set(reps, 1);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(span, AISLE_FAR - WALL_Z),
    new THREE.MeshStandardMaterial({ map: fmap, roughnessMap: frough, roughness: 1, metalness: 0, envMapIntensity: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  // texture u runs +x; v runs from the far side (top) to the wall — flip so
  // canvas y=0 (wall) lands at z = WALL_Z
  floor.position.set(x0 + span / 2, 0, (WALL_Z + AISLE_FAR) / 2);
  fmap.offset.x = -x0 / (BAY * 2);
  frough.offset.x = fmap.offset.x;
  floor.receiveShadow = true;
  fmap.flipY = true;
  frough.flipY = true;
  scene.add(floor);
  // the plane's +v is toward -z after the rotation; canvas row 0 is the top
  // of the texture (v=1) → z = WALL_Z. That's what we want.

  // bay numbers along the aisle edge
  const numC = bayNumbers(cars);
  const numT = toTex(numC, { repeat: false });
  const nums = new THREE.Mesh(
    new THREE.PlaneGeometry(BAY * n, 0.5),
    new THREE.MeshStandardMaterial({ map: numT, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  nums.rotation.x = -Math.PI / 2;
  nums.position.set(BAY * (n / 2) - BAY / 2, 0.006, 2.25);
  scene.add(nums);

  // ---------------------------------------------------------------- walls
  const wallC = wallModule('a', 'P2');
  const wallT = toTex(wallC);
  wallT.repeat.set(span / (BAY * 2), 1);
  wallT.offset.x = -x0 / (BAY * 2);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.92, metalness: 0 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(span, CEIL), wallMat);
  back.position.set(x0 + span / 2, CEIL / 2, WALL_Z);
  scene.add(back);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(span, CEIL), wallMat);
  far.rotation.y = Math.PI;
  far.position.set(x0 + span / 2, CEIL / 2, AISLE_FAR);
  scene.add(far);

  // ---------------------------------------------------------------- ceiling + beams
  const ceilT = concreteTexture('#5e5d59', 'lotceil');
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(span, AISLE_FAR - WALL_Z), new THREE.MeshStandardMaterial({ map: ceilT, roughness: 0.95, color: 0x8a8a86 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(x0 + span / 2, CEIL, (WALL_Z + AISLE_FAR) / 2);
  scene.add(ceil);
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture('#86857f', 'lotbeam'), roughness: 0.9 });
  const beamCount = Math.ceil(span / (BAY * 2)) + 1;
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.55, AISLE_FAR - WALL_Z), concrete, beamCount);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < beamCount; i++) {
    m4.makeTranslation(x0 + i * BAY * 2 - BAY / 2, CEIL - 0.275, (WALL_Z + AISLE_FAR) / 2);
    beams.setMatrixAt(i, m4);
  }
  scene.add(beams);

  // pillars (hazard-striped feet) at every other bay line, both sides of the aisle
  const pc = canvas(64, 256);
  {
    const x = pc.getContext('2d');
    x.fillStyle = '#9a9890';
    x.fillRect(0, 0, 64, 256);
    grain(x, 64, 256, makeRng('pillar'), 4000, 0.18);
    // hazard band at the bottom ~0.9 m
    for (let k = -4; k < 12; k++) {
      x.fillStyle = k % 2 ? '#e8b51e' : '#141414';
      x.beginPath();
      x.moveTo(k * 16, 256); x.lineTo(k * 16 + 16, 256); x.lineTo(k * 16 + 48, 256 - 74); x.lineTo(k * 16 + 32, 256 - 74);
      x.closePath(); x.fill();
    }
    x.fillStyle = 'rgba(30,62,82,0.9)';
    x.fillRect(0, 140, 64, 14);
  }
  const pillarMat = new THREE.MeshStandardMaterial({ map: toTex(pc, { repeat: false }), roughness: 0.85 });
  const pillarCount = beamCount * 2;
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, CEIL, 0.5), pillarMat, pillarCount);
  for (let i = 0; i < beamCount; i++) {
    m4.makeTranslation(x0 + i * BAY * 2 - BAY / 2, CEIL / 2, WALL_Z + 0.6);
    pillars.setMatrixAt(i * 2, m4);
    m4.makeTranslation(x0 + i * BAY * 2 - BAY / 2, CEIL / 2, AISLE_FAR - 2.2);
    pillars.setMatrixAt(i * 2 + 1, m4);
  }
  pillars.castShadow = true;
  scene.add(pillars);

  // pipes along the back wall
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6c2a22, roughness: 0.6, metalness: 0.4 });
  const pipeMat2 = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.5, metalness: 0.6 });
  for (const [y, z, r, mat] of [[CEIL - 0.42, WALL_Z + 0.16, 0.08, pipeMat], [CEIL - 0.24, WALL_Z + 0.36, 0.05, pipeMat2], [CEIL - 0.62, WALL_Z + 0.12, 0.035, pipeMat2]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, span, 10, 1), mat);
    p.rotation.z = Math.PI / 2;
    p.position.set(x0 + span / 2, y, z);
    scene.add(p);
  }

  // wheel stops in each bay
  const stopMat = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.9 });
  const stops = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.12, 0.22), stopMat, n);
  for (let k = 0; k < n; k++) {
    m4.makeTranslation(k * BAY, 0.06, WALL_Z + 0.75);
    stops.setMatrixAt(k, m4);
  }
  scene.add(stops);

  // ---------------------------------------------------------------- fluorescent fixtures
  const fixCount = Math.ceil(span / BAY) * 2;
  const housing = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.5 }), fixCount);
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeef6ff).multiplyScalar(3.2) });
  const tubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.035, 0.2), tubeMat, fixCount);
  const fixtures = [];
  let fi = 0;
  for (let k = -3; k < n + 3; k++) {
    for (const z of [0.1, 6.6]) {
      if (fi >= fixCount) break;
      const fx = k * BAY;
      m4.makeTranslation(fx, CEIL - 0.6, z);
      housing.setMatrixAt(fi, m4);
      m4.makeTranslation(fx, CEIL - 0.65, z);
      tubes.setMatrixAt(fi, m4);
      fixtures.push({ k, z });
      fi++;
    }
  }
  housing.count = fi;
  tubes.count = fi;
  scene.add(housing, tubes);
  // a dead tube and a flickering one (handled per frame by the screen)
  const flicker = { index: fixtures.findIndex((f) => f.k === 5 && f.z < 1), on: true, t: 0 };
  const deadIdx = fixtures.findIndex((f) => f.k === 9 && f.z > 1);
  if (deadIdx >= 0) { m4.makeScale(0, 0, 0); tubes.setMatrixAt(deadIdx, m4); }
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const flickerMatrix = new THREE.Matrix4();
  if (flicker.index >= 0) tubes.getMatrixAt(flicker.index, flickerMatrix);

  // class signs hanging over the first bay of each class
  const signs = [];
  const seen = new Set();
  cars.forEach((car, k) => {
    if (seen.has(car.cls)) return;
    seen.add(car.cls);
    const t = toTex(signTexture(car.cls, CLASS_SUB[car.cls] || '', CLASS_COLORS[car.cls] || '#444'), { repeat: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.12), [
      new THREE.MeshStandardMaterial({ color: 0x222 }), new THREE.MeshStandardMaterial({ color: 0x222 }),
      new THREE.MeshStandardMaterial({ color: 0x222 }), new THREE.MeshStandardMaterial({ color: 0x222 }),
      new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.6, 1.6, 1.6) }),
      new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.6, 1.6, 1.6) }),
    ]);
    box.position.set(k * BAY - BAY * 0.32, CEIL - 0.95, 2.3);
    scene.add(box);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.7), pipeMat2);
    rod.position.set(box.position.x, CEIL - 0.35, 2.3);
    scene.add(rod);
    signs.push(box);
  });

  // exit sign + extinguisher cabinets
  const exitC = canvas(256, 96);
  {
    const x = exitC.getContext('2d');
    x.fillStyle = '#0c5a2a';
    x.fillRect(0, 0, 256, 96);
    x.fillStyle = '#d8ffe6';
    x.font = '900 64px Arial Black, Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('EXIT', 128, 52);
  }
  const exit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.08), new THREE.MeshBasicMaterial({ map: toTex(exitC, { repeat: false }), color: new THREE.Color(2, 2, 2) }));
  exit.position.set(-BAY * 1.6, CEIL - 0.85, WALL_Z + 0.05);
  scene.add(exit);
  const exitGlow = new THREE.PointLight(0x2aff7a, 0.8, 5, 2);
  exitGlow.position.set(-BAY * 1.6, CEIL - 1.0, WALL_Z + 0.5);
  scene.add(exitGlow);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0xa3140f, roughness: 0.45, metalness: 0.2 });
  for (let i = 0; i < beamCount; i += 3) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), cabMat);
    cab.position.set(x0 + i * BAY * 2 - BAY / 2, 1.3, WALL_Z + 0.95);
    scene.add(cab);
  }

  // a couple of cones + an oil drum to dress the far end
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5a14, roughness: 0.6 });
  const rng = makeRng('lotprops');
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 12), coneMat);
    c.position.set(-BAY * 2 + rng() * 3, 0.25, 3 + rng() * 6);
    c.rotation.z = i === 3 ? Math.PI / 2 : 0;
    if (i === 3) c.position.y = 0.16;
    c.castShadow = true;
    scene.add(c);
  }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 20), new THREE.MeshStandardMaterial({ color: 0x1f3c6e, roughness: 0.55, metalness: 0.5 }));
  drum.position.set(BAY * n + 0.8, 0.44, WALL_Z + 1.0);
  scene.add(drum);

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0x8aa0c0, 0x1a1712, 0.32));
  // the "key": a cool overhead spot that follows the selected bay (shadowed)
  const key = new THREE.SpotLight(0xf2f6ff, 26, 16, 0.95, 0.65, 1.6);
  key.position.set(0, CEIL - 0.7, 1.4);
  key.target.position.set(0, 0, -0.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 8;
  scene.add(key, key.target);
  // fill from the aisle side (the next fixture row)
  const fill = new THREE.PointLight(0xdfe8ff, 5, 14, 1.6);
  fill.position.set(0, CEIL - 0.7, 6.6);
  scene.add(fill);
  // warm sodium spill from the ramp at the far end
  const ramp = new THREE.PointLight(0xff9a3a, 16, 30, 1.4);
  ramp.position.set(-BAY * 3.2, 1.8, 6);
  scene.add(ramp);
  // neighbour bays get a softer unshadowed light each
  const side = [new THREE.PointLight(0xeef4ff, 3.5, 9, 1.8), new THREE.PointLight(0xeef4ff, 3.5, 9, 1.8)];
  side.forEach((l) => scene.add(l));

  const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 120);

  return {
    scene, camera, key, fill, side, signs,
    /** Move the lighting rig to bay k (fractional while sliding). */
    focus(kx) {
      const x = kx * BAY;
      key.position.x = x;
      key.target.position.x = x;
      fill.position.x = x;
      side[0].position.set(x - BAY, CEIL - 0.7, 0.2);
      side[1].position.set(x + BAY, CEIL - 0.7, 0.2);
    },
    /** Fluorescent flicker for atmosphere. */
    update(dt, t) {
      if (flicker.index < 0) return;
      flicker.t -= dt;
      if (flicker.t <= 0) {
        flicker.on = !flicker.on;
        flicker.t = flicker.on ? 0.4 + rng() * 3.5 : 0.03 + rng() * 0.12;
        tubes.setMatrixAt(flicker.index, flicker.on ? flickerMatrix : hidden);
        tubes.instanceMatrix.needsUpdate = true;
      }
      void t;
    },
    flickerBay: fixtures[flicker.index]?.k ?? -99,
    flickerOn: () => flicker.on,
    dispose() {
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { m.map?.dispose?.(); m.roughnessMap?.dispose?.(); m.dispose?.(); }
      });
    },
  };
}
