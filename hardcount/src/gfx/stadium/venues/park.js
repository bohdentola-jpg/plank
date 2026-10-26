// PARK — a city park field for pickup games and practice: worn grass and
// faded lines, a tall chain-link cage, sodium lamps on wooden poles throwing
// orange light, two little aluminium bleachers, a handball wall covered in
// graffiti, a basketball court, the street with parked cars, and brick
// apartment blocks with fire escapes all around.
import * as THREE from 'three';
import { V3, box, beam, pole, spill, bleachers, chainFence, lightPole, trees, building } from '../kit.js';
import { cv, graffitiTex, noiseCanvas, grainCanvas, blotch } from '../tex.js';
import { createScoreboard } from '../scoreboard.js';
import { makeRng } from '../../../core/util.js';

export const SUN_AZ = 1.9;
export const WIND_DIR = 0.3;
export const POOL = [62, 80];
export const FLAG_COLOR = '#ff8a1a';
export const KEY_NIGHT = { color: '#ffc58a', i: 2.3 };

export function paint(ctx) {
  return {
    surface: 'grass', pattern: 'none', grass: ['#4a6e30', '#557a38'], wear: 0.95, border: 'park', lineAlpha: 0.7,
    endzone: { style: 'none' }, logo: null, numbers: true, marginSide: 12, marginEnd: 8,
  };
}

export function apronCanvas() {
  // trampled grass and dirt around the field
  const [c, x] = cv(512, 512);
  x.fillStyle = '#5a6a36';
  x.fillRect(0, 0, 512, 512);
  x.save();
  x.globalCompositeOperation = 'soft-light';
  x.globalAlpha = 0.6;
  x.drawImage(noiseCanvas(256, 17, 5, 3, 1.3), 0, 0, 512, 512);
  x.restore();
  const rng = makeRng('parkapron');
  for (let i = 0; i < 40; i++) blotch(x, rng() * 512, rng() * 512, 20 + rng() * 60, `rgba(120,100,62,${0.2 + rng() * 0.3})`);
  x.fillStyle = x.createPattern(grainCanvas(256, 'grassg', 0.9, '220,255,170', '0,20,0', 0.2), 'repeat');
  x.fillRect(0, 0, 512, 512);
  return c;
}

