// PORT HALCYON — CHINATOWN's set pieces: strings of red lanterns across the
// streets (they sway: their material swings each vertex by how far below
// its hook it hangs), the DRAGON GATE over Grant Avenue, the temple and its
// seven-storey pagoda on Lantern Square, the night market's stalls and its
// lantern pole, the teahouse courtyard behind Jade Alley, pagoda-roofed
// phone booths, dressed street lanterns, the alleys' dumpsters and crates.
import * as THREE from 'three';
import { box, cylinder, cone, sphere, prism } from '../builder.js';
import { U } from '../../kit.js';
import { frame, edgeFace, fquad, catenary, wire, cross, bush, inset, ccw } from './geo.js';
import { ctwUV, ctsHUV } from './cttex.js';
import { hipUp, pent } from './cthouse.js';
import { metalUV } from './tex.js';

// ------------------------------------------------------------------ lanterns

/** The lanterns' material: glowing, vertex-coloured, swung in the vertex shader (uv = phase, hang). */
export function lanternMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  m.color.setScalar(2.2);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hang = uv.y;
        transformed.x += sin(uTime * 1.6 + uv.x) * 0.075 * hang;
        transformed.z += cos(uTime * 1.25 + uv.x * 1.7) * 0.06 * hang;`);
  };
  m.customProgramCacheKey = () => 'ct-lantern-sway';
  return m;
}

const RINGS = [[-0.08, 0.15, 1], [-0.15, 0.22, 0], [-0.42, 0.31, 0], [-0.69, 0.22, 0], [-0.76, 0.15, 1]];
const RED = [1, 0.13, 0.08], GOLD = [1, 0.72, 0.22];

/**
 * One paper lantern hung from (x, y, z): a lathe of seven rings (shared
 * vertices: ~45 a lantern), gold caps, a tassel. ph: its swing phase; s: size.
 */
export function lantern(L, x, y, z, ph, s = 1, body = RED) {
  const n0 = L.count;
  const seg = 6;
  const ids = [];
  for (const [dy, r, gold] of RINGS) {
    const row = [];
    L.col = gold ? GOLD : body;
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      row.push(L.v(x + Math.cos(a) * r * s, y + dy * s, z + Math.sin(a) * r * s));
    }
    ids.push(row);
  }
  for (let q = 0; q < ids.length - 1; q++) {
    for (let k = 0; k < seg; k++) {
      const a = ids[q][k], b = ids[q][(k + 1) % seg], c = ids[q + 1][(k + 1) % seg], d = ids[q + 1][k];
      L.tri(a, b, c); L.tri(a, c, d);
    }
  }
  L.col = GOLD;
  const t0 = L.v(x - 0.03, y - 0.84 * s, z), t1 = L.v(x + 0.03, y - 0.84 * s, z), t2 = L.v(x, y - 1.15 * s, z);
  L.tri(t0, t1, t2); L.tri(t0, t2, t1);
  // the swing: phase, and how far below the hook
  for (let i = n0; i < L.count; i++) { L.uv[i * 2] = ph; L.uv[i * 2 + 1] = (y - L.p[i * 3 + 1]) / s * 1.2; }
}

/**
 * A string of lanterns between two points ([x, y, z]), sagging; the wire
 * close up. L: lantern acc, Wr: wire acc (near).
 */
export function lanternString(L, Wr, a, b, sag, spacing, ph0 = 0) {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(2, Math.round(len / spacing));
  const pts = catenary(a, b, sag, n);
  if (Wr) {
    // the wire: one thin strip facing down (it's seen from the street)
    for (let k = 0; k < n; k++) {
      const p = pts[k], q = pts[k + 1];
      const dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1, px = (-dz / l) * 0.03, pz = (dx / l) * 0.03;
      Wr.quadP([p[0] - px, p[1], p[2] - pz], [q[0] - px, q[1], q[2] - pz], [q[0] + px, q[1], q[2] + pz], [p[0] + px, p[1], p[2] + pz]);
    }
  }
  for (let k = 1; k < n; k++) {
    const p = pts[k];
    lantern(L, p[0], p[1] - 0.02, p[2], ph0 + k * 1.37, k % 3 === 1 ? 1.1 : 0.92);
  }
}

// ------------------------------------------------------------------ the gate

const RED_P = [0.72, 0.06, 0.05], GREEN_T = [0.16, 0.52, 0.32], GOLD_P = [0.85, 0.62, 0.18], GREY = [0.62, 0.6, 0.56];

/**
 * A paifang over a road: four red columns (the middle pair either side of
 * the carriageway, the outer pair at the building line), lintels, a gilt
 * board, green-tiled roofs with turned-up eaves, lanterns, two lions.
 * it: { x, z, g, ry (the gate's span runs along local x), half (span to the
 * inner columns), outer, grand }.
 */
export function gate(K, it) {
  const F = frame(it.x, it.g, it.z, it.ry);
  const P = K.paint, N = K.near;
  const hi = it.half, ho = it.outer;
  const H1 = it.grand ? 10 : 7.6, H2 = it.grand ? 7.4 : 5.6;
  for (const sx of [-1, 1]) {
    for (const [cx, h, r] of [[hi, H1, 0.46], [ho, H2, 0.38]]) {
      const p = F.P(sx * cx, 0, 0);
      P.col = GREY;
      box(P, p[0], p[1] - 0.3, p[2], 1.3, 1.1, 1.3, it.ry, { u: 1 });
      P.col = RED_P;
      cylinder(P, p[0], p[1] + 0.8, p[2], r, h - 0.8, 8);
      // the stone braces either side of the column's foot
      P.col = GREY;
      box(P, p[0], p[1] + 0.8, p[2], 0.5, 1.4, 2.4, it.ry, { u: 1 });
    }
    // the side spans' lintel, its roof
    const m = (hi + ho) / 2;
    const q = F.P(sx * m, H2 - 1.2, 0);
    P.col = RED_P;
    box(P, q[0], q[1], q[2], ho - hi + 0.8, 0.6, 0.5, it.ry, { u: 1 });
    P.col = GOLD_P;
    box(N.paint, q[0], q[1] - 0.5, q[2], ho - hi - 0.6, 0.35, 0.45, it.ry, { u: 1 });
    const rq = F.P(sx * m, H2 + 0.05, 0);
    hipUp(K.tile, P, rq[0], rq[1], rq[2], ho - hi + 1.4, 1.6, 1.0, it.ry, GREEN_T);
    // a lion on a plinth by the outer column
    const lp = F.P(sx * (ho + 1.6), 0, 2.2);
    P.col = GREY;
    box(P, lp[0], lp[1] - 0.2, lp[2], 1.2, 1.2, 1.6, it.ry, { u: 1 });
    sphere(P, lp[0], lp[1] + 1.4, lp[2] + 0.1, 0.55, 6, { sy: 0.9 });
    box(P, lp[0], lp[1] + 1.0, lp[2] - 0.25, 0.8, 0.9, 0.9, it.ry, { u: 1 });
  }
  // the main lintels, the board between them, the great roof
  const c1 = F.P(0, H1 - 1.6, 0), c2 = F.P(0, H1 - 3.2, 0);
  P.col = RED_P;
  box(P, c1[0], c1[1], c1[2], 2 * hi + 1.2, 0.75, 0.6, it.ry, { u: 1 });
  box(P, c2[0], c2[1], c2[2], 2 * hi + 0.6, 0.55, 0.5, it.ry, { u: 1 });
  P.col = GREEN_T;
  box(N.paint, c1[0], c1[1] - 0.25, c1[2], 2 * hi, 0.22, 0.65, it.ry, { u: 1 });
  K.win.col = [1, 1, 1];
  const bw = it.grand ? 4.2 : 3;
  for (const side of [1, -1]) {
    const f = side > 0 ? edgeFace(F.X(-bw / 2, 0.33), F.X(bw / 2, 0.33)) : edgeFace(F.X(bw / 2, -0.33), F.X(-bw / 2, -0.33));
    fquad(K.win, f, 0, bw, it.g + H1 - 2.65, it.g + H1 - 2.65 + bw * 0.62, 0, ctwUV('board'));
  }
  const rp = F.P(0, H1, 0);
  hipUp(K.tile, P, rp[0], rp[1], rp[2], 2 * hi + 3.2, 2.2, 1.6, it.ry, GREEN_T);
  // brackets under the eaves
  P.col = GOLD_P;
  for (let a = -hi + 0.6; a <= hi - 0.6; a += 1.1) {
    const b = F.P(a, H1 - 0.85, 0);
    box(N.paint, b[0], b[1], b[2], 0.32, 0.6, 1.4, it.ry, { u: 1 });
  }
  // two big lanterns under the main lintel
  for (const sx of [-0.45, 0.45]) { const p = F.P(sx * hi, H1 - 3.5, 0); lantern(K.lantern, p[0], p[1], p[2], sx * 3, 1.9); }
}

// ------------------------------------------------------------------ the temple

/**
 * The temple: a walled compound, its gateway, the main hall on a stone
 * terrace under a double roof, an incense burner, side halls, and the
 * seven-storey pagoda. it: { x, z, g, ry, w, d } (the compound; its gate on
 * local +x), pagoda: [lx, lz].
 */
export function temple(K, it) {
  const F = frame(it.x, it.g, it.z, it.ry);
  const P = K.paint, N = K.near, Wl = K.plaster;
  const hw = it.w / 2, hd = it.d / 2, g = it.g;
  // the compound wall: ochre-red, a tiled coping, the gateway in the middle of the front
  const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
  for (let k = 0; k < 4; k++) {
    const A = F.X(...corners[k]), Bq = F.X(...corners[(k + 1) % 4]);
    const f = edgeFace(A, Bq);
    const front = k === 1;      // the +x side
    const parts = front ? [[0, f.len / 2 - 5], [f.len / 2 + 5, f.len]] : [[0, f.len]];
    for (const [a0, a1] of parts) {
      Wl.col = [0.78, 0.32, 0.2];
      fquad(Wl, f, a0, a1, g - 0.5, g + 3.2, 0.4, [a0 / 2, 0, a1 / 2, 1.8]);
      fquad(Wl, f, a1, a0, g - 0.5, g + 3.2, -0.4, [a0 / 2, 0, a1 / 2, 1.8]);
      K.tile.col = GREEN_T;
      K.tile.quadP(f.P(a0, g + 3.2, 0.75), f.P(a1, g + 3.2, 0.75), f.P(a1, g + 3.75, 0), f.P(a0, g + 3.75, 0));
      K.tile.quadP(f.P(a1, g + 3.2, -0.75), f.P(a0, g + 3.2, -0.75), f.P(a0, g + 3.75, 0), f.P(a1, g + 3.75, 0));
    }
  }
  // the gateway: a small paifang in the wall
  gate(K, { x: F.X(hw, 0)[0], z: F.X(hw, 0)[1], g, ry: it.ry + Math.PI / 2, half: 2.6, outer: 4.6, grand: false });
  // the main hall on its terrace
  const hx = -hw + 22, hz = 0, HD = 17, HW = 28;
  const t = F.P(hx, -0.5, hz);
  K.paint.col = [0.7, 0.68, 0.64];
  box(K.paint, t[0], t[1], t[2], HD + 6, 1.9, HW + 6, it.ry, { u: 2 });
  // steps up the front
  const st = F.P(hx + HD / 2 + 3.6, -0.5, hz);
  box(K.paint, st[0], st[1], st[2], 1.8, 1.3, 8, it.ry, { u: 1 });
  const y0 = g + 1.4;
  // walls: red with lattice windows and the doors, set back behind a colonnade
  Wl.col = [0.66, 0.1, 0.08];
  const W0 = F.X(hx - HD / 2 + 1, -HW / 2 + 1), W1 = F.X(hx + HD / 2 - 2, -HW / 2 + 1), W2 = F.X(hx + HD / 2 - 2, HW / 2 - 1), W3 = F.X(hx - HD / 2 + 1, HW / 2 - 1);
  const hp = [W3, W2, W1, W0];   // (counter-clockwise: the +x front is edge 1)
  for (let k = 0; k < 4; k++) {
    const f = edgeFace(hp[k], hp[(k + 1) % 4]);
    Wl.col = [0.66, 0.1, 0.08];
    fquad(Wl, f, 0, f.len, y0, y0 + 7, 0, [0, 0, f.len / 2, 3.5]);
    if (k === 1) {
      // the front: doors in the middle, lattice either side
      K.win.col = [1, 1, 1];
      for (let q = 0; q < 6; q++) {
        const a = (q + 0.5) * f.len / 6;
        fquad(K.win, f, a - 1.9, a + 1.9, y0 + 0.2, y0 + 4.6, 0.05, ctwUV(q === 2 || q === 3 ? 'tdoor' : 'lattice'));
      }
    } else if (k !== 3) {
      K.win.col = [1, 1, 1];
      for (let q = 0; q < 3; q++) { const a = (q + 0.5) * f.len / 3; fquad(K.win, f, a - 1.5, a + 1.5, y0 + 1.6, y0 + 4.6, 0.05, ctwUV('lattice')); }
    }
  }
  // the colonnade round it
  P.col = RED_P;
  for (let q = 0; q <= 7; q++) {
    const lz = -HW / 2 + 0.6 + q * (HW - 1.2) / 7;
    const p = F.P(hx + HD / 2 - 0.4, 1.4, lz);
    cylinder(P, p[0], p[1], p[2], 0.34, 6.2, 8);
  }
  // the double roof: a lower pent all round, the hip above, turned-up corners
  const rp = F.P(hx - 0.5, 7.0 + 1.4, hz);
  hipUp(K.tile, P, rp[0], rp[1], rp[2], HD + 2.5, HW + 2.5, 1.2, it.ry, [0.85, 0.62, 0.16]);
  const rp2 = F.P(hx - 0.5, 7.0 + 1.4 + 2.2, hz);
  P.col = [0.66, 0.1, 0.08];
  box(P, rp2[0], rp2[1] - 2.2, rp2[2], HD - 3, 2.2, HW - 3, it.ry, { u: 1 });
  hipUp(K.tile, P, rp2[0], rp2[1], rp2[2], HD - 1, HW - 1, 4.2, it.ry, [0.85, 0.62, 0.16]);
  // the incense burner in the court
  const ib = F.P(hx + HD / 2 + 10, 0, hz);
  P.col = [0.3, 0.26, 0.2];
  cylinder(P, ib[0], ib[1], ib[2], 1.1, 0.9, 8, { r2: 1.4 });
  cylinder(P, ib[0], ib[1] + 0.9, ib[2], 1.4, 0.3, 8, { top: true });
  cone(P, ib[0], ib[1] + 1.2, ib[2], 0.9, 1.4, 8);
  K.neon.col = [1, 0.5, 0.15];
  cross(K.neon, ib[0], ib[1] + 1.15, ib[2], 0.5, 0.25);
  // side halls
  for (const sz of [-1, 1]) {
    const c = F.P(-hw + 22, 0, sz * (hd - 8));
    Wl.col = [0.7, 0.14, 0.1];
    box(Wl, c[0], c[1] - 0.5, c[2], 16, 5.4, 9, it.ry, { u: 2, top: false });
    hipUp(K.tile, P, c[0], c[1] + 4.9, c[2], 16, 9, 2.4, it.ry, GREEN_T);
    const f = edgeFace(F.X(-hw + 14, sz * (hd - 8) - sz * 4.5), F.X(-hw + 30, sz * (hd - 8) - sz * 4.5));
    K.win.col = [1, 1, 1];
    for (let q = 0; q < 3; q++) { const a = (q + 0.5) * 16 / 3; fquad(K.win, sz > 0 ? edgeFace(f.B, f.A) : f, a - 1.4, a + 1.4, it.g + 0.8, it.g + 3.6, 0.05, ctwUV('lattice')); }
  }
  // cypresses in the court
  for (const [lx, lz] of [[hw - 14, -hd + 10], [hw - 14, hd - 10], [hw - 30, -hd + 6], [hw - 30, hd - 6]]) {
    const p = F.P(lx, 0, lz);
    bush(K.leaf, p[0], p[1], p[2], 1.4, 7, [0.14, 0.3, 0.16], 'cone');
  }
  pagoda(K, F.P(it.pagoda[0], 0, it.pagoda[1]), it.ry);
}

/** The seven-storey pagoda: octagonal storeys, each under its own turned-up eave, a finial. */
export function pagoda(K, base, ry) {
  const [x, y, z] = base;
  const P = K.paint;
  let yy = y, r = 6.4;
  P.col = [0.68, 0.66, 0.62];
  cylinder(P, x, yy - 0.6, z, r + 1.6, 1.8, 8, { top: true });
  yy += 1.2;
  for (let s = 0; s < 7; s++) {
    const h = s === 0 ? 5.6 : 4.0 - s * 0.12;
    const oct = [];
    for (let k = 0; k < 8; k++) { const a = ry + (k / 8) * Math.PI * 2 + Math.PI / 8; oct.push([x + Math.cos(a) * r, z - Math.sin(a) * r]); }
    K.plaster.col = s % 2 ? [0.92, 0.88, 0.8] : [0.74, 0.14, 0.1];
    prism(K.plaster, oct, 0, 0, yy, yy + h, 0, { u: 2, top: false });
    // a lit lattice window on each face
    K.win.col = [1, 1, 1];
    for (let k = 0; k < 8; k++) {
      const f = edgeFace(oct[k], oct[(k + 1) % 8]);
      const ww = Math.min(f.len * 0.55, 2.2);
      fquad(K.win, f, f.len / 2 - ww / 2, f.len / 2 + ww / 2, yy + h * 0.25, yy + h * 0.25 + ww * 1.0, 0.05, ctwUV(k % 2 ? 'lattice' : 'moon'));
    }
    // the eave: out past the wall, corners turned up, a red lantern at each corner
    const ro = r + 1.9;
    K.tile.col = [0.85, 0.62, 0.16];
    const yt = yy + h + 0.25, ye = yy + h - 0.9;
    for (let k = 0; k < 8; k++) {
      const a0 = ry + (k / 8) * Math.PI * 2 + Math.PI / 8, a1 = ry + ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8;
      const am = (a0 + a1) / 2;
      const o0 = [x + Math.cos(a0) * ro, ye + 0.55, z - Math.sin(a0) * ro], o1 = [x + Math.cos(a1) * ro, ye + 0.55, z - Math.sin(a1) * ro];
      const om = [x + Math.cos(am) * ro * 0.95, ye, z - Math.sin(am) * ro * 0.95];
      const i0 = [x + Math.cos(a0) * (r - 0.4), yt, z - Math.sin(a0) * (r - 0.4)], i1 = [x + Math.cos(a1) * (r - 0.4), yt, z - Math.sin(a1) * (r - 0.4)];
      const im = [(i0[0] + i1[0]) / 2, yt, (i0[2] + i1[2]) / 2];
      K.tile.quadP(o0, om, im, i0); K.tile.quadP(om, o1, i1, im);
      P.col = [0.5, 0.08, 0.06];
      P.quadP(om, o0, i0, im); P.quadP(o1, om, im, i1);
      lantern(K.lantern, o0[0], o0[1] - 0.15, o0[2], k + s * 2.1, 0.75);
    }
    yy += h + 0.25;
    r = Math.max(2.4, r - 0.55);
  }
  // the finial: a ringed spire and a gilt pearl
  P.col = [0.8, 0.6, 0.2];
  cone(P, x, yy, z, r * 0.7, 2.2, 8);
  cylinder(P, x, yy + 1.6, z, 0.18, 5, 6);
  for (let q = 0; q < 5; q++) cylinder(P, x, yy + 2.2 + q * 0.75, z, 0.55 - q * 0.06, 0.18, 8);
  K.neon.col = [1, 0.8, 0.3];
  sphere(K.neon, x, yy + 7.0, z, 0.42, 6);
}

// ------------------------------------------------------------------ the market

/** A night-market stall: a cart under a sloping canopy, bare bulbs along its front. */
export function marketStall(K, x, y, z, ry, col, rng) {
  const P = K.paint, N = K.near;
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = (lx, lz, ly) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const w = 3.2, d = 2.4;
  P.col = [0.55, 0.52, 0.5];
  const t = W(0, 0, 0);
  box(P, t[0], t[1], t[2], w, 0.95, d * 0.55, ry, { u: 1 });
  // goods on the counter
  const goods = [[0.95, 0.4, 0.1], [0.9, 0.85, 0.7], [0.3, 0.7, 0.3], [0.85, 0.15, 0.15], [0.95, 0.8, 0.2]];
  for (let k = 0; k < 4; k++) { N.leaf.col = goods[Math.floor(rng() * goods.length)]; const p = W(-w / 2 + 0.45 + k * 0.75, 0, 0.95); box(N.leaf, p[0], p[1], p[2], 0.6, 0.18, d * 0.45, ry, { u: 1 }); }
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const p = W(lx, lz, 0);
    N.paint.col = [0.25, 0.25, 0.27];
    box(N.paint, p[0], p[1], p[2], 0.08, lz > 0 ? 2.3 : 2.7, 0.08, ry, { u: 1, top: false });
  }
  P.col = col;
  const A = W(-w / 2 - 0.2, -d / 2 - 0.2, 2.75), Bq = W(w / 2 + 0.2, -d / 2 - 0.2, 2.75), C = W(w / 2 + 0.2, d / 2 + 0.5, 2.25), D = W(-w / 2 - 0.2, d / 2 + 0.5, 2.25);
  P.quadP(D, C, Bq, A);
  P.col = [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5];
  P.quadP(A, Bq, C, D);
  // a valance with bulbs
  P.col = col;
  P.quadP(W(-w / 2 - 0.2, d / 2 + 0.5, 1.95), W(w / 2 + 0.2, d / 2 + 0.5, 1.95), C, D);
  for (let k = 0; k < 5; k++) { const p = W(-w / 2 + k * w / 4, d / 2 + 0.55, 1.9); cross(K.neon, p[0], p[1] - 0.12, p[2], 0.08, 0.16); }
}

// ------------------------------------------------------------------ small things

/** A phone booth under a pagoda roof (glass lit at night). */
export function phoneBooth(K, x, y, z, ry) {
  const P = K.paint;
  P.col = [0.72, 0.08, 0.06];
  box(P, x, y, z, 1.1, 0.3, 1.1, ry, { u: 1 });
  for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    box(P, x + dx * c + dz * s, y, z - dx * s + dz * c, 0.1, 2.3, 0.1, ry, { u: 1 });
  }
  K.neon.col = [0.95, 0.95, 0.85];
  box(K.neon, x, y + 1.6, z, 0.92, 0.5, 0.92, ry, { u: 1 });
  hipUp(K.tile, P, x, y + 2.3, z, 1.2, 1.2, 0.7, ry, GREEN_T);
}

/** A dumpster, a stack of crates, gas bottles (alley clutter, close up). */
export function clutter(K, x, y, z, ry, rng) {
  const N = K.near;
  const r = rng();
  if (r < 0.4) {
    N.paint.col = [[0.15, 0.32, 0.2], [0.2, 0.25, 0.4], [0.35, 0.35, 0.36]][Math.floor(rng() * 3)];
    box(N.paint, x, y, z, 1.9, 1.2, 1.1, ry, { u: 1 });
    N.paint.col = [0.12, 0.12, 0.12];
    box(N.paint, x, y + 1.2, z, 1.95, 0.08, 1.15, ry + 0.06, { u: 1 });
  } else if (r < 0.75) {
    for (let k = 0; k < 4; k++) {
      N.paint.col = [[0.6, 0.45, 0.28], [0.3, 0.45, 0.65], [0.75, 0.2, 0.15], [0.5, 0.5, 0.5]][Math.floor(rng() * 4)];
      box(N.paint, x + (k % 2) * 0.6 - 0.3, y + Math.floor(k / 2) * 0.42, z, 0.55, 0.4, 0.45, ry + rng() * 0.2, { u: 1 });
    }
  } else {
    N.paint.col = [0.8, 0.8, 0.82];
    for (let k = 0; k < 3; k++) cylinder(N.paint, x + k * 0.36, y, z, 0.15, 1.1, 6, { top: true });
  }
}

/** Dress a road's red street lantern: a curved bracket, a pagoda cap, a gilt finial (close up). */
export function dressLantern(K, L) {
  const N = K.near;
  // a red base, the post carried on up to a gilt arm over the head, a green pagoda cap
  N.paint.col = [0.6, 0.06, 0.05];
  cylinder(N.paint, L.x, L.y, L.z, 0.17, 1.0, 6, { r2: 0.1 });
  N.paint.col = [0.75, 0.55, 0.15];
  cylinder(N.paint, L.x, L.hy - 0.45, L.z, 0.06, 0.45, 4);
  N.paint.beam(L.x, L.hy - 0.03, L.z, L.hx, L.hy - 0.03, L.hz, 0.07, 0.07);
  cylinder(N.paint, L.hx, L.hy - 0.18, L.hz, 0.36, 0.05, 6);
  N.tile.col = GREEN_T;
  cone(N.tile, L.hx, L.hy - 0.14, L.hz, 0.46, 0.38, 6);
  N.paint.col = [0.85, 0.65, 0.2];
  cylinder(N.paint, L.hx, L.hy + 0.2, L.hz, 0.04, 0.22, 4);
}

/** A teahouse pavilion: two storeys of lattice behind red columns, a turned-up roof; a moon gate. */
export function teahouse(K, it) {
  const F = frame(it.x, it.g, it.z, it.ry);
  const P = K.paint, Wl = K.plaster, g = it.g;
  // the courtyard wall with its moon gate (on local −z, the alley side)
  const hw = it.w / 2, hd = it.d / 2;
  const wall = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  for (let k = 0; k < 4; k++) {
    const A = F.X(...wall[(k + 1) % 4]), Bq = F.X(...wall[k]);
    const f = edgeFace(A, Bq);
    Wl.col = [0.94, 0.92, 0.86];
    if (k === 0) {
      // the moon gate: the wall either side, the round opening framed in green
      fquad(Wl, f, 0, f.len / 2 - 2.4, g - 0.4, g + 3.6, 0, [0, 0, 1, 1]);
      fquad(Wl, f, f.len / 2 + 2.4, f.len, g - 0.4, g + 3.6, 0, [0, 0, 1, 1]);
      fquad(Wl, f, f.len / 2 - 2.4, 0, g - 0.4, g + 3.6, -0.3, [0, 0, 1, 1]);
      fquad(Wl, f, f.len, f.len / 2 + 2.4, g - 0.4, g + 3.6, -0.3, [0, 0, 1, 1]);
      K.win.col = [1, 1, 1];
      fquad(K.win, f, f.len / 2 - 2.4, f.len / 2 + 2.4, g - 0.2, g + 4.6, 0.02, ctwUV('moon'));
    } else { fquad(Wl, f, 0, f.len, g - 0.4, g + 3.6, 0, [0, 0, 1, 1]); fquad(Wl, f, f.len, 0, g - 0.4, g + 3.6, -0.3, [0, 0, 1, 1]); }
    K.tile.col = GREEN_T;
    K.tile.quadP(f.P(0, g + 3.6, 0.6), f.P(f.len, g + 3.6, 0.6), f.P(f.len, g + 4.1, 0), f.P(0, g + 4.1, 0));
  }
  // the pavilion at the back of the court
  const px = 0, pz = hd - 9;
  const c = F.P(px, 0, pz);
  Wl.col = [0.72, 0.12, 0.08];
  box(Wl, c[0], c[1] - 0.3, c[2], 14, 4.4, 8, it.ry, { u: 2, top: false });
  const f = edgeFace(F.X(px - 7, pz - 4), F.X(px + 7, pz - 4));
  const ff = edgeFace(f.B, f.A);
  K.win.col = [1, 1, 1];
  for (let q = 0; q < 4; q++) { const a = (q + 0.5) * 3.5; fquad(K.win, ff, a - 1.5, a + 1.5, g + 0.4, g + 3.6, 0.05, ctwUV(q === 1 || q === 2 ? 'tdoor' : 'lattice')); }
  hipUp(K.tile, P, c[0], c[1] + 4.1, c[2], 14, 8, 1.0, it.ry, GREEN_T);
  Wl.col = [0.72, 0.12, 0.08];
  box(Wl, c[0], c[1] + 5.0, c[2], 10, 3.0, 6, it.ry, { u: 2, top: false });
  for (let q = 0; q < 3; q++) { const a = (q + 0.5) * 10 / 3; const f2 = edgeFace(F.X(px + 5, pz - 3), F.X(px - 5, pz - 3)); fquad(K.win, f2, a - 1.3, a + 1.3, g + 5.4, g + 7.6, 0.05, ctwUV('lattice')); }
  hipUp(K.tile, P, c[0], c[1] + 8.0, c[2], 10.5, 6.5, 2.6, it.ry, GREEN_T);
  P.col = RED_P;
  for (let q = 0; q < 5; q++) { const p = F.P(px - 6.4 + q * 3.2, 0, pz - 4.6); cylinder(P, p[0], p[1], p[2], 0.2, 4.2, 6); }
  // a pond with a stone bridge, bamboo, stone lanterns, tables
  const pond = [];
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; pond.push(F.X(-hw + 10 + Math.cos(a) * 6, -2 + Math.sin(a) * 4)); }
  K.water.col = [1, 1, 1];
  prism(K.water, pond, 0, 0, g - 0.2, g + 0.12, 0, { walls: false });
  K.paint.col = [0.6, 0.58, 0.54];
  prism(K.paint, inset(ccw(pond), -0.4), 0, 0, g - 0.2, g + 0.3, 0, { top: false });
  for (let q = 0; q < 14; q++) {
    const p = F.P(hw - 2 - (q % 3) * 0.8, 0, -hd + 3 + q * 1.6);
    K.leaf.col = [0.32, 0.55, 0.22];
    cylinder(K.leaf, p[0], p[1], p[2], 0.07, 5 + (q % 4), 4);
    bush(K.near.leaf, p[0], p[1] + 4.5, p[2], 0.6, 1.4, [0.3, 0.5, 0.2]);
  }
  for (const [lx, lz] of [[-4, -hd + 3], [4, -hd + 3], [hw - 6, 4]]) {
    const p = F.P(lx, 0, lz);
    K.paint.col = [0.62, 0.6, 0.56];
    box(K.paint, p[0], p[1], p[2], 0.5, 1.0, 0.5, it.ry, { u: 1 });
    K.neon.col = [1, 0.75, 0.4];
    box(K.neon, p[0], p[1] + 1.0, p[2], 0.42, 0.36, 0.42, it.ry, { u: 1 });
    K.paint.col = [0.5, 0.49, 0.46];
    cone(K.paint, p[0], p[1] + 1.36, p[2], 0.48, 0.4, 4);
  }
  for (const [lx, lz] of [[-3, 3], [3, 3], [-6, 8], [6, 7]]) {
    const p = F.P(lx, 0, lz);
    K.near.paint.col = [0.3, 0.12, 0.06];
    cylinder(K.near.paint, p[0], p[1], p[2], 0.6, 0.75, 8, { top: true });
  }
  // lanterns strung across the court
  for (const [a, b] of [[[-hw, -hd + 2], [hw, hd - 4]], [[hw, -hd + 2], [-hw, hd - 4]]]) {
    const A = F.P(a[0], 4.4, a[1]), Bq = F.P(b[0], 4.4, b[1]);
    lanternString(K.lantern, K.near.paint, A, Bq, 1.0, 1.8, a[0]);
  }
}

export { pent, metalUV, ctsHUV, cross, cylinder, box, sphere };
