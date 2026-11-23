// Shared architecture for the building generators: walls with real openings,
// window and door units (casing, sills, sashes, mullions, boarded/broken states),
// roofs (gable, shed, hip, flat-with-parapet), raised floors on posts with
// skirting, steps, porches, arctic entries, stovepipes, gutters, icicles, signs,
// and the result packaging (doors / colliders / points / lights / cameras).
//
// Conventions: building-local frame, origin at the footprint centre on the
// ground, front door facing +Z, metres. A "side frame" maps a wall to local
// (u along the wall left→right seen from outside, y up, z out of the wall).
import * as THREE from 'three';
import { GeoBuilder, rgb, weather, rectMinusHoles } from '../geom.js';
import { windowCellUV, getSignMaterial, getMaterial } from '../materials.js';
import { makeRng, hashString } from '../../core/util.js';

export const PI = Math.PI;
export const HALF_PI = Math.PI / 2;

// paint palettes (sRGB hex) — faded rural Alaska
export const SIDING_COLORS = [
  '#7d2a22', '#8e3b2c', '#2f4a5e', '#3f6273', '#4f6a4a', '#6b7b56', '#b9a77c', '#c9b98f',
  '#8a8f8c', '#5d6669', '#2d3d36', '#a85f2d', '#6a4c3a', '#d4cdb8', '#4a5a7a', '#7c6a8a',
  '#b0b8b0', '#94584a', '#c4a24c', '#3b5f6b',
];
export const TRIM_COLORS = ['#f2efe6', '#efe9d8', '#ffffff', '#2c2a28', '#d8d2c2', '#5a3a2a'];
export const ROOF_COLORS = ['#5c2420', '#2e3f33', '#2a3440', '#6a6e70', '#3c3c3e', '#7a3a24', '#4a5648', '#8a8e90'];
export const DOOR_COLORS = ['#7a1f1a', '#2c3e50', '#3a5a40', '#c08a2a', '#ece6d6', '#4a3020', '#8a8a86', '#1e2a2a'];

// residential "room behind the glass" atlas cells (4 = shop shelves, 7 = office)
export const RES_CELLS = [0, 1, 2, 3, 5, 6];

// window light colours (multiplied by the glass emissive)
export const LIGHT = {
  warm: [1.0, 0.86, 0.66],
  soft: [0.85, 0.78, 0.66],
  dim: [0.32, 0.26, 0.2],
  tv: [0.42, 0.55, 0.95],
  cold: [0.8, 0.95, 1.05],
  office: [0.95, 0.95, 0.9],
  off: [0.012, 0.012, 0.014],
};

// ------------------------------------------------------------------ context

/** Shared per-building context. opts: {seed, state, name, interior, variant, ...style} */
export function makeCtx(type, opts = {}) {
  const o = { ...(opts.style || {}), ...opts };
  const seed = o.seed ?? 1;
  const rng = makeRng(hashString(type + ':' + seed));
  const state = Math.max(0, Math.min(1, o.state ?? 0.5));
  const ctx = {
    type, o, seed, rng, state,
    wear: 1 - state,
    name: o.name || '',
    wantInterior: !!o.interior,
    b: new GeoBuilder(),
    doors: [], colliders: [], points: {}, lights: [], cameras: [], floors: [], ramps: [],
    leaves: [], // door leaves kept as separate meshes {key, hinge:[x,z]}
    extra: [], // extra Object3Ds for the exterior (e.g. animated bits)
    footprint: { w: 10, d: 10 },
  };
  /** collider in building frame */
  ctx.col = (x, z, w, d, h = 3, rot = 0) => { ctx.colliders.push({ x, z, w, d, rot, h }); };
  /** collider given in the builder's current local frame */
  ctx.colLocal = (x, z, w, d, h = 3, y = 0) => {
    const p = ctx.b.P(x, y, z);
    ctx.colliders.push({ x: p[0], z: p[2], w, d, rot: ctx.b.yaw(), h });
  };
  /** walkable flat surface (building frame): centre, size, top height */
  ctx.floor = (x, z, w, d, y, rot = 0) => { ctx.floors.push({ x, z, w, d, rot, y }); };
  ctx.floorLocal = (x, z, w, d, y) => {
    const p = ctx.b.P(x, y, z);
    ctx.floors.push({ x: p[0], z: p[2], w, d, rot: ctx.b.yaw(), y: p[1] });
  };
  /** steps/stairs as a slope rising along the ramp's local +Z from y0 to y1 (building frame) */
  ctx.ramp = (x, z, w, d, y0, y1, rot = 0) => { ctx.ramps.push({ x, z, w, d, rot, y0, y1 }); };
  /** ramp in the current local frame; rising along local +Z (or −Z with down = true) */
  ctx.rampLocal = (x, z, w, d, y0, y1, towardMinusZ = false) => {
    const p0 = ctx.b.P(x, y0, z), p1 = ctx.b.P(x, y1, z);
    ctx.ramps.push({ x: p0[0], z: p0[2], w, d, rot: ctx.b.yaw() + (towardMinusZ ? PI : 0), y0: p0[1], y1: p1[1] });
  };
  ctx.point = (name, x, y, z, rot = 0) => { ctx.points[name] = { x, y, z, rot }; };
  ctx.pointLocal = (name, x, y, z, rot = 0) => {
    const p = ctx.b.P(x, y, z);
    ctx.points[name] = { x: p[0], y: p[1], z: p[2], rot: rot + ctx.b.yaw() };
  };
  ctx.light = (x, y, z, color = 0xffc070, intensity = 2, distance = 8, local = false) => {
    const p = local ? ctx.b.P(x, y, z) : [x, y, z];
    ctx.lights.push({ x: p[0], y: p[1], z: p[2], color, intensity, distance });
  };
  ctx.camera = (x, y, z, yaw, pitch = -0.35, fov = 70, range = 18, local = false) => {
    const p = local ? ctx.b.P(x, y, z) : [x, y, z];
    ctx.cameras.push({ x: p[0], y: p[1], z: p[2], yaw: local ? yaw + ctx.b.yaw() : yaw, pitch, fov, range });
  };
  /** pick lit/dark for a window (public buildings pass a higher p). */
  ctx.lit = (p = 0.55) => (rng() < Math.min(0.95, p * 1.3) * (0.4 + 0.6 * state) ? (rng() < 0.12 ? LIGHT.tv : rng() < 0.3 ? LIGHT.soft : LIGHT.warm) : LIGHT.off);
  return ctx;
}

/** Package the result. */
export function finish(ctx) {
  const { exterior, interior } = ctx.b.toGroups({ snow: true });
  // door leaves → pivot at the hinge so the game can swing them
  for (const lf of ctx.leaves) {
    for (const grp of [exterior, interior]) {
      const mesh = grp && grp.getObjectByName(lf.key);
      if (!mesh) continue;
      mesh.geometry.translate(-lf.hinge[0], 0, -lf.hinge[1]);
      mesh.geometry.computeBoundingSphere();
      mesh.position.set(lf.hinge[0], 0, lf.hinge[1]);
      mesh.matrixAutoUpdate = true;
      mesh.userData.door = lf.id;
    }
  }
  for (const e of ctx.extra) exterior.add(e);
  const group = new THREE.Group();
  group.name = ctx.type;
  group.add(exterior);
  for (const m of exterior.children) if (m.isMesh) m.updateMatrix();
  if (interior) {
    for (const m of interior.children) if (m.isMesh) m.updateMatrix();
  }
  group.userData = { type: ctx.type, seed: ctx.seed, state: ctx.state, stats: ctx.b.stats() };
  return {
    group,
    footprint: ctx.footprint,
    doors: ctx.doors,
    colliders: ctx.colliders,
    points: ctx.points,
    interior: interior || null,
    lights: ctx.lights,
    cameras: ctx.cameras,
    floors: ctx.floors,
    ramps: ctx.ramps,
  };
}

// ------------------------------------------------------------------ frames

/** Enter side s (0 front +Z, 1 right +X, 2 back −Z, 3 left −X) of a W×D box centred at (cx,cz). Returns the wall length. Caller must b.pop(). */
export function sideFrame(b, s, W, D, cx = 0, cz = 0) {
  b.push();
  if (s === 0) b.translate(cx - W / 2, 0, cz + D / 2);
  else if (s === 1) b.translate(cx + W / 2, 0, cz + D / 2).rotateY(HALF_PI);
  else if (s === 2) b.translate(cx + W / 2, 0, cz - D / 2).rotateY(PI);
  else b.translate(cx - W / 2, 0, cz - D / 2).rotateY(-HALF_PI);
  return s % 2 === 0 ? W : D;
}

// convex polygon clip (Sutherland–Hodgman), 2D [[x,y]...] CCW
function clipConvex(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const inside = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
    const inter = (p, q) => {
      const x1 = p[0], y1 = p[1], x2 = q[0], y2 = q[1];
      const x3 = a[0], y3 = a[1], x4 = b[0], y4 = b[1];
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(den) < 1e-12) return p;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
      return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    };
    const inp = out;
    out = [];
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length];
      const pi = inside(p), qi = inside(q);
      if (pi) out.push(p);
      if (pi !== qi) out.push(inter(p, q));
    }
  }
  return out;
}

