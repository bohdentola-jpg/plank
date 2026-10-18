// PORT HALCYON — desert kit planning helpers (headless: plan() only): where a
// set piece fronting a road goes, which way a sign faces the traffic, the
// ground beside a road, set pieces with their colliders/far shapes/lamps in
// their own local frame, and lines of telephone poles wired pole to pole.
import { natural } from '../../terrain.js';
import { reachOf, hash1, sstep } from './kit.js';

/** A footprint fronting road r at arc length s on `side` (+1 its left), its front `setback` m past the road's edge; +z faces the road. */
export function site(r, s, side, w, d, setback) {
  const off = reachOf(r) + setback + d / 2;
  const p = r.posAt(s, side * off);
  const i = p.i;
  return { x: p.x, z: p.z, ry: Math.atan2(-side * r.LX[i], -side * r.LZ[i]), w, d };
}

/** The ground beside a road (the land graded toward the road, as the terrain grades it). */
export function besideY(r, i, lat) {
  const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
  const core = reachOf(r) + 0.2, bl = r.spec.blend ?? r.rt.blend;
  const k = sstep(0, bl, Math.abs(lat) - core);
  return r.Y[i] - 0.12 + (natural(x, z) - (r.Y[i] - 0.12)) * k;
}

/** The facing (ry) of something beside a road on `side`, turned to traffic moving `dir` along it, toed `toe` rad toward the road. */
export function facing(r, i, side, dir, toe) {
  const tx = r.TX[i] * dir, tz = r.TZ[i] * dir;
  const nx = -tx * Math.cos(toe) - side * r.LX[i] * Math.sin(toe), nz = -tz * Math.cos(toe) - side * r.LZ[i] * Math.sin(toe);
  return Math.atan2(nx, nz);
}

/** Local → world for a frame { x, z, ry }. */
export function local(st, lx, lz) {
  const c = Math.cos(st.ry), s = Math.sin(st.ry);
  return [st.x + lx * c + lz * s, st.z - lx * s + lz * c];
}

/** Claim and add a set piece; its collider boxes ({ x, z, w, d, h, ry }) and far shapes are in its local frame. */
export function setPiece(P, it, boxes = [], farList = []) {
  P.claim(it.x, it.z, it.w, it.d, it.ry);
  P.add(it);
  const y = P.groundY(it.x, it.z);
  for (const b of boxes) { const [x, z] = local(it, b.x, b.z); P.collider({ kind: 'box', x, z, hx: b.w / 2, hz: b.d / 2, ry: it.ry + (b.ry || 0), y0: y - 2, y1: y + b.h }); }
  for (const f of farList) { const [x, z] = local(it, f.x, f.z); P.far({ ...f, x, z, y: y - 1 + (f.dy || 0), ry: it.ry + (f.ry || 0) }); }
  return y;
}

/** A lamp at a frame's local (lx, lz), hy over y. */
export function lampAt(P, st, y, lx, lz, hy, color, radius, intensity, halo) {
  const [x, z] = local(st, lx, lz);
  P.lamp({ x, z, hx: x, hz: z, hy: y + hy, color, radius, intensity, halo });
}
export function addBox(P, st, y, lx, lz, w, d, h, ry = 0) {
  const [x, z] = local(st, lx, lz);
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: st.ry + ry, y0: y - 2, y1: y + h });
}
export function addCircle(P, st, y, lx, lz, r, h) {
  const [x, z] = local(st, lx, lz);
  P.collider({ kind: 'circle', x, z, r, y0: y - 2, y1: y + h });
}

/** Telephone poles every ~46 m along a road, `lat` m to one side, wired pole to pole (each pole item knows the next). */
export function poleLine(P, r, side, lat, h = 9.5, o = {}) {
  const lk = o.leanK ?? 1;
  const s0 = r.trim0 + 20, s1 = r.length - r.trim1 - 20;
  let prev = null;
  for (let s = s0 + hash1(r.ri, 3) * 20; s < s1; s += 44 + hash1(r.ri, Math.round(s)) * 6) {
    const p = r.posAt(s, side * lat);
    const i = p.i;
    if ((r.flags[i] & 5) || !P.isFree(p.x, p.z, 1.6, 1.6, 0, { anywhere: true })) { prev = null; continue; }
    const y = besideY(r, i, side * lat);
    const it = P.add({ type: 'pole', x: p.x, z: p.z, y, ry: Math.atan2(r.TX[i], r.TZ[i]), h: h + hash1(r.ri, i, 3) * 1.2, lean: [(hash1(r.ri, i, 1) - 0.5) * 0.35 * lk, (hash1(r.ri, i, 2) - 0.5) * 0.35 * lk], next: null, broken: o.broken ? hash1(r.ri, i, 4) < o.broken : false });
    P.claim(p.x, p.z, 1.2, 1.2, 0);
    P.collider({ kind: 'circle', x: p.x, z: p.z, r: 0.22, y0: y - 1, y1: y + 10 });
    if (prev) prev.next = { x: it.x, y: it.y, z: it.z, ry: it.ry, h: it.h, lean: it.lean };
    prev = it;
  }
}

/** A road sign at arc length s (negative: from the end) of road id, on side, facing traffic heading dir. */
export function signAt(P, id, s, side, kind, dir = 1, o = {}) {
  const r = P.net.byId.get(id);
  if (!r) return null;
  const ss = Math.max(r.trim0 + 8, Math.min(r.length - r.trim1 - 8, s < 0 ? r.length + s : s));
  const p = r.posAt(ss, side * (reachOf(r) + 1.6 + (o.out || 0)));
  if (r.flags[p.i] & 5) return null;
  if (!P.isFree(p.x, p.z, 1, 1, 0, { anywhere: true })) return null;
  const it = P.add({ type: 'sign', x: p.x, z: p.z, ry: facing(r, p.i, side, dir, o.toe ?? 0.15), kind, o });
  P.claim(p.x, p.z, 1, 1, 0);
  P.collider({ kind: 'circle', x: p.x, z: p.z, r: 0.2, y0: r.Y[p.i] - 2, y1: r.Y[p.i] + 4 });
  return it;
}
