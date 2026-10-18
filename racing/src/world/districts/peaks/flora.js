// PORT HALCYON — the mountains' trees, shrubs, grass and rocks: low-poly,
// vertex-coloured (one material draws every kind), each kind its own
// silhouette so no two forests read alike: Kaido's sugi cedars in their dark
// plantation rows, bamboo and red maples; the Summit's snow-laden firs; the
// Ridgeline's wind-bent krummholz pines and golden tussocks; the North
// Woods' towering Douglas firs, ponderosa pines, snags, logs and ferns.
// Every function takes an accumulator (B.acc(mat) of a vertexColors
// material) and writes world-space geometry; colours are linear [r, g, b].
import { mixc, mulc } from './util.js';

const TAU = Math.PI * 2;

/** A tapered trunk: n-sided, from y0 radius r0 to y1 radius r1 (no caps). Optional lean (dx, dz at the top). */
export function trunk(acc, x, y0, z, r0, y1, r1, col, n = 4, rot = 0, lx = 0, lz = 0) {
  acc.col = col;
  const b = acc.count;
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * TAU, c = Math.cos(a), s = Math.sin(a);
    acc.v(x + c * r0, y0, z + s * r0, k / n, 0);
    acc.v(x + lx + c * r1, y1, z + lz + s * r1, k / n, 1);
  }
  for (let k = 0; k < n; k++) {
    const a0 = b + k * 2, a1 = b + ((k + 1) % n) * 2;
    acc.tri(a1, a0, a0 + 1);
    acc.tri(a1, a0 + 1, a1 + 1);
  }
}

/**
 * A conical tier of foliage: base ring at y (radius r, n points alternating
 * out/in for a ragged edge, the outer points drooping), apex h above.
 * colIn/colOut: inner and outer ring colours, colTop the apex. under: also
 * close the underside (seen from below on the lowest tier).
 */
export function tier(acc, x, y, z, r, h, n, rot, droop, colIn, colOut, colTop, under = false, ox = 0, oz = 0) {
  const b = acc.count;
  for (let k = 0; k < n; k++) {
    const out = k % 2 === 0;
    const a = rot + (k / n) * TAU;
    const rr = out ? r : r * 0.72;
    acc.col = out ? colOut : colIn;
    acc.v(x + Math.cos(a) * rr, y - (out ? droop : 0), z + Math.sin(a) * rr, k / n, 0);
  }
  acc.col = colTop;
  const t = acc.v(x + ox, y + h, z + oz, 0.5, 1);
  for (let k = 0; k < n; k++) acc.tri(b + ((k + 1) % n), b + k, t);
  if (under) {
    acc.col = colIn;
    const u = acc.v(x, y + h * 0.12, z, 0.5, 0.5);
    for (let k = 0; k < n; k++) acc.tri(b + k, b + ((k + 1) % n), u);
  }
}

/** A lumpy blob (crowns, bushes): two rings and two poles, squashed by sy. */
export function blob(acc, x, y, z, r, sy, n, rot, colLo, colHi, jit = 0.18, seed = 0.5) {
  const b = acc.count;
  const J = (k) => 1 + (((k * 7919 + seed * 997) % 13) / 13 - 0.5) * 2 * jit;
  acc.col = colLo;
  const bot = acc.v(x, y - r * sy, z, 0.5, 0);
  for (let ring = 0; ring < 2; ring++) {
    const yy = y + (ring ? 0.35 : -0.35) * r * sy;
    acc.col = ring ? colHi : colLo;
    for (let k = 0; k < n; k++) {
      const a = rot + ((k + ring * 0.5) / n) * TAU, rr = r * 0.95 * J(k + ring * n);
      acc.v(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr, k / n, ring);
    }
  }
  acc.col = colHi;
  const top = acc.v(x, y + r * sy * J(3), z, 0.5, 1);
  const r0 = bot + 1, r1 = bot + 1 + n;
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n;
    acc.tri(r0 + k, r0 + k1, bot);
    acc.tri(r0 + k1, r0 + k, r1 + k);
    acc.tri(r0 + k1, r1 + k, r1 + k1);
    acc.tri(r1 + k1, r1 + k, top);
  }
}