/**
 * Wall surface in the current side frame: convex outline [[u,y]...] (CCW seen
 * from outside) minus rectangular holes {x0,x1,y0,y1}, at depth z, facing +z
 * (or −z with o.inward). o: {color, uvOff}
 */
export function wallFace(b, key, outline, holes, z, o = {}) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of outline) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const rects = rectMinusHoles(x0, y0, x1, y1, holes);
  const rectOutline = outline.length === 4 && isAxisRect(outline);
  for (const [ra, ya, rb, yb] of rects) {
    let poly = [[ra, ya], [rb, ya], [rb, yb], [ra, yb]];
    if (!rectOutline) poly = clipConvex(poly, outline);
    if (poly.length < 3) continue;
    b.poly(key, poly.map(([u, y]) => [u, y, z]), { color: o.color, want: [0, 0, o.inward ? -1 : 1], uvOff: o.uvOff, vgrad: o.vgrad });
  }
}
function isAxisRect(pts) {
  const xs = new Set(pts.map((p) => +p[0].toFixed(5))), ys = new Set(pts.map((p) => +p[1].toFixed(5)));
  return xs.size === 2 && ys.size === 2;
}

// ------------------------------------------------------------------ openings

/**
 * Window in the current side frame. op: {u, y, w, h, style:'dh'|'slider'|'fixed'|'grid'|'pane2'|'store',
 * light:[r,g,b], cell, cond:'ok'|'boarded'|'broken'|'dark', trim, casing (m), sill:bool}
 * wall: {thick, trim, inner:{key,color}|null, recess}
 */
export function windowUnit(ctx, op, wall) {
  const b = ctx.b;
  const u0 = op.u - op.w / 2, u1 = op.u + op.w / 2, y0 = op.y, y1 = op.y + op.h;
  const rec = op.recess ?? wall.recess ?? 0.08;
  const T = wall.thick ?? 0.2;
  const trim = op.trim ?? wall.trim ?? '#eeeae0';
  const cw = op.casing ?? wall.casing ?? 0.09;
  const tk = wall.trimKey || 'paint';
  const cond = op.cond || 'ok';
  // jambs (exterior part, up to the glass)
  b.poly(tk, [[u0, y0, 0], [u0, y0, -rec], [u0, y1, -rec], [u0, y1, 0]], { color: trim, want: [1, 0, 0] });
  b.poly(tk, [[u1, y0, 0], [u1, y0, -rec], [u1, y1, -rec], [u1, y1, 0]], { color: trim, want: [-1, 0, 0] });
  b.poly(tk, [[u0, y1, 0], [u1, y1, 0], [u1, y1, -rec], [u0, y1, -rec]], { color: trim, want: [0, -1, 0] });
  b.poly(tk, [[u0, y0, 0], [u1, y0, 0], [u1, y0, -rec], [u0, y0, -rec]], { color: trim, want: [0, 1, 0] });
  // interior reveal + inner face trim
  if (wall.inner) {
    const ik = 'i:' + (wall.inner.trimKey || 'paint');
    const ic = wall.inner.trim || '#e8e2d4';
    b.poly(ik, [[u0, y0, -rec], [u0, y0, -T], [u0, y1, -T], [u0, y1, -rec]], { color: ic, want: [1, 0, 0] });
    b.poly(ik, [[u1, y0, -rec], [u1, y0, -T], [u1, y1, -T], [u1, y1, -rec]], { color: ic, want: [-1, 0, 0] });
    b.poly(ik, [[u0, y1, -rec], [u1, y1, -rec], [u1, y1, -T], [u0, y1, -T]], { color: ic, want: [0, -1, 0] });
    b.box(ik, op.u, y0 - 0.03, -T - 0.02, op.w + 0.12, 0.03, 0.06, { color: ic }); // stool
    b.box(ik, u0 - 0.035, y0 - 0.06, -T - 0.008, 0.07, op.h + 0.12, 0.016, { color: ic });
    b.box(ik, u1 + 0.035, y0 - 0.06, -T - 0.008, 0.07, op.h + 0.12, 0.016, { color: ic });
    b.box(ik, op.u, y1, -T - 0.008, op.w + 0.14, 0.07, 0.016, { color: ic });
  }
  // glass with the room behind it
  const light = cond === 'ok' ? (op.light || LIGHT.off) : LIGHT.off;
  const cell = op.cell ?? RES_CELLS[(ctx.rng() * RES_CELLS.length) | 0];
  const [cu0, cv0, cu1, cv1] = windowCellUV(cell);
  const gk = op.glass || wall.glass || 'glass_warm';
  if (cond !== 'gone') {
    b.poly(gk, [[u0, y0, -rec], [u1, y0, -rec], [u1, y1, -rec], [u0, y1, -rec]], {
      color: light, uv: [[cu0, cv0], [cu1, cv0], [cu1, cv1], [cu0, cv1]], want: [0, 0, 1],
    });
  } else {
    b.poly('paint', [[u0, y0, -rec - 0.4], [u1, y0, -rec - 0.4], [u1, y1, -rec - 0.4], [u0, y1, -rec - 0.4]], { color: '#050505', want: [0, 0, 1] });
  }
  // sash / mullions (in front of the glass)
  const style = op.style || 'dh';
  const sk = tk, sc = op.sashColor || trim;
  const fw = style === 'store' ? 0.06 : 0.045;
  const zf = -rec + 0.035;
  const frame = (a, c, d, e) => b.boxMinMax(sk, a, c, -rec, d, e, zf, { color: sc, skip: 'k' });
  frame(u0, y0, u0 + fw, y1);
  frame(u1 - fw, y0, u1, y1);
  frame(u0, y1 - fw, u1, y1);
  frame(u0, y0, u1, y0 + fw * 1.4);
  if (style === 'dh') {
    const ym = y0 + op.h * 0.52;
    b.boxMinMax(sk, u0, ym - 0.03, -rec, u1, ym + 0.03, zf + 0.01, { color: sc, skip: 'k' });
  } else if (style === 'slider' || style === 'pane2') {
    b.boxMinMax(sk, op.u - 0.03, y0, -rec, op.u + 0.03, y1, zf + 0.01, { color: sc, skip: 'k' });
  } else if (style === 'grid') {
    const nx = op.gx || 2, ny = op.gy || 3;
    for (let i = 1; i < nx; i++) {
      const x = u0 + (op.w * i) / nx;
      b.boxMinMax(sk, x - 0.014, y0, -rec, x + 0.014, y1, zf, { color: sc, skip: 'k' });
    }
    for (let j = 1; j < ny; j++) {
      const y = y0 + (op.h * j) / ny;
      b.boxMinMax(sk, u0, y - 0.014, -rec, u1, y + 0.014, zf, { color: sc, skip: 'k' });
    }
  } else if (style === 'store') {
    const nx = op.gx || Math.max(1, Math.round(op.w / 1.4));
    for (let i = 1; i < nx; i++) {
      const x = u0 + (op.w * i) / nx;
      b.boxMinMax(sk, x - 0.03, y0, -rec, x + 0.03, y1, zf, { color: sc, skip: 'k' });
    }
    if (op.transom) {
      const y = y1 - op.transom;
      b.boxMinMax(sk, u0, y - 0.03, -rec, u1, y + 0.03, zf, { color: sc, skip: 'k' });
    }
  }
  // exterior casing, head, sill
  if (op.casing !== 0 && wall.casing !== 0) {
    const ct = 0.025;
    b.boxMinMax(tk, u0 - cw, y0 - (op.sill === false ? 0 : 0.02), 0, u0, y1, ct, { color: trim, skip: 'k' });
    b.boxMinMax(tk, u1, y0 - (op.sill === false ? 0 : 0.02), 0, u1 + cw, y1, ct, { color: trim, skip: 'k' });
    b.boxMinMax(tk, u0 - cw - 0.02, y1, 0, u1 + cw + 0.02, y1 + cw * 1.2, ct + 0.005, { color: trim, skip: 'k' });
    b.boxMinMax(tk, u0 - cw - 0.035, y1 + cw * 1.2, 0, u1 + cw + 0.035, y1 + cw * 1.2 + 0.025, ct + 0.035, { color: trim, skip: 'k' });
    if (op.sill !== false) {
      b.boxMinMax(tk, u0 - cw - 0.03, y0 - 0.055, 0, u1 + cw + 0.03, y0 - 0.005, 0.07, { color: trim, skip: 'k' });
      b.boxMinMax(tk, u0 - cw + 0.01, y0 - 0.16, 0, u1 + cw - 0.01, y0 - 0.055, ct, { color: trim, skip: 'k' });
    }
  }
  // condition
  if (cond === 'boarded') {
    const r = ctx.rng;
    const wk = r() < 0.6 ? 'plywood' : 'osb';
    b.push().translate(op.u, (y0 + y1) / 2, 0.045).rotateZ((r() - 0.5) * 0.06);
    b.box(wk, 0, -op.h / 2 - 0.04, 0, op.w + cw * 1.6, op.h + 0.08, 0.018, { color: weather('#c8b89a', 0.4 + r() * 0.5) });
    b.pop();
    if (r() < 0.5) {
      // a couple of battens across it
      for (const k of [-0.3, 0.3]) b.box('wood_raw', op.u, (y0 + y1) / 2 + k * op.h - 0.04, 0.065, op.w + cw * 2.2, 0.09, 0.025, { color: '#9a8a74', rz: (r() - 0.5) * 0.08 });
    }
  } else if (cond === 'broken') {
    const r = ctx.rng;
    for (let i = 0; i < 4; i++) {
      const ax = u0 + r() * op.w, ay = y0 + r() * op.h;
      const bx = Math.max(u0, Math.min(u1, ax + (r() - 0.5) * op.w)), by = Math.max(y0, Math.min(y1, ay + (r() - 0.5) * op.h));
      b.beam('paint', [ax, ay, -rec + 0.006], [bx, by, -rec + 0.006], 0.008, 0.002, { color: '#b8c0c4' });
    }
  }
}

