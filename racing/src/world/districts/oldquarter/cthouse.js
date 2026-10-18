// PORT HALCYON — CHINATOWN's buildings: brick and painted walk-up tenements
// with fire escapes zig-zagging down their fronts, AC units in the windows,
// sheet-metal cornices and water tanks on the roofs; balconied shophouses
// under green-tiled eaves with upturned corners; tiled 1970s infill with
// ribbon windows and a billboard on top; restaurants in red and gold. Every
// one wears signs: tall lightboxes out over the pavement, neon boards, a
// signboard over each shopfront.
import { makeRng } from '../../../core/util.js';
import { box, cylinder, cone, sphere } from '../builder.js';
import { edgeFace, fquad, fwall, fbox, flat, cross } from './geo.js';
import { bandFU } from './othouse.js';
import { ctwUV, ctShopUV, ctsVUV, ctsHUV, CTSHOP } from './cttex.js';
import { metalUV } from './tex.js';

const wallAcc = (K, it) => (it.wall === 'brick' ? K.brick : K.plaster);
const NEON = [[1, 0.16, 0.3], [1, 0.3, 0.85], [0.16, 0.9, 1], [1, 0.82, 0.16], [0.5, 1, 0.35], [1, 0.55, 0.16]];

/**
 * One building. it: { poly, edges ('s'|'w'|'b'|'p'), kind ('ten'|'shop'|
 * 'mod'|'rest'), wall, col, trim, nf, gf, fh, shops, shopK, signs, fire,
 * tank, seed, lit, y0, gy }.
 */
export function ctHouse(K, it) {
  const rng = makeRng(it.seed);
  const poly = it.poly, n = poly.length;
  const top = it.gy + it.gf + it.nf * it.fh;
  const W = wallAcc(K, it);
  for (let k = 0; k < n; k++) {
    const f = edgeFace(poly[k], poly[(k + 1) % n]);
    const e = it.edges[k];
    W.col = it.col;
    fwall(W, f, 0, f.len, it.y0, top + (it.kind === 'shop' ? 0 : 1.0), 0, 2);
    if (e === 'p') continue;
    if (e === 's') streetFace(K, it, f, top, rng, k);
    else backFace(K, it, f, top, rng, e === 'w');
  }
  roof(K, it, top, rng);
}

function bays(len, want) {
  const nb = Math.max(1, Math.round(len / want));
  return { nb, bw: len / nb };
}

function winTile(rng, lit, kind) {
  if (kind === 'mod') return rng() < lit ? (rng() < 0.5 ? 'm_lit' : 'm_cool') : rng() < 0.5 ? 'm_mix' : 'm_dark';
  const r = rng();
  if (r < lit) return ['s_warm', 's_cool', 's_red', 's_aclit', 's_tv', 's_warm', 's_cool'][Math.floor(rng() * 7)];
  return ['s_dark', 's_ac', 's_grill', 's_dark', 's_ac'][Math.floor(rng() * 5)];
}

