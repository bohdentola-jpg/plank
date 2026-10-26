// COLLEGE — a big college bowl: a double-deck horseshoe of aluminium benches,
// open at the +z end where the video board stands, a brick exterior, a press
// box tower on the home side, the student section packed into the closed end,
// the band in the corner, LED ribbons on the upper-deck fascia, light masts
// on the rim, a hedge along the field wall, and the campus beyond the open end.
import * as THREE from 'three';
import { RRPath, ringWall, ringFlat } from '../bowl.js';
import { V3, box, beam, pole, trees, spill, building, exteriorMat } from '../kit.js';
import { cv, tex, BRANDS } from '../tex.js';
import { createScoreboard } from '../scoreboard.js';
import { logoCanvas } from '../../logos.js';
import { makeRng } from '../../../core/util.js';
import { wantFn, angleAt, adWallMat, ribbonMat, rimBanks, videoBoard, suiteMat } from './common.js';
import { buildTier } from '../bowl.js';

export const SUN_AZ = 2.6;
export const WIND_DIR = 1.2;

export function paint(ctx) {
  const h = ctx.home;
  return {
    surface: 'grass', pattern: 'checker', grass: ['#3c7a2a', '#4c8c34'], wear: 0.3, border: 'college',
    endzone: { style: 'stripes', fill: h.colors.primary, fill2: h.colors.dark || '#000000', text: [h.name.toUpperCase(), h.city.toUpperCase()], color: '#ffffff', outline: h.colors.secondary },
    logo: logoCanvas(h, 1024, { flat: true }), logoSize: Math.min(ctx.field.W * 0.3, 13),
    sideLogos: logoCanvas(h, 256, { mono: '#ffffff', flat: true }),
    marginSide: 12, marginEnd: 8,
  };
}

