// PORT HALCYON — BAYSHORE: the cliff-top coast road and the Bayshore
// Bridge. The bridge is a suspension bridge in Halcyon red: two stepped
// towers standing on caissons in the bay, main cables draped between them
// and down to concrete anchorages on the cliff and on Halcyon Point,
// hangers to a stiffening truss under the deck, lamp posts along it; at
// night the towers are floodlit, the cables strung with lights (the
// necklace you see from the city) and red lights blink on the tops. Along
// Bayshore Route: glass houses on the cliff edge, bungalows inland,
// wind-bent cypress, the Vista Point pull-off; on Cliff Road the Sea
// Breeze Motel under its neon. Hidden: Sunset Rock, down a dirt track off
// the bridge head (a lone cypress, a timber deck over the drop, the best
// view of the bridge), and the sea stacks off the cliffs below it.
import * as THREE from 'three';
import { makeRng } from '../../core/util.js';
import { U } from '../kit.js';
import { litMat, box, cylinder, drape } from './builder.js';
import { mats, cmat, C, col, frame, lbox, tube, panel, seedOf, groundStrip, coneC, windTree, chaseBulb, warmBuilders, prepareGround } from './coast/kit.js';
import { signAtlas, motelTexture } from './coast/tex.js';
import { homeMats, rockLump, stoneWall, cottage, glassHouse, car, lampPost, blob } from './coast/home.js';

const WIND = [0.92, -0.38];             // off the sea: the cypress lean inland
const RED = '#b23c26';                   // Halcyon red (the bridge)
const SODIUM = '#ffb468';

// ------------------------------------------------------------------ signs

const SIGNS = [
  { id: 'motel', w: 900, h: 250, text: 'SEA BREEZE', sub: 'M  O  T  E  L', style: 'neon', glow: '#2ae0ff', glow2: '#ff3a8a', border: '#ffd23a' },
  { id: 'vacancy', w: 560, h: 130, text: 'VACANCY', style: 'neon', glow: '#ff3a3a' },
  { id: 'office', w: 360, h: 100, text: 'OFFICE', style: 'neon', glow: '#ffd23a' },
  { id: 'tv', w: 560, h: 100, text: 'COLOR TV · POOL', style: 'neon', glow: '#7aff5a' },
  { id: 'vista', w: 760, h: 150, text: 'BAYSHORE VISTA POINT', sub: 'ELEVATION 146 FT', style: 'paint', bg: '#3a2a1d', fg: '#f2e6c8' },
  { id: 'rock', w: 520, h: 120, text: 'SUNSET ROCK', sub: 'NO RAIL · STAY BACK', style: 'paint', bg: '#5a3a24', fg: '#f4e0c0' },
  { id: 'plaque', w: 640, h: 170, text: 'BAYSHORE BRIDGE', sub: 'OPENED 1937', style: 'paint', bg: '#6a6a62', fg: '#ece6d2' },
  { id: 'coffee', w: 400, h: 100, text: 'COFFEE', style: 'neon', glow: '#ff7a2a' },
  { id: 'cliffs', w: 560, h: 120, text: 'CLIFF EDGE', sub: 'KEEP BACK FROM THE EDGE', style: 'paint', bg: '#e8c23a', fg: '#1d1d1d' },
];
const atlas = () => signAtlas('bayshore', SIGNS, 1024, 1024, 0.8);
const UV = () => atlas().uv;

/**
 * The bridge's paint, floodlit at night from below: an emissive glow of its
 * own colour that fades going up the towers.
 */
function floodMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25, envMapIntensity: 0.7 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWy = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vWy;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * uNight * (0.16 + 0.42 * clamp(1.0 - vWy / 115.0, 0.0, 1.0));');
  };
  m.customProgramCacheKey = () => 'bayshore-flood';
  m.userData.castShadow = true;
  return m;
}

function bmats(B) {
  const M = mats(B);
  Object.assign(M, homeMats(B));
  M.sign = B.mat('sign', () => { const t = atlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.35 }); });
  M.flood = cmat(B, 'flood', floodMat);
  M.motel = B.mat('motel', () => { const t = motelTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.8, envMapIntensity: 0.3 }, { night: 0.8, glow: 1.4 }); });
  return M;
}

// ------------------------------------------------------------------ the bridge model

/**
 * Where the bridge's parts are, from its road (the same for the plan and
 * the build): towers at s 200 and 800, saddles 103 m up, the main span's
 * cable sagging to 4.5 m over the deck mid-span, side spans down to the
 * anchorages (s 48 on the cliff, s 952 on the island shore).
 */
const MODEL = new WeakMap();
function bridgeModel(net) {
  const r = net.byId.get('bs_bridge');
  if (!r) return null;
  let m = MODEL.get(r);
  if (m) return m;
  const S1 = 200, S2 = 800, SA = 48, SB = 952, YS = 103, TA = 76, TB = 950;
  const deckY = (s) => r.posAt(Math.max(0, Math.min(r.length - 0.01, s))).y;
  const mid = (S1 + S2) / 2, ylow = deckY(mid) + 4.5;
  const yA = deckY(SA) + 5.5, yB = deckY(SB) + 5.5;
  const cableY = (s) => {
    if (s >= S1 && s <= S2) { const u = (s - mid) / (S2 - mid); return ylow + (YS - ylow) * u * u; }
    if (s < S1) { const t = (s - SA) / (S1 - SA); return yA + (YS - yA) * t - 20 * t * (1 - t); }
    const t = (s - S2) / (SB - S2); return YS + (yB - YS) * t - 20 * t * (1 - t);
  };
  // the cable plane: over the truss (10.2 out), spreading to the legs (13) at the towers and anchorages
  const cableLat = (s) => {
    const d = Math.min(Math.abs(s - S1), Math.abs(s - S2), Math.abs(s - SA), Math.abs(s - SB));
    return 10.2 + 2.8 * Math.max(0, 1 - d / 26);
  };
  const p0 = r.posAt(0);
  const LX = r.LX[p0.i], LZ = r.LZ[p0.i], TX = r.TX[p0.i], TZ = r.TZ[p0.i];
  const at = (s, lat, y) => {
    const p = r.posAt(Math.max(0, Math.min(r.length - 0.01, s)));
    return [p.x + LX * lat, y, p.z + LZ * lat];
  };
  m = { r, S1, S2, SA, SB, YS, TA, TB, deckY, cableY, cableLat, at, LX, LZ, TX, TZ, ry: Math.atan2(TX, TZ) };
  MODEL.set(r, m);
  return m;
}

// ------------------------------------------------------------------ the plan

