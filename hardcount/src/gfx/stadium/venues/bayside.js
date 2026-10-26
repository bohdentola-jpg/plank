// BAYSIDE — Port Halcyon's waterfront pro stadium. An open bowl: two decks
// down the sides and round the south (−z) end under white sail canopies with
// light banks on their edges; the north (+z) end stays low so the whole bay
// opens up behind the video board — rippled water throwing back the city's
// lights, the downtown skyline across the bay, and the Halcyon Bridge strung
// with lights.
import * as THREE from 'three';
import { RRPath, ringWall, ringFlat, buildTier } from '../bowl.js';
import { V3, box, beam, pole, spill, exteriorMat } from '../kit.js';
import { cv, tex, BRANDS, beamTex } from '../tex.js';
import { createScoreboard } from '../scoreboard.js';
import { spriteMesh } from '../lights.js';
import { logoCanvas } from '../../logos.js';
import { makeRng } from '../../../core/util.js';
import { GeoBuilder } from '../../geo.js';
import { wantFn, angleAt, adWallMat, ribbonMat, suiteMat, edgeBanks, videoBoard, cityBlock } from './common.js';

export const SUN_AZ = 0.15;          // the sun sets over the bay, behind the skyline
export const WIND_DIR = -1.2;
export const FLAG_COLOR = '#1fb5b0';
export const FOG = 0.45;
/** The shoreline sits this far north of the field centre (see build). */
const shoreZ = (field) => field.end + 10 + 9 * 0.95 + 3 + 26;
export const apronRect = (field) => ({ x0: -500, z0: -500, x1: 500, z1: shoreZ(field) - 0.4 });

export function paint(ctx) {
  const h = ctx.home;
  return {
    surface: 'grass', pattern: 'stripes', grass: ['#3a7a2e', '#4a8c38'], wear: 0.22, border: 'pro',
    endzone: { style: 'solid', fill: h.colors.primary, text: [h.name.toUpperCase(), h.name.toUpperCase()], color: h.colors.secondary, outline: '#ffffff' },
    logo: logoCanvas(h, 1024, { flat: true }), logoSize: Math.min(ctx.field.W * 0.3, 13),
    marginSide: 12, marginEnd: 8,
  };
}

/** Tileable ripple normal map from a sum of sines. */
function rippleNormals() {
  const N = 256;
  const [c, x] = cv(N, N);
  const img = x.createImageData(N, N);
  const rng = makeRng('ripples');
  const waves = [];
  for (let i = 0; i < 18; i++) waves.push([((rng() * 9) | 0) - 4 || 1, ((rng() * 9) | 0) - 4 || 2, rng() * 6.28, 0.3 + rng() * 0.7]);
  const h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0;
    for (const [kx, ky, ph, a] of waves) v += Math.sin(((kx * i + ky * j) / N) * Math.PI * 2 + ph) * a / Math.hypot(kx, ky);
    h[j * N + i] = v;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = h[j * N + ((i + 1) % N)] - h[j * N + ((i + N - 1) % N)];
    const dy = h[((j + 1) % N) * N + i] - h[((j + N - 1) % N) * N + i];
    const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const k = (j * N + i) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255;
    img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[k + 2] = (nz / l * 0.5 + 0.5) * 255;
    img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c, { srgb: false, aniso: 8 });
}

