// EASTSIDE — everything that isn't a house: the strip along Eastside Ave
// (EASTGATE PLAZA, the gas station's canopy, the STARLITE DINER, BURGER
// BARN's drive-thru, BOWL-O-RAMA, the motel, the used-car lot, FOODTOWN),
// parking lots with their stalls and light poles, ST. MARK'S, EASTSIDE HIGH
// and its stadium (the light towers you see from all over town), the
// ballpark, the park and its pond, the water tower, the freeway's sound
// wall, the old drive-in up on the bluff, and the barns out on the plains.
import { cylinder, cone, sphere, drape, lattice } from '../builder.js';
import { HOUSE, HS, ESIGN, tileUV, rectUV, storeUV } from './atlas.js';
import { M, Frame, rgb, shade, wallQ, flatQ, boxL, boxW, facade, slope, gableStrips, chainFence, glowBox, car, tree } from './kit.js';
import { HM, hh } from './ehouse.js';

const SIDES = (hw, hd) => [['f', -hw, hd, hw, hd], ['r', hw, hd, hw, -hd], ['b', hw, -hd, -hw, -hd], ['l', -hw, -hd, -hw, hd]];

/**
 * Walls round a box from the house atlas: a foundation band y0..yb (o.found
 * tile), then storeys of 3 m up to y1; tiles(side, i, n, storey) → tile id.
 */
function walls(B, F, w, d, y0, yb, y1, tint, tiles, o = {}) {
  const acc = B.acc(HM.wall(B));
  acc.col = rgb(tint);
  const t = typeof tiles === 'function' ? tiles : () => tiles;
  for (const [side, ax, az, bx, bz] of SIDES(w / 2, d / 2)) {
    if (o.skip && o.skip.includes(side)) continue;
    const rows = [{ h: yb - y0, v: [0, Math.min(1, (yb - y0) / 3)], tile: () => o.found ?? HS.block }];
    let y = yb, k = 0;
    while (y < y1 - 0.05) {
      const h = Math.min(3, y1 - y), storey = k++;
      rows.push({ h, v: [0, h / 3], tile: (i, n) => t(side, i, n, storey) });
      y += h;
    }
    facade(acc, F, HOUSE, ax, az, bx, bz, y0, rows, { bay: 3 });
  }
}

/** A cone hanging point-down (the underside of a tank): base radius r at y, the point h below. */
function coneDown(acc, x, y, z, r, h, seg = 8) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const A = acc.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, i / seg, 0);
    const Bv = acc.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, (i + 1) / seg, 0);
    const T = acc.v(x, y - h, z, (i + 0.5) / seg, 1);
    acc.tri(A, Bv, T);
  }
}

/** A flat roof with a little plant on it. */
function flatRoof(B, F, w, d, y, seed, col = '#6a6864') {
  const cm = B.acc(M.concrete(B));
  cm.col = rgb(col);
  flatQ(cm, F, -w / 2, -d / 2, w / 2, d / 2, y, true, [0, 0, w / 6, d / 6]);
  const p = B.acc(M.paint(B));
  const n = Math.min(5, Math.floor(w * d / 250));
  for (let k = 0; k < n; k++) {
    p.col = rgb(hh(seed, k, 1) < 0.5 ? '#9a9a96' : '#b8b4aa');
    boxL(p, F, (hh(seed, k, 2) - 0.5) * (w - 6), y, (hh(seed, k, 3) - 0.5) * (d - 6), 2.4, 1.3, 1.8);
  }
}

// ------------------------------------------------------------------ the strip

/** A strip mall: { x, z, w, d, ry, yb, y0, stores: [k], seed } — storefronts on the front, a covered walk. */
export function strip(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const hw = it.w / 2, hd = it.d / 2, yb = it.yb, H = 6.2;
  const sg = B.acc(HM.sign(B));
  // storefronts: 6 m bays, 4.5 m tall; the parapet band above
  const n = Math.max(1, Math.round(it.w / 6)), bw = it.w / n;
  for (let i = 0; i < n; i++) {
    const a = -hw + i * bw, b = a + bw;
    wallQ(sg, F, a, hd, b, hd, yb, yb + 4.5, storeUV(it.stores[i % it.stores.length]));
  }
  const wall = B.acc(HM.wall(B));
  wall.col = rgb(it.tint || '#e8dcc8');
  facade(wall, F, HOUSE, -hw, hd, hw, hd, yb + 4.5, [{ h: H - 4.5, v: [1 - (H - 4.5) / 3, 1], tile: () => HS.stuccoTrim }], { bay: 3 });
  facade(wall, F, HOUSE, -hw, hd, hw, hd, it.y0, [{ h: yb - it.y0, v: [0, 0.3], tile: () => HS.block }], { bay: 3 });
  walls(B, F, it.w, it.d, it.y0, yb, yb + H, it.tint || '#e8dcc8', (side, i, nn, st) => (side === 'b' ? (i % 3 === 1 && st === 0 ? HS.rearDoor : HS.block) : HS.stuccoPlain), { skip: ['f'] });
  flatRoof(B, F, it.w, it.d, yb + H - 0.4, it.n);
  // the covered walk: a fascia slab on square posts, lights under it
  const p = B.acc(M.paint(B));
  p.col = rgb(it.trim || '#7a2a1e');
  boxL(p, F, 0, yb + 3.7, hd + 1.6, it.w + 0.4, 0.55, 3.2, 0, { bottom: true });
  p.col = rgb('#e8e2d4');
  for (let i = 0; i <= n; i++) boxL(p, F, -hw + i * bw, yb, hd + 2.9, 0.3, 3.7, 0.3);
  const g = B.acc(M.glow(B));
  g.col = rgb('#fff2d8');
  for (let i = 0; i < n; i++) boxL(g, F, -hw + (i + 0.5) * bw, yb + 3.65, hd + 1.6, 0.9, 0.05, 0.5, 0, { bottom: true });
  // a sidewalk along the front
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#b4b0a6');
  boxL(cm, F, 0, it.y0, hd + 1.6, it.w + 0.4, yb - it.y0, 3.2, 0, { u: 2 });
}

/** A sign on a tall pole or a pylon: { x, z, ry, h (to the sign's foot), w, sh, key, pylon }. */
export function pylon(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const p = B.acc(M.paint(B));
  if (it.pylon) {
    p.col = rgb(it.col || '#8a3a2a');
    boxL(p, F, 0, -0.3, 0, it.w + 0.6, it.h + it.sh + 1.2, 0.9);
  } else {
    p.col = rgb('#4a4c50');
    for (const sx of it.w > 4 ? [-it.w * 0.3, it.w * 0.3] : [0]) boxL(p, F, sx, -0.3, 0, 0.35, it.h + 0.3, 0.35);
  }
  const sg = B.acc(HM.sign(B));
  const u = rectUV(ESIGN, it.key);
  wallQ(sg, F, -it.w / 2, 0.47, it.w / 2, 0.47, it.h, it.h + it.sh, u);
  wallQ(sg, F, it.w / 2, -0.47, -it.w / 2, -0.47, it.h, it.h + it.sh, u);
  p.col = rgb('#2a2a2c');
  boxL(p, F, 0, it.h - 0.15, 0, it.w + 0.3, it.sh + 0.3, 0.9, 0, { faces: 'lr' });
  boxL(p, F, 0, it.h + it.sh, 0, it.w + 0.3, 0.15, 0.9);
}