export default {
  id: 'bayshore',

  plan(P) {
    const S = {};
    planBridge(P, S);
    planVista(P, S);
    planMotel(P, S);
    planRock(P, S);
    planStacks(P, S);
    planCliffHouses(P, S);
    planHouses(P, S);
    P.landmark({ id: 'bs_bridge', name: 'BAYSHORE BRIDGE', x: 2650, z: 3010, r: 120, kind: 'bridge' });
    if (S.vista) P.landmark({ id: 'bs_vista', name: 'BAYSHORE VISTA POINT', x: S.vista.x, z: S.vista.z, r: 30, kind: 'lookout' });
    if (S.motel) P.landmark({ id: 'bs_motel', name: 'SEA BREEZE MOTEL', x: S.motel.x, z: S.motel.z, r: 40, kind: 'motel' });
    if (S.rock) P.landmark({ id: 'bs_rock', name: 'SUNSET ROCK', x: S.rock.x, z: S.rock.z, r: 30, hidden: true, kind: 'lookout' });
    if (S.stacks) P.landmark({ id: 'bs_stacks', name: 'THE THREE SISTERS', x: S.stacks.x, z: S.stacks.z, r: 60, kind: 'rocks' });
  },

  scatter(S) {
    // Monterey cypress, thickest along the cliff edge; scrub; ice plant at the edge
    // (the edge tests only where the sea comes within reach of the cell)
    let sea = false;
    for (let i = 0; i <= 10 && !sea; i++) for (let j = 0; j <= 10; j++) if (!S.land(S.x0 - 32 + i * 32, S.z0 - 32 + j * 32)) { sea = true; break; }
    const nearEdge = (px, pz, d) => sea && (!S.land(px + d, pz) || !S.land(px - d, pz) || !S.land(px, pz + d) || !S.land(px, pz - d));
    for (const [x, z] of S.points(17, { r: 2.6, density: (px, pz) => (nearEdge(px, pz, 34) ? 0.6 : 0.12) + 0.35 * Math.max(0, S.noise(px / 160, pz / 160)) })) {
      const y = S.groundY(x, z);
      if (y < 20) continue;
      const h = S.range(7, 14);
      S.add({ type: 'tree', x, z, y, h, t: S.rng() });
      S.collider({ kind: 'circle', x, z, r: 0.55, y0: y - 1, y1: y + h });
    }
    for (const [x, z] of S.points(14, { r: 1.5, density: (px, pz) => 0.25 + 0.4 * Math.max(0, S.noise(px / 70 + 3, pz / 70)) })) {
      const y = S.groundY(x, z);
      if (y < 20) continue;
      S.add({ type: 'scrub', x, z, y, s: S.range(0.7, 1.4), t: S.rng() });
    }
    if (!sea) return;
    for (const [x, z] of S.points(10, { r: 1.5, test: (px, pz) => nearEdge(px, pz, 14) })) {
      const y = S.groundY(x, z);
      if (y < 20) continue;
      S.add({ type: 'iceplant', x, z, y, a: S.rng() * 3, s: S.range(2, 4.5), t: S.rng() });
    }
  },

  *warm(B) {
    const M = bmats(B), uv = UV();
    yield;
    yield* warmBuilders(B, this, BUILD, M, uv);
  },

  *build(B, items) {
    const M = bmats(B);
    const uv = UV();
    yield* prepareGround(B, items);
    let t0 = performance.now();
    for (const it of items) {
      const fn = BUILD[it.type];
      if (fn) {
        // (a big piece builds in slices: its builder yields between them)
        const r = fn(B, M, it, uv);
        if (r && r[Symbol.iterator]) { yield* r; yield; t0 = performance.now(); continue; }
      }
      if (performance.now() - t0 > 1) { yield; t0 = performance.now(); }
    }
  },
};

/** A free footprint near (x0, z0), searched in rings out to maxR; turned to face its nearest road. */
function findFree(P, x0, z0, w, d, o = {}, maxR = 40) {
  for (let r = 0; r <= maxR; r += 4) {
    const n = r ? Math.max(6, Math.round(2 * Math.PI * r / 5)) : 1;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      let ry = o.ry;
      if (ry === undefined) { const nr = P.nearestRoad(x, z, 160); ry = nr ? nr.ry : 0; }
      if (P.isFree(x, z, w, d, ry, { pad: o.pad ?? 1, roadPad: true, water: o.water })) return { x, z, ry };
    }
  }
  return null;
}

// ------------------------------------------------------------------ the bridge

function planBridge(P, S) {
  const m = bridgeModel(P.net);
  if (!m) return;
  // the towers
  for (const s of [m.S1, m.S2]) {
    const c = m.at(s, 0, 0);
    const deck = m.deckY(s);
    P.add({ type: 'btower', x: c[0], z: c[2], s, deck });
    for (const sd of [1, -1]) {
      const l = m.at(s, sd * 13, 0);
      P.collider({ kind: 'box', x: l[0], z: l[2], hx: 2.2, hz: 3.2, ry: m.ry, y0: -14, y1: m.YS });
      P.far({ x: l[0], z: l[2], y: -2, w: 4.2, d: 6, h: m.YS + 1, ry: m.ry, color: '#7a2c1e' });
      // red lights on the saddles, halfway up the legs outside
      P.lamp({ x: l[0], z: l[2], hx: l[0], hy: m.YS + 3.2, hz: l[2], color: '#ff2a1a', radius: 4, intensity: 0, halo: 2.6 });
      const o = m.at(s, sd * 15.3, 0);
      P.lamp({ x: o[0], z: o[2], hx: o[0], hy: 66, hz: o[2], color: '#ff2a1a', radius: 4, intensity: 0, halo: 1.6 });
    }
    for (const y of [m.YS - 5.5, 77]) P.far({ x: c[0], z: c[2], y, w: 26, d: 3.2, h: 3.6, ry: m.ry, color: '#7a2c1e' });
    // the floods at its foot (light the deck under the tower)
    for (const sd of [1, -1]) {
      const l = m.at(s, sd * 9, 0);
      P.lamp({ x: l[0], z: l[2], hx: l[0], hy: deck + 6, hz: l[2], color: '#ffd8b0', radius: 18, intensity: 0.9, halo: 1.2 });
    }
  }
  // the spans, a piece at a time: cables, hangers, the truss, lamp posts
  const step = 60;
  for (let s0 = m.SA - 8; s0 < m.SB + 8; s0 += step) {
    const s1 = Math.min(m.SB + 8, s0 + step);
    const c = m.at((s0 + s1) / 2, 0, 0);
    P.add({ type: 'bspan', x: c[0], z: c[2], s0, s1 });
  }
  // the deck seen from afar: the truss's band, stepping with the deck
  for (let s = m.TA; s < m.TB; s += 75) {
    const s1 = Math.min(m.TB, s + 75), c = m.at((s + s1) / 2, 0, 0);
    const y = Math.min(m.deckY(s), m.deckY(s1));
    P.far({ x: c[0], z: c[2], y: y - 6.8, w: 21, d: s1 - s, h: 7.4, ry: m.ry, color: '#6a2a1e' });
  }
  // the necklace: lights strung along both main cables (points of light from town)
  for (let s = m.SA + 10; s < m.SB - 6; s += 24) {
    for (const sd of [1, -1]) {
      const p = m.at(s, sd * m.cableLat(s), 0);
      P.lamp({ x: p[0], z: p[2], hx: p[0], hy: m.cableY(s) + 0.6, hz: p[2], color: new THREE.Color(1.5, 1.32, 1.0), radius: 3, intensity: 0, halo: 1.3 });
    }
  }
  // lamp posts along the deck, both sides, staggered
  let k = 0;
  for (let s = m.TA + 8; s < m.TB - 4; s += 45, k++) {
    if (Math.abs(s - m.S1) < 10 || Math.abs(s - m.S2) < 10) continue;
    const sd = k % 2 ? 1 : -1;
    const head = m.at(s, sd * 6.6, 0), post = m.at(s, sd * 10.2, 0);
    P.collider({ kind: 'circle', x: post[0], z: post[2], r: 0.3, y0: m.deckY(s) - 2, y1: m.deckY(s) + 10 });
    P.lamp({ x: post[0], z: post[2], hx: head[0], hy: m.deckY(s) + 9.2, hz: head[2], color: SODIUM, radius: 24, intensity: 1.0, halo: 1.8 });
  }
  // the anchorages
  for (const [s, dir] of [[m.SA, 1], [m.SB, -1]]) {
    for (const sd of [1, -1]) {
      // (14.5 out: clear of the deck's edge and its kerb of occupied ground)
      const p = m.at(s - dir * 4, sd * 14.5, 0);
      const g = P.groundRange(p[0], p[2], 9, 20, m.ry);
      P.add({ type: 'banchor', x: p[0], z: p[2], s: s - dir * 4, sd, dir, y0: Math.min(-3, g.lo - 2), top: m.deckY(s) + 6.5, plaque: sd > 0 && dir > 0 });
      P.claim(p[0], p[2], 9, 20, m.ry);
      P.collider({ kind: 'box', x: p[0], z: p[2], hx: 4.5, hz: 10, ry: m.ry, y0: g.lo - 3, y1: m.deckY(s) + 6.5 });
      P.far({ x: p[0], z: p[2], y: g.lo - 2, w: 9, d: 20, h: m.deckY(s) + 8.5 - g.lo, ry: m.ry, color: '#8a867c' });
    }
  }
  S.bridge = m;
}

// ------------------------------------------------------------------ Vista Point