export async function build(ctx) {
  const { B, field, home, root } = ctx;
  const rng = makeRng('bayside');
  const hw = field.halfW, E = field.end;
  const disposables = [];
  const path = new RRPath(hw + 12, E + 10, 26);
  const P = path.P;
  B.get('adwall', () => adWallMat(ctx, 'adwall8', BRANDS.slice(0, 8)));
  B.get('suites', () => suiteMat(ctx, 'suites-bay', false));
  const rib = ribbonMat(ctx, ['PORT HALCYON TIDE', 'MIDNIGHT 88.1', 'TIDE TIDE TIDE', 'KUROSHIO', 'DEFENSE!', 'HALCYON BANK', 'MAKE SOME NOISE', 'CLEARWATER']);
  B.get('ribbon', () => rib.mat);
  B.get('exterior', (c) => exteriorMat(c, 'bay', '#c4c8cc', home.colors.secondary));
  B.get('canopy', (c) => spill(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide, envMapIntensity: c.night ? 0.25 : 0.8 }), c, 0.2, { direct: 0.1 }));
  const seatCol = (s, r) => (Math.floor(angleAt(path, s) / 14) % 2 ? home.colors.primary : '#13706c');
  const groupLo = (s, r) => { const a = angleAt(path, s); return a > 255 && a < 285 && r > 2 ? 'student' : 'home'; };
  // lower bowl: full height down the sides and round the south end, a low stand in the north
  const c1 = path.segs[1], c2 = path.segs[3];
  const nS0 = c1.s0 + c1.len * 0.4, nS1 = c2.s0 + c2.len * 0.6;
  const lowerSpec = (s0, s1, rows) => ({
    s0, s1, d0: 0, rows, depth: 0.95, h0: 1.8, rise: 0.42, riseGrow: 0.003,
    tint: [0.78, 0.78, 0.76], seats: 'seats', seatColor: seatCol,
    aisleEvery: 24, aisleW: 1.1, vom: { every: 26, offset: 10, row: 9, rows: 4, w: 2.6 },
    group: groupLo, want: wantFn(path, field, rows), light: (r) => (r > 18 ? 0.85 : 1),
    front: { y0: 0, rail: 0.3, key: 'adwall', vFit: true, uScale: 68 },
    back: { h: 2.4 }, exterior: true, exteriorKey: 'exterior', exteriorTint: [1, 1, 1], exteriorU: 16, exteriorV: 16,
  });
  const lower = buildTier(B, path, lowerSpec(nS1, nS0 + P, 24));
  const north = buildTier(B, path, { ...lowerSpec(nS0, nS1, 9), vom: null });
  // upper deck: sides + south end (open to the bay in the north)
  const s0 = path.segs[4].s0 - 1, s1 = path.segs[0].s1 + 1 + P;
  const uD0 = lower.dEnd - 6, uH0 = lower.top + 8;
  const groupUp = (s, r) => { const a = angleAt(path, s); return a > 300 && a < 330 && r > 2 ? 'away' : 'home'; };
  const upperSpec = {
    s0, s1, d0: uD0, rows: 24, depth: 1.0, h0: uH0, rise: 0.62,
    tint: [0.78, 0.78, 0.76], seats: 'seats', seatColor: seatCol,
    aisleEvery: 24, aisleW: 1.1, vom: { every: 30, offset: 14, row: 6, rows: 3, w: 2.4 },
    group: groupUp, want: wantFn(path, field, 24), light: (r) => (r > 10 ? 0.78 : 0.92),
    back: { h: 2.6 }, exterior: true, exteriorKey: 'exterior', exteriorTint: [1, 1, 1], exteriorU: 16, exteriorV: 16,
    roof: { depth: 15, h: 3.5, rise: 2.5, key: 'canopy', tint: [0.92, 0.93, 0.95], fascia: [0.1, 0.42, 0.42], fasciaH: 1.6, colEvery: 16 },
  };
  const upper = buildTier(B, path, upperSpec);
  const ssU = path.samples(s0, s1, 6);
  const soffit = uH0 - 3.6;
  ringWall(B.get('suites'), path, ssU, lower.dEnd + 0.4, lower.top + 2.4, soffit, { uScale: 8, vFit: true });
  const conc = B.get('concrete');
  conc.setColor(0.68, 0.68, 0.68);
  ringFlat(conc, path, ssU, uD0, lower.dEnd + 0.4, soffit, { down: true });
  const fas = B.get('paint');
  fas.setColor(0.06, 0.16, 0.3);
  ringWall(fas, path, ssU, uD0 - 0.02, soffit, uH0 + 0.35);
  ringWall(B.get('ribbon'), path, ssU, uD0 - 0.1, soffit + 0.9, soffit + 2.6, { uScale: 54, vFit: true });
  // light banks along the canopy edges
  const edge = upperSpec.roofEdge;
  const bankAt = [];
  for (const seg of [path.segs[0], path.segs[4], path.segs[6]]) for (const k of [0.12, 0.37, 0.63, 0.88]) bankAt.push(seg.s0 + seg.len * k);
  for (const seg of [path.segs[5], path.segs[7]]) bankAt.push(seg.s0 + seg.len * 0.5);
  edgeBanks(ctx, path, bankAt, edge.d + 0.6, edge.y - 2.6, { cols: 8, rows: 3, lamp: 0.85, tilt: 0.75 });

  // ---- north end: video board over the low stand, then the plaza and the bay
  const board = createScoreboard('video', { home, away: ctx.away, intensity: ctx.day ? 1.3 : 1.55 });
  const bw = Math.min(44, hw * 2.1), bh = bw * 0.36;
  const bz = path.az + north.dEnd + 3;
  videoBoard(ctx, 0, north.backTop + 3, bz, bw, bh, Math.PI, board);
  // the bay
  const shore = shoreZ(field);
  const plaza = B.get('concrete');
  plaza.setColor(0.4, 0.4, 0.42);
  for (let x = -250; x < 250; x += 10) plaza.box(x, -2.2, shore, 10, 2.25, 1.2, 0, {});
  const rail = B.get('metal');
  rail.setColor(0.5, 0.52, 0.55);
  beam(rail, V3(-250, 1.1, shore - 0.3), V3(250, 1.1, shore - 0.3), 0.06);
  for (let x = -120; x <= 120; x += 24) {
    pole(rail, V3(x, 0, shore - 2), V3(x, 6, shore - 2), 0.08, 6);
    ctx.lightsList.push({ pos: V3(x, 6.2, shore - 2), color: [1, 0.78, 0.5], size: 1.6, k: 1 });
  }
  const waterMat = spill(new THREE.MeshStandardMaterial({
    color: ctx.day ? '#1d4a66' : ctx.dusk ? '#1a2a44' : '#04101c', roughness: 0.12, metalness: 0.1,
    normalMap: rippleNormals(), normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: ctx.night ? 2.6 : 1.2,
  }), ctx, 0);
  waterMat.normalMap.repeat.set(60, 60);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1400), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.6, shore + 700);
  water.name = 'bay';
  root.add(water);

  // ---- the skyline across the bay: towers with setbacks, lit crowns, spires
  const sky = [];
  const styles = ['glass', 'dark', 'teal', 'concrete', 'glass'];
  const crowns = [[0.4, 1.8, 2.0], [2.2, 2.0, 1.7], [1.6, 0.6, 2.2], [2.2, 2.2, 2.2]];
  for (let i = 0; i < 34; i++) {
    const x = -470 + i * 28 + (rng() - 0.5) * 14;
    const core = Math.exp(-Math.pow((x + 40) / 190, 2));
    const z = shore + 320 + rng() * 170 - core * 50;
    const h = 24 + rng() * 30 + core * (55 + rng() * 120);
    const w = 16 + rng() * 14, d = 14 + rng() * 12;
    const style = styles[(rng() * styles.length) | 0];
    const seed = 'b' + (i % 3);
    if (h > 75) {
      const h0 = h * (0.45 + rng() * 0.2);
      sky.push({ x, z, w, d, h: h0, style, seed, uw: 14, uh: 22, glow: 2.6 });
      const h1 = h - h0;
      const w1 = w * (0.6 + rng() * 0.2), d1 = d * (0.6 + rng() * 0.2);
      sky.push({ x: x + (rng() - 0.5) * (w - w1) * 0.5, z, w: w1, d: d1, h: h1, y0: h0, style, seed, uw: 14, uh: 22, glow: 2.6, antenna: rng() < 0.6, crown: rng() < 0.65 ? crowns[(rng() * crowns.length) | 0] : null });
    } else sky.push({ x, z, w, d, h, style, seed, uw: 14, uh: 22, glow: 2.6, crown: rng() < 0.2 ? crowns[(rng() * crowns.length) | 0] : null });
  }
  // landmark: a slim tower with a spire
  sky.push({ x: -40, z: shore + 300, w: 20, d: 20, h: 120, style: 'glass', seed: 'L', uw: 12, uh: 20, glow: 2.6 });
  sky.push({ x: -40, z: shore + 300, w: 14, d: 14, h: 70, y0: 120, style: 'glass', seed: 'L', uw: 12, uh: 20, glow: 2.6, crown: [0.4, 2.0, 2.2] });
  cityBlock(ctx, rng, sky);
  const spire = B.get('metal');
  spire.setColor(0.7, 0.72, 0.75);
  pole(spire, V3(-40, 190, shore + 300), V3(-40, 232, shore + 300), 0.8, 6);
  ctx.lightsList.push({ pos: V3(-40, 233, shore + 300), color: [1, 0.15, 0.08], size: 5, k: 1.6, blink: 1 });

  // ---- the Halcyon Bridge (suspension, strung with lights)
  const bridge = B.get('metal');
  const bx0 = 140, bz0 = shore + 120, bx1 = 640, bz1 = shore + 420;
  const along = (t) => V3(bx0 + (bx1 - bx0) * t, 0, bz0 + (bz1 - bz0) * t);
  const deckY = 18, towerH = 70;
  bridge.setColor(0.55, 0.22, 0.16);
  for (const t of [0.25, 0.75]) {
    const p = along(t);
    for (const sx of [-1, 1]) {
      const nx = -(bz1 - bz0), nz = bx1 - bx0, nl = Math.hypot(nx, nz);
      const ox = (nx / nl) * 9 * sx, oz = (nz / nl) * 9 * sx;
      beam(bridge, V3(p.x + ox, -2, p.z + oz), V3(p.x + ox, towerH, p.z + oz), 3.2, 3.2);
    }
  }
  bridge.setColor(0.25, 0.26, 0.28);
  for (let k = 0; k < 20; k++) beam(bridge, along(k / 20).setY(deckY), along((k + 1) / 20).setY(deckY), 18, 2);
  const cable = (t) => {
    // catenary-ish: towers at 0.25 / 0.75
    const u = t < 0.25 ? t / 0.25 : t < 0.75 ? (t - 0.25) / 0.5 : (t - 0.75) / 0.25;
    const y = t < 0.25 ? deckY + (towerH - deckY) * Math.pow(u, 1.6) : t < 0.75 ? deckY + 4 + (towerH - deckY - 4) * Math.pow(2 * u - 1, 2) : towerH - (towerH - deckY) * Math.pow(u, 0.6);
    return along(t).setY(y);
  };
  bridge.setColor(0.55, 0.22, 0.16);
  for (let k = 0; k < 40; k++) beam(bridge, cable(k / 40), cable((k + 1) / 40), 0.8);
  for (let k = 0; k <= 40; k++) {
    const c = cable(k / 40);
    ctx.lightsList.push({ pos: c.clone().add(V3(0, 0.6, 0)), color: [1, 0.92, 0.75], size: 3.2, k: 1.1 });
    if (k % 2 === 0) ctx.lightsList.push({ pos: along(k / 40).setY(deckY + 1.5), color: [1, 0.6, 0.25], size: 2.6, k: 0.9 });
  }

  // ---- light streaks on the water (skyline + bridge + promenade), additive, built once
  const streaks = [];
  if (!ctx.day) {
    for (const b of sky) {
      if (b.y0) continue;
      for (let k = 0; k < 3; k++) {
        const x = b.x + (rng() - 0.5) * b.w * 0.9;
        streaks.push({ pos: V3(x, -1.5, b.z - b.d / 2 - 14 - rng() * 30), w: 1.4 + rng() * 2.4, h: 40 + rng() * 70, color: rng() < 0.7 ? [0.75, 0.6, 0.42] : [0.42, 0.55, 0.8] });
      }
    }
    for (const b of sky) if (b.crown) streaks.push({ pos: V3(b.x, -1.5, b.z - b.d / 2 - 20), w: b.w * 0.7, h: 120, color: b.crown.map((v) => v * 0.35) });
    for (let k = 0; k <= 20; k++) {
      const c = cable(k / 20);
      streaks.push({ pos: V3(c.x, -1.5, c.z - 30), w: 2.2, h: 46, color: [0.55, 0.5, 0.38] });
    }
  }
  let streakMesh = null;
  if (streaks.length) {
    // streak sprites lie flat on the water, stretched toward the camera's side of the bay
    const g = new GeoBuilder();
    const cols = [];
    for (const s of streaks) {
      const x0 = s.pos.x - s.w / 2, x1 = s.pos.x + s.w / 2, z0 = s.pos.z - s.h, z1 = s.pos.z + s.h * 0.15;
      g.setColor(...s.color);
      g.quad(V3(x0, s.pos.y, z1), V3(x1, s.pos.y, z1), V3(x1, s.pos.y, z0), V3(x0, s.pos.y, z0), [0, 0, 1, 1]);
      cols.push(s);
    }
    // bright at the far end (v = 0 by the light), fading toward the viewer
    streakMesh = new THREE.Mesh(g.build(true), new THREE.MeshBasicMaterial({
      map: beamTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    streakMesh.renderOrder = 3;
    streakMesh.name = 'waterStreaks';
    root.add(streakMesh);
  }
  void spriteMesh;

  // a couple of boats on the bay
  const boat = B.get('paint');
  for (let i = 0; i < 6; i++) {
    const x = -200 + rng() * 400, z = shore + 80 + rng() * 200, ry = rng() * 3;
    boat.setColor(0.9, 0.9, 0.88);
    box(boat, x, -1.6, z, 3.5, 1.4, 11, ry, {});
    box(boat, x, -0.2, z, 2.6, 1.2, 4, ry, {});
    if (!ctx.day) ctx.lightsList.push({ pos: V3(x, 1.4, z), color: [1, 0.9, 0.7], size: 1.4, k: 1 }, { pos: V3(x, 3.2, z + 2), color: [0.2, 1, 0.3], size: 0.9, k: 1 });
  }

  // a big "PORT HALCYON" sign on the south upper deck back
  const [nc, nx] = cv(1024, 128);
  nx.fillStyle = home.colors.primary;
  nx.fillRect(0, 0, 1024, 128);
  nx.font = '900 86px "Arial Black", "Inter", Arial, sans-serif';
  nx.textAlign = 'center'; nx.textBaseline = 'middle';
  nx.fillStyle = home.colors.secondary;
  nx.fillText('BAYSIDE STADIUM', 512, 68, 980);
  const nt = tex(nc, { repeat: false });
  disposables.push(nt);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(46, 5.75), new THREE.MeshBasicMaterial({ map: nt, color: new THREE.Color(1.4, 1.4, 1.4) }));
  sign.position.set(0, edge.y + 4.4, -(path.az + upper.dEnd + 0.9));
  root.add(sign);

  return {
    seats: [...lower.seats, ...north.seats, ...upper.seats],
    pool: [path.ax + upper.dEnd + 3, path.az + upper.dEnd + 3],
    boards: [board],
    disposables,
    sideline: { benchOff: 8.5, cheer: 'big', photographers: 10, coaches: 4, players: 16, chainSide: 1, vest: '#d8ff20' },
    cams: {
      scoreboard: { pos: V3(0, 5, E - 8), target: V3(0, north.backTop + 10, bz + 40) },
      crowd: { pos: V3(hw + 5, 3.5, -12), target: V3(hw + 26, 14, 4) },
    },
    update(dt, st, t) {
      rib.scroll(t);
      waterMat.normalMap.offset.set(t * 0.004, t * 0.0025);
    },
  };
}