/** A parking lot: asphalt, white stall lines in rows, optional light poles (their lamps are in the plan). */
export function parking(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const hw = it.w / 2, hd = it.d / 2;
  const W = (lx, lz) => [F.X(lx, lz), F.Z(lx, lz)];
  drape(B.acc(M.lot(B)), B, [W(-hw, -hd), W(hw, -hd), W(hw, hd), W(-hw, hd)], { lift: 0.06, uv: 6, step: 6 });
  const ln = B.near(M.line(B));
  ln.col = rgb('#e8e6dc');
  if (it.dense) { for (const c of it.cars || []) { const [x, z] = W(c[0], c[1]); car(B, x, z, it.ry + c[2], rgb(c[3])); } for (const [lx, lz] of it.poles || []) lightPole(B, ...W(lx, lz), it.ry, it.lampCol || '#f0f4ff'); return; }
  // rows of stalls along local x, 2.7 m wide, 5.5 m deep, an aisle of 7 m between pairs
  for (let z = -hd + 0.5; z + 5.5 <= hd - 0.5; z += 18) {
    for (const zr of [z, z + 12.5]) {
      if (zr + 5.5 > hd) continue;
      for (let x = -hw + 1; x <= hw - 1; x += 2.7) {
        const [ax, az] = W(x - 0.06, zr), [bx, bz] = W(x + 0.06, zr + 5.5);
        const y = B.groundY(ax, az) + 0.1;
        const P = (lx, lz) => { const q = W(lx, lz); return [q[0], y, q[1]]; };
        ln.quadP(P(x - 0.06, zr + 5.5), P(x + 0.06, zr + 5.5), P(x + 0.06, zr), P(x - 0.06, zr));
        void bx; void bz;
      }
    }
  }
  for (const [lx, lz] of it.poles || []) lightPole(B, ...W(lx, lz), it.ry, it.lampCol || '#f0f4ff');
  for (const c of it.cars || []) { const [x, z] = W(c[0], c[1]); car(B, x, z, it.ry + c[2], rgb(c[3])); }
}

/** A parking-lot light: a square pole, two heads. */
export function lightPole(B, x, z, ry, hex = '#f0f4ff', h = 9.5) {
  const y = B.groundY(x, z);
  const st = B.acc(M.steel(B));
  st.col = rgb('#5a5c60');
  st.box(x, y - 0.3, z, 0.22, h + 0.3, 0.22, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const sd of [-1, 1]) {
    const hx = x + c * sd * 0.9, hz = z - s * sd * 0.9;
    st.box(hx, y + h, hz, 1.1, 0.28, 0.5, ry);
    glowBox(B, hx, y + h - 0.03, hz, 0.9, 0.05, 0.38, ry, hex);
  }
}

// ------------------------------------------------------------------ gas, diner, drive-thru, big boxes

/** EASTGATE GAS: { x, z, ry (front +z to the street), cw, cd, store: [lx, lz, w, d] }. */
export function gas(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const hc = 5.2;
  const p = B.acc(M.paint(B));
  // the canopy: a slab, a lit fascia all round, columns; the underside a field of lights
  p.col = rgb('#f2f0ea');
  boxL(p, F, 0, hc, 0, it.cw, 0.25, it.cd, 0, { bottom: true });
  const sg = B.acc(HM.sign(B));
  const u = rectUV(ESIGN, 'canopy');
  for (const [side, ax, az, bx, bz] of SIDES(it.cw / 2, it.cd / 2)) { void side; wallQ(sg, F, ax * 1.002, az * 1.002, bx * 1.002, bz * 1.002, hc + 0.25, hc + 1.15, u); }
  boxL(p, F, 0, hc + 1.15, 0, it.cw, 0.06, it.cd);
  const g = B.acc(M.glow(B));
  g.col = rgb('#f4f8ff');
  for (let x = -it.cw / 2 + 2.5; x < it.cw / 2 - 1; x += 4) for (let z = -it.cd / 2 + 2.5; z < it.cd / 2 - 1; z += 4) boxL(g, F, x, hc - 0.04, z, 1.2, 0.05, 1.2, 0, { bottom: true });
  p.col = rgb('#c8201a');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxL(p, F, sx * it.cw * 0.3, -0.2, sz * it.cd * 0.22, 0.5, hc + 0.2, 0.5);
  // pump islands
  for (const sx of [-1, 0, 1]) {
    const cm = B.acc(M.concrete(B));
    cm.col = rgb('#c8c4b8');
    boxL(cm, F, sx * it.cw * 0.3, 0, 0, 1.4, 0.2, 7);
    for (const sz of [-1.8, 1.8]) {
      p.col = rgb('#e8e4dc'); boxL(p, F, sx * it.cw * 0.3, 0.2, sz, 0.9, 1.7, 0.6);
      p.col = rgb('#c8201a'); boxL(p, F, sx * it.cw * 0.3, 1.5, sz, 0.95, 0.4, 0.65);
      const gl = B.acc(M.glow(B)); gl.col = rgb('#9ad8ff'); boxL(gl, F, sx * it.cw * 0.3 + 0.48, 1.1, sz, 0.02, 0.25, 0.35);
    }
  }
  // the store behind the canopy
  const [lx, lz, sw, sd] = it.store;
  const Fs = new Frame(F.X(lx, lz), F.Z(lx, lz), it.ry, 0);
  const yb = y + 0.25;
  for (let i = 0; i < Math.round(sw / 6); i++) wallQ(sg, Fs, -sw / 2 + i * 6, sd / 2, -sw / 2 + (i + 1) * 6, sd / 2, yb, yb + 4.5, storeUV(15));
  walls(B, Fs, sw, sd, y - 0.5, yb, yb + 5, '#e8e4dc', (side) => (side === 'b' ? HS.blockVent : HS.white), { skip: ['f'] });
  const wall = B.acc(HM.wall(B));
  wall.col = rgb('#e8e4dc');
  facade(wall, Fs, HOUSE, -sw / 2, sd / 2, sw / 2, sd / 2, yb + 4.5, [{ h: 0.5, v: [0.8, 1], tile: () => HS.trimBand }], { bay: 3 });
  flatRoof(B, Fs, sw, sd, yb + 4.9, it.n);
}