// ------------------------------------------------------------------ Kaido

/** Sugi (Japanese cedar): straight red-brown trunk, a narrow dark spire of drooping tiers. lod 0 near, 1 far. */
export function sugi(acc, x, y, z, H, t, pal, lod = 0) {
  const k = 0.88 + t * 0.24;
  const base = mulc(pal.cedar, k), tip = mulc(pal.cedarTip, k), top = mulc(pal.cedarTop, k);
  const rot = t * TAU;
  if (lod) {
    trunk(acc, x, y - 0.5, z, 0.32, y + H * 0.35, 0.22, pal.bark, 3, rot);
    tier(acc, x, y + H * 0.22, z, H * 0.11, H * 0.8, 6, rot, H * 0.02, base, tip, top);
    return;
  }
  trunk(acc, x, y - 0.6, z, 0.38 + H * 0.004, y + H * 0.62, 0.16, pal.bark, 5, rot);
  const tiers = 4;
  for (let q = 0; q < tiers; q++) {
    const f = q / tiers;
    const by = y + H * (0.26 + f * 0.5);
    const r = H * (0.115 - f * 0.024);
    tier(acc, x, by, z, r, H * (0.34 - f * 0.04), 8, rot + q * 0.7, H * 0.025, base, tip, q === tiers - 1 ? top : mixc(base, tip, 0.5), q === 0);
  }
}

/** A bamboo clump: thin green culms leaning out, each with a feathery top. */
export function bamboo(acc, x, y, z, H, t, pal, n = 7) {
  for (let q = 0; q < n; q++) {
    const a = t * TAU + q * 2.4, d = 0.4 + (q % 3) * 0.45;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d;
    const h = H * (0.7 + ((q * 37) % 10) / 30);
    const lx = Math.cos(a) * h * 0.12, lz = Math.sin(a) * h * 0.12;
    trunk(acc, bx, y - 0.2, bz, 0.09, y + h, 0.05, q % 2 ? pal.culm : pal.culm2, 3, a, lx, lz);
    blob(acc, bx + lx * 0.95, y + h * 0.86, bz + lz * 0.95, h * 0.16, 1.4, 4, a, pal.bambooLeaf, pal.bambooLeafHi, 0.3, q);
  }
}

/** Momiji (Japanese maple): a low spreading crown, red/orange by the shrine and the tea house. */
export function maple(acc, x, y, z, H, t, pal) {
  const rot = t * TAU;
  trunk(acc, x, y - 0.3, z, 0.22, y + H * 0.45, 0.12, pal.mapleBark, 4, rot, 0.3, 0.1);
  const c0 = t < 0.5 ? pal.maple : pal.maple2;
  blob(acc, x + 0.4, y + H * 0.62, z, H * 0.42, 0.55, 6, rot, mulc(c0, 0.7), c0, 0.25, t * 9);
  blob(acc, x - 0.8, y + H * 0.5, z + 0.6, H * 0.28, 0.55, 5, rot + 1, mulc(c0, 0.6), mulc(c0, 0.95), 0.25, t * 13);
}

// ------------------------------------------------------------------ Summit

/** A snow-laden fir: stubby dark tiers frosted white at the tips, a white crown. */
export function snowFir(acc, x, y, z, H, t, pal, snow = 1, lod = 0) {
  const rot = t * TAU;
  const k = 0.85 + t * 0.3;
  const green = mulc(pal.fir, k);
  const frost = mixc(green, pal.snow, 0.55 * snow), top = mixc(green, pal.snow, 0.85 * snow);
  if (lod) {
    trunk(acc, x, y - 0.4, z, 0.25, y + H * 0.2, 0.18, pal.bark, 3, rot);
    tier(acc, x, y + H * 0.12, z, H * 0.26, H * 0.88, 6, rot, H * 0.03, green, frost, top);
    return;
  }
  trunk(acc, x, y - 0.5, z, 0.3, y + H * 0.3, 0.16, pal.bark, 4, rot);
  const tiers = 4;
  for (let q = 0; q < tiers; q++) {
    const f = q / tiers;
    tier(acc, x, y + H * (0.12 + f * 0.6), z, H * (0.3 - f * 0.065), H * (0.36 - f * 0.05), 8, rot + q * 0.9, H * 0.05, green, frost, q === tiers - 1 ? pal.snow : top, q === 0);
  }
}

