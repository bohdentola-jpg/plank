// PORT HALCYON — the coast's country pieces (Halcyon Point, Bayshore):
// clapboard cottages and glass houses on the cliffs, dry-stone walls,
// picket fences, rocks, parked cars, lamp posts.
import { litMat, box, gable, hip } from '../builder.js';
import { cmat, C, col, frame, lbox, tube } from './kit.js';
import { cottageTexture, glassTexture } from './tex.js';

/** Materials for houses (shared by the coast packs). */
export function homeMats(B) {
  return {
    clap: cmat(B, 'clapboard', () => { const t = cottageTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.85, envMapIntensity: 0.3 }, { night: 1.1 }); }),
    glass: cmat(B, 'glasswall', () => { const t = glassTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.25, metalness: 0.3, envMapIntensity: 1.0 }, { night: 1.2 }); }),
  };
}

// ------------------------------------------------------------------ rocks

/**
 * An irregular rock: a jittered, squashed blob (flat shaded by the rock
 * material), base sunk into the ground at y. sx/sz its radii, sy its height.
 */
export function rockLump(acc, x, y, z, sx, sy, sz, rng, ry = 0, c = [0.52, 0.5, 0.47], seg = 7, rings = 4) {
  const cr = Math.cos(ry), sr = Math.sin(ry);
  const jit = [];
  for (let j = 0; j <= rings; j++) { const row = []; for (let i = 0; i < seg; i++) row.push(0.78 + rng() * 0.42); jit.push(row); }
  const k = 0.85 + rng() * 0.25;
  acc.col = [c[0] * k, c[1] * k, c[2] * k * (0.95 + rng() * 0.1)];
  const pt = (i, j) => {
    const th = (j / rings) * Math.PI * 0.62, ph = ((i % seg) / seg) * Math.PI * 2;
    const r = jit[j][i % seg];
    const lx = Math.sin(th) * Math.cos(ph) * sx * r, lz = Math.sin(th) * Math.sin(ph) * sz * r;
    const ly = Math.cos(th) * sy * (j === 0 ? 1 : r);
    return [x + lx * cr + lz * sr, y - sy * 0.35 + ly, z - lx * sr + lz * cr];
  };
  // a cap at the top
  const top = pt(0, 0);
  for (let i = 0; i < seg; i++) {
    const a = pt(i, 1), b = pt(i + 1, 1);
    const ia = acc.v(...top, 0.5, 1), ib = acc.v(...b, (i + 1) / seg, 0.7), ic = acc.v(...a, i / seg, 0.7);
    acc.tri(ia, ib, ic);
  }
  for (let j = 1; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      acc.quadP(pt(i + 1, j + 1), pt(i, j + 1), pt(i, j), pt(i + 1, j), [(i + 1) / seg * 2, j / rings * 2, i / seg * 2, (j + 1) / rings * 2]);
    }
  }
}

/** A tumble of rocks round (x, z): n lumps, the biggest radius r. */
export function rockPile(acc, B, x, z, r, n, rng, c) {
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2, d = k ? r * (0.4 + rng() * 0.9) : 0;
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    const s = r * (k ? 0.35 + rng() * 0.45 : 0.8 + rng() * 0.2);
    rockLump(acc, px, B.groundY(px, pz), pz, s * (0.9 + rng() * 0.5), s * (0.55 + rng() * 0.5), s * (0.8 + rng() * 0.4), rng, rng() * 6, c);
  }
}

/**
 * A cheap leafy blob (a bush, a clump of gorse, turf): a jittered
 * five-sided bipyramid, flat shaded by the leaf material.
 */