function planVista(P, S) {
  // a pull-off on the sea side of Bayshore Route where the cliff comes close
  const r = P.net.byId.get('bs_r2');
  if (!r) return;
  const s = 318, half = 22;
  const p = r.posAt(s), i = p.i;
  const LX = -r.LX[i], LZ = -r.LZ[i];   // seaward is to the road's right
  const TX = r.TX[i], TZ = r.TZ[i];
  // how far out the cliff is
  let edge = 12;
  for (; edge < 120; edge += 1) if (P.groundY(p.x + LX * edge, p.z + LZ * edge) < 30) break;
  const near = r.rt.hw + r.rt.shoulder + 2.5, far = Math.max(near + 16, Math.min(edge - 4, near + 36));
  const pts = [];
  for (const [a, b] of [[-half, near], [half, near], [half, far], [-half, far]]) pts.push([p.x + TX * a + LX * b, p.z + TZ * a + LZ * b]);
  const cx = p.x + LX * (near + far) / 2, cz = p.z + LZ * (near + far) / 2;
  const ry = Math.atan2(-LX, -LZ);       // its +z faces the road
  if (!P.isFree(cx, cz, half * 2, far - near, ry, { pad: 0.5 })) return;
  P.claim(cx, cz, half * 2, far - near, ry);
  P.add({ type: 'vista', x: cx, z: cz, ry, w: half * 2, d: far - near, pts });
  // the wall along the edge
  const wl = [];
  for (let a = -half; a <= half; a += 4) wl.push([p.x + TX * a + LX * (far - 0.8), p.z + TZ * a + LZ * (far - 0.8)]);
  for (let k2 = 0; k2 < wl.length - 1; k2++) {
    const A = wl[k2], Bq = wl[k2 + 1];
    P.collider({ kind: 'box', x: (A[0] + Bq[0]) / 2, z: (A[1] + Bq[1]) / 2, hx: 2.1, hz: 0.5, ry: -Math.atan2(Bq[1] - A[1], Bq[0] - A[0]), y0: P.groundY(A[0], A[1]) - 1, y1: P.groundY(A[0], A[1]) + 1.1 });
  }
  const F = frame(cx, 0, cz, ry);
  for (const lx of [-14, 14]) {
    const q = F(lx, 0, (far - near) / 2 - 3);
    P.lamp({ x: q[0], z: q[2], hx: q[0], hy: P.groundY(q[0], q[2]) + 6.4, hz: q[2], color: '#ffd29a', radius: 18, intensity: 0.9, halo: 1.4 });
    P.collider({ kind: 'circle', x: q[0], z: q[2], r: 0.3, y0: 0, y1: 80 });
  }
  const cart = F(10, 0, -(far - near) / 2 + 9);
  P.lamp({ x: cart[0], z: cart[2], hx: cart[0], hy: P.groundY(cart[0], cart[2]) + 3, hz: cart[2], color: '#ffb070', radius: 10, intensity: 0.8, halo: 1.2 });
  P.collider({ kind: 'box', x: cart[0], z: cart[2], hx: 1.4, hz: 2.6, ry, y0: 0, y1: 80 });
  S.vista = { x: cx, z: cz };
}

// ------------------------------------------------------------------ the motel

function planMotel(P, S) {
  const f = findFree(P, 3215, 2452, 72, 46, { pad: 1 }, 60);
  if (!f) return;
  const { x, z, ry } = f;
  const g = P.groundRange(x, z, 72, 46, ry);
  const y1 = P.groundY(x, z) + 0.2;
  P.claim(x, z, 72, 46, ry);
  P.add({ type: 'motel', x, z, ry, y0: g.lo - 1, y1 });
  const F = frame(x, 0, z, ry);
  const put = (lx, lz, w, d, h) => { const q = F(lx, 0, lz); P.collider({ kind: 'box', x: q[0], z: q[2], hx: w / 2, hz: d / 2, ry, y0: g.lo - 1, y1: y1 + h }); };
  put(-27, 11, 12, 9, 5);          // the office
  put(-4, -15.5, 46, 13, 7.4);     // the rooms
  put(26.5, -3, 13, 31, 7.4);      // the side wing
  const pole = F(31, 0, 21);
  P.collider({ kind: 'circle', x: pole[0], z: pole[2], r: 0.6, y0: g.lo - 1, y1: y1 + 16 });
  for (const [lx, lz, w, d, h] of [[-27, 11, 12, 9, 5], [-4, -15.5, 46, 13, 7], [26.5, -3, 13, 31, 7]]) {
    const q = F(lx, 0, lz);
    P.far({ x: q[0], z: q[2], y: g.lo - 1, w, d, h: y1 - g.lo + 1 + h, ry, color: '#d8ccb8', lit: 0.5 });
  }
  // the neon pylon: a bright smear of pink and blue far off
  P.lamp({ x: pole[0], z: pole[2], hx: pole[0], hy: y1 + 13.5, hz: pole[2], color: '#ff4a9a', radius: 16, intensity: 0.9, halo: 3.2 });
  P.lamp({ x: pole[0], z: pole[2] + 0.1, hx: pole[0], hy: y1 + 9.4, hz: pole[2], color: '#ff3a3a', radius: 8, intensity: 0.5, halo: 1.8 });
  // the walkway lights along the rooms, lamps over the car park, the pool
  for (let lx = -24; lx <= 16; lx += 8) {
    const q = F(lx, 0, -8.6);
    P.lamp({ x: q[0], z: q[2], hx: q[0], hy: y1 + 2.8, hz: q[2], color: '#ffd8a0', radius: 6, intensity: 0.3, halo: 0.7 });
    const q2 = F(lx + 4, 0, -8.6);
    P.lamp({ x: q2[0], z: q2[2], hx: q2[0], hy: y1 + 6.0, hz: q2[2], color: '#ffd8a0', radius: 6, intensity: 0.3, halo: 0.7 });
  }
  for (const lx of [-16, 16]) {
    const q = F(lx, 0, 16);
    P.lamp({ x: q[0], z: q[2], hx: q[0], hy: y1 + 7.5, hz: q[2], color: SODIUM, radius: 18, intensity: 0.6, halo: 1.4 });
    P.collider({ kind: 'circle', x: q[0], z: q[2], r: 0.3, y0: g.lo - 1, y1: y1 + 8 });
  }
  const pool = F(-2, 0, 9.5);
  P.lamp({ x: pool[0], z: pool[2], hx: pool[0], hy: y1 + 1, hz: pool[2], color: '#4ae8e0', radius: 12, intensity: 0.8, halo: 0 });
  const off = F(-27, 0, 16);
  P.lamp({ x: off[0], z: off[2], hx: off[0], hy: y1 + 3.6, hz: off[2], color: '#ffe0a0', radius: 8, intensity: 0.45, halo: 1.0 });
  // cars nosed in at the rooms
  const rng = P.rng;
  for (let k = 0; k < 9; k++) {
    if (rng() < 0.3) continue;
    const lx = -25 + k * 5;
    const q = F(lx, 0, -5);
    P.collider({ kind: 'box', x: q[0], z: q[2], hx: 1, hz: 2.3, ry: ry + Math.PI, y0: g.lo - 1, y1: y1 + 1.6 });
    P.add({ type: 'mcar', x: q[0], z: q[2], ry: ry + Math.PI, s: rng() });
  }
  S.motel = { x, z };
}

// ------------------------------------------------------------------ Sunset Rock

function planRock(P, S) {
  const r = P.net.byId.get('bs_rock');
  if (!r) return;
  // the promontory west of the track's end: a deck over the drop, the lone cypress
  const ex = r.b.x, ez = r.b.z;
  let x = ex - 30, z = ez + 4;
  for (let d = 10; d < 80; d += 2) {
    if (P.groundY(ex - d, ez + 4) < 30) { x = ex - d + 3.5; break; }
  }
  const y = P.groundY(x + 2, z);
  const ry = -Math.PI / 2 - 0.35;
  P.add({ type: 'sunset', x, z, y, ry });
  P.claim(x, z, 14, 12, 0);
  P.collider({ kind: 'circle', x: x + 3, z: z - 4.5, r: 0.9, y0: y - 1, y1: y + 14 });
  P.collider({ kind: 'box', x: x + 3 * Math.sin(ry), z: z + 3 * Math.cos(ry), hx: 3.3, hz: 2.6, ry, y0: y - 6, y1: y + 1.2 });
  P.lamp({ x: x + 6, z: z + 3, hx: x + 6, hy: y + 2.4, hz: z + 3, color: '#ffb870', radius: 10, intensity: 0.7, halo: 1.2 });
  P.collider({ kind: 'circle', x: x + 6, z: z + 3, r: 0.25, y0: y - 1, y1: y + 3 });
  const sp = [x - 4.5 * Math.cos(ry) - 4 * Math.sin(ry), z + 4.5 * Math.sin(ry) - 4 * Math.cos(ry)];
  P.collider({ kind: 'box', x: sp[0], z: sp[1], hx: 1.4, hz: 0.2, ry, y0: y - 1, y1: y + 3 });
  // an old camper van parked at the end of the track
  const vx = ex - 13, vz = ez - 3;
  if (P.isFree(vx, vz, 3, 6, 1.2, { pad: 0.2 })) {
    P.add({ type: 'van', x: vx, z: vz, ry: 1.2 });
    P.collider({ kind: 'box', x: vx, z: vz, hx: 1.1, hz: 2.6, ry: 1.2, y0: y - 1, y1: y + 2.6 });
  }
  S.rock = { x, z };
}

