// THE WORKS — turning the plan's items into geometry (a cell's share at a
// time): brick factories laid bay by bay from the brick atlas (arched sash
// windows, roll-up doors, saw-tooth and monitor roofs, rooftop water tanks,
// ghost signs, fire escapes), corrugated sheds and Quonset huts, the Foundry
// stack, the Low Line (an elevated freight line on riveted steel bents),
// the power station, the rail yard, the tank farm, the salvage yard, the
// boneyard, and the yard clutter between them.
import * as THREE from 'three';
import { litMat, cylinder, cone, sphere, drape, lattice, ribbon } from '../builder.js';
import { concreteTexture } from '../../../track/textures.js';
import { BRICK, BK, METAL, MT, WSIGN, tileUV, rectUV } from './atlas.js';
import { brickAtlas, metalAtlas, worksSigns, railbed } from './tex.js';
import {
  M, Frame, rgb, shade, wallQ, flatQ, boxL, boxW, tube, facade, slope,
  chainFence, glowBox, floodMast, wallPack, drum, pallets, skip, car,
} from './kit.js';

// ------------------------------------------------------------------ materials

export const WM = {
  brick: (B) => B.mat('brick', () => { const t = brickAtlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 }, { night: 1.15 }); }),
  bplain: (B) => M.bplain(B),
  metal: (B) => B.mat('metal', () => { const t = metalAtlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.55 }, { night: 1.0 }); }),
  sign: (B) => B.mat('sign', () => { const t = worksSigns(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.75, envMapIntensity: 0.35 }, { night: 1.35 }); }),
  roof: (B) => B.mat('roof', () => litMat({ map: concreteTexture('#55534f', 'roof'), vertexColors: true, roughness: 0.95, envMapIntensity: 0.25 })),
  rail: (B) => B.mat('rail', () => litMat({ map: railbed(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { shadow: false })),
  blink: (B) => B.mat('blink', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1a0a').multiplyScalar(3) })),
  blink2: (B) => B.mat('blink2', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1a0a').multiplyScalar(3) })),
  flicker: (B) => B.mat('flicker', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a2a').multiplyScalar(2.5) })),
};

/** Make every material and texture now (at load). */
export function warmWorks(B) {
  for (const k of Object.keys(WM)) WM[k](B);
  for (const k of Object.keys(M)) M[k](B);
}

/** The per-frame life of a cell: aircraft lights and crossing lights blink, a fire flickers. */
export function blinkAnim(B) {
  const a = WM.blink(B), b = WM.blink2(B), f = WM.flicker(B);
  B.anim((t) => {
    const k = (t % 1.6) < 0.8 ? 1 : 0.06;
    a.color.setRGB(3 * k, 0.24 * k, 0.12 * k);
    b.color.setRGB(3 * (1.06 - k), 0.24 * (1.06 - k), 0.12 * (1.06 - k));
    const fl = 0.7 + 0.3 * Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1.2);
    f.color.setRGB(2.6 * fl, 1.1 * fl, 0.3 * fl);
  });
}

/** A stable hash in [0, 1). */
export function hh(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const SIDES = (hw, hd) => [['f', -hw, hd, hw, hd], ['r', hw, hd, hw, -hd], ['b', hw, -hd, -hw, -hd], ['l', -hw, -hd, -hw, hd]];
const SC = { f: 1, r: 2, b: 3, l: 4 };

// ------------------------------------------------------------------ brick buildings

const WIN = {
  arch: { dark: [BK.win, BK.win2], lit: [BK.winLit, BK.winLit2], cool: BK.winCool },
  pair: { dark: [BK.pair, BK.pair], lit: [BK.pairLit, BK.pairLit], cool: BK.pairLit },
  small: { dark: [BK.small, BK.small], lit: [BK.smallLit, BK.smallLit], cool: BK.smallLit },
};

function upperTile(it, side, i, n, f) {
  const s = SC[side];
  const r = hh(it.n, i * 7 + f * 131, s);
  if (n > 3 && (i === 0 || i === n - 1)) return it.corners === false ? null : (f % 3 === 1 ? BK.anchors : BK.pilaster);
  if (side === 'b' && r < 0.35) return BK.plain;
  if ((side === 'l' || side === 'r') && it.blind && r < 0.75) return r < 0.12 ? BK.anchors : r < 0.2 ? BK.downpipe : BK.plain;
  if (it.state === 'derelict') {
    if (r < 0.28) return BK.winBroken;
    if (r < 0.42) return BK.winBoarded;
    if (r < 0.52) return BK.winBricked;
  } else if (r < 0.04) return BK.winBricked;
  const set = WIN[it.win] || WIN.arch;
  // whole floors tend to be lit together (the night shift)
  const floorK = hh(it.n, f, 77) < 0.45 ? 1.9 : 0.25;
  const r2 = hh(it.n, i + 31, f * 13 + s);
  if (r2 < (it.lit ?? 0.12) * floorK) return hh(it.n, i, f + 99) < (it.cool ?? 0.35) ? set.cool : set.lit[i % 2];
  return set.dark[(i + f) % 2];
}

function groundTile(it, side, i, n) {
  const s = SC[side];
  const r = hh(it.n, i * 3 + 500, s);
  if (side === 'f') {
    if (it.doors && it.doors.includes(i)) return BK.door;
    if (it.front === 'loading') return r < 0.14 ? BK.rollupOpen : r < 0.22 ? BK.rollupTag : r < 0.32 ? BK.rollupHalf : r < 0.78 ? BK.rollup : BK.barred;
    if (it.front === 'shop') return r < 0.3 ? BK.office : r < 0.5 ? BK.shutter : r < 0.75 ? BK.barredLit : BK.barred;
    if (it.front === 'blank') return r < 0.55 ? BK.plinth : r < 0.75 ? BK.archBricked : BK.barred;
    if (it.front === 'garage') return r < 0.35 ? BK.rollupOpen : r < 0.7 ? BK.rollup : BK.barredLit;
    if (it.front === 'bar') return i === 0 || i === n - 1 ? BK.plinth : BK.barFront;
    return r < 0.4 ? BK.barred : r < 0.5 ? BK.barredLit : r < 0.66 ? BK.rollup : r < 0.74 ? BK.steelDoor : r < 0.84 ? BK.carriage : BK.plinth;
  }
  if (it.state === 'derelict') return r < 0.4 ? BK.archBricked : r < 0.6 ? BK.rollupTag : BK.plinth;
  if (side === 'b') return r < 0.3 ? BK.rollup : r < 0.4 ? BK.fireDoor : r < 0.52 ? BK.archBricked : r < 0.6 ? BK.rollupTag : BK.plinth;
  return r < 0.38 ? BK.barred : r < 0.46 ? BK.rollupTag : r < 0.52 ? BK.number : r < 0.6 ? BK.steelDoor : BK.plinth;
}

/** The roof line of a brick building (top of its walls). */
export const brickTop = (it) => it.yb + it.gh + (it.floors - 1) * it.fh;

/**
 * A brick building: { x, z, w, d, ry, y0, yb, floors, gh, fh, par, tint,
 * win, lit, cool, state, front, doors, roof: flat|saw|gable|monitor,
 * cornice, tower, chimney, ghost, ghostSide, fire, n }.
 */
export function brick(B, it) {
  const acc = B.acc(WM.brick(B));
  const tint = rgb(it.tint);
  acc.col = tint;
  const F = new Frame(it.x, it.z, it.ry, 0);
  const hw = it.w / 2, hd = it.d / 2;
  const top = brickTop(it);
  const saw = it.roof === 'saw';
  const hall = it.hall;           // tall arched bays instead of storeys
  for (const [side, ax, az, bx, bz] of SIDES(hw, hd)) {
    const rows = [{ h: it.yb - it.y0, v: [0, Math.min(1, (it.yb - it.y0) / 4)], tile: () => BK.plinth }];
    if (hall) {
      const tall = { h: 8, tall: true, tile: (i, n) => hallTile(it, side, i, n) };
      rows.push({ h: it.gh - 8 > 0.2 ? it.gh - 8 : 0, v: [0, Math.min(1, (it.gh - 8) / 4)], tile: () => BK.plinth });
      rows.push(tall);
      for (let f = 1; f < it.floors; f++) rows.push({ h: it.fh, tile: (i, n) => upperTile(it, side, i, n, f) });
    } else {
      const g0 = Math.min(it.gh, 4.6);
      rows.push({ h: g0, v: [0, 1], tile: (i, n) => groundTile(it, side, i, n) });
      if (it.gh - g0 > 0.1) rows.push({ h: it.gh - g0, v: [0, Math.min(1, (it.gh - g0) / 4)], tile: () => (side === 'f' ? BK.plain : BK.plainLight) });
      for (let f = 1; f < it.floors; f++) rows.push({ h: it.fh, tile: (i, n) => upperTile(it, side, i, n, f) });
    }
    if (it.par > 0 && !saw) rows.push({ h: it.par, v: [1 - Math.min(1, it.par / 4), 1], tile: () => it.cornice ?? BK.cornice });
    facade(acc, F, BRICK, ax, az, bx, bz, it.y0, rows, { bay: it.bay || 4 });
  }
  const pl = B.acc(WM.bplain(B));
  pl.col = tint;
  const rf = B.acc(WM.roof(B));
  rf.col = rgb(it.roofTint || '#8a8580');
  if (saw) sawRoof(B, F, it, top, pl, rf);
  else if (it.roof === 'gable') {
    const rise = Math.min(it.w, it.d) * 0.22;
    pitched(F, it, top, rise, rf, pl);
  } else {
    // flat: the roof a little under the parapet's top, the parapet's inside
    const ry = top + 0.05;
    flatQ(rf, F, -hw, -hd, hw, hd, ry, true, [0, 0, it.w / 8, it.d / 8]);
    if (it.par > 0) {
      const ih = 0.32;
      for (const [, ax, az, bx, bz] of SIDES(hw - ih, hd - ih)) wallQ(pl, F, bx, bz, ax, az, ry, top + it.par, [0, 0, Math.hypot(bx - ax, bz - az) / 4, it.par / 4]);
      // coping on top of the parapet
      const cp = B.acc(M.concrete(B));
      cp.col = rgb('#b8b4aa');
      for (const [, ax, az, bx, bz] of SIDES(hw, hd)) {
        const len = Math.hypot(bx - ax, bz - az);
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const a = Math.atan2(bz - az, bx - ax);
        boxL(cp, F, mx + Math.sin(a) * 0.16, top + it.par, mz - Math.cos(a) * 0.16, len + 0.3, 0.12, 0.42, -a, { u: 2 });
      }
    }
    if (it.roof === 'monitor') monitor(B, F, it, ry, tint);
    roofClutter(B, F, it, ry, tint);
  }
  if (it.tower) waterTower(B, F.X(it.tower[0], it.tower[1]), top + 0.05, F.Z(it.tower[0], it.tower[1]), it.n);
  if (it.chimney) {
    const [cx, cz, ch] = it.chimney;
    const x = F.X(cx, cz), z = F.Z(cx, cz);
    cylinder(pl, x, top - 1, z, 1.3, ch + 1, 10, { r2: 1.0, u: 4, v: 4 });
    const cp = B.acc(M.concrete(B));
    cp.col = rgb('#555');
    cylinder(cp, x, top + ch - 0.4, z, 1.18, 0.5, 10, { top: true });
  }
  if (it.ghost) ghostSign(B, F, it, top);
  if (it.fire) fireEscape(B, F, it);
  // lamps over the doors
  if (it.doors) {
    const n = Math.max(1, Math.round(it.w / (it.bay || 4))), bw = it.w / n;
    for (const i of it.doors) wallPack(B, F, -hw + (i + 0.5) * bw, it.yb + 2.95, hd);
  }
}

function hallTile(it, side, i, n) {
  const s = SC[side];
  const r = hh(it.n, i * 5 + 900, s);
  if (n > 2 && (i === 0 || i === n - 1)) return BK.hallPier;
  if (side === 'f' && it.hallDoor !== undefined && i === it.hallDoor) return BK.hallDoor;
  if (it.state === 'derelict' && r < 0.4) return BK.hallBroken;
  if (side === 'b' && r < 0.4) return BK.hallBlind;
  if (r < 0.07) return BK.hallLouvre;
  const r2 = hh(it.n, i + 77, s * 3);
  if (r2 < (it.lit ?? 0.12)) return hh(it.n, i, 5) < (it.cool ?? 0.4) ? BK.hallCool : BK.hallLit;
  return i % 4 === 2 ? BK.hallPier : BK.hall;
}

/** Saw-tooth roof: teeth along local x, ridges along z, glazing facing −x. */
function sawRoof(B, F, it, top, pl, rf) {
  const hw = it.w / 2, hd = it.d / 2;
  const n = Math.max(1, Math.round(it.w / (it.tooth || 8))), t = it.w / n;
  const r = it.rise || Math.min(3.6, t * 0.45);
  const acc = B.acc(WM.brick(B));
  acc.col = rgb('#ffffff');
  const gl = it.lit > 0.2 ? BK.glazeLit : BK.glaze;
  for (let k = 0; k < n; k++) {
    const xa = -hw + k * t, xb = xa + t;
    // the glazing (a row of tiles along z), steel frames: not tinted
    const nz = Math.max(1, Math.round(it.d / 4)), dz = it.d / nz;
    for (let q = 0; q < nz; q++) {
      const za = -hd + q * dz;
      const r0 = hh(it.n, k * 31 + q, 3);
      const id = it.state === 'derelict' ? (r0 < 0.5 ? BK.glazeBroken : BK.glaze) : r0 < (it.lit ?? 0.1) * 2 ? (r0 < (it.lit ?? 0.1) ? BK.glazeLit : BK.glazeCool) : gl === BK.glazeLit && r0 < 0.5 ? BK.glazeLit : BK.glaze;
      wallQ(acc, F, xa, za, xa, za + dz, top, top + r, tileUV(BRICK, id, 0, 0, 1, Math.min(1, r / 4)));
    }
    // the sloped back
    const sl = Math.hypot(t, r);
    slope(rf, F, [xb, top, hd], [xb, top, -hd], [xa, top + r, -hd], [xa, top + r, hd], [0, 0, it.d / 6, sl / 6]);
    // the ends: brick triangles in the front and back walls
    const a = pl.v(...F.P(xa, top, hd), xa / 4, top / 4), b = pl.v(...F.P(xb, top, hd), xb / 4, top / 4), c = pl.v(...F.P(xa, top + r, hd), xa / 4, (top + r) / 4);
    pl.tri(a, b, c);
    const a2 = pl.v(...F.P(xb, top, -hd), xb / 4, top / 4), b2 = pl.v(...F.P(xa, top, -hd), xa / 4, top / 4), c2 = pl.v(...F.P(xa, top + r, -hd), xa / 4, (top + r) / 4);
    pl.tri(a2, b2, c2);
  }
  // a gutter line of flashing along each valley
  const st = B.acc(M.steel(B));
  st.col = rgb('#3a3c3e');
  for (let k = 1; k < n; k++) boxL(st, F, -hw + k * t, top - 0.05, 0, 0.3, 0.2, it.d + 0.2);
}

/** A pitched roof (ridge along the longer side), its gable ends in plain brick. */
function pitched(F, it, top, rise, rf, pl) {
  const along = it.w >= it.d;
  const L = along ? it.w : it.d, S = along ? it.d : it.w;
  const ov = 0.35;
  const hl = L / 2 + ov, hs = S / 2 + ov;
  const sl = Math.hypot(hs, rise);
  const P = (a, y, b) => (along ? [a, y, b] : [b, y, a]);
  // two slopes (each one's corners counter-clockwise seen from above it)
  const q = (p0, p1, p2, p3) => slope(rf, F, p0, p1, p2, p3, [0, 0, (2 * hl) / 6, sl / 6]);
  if (along) {
    q(P(-hl, top - 0.12, hs), P(hl, top - 0.12, hs), P(hl, top + rise, 0), P(-hl, top + rise, 0));
    q(P(hl, top - 0.12, -hs), P(-hl, top - 0.12, -hs), P(-hl, top + rise, 0), P(hl, top + rise, 0));
  } else {
    q(P(hl, top - 0.12, hs), P(-hl, top - 0.12, hs), P(-hl, top + rise, 0), P(hl, top + rise, 0));
    q(P(-hl, top - 0.12, -hs), P(hl, top - 0.12, -hs), P(hl, top + rise, 0), P(-hl, top + rise, 0));
  }
  // the gables (in the end walls)
  const e = L / 2, s = S / 2;
  for (const sd of [1, -1]) {
    const A = P(sd * e, top, sd * s), Bq = P(sd * e, top, -sd * s), T = P(sd * e, top + rise, 0);
    const ia = pl.v(...F.P(...A), 0, top / 4), ib = pl.v(...F.P(...Bq), S / 4, top / 4), it2 = pl.v(...F.P(...T), S / 8, (top + rise) / 4);
    if (along) pl.tri(ia, ib, it2); else pl.tri(ib, ia, it2);
  }
}

/** A monitor (a raised glazed lantern along the ridge of a flat roof). */
function monitor(B, F, it, ry, tint) {
  const along = it.w >= it.d;
  const L = (along ? it.w : it.d) * 0.84, Wm = Math.min(10, (along ? it.d : it.w) * 0.3), h = 3.2;
  const acc = B.acc(WM.brick(B));
  acc.col = [1, 1, 1];
  const hl = L / 2, hs = Wm / 2;
  const n = Math.max(1, Math.round(L / 4));
  const lit = it.lit > 0.25;
  const Fm = along ? F : new Frame(F.x, F.z, F.ry + Math.PI / 2, 0);
  for (let k = 0; k < n; k++) {
    const a = -hl + (k / n) * L, b = -hl + ((k + 1) / n) * L;
    const id = lit && hh(it.n, k, 41) < 0.7 ? BK.monitorLit : BK.monitor;
    wallQ(acc, Fm, a, hs, b, hs, ry, ry + h, tileUV(BRICK, id, 0, 0, 1, h / 4));
    wallQ(acc, Fm, b, -hs, a, -hs, ry, ry + h, tileUV(BRICK, id, 0, 0, 1, h / 4));
  }
  const pl = B.acc(WM.bplain(B));
  pl.col = tint;
  wallQ(pl, Fm, hl, hs, hl, -hs, ry, ry + h, [0, 0, Wm / 4, h / 4]);
  wallQ(pl, Fm, -hl, -hs, -hl, hs, ry, ry + h, [0, 0, Wm / 4, h / 4]);
  const rf = B.acc(WM.roof(B));
  rf.col = rgb('#6a6660');
  const rise = 1.4, ov = 0.5;
  slope(rf, Fm, [-hl - ov, ry + h - 0.1, hs + ov], [hl + ov, ry + h - 0.1, hs + ov], [hl + ov, ry + h + rise, 0], [-hl - ov, ry + h + rise, 0], [0, 0, L / 6, 1]);
  slope(rf, Fm, [hl + ov, ry + h - 0.1, -hs - ov], [-hl - ov, ry + h - 0.1, -hs - ov], [-hl - ov, ry + h + rise, 0], [hl + ov, ry + h + rise, 0], [0, 0, L / 6, 1]);
  for (const sd of [1, -1]) {
    const A = Fm.P(sd * hl, ry + h, sd * hs), Bq = Fm.P(sd * hl, ry + h, -sd * hs), T = Fm.P(sd * hl, ry + h + rise, 0);
    const ia = pl.v(...A, 0, 0), ib = pl.v(...Bq, Wm / 4, 0), ic = pl.v(...T, Wm / 8, rise / 4);
    pl.tri(ia, ib, ic);
  }
}

/** Boxes on a flat roof: vents, plant, a stair house. */
function roofClutter(B, F, it, ry, tint) {
  const hw = it.w / 2, hd = it.d / 2;
  const st = B.acc(M.paint(B));
  const n = Math.min(4, Math.floor(it.w * it.d / 300));
  for (let k = 0; k < n; k++) {
    const r1 = hh(it.n, k, 11), r2 = hh(it.n, k, 12), r3 = hh(it.n, k, 13);
    const lx = (r1 - 0.5) * (it.w - 6), lz = (r2 - 0.5) * (it.d - 6);
    if (it.tower && Math.abs(lx - it.tower[0]) < 5 && Math.abs(lz - it.tower[1]) < 5) continue;
    st.col = rgb(r3 < 0.5 ? '#6e7070' : '#8a8478');
    if (r3 < 0.35) {
      boxL(st, F, lx, ry, lz, 2.4, 1.4, 1.6);
      st.col = rgb('#2a2a2a');
      cylinder(st, F.X(lx, lz), ry + 1.4, F.Z(lx, lz), 0.55, 0.15, 8, { top: true });
    } else if (r3 < 0.7) {
      boxL(st, F, lx, ry, lz, 1.2, 0.8, 1.2);
      st.col = rgb('#4a4a48');
      boxL(st, F, lx, ry + 0.8, lz, 0.5, 1.2, 0.5);
    } else {
      // a stair house in the building's own brick
      const pl = B.acc(WM.bplain(B));
      pl.col = tint;
      boxL(pl, F, lx, ry, lz, 3.4, 3.0, 3.4, 0, { u: 4 });
    }
  }
  void hw; void hd;
}

/** A wooden water tank on steel legs (the rooftop kind). */
export function waterTower(B, x, y, z, seed) {
  const st = B.acc(M.steel(B));
  st.col = rgb('#3a3634');
  const lh = 5.2 + hh(seed, 1, 2) * 2;
  const s = 1.9;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) st.beam(x + a * s * 1.15, y, z + b * s * 1.15, x + a * s, y + lh, z + b * s, 0.22, 0.22);
  for (const [a, b, c, d] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
    st.beam(x + a * s * 1.1, y + 0.6, z + b * s * 1.1, x + c * s, y + lh * 0.8, z + d * s, 0.07, 0.07);
    st.beam(x + c * s * 1.1, y + 0.6, z + d * s * 1.1, x + a * s, y + lh * 0.8, z + b * s, 0.07, 0.07);
  }
  const wd = B.acc(M.wood(B));
  wd.col = shade(rgb('#a8865e'), 0.7 + hh(seed, 3) * 0.3);
  boxW(wd, x, y + lh, z, 5, 0.25, 5, 0.3);
  cylinder(wd, x, y + lh + 0.25, z, 2.4, 4.4, 12, { u: 2, v: 4.4 });
  st.col = rgb('#222');
  for (const hy of [0.8, 2.2, 3.6]) cylinder(st, x, y + lh + 0.25 + hy, z, 2.46, 0.12, 12);
  const rf = B.acc(WM.roof(B));
  rf.col = rgb('#4a4440');
  cone(rf, x, y + lh + 4.6, z, 2.7, 1.8, 12);
}

/** A painted ghost sign on one of the walls. */
function ghostSign(B, F, it, top) {
  const side = it.ghostSide || 'l';
  const hw = it.w / 2, hd = it.d / 2;
  const [, , rw, rh] = WSIGN[it.ghost];
  const aspect = rw / rh;
  const len = side === 'f' || side === 'b' ? it.w : it.d;
  const y0 = it.yb + it.gh + 0.6, avail = top - y0 - 0.4;
  if (avail < 2) return;
  let W = Math.min(len * 0.82, avail * aspect * 0.92), H = W / aspect;
  if (H > avail) { H = avail; W = H * aspect; }
  const ym = y0 + avail * 0.55;
  const g = B.acc(WM.sign(B));
  const e = 0.04;
  const uv = rectUV(WSIGN, it.ghost);
  if (side === 'l') wallQ(g, F, -hw - e, -W / 2, -hw - e, W / 2, ym - H / 2, ym + H / 2, uv);
  else if (side === 'r') wallQ(g, F, hw + e, W / 2, hw + e, -W / 2, ym - H / 2, ym + H / 2, uv);
  else if (side === 'b') wallQ(g, F, W / 2, -hd - e, -W / 2, -hd - e, ym - H / 2, ym + H / 2, uv);
  else wallQ(g, F, -W / 2, hd + e, W / 2, hd + e, ym - H / 2, ym + H / 2, uv);
}

/** A fire escape down the front: a landing and a flight of steps a floor. */
function fireEscape(B, F, it) {
  const st = B.near(M.steel(B));
  st.col = rgb('#2c2e30');
  const hd = it.d / 2, x0 = it.fire[0], w = 6;
  for (let f = 1; f < it.floors; f++) {
    const y = it.yb + it.gh + (f - 1) * it.fh + 0.1;
    boxL(st, F, x0, y, hd + 0.7, w, 0.08, 1.3);
    boxL(st, F, x0, y + 1.0, hd + 1.33, w, 0.06, 0.06);
    for (const px of [-w / 2, 0, w / 2]) boxL(st, F, x0 + px, y, hd + 1.33, 0.05, 1.0, 0.05);
    // the flight down to the landing below (or a drop ladder off the lowest)
    const a = F.P(x0 - w / 2 + 0.6, y, hd + 0.75), b = F.P(x0 + w / 2 - 0.6, y - (f > 1 ? it.fh : 2.4), hd + 0.75);
    st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.9, 0.08);
  }
}

// ------------------------------------------------------------------ corrugated sheds

function shedTile(it, side, i, n) {
  const s = SC[side];
  const r = hh(it.n, i * 5 + 300, s);
  if (side === 'f') {
    if (it.docks && it.docks.includes(i)) return hh(it.n, i, 61) < (it.lit ?? 0.15) * 2.5 ? MT.dockOpen : MT.dock;
    if (it.doors && it.doors.includes(i)) return MT.door;
    if (it.office && it.office.includes(i)) return hh(it.n, i, 62) < 0.6 ? MT.office : MT.officeDark;
    return r < 0.3 ? MT.rollup : r < 0.36 ? (hh(it.n, i, 63) < (it.lit ?? 0.15) * 2 ? MT.rollupOpen : MT.rollupHalf) : r < 0.44 ? MT.number : r < 0.52 ? MT.hazard : MT.plinth;
  }
  if (side === 'b') return r < 0.25 ? MT.rollup : r < 0.4 ? MT.rusty : r < 0.5 ? MT.patched : MT.plain;
  if (it.h > 7.8 && r < 0.2) return MT.clerestory;
  return r < 0.12 ? MT.louvre : r < 0.24 ? MT.rusty : r < 0.3 ? MT.patched : r < 0.38 ? MT.door : r < 0.45 ? MT.hazard : MT.plinth;
}

/**
 * A corrugated shed: { x, z, w, d, ry, y0, yb, h, roof: gable|low|barrel|mono,
 * tint, roofTint, docks, doors, office, lit, canopy, n }.
 */
export function shed(B, it) {
  const acc = B.acc(WM.metal(B));
  const tint = rgb(it.tint);
  acc.col = tint;
  const F = new Frame(it.x, it.z, it.ry, 0);
  const hw = it.w / 2, hd = it.d / 2;
  for (const [side, ax, az, bx, bz] of SIDES(hw, hd)) {
    facade(acc, F, METAL, ax, az, bx, bz, it.yb, [{ h: it.h, v: [0, Math.min(1, it.h / 10)], tile: (i, n) => shedTile(it, side, i, n) }], { bay: 5 });
  }
  // the slab and footing under it
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#a09c92');
  boxL(cm, F, 0, it.y0, 0, it.w + 0.2, it.yb - it.y0, it.d + 0.2, 0, { u: 4, top: false });
  const top = it.yb + it.h;
  const rt = rgb(it.roofTint || '#8a8a88');
  const along = it.w >= it.d;
  const L = along ? it.w : it.d, S = along ? it.d : it.w;
  const Fr = along ? F : new Frame(it.x, it.z, it.ry + Math.PI / 2, 0);
  const roofAcc = B.acc(WM.metal(B));
  if (it.roof === 'barrel') {
    barrel(roofAcc, Fr, L, S, top, S * 0.18, rt, acc, tint);
  } else {
    const rise = it.roof === 'low' ? S * 0.08 : it.roof === 'mono' ? S * 0.1 : S * 0.2;
    metalRoof(roofAcc, Fr, L, S, top, rise, rt, it.roof === 'mono');
    // gable ends in the shed's cladding
    acc.col = tint;
    if (it.roof === 'mono') monoEnds(acc, Fr, L, S, top, rise);
    else gableEnds(acc, Fr, L, S, top, rise);
  }
  // a canopy over the docks, lit underneath
  if (it.canopy) {
    const n = Math.max(1, Math.round(it.w / 5)), bw = it.w / n;
    const [i0, i1] = it.canopy;
    const x0 = -hw + i0 * bw, x1 = -hw + (i1 + 1) * bw;
    const st = B.acc(M.steel(B));
    st.col = rgb('#4a4c50');
    boxL(st, F, (x0 + x1) / 2, it.yb + 5.6, hd + 1.6, x1 - x0, 0.35, 3.2);
    for (let x = x0 + 2; x < x1; x += 6) {
      glowBox(B, F.X(x, hd + 2.2), it.yb + 5.52, F.Z(x, hd + 2.2), 1.2, 0.08, 0.3, it.ry, '#ffb070');
      const a = F.P(x, it.yb + 5.9, hd + 3.1), b = F.P(x, it.yb + 8.5, hd + 0.05);
      st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.06, 0.06);
    }
  }
  if (it.doors) {
    const n = Math.max(1, Math.round(it.w / 5)), bw = it.w / n;
    for (const i of it.doors) wallPack(B, F, -hw + (i + 0.5) * bw, it.yb + 2.75, hd);
  }
}

/** Corrugated roof planes: tiles of 5 m along the ridge and 10 m down the slope. */
function metalRoof(acc, F, L, S, top, rise, col, mono) {
  acc.col = col;
  const ov = 0.4, hl = L / 2 + ov, hs = S / 2 + ov;
  const nl = Math.max(1, Math.round((2 * hl) / 5));
  const uv = (fx0, fx1, len) => tileUV(METAL, MT.plain, 0, 0, 1, Math.min(1, len / 10));
  const plane = (y0, yr, zs, ze) => {
    // from the eave (zs, y0) up to the ridge (ze, yr)
    const len = Math.hypot(ze - zs, yr - y0);
    const nv = Math.max(1, Math.ceil(len / 10));
    for (let a = 0; a < nl; a++) {
      const xa = -hl + (a / nl) * 2 * hl, xb = -hl + ((a + 1) / nl) * 2 * hl;
      for (let b = 0; b < nv; b++) {
        const t0 = b / nv, t1 = (b + 1) / nv;
        const za = zs + (ze - zs) * t0, zb = zs + (ze - zs) * t1, ya = y0 + (yr - y0) * t0, yb = y0 + (yr - y0) * t1;
        const u = uv(0, 1, len / nv);
        if (zs > ze) slope(acc, F, [xa, ya, za], [xb, ya, za], [xb, yb, zb], [xa, yb, zb], u);
        else slope(acc, F, [xb, ya, za], [xa, ya, za], [xa, yb, zb], [xb, yb, zb], u);
      }
    }
  };
  if (mono) { plane(top - 0.1, top + rise, hs, -hs); return; }
  plane(top - 0.1, top + rise, hs, 0);
  plane(top - 0.1, top + rise, -hs, 0);
}

/** Gable ends in cladding, in 5 m strips (so the ribs stay upright). */
function gableEnds(acc, F, L, S, top, rise) {
  const n = Math.max(1, Math.round(S / 5));
  for (const sd of [1, -1]) {
    const x = sd * L / 2;
    for (let k = 0; k < n; k++) {
      const za = -S / 2 + (k / n) * S, zb = -S / 2 + ((k + 1) / n) * S;
      const ha = rise * (1 - Math.abs(za) / (S / 2)), hb = rise * (1 - Math.abs(zb) / (S / 2));
      // a quad strip with a sloped top (and the ridge point when it straddles 0)
      const pts = za < 0 && zb > 0 ? [[za, ha], [0, rise], [zb, hb]] : [[za, ha], [zb, hb]];
      for (let p = 0; p < pts.length - 1; p++) {
        const [z0, h0] = pts[p], [z1, h1] = pts[p + 1];
        const u0 = (z0 - za) / (zb - za), u1 = (z1 - za) / (zb - za);
        const t0 = tileUV(METAL, MT.plain, u0, 0.35, u1, 0.35 + h0 / 10), t1 = tileUV(METAL, MT.plain, u0, 0.35, u1, 0.35 + h1 / 10);
        const A = F.P(x, top, sd > 0 ? z1 : z0), Bq = F.P(x, top, sd > 0 ? z0 : z1);
        const C = F.P(x, top + (sd > 0 ? h0 : h1), sd > 0 ? z0 : z1), D = F.P(x, top + (sd > 0 ? h1 : h0), sd > 0 ? z1 : z0);
        const ia = acc.v(A[0], A[1], A[2], sd > 0 ? t0[2] : t0[0], t0[1]);
        const ib = acc.v(Bq[0], Bq[1], Bq[2], sd > 0 ? t0[0] : t0[2], t0[1]);
        const ic = acc.v(C[0], C[1], C[2], sd > 0 ? t0[0] : t0[2], sd > 0 ? t0[3] : t1[3]);
        const id = acc.v(D[0], D[1], D[2], sd > 0 ? t0[2] : t0[0], sd > 0 ? t1[3] : t0[3]);
        acc.quad(ia, ib, ic, id);
      }
    }
  }
}

function monoEnds(acc, F, L, S, top, rise) {
  for (const sd of [1, -1]) {
    const x = sd * L / 2;
    const A = F.P(x, top, sd > 0 ? S / 2 : -S / 2), Bq = F.P(x, top, sd > 0 ? -S / 2 : S / 2), C = F.P(x, top + rise, -S / 2);
    const t = tileUV(METAL, MT.plain, 0, 0.3, 1, 0.3 + rise / 10);
    const ia = acc.v(...A, t[0], t[1]), ib = acc.v(...Bq, t[2], t[1]), ic = acc.v(...C, sd > 0 ? t[2] : t[0], t[3]);
    acc.tri(ia, ib, ic);
  }
}

/** A barrel (curved) roof over L × S, rising `rise`; its ends in cladding. */
function barrel(acc, F, L, S, top, rise, col, wallAcc, wallCol) {
  acc.col = col;
  const seg = 8, ov = 0.3, hl = L / 2 + ov;
  const R = (S * S / 4 + rise * rise) / (2 * rise), a0 = Math.asin(Math.min(1, S / 2 / R));
  const pt = (k) => { const a = -a0 + (k / seg) * 2 * a0; return [Math.sin(a) * R, top + Math.cos(a) * R - (R - rise)]; };
  const nl = Math.max(1, Math.round(2 * hl / 5));
  for (let k = 0; k < seg; k++) {
    const [z0, y0] = pt(k), [z1, y1] = pt(k + 1);
    const len = Math.hypot(z1 - z0, y1 - y0);
    for (let a = 0; a < nl; a++) {
      const xa = -hl + (a / nl) * 2 * hl, xb = -hl + ((a + 1) / nl) * 2 * hl;
      slope(acc, F, [xb, y0, z0], [xa, y0, z0], [xa, y1, z1], [xb, y1, z1], tileUV(METAL, MT.plain, 0, 0, 1, len / 10));
    }
  }
  // the ends: a fan from the middle of the eave line
  wallAcc.col = wallCol;
  for (const sd of [1, -1]) {
    const x = sd * L / 2;
    const c = wallAcc.v(...F.P(x, top, 0), 0.5 / 8, 0.9);
    for (let k = 0; k < seg; k++) {
      const [z0, y0] = pt(k), [z1, y1] = pt(k + 1);
      const za = Math.max(-S / 2, Math.min(S / 2, z0)), zb = Math.max(-S / 2, Math.min(S / 2, z1));
      const t = tileUV(METAL, MT.plain, 0, 0.3, 1, 0.3 + rise / 10);
      const ia = wallAcc.v(...F.P(x, y0, za), t[0], t[3]), ib = wallAcc.v(...F.P(x, y1, zb), t[2], t[3]);
      if (sd > 0) wallAcc.tri(c, ia, ib); else wallAcc.tri(c, ib, ia);
    }
  }
}

/** A Quonset hut: a half-round corrugated shell w long (local x), d across. */
export function quonset(B, it) {
  const acc = B.acc(WM.metal(B));
  const tint = rgb(it.tint);
  acc.col = tint;
  const F = new Frame(it.x, it.z, it.ry, 0);
  const R = it.d / 2, hl = it.w / 2, seg = 9;
  const y = it.yb;
  const nl = Math.max(1, Math.round(it.w / 5));
  for (let k = 0; k < seg; k++) {
    const a0 = Math.PI - (k / seg) * Math.PI, a1 = Math.PI - ((k + 1) / seg) * Math.PI;
    const z0 = Math.cos(a0) * R, y0 = Math.sin(a0) * R, z1 = Math.cos(a1) * R, y1 = Math.sin(a1) * R;
    const len = Math.hypot(z1 - z0, y1 - y0);
    for (let a = 0; a < nl; a++) {
      const xa = -hl + (a / nl) * it.w, xb = -hl + ((a + 1) / nl) * it.w;
      const t = tileUV(METAL, MT.plain, 0, 0, 1, len / 10);
      slope(acc, F, [xb, y + y0, z0], [xa, y + y0, z0], [xa, y + y1, z1], [xb, y + y1, z1], t);
    }
  }
  // the ends: a door in a fan of cladding
  for (const sd of [1, -1]) {
    const x = sd * hl;
    const c = acc.v(...F.P(x, y, 0), 0.06, 0.5);
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI, a1 = ((k + 1) / seg) * Math.PI;
      const t = tileUV(METAL, MT.plain, 0, 0.3, 1, 0.3 + R / 10);
      const ia = acc.v(...F.P(x, y + Math.sin(a0) * R, Math.cos(a0) * R), t[0], t[3]), ib = acc.v(...F.P(x, y + Math.sin(a1) * R, Math.cos(a1) * R), t[2], t[3]);
      if (sd > 0) acc.tri(c, ib, ia); else acc.tri(c, ia, ib);
    }
    const dw = Math.min(4.2, R * 0.9), dh = Math.min(4, R * 0.75);
    const id = sd > 0 ? (hh(it.n, 1) < 0.3 ? MT.rollupOpen : MT.rollup) : MT.door;
    const u = tileUV(METAL, id, 0.06, 0, 0.94, 0.53);
    if (sd > 0) wallQ(acc, F, x + 0.03, dw / 2, x + 0.03, -dw / 2, y, y + dh, u);
    else wallQ(acc, F, x - 0.03, -dw / 2, x - 0.03, dw / 2, y, y + dh, u);
  }
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#a09c92');
  boxL(cm, F, 0, it.y0, 0, it.w + 0.2, it.yb - it.y0 + 0.05, it.d + 0.2, 0, { u: 4, top: false });
}

