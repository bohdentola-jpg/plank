// PORT HALCYON — RED ROCK CANYON. A gorge of red sandstone: Canyon Rd along
// the floor between walls stepped in chunky layered ledges (deep red at the
// foot, orange, cream caprock), the Rim Rd round the top. THE RED ARCH spans
// the canyon road, floodlit from its feet at night; hoodoo spires stand in
// clusters (THE CHIMNEYS) on the floor and the rim; balanced rocks; junipers,
// sage, yucca and prickly pear; tumbled red boulders. A campground on the
// floor with its fires burning; the Arch Overlook on the rim. Up the Dutchman
// Rd, under the mesa west of Route 99, the old LOST DUTCHMAN MINE (hidden):
// a timbered adit, ore carts on rails out to the tailings, a lantern lit.
import { box, cylinder, cone, drape, gable } from './builder.js';
import { MAT, paint, paintMix, obox, panel, hcyl, drum, blob, clock, reachOf, hash1, TAU, sstep } from './desertkit/kit.js';
import { uvOf, RS } from './desertkit/tex.js';
import { roadSign, floodlight, car, drumBarrel, crate, picnic, stringLights, animUV, lampPost } from './desertkit/props.js';
import { hoodoo, balancedRock, boulder, SAND } from './desertkit/rocks.js';
import { cellGround, seedOf, buildScatter, shrubs, lowest } from './desertkit/scatter.js';
import { site, facing, local } from './desertkit/place.js';

const lotMat = (B) => MAT.lot(B);
const BAND = 7;      // m per strata band on the canyon walls
const BAND_TONES = ['#9a3e26', '#a8492c', '#b8583a', '#c46a40', '#a8492c', '#d08850', '#b46448', '#c9a074', '#9a3e26', '#b8583a', '#d8b088', '#c46a40'];

export default {
  id: 'redrock',

  plan(P) {
    const floor = P.net.byId.get('rr_floor');
    if (floor) arch(P, floor);
    chimneys(P);
    balanced(P);
    if (floor) camp(P, floor);
    overlook(P);
    mine(P);
    parkSigns(P);
  },

  scatter(S) {
    const G = cellGround(S);
    const nz = (x, z, f) => 0.5 + 0.5 * S.noise(x / f, z / f);
    // the walls: chunky layered ledges, their tops on the band lines, coloured by band
    for (const [x, z] of S.points(8, { r: 2, roadPad: true, jitter: 0.7 })) {
      const sl = G.slope(x, z);
      if (sl.g < 0.55) continue;
      const y = G.h(x, z);
      const k = Math.floor(y / BAND);
      const top = (k + 1) * BAND + (S.rng() - 0.5) * 0.8;
      const h = top - y + BAND * S.range(0.9, 1.6);
      S.add({ type: 'ledge', x, z, y: top - h * 0.4, ry: Math.atan2(sl.dx, sl.dz), w: S.range(8, 14), h, d: S.range(5, 9), tone: BAND_TONES[((k % BAND_TONES.length) + BAND_TONES.length) % BAND_TONES.length], k: S.range(0.9, 1.08) });
    }
    // junipers (in stands), the odd dead one
    for (const [x, z] of S.points(24, { r: 3, density: (x, z) => sstep(0.3, 0.8, nz(x, z, 180)) * 0.9 })) {
      if (G.slope(x, z).g > 0.4) continue;
      const y = G.h(x, z), s = S.range(0.7, 1.4);
      const dead = S.rng() < 0.08;
      S.add({ type: 'plant', kind: dead ? 'dead' : 'juniper', x, z, y, s, seed: seedOf(S) });
      S.collider({ kind: 'circle', x, z, r: 0.35 * s, y0: y - 1, y1: y + 4 });
    }
    // little hoodoos and spires on the flats near the rims
    for (const [x, z] of S.points(70, { r: 5 })) {
      if (S.rng() > 0.35 || G.slope(x, z).g > 0.25) continue;
      const y = G.h(x, z), h = S.range(5, 12);
      S.add({ type: 'spire', x, z, y, h, r: S.range(1.2, 2.2), seed: seedOf(S) });
      S.collider({ kind: 'circle', x, z, r: 1.8, y0: y - 1, y1: y + h });
    }
    shrubs(S, 11, (x, z) => 0.3 + 0.4 * nz(x, z, 80), [[3, 50], [1, 25], [2, 25]], { maxSlope: 0.5, tint: '#f4e8dc' });
    for (const [x, z] of S.points(30, { r: 1.5, density: () => 0.5 })) {
      if (G.slope(x, z).g > 0.4) continue;
      S.add({ type: 'plant', kind: S.rng() < 0.5 ? 'yucca' : 'pear', x, z, y: G.h(x, z), s: S.range(0.8, 1.3), seed: seedOf(S) });
    }
    // red boulders, tumbled thickest at the foot of the walls
    for (const [x, z] of S.points(22, { r: 3 })) {
      const sl = G.slope(x, z).g;
      if (S.rng() > (sl > 0.2 && sl < 0.55 ? 0.8 : 0.25)) continue;
      const s = S.range(0.6, 2.8), y = lowest(G, x, z, s);
      S.add({ type: 'rock', x, z, y, s, seed: seedOf(S), color: S.pick(['#9a4a2c', '#a85a3a', '#8a3e26', '#b0643e']) });
      if (s > 1.1) S.collider({ kind: 'circle', x, z, r: s * 0.9, y0: y - 1, y1: y + s * 1.2 });
    }
  },

  warm(B) {
    for (const k of ['paint', 'metal', 'rock', 'strata', 'plant', 'foliage', 'roadsigns', 'neon', 'glass', 'lights', 'wood', 'tin', 'hole', 'lot']) MAT[k](B);
  },

  *build(B, items) {
    const tick = clock(3);
    for (const it of items) {
      if (buildScatter(B, it)) { if (tick()) yield; continue; }
      switch (it.type) {
        case 'spire': spire(B, it); break;
        case 'arch': yield* buildArch(B, it); break;
        case 'hoodoo': hoodoo(B.acc(MAT.strata(B)), it.x, B.groundY(it.x, it.z), it.z, it.h, it.r, it.seed); break;
        case 'balanced': balancedRock(B.acc(MAT.strata(B)), B.acc(MAT.rock(B)), it.x, B.groundY(it.x, it.z), it.z, it.s, it.seed); break;
        case 'camp': yield* buildCamp(B, it); break;
        case 'overlook': buildOverlook(B, it); break;
        case 'mine': yield* buildMine(B, it); break;
        case 'sign': roadSign(B, it.x, B.groundY(it.x, it.z), it.z, it.ry, it.kind, it.o || {}); break;
        case 'gate': parkGate(B, it); break;
        default: break;
      }
      if (tick()) yield;
    }
  },
};

