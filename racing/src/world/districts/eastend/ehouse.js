// EASTSIDE — houses and their lots: clapboard, brick and stucco houses
// (ranches, colonials, bungalows, cape cods, split-levels) laid bay by bay
// from the house atlas, shingle roofs (gable, hip, gable to the street,
// dormers), porches with posts and a light, chimneys, garages attached, in
// a wing or out back; front lawns, driveways and walks, picket fences,
// hedges and privacy fences, mailboxes, trees in their autumn colours, and
// what's out back (a pool that glows at night, a shed, a swing set, a hoop).
import * as THREE from 'three';
import { litMat, cylinder, hip, drape } from '../builder.js';
import { groundTexture } from '../../../track/textures.js';
import { HOUSE, HS, ESIGN, tileUV, rectUV } from './atlas.js';
import { houseAtlas, shingles, picket, eastSigns, footballField, crops } from './etex.js';
import { M, Frame, rgb, shade, wallQ, flatQ, boxL, facade, slope, gableStrips, tree } from './kit.js';

export const HM = {
  wall: (B) => B.mat('wall', () => { const t = houseAtlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.85, envMapIntensity: 0.35 }, { night: 1.0 }); }),
  roof: (B) => B.mat('roof', () => litMat({ map: shingles(), vertexColors: true, roughness: 0.92, envMapIntensity: 0.25 })),
  lawn: (B) => B.mat('lawn', () => litMat({ map: groundTexture('grass'), vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { shadow: false })),
  picket: (B) => B.mat('picket', () => litMat({ map: picket(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7 }, { shadow: false })),
  sign: (B) => B.mat('sign', () => { const t = eastSigns(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6, envMapIntensity: 0.4 }, { night: 1.4 }); }),
  field: (B) => B.mat('field', () => litMat({ map: footballField(), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, { shadow: false })),
  crops: (B) => B.mat('crops', () => litMat({ map: crops(), vertexColors: true, roughness: 0.96, envMapIntensity: 0.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { shadow: false })),
  water: (B) => B.mat('water', () => litMat({ color: 0x163e4c, roughness: 0.06, metalness: 0.3, envMapIntensity: 1.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, { shadow: false })),
  blink: (B) => B.mat('blink', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1a0a').multiplyScalar(3) })),
};

/** A stable hash in [0, 1). */
export function hh(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const SIDES = (hw, hd) => [['f', -hw, hd, hw, hd], ['r', hw, hd, hw, -hd], ['b', hw, -hd, -hw, -hd], ['l', -hw, -hd, -hw, hd]];
const SC = { f: 1, r: 2, b: 3, l: 4 };

const TS = {
  siding: { plain: HS.plain, win: HS.win, winLit: HS.winLit, tv: HS.winTV, pic: HS.picture, picLit: HS.pictureLit, small: HS.small, smallLit: HS.smallLit, door: HS.door, doorLit: HS.doorLit, gar: HS.garage, garW: HS.garageWin, g2L: HS.garage2L, g2R: HS.garage2R, shut: HS.shutters, found: HS.block },
  brick: { plain: HS.bPlain, win: HS.bWin, winLit: HS.bWinLit, tv: HS.bWinLit, pic: HS.bPicture, picLit: HS.bPictureLit, small: HS.bSmall, smallLit: HS.bSmall, door: HS.bDoor, doorLit: HS.bDoor, gar: HS.bGarage, garW: HS.bGarage, g2L: null, g2R: null, shut: HS.bWin, found: HS.bPlain },
  stucco: { plain: HS.sPlain, win: HS.sArch, winLit: HS.sArchLit, tv: HS.sWinLit, pic: HS.sWin, picLit: HS.sWinLit, small: HS.sSmall, smallLit: HS.sSmall, door: HS.sDoor, doorLit: HS.sDoor, gar: HS.sGarage, garW: HS.sGarage, g2L: null, g2R: null, shut: HS.sWin, found: HS.sPlain },
};

function winTile(it, T, i, f, salt) {
  const lit = hh(it.n, i * 13 + f * 7, salt) < it.lit;
  if (lit) return hh(it.n, i, f + salt) < 0.14 ? T.tv : T.winLit;
  return it.shutters ? T.shut : T.win;
}

function tileFor(it, T, side, i, n, f) {
  const s = SC[side];
  if (side === 'f') {
    if (f === 0 && it.garIn && i >= it.garIn[0] && i <= it.garIn[1]) {
      if (it.garIn[1] - it.garIn[0] === 1 && T.g2L !== null) return i === it.garIn[0] ? T.g2L : T.g2R;
      return hh(it.n, i, 7) < 0.4 ? T.garW : T.gar;
    }
    if (f === 0 && i === it.door) return it.lit > 0.25 ? T.doorLit : T.door;
    if (f === 0 && i === it.pic) return hh(it.n, i, 21) < it.lit * 1.4 ? T.picLit : T.pic;
    if (f > 0 && it.garIn && i >= it.garIn[0] && i <= it.garIn[1] && it.floors > 1) return winTile(it, T, i, f, 5);
    return winTile(it, T, i, f, 3);
  }
  const r = hh(it.n, i * 3 + f * 11, s);
  if (side === 'b') {
    if (f === 0 && i === 1 && n > 2) return T.door;
    return r < 0.45 ? T.plain : winTile(it, T, i, f, 9);
  }
  if (n > 2 && (i === 0 || i === n - 1)) return T.plain;
  return r < 0.4 ? T.plain : r < 0.55 ? (hh(it.n, i, s + f) < it.lit ? T.smallLit : T.small) : winTile(it, T, i, f, 13);
}

/** A house body (walls, roof) in frame Fh: w × d, floors × fh over yb, its gables, porch, chimney, dormers. */
function body(B, it, Fh, w, d, o) {
  const wall = B.acc(HM.wall(B));
  const tint = rgb(it.tint);
  wall.col = tint;
  const T = TS[it.wall];
  const hw = w / 2, hd = d / 2;
  const top = it.yb + o.floors * it.fh;
  for (const [side, ax, az, bx, bz] of SIDES(hw, hd)) {
    const rows = [{ h: it.yb - it.y0, v: [0, Math.min(1, (it.yb - it.y0) / 3)], tile: () => T.found }];
    for (let f = 0; f < o.floors; f++) rows.push({ h: it.fh, v: [0, Math.min(1, it.fh / 3)], tile: o.tiles ? (i, n) => o.tiles(side, i, n, f) : (i, n) => tileFor(it, T, side, i, n, f) });
    facade(wall, Fh, HOUSE, ax, az, bx, bz, it.y0, rows, { bay: 3 });
  }
  // the roof
  const rf = B.acc(HM.roof(B));
  rf.col = rgb(it.roofTint);
  const trim = B.acc(M.paint(B));
  trim.col = rgb(it.trim || '#f2f0ea');
  const rise = o.rise;
  if (o.roof === 'hip') {
    hip(rf, Fh.x, top, Fh.z, w, d, rise, Fh.ry, { over: 0.45, u: 4 });
    boxL(trim, Fh, 0, top - 0.22, 0, w + 0.9, 0.22, d + 0.9, 0, { top: false });
    return top;
  }
  const along = o.roof !== 'gableZ';
  const Fr = along ? Fh : new Frame(Fh.x, Fh.z, Fh.ry + Math.PI / 2, 0);
  const L = along ? w : d, S = along ? d : w;
  const ov = 0.45, ovg = 0.3, hl = L / 2 + ovg, hs = S / 2 + ov;
  const ye = top - rise * ov / (S / 2);
  const sl = Math.hypot(hs, rise + (top - ye));
  slope(rf, Fr, [-hl, ye, hs], [hl, ye, hs], [hl, top + rise, 0], [-hl, top + rise, 0], [0, 0, 2 * hl / 4, sl / 4]);
  slope(rf, Fr, [hl, ye, -hs], [-hl, ye, -hs], [-hl, top + rise, 0], [hl, top + rise, 0], [0, 0, 2 * hl / 4, sl / 4]);
  // fascia along the eaves, barge boards up the gables
  for (const sd of [1, -1]) boxL(trim, Fr, 0, ye - 0.2, sd * (hs - 0.04), 2 * hl, 0.22, 0.08, 0, { top: false });
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    const a = Fr.P(sx * hl, ye - 0.05, sz * hs), b = Fr.P(sx * hl, top + rise - 0.05, 0);
    trim.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.08, 0.22);
  }
  // the gable ends in the walls (siding, a vent in the middle)
  const gt = it.wall === 'stucco' ? HS.sPlain : it.style === 'bungalow' ? HS.shingleSide : HS.plain;
  wall.col = it.wall === 'brick' ? rgb(it.gableTint || '#e8e2d4') : tint;
  gableStrips(wall, Fr, HOUSE, gt, L / 2, S / 2, L / 2, -S / 2, top, rise);
  gableStrips(wall, Fr, HOUSE, gt, -L / 2, -S / 2, -L / 2, S / 2, top, rise);
  if (it.wall !== 'stucco' && rise > 1.6) {
    const vh = Math.min(1.4, rise * 0.45), vy = top + rise * 0.3;
    for (const sx of [1, -1]) {
      const x = sx * (L / 2 + 0.03);
      if (sx > 0) wallQ(wall, Fr, x, vh / 2, x, -vh / 2, vy, vy + vh, tileUV(HOUSE, HS.gableVent, 0.2, 0.42, 0.8, 0.78));
      else wallQ(wall, Fr, x, -vh / 2, x, vh / 2, vy, vy + vh, tileUV(HOUSE, HS.gableVent, 0.2, 0.42, 0.8, 0.78));
    }
  }
  return top;
}

/**
 * A house and its lot (one item): { x, z, w, d, ry (lot, front +z), style,
 * wall, tint, roofTint, trim, hx, hz, hw, hd, floors, fh, roof, rise, door,
 * pic, shutters, lit, garIn, wing, back, porch, dormers, chimney, drive,
 * walk, fence, hedge, trees, extras, mailbox, y0, yb, n }.
 */
export function home(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const Fh = new Frame(F.X(it.hx, it.hz), F.Z(it.hx, it.hz), it.ry, 0);
  const top = body(B, it, Fh, it.hw, it.hd, { floors: it.floors, roof: it.roof, rise: it.rise });
  const front = it.hz + it.hd / 2;                 // the house's front line (lot frame)
  const trim = B.acc(M.paint(B));
  trim.col = rgb(it.trim || '#f2f0ea');
  // dormers on the front slope (cape cods): a window, cheeks, a little gable roof
  if (it.dormers && it.roof === 'gable') {
    const wall = B.acc(HM.wall(B));
    const rf = B.acc(HM.roof(B));
    rf.col = rgb(it.roofTint);
    for (let k = 0; k < it.dormers; k++) {
      const dx = (k - (it.dormers - 1) / 2) * (it.hw / it.dormers);
      const zf = it.hd / 2 - 0.9;                                   // its face (house frame)
      const yr = top + it.rise * 0.9 / (it.hd / 2);                 // the roof there
      const Fd = new Frame(Fh.X(dx, zf - 0.6), Fh.Z(dx, zf - 0.6), it.ry, 0);
      wall.col = rgb(it.wall === 'brick' ? '#e8e2d4' : it.tint);
      wallQ(wall, Fd, -0.9, 0.6, 0.9, 0.6, yr - 0.1, yr + 1.5, tileUV(HOUSE, hh(it.n, k, 31) < it.lit ? HS.dormerLit : HS.dormer, 0.15, 0.2, 0.85, 0.75));
      wallQ(wall, Fd, 0.9, 0.6, 0.9, -1.6, yr - 0.7, yr + 1.5, tileUV(HOUSE, HS.plain, 0, 0, 0.6, 0.6));
      wallQ(wall, Fd, -0.9, -1.6, -0.9, 0.6, yr - 0.7, yr + 1.5, tileUV(HOUSE, HS.plain, 0, 0, 0.6, 0.6));
      gableStrips(wall, Fd, HOUSE, HS.plain, -0.9, 0.6, 0.9, 0.6, yr + 1.5, 0.65);
      const ye = yr + 1.42, yt = yr + 2.2;
      slope(rf, Fd, [-1.15, ye, -1.8], [-1.15, ye, 0.85], [0, yt, 0.85], [0, yt, -1.8]);
      slope(rf, Fd, [1.15, ye, 0.85], [1.15, ye, -1.8], [0, yt, -1.8], [0, yt, 0.85]);
    }
  }
  // the porch: a slab, posts, a shed roof, a rail
  if (it.porch) {
    const pw = it.porch.w, pd = it.porch.d, px = it.porch.x ?? 0;
    const gy = B.groundY(F.X(it.hx + px, front + pd / 2), F.Z(it.hx + px, front + pd / 2));
    const cm = B.acc(M.concrete(B));
    cm.col = rgb('#b8b4aa');
    boxL(cm, Fh, px, gy - 0.4, it.hd / 2 + pd / 2, pw, it.yb - gy + 0.4, pd, 0, { u: 2 });
    const ph = Math.min(it.fh - 0.25, 2.75);
    const n = Math.max(2, Math.round(pw / 2.6));
    for (let k = 0; k <= n; k++) {
      const lx = px - pw / 2 + 0.2 + (k / n) * (pw - 0.4);
      boxL(trim, Fh, lx, it.yb, it.hd / 2 + pd - 0.2, 0.2, ph, 0.2);
      if (k < n && Math.abs(lx + (pw - 0.4) / n / 2 - (it.walkX ?? 99)) > 1) boxL(trim, Fh, lx + (pw - 0.4) / n / 2, it.yb + 0.85, it.hd / 2 + pd - 0.2, (pw - 0.4) / n, 0.08, 0.08);
    }
    const rf = B.acc(HM.roof(B));
    rf.col = rgb(it.roofTint);
    const y1 = it.yb + Math.min(it.fh - 0.15, ph + 0.9), y2 = it.yb + ph + 0.05;
    slope(rf, Fh, [px - pw / 2 - 0.3, y2, it.hd / 2 + pd + 0.3], [px + pw / 2 + 0.3, y2, it.hd / 2 + pd + 0.3], [px + pw / 2 + 0.3, y1, it.hd / 2], [px - pw / 2 - 0.3, y1, it.hd / 2], [0, 0, pw / 4, pd / 4]);
    // the underside (porch ceiling), the fascia
    slope(trim, Fh, [px - pw / 2 - 0.3, y1 - 0.05, it.hd / 2], [px + pw / 2 + 0.3, y1 - 0.05, it.hd / 2], [px + pw / 2 + 0.3, y2 - 0.05, it.hd / 2 + pd + 0.3], [px - pw / 2 - 0.3, y2 - 0.05, it.hd / 2 + pd + 0.3]);
    boxL(trim, Fh, px, y2 - 0.25, it.hd / 2 + pd + 0.28, pw + 0.6, 0.25, 0.08, 0, { top: false });
  }
  // the porch light by the door
  {
    const n = Math.max(1, Math.round(it.hw / 3)), bw = it.hw / n;
    const lx = -it.hw / 2 + (it.door + 0.5) * bw + 0.75;
    const g = B.acc(M.glow(B));
    g.col = rgb('#ffcf80');
    boxL(g, Fh, lx, it.yb + 2.0, it.hd / 2 + 0.06, 0.18, 0.3, 0.12);
  }
  // a chimney up one end
  if (it.chimney) {
    const pl = B.acc(M.bplain(B));
    pl.col = rgb(it.chimneyTint || '#c88a70');
    const cx = it.chimney * (it.hw / 2 + 0.45);
    const h = top + it.rise + 1.0 - it.y0;
    boxL(pl, Fh, cx, it.y0, -it.hd * 0.1, 0.9, h, 1.7, 0, { u: 4 });
    const cp = B.acc(M.concrete(B));
    cp.col = rgb('#6a6660');
    boxL(cp, Fh, cx, it.y0 + h, -it.hd * 0.1, 1.05, 0.14, 1.85);
  }
  // the garage: in a wing beside the house, or out back
  for (const g of [it.wing, it.back]) {
    if (!g) continue;
    const Fg = new Frame(F.X(g.x, g.z), F.Z(g.x, g.z), it.ry, 0);
    const gi = { ...it, floors: 1, wall: it.wall, garIn: g.doors === 2 ? [0, 1] : [0, 0], door: -1, pic: -1 };
    const n = Math.max(1, Math.round(g.w / 3));
    if (g.doors === 2 && n !== 2) gi.garIn = [0, n - 1];
    body(B, gi, Fg, g.w, g.d, { floors: 1, roof: 'gable', rise: g.rise || 1.6, tiles: (side, i, nn) => (side === 'f' ? tileFor(gi, TS[it.wall], 'f', i, nn, 0) : TS[it.wall].plain) });
  }
  // the hoop over the garage door
  if (it.extras?.includes('hoop') && it.drive) {
    const p = B.acc(M.paint(B));
    p.col = rgb('#f2f2ee');
    const z = (it.drive.z1 ?? front) + 0.2;
    boxL(p, F, it.drive.x, it.yb + 2.9, z, 1.8, 1.1, 0.06);
    p.col = rgb('#e85a1a');
    boxL(p, F, it.drive.x, it.yb + 3.0, z + 0.45, 0.46, 0.04, 0.46);
  }
  lot(B, it, F, front);
}

/** The lot round the house: lawn, driveway, walk, fences, mailbox, trees, the back yard. */
function lot(B, it, F, front) {
  const hw = it.w / 2, hd = it.d / 2;
  const W = (lx, lz) => [F.X(lx, lz), F.Z(lx, lz)];
  // the front lawn, its own green
  const lawn = B.acc(HM.lawn(B));
  lawn.col = rgb(it.lawn || '#ffffff');
  drape(lawn, B, [W(-hw, hd), W(-hw, front), W(hw, front), W(hw, hd)], { lift: 0.04, uv: 3, step: 5 });
  // driveway and walk
  const pave = B.acc(M.pave(B));
  if (it.drive) {
    const { x, w } = it.drive, z1 = it.drive.z1 ?? front;
    drape(pave, B, [W(x - w / 2, hd + 0.4), W(x - w / 2, z1), W(x + w / 2, z1), W(x + w / 2, hd + 0.4)], { lift: 0.08, uv: 3, step: 6 });
  }
  if (it.walkX !== undefined) {
    const x = it.walkX, z1 = front + (it.porch ? it.porch.d : 0);
    drape(pave, B, [W(x - 0.6, hd + 0.4), W(x - 0.6, z1), W(x + 0.6, z1), W(x + 0.6, hd + 0.4)], { lift: 0.08, uv: 3, step: 6 });
  }
  // the front line: a picket fence or a hedge, open at the walk and the drive
  const gaps = [];
  if (it.drive) gaps.push([it.drive.x - it.drive.w / 2 - 0.3, it.drive.x + it.drive.w / 2 + 0.3]);
  if (it.walkX !== undefined) gaps.push([it.walkX - 0.9, it.walkX + 0.9]);
  const runs = cutRuns(-hw + 0.3, hw - 0.3, gaps);
  if (it.fence === 'picket') {
    const pk = B.near(HM.picket(B));
    for (const [a, b] of runs) {
      const n = Math.max(1, Math.round((b - a) / 1.6));
      for (let k = 0; k < n; k++) {
        const x0 = a + (k / n) * (b - a), x1 = a + ((k + 1) / n) * (b - a);
        const [ax, az] = W(x0, hd - 0.4), [bx, bz] = W(x1, hd - 0.4);
        const y0 = B.groundY(ax, az), y1 = B.groundY(bx, bz);
        pk.quadP([ax, y0, az], [bx, y1, bz], [bx, y1 + 1.0, bz], [ax, y0 + 1.0, az], [0, 0, (x1 - x0) / 1.6, 1]);
      }
    }
  } else if (it.fence === 'hedge') {
    const lf = B.acc(M.leaf(B));
    lf.col = rgb('#2e4a22');
    for (const [a, b] of runs) {
      if (b - a < 1) continue;
      const [cx, cz] = W((a + b) / 2, hd - 0.9);
      boxL(lf, new Frame(cx, cz, it.ry, B.groundY(cx, cz) - 0.2), 0, 0, 0, b - a, 1.35, 1.1);
    }
  }
  // privacy fence round the back yard
  if (it.back_fence) {
    const wd = B.near(M.wood(B));
    wd.col = rgb('#9a7a58');
    const zf = front - it.hd - 1;
    const pts = [[-hw + 0.3, zf], [-hw + 0.3, -hd + 0.4], [hw - 0.3, -hd + 0.4], [hw - 0.3, zf]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = W(...pts[k]), [bx, bz] = W(...pts[k + 1]);
      const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 4));
      for (let q = 0; q < n; q++) {
        const t0 = q / n, t1 = (q + 1) / n;
        const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        const y0 = B.groundY(x0, z0), y1 = B.groundY(x1, z1);
        wd.quadP([x0, y0 - 0.1, z0], [x1, y1 - 0.1, z1], [x1, y1 + 1.8, z1], [x0, y0 + 1.8, z0], [0, 0, len / n / 2, 1]);
        wd.quadP([x1, y1 - 0.1, z1], [x0, y0 - 0.1, z0], [x0, y0 + 1.8, z0], [x1, y1 + 1.8, z1], [0, 0, len / n / 2, 1]);
      }
    }
  }
  // the mailbox by the drive
  if (it.mailbox !== undefined) {
    const [mx, mz] = W(it.mailbox, hd - 0.6);
    const y = B.groundY(mx, mz);
    const p = B.near(M.paint(B));
    p.col = rgb('#3a3a3a');
    boxL(p, new Frame(mx, mz, it.ry, y), 0, 0, 0, 0.1, 1.05, 0.1);
    p.col = rgb(it.mailCol || '#1a1a1a');
    boxL(p, new Frame(mx, mz, it.ry, y), 0, 1.0, 0.1, 0.24, 0.24, 0.48);
    p.col = rgb('#c8201a');
    boxL(p, new Frame(mx, mz, it.ry, y), 0.14, 1.12, 0.1, 0.03, 0.16, 0.04);
  }
  // trees (front and back), autumn
  for (const [lx, lz, s, col] of it.trees || []) {
    const [x, z] = W(lx, lz);
    tree(B, x, z, s, rgb(col), { kind: col === '#2a4a2a' ? 'cone' : undefined });
  }
  // out back
  for (const e of it.extras || []) {
    if (e === 'hoop') continue;
    const [ex, ez] = W(e.x, e.z);
    const y = B.groundY(ex, ez);
    const Fe = new Frame(ex, ez, it.ry + (e.ry || 0), y);
    if (e.k === 'pool') {
      const g = B.acc(M.paint(B));
      g.col = rgb('#f2f0ea');
      for (const [px, pz, pw, pd] of [[0, 2.15, 8.6, 0.6], [0, -2.15, 8.6, 0.6], [4.15, 0, 0.6, 3.7], [-4.15, 0, 0.6, 3.7]]) boxL(g, Fe, px, -0.1, pz, pw, 0.22, pd);
      const sg = B.acc(HM.sign(B));
      flatQ(sg, Fe, -3.9, -1.9, 3.9, 1.9, 0.06, true, rectUV(ESIGN, 'pool'));
    } else if (e.k === 'shed') {
      const sh = { ...it, wall: 'siding', tint: e.tint || it.tint, floors: 1, fh: 2.3, garIn: null, door: 0, pic: -1, lit: 0, yb: y + 0.15, y0: y - 0.3, style: 'shed' };
      body(B, sh, Fe, 3.2, 2.6, { floors: 1, roof: 'gable', rise: 1.0, tiles: (side, i) => (side === 'f' && i === 0 ? HS.door : HS.plain) });
    } else if (e.k === 'swing') {
      const st = B.near(M.steel(B));
      st.col = rgb(e.col || '#c82a2a');
      for (const sx of [-1.8, 1.8]) for (const sz of [-0.9, 0.9]) {
        const a = Fe.P(sx, 0, sz), b = Fe.P(sx, 2.3, 0);
        st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.07, 0.07);
      }
      const a = Fe.P(-1.9, 2.3, 0), b = Fe.P(1.9, 2.3, 0);
      st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.09, 0.09);
      st.col = rgb('#222');
      for (const sx of [-0.8, 0.8]) { boxL(st, Fe, sx, 0.5, 0, 0.5, 0.05, 0.2); const c = Fe.P(sx, 0.55, 0), d = Fe.P(sx, 2.3, 0); st.beam(c[0], c[1], c[2], d[0], d[1], d[2], 0.02, 0.02); }
    } else if (e.k === 'tramp') {
      const st = B.near(M.steel(B));
      st.col = rgb('#1a1a1a');
      cylinder(st, ex, y + 0.8, ez, 1.8, 0.08, 12, { top: true });
      st.col = rgb('#2a6ac8');
      cylinder(st, ex, y + 0.85, ez, 1.95, 0.06, 12);
    }
  }
}

/** Pieces of [a, b] left after taking out the gaps. */
export function cutRuns(a, b, gaps) {
  let runs = [[a, b]];
  for (const [g0, g1] of gaps) {
    const next = [];
    for (const [r0, r1] of runs) {
      if (g1 <= r0 || g0 >= r1) { next.push([r0, r1]); continue; }
      if (g0 > r0) next.push([r0, g0]);
      if (g1 < r1) next.push([g1, r1]);
    }
    runs = next;
  }
  return runs.filter(([r0, r1]) => r1 - r0 > 0.4);
}

export { tree };