// ------------------------------------------------------------------ the Foundry stack

/** A tall brick chimney: a square plinth, a tapering shaft, a corbelled cap, lettering, red lights. */
export function stack(B, it) {
  const pl = B.acc(WM.bplain(B));
  pl.col = rgb(it.tint || '#c07a62');
  const { x, z } = it;
  const y = it.y0;
  boxW(pl, x, y, z, it.r0 * 2 + 3, it.base + 1, it.r0 * 2 + 3, 0, null, { u: 4 });
  const cp = B.acc(M.concrete(B));
  cp.col = rgb('#b0aaa0');
  boxW(cp, x, y + it.base + 1, z, it.r0 * 2 + 3.4, 0.6, it.r0 * 2 + 3.4, 0, null, { u: 2 });
  const y1 = y + it.base + 1.6, h = it.h - it.base - 1.6;
  cylinder(pl, x, y1, z, it.r0, h, 16, { r2: it.r1, u: 4, v: 4 });
  // the corbelled cap: two rings stepping out, a dark lip
  cylinder(pl, x, y1 + h - 2.6, z, it.r1 + 0.35, 1.2, 16, { u: 4, v: 4 });
  cylinder(pl, x, y1 + h - 1.4, z, it.r1 + 0.6, 1.4, 16, { u: 4, v: 4, top: false });
  const dk = B.acc(M.dark(B));
  cylinder(dk, x, y1 + h - 0.05, z, it.r1 + 0.1, 0.06, 16, { top: true });
  // iron bands up the shaft
  const st = B.acc(M.steel(B));
  st.col = rgb('#2a2624');
  for (let k = 1; k < 9; k++) {
    const t = k / 9, r = it.r0 + (it.r1 - it.r0) * t + 0.06;
    cylinder(st, x, y1 + h * t, z, r, 0.25, 16);
  }
  // FOUNDRY down the face (toward `face`)
  if (it.letters) {
    const g = B.acc(WM.sign(B));
    const a = it.face, ca = Math.cos(a), sa = Math.sin(a);
    const lh = h * 0.42, lw = 2.6, ym = y1 + h * 0.52;
    const tR = (yy) => it.r0 + (it.r1 - it.r0) * ((yy - y1) / h) + 0.08;
    const uv = rectUV(WSIGN, 'stack');
    const yb = ym - lh / 2, yt = ym + lh / 2;
    const rb = tR(yb), rtp = tR(yt);
    // a gently curved strip of 3 facets around the face (seen from outside,
    // a larger angle f is further left: the texture's left edge at +span/2)
    const facets = 3, span = lw / rb;
    const uf = (f) => uv[0] + (uv[2] - uv[0]) * (span / 2 - f) / span;
    const P0 = (r, f, yy) => [x + (ca * Math.cos(f) - sa * Math.sin(f)) * r, yy, z + (sa * Math.cos(f) + ca * Math.sin(f)) * r];
    for (let k = 0; k < facets; k++) {
      const f0 = -span / 2 + (k / facets) * span, f1 = -span / 2 + ((k + 1) / facets) * span;
      g.quadP(P0(rb, f1, yb), P0(rb, f0, yb), P0(rtp, f0, yt), P0(rtp, f1, yt), [uf(f1), uv[1], uf(f0), uv[3]]);
    }
  }
  // aircraft warning lights: at the top and halfway (blinking)
  const bl = B.acc(WM.blink(B));
  for (const t of it.lights || [1]) {
    const yy = y1 + h * t - (t === 1 ? 0.4 : 0), r = it.r0 + (it.r1 - it.r0) * t + (t === 1 ? 0.7 : 0.15);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4;
      bl.box(x + Math.cos(a) * r, yy, z + Math.sin(a) * r, 0.5, 0.5, 0.5);
    }
  }
}