export function blob(acc, x, y, z, r, sy = 0.7, rng = null, seg = 5) {
  const top = acc.v(x, y + r * sy, z, 0.5, 1);
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2 + (rng ? rng() * 0.5 : 0);
    const rr = r * (rng ? 0.8 + rng() * 0.4 : 1);
    ring.push(acc.v(x + Math.cos(a) * rr, y + r * sy * 0.15, z + Math.sin(a) * rr, i / seg, 0.5));
  }
  const bot = acc.v(x, y - r * sy * 0.5, z, 0.5, 0);
  for (let i = 0; i < seg; i++) {
    const a = ring[i], b = ring[(i + 1) % seg];
    acc.tri(top, b, a);
    acc.tri(bot, a, b);
  }
}

// ------------------------------------------------------------------ walls, fences

/**
 * A dry-stone wall along world [x, z] points, following the ground: courses
 * of uneven blocks (rock material), h tall, w thick.
 */
export function stoneWall(acc, B, pts, h, w, rng, c = [0.8, 0.77, 0.71]) {
  // (blocks ~3 m long: their sides and tops only, the ends where the run ends)
  const last = pts.length - 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / 3));
    const ry = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const y = B.groundY(x, z);
      const hh = h * (0.85 + rng() * 0.3);
      const kk = 0.85 + rng() * 0.3;
      const faces = 'fb' + (i === 0 && k === 0 ? 'l' : '') + (i === last && k === n - 1 ? 'r' : '');
      acc.col = [c[0] * kk, c[1] * kk, c[2] * kk];
      box(acc, x, y - 0.3, z, L / n + 0.05, hh + 0.3, w, -ry, { u: 1.5, v: 1.5, faces });
      // capping stones on edge
      acc.col = [c[0] * kk * 0.9, c[1] * kk * 0.9, c[2] * kk * 0.9];
      box(acc, x, y + hh, z, L / n * 0.95, 0.22, w * 0.8, -ry + (rng() - 0.5) * 0.2, { u: 1, faces: 'fb' });
    }
  }
}

/** A white picket fence along world [x, z] points (pickets every 0.3 m in pairs of boards). */
export function picket(acc, B, pts, h = 1.0, c = [0.92, 0.91, 0.88]) {
  acc.col = c;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ry = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const n = Math.max(1, Math.round(L / 2.4));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0;
      const x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1;
      const y0 = B.groundY(x0, z0), y1 = B.groundY(x1, z1);
      acc.box(x0, y0 - 0.2, z0, 0.1, h + 0.25, 0.1, ry);
      // rails, then a board face in front of them (reads as pickets from the road)
      for (const ry0 of [0.3, h - 0.25]) acc.beam(x0, y0 + ry0, z0, x1, y1 + ry0, z1, 0.05, 0.08);
      const m = Math.max(2, Math.round(L / n / 0.34));
      const dx = (x1 - x0) / L * n, dz = (z1 - z0) / L * n;   // along the run, unit
      for (let p = 0; p < m; p++) {
        const t = (p + 0.5) / m;
        const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t, py = y0 + (y1 - y0) * t;
        const ph = h - 0.08 + (p % 2) * 0.06, hw = 0.05;
        // a board: its two faces (thin: no edges worth the vertices)
        const A = [px - dx * hw, py, pz - dz * hw], Bp = [px + dx * hw, py, pz + dz * hw];
        const Ct = [px + dx * hw, py + ph, pz + dz * hw], Dt = [px - dx * hw, py + ph, pz - dz * hw];
        acc.quadP(A, Bp, Ct, Dt);
        acc.quadP(Bp, A, Dt, Ct);
      }
    }
  }
}

// ------------------------------------------------------------------ houses

const DOORS = ['#2a4a6a', '#a8322a', '#2a5a3a', '#e8c24a', '#1d1d22', '#6a2a4a'];

/**
 * A clapboard cottage: it = { x, z, ry, w, d, y0 (foundation bottom), y1
 * (floor), floors (1 or 2), tint, roofC, porch, chimney, n }. Its front
 * (+z) faces the road. Walls through M.clap (the texture's 4 m storeys).
 */