function planStacks(P, S) {
  // the Three Sisters: sea stacks off the cliffs below Sunset Rock
  const at = [[3168, 3390, 26, 7.5], [3196, 3470, 18, 6], [3150, 3300, 14, 5.5]];
  for (const [x, z, h, r] of at) {
    P.add({ type: 'stack', x, z, h, r });
    P.collider({ kind: 'circle', x, z, r: r * 1.1, y0: -10, y1: h });
    P.far({ shape: 'cyl', x, z, y: -2, r: r * 0.9, r2: r * 0.5, h: h + 2, color: '#4a4440' });
  }
  S.stacks = { x: 3172, z: 3390 };
}

// ------------------------------------------------------------------ houses

function planCliffHouses(P, S) {
  // glass houses out on the cliff edge, each down its own drive off the road
  for (const id of ['bs_r1', 'bs_r2', 'bs_r3']) {
    const r = P.net.byId.get(id);
    if (!r) continue;
    const reach = r.rt.hw + r.rt.shoulder;
    for (let s = 30 + P.rng() * 20; s < r.length - 30; s += 42 + P.rng() * 40) {
      const p = r.posAt(s), i = p.i;
      const dx = -r.LX[i], dz = -r.LZ[i];      // seaward: the road's right
      let e = 0;
      for (let d = 10; d < 160; d += 2) if (P.groundY(p.x + dx * d, p.z + dz * d) < 30) { e = d; break; }
      if (!e || e < reach + 40) continue;
      // back from the edge (the plan's ground is coarse: the sea is nearer than it says)
      let x = 0, z = 0, ry = 0, ok = false;
      for (const back of [20, 25, 30]) {
        const dc = e - back;
        if (dc < reach + 16) break;
        x = p.x + dx * dc; z = p.z + dz * dc;
        ry = Math.atan2(-dx, -dz);         // its front (+z) to the road
        if (P.isFree(x, z, 19, 16, ry, { pad: 2, roadPad: true })) { ok = true; break; }
      }
      if (!ok) continue;
      const g = P.groundRange(x, z, 17, 14, ry);
      if (g.hi - g.lo > 5) continue;
      P.claim(x, z, 19, 16, ry);
      P.add({ type: 'glass', x, z, ry, w: 17, d: 13, y0: g.lo - 1, y1: g.hi + 0.3, car: P.rng() < 0.7, cliff: true });
      P.collider({ kind: 'box', x, z, hx: 8.5, hz: 7.5, ry, y0: g.lo - 1, y1: g.hi + 8 });
      P.far({ x, z, y: g.lo - 1, w: 17, d: 13, h: g.hi - g.lo + 8.4, ry, color: '#d8d4ca', lit: 0.6 });
      const fx = x - dx * 7, fz = z - dz * 7;
      P.lamp({ x: fx, z: fz, hx: fx, hy: g.hi + 2.6, hz: fz, color: '#ffd29a', radius: 9, intensity: 0.7, halo: 0.9 });
      // the drive: gravel from the road's edge to the door
      const a = [p.x + dx * (reach + 0.6), p.z + dz * (reach + 0.6)], b = [x - dx * 7, z - dz * 7];
      P.add({ type: 'drive', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, a, b });
    }
  }
}

const STUCCO = ['#efe4d0', '#e8d4b8', '#dcc8b0', '#f2ead8', '#d8dccc', '#e8d0c0'];
const TILES = ['#8a3a26', '#6a4a3a', '#4a4a46', '#7a5a3a', '#3a3e44'];

function planHouses(P, S) {
  const ids = new Set(['bs_r1', 'bs_r2', 'bs_r3', 'bs_east']);
  const lots = P.lots({ roads: (r) => ids.has(r.spec.id), width: [15, 20], depth: [12, 15], gap: [22, 70], setback: [7, 14], ends: 30, pad: 3, roadPad: true, chance: 0.62 });
  for (const L of lots) {
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    if (g.hi - g.lo > 3) continue;
    // on the sea side? (the cliff a short way behind it)
    const bx = -Math.sin(L.ry), bz = -Math.cos(L.ry);
    let sea = false;
    for (const d of [20, 35, 55]) if (P.groundY(L.x + bx * d, L.z + bz * d) < 25) sea = true;
    const it = P.add({ type: sea ? 'glass' : 'bungalow', x: L.x, z: L.z, ry: L.ry, w: L.w - 2, d: L.d - 2, y0: g.lo - 1, y1: g.hi + 0.3, tint: P.pick(STUCCO), roofC: P.pick(TILES), car: P.rng() < 0.6 });
    const h = sea ? 7.3 : 4.2;
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2 - 1, hz: L.d / 2 - 1, ry: L.ry, y0: g.lo - 1, y1: g.hi + h + 1 });
    P.far({ x: L.x, z: L.z, y: g.lo - 1, w: L.w - 2, d: L.d - 2, h: g.hi - g.lo + h + 1, ry: L.ry, color: sea ? '#d8d4ca' : it.tint, lit: sea ? 0.55 : 0.3 });
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    const lx = sea ? (L.w - 2) * 0.3 : -(L.w - 2) * 0.18, lz = (L.d - 2) / 2 + 0.5;
    const hx = L.x + lx * c + lz * s, hz = L.z - lx * s + lz * c;
    P.lamp({ x: hx, z: hz, hx, hy: g.hi + 2.6, hz, color: '#ffd29a', radius: 9, intensity: 0.7, halo: 0.9 });
    if (it.car) {
      const ox = L.w / 2 + 1.5, oz = L.d * 0.15;
      const px = L.x + ox * c + oz * s, pz = L.z - ox * s + oz * c;
      if (P.isFree(px, pz, 2.4, 5, L.ry, { pad: 0.2, roadPad: true })) {
        P.claim(px, pz, 2.4, 5, L.ry);
        P.collider({ kind: 'box', x: px, z: pz, hx: 1, hz: 2.3, ry: L.ry, y0: g.lo - 1, y1: g.hi + 1.6 });
        it.carAt = [px, pz];
      }
    }
  }
}

// ------------------------------------------------------------------ builders