// ------------------------------------------------------------------ the Low Line

/**
 * One cell's run of the Low Line: { x0, x1, z, yd (deck top), cols: [[x,
 * yGround]], abut: 'w'|'e'|null, lamps: [x], plates: [x], weeds: seed }.
 */
export function* el(B, it) {
  const { x0, x1, z, yd } = it;
  const len = x1 - x0, cx = (x0 + x1) / 2;
  const st = B.acc(M.steel(B));
  const green = rgb('#3d4c45');
  st.col = green;
  // the plate girders along both edges, with stiffeners
  for (const sd of [1, -1]) {
    boxW(st, cx, yd - 2.1, z + sd * 4.85, len, 2.5, 0.3, 0, null, { u: 3 });
    // the bottom flange
    boxW(st, cx, yd - 2.15, z + sd * 4.85, len, 0.12, 0.8, 0, null, { u: 3 });
  }
  const nst = Math.floor(len / 2.4);
  for (let k = 0; k <= nst; k++) {
    const x = x0 + (k / Math.max(1, nst)) * len;
    for (const sd of [1, -1]) boxW(st, x, yd - 2.05, z + sd * 5.05, 0.12, 2.3, 0.14);
  }
  yield;
  // the deck slab (its underside too: you drive under it), ballast and two tracks
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#5a5852');
  boxW(cm, cx, yd - 0.55, z, len, 0.5, 9.4, 0, null, { u: 4 });
  cm.col = rgb('#3a3a38');
  cm.quadP([x0, yd - 0.55, z - 4.7], [x1, yd - 0.55, z - 4.7], [x1, yd - 0.55, z + 4.7], [x0, yd - 0.55, z + 4.7], [0, 0, len / 4, 2.35]);
  // the girders' undersides, and stringers under the deck between the bents
  st.col = shade(green, 0.7);
  for (const sd of [1, -1]) st.quadP([x0, yd - 2.15, z + sd * 4.85 - 0.4], [x1, yd - 2.15, z + sd * 4.85 - 0.4], [x1, yd - 2.15, z + sd * 4.85 + 0.4], [x0, yd - 2.15, z + sd * 4.85 + 0.4]);
  for (const sz of [-1.9, 1.9]) boxW(st, cx, yd - 1.35, z + sz, len, 0.8, 0.35, 0, null, { u: 3 });
  st.col = green;
  const rb = B.acc(WM.rail(B));
  for (const tz of [z - 1.9, z + 1.9]) {
    rb.quadP([x0, yd + 0.03, tz - 1.6], [x0, yd + 0.03, tz + 1.6], [x1, yd + 0.03, tz + 1.6], [x1, yd + 0.03, tz - 1.6], [0, x0 / 4.8, 1, x1 / 4.8]);
    st.col = rgb('#5a4a40');
    for (const ro of [-0.72, 0.72]) boxW(st, cx, yd + 0.03, tz + ro, len, 0.16, 0.08);
    st.col = green;
  }
  // walkway railings
  for (const sd of [1, -1]) {
    boxW(st, cx, yd + 1.05, z + sd * 4.95, len, 0.07, 0.07);
    boxW(st, cx, yd + 0.55, z + sd * 4.95, len, 0.05, 0.05);
    for (let x = x0 + 1; x < x1; x += 2.4) boxW(st, x, yd, z + sd * 4.95, 0.06, 1.1, 0.06);
  }
  yield;
  // the bents: two columns, a cross girder, knee braces
  for (const [x, yg] of it.cols) {
    boxW(st, x, yd - 3.6, z, 0.7, 1.5, 11.4);
    for (const sd of [1, -1]) {
      const cz = z + sd * 5.4;
      boxW(st, x, yg - 0.3, cz, 0.62, yd - 3.6 - yg + 0.35, 0.62);
      // a base plate on a concrete footing
      cm.col = rgb('#8a8880');
      boxW(cm, x, yg - 0.4, cz, 1.3, 0.75, 1.3);
      cm.col = rgb('#5a5852');
      // knee braces
      st.beam(x, yd - 6.4, cz - sd * 0.25, x, yd - 3.65, cz - sd * 2.6, 0.18, 0.18);
      st.beam(x - 0.3, yd - 6.2, cz, x - 2.5, yd - 3.65, cz, 0.16, 0.16);
      st.beam(x + 0.3, yd - 6.2, cz, x + 2.5, yd - 3.65, cz, 0.16, 0.16);
    }
  }
  yield;
  // ends: a brick abutment with a buffer stop on the deck
  if (it.abut) {
    const pl = B.acc(WM.bplain(B));
    pl.col = rgb('#a8705c');
    const ax = it.abut === 'w' ? x0 + 2 : x1 - 2;
    const yg = it.abutY;
    boxW(pl, ax, yg - 1, z, 4, yd - yg + 0.6, 11.6, 0, null, { u: 4 });
    const cp = B.acc(M.concrete(B));
    cp.col = rgb('#b0aaa0');
    boxW(cp, ax, yd - 0.4, z, 4.4, 0.5, 12, 0, null, { u: 2 });
    // buffer stops (red and white) on both tracks
    const pa = B.acc(M.paint(B));
    for (const tz of [z - 1.9, z + 1.9]) {
      pa.col = rgb('#b02018');
      boxW(pa, ax + (it.abut === 'w' ? 1.4 : -1.4), yd, tz, 0.8, 1.2, 2.6);
      pa.col = rgb('#e8e4d8');
      boxW(pa, ax + (it.abut === 'w' ? 1.9 : -1.9), yd + 0.6, tz, 0.15, 0.3, 2.7);
    }
  }
  // LOW LINE on the girders, lamps hung under the cross girders
  const g = B.acc(WM.sign(B));
  for (const px of it.plates || []) {
    const u = rectUV(WSIGN, px.k || 'lowline');
    for (const sd of [1, -1]) {
      const zz = z + sd * 5.02, w = px.w || 7, hgt = w * 0.25;
      if (sd > 0) g.quadP([px.x - w / 2, yd - 1.45, zz], [px.x + w / 2, yd - 1.45, zz], [px.x + w / 2, yd - 1.45 + hgt, zz], [px.x - w / 2, yd - 1.45 + hgt, zz], u);
      else g.quadP([px.x + w / 2, yd - 1.45, zz], [px.x - w / 2, yd - 1.45, zz], [px.x - w / 2, yd - 1.45 + hgt, zz], [px.x + w / 2, yd - 1.45 + hgt, zz], u);
    }
  }
  for (const lx of it.lamps || []) {
    st.col = rgb('#222');
    boxW(st, lx, yd - 4.4, z, 0.08, 0.8, 0.08);
    glowBox(B, lx, yd - 4.62, z, 0.9, 0.22, 0.45, 0, '#ffa040');
  }
  yield;
  // weeds on the disused line
  const lf = B.near(M.paint(B));
  for (let k = 0; k < len / 3; k++) {
    const r1 = hh(it.seed, k, 1), r2 = hh(it.seed, k, 2), r3 = hh(it.seed, k, 3);
    const wx = x0 + r1 * len, wz = z + (r2 - 0.5) * 8;
    lf.col = rgb(r3 < 0.5 ? '#4a5a2a' : '#6a6a34');
    cone(lf, wx, yd, wz, 0.4 + r3 * 0.5, 0.5 + r3 * 0.9, 5);
  }
}

