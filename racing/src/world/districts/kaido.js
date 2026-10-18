// PORT HALCYON — KAIDO PASS: a Japanese touge. The pass road hairpins up the
// escarpment and switchbacks through dense, dark sugi cedar plantations;
// concrete lattice frames hold its cuttings; yellow chevrons, orange curve
// mirrors and lone sodium lamps mark the hairpins; concrete utility poles
// carry their wires alongside. Halfway up, a rest area: a row of glowing
// vending machines, a tea house with a red parasol and banners. At the top,
// the shrine: a vermilion torii, a lantern-lit stone approach, steps up to
// the hall, the sacred cedar. Off the foot of the pass an unmarked track
// climbs to a lookout over the whole city.
import * as THREE from 'three';
import { litMat, plainMat, box, prism, gable, cylinder, cone, drape } from './builder.js';
import { shoulderMat } from '../kit.js';
import { lin, mixc, mulc, frame, roadField, hash01, lampTest, levelness, useGround, cellPoints, ownAcc, ownMesh } from './peaks/util.js';
import * as F from './peaks/flora.js';
import { bends, poles, cuts, drapeCut } from './peaks/roadside.js';
import { cellUV, board, curveMirror, lampPost, utilityPole, railing, bench } from './peaks/parts.js';
import { findBesideRoad, findFlat } from './peaks/sites.js';
import { latticeTex, kaidoSignTex, vendingTex, teaWallTex, tileTex, stoneTex } from './peaks/tex.js';

const PAL = {
  cedar: lin('#18291f'), cedarTip: lin('#2a4232'), cedarTop: lin('#3a5a40'), bark: lin('#5e3424'),
  culm: lin('#5f8a3a'), culm2: lin('#7a9a48'), bambooLeaf: lin('#3e6a2a'), bambooLeafHi: lin('#6a9a40'),
  maple: lin('#c8321e'), maple2: lin('#e0702a'), mapleBark: lin('#4a3428'),
  rock: lin('#6e6c64'), rockDark: lin('#3e3c36'), moss: lin('#4a5a32'),
  vermilion: lin('#c8381e'), black: lin('#1a1614'), white: lin('#ece6da'), wood: lin('#5a3a24'), woodDark: lin('#3a2416'),
  stone: lin('#9a968c'), stoneDark: lin('#6c6860'), concrete: lin('#9c9a92'), concreteDark: lin('#6a6862'),
  steel: lin('#3c4046'), orange: lin('#e8661a'), yellow: lin('#f0c418'), red: lin('#c41e1e'), redCloth: lin('#b81a22'),
  straw: lin('#c8b47a'), paper: lin('#f2eadc'), green: lin('#2a6a3a'), blue: lin('#1a4fa0'), pole: lin('#8e8c86'),
  wire: lin('#141414'), insul: lin('#d8d4c8'), asphalt: lin('#303034'), paint: lin('#d8d6cc'),
};

// ------------------------------------------------------------------ materials