/**
 * Door in the current side frame. op: {u, y, w=0.9, h=2.1, style:'panel'|'steel'|'glass'|'plank'|'double'|'store2',
 * color, id, leaf (separate mesh key), knob}
 */
export function doorUnit(ctx, op, wall) {
  const b = ctx.b;
  const w = op.w ?? 0.9, h = op.h ?? 2.1;
  const u0 = op.u - w / 2, u1 = op.u + w / 2, y0 = op.y, y1 = op.y + h;
  const rec = op.recess ?? 0.07;
  const T = wall.thick ?? 0.2;
  const trim = op.trim ?? wall.trim ?? '#eeeae0';
  const tk = wall.trimKey || 'paint';
  const cw = 0.1;
  const col = op.color || '#6a2a20';
  b.poly(tk, [[u0, y0, 0], [u0, y0, -T], [u0, y1, -T], [u0, y1, 0]], { color: trim, want: [1, 0, 0] });
  b.poly(tk, [[u1, y0, 0], [u1, y0, -T], [u1, y1, -T], [u1, y1, 0]], { color: trim, want: [-1, 0, 0] });
  b.poly(tk, [[u0, y1, 0], [u1, y1, 0], [u1, y1, -T], [u0, y1, -T]], { color: trim, want: [0, -1, 0] });
  // threshold
  b.boxMinMax('metal', u0, y0, -T, u1, y0 + 0.02, 0.02, { color: '#8a8a84' });
  // casing
  if (op.casing !== 0) {
    b.boxMinMax(tk, u0 - cw, y0, 0, u0, y1, 0.025, { color: trim, skip: 'kb' });
    b.boxMinMax(tk, u1, y0, 0, u1 + cw, y1, 0.025, { color: trim, skip: 'kb' });
    b.boxMinMax(tk, u0 - cw - 0.02, y1, 0, u1 + cw + 0.02, y1 + 0.13, 0.03, { color: trim, skip: 'k' });
    b.boxMinMax(tk, u0 - cw - 0.04, y1 + 0.13, 0, u1 + cw + 0.04, y1 + 0.16, 0.06, { color: trim, skip: 'k' });
  }
  if (wall.inner) {
    const ik = 'i:' + (wall.inner.trimKey || 'paint');
    const ic = wall.inner.trim || '#e8e2d4';
    b.boxMinMax(ik, u0 - 0.08, y0, -T - 0.016, u0, y1 + 0.08, -T, { color: ic, skip: 'f' });
    b.boxMinMax(ik, u1, y0, -T - 0.016, u1 + 0.08, y1 + 0.08, -T, { color: ic, skip: 'f' });
    b.boxMinMax(ik, u0, y1, -T - 0.016, u1, y1 + 0.08, -T, { color: ic, skip: 'f' });
  }
  if (op.open) return; // open passage: jambs only
  const style = op.style || 'panel';
  const leafKey = op.leaf || null;
  const lk = (k) => (leafKey ? leafKey : k);
  const dt = 0.045;
  const zb = -rec - dt;
  const leaves = style === 'double' || style === 'store2' ? 2 : 1;
  const lw = w / leaves;
  for (let L = 0; L < leaves; L++) {
    const a0 = u0 + L * lw, a1 = a0 + lw;
    const key = lk(style === 'glass' || style === 'store2' ? 'metal' : style === 'plank' ? 'wood_raw' : 'paint');
    if (style === 'glass' || style === 'store2') {
      // aluminium storefront door: frame + big glass
      const fc = op.frame || '#9aa0a4';
      const k = leafKey || 'metal';
      b.boxMinMax(k, a0, y0, zb, a0 + 0.1, y1, -rec, { color: fc });
      b.boxMinMax(k, a1 - 0.1, y0, zb, a1, y1, -rec, { color: fc });
      b.boxMinMax(k, a0, y1 - 0.1, zb, a1, y1, -rec, { color: fc });
      b.boxMinMax(k, a0, y0, zb, a1, y0 + 0.25, -rec, { color: fc });
      b.boxMinMax(k, a0 + 0.1, y0 + 0.95, zb + 0.005, a1 - 0.1, y0 + 1.0, -rec + 0.01, { color: fc }); // push bar
      const [cu0, cv0, cu1, cv1] = windowCellUV(op.cell ?? 4);
      b.poly(op.glass || 'glass_warm', [[a0 + 0.1, y0 + 0.25, zb + dt / 2], [a1 - 0.1, y0 + 0.25, zb + dt / 2], [a1 - 0.1, y1 - 0.1, zb + dt / 2], [a0 + 0.1, y1 - 0.1, zb + dt / 2]], {
        color: op.light || LIGHT.office, uv: [[cu0, cv0], [cu1, cv0], [cu1, cv1], [cu0, cv1]], want: [0, 0, 1],
      });
      continue;
    }
    b.boxMinMax(key, a0 + 0.004, y0 + 0.01, zb, a1 - 0.004, y1 - 0.004, -rec, { color: col });
    if (style === 'panel' || style === 'double') {
      // raised panels: 2 tall top, 2 bottom (+ small middle) — six-panel feel
      const pc = rgb(col, 0.92);
      const px = [a0 + 0.1, a0 + lw / 2 + 0.03];
      const pw = lw / 2 - 0.13;
      for (const x of px) {
        b.boxMinMax(key, x, y0 + 1.15, -rec, x + pw, y1 - 0.12, -rec + 0.012, { color: pc, skip: 'k' });
        b.boxMinMax(key, x, y0 + 0.14, -rec, x + pw, y0 + 0.95, -rec + 0.012, { color: pc, skip: 'k' });
      }
    } else if (style === 'steel') {
      // insulated steel door with a small lite
      const [cu0, cv0, cu1, cv1] = windowCellUV(op.cell ?? 2);
      const gx0 = a0 + lw * 0.3, gx1 = a1 - lw * 0.3, gy0 = y0 + 1.45, gy1 = y0 + 1.85;
      b.poly(op.glass || 'glass_warm', [[gx0, gy0, -rec + 0.002], [gx1, gy0, -rec + 0.002], [gx1, gy1, -rec + 0.002], [gx0, gy1, -rec + 0.002]], {
        color: op.light || LIGHT.dim, uv: [[cu0, cv0], [cu1, cv0], [cu1, cv1], [cu0, cv1]], want: [0, 0, 1],
      });
      b.boxMinMax(key, gx0 - 0.03, gy0 - 0.03, -rec, gx1 + 0.03, gy0, -rec + 0.01, { color: rgb(col, 0.8), skip: 'k' });
      b.boxMinMax(key, gx0 - 0.03, gy1, -rec, gx1 + 0.03, gy1 + 0.03, -rec + 0.01, { color: rgb(col, 0.8), skip: 'k' });
      b.boxMinMax(key, gx0 - 0.03, gy0, -rec, gx0, gy1, -rec + 0.01, { color: rgb(col, 0.8), skip: 'k' });
      b.boxMinMax(key, gx1, gy0, -rec, gx1 + 0.03, gy1, -rec + 0.01, { color: rgb(col, 0.8), skip: 'k' });
      b.boxMinMax(key, a0 + 0.02, y0 + 0.02, -rec, a1 - 0.02, y0 + 0.22, -rec + 0.004, { color: '#8a8a88', skip: 'k' }); // kick plate
    } else if (style === 'plank') {
      for (let i = 1; i < 5; i++) b.boxMinMax(key, a0 + (lw * i) / 5 - 0.006, y0, -rec, a0 + (lw * i) / 5 + 0.006, y1 - 0.01, -rec + 0.006, { color: rgb(col, 0.7), skip: 'k' });
      b.boxMinMax(key, a0 + 0.04, y0 + 0.3, -rec, a1 - 0.04, y0 + 0.42, -rec + 0.025, { color: col, skip: 'k' });
      b.boxMinMax(key, a0 + 0.04, y1 - 0.45, -rec, a1 - 0.04, y1 - 0.33, -rec + 0.025, { color: col, skip: 'k' });
      b.beam(key, [a0 + 0.08, y0 + 0.42, -rec + 0.012], [a1 - 0.08, y1 - 0.45, -rec + 0.012], 0.1, 0.025, { color: col });
    }
    // knob / lever, both faces
    const kx = leaves === 2 ? (L === 0 ? a1 - 0.08 : a0 + 0.08) : a1 - 0.09;
    const kk = leafKey || 'metal';
    b.push().translate(kx, y0 + 0.97, -rec).rotateX(HALF_PI);
    b.cyl(kk, 0, -0.07, 0, 0.022, 0.07, { segs: 8, color: '#c8b070' });
    b.cyl(kk, 0, dt, 0, 0.022, 0.07, { segs: 8, color: '#c8b070' });
    b.pop();
  }
  if (leafKey) {
    // hinge at the left jamb (seen from outside), in building space
    const p = b.P(u0, 0, -rec - dt / 2);
    ctx.leaves.push({ key: leafKey, hinge: [p[0], p[2]], id: op.id || 'front' });
  }
}