// ------------------------------------------------------------------ rail: track, cars, gantry

/** Track on the ground: { pts: [[x, z]], cross: [[s0, s1]] (level crossings: rails only, on the road) }. */
export function* track(B, it) {
  const rb = B.acc(WM.rail(B));
  const st = B.acc(M.steel(B));
  st.col = rgb('#5a4c42');
  const pts = it.pts;
  let s = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(L / 6));
    const tx = (bx - ax) / L, tz = (bz - az) / L, lx = -tz, lz = tx;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const sm = s + L * (t0 + t1) / 2;
      const onRoad = it.cross && it.cross.some(([c0, c1]) => sm > c0 && sm < c1);
      const y0 = onRoad ? roadH(B, x0, z0) : B.groundY(x0, z0) + 0.06, y1 = onRoad ? roadH(B, x1, z1) : B.groundY(x1, z1) + 0.06;
      if (!onRoad) {
        rb.quadP([x0 - lx * 1.6, y0, z0 - lz * 1.6], [x0 + lx * 1.6, y0, z0 + lz * 1.6], [x1 + lx * 1.6, y1, z1 + lz * 1.6], [x1 - lx * 1.6, y1, z1 - lz * 1.6], [0, (s + L * t0) / 4.8, 1, (s + L * t1) / 4.8]);
      } else {
        const cm = B.acc(M.concrete(B));
        cm.col = rgb('#7c7a74');
        cm.quadP([x0 - lx * 1.4, y0 + 0.02, z0 - lz * 1.4], [x0 + lx * 1.4, y0 + 0.02, z0 + lz * 1.4], [x1 + lx * 1.4, y1 + 0.02, z1 + lz * 1.4], [x1 - lx * 1.4, y1 + 0.02, z1 - lz * 1.4], [0, 0, 1, 1]);
      }
      for (const ro of [-0.72, 0.72]) st.beam(x0 + lx * ro, y0 + 0.08, z0 + lz * ro, x1 + lx * ro, y1 + 0.08, z1 + lz * ro, 0.08, onRoad ? 0.06 : 0.16);
    }
    s += L;
    if (k % 10 === 9) yield;
  }
}

