// SNOWBOWL — an old cold-weather horseshoe: one tall, steep deck of weathered
// concrete with bench seating, open at the north end where the old bulb
// scoreboard stands, snow piled along the field wall and on every step
// nobody's standing on, an old press box, lattice light towers on the rim,
// heaters on the sidelines, frosted pines and the mountains beyond.
import * as THREE from 'three';
import { RRPath, ringWall, ringFlat, buildTier } from '../bowl.js';
import { V3, box, beam, pole, spill, trees, lightPole, exteriorMat } from '../kit.js';
import { cv, tex, BRANDS } from '../tex.js';
import { createScoreboard } from '../scoreboard.js';
import { logoCanvas } from '../../logos.js';
import { makeRng, makeNoise2D } from '../../../core/util.js';
import { GeoBuilder } from '../../geo.js';
import { wantFn, angleAt, adWallMat } from './common.js';

export const SUN_AZ = 2.5;
export const WIND_DIR = 2.2;
export const COLD = true;
export const FLAG_COLOR = '#13294b';
export const FOG = 0.35;

export function paint(ctx) {
  const h = ctx.home;
  return {
    surface: 'grass', pattern: 'stripes', grass: ['#45703a', '#527c44'], wear: 0.4, border: 'pro', frozen: true,
    endzone: { style: 'solid', fill: h.colors.secondary, text: [h.name.toUpperCase(), h.city.toUpperCase()], color: h.colors.primary, outline: '#ffffff' },
    logo: logoCanvas(h, 1024, { flat: true }), logoSize: Math.min(ctx.field.W * 0.28, 12),
    marginSide: 12, marginEnd: 8,
  };
}

/** A far mountain range (jagged ridge strip, snow above the tree line). */
function mountains(ctx, z0, span, hMax, seed, dark) {
  const n = makeNoise2D(seed);
  const g = new GeoBuilder();
  const step = 30;
  const col = (y, top) => {
    const k = y / hMax;
    if (k > 0.55 || (top && k > 0.42)) return [0.92, 0.94, 0.98];
    return dark;
  };
  for (let x = -span; x < span; x += step) {
    const h0 = hMax * (0.35 + 0.65 * Math.max(0, n.ridged(x * 0.0025, 1.3, 4))) * (0.75 + 0.25 * Math.cos(x / span * 1.4));
    const h1 = hMax * (0.35 + 0.65 * Math.max(0, n.ridged((x + step) * 0.0025, 1.3, 4))) * (0.75 + 0.25 * Math.cos((x + step) / span * 1.4));
    const zA = z0 + Math.sin(x * 0.003) * 60, zB = z0 + Math.sin((x + step) * 0.003) * 60;
    // lower slope, then the snowy ridge band
    const mid = 0.5;
    g.setColor(...dark);
    g.quad(V3(x + step, -20, zB), V3(x, -20, zA), V3(x, h0 * mid, zA), V3(x + step, h1 * mid, zB));
    g.setColor(...col(h0, true));
    const a = V3(x, h0 * mid, zA), b = V3(x + step, h1 * mid, zB), c = V3(x + step, h1, zB + 20), d = V3(x, h0, zA + 20);
    g.quad(b, a, d, c);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g.build(true), spill(mat, ctx, 0));
  m.name = 'mountains';
  return m;
}