// ------------------------------------------------------------------ Ridgeline

/** Krummholz: a short pine bent by the wind, its crown flagged downwind (+wx, +wz). */
export function krummholz(acc, x, y, z, H, t, pal, wx = 1, wz = 0.2) {
  const rot = t * TAU;
  const lean = H * (0.25 + t * 0.2);
  trunk(acc, x, y - 0.3, z, 0.2 + H * 0.02, y + H * 0.55, 0.08, pal.krumBark, 4, rot, wx * lean, wz * lean);
  const c = mulc(pal.krum, 0.85 + t * 0.3), hi = mulc(pal.krumHi, 0.85 + t * 0.3);
  // flat pads of needles streaming downwind
  for (let q = 0; q < 3; q++) {
    const f = q / 3;
    const px = x + wx * lean * (0.4 + f * 0.7), pz = z + wz * lean * (0.4 + f * 0.7);
    blob(acc, px + wx * H * 0.18, y + H * (0.35 + f * 0.25), pz + wz * H * 0.18, H * (0.34 - f * 0.08), 0.35, 5, rot + q, c, hi, 0.3, t * 7 + q);
  }
}

/** A silvered dead snag (Ridgeline's and the Woods'): a bare tapering trunk, a broken top, stubs. */
export function snag(acc, x, y, z, H, t, col) {
  const rot = t * TAU;
  trunk(acc, x, y - 0.5, z, 0.32, y + H, 0.08, col, 4, rot, 0.4 * Math.cos(rot), 0.4 * Math.sin(rot));
  for (let q = 0; q < 3; q++) {
    const a = rot + q * 2.1, yy = y + H * (0.45 + q * 0.15), l = H * 0.12;
    acc.col = col;
    acc.beam(x, yy, z, x + Math.cos(a) * l, yy + l * 0.4, z + Math.sin(a) * l, 0.1, 0.1);
  }
}

/** Tussock: a golden clump of grass blades (4-sided spiky cone). */
export function tussock(acc, x, y, z, s, t, pal) {
  const c = mixc(pal.grass, pal.grassHi, t);
  tier(acc, x, y - 0.05, z, 0.45 * s, 0.75 * s, 6, t * TAU, -0.05, mulc(c, 0.6), c, mixc(c, pal.grassTip, 0.6));
}

// ------------------------------------------------------------------ North Woods

/** Douglas fir: very tall, bare lower trunk, a long ragged spire. */
export function dougFir(acc, x, y, z, H, t, pal, lod = 0) {
  const rot = t * TAU, k = 0.85 + t * 0.3;
  const c = mulc(pal.fir, k), cTip = mulc(pal.firTip, k);
  if (lod) {
    trunk(acc, x, y - 0.5, z, 0.45, y + H * 0.45, 0.3, pal.bark, 3, rot);
    tier(acc, x, y + H * 0.32, z, H * 0.1, H * 0.7, 6, rot, H * 0.02, c, cTip, cTip);
    return;
  }
  trunk(acc, x, y - 0.6, z, 0.5 + H * 0.006, y + H * 0.7, 0.2, pal.bark, 5, rot);
  const tiers = 5;
  for (let q = 0; q < tiers; q++) {
    const f = q / tiers;
    tier(acc, x, y + H * (0.3 + f * 0.55), z, H * (0.12 - f * 0.018), H * (0.24 - f * 0.02), 8, rot + q * 1.3, H * 0.03, c, cTip, cTip, q === 0);
  }
}