/** The road surface's height at (x, z) (the ground's, off the roads). */
export function roadH(B, x, z) {
  let h = -1e9;
  for (const q of B.net.surfaces(x, z, _surf)) if (q.zone === 'road' && q.h > h) h = q.h;
  return h > -1e8 ? h + 0.02 : B.groundY(x, z) + 0.06;
}
const _surf = [];

/** A small low-poly blob (weeds, bushes). */
export function blob(acc, x, y, z, r) { sphere(acc, x, y, z, r, 5, { sy: 0.7 }); }

/** A freight car on a track: { x, z, ry, y, kind: box|tank|hopper|flat|gondola, tint, n }. */
export function railcar(B, it) {
  const F = new Frame(it.x, it.z, it.ry, it.y);
  const L = it.len || 15, W = 3.0;
  const st = B.acc(M.steel(B));
  st.col = rgb('#1e1e1e');
  // trucks (bogies), frame, couplers
  for (const sz of [-L * 0.36, L * 0.36]) {
    boxL(st, F, 0, 0.35, sz, 2.4, 0.55, 2.4);
    for (const wx of [-0.72, 0.72]) for (const wz of [-0.7, 0.7]) boxL(st, F, wx, 0.12, sz + wz, 0.14, 0.7, 0.7);
  }
  boxL(st, F, 0, 0.9, 0, W - 0.2, 0.35, L);
  for (const sz of [-1, 1]) boxL(st, F, 0, 1.0, sz * (L / 2 + 0.3), 0.3, 0.25, 0.6);
  const tint = rgb(it.tint);
  const kind = it.kind;
  if (kind === 'box') {
    const acc = B.acc(WM.metal(B));
    acc.col = tint;
    const y0 = 1.25, h = 3.4;
    const hw = W / 2, hd = L / 2;
    for (const [side, ax, az, bx, bz] of SIDES(hw, hd)) {
      const long = side === 'r' || side === 'l';
      const n = long ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const px0 = ax + (bx - ax) * t0, pz0 = az + (bz - az) * t0, px1 = ax + (bx - ax) * t1, pz1 = az + (bz - az) * t1;
        const id = long && k === 1 ? (hh(it.n, 3) < 0.25 ? MT.rollupHalf : MT.patched) : MT.plain;
        wallQ(acc, F, px0, pz0, px1, pz1, y0, y0 + h, tileUV(METAL, id, 0, 0.05, 1, 0.05 + h / 10));
      }
    }
    const rf = B.acc(WM.roof(B));
    rf.col = shade(tint, 0.7);
    slope(rf, F, [-hw - 0.05, y0 + h, hd], [hw + 0.05, y0 + h, hd], [hw + 0.05, y0 + h, -hd], [-hw - 0.05, y0 + h, -hd], [0, 0, 1, 3]);
    // a graffiti piece on some
    if (hh(it.n, 9) < 0.45) {
      const g = B.acc(WM.sign(B));
      const u = rectUV(WSIGN, 'graffiti', hh(it.n, 4) * 0.6, 0, hh(it.n, 4) * 0.6 + 0.35, 1);
      const sd = hh(it.n, 5) < 0.5 ? 1 : -1;
      if (sd > 0) wallQ(g, F, hw + 0.03, hd * 0.7, hw + 0.03, -hd * 0.7, y0 + 0.3, y0 + 2.9, u);
      else wallQ(g, F, -hw - 0.03, -hd * 0.7, -hw - 0.03, hd * 0.7, y0 + 0.3, y0 + 2.9, u);
    }
  } else if (kind === 'tank') {
    const p = B.acc(M.paint(B));
    p.col = tint;
    const c = F.P(0, 2.7, 0);
    const a = F.dir(0, 1);
    tube(p, [c[0] - a[0] * L * 0.46, c[1], c[2] - a[1] * L * 0.46], [c[0] + a[0] * L * 0.46, c[1], c[2] + a[1] * L * 0.46], 1.45, 10);
    for (const sd of [-1, 1]) {
      const e = [c[0] + a[0] * L * 0.46 * sd, c[1], c[2] + a[1] * L * 0.46 * sd];
      tube(p, e, [e[0] + a[0] * 0.5 * sd, e[1], e[2] + a[1] * 0.5 * sd], 1.45, 10, 0.9);
    }
    p.col = shade(tint, 0.6);
    cylinder(p, c[0], c[1] + 1.35, c[2], 0.5, 0.5, 8, { top: true });
  } else if (kind === 'hopper' || kind === 'gondola') {
    const p = B.acc(M.paint(B));
    p.col = tint;
    const h = kind === 'hopper' ? 3.4 : 1.9;
    boxL(p, F, 0, 1.25, 0, W, h, L - 0.6, 0, { top: false });
    p.col = shade(tint, 0.5);
    boxL(p, F, 0, 1.25 + h - 0.3, 0, W - 0.25, 0.08, L - 1);
    if (kind === 'hopper') for (const sz of [-L * 0.22, L * 0.22]) { p.col = shade(tint, 0.8); boxL(p, F, 0, 0.6, sz, 2.2, 0.7, 2.6); }
    for (let k = -2; k <= 2; k++) { p.col = shade(tint, 0.75); boxL(p, F, W / 2 + 0.04, 1.3, k * L / 6, 0.08, h - 0.1, 0.18); boxL(p, F, -W / 2 - 0.04, 1.3, k * L / 6, 0.08, h - 0.1, 0.18); }
  } else {
    // a flatcar with a container or two
    const n = it.boxes ?? 1;
    for (let k = 0; k < n; k++) {
      const cl = n === 1 ? 12 : 6;
      container(B, F, 0, 1.25, n === 1 ? 0 : (k - 0.5) * 6.4, cl, rgb(it.tints?.[k] || it.tint), it.n + k);
    }
  }
}