// ------------------------------------------------------------------ walls

/**
 * Four walls of a rectangular body with openings.
 * spec: { W, D, cx=0, cz=0, y0, y1, thick=0.2, key, color, trim, trimKey, corner=0.1,
 *   gable: {axis:'x'|'z', yRidge} (adds gable triangles on the end walls),
 *   sides: [front[], right[], back[], left[]] openings {kind:'win'|'door', u, y, w, h, ...},
 *   inner: {key:'plaster', color, trim, y0, y1} — interior wall faces (into 'i:' buckets),
 *   skip: [bool x4], bands: true (skirt/frieze boards) }
 */
export function walls(ctx, spec) {
  const b = ctx.b;
  const T = spec.thick ?? 0.2;
  const wall = { thick: T, trim: spec.trim, trimKey: spec.trimKey, inner: spec.inner || null, glass: spec.glass, recess: spec.recess, casing: spec.casing };
  for (let s = 0; s < 4; s++) {
    if (spec.skip && spec.skip[s]) continue;
    const len = sideFrame(b, s, spec.W, spec.D, spec.cx || 0, spec.cz || 0);
    const ops = (spec.sides && spec.sides[s]) || [];
    const holes = ops.map((op) => {
      const w = op.w ?? 0.9, h = op.h ?? 2.1;
      return { x0: op.u - w / 2, x1: op.u + w / 2, y0: op.y, y1: op.y + h };
    });
    // outline: rectangle or pentagon on gable ends
    let outline = [[0, spec.y0], [len, spec.y0], [len, spec.y1], [0, spec.y1]];
    const isGableEnd = spec.gable && ((spec.gable.axis === 'x' && s % 2 === 1) || (spec.gable.axis === 'z' && s % 2 === 0));
    if (isGableEnd) outline = [[0, spec.y0], [len, spec.y0], [len, spec.y1], [len / 2, spec.gable.yRidge], [0, spec.y1]];
    if (spec.shed && s % 2 === 1) {
      // shed roof: side walls are trapezoids (front high or low)
      const yf = spec.shed.yFront, yb = spec.shed.yBack;
      outline = s === 1 ? [[0, spec.y0], [len, spec.y0], [len, yb], [0, yf]] : [[0, spec.y0], [len, spec.y0], [len, yf], [0, yb]];
    }
    if (spec.shed && s === 0) outline = [[0, spec.y0], [len, spec.y0], [len, spec.shed.yFront], [0, spec.shed.yFront]];
    if (spec.shed && s === 2) outline = [[0, spec.y0], [len, spec.y0], [len, spec.shed.yBack], [0, spec.shed.yBack]];
    const sc = spec.sideColor ? spec.sideColor[s] : spec.color;
    // grime: darker toward the base (splash, snow melt), slightly under the eaves
    const g = spec.grime ?? 0.18;
    const yTopW = Math.max(...outline.map((p) => p[1]));
    wallFace(b, spec.key, outline, holes, 0, { color: sc, vgrad: g > 0 ? [spec.y0, Math.min(spec.y0 + 2.2, yTopW), 1 - g, 1] : null });
    if (spec.inner) {
      const iy0 = spec.inner.y0 ?? spec.y0, iy1 = spec.inner.y1 ?? spec.y1;
      const inl = [[T, iy0], [len - T, iy0], [len - T, iy1], [T, iy1]];
      wallFace(b, 'i:' + (spec.inner.key || 'plaster'), inl, holes.map((h) => ({ ...h, y0: Math.max(h.y0, iy0) })), -T, { color: spec.inner.color || '#d8d0c0', inward: true });
    }
    // corner boards + bands
    const cb = spec.corner ?? 0.1;
    const tk = spec.trimKey || 'paint';
    const yTop = isGableEnd || spec.shed ? spec.y1 : spec.y1;
    if (cb > 0) {
      const yt = spec.shed && s % 2 === 1 ? Math.min(spec.shed.yFront, spec.shed.yBack) : yTop;
      const ytl = spec.shed && s === 1 ? spec.shed.yFront : spec.shed && s === 3 ? spec.shed.yBack : spec.shed && s === 0 ? spec.shed.yFront : spec.shed && s === 2 ? spec.shed.yBack : yt;
      const ytr = spec.shed && s === 1 ? spec.shed.yBack : spec.shed && s === 3 ? spec.shed.yFront : spec.shed && s === 0 ? spec.shed.yFront : spec.shed && s === 2 ? spec.shed.yBack : yt;
      b.boxMinMax(tk, 0, spec.y0, 0, cb, ytl, 0.028, { color: spec.trim, skip: 'k' });
      b.boxMinMax(tk, len - cb, spec.y0, 0, len, ytr, 0.028, { color: spec.trim, skip: 'k' });
    }
    if (spec.bands !== false) {
      b.boxMinMax(tk, -0.03, spec.y0 - 0.02, 0, len + 0.03, spec.y0 + 0.16, 0.035, { color: spec.trim, skip: 'k' });
      if (!isGableEnd && !(spec.shed && s % 2 === 1)) {
        const yt = spec.shed ? (s === 0 ? spec.shed.yFront : spec.shed.yBack) : spec.y1;
        b.boxMinMax(tk, 0, yt - 0.2, 0, len, yt, 0.03, { color: spec.trim, skip: 'k' });
      }
    }
    for (const op of ops) {
      if (op.kind === 'door') doorUnit(ctx, op, wall);
      else windowUnit(ctx, op, wall);
    }
    b.pop();
  }
}

/** Lay out n windows evenly along a wall of length len (returns u centres). */
export function spread(len, n, margin = 1.0) {
  if (n <= 0) return [];
  if (n === 1) return [len / 2];
  const out = [];
  for (let i = 0; i < n; i++) out.push(margin + ((len - 2 * margin) * i) / (n - 1));
  return out;
}

// ------------------------------------------------------------------ roofs

/**
 * Gable roof over a W×D body, ridge along local X (use o.axis='z' to turn it).
 * o: {W, D, cx, cz, yEave, pitch, eave, rake, thick, key, color, trim, soffit,
 *     cap: bool, wear (0..1 patches/rust), sag}
 * Returns {yRidge}.
 */