const BUILD = {
  btower: tower,
  bspan: span,
  banchor: anchorage,
  vista,
  motel,
  mcar(B, M, it) { car(B, M, it.x, B.groundY(it.x, it.z), it.z, it.ry, makeRng(seedOf(it)), false); },
  sunset,
  van(B, M, it) {
    const y = B.groundY(it.x, it.z);
    const F = frame(it.x, y, it.z, it.ry);
    const pa = B.acc(M.paint), gl = B.acc(M.glow);
    col(pa, [0.05, 0.05, 0.05]);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lbox(pa, F, it.ry, a * 0.85, 0, b * 1.7, 0.28, 0.7, 0.7, {});
    col(pa, C('#e8dcc0'));
    lbox(pa, F, it.ry, 0, 0.35, 0, 2.0, 1.1, 5.0, {});
    col(pa, C('#3a8a9a'));
    lbox(pa, F, it.ry, 0, 1.45, 0, 2.0, 1.1, 5.0, {});
    col(pa, C('#f4f0e6'));
    lbox(pa, F, it.ry, 0, 2.55, 0, 1.9, 0.12, 4.6, {});
    col(gl, C('#ffc070', 0.7));
    for (const sd of [-1, 1]) lbox(gl, F, it.ry, sd * 1.01, 1.7, -0.6, 0.03, 0.45, 1.8, {});
    col(pa, C('#1d2a33'));
    lbox(pa, F, it.ry, 0, 1.5, 2.51, 1.6, 0.7, 0.03, {});
  },
  stack: seaStack,
  drive(B, M, it) {
    const dc = B.acc(M.decal);
    col(dc, C('#8a8274'));
    groundStrip(dc, B, [it.a, it.b], 3.4, 0.07, 3);
  },
  glass(B, M, it) {
    const rng = makeRng(seedOf(it));
    glassHouse(B, M, M, it, rng);
    if (it.carAt) car(B, M, it.carAt[0], B.groundY(it.carAt[0], it.carAt[1]), it.carAt[1], it.ry, rng, true);
    hedge(B, M, it, rng);
  },
  bungalow(B, M, it) {
    const rng = makeRng(seedOf(it));
    cottage(B, M, M, { ...it, floors: 1, tint: C(it.tint), roofC: C(it.roofC), roof: rng() < 0.6 ? 'hip' : 'gable', porch: rng() < 0.5, chimney: rng() < 0.5 }, rng);
    if (it.carAt) car(B, M, it.carAt[0], B.groundY(it.carAt[0], it.carAt[1]), it.carAt[1], it.ry, rng, true);
    hedge(B, M, it, rng);
  },
  tree(B, M, it) {
    const rng = makeRng(`bt${it.x.toFixed(1)},${it.z.toFixed(1)}`);
    const k = 0.8 + it.t * 0.35;
    windTree(B.acc(M.matte), B.acc(M.leaf), it.x, it.y, it.z, it.h, WIND[0], WIND[1], rng, [0.09 * k, 0.19 * k, 0.11 * k]);
  },
  scrub(B, M, it) {
    const lf = B.near(M.leaf);
    const rng = makeRng(`bs${it.x.toFixed(1)},${it.z.toFixed(1)}`);
    for (let k = 0; k < 2; k++) {
      const a = rng() * 6.28, r = rng() * 0.9 * it.s;
      col(lf, [0.2 + rng() * 0.08, 0.24 + rng() * 0.06, 0.12]);
      blob(lf, it.x + Math.cos(a) * r, it.y + 0.05, it.z + Math.sin(a) * r, (0.6 + rng() * 0.4) * it.s, 0.65, rng);
    }
  },
  iceplant(B, M, it) {
    // a mat of ice plant over the cliff top: green, flowering magenta
    const dc = B.acc(M.decal);
    const rng = makeRng(`bi${it.x.toFixed(1)},${it.z.toFixed(1)}`);
    const n = 7;
    const c = it.t < 0.35 ? [0.42, 0.16, 0.3] : [0.24, 0.34, 0.13];
    dc.col = c;
    const ctr = dc.v(it.x, B.groundY(it.x, it.z) + 0.07, it.z, 0.5, 0.5);
    const ring = [];
    for (let k = 0; k < n; k++) {
      const a = it.a + (k / n) * Math.PI * 2, r = it.s * (0.6 + rng() * 0.5);
      const px = it.x + Math.cos(a) * r, pz = it.z + Math.sin(a) * r;
      dc.col = [c[0] * 0.8, c[1] * 0.9, c[2] * 0.8];
      ring.push(dc.v(px, B.groundY(px, pz) + 0.07, pz, 0, 0));
    }
    for (let k = 0; k < n; k++) dc.tri(ctr, ring[(k + 1) % n], ring[k]);
  },
};

// ------------------------------------------------------------------ the towers

function* tower(B, M, it) {
  const m = bridgeModel(B.net);
  const fl = B.acc(M.flood), cn = B.acc(M.conc), bl = B.acc(M.blink), gl = B.acc(M.glow), pa = B.acc(M.paint);
  const { s, deck } = it;
  const ry = m.ry;
  const P0 = m.at(s, 0, 0);
  const F = frame(P0[0], 0, P0[2], ry);   // local x across the bridge (to its left), local z along it
  // the caisson: a pill of concrete in the water, a dark tide band
  col(cn, C('#b0aca2'));
  lbox(cn, F, ry, 0, -14, 0, 30, 17.5, 12, { u: 3 });
  for (const sd of [1, -1]) { const q = F(sd * 15, 0, 0); cylinder(cn, q[0], -14, q[2], 6, 17.5, 12, { top: true, u: 3 }); }
  col(pa, C('#2a2e2c'));
  lbox(pa, F, ry, 0, -0.6, 0, 30.2, 1.6, 12.2, {});
  for (const sd of [1, -1]) { const q = F(sd * 15, 0, 0); cylinder(pa, q[0], -0.6, q[2], 6.05, 1.6, 12, {}); }
  yield;
  // the legs: stepped back as they rise (Halcyon red)
  const legs = [[3.5, 30, 4.4, 6.4], [30, 58, 4.0, 5.8], [58, 84, 3.6, 5.2], [84, m.YS - 2, 3.2, 4.6]];
  col(fl, C(RED));
  for (const sd of [1, -1]) {
    for (const [y0, y1, w, d] of legs) {
      lbox(fl, F, ry, sd * 13, y0, 0, w, y1 - y0, d, { u: 4 });
      // the setback's cap, a shade darker
      col(fl, C('#8a2c1c'));
      lbox(fl, F, ry, sd * 13, y1 - 0.4, 0, w + 0.3, 0.4, d + 0.3, { u: 4 });
      col(fl, C(RED));
    }
    // the recessed panels up the legs' faces (art deco ribs)
    col(fl, C('#962f1e'));
    for (const lz of [-1.6, 1.6]) lbox(fl, F, ry, sd * 13 + sd * 2.25, 6, lz, 0.2, 22, 0.7, {});
    // the saddle house on top, the red lights
    col(fl, C('#8a2c1c'));
    lbox(fl, F, ry, sd * 13, m.YS - 2, 0, 3.6, 2.4, 5.6, {});
    const t = F(sd * 13, m.YS + 2.9, 0), tb = F(sd * 13, m.YS + 0.4, 0);
    fl.beam(tb[0], tb[1], tb[2], t[0], t[1], t[2], 0.16, 0.16);
    col(fl, C(RED));
    col(bl, C('#ff2a1a', 3));
    bl.box(t[0], t[1], t[2], 0.7, 0.7, 0.7);
    const o = F(sd * 15.3, 65.6, 0);
    bl.box(o[0], o[1], o[2], 0.5, 0.5, 0.5);
  }
  yield;
  // the portal struts: one under the deck, three over it
  const ups = [deck + Math.max(18, 56 - deck), 77, m.YS - 5.5];
  col(fl, C(RED));
  lbox(fl, F, ry, 0, deck - 10.5, 0, 24, 3.4, 3.6, { u: 4 });
  for (const y of ups) {
    lbox(fl, F, ry, 0, y, 0, 23, 3.6, 3.2, { u: 4 });
    col(fl, C('#8a2c1c'));
    for (const lx of [-6, 0, 6]) for (const lz of [1.62, -1.62]) lbox(fl, F, ry, lx, y + 0.6, lz, 3.2, 2.4, 0.1, {});
    col(fl, C(RED));
  }
  // floods at the foot of each leg (glowing housings)
  col(gl, C('#fff0d8', 2.4));
  for (const sd of [1, -1]) for (const lz of [-4, 4]) { const q = F(sd * 13, 3.6, lz); gl.box(q[0], q[1], q[2], 0.8, 0.5, 0.8); }
}

// ------------------------------------------------------------------ the spans