export async function build(ctx) {
  const { B, rig, field, home, root } = ctx;
  const rng = makeRng('park');
  const hw = field.halfW, E = field.end;
  const disposables = [];
  const seats = [];
  const fx = hw + 9, fz = E + 9;

  // ---- the cage: tall chain-link round the field, a gate on the home side
  chainFence(B, [[-fx, -fz], [fx, -fz], [fx, fz], [-fx, fz], [-fx, 2.5]], 3.6, { postColor: [0.5, 0.52, 0.54] });
  chainFence(B, [[-fx, -2.5], [-fx, -fz]], 3.6, { postColor: [0.5, 0.52, 0.54] });
  // asphalt path round the outside, sidewalk + street
  const asphalt = B.get('ground');
  asphalt.setColor(0.2, 0.2, 0.21);
  const ring = (x0, z0, x1, z1, w, y) => {
    asphalt.quad(V3(x0 - w, y, z1 + w), V3(x1 + w, y, z1 + w), V3(x1 + w, y, z1), V3(x0 - w, y, z1));
    asphalt.quad(V3(x0 - w, y, z0), V3(x1 + w, y, z0), V3(x1 + w, y, z0 - w), V3(x0 - w, y, z0 - w));
    asphalt.quad(V3(x0 - w, y, z1), V3(x0, y, z1), V3(x0, y, z0), V3(x0 - w, y, z0));
    asphalt.quad(V3(x1, y, z1), V3(x1 + w, y, z1), V3(x1 + w, y, z0), V3(x1, y, z0));
  };
  ring(-fx - 2, -fz - 2, fx + 2, fz + 2, 3, 0.03);
  asphalt.setColor(0.13, 0.13, 0.14);
  ring(-fx - 30, -fz - 30, fx + 30, fz + 30, 14, 0.035);
  const walk = B.get('concrete');
  walk.setColor(0.55, 0.55, 0.53);
  ring(-fx - 22, -fz - 22, fx + 22, fz + 22, 6, 0.06);
  // ---- sodium lamps on wooden poles (two heads each)
  for (const sx of [-1, 1]) {
    for (const z of [-E * 0.7, 0, E * 0.7]) {
      const x = sx * (fx + 1.5);
      const spec = lightPole(B, x, z, 18, [x * 0.1, 0, z * 0.6], { kind: 'wood', cols: 2, rows: 1, lamp: 1.1, tilt: 0.75, catwalk: false });
      rig.bank({ ...spec, warm: true, glare: 1.3 });
    }
  }
  // ---- two small bleachers on the home side, one by the far end
  for (const z of [-14, 14]) {
    const b = bleachers(B, -(fx - 2.5), z, Math.PI / 2, 12, 5, { base: 0.5, rng, skirt: true });
    for (const s of b.seats) seats.push({ ...s, group: 'home', want: 0.6 - s.row * 0.05, light: 0.85, sec: 0 });
  }
  const b2 = bleachers(B, fx - 2.5, 0, -Math.PI / 2, 10, 4, { base: 0.5, rng });
  for (const s of b2.seats) seats.push({ ...s, group: 'away', want: 0.4, light: 0.85, sec: 0 });
  // folks leaning on the fence
  for (let i = 0; i < 26; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const z = (rng() - 0.5) * 2 * (E - 6);
    if (side < 0 && Math.abs(Math.abs(z) - 14) < 8) continue;
    seats.push({ p: V3(side * (fx + 0.6), 0, z), group: side < 0 ? 'home' : 'away', want: 0.5, light: 0.8, sec: 0 });
  }

  // ---- handball wall with graffiti behind the north end, a basketball court beside it
  const gt = graffitiTex('park', '#8a8478');
  const gt2 = graffitiTex('park2', '#7a7a74');
  disposables.push(gt, gt2);
  const gMat = spill(new THREE.MeshStandardMaterial({ map: gt, roughness: 0.9 }), ctx, 0.5);
  const wallZ = fz + 12;
  const wg = new THREE.BoxGeometry(34, 6, 1.2);
  const wallM = new THREE.Mesh(wg, [gMat, gMat, gMat, gMat, gMat, gMat]);
  wallM.position.set(-12, 3, wallZ);
  root.add(wallM);
  const gMat2 = spill(new THREE.MeshStandardMaterial({ map: gt2, roughness: 0.9 }), ctx, 0.5);
  const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(30, 4.5), gMat2);
  wall2.position.set(fx + 26, 2.25, -10);
  wall2.rotation.y = -Math.PI / 2;
  root.add(wall2);
  // basketball court
  const court = B.get('ground');
  court.setColor(0.24, 0.3, 0.36);
  const cx0 = 24, cz0 = fz + 8;
  court.quad(V3(cx0 - 15, 0.05, cz0 + 26), V3(cx0 + 15, 0.05, cz0 + 26), V3(cx0 + 15, 0.05, cz0), V3(cx0 - 15, 0.05, cz0));
  const lines = B.get('paint');
  lines.setColor(0.85, 0.85, 0.8);
  for (const [x0, z0, x1, z1] of [[cx0 - 14, cz0 + 1, cx0 + 14, cz0 + 1.12], [cx0 - 14, cz0 + 24.9, cx0 + 14, cz0 + 25], [cx0 - 0.06, cz0 + 1, cx0 + 0.06, cz0 + 25]]) {
    lines.quad(V3(x0, 0.07, z1), V3(x1, 0.07, z1), V3(x1, 0.07, z0), V3(x0, 0.07, z0));
  }
  const hoop = B.get('metal');
  hoop.setColor(0.3, 0.32, 0.34);
  for (const z of [cz0 + 2, cz0 + 24]) {
    pole(hoop, V3(cx0, 0, z + (z < cz0 + 10 ? -1 : 1)), V3(cx0, 3.6, z + (z < cz0 + 10 ? -1 : 1)), 0.08, 6);
    lines.setColor(0.9, 0.9, 0.88);
    box(lines, cx0, 3.0, z, 2, 1.2, 0.08, 0, {});
  }

  // ---- apartment blocks, corner shop, street lamps, parked cars
  const blocks = [];
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    blocks.push({ x: side * (fx + 52 + rng() * 10), z: -95 + (i >> 1) * 42, w: 24, d: 30, h: 18 + rng() * 22, ry: 0, style: rng() < 0.7 ? 'brick' : 'tan' });
  }
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    blocks.push({ x: -60 + (i >> 1) * 60, z: side * (fz + 56 + rng() * 10), w: 40, d: 22, h: 20 + rng() * 24, ry: 0, style: rng() < 0.6 ? 'brick' : 'dark' });
  }
  for (const b of blocks) {
    building(B, ctx, b.x, b.z, b.w, b.d, b.h, b.ry, b.style, b.style === 'brick' ? 'apt' : 'apt2', { uw: 12, uh: 12, glow: 1.9, fireEscape: true });
    // rooftop water tank
    if (rng() < 0.5) {
      const tk = B.get('wood');
      tk.setColor(0.42, 0.3, 0.2);
      const tg = new THREE.CylinderGeometry(2, 2, 3.2, 10);
      tg.translate(b.x + (rng() - 0.5) * 8, b.h + 3.6, b.z + (rng() - 0.5) * 8);
      tk.geometry(tg, new THREE.Matrix4());
      tg.dispose();
    }
  }
  const lamp = B.get('metal');
  lamp.setColor(0.28, 0.3, 0.32);
  for (let k = -4; k <= 4; k++) {
    for (const side of [-1, 1]) {
      const x = side * (fx + 33), z = k * 26;
      pole(lamp, V3(x, 0, z), V3(x, 8, z), 0.1, 6);
      beam(lamp, V3(x, 8, z), V3(x - side * 2, 8.2, z), 0.08);
      ctx.lightsList.push({ pos: V3(x - side * 2, 8, z), color: [1, 0.55, 0.18], size: 3.4, k: 1.2 });
    }
  }
  const car = B.get('metal');
  const carCols = [[0.5, 0.06, 0.06], [0.1, 0.12, 0.2], [0.75, 0.75, 0.72], [0.12, 0.12, 0.13], [0.3, 0.36, 0.4], [0.75, 0.6, 0.1]];
  for (let k = 0; k < 18; k++) {
    if (rng() < 0.3) continue;
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (fx + 38), z = -90 + k * 10.5;
    car.setColor(...carCols[(rng() * carCols.length) | 0]);
    box(car, x, 0.25, z, 1.9, 0.8, 4.4, 0, {});
    box(car, x, 1.05, z - 0.2, 1.7, 0.6, 2.3, 0, {});
  }
  const tl = [];
  for (let i = 0; i < 40; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    tl.push({ x: side * (fx + 12 + rng() * 12), z: (rng() - 0.5) * 2 * (fz + 20), h: 7 + rng() * 5, kind: 'oak', tint: rng() < 0.5 ? '#2e4426' : '#3a5030' });
  }
  root.add(trees(tl, ctx));

  // ---- a little scoreboard bolted to the fence at the north end
  const board = createScoreboard('hs', { home, away: ctx.away, title: ctx.def.name.toUpperCase(), sub: 'CITY PARKS · NO DOGS ON THE FIELD', intensity: ctx.day ? 1.2 : 1.6 });
  const bw = 8, bh = 4;
  const bm = B.get('metal');
  bm.setColor(0.3, 0.32, 0.33);
  for (const sx of [-3, 3]) pole(bm, V3(sx, 0, fz + 0.6), V3(sx, 7.5, fz + 0.6), 0.12, 6);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), board.material);
  face.position.set(0, 5, fz + 0.3);
  face.rotation.y = Math.PI;
  root.add(face);

  return {
    seats,
    boards: [board],
    disposables,
    sideline: { benchOff: 4.5, cheer: false, photographers: 0, coaches: 1, players: 8, chainSide: 1, vest: '#ff7a12' },
    cams: {
      scoreboard: { pos: V3(0, 3, fz - 12), target: V3(0, 5, fz) },
      crowd: { pos: V3(-fx + 10, 2.5, -2), target: V3(-fx - 2, 2, -14) },
    },
    post: ctx.night ? { saturation: 1.02, gain: [1.04, 0.99, 0.94] } : {},
  };
}