function streetFace(K, it, f, top, rng, k) {
  const len = f.len, N = K.near;
  const P = K.paint;
  // over the shops: a fascia; at the top: a bracketed cornice (tenements) or an eave (shophouses)
  P.col = it.trim;
  bandFU(P, f, -0.05, len + 0.05, it.gy + it.gf - 0.35, 0.4, 0, 0.18, 2);
  if (it.kind === 'ten' || it.kind === 'mod') {
    // (up at the roofline: no lamp light baked on it)
    const Tr = K.trim || P;
    Tr.col = it.trim;
    bandFU(Tr, f, -0.25, len + 0.25, top + 0.2, 0.7, 0, 0.6, 2);
    // the brackets under it, as a dark dentil strip
    Tr.col = [it.trim[0] * 0.5, it.trim[1] * 0.5, it.trim[2] * 0.5];
    fquad(Tr, f, -0.2, len + 0.2, top - 0.15, top + 0.2, 0.42, [0, 0, len / 0.6, 1]);
  }
  // upper floors
  if (it.kind === 'mod') {
    for (let fl = 1; fl <= it.nf; fl++) {
      const yb = it.gy + it.gf + (fl - 1) * it.fh;
      K.win.col = [1, 1, 1];
      const nseg = Math.max(1, Math.round(len / 4));
      const sw = len / nseg;
      for (let q = 0; q < nseg; q++) fquad(K.win, f, q * sw + 0.08, (q + 1) * sw - 0.08, yb + 0.7, yb + 0.7 + it.fh * 0.62, 0.04, ctwUV(winTile(rng, it.lit, 'mod')));
    }
  } else {
    const { nb, bw } = bays(len, it.kind === 'shop' ? 2.6 : 2.45);
    for (let fl = 1; fl <= it.nf; fl++) {
      const yb = it.gy + it.gf + (fl - 1) * it.fh;
      K.win.col = it.kind === 'shop' ? it.trim : [1, 1, 1];
      if (it.kind === 'shop') {
        // balcony doors behind a verandah: railing, slab, a tiled pent roof over the top floor's
        for (let b = 0; b < nb; b++) {
          const a = (b + 0.5) * bw;
          const lit = rng() < it.lit;
          fquad(K.win, f, a - 0.6, a + 0.6, yb + 0.15, yb + 2.55, 0.04, ctwUV(lit ? ['d_lit', 'd_red', 'd_green'][Math.floor(rng() * 3)] : 'd_dark'));
        }
        const Ps = K.trim || P;
        Ps.col = [0.82, 0.8, 0.74];
        bandFU(Ps, f, 0.1, len - 0.1, yb - 0.05, 0.16, 0, 1.1, 2);
        K.metal.col = it.rail;
        fquad(K.metal, f, 0.1, len - 0.1, yb + 0.11, yb + 1.15, 1.08, metalUV(1, len, 1.6));
        if (fl === it.nf || rng() < 0.4) pent(K.trim ? { ...K, paint: K.trim } : K, f, 0, len, yb + it.fh - 0.15, 1.3, it.tileCol);
        // plants on the balcony
        if (rng() < 0.5) {
          N.leaf.col = [0.18 + rng() * 0.1, 0.42, 0.16];
          const p = f.P(0.6 + rng() * (len - 1.2), yb + 0.11, 0.7);
          cross(N.leaf, p[0], p[1], p[2], 0.35, 0.7);
        }
      } else {
        for (let b = 0; b < nb; b++) {
          const a = (b + 0.5) * bw;
          const wd = Math.min(bw * 0.62, 1.0);
          // tenement windows often go in pairs: two bays as one paired window (one quad)
          if (it.kind === 'ten' && b + 1 < nb && rng() < 0.55) {
            const am = (b + 1) * bw, lit = rng() < it.lit;
            const t2 = lit ? (rng() < 0.6 ? 'p_lit' : 'p_pink') : rng() < 0.4 ? 'p_wash' : 'p_dark';
            fquad(K.win, f, am - wd, am + wd, yb + 0.75, yb + 0.75 + wd * 2, 0.04, ctwUV(t2));
            b++;
            continue;
          }
          const t = winTile(rng, it.lit, it.kind);
          fquad(K.win, f, a - wd / 2, a + wd / 2, yb + 0.75, yb + 0.75 + wd * 2, 0.04, ctwUV(t));
          // an AC unit hung out of the window now and then
          if ((t === 's_ac' || t === 's_aclit') && fl <= 3) {
            const Na = N.trim || N.paint;
            Na.col = [0.78, 0.78, 0.74];
            fbox(Na, f, a, yb + 0.85, 0, wd * 0.85, 0.5, 0.55, { u: 1, faces: 'f', top: false });
          }
        }
      }
    }
  }
  // the fire escape over two bays of the front
  if (it.fire && it.nf >= 3) fireEscape(K, f, it, rng);
  // the shopfronts
  shops(K, it, f, k, rng);
  // signs on the face: boards flush between floors, lightboxes out over the pavement
  for (const s of it.signs || []) {
    if (s.k !== k) continue;
    if (s.kind === 'h') {
      K.sign.col = [1, 1, 1];
      fquad(K.sign, f, s.a - s.w / 2, s.a + s.w / 2, s.y, s.y + s.w * 0.5, 0.12, ctsHUV(s.tile));
      neonFrame(K, f, s.a - s.w / 2, s.a + s.w / 2, s.y, s.y + s.w * 0.5, 0.14, s.neon);
    } else vSign(K, f, s);
  }
  // the restaurant's tiled canopy over its door, its lanterns
  if (it.kind === 'rest') {
    pent(K, f, 0.3, len - 0.3, it.gy + it.gf + 0.4, 1.8, [0.16, 0.5, 0.3]);
    for (let a = 1.2; a < len - 0.8; a += 2.4) {
      const p = f.P(a, it.gy + it.gf + 0.1, 1.3);
      K.lanternFn(K.lantern, p[0], p[1], p[2], a, 0.9);
    }
  }
}