/** A shipping container in a frame (local centre-bottom), its doors at the −z end. */
export function container(B, F, lx, ly, lz, len, col, seed) {
  const acc = B.acc(WM.metal(B));
  acc.col = col;
  const w = 2.44, h = 2.6, hw = w / 2, hd = len / 2;
  const t = tileUV(METAL, hh(seed, 2) < 0.2 ? MT.rusty : MT.plain, 0, 0.1, Math.min(1, len / 10), 0.1 + h / 10);
  const tw = tileUV(METAL, MT.plain, 0, 0.1, 0.5, 0.1 + h / 10);
  const Fc = new Frame(F.X(lx, lz), F.Z(lx, lz), F.ry, F.y + ly);
  wallQ(acc, Fc, hw, hd, hw, -hd, 0, h, t);
  wallQ(acc, Fc, -hw, -hd, -hw, hd, 0, h, t);
  wallQ(acc, Fc, -hw, hd, hw, hd, 0, h, tw);
  wallQ(acc, Fc, hw, -hd, -hw, -hd, 0, h, tileUV(METAL, MT.rollup, 0.1, 0.1, 0.6, 0.1 + h / 10));
  flatQ(acc, Fc, -hw, -hd, hw, hd, h, true, tileUV(METAL, MT.plain, 0, 0.5, 0.5, 0.9));
}

/** A rail-mounted gantry crane straddling the tracks: { x, z, span (along z), h, len (along x) }. */
export function gantry(B, it) {
  const { x, z, span, h } = it;
  const y = B.groundY(x, z);
  const p = B.acc(M.paint(B));
  const yel = rgb('#d8a020');
  p.col = yel;
  const leg = 5.5;
  for (const sz of [-1, 1]) {
    const lz = z + sz * span / 2;
    for (const sx of [-1, 1]) p.beam(x + sx * leg, y + 0.6, lz, x + sx * 1.2, y + h - 1.2, lz, 0.9, 0.9);
    boxW(p, x, y, lz, leg * 2 + 3, 1.2, 1.6);
    // the wheels' trucks
    p.col = rgb('#222');
    for (const sx of [-1, 1]) boxW(p, x + sx * (leg + 0.8), y, lz, 2.2, 0.7, 1.2);
    p.col = yel;
  }
  // the bridge girders across, the trolley, the cab, the hoist
  for (const sx of [-1, 1]) boxW(p, x + sx * 1.1, y + h - 1.6, z, 1.0, 2.0, span + 9);
  for (let k = -3; k <= 3; k++) boxW(p, x, y + h - 0.6, z + k * span / 7, 3.2, 0.4, 0.4);
  p.col = rgb('#c8c4b8');
  boxW(p, x, y + h + 0.4, z - span * 0.12, 3.6, 1.8, 3.4);
  const st = B.acc(M.steel(B));
  st.col = rgb('#222');
  for (const o of [-0.5, 0.5]) st.beam(x + o, y + h - 1.4, z - span * 0.12, x + o, y + h - 9, z - span * 0.12, 0.05, 0.05);
  boxW(st, x, y + h - 9.6, z - span * 0.12, 2.4, 0.6, 6.1);
  p.col = rgb('#e8e2d0');
  boxW(p, x + 1.9, y + h - 4.2, z + span / 2 - 3, 2.2, 2.4, 2.4);
  const gl = B.acc(M.glow(B));
  gl.col = rgb('#ffe0a0');
  boxW(gl, x + 3.02, y + h - 3.4, z + span / 2 - 3, 0.04, 0.9, 1.8);
  // warning beacons
  const bl = B.acc(WM.blink2(B));
  for (const sz of [-1, 1]) bl.box(x, y + h + 0.1, z + sz * (span / 2 + 3.5), 0.4, 0.4, 0.4);
  // floods under the girder
  for (const sz of [-0.3, 0.3]) glowBox(B, x, y + h - 2.7, z + sz * span, 1.2, 0.18, 0.6, 0, '#ffd8a0');
}

/** A stack of containers: { x, z, ry, n (along), tiers, cols: [hex], seed }. */
export function boxes(B, it) {
  const F = new Frame(it.x, it.z, it.ry, B.groundY(it.x, it.z));
  const len = it.len || 12.2;
  for (let k = 0; k < it.cnt; k++) {
    const tiers = Math.max(1, Math.round(it.tiers - hh(it.seed, k, 5) * 1.6));
    for (let t = 0; t < tiers; t++) {
      const col = rgb(it.cols[Math.floor(hh(it.seed, k * 5 + t, 6) * it.cols.length)]);
      container(B, F, (k - (it.cnt - 1) / 2) * 2.6, t * 2.6, (hh(it.seed, k, t) - 0.5) * 0.4, len, col, it.seed + k * 7 + t);
    }
  }
}

// ------------------------------------------------------------------ tanks

/** An oil tank: { x, z, r, h, tint, y0, n } with a stair round it and a rail on top. */
export function tank(B, it) {
  const { x, z, r, h } = it;
  const y = it.y0;
  const p = B.acc(M.paint(B));
  const col = rgb(it.tint);
  p.col = col;
  cylinder(p, x, y, z, r, h, 20, { u: 4 });
  p.col = shade(col, 0.82);
  for (let k = 1; k < 5; k++) cylinder(p, x, y + (k / 5) * h, z, r + 0.05, 0.18, 20);
  // a shallow cone roof
  p.col = shade(col, 0.9);
  cone(p, x, y + h, z, r + 0.2, r * 0.12, 20);
  // rust staining down from the roof line
  const st = B.acc(M.steel(B));
  st.col = rgb('#2c2e30');
  // the stair: a band of steps spiralling a quarter turn up the side
  const a0 = hh(it.n, 1) * Math.PI * 2;
  const steps = 14;
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps, t1 = (k + 1) / steps;
    const a = a0 + t0 * Math.PI * 0.6, b = a0 + t1 * Math.PI * 0.6;
    st.beam(x + Math.cos(a) * (r + 0.6), y + h * t0, z + Math.sin(a) * (r + 0.6), x + Math.cos(b) * (r + 0.6), y + h * t1, z + Math.sin(b) * (r + 0.6), 0.9, 0.08);
    st.beam(x + Math.cos(a) * (r + 1.05), y + h * t0 + 1, z + Math.sin(a) * (r + 1.05), x + Math.cos(b) * (r + 1.05), y + h * t1 + 1, z + Math.sin(b) * (r + 1.05), 0.05, 0.05);
  }
  // the rail round the top
  const segs = 20;
  for (let k = 0; k < segs; k++) {
    const a = (k / segs) * Math.PI * 2, b = ((k + 1) / segs) * Math.PI * 2;
    st.beam(x + Math.cos(a) * (r - 0.3), y + h + 1.1, z + Math.sin(a) * (r - 0.3), x + Math.cos(b) * (r - 0.3), y + h + 1.1, z + Math.sin(b) * (r - 0.3), 0.05, 0.05);
  }
}

// ------------------------------------------------------------------ the power station