// ================================================================== planning

/** THE RED ARCH: spans Canyon Rd near the canyon's bend, its legs either side of the road. */
function arch(P, r) {
  // the road sample nearest the arch's spot
  let best = 0, bd = Infinity;
  for (let i = 0; i < r.N; i++) { const d = (r.X[i] - 4660) ** 2 + (r.Z[i] + 1838) ** 2; if (d < bd) { bd = d; best = i; } }
  const i = best;
  const x = r.X[i], z = r.Z[i];
  const ry = Math.atan2(r.TX[i], r.TZ[i]);      // local z along the road, local x across it
  const span = 25;
  const y = r.Y[i];
  const it = P.add({ type: 'arch', x, z, ry, span, y, map: 'park' });
  const lx = r.LX[i], lz = r.LZ[i];
  for (const sd of [1, -1]) {
    const cx = x + lx * sd * (span + 3.5), cz = z + lz * sd * (span + 3.5);
    P.claim(cx, cz, 14, 15, ry);
    P.collider({ kind: 'box', x: cx, z: cz, hx: 6.5, hz: 7, ry, y0: y - 3, y1: y + 40 });
    P.far({ shape: 'box', x: cx, z: cz, y: y - 2, w: 11, d: 12, h: 26, ry, color: '#a8492c' });
    // floodlights at its feet, up at the arch
    for (const k of [-6, 6]) {
      const fx = x + lx * sd * (span - 6) + r.TX[i] * k, fz = z + lz * sd * (span - 6) + r.TZ[i] * k;
      P.lamp({ x: fx, z: fz, hx: fx, hz: fz, hy: y + 0.9, color: '#ffb070', radius: 32, intensity: 0.6, halo: 1.3 });
    }
  }
  P.far({ shape: 'box', x, z, y: y + 26, w: span * 2 + 12, d: 10, h: 12, ry: ry + Math.PI / 2, color: '#b8583a' });
  P.landmark({ id: 'red_arch', name: 'THE RED ARCH', x, z, r: 40, kind: 'arch' });
  void it;
}

/** THE CHIMNEYS: clusters of hoodoos on the canyon floor and the rim. */
function chimneys(P) {
  const spots = [[4420, -1745, 9, 38], [4520, -1960, 12, 46], [5090, -1690, 8, 34], [4980, -2120, 10, 50], [4130, -1520, 7, 30]];
  for (const [cx, cz, n, rad] of spots) {
    let made = 0;
    for (let k = 0; k < n * 3 && made < n; k++) {
      const a = P.rng() * TAU, d = Math.sqrt(P.rng()) * rad;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const r = P.range(2.2, 4.2), h = P.range(14, 32);
      if (!P.isFree(x, z, r * 2.6, r * 2.6, 0, { anywhere: true, roadPad: true })) continue;
      const g = P.groundRange(x, z, r * 2, r * 2, 0);
      if (g.hi - g.lo > 3) continue;
      P.claim(x, z, r * 2.4, r * 2.4, 0);
      P.add({ type: 'hoodoo', x, z, h, r, seed: Math.floor(P.rng() * 1e6) });
      P.collider({ kind: 'circle', x, z, r: r * 1.15, y0: g.lo - 2, y1: g.lo + h });
      P.far({ shape: 'cyl', x, z, y: g.lo - 1, r: r * 0.9, r2: r * 0.6, h: h * 0.9, color: SAND[made % SAND.length] });
      made++;
    }
  }
}