/** The STARLITE DINER: a stainless railroad-car diner, windows all along, neon on the roof. */
export function diner(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const L = it.w, Wd = it.d, yb = 0.6;
  const st = B.acc(M.glossy(B));
  st.col = rgb('#d8dce0');
  // the body: a band under the windows, a band over, a barrel roof
  boxL(st, F, 0, 0, 0, L, yb + 0.9, Wd, 0, { top: false });
  st.col = rgb('#c82a3a');
  boxL(st, F, 0, yb + 0.85, 0, L + 0.04, 0.12, Wd + 0.04, 0, { top: false });
  st.col = rgb('#d8dce0');
  boxL(st, F, 0, yb + 2.4, 0, L, 0.7, Wd, 0, { top: false });
  const wall = B.acc(HM.wall(B));
  wall.col = [1, 1, 1];
  const n = Math.round(L / 3);
  for (let i = 0; i < n; i++) {
    const a = -L / 2 + i * L / n, b = a + L / n;
    const t = tileUV(HOUSE, i === Math.floor(n / 2) ? HS.doorLit : HS.pictureLit, 0, 0.3, 1, 0.85);
    wallQ(wall, F, a, Wd / 2, b, Wd / 2, yb + 0.9, yb + 2.4, t);
    wallQ(wall, F, b, -Wd / 2, a, -Wd / 2, yb + 0.9, yb + 2.4, tileUV(HOUSE, HS.pictureLit, 0, 0.3, 1, 0.85));
  }
  for (const sx of [1, -1]) {
    if (sx > 0) wallQ(st, F, L / 2, Wd / 2, L / 2, -Wd / 2, yb + 0.9, yb + 2.4, [0, 0, 1, 1]);
    else wallQ(st, F, -L / 2, -Wd / 2, -L / 2, Wd / 2, yb + 0.9, yb + 2.4, [0, 0, 1, 1]);
  }
  // barrel roof
  const seg = 6, R = Wd / 2 + 0.2, y0 = yb + 3.1;
  for (let k = 0; k < seg; k++) {
    const a0 = Math.PI - (k / seg) * Math.PI, a1 = Math.PI - ((k + 1) / seg) * Math.PI;
    const z0 = Math.cos(a0) * R, h0 = Math.sin(a0) * R * 0.45, z1 = Math.cos(a1) * R, h1 = Math.sin(a1) * R * 0.45;
    slope(st, F, [L / 2 + 0.2, y0 + h0, z0], [-L / 2 - 0.2, y0 + h0, z0], [-L / 2 - 0.2, y0 + h1, z1], [L / 2 + 0.2, y0 + h1, z1]);
  }
  for (const sx of [1, -1]) {
    const c = st.v(...F.P(sx * (L / 2 + 0.2), y0, 0), 0, 0);
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI, a1 = ((k + 1) / seg) * Math.PI;
      const p0 = st.v(...F.P(sx * (L / 2 + 0.2), y0 + Math.sin(a0) * R * 0.45, Math.cos(a0) * R), 0, 0);
      const p1 = st.v(...F.P(sx * (L / 2 + 0.2), y0 + Math.sin(a1) * R * 0.45, Math.cos(a1) * R), 0, 0);
      if (sx > 0) st.tri(c, p1, p0); else st.tri(c, p0, p1);
    }
  }
  // neon on the roof, facing the street
  const sg = B.acc(HM.sign(B));
  const p = B.acc(M.paint(B));
  p.col = rgb('#3a3c40');
  for (const sx of [-2.5, 2.5]) boxL(p, F, sx, y0 + 0.6, 0.6, 0.15, 1.2, 0.15);
  wallQ(sg, F, -4, 0.7, 4, 0.7, y0 + 1.6, y0 + 3.6, rectUV(ESIGN, 'dinerSign'));
  wallQ(sg, F, 4, 0.5, -4, 0.5, y0 + 1.6, y0 + 3.6, rectUV(ESIGN, 'dinerSign'));
  // steps up to the door
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#b8b4aa');
  boxL(cm, F, 0, -0.2, Wd / 2 + 0.8, 3, yb + 0.2, 1.6);
}

/** BURGER BARN: a little drive-thru with a red mansard roof. { x, z, w, d, ry, yb }. */
export function burger(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const yb = it.yb, H = 3.4;
  const sg = B.acc(HM.sign(B));
  const n = Math.max(1, Math.round(it.w / 6));
  for (let i = 0; i < n; i++) wallQ(sg, F, -it.w / 2 + i * it.w / n, it.d / 2, -it.w / 2 + (i + 1) * it.w / n, it.d / 2, yb, yb + 4.5 * (H / 4.5), storeUV(i % 2 ? 3 : 10));
  walls(B, F, it.w, it.d, it.y0, yb, yb + H, '#f0e6d0', (side, i) => (side === 'r' && i === 1 ? HS.pictureLit : HS.white), { skip: ['f'] });
  // the mansard: steep shingled slopes all round, flat on top
  const rf = B.acc(HM.roof(B));
  rf.col = rgb('#a8281e');
  const y0 = yb + H, y1 = y0 + 1.8, ov = 0.6, ins = 1.2;
  const hw = it.w / 2 + ov, hd = it.d / 2 + ov, iw = it.w / 2 - ins + ov, id = it.d / 2 - ins + ov;
  slope(rf, F, [-hw, y0, hd], [hw, y0, hd], [iw, y1, id], [-iw, y1, id]);
  slope(rf, F, [hw, y0, -hd], [-hw, y0, -hd], [-iw, y1, -id], [iw, y1, -id]);
  slope(rf, F, [hw, y0, hd], [hw, y0, -hd], [iw, y1, -id], [iw, y1, id]);
  slope(rf, F, [-hw, y0, -hd], [-hw, y0, hd], [-iw, y1, id], [-iw, y1, -id]);
  flatRoof(B, F, 2 * iw, 2 * id, y1, it.n, '#7a6a60');
  // its sign on the roof's front
  wallQ(sg, F, -3, hd - 0.3, 3, hd - 0.3, y1 - 0.2, y1 + 2.6, rectUV(ESIGN, 'burger'));
  // the drive-thru window light, the menu board on posts
  glowBox(B, F.X(it.w / 2 + 0.05, -1), yb + 1.4, F.Z(it.w / 2 + 0.05, -1), 0.05, 1.0, 1.6, it.ry, '#ffe0a0');
  const p = B.acc(M.paint(B));
  p.col = rgb('#3a3c40');
  const mx = it.w / 2 + 4, mz = -it.d / 2 - 2;
  for (const sz of [-1, 1]) boxL(p, F, mx, -0.3, mz + sz * 0.9, 0.15, yb + 1.0, 0.15);
  const Fm = new Frame(F.X(mx, mz), F.Z(mx, mz), it.ry + Math.PI / 2, 0);
  wallQ(sg, Fm, -1.2, 0.1, 1.2, 0.1, yb + 0.6, yb + 2.4, rectUV(ESIGN, 'menu'));
}

/** A big box (the bowling alley, the supermarket): { x, z, w, d, ry, yb, h, tint, key (its sign), entry: 'glass'|'bowl' }. */
export function bigbox(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const yb = it.yb, H = it.h;
  walls(B, F, it.w, it.d, it.y0, yb, yb + H, it.tint, (side, i, n, row) => {
    if (side === 'b') return i % 4 === 2 && row === 0 ? HS.rearDoor : HS.block;
    if (side === 'f') return row === 0 && Math.abs(i - (n - 1) / 2) < 1 ? HS.white : HS.stuccoPlain;
    return HS.stuccoPlain;
  });
  flatRoof(B, F, it.w, it.d, yb + H - 0.2, it.n);
  const sg = B.acc(HM.sign(B));
  // the entrance: a glass front under a canopy
  const ew = Math.min(it.w * 0.4, 24);
  const n = Math.max(1, Math.round(ew / 6));
  for (let i = 0; i < n; i++) wallQ(sg, F, -ew / 2 + i * ew / n, it.d / 2 + 0.05, -ew / 2 + (i + 1) * ew / n, it.d / 2 + 0.05, yb, yb + 4.5, storeUV(it.stores ? it.stores[i % it.stores.length] : 4));
  const p = B.acc(M.paint(B));
  p.col = rgb(it.trim || '#2a3a6a');
  boxL(p, F, 0, yb + 4.6, it.d / 2 + 2, ew + 2, 0.7, 4, 0, { bottom: true });
  const g = B.acc(M.glow(B));
  g.col = rgb('#fff2d8');
  for (let x = -ew / 2 + 2; x < ew / 2; x += 4) boxL(g, F, x, yb + 4.56, it.d / 2 + 2, 1.2, 0.05, 0.6, 0, { bottom: true });
  // the name, big, on the front
  const [, , rw, rh] = ESIGN[it.key];
  const sw = Math.min(it.w * 0.55, it.signW || 26), sh = sw * rh / rw;
  wallQ(sg, F, -sw / 2, it.d / 2 + 0.1, sw / 2, it.d / 2 + 0.1, yb + H - sh - 0.4, yb + H - 0.4, rectUV(ESIGN, it.key));
}