/** HALCYON POWER & LIGHT: { x, z, ry, y0, yb, ... } (front toward +z). */
export function* power(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const tint = rgb('#b0705c');
  const acc = B.acc(WM.brick(B));
  acc.col = tint;
  const pl = B.acc(WM.bplain(B));
  pl.col = tint;
  const rf = B.acc(WM.roof(B));
  rf.col = rgb('#6a6660');
  const yb = it.yb, y0 = it.y0;
  // the turbine hall (front): three tiers of tall arched bays
  const Fh = new Frame(F.X(0, it.D / 2 - it.hd / 2), F.Z(0, it.D / 2 - it.hd / 2), it.ry, 0);
  const hallH = 24;
  const tilesHall = (side) => (i, n) => {
    if (i === 0 || i === n - 1 || i % 5 === 0) return BK.hallPier;
    const r = hh(i, side.length, 17);
    if (side === 'f' && i === Math.floor(n / 2)) return BK.hallDoor;
    return r < 0.45 ? BK.hallBroken : r < 0.5 ? BK.hallCool : BK.hall;
  };
  const tilesUp = (side) => (i, n) => {
    if (i === 0 || i === n - 1 || i % 5 === 0) return BK.hallPier;
    const r = hh(i, side.length, 23);
    return r < 0.4 ? BK.hallBroken : r < 0.55 ? BK.hallBlind : BK.hall;
  };
  for (const [side, ax, az, bx, bz] of SIDES(it.hw / 2, it.hd / 2)) {
    facade(acc, Fh, BRICK, ax, az, bx, bz, y0, [
      { h: yb - y0, v: [0, 0.4], tile: () => BK.plinth },
      { h: 8, tall: true, tile: tilesHall(side) },
      { h: 8, tall: true, tile: tilesUp(side) },
      { h: 8, tall: true, tile: (i, n) => (i === 0 || i === n - 1 || i % 5 === 0 ? BK.hallPier : BK.hallBlind) },
      { h: 1.6, v: [0.6, 1], tile: () => BK.dentil },
    ]);
  }
  const ht = yb + hallH;
  flatQ(rf, Fh, -it.hw / 2, -it.hd / 2, it.hw / 2, it.hd / 2, ht + 0.2, true, [0, 0, it.hw / 8, it.hd / 8]);
  // HALCYON POWER & LIGHT across the top of the front
  const g = B.acc(WM.sign(B));
  const nw = Math.min(46, it.hw * 0.42), nh = nw * (96 / 512);
  wallQ(g, Fh, -nw / 2, it.hd / 2 + 0.06, nw / 2, it.hd / 2 + 0.06, ht - nh - 0.6, ht - 0.6, rectUV(WSIGN, 'power'));
  yield;
  // the boiler house behind: taller, plainer, the four chimneys at its corners
  const Fb = new Frame(F.X(0, -it.D / 2 + it.bd / 2), F.Z(0, -it.D / 2 + it.bd / 2), it.ry, 0);
  const bh = 38;
  for (const [side, ax, az, bx, bz] of SIDES(it.hw / 2 - 2, it.bd / 2)) {
    if (side === 'f') continue;
    facade(acc, Fb, BRICK, ax, az, bx, bz, y0, [
      { h: yb - y0, v: [0, 0.4], tile: () => BK.plinth },
      { h: 8, tall: true, tile: (i, n) => (i % 4 === 0 || i === n - 1 ? BK.hallPier : hh(i, 3, side.length) < 0.3 ? BK.hallBroken : BK.hallBlind) },
      { h: 8, tall: true, tile: (i, n) => (i % 4 === 0 || i === n - 1 ? BK.hallPier : BK.hallBlind) },
      { h: 8, tall: true, tile: (i, n) => (i % 4 === 0 || i === n - 1 ? BK.hallPier : hh(i, 5, side.length) < 0.5 ? BK.hallBroken : BK.hall) },
      { h: 8, tall: true, tile: (i, n) => (i % 4 === 0 || i === n - 1 ? BK.hallPier : BK.hallBlind) },
      { h: bh - 32, v: [0, 1], tile: () => BK.plain },
      { h: 1.6, v: [0.6, 1], tile: () => BK.dentil },
    ]);
  }
  // the part of the boiler house's front above the turbine hall's roof
  plainFront(pl, Fb, it.hw / 2 - 2, it.bd / 2, ht, yb + bh + 1.6);
  flatQ(rf, Fb, -it.hw / 2 + 2, -it.bd / 2, it.hw / 2 - 2, it.bd / 2, yb + bh + 0.3, true, [0, 0, it.hw / 8, it.bd / 8]);
  yield;
  // the chimneys: white fluted concrete on brick plinths
  const pa = B.acc(M.paint(B));
  const bl = B.acc(WM.blink(B));
  for (const [cx, cz] of it.chimneys) {
    const x = Fb.X(cx, cz), z = Fb.Z(cx, cz);
    const yr = yb + bh;
    pl.col = tint;
    boxW(pl, x, yr - 1, z, 10, 6, 10, it.ry, null, { u: 4 });
    pa.col = rgb('#e4e0d4');
    cylinder(pa, x, yr + 5, z, 4.2, it.ch, 16, { r2: 3.3 });
    pa.col = rgb('#b8b2a4');
    cylinder(pa, x, yr + 5, z, 4.5, 2.2, 16, { r2: 4.25 });
    for (const t of [0.35, 0.7]) cylinder(pa, x, yr + 5 + it.ch * t, z, 4.2 - 0.9 * t + 0.08, 0.6, 16);
    pa.col = rgb('#3a3634');
    cylinder(pa, x, yr + 5 + it.ch - 1.4, z, 3.42, 1.4, 16, { top: false });
    const dk = B.acc(M.dark(B));
    cylinder(dk, x, yr + 5 + it.ch - 0.06, z, 3.2, 0.06, 14, { top: true });
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.78;
      bl.box(x + Math.cos(a) * 3.6, yr + 5 + it.ch - 0.6, z + Math.sin(a) * 3.6, 0.55, 0.55, 0.55);
      bl.box(x + Math.cos(a) * 4.0, yr + 5 + it.ch * 0.5, z + Math.sin(a) * 4.0, 0.45, 0.45, 0.45);
    }
  }
  yield;
  // corner towers at the turbine hall's front corners (art deco fluting)
  for (const sx of [-1, 1]) {
    const lx = sx * (it.hw / 2 - 3), lz = it.D / 2 - 3;
    const x = F.X(lx, lz), z = F.Z(lx, lz);
    pl.col = tint;
    boxW(pl, x, y0, z, 6.4, ht + 6 - y0, 6.4, it.ry, null, { u: 4 });
    for (let k = 0; k < 3; k++) boxW(pl, x, ht + 6 + k * 1.2, z, 6.0 - k * 1.2, 1.2, 6.0 - k * 1.2, it.ry, null, { u: 4 });
  }
  yield;
  // a coal conveyor gallery up to the boiler house's side
  const st = B.acc(M.steel(B));
  st.col = rgb('#4a4438');
  const ga = F.P(it.hw / 2 + 26, yb + 2, -it.D / 2 + 10), gb = F.P(it.hw / 2 - 4, yb + 30, -it.D / 2 + 22);
  lattice(st, ga, gb, 3.2, { bay: 4 });
  const mc = B.acc(WM.metal(B));
  mc.col = rgb('#8a8070');
  const pz = F.P(it.hw / 2 + 26, 0, -it.D / 2 + 10);
  for (let k = 0; k < 3; k++) {
    const t = (k + 1) / 4;
    const px = ga[0] + (gb[0] - ga[0]) * t, py = ga[1] + (gb[1] - ga[1]) * t, pz2 = ga[2] + (gb[2] - ga[2]) * t;
    st.beam(px, B.groundY(px, pz2) - 0.4, pz2, px, py - 1.6, pz2, 0.5, 0.5);
  }
  boxW(mc, pz[0], B.groundY(pz[0], pz[2]) - 0.5, pz[2], 8, 9, 8, it.ry, null, { u: 5 });
}

function plainFront(pl, F, hw, hd, y0, y1) {
  wallQ(pl, F, -hw, hd, hw, hd, y0, y1, [0, y0 / 4, 2 * hw / 4, y1 / 4]);
}

// ------------------------------------------------------------------ the salvage yard

/** A pile of flattened cars: { x, z, ry, n, tiers, seed }. */
export function carpile(B, it) {
  const F = new Frame(it.x, it.z, it.ry, B.groundY(it.x, it.z));
  const p = B.acc(M.paint(B));
  const cols = ['#8a2a22', '#2a4a7a', '#c8c4b8', '#3a5a3a', '#5a5a5e', '#a8782a', '#2a2a2c', '#7a6a5a', '#9a4a2a'];
  for (let k = 0; k < it.cnt; k++) {
    const tiers = Math.max(1, Math.round(it.tiers * (0.6 + 0.4 * hh(it.seed, k, 1))));
    for (let t = 0; t < tiers; t++) {
      const r = hh(it.seed, k * 9 + t, 2);
      p.col = shade(rgb(cols[Math.floor(r * cols.length)]), 0.55 + 0.35 * hh(it.seed, k, t + 4));
      boxL(p, F, (k - (it.cnt - 1) / 2) * 1.95 + (r - 0.5) * 0.4, t * 0.62, (hh(it.seed, t, k) - 0.5) * 0.8, 1.8, 0.58, 4.3, (r - 0.5) * 0.18);
    }
  }
}

/** A crawler crane with a magnet: { x, z, ry, boom, seed }. */
export function crane(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const p = B.acc(M.paint(B));
  p.col = rgb('#1e1e1e');
  for (const sx of [-1.6, 1.6]) boxL(p, F, sx, 0, 0, 1.0, 1.1, 6);
  p.col = rgb('#d8a020');
  boxL(p, F, 0, 1.1, -0.6, 3.6, 2.2, 5);
  p.col = rgb('#c89018');
  boxL(p, F, 1.2, 3.3, 1.2, 1.4, 1.8, 1.6);
  const gl = B.acc(M.glass(B));
  boxL(gl, F, 1.2, 3.7, 2.02, 1.2, 1.0, 0.04);
  const st = B.acc(M.steel(B));
  st.col = rgb('#d8a020');
  const a = F.P(0, 2.4, 1.8), b = F.P(0, 2.4 + it.boom * 0.78, 1.8 + it.boom * 0.62);
  lattice(st, a, b, 1.1, { bay: 1.6 });
  st.col = rgb('#222');
  st.beam(b[0], b[1], b[2], b[0], b[1] - it.boom * 0.55, b[2], 0.04, 0.04);
  const m = [b[0], b[1] - it.boom * 0.55, b[2]];
  cylinder(st, m[0], m[1] - 0.5, m[2], 0.9, 0.5, 10, { top: true, bottom: true });
}

// ------------------------------------------------------------------ the boneyard

/**
 * The abandoned warehouse you can drive into: steel portal frames, some
 * cladding left, the roof half fallen in. { x, z, w, d, ry, yb, h, n }.
 */
