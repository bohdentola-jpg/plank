// Interior kit: floors, ceilings, partitions, wall colliders with door gaps and
// furniture. Everything goes into the builder's interior ('i:') buckets. Each
// helper takes (ctx, x, y, z, rot, opts) in the building frame (y = floor).
import { rgb, weather } from '../geom.js';
import { getSignMaterial, windowCellUV } from '../materials.js';
import { LIGHT } from './common.js';

const HP = Math.PI / 2, PI = Math.PI;

/** Enter a local frame at (x, y, z) rotated by rot (caller pops via the returned fn). */
function at(ctx, x, y, z, rot = 0) { ctx.b.push().translate(x, y, z).rotateY(rot); return () => ctx.b.pop(); }

// ------------------------------------------------------------------ shell

/** Floor slab top at y over a W×D rect centred (cx, cz). */
export function floor(ctx, cx, cz, W, D, y, key = 'floor_wood', color = '#ffffff') {
  ctx.b.box('i:' + key, cx, y - 0.05, cz, W, 0.05, D, { color, skip: 'b' });
}

/** Ceiling (facing down) at height y. */
export function ceiling(ctx, cx, cz, W, D, y, key = 'plaster', color = '#e8e4da') {
  ctx.b.poly('i:' + key, [[cx - W / 2, y, cz - D / 2], [cx + W / 2, y, cz - D / 2], [cx + W / 2, y, cz + D / 2], [cx - W / 2, y, cz + D / 2]], { color, want: [0, -1, 0] });
}

/**
 * Interior partition wall from (x0,z0) to (x1,z1), height h, thickness t,
 * with optional door gaps [{at (m from start), w}] — adds colliders too.
 */
export function partition(ctx, x0, z0, x1, z1, y, h, o = {}) {
  const b = ctx.b;
  const t = o.t ?? 0.12;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const rot = Math.atan2(x1 - x0, z1 - z0) - HP;
  const gaps = (o.doors || []).slice().sort((a, c) => a.at - c.at);
  const key = 'i:' + (o.key || 'plaster'), col = o.color || '#ddd6c8';
  b.push().translate(x0, y, z0).rotateY(rot);
  let u = 0;
  const seg = (a, c) => {
    if (c - a < 0.02) return;
    b.boxMinMax(key, a, 0, -t / 2, c, h, t / 2, { color: col });
    const p = b.P((a + c) / 2, 0, 0);
    ctx.colliders.push({ x: p[0], z: p[2], w: c - a, d: t + 0.05, rot: b.yaw(), h });
  };
  for (const g of gaps) {
    seg(u, g.at - g.w / 2);
    // header over the door + casing
    b.boxMinMax(key, g.at - g.w / 2, g.h ?? 2.1, -t / 2, g.at + g.w / 2, h, t / 2, { color: col });
    for (const s of [-1, 1]) {
      b.boxMinMax('i:paint', g.at - g.w / 2 - 0.07, 0, s * t / 2, g.at - g.w / 2, (g.h ?? 2.1) + 0.07, s * (t / 2 + 0.015), { color: o.trim || '#e8e2d4' });
      b.boxMinMax('i:paint', g.at + g.w / 2, 0, s * t / 2, g.at + g.w / 2 + 0.07, (g.h ?? 2.1) + 0.07, s * (t / 2 + 0.015), { color: o.trim || '#e8e2d4' });
      b.boxMinMax('i:paint', g.at - g.w / 2, g.h ?? 2.1, s * t / 2, g.at + g.w / 2, (g.h ?? 2.1) + 0.07, s * (t / 2 + 0.015), { color: o.trim || '#e8e2d4' });
    }
    if (g.leaf) {
      // an open door leaf against the wall
      b.push().translate(g.at - g.w / 2, 0, t / 2).rotateY(-1.3);
      b.box('i:paint', g.w / 2, 0.01, 0.02, g.w - 0.02, 2.04, 0.04, { color: g.color || '#8a6a4a' });
      b.pop();
    }
    u = g.at + g.w / 2;
  }
  seg(u, len);
  if (o.base !== false) for (const s of [-1, 1]) b.boxMinMax('i:paint', 0, 0, s * t / 2, len, 0.1, s * (t / 2 + 0.012), { color: o.trim || '#e8e2d4' });
  b.pop();
}