function* span(B, M, it) {
  const m = bridgeModel(B.net);
  const fl = B.acc(M.flood), gl = B.acc(M.glow), pa = B.acc(M.paint);
  const { s0, s1 } = it;
  // the main cables, both sides, sampled every 6 m
  col(fl, C('#a23824'));
  for (const sd of [1, -1]) {
    let prev = null;
    const a = Math.max(m.SA, s0), b = Math.min(m.SB, s1);
    for (let s = a; s <= b + 0.01; s += Math.min(6, Math.max(0.5, b - s))) {
      const p = m.at(s, sd * m.cableLat(s), m.cableY(s));
      if (prev) tube(fl, prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.42, 6);
      prev = p;
      if (s >= b) break;
    }
  }
  yield;
  // the necklace bulbs
  col(gl, C('#fff2d8', 3));
  for (let s = Math.ceil(m.SA / 12) * 12; s < s1; s += 12) {
    if (s < s0 || s > m.SB - 2) continue;
    for (const sd of [1, -1]) {
      const p = m.at(s, sd * m.cableLat(s), m.cableY(s) + 0.6);
      gl.box(p[0], p[1] - 0.2, p[2], 0.42, 0.42, 0.42);
    }
  }
  // hangers: vertical from the cable to the truss's top chord
  col(fl, C('#8a2c1c'));
  for (let s = Math.ceil(m.SA / 15) * 15; s < s1; s += 15) {
    if (s < s0 || s <= m.SA + 6 || s >= m.SB - 6) continue;
    if (Math.abs(s - m.S1) < 5 || Math.abs(s - m.S2) < 5) continue;
    const cy = m.cableY(s), dy = m.deckY(s) - 0.6;
    if (cy - dy < 1.5) continue;
    for (const sd of [1, -1]) {
      const lat = sd * m.cableLat(s);
      const top = m.at(s, lat, cy - 0.3), bot = m.at(s, sd * 10.2, dy);
      fl.beam(top[0], top[1], top[2], bot[0], bot[1], bot[2], 0.14, 0.14);
    }
  }
  yield;
  // the stiffening truss under the deck edges, floor beams across
  const ta = Math.max(m.TA, s0), tb = Math.min(m.TB, s1);
  if (tb > ta) {
    const bay = 7.5;
    col(fl, C('#9a3420'));
    for (const sd of [1, -1]) {
      const lat = sd * 10.2;
      for (let s = Math.ceil(ta / bay) * bay; s < tb; s += bay) {
        const sb = Math.min(m.TB, s + bay);
        const y0 = m.deckY(s), y1 = m.deckY(sb);
        const A = m.at(s, lat, y0 - 0.6), Bt = m.at(sb, lat, y1 - 0.6);
        const C0 = m.at(s, lat, y0 - 6.6), D = m.at(sb, lat, y1 - 6.6);
        fl.beam(A[0], A[1], A[2], Bt[0], Bt[1], Bt[2], 0.7, 0.9);
        fl.beam(C0[0], C0[1], C0[2], D[0], D[1], D[2], 0.7, 0.9);
        fl.beam(A[0], A[1], A[2], C0[0], C0[1], C0[2], 0.4, 0.4);
        const k = Math.round(s / bay) % 2;
        if (k) fl.beam(A[0], A[1], A[2], D[0], D[1], D[2], 0.35, 0.35);
        else fl.beam(C0[0], C0[1], C0[2], Bt[0], Bt[1], Bt[2], 0.35, 0.35);
        // the outrigger out to the deck's edge, the floor beam across under it
        const E = m.at(s, sd * 8.4, y0 - 0.6);
        fl.beam(A[0], A[1], A[2], E[0], E[1], E[2], 0.5, 0.5);
        if (sd > 0 && Math.round(s / bay) % 2 === 0) {
          const X0 = m.at(s, 10.2, y0 - 6.6), X1 = m.at(s, -10.2, y0 - 6.6);
          fl.beam(X0[0], X0[1], X0[2], X1[0], X1[1], X1[2], 0.6, 0.8);
        }
      }
    }
  }
  yield;
  // lamp posts on the truss, their heads out over the lanes
  let k = 0;
  for (let s = m.TA + 8; s < m.TB - 4; s += 45, k++) {
    if (s < s0 || s >= s1) continue;
    if (Math.abs(s - m.S1) < 10 || Math.abs(s - m.S2) < 10) continue;
    const sd = k % 2 ? 1 : -1;
    const y = m.deckY(s);
    const p = m.at(s, sd * 10.2, y - 0.6), top = m.at(s, sd * 10.2, y + 9.6), head = m.at(s, sd * 6.6, y + 9.4);
    col(pa, C('#3a3a3e'));
    tube(pa, p[0], p[1], p[2], top[0], top[1], top[2], 0.13, 6, 0.09);
    pa.beam(top[0], top[1], top[2], head[0], head[1], head[2], 0.14, 0.14);
    col(gl, C('#ffd0a0', 2.6));
    gl.box(head[0], head[1] - 0.35, head[2], 0.7, 0.3, 0.45);
  }
}

function anchorage(B, M, it, uv) {
  const m = bridgeModel(B.net);
  const cn = B.acc(M.conc), fl = B.acc(M.flood), gl = B.acc(M.glow);
  const { x, z, y0, top, sd, dir } = it;
  const ry = m.ry;
  // a stepped block of concrete with grooved bands, the cable going in at its top
  col(cn, C('#b8b2a4'));
  box(cn, x, y0, z, 9, top - y0, 20, ry, { u: 3 });
  col(cn, C('#a8a294'));
  box(cn, x, top, z, 7.4, 1.4, 17, ry, { u: 3 });
  col(cn, C('#8a8478'));
  for (const h of [3, 6]) box(cn, x, top - h, z, 9.15, 0.35, 20.15, ry, { u: 3 });
  // the saddle where the cable splays into the block
  col(fl, C(RED));
  const F = frame(x, 0, z, ry);
  const q = F(-1.5 * sd, top + 1.4, dir * 7);
  box(fl, q[0], q[1], q[2], 2.6, 1.6, 4, ry, {});
  col(gl, C('#fff0d8', 2.2));
  const lamp = F(sd * 4.8, top - 1, dir * 9.5);
  gl.box(lamp[0], lamp[1], lamp[2], 0.6, 0.6, 0.6);
  if (it.plaque) panel(B.acc(M.sign), ...F(-4.56, top - 4.5, 0), 4.4, 4.4 * 170 / 640, ry - Math.PI / 2, uv.plaque, false);
}

// ------------------------------------------------------------------ Vista Point

function vista(B, M, it, uv) {
  const { x, z, ry, w, d, pts } = it;
  const rng = makeRng(seedOf(it));
  const dc = B.acc(M.decal), pa = B.acc(M.paint), gl = B.acc(M.glow), wd = B.acc(M.wood), rk = B.acc(M.rock);
  col(dc, C('#3c3d40'));
  drape(dc, B, pts, { lift: 0.06, step: 4, uv: 8 });
  const F = frame(x, 0, z, ry);
  // bays painted on the road side
  col(dc, C('#e8e6dc'));
  for (let lx = -w / 2 + 4; lx <= w / 2 - 14; lx += 3) {
    const a = F(lx, 0, d / 2 - 0.5), b = F(lx, 0, d / 2 - 5.5);
    groundStrip(dc, B, [[a[0], a[2]], [b[0], b[2]]], 0.12, 0.09, 6);
  }
  // the wall along the edge
  const wl = [];
  for (let lx = -w / 2; lx <= w / 2 + 0.1; lx += 4) { const p = F(lx, 0, -d / 2 + 0.8); wl.push([p[0], p[2]]); }
  stoneWall(rk, B, wl, 0.9, 0.7, rng, [0.6, 0.56, 0.5]);
  // binoculars, benches, the board, a bin
  for (const lx of [-6, 4]) {
    const p = F(lx, 0, -d / 2 + 2.2);
    const y = B.groundY(p[0], p[2]);
    col(pa, C('#2a5a3a'));
    tube(pa, p[0], y - 0.2, p[2], p[0], y + 1.2, p[2], 0.08, 6);
    lbox(pa, F, ry, lx, y + 1.2, -d / 2 + 2.2, 0.5, 0.4, 0.7, {}, 0);
    col(pa, C('#c8c4bc'));
    const e = F(lx, y + 1.4, -d / 2 + 2.65);
    pa.box(e[0], e[1] - 0.12, e[2], 0.45, 0.24, 0.2, ry);
  }
  for (const lx of [-15, -1, 10]) {
    const p = F(lx, 0, -d / 2 + 3.6);
    const y = B.groundY(p[0], p[2]);
    col(wd, C('#8a7a66'));
    box(wd, ...F(lx, y + 0.45, -d / 2 + 3.4), 2.2, 0.08, 0.5, ry, { u: 1 });
    box(wd, ...F(lx, y + 0.5, -d / 2 + 3.7), 2.2, 0.5, 0.06, ry, { u: 1 });
    col(pa, C('#2a2a2e'));
    for (const o of [-0.9, 0.9]) lbox(pa, F, ry, lx + o, y, -d / 2 + 3.6, 0.08, 0.45, 0.45, {}, 0);
  }
  const bp = F(-10, 0, -d / 2 + 5.2);
  const by = B.groundY(bp[0], bp[2]);
  col(wd, C('#5a4a3a'));
  for (const o of [-1.6, 1.6]) box(wd, ...F(-10 + o, by - 0.3, -d / 2 + 5.2), 0.2, 2.8, 0.2, ry, { u: 1 });
  panel(B.acc(M.sign), bp[0], by + 1.8, bp[2], 3.6, 3.6 * 150 / 760, ry, uv.vista, true);
  // lamp posts
  for (const lx of [-14, 14]) {
    const q = F(lx, 0, d / 2 - 3);
    const y = B.groundY(q[0], q[2]);
    col(pa, C('#2a2c30'));
    tube(pa, q[0], y - 0.3, q[2], q[0], y + 6.5, q[2], 0.1, 6, 0.08);
    col(gl, C('#ffd29a', 2.6));
    gl.box(q[0], y + 6.1, q[2], 0.55, 0.5, 0.55);
  }
  // the coffee cart, lit, a couple of parked cars
  const cp = F(10, 0, -d / 2 + 9);
  const cy = B.groundY(cp[0], cp[2]);
  col(pa, C('#e8e2d0'));
  box(pa, cp[0], cy + 0.35, cp[2], 2.4, 2.2, 4.6, ry, {});
  col(pa, C('#3a6a5a'));
  box(pa, cp[0], cy + 2.55, cp[2], 2.6, 0.2, 4.8, ry, {});
  col(gl, C('#ffd8a0', 1.8));
  lbox(gl, F, ry, 10 + 1.22, cy + 1.1, -d / 2 + 9, 0.04, 0.9, 3, {}, 0);
  col(pa, [0.05, 0.05, 0.05]);
  for (const o of [-1.4, 1.4]) lbox(pa, F, ry, 10 + o * 0.7, cy, -d / 2 + 9 + o, 0.3, 0.6, 0.6, {}, 0);
  panel(B.acc(M.sign), ...F(10 + 1.25, cy + 2.95, -d / 2 + 9), 2, 0.5, ry + Math.PI / 2, uv.coffee, true);
  for (const lx of [-17, -11]) {
    const p = F(lx, 0, d / 2 - 3);
    car(B, M, p[0], B.groundY(p[0], p[2]), p[2], ry + Math.PI, rng, false);
  }
}