/** The motel: two floors of doors along a walkway, its office, its sign on a pole. { x, z, w, d, ry, yb, rooms }. */
export function motel(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const yb = it.yb, fh = 2.9;
  const tiles = (side, i, n, row) => {
    if (side !== 'f') return side === 'b' ? (hh(it.n, i, row) < 0.4 ? HS.small : HS.plain) : HS.plain;
    if (i % 2 === 0) return HS.door;
    return hh(it.n, i * 3 + row, 5) < 0.45 ? HS.pictureLit : HS.picture;
  };
  walls(B, F, it.w, it.d, it.y0, yb, yb + 2 * fh, it.tint || '#e8d8b8', tiles);
  const rf = B.acc(HM.roof(B));
  rf.col = rgb('#5a4a3a');
  const top = yb + 2 * fh;
  slope(rf, F, [-it.w / 2 - 0.4, top - 0.1, it.d / 2 + 0.5], [it.w / 2 + 0.4, top - 0.1, it.d / 2 + 0.5], [it.w / 2 + 0.4, top + 1.6, 0], [-it.w / 2 - 0.4, top + 1.6, 0], [0, 0, it.w / 4, 1.5]);
  slope(rf, F, [it.w / 2 + 0.4, top - 0.1, -it.d / 2 - 0.5], [-it.w / 2 - 0.4, top - 0.1, -it.d / 2 - 0.5], [-it.w / 2 - 0.4, top + 1.6, 0], [it.w / 2 + 0.4, top + 1.6, 0], [0, 0, it.w / 4, 1.5]);
  const pc = B.acc(M.paint(B));
  pc.col = rgb('#7a3a2a');
  boxL(pc, F, 0, top - 0.25, it.d / 2 + 1.3, it.w + 0.4, 0.25, 2.6, 0, { bottom: true });
  const wall = B.acc(HM.wall(B));
  wall.col = rgb(it.tint || '#e8d8b8');
  gableStrips(wall, F, HOUSE, HS.plain, it.w / 2, it.d / 2, it.w / 2, -it.d / 2, top, 1.6);
  gableStrips(wall, F, HOUSE, HS.plain, -it.w / 2, -it.d / 2, -it.w / 2, it.d / 2, top, 1.6);
  // the upper walkway: a slab, a rail, posts; lights over the doors
  const p = B.acc(M.paint(B));
  p.col = rgb('#e8e4dc');
  boxL(p, F, 0, yb + fh - 0.1, it.d / 2 + 1.2, it.w, 0.2, 2.4, 0, { bottom: true });
  boxL(p, F, 0, yb + fh + 0.95, it.d / 2 + 2.35, it.w, 0.08, 0.08);
  for (let x = -it.w / 2 + 0.3; x <= it.w / 2; x += 4.2) boxL(p, F, x, yb - 0.1, it.d / 2 + 2.3, 0.18, fh + 1.1, 0.18);
  const g = B.acc(M.glow(B));
  g.col = rgb('#ffd890');
  const n = Math.round(it.w / 3);
  for (let i = 0; i < n; i += 2) for (const f of [0, 1]) boxL(g, F, -it.w / 2 + (i + 0.5) * it.w / n + 0.8, yb + f * fh + 2.25, it.d / 2 + 0.06, 0.2, 0.25, 0.1);
}

/** A used-car lot's office and its strings of pennants. { x, z, ry, w, d, poles: [[lx, lz]] }. */
export function dealer(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, 0);
  const sg = B.acc(HM.sign(B));
  // the office: glass on three sides
  const ow = 10, od = 7, ox = it.office[0], oz = it.office[1];
  const Fo = new Frame(F.X(ox, oz), F.Z(ox, oz), it.ry, 0);
  for (let i = 0; i < 2; i++) wallQ(sg, Fo, -ow / 2 + i * 5, od / 2, -ow / 2 + (i + 1) * 5, od / 2, y + 0.3, y + 3.6, storeUV(i ? 4 : 12));
  walls(B, Fo, ow, od, y - 0.4, y + 0.3, y + 3.9, '#f2eee4', HS.white, { skip: ['f'] });
  flatRoof(B, Fo, ow, od, y + 3.9, it.n);
  wallQ(sg, Fo, -6, od / 2 + 0.4, 6, od / 2 + 0.4, y + 3.9, y + 6.15, rectUV(ESIGN, 'dealer'));
  // pennants strung between poles
  const p = B.acc(M.paint(B));
  p.col = rgb('#d8d8d4');
  const fl = B.near(HM.sign(B));
  const tops = it.poles.map(([lx, lz]) => { const x = F.X(lx, lz), z = F.Z(lx, lz), yy = B.groundY(x, z); p.box(x, yy - 0.3, z, 0.12, 6.3, 0.12); return [x, yy + 6, z]; });
  for (let k = 0; k < tops.length - 1; k++) {
    const a = tops[k], b = tops[k + 1];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const m = Math.max(2, Math.round(len / 1.2));
    for (let q = 0; q < m; q++) {
      const t0 = q / m, t1 = (q + 0.8) / m;
      const sag = (t) => -Math.sin(t * Math.PI) * 1.2;
      const P0 = [a[0] + (b[0] - a[0]) * t0, a[1] + sag(t0), a[2] + (b[2] - a[2]) * t0], P1 = [a[0] + (b[0] - a[0]) * t1, a[1] + sag(t1), a[2] + (b[2] - a[2]) * t1];
      const u0 = (q % 16) / 16 * 0.5, u = rectUV(ESIGN, 'flag', u0, 0.75, u0 + 1 / 32, 1);
      const ia = fl.v(P0[0], P0[1], P0[2], u[0], u[3]), ib = fl.v(P1[0], P1[1], P1[2], u[2], u[3]), ic = fl.v((P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2 - 0.45, (P0[2] + P1[2]) / 2, (u[0] + u[2]) / 2, u[1]);
      fl.tri(ia, ib, ic); fl.tri(ia, ic, ib);
    }
  }
}

// ------------------------------------------------------------------ church, school, stadium