export function cottage(B, M, H, it, rng) {
  const { x, z, ry, w, d } = it;
  const y1 = it.y1, fl = it.floors || 1;
  const F = frame(x, y1, z, ry);
  const cl = B.acc(H.clap), pa = B.acc(M.paint), rf = B.acc(M.matte), cn = B.acc(M.conc), gl = B.acc(M.glow), wd = B.acc(M.wood);
  // the foundation (stone, down to the lowest ground)
  col(cn, C('#8a8478'));
  box(cn, x, it.y0, z, w + 0.3, y1 - it.y0 + 0.05, d + 0.3, ry, { u: 2 });
  // walls: one or two storeys of clapboard (3.4 m each, the texture's 4 m storey squeezed)
  col(cl, it.tint);
  const wh = fl * 3.2;
  box(cl, x, y1, z, w, wh, d, ry, { u: 16, v: 3.2, top: false });
  // corner boards and trim
  col(pa, C('#f6f4ee'));
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lbox(pa, F, ry, a * (w / 2), 0, b * (d / 2), 0.22, wh, 0.22, {});
  lbox(pa, F, ry, 0, wh - 0.05, 0, w + 0.3, 0.25, d + 0.3, {});
  // the door: a colour per house, a light over it
  const dc = DOORS[it.n % DOORS.length];
  col(pa, C(dc));
  lbox(pa, F, ry, -w * 0.18, 0, d / 2 + 0.02, 1.0, 2.15, 0.08, {});
  col(gl, C('#ffd8a0', 2.2));
  lbox(gl, F, ry, -w * 0.18, 2.45, d / 2 + 0.12, 0.22, 0.28, 0.22, {});
  // roof
  const roofY = y1 + wh;
  col(rf, it.roofC);
  if (it.roof === 'hip') hip(rf, x, roofY, z, w, d, Math.min(w, d) * 0.38, ry, { over: 0.5 });
  else {
    const rise = Math.min(w, d) * 0.42;
    gable(rf, x, roofY, z, w, d, rise, ry, { over: 0.45, endAcc: cl });
    // dormers on a one-and-a-half storey cottage
    if (fl === 1 && w > 9 && it.dormers) {
      for (const dx of [-w * 0.22, w * 0.22]) {
        col(cl, it.tint);
        lbox(cl, F, ry, dx, wh + 0.1, d * 0.12, 1.8, 1.6, 1.8, {});
        col(rf, it.roofC);
        const p = F(dx, wh + 1.7, d * 0.12);
        gable(rf, p[0], p[1], p[2], 1.8, 1.8, 0.8, ry + Math.PI / 2, { over: 0.2 });
        col(gl, C('#ffcf8a', it.n % 3 ? 1.3 : 0.1));
        lbox(gl, F, ry, dx, wh + 0.4, d * 0.12 + 0.92, 0.9, 0.9, 0.05, {});
      }
    }
  }
  // chimney
  if (it.chimney) {
    col(cn, C('#7a5a4a'));
    lbox(cn, F, ry, w / 2 - 1.0, wh - 1, -d * 0.15, 0.9, Math.min(w, d) * 0.42 + 2.2, 0.9, {});
  }
  // porch: a deck on posts with a little roof
  if (it.porch) {
    col(wd, C('#a89a88'));
    lbox(wd, F, ry, 0, -0.35, d / 2 + 1.1, w * 0.7, 0.35, 2.2, { u: 2 });
    col(pa, C('#f6f4ee'));
    for (const a of [-1, 1]) lbox(pa, F, ry, a * w * 0.33, 0, d / 2 + 2.0, 0.16, 2.6, 0.16, {});
    col(rf, it.roofC);
    const pr = [F(-w * 0.37, 2.6, d / 2 + 2.3), F(w * 0.37, 2.6, d / 2 + 2.3), F(w * 0.37, 3.1, d / 2), F(-w * 0.37, 3.1, d / 2)];
    rf.quadP(pr[0], pr[1], pr[2], pr[3]);
    rf.quadP(pr[1], pr[0], pr[3], pr[2]);
  }
}