/** Ponderosa pine: a tall orange-brown trunk, bare, a lumpy rounded crown on top. */
export function ponderosa(acc, x, y, z, H, t, pal, lod = 0) {
  const rot = t * TAU, k = 0.85 + t * 0.3;
  const c = mulc(pal.pine, k), hi = mulc(pal.pineHi, k);
  trunk(acc, x, y - 0.5, z, 0.45, y + H * 0.82, 0.22, pal.pineBark, lod ? 3 : 5, rot);
  if (lod) { blob(acc, x, y + H * 0.82, z, H * 0.17, 0.8, 5, rot, c, hi, 0.2, t * 5); return; }
  blob(acc, x, y + H * 0.8, z, H * 0.17, 0.75, 6, rot, c, hi, 0.25, t * 5);
  blob(acc, x + H * 0.08, y + H * 0.68, z - H * 0.05, H * 0.12, 0.7, 5, rot + 1, mulc(c, 0.9), hi, 0.3, t * 11);
}

/** A fallen log lying along ry (6-sided, bark sides, pale cut ends). */
export function log(acc, x, y, z, L, r, ry, bark, cut) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const hx = c * L / 2, hz = -s * L / 2;
  const n = 6, b = acc.count;
  acc.col = bark;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const oy = Math.sin(a) * r, oo = Math.cos(a) * r;
    acc.v(x - hx + s * oo, y + r + oy, z - hz + c * oo, 0, k / n);
    acc.v(x + hx + s * oo, y + r + oy, z + hz + c * oo, 1, k / n);
  }
  for (let k = 0; k < n; k++) {
    const a0 = b + k * 2, a1 = b + ((k + 1) % n) * 2;
    acc.tri(a0, a0 + 1, a1);
    acc.tri(a1, a0 + 1, a1 + 1);
  }
  acc.col = cut;
  for (const e of [-1, 1]) {
    const cb = acc.count;
    acc.v(x + e * hx, y + r, z + e * hz, 0.5, 0.5);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      acc.v(x + e * hx + s * Math.cos(a) * r, y + r + Math.sin(a) * r, z + e * hz + c * Math.cos(a) * r, 0, 0);
    }
    for (let k = 0; k < n; k++) { if (e > 0) acc.tri(cb, cb + 1 + ((k + 1) % n), cb + 1 + k); else acc.tri(cb, cb + 1 + k, cb + 1 + ((k + 1) % n)); }
  }
}

/** A stump: a short trunk with a pale cut top. */
export function stump(acc, x, y, z, r, h, bark, cut, t = 0) {
  trunk(acc, x, y - 0.3, z, r * 1.15, y + h, r, bark, 6, t * TAU);
  acc.col = cut;
  const b = acc.count;
  acc.v(x, y + h, z, 0.5, 0.5);
  for (let k = 0; k < 6; k++) { const a = t * TAU + (k / 6) * TAU; acc.v(x + Math.cos(a) * r, y + h, z + Math.sin(a) * r, 0, 0); }
  for (let k = 0; k < 6; k++) acc.tri(b, b + 1 + ((k + 1) % 6), b + 1 + k);
}

/** A fern: fronds arching out from a centre. */
export function fern(acc, x, y, z, s, t, col, colTip) {
  const n = 6;
  for (let k = 0; k < n; k++) {
    const a = t * TAU + (k / n) * TAU;
    const c = Math.cos(a), sn = Math.sin(a);
    const b = acc.count;
    acc.col = col;
    acc.v(x - sn * 0.12 * s, y + 0.1, z + c * 0.12 * s, 0, 0);
    acc.v(x + sn * 0.12 * s, y + 0.1, z - c * 0.12 * s, 1, 0);
    acc.col = colTip;
    acc.v(x + c * 0.7 * s - sn * 0.22 * s, y + 0.55 * s, z + sn * 0.7 * s + c * 0.22 * s, 0, 1);
    acc.v(x + c * 0.7 * s + sn * 0.22 * s, y + 0.55 * s, z + sn * 0.7 * s - c * 0.22 * s, 1, 1);
    acc.v(x + c * 1.25 * s, y + 0.2 * s, z + sn * 1.25 * s, 0.5, 1);
    acc.tri(b, b + 1, b + 3); acc.tri(b, b + 3, b + 2); acc.tri(b + 2, b + 3, b + 4);
    acc.tri(b, b + 3, b + 1); acc.tri(b, b + 2, b + 3); acc.tri(b + 2, b + 4, b + 3);
  }
}