/** ST. MARK'S: a white clapboard nave, lancet windows, a steeple at the front. { x, z, w (along), d, ry, yb, y0 }. */
export function church(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const yb = it.yb, H = 6.2;
  // the nave runs back from the street: its gable end is the front (local +z)
  const tiles = (side, i, n, row) => {
    if (side === 'f') return row === 0 && Math.abs(i - (n - 1) / 2) < 0.6 ? HS.churchDoor : HS.bPlain;
    if (side === 'b') return HS.bPlain;
    return row === 0 && i > 0 && i < n - 1 ? (hh(it.n, i, 3) < 0.8 ? HS.churchWinLit : HS.churchWin) : HS.bPlain;
  };
  // a brick nave (the church tiles are brick-backed), a white steeple
  const wall = B.acc(HM.wall(B));
  wall.col = [1, 1, 1];
  for (const [side, ax, az, bx, bz] of SIDES(it.w / 2, it.d / 2)) {
    facade(wall, F, HOUSE, ax, az, bx, bz, it.y0, [
      { h: yb - it.y0, v: [0, 0.2], tile: () => HS.bPlain },
      { h: 3, v: [0, 1], tile: (i, n) => tiles(side, i, n, 0) },
      { h: H - 3, v: [0, (H - 3) / 3], tile: () => HS.bPlain },
    ], { bay: 3 });
  }
  const top = yb + H, rise = it.w * 0.55;
  const Fr = new Frame(it.x, it.z, it.ry + Math.PI / 2, 0);
  const rf = B.acc(HM.roof(B));
  rf.col = rgb('#3a3c44');
  const L = it.d, S = it.w, hl = L / 2 + 0.3, hs = S / 2 + 0.5, ye = top - rise * 0.5 / (S / 2);
  slope(rf, Fr, [-hl, ye, hs], [hl, ye, hs], [hl, top + rise, 0], [-hl, top + rise, 0], [0, 0, 2 * hl / 4, rise / 3]);
  slope(rf, Fr, [hl, ye, -hs], [-hl, ye, -hs], [-hl, top + rise, 0], [hl, top + rise, 0], [0, 0, 2 * hl / 4, rise / 3]);
  gableStrips(wall, Fr, HOUSE, HS.bPlain, L / 2, S / 2, L / 2, -S / 2, top, rise);
  gableStrips(wall, Fr, HOUSE, HS.bPlain, -L / 2, -S / 2, -L / 2, S / 2, top, rise);
  // the steeple: a square tower in front, a belfry, an octagonal spire
  const tz = it.d / 2 + 2.2, ts = 4.4;
  const Ft = new Frame(F.X(0, tz), F.Z(0, tz), it.ry, 0);
  walls(B, Ft, ts, ts, it.y0, yb, top + 6, '#f4f2ec', (side, i, n, row) => (row === 0 && side === 'f' ? HS.door : row === 2 ? HS.dormerLit : HS.plain));
  const p = B.acc(M.paint(B));
  p.col = rgb('#f4f2ec');
  boxL(p, Ft, 0, top + 6, 0, ts + 0.4, 0.3, ts + 0.4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxL(p, Ft, sx * (ts / 2 - 0.3), top + 6.3, sz * (ts / 2 - 0.3), 0.45, 3, 0.45);
  boxL(p, Ft, 0, top + 9.3, 0, ts + 0.3, 0.4, ts + 0.3);
  const bell = B.acc(M.dark(B));
  boxL(bell, Ft, 0, top + 6.3, 0, ts - 1.2, 3, ts - 1.2);
  rf.col = rgb('#3a3c44');
  cone(rf, Ft.x, top + 9.7, Ft.z, ts * 0.62, 14, 8);
  const st = B.acc(M.steel(B));
  st.col = rgb('#d8b040');
  st.box(Ft.x, top + 23.5, Ft.z, 0.12, 2.2, 0.12);
  st.box(Ft.x, top + 24.7, Ft.z, 1.1, 0.12, 0.12, it.ry);
}

/** EASTSIDE HIGH: two floors of ribbon windows in brick, the gym, its name, a flagpole. { x, z, w, d, ry, yb, y0, gym: [lx, w, d, h] }. */
export function school(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const yb = it.yb;
  const tiles = (side, i, n, row) => {
    if (side === 'f' && row === 0 && Math.abs(i - (n - 1) / 2) < 1.1) return HS.schoolDoor;
    if (i === 0 || i === n - 1) return HS.schoolPlain;
    return hh(it.n, i * 5 + row, side.charCodeAt(0)) < it.lit ? HS.schoolWinLit : HS.schoolWin;
  };
  walls(B, F, it.w, it.d, it.y0, yb, yb + 6.6, '#ffffff', tiles, { found: HS.schoolPlain });
  flatRoof(B, F, it.w, it.d, yb + 6.6, it.n, '#5a5854');
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#d8d4c8');
  boxL(cm, F, 0, yb + 6.6, 0, it.w + 0.3, 0.5, it.d + 0.3, 0, { top: false });
  // the name over the doors, a canopy
  const sg = B.acc(HM.sign(B));
  wallQ(sg, F, -10, it.d / 2 + 0.08, 10, it.d / 2 + 0.08, yb + 3.4, yb + 5.9, rectUV(ESIGN, 'school'));
  const p = B.acc(M.paint(B));
  p.col = rgb('#1d2f6a');
  boxL(p, F, 0, yb + 2.9, it.d / 2 + 2.2, 14, 0.4, 4.4, 0, { bottom: true });
  const g = B.acc(M.glow(B));
  g.col = rgb('#eef4ff');
  for (const x of [-5, 0, 5]) boxL(g, F, x, yb + 2.86, it.d / 2 + 2.2, 1.2, 0.05, 0.6, 0, { bottom: true });
  // the gym: taller, high windows
  const [gx, gw, gd, gh] = it.gym;
  const Fg = new Frame(F.X(gx, (it.d - gd) / 2), F.Z(gx, (it.d - gd) / 2), it.ry, 0);
  walls(B, Fg, gw, gd, it.y0, yb, yb + gh, '#ffffff', (side, i, n, row) => (row === Math.floor((gh - 1) / 3) ? HS.gym : side === 'f' && row === 0 && i === 1 ? HS.schoolDoor : HS.schoolPlain), { found: HS.schoolPlain });
  flatRoof(B, Fg, gw, gd, yb + gh, it.n + 1, '#5a5854');
  // flagpole on the lawn
  const st = B.acc(M.steel(B));
  st.col = rgb('#d8d8d4');
  const fx = F.X(-14, it.d / 2 + 12), fz = F.Z(-14, it.d / 2 + 12), fy = B.groundY(fx, fz);
  st.cyl(fx, fy, fz, 0.09, 12, 6, 0.05);
  const fl = B.acc(HM.sign(B));
  const Ff = new Frame(fx, fz, it.ry + Math.PI / 2, 0);
  wallQ(fl, Ff, 0.1, 0, 2.6, 0, fy + 10, fy + 11.5, rectUV(ESIGN, 'flag', 0.4, 0, 0.98, 0.62));
  wallQ(fl, Ff, 2.6, 0.01, 0.1, 0.01, fy + 10, fy + 11.5, rectUV(ESIGN, 'flag', 0.4, 0, 0.98, 0.62));
}

/** The football stadium: { x, z, ry, y (field level), towers: true }. Field 110 × 49, track round it. */
export function stadium(B, it) {
  const F = new Frame(it.x, it.z, it.ry, it.y);
  const W = (lx, lz) => [F.X(lx, lz), F.Z(lx, lz)];
  // the track: a red ring (drape), the field in it (its own texture, laid flat)
  const tr = B.acc(M.dirt(B));
  const rx = 85, rz = 47;
  drape(tr, B, [W(-rx, -rz), W(rx, -rz), W(rx, rz), W(-rx, rz)], { lift: 0.05, uv: 3, step: 8 });
  const fm = B.acc(HM.field(B));
  const hx = 55, hz = 24.5;
  // the field: subdivided so the floodlights bake onto it
  const nx = 12, nz = 6;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x0 = -hx + (i / nx) * 2 * hx, x1 = -hx + ((i + 1) / nx) * 2 * hx, z0 = -hz + (j / nz) * 2 * hz, z1 = -hz + ((j + 1) / nz) * 2 * hz;
    const P = (lx, lz) => { const [x, z] = W(lx, lz); return [x, B.groundY(x, z) + 0.1, z]; };
    fm.quadP(P(x0, z1), P(x1, z1), P(x1, z0), P(x0, z0), [i / nx, 1 - (j + 1) / nz, (i + 1) / nx, 1 - j / nz].map((v, k) => (k % 2 ? 1 - v : v)));
  }
  // goalposts (yellow)
  const st = B.acc(M.steel(B));
  st.col = rgb('#e8c020');
  for (const sx of [-1, 1]) {
    const x = sx * (hx + 0.5);
    const a = F.P(x, 0, 0); st.box(a[0], a[1], a[2], 0.15, 3.05, 0.15);
    const b = F.P(x, 3.05, -2.8), c = F.P(x, 3.05, 2.8); st.beam(b[0], b[1], b[2], c[0], c[1], c[2], 0.12, 0.12);
    for (const sz of [-2.8, 2.8]) { const d = F.P(x, 3.05, sz); st.box(d[0], d[1], d[2], 0.1, 6, 0.1); }
  }
  // bleachers: home (north, −z) big with a press box, visitors (south) smaller
  const cm = B.acc(M.concrete(B));
  const al = B.acc(M.steel(B));
  for (const [sz, len, rows] of [[-1, 100, 12], [1, 70, 7]]) {
    const z0 = sz * (rz + 1);
    for (let r = 0; r < rows; r++) {
      cm.col = rgb('#a8a49a');
      boxL(cm, F, 0, -0.5, z0 + sz * (r * 0.85 + 0.42), len, 0.5 + r * 0.45, 0.85, 0, { top: false });
      al.col = rgb('#c8ccd0');
      boxL(al, F, 0, r * 0.45, z0 + sz * (r * 0.85 + 0.5), len, 0.08, 0.4);
    }
    // the back of the stand
    cm.col = rgb('#8a8680');
    const zb = z0 + sz * rows * 0.85;
    boxL(cm, F, 0, -0.5, zb + sz * 0.15, len, rows * 0.45 + 1.6, 0.3);
    if (sz < 0) {
      const p = B.acc(M.paint(B));
      p.col = rgb('#e8e4dc');
      boxL(p, F, 0, rows * 0.45 + 1.1, zb + sz * 2, 18, 3, 3.6);
      const gl = B.acc(M.glass(B));
      boxL(gl, F, 0, rows * 0.45 + 2.1, zb + sz * 2 - sz * 1.82, 16, 1.4, 0.05);
      p.col = rgb('#1d2f6a');
      boxL(p, F, 0, rows * 0.45 + 4.1, zb + sz * 2, 19, 0.4, 4.2);
    }
  }
  // the scoreboard at the east end
  const sg = B.acc(HM.sign(B));
  const Fs = new Frame(F.X(rx + 4, 0), F.Z(rx + 4, 0), it.ry - Math.PI / 2, it.y);
  for (const sx of [-3.5, 3.5]) { const p = Fs.P(sx, 0, -0.3); st.col = rgb('#3a3c40'); st.box(p[0], p[1] - 0.3, p[2], 0.35, 6.3, 0.35); }
  wallQ(sg, Fs, -5, 0, 5, 0, 6, 11, rectUV(ESIGN, 'scoreboard'));
  wallQ(sg, Fs, 5, -0.6, -5, -0.6, 6, 11, rectUV(ESIGN, 'mascot'));
  st.col = rgb('#2a2a2c');
  boxL(st, Fs, 0, 5.9, -0.3, 10.2, 5.2, 0.5, 0, { faces: 'lr' });
  // the light towers at the corners: a pole, a bank of lamps aimed at the field
  for (const [lx, lz] of it.towers) {
    const [x, z] = W(lx, lz);
    const y = B.groundY(x, z);
    st.col = rgb('#8a8e94');
    lattice(st, [x, y, z], [x, y + 30, z], 1.4, { bay: 2.5 });
    const ang = Math.atan2(F.Z(0, 0) - z, F.X(0, 0) - x);
    const ry = -ang + Math.PI / 2;
    const Fl = new Frame(x, z, ry, y + 30);
    st.col = rgb('#5a5e64');
    boxL(st, Fl, 0, 0, 0, 7, 3.6, 0.6);
    const g = B.acc(M.glow(B));
    g.col = rgb('#f8faff');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) boxL(g, Fl, -2.8 + c * 1.4, 0.3 + r * 1.15, 0.33, 1.1, 0.85, 0.05);
  }
}