export function* bone(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const st = B.acc(M.steel(B));
  st.col = rgb('#5a3a2a');
  const hw = it.w / 2, hd = it.d / 2, y = it.yb, h = it.h, rise = it.w * 0.12;
  const n = Math.round(it.d / 8);
  for (let k = 0; k <= n; k++) {
    const lz = -hd + (k / n) * it.d;
    const fallen = it.fallen.includes(k);
    for (const sx of [-1, 1]) boxL(st, F, sx * hw, y - 0.3, lz, 0.5, h + 0.3, 0.5);
    if (fallen) {
      // a rafter hanging down into the hall
      const a = F.P(-hw, y + h, lz), b = F.P(0, y + h * 0.35, lz + 1.5);
      st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.35, 0.5);
      continue;
    }
    const a = F.P(-hw, y + h, lz), m = F.P(0, y + h + rise, lz), b = F.P(hw, y + h, lz);
    st.beam(a[0], a[1], a[2], m[0], m[1], m[2], 0.32, 0.55);
    st.beam(m[0], m[1], m[2], b[0], b[1], b[2], 0.32, 0.55);
  }
  // purlins along the bays still standing
  for (let k = 0; k < n; k++) {
    if (it.fallen.includes(k) || it.fallen.includes(k + 1)) continue;
    const z0 = -hd + (k / n) * it.d, z1 = -hd + ((k + 1) / n) * it.d;
    for (const t of [0.25, 0.6, 0.95]) for (const sx of [-1, 1]) {
      const a = F.P(sx * hw * t, y + h + rise * (1 - t), z0), b = F.P(sx * hw * t, y + h + rise * (1 - t), z1);
      st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.14, 0.2);
    }
  }
  yield;
  // cladding: what's left of it
  const acc = B.acc(WM.metal(B));
  acc.col = rgb('#a89078');
  for (const [k, sd, hgt] of it.walls) {
    const z0 = -hd + (k / n) * it.d, z1 = -hd + ((k + 1) / n) * it.d;
    const t = tileUV(METAL, hh(it.n, k, sd + 3) < 0.5 ? MT.rusty : MT.patched, 0, 0, 1, Math.min(1, hgt / 10));
    if (sd > 0) wallQ(acc, F, hw, z1, hw, z0, y, y + hgt, t);
    else wallQ(acc, F, -hw, z0, -hw, z1, y, y + hgt, t);
    // and the inside face (it's open: you see it from in there)
    if (sd > 0) wallQ(acc, F, hw - 0.05, z0, hw - 0.05, z1, y, y + hgt, t);
    else wallQ(acc, F, -hw + 0.05, z1, -hw + 0.05, z0, y, y + hgt, t);
  }
  yield;
  // roof sheets on the bays still standing (both faces)
  const rf = B.acc(WM.metal(B));
  rf.col = rgb('#7a6a5a');
  for (let k = 0; k < n; k++) {
    if (it.fallen.includes(k) || it.fallen.includes(k + 1) || it.holes.includes(k)) continue;
    const z0 = -hd + (k / n) * it.d, z1 = -hd + ((k + 1) / n) * it.d;
    const t = tileUV(METAL, MT.rusty, 0, 0, 1, 0.6);
    for (const sx of [-1, 1]) {
      const e = [sx * (hw + 0.3), y + h + 0.3, 0], r = [0, y + h + rise + 0.3, 0];
      if (sx > 0) {
        slope(rf, F, [e[0], e[1], z1], [e[0], e[1], z0], [0, r[1], z0], [0, r[1], z1], t);
        slope(rf, F, [0, r[1] - 0.05, z1], [0, r[1] - 0.05, z0], [e[0], e[1] - 0.05, z0], [e[0], e[1] - 0.05, z1], t);
      } else {
        slope(rf, F, [e[0], e[1], z0], [e[0], e[1], z1], [0, r[1], z1], [0, r[1], z0], t);
        slope(rf, F, [0, r[1] - 0.05, z0], [0, r[1] - 0.05, z1], [e[0], e[1] - 0.05, z1], [e[0], e[1] - 0.05, z0], t);
      }
    }
  }
  // graffiti inside, on what's left of the walls
  const g = B.acc(WM.sign(B));
  for (const [k, sd] of it.walls.slice(0, 4)) {
    const z0 = -hd + (k / n) * it.d + 0.5, z1 = z0 + it.d / n - 1;
    const u = rectUV(WSIGN, 'graffiti', hh(it.n, k) * 0.7, 0, hh(it.n, k) * 0.7 + 0.28, 1);
    if (sd > 0) wallQ(g, F, hw - 0.1, z0, hw - 0.1, z1, y + 0.4, y + 3.6, u);
    else wallQ(g, F, -hw + 0.1, z1, -hw + 0.1, z0, y + 0.4, y + 3.6, u);
  }
  yield;
  // the floor: cracked concrete slab
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#7a7870');
  flatQ(cm, F, -hw, -hd, hw, hd, y + 0.02, true, [0, 0, it.w / 4, it.d / 4]);
}

// ------------------------------------------------------------------ small things

/** A burning oil drum (the fire flickers; its light is a lamp in the plan). */
export function fireBarrel(B, x, z) {
  const y = B.groundY(x, z);
  const p = B.near(M.paint(B));
  drum(p, x, y, z, rgb('#3a2a20'));
  const f = B.near(WM.flicker(B));
  f.box(x, y + 0.9, z, 0.45, 0.3, 0.45);
  f.box(x + 0.05, y + 1.15, z - 0.04, 0.28, 0.35, 0.26, 0.6);
}

/** A semi-trailer (box van) parked: { x, z, ry, tint, n }, tractor optional. */
export function trailer(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const L = 13.6, W = 2.5, H = 2.8;
  const acc = B.near(WM.metal(B));
  acc.col = rgb(it.tint);
  const hw = W / 2, hd = L / 2, y0 = 1.25;
  const t = tileUV(METAL, MT.plain, 0, 0.1, 1, 0.1 + H / 10);
  for (const [side, ax, az, bx, bz] of SIDES(hw, hd)) {
    const n = side === 'l' || side === 'r' ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      wallQ(acc, F, ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, y0, y0 + H, side === 'b' ? tileUV(METAL, MT.rollup, 0.08, 0.1, 0.92, 0.1 + H / 10) : t);
    }
  }
  flatQ(acc, F, -hw, -hd, hw, hd, y0 + H, true, t);
  const p = B.near(M.paint(B));
  p.col = rgb('#1a1a1a');
  boxL(p, F, 0, 0.5, -hd + 2.5, W - 0.3, 0.75, 3.2);
  for (const sz of [-hd + 1.7, -hd + 3.0]) for (const sx of [-1, 1]) boxL(p, F, sx * (hw - 0.3), 0, sz, 0.5, 1.0, 1.0);
  // landing legs at the front
  for (const sx of [-1, 1]) boxL(p, F, sx * 0.8, 0, hd - 3, 0.15, 1.25, 0.15);
  if (it.cab) {
    p.col = rgb(it.cab);
    boxL(p, F, 0, 0.9, hd + 2.6, W, 2.1, 2.6);
    boxL(p, F, 0, 0.9, hd + 4.4, W, 1.2, 1.4);
    const gl = B.near(M.glass(B));
    boxL(gl, F, 0, 2.05, hd + 3.92, W - 0.3, 0.8, 0.04);
    p.col = rgb('#1a1a1a');
    for (const sz of [hd + 1.2, hd + 4.4]) for (const sx of [-1, 1]) boxL(p, F, sx * (hw - 0.3), 0, sz, 0.5, 1.05, 1.05);
  }
}

/** A forklift (yellow, mast up front). */
export function forklift(B, x, z, ry) {
  const y = B.groundY(x, z);
  const F = new Frame(x, z, ry, y);
  const p = B.near(M.paint(B));
  p.col = rgb('#e0a818');
  boxL(p, F, 0, 0.3, 0, 1.1, 1.0, 2.2);
  p.col = rgb('#222');
  boxL(p, F, 0, 1.3, -0.2, 1.0, 0.08, 1.2);
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.6, 0.7]) boxL(p, F, sx, 0, sz, 0.25, 0.55, 0.55);
  for (const sx of [-0.45, 0.45]) { boxL(p, F, sx, 0.3, 0.45, 0.06, 1.0, 0.06); boxL(p, F, sx, 0.3, -0.75, 0.06, 1.0, 0.06); }
  for (const sx of [-0.35, 0.35]) { boxL(p, F, sx, 0, 1.25, 0.1, 2.6, 0.1); boxL(p, F, sx, 0.1, 1.7, 0.12, 0.05, 0.9); }
}

/** A tyre stack. */
export function tyres(B, x, z, n) {
  const y = B.groundY(x, z);
  const p = B.near(M.paint(B));
  p.col = rgb('#161616');
  for (let k = 0; k < n; k++) cylinder(p, x + (hh(x | 0, k) - 0.5) * 0.12, y + k * 0.24, z, 0.36, 0.23, 8, { top: k === n - 1 });
}

/** A graffiti wall (precast panels): { x, z, ry, w, h, u0 }. */
export function gwall(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const g = B.acc(WM.sign(B));
  const y = B.groundY(it.x, it.z) - 0.4;
  const n = Math.max(1, Math.round(it.w / 8));
  for (let k = 0; k < n; k++) {
    const a = -it.w / 2 + (k / n) * it.w, b = a + it.w / n;
    const u0 = ((it.u0 || 0) + k * 0.23) % 0.76;
    wallQ(g, F, a, 0.15, b, 0.15, y, y + it.h, rectUV(WSIGN, 'graffiti', u0, 0, u0 + 0.24, 1));
    // the back: plain tags strip
    wallQ(g, F, b, -0.15, a, -0.15, y, y + it.h, rectUV(WSIGN, 'graffiti2', (k * 0.31) % 0.7, 0, (k * 0.31) % 0.7 + 0.3, 1));
  }
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#8a8884');
  boxL(cm, F, 0, y + it.h, 0, it.w, 0.15, 0.36, 0, { u: 2 });
  wallQ(cm, F, -it.w / 2, -0.15, -it.w / 2, 0.15, y, y + it.h, [0, 0, 0.1, 1]);
  wallQ(cm, F, it.w / 2, 0.15, it.w / 2, -0.15, y, y + it.h, [0, 0, 0.1, 1]);
}

/** A sign on posts or on a wall: { x, z, ry, y (bottom), w, h, key, posts, lit }. */
export function sign(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const g = B.acc(WM.sign(B));
  const y = it.y ?? B.groundY(it.x, it.z) + (it.lift ?? 2.2);
  wallQ(g, F, -it.w / 2, 0.08, it.w / 2, 0.08, y, y + it.h, rectUV(WSIGN, it.key));
  const st = B.acc(M.steel(B));
  st.col = rgb('#2a2c2e');
  boxL(st, F, 0, y - 0.05, 0, it.w + 0.1, it.h + 0.1, 0.12, 0, { u: 2 });
  if (it.back) wallQ(g, F, it.w / 2, -0.08, -it.w / 2, -0.08, y, y + it.h, rectUV(WSIGN, it.back));
  if (it.posts) {
    const yg = B.groundY(it.x, it.z);
    for (const sx of it.posts === 1 ? [0] : [-it.w * 0.35, it.w * 0.35]) boxL(st, F, sx, yg - 0.3, -0.12, 0.16, y - yg + 0.3, 0.16);
  }
}

/** A railroad crossing: crossbuck, two red lights that alternate. */
export function xing(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const st = B.near(M.steel(B));
  st.col = rgb('#d8d8d0');
  boxL(st, F, 0, -0.2, 0, 0.14, 4.6, 0.14);
  const g = B.near(WM.sign(B));
  const u = rectUV(WSIGN, 'xing');
  wallQ(g, F, -0.9, 0.09, 0.9, 0.09, y + 3.0 - y, y + 4.8 - y, u);
  wallQ(g, F, 0.9, -0.09, -0.9, -0.09, 3.0, 4.8, u);
  st.col = rgb('#111');
  boxL(st, F, 0, 2.3, 0.06, 1.4, 0.12, 0.12);
  for (const [sx, m] of [[-0.55, WM.blink(B)], [0.55, WM.blink2(B)]]) {
    const b = B.near(m);
    boxL(st, F, sx, 2.05, 0.1, 0.42, 0.42, 0.2);
    boxL(b, F, sx, 2.12, 0.22, 0.28, 0.28, 0.04);
  }
}

export { drum, pallets, skip, car, chainFence, floodMast };