/** A tiled pent roof along a face: out `d` and down, its ends turned up (green glaze or red). */
export function pent(K, f, a0, a1, y, d, col) {
  const T = K.tile, P = K.paint;
  const n = 2, drop = d * 0.5;
  for (let q = 0; q < n; q++) {
    const s0 = a0 + (a1 - a0) * q / n, s1 = a0 + (a1 - a0) * (q + 1) / n;
    const lift = (s) => { const t = Math.abs((s - a0) / (a1 - a0) * 2 - 1); return Math.pow(t, 4) * 0.45; };
    const e0 = y - drop + lift(s0), e1 = y - drop + lift(s1);
    T.col = col;
    T.quadP(f.P(s0, e0, d), f.P(s1, e1, d), f.P(s1, y, 0.02), f.P(s0, y, 0.02), [s0 / 2, 0, s1 / 2, d / 2]);
    P.col = [0.45, 0.08, 0.06];
    P.quadP(f.P(s1, e1 - 0.02, d), f.P(s0, e0 - 0.02, d), f.P(s0, y - 0.02, 0.02), f.P(s1, y - 0.02, 0.02));
    // the fascia board along the eave
    P.col = [0.6, 0.1, 0.08];
    P.quadP(f.P(s0, e0 - 0.16, d + 0.02), f.P(s1, e1 - 0.16, d + 0.02), f.P(s1, e1, d + 0.02), f.P(s0, e0, d + 0.02));
  }
  // a ridge tile along the wall
  T.col = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8];
  fquad(T, f, a0 - 0.1, a1 + 0.1, y - 0.05, y + 0.15, 0.25, [0, 0, (a1 - a0) / 2, 0.1]);
}

/** A neon tube round a rectangle on a face. */
function neonFrame(K, f, a0, a1, y0, y1, o, col) {
  const G = K.neon, t = 0.05;
  G.col = col;
  fquad(G, f, a0 - t, a1 + t, y0 - t, y0 + t, o);
  fquad(G, f, a0 - t, a1 + t, y1 - t, y1 + t, o);
  fquad(G, f, a0 - t, a0 + t, y0, y1, o);
  fquad(G, f, a1 - t, a1 + t, y0, y1, o);
}