/**
 * Colliders for the 4 exterior walls of a W×D body when the interior is open:
 * wall segments with gaps at doors [{side (0 front,1 right,2 back,3 left), u, w}].
 */
export function wallColliders(ctx, W, D, cx = 0, cz = 0, doors = [], h = 3, t = 0.3) {
  for (let s = 0; s < 4; s++) {
    const len = s % 2 === 0 ? W : D;
    const gaps = doors.filter((d) => d.side === s).sort((a, c) => a.u - c.u);
    let u = 0;
    const seg = (a, c) => {
      if (c - a < 0.05) return;
      const m = (a + c) / 2;
      let x, z, rot;
      if (s === 0) { x = cx - W / 2 + m; z = cz + D / 2 - t / 2; rot = 0; }
      else if (s === 1) { x = cx + W / 2 - t / 2; z = cz + D / 2 - m; rot = HP; }
      else if (s === 2) { x = cx + W / 2 - m; z = cz - D / 2 + t / 2; rot = 0; }
      else { x = cx - W / 2 + t / 2; z = cz - D / 2 + m; rot = HP; }
      ctx.col(x, z, c - a, t, h, rot);
    };
    for (const g of gaps) { seg(u, g.u - g.w / 2); u = g.u + g.w / 2; }
    seg(u, len);
  }
}

// ------------------------------------------------------------------ furniture

export function table(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 1.2, d = o.d ?? 0.8, h = o.h ?? 0.75;
  const key = 'i:' + (o.key || 'wood_dark'), col = o.color || '#c8a880';
  if (o.round) {
    b.cyl(key, 0, h - 0.04, 0, w / 2, 0.04, { segs: 16, color: col });
    b.cyl('i:metal', 0, 0, 0, 0.04, h - 0.04, { segs: 6, color: '#2a2a2a' });
    b.cyl('i:metal', 0, 0, 0, 0.25, 0.03, { segs: 10, color: '#2a2a2a' });
  } else {
    b.box(key, 0, h - 0.04, 0, w, 0.04, d, { color: col });
    if (o.cloth) b.box('i:fabric', 0, h, 0, w + 0.1, 0.005, d + 0.1, { color: o.cloth });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(key, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), 0.05, h - 0.04, 0.05, { color: rgb(col, 0.8) });
  }
  if (o.collide !== false) ctx.colLocal(0, 0, w, d, h);
  pop();
}

export function chair(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, col = o.color || '#7a5a3a', key = 'i:' + (o.key || 'wood_dark');
  if (o.folding) {
    b.box('i:metal', 0, 0.44, 0, 0.42, 0.03, 0.42, { color: col });
    b.box('i:metal', 0, 0.6, -0.2, 0.42, 0.35, 0.02, { color: col });
    for (const sx of [-1, 1]) {
      b.beam('i:metal', [sx * 0.19, 0, 0.2], [sx * 0.19, 0.9, -0.21], 0.02, 0.02, { color: '#5a5a5a' });
      b.beam('i:metal', [sx * 0.19, 0, -0.2], [sx * 0.19, 0.45, 0.15], 0.02, 0.02, { color: '#5a5a5a' });
    }
  } else {
    b.box(key, 0, 0.42, 0, 0.42, 0.04, 0.42, { color: col });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(key, sx * 0.18, 0, sz * 0.18, 0.035, 0.42, 0.035, { color: rgb(col, 0.85) });
    for (const sx of [-1, 1]) b.box(key, sx * 0.18, 0.46, -0.18, 0.035, 0.48, 0.035, { color: rgb(col, 0.85) });
    b.box(key, 0, 0.75, -0.18, 0.4, 0.14, 0.025, { color: col });
  }
  pop();
}