function balanced(P) {
  for (const [x, z, s] of [[4300, -1700, 1.25], [4820, -2060, 1.0], [5180, -1560, 0.9], [4040, -1880, 0.85]]) {
    if (!P.isFree(x, z, 10 * s, 10 * s, 0, { anywhere: true, roadPad: true })) continue;
    const y = P.groundY(x, z);
    P.claim(x, z, 9 * s, 9 * s, 0);
    P.add({ type: 'balanced', x, z, s, seed: Math.floor(P.rng() * 1e6) });
    P.collider({ kind: 'circle', x, z, r: 2.6 * s, y0: y - 2, y1: y + 12 * s });
    P.far({ shape: 'cyl', x, z, y: y - 1, r: 1.6 * s, h: 6 * s, color: '#b8583a' });
    P.far({ shape: 'cyl', x, z, y: y + 5 * s, r: 3.1 * s, h: 4.5 * s, color: '#9a4a2c' });
  }
}

/** REDROCK CAMP: tents, a camper, fire rings on the canyon floor beside the road. */
function camp(P, r) {
  let best = null;
  for (let s = r.length * 0.55; s < r.length * 0.85; s += 30) {
    for (const side of [1, -1]) {
      const st = site(r, s, side, 44, 30, 6);
      if (!P.isFree(st.x, st.z, st.w, st.d, st.ry, { anywhere: true })) continue;
      const g = P.groundRange(st.x, st.z, st.w, st.d, st.ry);
      const sc = g.hi - g.lo;
      if (sc < 2.5 && (!best || sc < best.sc)) best = { ...st, sc, y: g.lo };
    }
  }
  if (!best) return;
  P.claim(best.x, best.z, best.w, best.d, best.ry);
  P.add({ type: 'camp', x: best.x, z: best.z, ry: best.ry, w: best.w, d: best.d, map: 'park' });
  const c = Math.cos(best.ry), s = Math.sin(best.ry);
  const at = (lx, lz) => [best.x + lx * c + lz * s, best.z - lx * s + lz * c];
  for (const [lx, lz] of CAMP_FIRES) {
    const [x, z] = at(lx, lz);
    P.lamp({ x, z, hx: x, hz: z, hy: best.y + 0.8, color: '#ff8a3a', radius: 14, intensity: 1.0, halo: 1.4 });
  }
  for (const [lx, lz, w, d] of CAMP_SOLIDS) {
    const [x, z] = at(lx, lz);
    P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: best.ry, y0: best.y - 1, y1: best.y + 3 });
  }
  const [lx, lz] = at(-best.w / 2 + 3, best.d / 2 - 1);
  P.add({ type: 'sign', x: lx, z: lz, ry: best.ry, kind: 'camp', o: { wood: true } });
}
const CAMP_FIRES = [[-10, 2], [8, -4]];
// tents, the camper, picnic tables (local frame)
const CAMP_SOLIDS = [[-14, -6, 3.6, 3.2], [-4, -8, 3.2, 3.2], [14, 6, 3.4, 3], [16, -7, 7.5, 2.6], [0, 8, 2, 1.6]];

/** The Arch Overlook at the end of its spur: a parking bay, a stone wall on the rim, a viewer. */
function overlook(P) {
  const r = P.net.byId.get('ov_road');
  if (!r) return;
  const p = r.posAt(r.length - 1);
  const i = p.i;
  const fx = r.TX[i], fz = r.TZ[i];
  const x = p.x + fx * 9, z = p.z + fz * 9;
  const ry = Math.atan2(fx, fz);
  P.claim(x, z, 26, 14, ry);
  const y = P.groundY(x, z);
  P.add({ type: 'overlook', x, z, ry, w: 26, d: 14, map: 'park' });
  // the wall along the rim side (local +z: on toward the canyon)
  P.collider({ kind: 'box', x: x + fx * 6.5, z: z + fz * 6.5, hx: 12, hz: 0.5, ry, y0: y - 1, y1: y + 1.2 });
  P.lamp({ x: x - fx * 2, z: z - fz * 2, hx: x - fx * 2, hz: z - fz * 2, hy: y + 4.2, color: '#ffd8a0', radius: 12, intensity: 0.7, halo: 1.4 });
}