// ------------------------------------------------------------------ the motel

function* motel(B, M, it, uv) {
  const { x, z, ry, y1 } = it;
  const rng = makeRng(seedOf(it));
  const F = frame(x, y1, z, ry);
  const pa = B.acc(M.paint), mo = B.acc(M.motel), cn = B.acc(M.conc), gl = B.acc(M.glow), ch = B.acc(M.chase), sg = B.acc(M.sign), dc = B.acc(M.decal), rf = B.acc(M.matte);
  // the car park
  col(dc, C('#38393c'));
  const lot = [[-36, 22], [36, 22], [36, -7], [-36, -7]].map(([a, b]) => { const p = F(a, 0, b); return [p[0], p[2]]; });
  drape(dc, B, lot, { lift: 0.06, step: 4, uv: 8 });
  col(dc, C('#e8e6dc'));
  for (let lx = -27.5; lx <= 20; lx += 5) { const a = F(lx, 0, -7), b = F(lx, 0, -2); groundStrip(dc, B, [[a[0], a[2]], [b[0], b[2]]], 0.12, 0.09, 6); }
  const wing = (cx, cz, w, d, rot) => {
    // two storeys of rooms (the texture's doors and windows on the front, local +z of the wing)
    const R = ry + rot;
    const q = F(cx, 0, cz);
    col(cn, C('#a8a294'));
    box(cn, q[0], it.y0, q[2], w + 0.3, y1 - it.y0, d + 0.3, R, { u: 2 });
    col(mo, C('#e2d6c0'));
    box(mo, q[0], y1, q[2], w, 6.4, d, R, { u: 16, v: 3.2, top: false });
    col(pa, C('#3a6a7a'));
    box(pa, q[0], y1 + 6.4, q[2], w + 1.4, 0.5, d + 3.4, R, {});
    // the walkway along the upper rooms, its rail; posts down to the ground
    const G = frame(q[0], y1, q[2], R);
    col(cn, C('#c8c2b4'));
    lbox(cn, G, R, 0, 3.0, d / 2 + 1.2, w, 0.25, 2.4, { u: 2 });
    col(pa, C('#f2efe6'));
    for (let lx = -w / 2 + 0.5; lx <= w / 2; lx += 4) lbox(pa, G, R, lx, 0, d / 2 + 2.3, 0.18, 6.4, 0.18, {});
    const ra = G(-w / 2, 4.05, d / 2 + 2.35), rb = G(w / 2, 4.05, d / 2 + 2.35);
    pa.beam(ra[0], ra[1], ra[2], rb[0], rb[1], rb[2], 0.08, 0.08);
    const rc = G(-w / 2, 3.65, d / 2 + 2.35), rd = G(w / 2, 3.65, d / 2 + 2.35);
    pa.beam(rc[0], rc[1], rc[2], rd[0], rd[1], rd[2], 0.05, 0.05);
    // lights over the doors along both floors
    col(gl, C('#ffe0a8', 2.2));
    for (let lx = -w / 2 + 2; lx < w / 2; lx += 4) for (const y of [2.5, 5.7]) { const p = G(lx - 1.1, y, d / 2 + 0.1); gl.box(p[0], p[1], p[2], 0.25, 0.25, 0.15); }
    // stairs up at the end
    col(cn, C('#c8c2b4'));
    for (let k = 0; k < 10; k++) lbox(cn, G, R, -w / 2 - 4.0 + k * 0.35, k * 0.3, d / 2 + 1.2, 0.4, 0.25, 1.4, {});
  };
  yield;
  wing(-4, -15.5, 46, 11, 0);
  yield;
  // the side wing faces the courtyard (turned to face local -x)
  {
    const R = ry - Math.PI / 2;
    const q = F(26.5, 0, -3);
    col(cn, C('#a8a294'));
    box(cn, q[0], it.y0, q[2], 11.3, y1 - it.y0, 31.3, ry, { u: 2 });
    col(mo, C('#e2d6c0'));
    box(mo, q[0], y1, q[2], 11, 6.4, 31, ry, { u: 16, v: 3.2, top: false });
    col(pa, C('#3a6a7a'));
    box(pa, q[0], y1 + 6.4, q[2], 14.4, 0.5, 32.4, ry, {});
    const G = frame(q[0], y1, q[2], R);
    col(cn, C('#c8c2b4'));
    lbox(cn, G, R, 0, 3.0, 5.5 + 1.2, 31, 0.25, 2.4, { u: 2 });
    col(pa, C('#f2efe6'));
    for (let lx = -15; lx <= 15.5; lx += 4) lbox(pa, G, R, lx, 0, 5.5 + 2.3, 0.18, 6.4, 0.18, {});
    const ra = G(-15.5, 4.05, 7.85), rb = G(15.5, 4.05, 7.85);
    pa.beam(ra[0], ra[1], ra[2], rb[0], rb[1], rb[2], 0.08, 0.08);
    col(gl, C('#ffe0a8', 2.2));
    for (let lx = -13.5; lx < 15.5; lx += 4) for (const y of [2.5, 5.7]) { const p = G(lx - 1.1, y, 5.6); gl.box(p[0], p[1], p[2], 0.25, 0.25, 0.15); }
  }
  yield;
  // the office: big windows, a canted roof, its neon
  const op = F(-27, 0, 11);
  col(cn, C('#a8a294'));
  box(cn, op[0], it.y0, op[2], 12.3, y1 - it.y0, 9.3, ry, { u: 2 });
  col(pa, C('#e8dcc4'));
  box(pa, op[0], y1, op[2], 12, 3.8, 9, ry, {});
  col(gl, C('#fff0d0', 1.8));
  lbox(gl, F, ry, -27, 0.5, 15.53, 9, 2.4, 0.05, {});
  col(pa, C('#3a6a7a'));
  const cr = [F(-33.6, 3.8, 16.8), F(-20.4, 3.8, 16.8), F(-20.4, 5.2, 6.2), F(-33.6, 5.2, 6.2)];
  pa.quadP(cr[0], cr[1], cr[2], cr[3]);
  pa.quadP(cr[1], cr[0], cr[3], cr[2]);
  panel(sg, ...F(-27, 3.4, 16.9), 3.2, 0.9, ry, uv.office, false);
  // the pool, glowing, its deck and a fence
  const pp = F(-2, 0, 9.5);
  const py = B.groundY(pp[0], pp[2]);
  col(cn, C('#d8d2c4'));
  box(cn, pp[0], py - 0.3, pp[2], 18, 0.4, 10, ry, { u: 2 });
  col(gl, C('#3ae0d8', 1.1));
  const pw = [F(-9, 0, 6), F(5, 0, 6), F(5, 0, 13), F(-9, 0, 13)].map((p) => [p[0], py + 0.12, p[2]]);
  gl.quadP(pw[3], pw[2], pw[1], pw[0]);
  col(rf, C('#f4f0e6'));
  for (let k = 0; k < 3; k++) { const p = F(-7 + k * 5, 0, 5.2); coneC(rf, p[0], py + 1.9, p[2], 1.3, 0.5, 8); rf.box(p[0], py + 0.1, p[2], 0.06, 1.85, 0.06); }
  yield;
  // the pylon: a tall pole, the big neon board, the arrow chasing, VACANCY
  const pl = F(31, 0, 21);
  const ly = B.groundY(pl[0], pl[2]);
  col(pa, C('#e8e4dc'));
  tube(pa, pl[0], ly - 0.5, pl[2], pl[0], ly + 12.2, pl[2], 0.35, 8, 0.3);
  const Fs = frame(pl[0], ly, pl[2], ry);
  col(pa, C('#1d2a3a'));
  lbox(pa, Fs, ry, -2.6, 10.6, 0, 8.6, 3.6, 0.6, {});
  panel(sg, ...Fs(-2.6, 12.4, 0.31), 8.2, 8.2 * 250 / 900, ry, uv.motel, false);
  panel(sg, ...Fs(-2.6, 12.4, -0.31), 8.2, 8.2 * 250 / 900, ry + Math.PI, uv.motel, false);
  col(pa, C('#1d2a3a'));
  lbox(pa, Fs, ry, -1.2, 7.6, 0, 5.2, 1.6, 0.4, {});
  panel(sg, ...Fs(-1.2, 8.4, 0.21), 5, 5 * 130 / 560, ry, uv.vacancy, false);
  panel(sg, ...Fs(-1.2, 8.4, -0.21), 5, 5 * 130 / 560, ry + Math.PI, uv.vacancy, false);
  // the arrow: chasing bulbs round its outline, pointing in
  const arrow = [[3.4, 12.6], [1.6, 11.2], [1.6, 11.9], [-1, 11.9], [-1, 13.3], [1.6, 13.3], [1.6, 14.0]];
  let kb = 0;
  for (let i = 0; i < arrow.length; i++) {
    const a = arrow[i], b = arrow[(i + 1) % arrow.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / 0.45));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      for (const sz of [0.36, -0.36]) {
        const p = Fs(4.3 + a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 0.6, sz);
        chaseBulb(ch, p[0], p[1], p[2], 0.22, C(kb % 2 ? '#ffd23a' : '#ff8a2a', 3.2), kb);
      }
      kb++;
    }
  }
  col(pa, C('#1d2a3a'));
  lbox(pa, Fs, ry, 5.6, 10.7, 0, 5.2, 3.1, 0.5, {});
  // the soda and ice machines glowing under the stairs
  col(gl, C('#ff3a2a', 1.4));
  lbox(gl, F, ry, -28.6, 0, -13.2, 0.8, 1.9, 1.0, {});
  col(gl, C('#e8f4ff', 1.3));
  lbox(gl, F, ry, -28.6, 0, -14.6, 0.8, 1.7, 1.0, {});
  panel(sg, ...F(-4, 7.2, -9.0), 6, 6 * 100 / 560, ry, uv.tv, false);
  void rng;
}