/**
 * A glass house on the cliff: a white box with its glass wall to the view
 * (local −z, away from the road), a cantilevered upper floor, a deck. it =
 * { x, z, ry, w, d, y0, y1, n }.
 */
export function glassHouse(B, M, H, it, rng) {
  const { x, z, ry, w, d } = it;
  const y1 = it.y1;
  const F = frame(x, y1, z, ry);
  const pa = B.acc(M.paint), cn = B.acc(M.conc), gs = B.acc(H.glass), gl = B.acc(M.glow), wd = B.acc(M.wood);
  col(cn, C('#c8c4b8'));
  box(cn, x, it.y0, z, w, y1 - it.y0 + 0.1, d, ry, { u: 3 });
  // ground floor: render walls front and sides, glass to the back (the view)
  col(pa, C('#eeece6'));
  lbox(pa, F, ry, 0, 0, d * 0.25, w, 3.4, d * 0.5, {});
  const g0 = [F(-w / 2, 0, -d / 2 + 0.6), F(w / 2, 0, -d / 2 + 0.6), F(w / 2, 3.4, -d / 2 + 0.6), F(-w / 2, 3.4, -d / 2 + 0.6)];
  gs.quadP(g0[1], g0[0], g0[3], g0[2], [0, 0, w / 16, 3.4 / 4]);
  for (const a of [-1, 1]) {
    const s0 = [F(a * w / 2, 0, 0), F(a * w / 2, 0, -d / 2 + 0.6), F(a * w / 2, 3.4, -d / 2 + 0.6), F(a * w / 2, 3.4, 0)];
    if (a > 0) gs.quadP(s0[0], s0[1], s0[2], s0[3], [0, 0, (d / 2 - 0.6) / 16, 3.4 / 4]);
    else gs.quadP(s0[1], s0[0], s0[3], s0[2], [0, 0, (d / 2 - 0.6) / 16, 3.4 / 4]);
  }
  // the upper floor, pushed out over the view (its floor slab under it)
  const w2 = w * 0.8, d2 = d * 0.75, oz = -d * 0.2;
  col(pa, C('#e6e2da'));
  lbox(pa, F, ry, 0, 3.4, 0, w + 0.2, 0.35, d, {});
  lbox(pa, F, ry, w * 0.06, 3.4, oz, w2 + 0.6, 0.35, d2 + 0.6, {});
  col(pa, C('#f2f0ea'));
  lbox(pa, F, ry, w * 0.06, 3.75, oz + d2 * 0.2, w2, 3.1, d2 * 0.6, {});
  const g1 = [F(w * 0.06 - w2 / 2, 3.75, oz - d2 / 2), F(w * 0.06 + w2 / 2, 3.75, oz - d2 / 2), F(w * 0.06 + w2 / 2, 6.85, oz - d2 / 2), F(w * 0.06 - w2 / 2, 6.85, oz - d2 / 2)];
  gs.quadP(g1[1], g1[0], g1[3], g1[2], [0.3, 0, 0.3 + w2 / 16, 3.1 / 4]);
  for (const a of [-1, 1]) {
    const sx = w * 0.06 + a * w2 / 2;
    const s1 = [F(sx, 3.75, oz - d2 * 0.1), F(sx, 3.75, oz - d2 / 2), F(sx, 6.85, oz - d2 / 2), F(sx, 6.85, oz - d2 * 0.1)];
    if (a > 0) gs.quadP(s1[0], s1[1], s1[2], s1[3], [0, 0, d2 * 0.4 / 16, 3.1 / 4]);
    else gs.quadP(s1[1], s1[0], s1[3], s1[2], [0, 0, d2 * 0.4 / 16, 3.1 / 4]);
  }
  // its underside where it overhangs, the roof slab
  col(pa, C('#d8d4cc'));
  lbox(pa, F, ry, w * 0.06, 6.85, oz, w2 + 0.6, 0.4, d2 + 0.6, {});
  // a deck off the ground floor with a glass rail
  col(wd, C('#9a8a78'));
  lbox(wd, F, ry, -w * 0.1, -0.25, -d / 2 - 1.6, w * 0.8, 0.25, 3.2, { u: 2 });
  col(gl, C('#9ab8c8', 0.25));
  lbox(gl, F, ry, -w * 0.1, 0, -d / 2 - 3.2, w * 0.8, 1.05, 0.04, {});
  // the entrance on the road side, its light
  col(pa, C('#3a3430'));
  lbox(pa, F, ry, w * 0.3, 0, d / 2 + 0.03, 1.4, 2.4, 0.08, {});
  col(gl, C('#ffe0b0', 2));
  lbox(gl, F, ry, w * 0.3 - 1.2, 1.9, d / 2 + 0.1, 0.18, 0.5, 0.12, {});
  lbox(gl, F, ry, w * 0.3 + 1.2, 1.9, d / 2 + 0.1, 0.18, 0.5, 0.12, {});
  void rng;
}