/** A lightbox sign out from the wall: both faces lit, a neon edge, its bracket. */
function vSign(K, f, s) {
  const S = K.sign, G = K.neon;
  const out0 = 0.35, out1 = out0 + s.w;
  // two faces (the sign stands square to the wall): along the normal, up
  const P = (o, y, side) => { const p = f.P(s.a + side * 0.12, y, o); return p; };
  S.col = [1, 1, 1];
  const uv = ctsVUV(s.tile);
  // the face seen from the a+ side, then the a− side
  // (a quad running outward faces −a: so that one goes on the −a side, its mirror on the +a side)
  S.quadP(P(out0, s.y, -1), P(out1, s.y, -1), P(out1, s.y + s.h, -1), P(out0, s.y + s.h, -1), uv);
  S.quadP(P(out1, s.y, 1), P(out0, s.y, 1), P(out0, s.y + s.h, 1), P(out1, s.y + s.h, 1), uv);
  // its edges, the neon round it (the neon-lettered ones: lightboxes glow all over)
  G.col = s.neon;
  const t = 0.07;
  for (const side of s.tile % 3 === 1 ? [1, -1] : []) {
    const q = (o0, o1, y0, y1) => (side > 0
      ? G.quadP(P(o1, y0, 1.15), P(o0, y0, 1.15), P(o0, y1, 1.15), P(o1, y1, 1.15))
      : G.quadP(P(o0, y0, -1.15), P(o1, y0, -1.15), P(o1, y1, -1.15), P(o0, y1, -1.15)));
    q(out0 - t, out1 + t, s.y - t, s.y + t);
    q(out0 - t, out1 + t, s.y + s.h - t, s.y + s.h + t);
    q(out1 - t, out1 + t, s.y, s.y + s.h);
    q(out0 - t, out0 + t, s.y, s.y + s.h);
  }
  const Tr = K.trim || K.paint;
  Tr.col = [0.12, 0.12, 0.13];
  Tr.quadP(f.P(s.a, s.y + s.h - 0.34, out0 + 0.1), f.P(s.a, s.y + s.h - 0.34, 0), f.P(s.a, s.y + s.h - 0.26, 0), f.P(s.a, s.y + s.h - 0.26, out0 + 0.1));
  Tr.quadP(f.P(s.a, s.y + s.h - 0.34, 0), f.P(s.a, s.y + s.h - 0.34, out0 + 0.1), f.P(s.a, s.y + s.h - 0.26, out0 + 0.1), f.P(s.a, s.y + s.h - 0.26, 0));
  // the side edge strips (the box's thickness), dark
  Tr.col = [0.1, 0.1, 0.1];
  Tr.quadP(P(out1, s.y, -1), P(out1, s.y, 1), P(out1, s.y + s.h, 1), P(out1, s.y + s.h, -1));
}

/** A fire escape: a landing at each floor over two bays, stairs between them, a drop ladder. */
function fireEscape(K, f, it, rng) {
  // (close up only: past a few hundred metres it is a hatching nobody sees; unlit, above the lamps)
  const N = K.near, M = K.near.metalHi || K.near.metal;
  const w = Math.min(f.len - 0.6, 4.6), a0 = it.fireA ?? Math.max(0.3, (f.len - w) / 2), a1 = a0 + w;
  const dep = 1.25;
  M.col = [0.16, 0.16, 0.17];
  N.paint.col = [0.14, 0.14, 0.15];
  for (let fl = 1; fl <= it.nf; fl++) {
    const y = it.gy + it.gf + (fl - 1) * it.fh;
    // the landing (grating, from below and above) and its railing on three sides
    M.quadP(f.P(a0, y, dep), f.P(a1, y, dep), f.P(a1, y, 0.02), f.P(a0, y, 0.02), metalUV(2, w, 0.8));
    M.quadP(f.P(a0, y, dep), f.P(a1, y, dep), f.P(a1, y + 1.0, dep), f.P(a0, y + 1.0, dep), metalUV(1, w, 1.6));
    // the stair up to the next landing (alternating direction)
    if (fl < it.nf) {
      const dir = fl % 2;
      const s0 = dir ? a0 + 0.3 : a1 - 0.3, s1 = dir ? a1 - 1.2 : a0 + 1.2;
      const yn = y + it.fh;
      const o0 = 0.15, o1 = 0.85;
      const A = f.P(s0, y, o0), B = f.P(s0, y, o1), C = f.P(s1, yn, o1), D = f.P(s1, yn, o0);
      M.quadP(A, B, C, D, metalUV(2, 0.7, 0.7));
    }
  }
  // the drop ladder under the lowest landing
  const yl = it.gy + it.gf;
  const L0 = f.P(a1 - 0.9, yl - 2.4, dep - 0.1), L1 = f.P(a1 - 0.35, yl - 2.4, dep - 0.1);
  M.quadP(L0, L1, [L1[0], yl, L1[2]], [L0[0], yl, L0[2]], [0, 1 - 510 / 512, 0.25, 1 - 386 / 512]);
  void rng;
}