/** The LOST DUTCHMAN MINE: an adit into the mesa at the Dutchman Rd's end. */
function mine(P) {
  const r = P.net.byId.get('mn_road');
  if (!r) return;
  const end = r.posAt(r.length - 1);
  const i = end.i;
  // westward (on along the road) until the slope has risen: the portal's place
  const fx = r.TX[i], fz = r.TZ[i];
  const y0 = r.Y[r.N - 1];
  let d = 6;
  for (; d < 60; d += 1.5) { if (P.groundY(end.x + fx * d, end.z + fz * d) > y0 + 5) break; }
  const x = end.x + fx * (d - 2), z = end.z + fz * (d - 2);
  const ry = Math.atan2(-fx, -fz);        // the portal faces back down the road
  P.claim(x, z, 30, 36, ry);
  P.add({ type: 'mine', x, z, ry, y: y0, w: 30, d: 36, map: 'yard' });
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lx, lz, w, dd, h] of MINE_SOLIDS) {
    const [cx, cz] = at(lx, lz);
    P.collider({ kind: 'box', x: cx, z: cz, hx: w / 2, hz: dd / 2, ry, y0: y0 - 2, y1: y0 + h });
  }
  const [lx, lz] = at(2.6, 1.2);
  P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: y0 + 3.2, color: '#ffb050', radius: 7, intensity: 0.6, halo: 1.0 });
  P.landmark({ id: 'dutchman_mine', name: 'LOST DUTCHMAN MINE', x, z, r: 25, kind: 'mine', hidden: true });
}

// the mine's solid parts (local frame; +z back toward the road's end): the rock
// face round the portal, the hoist shack, the boiler, the tailings heap
const MINE_SOLIDS = [[0, -5.4, 12, 6, 9], [10, 4, 5.4, 5.4, 3.6], [11, -3, 3, 2.4, 2.2], [-15, 9, 11, 8, 3]];
// the rails run out of the portal and off to the side, to the tailings
const railAt = (k) => [-k * 0.62, -1.5 + k * 0.78];

/** The park's entrance: a stone-and-timber gate sign on Canyon Rd, signs on Route 99. */
function parkSigns(P) {
  const r = P.net.byId.get('rr_in');
  if (r) {
    const p = r.posAt(Math.min(r.length - r.trim1 - 12, r.trim0 + 40), reachOf(r) + 4);
    if (P.isFree(p.x, p.z, 7, 3, 0, { anywhere: true })) {
      const ry = facing(r, p.i, 1, 1, 0.5);
      P.claim(p.x, p.z, 7, 3, ry);
      P.add({ type: 'gate', x: p.x, z: p.z, ry, map: 'park' });
      const y = P.groundY(p.x, p.z);
      P.collider({ kind: 'box', x: p.x, z: p.z, hx: 3.4, hz: 1.0, ry, y0: y - 1, y1: y + 3 });
    }
  }
  for (const [id, s, side, dir] of [['r99_2', -140, -1, 1], ['r99_3', 120, 1, -1]]) {
    const rr = P.net.byId.get(id);
    if (!rr) continue;
    const ss = s < 0 ? rr.length + s : s;
    const p = rr.posAt(ss, side * (reachOf(rr) + 2));
    if (!P.isFree(p.x, p.z, 2, 2, 0, { anywhere: true })) continue;
    P.claim(p.x, p.z, 2, 2, 0);
    P.add({ type: 'sign', x: p.x, z: p.z, ry: facing(rr, p.i, side, dir, 0.25), kind: 'park', o: { wood: true } });
    P.collider({ kind: 'circle', x: p.x, z: p.z, r: 0.4, y0: rr.Y[p.i] - 2, y1: rr.Y[p.i] + 4 });
  }
  void RS;
}

// ================================================================== building

function spire(B, it) {
  const acc = B.acc(MAT.strata(B));
  let y = it.y - 0.8, r = it.r;
  const n = 2 + Math.floor(hash1(it.seed, 1) * 2);
  for (let k = 0; k < n; k++) {
    const h = (it.h / n) * (0.8 + hash1(it.seed, k) * 0.4) + (k === 0 ? 0.8 : 0);
    paint(acc, SAND[(k + Math.floor(hash1(it.seed, 2) * 4)) % SAND.length]);
    drum(acc, it.x, y, it.z, r, r * 0.7, h, 6, it.seed + k, 0.22, { u: 8, v: 16, v0: 0, top: k === n - 1 });
    y += h;
    r *= 0.75;
  }
}