export async function build(ctx) {
  const { B, field, home, root } = ctx;
  const rng = makeRng('snowbowl');
  const hw = field.halfW, E = field.end;
  const disposables = [];
  const snowy = ctx.weather === 'snow';
  const path = new RRPath(hw + 11, E + 9, 30);
  const P = path.P;
  B.get('adwall', () => adWallMat(ctx, 'adwall8b', BRANDS.slice(2, 10)));
  B.get('exterior', (c) => exteriorMat(c, 'snowbowl', '#9a9a94', home.colors.secondary));
  const c1 = path.segs[1], c2 = path.segs[3];
  const s0 = c2.s0 + c2.len * 0.4, s1 = c1.s0 + c1.len * 0.6 + P;
  const rows = 44;
  const tint = snowy ? [0.93, 0.95, 0.98] : [0.66, 0.65, 0.62];
  const bowl = buildTier(B, path, {
    s0, s1, d0: 0, rows, depth: 0.9, h0: 2.2, rise: 0.48, riseGrow: 0.002,
    tint, seats: 'bench', benchTint: snowy ? [0.95, 0.96, 0.98] : [0.62, 0.5, 0.36],
    aisleEvery: 26, aisleW: 1.2, vom: { every: 24, offset: 10, row: 12, rows: 4, w: 2.8 },
    group: (s, r) => { const a = angleAt(path, s); return a > 255 && a < 285 && r > 3 && r < 26 ? 'student' : a > 300 && a < 330 && r > 20 ? 'away' : 'home'; },
    want: wantFn(path, field, rows), light: () => 1,
    front: { y0: 0, rail: 0.35, key: 'adwall', vFit: true, uScale: 68 },
    back: { h: 3 }, exterior: true, exteriorKey: 'exterior', exteriorTint: [1, 1, 1], exteriorU: 16, exteriorV: 16,
  });
  // old press box on the home (−x) side
  const pb = B.get('paint');
  pb.setColor(0.78, 0.76, 0.7);
  const pbx = -(path.ax + bowl.dEnd) + 2;
  box(pb, pbx, bowl.backTop, 0, 7, 7, E * 0.9, 0, {});
  pb.setColor(...new THREE.Color(home.colors.primary).toArray());
  box(pb, pbx, bowl.backTop + 7, 0, 8, 0.6, E * 0.9 + 1, 0, {});
  const glow = B.get('glow');
  glow.setColor(...(ctx.day ? [0.35, 0.4, 0.45] : [1.7, 1.35, 0.85]));
  glow.quad(V3(pbx + 3.52, bowl.backTop + 2.5, E * 0.43), V3(pbx + 3.52, bowl.backTop + 2.5, -E * 0.43), V3(pbx + 3.52, bowl.backTop + 5.5, -E * 0.43), V3(pbx + 3.52, bowl.backTop + 5.5, E * 0.43));
  // light towers on the rim: three a side, old lattice frames
  for (const seg of [path.segs[0], path.segs[4]]) {
    for (const k of [0.1, 0.5, 0.9]) {
      const p = path.at(seg.s0 + seg.len * k, bowl.dEnd + 2.5);
      const spec = lightPole(B, p.x, p.z, bowl.backTop + 12, [p.x * 0.2, 0, p.z * 0.3], { kind: 'lattice', cols: 6, rows: 4, lamp: 0.9, tilt: 0.6 });
      ctx.rig.bank({ ...spec, warm: true, glare: 1.1 });
    }
  }
  // the north end: the old bulb scoreboard on steel legs
  const board = createScoreboard('hs', { home, away: ctx.away, title: ctx.def.name.toUpperCase(), sub: `${home.city.toUpperCase()} ${home.name.toUpperCase()}`, intensity: ctx.day ? 1.35 : 1.7 });
  const bw = 26, bh = 13, bz = path.az + 26, by = 8;
  const m = B.get('metal');
  m.setColor(0.3, 0.32, 0.34);
  for (const sx of [-8, 8]) { beam(m, V3(sx, 0, bz + 1), V3(sx, by + bh * 0.7, bz + 1), 0.8); beam(m, V3(sx, 0, bz + 4), V3(sx, by, bz + 1), 0.4); }
  pb.setColor(0.12, 0.14, 0.13);
  box(pb, 0, by - 0.4, bz + 0.6, bw + 1.2, bh + 0.8, 0.8, 0, {});
  const face = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), board.material);
  face.position.set(0, by + bh / 2, bz + 0.15);
  face.rotation.y = Math.PI;
  root.add(face);
  if (snowy || ctx.cold) {
    // snow on top of the board
    const sn = B.get('paint');
    sn.setColor(0.94, 0.96, 1.0);
    box(sn, 0, by + bh + 0.4, bz + 0.6, bw + 1.2, 0.35, 1.0, 0, {});
  }
  // snow piles along the field wall and in the open end (cleared off the field)
  const pile = new GeoBuilder();
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const mtx = new THREE.Matrix4();
  pile.setColor(0.93, 0.95, 1.0);
  const addPile = (x, z, s) => {
    for (let k = 0; k < 4; k++) {
      const sx = s * (0.8 + rng() * 0.6), sy = s * (0.35 + rng() * 0.25), sz = s * (0.8 + rng() * 0.6);
      mtx.compose(V3(x + (rng() - 0.5) * s, sy * 0.2, z + (rng() - 0.5) * s * 1.5), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), rng() * 6), V3(sx, sy, sz));
      pile.geometry(ico, mtx);
    }
  };
  for (const sx of [-1, 1]) for (let z = -E + 2; z <= E - 2; z += 7) if (Math.abs(z) > 16 || sx > 0) addPile(sx * (path.ax - 1.6), z + (rng() - 0.5) * 2, 1.4 + rng() * 0.8);
  for (let x = -hw; x <= hw; x += 6) addPile(x, path.az + 6 + rng() * 6, 2.2 + rng() * 1.4);
  for (const sz of [-1]) for (let x = -hw + 4; x <= hw - 4; x += 8) addPile(x, sz * (path.az - 1.5), 1.2 + rng() * 0.6);
  ico.dispose();
  const piles = new THREE.Mesh(pile.build(true), spill(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, envMapIntensity: 0.6 }), ctx, 0.5));
  piles.receiveShadow = true;
  piles.name = 'snowpiles';
  root.add(piles);
  // frosted pines around, and the mountains beyond the open end
  const tl = [];
  for (let i = 0; i < 140; i++) {
    const a = rng() * Math.PI * 2, r = 1.05 + rng() * 0.7;
    tl.push({ x: Math.cos(a) * (path.ax + 70) * r, z: Math.sin(a) * (path.az + 60) * r, h: 12 + rng() * 12, kind: 'pine', w: 0.4, tint: rng() < 0.5 ? '#9ab0b8' : '#7a9098' });
  }
  root.add(trees(tl, ctx, { snow: true }));
  root.add(mountains(ctx, 650, 2000, 300, 7, [0.16, 0.19, 0.24]));
  root.add(mountains(ctx, 1150, 2600, 470, 11, [0.24, 0.28, 0.36]));
  // the snow-covered ground outside the bowl
  const ground = B.get('ground');
  ground.setColor(...(snowy || ctx.cold ? [0.82, 0.85, 0.9] : [0.4, 0.42, 0.36]));
  void ground;

  return {
    seats: bowl.seats,
    pool: [path.ax + bowl.dEnd + 3, path.az + bowl.dEnd + 3],
    boards: [board],
    disposables,
    sideline: { benchOff: 8, cheer: true, photographers: 8, coaches: 4, players: 16, chainSide: 1, vest: '#ff7a12', heaters: true },
    cams: {
      scoreboard: { pos: V3(0, 6, E - 6), target: V3(0, by + bh * 0.5, bz) },
      crowd: { pos: V3(hw + 4, 3.5, -12), target: V3(hw + 26, 16, 2) },
    },
    post: { saturation: 0.95, gain: [0.98, 1.0, 1.04], lift: [0.0, 0.004, 0.012] },
  };
}

/** Snowy apron outside the field when it's cold. */
export function apronCanvas(ctx) {
  if (ctx.weather !== 'snow') return null;
  const [c, x] = cv(512, 512);
  x.fillStyle = '#dfe6ee';
  x.fillRect(0, 0, 512, 512);
  const rng = makeRng('snowapron');
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '150,165,185'},${rng() * 0.25})`;
    x.fillRect(rng() * 512, rng() * 512, 2, 2);
  }
  return c;
}