const SHUTTER = new Set([9, 10]);
function shops(K, it, f, k, rng) {
  const len = f.len;
  let units = it.shops && k === (it.shopK || 0) ? it.shops : null;
  if (!units) {
    const nu = Math.max(1, Math.round(len / 5));
    units = [];
    for (let u = 0; u < nu; u++) units.push(Math.floor(rng() * CTSHOP.length));
  }
  const uw = len / units.length;
  const h = Math.min(it.gf - 0.45, 4.1);
  for (let u = 0; u < units.length; u++) {
    const a0 = u * uw + 0.1, a1 = (u + 1) * uw - 0.1;
    const t = units[u];
    K.shop.col = [1, 1, 1];
    fquad(K.shop, f, a0, a1, it.gy, it.gy + h, 0.03, ctShopUV(t));
    // grocers put their fruit out on the pavement under an awning
    if (CTSHOP[t].kind === 'grocer') fruitStand(K, f, a0 + 0.3, a1 - 0.3, it.gy, rng);
    else if (!SHUTTER.has(t) && rng() < 0.45) awningCT(K, f, a0 + 0.1, a1 - 0.1, it.gy + h - 0.2, rng);
  }
}

function awningCT(K, f, a0, a1, y, rng) {
  const P = K.paint;
  const c = [[0.75, 0.08, 0.1], [0.95, 0.75, 0.1], [0.1, 0.4, 0.25], [0.12, 0.2, 0.5], [0.95, 0.95, 0.92]][Math.floor(rng() * 5)];
  P.col = c;
  P.quadP(f.P(a0, y - 0.6, 1.5), f.P(a1, y - 0.6, 1.5), f.P(a1, y, 0.04), f.P(a0, y, 0.04));
  P.quadP(f.P(a0, y - 0.95, 1.5), f.P(a1, y - 0.95, 1.5), f.P(a1, y - 0.6, 1.5), f.P(a0, y - 0.6, 1.5));
  P.col = [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45];
  P.quadP(f.P(a1, y - 0.6, 1.48), f.P(a0, y - 0.6, 1.48), f.P(a0, y, 0.03), f.P(a1, y, 0.03));
}

function fruitStand(K, f, a0, a1, y, rng) {
  const N = K.near, P = K.paint;
  P.col = [0.1, 0.42, 0.2];
  P.quadP(f.P(a0, y + 2.6, 1.9), f.P(a1, y + 2.6, 1.9), f.P(a1, y + 3.3, 0.04), f.P(a0, y + 3.3, 0.04));
  P.col = [0.05, 0.2, 0.1];
  P.quadP(f.P(a1, y + 2.6, 1.88), f.P(a0, y + 2.6, 1.88), f.P(a0, y + 3.3, 0.03), f.P(a1, y + 3.3, 0.03));
  // crates, stepped, heaped with fruit
  const fr = [[0.9, 0.2, 0.1], [1, 0.6, 0.1], [0.5, 0.75, 0.2], [0.95, 0.85, 0.2], [0.6, 0.15, 0.4]];
  for (let a = a0 + 0.4; a < a1 - 0.3; a += 0.75) {
    for (const [o, hh] of [[0.8, 0.5]]) {
      N.paint.col = [0.55, 0.4, 0.25];
      fbox(N.paint, f, a, y, o - 0.27, 0.68, hh, 0.5, { u: 1 });
      N.leaf.col = fr[Math.floor(rng() * fr.length)];
      fbox(N.leaf, f, a, y + hh, o - 0.24, 0.6, 0.12, 0.44, { u: 1, faces: 'f' });
    }
  }
}