function mats(B) {
  return {
    veg: B.mat('veg', () => litMat({ vertexColors: true, roughness: 0.92, flatShading: true }, { glow: 2.0 })),
    vegDark: B.mat('vegDark', () => plainMat({ vertexColors: true, roughness: 0.92, flatShading: true })),
    rock: B.mat('rock', () => litMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    rockDark: B.mat('rockDark', () => plainMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    props: B.mat('props', () => litMat({ vertexColors: true, roughness: 0.7, metalness: 0.08 })),
    lattice: B.mat('lattice', () => litMat({ map: latticeTex(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    signs: B.mat('signs', () => litMat({ map: kaidoSignTex(), emissive: 0xffffff, emissiveMap: kaidoSignTex(), roughness: 0.55 }, { night: 0.32 })),
    vend: B.mat('vend', () => { const t = vendingTex(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.4 }, { night: 0.95 }); }),
    tea: B.mat('tea', () => { const t = teaWallTex(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.85 }, { night: 1.4 }); }),
    tile: B.mat('tile', () => litMat({ map: tileTex(), roughness: 0.7, metalness: 0.15 })),
    stone: B.mat('stone', () => litMat({ map: stoneTex(), roughness: 0.92 })),
    lantern: B.mat('lantern', () => litMat({ color: 0xf0e2c0, emissive: 0xffa24a, roughness: 0.8 }, { night: 2.4 })),
    sodium: B.mat('sodium', () => litMat({ color: 0xe8dcc0, emissive: 0xff9a3a, roughness: 0.6 }, { night: 3.2 })),
    mirror: B.mat('mirror', () => plainMat({ color: 0xc8d4dc, metalness: 1, roughness: 0.05, envMapIntensity: 1.5 })),
    lot: shoulderMat('asphaltlot'),
  };
}

// ------------------------------------------------------------------ plan

function plan(P) {
  const net = P.net;
  const pass = net.byId.get('kd_pass');
  // --- lone sodium lamps at the hairpins of the pass (and the other bends of the district's mountain roads)
  for (const r of P.roads((q) => q.rt.id === 'mountain')) hairpinLamps(P, r);
  // --- the shrine at the top of the pass
  shrine(P);
  // --- the rest area halfway up
  if (pass) restArea(P, pass);
  // --- the lookout at the end of the Miharashi track
  lookout(P);
  // --- the pass's route board at its foot
  if (pass) passBoard(P, pass);
}

function hairpinLamps(P, r) {
  let lastS = -1e9;
  for (let i = 8; i < r.N - 8; i++) {
    const k = r.Ks[i];
    if (Math.abs(k) < 1 / 38) continue;
    if (Math.abs(r.Ks[i - 1]) > Math.abs(k) || Math.abs(r.Ks[i + 1]) > Math.abs(k)) continue;
    if (r.S[i] - lastS < 110 || r.S[i] < r.trim0 + 20 || r.S[i] > r.length - r.trim1 - 20) continue;
    if (!P.inside(r.X[i], r.Z[i])) continue;
    const out1 = k > 0 ? -1 : 1;
    const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
    const lat = out1 * (reach + 1.6);
    const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
    const hx = r.X[i] + r.LX[i] * out1 * (reach - 1.2), hz = r.Z[i] + r.LZ[i] * out1 * (reach - 1.2);
    const y = r.roadY(i, 0, out1 * r.rt.hw);
    lastS = r.S[i];
    P.add({ type: 'sodium', x, z, y, hx, hz });
    P.lamp({ x, z, y, hx, hz, hy: y + 7.6, color: '#ffa048', radius: 24, intensity: 1.15, halo: 3.2 });
  }
}

function restArea(P, r) {
  // prefer the middle of the pass, on whichever side has the room
  const mid = r.length * 0.55;
  const f = findBesideRoad(P, r, 40, 26, { s0: r.length * 0.35, s1: r.length * 0.8, step: 10, setback: 1.5, maxSpan: 7, maxDy: 3.5, prefer: (q) => Math.abs(q.s - mid) * 0.02 });
  if (!f) return;
  const y = f.roadY;
  P.add({ type: 'rest', x: f.x, z: f.z, ry: f.ry, w: f.w, d: f.d, y, map: 'yard' });
  const L = frame(f.x, y, f.z, f.ry);
  const at = (lx, lz) => L.xz(lx, lz);
  // the tea house, the vending machines, the lamp
  const [tx, tz] = at(9, -7);
  P.collider({ kind: 'box', x: tx, z: tz, hx: 5.6, hz: 4.0, ry: f.ry, y0: y - 2, y1: y + 6 });
  const [vx, vz] = at(-12, -9.6);
  P.collider({ kind: 'box', x: vx, z: vz, hx: 3.0, hz: 0.6, ry: f.ry, y0: y - 1, y1: y + 2.4 });
  const [lx, lz] = at(-1, 6);
  P.collider({ kind: 'circle', x: lx, z: lz, r: 0.3, y0: y - 1, y1: y + 8 });
  P.lamp({ x: lx, z: lz, y, hx: lx, hz: lz, hy: y + 7.5, color: '#e8eeff', radius: 22, intensity: 0.9, halo: 2.6 });
  const [mx, mz] = at(-12, -7.6);
  P.lamp({ x: vx, z: vz, y, hx: mx, hz: mz, hy: y + 1.4, color: '#cfe4ff', radius: 9, intensity: 1.3, halo: 0 });
  const [hx, hz] = at(9, -2);
  P.lamp({ x: tx, z: tz, y, hx, hz, hy: y + 2.6, color: '#ffb060', radius: 9, intensity: 0.9, halo: 1.2 });
  P.far({ x: tx, z: tz, y: y - 1, w: 11, d: 8, h: 6, ry: f.ry, color: '#4a3424', lit: 0.4 });
  P.landmark({ id: 'kaido_rest', name: 'KAIDO REST AREA', x: f.x, z: f.z, r: 30, kind: 'rest' });
}

function shrine(P) {
  const top = P.net.nodes.get('kd_top');
  if (!top) return;
  // the shrine's grounds: a long footprint (approach + hall) beside the junction, facing it
  let site = null;
  for (const [ox, oz] of [[-120, -95], [-90, -120], [-140, -60], [-60, -130], [30, -150], [-170, -110]]) {
    site = findFlat(P, top.x + ox, top.z + oz, 28, 74, 40, { ry: Math.atan2(-ox, -oz), roadPad: true, step: 8, pull: 0.02 });
    if (site) break;
  }
  if (!site) return;
  const g = { lo: site.lo, hi: site.hi };
  const y = g.lo;
  P.add({ type: 'shrine', x: site.x, z: site.z, ry: site.ry, w: site.w, d: site.d, y, yHi: g.hi, map: 'park' });
  const L = frame(site.x, y, site.z, site.ry);
  const at = (lx, lz) => L.xz(lx, lz);
  // solid things: the torii's pillars, the platform and hall, the sacred cedar, the lanterns
  for (const sx of [-3.6, 3.6]) { const [px, pz] = at(sx, 33); P.collider({ kind: 'circle', x: px, z: pz, r: 0.45, y0: y - 2, y1: y + 9 }); }
  const [hx, hz] = at(0, -27);
  P.collider({ kind: 'box', x: hx, z: hz, hx: 11, hz: 8.5, ry: site.ry, y0: y - 2, y1: g.hi + 12 });
  const [cx, cz] = at(-10, -14);
  P.collider({ kind: 'circle', x: cx, z: cz, r: 1.8, y0: y - 2, y1: y + 40 });
  for (let k = 0; k < 5; k++) {
    for (const sx of [-3.4, 3.4]) {
      const [px, pz] = at(sx, 26 - k * 8.5);
      P.collider({ kind: 'circle', x: px, z: pz, r: 0.5, y0: y - 1, y1: y + 2.5 });
      if (k % 2 === 0) P.lamp({ x: px, z: pz, y, hx: px, hz: pz, hy: y + 1.6, color: '#ffae58', radius: 7, intensity: 0.75, halo: 0.9 });
    }
  }
  const [ex, ez] = at(0, -19);
  P.lamp({ x: ex, z: ez, y: y + 2.6, hx: ex, hz: ez, hy: y + 6, color: '#ffa850', radius: 12, intensity: 0.9, halo: 1.4 });
  // far: the torii, the hall, the cedar
  const [fx, fz] = at(0, 33);
  P.far({ x: fx, z: fz, y: y - 1, w: 9.5, d: 1.2, h: 9, ry: site.ry, color: '#b03018', lit: 0 });
  P.far({ x: hx, z: hz, y: y - 1, w: 16, d: 13, h: 12, ry: site.ry, color: '#3a3430', lit: 0.25 });
  P.far({ shape: 'cone', x: cx, z: cz, y: y + 8, r: 5, h: 36, color: '#1c2c22' });
  P.landmark({ id: 'shrine', name: 'KAIDO SHRINE', x: site.x, z: site.z, r: 40, kind: 'shrine' });
}

function lookout(P) {
  const n = P.net.nodes.get('kd_view');
  if (!n) return;
  // a clearing at the end of the track, the railing on the escarpment's edge (south)
  const e = n.ends[0];
  const ry = 0;                            // facing south, out over the city
  const x = n.x - e.dx * 9, z = n.z - e.dz * 9;
  const y = n.y;
  P.claim(x, z, 14, 10, ry);
  // the view: no trees on the slope in front of the railing
  P.claim(x, z + 48, 70, 80, ry);
  P.add({ type: 'lookout', x, z, ry, y, w: 14, d: 10, map: 'plaza' });
  P.collider({ kind: 'box', x, z: z + 5.5, hx: 7, hz: 0.3, ry, y0: y - 2, y1: y + 1.2 });
  P.lamp({ x, z, y, hx: x, hz: z, hy: y + 2.2, color: '#ffc890', radius: 7, intensity: 0.5, halo: 0.8 });
  P.landmark({ id: 'miharashi', name: 'MIHARASHI LOOKOUT', x, z, r: 20, kind: 'lookout', hidden: true });
}

function passBoard(P, r) {
  // the blue route board where the pass begins (by the junction at its foot)
  const s = r.trim0 + 26, p = r.posAt(s), i = p.i;
  for (const sd of [-1, 1]) {
    const lat = sd * (r.rt.hw + r.rt.shoulder + 2.2);
    const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
    if (!P.isFree(x, z, 2, 1, 0, { pad: 0, anywhere: true })) continue;
    P.add({ type: 'routeboard', x, z, y: r.Y[i], ry: Math.atan2(-r.TX[i], -r.TZ[i]) });
    P.collider({ kind: 'circle', x, z, r: 0.25, y0: r.Y[i] - 1, y1: r.Y[i] + 4 });
    break;
  }
}

// ------------------------------------------------------------------ scatter

function scatter(S) {
  useGround(S);
  const field = roadField(S.net, S.cx, S.cz);
  const lit = lampTest(S);
  // the roadside
  for (const it of bends(S, { mirrors: true, rMax: 55 })) S.add(it);
  for (const it of poles(S, 'upole', { every: 40, off: 3.0, wires: true, free: true, filter: (r) => r.rt.id === 'mountain' })) S.add(it);
  for (const it of cuts(S, 'lattice', { minRise: 3.2, filter: (r) => r.rt.id === 'mountain' })) S.add(it);
  // the forest: sugi in plantation rows (each stand its own row angle), bamboo in patches, the odd clearing
  const sp = 6.2;
  const x0 = S.x0, z0 = S.z0;
  for (let gz = z0 + sp / 2; gz < z0 + 256; gz += sp) {
    for (let gx = x0 + sp / 2; gx < x0 + 256; gx += sp) {
      // a stand's row direction from a coarse noise: rows read as a plantation
      const stand = S.noise(gx / 260 + 31, gz / 260 - 7);
      const rowy = stand > 0.05;
      const ang = stand * 4.0;
      let x = gx, z = gz;
      const j = S.rng(), j2 = S.rng(), keep = S.rng(), t = S.rng();
      if (rowy) {
        // snap across the rows (rows 5.5 m apart), jitter along them
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const u = x * ca + z * sa, v = -x * sa + z * ca;
        const v2 = Math.round(v / 5.5) * 5.5 + (j - 0.5) * 0.8;
        const u2 = u + (j2 - 0.5) * 2.2;
        x = u2 * ca - v2 * sa; z = u2 * sa + v2 * ca;
        if (x < x0 || x >= x0 + 256 || z < z0 || z >= z0 + 256) continue;
      } else { x += (j - 0.5) * sp * 0.9; z += (j2 - 0.5) * sp * 0.9; }
      if (!S.inside(x, z)) continue;
      const d = field.at(x, z);
      if (d < 3) continue;
      const clear = S.noise(x / 120 - 5, z / 120 + 11);
      if (clear < -0.42) continue;                         // a clearing
      if (d < 9 && keep > 0.55) continue;                  // thinner right by the road
      if (!S.free(x, z, 1.6, true)) continue;
      const y = S.groundY(x, z);
      if (d < 36) {
        // not on the dressed cut slopes beside the road
        if (levelness(S.groundY, x, z) < 0.8) continue;
      }
      const bam = S.noise(x / 70 + 3, z / 70 - 9);
      if (bam > 0.38 && d < 90) {
        if (keep < 0.5) S.add({ type: 'bamboo', x, z, y, h: 7 + t * 4, t, lit: lit(x, z) });
        if (d < 40) S.collider({ kind: 'circle', x, z, r: 1.0, y0: y - 1, y1: y + 6 });
        continue;
      }
      const h = 17 + t * 11 + (rowy ? 0 : 4 * j);
      S.add({ type: 'sugi', x, z, y, h, t, lod: d > 70 ? 1 : 0, lit: lit(x, z) });
      if (d < 48) S.collider({ kind: 'circle', x, z, r: 0.55, y0: y - 1, y1: y + 10 });
    }
  }
  // moss-covered boulders here and there
  for (const [x, z] of cellPoints(S, 46, { r: 2.5 })) {
    if (S.rng() > 0.35) continue;
    const y = S.groundY(x, z), s = S.range(0.8, 2.4);
    S.add({ type: 'rock', x, z, y, s, t: S.rng(), lit: lit(x, z) });
    if (s > 1.4 && field.at(x, z) < 50) S.collider({ kind: 'circle', x, z, r: s * 0.5, y0: y - 1, y1: y + s });
  }
}

// ------------------------------------------------------------------ build

const HEAVY = new Set(['rest', 'shrine', 'lookout', 'lattice', 'upole', 'routeboard']);

function* build(B, items) {
  const m = mats(B);
  useGround(B);
  const vegL = B.acc(m.veg), vegD = ownAcc(m.vegDark), rockL = B.acc(m.rock), rockD = B.acc(m.rockDark);
  let n = 0;
  for (const it of items) {
    switch (it.type) {
      case 'sugi': F.sugi(it.lit ? vegL : vegD, it.x, it.y, it.z, it.h, it.t, PAL, it.lod); break;
      case 'bamboo': F.bamboo(it.lit ? vegL : vegD, it.x, it.y, it.z, it.h, it.t, PAL, 6 + Math.floor(it.t * 4)); break;
      case 'rock': F.rock(it.lit ? rockL : rockD, it.x, it.y, it.z, it.s, 0.75, it.t, mixc(PAL.rock, PAL.moss, 0.5), PAL.rockDark, PAL.moss, 0.6); break;
      case 'chev': chevron(B, m, it); break;
      case 'mirror': curveMirror(B.near(m.props), B.near(m.mirror), it.x, B.groundY(it.x, it.z), it.z, it.ry, PAL.orange, PAL.orange); break;
      case 'upole': upole(B, m, it); break;
      case 'lattice': drapeCut(B, B.acc(m.lattice), it, { tile: 4, maxW: 30 }); gutter(B, m, it); break;
      case 'sodium': lampPost(B.acc(m.props), B.acc(m.sodium), it.x, it.y, it.z, 7.6, it.hx, it.hz, PAL.steel); break;
      case 'rest': restArea3d(B, m, it); break;
      case 'shrine': shrine3d(B, m, it); break;
      case 'lookout': lookout3d(B, m, it); break;
      case 'routeboard': routeBoard(B, m, it); break;
      default: break;
    }
    if (++n % 24 === 0 || HEAVY.has(it.type)) yield;
  }
  yield* ownMesh(B, vegD);
}

// ------------------------------------------------------------------ roadside parts

function chevron(B, m, it) {
  const y = Math.max(B.groundY(it.x, it.z), it.y - 3);
  const props = B.near(m.props);
  props.col = PAL.steel;
  box(props, it.x, y - 0.4, it.z, 0.09, Math.max(1.6, it.y + 1.0 - y + 0.4), 0.09, it.ry);
  board(B.near(m.signs), it.x, Math.max(it.y, y) + 1.35, it.z, 0.62, 0.62, it.ry, cellUV(it.cell));
}

function upole(B, m, it) {
  const y = B.groundY(it.x, it.z);
  const ny = it.nx !== undefined ? B.groundY(it.nx, it.nz) : y;
  utilityPole(B.acc(m.props), B.near(m.props), it, y, ny, PAL.pole, PAL.concreteDark, PAL.wire, PAL.insul, it.k % 5 === 2);
}

/** A concrete U-gutter along the foot of a dressed cut. */
function gutter(B, m, it) {
  const r = B.net.roads[it.road];
  if (!r) return;
  const acc = B.acc(m.props);
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  const sd = it.sd;
  const i1 = Math.min(r.N - 1, it.i1 + 1);
  for (let i = it.i0; i < i1; i += 2) {
    const j = Math.min(i1, i + 2);
    const a0 = sd * (reach + 0.35), a1 = sd * (reach + 0.95);
    const P = (k, lat, dy) => [r.X[k] + r.LX[k] * lat, r.roadY(k, 0, sd * r.rt.hw) + dy, r.Z[k] + r.LZ[k] * lat];
    acc.col = PAL.concreteDark;
    // the channel floor, sunk a little, and its outer lip
    if (sd > 0) { acc.quadP(P(i, a0, -0.18), P(i, a1, -0.18), P(j, a1, -0.18), P(j, a0, -0.18)); acc.quadP(P(i, a1, -0.18), P(i, a1, 0.12), P(j, a1, 0.12), P(j, a1, -0.18)); }
    else { acc.quadP(P(i, a1, -0.18), P(i, a0, -0.18), P(j, a0, -0.18), P(j, a1, -0.18)); acc.quadP(P(j, a1, -0.18), P(j, a1, 0.12), P(i, a1, 0.12), P(i, a1, -0.18)); }
  }
}

// ------------------------------------------------------------------ the rest area

function restArea3d(B, m, it) {
  const { x, z, ry, w, d, y } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props), near = B.near(m.props);
  // the lot: asphalt draped on the ground, white bays
  const c = [L.xz(-w / 2, -d / 2), L.xz(w / 2, -d / 2), L.xz(w / 2, d / 2), L.xz(-w / 2, d / 2)];
  drape(B.acc(m.lot), B, c, { lift: 0.05, uv: 6 });
  near.col = PAL.paint;
  for (let k = 0; k < 6; k++) {
    const lx = -6 + k * 3.2;
    const a = L.xz(lx, -1.5), b = L.xz(lx, 3.5);
    const ya = B.groundY(a[0], a[1]) + 0.07, yb = B.groundY(b[0], b[1]) + 0.07;
    near.quadP([a[0] - 0.06 * L.c, ya, a[1] + 0.06 * L.s], [a[0] + 0.06 * L.c, ya, a[1] - 0.06 * L.s], [b[0] + 0.06 * L.c, yb, b[1] - 0.06 * L.s], [b[0] - 0.06 * L.c, yb, b[1] + 0.06 * L.s]);
  }
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  // the tea house: plaster and timber walls, a deep tiled gable roof, a veranda
  const ty = Math.max(gy(9, -7), gy(4, -10.5), gy(14, -10.5), gy(4, -3.5), gy(14, -3.5));
  const [tx, tz] = L.xz(9, -7);
  props.col = PAL.stoneDark;
  box(props, tx, ty - 3, tz, 10.6, 3.35, 7.6, ry);
  box(B.acc(m.tea), tx, ty + 0.35, tz, 10, 3.0, 7, ry, { u: 6, v: 3, top: false });
  props.col = PAL.woodDark;
  gable(B.acc(m.tile), tx, ty + 3.35, tz, 10, 7, 2.2, ry, { over: 1.2, u: 2, endAcc: props });
  props.col = PAL.woodDark;
  const [vx2, vz2] = L.xz(9, -2.9);
  box(props, vx2, ty + 0.2, vz2, 10, 0.25, 1.2, ry);
  // the red bench with its parasol
  near.col = PAL.redCloth;
  const [bx, bz] = L.xz(3, 0.5);
  box(near, bx, gy(3, 0.5) + 0.42, bz, 2.4, 0.12, 0.8, ry);
  near.col = PAL.woodDark;
  for (const lx of [-1, 1]) { const q = L.xz(3 + lx, 0.5); box(near, q[0], gy(3, 0.5), q[1], 0.1, 0.42, 0.7, ry); }
  const [px, pz] = L.xz(4.6, 1.4);
  const py = gy(4.6, 1.4);
  near.col = PAL.woodDark;
  cylinder(near, px, py, pz, 0.05, 2.6, 5);
  near.col = PAL.red;
  cone(near, px, py + 2.2, pz, 1.7, 0.7, 12);
  // nobori banners along the front
  for (const [k, col] of [[0, PAL.red], [1, PAL.white], [2, PAL.blue], [3, PAL.green]]) {
    const lx = -3 + k * 4.5, q = L.xz(lx, 9.5), by = gy(lx, 9.5);
    near.col = PAL.steel;
    cylinder(near, q[0], by, q[1], 0.03, 3.6, 4);
    near.col = col;
    const P2 = frame(q[0], by, q[1], ry + 0.4);
    near.quadP(P2(0.05, 1.2, 0), P2(0.75, 1.2, 0), P2(0.75, 3.4, 0), P2(0.05, 3.4, 0));
    near.quadP(P2(0.75, 1.2, 0), P2(0.05, 1.2, 0), P2(0.05, 3.4, 0), P2(0.75, 3.4, 0));
  }
  // the vending machines under a little canopy, glowing
  const vy = Math.max(gy(-14, -9.6), gy(-10, -9.6));
  const vend = B.acc(m.vend);
  for (let k = 0; k < 4; k++) {
    const lx = -13.6 + k * 1.08;
    const q = L.xz(lx, -9.6);
    vendingMachine(vend, props, q[0], vy, q[1], ry, k);
  }
  props.col = PAL.concreteDark;
  const cq = L.xz(-12, -9.9);
  box(props, cq[0], vy + 2.35, cq[1], 5.4, 0.14, 1.9, ry);
  for (const lx of [-14.6, -9.4]) { const q = L.xz(lx, -10.6); box(props, q[0], vy - 0.5, q[1], 0.12, 2.9, 0.12, ry); }
  // recycling bins
  near.col = PAL.blue;
  for (const lx of [-9.2, -8.6]) { const q = L.xz(lx, -9.4); box(near, q[0], vy, q[1], 0.5, 0.9, 0.5, ry); }
  // the lot's lamp
  const lq = L.xz(-1, 6);
  props.col = PAL.steel;
  cylinder(props, lq[0], gy(-1, 6) - 0.3, lq[1], 0.13, 7.8, 6);
  box(B.acc(m.sodium), lq[0], gy(-1, 6) + 7.3, lq[1], 0.8, 0.2, 0.4, ry);
  // a kei truck in a bay, a stone lantern by the tea house door
  keiTruck(near, ...L.xz(-3.2, 1.2), gy(-3.2, 1.2), ry + Math.PI);
  toro(B, m, ...L.xz(14.8, -2.2), gy(14.8, -2.2), ry, 0.8);
}

function vendingMachine(vend, props, x, y, z, ry, k) {
  const P = frame(x, y, z, ry);
  const w = 0.5, d = 0.38, h = 1.83;
  const u0 = k * 0.25 + 0.004, u1 = (k + 1) * 0.25 - 0.004;
  vend.quadP(P(-w, 0, d), P(w, 0, d), P(w, h, d), P(-w, h, d), [u0, 0, u1, 1]);
  props.col = k === 1 ? lin('#e8eef2') : k === 0 ? PAL.red : k === 2 ? PAL.blue : PAL.green;
  props.quadP(P(w, 0, -d), P(-w, 0, -d), P(-w, h, -d), P(w, h, -d));
  props.quadP(P(w, 0, d), P(w, 0, -d), P(w, h, -d), P(w, h, d));
  props.quadP(P(-w, 0, -d), P(-w, 0, d), P(-w, h, d), P(-w, h, -d));
  props.quadP(P(-w, h, d), P(w, h, d), P(w, h, -d), P(-w, h, -d));
}

function keiTruck(acc, x, z, y, ry) {
  const L = frame(x, y, z, ry);
  const bx = (lx, ly, lz, w, h, d, col) => { acc.col = col; const q = L.xz(lx, lz); box(acc, q[0], y + ly, q[1], w, h, d, ry); };
  const white = lin('#ecebe6'), dark = lin('#1b1e22'), tyre = lin('#111111');
  bx(0, 0.45, 1.0, 1.4, 1.25, 1.3, white);
  bx(0, 0.62, -0.75, 1.4, 0.1, 2.0, white);
  bx(0.66, 0.72, -0.75, 0.06, 0.32, 2.0, white);
  bx(-0.66, 0.72, -0.75, 0.06, 0.32, 2.0, white);
  bx(0, 0.72, -1.72, 1.4, 0.32, 0.06, white);
  bx(0, 1.15, 1.66, 1.25, 0.5, 0.02, dark);
  bx(0, 0.3, 1.66, 1.42, 0.16, 0.06, dark);
  for (const [lx, lz] of [[0.6, 1.05], [-0.6, 1.05], [0.6, -1.1], [-0.6, -1.1]]) bx(lx, 0, lz, 0.2, 0.52, 0.52, tyre);
}

/** A stone lantern (tōrō): base, shaft, the lit fire-box, a pyramid roof, a finial. */
function toro(B, m, x, z, y, ry, s = 1) {
  const st = B.acc(m.stone);
  box(st, x, y - 0.2, z, 0.62 * s, 0.42 * s, 0.62 * s, ry, { u: 1 });
  cylinder(st, x, y + 0.22 * s, z, 0.13 * s, 0.85 * s, 6);
  box(st, x, y + 1.07 * s, z, 0.56 * s, 0.12 * s, 0.56 * s, ry, { u: 1 });
  box(B.acc(m.lantern), x, y + 1.19 * s, z, 0.36 * s, 0.34 * s, 0.36 * s, ry);
  const r = B.acc(m.stone);
  cone(r, x, y + 1.53 * s, z, 0.52 * s, 0.42 * s, 4);
  cylinder(r, x, y + 1.9 * s, z, 0.07 * s, 0.16 * s, 5, { top: true });
}

// ------------------------------------------------------------------ the shrine

function shrine3d(B, m, it) {
  const { x, z, ry, y } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props), near = B.near(m.props);
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  // the approach: stone paving from the torii to the steps
  const path = [L.xz(-1.8, 34), L.xz(1.8, 34), L.xz(1.8, -12), L.xz(-1.8, -12)];
  drape(B.acc(m.stone), B, path, { lift: 0.06, uv: 2, step: 3 });
  // the torii
  torii(B, m, ...L.xz(0, 33), gy(0, 33), ry, 1.15);
  // lanterns along the approach
  for (let k = 0; k < 5; k++) for (const sx of [-3.4, 3.4]) toro(B, m, ...L.xz(sx, 26 - k * 8.5), gy(sx, 26 - k * 8.5), ry, 1.25);
  // the platform: a stone-faced terrace with steps up from the approach
  const yTop = Math.max(it.yHi, y + 1.5) + 1.6;
  const [px, pz] = L.xz(0, -27);
  const st = B.acc(m.stone);
  box(st, px, y - 3, pz, 22, yTop - y + 3, 17, ry, { u: 2 });
  const steps = Math.max(4, Math.round((yTop - gy(0, -12)) / 0.3));
  const y0s = gy(0, -12);
  for (let k = 0; k < steps; k++) {
    const lz = -12 - k * 0.45;
    const q = L.xz(0, lz);
    box(st, q[0], y0s - 1, q[1], 5, (yTop - y0s) * ((k + 1) / steps) + 1, 0.45, ry, { u: 2 });
  }
  // komainu on their plinths at the foot of the steps
  for (const sx of [-3.4, 3.4]) {
    const q = L.xz(sx, -11.5), qy = gy(sx, -11.5);
    box(st, q[0], qy - 0.2, q[1], 0.9, 1.1, 1.0, ry, { u: 1 });
    near.col = PAL.stoneDark;
    const P2 = frame(q[0], qy + 0.9, q[1], ry);
    const bq = P2(0, 0, 0);
    box(near, bq[0], bq[1], bq[2], 0.55, 0.55, 0.75, ry);
    const hq = P2(0, 0, 0.2);
    box(near, hq[0], bq[1] + 0.55, hq[2], 0.45, 0.42, 0.42, ry);
  }
  // the hall (haiden): vermilion posts, white walls, dark lattice doors, a big tiled roof
  const hy = yTop;
  const [hx, hz] = L.xz(0, -28);
  props.col = PAL.woodDark;
  box(props, hx, hy, hz, 12.4, 0.5, 9.4, ry);
  props.col = PAL.white;
  box(props, hx, hy + 0.5, hz, 11, 4.2, 8, ry, { top: false });
  props.col = PAL.vermilion;
  for (const lx of [-5.6, -1.9, 1.9, 5.6]) for (const lz of [-4.1, 4.1]) { const q = L.xz(lx, -28 + lz); box(props, q[0], hy + 0.5, q[1], 0.38, 4.25, 0.38, ry); }
  box(props, hx, hy + 4.4, hz, 12, 0.4, 8.8, ry);
  // the doors: dark lattice panels on the front
  props.col = PAL.woodDark;
  const P3 = frame(hx, hy, hz, ry);
  for (const lx of [-3.7, 0, 3.7]) {
    const a = P3(lx - 1.5, 0.6, 4.02), b = P3(lx + 1.5, 0.6, 4.02), c = P3(lx + 1.5, 3.9, 4.02), d = P3(lx - 1.5, 3.9, 4.02);
    props.quadP(a, b, c, d);
  }
  props.col = PAL.white;
  gable(B.acc(m.tile), hx, hy + 4.8, hz, 12.5, 9.4, 3.6, ry, { over: 2.2, u: 2, endAcc: props });
  // chigi and katsuogi on the ridge
  props.col = PAL.black;
  const ridge = (lx) => P3(lx, 8.4, 0);
  const r0 = ridge(-6.6), r1 = ridge(6.6);
  props.beam(r0[0], r0[1], r0[2], r1[0], r1[1], r1[2], 0.45, 0.4);
  for (const lx of [-4, -1.4, 1.4, 4]) { const q = P3(lx, 8.75, 0); cylinder(props, q[0] - 0.0, q[1] - 0.2, q[2], 0.2, 0.4, 6, { top: true }); }
  for (const e of [-1, 1]) {
    const a = P3(e * 6.5, 8.0, -1.2), b = P3(e * 7.6, 10.2, 1.2);
    const c2 = P3(e * 6.5, 8.0, 1.2), d2 = P3(e * 7.6, 10.2, -1.2);
    props.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.18, 0.12);
    props.beam(c2[0], c2[1], c2[2], d2[0], d2[1], d2[2], 0.18, 0.12);
  }
  // the shimenawa (straw rope) across the front with its white shide
  near.col = PAL.straw;
  const s0 = P3(-4.5, 4.0, 4.4), s1 = P3(4.5, 4.0, 4.4), smid = P3(0, 3.5, 4.4);
  near.beam(s0[0], s0[1], s0[2], smid[0], smid[1], smid[2], 0.3, 0.3);
  near.beam(smid[0], smid[1], smid[2], s1[0], s1[1], s1[2], 0.3, 0.3);
  near.col = PAL.paper;
  for (const lx of [-3, -1, 1, 3]) { const q = P3(lx, 3.0, 4.45); box(near, q[0], q[1], q[2], 0.18, 0.55, 0.03, ry); }
  // the offering box and two hanging lanterns
  near.col = PAL.woodDark;
  const ob = P3(0, 0.5, 5.4);
  box(near, ob[0], ob[1], ob[2], 1.6, 0.8, 0.7, ry);
  for (const lx of [-3.3, 3.3]) { const q = P3(lx, 3.0, 4.9); cylinder(B.acc(m.lantern), q[0], q[1], q[2], 0.32, 0.8, 8, { top: true, bottom: true }); }
  // the sacred cedar with its rope, red maples round the grounds
  const veg = B.acc(m.veg);
  const [cx, cz] = L.xz(-10, -14);
  const cy = gy(-10, -14);
  F.trunk(veg, cx, cy - 1, cz, 1.7, cy + 30, 0.5, PAL.bark, 7, 0.3);
  for (let q = 0; q < 5; q++) F.tier(veg, cx, cy + 14 + q * 6, cz, 7.5 - q * 1.2, 11, 9, q * 0.8, 1.0, PAL.cedar, PAL.cedarTip, q === 4 ? PAL.cedarTop : PAL.cedarTip, q === 0);
  near.col = PAL.straw;
  cylinder(near, cx, cy + 3.0, cz, 1.85, 0.35, 12);
  near.col = PAL.paper;
  for (let k = 0; k < 6; k++) { const a = k * 1.05; box(near, cx + Math.cos(a) * 1.9, cy + 2.4, cz + Math.sin(a) * 1.9, 0.16, 0.5, 0.03, -a); }
  for (const [lx, lz, h, t] of [[9, 20, 6, 0.2], [-9, 10, 5.5, 0.7], [9, -6, 7, 0.4], [-8, 28, 5, 0.9], [10, 6, 6.5, 0.1]]) {
    F.maple(veg, ...[L.xz(lx, lz)[0], gy(lx, lz), L.xz(lx, lz)[1]], h, t, PAL);
  }
}

/** A torii: two vermilion pillars, the nuki tie beam, the kasagi lintel with upswept black-capped ends. */
function torii(B, m, x, z, y, ry, s = 1) {
  const props = B.acc(m.props);
  const P = frame(x, y, z, ry);
  const half = 3.4 * s, H = 7.6 * s;
  props.col = PAL.black;
  for (const e of [-1, 1]) { const q = P(e * half, 0, 0); cylinder(props, q[0], y - 0.5, q[2], 0.5 * s, 1.0, 10); }
  props.col = PAL.vermilion;
  for (const e of [-1, 1]) { const q = P(e * half, 0, 0); cylinder(props, q[0], y, q[2], 0.42 * s, H, 10, { r2: 0.36 * s }); }
  const tie = (ly, ext, th, col) => { props.col = col; const a = P(-half - ext, ly, 0), b = P(half + ext, ly, 0); props.beam(a[0], a[1], a[2], b[0], b[1], b[2], th, th); };
  tie(H * 0.74, 0.7 * s, 0.45 * s, PAL.vermilion);
  tie(H - 0.25 * s, 1.2 * s, 0.55 * s, PAL.vermilion);
  // the kasagi: rising toward its ends, black on top
  props.col = PAL.black;
  const segs = [[-half - 2.0 * s, H + 0.55 * s], [-half, H + 0.25 * s], [0, H + 0.2 * s], [half, H + 0.25 * s], [half + 2.0 * s, H + 0.55 * s]];
  for (let k = 0; k < segs.length - 1; k++) {
    const a = P(segs[k][0], segs[k][1], 0), b = P(segs[k + 1][0], segs[k + 1][1], 0);
    props.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.75 * s, 0.38 * s);
  }
  props.col = PAL.vermilion;
  const gq = P(0, H * 0.74, 0);
  box(props, gq[0], gq[1], gq[2], 0.35 * s, H * 0.26 - 0.3 * s, 0.3 * s, ry);
  props.col = PAL.black;
  const pq = P(0, H * 0.8, 0.2 * s);
  box(props, pq[0], pq[1], pq[2], 0.9 * s, 1.1 * s, 0.12, ry);
}