export function stool(ctx, x, y, z, o = {}) {
  const b = ctx.b;
  b.cyl('i:chrome', x, y, z, 0.03, 0.72, { segs: 6, color: '#d8dcdc' });
  b.cyl('i:chrome', x, y, z, 0.2, 0.02, { segs: 10, color: '#c8cccc' });
  b.cyl('i:leather', x, y + 0.72, z, 0.19, 0.08, { segs: 12, color: o.color || '#a81a1a' });
  b.cyl('i:chrome', x, y + 0.25, z, 0.17, 0.015, { segs: 10, color: '#d8dcdc', caps: '' });
}

export function bed(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 1.0, l = 2.0;
  b.box('i:wood_dark', 0, 0, 0, w + 0.06, 0.3, l + 0.06, { color: '#a88a6a' });
  b.box('i:fabric', 0, 0.3, 0.05, w, 0.2, l - 0.1, { color: '#e8e2d8' });
  b.box('i:fabric', 0, 0.5, 0.25, w + 0.04, 0.08, l - 0.5, { color: o.blanket || '#7a2a2a' });
  b.box('i:fabric', 0, 0.5, -l / 2 + 0.3, w - 0.2, 0.12, 0.4, { color: '#f0ece4' });
  b.box('i:wood_dark', 0, 0, -l / 2 - 0.03, w + 0.1, 0.95, 0.06, { color: '#8a6a4a' });
  b.box('i:wood_dark', 0, 0, l / 2 + 0.03, w + 0.1, 0.55, 0.06, { color: '#8a6a4a' });
  ctx.colLocal(0, 0, w + 0.1, l + 0.1, 0.6);
  pop();
}

export function desk(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 1.4, d = o.d ?? 0.7;
  const col = o.color || '#8a6a4a', key = 'i:' + (o.key || 'wood_dark');
  b.box(key, 0, 0.72, 0, w, 0.04, d, { color: col });
  b.box(key, w / 2 - 0.22, 0, 0, 0.42, 0.72, d - 0.04, { color: rgb(col, 0.9) });
  for (let i = 0; i < 3; i++) b.box('i:metal', w / 2 - 0.22, 0.12 + i * 0.22, d / 2 - 0.015, 0.12, 0.02, 0.02, { color: '#c8b070' });
  b.box(key, -w / 2 + 0.03, 0, 0, 0.04, 0.72, d - 0.04, { color: rgb(col, 0.9) });
  ctx.colLocal(0, 0, w, d, 0.76);
  pop();
}

/** Laptop with a glowing screen (open toward +z of its frame). */
export function laptop(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b;
  b.box('i:plastic', 0, 0, 0, 0.34, 0.02, 0.24, { color: '#2a2c30' });
  b.push().translate(0, 0.02, -0.12).rotateX(-0.25);
  b.box('i:plastic', 0, 0, -0.01, 0.34, 0.23, 0.012, { color: '#2a2c30' });
  b.box('i:neon', 0, 0.015, 0.0, 0.31, 0.2, 0.002, { color: o.screen || [0.9, 1.3, 1.6] });
  b.pop();
  pop();
}

export function crtMonitor(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b;
  b.box('i:plastic', 0, 0, -0.05, 0.4, 0.36, 0.38, { color: '#c8c4b8' });
  b.box('i:neon', 0, 0.06, 0.142, 0.32, 0.25, 0.005, { color: o.screen || [0.5, 1.6, 0.8] });
  pop();
}

export function flatScreen(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 0.6, h = o.h ?? 0.36;
  b.box('i:plastic', 0, 0, 0, w + 0.03, h + 0.03, 0.04, { color: '#111214' });
  b.box('i:neon', 0, 0.015, 0.021, w, h, 0.002, { color: o.screen || [0.6, 0.9, 1.3] });
  if (o.stand !== false) b.box('i:plastic', 0, -0.12, -0.03, 0.06, 0.14, 0.04, { color: '#111214' });
  pop();
}