/** The arch: a band of rock sweeping over the road from leg to leg, thick at the feet, thin at the crown. */
function* buildArch(B, it) {
  const { x, z, ry, span, y } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  // local frame: u across the road (local x), w along it (local z)
  const W = (u, h, w) => [x + u * c + w * s, y + h, z - u * s + w * c];
  const acc = B.acc(MAT.strata(B));
  const Rx = span + 2, Ry = 33;
  const seg = 22;
  // the band's cross-section along the sweep: thickness t (radial), depth d (along the road)
  const prof = (k) => {
    const t = k / seg;                         // 0 at one foot, 1 at the other
    const mid = 1 - Math.abs(t - 0.5) * 2;     // 1 at the crown
    const jitter = (hash1(it.n, k, 1) - 0.5) * 1.2;
    return { th: 14 - mid * 8.5 + jitter, dp: 15 - mid * 6.5 + (hash1(it.n, k, 2) - 0.5) * 1.5, lean: (hash1(it.n, k, 3) - 0.5) * 1.2 };
  };
  const ring = [];
  for (let k = 0; k <= seg; k++) {
    const a = Math.PI - (k / seg) * Math.PI;
    const P0 = prof(k);
    const cu = Math.cos(a) * Rx, ch = Math.sin(a) * Ry;
    // the normal of the ellipse (outward)
    let nu = Math.cos(a) / Rx, nh = Math.sin(a) / Ry;
    const nl = Math.hypot(nu, nh);
    nu /= nl; nh /= nl;
    const inner = [cu - nu * P0.th * 0.45, ch - nh * P0.th * 0.45], outer = [cu + nu * P0.th * 0.55, ch + nh * P0.th * 0.55];
    // the feet go down into the ground
    if (k === 0 || k === seg) { inner[1] = -3; outer[1] = -3; }
    ring.push({ inner, outer, d: P0.dp, lean: P0.lean });
  }
  for (let k = 0; k < seg; k++) {
    const A = ring[k], Bq = ring[k + 1];
    const band = Math.floor((A.inner[1] + y) / 7);
    paint(acc, ['#a8492c', '#b8583a', '#9a3e26', '#c46a40', '#b46448'][((band % 5) + 5) % 5], 0.95 + hash1(it.n, k, 4) * 0.1);
    const fA = A.d / 2, fB = Bq.d / 2;
    const ai = W(A.inner[0], A.inner[1], A.lean), ao = W(A.outer[0], A.outer[1], A.lean), bi = W(Bq.inner[0], Bq.inner[1], Bq.lean), bo = W(Bq.outer[0], Bq.outer[1], Bq.lean);
    const off = (p, f) => [p[0] + s * f, p[1], p[2] + c * f];
    // the front (+w) and back (−w) faces of this slice, the soffit (inner) and the top (outer)
    const uvA = A.inner[1] / 16, uvB = Bq.outer[1] / 16;
    acc.quadP(off(ai, fA), off(bi, fB), off(bo, fB), off(ao, fA), [0, uvA, 1, uvB]);
    acc.quadP(off(bi, -fB), off(ai, -fA), off(ao, -fA), off(bo, -fB), [0, uvA, 1, uvB]);
    acc.quadP(off(ai, -fA), off(bi, -fB), off(bi, fB), off(ai, fA), [0, uvA, 1, uvA + 0.6]);
    acc.quadP(off(ao, fA), off(bo, fB), off(bo, -fB), off(ao, -fA), [0, uvB, 1, uvB + 0.6]);
  }
  yield;
  // the feet: big buttresses of stacked blocks, rubble round them
  for (const sd of [1, -1]) {
    const u = sd * (span + 3.5);
    for (let k = 0; k < 4; k++) {
      const p = W(u + sd * (hash1(it.n, k, 5) - 0.3) * 3, 0, (hash1(it.n, k, 6) - 0.5) * 4);
      paint(acc, SAND[k % SAND.length]);
      drum(acc, p[0], y - 2 + k * 5.5, p[2], 7.6 - k * 0.9, 6.8 - k * 0.9, 6.5, 7, it.n * 7 + k + (sd > 0 ? 50 : 0), 0.22, { u: 8, v: 16, v0: 0, top: k === 3 });
    }
    const rk = B.acc(MAT.rock(B));
    for (let k = 0; k < 9; k++) {
      const p = W(u + sd * (hash1(it.n, k, 8) * 10 - 5) - sd * 6, 0, (hash1(it.n, k, 9) - 0.5) * 22);
      boulder(rk, p[0], B.groundY(p[0], p[2]) - 0.4, p[2], 0.8 + hash1(it.n, k, 10) * 2.2, it.n * 13 + k, '#9a4a2c');
    }
    // the floodlights pointing up at it
    for (const k of [-6, 6]) {
      const fx = x + c * sd * (span - 6) + s * k, fz = z - s * sd * (span - 6) + c * k;
      floodlight(B, fx, B.groundY(fx, fz), fz, Math.atan2(-c * sd, s * sd), '#ffd0a0', 0.6);
    }
  }
}