export function roofGable(ctx, o) {
  const b = ctx.b;
  const axisZ = o.axis === 'z';
  const W = axisZ ? o.D : o.W, D = axisZ ? o.W : o.D;
  const pitch = o.pitch ?? 0.5;
  const eave = o.eave ?? 0.45, rake = o.rake ?? 0.35, thick = o.thick ?? 0.14;
  const yE = o.yEave;
  const yR = yE + (D / 2) * pitch;
  b.push().translate(o.cx || 0, 0, o.cz || 0);
  if (axisZ) b.rotateY(HALF_PI);
  const xl = -W / 2 - rake, xr = W / 2 + rake;
  const ze = D / 2 + eave, ye = yE - eave * pitch;
  const tv = thick * Math.sqrt(1 + pitch * pitch);
  const key = o.key || 'roof_shingle', col = o.color || '#3a3a3a';
  const trim = o.trim || '#eeeae0', soffit = o.soffit || trim;
  for (const s of [1, -1]) {
    const Z = (z) => z * s;
    b.poly(key, [[xl, ye + tv, Z(ze)], [xr, ye + tv, Z(ze)], [xr, yR + tv, 0], [xl, yR + tv, 0]], { color: col, want: [0, 1, s * pitch] });
    b.poly('paint', [[xl, ye, Z(ze)], [xr, ye, Z(ze)], [xr, yR, 0], [xl, yR, 0]], { color: soffit, want: [0, -1, -s * pitch] });
    // fascia (deeper than the deck) + rake boards
    b.poly('paint', [[xl, ye - 0.08, Z(ze)], [xr, ye - 0.08, Z(ze)], [xr, ye + tv, Z(ze)], [xl, ye + tv, Z(ze)]], { color: trim, want: [0, 0, s] });
    b.poly('paint', [[xl, ye - 0.08, Z(ze) - s * 0.03], [xr, ye - 0.08, Z(ze) - s * 0.03], [xr, ye - 0.08, Z(ze)], [xl, ye - 0.08, Z(ze)]], { color: trim, want: [0, -1, 0] });
    for (const x of [xl, xr]) {
      const sx = x < 0 ? -1 : 1;
      b.poly('paint', [[x, ye - 0.08, Z(ze)], [x, yR - 0.08, 0], [x, yR + tv, 0], [x, ye + tv, Z(ze)]], { color: trim, want: [sx, 0, 0] });
      b.poly('paint', [[x - sx * 0.04, ye - 0.08, Z(ze)], [x - sx * 0.04, yR - 0.08, 0], [x, yR - 0.08, 0], [x, ye - 0.08, Z(ze)]], { color: trim, want: [0, -1, 0] });
    }
    // patches / missing shingles on run-down roofs
    if ((o.wear || 0) > 0.35 && key === 'roof_shingle') {
      const n = Math.floor((o.wear - 0.3) * 10);
      for (let i = 0; i < n; i++) {
        const px = xl + 0.5 + ctx.rng() * (xr - xl - 1.5), t = 0.15 + ctx.rng() * 0.7;
        const pw = 0.4 + ctx.rng() * 1.2, ph = 0.3 + ctx.rng() * 0.6;
        const z0 = ze * (1 - t), y0 = ye + (yR - ye) * t + tv + 0.006;
        const dz = (ph / Math.sqrt(1 + pitch * pitch));
        const dy = dz * pitch;
        const pc = ctx.rng() < 0.5 ? '#1a1a1a' : '#5a4a3a';
        b.poly('paint', [[px, y0, Z(z0)], [px + pw, y0, Z(z0)], [px + pw, y0 + dy, Z(z0 - dz)], [px, y0 + dy, Z(z0 - dz)]], { color: pc, want: [0, 1, s * pitch] });
      }
    }
  }
  if (o.cap !== false) {
    // ridge cap
    const cw = 0.16;
    const ck = o.capKey || (key === 'roof_shingle' ? key : 'sheet_metal');
    const cc = o.capColor || (key === 'roof_shingle' ? rgb(col, 0.85) : rgb(col, 0.9));
    for (const s of [1, -1]) {
      b.poly(ck, [[xl, yR + tv - cw * pitch * 0.5, s * cw], [xr, yR + tv - cw * pitch * 0.5, s * cw], [xr, yR + tv + 0.04, 0], [xl, yR + tv + 0.04, 0]], { color: cc, want: [0, 1, s * 0.3] });
    }
    b.poly(ck, [[xl, yR + tv - cw * pitch * 0.5, cw], [xl, yR + tv + 0.04, 0], [xl, yR + tv - cw * pitch * 0.5, -cw]], { color: cc, want: [-1, 0, 0] });
    b.poly(ck, [[xr, yR + tv - cw * pitch * 0.5, -cw], [xr, yR + tv + 0.04, 0], [xr, yR + tv - cw * pitch * 0.5, cw]], { color: cc, want: [1, 0, 0] });
  }
  if (o.gutters) {
    for (const s of [1, -1]) {
      b.boxMinMax('sheet_metal', xl + 0.1, ye - 0.2, s * (ze + 0.0) - (s < 0 ? 0.12 : 0), xr - 0.1, ye - 0.06, s * (ze + 0.0) + (s > 0 ? 0.12 : 0), { color: o.gutterColor || '#d8d8d0' });
    }
  }
  if (o.icicles) icicles(ctx, xl + 0.2, xr - 0.2, ye - 0.08, ze + 0.01, o.icicles);
  if (o.icicles) { b.push().rotateY(PI); icicles(ctx, xl + 0.2, xr - 0.2, ye - 0.08, ze + 0.01, o.icicles * 0.6); b.pop(); }
  b.pop();
  return { yRidge: yR, yEaveEdge: ye };
}

/** A row of icicles hanging under an eave line at height y, z (local). */
export function icicles(ctx, x0, x1, y, z, density = 1) {
  const b = ctx.b, r = ctx.rng;
  const n = Math.floor((x1 - x0) * 2.2 * density);
  for (let i = 0; i < n; i++) {
    if (r() < 0.35) continue;
    const x = x0 + r() * (x1 - x0);
    const len = 0.08 + r() * r() * 0.6;
    b.cyl('ice', x, y - len, z, 0.0, len, { rTop: 0.018 + r() * 0.025, segs: 5, caps: 't', color: '#e8f4ff' });
  }
}

/**
 * Shed (mono-pitch) roof: high edge at the front (o.high = 'front') or back.
 * o: {W, D, cx, cz, yLow, yHigh, eave, rake, thick, key, color, trim}
 */
export function roofShed(ctx, o) {
  const b = ctx.b;
  const W = o.W, D = o.D;
  const eave = o.eave ?? 0.4, rake = o.rake ?? 0.3, thick = o.thick ?? 0.14;
  const high = o.high || 'back';
  const pitch = (o.yHigh - o.yLow) / D;
  b.push().translate(o.cx || 0, 0, o.cz || 0);
  if (high === 'front') b.rotateY(PI);
  // low edge at +z
  const xl = -W / 2 - rake, xr = W / 2 + rake;
  const zl = D / 2 + eave, zh = -D / 2 - eave * 0.6;
  const yl = o.yLow - eave * pitch, yh = o.yHigh + eave * 0.6 * pitch;
  const tv = thick * Math.sqrt(1 + pitch * pitch);
  const key = o.key || 'metal_corr', col = o.color || '#808080', trim = o.trim || '#eeeae0';
  b.poly(key, [[xl, yl + tv, zl], [xr, yl + tv, zl], [xr, yh + tv, zh], [xl, yh + tv, zh]], { color: col, want: [0, 1, pitch] });
  b.poly('paint', [[xl, yl, zl], [xr, yl, zl], [xr, yh, zh], [xl, yh, zh]], { color: o.soffit || trim, want: [0, -1, -pitch] });
  b.poly('paint', [[xl, yl - 0.06, zl], [xr, yl - 0.06, zl], [xr, yl + tv, zl], [xl, yl + tv, zl]], { color: trim, want: [0, 0, 1] });
  b.poly('paint', [[xl, yh - 0.06, zh], [xr, yh - 0.06, zh], [xr, yh + tv, zh], [xl, yh + tv, zh]], { color: trim, want: [0, 0, -1] });
  for (const x of [xl, xr]) {
    const sx = x < 0 ? -1 : 1;
    b.poly('paint', [[x, yl - 0.06, zl], [x, yh - 0.06, zh], [x, yh + tv, zh], [x, yl + tv, zl]], { color: trim, want: [sx, 0, 0] });
  }
  if (o.icicles) icicles(ctx, xl + 0.2, xr - 0.2, yl - 0.06, zl + 0.01, o.icicles);
  b.pop();
}

/** Hip roof over W×D (o: {W, D, cx, cz, yEave, pitch, eave, thick, key, color, trim}). */
export function roofHip(ctx, o) {
  const b = ctx.b;
  const W = o.W, D = o.D, pitch = o.pitch ?? 0.45, eave = o.eave ?? 0.5, thick = o.thick ?? 0.14;
  const key = o.key || 'roof_shingle', col = o.color || '#3a3a3a', trim = o.trim || '#eeeae0';
  b.push().translate(o.cx || 0, 0, o.cz || 0);
  const w2 = W / 2 + eave, d2 = D / 2 + eave;
  const ye = o.yEave - eave * pitch;
  const run = Math.min(w2, d2);
  const yR = ye + run * pitch;
  const rx = w2 - run, rz = d2 - run; // half-length of ridge
  const tv = thick * Math.sqrt(1 + pitch * pitch);
  const T = (pts) => pts.map(([x, y, z]) => [x, y + tv, z]);
  const faces = [
    [[-w2, ye, d2], [w2, ye, d2], [rx, yR, rz], [-rx, yR, rz]],
    [[w2, ye, -d2], [-w2, ye, -d2], [-rx, yR, -rz], [rx, yR, -rz]],
    [[w2, ye, d2], [w2, ye, -d2], [rx, yR, -rz], [rx, yR, rz]],
    [[-w2, ye, -d2], [-w2, ye, d2], [-rx, yR, rz], [-rx, yR, -rz]],
  ];
  const wants = [[0, 1, pitch], [0, 1, -pitch], [pitch, 1, 0], [-pitch, 1, 0]];
  faces.forEach((f, i) => {
    // drop the duplicated apex when the ridge degenerates to a point
    const pts = Math.hypot(f[2][0] - f[3][0], f[2][2] - f[3][2]) < 1e-6 ? f.slice(0, 3) : f;
    b.poly(key, T(pts), { color: col, want: wants[i] });
    b.poly('paint', pts, { color: o.soffit || trim, want: wants[i].map((v) => -v) });
  });
  // fascia
  const fs = [[[-w2, d2], [w2, d2], [0, 0, 1]], [[w2, -d2], [-w2, -d2], [0, 0, -1]], [[w2, d2], [w2, -d2], [1, 0, 0]], [[-w2, -d2], [-w2, d2], [-1, 0, 0]]];
  for (const [a, c, wnt] of fs) b.poly('paint', [[a[0], ye - 0.08, a[1]], [c[0], ye - 0.08, c[1]], [c[0], ye + tv, c[1]], [a[0], ye + tv, a[1]]], { color: trim, want: wnt });
  b.pop();
  return { yRidge: yR + tv };
}