export function woodStove(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b;
  b.box('i:stone', 0, 0, 0, 1.1, 0.06, 1.0, { color: '#6a6a66' });
  b.box('i:metal', 0, 0.18, 0, 0.62, 0.55, 0.5, { color: '#1a1a1a' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('i:metal', sx * 0.26, 0.06, sz * 0.2, 0.05, 0.12, 0.05, { color: '#1a1a1a' });
  b.box('i:metal', 0, 0.72, 0, 0.66, 0.04, 0.54, { color: '#222' });
  // fire window glow
  b.box('i:neon', 0, 0.3, 0.252, 0.3, 0.2, 0.004, { color: [6, 2.2, 0.5] });
  b.box('i:metal', 0, 0.28, 0.255, 0.36, 0.26, 0.002, { color: '#2a2a2a', skip: 'f' });
  // stovepipe up
  b.cyl('i:metal', 0, 0.76, -0.1, 0.075, o.pipe ?? 1.9, { segs: 10, color: '#1e1e1e', caps: '' });
  ctx.colLocal(0, 0, 0.7, 0.6, 0.8);
  ctx.light(0, 0.5, 0.5, 0xff8a3a, 1.4, 5, true);
  pop();
}

export function wardrobe(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, col = o.color || '#7a5a3a';
  b.box('i:wood_dark', 0, 0, 0, 1.0, 1.95, 0.58, { color: col });
  b.box('i:wood_dark', 0, 1.95, 0, 1.06, 0.06, 0.62, { color: rgb(col, 0.9) });
  b.box('i:wood_dark', 0, 0.05, 0.292, 0.005, 1.85, 0.004, { color: '#2a1a10' });
  for (const sx of [-1, 1]) b.box('i:metal', sx * 0.06, 1.0, 0.3, 0.02, 0.12, 0.02, { color: '#c8b070' });
  ctx.colLocal(0, 0, 1.0, 0.6, 2);
  pop();
}

/** Old shortwave radio (glowing dial). */
export function radio(ctx, x, y, z, rot = 0) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b;
  b.box('i:wood_dark', 0, 0, 0, 0.5, 0.28, 0.25, { color: '#6a4a2a' });
  b.box('i:neon', -0.08, 0.14, 0.126, 0.22, 0.07, 0.003, { color: [3.0, 2.0, 0.8] });
  for (const kx of [0.12, 0.19]) { b.push().translate(kx, 0.13, 0.13).rotateX(HP); b.cyl('i:plastic', 0, 0, 0, 0.025, 0.03, { segs: 8, color: '#1a1a1a' }); b.pop(); }
  b.cylBetween('i:chrome', [0.2, 0.28, -0.05], [0.35, 0.9, -0.1], 0.004, { segs: 4, color: '#d8d8d8' });
  pop();
}

export function workbench(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 1.8, r = ctx.rng;
  b.box('i:wood_raw', 0, 0.86, 0, w, 0.06, 0.7, { color: '#b89a74' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('i:wood_raw', sx * (w / 2 - 0.06), 0, sz * 0.28, 0.08, 0.86, 0.08, { color: '#8a7058' });
  b.box('i:wood_raw', 0, 0.2, 0, w - 0.1, 0.03, 0.6, { color: '#8a7058' });
  // pegboard + tools
  b.box('i:osb', 0, 0.95, -0.36, w, 0.9, 0.02, { color: '#c8a070' });
  for (let i = 0; i < 7; i++) b.box('i:metal', -w / 2 + 0.2 + i * (w - 0.4) / 6, 1.2 + r() * 0.4, -0.34, 0.03 + r() * 0.05, 0.15 + r() * 0.2, 0.02, { color: r() < 0.5 ? '#b81a1a' : '#5a5a5a' });
  b.box('i:metal', 0.5, 0.92, 0.05, 0.35, 0.18, 0.2, { color: '#3a4a6a' }); // tool box
  b.box('i:metal', -0.6, 0.92, 0.12, 0.18, 0.12, 0.14, { color: '#2a2a2a' }); // vise
  ctx.colLocal(0, 0, w, 0.75, 0.9);
  pop();
}

/** Kitchen run: base cabinets + counter + sink + uppers (length w along x). */
export function kitchen(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 2.4;
  const cab = o.color || '#c8b898';
  b.box('i:wood_dark', 0, 0.1, 0, w, 0.78, 0.6, { color: cab });
  b.box('i:solid', 0, 0, 0.02, w - 0.04, 0.1, 0.55, { color: '#2a2a2a' });
  b.box('i:stone', 0, 0.88, 0.01, w + 0.02, 0.04, 0.64, { color: o.top || '#8a8478' });
  for (let i = 0; i < Math.floor(w / 0.6); i++) b.box('i:wood_dark', -w / 2 + 0.3 + i * 0.6, 0.15, 0.302, 0.56, 0.7, 0.006, { color: rgb(cab, 0.92) });
  b.box('i:chrome', -w / 4, 0.86, 0.0, 0.5, 0.05, 0.4, { color: '#a8acae' }); // sink
  b.cylBetween('i:chrome', [-w / 4, 0.9, -0.25], [-w / 4, 1.15, -0.15], 0.015, { segs: 6, color: '#c8cccc' });
  if (o.uppers !== false) {
    b.box('i:wood_dark', 0, 1.45, -0.12, w, 0.7, 0.35, { color: cab });
    for (let i = 0; i < Math.floor(w / 0.6); i++) b.box('i:wood_dark', -w / 2 + 0.3 + i * 0.6, 1.47, 0.053, 0.56, 0.66, 0.006, { color: rgb(cab, 0.92) });
  }
  if (o.stove) {
    b.box('i:sheet_metal', w / 2 + 0.38, 0, 0, 0.76, 0.92, 0.62, { color: '#e8e4dc' });
    for (const [sx, sz] of [[-0.18, -0.13], [0.18, -0.13], [-0.18, 0.13], [0.18, 0.13]]) b.cyl('i:metal', w / 2 + 0.38 + sx, 0.92, sz, 0.09, 0.01, { segs: 10, color: '#1a1a1a' });
  }
  if (o.fridge) {
    b.box('i:sheet_metal', -w / 2 - 0.42, 0, 0, 0.8, 1.8, 0.7, { color: '#e8e4dc' });
    b.box('i:metal', -w / 2 - 0.1, 0.9, 0.36, 0.03, 0.4, 0.03, { color: '#9a9a9a' });
  }
  ctx.colLocal(0, 0, w + (o.stove ? 0.8 : 0) + (o.fridge ? 0.8 : 0), 0.65, 0.95);
  pop();
}

/** Shelving unit stocked with goods (length w, levels n). */
export function shelf(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, r = ctx.rng;
  const w = o.w ?? 2.0, h = o.h ?? 1.9, d = o.d ?? 0.45, n = o.levels ?? 5;
  const key = 'i:' + (o.key || 'wood_dark'), col = o.color || '#8a6a4a';
  const two = o.double;
  for (const sx of [-1, 1]) b.box(key, sx * (w / 2 - 0.02), 0, 0, 0.04, h, d * (two ? 2 : 1), { color: col });
  if (!two) b.box(key, 0, 0, -d / 2 + 0.01, w, h, 0.02, { color: rgb(col, 0.85) });
  else b.box(key, 0, 0.1, 0, w, h - 0.1, 0.02, { color: rgb(col, 0.85) });
  const pal = o.palette || ['#b81a1a', '#e8c020', '#2a5aa8', '#e8e4dc', '#2a7a3a', '#d86a1a', '#6a2a8a', '#c8a070', '#1a1a1a'];
  for (let i = 0; i < n; i++) {
    const yy = 0.1 + (i * (h - 0.2)) / (n - 1 || 1);
    for (const side of two ? [-1, 1] : [1]) {
      const zc = two ? side * d / 2 : 0;
      b.box(key, 0, yy - 0.025, zc, w - 0.04, 0.025, d, { color: rgb(col, 0.95) });
      if (i === n - 1 && !o.topGoods) continue;
      let xx = -w / 2 + 0.06;
      while (xx < w / 2 - 0.1) {
        const gw = 0.06 + r() * 0.14, gh = 0.08 + r() * 0.2;
        if (r() < (o.sparse ?? 0.12)) { xx += gw + 0.04; continue; }
        const c = pal[(r() * pal.length) | 0];
        if (r() < 0.35) b.cyl('i:plastic', xx + gw / 2, yy, zc + side * 0.02, gw * 0.45, gh, { segs: 6, color: c });
        else b.box('i:plastic', xx + gw / 2, yy, zc + side * 0.02, gw, gh, d * 0.7, { color: c });
        xx += gw + 0.015;
      }
    }
  }
  ctx.colLocal(0, 0, w, d * (two ? 2 : 1), h);
  pop();
}

/** Shop counter with an optional cash register. */
export function counter(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 2.4, d = o.d ?? 0.65, h = o.h ?? 0.95;
  const key = 'i:' + (o.key || 'wood_dark'), col = o.color || '#7a5232';
  b.box(key, 0, 0, 0, w, h - 0.04, d, { color: col });
  b.box(o.topKey ? 'i:' + o.topKey : key, 0, h - 0.04, 0, w + 0.08, 0.04, d + 0.08, { color: o.top || rgb(col, 1.1) });
  if (o.panels !== false) for (let i = 0; i < Math.floor(w / 0.6); i++) b.box(key, -w / 2 + 0.3 + i * 0.6, 0.12, d / 2 + 0.004, 0.5, h - 0.3, 0.012, { color: rgb(col, 0.9) });
  if (o.register === 'old') {
    // brass National-style register
    b.push().translate(o.regX ?? w / 3, h, 0);
    b.box('i:gold_dull', 0, 0, 0, 0.42, 0.25, 0.4, { color: '#a88a4a' });
    b.poly('i:gold_dull', [[-0.21, 0.25, 0.2], [0.21, 0.25, 0.2], [0.21, 0.42, -0.05], [-0.21, 0.42, -0.05]], { color: '#b89a5a', want: [0, 1, 1] });
    b.box('i:gold_dull', 0, 0.25, -0.12, 0.42, 0.28, 0.16, { color: '#a88a4a' });
    b.box('i:paint', 0, 0.5, -0.12, 0.3, 0.1, 0.02, { color: '#f0e8d0' });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.cyl('i:plastic', -0.14 + i * 0.09, 0.27 + j * 0.05, 0.12 - j * 0.07, 0.018, 0.02, { segs: 6, color: '#e8e2d0' });
    b.pop();
  } else if (o.register === 'pos') {
    b.push().translate(o.regX ?? w / 3, h, 0);
    b.box('i:plastic', 0, 0, 0, 0.4, 0.08, 0.35, { color: '#1a1a1c' });
    b.push().translate(0, 0.1, -0.05).rotateX(-0.3);
    b.box('i:plastic', 0, 0, 0, 0.36, 0.25, 0.03, { color: '#1a1a1c' });
    b.box('i:neon', 0, 0.02, 0.016, 0.32, 0.2, 0.002, { color: [0.8, 1.4, 1.8] });
    b.pop();
    b.box('i:plastic', 0.3, 0, 0.1, 0.12, 0.05, 0.18, { color: '#2a2a2c' });
    b.pop();
  }
  ctx.colLocal(0, 0, w, d, h);
  pop();
}

/** Diner booth pair facing each other along z, with a table (centre x, z). */
export function booth(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 1.2;
  const vin = o.color || '#b01818';
  for (const s of [-1, 1]) {
    b.box('i:chrome', 0, 0, s * 0.85, w, 0.42, 0.5, { color: '#d8dcdc' });
    b.box('i:leather', 0, 0.42, s * 0.85, w - 0.04, 0.1, 0.48, { color: vin });
    b.box('i:leather', 0, 0.45, s * 1.06, w - 0.04, 0.68, 0.14, { color: vin, rx: s * 0.08 });
    b.box('i:chrome', 0, 1.12, s * 1.08, w, 0.04, 0.2, { color: '#d8dcdc' });
  }
  b.box('i:plastic', 0, 0.72, 0, w - 0.1, 0.04, 0.75, { color: o.top || '#e8dcc8' });
  b.box('i:chrome', 0, 0.7, 0, w - 0.08, 0.025, 0.77, { color: '#c8cccc' });
  b.cyl('i:chrome', 0, 0, 0, 0.04, 0.7, { segs: 8, color: '#c8cccc' });
  // napkin dispenser + sugar
  b.box('i:chrome', -w / 2 + 0.2, 0.76, 0, 0.1, 0.12, 0.08, { color: '#d8dcdc' });
  b.cyl('i:glass_dark', -w / 2 + 0.32, 0.76, 0.05, 0.03, 0.12, { segs: 6, color: '#888' });
  ctx.colLocal(0, 0, w, 2.3, 1.1);
  pop();
}

export function sofa(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 2.0, col = o.color || '#5a4a3a';
  b.box('i:fabric', 0, 0.1, 0, w, 0.35, 0.85, { color: col });
  b.box('i:fabric', 0, 0.45, -0.32, w, 0.45, 0.22, { color: rgb(col, 0.9) });
  for (const sx of [-1, 1]) b.box('i:fabric', sx * (w / 2 - 0.1), 0.1, 0, 0.2, 0.55, 0.85, { color: rgb(col, 0.95) });
  ctx.colLocal(0, 0, w, 0.9, 0.9);
  pop();
}

export function rug(ctx, x, y, z, w, d, color = '#7a2a2a', rot = 0) {
  const pop = at(ctx, x, y, z, rot);
  ctx.b.box('i:carpet', 0, 0.002, 0, w, 0.012, d, { color });
  ctx.b.box('i:carpet', 0, 0.004, 0, w - 0.2, 0.012, d - 0.2, { color: rgb(color, 1.25) });
  pop();
}

export function filingCabinet(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, n = o.drawers ?? 4, col = o.color || '#8a8e88';
  b.box('i:sheet_metal', 0, 0, 0, 0.46, 0.33 * n, 0.62, { color: col });
  for (let i = 0; i < n; i++) {
    b.box('i:sheet_metal', 0, 0.02 + i * 0.33, 0.311, 0.42, 0.3, 0.008, { color: rgb(col, 1.05) });
    b.box('i:chrome', 0, 0.22 + i * 0.33, 0.32, 0.12, 0.02, 0.02, { color: '#c8cccc' });
  }
  ctx.colLocal(0, 0, 0.46, 0.62, 0.33 * n);
  pop();
}

/** Wall safe (set into a wall facing +z of its frame). */
export function wallSafe(ctx, x, y, z, rot = 0) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b;
  b.box('i:metal', 0, 0, 0, 0.5, 0.5, 0.06, { color: '#2a2e30' });
  b.box('i:metal', 0, 0.03, 0.03, 0.44, 0.44, 0.02, { color: '#3a4044' });
  b.push().translate(0, 0.25, 0.05).rotateX(HP);
  b.cyl('i:chrome', 0, 0, 0, 0.06, 0.03, { segs: 14, color: '#c8cccc' });
  b.pop();
  b.box('i:chrome', 0.14, 0.24, 0.05, 0.03, 0.08, 0.03, { color: '#c8cccc' });
  pop();
}

/** Picture/poster/icon on a wall: canvas sign material. */
export function wallPicture(ctx, key, x, y, z, rot, w, h, spec, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b;
  const mk = 'i:sign:' + key;
  b.materials.set(mk, getSignMaterial(key, { w, h, kind: 'paint', ...spec }));
  if (o.frame !== false) b.box(o.frameKey || 'i:wood_dark', 0, -h / 2 - 0.04, 0, w + 0.08, h + 0.08, 0.025, { color: o.frame || '#4a3020' });
  b.poly(mk, [[-w / 2, -h / 2, 0.027], [w / 2, -h / 2, 0.027], [w / 2, h / 2, 0.027], [-w / 2, h / 2, 0.027]], { uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, 0, 1] });
  pop();
}

/** Glass-door cooler (glowing) — length w. */
export function cooler(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 2.4, h = 2.1, r = ctx.rng;
  b.box('i:sheet_metal', 0, 0, 0, w, h, 0.75, { color: o.color || '#e8eaec' });
  const nd = Math.max(1, Math.round(w / 0.76));
  for (let i = 0; i < nd; i++) {
    const x0 = -w / 2 + (i * w) / nd + 0.04, x1 = -w / 2 + ((i + 1) * w) / nd - 0.04;
    // goods behind glass
    for (let l = 0; l < 5; l++) for (let k = 0; k < 6; k++) {
      const c = ['#b81a1a', '#1a5aa8', '#e8e8e0', '#2a8a3a', '#e8a020', '#1a1a1a'][(r() * 6) | 0];
      b.box('i:plastic', x0 + 0.06 + k * (x1 - x0 - 0.1) / 6, 0.25 + l * 0.36, 0.3, 0.07, 0.22, 0.07, { color: c });
    }
    b.box('i:neon', (x0 + x1) / 2, h - 0.12, 0.33, x1 - x0 - 0.06, 0.03, 0.02, { color: o.glow || [5, 5.4, 5.6] });
    b.poly('i:glass_dark', [[x0, 0.15, 0.38], [x1, 0.15, 0.38], [x1, h - 0.15, 0.38], [x0, h - 0.15, 0.38]], { color: [0, 0, 0], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], want: [0, 0, 1] });
    b.boxMinMax('i:chrome', x1 - 0.06, 0.8, 0.38, x1 - 0.04, 1.4, 0.42, { color: '#c8cccc' });
  }
  ctx.colLocal(0, 0, w, 0.8, h);
  ctx.light(0, h * 0.6, 0.6, 0xe8f4ff, 0.8, 4, true);
  pop();
}