/** A ballpark: infield dirt, a backstop, little bleachers. { x, z, ry, y }. */
export function diamond(B, it) {
  const F = new Frame(it.x, it.z, it.ry, it.y);
  const W = (lx, lz) => [F.X(lx, lz), F.Z(lx, lz)];
  const d = B.acc(M.dirt(B));
  // the infield: a quarter circle from home plate (at local 0, 0) out toward +z
  const pts = [W(0, -2)];
  for (let k = 0; k <= 8; k++) { const a = Math.PI / 4 + (k / 8) * Math.PI / 2; pts.push(W(Math.cos(a) * 38, Math.sin(a) * 38 - 2)); }
  drape(d, B, pts, { lift: 0.05, uv: 3, step: 8 });
  const p = B.acc(M.paint(B));
  p.col = rgb('#f2f2ee');
  for (const [bx, bz] of [[0, 0], [19, 19], [0, 38], [-19, 19]]) { const [x, z] = W(bx, bz); p.box(x, B.groundY(x, z), z, 0.5, 0.08, 0.5, it.ry + Math.PI / 4); }
  // the backstop and the base lines' fences
  chainFence(B, [W(-12, -6), W(-6, -10), W(6, -10), W(12, -6)], 4.5);
  chainFence(B, [W(-14, 4), W(-40, 30)], 1.3);
  chainFence(B, [W(14, 4), W(40, 30)], 1.3);
  const al = B.acc(M.steel(B));
  al.col = rgb('#c8ccd0');
  for (const sx of [-1, 1]) for (let r = 0; r < 4; r++) {
    const Fb = new Frame(F.X(sx * 16, -4 - r * 0.8), F.Z(sx * 16, -4 - r * 0.8), it.ry + sx * 0.6, it.y);
    boxL(al, Fb, 0, r * 0.4, 0, 9, 0.08, 0.5);
    boxL(al, Fb, 0, 0, 0, 9, r * 0.4, 0.06, 0, { top: false });
  }
}

// ------------------------------------------------------------------ the park

/** A pond: an ellipse of dark water with a stone edge. { x, z, rx, rz, ry }. */
export function pond(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const pts = [], edge = [];
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2, w = 1 + 0.08 * Math.sin(a * 3 + it.x);
    pts.push([F.X(Math.cos(a) * it.rx * w, Math.sin(a) * it.rz * w), F.Z(Math.cos(a) * it.rx * w, Math.sin(a) * it.rz * w)]);
    edge.push([F.X(Math.cos(a) * (it.rx * w + 1.6), Math.sin(a) * (it.rz * w + 1.6)), F.Z(Math.cos(a) * (it.rx * w + 1.6), Math.sin(a) * (it.rz * w + 1.6))]);
  }
  drape(B.acc(M.pave(B)), B, edge, { lift: 0.05, uv: 2, step: 8 });
  drape(B.acc(HM.water(B)), B, pts, { lift: 0.09, uv: 8, step: 8 });
}