/** Flat roof with a parapet: o {W, D, cx, cz, y (roof deck), parapet (height), key, color, capColor}. */
export function roofFlat(ctx, o) {
  const b = ctx.b;
  const W = o.W, D = o.D, p = o.parapet ?? 0.6, t = o.thick ?? 0.25;
  b.push().translate(o.cx || 0, 0, o.cz || 0);
  b.box(o.deckKey || 'concrete', 0, o.y - 0.05, 0, W - 0.1, 0.06, D - 0.1, { color: o.deckColor || '#5a5a5a', skip: 'b' });
  const k = o.key || 'paint', c = o.color || '#cccccc', cc = o.capColor || '#9a9a9a';
  if (p > 0) {
    b.box(k, 0, o.y, D / 2 - t / 2, W, p, t, { color: c });
    b.box(k, 0, o.y, -D / 2 + t / 2, W, p, t, { color: c });
    b.box(k, W / 2 - t / 2, o.y, 0, t, p, D - 2 * t, { color: c });
    b.box(k, -W / 2 + t / 2, o.y, 0, t, p, D - 2 * t, { color: c });
    b.box('sheet_metal', 0, o.y + p, D / 2 - t / 2, W + 0.06, 0.05, t + 0.06, { color: cc });
    b.box('sheet_metal', 0, o.y + p, -D / 2 + t / 2, W + 0.06, 0.05, t + 0.06, { color: cc });
    b.box('sheet_metal', W / 2 - t / 2, o.y + p, 0, t + 0.06, 0.05, D - 2 * t, { color: cc });
    b.box('sheet_metal', -W / 2 + t / 2, o.y + p, 0, t + 0.06, 0.05, D - 2 * t, { color: cc });
  }
  b.pop();
}

// ------------------------------------------------------------------ base

/**
 * Raised floor on posts (permafrost): posts, rim beams, optional skirting.
 * o: {W, D, cx, cz, floorY, skirt: 'plywood'|'t111'|'lattice'|null, color, gaps (0..1), postKey}
 */
export function raisedFloor(ctx, o) {
  const b = ctx.b, r = ctx.rng;
  const W = o.W, D = o.D, fy = o.floorY;
  b.push().translate(o.cx || 0, 0, o.cz || 0);
  // rim joist band
  b.box(o.rimKey || 'wood_raw', 0, fy - 0.28, 0, W + 0.04, 0.28, D + 0.04, { color: o.rimColor || '#8a7560', skip: 't' });
  // floor deck underside
  if (fy > 0.3) {
    const nx = Math.max(2, Math.round(W / 2.4) + 1), nz = Math.max(2, Math.round(D / 2.4) + 1);
    const pk = o.postKey || 'wood_raw';
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1 && (i + j) % 2) continue;
        const x = -W / 2 + 0.2 + ((W - 0.4) * i) / (nx - 1), z = -D / 2 + 0.2 + ((D - 0.4) * j) / (nz - 1);
        if (pk === 'galv' || pk === 'metal') b.cyl(pk, x, -0.3, z, 0.085, fy - 0.28 + 0.3, { segs: 8, color: '#9aa0a2', caps: 't' });
        else b.box(pk, x, -0.3, z, 0.15, fy - 0.28 + 0.3, 0.15, { color: '#7a6a56', skip: 'b' });
        // cribbing pad
        if (pk !== 'galv') b.box('wood_raw', x, -0.05, z, 0.5, 0.12, 0.3, { color: '#5a4a3a', ry: (i * 7 + j) % 2 ? 0 : HALF_PI });
      }
    }
    b.box('wood_raw', 0, fy - 0.3, 0, W - 0.1, 0.02, D - 0.1, { color: '#3a3228', skip: 't' });
    if (o.skirt) {
      const sk = o.skirt === 't111' ? 'siding_panel' : o.skirt === 'lattice' ? 'wood_raw' : 'plywood';
      const sc = o.color || (o.skirt === 'plywood' ? '#a89878' : '#8a7a68');
      const gaps = o.gaps || 0;
      for (let s = 0; s < 4; s++) {
        const len = sideFrame(b, s, W, D);
        const n = Math.max(1, Math.round(len / 1.22));
        for (let i = 0; i < n; i++) {
          if (r() < gaps) {
            // missing panel → a dark crawlspace hole (posts visible behind)
            if (r() < 0.5) {
              // panel kicked in / leaning out
              b.push().translate((len * (i + 0.5)) / n, 0, 0.05).rotateX(0.25 + r() * 0.3);
              b.box(sk, 0, 0, 0, len / n - 0.02, (fy - 0.28) * 0.9, 0.012, { color: sc });
              b.pop();
            }
            continue;
          }
          const x0 = (len * i) / n, x1 = (len * (i + 1)) / n;
          b.boxMinMax(sk, x0 + 0.005, -0.2, 0.0, x1 - 0.005, fy - 0.28, 0.015, { color: rgb(sc, 0.9 + r() * 0.2), skip: 'k' });
        }
        b.boxMinMax('paint', 0, fy - 0.34, 0.015, len, fy - 0.26, 0.04, { color: o.trim || '#d8d2c4', skip: 'k' });
        b.pop();
      }
    }
  }
  b.pop();
}

/**
 * Open wooden steps rising toward −Z (to a landing at height rise) at (x, z)
 * facing +Z. o: {w, rise, rail: bool, key, color}
 */
export function steps(ctx, x, z, rot, o = {}) {
  const b = ctx.b;
  const rise = o.rise ?? 0.8, w = o.w ?? 1.1;
  const n = Math.max(1, Math.round(rise / 0.19));
  const rr = rise / n, run = 0.28;
  const key = o.key || 'wood_raw', col = o.color || '#9a8466';
  b.push().translate(x, 0, z).rotateY(rot);
  ctx.rampLocal(0, (n * run) / 2, w, n * run, 0, rise, true);
  // treads: step i top at (i+1)*rr, from z = (n-1-i)*run .. (n-i)*run measured outward from the landing
  for (let i = 0; i < n; i++) {
    const zc = (n - 1 - i) * run + run / 2;
    if (o.solid) b.box(key, 0, 0, zc, w, (i + 1) * rr, run, { color: col });
    else b.box(key, 0, (i + 1) * rr - 0.04, zc, w, 0.04, run + 0.02, { color: rgb(col, 0.95 + (i % 2) * 0.08) });
  }
  if (!o.solid && n > 1) {
    // stringers
    for (const sx of [-w / 2 + 0.03, w / 2 - 0.03]) {
      b.beam(key, [sx, -0.02, n * run], [sx, rise - 0.02, 0], 0.05, 0.2, { color: rgb(col, 0.8) });
    }
  }
  if (o.rail && n > 2) {
    const rc = o.railColor || col;
    for (const sx of [-w / 2 + 0.03, w / 2 - 0.03]) {
      b.box(key, sx, 0, n * run - 0.05, 0.07, 0.95, 0.07, { color: rc });
      b.beam(key, [sx, 0.92, n * run - 0.05], [sx, rise + 0.92, 0.05], 0.06, 0.05, { color: rc });
    }
  }
  b.pop();
  return { run: n * run };
}

/** Railing along a polyline [[x,z]...] at deck height y (balusters + top rail). */
export function railing(ctx, pts, y, o = {}) {
  const b = ctx.b, r = ctx.rng;
  const key = o.key || 'wood_raw', col = o.color || '#9a8466';
  const h = o.h ?? 0.95;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const broken = (o.wear || 0) > 0.5 && r() < (o.wear - 0.4);
    b.box(key, ax, y, az, 0.09, h + 0.05, 0.09, { color: col });
    if (!broken) b.beam(key, [ax, y + h, az], [bx, y + h, bz], 0.09, 0.05, { color: col });
    else b.beam(key, [ax, y + h, az], [ax + (bx - ax) * 0.4, y + h - 0.3, az + (bz - az) * 0.4], 0.09, 0.05, { color: col });
    b.beam(key, [ax, y + 0.12, az], [bx, y + 0.12, bz], 0.07, 0.04, { color: col });
    const nb = Math.floor(len / 0.14);
    for (let k = 1; k < nb; k++) {
      if (broken && r() < 0.5) continue;
      const t = k / nb;
      b.box(key, ax + (bx - ax) * t, y + 0.14, az + (bz - az) * t, 0.035, h - 0.14, 0.035, { color: col, ry: Math.atan2(bx - ax, bz - az) });
    }
  }
  const [lx, lz] = pts[pts.length - 1];
  b.box(key, lx, y, lz, 0.09, h + 0.05, 0.09, { color: col });
}