function backFace(K, it, f, top, rng, full) {
  // (a back on the block's interior is seen by nobody: only a side on a street or alley is dressed)
  if (!full) return;
  const { nb, bw } = bays(f.len, 2.6);
  const Wn = full ? K.win : K.near.win;
  Wn.col = [1, 1, 1];
  for (let fl = 1; fl <= it.nf; fl++) {
    const yb = it.gy + it.gf + (fl - 1) * it.fh;
    for (let b = 0; b < nb; b++) {
      if (!full && (b + fl) % 2 && nb > 1) continue;
      const a = (b + 0.5) * bw;
      fquad(Wn, f, a - 0.45, a + 0.45, yb + 0.8, yb + 2.6, 0.04, ctwUV(winTile(rng, it.lit * 0.8, 'ten')));
    }
  }
  // the alley side: an AC condenser, pipes, a back door with a bare bulb
  if (rng() < 0.6) {
    const N = K.near;
    N.paint.col = [0.72, 0.72, 0.68];
    fbox(N.paint, f, f.len * 0.3, it.gy + it.gf + 0.4, 0, 0.9, 0.7, 0.45, { u: 1, faces: 'f' });
    N.paint.col = [0.4, 0.42, 0.44];
    fquad(N.paint, f, f.len * 0.75 - 0.07, f.len * 0.75 + 0.07, it.y0, top, 0.08);
  }
  if (full && rng() < 0.25 && it.fire && it.nf >= 3) fireEscape(K, f, { ...it, fireA: Math.max(0.3, f.len / 2 - 2.3) }, rng);
}

// ------------------------------------------------------------------ roofs

function roof(K, it, top, rng) {
  // (the roofs take no baked lamp light: K.trim, a plain material)
  K = K.trim ? { ...K, paint: K.trim, near: { ...K.near, paint: K.near.trim || K.near.paint } } : K;
  const poly = it.poly;
  const yr = top + (it.kind === 'shop' ? 0 : 1.0);
  K.paint.col = [0.3, 0.3, 0.32];
  flat(K.paint, poly, yr - 0.05, 2);
  const c = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
  const f0 = edgeFace(poly[0], poly[1]);
  if (it.kind === 'shop') {
    // a tiled hip roof with turned-up eaves on the shophouses
    const T = K.tile;
    T.col = it.tileCol;
    const L = it.rect;
    if (L) {
      const rise = Math.min(L.w, L.d) * 0.3;
      hipUp(T, K.paint, L.x, yr, L.z, L.w, L.d, rise, L.ry, it.tileCol);
    }
    return;
  }
  if (it.rear) return;
  // tenements: a stair bulkhead, a water tank on legs, antennas, washing
  K.paint.col = [it.col[0] * 0.8, it.col[1] * 0.8, it.col[2] * 0.8];
  const bp = [c[0] + f0.nx * -2, c[1] + f0.nz * -2];
  if (it.seed % 5 < 2) box(K.paint, bp[0], yr - 0.05, bp[1], 3, 2.6, 3.4, f0.ry, { u: 1, faces: 'flr' });
  if (it.tank) tank(K, c[0] - f0.tx * 2.5 - f0.nx * 1, yr, c[1] - f0.tz * 2.5 - f0.nz * 1);
  const N = K.near;
  N.paint.col = [0.2, 0.2, 0.22];
  if (rng() < 0.6) {
    const ax = c[0] + (rng() - 0.5) * 6, az = c[1] + (rng() - 0.5) * 6, h = 3 + rng() * 2.5;
    N.paint.quadP([ax - 0.04, yr, az], [ax + 0.04, yr, az], [ax + 0.04, yr + h, az], [ax - 0.04, yr + h, az]);
    N.paint.quadP([ax - 0.7, yr + h - 0.5, az], [ax + 0.7, yr + h - 0.5, az], [ax + 0.7, yr + h - 0.44, az], [ax - 0.7, yr + h - 0.44, az]);
  }
  if (rng() < 0.4) {
    N.paint.col = [0.86, 0.86, 0.84];
    const dx = c[0] + (rng() - 0.5) * 5, dz = c[1] + (rng() - 0.5) * 5;
    cone(N.paint, dx, yr + 0.5, dz, 0.55, 0.35, 6);
  }
  if (it.kind === 'mod' && it.billboard !== undefined) {
    // a billboard on the roof, lit
    const p = f0.P(f0.len / 2, yr, -1.2);
    N.paint.col = [0.18, 0.18, 0.2];
    for (const s of [-1, 1]) { const q = f0.P(f0.len / 2 + s * 2.4, yr, -1.2); cylinder(K.paint, q[0], yr, q[2], 0.08, 2.2, 4); }
    K.sign.col = [1, 1, 1];
    const w = Math.min(f0.len - 1, 8);
    fquad(K.sign, f0, f0.len / 2 - w / 2, f0.len / 2 + w / 2, yr + 2.2, yr + 2.2 + w * 0.5, -1.15, ctsHUV(it.billboard));
    void p;
  }
}