/** A playground: swings, a slide, a climbing frame, in primary colours. */
export function playground(B, x, z, ry) {
  const y = B.groundY(x, z);
  const F = new Frame(x, z, ry, y);
  const st = B.near(M.steel(B));
  st.col = rgb('#c82a2a');
  for (const sx of [-2.5, 2.5]) for (const sz of [-1, 1]) { const a = F.P(sx, 0, sz), b = F.P(sx, 2.6, 0); st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.08, 0.08); }
  { const a = F.P(-2.6, 2.6, 0), b = F.P(2.6, 2.6, 0); st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.1, 0.1); }
  st.col = rgb('#1a1a1a');
  for (const sx of [-1.2, 0, 1.2]) boxL(st, F, sx, 0.5, 0, 0.5, 0.05, 0.22);
  // the slide and its ladder
  st.col = rgb('#e8c020');
  const s0 = F.P(6, 2.2, 0), s1 = F.P(9.5, 0.3, 0);
  st.beam(s0[0], s0[1], s0[2], s1[0], s1[1], s1[2], 0.7, 0.08);
  st.col = rgb('#2a6ac8');
  boxL(st, F, 5.5, 0, 0, 1.2, 2.2, 1.2, 0, { top: true });
  // the climbing frame
  st.col = rgb('#2a9a4a');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxL(st, F, -6 + sx * 1.2, 0, 3 + sz * 1.2, 0.1, 2.4, 0.1);
  for (const yy of [0.8, 1.6, 2.4]) { boxL(st, F, -6, yy, 4.2, 2.4, 0.06, 0.06); boxL(st, F, -6, yy, 1.8, 2.4, 0.06, 0.06); }
}

/** A park lamp: a short post, a globe (warm). */
export function parkLamp(B, x, z) {
  const y = B.groundY(x, z);
  const st = B.acc(M.steel(B));
  st.col = rgb('#1e2a22');
  st.cyl(x, y - 0.2, z, 0.08, 3.6, 6, 0.06);
  const g = B.acc(M.glow(B));
  g.col = rgb('#ffe2b0');
  sphere(g, x, y + 3.75, z, 0.28, 6);
}

/** A bench. */
export function bench(B, x, z, ry) {
  const y = B.groundY(x, z);
  const F = new Frame(x, z, ry, y);
  const w = B.near(M.wood(B));
  w.col = rgb('#8a6a48');
  boxL(w, F, 0, 0.42, 0, 1.8, 0.06, 0.45);
  boxL(w, F, 0, 0.5, -0.24, 1.8, 0.4, 0.05);
  const st = B.near(M.steel(B));
  st.col = rgb('#2a2a2c');
  for (const sx of [-0.8, 0.8]) boxL(st, F, sx, 0, 0, 0.06, 0.45, 0.45);
}

/** A gazebo: an octagon of posts, a pointed roof. */
export function gazebo(B, x, z) {
  const y = B.groundY(x, z);
  const p = B.acc(M.paint(B));
  p.col = rgb('#f2f0ea');
  cylinder(p, x, y - 0.2, z, 4.2, 0.6, 8, { top: true });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.box(x + Math.cos(a) * 3.8, y + 0.4, z + Math.sin(a) * 3.8, 0.2, 2.6, 0.2); }
  const rf = B.acc(HM.roof(B));
  rf.col = rgb('#3a4a5a');
  cone(rf, x, y + 3.0, z, 4.8, 2.6, 8);
}

// ------------------------------------------------------------------ the water tower

/** The water tower: legs, bracing, a riser, the tank with EASTSIDE on it, a red light. { x, z, y, h }. */
export function wtower(B, it) {
  const { x, z } = it, y = it.y, H = it.h;
  const st = B.acc(M.steel(B));
  st.col = rgb('#b8bcc0');
  const R = 7.2, legs = 6;
  const P = (a, r, hh2) => [x + Math.cos(a) * r, y + hh2, z + Math.sin(a) * r];
  for (let k = 0; k < legs; k++) {
    const a = (k / legs) * Math.PI * 2;
    const b = P(a, R * 1.35, 0), t = P(a, R * 0.92, H);
    st.beam(b[0], b[1] - 0.5, b[2], t[0], t[1], t[2], 0.55, 0.55);
    const a2 = ((k + 1) / legs) * Math.PI * 2;
    for (const f of [0.3, 0.62]) {
      const r0 = R * (1.35 - 0.43 * f);
      const p0 = P(a, r0, H * f), p1 = P(a2, r0, H * f);
      st.beam(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.2, 0.2);
      const q0 = P(a, R * (1.35 - 0.43 * (f - 0.3)), H * (f - 0.3)), q1 = P(a2, r0, H * f);
      st.beam(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], 0.08, 0.08);
    }
  }
  st.cyl(x, y - 0.3, z, 0.9, H + 0.4, 8);
  // the tank: a short drum with a cone under it and a dome over it
  const p = B.acc(M.paint(B));
  p.col = rgb('#d4d8dc');
  coneDown(p, x, y + H + 0.2, z, R * 1.08, 4.5, 16);
  cylinder(p, x, y + H, z, R * 1.08, 6.5, 16);
  sphere(p, x, y + H + 6.5, z, R * 1.08, 16, { dome: true, sy: 0.42 });
  // the catwalk and its rail
  st.col = rgb('#8a8e94');
  cylinder(st, x, y + H + 0.05, z, R * 1.08 + 1.1, 0.15, 16, { top: false });
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, b2 = ((k + 1) / 16) * Math.PI * 2; const r = R * 1.08 + 1.05; st.beam(x + Math.cos(a) * r, y + H + 1.1, z + Math.sin(a) * r, x + Math.cos(b2) * r, y + H + 1.1, z + Math.sin(b2) * r, 0.05, 0.05); }
  // EASTSIDE, twice round the tank (facing the freeway and the town)
  const sg = B.acc(HM.sign(B));
  const u = rectUV(ESIGN, 'water');
  const r = R * 1.08 + 0.04;
  for (const face of it.faces) {
    const span = 1.1, n = 5;
    const uf = (f) => u[0] + (u[2] - u[0]) * (span / 2 - f) / span;
    for (let k = 0; k < n; k++) {
      const f0 = -span / 2 + (k / n) * span, f1 = -span / 2 + ((k + 1) / n) * span;
      const Q = (f, yy) => [x + Math.cos(face + f) * r, yy, z + Math.sin(face + f) * r];
      sg.quadP(Q(f1, y + H + 1.4), Q(f0, y + H + 1.4), Q(f0, y + H + 5.6), Q(f1, y + H + 5.6), [uf(f1), u[1], uf(f0), u[3]]);
    }
  }
  const bl = B.acc(HM.blink(B));
  bl.box(x, y + H + 6.5 + R * 0.45, z, 0.6, 0.6, 0.6);
}

// ------------------------------------------------------------------ the sound wall, the drive-in, barns