/**
 * Covered porch/deck in front of a wall: platform (W × D) at height y, centred
 * on (x, z) with the house wall at z − D/2. o: {roof:bool, roofKey, roofColor, wear, rail}
 */
export function porch(ctx, x, z, W, D, y, o = {}) {
  const b = ctx.b, r = ctx.rng;
  const wear = o.wear || 0;
  const key = o.key || 'wood_weathered', col = o.color || '#8a7c6a';
  b.push().translate(x, 0, z);
  ctx.floorLocal(0, 0, W, D, y);
  const sag = wear > 0.6 ? (wear - 0.6) * 0.25 : 0;
  // deck boards
  const nb = Math.round(W / 0.15);
  for (let i = 0; i < nb; i++) {
    if (wear > 0.5 && r() < (wear - 0.45) * 0.25) continue; // missing board
    const bx = -W / 2 + (i + 0.5) * (W / nb);
    const dy = -sag * Math.sin((i / nb) * PI);
    b.box(key, bx, y - 0.035 + dy, 0, W / nb - 0.012, 0.035, D, { color: rgb(col, 0.9 + r() * 0.2), noSnow: !!o.roof });
  }
  b.box('wood_raw', 0, y - 0.25, D / 2 - 0.05, W, 0.21, 0.05, { color: '#6a5a48' });
  b.box('wood_raw', 0, y - 0.25, 0, W - 0.1, 0.18, D - 0.2, { color: '#3a3228', skip: 't' });
  // posts under
  for (const px of [-W / 2 + 0.1, W / 2 - 0.1]) for (const pz of [D / 2 - 0.1, -D / 2 + 0.15]) b.box('wood_raw', px, -0.2, pz, 0.12, y - 0.05, 0.12, { color: '#6a5a48' });
  if (o.rail !== false) railing(ctx, [[-W / 2 + 0.05, -D / 2 + 0.05], [-W / 2 + 0.05, D / 2 - 0.05], [-(o.gap ?? 0.6), D / 2 - 0.05]], y, { wear, color: o.railColor || col, key: o.railKey || key });
  if (o.rail !== false) railing(ctx, [[o.gap ?? 0.6, D / 2 - 0.05], [W / 2 - 0.05, D / 2 - 0.05], [W / 2 - 0.05, -D / 2 + 0.05]], y, { wear, color: o.railColor || col, key: o.railKey || key });
  if (o.roof) {
    const ph = o.postH ?? 2.45;
    const tilt = wear > 0.7 ? (r() - 0.5) * 0.06 : 0;
    for (const px of [-W / 2 + 0.08, W / 2 - 0.08]) {
      b.push().translate(px, y, D / 2 - 0.08).rotateZ(tilt);
      b.box(o.postKey || 'paint', 0, 0, 0, 0.12, ph, 0.12, { color: o.postColor || '#e8e2d4' });
      b.pop();
    }
    b.box('paint', 0, y + ph - 0.2, D / 2 - 0.08, W, 0.2, 0.14, { color: o.postColor || '#e8e2d4' });
    roofShed(ctx, { W: W, D: D, cx: 0, cz: 0, yLow: y + ph - sag * 2, yHigh: y + ph + 0.45, high: 'back', key: o.roofKey || 'metal_corr', color: o.roofColor || '#8a8e90', trim: o.postColor || '#e8e2d4', eave: 0.25, rake: 0.15, icicles: o.icicles });
  }
  b.pop();
}

/**
 * Arctic entry: a small unheated vestibule in front of a door (cold porch).
 * Built centred on (x, z) with its back against the wall at z − d/2.
 * o: {w, d, h, floorY, key, color, trim, roofKey, roofColor, doorSide: 'front'|'left'|'right', door style}
 * returns the outer door position in building space.
 */
export function arcticEntry(ctx, x, z, o = {}) {
  const b = ctx.b, r = ctx.rng;
  const w = o.w ?? 2.0, d = o.d ?? 1.6, h = o.h ?? 2.45, fy = o.floorY ?? 0.6;
  b.push().translate(x, 0, z);
  const side = o.doorSide || 'front';
  const sides = [[], [], [], []];
  const doorOp = { kind: 'door', y: fy, w: 0.86, h: 2.03, style: o.doorStyle || 'steel', color: o.doorColor || '#5a5a58', light: LIGHT.dim, id: o.doorId || 'front', leaf: o.leaf };
  if (side === 'front') sides[0].push({ ...doorOp, u: w / 2 });
  else if (side === 'right') sides[1].push({ ...doorOp, u: d / 2 + 0.1 });
  else sides[3].push({ ...doorOp, u: d / 2 - 0.1 });
  if (o.window !== false) {
    const ws = side === 'front' ? 1 : 0;
    sides[ws].push({ kind: 'win', u: ws === 0 ? w / 2 : d / 2, y: fy + 1.0, w: 0.5, h: 0.6, style: 'fixed', light: o.light || LIGHT.dim, cond: o.cond });
  }
  walls(ctx, {
    W: w, D: d, y0: Math.max(0, fy - 0.3), y1: fy + h, key: o.key || 'siding_panel', color: o.color || '#9a8a70', trim: o.trim || '#e8e2d4',
    sides, skip: [false, false, true, false], thick: 0.12, gable: o.gable ? { axis: 'z', yRidge: fy + h + (w / 2) * 0.6 } : null,
  });
  b.box('wood_raw', 0, fy - 0.3, 0, w, 0.3, d, { color: '#7a6a56', skip: 't' });
  ctx.floorLocal(0, 0, w - 0.2, d - 0.2, fy);
  if (o.gable) {
    roofGable(ctx, { W: w, D: d, yEave: fy + h, pitch: 0.6, axis: 'z', eave: 0.25, rake: 0.25, key: o.roofKey || 'metal_corr', color: o.roofColor || '#7a7e80', trim: o.trim || '#e8e2d4', cap: true, cz: 0.08, icicles: o.icicles });
  } else {
    roofShed(ctx, { W: w, D: d + 0.1, yLow: fy + h, yHigh: fy + h + 0.4, high: 'back', key: o.roofKey || 'metal_corr', color: o.roofColor || '#7a7e80', trim: o.trim || '#e8e2d4', eave: 0.3, rake: 0.2, icicles: o.icicles });
  }
  // light over the door
  let doorPos;
  if (side === 'front') doorPos = [0, d / 2];
  else if (side === 'right') doorPos = [w / 2, 0.1];
  else doorPos = [-w / 2, 0.1];
  const lx = side === 'front' ? 0.62 : 0, lz = side === 'front' ? d / 2 + 0.06 : 0.75;
  if (side === 'front') porchLight(ctx, lx, fy + 2.3, lz, 0, o.lightOn);
  const p = b.P(doorPos[0], 0, doorPos[1]);
  const rot = b.yaw() + (side === 'front' ? 0 : side === 'right' ? HALF_PI : -HALF_PI);
  ctx.colLocal(0, 0, w, d, fy + h);
  b.pop();
  return { x: p[0], z: p[2], rot };
}

/** Wall-mounted porch light (box + glowing globe). */
export function porchLight(ctx, x, y, z, rot = 0, on = true) {
  const b = ctx.b;
  b.push().translate(x, y, z).rotateY(rot);
  b.box('metal', 0, -0.04, -0.02, 0.1, 0.16, 0.04, { color: '#2a2a2a' });
  b.box('metal', 0, 0.06, 0.04, 0.16, 0.03, 0.14, { color: '#2a2a2a' });
  b.sphere(on ? 'neon' : 'glass_dark', 0, -0.02, 0.06, 0.06, { color: on ? [4.0, 2.6, 1.3] : '#888', rings: 5, segs: 8 });
  b.pop();
  if (on) ctx.light(x, y, z + 0.25, 0xffb46a, 1.6, 7, true);
}