function* buildCamp(B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const at = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  const la = B.acc(lotMat(B));
  paint(la, '#b07a58');
  drape(la, B, [at(-it.w / 2, it.d / 2), at(it.w / 2, it.d / 2), at(it.w / 2, -it.d / 2), at(-it.w / 2, -it.d / 2)], { lift: 0.04, step: 4, uv: 6 });
  const pa = B.acc(MAT.paint(B)), nr = B.near(MAT.paint(B));
  // tents: A-frames and a dome, in bright nylon
  const tent = (lx, lz, w, d, h, col, rot = 0) => {
    const [tx, tz] = at(lx, lz);
    const ty = B.groundY(tx, tz);
    paint(pa, col);
    gable(pa, tx, ty - 0.05, tz, w, d, h, it.ry + rot, { over: 0.15 });
  };
  tent(-14, -6, 2.8, 3.2, 1.7, '#e8a020', Math.PI / 2);
  tent(-4, -8, 2.6, 3, 1.6, '#2a8ad8', Math.PI / 2 + 0.3);
  {
    const [tx, tz] = at(14, 6);
    const ty = B.groundY(tx, tz);
    paint(pa, '#3aa858');
    blob(pa, tx, ty, tz, 1.7, 1.25, 1.7, 0, it.n, 0.02, 0.0);
  }
  // the camper van, a pickup with a canoe
  {
    const [vx, vz] = at(16, -7);
    car(B, vx, B.groundY(vx, vz), vz, it.ry + Math.PI / 2, { kind: 'van', color: '#e8e4da' });
    paint(pa, '#d87a2a');
    const [px, pz] = at(16, -7);
    box(pa, px, B.groundY(px, pz) + 2.05, pz, 2.0, 0.08, 7.0, it.ry + Math.PI / 2);
  }
  // picnic tables, fire rings (flickering), a lantern on a post, chairs
  for (const [lx, lz] of [[0, 8], [-18, 6]]) { const [px, pz] = at(lx, lz); picnic(nr, px, B.groundY(px, pz), pz, it.ry + 0.2); }
  const lights = B.acc(MAT.lights(B));
  const rk = B.near(MAT.rock(B));
  CAMP_FIRES.forEach(([lx, lz], q) => {
    const [fx, fz] = at(lx, lz);
    const fy = B.groundY(fx, fz);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; boulder(rk, fx + Math.cos(a) * 0.9, fy - 0.15, fz + Math.sin(a) * 0.9, 0.28, it.n + k + q * 10, '#6a5a50'); }
    const k0 = lights.count;
    paint(lights, '#ff7a1a');
    cone(lights, fx, fy, fz, 0.55, 1.2, 6);
    paint(lights, '#ffd04a');
    cone(lights, fx + 0.1, fy, fz - 0.1, 0.3, 0.8, 5);
    animUV(lights, k0, q * 0.37, -7);
    paint(nr, '#5a3a24');
    for (let k = 0; k < 3; k++) { const a = k * 2.1; obox(nr, fx + Math.cos(a) * 0.2, fy, fz + Math.sin(a) * 0.2, 0.12, 0.12, 1.1, a, 0.15, 0); }
    // camp chairs round the fire
    for (let k = 0; k < 3; k++) {
      const a = k * 2.0 + 0.5, cx2 = fx + Math.cos(a) * 2.2, cz2 = fz + Math.sin(a) * 2.2;
      paint(nr, ['#c8322a', '#2a6ac8', '#3a9a4a'][k]);
      box(nr, cx2, fy + 0.35, cz2, 0.55, 0.08, 0.55, a);
      obox(nr, cx2 + Math.cos(a) * 0.28, fy + 0.35, cz2 + Math.sin(a) * 0.28, 0.55, 0.6, 0.06, -a + Math.PI / 2, -0.2, 0);
    }
  });
  yield;
  // string lights between the camper and a pole
  const [ax, az] = at(12, -6), [bx, bz] = at(4, 2);
  const by = B.groundY(bx, bz);
  paint(pa, '#5e4c3c'); cylinder(pa, bx, by - 0.3, bz, 0.08, 3.4, 5);
  stringLights(B, [ax, B.groundY(ax, az) + 2.3, az], [bx, by + 3.0, bz], 0.4, 0.8, ['#ffcf7a', '#ff9a6a', '#fff2c0']);
  // firewood, a cooler, a water jug
  const [wx, wz] = at(-8, -2); paint(nr, '#7a5a3a'); for (let k = 0; k < 4; k++) hcyl(nr, wx, B.groundY(wx, wz) + 0.12 + k * 0.18, wz + (k % 2) * 0.1, 0.1, 1.0, it.ry, 5, true);
  const [cx, cz] = at(-12, 0); paint(nr, '#2a6ac8'); box(nr, cx, B.groundY(cx, cz), cz, 0.7, 0.45, 0.45, it.ry);
}