/** A hipped roof with turned-up corners and a ridge (tiles), red rafters under the eaves. */
export function hipUp(T, P, x, y, z, w, d, rise, ry, col) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = (lx, lz, ly) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const ov = 0.9, hw = w / 2 + ov, hd = d / 2 + ov, r = Math.max(0.5, hw - hd);
  const up = 0.55;
  T.col = col;
  // each slope as a strip with lifted ends
  const slope = (a, b, A, B, n = 3) => {
    for (let q = 0; q < n; q++) {
      const t0 = q / n, t1 = (q + 1) / n;
      const e0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], e1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      const l0 = Math.pow(Math.abs(t0 * 2 - 1), 4) * up, l1 = Math.pow(Math.abs(t1 * 2 - 1), 4) * up;
      const r0 = [A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0], r1 = [A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1];
      T.quadP(W(e0[0], e0[1], l0), W(e1[0], e1[1], l1), W(r1[0], r1[1], rise), W(r0[0], r0[1], rise), [0, 0, 1, 1]);
      P.quadP(W(e1[0], e1[1], l1 - 0.05), W(e0[0], e0[1], l0 - 0.05), W(r0[0], r0[1], rise - 0.4), W(r1[0], r1[1], rise - 0.4));
    }
  };
  P.col = [0.5, 0.08, 0.06];
  slope([-hw, hd], [hw, hd], [-r, 0], [r, 0], 2);
  slope([hw, -hd], [-hw, -hd], [r, 0], [-r, 0], 2);
  slope([hw, hd], [hw, -hd], [r, 0], [r, 0], 1);
  slope([-hw, -hd], [-hw, hd], [-r, 0], [-r, 0], 1);
  // the ridge and its end flourishes
  T.col = [col[0] * 0.75, col[1] * 0.75, col[2] * 0.75];
  const m = W(0, 0, rise);
  box(T, m[0], m[1] - 0.05, m[2], 2 * r + 0.6, 0.35, 0.35, ry, { u: 1 });
  for (const e of [-1, 1]) {
    const p = W(e * (r + 0.3), 0, rise + 0.3);
    cone(T, p[0], p[1] - 0.1, p[2], 0.22, 0.7, 4);
  }
}

/** A rooftop water tank: staves on a steel frame, a conical cap. */
export function tank(K, x, y, z) {
  const P = K.paint;
  P.col = [0.2, 0.2, 0.21];
  box(P, x, y, z, 2.4, 2.2, 2.4, 0, { u: 1, top: false, faces: 'fb' });
  P.col = [0.45, 0.33, 0.24];
  cylinder(P, x, y + 2.2, z, 1.7, 3.2, 6, { u: 0.5 });
  P.col = [0.3, 0.26, 0.22];
  cone(P, x, y + 5.4, z, 1.85, 1.0, 6);
}