/** Server rack with blinking LEDs. */
export function serverRack(ctx, x, y, z, rot = 0) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, r = ctx.rng;
  b.box('i:metal', 0, 0, 0, 0.6, 2.0, 1.0, { color: '#16181a' });
  for (let i = 0; i < 14; i++) {
    b.box('i:metal', 0, 0.12 + i * 0.13, 0.501, 0.54, 0.1, 0.005, { color: '#26292c' });
    for (let k = 0; k < 4; k++) if (r() < 0.7) b.box('i:neon', -0.22 + k * 0.03, 0.15 + i * 0.13, 0.505, 0.012, 0.012, 0.003, { color: r() < 0.7 ? [0.3, 3.5, 0.6] : r() < 0.5 ? [3.5, 2.0, 0.2] : [0.3, 1.2, 4.0] });
  }
  ctx.colLocal(0, 0, 0.6, 1.0, 2.0);
  pop();
}

/** Wooden bench/pew. */
export function bench(ctx, x, y, z, rot = 0, o = {}) {
  const pop = at(ctx, x, y, z, rot);
  const b = ctx.b, w = o.w ?? 1.8, col = o.color || '#7a5a3a';
  b.box('i:wood_dark', 0, 0.42, 0, w, 0.05, 0.4, { color: col });
  for (const sx of [-1, 1]) b.box('i:wood_dark', sx * (w / 2 - 0.05), 0, 0, 0.05, 0.42, 0.38, { color: rgb(col, 0.85) });
  if (o.back !== false) b.box('i:wood_dark', 0, 0.55, -0.18, w, 0.4, 0.04, { color: col });
  ctx.colLocal(0, 0, w, 0.45, 0.5);
  pop();
}

/** A window-like glowing "lit sign" in a frame (open/closed, etc.). */
export function glowPanel(ctx, x, y, z, rot, w, h, color) {
  const pop = at(ctx, x, y, z, rot);
  ctx.b.box('i:neon', 0, 0, 0, w, h, 0.01, { color });
  pop();
}

/** A simple ladder from (x, y0, z) up to y1, facing +z of its frame. */
export function ladder(ctx, x, y0, z, y1, rot = 0, o = {}) {
  const pop = at(ctx, x, y0, z, rot);
  const b = ctx.b, w = o.w ?? 0.5;
  const key = o.key || 'i:wood_raw';
  for (const sx of [-1, 1]) b.box(key, sx * w / 2, 0, 0, 0.06, y1 - y0, 0.08, { color: '#8a7058' });
  for (let yy = 0.3; yy < y1 - y0 - 0.1; yy += 0.3) b.box(key, 0, yy, 0, w, 0.035, 0.05, { color: '#9a8066' });
  pop();
}

export { LIGHT, windowCellUV, weather };