// ------------------------------------------------------------------ cars, lamps

const CAR_C = ['#b8bcc0', '#1d2a3a', '#8a1d1d', '#f0eee8', '#2a4a3a', '#3a3a3e', '#c8a24a', '#4a6a8a', '#6a2a1d'];

/**
 * A parked car (low poly): body, glasshouse, wheels, lights that glow at
 * night. y the ground at its centre; it faces local +z.
 */
export function car(B, M, x, y, z, ry, rng, near = true) {
  const pa = near ? B.near(M.paint) : B.acc(M.paint), gl = near ? B.near(M.glow) : B.acc(M.glow);
  const F = frame(x, y, z, ry);
  const L = 4.3 + rng() * 0.5, W = 1.8, body = C(CAR_C[Math.floor(rng() * CAR_C.length)]);
  col(pa, [0.05, 0.05, 0.05]);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lbox(pa, F, ry, a * 0.78, 0, b * L * 0.32, 0.26, 0.64, 0.64, {});
  col(pa, body);
  lbox(pa, F, ry, 0, 0.3, 0, W, 0.72, L, {});
  const tall = rng() < 0.3;
  lbox(pa, F, ry, 0, 1.02, -L * 0.06, W * 0.86, tall ? 0.78 : 0.56, L * (tall ? 0.62 : 0.48), {});
  col(pa, [0.06, 0.08, 0.1]);
  lbox(pa, F, ry, 0, 1.06, -L * 0.06, W * 0.88, tall ? 0.6 : 0.42, L * (tall ? 0.6 : 0.46) + 0.04, {});
  col(gl, C('#fff2d8', 1.4));
  for (const a of [-1, 1]) lbox(gl, F, ry, a * 0.62, 0.62, L / 2 + 0.01, 0.34, 0.14, 0.04, {});
  col(gl, C('#ff2a1a', 1.6));
  for (const a of [-1, 1]) lbox(gl, F, ry, a * 0.66, 0.66, -L / 2 - 0.01, 0.3, 0.14, 0.04, {});
}

/** A lamp post (lantern on a pole): post colour pc, light c. */
export function lampPost(st, gl, x, y, z, h, c = '#ffd8a0', pc = '#2a2c30') {
  col(st, C(pc));
  tube(st, x, y - 0.3, z, x, y + h, z, 0.09, 6, 0.07);
  st.box(x, y - 0.3, z, 0.4, 0.5, 0.4);
  col(gl, C(c, 2.6));
  gl.box(x, y + h, z, 0.42, 0.55, 0.42);
  col(st, C(pc));
  st.box(x, y + h + 0.55, z, 0.55, 0.12, 0.55);
}

export { DOORS };