function buildOverlook(B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const at = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  const la = B.acc(lotMat(B));
  paint(la, '#a07858');
  drape(la, B, [at(-it.w / 2, 5), at(it.w / 2, 5), at(it.w / 2, -it.d / 2), at(-it.w / 2, -it.d / 2)], { lift: 0.05, step: 4, uv: 6 });
  // a low wall of red stone along the rim side
  const rk = B.acc(MAT.rock(B));
  for (let k = 0; k < 14; k++) {
    const [px, pz] = at(-12 + k * 1.85, 6.5);
    const py = B.groundY(px, pz);
    paintMix(rk, '#9a4a2c', '#c87a50', hash1(it.n, k));
    blob(rk, px, py + 0.5, pz, 1.05, 0.6, 0.6, it.ry, it.n * 7 + k, 0.15, 0.9);
  }
  // the coin viewer on its post, a bench, the sign, a lamp
  const pa = B.near(MAT.paint(B));
  const [vx, vz] = at(2, 5.3);
  const vy = B.groundY(vx, vz);
  paint(pa, '#5a6a3a'); cylinder(pa, vx, vy, vz, 0.09, 1.2, 6);
  paint(pa, '#2a5a3a'); hcyl(pa, vx, vy + 1.35, vz, 0.2, 0.7, it.ry + Math.PI / 2, 8, true);
  const [bx, bz] = at(-6, 4); paint(pa, '#7a5a3a'); box(pa, bx, B.groundY(bx, bz) + 0.42, bz, 2.0, 0.08, 0.5, it.ry);
  for (const k of [-0.8, 0.8]) { const [qx, qz] = at(-6 + k, 4); box(pa, qx, B.groundY(qx, qz), qz, 0.08, 0.42, 0.45, it.ry); }
  const [sx, sz] = at(8, -4);
  roadSign(B, sx, B.groundY(sx, sz), sz, it.ry + Math.PI, 'overlook', { wood: true });
  const [lx, lz] = at(0, -2);
  lampPost(B, lx, B.groundY(lx, lz), lz, lx, B.groundY(lx, lz) + 4.2, lz, { wood: true, color: '#ffd8a0' });
}