/** Concrete sound-wall panels along a run of points (both faces), posts between. */
export function soundwall(B, it) {
  const cm = B.acc(M.concrete(B));
  for (let k = 0; k < it.pts.length - 1; k++) {
    const [ax, az] = it.pts[k], [bx, bz] = it.pts[k + 1];
    const ya = B.groundY(ax, az), yb2 = B.groundY(bx, bz);
    const len = Math.hypot(bx - ax, bz - az);
    cm.col = rgb(k % 3 === 1 ? '#b0aca2' : '#bcb8ae');
    cm.quadP([ax, ya - 0.5, az], [bx, yb2 - 0.5, bz], [bx, yb2 + it.h, bz], [ax, ya + it.h, az], [0, 0, len / 4, it.h / 4]);
    cm.quadP([bx, yb2 - 0.5, bz], [ax, ya - 0.5, az], [ax, ya + it.h, az], [bx, yb2 + it.h, bz], [0, 0, len / 4, it.h / 4]);
    cm.col = rgb('#9a968c');
    cm.box(ax, ya - 0.5, az, 0.5, it.h + 0.8, 0.5, -Math.atan2(bz - az, bx - ax));
  }
}

/** The STARLITE DRIVE-IN (long closed): the screen, its marquee, speaker posts, the snack bar. */
export function drivein(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const st = B.acc(M.steel(B));
  st.col = rgb('#6a6660');
  // the screen: a big panel on a braced frame (its face toward local +z)
  const sw = 30, sh = 13, sy = 4;
  for (let x = -sw / 2; x <= sw / 2; x += 5) { const a = F.P(x, 0, -1.5), b = F.P(x, sy + sh + 0.5, -1.5); st.beam(a[0], a[1] - 0.5, a[2], b[0], b[1], b[2], 0.4, 0.4); const c = F.P(x, 0, -7); st.beam(c[0], c[1] - 0.5, c[2], b[0], b[1] - 2, b[2], 0.25, 0.25); }
  const sg = B.acc(HM.sign(B));
  wallQ(sg, F, -sw / 2, 0, sw / 2, 0, sy, sy + sh, rectUV(ESIGN, 'screen'));
  const p = B.acc(M.paint(B));
  p.col = rgb('#8a8680');
  wallQ(p, F, sw / 2, -0.1, -sw / 2, -0.1, sy, sy + sh);
  boxL(p, F, 0, sy - 0.4, -0.05, sw + 0.6, 0.4, 0.3);
  // speaker posts in curved rows
  for (let r = 0; r < 5; r++) for (let k = -5; k <= 5; k++) {
    const lx = k * 5.5, lz = 18 + r * 9 + Math.abs(k) * 0.4;
    const P0 = F.P(lx, 0, lz);
    st.box(P0[0], B.groundY(P0[0], P0[2]) - 0.2, P0[2], 0.08, 1.3, 0.08);
    st.box(P0[0], B.groundY(P0[0], P0[2]) + 1.0, P0[2], 0.35, 0.25, 0.2, it.ry);
  }
  // the snack bar at the back of the field
  const Fs = new Frame(F.X(0, 64), F.Z(0, 64), it.ry + Math.PI, 0);
  walls(B, Fs, 12, 7, y - 0.5, y + 0.2, y + 3.2, '#e8dcc0', (side, i) => (side === 'f' && i === 1 ? HS.picture : HS.stuccoPlain));
  flatRoof(B, Fs, 12, 7, y + 3.2, it.n);
  // the marquee by the gate
  const Fm = new Frame(F.X(it.gate[0], it.gate[1]), F.Z(it.gate[0], it.gate[1]), it.ry + it.gate[2], y);
  st.col = rgb('#4a4640');
  for (const sx of [-2.2, 2.2]) { const a = Fm.P(sx, 0, 0); st.box(a[0], a[1] - 0.4, a[2], 0.3, 5.2, 0.3); }
  wallQ(sg, Fm, -2.6, 0.18, 2.6, 0.18, 2.4, 5.0, rectUV(ESIGN, 'driveIn'));
  wallQ(sg, Fm, 2.6, -0.18, -2.6, -0.18, 2.4, 5.0, rectUV(ESIGN, 'driveIn'));
}

/** A red barn with a gambrel roof, and a silo. { x, z, ry, w, d, y0, yb }. */
export function barn(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const wall = B.acc(M.wood(B));
  wall.col = rgb('#9a2a1e');
  const hw = it.w / 2, hd = it.d / 2, top = it.yb + 4.5;
  for (const [side, ax, az, bx, bz] of SIDES(hw, hd)) { void side; wallQ(wall, F, ax, az, bx, bz, it.y0, top, [0, 0, Math.hypot(bx - ax, bz - az) / 2, (top - it.y0) / 4]); }
  // gambrel: two pitches each side
  const rf = B.acc(HM.roof(B));
  rf.col = rgb('#4a4a4c');
  const k1 = hd * 0.55, y1 = top + 3.2, y2 = top + 5.0;
  for (const sd of [1, -1]) {
    if (sd > 0) {
      slope(rf, F, [-hw - 0.3, top, hd + 0.4], [hw + 0.3, top, hd + 0.4], [hw + 0.3, y1, k1], [-hw - 0.3, y1, k1]);
      slope(rf, F, [-hw - 0.3, y1, k1], [hw + 0.3, y1, k1], [hw + 0.3, y2, 0], [-hw - 0.3, y2, 0]);
    } else {
      slope(rf, F, [hw + 0.3, top, -hd - 0.4], [-hw - 0.3, top, -hd - 0.4], [-hw - 0.3, y1, -k1], [hw + 0.3, y1, -k1]);
      slope(rf, F, [hw + 0.3, y1, -k1], [-hw - 0.3, y1, -k1], [-hw - 0.3, y2, 0], [hw + 0.3, y2, 0]);
    }
  }
  for (const sx of [1, -1]) {
    const x = sx * hw;
    const pts = [[hd, top], [k1, y1], [0, y2], [-k1, y1], [-hd, top]];
    const c = wall.v(...F.P(x, top, 0), 0, 0);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = wall.v(...F.P(x, pts[k][1], pts[k][0]), pts[k][0] / 2, pts[k][1] / 4), b = wall.v(...F.P(x, pts[k + 1][1], pts[k + 1][0]), pts[k + 1][0] / 2, pts[k + 1][1] / 4);
      if (sx > 0) wall.tri(c, a, b); else wall.tri(c, b, a);
    }
  }
  // white trim: a big X on the doors
  const p = B.acc(M.paint(B));
  p.col = rgb('#f2f0ea');
  const d0 = F.P(-2.5, it.yb, hd + 0.05), d1 = F.P(2.5, it.yb + 4, hd + 0.05), d2 = F.P(2.5, it.yb, hd + 0.05), d3 = F.P(-2.5, it.yb + 4, hd + 0.05);
  p.beam(d0[0], d0[1], d0[2], d1[0], d1[1], d1[2], 0.25, 0.08);
  p.beam(d2[0], d2[1], d2[2], d3[0], d3[1], d3[2], 0.25, 0.08);
  // the silo
  const sx = F.X(hw + 4.5, -hd * 0.3), sz = F.Z(hw + 4.5, -hd * 0.3);
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#c8c4ba');
  cylinder(cm, sx, it.y0, sz, 3.2, 15 + (it.yb - it.y0), 12, { u: 4 });
  const st = B.acc(M.steel(B));
  st.col = rgb('#8a8e94');
  sphere(st, sx, it.yb + 15, sz, 3.3, 12, { dome: true, sy: 0.6 });
}

export { tree, car };