// ------------------------------------------------------------------ rocks

/**
 * A rock: a jittered low-poly lump, s across, flattened by sy, sunk into the
 * ground. cap: colour of its top (snow on the Summit), capT how much of it.
 */
export function rock(acc, x, y, z, s, sy, t, col, colDark, cap = null, capT = 0) {
  const n = 6, rot = t * TAU;
  const J = (k) => 0.78 + (((k * 2654435761 + Math.floor(t * 1e6)) >>> 0) % 1000) / 1000 * 0.44;
  const b = acc.count;
  acc.col = colDark;
  acc.v(x, y - s * sy * 0.5, z, 0.5, 0);
  for (let ring = 0; ring < 2; ring++) {
    const yy = y + (ring ? 0.32 : -0.15) * s * sy;
    acc.col = ring ? (cap && capT > 0.5 ? mixc(col, cap, capT) : col) : colDark;
    for (let k = 0; k < n; k++) {
      const a = rot + ((k + ring * 0.5) / n) * TAU, rr = s * 0.55 * J(k + ring * 7) * (ring ? 0.82 : 1);
      acc.v(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr * (0.75 + t * 0.4), k / n, ring);
    }
  }
  acc.col = cap && capT > 0 ? mixc(col, cap, Math.min(1, capT * 1.4)) : col;
  const top = acc.v(x + s * 0.08, y + s * sy * 0.62 * J(5), z - s * 0.05, 0.5, 1);
  const r0 = b + 1, r1 = b + 1 + n;
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n;
    acc.tri(r0 + k, r0 + k1, b);
    acc.tri(r0 + k1, r0 + k, r1 + k);
    acc.tri(r0 + k1, r1 + k, r1 + k1);
    acc.tri(r1 + k1, r1 + k, top);
  }
}

/**
 * A crag: a cluster of tilted rock slabs standing out of the ground
 * (Ridgeline's spine, the Summit's outcrops). h tall.
 */
export function crag(acc, x, y, z, h, t, col, colDark, cap = null) {
  const n = 3 + Math.floor(t * 3);
  for (let q = 0; q < n; q++) {
    const a = t * 9 + q * 2.3, d = h * 0.25 * (q ? 1 : 0);
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    const hh = h * (1 - q * 0.18), w = h * (0.35 + ((q * 7) % 5) * 0.05);
    const b = acc.count;
    const ry = a * 0.7, c = Math.cos(ry), s = Math.sin(ry);
    const lean = 0.18 * h * (q % 2 ? 1 : -1);
    const P = (lx, ly, lz) => [px + lx * c + lz * s + (ly / hh) * lean * c, y + ly, pz - lx * s + lz * c - (ly / hh) * lean * s];
    const ring = [[-w / 2, -w * 0.3], [w / 2, -w * 0.35], [w * 0.55, w * 0.25], [0, w * 0.4], [-w * 0.5, w * 0.2]];
    acc.col = colDark;
    for (const [lx, lz] of ring) acc.v(...P(lx, -1.5, lz), 0, 0);
    acc.col = cap ? mixc(col, cap, 0.25) : col;
    for (const [lx, lz] of ring) acc.v(...P(lx * 0.55, hh * 0.85, lz * 0.55), 0, 1);
    acc.col = cap || col;
    const top = acc.v(...P(w * 0.1, hh, 0), 0.5, 1);
    for (let k = 0; k < 5; k++) {
      const k1 = (k + 1) % 5;
      acc.tri(b + k1, b + k, b + 5 + k);
      acc.tri(b + k1, b + 5 + k, b + 5 + k1);
      acc.tri(b + 5 + k1, b + 5 + k, top);
    }
  }
}