// ------------------------------------------------------------------ the lookout and the route board

function lookout3d(B, m, it) {
  const { x, z, ry, y, w, d } = it;
  const L = frame(x, y, z, ry);
  const near = B.near(m.props);
  const c = [L.xz(-w / 2, -d / 2), L.xz(w / 2, -d / 2), L.xz(w / 2, d / 2), L.xz(-w / 2, d / 2)];
  drape(B.acc(m.lot), B, c, { lift: 0.05, uv: 6 });
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  const a = L.xz(-7, 5.5), b = L.xz(7, 5.5);
  railing(near, [a[0], gy(-7, 5.5), a[1]], [b[0], gy(7, 5.5), b[1]], 1.1, PAL.woodDark, 1.8, 0.1);
  for (const lx of [-3.5, 3.5]) { const q = L.xz(lx, 2.5); bench(near, q[0], gy(lx, 2.5), q[1], ry, 2.2, PAL.wood, PAL.steel); }
  // a coin binocular viewer on its post
  const vq = L.xz(0, 4.6), vy = gy(0, 4.6);
  near.col = PAL.steel;
  cylinder(near, vq[0], vy, vq[1], 0.08, 1.2, 6);
  near.col = PAL.green;
  box(near, vq[0], vy + 1.15, vq[1], 0.5, 0.32, 0.55, ry);
  // a stone lantern and the lookout's little lamp
  toro(B, m, ...L.xz(-6, -3), gy(-6, -3), ry, 0.9);
}

function routeBoard(B, m, it) {
  const y = B.groundY(it.x, it.z);
  const props = B.acc(m.props);
  props.col = PAL.steel;
  for (const o of [-0.7, 0.7]) box(props, it.x + Math.cos(it.ry) * o, y - 0.4, it.z - Math.sin(it.ry) * o, 0.1, 3.4, 0.1, it.ry);
  board(B.acc(m.signs), it.x, y + 2.6, it.z, 1.8, 1.8, it.ry, cellUV(6), cellUV(7, 4, 2, 0.02));
}

// ------------------------------------------------------------------ the pack

export default {
  id: 'kaido',
  plan,
  scatter,
  warm(B) { mats(B); },
  build,
};

export { PAL as KAIDO_PAL, toro, torii };
void THREE; void prism; void hash01; void mulc;