function* buildMine(B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const at = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  const y = it.y;
  const wood = B.acc(MAT.wood(B)), hole = B.acc(MAT.hole(B)), pa = B.acc(MAT.paint(B));
  // the adit: a dark opening set into the slope, framed in heavy timbers, a rock face round it
  const [px, pz] = at(0, -2);
  const py = B.groundY(px, pz);
  const sy = Math.min(py, y);
  const rk = B.acc(MAT.strata(B));
  paint(rk, '#9a3e26');
  box(rk, px - s * 3.4, sy - 1, pz - c * 3.4, 12, 9.5, 6, it.ry, { u: 16, v: 16, v0: (sy - 1) / 16 });
  paint(hole, '#000');
  panel(hole, px - s * 0.42, sy, pz - c * 0.42, it.ry, 3.0, 3.4);
  paint(wood, '#6a5038');
  for (const k of [-1.75, 1.75]) { const [qx, qz] = at(k, -2 + 0.1); box(wood, qx, sy - 0.3, qz, 0.45, 4.2, 0.45, it.ry, { u: 2, v: 4 }); }
  const [hx, hz] = at(0, -2 + 0.1);
  box(wood, hx, sy + 3.75, hz, 4.6, 0.5, 0.55, it.ry, { u: 2, v: 4 });
  box(wood, hx, sy + 4.25, hz, 5.4, 0.4, 0.6, it.ry, { u: 2, v: 4 });
  // the DANGER sign nailed to the header, the lantern hung by the door
  panel(B.acc(MAT.roadsigns(B)), hx + s * 0.3, sy + 4.3, hz + c * 0.3, it.ry, 1.8, 0.9, uvOf(RS.mine[0], 1024, 512));
  const [lx, lz] = at(2.6, 1.2);
  paint(pa, '#3a3a3a'); cylinder(pa, lx, B.groundY(lx, lz) - 0.3, lz, 0.07, 3.6, 5);
  const g = B.acc(MAT.neon(B));
  paint(g, '#ffb050'); box(g, lx, B.groundY(lx, lz) + 2.8, lz, 0.28, 0.4, 0.28, 0);
  yield;
  // the rails: two lines of steel on sleepers, out of the adit and away to the tailings
  const rail = B.acc(MAT.metal(B));
  const dirx = -0.62, dirz = 0.78, dl = Math.hypot(dirx, dirz);
  const ux = dirz / dl, uz = -dirx / dl;          // square to the rails (local)
  const rry = it.ry + Math.atan2(dirx, dirz);
  for (let k = 0; k < 22; k++) {
    const [lx0, lz0] = railAt(k);
    const [qx, qz] = at(lx0, lz0);
    paint(wood, '#5a4030');
    box(wood, qx, B.groundY(qx, qz) - 0.05, qz, 1.6, 0.14, 0.24, rry, { u: 2, v: 4 });
  }
  paint(rail, '#5a4a40');
  for (const k of [-0.5, 0.5]) {
    const pts = [];
    for (let q = 0; q <= 11; q++) { const [lx0, lz0] = railAt(q * 2); const [qx, qz] = at(lx0 + ux * k, lz0 + uz * k); pts.push([qx, B.groundY(qx, qz) + 0.12, qz]); }
    for (let q = 0; q < pts.length - 1; q++) rail.beam(...pts[q], ...pts[q + 1], 0.07, 0.1);
  }
  // ore carts: two on the rails, one off them and tipped, its ore spilled
  const cart = (k, off, rot, tip) => {
    const [lx0, lz0] = railAt(k);
    const [qx, qz] = at(lx0 + ux * off, lz0 + uz * off);
    const qy = B.groundY(qx, qz);
    paint(rail, '#6a4a34');
    obox(rail, qx, qy + 0.35, qz, 1.1, 0.8, 1.6, rry + rot, 0, tip);
    if (!tip) { paint(pa, '#1a1a1a'); for (const a of [-0.55, 0.55]) hcyl(pa, qx + Math.sin(rry) * a, qy + 0.25, qz + Math.cos(rry) * a, 0.22, 1.2, rry + Math.PI / 2, 6, true); }
  };
  cart(4, 0, 0, 0);
  cart(6.4, 0, 0, 0);
  cart(12, 2.6, 0.6, 1.2);
  const ore = B.acc(MAT.rock(B));
  for (let k = 0; k < 9; k++) { const [lx0, lz0] = railAt(12.5 + hash1(it.n, k) * 2); const [qx, qz] = at(lx0 + ux * (3.4 + hash1(it.n, k, 1) * 1.6), lz0 + uz * (3.4 + hash1(it.n, k, 1) * 1.6)); boulder(ore, qx, B.groundY(qx, qz) - 0.1, qz, 0.25 + hash1(it.n, k, 2) * 0.3, it.n + k, '#7a6a5a'); }
  // the tailings: a heap of pale waste rock at the end of the line
  {
    const [tx, tz] = at(-15, 9);
    const g3 = B.footY(tx, tz, 12, 12, rry);
    paint(ore, '#b8a088');
    drum(ore, tx, g3.lo - 0.6, tz, 6.5, 1.6, 3.4 + (g3.hi - g3.lo) * 0.3, 9, it.n * 3, 0.15, { top: true });
  }
  yield;
  // the hoist shack (plank walls, a tin roof), a rusted boiler, drums, crates
  {
    const [sx, sz] = at(10, 4);
    const g2 = B.footY(sx, sz, 5, 5, it.ry);
    paint(wood, '#8a7058');
    box(wood, sx, g2.lo - 0.3, sz, 5, g2.hi - g2.lo + 3.0, 5, it.ry + 0.1, { u: 2, v: 4 });
    const tin = B.acc(MAT.tin(B));
    paint(tin, '#9a6a4a');
    gable(tin, sx, g2.hi + 2.7, sz, 5.4, 5.4, 1.2, it.ry + 0.1, { over: 0.3, u: 4 });
  }
  {
    const [bx, bz] = at(11, -3);
    paint(pa, '#5a3a2a');
    hcyl(pa, bx, B.groundY(bx, bz) + 1.0, bz, 1.0, 2.8, it.ry + 0.4, 10, true);
    cylinder(pa, bx, B.groundY(bx, bz) + 1.8, bz, 0.22, 3.2, 6);
  }
  const nr = B.near(MAT.paint(B));
  for (let k = 0; k < 3; k++) { const [qx, qz] = at(7 + k * 0.7, 9); drumBarrel(nr, qx, B.groundY(qx, qz), qz, '#6a4a34', k === 2, it.ry); }
  const [cx, cz] = at(6, -1); crate(nr, cx, B.groundY(cx, cz), cz, 1, it.ry + 0.3, '#8a6a48');
  crate(nr, cx, B.groundY(cx, cz) + 0.9, cz, 0.8, it.ry + 0.1, '#7a5a3a');
}

/** The park's gate sign: stone piers, a timber beam, the sign board. */
function parkGate(B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const y = B.groundY(it.x, it.z);
  const rk = B.acc(MAT.strata(B));
  for (const k of [-2.8, 2.8]) {
    paint(rk, '#a8492c');
    drum(rk, it.x + c * k, y - 0.5, it.z - s * k, 0.9, 0.75, 3.2, 6, Math.round(k * 10) + it.n, 0.15, { u: 8, v: 16, v0: 0 });
  }
  const wood = B.acc(MAT.wood(B));
  paint(wood, '#6a5038');
  box(wood, it.x, y + 2.6, it.z, 6.8, 0.4, 0.4, it.ry, { u: 2, v: 4 });
  panel(B.acc(MAT.roadsigns(B)), it.x + s * 0.22, y + 0.7, it.z + c * 0.22, it.ry, 4.2, 2.0, uvOf(RS.park[0], 1024, 512));
  paint(wood, '#5a4030');
  box(wood, it.x, y + 0.6, it.z, 4.4, 2.2, 0.3, it.ry, { u: 2, v: 4 });
}