// ------------------------------------------------------------------ Sunset Rock

function sunset(B, M, it, uv) {
  const { x, z, y, ry } = it;
  const rng = makeRng(seedOf(it));
  const F = frame(x, y, z, ry);
  const wd = B.acc(M.wood), pa = B.acc(M.paint), rk = B.acc(M.rock), gl = B.acc(M.glow);
  // the rock: a knuckle of stone at the edge
  for (let k = 0; k < 7; k++) {
    const a = rng() * Math.PI * 2, r = 3 + rng() * 6;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const s = 1.4 + rng() * 2.2;
    rockLump(rk, px, B.groundY(px, pz), pz, s * 1.2, s * 0.7, s, rng, rng() * 6, [0.58, 0.52, 0.44]);
  }
  // the lone cypress, bent flat by the wind
  windTree(B.acc(M.matte), B.acc(M.leaf), x + 3, B.groundY(x + 3, z - 4.5), z - 4.5, 13, WIND[0], WIND[1], rng, [0.08, 0.17, 0.1]);
  // the deck out over the drop (local +z toward the sea), its rail, a bench
  col(wd, C('#8a7a64'));
  lbox(wd, F, ry, 0, 0.0, 3, 6.4, 0.25, 5, { u: 2 });
  col(pa, C('#4a3a2a'));
  for (const [a, b] of [[-3, 0.8], [3, 0.8], [-3, 5.3], [3, 5.3]]) lbox(pa, F, ry, a, -4, b, 0.25, 4.1, 0.25, {});
  col(wd, C('#7a6a56'));
  for (const [a0, b0, a1, b1] of [[-3.1, 5.4, 3.1, 5.4], [-3.1, 0.6, -3.1, 5.4], [3.1, 0.6, 3.1, 5.4]]) {
    const A = F(a0, 1.05, b0), Bq = F(a1, 1.05, b1);
    wd.beam(A[0], A[1], A[2], Bq[0], Bq[1], Bq[2], 0.12, 0.12);
    for (let t = 0; t <= 1.001; t += 0.25) { const P0 = F(a0 + (a1 - a0) * t, 0.2, b0 + (b1 - b0) * t); wd.box(P0[0], P0[1], P0[2], 0.1, 0.9, 0.1); }
  }
  col(wd, C('#9a8a74'));
  lbox(wd, F, ry, 0, 0.6, 1.4, 2.2, 0.08, 0.5, { u: 1 });
  lbox(wd, F, ry, 0, 0.65, 1.15, 2.2, 0.5, 0.06, { u: 1 });
  // the telescope, the sign, a lantern on a post
  col(pa, C('#3a3a3e'));
  const tp = F(2.2, 0.25, 4.6);
  tube(pa, tp[0], tp[1], tp[2], tp[0], tp[1] + 1.2, tp[2], 0.06, 5);
  const ta = F(2.0, 1.5, 4.3), tb = F(2.4, 1.65, 5.1);
  tube(pa, ta[0], ta[1], ta[2], tb[0], tb[1], tb[2], 0.09, 6, 0.12);
  const sp = F(-4.5, 0, -4);
  const sy = B.groundY(sp[0], sp[2]);
  col(pa, C('#3a2e24'));
  pa.box(sp[0], sy - 0.3, sp[2], 0.14, 2.4, 0.14);
  panel(B.acc(M.sign), sp[0], sy + 1.9, sp[2], 2.6, 2.6 * 120 / 520, ry + Math.PI, uv.rock, true);
  const lp = [x + 6, B.groundY(x + 6, z + 3), z + 3];
  lampPost(pa, gl, lp[0], lp[1], lp[2], 2.2, '#ffb870', '#2a2420');
}

function seaStack(B, M, it) {
  const rng = makeRng(seedOf(it));
  const rk = B.acc(M.rock);
  const { x, z, h, r } = it;
  let y = -3, rr = r;
  while (y < h - 2) {
    const sy = 3 + rng() * 3;
    const ox = (rng() - 0.5) * r * 0.25, oz = (rng() - 0.5) * r * 0.25;
    rockLump(rk, x + ox, y + sy * 0.6, z + oz, rr * (0.9 + rng() * 0.2), sy, rr * (0.85 + rng() * 0.2), rng, rng() * 6, y < 2 ? [0.3, 0.29, 0.27] : [0.46, 0.42, 0.38]);
    y += sy * 0.75;
    rr *= 0.9;
  }
  // a cap of scrub and guano
  col(rk, [0.86, 0.84, 0.78]);
  rockLump(rk, x, h - 0.6, z, rr * 0.9, 1.2, rr * 0.8, rng, 0, [0.82, 0.8, 0.74]);
}

// ------------------------------------------------------------------ gardens

function hedge(B, M, it, rng) {
  // a low hedge or planting along the front, a path to the door
  const lf = B.near(M.leaf);
  const F = frame(it.x, 0, it.z, it.ry);
  for (let k = 0; k < 6; k++) {
    const p = F(-it.w / 2 + (k + 0.5) * it.w / 6, 0, it.d / 2 + 2.6 + rng());
    col(lf, [0.12 + rng() * 0.06, 0.24 + rng() * 0.08, 0.1]);
    blob(lf, p[0], B.groundY(p[0], p[2]) + 0.2, p[2], 0.9 + rng() * 0.5, 0.75, rng);
  }
}

export { bridgeModel };