/** Galvanised stovepipe rising from a roof point (x, yBase, z) to yTop, with a rain cap + brace. */
export function stovepipe(ctx, x, yBase, z, yTop, o = {}) {
  const b = ctx.b;
  const r = o.r ?? 0.09;
  const lean = o.lean || 0;
  b.push().translate(x, yBase, z).rotateZ(lean);
  const h = yTop - yBase;
  b.cyl('galv', 0, -0.4, 0, r, h + 0.4, { segs: 10, caps: '', color: o.color || '#b8bcbe' });
  b.cyl('galv', 0, -0.05, 0, r * 2.2, 0.12, { segs: 10, rTop: r * 1.1, color: '#8a8e90' }); // roof jack/flashing
  b.cyl('galv', 0, h * 0.5, 0, r * 1.08, 0.05, { segs: 10, color: '#9a9ea0' });
  b.cyl('galv', 0, h + 0.12, 0, r * 2.4, 0.16, { segs: 10, rTop: 0.01, color: '#9a9ea0', caps: 'b' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2;
    b.beam('galv', [Math.cos(a) * r * 0.8, h - 0.02, Math.sin(a) * r * 0.8], [Math.cos(a) * r * 1.6, h + 0.14, Math.sin(a) * r * 1.6], 0.015, 0.015, { color: '#8a8e90' });
  }
  b.pop();
  if (o.brace) b.beam('galv', [x, yBase + h * 0.7, z], [x + o.brace[0], yBase + o.brace[1], z + o.brace[2]], 0.02, 0.02, { color: '#8a8e90' });
  smokePoint(ctx, x, yTop + 0.3, z);
}

/** Register a smoke emitter point (stovepipe / chimney top): smoke, smoke2, … */
export function smokePoint(ctx, x, y, z) {
  let name = 'smoke', i = 1;
  while (ctx.points[name]) name = 'smoke' + ++i;
  ctx.pointLocal(name, x, y, z, 0);
}

/** Brick or block chimney box from y0 to y1 at (x, z). */
export function chimney(ctx, x, y0, z, y1, o = {}) {
  const b = ctx.b;
  const w = o.w ?? 0.55, d = o.d ?? 0.55;
  b.box(o.key || 'brick', x, y0, z, w, y1 - y0, d, { color: o.color || '#b8a090' });
  b.box('concrete', x, y1, z, w + 0.08, 0.08, d + 0.08, { color: '#8a8a84' });
  b.cyl('galv', x, y1 + 0.08, z, 0.09, 0.25, { segs: 8, color: '#9a9ea0' });
  smokePoint(ctx, x, y1 + 0.4, z);
}

/**
 * Sign board in the builder's current frame (facing +z), w × h at centre (x, y, z).
 * spec as getSignMaterial; key unique per sign text/style.
 */
export function sign(ctx, key, x, y, z, w, h, spec, o = {}) {
  const b = ctx.b;
  // the cache key covers the whole spec (text, glow, emissive, fade…; draw functions
  // pass a textKey) so different names/states never share a stale material
  key += '#' + hashString(JSON.stringify({ ...spec, w, h }) + (spec.textKey ?? ''));
  const mk = 'sign:' + key;
  b.materials.set(mk, getSignMaterial(key, { w, h, ...spec }));
  b.poly(mk, [[x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z]], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, 0, 1] });
  if (o.back) b.poly(mk, [[x + w / 2, y - h / 2, z - 0.001], [x - w / 2, y - h / 2, z - 0.001], [x - w / 2, y + h / 2, z - 0.001], [x + w / 2, y + h / 2, z - 0.001]], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, 0, -1] });
  if (o.board) b.box(o.boardKey || 'paint', x, y - h / 2 - 0.04, z - (o.boardT || 0.05) - 0.002, w + 0.1, h + 0.08, o.boardT || 0.05, { color: o.board });
}

/** Exterior gooseneck lamp shining on a sign: arm + shade + hot bulb (+ light). */
export function gooseneck(ctx, x, y, z, on = true) {
  const b = ctx.b;
  b.beam('metal', [x, y, z], [x, y + 0.15, z + 0.4], 0.025, 0.025, { color: '#2a3a2a' });
  b.cyl('metal', x, y + 0.08, z + 0.45, 0.16, 0.12, { rTop: 0.04, segs: 10, color: '#2a3a2a', caps: 't' });
  if (on) {
    b.cyl('neon', x, y + 0.07, z + 0.45, 0.13, 0.012, { segs: 10, caps: 'b', color: [5, 3.6, 2.2] });
    ctx.light(x, y - 0.3, z + 0.5, 0xffc890, 1.2, 5, true);
  }
}

/** Flag pole with a (US) flag. */
export function flagpole(ctx, x, z, h = 9, o = {}) {
  const b = ctx.b;
  b.cyl('galv', x, 0, z, 0.06, h, { rTop: 0.035, segs: 8, color: '#c8ccce' });
  b.sphere('gold', x, h + 0.05, z, 0.07, { rings: 4, segs: 8 });
  b.box('concrete', x, 0, z, 0.6, 0.15, 0.6, { color: '#9a9a94' });
  if (o.flag !== false) {
    const fw = 1.5, fh = 0.95;
    const fy = h - 0.15 - fh;
    const key = 'sign:flag_' + (o.flag || 'us');
    b.materials.set(key, getSignMaterial('flag_' + (o.flag || 'us'), { kind: 'paint', w: fw, h: fh, ppm: 96, draw: o.flag === 'ak' ? drawAkFlag : drawUsFlag }));
    // wavy flag: a few columns with a sine offset
    const nCol = 6;
    for (let i = 0; i < nCol; i++) {
      const t0 = i / nCol, t1 = (i + 1) / nCol;
      const w0 = Math.sin(t0 * 5) * 0.08 * t0, w1 = Math.sin(t1 * 5) * 0.08 * t1;
      const p0 = [x + 0.06 + t0 * fw, z + w0], p1 = [x + 0.06 + t1 * fw, z + w1];
      b.poly(key, [[p0[0], fy, p0[1]], [p1[0], fy, p1[1]], [p1[0], fy + fh, p1[1]], [p0[0], fy + fh, p0[1]]], { uv: [[t0, 0], [t1, 0], [t1, 1], [t0, 1]] });
      b.poly(key, [[p1[0], fy, p1[1]], [p0[0], fy, p0[1]], [p0[0], fy + fh, p0[1]], [p1[0], fy + fh, p1[1]]], { uv: [[t1, 0], [t0, 0], [t0, 1], [t1, 1]] });
    }
  }
}

function drawUsFlag(g, W, H) {
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 ? '#f2f2f2' : '#b22234';
    g.fillRect(0, (i * H) / 13, W, H / 13 + 1);
  }
  g.fillStyle = '#3c3b6e';
  g.fillRect(0, 0, W * 0.4, (H * 7) / 13);
  g.fillStyle = '#fff';
  for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) g.fillRect(W * 0.4 * ((c + (r % 2 ? 1 : 0.5)) / 6.2) - 1, (H * 7 / 13) * ((r + 0.6) / 9.6) - 1, 3, 3);
}
function drawAkFlag(g, W, H) {
  g.fillStyle = '#0f204b';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffb612';
  const st = [[0.15, 0.62], [0.24, 0.55], [0.32, 0.5], [0.38, 0.6], [0.44, 0.68], [0.52, 0.66], [0.62, 0.62]];
  for (const [x, y] of st) g.fillRect(x * W - 3, y * H - 3, 6, 6);
  g.fillRect(0.82 * W - 5, 0.22 * H - 5, 10, 10);
}

/** Simple interior lamp: a glowing shade (emissive) + returned light source. */
export function ceilingLamp(ctx, x, y, z, o = {}) {
  const b = ctx.b;
  const k = o.key || 'i:neon';
  b.cylBetween('i:metal', [x, y, z], [x, y - (o.drop ?? 0.35), z], 0.006, { segs: 4, color: '#222' });
  const yl = y - (o.drop ?? 0.35);
  b.cyl('i:metal', x, yl - 0.12, z, o.r ?? 0.2, 0.14, { rTop: 0.06, segs: 12, color: o.shade || '#2f4a3a', caps: '' });
  b.sphere(k, x, yl - 0.1, z, 0.06, { color: o.glow || [6, 4.6, 3], rings: 4, segs: 8 });
  if (o.light !== false) ctx.light(x, yl - 0.2, z, o.lightColor ?? 0xffcf96, o.intensity ?? 2.2, o.distance ?? 7, o.local);
}

/** Fluorescent tube fixture (cold) for stores / offices. */
export function tubeLight(ctx, x, y, z, len = 1.2, o = {}) {
  const b = ctx.b;
  b.box('i:metal', x, y - 0.05, z, o.rot ? 0.2 : len, 0.05, o.rot ? len : 0.2, { color: '#d8d8d4' });
  b.box('i:neon', x, y - 0.075, z, o.rot ? 0.14 : len - 0.08, 0.025, o.rot ? len - 0.08 : 0.14, { color: o.color || [5.5, 5.8, 5.6] });
}

/** Seeded choice helpers. */
export function pick(ctx, arr) { return arr[Math.floor(ctx.rng() * arr.length)]; }
export function chance(ctx, p) { return ctx.rng() < p; }
export function range(ctx, a, b) { return a + (b - a) * ctx.rng(); }

/** Decide a window's condition from wear. */
export function windowCond(ctx, extra = 0) {
  const w = ctx.wear;
  const r = ctx.rng();
  if (w > 0.55 && r < (w - 0.5) * 0.9 + extra) return 'boarded';
  if (w > 0.4 && r < (w - 0.35) * 1.1 + extra) return 'broken';
  return 'ok';
}

export { rgb, weather, getMaterial };