export async function build(ctx) {
  const { B, field, home, root } = ctx;
  const rng = makeRng('college');
  const hw = field.halfW, E = field.end;
  const disposables = [];
  const path = new RRPath(hw + 11, E + 9, 24);
  const P = path.P;
  const c2 = path.segs[3], c1 = path.segs[1];
  // horseshoe open at +z: from halfway round the (−x,+z) corner, all the way to halfway round (+x,+z)
  const s0 = c2.s0 + c2.len * 0.55, s1 = c1.s0 + c1.len * 0.45 + P;

  B.get('adwall', () => adWallMat(ctx, 'adwall8', BRANDS.slice(0, 8)));
  const rib = ribbonMat(ctx, [`${home.city.toUpperCase()} ${home.name.toUpperCase()}`, 'NOVATRON', `GO ${home.abbr}!`, 'BOLT COLA', 'DEFENSE!', 'HALCYON BANK', 'MAKE SOME NOISE', 'KUROSHIO']);
  B.get('ribbon', () => rib.mat);
  B.get('suites', () => suiteMat(ctx));
  B.opts('ribbon', { receive: false });
  B.get('exterior', (c) => exteriorMat(c, 'college', '#8a4030', home.colors.primary, { brick: true }));

  const primary = new THREE.Color(home.colors.primary);
  const groupLo = (s, r) => {
    const a = angleAt(path, s);
    if (a > 248 && a < 292 && r > 1) return 'student';
    if (a > 208 && a < 232 && r > 2 && r < 16) return 'band';
    return 'home';
  };
  const lowerRows = 32;
  const lower = buildTier(B, path, {
    s0, s1, d0: 0, rows: lowerRows, depth: 0.95, h0: 1.8, rise: 0.4, riseGrow: 0.004,
    tint: [0.74, 0.73, 0.7], seats: 'bench', benchTint: [0.86, 0.87, 0.88],
    aisleEvery: 26, aisleW: 1.2, vom: { every: 26, offset: 9, row: 9, rows: 4, w: 2.8 },
    group: groupLo, want: wantFn(path, field, lowerRows), light: (r) => (r > 25 ? 0.72 : 1),
    front: { y0: 0, rail: 0.3, key: 'adwall', vFit: true, uScale: 68 },
    back: { h: 2.8 }, exterior: false,
  });
  // upper deck overhangs the back of the lower bowl
  const uD0 = lower.dEnd - 7, uH0 = lower.top + 8.5, upperRows = 26;
  const groupUp = (s, r) => {
    const a = angleAt(path, s);
    return a > 40 && a < 62 && r > 3 ? 'away' : 'home';
  };
  const upper = buildTier(B, path, {
    s0: s0 + 3, s1: s1 - 3, d0: uD0, rows: upperRows, depth: 1.0, h0: uH0, rise: 0.6,
    tint: [0.72, 0.71, 0.68], seats: 'bench', benchTint: [0.84, 0.85, 0.86],
    aisleEvery: 26, aisleW: 1.2, vom: { every: 30, offset: 14, row: 6, rows: 3, w: 2.6 },
    group: groupUp, want: wantFn(path, field, upperRows), light: () => 0.92,
    back: { h: 2.4 }, exterior: true, exteriorKey: 'exterior', exteriorTint: [1, 1, 1], exteriorU: 16, exteriorV: 16,
  });
  // suites between the decks, soffit, fascia ribbon
  const ss = path.samples(s0 + 3, s1 - 3, 6);
  const soffit = uH0 - 3.6;
  ringWall(B.get('suites'), path, ss, lower.dEnd + 0.4, lower.top + 2.8, soffit, { uScale: 8, vFit: true });
  const conc = B.get('concrete');
  conc.setColor(0.6, 0.6, 0.6);
  ringFlat(conc, path, ss, uD0, lower.dEnd + 0.4, soffit, { down: true });
  const fas = B.get('paint');
  fas.setColor(...primary.toArray());
  ringWall(fas, path, ss, uD0 - 0.02, soffit, uH0 + 0.35);
  ringWall(B.get('ribbon'), path, ss, uD0 - 0.1, soffit + 1.0, soffit + 2.7, { uScale: 54, vFit: true });
  // brick base under the lower bowl's open ends + a hedge along the field wall
  const hedge = B.get('foliage');
  hedge.setColor(0.16, 0.3, 0.12);
  for (const seg of [path.segs[0], path.segs[4]]) {
    for (const s of path.samples(seg.s0 + 2, seg.s1 - 2, 4).slice(0, -1)) {
      const p = path.at(s, -0.7), q = path.at(s + 4, -0.7);
      beam(hedge, V3(p.x, 0.6, p.z), V3(q.x, 0.6, q.z), 0.9, 1.25);
    }
  }

  // ---- press box tower on the home (−x) side
  const pb = B.get('paint');
  pb.setColor(0.82, 0.8, 0.76);
  const pbx = -(path.ax + upper.dEnd) + 3, pbz0 = -E * 0.45, pbz1 = E * 0.45;
  box(pb, pbx - 2, upper.backTop, 0, 9, 12, pbz1 - pbz0, 0, {});
  const glow = B.get('glow');
  glow.setColor(...(ctx.day ? [0.3, 0.36, 0.42] : [1.6, 1.3, 0.85]));
  for (const yy of [upper.backTop + 2.2, upper.backTop + 7]) {
    glow.quad(V3(pbx + 2.52, yy, pbz1 - 1), V3(pbx + 2.52, yy, pbz0 + 1), V3(pbx + 2.52, yy + 3, pbz0 + 1), V3(pbx + 2.52, yy + 3, pbz1 - 1));
  }
  pb.setColor(...primary.toArray());
  box(pb, pbx - 2, upper.backTop + 12, 0, 10, 0.8, pbz1 - pbz0 + 1, 0, {});

  // ---- light masts on the rim (both sides + closed-end corners)
  const sideAt = (seg, ks) => ks.map((k) => seg.s0 + seg.len * k);
  const masts = [...sideAt(path.segs[0], [0.15, 0.5, 0.85]), ...sideAt(path.segs[4], [0.15, 0.5, 0.85]), path.segs[5].s0 + path.segs[5].len * 0.5 + 0.01, path.segs[7].s0 + path.segs[7].len * 0.5];
  rimBanks(ctx, path, masts.map((s) => s % P), upper.dEnd + 0.4, upper.backTop, 9, { cols: 7, rows: 4, lamp: 0.9, tilt: 0.6 });

  // ---- the open end: video board + campus
  const board = createScoreboard('video', { home, away: ctx.away, intensity: ctx.day ? 1.35 : 1.6 });
  const bw = Math.min(42, hw * 2 + 2), bh = bw * 0.38;
  const bz = E + 30;
  videoBoard(ctx, 0, 9, bz, bw, bh, Math.PI, board);
  // school name over the board
  const [nc, nx] = cv(1024, 128);
  nx.fillStyle = home.colors.primary;
  nx.fillRect(0, 0, 1024, 128);
  nx.font = `900 84px "Arial Black", "Inter", Arial, sans-serif`;
  nx.textAlign = 'center'; nx.textBaseline = 'middle';
  nx.fillStyle = '#ffffff';
  nx.fillText(`${home.city.toUpperCase()}`, 512, 68, 980);
  const nt = tex(nc, { repeat: false });
  disposables.push(nt);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.7, bw * 0.7 / 8), new THREE.MeshBasicMaterial({ map: nt, color: new THREE.Color(1.3, 1.3, 1.3) }));
  name.position.set(0, 9 + bh + 1.2 + bw * 0.044, bz - 0.5);
  name.rotation.y = Math.PI;
  root.add(name);
  // campus: brick halls and a clock tower beyond the open end
  for (let i = 0; i < 7; i++) {
    const bx = -110 + i * 36 + (rng() - 0.5) * 10, bzz = E + 75 + rng() * 40;
    building(B, ctx, bx, bzz, 26 + rng() * 10, 16, 12 + rng() * 10, (rng() - 0.5) * 0.2, rng() < 0.7 ? 'brick' : 'tan', 'c' + (i % 2), { uw: 14, uh: 14 });
  }
  const tw = B.get('brick');
  tw.setColor(0.92, 0.88, 0.84);
  tw.box(30, 0, E + 70, 7, 38, 7, 0, { uw: 4, uh: 4 });
  const roof = B.get('metal');
  roof.setColor(0.25, 0.35, 0.3);
  const cone = new THREE.ConeGeometry(5.6, 9, 4);
  cone.rotateY(Math.PI / 4);
  cone.translate(30, 38 + 4.5, E + 70);
  roof.geometry(cone, new THREE.Matrix4());
  cone.dispose();
  const clock = B.get('glow');
  clock.setColor(...(ctx.day ? [0.9, 0.88, 0.8] : [2.2, 1.9, 1.3]));
  const cr = 2.2, cy = 33, czc = E + 70 - 3.52;
  for (let k = 0; k < 16; k++) {
    const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
    clock.quad(V3(30, cy, czc), V3(30 + Math.cos(a1) * cr, cy + Math.sin(a1) * cr, czc), V3(30 + Math.cos(a0) * cr, cy + Math.sin(a0) * cr, czc), V3(30, cy, czc));
  }
  const tl = [];
  for (let i = 0; i < 120; i++) {
    const a = rng() * Math.PI * 2, r = 1.0 + rng() * 0.6;
    tl.push({ x: Math.cos(a) * (path.ax + 60) * r, z: Math.sin(a) * (path.az + 50) * r, h: 9 + rng() * 8, kind: rng() < 0.2 ? 'pine' : 'oak', tint: rng() < 0.5 ? '#2e4a26' : '#3a5a2c' });
  }
  root.add(trees(tl, ctx));
  // flag poles on the rim of the closed end
  const fp = B.get('metal');
  fp.setColor(0.8, 0.8, 0.82);
  for (const k of [0.3, 0.5, 0.7]) {
    const p = path.at(path.segs[6].s0 + path.segs[6].len * k, upper.dEnd);
    pole(fp, V3(p.x, upper.backTop, p.z), V3(p.x, upper.backTop + 8, p.z), 0.08, 6);
  }

  const seats = [...lower.seats, ...upper.seats];
  return {
    seats,
    pool: [path.ax + upper.dEnd + 3, path.az + upper.dEnd + 3],
    boards: [board],
    disposables,
    sideline: { benchOff: 7.5, cheer: 'big', photographers: 10, coaches: 4, players: 16, chainSide: 1, vest: '#e8e8e0' },
    cams: {
      scoreboard: { pos: V3(0, 6, E - 6), target: V3(0, 14, bz) },
      crowd: { pos: V3(4, 3, -E + 6), target: V3(-10, 9, -(path.az + 14)) },
    },
    update(dt, st, t) { rib.scroll(t); },
  };
}
